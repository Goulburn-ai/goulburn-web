#!/usr/bin/env node
/**
 * goulburn.ai Static Site Builder
 * Compiles src/pages/*.html → public/*.html with shared partials.
 * Compiles Tailwind CSS from src/styles/input.css → public/styles.css
 *
 * Partials use: <!-- @include partials/name.html -->
 * Uses Tailwind CLI for CSS compilation.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// ─────────────────────────────────────────────────────────────────────
// STEP 1: Compile Tailwind CSS
// ─────────────────────────────────────────────────────────────────────
const INPUT_CSS = path.join(STYLES_DIR, 'input.css');
const OUTPUT_CSS = path.join(OUT, 'styles.css');

if (fs.existsSync(INPUT_CSS)) {
    console.log('Compiling Tailwind CSS...');
    try {
        execSync(`npx @tailwindcss/cli -i "${INPUT_CSS}" -o "${OUTPUT_CSS}" --minify`, {
            stdio: 'inherit',
            cwd: __dirname
        });
        console.log(`✓ Tailwind CSS compiled → ${OUTPUT_CSS}`);
    } catch (err) {
        console.error('Failed to compile Tailwind CSS:', err.message);
        process.exit(1);
    }
} else {
    console.warn(`⚠ Input CSS not found at ${INPUT_CSS}`);
}

// ─────────────────────────────────────────────────────────────────────
// STEP 2: Process HTML pages with partial includes
// ─────────────────────────────────────────────────────────────────────

const pages = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));
let count = 0;

pages.forEach(file => {
    let html = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8');

    // Replace <!-- @include partials/name.html --> with partial content
    html = html.replace(/<!--\s*@include\s+partials\/(\w+)\.html\s*-->/g, (match, name) => {
        if (partials[name]) {
            return partials[name];
        }
        console.warn(`  Warning: Partial "${name}" not found in ${file}`);
        return match;
    });

    fs.writeFileSync(path.join(OUT, file), html, 'utf8');
    count++;
});

// ─────────────────────────────────────────────────────────────────────
// STEP 3: Copy static assets from src/static/ → public/
// ───────────────────────────────────────────────────────────────────── (JS, CSS, images) from src/static/ → public/
const STATIC_DIR = path.join(SRC, 'static');
let staticCount = 0;
if (fs.existsSync(STATIC_DIR)) {
    fs.readdirSync(STATIC_DIR).forEach(file => {
        fs.copyFileSync(path.join(STATIC_DIR, file), path.join(OUT, file));
        staticCount++;
    });
}
if (staticCount > 0) {
    console.log(`Copied ${staticCount} static asset(s) → public/`);
}

console.log(`Built ${count} pages → public/`);

// ─────────────────────────────────────────────────────────────────────
// MAINTENANCE MODE — when true, overwrite every public HTML file with
// the maintenance page content so static-file resolution serves it
// regardless of Vercel rewrite evaluation order.
// Flip to false and rebuild to lift maintenance.
// ─────────────────────────────────────────────────────────────────────
const MAINTENANCE_MODE = true;
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
