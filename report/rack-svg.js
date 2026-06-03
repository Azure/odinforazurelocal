/* ============================================
   Static 2D SVG Rack Diagram — rack-svg.js
   Generates a front-view SVG of the rack layout
   matching the 3D visualization topology.
   ============================================ */

(function() {
    'use strict';

    // ── Layout constants (matching rack3d.js) ──
    const TOTAL_U = 42;
    const RACK_W = 220;          // SVG pixels for rack inner width
    const U_H = 14;              // SVG pixels per 1U
    const POST_W = 8;            // Rail post width
    const RACK_GAP = 60;         // Gap between racks (rack-aware)
    const LABEL_FONT = 10;
    const LEGEND_FONT = 10;

    // ── Azure Local icon (inline data URI for standalone SVG export) ──
    const ICON_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgY2xhc3M9IiIgcm9sZT0icHJlc2VudGF0aW9uIiBmb2N1c2FibGU9ImZhbHNlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBpZD0iRnhTeW1ib2wwLTEyMyIgZGF0YS10eXBlPSIxIj48Zz48dGl0bGU+PC90aXRsZT48cGF0aCBkPSJNMTI1LjI1IDEwNy41MTNjLTEuMTMgNC45NzgtNy4zMTcgOS44MjctMTguNDg4IDEzLjYyNWExNTIuNTcxIDE1Mi41NzEgMCAwIDEtODUuNzA0LjEyMWMtMTAuMzAzLTMuNjQ4LTE1Ljg2NC04LjI2My0xNi43MzItMTMuMDIxLS4xNS0uODM5IDAtMTMuODk1IDAtMTMuODk1bDEyMS4xNTktMS4xMjNzLS4wOTIgMTMuNjgxLS4yMzUgMTQuMjkzWiIgZmlsbD0iIzVFQTBFRiI+PC9wYXRoPjxwYXRoIGQ9Ik02NS4wNCAxMTUuMDMxYzMzLjQ3OS0uMzM2IDYwLjUyNS05Ljk5MSA2MC40MDktMjEuNTY0LS4xMTYtMTEuNTczLTI3LjM1LTIwLjY4My02MC44My0yMC4zNDctMzMuNDc5LjMzNi02MC41MjUgOS45OS02MC40MDkgMjEuNTY0LjExNiAxMS41NzMgMjcuMzUgMjAuNjgzIDYwLjgzIDIwLjM0N1oiIGZpbGw9IiM1MEU2RkYiPjwvcGF0aD48cGF0aCBkPSJNMTA1Ljk4OSAxMUgyMi4wMTFBMy4wMTEgMy4wMTEgMCAwIDAgMTkgMTQuMDExdjE4LjU4NWEzLjAxMSAzLjAxMSAwIDAgMCAzLjAxMSAzLjAxMWg4My45NzhhMy4wMTEgMy4wMTEgMCAwIDAgMy4wMTEtMy4wMVYxNC4wMWEzLjAxMSAzLjAxMSAwIDAgMC0zLjAxMS0zLjAxWiIgZmlsbD0iI0I1OTZGNSI+PC9wYXRoPjxwYXRoIGQ9Ik0xMDAuMjMgMTUuMzA3aC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MyAxLjUwMi0xLjUwM3YtMy43MmMwLS44My0uNjcyLTEuNTAzLTEuNTAyLTEuNTAzWm0wIDkuMjczaC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MyAxLjUwMi0xLjUwM3YtMy43MmMwLS44My0uNjcyLTEuNTAzLTEuNTAyLTEuNTAzWiIgZmlsbD0iI0YyRjJGMiI+PC9wYXRoPjxwYXRoIGQ9Ik0xMDUuOTg5IDQwLjE2NkgyMi4wMTFBMy4wMTEgMy4wMTEgMCAwIDAgMTkgNDMuMTc2djE4LjU4NmEzLjAxMSAzLjAxMSAwIDAgMCAzLjAxMSAzLjAxMWg4My45NzhhMy4wMTEgMy4wMTEgMCAwIDAgMy4wMTEtMy4wMVY0My4xNzZhMy4wMSAzLjAxIDAgMCAwLTMuMDExLTMuMDExWiIgZmlsbD0iIzkyNjZFNiI+PC9wYXRoPjxwYXRoIGQ9Ik0xMDAuMjMgNDQuNDY3aC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MyAxLjUwMi0xLjUwM3YtMy43MmMwLS44My0uNjcyLTEuNTAzLTEuNTAyLTEuNTAzWm0wIDkuMjczaC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MyAxLjUwMi0xLjUwMnYtMy43MmMwLS44My0uNjcyLTEuNTA0LTEuNTAyLTEuNTA0WiIgZmlsbD0iI0YyRjJGMiI+PC9wYXRoPjxwYXRoIGQ9Ik0xMDUuOTg5IDY5LjMyNkgyMi4wMTFBMy4wMTEgMy4wMTEgMCAwIDAgMTkgNzIuMzM2djE4LjU4NmEzLjAxMSAzLjAxMSAwIDAgMCAzLjAxMSAzLjAxMWg4My45NzhhMy4wMSAzLjAxIDAgMCAwIDMuMDExLTMuMDFWNzIuMzM2YTMuMDExIDMuMDExIDAgMCAwLTMuMDExLTMuMDExWiIgZmlsbD0iIzU1MkY5OSI+PC9wYXRoPjxwYXRoIGQ9Ik0xMDAuMjMgNzMuNjI3aC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MyAxLjUwMi0xLjUwMlY3NS4xM2MwLS44My0uNjcyLTEuNTAzLTEuNTAyLTEuNTAzWm0wIDkuMjczaC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MiAxLjUwMi0xLjUwMnYtMy43MmMwLS44My0uNjcyLTEuNTA0LTEuNTAyLTEuNTA0WiIgZmlsbD0iI0YyRjJGMiI+PC9wYXRoPjwvZz48ZGVmcz4KPC9kZWZzPgo8L3N2Zz4=';

    // ── Colors (matching rack3d.js COLORS) ──
    const C = {
        RACK_FRAME:  '#2a2a2a',
        RACK_RAIL:   '#3a3a3a',
        EMPTY_SLOT:  '#1a1a1a',
        SERVER:      '#aaaaaa',
        SERVER_GPU:  '#d97706',
        TOR_SWITCH:  '#444444',
        BMC_SWITCH:  '#3b82f6',
        GPU_ACCENT:  '#fbbf24',
        LABEL_LIGHT: '#ffffff',
        LABEL_DARK:  '#333333',
        BACKGROUND:  '#0a0a0a'
    };

    // ── Escaping helper ──
    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Label resolvers (#233) ──
    // Surface real Designer node names / ToR switch labels when provided via
    // config; fall back to generic 'Node N' / 'ToR N'. nodeNames / torLabels are
    // resolved by the caller (report.js) from the saved config's nodeSettings /
    // switch state and indexed by GLOBAL node / ToR index across all racks.
    function getRackNodeLabel(config, globalNodeIndex) {
        const names = config && config.nodeNames;
        if (Array.isArray(names) && names[globalNodeIndex]) {
            const nm = String(names[globalNodeIndex]).trim();
            if (nm) return nm;
        }
        return 'Node ' + (globalNodeIndex + 1);
    }

    function getRackTorLabel(config, torIndex) {
        const labels = config && config.torLabels;
        if (Array.isArray(labels) && labels[torIndex]) {
            const lb = String(labels[torIndex]).trim();
            if (lb) return lb;
        }
        return 'ToR ' + (torIndex + 1);
    }

    // ── Draw a single rack frame (returns SVG group string) ──
    function drawRackFrame(ox, oy, rackLabel) {
        const innerH = TOTAL_U * U_H;
        const outerW = RACK_W + POST_W * 2;
        const outerH = innerH + 12; // top/bottom lip
        const parts = [];

        // Outer frame
        parts.push('<rect x="' + ox + '" y="' + oy + '" width="' + outerW + '" height="' + outerH + '" rx="3" fill="' + C.RACK_FRAME + '" stroke="#555" stroke-width="0.5"/>');

        // Inner area (empty slots background)
        parts.push('<rect x="' + (ox + POST_W) + '" y="' + (oy + 6) + '" width="' + RACK_W + '" height="' + innerH + '" fill="' + C.EMPTY_SLOT + '"/>');

        // Rail posts (left & right)
        parts.push('<rect x="' + ox + '" y="' + oy + '" width="' + POST_W + '" height="' + outerH + '" rx="1" fill="' + C.RACK_RAIL + '"/>');
        parts.push('<rect x="' + (ox + POST_W + RACK_W) + '" y="' + oy + '" width="' + POST_W + '" height="' + outerH + '" rx="1" fill="' + C.RACK_RAIL + '"/>');

        // U markers on left rail (every 5U)
        for (let u = 5; u <= TOTAL_U; u += 5) {
            const markerY = oy + 6 + innerH - u * U_H + U_H / 2;
            parts.push('<text x="' + (ox + POST_W / 2) + '" y="' + (markerY + 3) + '" text-anchor="middle" font-size="6" fill="#888" font-family="Segoe UI, sans-serif">' + u + '</text>');
        }

        // Rack label below
        if (rackLabel) {
            parts.push('<text x="' + (ox + outerW / 2) + '" y="' + (oy - 6) + '" text-anchor="middle" font-size="' + (LABEL_FONT + 1) + '" font-weight="600" fill="#ccc" font-family="Segoe UI, sans-serif">' + esc(rackLabel) + '</text>');
        }

        return parts.join('\n');
    }

    // ── Draw a device in a specific U position ──
    // uStart is 1-based from bottom; height is in U
    function drawDevice(ox, oy, uStart, heightU, color, label, labelColor, isLight) {
        const innerH = TOTAL_U * U_H;
        const deviceW = RACK_W - 4;          // small inset from inner area
        const deviceH = heightU * U_H - 2;   // small gap between devices
        const dx = ox + POST_W + 2;
        // uStart=1 is bottom of rack; higher U is higher physically
        const dy = oy + 6 + innerH - uStart * U_H - (heightU - 1) * U_H + 1;

        const parts = [];
        parts.push('<rect x="' + dx + '" y="' + dy + '" width="' + deviceW + '" height="' + deviceH + '" rx="2" fill="' + color + '"/>');

        // Front panel inset (dark face)
        const panelInset = 3;
        const panelOpacity = '0.3';
        parts.push('<rect x="' + (dx + panelInset) + '" y="' + (dy + 1) + '" width="' + (deviceW - panelInset * 2) + '" height="' + (deviceH - 2) + '" rx="1" fill="#0d0d0d" opacity="' + panelOpacity + '"/>');

        // Label
        if (label) {
            const lc = labelColor || C.LABEL_LIGHT;
            const ly = dy + deviceH / 2 + LABEL_FONT * 0.35;
            parts.push('<text x="' + (dx + deviceW / 2) + '" y="' + ly + '" text-anchor="middle" font-size="' + LABEL_FONT + '" font-weight="500" fill="' + lc + '" font-family="Segoe UI, sans-serif">' + esc(label) + '</text>');
        }

        return parts.join('\n');
    }

    // ── Draw a server node (2U) with optional GPU accent ──
    function drawServer(ox, oy, uStart, label, isGpu) {
        const parts = [];
        const color = isGpu ? C.SERVER_GPU : C.SERVER;
        parts.push(drawDevice(ox, oy, uStart, 2, color, label, C.LABEL_LIGHT));

        // GPU accent stripe
        if (isGpu) {
            const innerH = TOTAL_U * U_H;
            const deviceW = RACK_W - 4;
            const dx = ox + POST_W + 2;
            const dy = oy + 6 + innerH - uStart * U_H - U_H + 1;
            const stripeH = 3;
            parts.push('<rect x="' + (dx + 4) + '" y="' + (dy + U_H * 2 - stripeH - 3) + '" width="' + (deviceW - 8) + '" height="' + stripeH + '" rx="1" fill="' + C.GPU_ACCENT + '" opacity="0.8"/>');
        }

        // Drive bays (left side)
        const innerH2 = TOTAL_U * U_H;
        const dx2 = ox + POST_W + 2;
        const dy2 = oy + 6 + innerH2 - uStart * U_H - U_H + 1;
        const deviceH2 = 2 * U_H - 2;
        const bayW = 8, bayH = deviceH2 * 0.4;
        const bayY = dy2 + deviceH2 / 2 - bayH / 2;
        for (let b = 0; b < 6; b++) {
            parts.push('<rect x="' + (dx2 + 8 + b * (bayW + 2)) + '" y="' + bayY + '" width="' + bayW + '" height="' + bayH + '" rx="1" fill="#333" opacity="0.4"/>');
        }

        // Status LEDs (right side, vertically centered)
        const ledX = dx2 + (RACK_W - 4) - 12;
        const ledY = dy2 + deviceH2 / 2;
        parts.push('<circle cx="' + ledX + '" cy="' + ledY + '" r="2" fill="#00ff66" opacity="0.7"/>');
        parts.push('<circle cx="' + (ledX + 6) + '" cy="' + ledY + '" r="2" fill="#3399ff" opacity="0.7"/>');

        return parts.join('\n');
    }

    // ── Draw a 1U switch (ToR or BMC) ──
    function drawSwitch(ox, oy, uStart, label, color, labelColor, isLight) {
        const parts = [];
        parts.push(drawDevice(ox, oy, uStart, 1, color, label, labelColor || C.LABEL_LIGHT, isLight));

        // Status LEDs
        const innerH = TOTAL_U * U_H;
        const dx = ox + POST_W + 2;
        const deviceW = RACK_W - 4;
        const dy = oy + 6 + innerH - uStart * U_H + 1;
        const deviceH = U_H - 2;
        const ledX = dx + deviceW - 16;
        const ledY = dy + deviceH / 2;
        for (let i = 0; i < 3; i++) {
            parts.push('<circle cx="' + (ledX + i * 5) + '" cy="' + ledY + '" r="1.5" fill="#00ff66" opacity="0.6"/>');
        }

        return parts.join('\n');
    }

    // ── Main generator ──
    // config: { clusterType, nodeCount, hasGpu }
    // Returns an SVG string.
    function generateRackSvg(config) {
        const clusterType = config.clusterType || 'standard';
        const isRackAware = clusterType === 'rack-aware';
        const rackCount = isRackAware ? 2 : 1;
        const nodeCount = config.nodeCount || 2;
        const hasGpu = config.hasGpu || false;
        const torPerRack = nodeCount > 1 ? 2 : 1;  // 2 ToRs for multi-node, 1 ToR for single
        const bmcPerRack = 1;

        // Distribute nodes across racks (same logic as rack3d.js)
        const racks = [];
        if (isRackAware) {
            const half = Math.ceil(nodeCount / 2);
            racks.push({ nodes: half, tor: torPerRack });
            racks.push({ nodes: nodeCount - half, tor: torPerRack });
        } else {
            racks.push({ nodes: nodeCount, tor: torPerRack });
        }

        // Calculate SVG dimensions
        const outerRackW = RACK_W + POST_W * 2;
        const innerH = TOTAL_U * U_H;
        const outerRackH = innerH + 12;
        const totalWidth = rackCount * outerRackW + (rackCount - 1) * RACK_GAP;
        const legendH = 50;
        const titleH = 30;
        const coreH = 36;           // Height for core switch box above racks
        const coreGap = 26;         // Gap between core switch and rack tops (room for rack labels)
        const bottomPad = 24;
        // Title (centered) and the "Azure Local" brand badge in the top-right
        // need their own horizontal space — without a minimum width they
        // overlap on narrow single-rack diagrams (the title slides under the
        // "Azure Local" text). Because the title is CENTERED (not left-aligned),
        // its right edge sits at svgW/2 + ~87px (title ≈ 173px wide), while the
        // brand block occupies the right ~112px. To keep a comfortable ~36px gap
        // between them we need svgW ≥ 2 × (87 + 36 + 112) ≈ 470px. This only
        // affects the single-rack diagram (2+ rack layouts are already wider);
        // it keeps the brand consistently top-right across 1- and 2-rack views.
        const MIN_SVG_W = 470;
        const svgW = Math.max(totalWidth + 40, MIN_SVG_W);
        const svgH = titleH + coreH + coreGap + outerRackH + bottomPad + legendH + 10;
        // Centre the rack content if the SVG was widened to satisfy the
        // title/brand layout above.
        const rackBlockOffsetX = (svgW - (totalWidth + 40)) / 2;

        const parts = [];
        // viewBox + style keeps the aspect ratio while letting the diagram
        // shrink into narrow report cards. The explicit `max-width: <svgW>px`
        // is critical: without it, a tall+narrow diagram (e.g. a single rack
        // with 16 nodes) inherits the parent container's full width via the
        // browser default `width: 100%`, and grows to many times its natural
        // size — the title, core switch and node tiles end up gigantic. Capping
        // max-width at the intrinsic SVG width prevents upward scaling, while
        // `width: 100%` still allows downward scaling on small screens.
        parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" preserveAspectRatio="xMidYMid meet" style="width: 100%; max-width: ' + svgW + 'px; height: auto; display: block; margin: 0 auto; font-family: \'Segoe UI\', sans-serif;">');

        // Background
        parts.push('<rect width="' + svgW + '" height="' + svgH + '" fill="' + C.BACKGROUND + '" rx="6"/>');

        // Title
        parts.push('<text x="' + (svgW / 2) + '" y="20" text-anchor="middle" font-size="13" font-weight="600" fill="#ccc" font-family="Segoe UI, sans-serif">Rack Layout — Front View</text>');
        // Brand: instance icon + "Azure Local" text (top-right)
        const brandX = svgW - 20;
        const brandY = 8;
        const iconSize = 20;
        parts.push('<image href="' + ICON_DATA_URI + '" x="' + (brandX - iconSize - 72) + '" y="' + brandY + '" width="' + iconSize + '" height="' + iconSize + '" opacity="0.85"/>');
        parts.push('<text x="' + (brandX - 68) + '" y="' + (brandY + 15) + '" font-size="12" font-weight="600" fill="#B596F5" font-family="Segoe UI, sans-serif">Azure Local</text>');
        // Core Switch / Router / Firewall above racks
        const coreW = Math.min(totalWidth, outerRackW * 1.2);
        const coreX = (svgW - coreW) / 2;
        const coreY = titleH;
        parts.push('<rect x="' + coreX + '" y="' + coreY + '" width="' + coreW + '" height="' + coreH + '" rx="4" fill="#1a6fc4" stroke="#2a8ad4" stroke-width="0.5"/>');
        parts.push('<rect x="' + (coreX + 3) + '" y="' + (coreY + 2) + '" width="' + (coreW - 6) + '" height="' + (coreH - 4) + '" rx="2" fill="#0d0d0d" opacity="0.4"/>');
        parts.push('<text x="' + (coreX + coreW / 2) + '" y="' + (coreY + coreH / 2 + 4) + '" text-anchor="middle" font-size="10" font-weight="500" fill="#ffffff" font-family="Segoe UI, sans-serif">Core Switch / Router / Firewall</text>');
        // LEDs on core switch
        for (let ci = 0; ci < 3; ci++) {
            parts.push('<circle cx="' + (coreX + coreW - 14 + ci * 6) + '" cy="' + (coreY + 8) + '" r="2" fill="#00ff66" opacity="0.7"/>');
        }

        // Rack top origin (below core switch)
        const rackTopY = titleH + coreH + coreGap;

        // Connecting lines from core switch down to each rack
        const coreBottomY = coreY + coreH;
        for (let cl = 0; cl < rackCount; cl++) {
            const clOx = 20 + rackBlockOffsetX + cl * (outerRackW + RACK_GAP);
            const rackCenterX = clOx + outerRackW / 2;
            parts.push('<line x1="' + rackCenterX + '" y1="' + coreBottomY + '" x2="' + rackCenterX + '" y2="' + rackTopY + '" stroke="#2a8ad4" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.5"/>');
        }

        // Draw racks — Rack 1 on left
        for (let r = 0; r < rackCount; r++) {
            const rackIndex = r;  // Rack 1 = index 0 = left
            const ox = 20 + rackBlockOffsetX + r * (outerRackW + RACK_GAP);
            const oy = rackTopY;
            const rackInfo = racks[rackIndex];

            const rackLabel = isRackAware ? 'Rack ' + (rackIndex + 1) : 'Rack';
            parts.push(drawRackFrame(ox, oy, rackLabel));

            // Place ToR switches at top (U42, U41)
            for (let t = 0; t < rackInfo.tor; t++) {
                const torU = TOTAL_U - t; // 42, 41
                const torNum = isRackAware ? (rackIndex * 2 + t + 1) : (t + 1);
                const torLabel = getRackTorLabel(config, torNum - 1);
                parts.push(drawSwitch(ox, oy, torU, torLabel, C.TOR_SWITCH, C.LABEL_LIGHT));
            }

            // Place BMC switch below ToRs (1U) — only when ToRs are present
            if (bmcPerRack > 0) {
                const bmcU = TOTAL_U - rackInfo.tor;
                const bmcNum = isRackAware ? (rackIndex + 1) : 1;
                parts.push(drawSwitch(ox, oy, bmcU, 'BMC ' + bmcNum, C.BMC_SWITCH, C.LABEL_LIGHT));
            }

            // Place server nodes filling the rack bottom-up (datacentre practice —
            // heavy servers low, switches stay at the top for cabling clarity). The
            // first node sits at the lowest U and each subsequent node stacks upward.
            let nodeOffset = 0;
            for (let pr = 0; pr < rackIndex; pr++) { nodeOffset += racks[pr].nodes; }
            const topServerU = TOTAL_U - rackInfo.tor - bmcPerRack; // highest U available to servers
            for (let n = 0; n < rackInfo.nodes; n++) {
                const serverStartU = 1 + (n * 2); // bottom-up: node 1 at U1-2, node 2 at U3-4, …
                if (serverStartU + 1 > topServerU) break; // would overlap the switch zone
                const nodeLabel = getRackNodeLabel(config, nodeOffset + n);
                parts.push(drawServer(ox, oy, serverStartU, nodeLabel, hasGpu));
            }
        }

        // Legend
        const legendY = rackTopY + outerRackH + bottomPad;
        const legendItems = [
            { color: C.SERVER, label: 'Server Node' },
            { color: C.TOR_SWITCH, label: 'ToR Switch' },
            { color: C.BMC_SWITCH, label: 'BMC Switch' },
            { color: '#1a6fc4', label: 'Core Switch' }
        ];
        if (hasGpu) {
            legendItems.splice(1, 0, { color: C.GPU_ACCENT, label: 'GPU Accent' });
        }

        let legendTotalW = 0;
        const swatchW = 14;
        const swatchH = 10;
        const itemGap = 20;
        const textWidthEstimate = function(s) { return s.length * 6.2; };
        for (let li = 0; li < legendItems.length; li++) {
            legendTotalW += swatchW + 4 + textWidthEstimate(legendItems[li].label);
            if (li < legendItems.length - 1) legendTotalW += itemGap;
        }

        let legendX = (svgW - legendTotalW) / 2;
        for (let lj = 0; lj < legendItems.length; lj++) {
            const item = legendItems[lj];
            parts.push('<rect x="' + legendX + '" y="' + (legendY - swatchH / 2) + '" width="' + swatchW + '" height="' + swatchH + '" rx="2" fill="' + item.color + '" stroke="#555" stroke-width="0.5"/>');
            legendX += swatchW + 4;
            parts.push('<text x="' + legendX + '" y="' + (legendY + LEGEND_FONT * 0.35) + '" font-size="' + LEGEND_FONT + '" fill="#aaa" font-family="Segoe UI, sans-serif">' + esc(item.label) + '</text>');
            legendX += textWidthEstimate(item.label) + itemGap;
        }

        // U count summary
        const nodesU = nodeCount * 2;
        const switchesU = torPerRack * rackCount;
        const bmcSwitchesU = bmcPerRack * rackCount;
        const usedU = nodesU + switchesU + bmcSwitchesU;
        const totalU = TOTAL_U * rackCount;
        parts.push('<text x="' + (svgW / 2) + '" y="' + (legendY + 18) + '" text-anchor="middle" font-size="9" fill="#888" font-family="Segoe UI, sans-serif">' + usedU + 'U used / ' + totalU + 'U total</text>');

        parts.push('</svg>');
        return parts.join('\n');
    }

    // ── Disaggregated Rack SVG Generator ──
    // config: { storageType, backupEnabled, rackCount, nodesPerRack, spineCount, rackAsns }
    function generateDisaggregatedRackSvg(config) {
        const storageType = config.storageType || 'fc_san';
        const backupEnabled = config.backupEnabled || false;
        const rackCount = config.rackCount || 4;
        const nodesPerRack = config.nodesPerRack || 16;
        const spineCount = config.spineCount || 2;
        const baseAsn = 64789;
        const spineAsn = 64841;
        const serviceLeafAsn = 65005;

        // Colors for disaggregated-specific components
        const DC = {
            LEAF_SWITCH: '#444444',
            BMC_SWITCH:  '#3b82f6',
            FC_SWITCH:   '#7c3aed',
            SAN_ARRAY:   '#6d28d9',
            ISCSI_ARRAY: '#ea580c',
            SPINE:       '#1a6fc4',
            SERVICE_LEAF:'#0d9488'
        };

        const hasFC = storageType === 'fc_san';
        const hasIscsi = storageType === 'iscsi_4nic' || storageType === 'iscsi_6nic';
        const fcDevices = hasFC ? 2 : 0;  // FC Switch A + B per rack

        const outerRackW = RACK_W + POST_W * 2;
        const innerH = TOTAL_U * U_H;
        const outerRackH = innerH + 12;
        const rackGap = rackCount > 4 ? 20 : 30;
        const totalRackWidth = rackCount * outerRackW + (rackCount - 1) * rackGap;

        // Layout heights
        const titleH = 30;
        const spineH = 70;    // Spine + service leaf area
        const rackLabelH = 18;
        const sanH = hasFC ? 50 : (hasIscsi ? 50 : 0);
        const legendH = 50;
        const padX = 20;

        // ── Issue #223 fix ──
        // The single-rack disaggregated layout previously clamped svgW to
        // 380px, which caused three overlapping artefacts:
        //   1. Title text crossed under the Azure Local brand badge.
        //   2. SAN/iSCSI fabric labels overflowed their boxes (sanBoxW was
        //      derived from totalRackWidth = 236 → boxes only 108 px wide).
        //   3. Legend ran past the right edge.
        // Compute MIN_SVG_W from the actual content widths (title + brand,
        // SAN/iSCSI fabric labels, and legend) so single-rack renders stay
        // readable while preserving the existing side-by-side fabric design.
        const storageLabel = storageType === 'fc_san' ? 'FC SAN' : (storageType === 'iscsi_4nic' ? 'iSCSI 4-NIC' : 'iSCSI 6-NIC');
        const titleText = 'Rack Layout — Front View (Disaggregated, ' + storageLabel + ')';
        // Title font-size 13 ≈ 6.5 px/char; brand badge ≈ 94px (icon + text);
        // need brand on either side of the centred title without collision,
        // hence brand width counted twice plus padding.
        const titleMinW = Math.ceil(titleText.length * 6.6) + 2 * 94 + 2 * padX;

        // SAN/iSCSI fabric labels at font-size 9 (~5.1 px/char) plus a
        // sub-line at font-size 7 (~3.7 px/char). Each fabric box must fit
        // the longer of the two; pair has a 20px gap; whole block spans
        // (svgW - 2*padX) centred.
        let sanLabelMinW = 0;
        if (hasFC) {
            const fcMain = 'SAN Storage Array — Fabric B';
            const fcSub = 'FC 32G / Connected to FC Switch A in each rack';
            sanLabelMinW = Math.ceil(Math.max(fcMain.length * 5.1, fcSub.length * 3.7)) + 16; // box padding
            sanLabelMinW = sanLabelMinW * 2 + 20 + 2 * padX;
        } else if (hasIscsi) {
            const iscsiMain = 'iSCSI Storage Array — Target B';
            const iscsiSub = storageType === 'iscsi_6nic' ? 'Ports 33-48, VLAN 600' : 'Ports 17-32 (shared)';
            sanLabelMinW = Math.ceil(Math.max(iscsiMain.length * 5.1, iscsiSub.length * 3.7)) + 16;
            sanLabelMinW = sanLabelMinW * 2 + 20 + 2 * padX;
        }

        // Legend width — count items conservatively (the loop below repeats
        // the same formula). 7–9 items at ~13 chars each + swatch overhead.
        const legendItemCount = 5 + (hasFC ? 2 : 0) + (hasIscsi ? 1 : 0); // server, leaf, bmc, spine, sl + (fc+san) | iscsi
        const legendMinW = legendItemCount * 110 + 2 * padX;

        const MIN_SVG_W = Math.max(380, titleMinW, sanLabelMinW, legendMinW);
        const svgW = Math.max(totalRackWidth + padX * 2, MIN_SVG_W);
        const svgH = titleH + spineH + rackLabelH + outerRackH + sanH + legendH + 40;
        // Centre the rack/spine block when the SVG was widened.
        const disaggOffsetX = (svgW - (totalRackWidth + padX * 2)) / 2;

        const parts = [];
        // Responsive: viewBox scales to container width. Wide disaggregated
        // layouts (rackCount > ~5) would otherwise overflow the report column.
        // No max-width: let the SVG fill the report column so single-rack
        // layouts use the entire available canvas instead of being clamped
        // to MIN_SVG_W and looking cramped.
        parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: auto; display: block; margin: 0 auto;" font-family="Segoe UI, sans-serif">');
        parts.push('<rect width="' + svgW + '" height="' + svgH + '" fill="' + C.BACKGROUND + '"/>');

        // Title
        parts.push('<text x="' + (svgW / 2) + '" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="#ccc">' + esc(titleText) + '</text>');

        // Azure Local brand: icon + text (top-right)
        const brandX = svgW - padX;
        const brandY = 4;
        const iconSize = 16;
        parts.push('<image href="' + ICON_DATA_URI + '" x="' + (brandX - iconSize - 62) + '" y="' + brandY + '" width="' + iconSize + '" height="' + iconSize + '" opacity="0.85"/>');
        parts.push('<text x="' + (brandX - 58) + '" y="' + (brandY + 13) + '" font-size="10" font-weight="600" fill="#B596F5" font-family="Segoe UI, sans-serif">Azure Local</text>');

        // ── Service Leaf + Spine layer ──
        const slBoxW = 120;
        const slBoxH = 20;
        const slY = titleH + 8;
        const slStartX = (svgW - 2 * slBoxW - 20) / 2;
        const slLabels = ['Service Leaf A', 'Service Leaf B'];
        for (let sl = 0; sl < 2; sl++) {
            const slx = slStartX + sl * (slBoxW + 20);
            parts.push('<rect x="' + slx + '" y="' + slY + '" width="' + slBoxW + '" height="' + slBoxH + '" rx="3" fill="' + DC.SERVICE_LEAF + '"/>');
            parts.push('<text x="' + (slx + slBoxW / 2) + '" y="' + (slY + 11) + '" text-anchor="middle" font-size="8" font-weight="600" fill="#fff">' + slLabels[sl] + '</text>');
            parts.push('<text x="' + (slx + slBoxW / 2) + '" y="' + (slY + slBoxH - 2) + '" text-anchor="middle" font-size="6" fill="rgba(255,255,255,0.6)">ASN ' + serviceLeafAsn + '</text>');
        }

        // Spine pair
        const spineBoxW = 160;
        const spineBoxH = 22;
        const spineY = slY + slBoxH + 8;
        const spineGap = 20;
        const totalSpineW = spineCount * spineBoxW + (spineCount - 1) * spineGap;
        const spineStartX = (svgW - totalSpineW) / 2;

        for (let s = 0; s < spineCount; s++) {
            const sx = spineStartX + s * (spineBoxW + spineGap);
            parts.push('<rect x="' + sx + '" y="' + spineY + '" width="' + spineBoxW + '" height="' + spineBoxH + '" rx="4" fill="' + DC.SPINE + '"/>');
            parts.push('<text x="' + (sx + spineBoxW / 2) + '" y="' + (spineY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">Spine ' + (s + 1) + '</text>');
            parts.push('<text x="' + (sx + spineBoxW / 2) + '" y="' + (spineY + spineBoxH - 2) + '" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.6)">ASN ' + spineAsn + '</text>');
        }

        // ── Racks ──
        const racksY = titleH + spineH + rackLabelH;
        for (let r = 0; r < rackCount; r++) {
            const rackAsn = baseAsn + r;
            const rx = padX + disaggOffsetX + r * (outerRackW + rackGap);

            // Rack label
            parts.push('<text x="' + (rx + outerRackW / 2) + '" y="' + (racksY - 4) + '" text-anchor="middle" font-size="' + (LABEL_FONT + 1) + '" font-weight="600" fill="#ccc">Rack ' + (r + 1) + ' (ASN ' + rackAsn + ')</text>');

            // Rack frame
            parts.push(drawRackFrame(rx, racksY, null));

            // U positions: Leaf A=U42, Leaf B=U41, BMC=U40, Servers start U39 going down (2U each)
            // FC switches (if any) at bottom: U2, U1
            parts.push(drawDevice(rx, racksY, 42, 1, DC.LEAF_SWITCH, 'Leaf ' + (r + 1) + 'A', C.LABEL_LIGHT));
            parts.push(drawDevice(rx, racksY, 41, 1, DC.LEAF_SWITCH, 'Leaf ' + (r + 1) + 'B', C.LABEL_LIGHT));

            // LEDs for leaves
            const leafDy42 = racksY + 6 + innerH - 42 * U_H + 1;
            const leafDy41 = racksY + 6 + innerH - 41 * U_H + 1;
            const ledBaseX = rx + POST_W + 2 + RACK_W - 4 - 16;
            for (let led = 0; led < 3; led++) {
                parts.push('<circle cx="' + (ledBaseX + led * 5) + '" cy="' + (leafDy42 + (U_H - 2) / 2) + '" r="1.5" fill="#00ff66" opacity="0.6"/>');
                parts.push('<circle cx="' + (ledBaseX + led * 5) + '" cy="' + (leafDy41 + (U_H - 2) / 2) + '" r="1.5" fill="#00ff66" opacity="0.6"/>');
            }

            // BMC switch at U40
            parts.push(drawDevice(rx, racksY, 40, 1, DC.BMC_SWITCH, 'BMC Switch ' + (r + 1), C.LABEL_LIGHT, false));
            const bmcDy = racksY + 6 + innerH - 40 * U_H + 1;
            for (let bled = 0; bled < 2; bled++) {
                parts.push('<circle cx="' + (ledBaseX + bled * 6) + '" cy="' + (bmcDy + (U_H - 2) / 2) + '" r="2" fill="#00ff66" opacity="0.7"/>');
            }

            // Server nodes fill bottom-up (2U each). FC switches (when present)
            // occupy U1-U2, so servers start just above them and stack upward,
            // stopping before the BMC switch at U40.
            // Note: drawDevice for 2U extends upward by 1U, so uPos occupies uPos..uPos+1.
            const nodeStart = r * nodesPerRack + 1;
            const lowestServerU = hasFC ? 3 : 1; // above the FC switches when present
            for (let n = 0; n < nodesPerRack; n++) {
                const uPos = lowestServerU + n * 2;
                if (uPos + 1 >= 40) break;  // don't overlap the BMC / leaf switch zone
                const nodeLabel = getRackNodeLabel(config, nodeStart + n - 1);
                parts.push(drawDevice(rx, racksY, uPos, 2, C.SERVER, nodeLabel, C.LABEL_LIGHT));

                // Drive bays (left side of node)
                const dx = rx + POST_W + 2;
                const dy = racksY + 6 + innerH - uPos * U_H - U_H + 1;
                const devH = 2 * U_H - 2;
                const devW = RACK_W - 4;
                const bayW = 8, bayH = devH * 0.4;
                const bayY = dy + devH / 2 - bayH / 2;
                for (let b = 0; b < 6; b++) {
                    parts.push('<rect x="' + (dx + 8 + b * (bayW + 2)) + '" y="' + bayY + '" width="' + bayW + '" height="' + bayH + '" rx="1" fill="#333" opacity="0.4"/>');
                }

                // Status LEDs (right side, vertically centered)
                parts.push('<circle cx="' + (dx + devW - 12) + '" cy="' + (dy + devH / 2) + '" r="2" fill="#00ff66" opacity="0.6"/>');
                parts.push('<circle cx="' + (dx + devW - 6) + '" cy="' + (dy + devH / 2) + '" r="2" fill="#f59e0b" opacity="0.5"/>');
            }

            // FC switches at bottom U2, U1 (only for FC SAN)
            if (hasFC) {
                parts.push(drawDevice(rx, racksY, 2, 1, DC.FC_SWITCH, 'FC Switch ' + (r + 1) + 'A', C.LABEL_LIGHT));
                parts.push(drawDevice(rx, racksY, 1, 1, DC.FC_SWITCH, 'FC Switch ' + (r + 1) + 'B', C.LABEL_LIGHT));
                const fcDy2 = racksY + 6 + innerH - 2 * U_H + 1;
                const fcDy1 = racksY + 6 + innerH - 1 * U_H + 1;
                for (let fled = 0; fled < 3; fled++) {
                    parts.push('<circle cx="' + (ledBaseX + fled * 5) + '" cy="' + (fcDy2 + (U_H - 2) / 2) + '" r="1.5" fill="#00ff66" opacity="0.6"/>');
                    parts.push('<circle cx="' + (ledBaseX + fled * 5) + '" cy="' + (fcDy1 + (U_H - 2) / 2) + '" r="1.5" fill="#00ff66" opacity="0.6"/>');
                }
            }

            // Spine → Leaf connector lines
            for (let sp = 0; sp < spineCount; sp++) {
                const spCenterX = spineStartX + sp * (spineBoxW + spineGap) + spineBoxW / 2;
                const leafACenterY = racksY + 6 + innerH - 42 * U_H + U_H / 2;
                const leafCenterX = rx + outerRackW / 2;
                parts.push('<line x1="' + spCenterX + '" y1="' + (spineY + spineBoxH) + '" x2="' + leafCenterX + '" y2="' + leafACenterY + '" stroke="#7dd3fc" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.25"/>');
            }
        }

        // ── SAN layer ──
        // Issue #223: span the full SVG width (not the narrow rack column)
        // so the fabric labels remain readable for single-rack layouts.
        const sanY = racksY + outerRackH + 12;
        const sanBlockW = svgW - 2 * padX;
        if (hasFC) {
            const sanBoxW = (sanBlockW - 20) / 2;
            const sanBoxH = 30;
            const sanX1 = padX;
            const sanX2 = padX + sanBoxW + 20;
            parts.push('<rect x="' + sanX1 + '" y="' + sanY + '" width="' + sanBoxW + '" height="' + sanBoxH + '" rx="4" fill="' + DC.SAN_ARRAY + '"/>');
            parts.push('<text x="' + (sanX1 + sanBoxW / 2) + '" y="' + (sanY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">SAN Storage Array — Fabric A</text>');
            parts.push('<text x="' + (sanX1 + sanBoxW / 2) + '" y="' + (sanY + 24) + '" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">FC 32G / Connected to FC Switch A in each rack</text>');
            parts.push('<rect x="' + sanX2 + '" y="' + sanY + '" width="' + sanBoxW + '" height="' + sanBoxH + '" rx="4" fill="' + DC.SAN_ARRAY + '"/>');
            parts.push('<text x="' + (sanX2 + sanBoxW / 2) + '" y="' + (sanY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">SAN Storage Array — Fabric B</text>');
            parts.push('<text x="' + (sanX2 + sanBoxW / 2) + '" y="' + (sanY + 24) + '" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">FC 32G / Connected to FC Switch B in each rack</text>');

            // FC → SAN connector lines
            for (let fr = 0; fr < rackCount; fr++) {
                const frx = padX + disaggOffsetX + fr * (outerRackW + rackGap) + outerRackW / 2;
                const fcBottomY = racksY + outerRackH;
                parts.push('<line x1="' + frx + '" y1="' + fcBottomY + '" x2="' + (sanX1 + sanBoxW / 2) + '" y2="' + sanY + '" stroke="#c4b5fd" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.25"/>');
                parts.push('<line x1="' + frx + '" y1="' + fcBottomY + '" x2="' + (sanX2 + sanBoxW / 2) + '" y2="' + sanY + '" stroke="#c4b5fd" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.25"/>');
            }
        } else if (hasIscsi) {
            const iscsiBoxW = (sanBlockW - 20) / 2;
            const iscsiBoxH = 30;
            const iscsiX1 = padX;
            const iscsiX2 = padX + iscsiBoxW + 20;
            const portLabel = storageType === 'iscsi_6nic' ? 'Ports 33-48, VLAN 500' : 'Ports 17-32 (shared)';
            const port2Label = storageType === 'iscsi_6nic' ? 'Ports 33-48, VLAN 600' : 'Ports 17-32 (shared)';
            parts.push('<rect x="' + iscsiX1 + '" y="' + sanY + '" width="' + iscsiBoxW + '" height="' + iscsiBoxH + '" rx="4" fill="' + DC.ISCSI_ARRAY + '"/>');
            parts.push('<text x="' + (iscsiX1 + iscsiBoxW / 2) + '" y="' + (sanY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">iSCSI Storage Array — Target A</text>');
            parts.push('<text x="' + (iscsiX1 + iscsiBoxW / 2) + '" y="' + (sanY + 24) + '" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">' + esc(portLabel) + '</text>');
            parts.push('<rect x="' + iscsiX2 + '" y="' + sanY + '" width="' + iscsiBoxW + '" height="' + iscsiBoxH + '" rx="4" fill="' + DC.ISCSI_ARRAY + '"/>');
            parts.push('<text x="' + (iscsiX2 + iscsiBoxW / 2) + '" y="' + (sanY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">iSCSI Storage Array — Target B</text>');
            parts.push('<text x="' + (iscsiX2 + iscsiBoxW / 2) + '" y="' + (sanY + 24) + '" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">' + esc(port2Label) + '</text>');

            for (let ir = 0; ir < rackCount; ir++) {
                const irx = padX + disaggOffsetX + ir * (outerRackW + rackGap) + outerRackW / 2;
                const iscsiTopY = racksY + outerRackH;
                parts.push('<line x1="' + irx + '" y1="' + iscsiTopY + '" x2="' + (iscsiX1 + iscsiBoxW / 2) + '" y2="' + sanY + '" stroke="#fdba74" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.25"/>');
                parts.push('<line x1="' + irx + '" y1="' + iscsiTopY + '" x2="' + (iscsiX2 + iscsiBoxW / 2) + '" y2="' + sanY + '" stroke="#fdba74" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.25"/>');
            }
        }

        // ── Legend ──
        const legendY = svgH - legendH;
        const legendItems = [
            { color: C.SERVER, label: 'Server Node' },
            { color: DC.LEAF_SWITCH, label: 'Leaf Switch' },
            { color: DC.BMC_SWITCH, label: 'BMC Switch' }
        ];
        if (hasFC) legendItems.push({ color: DC.FC_SWITCH, label: 'FC Switch' });
        if (hasIscsi) legendItems.push({ color: DC.ISCSI_ARRAY, label: 'iSCSI Storage' });
        legendItems.push({ color: DC.SPINE, label: 'Spine Switch' });
        legendItems.push({ color: DC.SERVICE_LEAF, label: 'Service Leaf' });
        if (hasFC) legendItems.push({ color: DC.SAN_ARRAY, label: 'SAN Storage' });

        const lgW = 14, lgH = 10, lgGap = 14;
        let totalLegendW = 0;
        legendItems.forEach(function(li) { totalLegendW += lgW + 4 + li.label.length * 5.5 + lgGap; });
        let lgX = (svgW - totalLegendW) / 2;

        legendItems.forEach(function(li) {
            parts.push('<rect x="' + lgX + '" y="' + (legendY + 4) + '" width="' + lgW + '" height="' + lgH + '" rx="2" fill="' + li.color + '"/>');
            const tc = li.textColor || '#aaa';
            parts.push('<text x="' + (lgX + lgW + 4) + '" y="' + (legendY + 12) + '" font-size="' + LEGEND_FONT + '" fill="' + tc + '">' + esc(li.label) + '</text>');
            lgX += lgW + 4 + li.label.length * 5.5 + lgGap;
        });

        // Summary line
        const totalNodes = rackCount * nodesPerRack;
        const usedU = rackCount * (3 + nodesPerRack * 2 + fcDevices);
        const totalU = rackCount * TOTAL_U;
        const backupStr = backupEnabled ? ' | Backup' : '';
        parts.push('<text x="' + (svgW / 2) + '" y="' + (legendY + 30) + '" text-anchor="middle" font-size="9" fill="#888">' + usedU + 'U used / ' + totalU + 'U total | ' + totalNodes + ' nodes | ' + rackCount + ' racks | ' + spineCount + ' spines | ' + esc(storageLabel) + backupStr + '</text>');

        parts.push('</svg>');
        return parts.join('\n');
    }

    // ── Draw.io XML helpers ──
    function xmlEsc(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── HCI Rack Draw.io Generator ──
    // config: { clusterType, nodeCount, hasGpu }
    function generateRackDrawio(config) {
        const clusterType = config.clusterType || 'standard';
        const isRackAware = clusterType === 'rack-aware';
        const rackCount = isRackAware ? 2 : 1;
        const nodeCount = config.nodeCount || 2;
        const hasGpu = config.hasGpu || false;
        const torPerRack = nodeCount > 1 ? 2 : 1;
        const bmcPerRack = 1;

        const racks = [];
        if (isRackAware) {
            const half = Math.ceil(nodeCount / 2);
            racks.push({ nodes: half, tor: torPerRack });
            racks.push({ nodes: nodeCount - half, tor: torPerRack });
        } else {
            racks.push({ nodes: nodeCount, tor: torPerRack });
        }

        // Layout constants (draw.io scale)
        const rackW = 260;
        const uH = 24;
        const rackGap = 80;
        const rackInnerH = 42 * uH;  // 42U
        const rackOuterH = rackInnerH + 20;
        const coreW = 300;
        const coreH = 50;
        const padX = 60;
        const padY = 40;
        const coreGap = 50;

        const totalRacksW = rackCount * rackW + (rackCount - 1) * rackGap;
        const pageW = Math.max(totalRacksW, coreW) + padX * 2;
        const pageH = padY + coreH + coreGap + rackOuterH + 120;

        const cells = [];
        let cellId = 2;
        function nextId() { return String(cellId++); }
        function addCell(value, x, y, w, h, style, parent) {
            const id = nextId();
            cells.push({ id: id, value: xmlEsc(value), x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), style: style, parent: parent || '1' });
            return id;
        }

        // Background
        addCell('', 0, 0, pageW, pageH,
            'rounded=1;whiteSpace=wrap;html=1;fillColor=#0a0a0a;strokeColor=none;arcSize=2;');

        // Title
        addCell('Rack Layout — Front View', 0, padY - 30, pageW, 24,
            'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#cccccc;fontSize=14;fontStyle=1;');

        // Azure Local brand
        addCell('Azure Local', pageW - 140, padY - 28, 100, 20,
            'text;html=1;align=right;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#B596F5;fontSize=12;fontStyle=1;');

        // Core Switch
        const coreX = (pageW - coreW) / 2;
        const coreY = padY;
        addCell('Core Switch / Router / Firewall', coreX, coreY, coreW, coreH,
            'rounded=1;whiteSpace=wrap;html=1;fillColor=#1a6fc4;strokeColor=#2a8ad4;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=8;');

        // Racks
        const racksTopY = coreY + coreH + coreGap;
        const racksStartX = (pageW - totalRacksW) / 2;

        for (let r = 0; r < rackCount; r++) {
            const rackInfo = racks[r];
            const rx = racksStartX + r * (rackW + rackGap);
            const ry = racksTopY;

            // Rack label
            const rackLabel = isRackAware ? 'Rack ' + (r + 1) : 'Rack';
            addCell(rackLabel, rx, ry - 22, rackW, 20,
                'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#cccccc;fontSize=12;fontStyle=1;');

            // Rack frame
            addCell('', rx, ry, rackW, rackOuterH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#2a2a2a;strokeColor=#555555;arcSize=1;');

            // Inner area
            addCell('', rx + 10, ry + 10, rackW - 20, rackInnerH,
                'rounded=0;whiteSpace=wrap;html=1;fillColor=#1a1a1a;strokeColor=none;');

            const devW = rackW - 28;
            const devX = rx + 14;

            // ToR switches at top (U42, U41)
            for (let t = 0; t < rackInfo.tor; t++) {
                const torU = 42 - t;
                const torY = ry + 10 + (42 - torU) * uH;
                const torNum = isRackAware ? (r * 2 + t + 1) : (t + 1);
                addCell(getRackTorLabel(config, torNum - 1), devX, torY + 1, devW, uH - 2,
                    'rounded=1;whiteSpace=wrap;html=1;fillColor=#444444;strokeColor=#666666;fontColor=#FFFFFF;fontSize=10;fontStyle=1;arcSize=15;');
            }

            // BMC switch
            const bmcU = 42 - rackInfo.tor;
            const bmcY = ry + 10 + (42 - bmcU) * uH;
            const bmcNum = isRackAware ? (r + 1) : 1;
            addCell('BMC ' + bmcNum, devX, bmcY + 1, devW, uH - 2,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#3b82f6;strokeColor=#2563eb;fontColor=#FFFFFF;fontSize=10;fontStyle=1;arcSize=15;');

            // Server nodes (2U each) — fill bottom-up; switches stay at the top.
            // serverU is the TOP U of each 2U device, so the device covers
            // serverU and serverU-1. Node 1 sits at U2-U1, then stacks upward.
            const topServerU = 42 - rackInfo.tor - bmcPerRack;
            let nodeOffset = 0;
            for (let pr = 0; pr < r; pr++) { nodeOffset += racks[pr].nodes; }
            for (let n = 0; n < rackInfo.nodes; n++) {
                const serverU = 2 + n * 2;
                if (serverU > topServerU) break;
                const serverY = ry + 10 + (42 - serverU) * uH;
                const serverColor = hasGpu ? '#d97706' : '#aaaaaa';
                const serverStroke = hasGpu ? '#b45309' : '#888888';
                const serverFontColor = hasGpu ? '#FFFFFF' : '#333333';
                addCell(getRackNodeLabel(config, nodeOffset + n), devX, serverY + 1, devW, 2 * uH - 2,
                    'rounded=1;whiteSpace=wrap;html=1;fillColor=' + serverColor + ';strokeColor=' + serverStroke + ';fontColor=' + serverFontColor + ';fontSize=10;fontStyle=1;arcSize=8;');
            }
        }

        // Legend
        const legendY = racksTopY + rackOuterH + 30;
        const legendItems = [
            { color: '#aaaaaa', label: 'Server Node' },
            { color: '#444444', label: 'ToR Switch' },
            { color: '#3b82f6', label: 'BMC Switch' },
            { color: '#1a6fc4', label: 'Core Switch' }
        ];
        if (hasGpu) {
            legendItems.splice(1, 0, { color: '#d97706', label: 'GPU Node' });
        }
        const lgW = 20, lgH = 14, lgGap = 16;
        let lgTotalW = 0;
        for (let li = 0; li < legendItems.length; li++) {
            lgTotalW += lgW + 4 + legendItems[li].label.length * 7 + lgGap;
        }
        let lgX = (pageW - lgTotalW) / 2;
        for (let lj = 0; lj < legendItems.length; lj++) {
            const item = legendItems[lj];
            addCell('', lgX, legendY, lgW, lgH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=' + item.color + ';strokeColor=#555555;');
            addCell(item.label, lgX + lgW + 4, legendY - 1, item.label.length * 7, lgH + 2,
                'text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#aaaaaa;fontSize=10;');
            lgX += lgW + 4 + item.label.length * 7 + lgGap;
        }

        // U count summary
        const nodesU = nodeCount * 2;
        const switchesU = torPerRack * rackCount;
        const bmcU2 = bmcPerRack * rackCount;
        const usedU = nodesU + switchesU + bmcU2;
        const totalU = 42 * rackCount;
        addCell(usedU + 'U used / ' + totalU + 'U total', 0, legendY + 24, pageW, 18,
            'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#888888;fontSize=10;');

        // Build XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<mxfile host="app.diagrams.net" type="device">\n';
        xml += '  <diagram name="Rack Layout" id="odin-rack-layout">\n';
        xml += '    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="' + Math.round(pageW) + '" pageHeight="' + Math.round(pageH + 60) + '" math="0" shadow="0">\n';
        xml += '      <root>\n';
        xml += '        <mxCell id="0" />\n';
        xml += '        <mxCell id="1" parent="0" />\n';
        for (let vi = 0; vi < cells.length; vi++) {
            const c = cells[vi];
            xml += '        <mxCell id="' + c.id + '" value="' + c.value + '" style="' + c.style + '" vertex="1" parent="' + c.parent + '">\n';
            xml += '          <mxGeometry x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" as="geometry" />\n';
            xml += '        </mxCell>\n';
        }
        xml += '      </root>\n';
        xml += '    </mxGraphModel>\n';
        xml += '  </diagram>\n';
        xml += '</mxfile>';
        return xml;
    }

    // ── Disaggregated Rack Draw.io Generator ──
    // config: { storageType, backupEnabled, rackCount, nodesPerRack, spineCount }
    function generateDisaggregatedRackDrawio(config) {
        const storageType = config.storageType || 'fc_san';
        const backupEnabled = config.backupEnabled || false;
        const rackCount = config.rackCount || 4;
        const nodesPerRack = config.nodesPerRack || 16;
        const spineCount = config.spineCount || 2;
        const baseAsn = 64789;
        const spineAsn = 64841;
        const serviceLeafAsn = 65005;

        const hasFC = storageType === 'fc_san';
        const hasIscsi = storageType === 'iscsi_4nic' || storageType === 'iscsi_6nic';
        const fcDevices = hasFC ? 2 : 0;

        // Layout constants (draw.io scale)
        const rackW = 260;
        const uH = 24;
        const rackGap = rackCount > 4 ? 30 : 50;
        const rackInnerH = 42 * uH;
        const rackOuterH = rackInnerH + 20;
        const padX = 40;
        const padY = 40;

        const totalRacksW = rackCount * rackW + (rackCount - 1) * rackGap;

        // Spine/service leaf area
        const slBoxW = 160;
        const slBoxH = 30;
        const spineBoxW = 200;
        const spineBoxH = 34;
        const spineGap = 30;
        const slY = padY + 30;
        const spineY = slY + slBoxH + 14;
        const rackLabelH = 30;
        const racksTopY = spineY + spineBoxH + rackLabelH + 10;
        const sanH = (hasFC || hasIscsi) ? 60 : 0;
        const legendH = 60;

        const pageW = Math.max(totalRacksW + padX * 2, 600);
        const pageH = racksTopY + rackOuterH + sanH + legendH + 60;

        const cells = [];
        let cellId = 2;
        function nextId() { return String(cellId++); }
        function addCell(value, x, y, w, h, style, parent) {
            const id = nextId();
            cells.push({ id: id, value: xmlEsc(value), x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), style: style, parent: parent || '1' });
            return id;
        }

        // Background
        addCell('', 0, 0, pageW, pageH,
            'rounded=0;whiteSpace=wrap;html=1;fillColor=#0a0a0a;strokeColor=none;');

        // Title
        const storageLabel = storageType === 'fc_san' ? 'FC SAN' : (storageType === 'iscsi_4nic' ? 'iSCSI 4-NIC' : 'iSCSI 6-NIC');
        addCell('Rack Layout — Front View (Disaggregated, ' + storageLabel + ')', 0, padY - 24, pageW, 24,
            'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#cccccc;fontSize=14;fontStyle=1;');

        // Azure Local brand
        addCell('Azure Local', pageW - 140, padY - 22, 100, 20,
            'text;html=1;align=right;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#B596F5;fontSize=12;fontStyle=1;');

        // Service Leaf boxes
        const slStartX = (pageW - 2 * slBoxW - 30) / 2;
        const slLabels = ['Service Leaf A', 'Service Leaf B'];
        for (let sl = 0; sl < 2; sl++) {
            const slx = slStartX + sl * (slBoxW + 30);
            addCell(slLabels[sl] + '\\nASN ' + serviceLeafAsn, slx, slY, slBoxW, slBoxH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#0d9488;strokeColor=#14b8a6;fontColor=#FFFFFF;fontSize=10;fontStyle=1;arcSize=12;');
        }

        // Spine switches
        const totalSpineW = spineCount * spineBoxW + (spineCount - 1) * spineGap;
        const spineStartX = (pageW - totalSpineW) / 2;
        for (let s = 0; s < spineCount; s++) {
            const sx = spineStartX + s * (spineBoxW + spineGap);
            addCell('Spine ' + (s + 1) + '\\nASN ' + spineAsn, sx, spineY, spineBoxW, spineBoxH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#1a6fc4;strokeColor=#2a8ad4;fontColor=#FFFFFF;fontSize=11;fontStyle=1;arcSize=8;');
        }

        // Racks
        const racksStartX = (pageW - totalRacksW) / 2;
        for (let r = 0; r < rackCount; r++) {
            const rackAsn = baseAsn + r;
            const rx = racksStartX + r * (rackW + rackGap);
            const ry = racksTopY;

            // Rack label
            addCell('Rack ' + (r + 1) + ' (ASN ' + rackAsn + ')', rx, ry - 22, rackW, 20,
                'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#cccccc;fontSize=11;fontStyle=1;');

            // Rack frame
            addCell('', rx, ry, rackW, rackOuterH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#2a2a2a;strokeColor=#555555;arcSize=1;');

            // Inner area
            addCell('', rx + 10, ry + 10, rackW - 20, rackInnerH,
                'rounded=0;whiteSpace=wrap;html=1;fillColor=#1a1a1a;strokeColor=none;');

            const devW = rackW - 28;
            const devX = rx + 14;

            // Leaf switches (U42, U41)
            addCell('Leaf ' + (r + 1) + 'A', devX, ry + 10 + 1, devW, uH - 2,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#444444;strokeColor=#666666;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;');
            addCell('Leaf ' + (r + 1) + 'B', devX, ry + 10 + uH + 1, devW, uH - 2,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#444444;strokeColor=#666666;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;');

            // BMC switch (U40)
            addCell('BMC Switch ' + (r + 1), devX, ry + 10 + 2 * uH + 1, devW, uH - 2,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#3b82f6;strokeColor=#2563eb;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;');

            // Server nodes (2U each) — fill bottom-up; switches stay at the top,
            // FC switches (when present) occupy U1-U2. uPos is the TOP U of each
            // 2U device (covers uPos and uPos-1).
            const nodeStart = r * nodesPerRack + 1;
            const lowestUPos = hasFC ? 4 : 2; // just above the FC switch zone
            for (let n = 0; n < nodesPerRack; n++) {
                const uPos = lowestUPos + n * 2;
                if (uPos > 39) break; // don't overlap the BMC / leaf switch zone
                const serverY = ry + 10 + (42 - uPos) * uH;
                addCell(getRackNodeLabel(config, nodeStart + n - 1), devX, serverY + 1, devW, 2 * uH - 2,
                    'rounded=1;whiteSpace=wrap;html=1;fillColor=#aaaaaa;strokeColor=#888888;fontColor=#333333;fontSize=9;fontStyle=1;arcSize=8;');
            }

            // FC switches at bottom (U2, U1)
            if (hasFC) {
                const fcY2 = ry + 10 + (42 - 2) * uH;
                const fcY1 = ry + 10 + (42 - 1) * uH;
                addCell('FC Switch ' + (r + 1) + 'A', devX, fcY2 + 1, devW, uH - 2,
                    'rounded=1;whiteSpace=wrap;html=1;fillColor=#7c3aed;strokeColor=#6d28d9;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;');
                addCell('FC Switch ' + (r + 1) + 'B', devX, fcY1 + 1, devW, uH - 2,
                    'rounded=1;whiteSpace=wrap;html=1;fillColor=#7c3aed;strokeColor=#6d28d9;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;');
            }
        }

        // SAN / iSCSI layer
        const sanY = racksTopY + rackOuterH + 16;
        if (hasFC) {
            const sanBoxW = (totalRacksW - 20) / 2;
            const sanBoxH = 40;
            const sanX1 = racksStartX;
            const sanX2 = racksStartX + sanBoxW + 20;
            addCell('SAN Storage Array — Fabric A\\nFC 32G / Connected to FC Switch A in each rack', sanX1, sanY, sanBoxW, sanBoxH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#6d28d9;strokeColor=#7c3aed;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=6;');
            addCell('SAN Storage Array — Fabric B\\nFC 32G / Connected to FC Switch B in each rack', sanX2, sanY, sanBoxW, sanBoxH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#6d28d9;strokeColor=#7c3aed;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=6;');
        } else if (hasIscsi) {
            const iscsiBoxW = (totalRacksW - 20) / 2;
            const iscsiBoxH = 40;
            const iscsiX1 = racksStartX;
            const iscsiX2 = racksStartX + iscsiBoxW + 20;
            addCell('iSCSI Storage Array — Target A', iscsiX1, sanY, iscsiBoxW, iscsiBoxH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#ea580c;strokeColor=#c2410c;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=6;');
            addCell('iSCSI Storage Array — Target B', iscsiX2, sanY, iscsiBoxW, iscsiBoxH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#ea580c;strokeColor=#c2410c;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=6;');
        }

        // Legend
        const legendY = sanY + (sanH > 0 ? 56 : 16);
        const legendItems = [
            { color: '#aaaaaa', label: 'Server Node' },
            { color: '#444444', label: 'Leaf Switch' },
            { color: '#3b82f6', label: 'BMC Switch' }
        ];
        if (hasFC) legendItems.push({ color: '#7c3aed', label: 'FC Switch' });
        if (hasIscsi) legendItems.push({ color: '#ea580c', label: 'iSCSI Storage' });
        legendItems.push({ color: '#1a6fc4', label: 'Spine Switch' });
        legendItems.push({ color: '#0d9488', label: 'Service Leaf' });
        if (hasFC) legendItems.push({ color: '#6d28d9', label: 'SAN Storage' });

        const lgW = 20, lgH = 14, lgGap = 16;
        let lgTotalW = 0;
        for (let li = 0; li < legendItems.length; li++) {
            lgTotalW += lgW + 4 + legendItems[li].label.length * 7 + lgGap;
        }
        let lgX = (pageW - lgTotalW) / 2;
        for (let lj = 0; lj < legendItems.length; lj++) {
            const lItem = legendItems[lj];
            addCell('', lgX, legendY, lgW, lgH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=' + lItem.color + ';strokeColor=#555555;');
            addCell(lItem.label, lgX + lgW + 4, legendY - 1, lItem.label.length * 7, lgH + 2,
                'text;html=1;align=left;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#aaaaaa;fontSize=10;');
            lgX += lgW + 4 + lItem.label.length * 7 + lgGap;
        }

        // Summary
        const totalNodes = rackCount * nodesPerRack;
        const usedU = rackCount * (3 + nodesPerRack * 2 + fcDevices);
        const totalU = rackCount * 42;
        const backupStr = backupEnabled ? ' | Backup' : '';
        addCell(usedU + 'U used / ' + totalU + 'U total | ' + totalNodes + ' nodes | ' + rackCount + ' racks | ' + spineCount + ' spines | ' + storageLabel + backupStr, 0, legendY + 24, pageW, 18,
            'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#888888;fontSize=10;');

        // Build XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<mxfile host="app.diagrams.net" type="device">\n';
        xml += '  <diagram name="Rack Layout" id="odin-rack-layout">\n';
        xml += '    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="' + Math.round(pageW) + '" pageHeight="' + Math.round(pageH) + '" math="0" shadow="0">\n';
        xml += '      <root>\n';
        xml += '        <mxCell id="0" />\n';
        xml += '        <mxCell id="1" parent="0" />\n';
        for (let vi = 0; vi < cells.length; vi++) {
            const c = cells[vi];
            xml += '        <mxCell id="' + c.id + '" value="' + c.value + '" style="' + c.style + '" vertex="1" parent="' + c.parent + '">\n';
            xml += '          <mxGeometry x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" as="geometry" />\n';
            xml += '        </mxCell>\n';
        }
        xml += '      </root>\n';
        xml += '    </mxGraphModel>\n';
        xml += '  </diagram>\n';
        xml += '</mxfile>';
        return xml;
    }

    // Expose globally
    window.generateRackSvg = generateRackSvg;
    window.generateDisaggregatedRackSvg = generateDisaggregatedRackSvg;
    window.generateRackDrawio = generateRackDrawio;
    window.generateDisaggregatedRackDrawio = generateDisaggregatedRackDrawio;
    window.getRackNodeLabel = getRackNodeLabel;
    window.getRackTorLabel = getRackTorLabel;
})();
