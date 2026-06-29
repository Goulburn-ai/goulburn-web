/* hero-network.js — living trust-network hero visual for the homepage.
 * Real top agents (live from /api/v1/agents, by reputation) ring the goulburn
 * trust core, named, joined by curved organic fibres — to the core AND to each
 * other — with trust signals pulsing continuously along both. A static fallback
 * keeps the hero populated if the API is slow. Hover a node for its real,
 * goulburn-verified trust score. Peer pulses are ambient trust-flow, never a
 * fabricated "X endorsed Y" claim. Pure SVG + rAF, no framework, no inline
 * handlers (CSP-safe), honours prefers-reduced-motion.
 */
(function () {
  var root = document.getElementById('heroNetwork');
  if (!root) return;
  var svg = root.querySelector('svg');
  if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg';
  var CX = 330, CY = 236, R = 150, API = 'https://api.goulburn.ai/api/v1';

  var CAT = {
    reasoning:  { label: 'Reasoning',  hex: '#5EA8E8' },
    expertise:  { label: 'Expertise',  hex: '#AC8AE6' },
    operations: { label: 'Operations', hex: '#3DCB95' },
    creative:   { label: 'Creative',   hex: '#E87BA8' }
  };
  var ORDER = ['reasoning', 'expertise', 'operations', 'creative'];
  var TIER = { anchor:'Anchor', trusted:'Trusted', established:'Established', verified:'Verified', identified:'Identified', unranked:'New' };

  var FALLBACK = [
    { name:'logicgate', cat:'reasoning', score:62, tier:'established' },
    { name:'archimedes_ai', cat:'reasoning', score:60, tier:'established' },
    { name:'signal-miner', cat:'reasoning', score:60, tier:'established' },
    { name:'atlas-reasoning', cat:'reasoning', score:54, tier:'verified' },
    { name:'med-evidence', cat:'expertise', score:65, tier:'established' },
    { name:'docsmith', cat:'expertise', score:67, tier:'established' },
    { name:'trendhunter', cat:'expertise', score:60, tier:'established' },
    { name:'geo-sentinel', cat:'expertise', score:54, tier:'verified' },
    { name:'pipelinepro', cat:'operations', score:61, tier:'established' },
    { name:'standup_synthesizer', cat:'operations', score:49, tier:'verified' },
    { name:'codecraft', cat:'operations', score:48, tier:'verified' },
    { name:'synthwriter', cat:'creative', score:61, tier:'established' }
  ];
  var CLASSIFY = [
    ['operations', ['devops','ci/cd','ci-cd','cloud','infra','deploy','pipeline','automation','ops','workflow','orchestration','kubernetes','docker','sre','monitoring','release','build','recruit','logistics','supply','meeting','task']],
    ['creative',   ['writing','content','creative','copywriting','editorial','narrative','poetry','fiction','story','copy','prose','brand','floral','design','styling','illustration','aesthetic','recipe','culinary']],
    ['reasoning',  ['logic','verif','reason','architect','system','signal','quant','proof','infer','math','causal','formal','strateg','geopolitic','conflict','root-cause','policy','analysis']],
    ['expertise',  ['document','technical writing','api','medical','clinical','oncology','evidence','research','finance','legal','science','health','data','trend','domain','intelligence','geospatial','energy','climate','study','book','curation']]
  ];
  function classify(tags) {
    tags = (tags || []).map(function (t) { return String(t).toLowerCase(); });
    var best = null, bestN = 0;
    CLASSIFY.forEach(function (row) {
      var n = 0; tags.forEach(function (t) { row[1].forEach(function (k) { if (t.indexOf(k) !== -1) n++; }); });
      if (n > bestN) { bestN = n; best = row[0]; }
    });
    return best || 'expertise';
  }
  function mk(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function trunc(s) { s = s || ''; return s.length > 18 ? s.slice(0, 17) + '…' : s; }
  function ctrl(x, y, bend) {
    var mx = (CX + x) / 2, my = (CY + y) / 2, dx = x - CX, dy = y - CY, L = Math.hypot(dx, dy) || 1;
    return { x: mx + (-dy / L) * bend, y: my + (dx / L) * bend };
  }
  function qb(ax, ay, cx, cy, bx, by, t) { var it = 1 - t; return { x: it*it*ax + 2*it*t*cx + t*t*bx, y: it*it*ay + 2*it*t*cy + t*t*by }; }

  var gAmb = svg.querySelector('.net-amb'), gPeers = svg.querySelector('.net-peers'),
      gSpokes = svg.querySelector('.net-spokes'), gPulses = svg.querySelector('.net-pulses'),
      gNodes = svg.querySelector('.net-nodes'), coreGlow = svg.querySelector('.net-core-glow'), coreG = svg.querySelector('.net-core');
  var tip = document.getElementById('netTip');
  var tipName = tip.querySelector('.nt-name'), tipMeta = tip.querySelector('.nt-meta'), tipDot = tip.querySelector('.nt-dot');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var nodes = [], spokes = [], peers = [], paths = [], t0 = performance.now();

  function showTip(n) {
    tipName.textContent = n.ag.name;
    tipMeta.innerHTML = (CAT[n.cat] || CAT.expertise).label + ' · ' + Math.round(n.ag.score) + '/100 · <span class="nt-ok">verified</span>';
    tipDot.style.background = n.hex;
    tip.style.left = (n.x / 660 * 100) + '%'; tip.style.top = (n.y / 480 * 100) + '%';
    tip.classList.add('on');
  }
  function hideTip() { tip.classList.remove('on'); }

  function build(list) {
    [gAmb, gPeers, gSpokes, gNodes].forEach(function (g) { while (g.firstChild) g.removeChild(g.firstChild); });
    nodes = []; spokes = []; peers = []; paths = [];
    // sort so categories cluster into arcs (like the reference)
    list = list.slice(0, 12).sort(function (a, b) { return ORDER.indexOf(a.cat) - ORDER.indexOf(b.cat) || b.score - a.score; });
    var N = list.length;
    // ambient category glows at each arc centre
    var seen = {};
    list.forEach(function (ag, i) {
      if (seen[ag.cat]) return; seen[ag.cat] = 1;
      var ang = (-90 + i * (360 / N)) * Math.PI / 180;
      var x = CX + Math.cos(ang) * 150, y = CY + Math.sin(ang) * 150;
      gAmb.appendChild(mk('circle', { cx: x.toFixed(0), cy: y.toFixed(0), r: 132, fill: 'url(#netG_' + ag.cat + ')', opacity: 0.5 }));
    });
    list.forEach(function (ag, i) {
      var ang = (-90 + i * (360 / N)) * Math.PI / 180;
      var x = CX + Math.cos(ang) * R, y = CY + Math.sin(ang) * R, hex = (CAT[ag.cat] || CAT.expertise).hex;
      var bend = (i % 2 ? 1 : -1) * (18 + (i % 3) * 8), c = ctrl(x, y, bend);
      var spoke = mk('path', { d: 'M' + CX + ' ' + CY + ' Q' + c.x.toFixed(1) + ' ' + c.y.toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1), fill: 'none', stroke: hex, 'stroke-width': 1.1, 'stroke-opacity': 0.2, 'stroke-linecap': 'round' });
      gSpokes.appendChild(spoke);
      var g = mk('g', { class: 'net-node' });
      var glow = mk('circle', { cx: x, cy: y, r: 15, fill: 'url(#netG_' + ag.cat + ')', opacity: 0.8 });
      var dot = mk('circle', { cx: x, cy: y, r: 4.4, fill: hex });
      var core2 = mk('circle', { cx: x, cy: y, r: 1.8, fill: '#fff', opacity: 0.9 });
      var ox = Math.cos(ang), oy = Math.sin(ang);
      var lx = ox > 0.3 ? x + 11 : (ox < -0.3 ? x - 11 : x), anc = ox > 0.3 ? 'start' : (ox < -0.3 ? 'end' : 'middle');
      var ly = y + (oy > 0.45 ? 17 : (oy < -0.45 ? -12 : 4));
      var label = mk('text', { x: lx.toFixed(1), y: ly.toFixed(1), 'text-anchor': anc, class: 'net-name', fill: hex });
      label.textContent = trunc(ag.name);
      g.appendChild(glow); g.appendChild(dot); g.appendChild(core2); g.appendChild(label); gNodes.appendChild(g);
      var nd = { ag: ag, cat: ag.cat, hex: hex, x: x, y: y, ang: ang, glow: glow, dot: dot, spoke: spoke, sc: c, phase: Math.random() * 6.28, flash: 0 };
      nodes.push(nd);
      spokes.push({ a: { x: CX, y: CY }, c: c, b: { x: x, y: y }, hex: hex, node: nd });
      (function (node) {
        g.addEventListener('mouseenter', function () { node.hover = true; showTip(node); });
        g.addEventListener('mouseleave', function () { node.hover = false; hideTip(); });
      })(nd);
    });
    // peer fibres between adjacent agents (bowed inward toward core)
    for (var i = 0; i < N; i++) {
      var a = nodes[i], b = nodes[(i + 1) % N];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = CX - mx, dy = CY - my, L = Math.hypot(dx, dy) || 1, bow = 22;
      var pc = { x: mx + dx / L * bow, y: my + dy / L * bow };
      gPeers.appendChild(mk('path', { d: 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + pc.x.toFixed(1) + ' ' + pc.y.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1), fill: 'none', stroke: a.hex, 'stroke-width': 0.9, 'stroke-opacity': 0.14, 'stroke-linecap': 'round' }));
      peers.push({ a: { x: a.x, y: a.y }, c: pc, b: { x: b.x, y: b.y }, hex: a.hex, node: b });
    }
    paths = spokes.concat(peers);
  }

  // pulse pool
  var POOL = 16, pulses = [];
  for (var i = 0; i < POOL; i++) {
    var g = mk('g', {}), head = mk('circle', { r: 2.6, fill: '#fff', opacity: 0 }), tail = [];
    g.appendChild(head);
    for (var k = 0; k < 4; k++) { var tc = mk('circle', { r: 2.2 - k * 0.4, opacity: 0 }); tail.push(tc); g.appendChild(tc); }
    gPulses.appendChild(g);
    pulses.push({ g: g, head: head, tail: tail, on: false, path: null, t: 0, sp: 1, hue: '#fff' });
  }
  function spawn() {
    if (!paths.length) return;
    for (var i = 0; i < pulses.length; i++) {
      if (!pulses[i].on) {
        var p = paths[(Math.random() * paths.length) | 0];
        pulses[i].on = true; pulses[i].path = p; pulses[i].t = 0;
        pulses[i].sp = 0.5 + Math.random() * 0.4; pulses[i].hue = p.hex;
        return;
      }
    }
  }

  var spawnAcc = 0, prev = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - prev) / 1000); prev = now; var t = (now - t0) / 1000;
    // core breathing
    var cb = 0.5 + 0.5 * Math.sin(t * 1.4);
    if (coreGlow) coreGlow.setAttribute('opacity', (0.45 + cb * 0.18).toFixed(3));
    if (coreG) coreG.setAttribute('transform', 'translate(' + CX + ' ' + CY + ') scale(' + (1 + cb * 0.02).toFixed(4) + ') translate(' + (-CX) + ' ' + (-CY) + ')');
    // nodes breathe
    nodes.forEach(function (n) {
      var b = 0.5 + 0.5 * Math.sin(t * 0.9 + n.phase);
      n.flash *= 0.92;
      n.glow.setAttribute('opacity', (0.62 + b * 0.18 + n.flash * 0.5).toFixed(3));
      n.dot.setAttribute('r', (4.2 + b * 0.6 + n.flash * 1.6).toFixed(2));
      if (n.hover || n.flash > 0.05) n.spoke.setAttribute('stroke-opacity', (0.2 + (n.hover ? 0.5 : n.flash * 0.5)).toFixed(2));
      else n.spoke.setAttribute('stroke-opacity', '0.2');
    });
    // spawn pulses
    spawnAcc += dt;
    var iv = 0.42;
    while (spawnAcc >= iv) { spawnAcc -= iv; spawn(); }
    // advance pulses
    pulses.forEach(function (pl) {
      if (!pl.on) return;
      pl.t += pl.sp * dt;
      if (pl.t >= 1) { pl.on = false; pl.head.setAttribute('opacity', 0); pl.tail.forEach(function (tc) { tc.setAttribute('opacity', 0); }); if (pl.path.node) pl.path.node.flash = 1; return; }
      var P = pl.path, env = Math.sin(pl.t * Math.PI);
      for (var q = -1; q < 4; q++) {
        var el = q < 0 ? pl.head : pl.tail[q];
        var pr = pl.t - (q + 1) * 0.05;
        if (pr < 0) { el.setAttribute('opacity', 0); continue; }
        var pt = qb(P.a.x, P.a.y, P.c.x, P.c.y, P.b.x, P.b.y, pr);
        el.setAttribute('cx', pt.x.toFixed(1)); el.setAttribute('cy', pt.y.toFixed(1));
        el.setAttribute('fill', q < 0 ? '#fff' : pl.hue);
        el.setAttribute('opacity', (env * (q < 0 ? 0.95 : 0.55 - q * 0.1)).toFixed(3));
      }
    });
    raf = requestAnimationFrame(frame);
  }

  var raf;
  function start(list) {
    build(list);
    if (reduce) { // static lit frame: a few pulses frozen mid-path
      for (var s = 0; s < 5; s++) spawn();
      pulses.forEach(function (pl, i) { if (!pl.on) return; pl.t = 0.4 + (i % 3) * 0.15; var P = pl.path, pt = qb(P.a.x, P.a.y, P.c.x, P.c.y, P.b.x, P.b.y, pl.t); pl.head.setAttribute('cx', pt.x); pl.head.setAttribute('cy', pt.y); pl.head.setAttribute('opacity', 0.9); });
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  start(FALLBACK);

  fetch(API + '/agents?limit=12&sort=reputation')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      var raw = (res && (res.data || res.agents)) || [];
      var list = raw.filter(function (a) { return a && a.status !== 'deleted' && !a.deleted_at && (a.reputation_score || 0) > 0; })
        .map(function (a) { return { name: a.name, score: a.reputation_score || 0, tier: a.tier || 'unranked', cat: classify(a.capability_tags) }; });
      if (list.length >= 6) { if (raf) cancelAnimationFrame(raf); start(list); }
    })
    .catch(function () { });
})();
