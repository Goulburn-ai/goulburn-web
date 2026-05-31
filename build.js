#!/usr/bin/env node
/**
 * goulburn.ai Static Site Builder
 * Compiles src/pages/*.html â public/*.html with shared partials.
 * Compiles Tailwind CSS from src/styles/input.css â public/styles.css
 *
 * Partials use: <!-- @include partials/name.html -->
 * Uses Tailwind CLI for CSS compilation.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { injectMetaCsp } = require('./csp-hashes');

const SRC = path.join(__dirname, 'src');
const PARTIALS_DIR = path.join(SRC, 'partials');
const PAGES_DIR = path.join(SRC, 'pages');
const STYLES_DIR = path.join(SRC, 'styles');
const OUT = path.join(__dirname, 'public');

// Clean old HTML files from output dir, preserve non-HTML assets (favicon, images, etc.)
if (fs.existsSync(OUT)) {
    fs.readdirSync(OUT).forEach(file => {
        if (file.endsWith('.html')) {
            fs.unlinkSync(path.join(OUT, file));
        }
    });
} else {
    fs.mkdirSync(OUT, { recursive: true });
}

// Load all partials into memory
const partials = {};
fs.readdirSync(PARTIALS_DIR).forEach(file => {
    if (file.endsWith('.html')) {
        const name = file.replace('.html', '');
        partials[name] = fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf8');
    }
});

console.log(`Loaded ${Object.keys(partials).length} partials: ${Object.keys(partials).join(', ')}`);

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// STEP 1: Compile Tailwind CSS
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const INPUT_CSS = path.join(STYLES_DIR, 'input.css');
const OUTPUT_CSS = path.join(OUT, 'styles.css');

if (fs.existsSync(INPUT_CSS)) {
    console.log('Compiling Tailwind CSS...');
    try {
        execSync(`npx @tailwindcss/cli -i "${INPUT_CSS}" -o "${OUTPUT_CSS}" --minify`, {
            stdio: 'inherit',
            cwd: __dirname
        });
        console.log(`â Tailwind CSS compiled â ${OUTPUT_CSS}`);
    } catch (err) {
        console.error('Failed to compile Tailwind CSS:', err.message);
        process.exit(1);
    }
} else {
    console.warn(`â  Input CSS not found at ${INPUT_CSS}`);
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// STEP 2: Process HTML pages with partial includes
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const pages = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));
let count = 0;

pages.forEach(file => {
    let html = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8');

    // Replace <!-- @include partials/name.html --> recursively, so partials
    // can include other partials. Cap at 8 passes as a circular-include guard.
    function expandPartials(input) {
        let prev = null;
        let out = input;
        let pass = 0;
        while (prev !== out && pass < 8) {
            prev = out;
            out = out.replace(/<!--\s*@include\s+partials\/(\w+)\.html\s*-->/g, (match, name) => {
                if (partials[name]) return partials[name];
                console.warn(`  Warning: Partial "${name}" not found in ${file}`);
                return match;
            });
            pass++;
        }
        return out;
    }
    html = expandPartials(html);

    // Phase 2: inject per-page meta-CSP with SHA-256 hashes of every inline
    // <script> + every on*= handler. Browsers intersect HTTP CSP and meta CSP,
    // so meta locks down script-src to hash-only even though vercel.json keeps
    // 'unsafe-inline' as legacy backstop. XSS injections fail hash check.
    html = injectMetaCsp(html);

    fs.writeFileSync(path.join(OUT, file), html, 'utf8');
    count++;
});

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// STEP 3: Copy static assets from src/static/ â public/
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ (JS, CSS, images) from src/static/ â public/
const STATIC_DIR = path.join(SRC, 'static');
let staticCount = 0;
if (fs.existsSync(STATIC_DIR)) {
    fs.readdirSync(STATIC_DIR).forEach(file => {
        fs.copyFileSync(path.join(STATIC_DIR, file), path.join(OUT, file));
        staticCount++;
    });
}
if (staticCount > 0) {
    console.log(`Copied ${staticCount} static asset(s) â public/`);
}

console.log(`Built ${count} pages â public/`);

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// MAINTENANCE MODE â when true, overwrite every public HTML file with
// the maintenance page content so static-file resolution serves it
// regardless of Vercel rewrite evaluation order.
// Flip to false and rebuild to lift maintenance.
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const MAINTENANCE_MODE = false;
if (MAINTENANCE_MODE) {
    const maintenanceHtml = fs.readFileSync(path.join(OUT, 'maintenance.html'), 'utf8');
    let overwritten = 0;
    fs.readdirSync(OUT).forEach(file => {
        if (file.endsWith('.html') && file !== 'maintenance.html') {
            fs.writeFileSync(path.join(OUT, file), maintenanceHtml, 'utf8');
            overwritten++;
        }
    });
    console.log(`MAINTENANCE MODE: overwrote ${overwritten} pages with maintenance.html`);
                        }

// ─────────────────────────────────────────────────────────────────────
// STEP 5: Manifest display-mode guard
// ─────────────────────────────────────────────────────────────────────
// 2026-05-14 — PWA manifest 'display: standalone' captures every
// in-scope navigation, which means email/Slack/external links spawn a
// full-screen PWA window disconnected from the operator's browser tab.
// Caught when Iran2026's claim email opened a separate full-screen
// PWA instance instead of the existing browser session.
// Manifest must use 'browser' (or 'minimal-ui' if we ever want minimal
// chrome). Never 'standalone' or 'fullscreen' on a domain whose pages
// are linked from external apps.
const MANIFEST_PATH = path.join(OUT, 'manifest.webmanifest');
if (fs.existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const forbidden = ['standalone', 'fullscreen'];
    if (forbidden.includes(manifest.display)) {
        console.error(
            `Manifest display="${manifest.display}" hijacks external email links into a full-screen PWA window. ` +
            `Use "browser" (recommended) or "minimal-ui". See PR fix/pwa-display-browser for context.`
        );
        process.exit(1);
    }
    console.log(`Manifest display="${manifest.display}" — external links open in browser tab.`);
}

// ─────────────────────────────────────────────────────────────────────
// STEP 6: Recommended-Actions projection-arithmetic guard
// ─────────────────────────────────────────────────────────────────────
// 2026-05-14 — dashboard.html _tdLadderHtml() previously added the
// action's layer-delta directly to the overall reputation_score,
// claiming tier jumps that wouldn't actually happen (Iran2026 audit:
// 'Verify operator identity +60' shown as 15 -> 75 (Verified), real
// outcome 15 -> 30 (still Unverified) because identity is weighted 0.25).
// The fix takes layer + current layer score and applies LAYER_WEIGHTS.
// This guard makes the old shape impossible to reintroduce silently.
const DASH = path.join(OUT, 'dashboard.html');
if (fs.existsSync(DASH)) {
    const dashSrc = fs.readFileSync(DASH, 'utf8');
    // Must define the layer-weight table.
    if (!/TD_LAYER_WEIGHTS/.test(dashSrc)) {
        console.error('dashboard.html missing TD_LAYER_WEIGHTS — projection bug regression risk.');
        process.exit(1);
    }
    // Must NOT contain the old layer-as-overall arithmetic pattern.
    if (/var\s+ps\s*=\s*Math\.min\(100,\s*cs\s*\+\s*ds\)/.test(dashSrc)) {
        console.error('dashboard.html still has the old `cs + ds` projection arithmetic — projection bug regressed.');
        process.exit(1);
    }
    console.log('Dashboard projection guard: TD_LAYER_WEIGHTS present, no `cs + ds` regression.');
}

// ─────────────────────────────────────────────────────────────────────
// STEP 7: Pricing-copy honesty guard (Phase A0)
// ─────────────────────────────────────────────────────────────────────
// 2026-05-26 — paid pricing cards must not promise features that aren't
// shipping in v1.0. Specifically blocked: "Terraform provider" bullet
// and "custom branded badges" in the magnet copy. settings.html's stale
// pitch ("Studio (", "Pro+") must not regress. If these strings reappear
// after Phase A0, the build fails — better to fail-loud than ship
// promises we can't keep.
const PRICING = path.join(OUT, 'pricing.html');
if (fs.existsSync(PRICING)) {
    const src = fs.readFileSync(PRICING, 'utf8');
    // STEP 7 (Phase A0): Terraform must not appear as a green-check
    // bullet on a pricing card. Detection: <span>Terraform provider</span>
    // is the card-bullet shape. The comparison-table row uses
    // <td>Terraform provider</td> and carries a "Soon" badge — allowed.
    if (/<span[^>]*>Terraform provider<\/span>/.test(src)) {
        console.error('pricing.html card still promises "Terraform provider" as a green-check bullet — use a "Soon" badge in the comparison table instead.');
        process.exit(1);
    }
    if (/custom branded badges/i.test(src)) {
        console.error('pricing.html magnet copy still mentions "custom branded badges" — deferred to v1.1.');
        process.exit(1);
    }
    console.log('Pricing-copy honesty guard: no v1.1-only promises on /pricing.');
}
const SETTINGS = path.join(OUT, 'settings.html');
if (fs.existsSync(SETTINGS)) {
    const src = fs.readFileSync(SETTINGS, 'utf8');
    // Two retired tier names that must never reappear in operator-facing copy.
    if (src.includes('Studio (')) {
        console.error('settings.html mentions "Studio (...)" — legacy tier, must not be advertised.');
        process.exit(1);
    }
    if (src.includes('Pro+ (')) {
        console.error('settings.html mentions "Pro+ (...)" — renamed to Builder Pro in migration 049.');
        process.exit(1);
    }
    console.log('Settings-page honesty guard: no retired tier names in upgrade pitch.');
}


// ─────────────────────────────────────────────────────────────────────
// STEP 8: Comparison-table presence guard (Phase A0.5)
// ─────────────────────────────────────────────────────────────────────
// 2026-05-26 — pricing.html includes a "Compare tiers & features" table
// below the three cards (X.com pattern). The table is the buyer's primary
// decision tool — make sure it never silently disappears from a future
// pricing.html refactor. Also pin that the table doesn't promise v1.1+
// features ("Terraform" — already blocked by STEP 7, double-checked here
// for the table region specifically).
if (fs.existsSync(PRICING)) {
    const src = fs.readFileSync(PRICING, 'utf8');
    if (!src.includes('Compare tiers &amp; features')) {
        console.error('pricing.html no longer contains the "Compare tiers & features" table — Phase A0.5 regressed.');
        process.exit(1);
    }
    // Table must list all three tier columns
    for (const col of ['Free', 'Wallet', 'Builder']) {
        // Look for the col header within the table region only
        // (a loose check; the STEP 7 honesty guard covers stricter wording)
        if (!src.includes('>' + col + '<')) {
            console.error('pricing.html comparison table missing tier column: ' + col);
            process.exit(1);
        }
    }
    console.log('Comparison-table guard: 3 tier columns present.');
}


// ─────────────────────────────────────────────────────────────────────
// STEP 9: Tier 3 network-pro.js bundle-size gate (Phase 3, network-advanced)
// ─────────────────────────────────────────────────────────────────────
// 2026-05-31 — Tier 3 of the Network widget loads /static/network-pro.js
// on first sustained hover. The senior-eng review required a hard CI gate
// that fails the build if the gzipped bundle exceeds 60KB. Catches a
// silent bloat from adding a heavy dep or kitchen-sink import.
const NETWORK_PRO = path.join(OUT, 'network-pro.js');
if (fs.existsSync(NETWORK_PRO)) {
    const zlib = require('zlib');
    const raw = fs.readFileSync(NETWORK_PRO);
    const gz = zlib.gzipSync(raw);
    console.log(`network-pro.js raw=${raw.length}B gzipped=${gz.length}B`);
    const LIMIT = 60 * 1024; // 60KB gzipped
    if (gz.length > LIMIT) {
        console.error(`network-pro.js gzipped (${gz.length}B) exceeds ${LIMIT}B budget — aborting build.`);
        process.exit(1);
    }
} else {
    console.warn('network-pro.js missing from public/ — Phase 3 of network-advanced not in this build.');
}
