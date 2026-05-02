// Phase 2 — CSP hash injection for inline scripts + event handlers.
// Computes SHA-256 of every inline <script> body and every on*= attribute
// value, then injects a per-page meta-CSP that allowlists exactly those
// hashes. Browsers intersect HTTP CSP and meta CSP, so even though HTTP
// CSP keeps 'unsafe-inline' for legacy compat, meta CSP enforces hash-only
// — XSS-injected scripts/handlers (different content = different hash) are
// blocked by the intersection.
const crypto = require('crypto');

function sha256B64(s) {
    return crypto.createHash('sha256').update(s, 'utf8').digest('base64');
}

function computePageHashes(html) {
    const scriptHashes = new Set();
    const handlerHashes = new Set();

    // Inline <script>...</script> (excluding src= scripts)
    const scriptRe = /<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
        const attrs = m[1] || '';
        if (/\bsrc\s*=/.test(attrs)) continue; // external script — host allowlisted, no hash needed
        const body = m[2];
        if (body.length === 0) continue;
        scriptHashes.add(sha256B64(body));
    }

    // Inline event handlers (on*=" ... ")
    const eventRe = /\son(?:click|load|input|change|submit|focus|blur|keyup|keydown|mouseover|mouseout|mouseenter|mouseleave|error|message)\s*=\s*(["'])([\s\S]*?)\1/gi;
    while ((m = eventRe.exec(html)) !== null) {
        const value = m[2];
        if (value.length === 0) continue;
        handlerHashes.add(sha256B64(value));
    }

    return { scriptHashes, handlerHashes };
}

function buildMetaCsp(html) {
    const { scriptHashes, handlerHashes } = computePageHashes(html);
    const scriptHashSrc = Array.from(scriptHashes).map(h => `'sha256-${h}'`).join(' ');
    const handlerHashSrc = Array.from(handlerHashes).map(h => `'sha256-${h}'`).join(' ');

    // External CDNs that host JS we load via <script src=...>
    const cdnHosts = [
        'https://unpkg.com',
        'https://cdnjs.cloudflare.com',
        'https://js.sentry-cdn.com',
        'https://cdn.vercel-insights.com',
        'https://cdn.jsdelivr.net',
        'https://challenges.cloudflare.com',
        // Vercel speed-insights also calls /_vercel/speed-insights/script.js (same-origin via /_vercel)
    ].join(' ');

    // Build the script-src directive. Note: NO 'unsafe-inline'. The hash list
    // covers every inline script and (with 'unsafe-hashes') every inline event
    // handler we ship. Anything else is an XSS injection and gets blocked.
    let scriptSrc = `'self' ${cdnHosts} ${scriptHashSrc}`;
    if (handlerHashes.size > 0) {
        scriptSrc += ` 'unsafe-hashes' ${handlerHashSrc}`;
    }

    // Meta CSP can NOT use frame-ancestors / report-uri (HTML spec restriction).
    // Those stay on the HTTP CSP via vercel.json. Meta only locks down script-src.
    const csp = `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.goulburn.ai https://goulburn-api-production.up.railway.app https://admin.goulburn.ai https://*.ingest.sentry.io; img-src 'self' data: https://api.dicebear.com; frame-src https://challenges.cloudflare.com; worker-src 'self'; base-uri 'self'; form-action 'self'`;

    return csp;
}

function injectMetaCsp(html) {
    // Skip the build's MAINTENANCE pages and any HTML missing a <head>.
    if (!html.includes('<head>') && !html.includes('<head ')) return html;
    const csp = buildMetaCsp(html);
    const meta = `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}">`;
    // Inject just after <head> opening tag
    return html.replace(/<head([^>]*)>/i, `<head$1>\n    ${meta}`);
}

module.exports = { injectMetaCsp, computePageHashes, buildMetaCsp };
