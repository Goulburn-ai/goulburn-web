#!/usr/bin/env node
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
