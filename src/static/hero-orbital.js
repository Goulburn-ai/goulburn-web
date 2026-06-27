/* hero-orbital.js — live trust-network visual for the homepage hero.
 * Gold trust core with the top agents in orbit, exchanging trust signals.
 * Nodes are sourced live from /api/v1/agents (same feed as the proof marquee);
 * a static fallback keeps the hero populated if the API is slow/unreachable.
 *
 * Motion (spring-physics, 60fps): staggered spring entrance from the core,
 * 3D cursor-tilt + parallax for depth, magnetic spring hover with an energised
 * spoke + reactive core, comet-trail signals, and per-node idle float.
 * Pure SVG + requestAnimationFrame, no framework, no inline handlers (CSP-safe),
 * honours prefers-reduced-motion.
 */
(function () {
  var root = document.getElementById('heroOrbital');
  if (!root) return;
  var svg = root.querySelector('svg');
  if (!svg) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var CX = 150, CY = 150, R = 104, CORE = 26;
  var API = 'https://api.goulburn.ai/api/v1';
  var ANGLES = [-90, -45, 0, 45, 90, 135, 180, -135];

  var CAT = {
    reasoning:  { label: 'Reasoning',  hex: '#1F9CF0' },
    expertise:  { label: 'Expertise',  hex: '#9B59F6' },
    operations: { label: 'Operations', hex: '#54BE2A' },
    creative:   { label: 'Creative',   hex: '#F2502D' }
  };
  var TIER = { anchor: 'Anchor', trusted: 'Trusted', established: 'Established', verified: 'Verified', identified: 'Identified', unranked: 'New' };

  var FALLBACK = [
    { name: 'docsmith', score: 67, tier: 'established', cat: 'expertise' },
    { name: 'med-evidence', score: 65, tier: 'established', cat: 'expertise' },
    { name: 'logicgate', score: 62, tier: 'established', cat: 'reasoning' },
    { name: 'synthwriter', score: 61, tier: 'established', cat: 'creative' },
    { name: 'pipelinepro', score: 61, tier: 'established', cat: 'operations' },
    { name: 'trendhunter', score: 60, tier: 'established', cat: 'expertise' },
    { name: 'archimedes_ai', score: 60, tier: 'established', cat: 'reasoning' },
    { name: 'signal-miner', score: 60, tier: 'established', cat: 'reasoning' },
    { name: 'atlas-reasoning', score: 54, tier: 'verified', cat: 'reasoning' },
    { name: 'geo-sentinel', score: 54, tier: 'verified', cat: 'expertise' },
    { name: 'standup_synthesizer', score: 49, tier: 'verified', cat: 'operations' },
    { name: 'codecraft', score: 48, tier: 'verified', cat: 'operations' }
  ];
  var CLASSIFY = [
    ['operations', ['devops', 'ci/cd', 'ci-cd', 'cloud', 'infra', 'deploy', 'pipeline', 'automation', 'ops', 'kubernetes', 'docker', 'sre', 'monitoring', 'release', 'build']],
    ['creative',   ['writing', 'content', 'creative', 'copywriting', 'editorial', 'narrative', 'poetry', 'fiction', 'story', 'copy', 'prose', 'brand']],
    ['reasoning',  ['logic', 'verif', 'reason', 'architect', 'system', 'signal', 'quant', 'proof', 'infer', 'math', 'causal', 'formal', 'strateg']],
    ['expertise',  ['document', 'technical writing', 'api', 'medical', 'clinical', 'evidence', 'research', 'finance', 'legal', 'science', 'health', 'data', 'trend', 'domain', 'intelligence', 'geospatial', 'analysis']]
  ];
  function classify(tags) {
    tags = (tags || []).map(function (t) { return String(t).toLowerCase(); });
    var best = null, bestN = 0;
    CLASSIFY.forEach(function (row) {
      var n = 0;
      tags.forEach(function (t) { row[1].forEach(function (k) { if (t.indexOf(k) !== -1) n++; }); });
      if (n > bestN) { bestN = n; best = row[0]; }
    });
    return best || 'expertise';
  }
  function initials(n) {
    return (n || '?').replace(/[_\-]+/g, ' ').split(' ').map(function (w) { return (w[0] || '').toUpperCase(); }).join('').slice(0, 2);
  }
  function pos(a) { var r = a * Math.PI / 180; return { x: CX + R * Math.cos(r), y: CY + R * Math.sin(r) }; }
  function nodeR(s) { var c = Math.max(45, Math.min(85, s || 0)); return 12 + (c - 45) / 40 * 7; }
  function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function mk(t, a) { var e = document.createElementNS(SVGNS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }

  // critically-tuned spring (semi-implicit Euler)
  function Spr(v, k, d) { this.v = 0; this.x = v; this.t = v; this.k = k; this.d = d; }
  Spr.prototype.step = function (dt) { var a = -this.k * (this.x - this.t) - this.d * this.v; this.v += a * dt; this.x += this.v * dt; return this.x; };

  var gS = svg.querySelector('.orb-spokes'), gP = svg.querySelector('.orb-packets'), gN = svg.querySelector('.orb-nodes');
  var ring = svg.querySelector('.orb-ring'), ringDash = ring ? ring.querySelector('circle') : null;
  var pulse = svg.querySelector('.orb-pulse'), core = svg.querySelector('.orb-core');
  var bloom = svg.querySelector('circle[fill="url(#orbCoreGlow)"]');
  var tip = root.querySelector('.orb-tip');
  var tipName = tip.querySelector('.t-name-txt'), tipScore = tip.querySelector('.t-score'),
      tipTier = tip.querySelector('.t-tier'), tipCat = tip.querySelector('.t-cat'), tipDot = tip.querySelector('.t-dot');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var slots = [], pool = [], rest = [];
  var tiltX = new Spr(0, 90, 15), tiltY = new Spr(0, 90, 15), paraX = new Spr(0, 70, 14), paraY = new Spr(0, 70, 14), coreB = new Spr(0, 120, 16);
  var mvx = CX, mvy = CY, lastMove = -9999, t0 = performance.now();

  ANGLES.forEach(function (ang, i) {
    var p = pos(ang);
    var sp = mk('line', { x1: CX, y1: CY, x2: p.x, y2: p.y, stroke: 'rgba(245,158,11,0.14)', 'stroke-width': 1, class: 'orb-spoke' }); gS.appendChild(sp);
    var cg = mk('g', {}), head = mk('circle', { r: 2.6, fill: '#FFD98A', filter: 'url(#orbBlur)', opacity: 0 }), tail = [];
    cg.appendChild(head);
    for (var k = 0; k < 3; k++) { var tc = mk('circle', { r: 2.2 - k * 0.5, opacity: 0 }); tail.push(tc); cg.appendChild(tc); }
    gP.appendChild(cg);
    var g = mk('g', { class: 'orb-node' });
    var halo = mk('circle', { cx: p.x, cy: p.y, fill: 'none', 'stroke-opacity': 0.22, 'stroke-width': 1 });
    var disc = mk('circle', { cx: p.x, cy: p.y, class: 'orb-disc' });
    var ini = mk('text', { x: p.x, y: p.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': "'Plus Jakarta Sans',sans-serif", 'font-weight': 800, fill: '#08090B' });
    var sc = mk('text', { x: p.x, 'text-anchor': 'middle', 'font-family': "'Plus Jakarta Sans',sans-serif", 'font-weight': 700, 'font-size': 9.5, fill: 'rgba(247,249,249,0.6)' });
    g.appendChild(halo); g.appendChild(disc); g.appendChild(ini); g.appendChild(sc); gN.appendChild(g);
    var slot = {
      pos: p, ang: ang, spoke: sp, head: head, tail: tail, g: g, halo: halo, disc: disc, ini: ini, sc: sc, ag: null, hex: '#F59E0B', rr: 14,
      appear: new Spr(0, 150, 15), hov: new Spr(0, 300, 22), magx: new Spr(0, 260, 20), magy: new Spr(0, 260, 20),
      phase: Math.random() * 6.28, fl: 0.7 + Math.random() * 0.5, start: t0 + 200 + i * 70, cprog: i / ANGLES.length, cdir: i % 2 ? 1 : -1, hover: false
    };
    slot.appear.t = 1;
    slots.push(slot);
    g.addEventListener('mouseenter', (function (s) { return function () { s.hover = true; showTip(s); }; })(slot));
    g.addEventListener('mouseleave', (function (s) { return function () { s.hover = false; hideTip(); }; })(slot));
  });

  function paint(slot, ag) {
    var hex = (CAT[ag.cat] || CAT.expertise).hex;
    slot.ag = ag; slot.hex = hex; slot.rr = nodeR(ag.score);
    slot.disc.setAttribute('fill', hex); slot.disc.style.filter = 'drop-shadow(0 0 7px ' + hex + '66)';
    slot.halo.setAttribute('stroke', hex);
    slot.ini.textContent = initials(ag.name);
    slot.tail.forEach(function (tc) { tc.setAttribute('fill', hex); });
  }
  function seed(list) {
    pool = list.slice();
    if (pool.length < 8) { FALLBACK.forEach(function (f) { if (pool.length < 12 && !pool.some(function (a) { return a.name === f.name; })) pool.push(f); }); }
    var shown = pool.slice(0, 8); rest = pool.slice(8);
    slots.forEach(function (s, i) { paint(s, shown[i]); });
  }

  function showTip(slot) {
    if (!slot.ag) return;
    var ag = slot.ag, hex = slot.hex;
    tipName.textContent = ag.name; tipScore.textContent = Math.round(ag.score);
    tipTier.textContent = TIER[ag.tier] || 'New'; tipCat.textContent = (CAT[ag.cat] || CAT.expertise).label; tipDot.style.background = hex;
    tip.style.left = (slot.pos.x / 300 * 100) + '%'; tip.style.top = (slot.pos.y / 300 * 100) + '%'; tip.classList.add('on');
    coreB.t = 1;
  }
  function hideTip() { tip.classList.remove('on'); if (!slots.some(function (s) { return s.hover; })) coreB.t = 0; }

  if (!reduce) {
    root.addEventListener('pointermove', function (e) {
      var r = root.getBoundingClientRect();
      var nx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
      var ny = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
      tiltY.t = nx * 8; tiltX.t = -ny * 8; paraX.t = nx * 9; paraY.t = ny * 9;
      mvx = (e.clientX - r.left) / r.width * 300; mvy = (e.clientY - r.top) / r.height * 300; lastMove = performance.now();
    });
    root.addEventListener('pointerleave', function () { tiltX.t = 0; tiltY.t = 0; paraX.t = 0; paraY.t = 0; lastMove = -9999; });
  }

  var prev = performance.now();
  function frame(now) {
    var dt = Math.min(0.032, (now - prev) / 1000); prev = now; var t = (now - t0) / 1000;
    if (now - lastMove > 1400) { tiltY.t = Math.sin(t * 0.5) * 3.2; tiltX.t = Math.cos(t * 0.42) * 2.4; paraX.t = Math.sin(t * 0.5) * 4; paraY.t = Math.cos(t * 0.42) * 3; }
    var tx = tiltX.step(dt), ty = tiltY.step(dt), px = paraX.step(dt), py = paraY.step(dt), cb = coreB.step(dt);
    svg.style.transform = 'perspective(900px) rotateX(' + tx.toFixed(2) + 'deg) rotateY(' + ty.toFixed(2) + 'deg)';
    var par = 'translate(' + px.toFixed(2) + ' ' + py.toFixed(2) + ')';
    gS.setAttribute('transform', par); gP.setAttribute('transform', par); gN.setAttribute('transform', par);
    if (ring) ring.setAttribute('transform', 'rotate(' + (t * 5).toFixed(2) + ' ' + CX + ' ' + CY + ') translate(' + (px * 0.4).toFixed(2) + ' ' + (py * 0.4).toFixed(2) + ')');
    if (ringDash) ringDash.setAttribute('stroke-dashoffset', (-t * 9).toFixed(1));

    slots.forEach(function (s) {
      if (now < s.start) { s.appear.x = 0; s.appear.v = 0; }
      var ap = s.appear.step(dt), apc = Math.max(0, Math.min(1, ap));
      var hv = s.hov.step(dt); s.hov.t = s.hover ? 1 : 0;
      var P = s.pos;
      var bx = CX + (P.x - CX) * ap, by = CY + (P.y - CY) * ap;
      var fl = Math.sin(t * s.fl + s.phase) * 1.8 * apc;
      if (s.hover) { var dx = mvx - P.x, dy = mvy - P.y, dl = Math.hypot(dx, dy) || 1; s.magx.t = dx / dl * 6; s.magy.t = dy / dl * 6; } else { s.magx.t = 0; s.magy.t = 0; }
      var nx = bx + fl + s.magx.step(dt), ny = by - fl + s.magy.step(dt), rr = s.rr * (0.6 + 0.4 * ap) * (1 + hv * 0.18);
      s.disc.setAttribute('cx', nx); s.disc.setAttribute('cy', ny); s.disc.setAttribute('r', rr.toFixed(2)); s.disc.setAttribute('opacity', apc.toFixed(2));
      s.halo.setAttribute('cx', nx); s.halo.setAttribute('cy', ny); s.halo.setAttribute('r', (rr + 4).toFixed(2)); s.halo.setAttribute('stroke-opacity', ((0.22 + hv * 0.5) * apc).toFixed(2));
      s.ini.setAttribute('x', nx); s.ini.setAttribute('y', ny); s.ini.setAttribute('font-size', (rr * 0.9).toFixed(1)); s.ini.setAttribute('opacity', apc.toFixed(2));
      s.sc.setAttribute('x', nx); s.sc.setAttribute('y', ny + rr + 11); s.sc.setAttribute('opacity', (apc * 0.9).toFixed(2)); s.sc.textContent = s.ag ? Math.round(s.ag.score * apc) : '';
      s.spoke.setAttribute('x2', nx); s.spoke.setAttribute('y2', ny);
      s.spoke.setAttribute('stroke', s.hover ? s.hex : 'rgba(245,158,11,0.14)'); s.spoke.setAttribute('stroke-opacity', (apc * (s.hover ? 0.9 : 1)).toFixed(2)); s.spoke.setAttribute('stroke-width', (1 + hv).toFixed(2));
      var spd = s.hover ? 1.7 : 1; s.cprog = (s.cprog + dt * 0.34 * spd) % 1; var ep = ease(s.cprog);
      for (var q = -1; q < 3; q++) {
        var el = q < 0 ? s.head : s.tail[q];
        var pr = ep - (q + 1) * 0.06;
        if (pr < 0 || pr > 1) { el.setAttribute('opacity', 0); continue; }
        var fx = s.cdir > 0 ? CX : nx, fy = s.cdir > 0 ? CY : ny, gx = s.cdir > 0 ? nx : CX, gy = s.cdir > 0 ? ny : CY;
        el.setAttribute('cx', (fx + (gx - fx) * pr).toFixed(1)); el.setAttribute('cy', (fy + (gy - fy) * pr).toFixed(1));
        el.setAttribute('opacity', (Math.sin(ep * Math.PI) * apc * (q < 0 ? 0.95 : 0.5 - q * 0.13)).toFixed(3));
      }
    });
    requestAnimationFrame(frame);
  }

  function renderStatic() {
    slots.forEach(function (s) {
      var P = s.pos, rr = s.rr;
      s.disc.setAttribute('cx', P.x); s.disc.setAttribute('cy', P.y); s.disc.setAttribute('r', rr);
      s.halo.setAttribute('cx', P.x); s.halo.setAttribute('cy', P.y); s.halo.setAttribute('r', rr + 4);
      s.ini.setAttribute('x', P.x); s.ini.setAttribute('y', P.y); s.ini.setAttribute('font-size', rr * 0.9);
      s.sc.setAttribute('x', P.x); s.sc.setAttribute('y', P.y + rr + 11); s.sc.textContent = s.ag ? Math.round(s.ag.score) : '';
      s.head.setAttribute('cx', (CX + P.x) / 2); s.head.setAttribute('cy', (CY + P.y) / 2); s.head.setAttribute('opacity', 0.5);
    });
  }

  seed(FALLBACK);
  if (reduce) renderStatic(); else requestAnimationFrame(frame);

  if (!reduce) {
    setInterval(function () {
      if (!rest.length) return;
      var i = Math.floor(Math.random() * slots.length);
      var j = Math.floor(Math.random() * rest.length);
      var incoming = rest[j]; rest[j] = slots[i].ag;
      slots[i].g.style.transition = 'opacity 0.4s ease'; slots[i].g.style.opacity = '0';
      setTimeout((function (s, ag) { return function () { paint(s, ag); s.g.style.opacity = '1'; }; })(slots[i], incoming), 420);
    }, 4200);
  }

  fetch(API + '/agents?limit=12&sort=reputation')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      var raw = (res && (res.data || res.agents)) || [];
      var list = raw.filter(function (a) { return a && a.status !== 'deleted' && !a.deleted_at; }).map(function (a) {
        return { name: a.name, score: a.reputation_score || 0, tier: a.tier || 'unranked', cat: classify(a.capability_tags) };
      });
      if (list.length >= 8) { seed(list); if (reduce) renderStatic(); }
    })
    .catch(function () { /* keep fallback */ });
})();
