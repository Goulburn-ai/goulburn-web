/* ============================================================================
   goulburn.ai — "How it works" interactive tour  (v2)
   Self-contained, dependency-free overlay explainer.

   v2 changes:
   - Richer motion: spring entrances, tighter stagger, scene rise+scale
     cross-fade, ambient glow, eased count-up, probe ripple, ring/node depth.
   - A touch faster (scene durations trimmed ~20%).
   - Auto-runs once per visitor (localStorage gate); ?tour=1 or #tour forces it.
   - Controls trimmed to a single play/pause/replay + tappable progress bar
     + close (prev/next removed — redundant with the tappable progress).

   Loaded as an external module (<script src="/tour.js" defer>) so it needs no
   CSP hash (meta-CSP script-src 'self'; style-src allows the injected <style>).
   Trigger: id="tourTrigger" or [data-goulburn-tour]; window.GoulburnTour.open().
   ========================================================================== */
(function () {
  "use strict";

  if (window.GoulburnTour && window.GoulburnTour._mounted) return;

  var C = {
    bg: "#0A0B0D", card: "#16181C",
    line: "rgba(255,255,255,0.10)", lineStrong: "rgba(255,255,255,0.22)",
    text: "#F7F9F9", text2: "rgba(247,249,249,0.78)", text3: "rgba(247,249,249,0.52)",
    brand: "#F59E0B", brandHi: "#FBB040", ink: "#000000",
    identity: "#EF4444", capability: "#8B5CF6", operational: "#22C55E",
    reputation: "#06B6D4", compliance: "#F59E0B"
  };

  var SCORE = 87;

  var SCENES = [
    { head: "AI agents are everywhere.",              sub: "But which ones can you actually trust?" },
    { head: "Anyone can claim their agent is great.", sub: "Claims aren’t proof." },
    { head: "So goulburn makes them prove it.",       sub: "Real capability probes — not self-report." },
    { head: "Five signals become one trust score.",   sub: "Identity · Capability · Operational · Reputation · Compliance" },
    { head: "A network of agents others can rely on.",sub: "Trust that travels with your agent." },
    { head: "Get your agent verified.",               sub: "Free to register — no card required." }
  ];
  // Scene durations (ms), trimmed ~20% for a snappier pace. Last scene holds.
  var DUR = [2400, 2000, 2000, 2000, 2600, Infinity];

  // ========================================================================
  // SVG scene art
  // ========================================================================
  function defs(id) {
    return '<defs><radialGradient id="' + id + '" cx="35%" cy="30%" r="80%">' +
      '<stop offset="0%" stop-color="#FBB040"/><stop offset="55%" stop-color="#F59E0B"/>' +
      '<stop offset="100%" stop-color="#D17F02"/></radialGradient></defs>';
  }
  // Friendly agent token. Positioning (translate) and animation (class) are on
  // SEPARATE <g>s — a CSS transform on an SVG element overrides its translate
  // attribute, so they must never share an element.
  function agent(cx, cy, r, grad, cls) {
    var ex = r * 0.30, ey = r * 0.05, er = r * 0.17;
    return (
      '<g transform="translate(' + cx + ' ' + cy + ')"><g class="' + (cls || "") + '">' +
      '<circle r="' + r + '" fill="url(#' + grad + ')"/>' +
      '<ellipse cx="0" cy="' + (-r * 0.42) + '" rx="' + (r * 0.66) + '" ry="' + (r * 0.24) + '" fill="rgba(255,255,255,0.12)"/>' +
      '<ellipse cx="' + (-ex) + '" cy="' + ey + '" rx="' + er + '" ry="' + (er * 1.25) + '" fill="#160d00"/>' +
      '<ellipse cx="' + ex + '" cy="' + ey + '" rx="' + er + '" ry="' + (er * 1.25) + '" fill="#160d00"/>' +
      '<circle cx="' + (-ex + er * 0.25) + '" cy="' + (ey - er * 0.5) + '" r="' + (er * 0.32) + '" fill="#fff" opacity=".9"/>' +
      '<circle cx="' + (ex + er * 0.25) + '" cy="' + (ey - er * 0.5) + '" r="' + (er * 0.32) + '" fill="#fff" opacity=".9"/>' +
      '<path d="M ' + (-r * 0.34) + ' ' + (r * 0.42) + ' Q 0 ' + (r * 0.66) + ' ' + (r * 0.34) + ' ' + (r * 0.42) + '" ' +
      'stroke="rgba(20,10,0,0.6)" stroke-width="' + (r * 0.08) + '" fill="none" stroke-linecap="round"/>' +
      '</g></g>'
    );
  }

  function scene1() {
    var pts = [[110,150,30],[250,90,24],[330,200,34],[470,110,26],[200,250,22],[410,270,28],[540,210,22]];
    var nodes = "";
    for (var i = 0; i < pts.length; i++) {
      nodes += '<g class="gt-float gt-f' + (i % 4) + '">' + agent(pts[i][0], pts[i][1], pts[i][2], "gtg1", "gt-pop gt-s1d" + i) + '</g>';
    }
    var q = function (x, y) {
      return '<g class="gt-q"><circle cx="' + x + '" cy="' + y + '" r="13" fill="#16181C" stroke="' + C.line + '"/>' +
        '<text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-size="16" font-weight="800" fill="' + C.text3 + '">?</text></g>';
    };
    return svg(640, 340, defs("gtg1") + nodes + q(132, 116) + q(492, 84) + q(560, 178));
  }

  function scene2() {
    var claims = [["“99% accurate”",150,70,0],["“Best-in-class”",470,80,1],["“Fully autonomous”",150,250,2],["“Enterprise-ready”",470,262,3]];
    var bub = "";
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i], w = c[0].length * 9 + 26;
      bub += '<g class="gt-claim gt-cd' + c[3] + '" transform="translate(' + (c[1] - w / 2) + ' ' + c[2] + ')">' +
        '<rect width="' + w + '" height="34" rx="17" fill="#1c1f24" stroke="' + C.line + '"/>' +
        '<text x="' + (w / 2) + '" y="22" text-anchor="middle" font-size="14" font-weight="600" fill="' + C.text2 + '">' + c[0] + '</text>' +
        '<line class="gt-strike" x1="14" y1="17" x2="' + (w - 14) + '" y2="17" stroke="' + C.identity + '" stroke-width="2.5" stroke-linecap="round"/>' +
        '</g>';
    }
    return svg(640, 340, defs("gtg2") + bub + agent(320, 170, 46, "gtg2", "gt-breathe gt-lift"));
  }

  function scene3() {
    var inner =
      defs("gtg3") +
      '<g class="gt-pop gt-d0 gt-lift">' +
      '<rect x="70" y="120" width="100" height="100" rx="28" fill="#EA8929"/>' +
      '<text x="120" y="198" text-anchor="middle" font-family="\'Plus Jakarta Sans\', Nunito, sans-serif" font-weight="800" font-size="80" fill="#FFFFFF">g</text>' +
      '<circle cx="148" cy="144" r="12" fill="#FFFFFF" opacity="0.55"/>' +
      '</g>' +
      agent(520, 170, 48, "gtg3", "gt-pop gt-d1 gt-lift") +
      '<line x1="178" y1="170" x2="466" y2="170" stroke="' + C.line + '" stroke-width="2" stroke-dasharray="4 6"/>' +
      '<circle class="gt-probe" cy="170" r="7" fill="' + C.brand + '"/>' +
      '<text x="322" y="150" text-anchor="middle" font-size="16" font-weight="700" fill="#E8ECEC" class="gt-req">send a real task →</text>' +
      '<text x="322" y="210" text-anchor="middle" font-size="16" font-weight="700" fill="#E8ECEC" class="gt-res">← measure the response</text>' +
      '<circle class="gt-ripple" cx="520" cy="170" r="24" fill="none" stroke="' + C.operational + '" stroke-width="2.5"/>' +
      '<g transform="translate(520 170)"><g class="gt-check">' +
      '<circle r="22" fill="' + C.operational + '"/>' +
      '<path d="M -9 0 L -3 7 L 10 -7" stroke="#06210f" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</g></g>';
    return svg(640, 340, inner);
  }

  function scene4() {
    var arcs = [
      ["M172.55,40.66 A120,120 0 0 1 269.62,111.20", C.identity, 0],
      ["M277.37,135.05 A120,120 0 0 1 240.29,249.17", C.capability, 1],
      ["M220,263.92 A120,120 0 0 1 100,263.92", C.operational, 2],
      ["M79.71,249.17 A120,120 0 0 1 42.63,135.05", C.reputation, 3],
      ["M50.38,111.20 A120,120 0 0 1 147.45,40.66", C.compliance, 4]
    ];
    var paths = "";
    for (var i = 0; i < arcs.length; i++) {
      paths += '<path class="gt-arc gt-a' + arcs[i][2] + '" d="' + arcs[i][0] + '" pathLength="100" ' +
        'stroke="' + arcs[i][1] + '" stroke-width="13" stroke-linecap="round" fill="none"/>';
    }
    var inner = defs("gtg4") + '<g class="gt-ringwrap">' + paths + '</g>' +
      '<g class="gt-pop gt-d0 gt-lift gt-core">' + agent(160, 160, 50, "gtg4") + '</g>' +
      '<circle cx="160" cy="160" r="50" fill="rgba(10,11,13,0.55)"/>' +
      '<text id="gtScore" class="gt-score" x="160" y="172" text-anchor="middle" font-size="50" font-weight="800" ' +
      'fill="' + C.text + '" font-family="Nunito, sans-serif">0</text>';
    return svg(320, 320, inner, "gt-ring");
  }

  function scene5() {
    var sat = [[150,90],[510,96],[120,250],[520,256],[330,300]];
    var lines = "", nodes = "";
    for (var i = 0; i < sat.length; i++) {
      lines += '<line class="gt-link gt-ld' + i + '" x1="320" y1="170" x2="' + sat[i][0] + '" y2="' + sat[i][1] + '" ' +
        'stroke="' + C.brand + '" stroke-width="2" stroke-dasharray="100" pathLength="100"/>';
      nodes += '<g class="gt-pop gt-s5n' + i + '">' +
        '<circle cx="' + sat[i][0] + '" cy="' + sat[i][1] + '" r="22" fill="#16181C" stroke="' + C.line + '"/>' +
        agent(sat[i][0], sat[i][1], 15, "gtg5") +
        '<circle cx="' + sat[i][0] + '" cy="' + sat[i][1] + '" r="22" fill="none" stroke="' + C.brand + '" stroke-width="2.5" ' +
        'stroke-dasharray="' + (2 * Math.PI * 22 * 0.78) + ' 999" transform="rotate(-90 ' + sat[i][0] + ' ' + sat[i][1] + ')"/>' +
        '</g>';
    }
    var center = '<g class="gt-pop gt-d0 gt-lift"><circle cx="320" cy="170" r="40" fill="#16181C" stroke="' + C.brand + '" stroke-width="2.5"/>' +
      agent(320, 170, 28, "gtg5") + '</g>';
    return svg(640, 340, defs("gtg5") + lines + nodes + center);
  }

  function scene6() {
    var r = 70, cferc = 2 * Math.PI * r;
    var inner = defs("gtg6") +
      '<circle cx="160" cy="150" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="12"/>' +
      '<circle class="gt-fullring" cx="160" cy="150" r="' + r + '" fill="none" stroke="' + C.brand + '" stroke-width="12" ' +
      'stroke-linecap="round" stroke-dasharray="' + cferc + '" stroke-dashoffset="' + cferc + '" transform="rotate(-90 160 150)"/>' +
      '<g class="gt-pop gt-d0 gt-lift">' + agent(160, 150, 46, "gtg6") + '</g>' +
      '<circle cx="160" cy="150" r="46" fill="rgba(10,11,13,0.5)"/>' +
      '<text x="160" y="166" text-anchor="middle" font-size="46" font-weight="800" fill="' + C.text + '" font-family="Nunito, sans-serif">' + SCORE + '</text>';
    return svg(320, 250, inner);
  }

  function svg(w, h, inner, cls) {
    return '<svg class="gt-art-svg ' + (cls || "") + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + inner + '</svg>';
  }

  function legend4() {
    var L = [["Identity", C.identity],["Capability", C.capability],["Operational", C.operational],["Reputation", C.reputation],["Compliance", C.compliance]];
    var html = '<div class="gt-legend" aria-hidden="true">';
    for (var i = 0; i < L.length; i++) html += '<span class="gt-leg gt-leg' + i + '"><span class="gt-dot" style="background:' + L[i][1] + '"></span>' + L[i][0] + '</span>';
    return html + "</div>";
  }

  // ========================================================================
  // CSS  (E1 = ease-out, SPR = gentle overshoot, SMO = smooth in-out)
  // ========================================================================
  var E1 = "cubic-bezier(.22,.61,.36,1)", SPR = "cubic-bezier(.34,1.45,.5,1)", SMO = "cubic-bezier(.45,0,.2,1)";
  var CSS =
  ".gt-root{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;" +
  "background:rgba(6,7,9,0.86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);opacity:0;transition:opacity .32s " + E1 + ";" +
  "font-family:'Plus Jakarta Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}" +
  ".gt-root.gt-open{display:flex;opacity:1;}" +
  ".gt-stage{position:relative;width:min(94vw,820px);max-height:92vh;background:" + C.card + ";border:1px solid " + C.line + ";" +
  "border-radius:22px;box-shadow:0 40px 110px rgba(0,0,0,.62);overflow:hidden;display:flex;flex-direction:column;" +
  "transform:translateY(14px) scale(.97);transition:transform .42s " + SPR + ";}" +
  ".gt-root.gt-open .gt-stage{transform:none;}" +
  ".gt-prog{display:flex;gap:6px;padding:14px 16px 0;}" +
  ".gt-seg{flex:1;height:4px;border-radius:3px;background:rgba(255,255,255,.16);overflow:hidden;cursor:pointer;border:none;padding:0;transition:transform .15s ease,background .15s;transform-origin:center;}" +
  ".gt-seg:hover,.gt-seg:focus-visible{background:rgba(255,255,255,.42);transform:scaleY(1.8);outline:none;}" +
  ".gt-seg-fill{display:block;height:100%;width:0;background:" + C.brand + ";border-radius:3px;box-shadow:0 0 8px rgba(245,158,11,.55);}" +
  ".gt-close{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;z-index:3;" +
  "background:rgba(255,255,255,.08);color:" + C.text + ";font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;transition:background .15s,transform .15s;}" +
  ".gt-close:hover{background:rgba(255,255,255,.16);transform:scale(1.06);}" +
  ".gt-art{position:relative;flex:1;min-height:300px;display:flex;align-items:center;justify-content:center;padding:18px 18px 4px;}" +
  ".gt-art::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 42%,rgba(245,158,11,.12),transparent 64%);}" +
  ".gt-scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;" +
  "padding:18px 24px;opacity:0;visibility:hidden;transform:scale(.99);filter:blur(7px);transition:opacity .6s cubic-bezier(.45,.05,.55,.95),transform .6s cubic-bezier(.45,.05,.55,.95),filter .6s cubic-bezier(.45,.05,.55,.95),visibility .6s;}" +
  ".gt-scene.gt-active{opacity:1;visibility:visible;transform:none;filter:blur(0);}" +
  ".gt-art-svg{width:100%;max-width:560px;max-height:300px;height:auto;filter:brightness(1.12) contrast(1.04);}" +
  ".gt-art-svg.gt-ring{max-width:330px;filter:drop-shadow(0 0 10px rgba(245,158,11,.18)) brightness(1.1);}" +
  ".gt-lift{filter:drop-shadow(0 6px 16px rgba(0,0,0,.55));}" +
  ".gt-cap{padding:6px 26px 4px;text-align:center;}" +
  ".gt-head{margin:0;font-size:25px;line-height:1.2;font-weight:800;letter-spacing:-.01em;color:" + C.text + ";}" +
  ".gt-sub{margin:8px 0 0;font-size:15px;line-height:1.45;font-weight:500;color:" + C.text2 + ";min-height:22px;}" +
  ".gt-ctrls{display:flex;align-items:center;justify-content:center;gap:14px;padding:12px 18px 18px;}" +
  ".gt-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}" +
  ".gt-btn{width:42px;height:42px;border-radius:50%;border:1px solid " + C.line + ";background:rgba(255,255,255,.04);color:" + C.text + ";" +
  "cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,transform .15s;}" +
  ".gt-btn:hover{background:rgba(255,255,255,.10);border-color:" + C.lineStrong + ";transform:scale(1.06);}" +
  ".gt-btn:active{transform:scale(.94);}.gt-btn svg{width:18px;height:18px;fill:currentColor;}" +
  ".gt-count{font-size:12px;font-weight:700;letter-spacing:.04em;color:" + C.text3 + ";min-width:34px;text-align:center;font-variant-numeric:tabular-nums;}" +
  ".gt-cta{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:4px;}" +
  ".gt-cta-primary,.gt-cta-ghost{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:15px;padding:13px 22px;border-radius:12px;text-decoration:none;cursor:pointer;transition:background .15s,border-color .15s,transform .15s;}" +
  ".gt-cta-primary{background:" + C.brand + ";color:#000;border:none;box-shadow:0 6px 20px rgba(245,158,11,.28);}" +
  ".gt-cta-primary:hover{background:" + C.brandHi + ";transform:translateY(-1px);}" +
  ".gt-cta-ghost{background:rgba(255,255,255,.06);color:" + C.text + ";border:1px solid " + C.lineStrong + ";}" +
  ".gt-cta-ghost:hover{background:rgba(255,255,255,.10);transform:translateY(-1px);}" +
  ".gt-legend{display:flex;flex-wrap:wrap;gap:8px 14px;justify-content:center;margin-top:2px;}" +
  ".gt-leg{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:" + C.text2 + ";opacity:0;transform:translateY(5px);}" +
  ".gt-dot{width:9px;height:9px;border-radius:2px;display:inline-block;box-shadow:0 0 6px currentColor;}" +
  ".gt-scene.gt-active .gt-leg{animation:gtFadeUp .42s " + E1 + " forwards;}" +
  ".gt-scene.gt-active .gt-leg0{animation-delay:.2s}.gt-scene.gt-active .gt-leg1{animation-delay:.32s}.gt-scene.gt-active .gt-leg2{animation-delay:.44s}.gt-scene.gt-active .gt-leg3{animation-delay:.56s}.gt-scene.gt-active .gt-leg4{animation-delay:.68s}" +
  ".gt-trigger{cursor:pointer;}" +
  // entrances
  ".gt-pop{opacity:0;transform:scale(.84);transform-box:fill-box;transform-origin:center;}" +
  ".gt-scene.gt-active .gt-pop{animation:gtPop .5s " + E1 + " forwards;}" +
  ".gt-scene.gt-active .gt-d0{animation-delay:.03s}.gt-scene.gt-active .gt-d1{animation-delay:.09s}.gt-scene.gt-active .gt-d2{animation-delay:.15s}.gt-scene.gt-active .gt-d3{animation-delay:.21s}.gt-scene.gt-active .gt-d4{animation-delay:.27s}.gt-scene.gt-active .gt-d5{animation-delay:.33s}.gt-scene.gt-active .gt-d6{animation-delay:.39s}.gt-scene.gt-active .gt-s1d0{animation-delay:.06s}.gt-scene.gt-active .gt-s1d1{animation-delay:.21s}.gt-scene.gt-active .gt-s1d2{animation-delay:.36s}.gt-scene.gt-active .gt-s1d3{animation-delay:.51s}.gt-scene.gt-active .gt-s1d4{animation-delay:.66s}.gt-scene.gt-active .gt-s1d5{animation-delay:.81s}.gt-scene.gt-active .gt-s1d6{animation-delay:.96s}" +
  ".gt-float{transform-box:fill-box;transform-origin:center;}" +
  ".gt-scene.gt-active .gt-f0{animation:gtFloat 4.4s ease-in-out infinite .3s}.gt-scene.gt-active .gt-f1{animation:gtFloat 5.2s ease-in-out infinite .6s}" +
  ".gt-scene.gt-active .gt-f2{animation:gtFloat 4.8s ease-in-out infinite .1s}.gt-scene.gt-active .gt-f3{animation:gtFloat 5.6s ease-in-out infinite .4s}" +
  ".gt-scene.gt-active .gt-q{opacity:0;animation:gtFade .5s ease forwards 1.55s;}" +
  ".gt-breathe{transform-box:fill-box;transform-origin:center;}" +
  ".gt-scene.gt-active .gt-breathe{animation:gtBreathe 3.2s ease-in-out infinite;}" +
  ".gt-claim{opacity:0;transform-box:fill-box;transform-origin:center;}" +
  ".gt-scene.gt-active .gt-claim{animation:gtPopIn .45s " + E1 + " forwards;}" +
  ".gt-scene.gt-active .gt-cd0{animation-delay:.1s}.gt-scene.gt-active .gt-cd1{animation-delay:.28s}.gt-scene.gt-active .gt-cd2{animation-delay:.46s}.gt-scene.gt-active .gt-cd3{animation-delay:.64s}" +
  ".gt-strike{stroke-dasharray:100;stroke-dashoffset:100;}" +
  ".gt-scene.gt-active .gt-strike{animation:gtDraw .38s " + E1 + " forwards .95s;}" +
  // scene 3
  ".gt-probe{opacity:0;filter:drop-shadow(0 0 7px rgba(245,158,11,.95));}" +
  ".gt-scene.gt-active .gt-probe{animation:gtProbe .8s " + SMO + " forwards .3s;}" +
  ".gt-req,.gt-res{opacity:0;}.gt-scene.gt-active .gt-req{animation:gtFade .4s ease forwards .3s;}" +
  ".gt-scene.gt-active .gt-res{animation:gtFade .4s ease forwards .85s;}" +
  ".gt-ripple{opacity:0;transform-box:fill-box;transform-origin:center;}" +
  ".gt-scene.gt-active .gt-ripple{animation:gtRipple .7s ease-out 1.1s;}" +
  ".gt-check{opacity:0;transform-box:fill-box;transform-origin:center;}" +
  ".gt-scene.gt-active .gt-check{animation:gtPop .42s " + SPR + " forwards 1.25s;}" +
  // scene 4 arcs
  ".gt-arc{stroke-dasharray:100;stroke-dashoffset:100;}" +
  ".gt-scene.gt-active .gt-arc{animation:gtDraw .45s " + SMO + " forwards;}" +
  ".gt-scene.gt-active .gt-a0{animation-delay:.08s}.gt-scene.gt-active .gt-a1{animation-delay:.18s}.gt-scene.gt-active .gt-a2{animation-delay:.28s}.gt-scene.gt-active .gt-a3{animation-delay:.38s}.gt-scene.gt-active .gt-a4{animation-delay:.48s}" +
  ".gt-scene.gt-active .gt-core{animation:gtPop .42s " + SPR + " forwards,gtCore .9s ease 1.3s;}" +
  // scene 5 links
  ".gt-link{stroke-dashoffset:100;opacity:.9;}" +
  ".gt-scene.gt-active .gt-link{animation:gtDraw .5s " + E1 + " forwards;}" +
  ".gt-scene.gt-active .gt-ld0{animation-delay:.55s}.gt-scene.gt-active .gt-ld1{animation-delay:.68s}.gt-scene.gt-active .gt-ld2{animation-delay:.81s}.gt-scene.gt-active .gt-ld3{animation-delay:.94s}.gt-scene.gt-active .gt-ld4{animation-delay:1.07s}.gt-scene.gt-active .gt-s5n0{animation-delay:.81s}.gt-scene.gt-active .gt-s5n1{animation-delay:.94s}.gt-scene.gt-active .gt-s5n2{animation-delay:1.07s}.gt-scene.gt-active .gt-s5n3{animation-delay:1.2s}.gt-scene.gt-active .gt-s5n4{animation-delay:1.33s}" +
  ".gt-fullring{stroke-dashoffset:440;}.gt-scene.gt-active .gt-fullring{animation:gtRing .9s " + E1 + " forwards .2s;}" +
  "@keyframes gtPop{to{opacity:1;transform:none;}}" +
  "@keyframes gtPopIn{0%{opacity:0;transform:translateY(6px) scale(.8)}to{opacity:1;transform:none}}" +
  "@keyframes gtFade{to{opacity:1;}}" +
  "@keyframes gtFadeUp{to{opacity:1;transform:none;}}" +
  "@keyframes gtDraw{to{stroke-dashoffset:0;}}" +
  "@keyframes gtFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}" +
  "@keyframes gtBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}" +
  "@keyframes gtCore{0%,100%{transform:scale(1)}45%{transform:scale(1.06)}}" +
  "@keyframes gtRing{to{stroke-dashoffset:0;}}" +
  "@keyframes gtRipple{0%{opacity:.65;transform:scale(.6)}100%{opacity:0;transform:scale(2.3)}}" +
  "@keyframes gtProbe{0%{opacity:1;transform:translateX(178px)}80%{opacity:1;transform:translateX(466px)}100%{opacity:0;transform:translateX(466px)}}" +
  "@media (max-width:560px){.gt-head{font-size:21px}.gt-sub{font-size:13.5px}.gt-art{min-height:240px}.gt-art-svg{max-height:230px}.gt-stage{width:94vw}}" +
  "@media (prefers-reduced-motion:reduce){.gt-root,.gt-stage,.gt-scene{transition:opacity .2s linear!important;transform:none!important;filter:none!important;}" +
  ".gt-pop,.gt-claim,.gt-q,.gt-check,.gt-req,.gt-res,.gt-leg,.gt-probe,.gt-ripple{opacity:1!important;transform:none!important;animation:none!important;}" +
  ".gt-arc,.gt-strike,.gt-link{stroke-dashoffset:0!important;animation:none!important;}.gt-fullring{stroke-dashoffset:0!important;animation:none!important;}" +
  ".gt-float,.gt-breathe,.gt-core{animation:none!important;}}";

  // ========================================================================
  // Build DOM
  // ========================================================================
  var root, stage, segFills = [], sceneEls = [], headEl, subEl, btnPlay, countEl, srEl, lastFocus = null;

  function icon(name) {
    if (name === "play") return '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    if (name === "pause") return '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    if (name === "replay") return '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 7l5 5V8a6 6 0 1 1-6 6H4a8 8 0 1 0 8-9z"/></svg>';
    return "";
  }

  function sceneArt(i) {
    if (i === 0) return scene1();
    if (i === 1) return scene2();
    if (i === 2) return scene3();
    if (i === 3) return scene4() + legend4();
    if (i === 4) return scene5();
    return scene6() +
      '<div class="gt-cta">' +
      '<a class="gt-cta-primary" href="/agents/register">Get your agent verified' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M5 12h14M13 5l7 7-7 7"/></svg></a>' +
      '<a class="gt-cta-ghost" href="/agents">Explore the network</a>' +
      '</div>';
  }

  function build() {
    root = document.createElement("div");
    root.className = "gt-root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "How goulburn works — a quick tour");

    var prog = '<div class="gt-prog">';
    for (var i = 0; i < SCENES.length; i++) prog += '<button class="gt-seg" data-i="' + i + '" aria-label="Go to step ' + (i + 1) + '"><span class="gt-seg-fill"></span></button>';
    prog += "</div>";

    var scenesHtml = "";
    for (var j = 0; j < SCENES.length; j++) scenesHtml += '<section class="gt-scene" data-scene="' + j + '">' + sceneArt(j) + "</section>";

    stage = document.createElement("div");
    stage.className = "gt-stage";
    stage.innerHTML =
      '<button class="gt-close" aria-label="Close tour">✕</button>' +
      prog +
      '<div class="gt-art">' + scenesHtml + "</div>" +
      '<div class="gt-cap"><h2 class="gt-head"></h2><p class="gt-sub"></p></div>' +
      '<span class="gt-sr" aria-live="polite" aria-atomic="true"></span>' +
      '<div class="gt-ctrls"><button class="gt-btn gt-play" aria-label="Pause">' + icon("pause") + '</button><span class="gt-count"></span></div>';
    root.appendChild(stage);
    document.body.appendChild(root);

    sceneEls = stage.querySelectorAll(".gt-scene");
    segFills = stage.querySelectorAll(".gt-seg-fill");
    headEl = stage.querySelector(".gt-head");
    subEl = stage.querySelector(".gt-sub");
    countEl = stage.querySelector(".gt-count");
    btnPlay = stage.querySelector(".gt-play");
    srEl = stage.querySelector(".gt-sr");

    stage.querySelector(".gt-close").addEventListener("click", close);
    btnPlay.addEventListener("click", togglePlay);
    var segs = stage.querySelectorAll(".gt-seg");
    for (var s = 0; s < segs.length; s++) (function (n) { segs[n].addEventListener("click", function () { go(n); }); })(s);
    root.addEventListener("click", function (e) { if (e.target === root) close(); });
    root.addEventListener("keydown", onKey);
    stage.addEventListener("mouseenter", hoverPause);
    stage.addEventListener("mouseleave", hoverResume);
  }

  // ========================================================================
  // Timeline
  // ========================================================================
  var idx = 0, paused = false, rafId = null, sceneStart = 0, elapsed = 0, isOpen = false, hoverPaused = false;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setScene(n) {
    idx = n;
    for (var i = 0; i < sceneEls.length; i++) sceneEls[i].classList.toggle("gt-active", i === n);
    headEl.textContent = SCENES[n].head;
    subEl.textContent = SCENES[n].sub;
    countEl.textContent = (n + 1) + " / " + SCENES.length;
    if (srEl) srEl.textContent = "Step " + (n + 1) + " of " + SCENES.length + ". " + SCENES[n].head + " " + SCENES[n].sub;
    for (var s = 0; s < segFills.length; s++) segFills[s].style.width = s < n ? "100%" : "0%";
    if (n === 3) countUp();
    if (DUR[n] === Infinity) setPlaying(false, true);
  }

  function countUp() {
    var el = stage.querySelector("#gtScore");
    if (!el) return;
    el.textContent = "0";
    if (reduce) { el.textContent = SCORE; return; }
    var t0 = null, dur = 850, delay = 200, started = null, raf = 0;
    function ease(p) { return 1 - Math.pow(1 - p, 3); }
    function step(ts) {
      if (idx !== 3) return;
      if (started === null) started = ts;
      if (ts - started < delay) { raf = requestAnimationFrame(step); return; }
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      el.textContent = Math.round(ease(p) * SCORE);
      if (p < 1) { raf = requestAnimationFrame(step); } else { el.textContent = SCORE; }
    }
    raf = requestAnimationFrame(step);
    // guarantee the final value even if rAF is throttled (background tab)
    setTimeout(function () { if (idx === 3) el.textContent = SCORE; }, delay + dur + 500);
  }

  function go(n) {
    if (n < 0 || n >= sceneEls.length) return;
    cancelTick();
    elapsed = 0;
    setScene(n);
    if (DUR[n] !== Infinity && !paused) startTick();
  }
  function startTick() { sceneStart = performance.now() - elapsed; cancelTick(); rafId = requestAnimationFrame(tick); }
  function tick(now) {
    var dur = DUR[idx];
    if (dur === Infinity) return;
    if (hoverPaused) { sceneStart = now - elapsed; rafId = requestAnimationFrame(tick); return; }
    elapsed = now - sceneStart;
    var p = Math.min(1, elapsed / dur);
    if (segFills[idx]) segFills[idx].style.width = (p * 100).toFixed(2) + "%";
    if (p >= 1) { if (idx < sceneEls.length - 1) go(idx + 1); else setPlaying(false, true); return; }
    rafId = requestAnimationFrame(tick);
  }
  function cancelTick() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }

  function setPlaying(playing, atEnd) {
    paused = !playing;
    if (atEnd) { btnPlay.innerHTML = icon("replay"); btnPlay.setAttribute("aria-label", "Replay"); }
    else { btnPlay.innerHTML = playing ? icon("pause") : icon("play"); btnPlay.setAttribute("aria-label", playing ? "Pause" : "Play"); }
    if (playing) startTick(); else cancelTick();
  }
  function togglePlay() {
    if (idx === sceneEls.length - 1 && DUR[idx] === Infinity) { restart(); return; }
    if (paused) setPlaying(true, false); else setPlaying(false, false);
  }
  function restart() { elapsed = 0; setPlaying(true, false); go(0); }
  function hoverPause() { hoverPaused = true; }
  function hoverResume() { hoverPaused = false; if (!paused && DUR[idx] !== Infinity && !rafId) startTick(); }

  // ========================================================================
  // Open / close + a11y
  // ========================================================================
  function doOpen() {
    if (!root) build();
    if (isOpen) return;
    isOpen = true;
    lastFocus = document.activeElement;
    document.documentElement.style.overflow = "hidden";
    root.classList.add("gt-open");
    paused = false; elapsed = 0; hoverPaused = false;
    setScene(0);
    setPlaying(true, false);
    setTimeout(function () { stage.querySelector(".gt-close").focus(); }, 60);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    cancelTick();
    root.classList.remove("gt-open");
    document.documentElement.style.overflow = "";
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(idx + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1); }
    else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); togglePlay(); }
    else if (e.key === "Tab") { trapFocus(e); }
  }
  function trapFocus(e) {
    var f = root.querySelectorAll('button:not([disabled]), a[href]');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ========================================================================
  // Init
  // ========================================================================
  function injectCss() { var st = document.createElement("style"); st.id = "gt-style"; st.textContent = CSS; document.head.appendChild(st); }
  function wireTriggers() {
    var els = [];
    var byId = document.getElementById("tourTrigger");
    if (byId) els.push(byId);
    var data = document.querySelectorAll("[data-goulburn-tour]");
    for (var i = 0; i < data.length; i++) els.push(data[i]);
    els.forEach(function (el) { el.addEventListener("click", function (e) { e.preventDefault(); doOpen(); }); });
  }
  // Auto-run once per visitor; ?tour or #tour force-replays (e.g. for sharing).
  function maybeAutoRun() {
    try {
      var force = false;
      try { force = new URLSearchParams(location.search).get("tour") !== null || location.hash === "#tour"; } catch (e) {}
      if (force) { setTimeout(doOpen, 250); return; }
      var seen = false;
      try { seen = localStorage.getItem("gt_tour_seen") === "1"; } catch (e) {}
      if (!seen) {
        try { localStorage.setItem("gt_tour_seen", "1"); } catch (e) {}
        setTimeout(doOpen, 900);
      }
    } catch (e) {}
  }
  function init() {
    try { injectCss(); wireTriggers(); maybeAutoRun(); }
    catch (err) { if (window.console) console.warn("[tour] init failed", err); }
  }

  window.GoulburnTour = { open: doOpen, close: close, _mounted: true };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
