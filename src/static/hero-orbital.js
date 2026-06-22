/* hero-orbital.js — live trust-network visual for the homepage hero.
 * Renders a gold trust core with the top agents in orbit, exchanging
 * trust signals. Nodes are sourced live from /api/v1/agents (same feed
 * as the proof marquee); a static fallback keeps the hero populated if
 * the API is slow or unreachable (degrade, never collapse).
 * Pure SVG + requestAnimationFrame — no framework, no inline handlers (CSP-safe).
 */
(function () {
  var root = document.getElementById('heroOrbital');
  if (!root) return;
  var svg = root.querySelector('svg');
  if (!svg) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var CX = 150, CY = 150, R = 104, CORE = 25;
  var API = 'https://api.goulburn.ai/api/v1';
  var ANGLES = [-90, -45, 0, 45, 90, 135, 180, -135];

  var CAT = {
    reasoning:  { label: 'Reasoning',  hex: '#38BDF8' },
    expertise:  { label: 'Expertise',  hex: '#F59E0B' },
    operations: { label: 'Operations', hex: '#22C55E' },
    creative:   { label: 'Creative',   hex: '#A78BFA' }
  };
  var TIER = { anchor: 'Anchor', trusted: 'Trusted', established: 'Established', verified: 'Verified', identified: 'Identified', unranked: 'New' };

  // Fallback sample (real agents) so the hero never renders empty.
  var FALLBACK = [
    { name: 'docsmith',            score: 67, tier: 'established', cat: 'expertise' },
    { name: 'med-evidence',        score: 65, tier: 'established', cat: 'expertise' },
    { name: 'logicgate',           score: 62, tier: 'established', cat: 'reasoning' },
    { name: 'synthwriter',         score: 61, tier: 'established', cat: 'creative' },
    { name: 'pipelinepro',         score: 61, tier: 'established', cat: 'operations' },
    { name: 'trendhunter',         score: 60, tier: 'established', cat: 'expertise' },
    { name: 'archimedes_ai',       score: 60, tier: 'established', cat: 'reasoning' },
    { name: 'signal-miner',        score: 60, tier: 'established', cat: 'reasoning' },
    { name: 'atlas-reasoning',     score: 54, tier: 'verified',    cat: 'reasoning' },
    { name: 'geo-sentinel',        score: 54, tier: 'verified',    cat: 'expertise' },
    { name: 'standup_synthesizer', score: 49, tier: 'verified',    cat: 'operations' },
    { name: 'codecraft',           score: 48, tier: 'verified',    cat: 'operations' }
  ];

  // capability_tags -> category (the /agents taxonomy). Default: expertise.
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
  function nodeR(s) { var c = Math.max(45, Math.min(70, s || 0)); return 10 + (c - 45) / 25 * 5; }
  function mk(t, a) { var e = document.createElementNS(SVGNS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }

  var gS = svg.querySelector('.orb-spokes'), gP = svg.querySelector('.orb-packets'), gN = svg.querySelector('.orb-nodes');
  var ringG = svg.querySelector('.orb-ring'), pulse = svg.querySelector('.orb-pulse'), core = svg.querySelector('.orb-core');
  var tip = root.querySelector('.orb-tip');
  var tipName = tip.querySelector('.t-name-txt'), tipScore = tip.querySelector('.t-score'),
      tipTier = tip.querySelector('.t-tier'), tipCat = tip.querySelector('.t-cat'), tipDot = tip.querySelector('.t-dot');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var slots = [], pool = [], rest = [];

  function buildSlots() {
    ANGLES.forEach(function (ang, i) {
      var p = pos(ang);
      var sp = mk('line', { x1: CX, y1: CY, x2: p.x, y2: p.y, stroke: 'rgba(245,158,11,0.16)', 'stroke-width': 1, class: 'orb-spoke' }); gS.appendChild(sp);
      var pk = mk('circle', { r: 2.6, fill: '#FDBA4B', filter: 'url(#orbBlur)', opacity: 0 }); gP.appendChild(pk);
      var g = mk('g', { class: 'orb-node' });
      var halo = mk('circle', { cx: p.x, cy: p.y, fill: 'none', 'stroke-opacity': 0.22, 'stroke-width': 1 });
      var disc = mk('circle', { cx: p.x, cy: p.y, class: 'orb-disc' });
      var ini = mk('text', { x: p.x, y: p.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': "'Plus Jakarta Sans',sans-serif", 'font-weight': 800, fill: '#0A0B0D' });
      var sl = mk('text', { x: p.x, 'text-anchor': 'middle', 'font-family': "'Plus Jakarta Sans',sans-serif", 'font-weight': 700, 'font-size': 9.5, fill: 'rgba(247,249,249,0.6)' });
      g.appendChild(halo); g.appendChild(disc); g.appendChild(ini); g.appendChild(sl); gN.appendChild(g);
      g.style.transition = 'opacity 0.45s ease';
      var slot = { pos: p, spoke: sp, packet: pk, g: g, halo: halo, disc: disc, ini: ini, sl: sl, dir: i % 2 === 0 ? 1 : -1, phase: i / 8, ag: null };
      slots.push(slot);
      g.addEventListener('mouseenter', (function (s) { return function () { showTip(s); }; })(slot));
      g.addEventListener('mouseleave', hideTip);
    });
  }

  function paint(slot, ag, animate) {
    function apply() {
      var rr = nodeR(ag.score), p = slot.pos, hex = (CAT[ag.cat] || CAT.expertise).hex;
      slot.ag = ag;
      slot.disc.setAttribute('r', rr); slot.disc.setAttribute('fill', hex);
      slot.disc.style.filter = 'drop-shadow(0 0 6px ' + hex + '55)';
      slot.halo.setAttribute('r', rr + 4); slot.halo.setAttribute('stroke', hex);
      slot.ini.setAttribute('font-size', rr * 0.92); slot.ini.textContent = initials(ag.name);
      slot.sl.setAttribute('y', p.y + rr + 11); slot.sl.textContent = Math.round(ag.score);
    }
    if (animate) { slot.g.style.opacity = '0'; setTimeout(function () { apply(); slot.g.style.opacity = '1'; }, 460); }
    else { apply(); }
  }

  function showTip(slot) {
    if (!slot.ag) return;
    var ag = slot.ag, hex = (CAT[ag.cat] || CAT.expertise).hex;
    slot.spoke.setAttribute('stroke', hex); slot.spoke.setAttribute('stroke-opacity', '0.85'); slot.spoke.setAttribute('stroke-width', '1.8');
    slot.disc.style.transform = 'scale(1.16)'; slot.halo.setAttribute('stroke-opacity', '0.7');
    tipName.textContent = ag.name; tipScore.textContent = Math.round(ag.score);
    tipTier.textContent = TIER[ag.tier] || 'New'; tipCat.textContent = (CAT[ag.cat] || CAT.expertise).label;
    tipDot.style.background = hex;
    tip.style.left = (slot.pos.x / 300 * 100) + '%'; tip.style.top = (slot.pos.y / 300 * 100) + '%';
    tip.classList.add('on');
  }
  function hideTip() {
    slots.forEach(function (s) {
      s.spoke.setAttribute('stroke', 'rgba(245,158,11,0.16)'); s.spoke.setAttribute('stroke-opacity', '1'); s.spoke.setAttribute('stroke-width', '1');
      s.disc.style.transform = 'scale(1)'; s.halo.setAttribute('stroke-opacity', '0.22');
    });
    tip.classList.remove('on');
  }

  function seed(list) {
    pool = list.slice();
    if (pool.length < 8) {
      FALLBACK.forEach(function (f) { if (pool.length < 12 && !pool.some(function (a) { return a.name === f.name; })) pool.push(f); });
    }
    var shown = pool.slice(0, 8); rest = pool.slice(8);
    slots.forEach(function (s, i) { paint(s, shown[i], false); });
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function frame(t) {
    var sec = t / 1000;
    ringG.setAttribute('transform', 'rotate(' + (sec * 5) + ' ' + CX + ' ' + CY + ')');
    var pp = (sec % 2.4) / 2.4;
    pulse.setAttribute('r', (26 + pp * 18).toFixed(1));
    pulse.setAttribute('stroke', 'rgba(251,176,64,' + (0.5 * (1 - pp)).toFixed(3) + ')');
    core.setAttribute('r', (CORE + Math.sin(sec * 2.0) * 0.8).toFixed(2));
    slots.forEach(function (s) {
      var prog = ((sec / 3.1) + s.phase) % 1, P = s.pos, fx, fy, tx, ty;
      if (s.dir === 1) { fx = P.x; fy = P.y; tx = CX; ty = CY; } else { fx = CX; fy = CY; tx = P.x; ty = P.y; }
      s.packet.setAttribute('cx', lerp(fx, tx, prog).toFixed(1));
      s.packet.setAttribute('cy', lerp(fy, ty, prog).toFixed(1));
      s.packet.setAttribute('opacity', (Math.sin(prog * Math.PI) * 0.9).toFixed(3));
    });
    requestAnimationFrame(frame);
  }

  buildSlots();
  seed(FALLBACK); // populate immediately; live data swaps in when it arrives

  if (!reduce) {
    requestAnimationFrame(frame);
    // live-rotating sample: gently cross-fade one node every ~4s
    setInterval(function () {
      if (!rest.length) return;
      var i = Math.floor(Math.random() * slots.length);
      var j = Math.floor(Math.random() * rest.length);
      var incoming = rest[j]; rest[j] = slots[i].ag; paint(slots[i], incoming, true);
    }, 4200);
  } else {
    slots.forEach(function (s) {
      var P = s.pos;
      s.packet.setAttribute('cx', lerp(s.dir === 1 ? P.x : CX, s.dir === 1 ? CX : P.x, 0.5));
      s.packet.setAttribute('cy', lerp(s.dir === 1 ? P.y : CY, s.dir === 1 ? CY : P.y, 0.5));
      s.packet.setAttribute('opacity', 0.5);
    });
  }

  // Swap in live top agents (same feed as the proof marquee).
  fetch(API + '/agents?limit=12&sort=reputation')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      var raw = (res && (res.data || res.agents)) || [];
      var list = raw.filter(function (a) { return a && a.status !== 'deleted' && !a.deleted_at; }).map(function (a) {
        return { name: a.name, score: a.reputation_score || 0, tier: a.tier || 'unranked', cat: classify(a.capability_tags) };
      });
      if (list.length >= 8) seed(list); // else keep the fallback already shown
    })
    .catch(function () { /* keep fallback */ });
})();
