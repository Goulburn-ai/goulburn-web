/**
 * Shared avatar icon library for goulburn.ai.
 *
 * Exports on window:
 *   window.GOULBURN_AVATAR_ICONS  — { iconName: svgInnerMarkup, ... }
 *   window.GOULBURN_AVATAR_CATS   — ordered list of { id, label, icons }
 *   window.GOULBURN_AVATAR_ALL    — flat list of all icon names (ICON_NAMES)
 *   window.GOULBURN_ICON_META     — { iconName: { cat, title } }
 *
 * All SVGs use viewBox="0 0 24 24", stroke-based (stroke="currentColor",
 * strokeWidth 1.5), fill="none". Renderers apply colour by wrapping in
 * a <span> or setting stroke via class.
 */
(function () {
    "use strict";

    var ICONS = {
        // ── Tech / Developer ───────────────────────────────────────
        robot:    '<rect x="5" y="8" width="14" height="12" rx="2"/><circle cx="9" cy="14" r="1.5"/><circle cx="15" cy="14" r="1.5"/><path d="M12 8V5m-3 13h6"/><rect x="10" y="3" width="4" height="2" rx="1"/>',
        brain:    '<path d="M12 2a7 7 0 017 7c0 2.5-1.5 4.5-3 5.5V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.5C6.5 13.5 5 11.5 5 9a7 7 0 017-7z"/><path d="M9 21h6M10 17v4M14 17v4"/><circle cx="10" cy="9" r="1"/><circle cx="14" cy="9" r="1"/>',
        shield:   '<path d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z"/><path d="M9 12l2 2 4-4"/>',
        chart:    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 17V13M12 17V8M17 17V11"/>',
        code:     '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
        globe:    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/>',
        bolt:     '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
        gear:     '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
        eye:      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
        puzzle:   '<path d="M20 7h-3V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v1.5A1.5 1.5 0 019.5 7H8V4a1 1 0 00-1-1H4a1 1 0 00-1 1v3h3a1.5 1.5 0 011.5 1.5V10H4a1 1 0 00-1 1v4a1 1 0 001 1h1.5A1.5 1.5 0 017 17.5V20a1 1 0 001 1h4a1 1 0 001-1v-3h1.5a1.5 1.5 0 001.5-1.5V14h3a1 1 0 001-1v-4a1 1 0 00-1-1z"/>',
        rocket:   '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11.95A22 22 0 0112 15z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
        star:     '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
        cpu:      '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
        database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/>',
        cloud:    '<path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>',
        terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 10l3 3-3 3M12 16h5"/>',
        lock:     '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
        network:  '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v3m-7 7l5-5m2 5l5-5"/>',

        // ── People ─────────────────────────────────────────────────
        person:         '<circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>',
        team:           '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M3 21v-2a3 3 0 013-3h6a3 3 0 013 3v2M15 16a2 2 0 012-2h2a2 2 0 012 2v2"/>',
        "user-circle":  '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M6 19a6 6 0 0112 0"/>',
        expert:         '<circle cx="12" cy="8" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/>',
        handshake:      '<path d="M11 17l-4 4-4-4 8-8 4 4M13 7l4-4 4 4-8 8-4-4"/><path d="M8 15l-1 1M16 9l1-1"/>',
        "user-tie":     '<circle cx="12" cy="6" r="3.5"/><path d="M5 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/><path d="M11 10l1 2 1-2M11 10l1 5 1-5"/>',
        headset:        '<path d="M3 12a9 9 0 1118 0v5a3 3 0 01-3 3h-2v-7h5M3 13v4a3 3 0 003 3h2v-7H3"/>',
        "face-smile":   '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
        chef:           '<path d="M8 22h8M8 22V14m8 8V14M5 14h14a0 0 0 000 0V9a3 3 0 01-1-5.83 3 3 0 015.66 0A3 3 0 0119 9v5a0 0 0 000 0z"/>',
        doctor:         '<circle cx="12" cy="5" r="3"/><path d="M6 22v-7a3 3 0 013-3h6a3 3 0 013 3v7"/><path d="M12 10v6M9 13h6"/>',
        teacher:        '<path d="M3 21h18M5 21V9l7-4 7 4v12M9 21v-6h6v6"/>',
        athlete:        '<circle cx="14" cy="4" r="2"/><path d="M4 22l2-7 4-2 3 3-2 5M10 13l4-2 3 3 4 2"/>',

        // ── Financial ──────────────────────────────────────────────
        dollar:         '<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
        "trending-up":  '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/>',
        bank:           '<path d="M3 10l9-6 9 6v1H3zM3 11v9h18v-9"/><path d="M7 13v5M11 13v5M15 13v5M19 13v5M3 20h18"/>',
        coin:           '<circle cx="12" cy="12" r="9"/><path d="M14 9h-3a2 2 0 000 4h2a2 2 0 010 4H10M12 7v2m0 8v2"/>',
        scale:          '<path d="M12 3v18M5 20h14"/><path d="M6 7L3 14h6zM18 7l-3 7h6z"/><path d="M3 14a3 3 0 006 0M15 14a3 3 0 006 0"/>',
        wallet:         '<path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2v-5"/><path d="M21 9h-5a3 3 0 000 6h5z"/>',
        briefcase:      '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M2 13h20"/>',
        building:       '<rect x="4" y="2" width="16" height="20"/><path d="M9 6h2M13 6h2M9 10h2M13 10h2M9 14h2M13 14h2M9 18h6"/>',
        stocks:         '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/><circle cx="7" cy="14" r="1"/><circle cx="11" cy="10" r="1"/><circle cx="14" cy="13" r="1"/><circle cx="19" cy="7" r="1"/>',
        "piggy-bank":   '<path d="M19 11c0-3-3-5-7-5s-7 2-7 5a4 4 0 002 3.46V18a1 1 0 001 1h1a1 1 0 001-1v-1h6v1a1 1 0 001 1h1a1 1 0 001-1v-3.54A4 4 0 0019 11z"/><circle cx="15" cy="10" r="1"/>',
        calculator:     '<rect x="4" y="2" width="16" height="20" rx="2"/><rect x="7" y="5" width="10" height="3"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
        invoice:        '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h3M11 10h2"/>',

        // ── Cool / Style ───────────────────────────────────────────
        flame:     '<path d="M8 14c0-4 4-6 4-12 3 3 6 6 6 11a6 6 0 01-12 1z"/><path d="M10 17a2 2 0 004 0c0-2-2-3-2-5"/>',
        crown:     '<path d="M2 8l4 10h12l4-10-6 4-4-7-4 7-6-4z"/><path d="M6 18h12"/>',
        diamond:   '<path d="M6 3h12l3 6-9 12L3 9l3-6z"/><path d="M11 3l-3 6h8l-3-6M3 9h18"/>',
        target:    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
        infinity:  '<path d="M6.5 9a4 4 0 110 6c-2 0-5 2-9 0M17.5 15a4 4 0 110-6c2 0 5-2 9 0"/><path d="M7 12c2-3 5-3 10 0M7 12c5 3 8 3 10 0"/>',
        wings:     '<path d="M12 12c-3-4-7-5-10-5 2 4 5 7 10 8 5-1 8-4 10-8-3 0-7 1-10 5z"/>',
        phoenix:   '<path d="M12 2c0 4-4 5-4 9 0 3 2 5 4 5s4-2 4-5c0-4-4-5-4-9z"/><path d="M8 14c-3 2-4 5-4 7 2-1 5-2 7-4M16 14c3 2 4 5 4 7-2-1-5-2-7-4"/>',
        lightning: '<path d="M14 2L3 14h7l-2 8 11-12h-7l2-8z"/>',

        // ── Nature ─────────────────────────────────────────────────
        leaf:      '<path d="M21 3c-9 0-16 5-16 12 0 3 2 6 5 6 7 0 11-9 11-18zM5 21c2-4 4-6 9-8"/>',
        tree:      '<path d="M12 22v-7M8 15c-3 0-5-2-5-5 0-2 1-3 3-3 0-3 2-5 6-5s6 2 6 5c2 0 3 1 3 3 0 3-2 5-5 5z"/>',
        sun:       '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
        moon:      '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>',
        mountain:  '<path d="M2 20l7-12 4 6 3-4 6 10z"/><circle cx="17" cy="5" r="1"/>',
        wave:      '<path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
        flower:    '<circle cx="12" cy="12" r="2"/><path d="M12 2a4 4 0 000 8zM22 12a4 4 0 00-8 0zM12 22a4 4 0 000-8zM2 12a4 4 0 008 0z"/>',

        // ── Science / Research ─────────────────────────────────────
        beaker:     '<path d="M9 3h6v5l5 11a1 1 0 01-1 1H5a1 1 0 01-1-1L9 8z"/><path d="M9 3h6M7 14h10"/>',
        atom:       '<circle cx="12" cy="12" r="1.5"/><path d="M6 6c3 3 6 12 12 12M6 18c3-3 6-12 12-12"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)"/>',
        dna:        '<path d="M4 4s4 4 8 4 8-4 8-4M4 8s4 4 8 4 8-4 8-4M4 12s4 4 8 4 8-4 8-4M4 16s4 4 8 4 8-4 8-4"/>',
        microscope: '<path d="M6 18h12v3H6z"/><path d="M10 15v3M14 15v3M10 3h4v3l-2 3-2-3z"/><circle cx="12" cy="13" r="4"/>',
        flask:      '<path d="M10 2h4v6l5 10a2 2 0 01-2 3H7a2 2 0 01-2-3l5-10z"/><path d="M10 2h4M8 14h8"/>',
        telescope:  '<path d="M2 12l8-8 10 10-8 8zM6 8l10 10M8 22h8"/>',

        // ── Creative ───────────────────────────────────────────────
        palette:    '<path d="M12 2a10 10 0 00-10 10c0 5 4 9 9 9h1a3 3 0 003-3v-2a2 2 0 012-2h2a5 5 0 005-5A10 10 0 0012 2z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="16" cy="9" r="1"/>',
        brush:      '<path d="M18 3l3 3L9 18l-6 3 3-6z"/><path d="M14 7l3 3"/>',
        camera:     '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M8 6l2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',
        pen:        '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13L8.5 22.5 2 21l1.5-6.5L13 5l5 8z"/>',
        microphone: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v4M8 22h8"/>',
        film:       '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M6 3v18M18 3v18M2 8h4M18 8h4M2 12h4M18 12h4M2 16h4M18 16h4"/>',
        music:      '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',

        // ── Other ─────────────────────────────────────────────────
        heart:      '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/>',
        key:        '<circle cx="7" cy="15" r="3"/><path d="M9.5 13.5L20 3M16 7l2 2M18 5l2 2"/>',
        compass:    '<circle cx="12" cy="12" r="10"/><polygon points="16 8 10 10 8 16 14 14 16 8"/>',
        book:       '<path d="M4 19.5A2.5 2.5 0 016.5 17H20v2H6.5A2.5 2.5 0 014 19.5zM4 19.5V4a2 2 0 012-2h14v15"/>',
        gift:       '<path d="M12 8v13M20 12H4v9h16zM22 8H2v4h20V8zM7 8a2 2 0 01-2-2 3 3 0 016 0M17 8a2 2 0 002-2 3 3 0 00-6 0"/>',
        lightbulb:  '<path d="M9 18h6M10 22h4M9 14a5 5 0 117 0c-1 1-2 2-2 4h-3c0-2-1-3-2-4z"/>',
        tag:        '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1"/>',
        map:        '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><path d="M9 3v15M15 6v15"/>',
        bird:       '<path d="M5 14c0-3 3-5 7-5 3 0 5 1 6 3l4-2-2 5c-1 3-5 5-9 5-4 0-7-3-6-6z"/><circle cx="11" cy="11" r="1"/>',
        anchor:     '<circle cx="12" cy="5" r="3"/><path d="M12 8v13M5 12H2c0 6 4 9 10 9s10-3 10-9h-3"/>',
    };

    // Category organisation — determines tabs + grouping
    var CATEGORIES = [
        { id: "all",       label: "All",       icons: null }, // populated below
        { id: "tech",      label: "Tech",      icons: ["robot","brain","shield","chart","code","globe","bolt","gear","eye","puzzle","rocket","star","cpu","database","cloud","terminal","lock","network"] },
        { id: "people",    label: "People",    icons: ["person","team","user-circle","expert","handshake","user-tie","headset","face-smile","chef","doctor","teacher","athlete"] },
        { id: "financial", label: "Financial", icons: ["dollar","trending-up","bank","coin","scale","wallet","briefcase","building","stocks","piggy-bank","calculator","invoice"] },
        { id: "cool",      label: "Cool",      icons: ["flame","crown","diamond","target","infinity","wings","phoenix","lightning"] },
        { id: "nature",    label: "Nature",    icons: ["leaf","tree","sun","moon","mountain","wave","flower"] },
        { id: "science",   label: "Science",   icons: ["beaker","atom","dna","microscope","flask","telescope"] },
        { id: "creative",  label: "Creative",  icons: ["palette","brush","camera","pen","microphone","film","music"] },
        { id: "other",     label: "Other",     icons: ["heart","key","compass","book","gift","lightbulb","tag","map","bird","anchor"] },
    ];

    // Build the ALL bucket + meta map
    var ALL = [];
    var META = {};
    for (var i = 1; i < CATEGORIES.length; i++) {
        var cat = CATEGORIES[i];
        for (var j = 0; j < cat.icons.length; j++) {
            var n = cat.icons[j];
            if (ICONS[n]) {
                ALL.push(n);
                META[n] = { cat: cat.id, title: n.replace(/-/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }) };
            }
        }
    }
    CATEGORIES[0].icons = ALL;

    // Wrap inner markup into a full <svg> for inline rendering.
    function svg(name, size) {
        size = size || 22;
        var inner = ICONS[name];
        if (!inner) return "";
        return '<svg width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' + inner + "</svg>";
    }

    // Publish to window
    window.GOULBURN_AVATAR_ICONS = ICONS;
    window.GOULBURN_AVATAR_CATS = CATEGORIES;
    window.GOULBURN_AVATAR_ALL = ALL;
    window.GOULBURN_ICON_META = META;
    window.GOULBURN_AVATAR_SVG = svg;

    /**
     * Render a category-tabs + scrolling grid picker into the given container.
     *
     * @param {HTMLElement} container
     * @param {object} opts
     *        opts.selected     — currently-selected icon name (for highlight)
     *        opts.onSelect     — fn(iconName) called when user clicks an icon
     *        opts.initialCategory — default tab (default "all")
     *        opts.gridClass    — extra class for the grid (e.g. tailwind cols)
     *        opts.tabClass     — extra class for tab buttons
     *        opts.itemClass    — extra class for icon buttons
     */
    function renderPicker(container, opts) {
        opts = opts || {};
        var selected = opts.selected || "";
        var onSelect = opts.onSelect || function () {};
        var currentCat = opts.initialCategory || "all";

        var tabsHtml = CATEGORIES.map(function (cat) {
            return (
                '<button type="button" class="gb-cat-tab ' + (opts.tabClass || "") +
                (cat.id === currentCat ? " gb-cat-active" : "") +
                '" data-cat="' + cat.id + '">' + cat.label + "</button>"
            );
        }).join("");

        container.innerHTML =
            '<div class="gb-avatar-tabs">' + tabsHtml + "</div>" +
            '<div class="gb-avatar-grid ' + (opts.gridClass || "") + '" data-gbgrid></div>';

        function paint(cat) {
            var list = CATEGORIES.find(function (c) { return c.id === cat; }).icons;
            var grid = container.querySelector("[data-gbgrid]");
            grid.innerHTML = list.map(function (n) {
                return (
                    '<button type="button" class="gb-avatar-btn ' + (opts.itemClass || "") +
                    (n === selected ? " gb-avatar-selected" : "") +
                    '" data-icon="' + n + '" title="' + (META[n] && META[n].title || n) + '">' +
                    svg(n) + "</button>"
                );
            }).join("");
            grid.querySelectorAll(".gb-avatar-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    selected = btn.getAttribute("data-icon");
                    grid.querySelectorAll(".gb-avatar-selected").forEach(function (x) {
                        x.classList.remove("gb-avatar-selected");
                    });
                    btn.classList.add("gb-avatar-selected");
                    onSelect(selected);
                });
            });
        }

        container.querySelectorAll(".gb-cat-tab").forEach(function (tab) {
            tab.addEventListener("click", function () {
                container.querySelectorAll(".gb-cat-active").forEach(function (x) {
                    x.classList.remove("gb-cat-active");
                });
                tab.classList.add("gb-cat-active");
                currentCat = tab.getAttribute("data-cat");
                paint(currentCat);
            });
        });

        paint(currentCat);
    }

    window.GOULBURN_AVATAR_RENDER_PICKER = renderPicker;
})();
