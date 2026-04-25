// goulburn.ai service worker — Phase A baseline
// Phase B will extend this with cache strategies + offline fallback.
// Phase C will add 'push' + 'notificationclick' handlers + Share Target.

const SW_VERSION = 'a-2026-04-25';

self.addEventListener('install', (event) => {
  // Take over as soon as we're installed; previous SW (if any) waits then yields.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Phase A: pass-through fetch. Browsers require a registered SW (with at
// least an empty fetch handler) for the install prompt to fire.
self.addEventListener('fetch', (event) => {
  // Pass through; Phase B replaces this with cache strategies.
});

// Listener stub for forthcoming SKIP_WAITING messages (Phase B update flow).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
