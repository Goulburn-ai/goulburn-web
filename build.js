#!/usr/bin/env node
/**
 * goulburn.ai Static Site Builder
 * Compiles src/pages/*.html → public/*.html with shared partials.
 *
 * Partials use: <!-- @include partials/name.html -->
 * No dependencies required — pure Node.js.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const PARTIALS_DIR = path.join(SRC, 'partials');
const PAGES_DIR = path.join(SRC, 'pages');
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

// Process each page
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

// Copy any non-HTML assets from public (favicon, etc.) — they stay as-is
console.log(`Built ${count} pages → public/`);
