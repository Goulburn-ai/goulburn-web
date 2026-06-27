/* eslint-disable */
/**
 * goulburn agent-visuals — single source of truth for rendering an agent.
 *
 *   Status: v1 (2026-05-05)
 *   Owner:  any change here ripples to every consumer; treat changes as
 *           cross-cutting and browser-verify each surface before shipping.
 *
 * Why this file exists, backend contract, tier metadata mirror — see
 * outputs/agent_rendering_drift_audit.md and the README in this repo.
 */

(function (global) {
    'use strict';

    var TIER_LABELS = {
        anchor: 'Anchor', trusted: 'Trusted', established: 'Established',
        verified: 'Verified', identified: 'Identified', unranked: 'New', not_found: 'New'
    };

    var TIER_COLORS = {
        anchor:      { bgTint: 'rgba(217,70,239,0.12)', fg: '#D946EF', border: 'rgba(217,70,239,0.30)' },
        trusted:     { bgTint: 'rgba(45,212,191,0.12)',  fg: '#2DD4BF', border: 'rgba(45,212,191,0.30)' },
        established: { bgTint: 'rgba(129,140,248,0.12)', fg: '#818CF8', border: 'rgba(129,140,248,0.30)' },
        verified:    { bgTint: 'rgba(245,158,11,0.12)',  fg: '#F59E0B', border: 'rgba(245,158,11,0.30)' },
        identified:  { bgTint: 'rgba(139,152,165,0.12)', fg: '#8B98A5', border: 'rgba(139,152,165,0.28)' },
        unranked:    { bgTint: 'rgba(148,163,184,0.10)', fg: '#94A3B8', border: 'rgba(148,163,184,0.25)' },
        not_found:   { bgTint: 'rgba(148,163,184,0.10)', fg: '#94A3B8', border: 'rgba(148,163,184,0.25)' }
    };

    var LAYER_COLORS = {
        identity:     '#EF4444', capability:   '#9B59B6', track_record: '#14B8A6',
        social:       '#3B82F6', compliance:   '#22C55E'
    };
    var LAYER_LABELS = {
        identity: 'Identity', capability: 'Capability', track_record: 'Track Record',
        social: 'Social', compliance: 'Compliance'
    };
    var LAYER_ORDER = ['identity', 'capability', 'track_record', 'social', 'compliance'];

    function _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function tier(agent) {
        if (!agent) return 'unranked';
        var t = agent.tier;
        return (t && TIER_COLORS[t]) ? t : 'unranked';
    }

    function tierLabel(t) {
        var slug = typeof t === 'string' ? t : tier(t);
        return TIER_LABELS[slug] || TIER_LABELS.unranked;
    }

    function tierTokens(t) {
        var slug = typeof t === 'string' ? t : tier(t);
        return TIER_COLORS[slug] || TIER_COLORS.unranked;
    }

    function score(agent) {
        if (!agent) return 0;
        var s = agent.reputation_score;
        if (s == null) s = agent.score;
        if (s == null) s = agent.overall_score;
        return Math.max(0, Math.min(100, parseInt(s, 10) || 0));
    }

    function scoreFormat(agent) { return score(agent) + ' / 100'; }

    function scoreMovement(agent) {
        if (!agent || agent.score_last_week == null) return null;
        return { delta: score(agent) - (parseInt(agent.score_last_week, 10) || 0), label: 'this week' };
    }

    function layerScore(agent, k) {
        if (!agent) return null;
        var rb = agent.reputation_breakdown;
        if (!rb) return null;
        var v = rb[k];
        return v == null ? null : Math.max(0, Math.min(100, parseInt(v, 10) || 0));
    }
    function layerColor(k) { return LAYER_COLORS[k] || '#94A3B8'; }
    function layerLabel(k) { return LAYER_LABELS[k] || k; }
    function layerOrder() { return LAYER_ORDER.slice(); }

    var _iconResolver = null;
    function registerIconResolver(fn) { _iconResolver = (typeof fn === 'function') ? fn : null; }

    function renderAvatar(agentOrAvatar, size, opts) {
        size = size || 44;
        opts = opts || {};
        var agent = (agentOrAvatar && typeof agentOrAvatar === 'object') ? agentOrAvatar : null;
        var avatarStr = agent ? (agent.avatar || '') : (agentOrAvatar || '');
        var name = opts.name || (agent ? (agent.name || '') : '');
        var slug = opts.tier || (agent ? tier(agent) : 'unranked');
        var t = TIER_COLORS[slug] || TIER_COLORS.unranked;
        var border = '2px solid ' + t.fg;
        var bg = t.bgTint;

        if (avatarStr && avatarStr.indexOf('icon:') === 0) {
            var iconName = avatarStr.substring(5);
            var iconBody = _iconResolver ? _iconResolver(iconName) : null;
            if (iconBody) {
                var iSize = Math.round(size * 0.55);
                var iconSvg = (iconBody.indexOf('<svg') === 0)
                    ? iconBody
                    : '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' + iconBody + '</svg>';
                return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;border:' + border + ';background:' + bg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
                    '<div style="width:' + iSize + 'px;height:' + iSize + 'px;color:' + t.fg + ';">' + iconSvg + '</div>' +
                    '</div>';
            }
        }

        var dbMatch = avatarStr && avatarStr.match(/^(personas|bottts|avataaars|notionists|lorelei|micah):(.+)$/);
        if (dbMatch) {
            var seed = encodeURIComponent(dbMatch[2]);
            return '<img src="https://api.dicebear.com/9.x/' + dbMatch[1] + '/svg?seed=' + seed + '"' +
                ' alt="' + _esc(name) + '"' +
                ' style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;border:' + border + ';background:#1a1a2e;flex-shrink:0;">';
        }

        if (avatarStr && (avatarStr.indexOf('http') === 0 || avatarStr.indexOf('data:') === 0)) {
            return '<img src="' + _esc(avatarStr) + '" alt="' + _esc(name) + '"' +
                ' style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;border:' + border + ';flex-shrink:0;">';
        }

        if (name) {
            var seed2 = encodeURIComponent(name);
            return '<img src="https://api.dicebear.com/9.x/personas/svg?seed=' + seed2 + '"' +
                ' alt="' + _esc(name) + '"' +
                ' style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;border:' + border + ';background:#1a1a2e;flex-shrink:0;">';
        }

        return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + bg + ';color:' + t.fg + ';display:flex;align-items:center;justify-content:center;font-size:' + Math.round(size * 0.4) + 'px;font-weight:700;border:' + border + ';flex-shrink:0;">?</div>';
    }

    function relativeTime(iso) {
        if (!iso) return '—';
        var t = new Date(iso).getTime();
        if (isNaN(t)) return '—';
        var s = Math.floor((Date.now() - t) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return Math.floor(s / 60) + 'm ago';
        if (s < 86400) return Math.floor(s / 3600) + 'h ago';
        if (s < 30 * 86400) return Math.floor(s / 86400) + 'd ago';
        if (s < 365 * 86400) return Math.floor(s / (30 * 86400)) + 'mo ago';
        return Math.floor(s / (365 * 86400)) + 'y ago';
    }

    function operatorByline(agent) {
        if (!agent || !agent.owner_handle) return '';
        return 'Built by @' + _esc(agent.owner_handle);
    }

    function truncate(s, n) {
        n = n || 110;
        s = String(s || '').trim();
        if (s.length <= n) return s;
        return s.slice(0, Math.max(1, n - 1)).trimEnd() + '…';
    }

    function tagsHtml(agent, max) {
        max = max == null ? 3 : max;
        var tags = (agent && agent.capability_tags) || [];
        if (!tags.length) return '';
        return tags.slice(0, max).map(function (t) {
            return '<span style="background:rgba(255,255,255,0.04);' +
                'border:0.5px solid rgba(255,255,255,0.08);' +
                'padding:3px 9px;border-radius:8px;font-size:11px;' +
                'color:rgba(247,249,249,0.65);white-space:nowrap;">' +
                _esc(t) + '</span>';
        }).join(' ');
    }

    var GoulburnAgent = {
        tier: tier, tierLabel: tierLabel, tierTokens: tierTokens,
        TIER_COLORS: TIER_COLORS, TIER_LABELS: TIER_LABELS,
        score: score, scoreFormat: scoreFormat, scoreMovement: scoreMovement,
        layerScore: layerScore, layerColor: layerColor, layerLabel: layerLabel,
        layerOrder: layerOrder, LAYER_COLORS: LAYER_COLORS, LAYER_LABELS: LAYER_LABELS,
        renderAvatar: renderAvatar, registerIconResolver: registerIconResolver,
        relativeTime: relativeTime, operatorByline: operatorByline,
        truncate: truncate, tagsHtml: tagsHtml,
        VERSION: '1.0.0'
    };

    global.GoulburnAgent = GoulburnAgent;
})(typeof window !== 'undefined' ? window : this);
