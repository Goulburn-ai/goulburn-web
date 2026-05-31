/**
 * goulburn.ai — Network widget Tier 3 (force-directed SVG).
 *
 * Phase 3 of the network-advanced design (2026-05-31 v2).
 *
 * Dynamically imported by /agents on the first sustained hover of the
 * Network widget. Replaces the bounce-loop + hash-positioned SVG layout
 * with a minimal hand-rolled Verlet-style force simulation. No external
 * dependencies — d3-force was considered and dropped after the senior-
 * eng review (~10KB gzipped saved + zero supply-chain risk + the four
 * forces needed are ~100 lines of plain JS for a 30-node graph).
 *
 * The bundle is loaded via `import("/static/network-pro.js")` which
 * means it's served as an ES module. Vercel serves files in /public/
 * as-is — we add the file to /src/static/ and the build step copies
 * it to /public/static/.
 *
 * Module contract (consumed by agents.html):
 *
 *     export function initPro(svgEl, { nodes, edges })
 *
 *   nodes: [{ id, x, y, cluster, color }]
 *   edges: [{ source, target }]    // ids referencing nodes
 *
 * Side effects:
 *   - Mutates the existing #netDynNodes / #netDynEdges SVG groups in
 *     place so the existing hover/click/legend wiring keeps working.
 *   - Starts a requestAnimationFrame loop that runs ~6s then settles.
 *   - Adds pan + zoom via viewBox transform on the parent SVG.
 *
 * Kill switch: window.GOULBURN_NETWORK_PRO_OFF (checked at the caller
 * — agents.html — so this module is never even imported).
 */

const SVG_NS = "http://www.w3.org/2000/svg";

// Centre and bounds of the canvas (matches the 340x240 viewBox).
const VIEW_W = 340;
const VIEW_H = 240;
const CENTER_X = VIEW_W / 2;
const CENTER_Y = VIEW_H / 2;

// Force coefficients. Tuned for 12-30 node graphs at this canvas size.
const ALPHA_DECAY = 0.94;        // simulation cools each frame
const ALPHA_MIN = 0.005;         // stop when below this
const FORCE_CENTER = 0.012;      // pull each node toward (cx, cy)
const FORCE_REPEL = 380;         // pairwise repulsion strength
const FORCE_LINK = 0.06;         // attractive force along edges
const TARGET_LINK_DIST = 38;     // resting edge length
const FORCE_COLLIDE = 0.9;       // collision response strength
const MIN_NODE_DIST = 18;        // collision radius
const VELOCITY_DECAY = 0.78;     // damping per frame
const MAX_VELOCITY = 6;          // safety clamp

// Track simulation state across calls.
let _simState = null;


export function initPro(svgEl, payload) {
    if (!svgEl || !payload || !Array.isArray(payload.nodes)) return;

    // Build sim nodes + edges. We mutate the existing SVG <circle>s
    // and <line>s in place rather than redrawing the DOM, so the Tier
    // 1 hover/click handlers keep working without rebinding.
    const nodes = payload.nodes.map(function(n) {
        return {
            id: n.id,
            x: n.x,
            y: n.y,
            vx: 0,
            vy: 0,
            cluster: n.cluster,
            color: n.color,
        };
    });
    const nodeById = {};
    nodes.forEach(function(n) { nodeById[n.id] = n; });

    const edges = (payload.edges || []).map(function(e) {
        return {
            source: nodeById[e.source],
            target: nodeById[e.target],
        };
    }).filter(function(e) { return e.source && e.target; });

    // Resolve the DOM nodes once. We update their cx/cy/x1/y1/x2/y2
    // each frame rather than re-rendering.
    const domNodes = {};
    svgEl.querySelectorAll("#netDynNodes .net-node[data-agent]").forEach(function(g) {
        const name = g.getAttribute("data-agent");
        if (!name) return;
        domNodes[name] = {
            g: g,
            circles: g.querySelectorAll("circle"),
            text: g.querySelector("text"),
        };
    });

    const domEdges = [];
    svgEl.querySelectorAll("#netDynEdges .net-edge").forEach(function(line) {
        const fromName = line.getAttribute("data-from");
        const toName = line.getAttribute("data-to");
        if (!fromName || !toName) return;
        domEdges.push({
            line: line,
            from: nodeById[fromName],
            to: nodeById[toName],
        });
    });

    if (_simState && _simState.cancel) {
        _simState.cancel();
    }
    _simState = {
        nodes: nodes,
        edges: edges,
        domNodes: domNodes,
        domEdges: domEdges,
        alpha: 1.0,
        rafId: 0,
        cancel: null,
    };

    // Wire pan + zoom on the parent SVG via viewBox manipulation.
    // Conservative: only allow zoom 0.5x to 3x. Pan in image space.
    _wirePanZoom(svgEl);

    // Start the simulation loop.
    function step() {
        if (!_simState) return;
        _simulateStep(_simState);
        _renderStep(_simState);
        _simState.alpha *= ALPHA_DECAY;
        if (_simState.alpha > ALPHA_MIN) {
            _simState.rafId = requestAnimationFrame(step);
        }
    }
    _simState.rafId = requestAnimationFrame(step);
    _simState.cancel = function() {
        if (_simState.rafId) cancelAnimationFrame(_simState.rafId);
    };
}


function _simulateStep(s) {
    const nodes = s.nodes;
    const edges = s.edges;
    const alpha = s.alpha;

    // Repulsion: pairwise inverse-square (kept simple — N is small)
    for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d2 = dx * dx + dy * dy + 0.01;
            const d = Math.sqrt(d2);
            const f = (FORCE_REPEL * alpha) / d2;
            const fx = (dx / d) * f;
            const fy = (dy / d) * f;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
        }
    }

    // Link force: pull endpoints toward TARGET_LINK_DIST
    for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const dx = e.target.x - e.source.x;
        const dy = e.target.y - e.source.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const delta = d - TARGET_LINK_DIST;
        const f = FORCE_LINK * alpha * delta;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        e.source.vx += fx;
        e.source.vy += fy;
        e.target.vx -= fx;
        e.target.vy -= fy;
    }

    // Centre gravity: gentle pull toward viewport centre
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.vx += (CENTER_X - n.x) * FORCE_CENTER * alpha;
        n.vy += (CENTER_Y - n.y) * FORCE_CENTER * alpha;
    }

    // Collision: keep nodes ≥ MIN_NODE_DIST apart
    for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
            if (d < MIN_NODE_DIST) {
                const overlap = (MIN_NODE_DIST - d) * 0.5 * FORCE_COLLIDE;
                const ox = (dx / d) * overlap;
                const oy = (dy / d) * overlap;
                a.x -= ox;
                a.y -= oy;
                b.x += ox;
                b.y += oy;
            }
        }
    }

    // Integrate + damp + clamp + keep inside view
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.vx *= VELOCITY_DECAY;
        n.vy *= VELOCITY_DECAY;
        if (n.vx > MAX_VELOCITY) n.vx = MAX_VELOCITY;
        if (n.vx < -MAX_VELOCITY) n.vx = -MAX_VELOCITY;
        if (n.vy > MAX_VELOCITY) n.vy = MAX_VELOCITY;
        if (n.vy < -MAX_VELOCITY) n.vy = -MAX_VELOCITY;
        n.x += n.vx;
        n.y += n.vy;
        // Keep inside the canvas with a small margin
        if (n.x < 8) n.x = 8;
        if (n.x > VIEW_W - 8) n.x = VIEW_W - 8;
        if (n.y < 8) n.y = 8;
        if (n.y > VIEW_H - 8) n.y = VIEW_H - 8;
    }
}


function _renderStep(s) {
    // Update each DOM node to the simulated position.
    for (let i = 0; i < s.nodes.length; i++) {
        const n = s.nodes[i];
        const dn = s.domNodes[n.id];
        if (!dn) continue;
        dn.circles.forEach(function(c) {
            c.setAttribute("cx", n.x.toFixed(1));
            c.setAttribute("cy", n.y.toFixed(1));
        });
        if (dn.text) {
            dn.text.setAttribute("x", n.x.toFixed(1));
            // Label placement matches the static layout — below the node
            // except for top-row clusters where it goes above.
            const above = (n.cluster === "reasoning" || n.cluster === "expertise") && n.y < 90;
            dn.text.setAttribute("y", (above ? n.y - 11 : n.y + 17).toFixed(1));
        }
    }
    for (let i = 0; i < s.domEdges.length; i++) {
        const e = s.domEdges[i];
        e.line.setAttribute("x1", e.from.x.toFixed(1));
        e.line.setAttribute("y1", e.from.y.toFixed(1));
        e.line.setAttribute("x2", e.to.x.toFixed(1));
        e.line.setAttribute("y2", e.to.y.toFixed(1));
    }

    // Mirror back to NODE_POS so the existing bounce-loop and hover
    // wiring read the right positions. Only update x/y, not baseX/baseY
    // — keeping the original anchor so a reload restores the static
    // layout if Tier 3 fails.
    try {
        const NP = (typeof window !== "undefined") && window.__GOULBURN_NODE_POS;
        if (NP) {
            for (let i = 0; i < s.nodes.length; i++) {
                const n = s.nodes[i];
                if (NP[n.id]) {
                    NP[n.id].x = n.x;
                    NP[n.id].y = n.y;
                }
            }
        }
    } catch (e) { /* no-op */ }
}


// ── Pan + zoom via SVG viewBox ───────────────────────────────────────
// Only wires once per SVG. Stores state on the element via __panzoom.
function _wirePanZoom(svgEl) {
    if (svgEl.__panzoom) return;
    svgEl.__panzoom = true;

    let view = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };

    function apply() {
        svgEl.setAttribute("viewBox",
            view.x.toFixed(1) + " " +
            view.y.toFixed(1) + " " +
            view.w.toFixed(1) + " " +
            view.h.toFixed(1)
        );
    }

    svgEl.style.cursor = "grab";

    // Wheel zoom (Ctrl+wheel to avoid trapping page scroll outside the widget).
    svgEl.addEventListener("wheel", function(ev) {
        if (!ev.ctrlKey && !ev.metaKey) return;
        ev.preventDefault();
        const factor = ev.deltaY < 0 ? 0.92 : 1.08;
        const newW = view.w * factor;
        const newH = view.h * factor;
        // Clamp zoom between 0.5x and 3x of base view.
        if (newW < VIEW_W * 0.33 || newW > VIEW_W * 2.0) return;
        // Zoom toward the cursor.
        const rect = svgEl.getBoundingClientRect();
        const cxFrac = (ev.clientX - rect.left) / rect.width;
        const cyFrac = (ev.clientY - rect.top) / rect.height;
        view.x += (view.w - newW) * cxFrac;
        view.y += (view.h - newH) * cyFrac;
        view.w = newW;
        view.h = newH;
        apply();
    }, { passive: false });

    // Drag pan
    let dragging = null;
    svgEl.addEventListener("mousedown", function(ev) {
        // Only pan when dragging blank background — don't hijack node clicks.
        if (ev.target.closest(".net-node") || ev.target.closest(".net-info-panel")) return;
        dragging = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
        svgEl.style.cursor = "grabbing";
    });
    window.addEventListener("mousemove", function(ev) {
        if (!dragging) return;
        const rect = svgEl.getBoundingClientRect();
        const dx = (ev.clientX - dragging.x) * (view.w / rect.width);
        const dy = (ev.clientY - dragging.y) * (view.h / rect.height);
        view.x = dragging.vx - dx;
        view.y = dragging.vy - dy;
        apply();
    });
    window.addEventListener("mouseup", function() {
        dragging = null;
        svgEl.style.cursor = "grab";
    });
}
