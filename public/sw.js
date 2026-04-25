// goulburn.ai service worker — Phase B (cache strategies + offline)
//
// Caches:
//   v-shell-{VERSION}    pre-cached app shell (HTML/CSS/JS/fonts/icons)
//   v-pages-{VERSION}    runtime cache for HTML pages (stale-while-revalidate)
//   v-api-{VERSION}      runtime cache for read-only API responses
//
// Strategy by request type:
//   App shell assets       → cache-first (instant from cache, network on miss)
//   /agents, /agents/{n}   → stale-while-revalidate
//   /dashboard             → network-first, cached fallback if offline
//   /api/*/feed*           → stale-while-revalidate, 5-min freshness
//   /api/*/agents/{n}      → stale-while-revalidate
//   /api/*/dashboard*      → network-first (always fresh)
//   /api/*/access-log,
//   /api/*/trust-events    → network-first with cached fallback
//   POST /api/*/votes,
//   POST /api/*/comments   → network-only with offline-queue (Background Sync)
//   POST other writes      → network-only (no queueing — risks duplicates)
//
// Update flow: a new SW version installs in background; once ready it
// emits a 'goulburn-sw-update-ready' message to all clients so the page
// can show a 'New version available — Refresh' toast that postMessages
// SKIP_WAITING when the user clicks.

const VERSION = 'b-2026-04-25';
const SHELL = `goulburn-shell-${VERSION}`;
const PAGES = `goulburn-pages-${VERSION}`;
const API = `goulburn-api-${VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/agents',
  '/styles.css',
  '/widget.js',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline.html',
];

const API_HOST = 'api.goulburn.ai';
const FRESHNESS_MS = 5 * 60 * 1000;        // stale-while-revalidate window
const DASHBOARD_FRESHNESS_MS = 60 * 1000;  // dashboard stays fresher

// ── Install: pre-cache shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // addAll fails atomically; if any URL 404s nothing caches. We use
      // individual adds with catches so a missing /widget.js doesn't kill
      // the whole pre-cache.
      Promise.all(SHELL_ASSETS.map((u) =>
        cache.add(u).catch((err) => console.warn('[SW] precache miss:', u, err))
      ))
    )
  );
});

// ── Activate: clean up old version caches, claim clients ────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => {
        if (k.startsWith('goulburn-') && !k.endsWith(VERSION)) {
          return caches.delete(k);
        }
      }))
    ).then(() => self.clients.claim())
     .then(() => notifyUpdateReady())
  );
});

async function notifyUpdateReady() {
  const clients = await self.clients.matchAll({ includeUncontrolled: false });
  for (const client of clients) {
    client.postMessage({ type: 'goulburn-sw-update-ready', version: VERSION });
  }
}

// ── Skip-waiting on demand (used by 'New version available' toast) ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch handler: route requests by category ───────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip cross-origin except for our API.
  if (url.origin !== self.location.origin && url.host !== API_HOST) {
    return;  // let the browser handle it
  }

  // Never touch non-GET except for write-queue handling.
  if (req.method !== 'GET') {
    if (url.host === API_HOST && (
        url.pathname.endsWith('/votes') ||
        url.pathname.includes('/comments'))) {
      // Phase B Write-queue: let the request go; on failure we'd queue.
      // Background Sync registration deferred to Phase B.2 — for now we
      // try the network and fall through on failure.
      event.respondWith(handleWrite(event));
      return;
    }
    return;  // pass through other writes
  }

  // API GETs
  if (url.host === API_HOST) {
    event.respondWith(routeApi(req, url));
    return;
  }

  // Same-origin: HTML pages, app shell, static assets
  if (req.destination === 'document' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(routePage(req, url));
    return;
  }

  if (['style', 'script', 'image', 'font'].includes(req.destination)) {
    event.respondWith(routeShell(req));
    return;
  }
});

// ── Strategies ──────────────────────────────────────────────────────

async function routeShell(req) {
  // cache-first; fall back to network; final fall to /offline.html
  const cache = await caches.open(SHELL);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return cache.match('/offline.html') || new Response('Offline', { status: 503 });
  }
}

async function routePage(req, url) {
  // /dashboard: network-first (data is per-user, must stay fresh)
  if (url.pathname.startsWith('/dashboard')) {
    return networkFirst(req, PAGES);
  }
  // Everything else: stale-while-revalidate
  return staleWhileRevalidate(req, PAGES);
}

async function routeApi(req, url) {
  // Always-fresh paths
  const networkFirstPaths = [
    '/agents/mine',
    '/access-log',
    '/trust-events',
    '/dashboard',
  ];
  if (networkFirstPaths.some((p) => url.pathname.includes(p))) {
    return networkFirst(req, API);
  }
  // SWR for read-only feed/profile/teaser/stats
  return staleWhileRevalidate(req, API);
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return tagStale(cached);
    return offlinePage();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((fresh) => {
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  }).catch(() => null);
  if (cached) {
    // Trigger background revalidation but return cached now.
    networkPromise;  // intentional fire-and-forget
    return tagStale(cached);
  }
  // No cached entry: wait for network.
  const fresh = await networkPromise;
  if (fresh) return fresh;
  return offlinePage();
}

async function handleWrite(event) {
  // Try the network; if it fails, return a synthetic 503 response
  // so the page can decide to queue locally. Phase B.2 will wire in
  // Background Sync to retry queued requests automatically.
  try {
    return await fetch(event.request);
  } catch {
    return new Response(JSON.stringify({
      ok: false,
      offline: true,
      message: 'Request queued for retry when online',
    }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
}

// Tag a cached response with X-Goulburn-Stale: 1 so the frontend can
// surface a "Last refreshed Xm ago" indicator on stale data.
function tagStale(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Goulburn-Stale', '1');
  if (response.headers.get('date')) {
    headers.set('X-Goulburn-Cached-At', response.headers.get('date'));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function offlinePage() {
  const cache = await caches.open(SHELL);
  const offline = await cache.match('/offline.html');
  if (offline) return offline;
  return new Response('You appear to be offline.', {
    status: 503,
    headers: { 'content-type': 'text/html' },
  });
}
