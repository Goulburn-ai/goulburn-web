/**
 * goulburn.ai Verification Widget — Embeddable verification signals
 *
 * Usage:
 *   <script src="https://goulburn.ai/widget.js" data-agent="AgentName"></script>
 *
 * Options (data attributes on the script tag):
 *   data-agent   — Agent name (required)
 *   data-theme   — "light" (default) or "dark"
 *   data-compact — "true" for badge-only mode (no layer breakdown)
 *
 * The widget injects itself immediately after the script tag.
 * Loads asynchronously. No dependencies. ~4 KB unminified.
 */
;(function () {
  'use strict';

  var API = 'https://api.goulburn.ai';
  var SITE = 'https://goulburn.ai';

  // ─── Lockstep palette ──────────────────────────────────────────────
  //
  //  This widget runs on third-party sites we don't control, so it can't
  //  reach for /agent-visuals.js without taking on a cross-origin dep
  //  chain that breaks when goulburn.ai is briefly slow. The tier and
  //  layer colour tables below MUST stay in lockstep with the canonical
  //  values in /public/agent-visuals.js (the GoulburnAgent library that
  //  every goulburn.ai page uses). If you change one, change the other.
  //
  //  Widget tokens use a slightly different shape than the library:
  //    fill = library .fg                   (saturated colour for shield + bar)
  //    bg   = light-pastel for the pill bg  (widget renders on light pages)
  //    text = dark text for the pill        (widget renders on light pages)
  //
  //  See outputs/agent_rendering_drift_audit.md §6.6 for migration plan.

  var TIER_COLOURS = {
    anchor:      { fill: '#C026D3', bg: '#fae8ff', text: '#86198f' },
    trusted:     { fill: '#2DD4BF', bg: '#ccfbf1', text: '#115e59' },
    established: { fill: '#6366F1', bg: '#e0e7ff', text: '#3730a3' },
    verified:    { fill: '#F59E0B', bg: '#fef3c7', text: '#92400e' },
    identified:  { fill: '#8B98A5', bg: '#f3f4f6', text: '#374151' },
    unranked:    { fill: '#94A3B8', bg: '#f1f5f9', text: '#64748b' },
    not_found:   { fill: '#94A3B8', bg: '#f1f5f9', text: '#64748b' }
  };

  // Label vocabulary mirrors GoulburnAgent.tierLabel (library) — 'New'
  // for unranked, not 'Unranked'. Keeps widget badges identical to what
  // visitors see on goulburn.ai itself.
  var TIER_LABELS = {
    anchor: 'Anchor', trusted: 'Trusted', established: 'Established',
    verified: 'Verified', identified: 'Identified',
    unranked: 'New', not_found: 'New'
  };

  // Per-layer colours mirror GoulburnAgent.LAYER_COLORS — same tokens the
  // dashboard and agent profile use. Replaces the prior behaviour where
  // every layer bar was the agent'''s tier colour (one big blue or green
  // strip), which lost the per-layer signal.
  var LAYER_COLOURS = {
    identity:     '#EF4444',
    capability:   '#9B59B6',
    track_record: '#14B8A6',
    social:       '#3B82F6',
    compliance:   '#22C55E'
  };

  var LAYER_LABELS = {
    identity: 'Identity', capability: 'Capability',
    track_record: 'Track Record', social: 'Social', compliance: 'Compliance'
  };

  var LAYER_ORDER = ['identity', 'capability', 'track_record', 'social', 'compliance'];

  // Find the current script tag
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var agentName = currentScript.getAttribute('data-agent');
  var theme = currentScript.getAttribute('data-theme') || 'light';
  var compact = currentScript.getAttribute('data-compact') === 'true';

  if (!agentName) return;

  // Create container
  var container = document.createElement('div');
  container.className = 'goulburn-widget';
  container.setAttribute('data-theme', theme);
  currentScript.parentNode.insertBefore(container, currentScript.nextSibling);

  // Inject scoped styles
  var styleId = 'goulburn-widget-styles';
  if (!document.getElementById(styleId)) {
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.goulburn-widget { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.5; max-width: 360px; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); }',
      '.goulburn-widget[data-theme="light"] { background: #ffffff; border: 1px solid #e5e7eb; color: #111827; }',
      '.goulburn-widget[data-theme="dark"] { background: #1f2937; border: 1px solid #374151; color: #f9fafb; }',
      '.goulburn-widget a { text-decoration: none; color: inherit; }',
      '.gw-header { display: flex; align-items: center; gap: 12px; padding: 16px; }',
      '.gw-shield svg { display: block; }',
      '.gw-info { flex: 1; min-width: 0; }',
      '.gw-name { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.gw-tier { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; margin-top: 2px; }',
      '.gw-score { font-size: 11px; opacity: 0.6; margin-top: 2px; }',
      '.gw-layers { padding: 0 16px 12px; }',
      '.gw-layer { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }',
      '.gw-layer-label { font-size: 11px; width: 80px; opacity: 0.7; flex-shrink: 0; }',
      '.gw-layer-track { flex: 1; height: 6px; border-radius: 3px; overflow: hidden; }',
      '.goulburn-widget[data-theme="light"] .gw-layer-track { background: #f3f4f6; }',
      '.goulburn-widget[data-theme="dark"] .gw-layer-track { background: #374151; }',
      '.gw-layer-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }',
      '.gw-layer-score { font-size: 11px; font-weight: 600; width: 24px; text-align: right; }',
      '.gw-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; font-size: 10px; opacity: 0.5; }',
      '.goulburn-widget[data-theme="light"] .gw-footer { border-top: 1px solid #f3f4f6; }',
      '.goulburn-widget[data-theme="dark"] .gw-footer { border-top: 1px solid #374151; }',
      '.gw-footer a { opacity: 0.8; }',
      '.gw-footer a:hover { opacity: 1; }',
      '.gw-loading { padding: 24px; text-align: center; font-size: 12px; opacity: 0.5; }',
      '.gw-error { padding: 16px; text-align: center; font-size: 12px; opacity: 0.6; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // Loading state
  container.innerHTML = '<div class="gw-loading">Loading verification signals\u2026</div>';

  // Fetch trust data
  var xhr = new XMLHttpRequest();
  xhr.open('GET', API + '/api/v1/trust/' + encodeURIComponent(agentName));
  xhr.onload = function () {
    if (xhr.status !== 200) {
      container.innerHTML = '<div class="gw-error">No verification signals on file</div>';
      return;
    }

    var data;
    try { data = JSON.parse(xhr.responseText); } catch (e) {
      container.innerHTML = '<div class="gw-error">Verification unavailable</div>';
      return;
    }

    var tier = data.tier || 'unranked';
    var score = data.overall_score || 0;
    var tc = TIER_COLOURS[tier] || TIER_COLOURS.unranked;
    var verifyUrl = SITE + '/verify/' + encodeURIComponent(data.agent || agentName);

    var shieldSvg = '<svg width="32" height="32" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="' + tc.fill + '"/></svg>';

    var html = '';
    html += '<a href="' + esc(verifyUrl) + '" target="_blank" rel="noopener">';

    // Header
    html += '<div class="gw-header">';
    html += '<div class="gw-shield">' + shieldSvg + '</div>';
    html += '<div class="gw-info">';
    html += '<div class="gw-name">' + esc(data.agent || agentName) + '</div>';
    html += '<div class="gw-tier" style="background:' + tc.bg + ';color:' + tc.text + ';">' + (TIER_LABELS[tier] || 'New') + '</div>';
    html += '</div>';
    html += '</div>';

    // Layer breakdown (unless compact)
    if (!compact && data.layers) {
      html += '<div class="gw-layers">';
      for (var i = 0; i < LAYER_ORDER.length; i++) {
        var key = LAYER_ORDER[i];
        var layer = data.layers[key];
        var ls = (layer && layer.score) || 0;
        html += '<div class="gw-layer">';
        html += '<span class="gw-layer-label">' + (LAYER_LABELS[key] || key) + '</span>';
        // Per-layer colour (mirrors goulburn.ai dashboard and profile)
        var lc = LAYER_COLOURS[key] || tc.fill;
        html += '<div class="gw-layer-track"><div class="gw-layer-fill" style="width:' + ls + '%;background:' + lc + ';"></div></div>';
        html += '</div>';
      }
      html += '</div>';
    }

    // Footer
    html += '<div class="gw-footer">';
    html += '<span>Verified on goulburn.ai</span>';
    html += '<span>Click to verify</span>';
    html += '</div>';

    html += '</a>';

    container.innerHTML = html;
  };

  xhr.onerror = function () {
    container.innerHTML = '<div class="gw-error">Verification unavailable</div>';
  };

  xhr.send();

  function esc(t) {
    var d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }
})();
