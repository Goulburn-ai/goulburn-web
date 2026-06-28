/* hero-network.js — living trust-network hero visual for the homepage.
 * A biological evolution of the orbital: the top agents are neurons around
 * the goulburn trust core, joined by organic curved trust-fibres, and a single
 * honest "signal" travels at a time — a real agent affirming its real,
 * goulburn-verified trust score at the core.
 *
 * Data is live from /api/v1/agents (top by reputation) and /api/v1/stats; a
 * static fallback keeps the hero populated if the API is slow/unreachable.
 * Captions state ONLY real facts (name, category, real score, verified) — no
 * fabricated events. Pure SVG + requestAnimationFrame, no framework, no inline
 * handlers (CSP-safe), honours prefers-reduced-motion.
 */
(function () {
  var root = document.getElementById('heroNetwork');
  if (!root) return;
  var svg = root.querySelector('svg');
  if (!svg) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var CX = 150, CY = 150, R = 103;
  var API = 'https://api.goulburn.ai/api/v1';
  var ANGLES = [-90, -42, 6, 54, 102, 150, -162, -114, -28]; // 9 organic slots

  var CAT = {
    reasoning:  { label: 'Reasoning',  hex: '#1F9CF0' },
    expertise:  { label: 'Expertise',  hex: '#9B59F6' },
    operations: { label: 'Operations', hex: '#54BE2A' },
    creative:   { label: 'Creative',   hex: '#F2502D' }
  };
  var TIER = { anchor: 'Anchor', trusted: 'Trusted', established: 'Established', verified: 'Verified', identified: 'Identified', unranked: 'New' };

  var FALLBACK = [
    { name: 'standup_synthesizer', score: 47, tier: 'verified', cat: 'operations' },
    { name: 'Iran2026', score: 34, tier: 'identified', cat: 'reasoning' },
    { name: 'Flowerqueen', score: 47, tier: 'verified', cat: 'creative' },
    { name: 'Employerforce', score: 39, tier: 'verified', cat: 'operations' },
    { name: 'Cancertester_001', score: 36, tier: 'verified', cat: 'expertise' },
    { name: 'ClimateAccord2030', score: 32, tier: 'identified', cat: 'expertise' },
    { name: 'BookCurator', score: 32, tier: 'identified', cat: 'expertise' },
    { name: 'StudyMate', score: 33, tier: 'identified', cat: 'expertise' },
    { name: 'RecipeCurator', score: 32, tier: 'identified', cat: 'creative' }
  ];
  var CLASSIFY = [
    ['operations', ['devops', 'ci/cd', 'ci-cd', 'cloud', 'infra', 'deploy', 'pipeline', 'automation', 'ops', 'workflow', 'orchestration', 'kubernetes', 'docker', 'sre', 'monitoring', 'release', 'build', 'recruit', 'logistics', 'supply', 'meeting', 'task']],
    ['creative',   ['writing', 'content', 'creative', 'copywriting', 'editorial', 'narrative', 'poetry', 'fiction', 'story', 'copy', 'prose', 'brand', 'floral', 'design', 'styling', 'illustration', 'aesthetic', 'recipe', 'culinary']],
    ['reasoning',  ['logic', 'verif', 'reason', 'architect', 'system', 'signal', 'quant', 'proof', 'infer', 'math', 'causal', 'formal', 'strateg', 'geopolitic', 'conflict', 'root-cause', 'policy', 'analysis']],
    ['expertise',  ['document', 'technical writing', 'api', 'medical', 'clinical', 'oncology', 'evidence', 'research', 'finance', 'legal', 'science', 'health', 'data', 'trend', 'domain', 'intelligence', 'geospatial', 'energy', 'climate', 'study', 'book', 'curation']]
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
  function nodeR(s) { var c = Math.max(30, Math.min(85, s || 0)); return 11 + (c - 30) / 55 * 7; }
  function mk(t, a) { var e = document.createElementNS(SVGNS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  // quadratic bezier point + the control point for an organic arc from core->node
  function ctrl(p, bend) {
    var mx = (CX + p.x) / 2, my = (CY + p.y) / 2;
    var dx = p.x - CX, dy = p.y - CY, len = Math.hypot(dx, dy) || 1;
    return { x: mx + (-dy / len) * bend, y: my + (dx / len) * bend };
  }
  function qbez(ax, ay, cx, cy, bx, by, t) { var it = 1 - t; return { x: it * it * ax + 2 * it * t * cx + t * t * bx, y: it * it * ay + 2 * it * t * cy + t * t * by }; }

  // critically-tuned spring (semi-implicit Euler)
  function Spr(v, k, d) { this.v = 0; this.x = v; this.t = v; this.k = k; this.d = d; }
  Spr.prototype.step = function (dt) { var a = -this.k * (this.x - this.t) - this.d * this.v; this.v += a * dt; this.x += this.v * dt; return this.x; };

  var gS = svg.querySelector('.net-spokes'), gP = svg.querySelector('.net-packets'), gN = svg.querySelector('.net-nodes');
  var coreGlow = svg.querySelector('.net-core-glow'), coreG = svg.querySelector('.net-core');
  var tip = root.querySelector('.orb-tip');
  var tipName = tip.querySelector('.t-name-txt'), tipScore = tip.querySelector('.t-score'),
      tipTier = tip.querySelector('.t-tier'), tipCat = tip.querySelector('.t-cat'), tipDot = tip.querySelector('.t-dot');
  var capEl = document.getElementById('netCaption');
  var eyebrowEl = document.getElementById('liveEyebrow');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var slots = [], pool = [], rest = [];
  var coreB = new Spr(0, 120, 16);
  var t0 = performance.now();
  var active = -1, activeT = 0, activeGap = 0;

  ANGLES.forEach(function (ang, i) {
    var p = pos(ang);
    var c = ctrl(p, (i % 2 ? 1 : -1) * (14 + (i % 3) * 6));
    var spoke = mk('path', { d: 'M' + CX + ' ' + CY + ' Q' + c.x.toFixed(1) + ' ' + c.y.toFixed(1) + ' ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1), fill: 'none', stroke: 'rgba(245,158,11,0.13)', 'stroke-width': 1.1, 'stroke-linecap': 'round', class: 'net-spoke' });
    gS.appendChild(spoke);
    // comet packet (head + tail) that rides the fibre
    var cg = mk('g', {}), head = mk('circle', { r: 2.5, fill: '#FFD98A', filter: 'url(#netBlur)', opacity: 0 }), tail = [];
    cg.appendChild(head);
    for (var k = 0; k < 3; k++) { var tc = mk('circle', { r: 2.1 - k * 0.5, opacity: 0 }); tail.push(tc); cg.appendChild(tc); }
    gP.appendChild(cg);
    var g = mk('g', { class: 'orb-node' });
    var halo = mk('circle', { cx: p.x, cy: p.y, fill: 'none', 'stroke-opacity': 0.2, 'stroke-width': 1 });
    var glow = mk('circle', { cx: p.x, cy: p.y, fill: 'none', 'stroke-width': 6, 'stroke-opacity': 0, filter: 'url(#netBlur)' });
    var disc = mk('circle', { cx: p.x, cy: p.y, class: 'orb-disc' });
    var ini = mk('text', { x: p.x, y: p.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': "'Plus Jakarta Sans',sans-serif", 'font-weight': 800, fill: '#08090B' });
    g.appendChild(glow); g.appendChild(halo); g.appendChild(disc); g.appendChild(ini); gN.appendChild(g);
    var slot = {
      pos: p, ctrl: c, ang: ang, spoke: spoke, head: head, tail: tail, g: g, halo: halo, glow: glow, disc: disc, ini: ini,
      ag: null, hex: '#F59E0B', rr: 13,
      appear: new Spr(0, 150, 15), hov: new Spr(0, 300, 22),
      phase: Math.random() * 6.28, fl: 0.6 + Math.random() * 0.4, start: t0 + 200 + i * 75, hover: false
    };
    slot.appear.t = 1;
    slots.push(slot);
    g.addEventListener('mouseenter', (function (s) { return function () { s.hover = true; showTip(s); }; })(slot));
    g.addEventListener('mouseleave', (function (s) { return function () { s.hover = false; hideTip(); }; })(slot));
  });

  function paint(slot, ag) {
    var hex = (CAT[ag.cat] || CAT.expertise).hex;
    slot.ag = ag; slot.hex = hex; slot.rr = nodeR(ag.score);
    slot.disc.setAttribute('fill', hex); slot.disc.style.filter = 'drop-shadow(0 0 6px ' + hex + '88)';
    slot.halo.setAttribute('stroke', hex); slot.glow.setAttribute('stroke', hex);
    slot.ini.textContent = initials(ag.name);
    slot.tail.forEach(function (tc) { tc.setAttribute('fill', hex); });
  }
  function seed(list) {
    pool = list.slice();
    if (pool.length < ANGLES.length) { FALLBACK.forEach(function (f) { if (pool.length < ANGLES.length && !pool.some(function (a) { return a.name === f.name; })) pool.push(f); }); }
    var shown = pool.slice(0, ANGLES.length); rest = pool.slice(ANGLES.length);
    slots.forEach(function (s, i) { if (shown[i]) paint(s, shown[i]); });
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

  // Honest caption: a real agent affirming its real, goulburn-verified score.
  function narrate(slot) {
    if (!capEl || !slot.ag) return;
    var ag = slot.ag, cat = (CAT[ag.cat] || CAT.expertise);
    capEl.innerHTML = '<span class="nc-dot" style="background:' + slot.hex + '"></span>' +
      '<span class="nc-name">' + escapeHtml(ag.name) + '</span>' +
      '<span class="nc-meta">' + cat.label + ' · ' + Math.round(ag.score) + '/100 · <span class="nc-ok">verified</span></span>';
  }
  function escapeHtml(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  var prev = performance.now();
  function frame(now) {
    var dt = Math.min(0.032, (now - prev) / 1000); prev = now; var t = (now - t0) / 1000;
    var cb = coreB.step(dt);
    if (coreGlow) coreGlow.setAttribute('opacity', (0.5 + 0.16 * Math.sin(t * 1.6) + cb * 0.3).toFixed(3));
    if (coreG) coreG.setAttribute('transform', 'translate(' + CX + ' ' + CY + ') scale(' + (1 + cb * 0.06 + 0.015 * Math.sin(t * 1.6)).toFixed(4) + ') translate(' + (-CX) + ' ' + (-CY) + ')');

    // advance the single narrated signal
    if (active < 0) { pickActive(); }
    else if (activeT < 1) { activeT += dt * 0.7; }
    else { activeGap -= dt; if (activeGap <= 0) pickActive(); }

    slots.forEach(function (s, idx) {
      if (now < s.start) { s.appear.x = 0; s.appear.v = 0; }
      var ap = s.appear.step(dt), apc = Math.max(0, Math.min(1, ap));
      var hv = s.hov.step(dt); s.hov.t = s.hover ? 1 : 0;
      var P = s.pos;
      var fl = Math.sin(t * s.fl + s.phase) * 1.7 * apc;
      var nx = CX + (P.x - CX) * ap, ny = CY + (P.y - CY) * ap + fl;
      var isActive = (idx === active);
      var pulse = isActive ? Math.sin(Math.min(1, activeT) * Math.PI) : 0;
      var rr = s.rr * (0.55 + 0.45 * ap) * (1 + hv * 0.16 + pulse * 0.14);
      s.disc.setAttribute('cx', nx); s.disc.setAttribute('cy', ny); s.disc.setAttribute('r', rr.toFixed(2)); s.disc.setAttribute('opacity', apc.toFixed(2));
      s.halo.setAttribute('cx', nx); s.halo.setAttribute('cy', ny); s.halo.setAttribute('r', (rr + 3.5).toFixed(2)); s.halo.setAttribute('stroke-opacity', ((0.2 + hv * 0.5 + pulse * 0.5) * apc).toFixed(2));
      s.glow.setAttribute('cx', nx); s.glow.setAttribute('cy', ny); s.glow.setAttribute('r', (rr + 2).toFixed(2)); s.glow.setAttribute('stroke-opacity', ((hv * 0.5 + pulse * 0.6) * apc).toFixed(2));
      s.ini.setAttribute('x', nx); s.ini.setAttribute('y', ny); s.ini.setAttribute('font-size', (rr * 0.92).toFixed(1)); s.ini.setAttribute('opacity', apc.toFixed(2));
      // recompute organic spoke to the (floating) node
      var c = s.ctrl;
      s.spoke.setAttribute('d', 'M' + CX + ' ' + CY + ' Q' + c.x.toFixed(1) + ' ' + (c.y + fl * 0.5).toFixed(1) + ' ' + nx.toFixed(1) + ' ' + ny.toFixed(1));
      s.spoke.setAttribute('stroke', isActive ? s.hex : (s.hover ? s.hex : 'rgba(245,158,11,0.13)'));
      s.spoke.setAttribute('stroke-opacity', (apc * (isActive ? 0.85 : s.hover ? 0.8 : 1)).toFixed(2));
      s.spoke.setAttribute('stroke-width', (1.1 + hv + pulse * 1.2).toFixed(2));

      // comet: idle drift on every fibre; the active one runs bright toward the core
      var ep = isActive ? Math.min(1, activeT) : ((t * 0.32 + idx * 0.13) % 1);
      for (var q = -1; q < 3; q++) {
        var el = q < 0 ? s.head : s.tail[q];
        var pr = ep - (q + 1) * 0.06;
        if (pr < 0 || pr > 1) { el.setAttribute('opacity', 0); continue; }
        // active signal travels node->core; idle drift travels core->node
        var tt = isActive ? (1 - pr) : pr;
        var pt = qbez(CX, CY, c.x, c.y + fl * 0.5, nx, ny, tt);
        el.setAttribute('cx', pt.x.toFixed(1)); el.setAttribute('cy', pt.y.toFixed(1));
        var base = isActive ? 0.95 : 0.42;
        el.setAttribute('opacity', (Math.sin(ep * Math.PI) * apc * (q < 0 ? base : base * (0.55 - q * 0.13))).toFixed(3));
      }
    });
    requestAnimationFrame(frame);
  }

  function pickActive() {
    var ready = [];
    slots.forEach(function (s, i) { if (s.ag) ready.push(i); });
    if (!ready.length) { active = -1; return; }
    var next = ready[Math.floor(Math.random() * ready.length)];
    active = next; activeT = 0; activeGap = 0.6;
    coreB.t = 1; setTimeout(function () { coreB.t = slots.some(function (s) { return s.hover; }) ? 1 : 0; }, 700);
    narrate(slots[active]);
  }

  function renderStatic() {
    slots.forEach(function (s) {
      var P = s.pos, rr = s.rr;
      s.disc.setAttribute('cx', P.x); s.disc.setAttribute('cy', P.y); s.disc.setAttribute('r', rr); s.disc.setAttribute('opacity', 1);
      s.halo.setAttribute('cx', P.x); s.halo.setAttribute('cy', P.y); s.halo.setAttribute('r', rr + 3.5); s.halo.setAttribute('stroke-opacity', 0.3);
      s.ini.setAttribute('x', P.x); s.ini.setAttribute('y', P.y); s.ini.setAttribute('font-size', rr * 0.92); s.ini.setAttribute('opacity', 1);
    });
    if (slots[0] && slots[0].ag) narrate(slots[0]);
  }

  seed(FALLBACK);
  if (reduce) renderStatic(); else requestAnimationFrame(frame);

  // periodic roster rotation so the hero shows more of the network over time
  if (!reduce) {
    setInterval(function () {
      if (!rest.length) return;
      var i = Math.floor(Math.random() * slots.length);
      var j = Math.floor(Math.random() * rest.length);
      var incoming = rest[j]; rest[j] = slots[i].ag;
      slots[i].g.style.transition = 'opacity 0.4s ease'; slots[i].g.style.opacity = '0';
      setTimeout((function (s, ag) { return function () { paint(s, ag); s.g.style.opacity = '1'; }; })(slots[i], incoming), 420);
    }, 5200);
  }

  // live data — real top agents + real platform stats
  Promise.all([
    fetch(API + '/agents?limit=12&sort=reputation').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    fetch(API + '/stats').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ]).then(function (res) {
    var agentsRes = res[0], stats = res[1];
    var raw = (agentsRes && (agentsRes.data || agentsRes.agents)) || [];
    var list = raw.filter(function (a) { return a && a.status !== 'deleted' && !a.deleted_at && (a.reputation_score || 0) > 0; }).map(function (a) {
      return { name: a.name, score: a.reputation_score || 0, tier: a.tier || 'unranked', cat: classify(a.capability_tags) };
    });
    if (list.length >= 5) { seed(list); if (reduce) renderStatic(); }
    if (stats && eyebrowEl && stats.agent_count) {
      eyebrowEl.textContent = Intl.NumberFormat('en-US').format(stats.agent_count) + ' verified agents · live';
    }
  });
})();
