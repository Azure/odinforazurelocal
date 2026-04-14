/* ============================================
   Static 2D SVG Rack Diagram — rack-svg.js
   Generates a front-view SVG of the rack layout
   matching the 3D visualization topology.
   ============================================ */

(function () {
    'use strict';

    // ── Layout constants (matching rack3d.js) ──
    var TOTAL_U = 42;
    var RACK_W = 220;          // SVG pixels for rack inner width
    var U_H = 14;              // SVG pixels per 1U
    var POST_W = 8;            // Rail post width
    var RACK_GAP = 60;         // Gap between racks (rack-aware)
    var LABEL_FONT = 10;
    var LEGEND_FONT = 10;

    // ── Azure Local icon (inline data URI for standalone SVG export) ──
    var ICON_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgY2xhc3M9IiIgcm9sZT0icHJlc2VudGF0aW9uIiBmb2N1c2FibGU9ImZhbHNlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBpZD0iRnhTeW1ib2wwLTEyMyIgZGF0YS10eXBlPSIxIj48Zz48dGl0bGU+PC90aXRsZT48cGF0aCBkPSJNMTI1LjI1IDEwNy41MTNjLTEuMTMgNC45NzgtNy4zMTcgOS44MjctMTguNDg4IDEzLjYyNWExNTIuNTcxIDE1Mi41NzEgMCAwIDEtODUuNzA0LjEyMWMtMTAuMzAzLTMuNjQ4LTE1Ljg2NC04LjI2My0xNi43MzItMTMuMDIxLS4xNS0uODM5IDAtMTMuODk1IDAtMTMuODk1bDEyMS4xNTktMS4xMjNzLS4wOTIgMTMuNjgxLS4yMzUgMTQuMjkzWiIgZmlsbD0iIzVFQTBFRiI+PC9wYXRoPjxwYXRoIGQ9Ik02NS4wNCAxMTUuMDMxYzMzLjQ3OS0uMzM2IDYwLjUyNS05Ljk5MSA2MC40MDktMjEuNTY0LS4xMTYtMTEuNTczLTI3LjM1LTIwLjY4My02MC44My0yMC4zNDctMzMuNDc5LjMzNi02MC41MjUgOS45OS02MC40MDkgMjEuNTY0LjExNiAxMS41NzMgMjcuMzUgMjAuNjgzIDYwLjgzIDIwLjM0N1oiIGZpbGw9IiM1MEU2RkYiPjwvcGF0aD48cGF0aCBkPSJNMTA1Ljk4OSAxMUgyMi4wMTFBMy4wMTEgMy4wMTEgMCAwIDAgMTkgMTQuMDExdjE4LjU4NWEzLjAxMSAzLjAxMSAwIDAgMCAzLjAxMSAzLjAxMWg4My45NzhhMy4wMTEgMy4wMTEgMCAwIDAgMy4wMTEtMy4wMVYxNC4wMWEzLjAxMSAzLjAxMSAwIDAgMC0zLjAxMS0zLjAxWiIgZmlsbD0iI0I1OTZGNSI+PC9wYXRoPjxwYXRoIGQ9Ik0xMDAuMjMgMTUuMzA3aC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MyAxLjUwMi0xLjUwM3YtMy43MmMwLS44My0uNjcyLTEuNTAzLTEuNTAyLTEuNTAzWm0wIDkuMjczaC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MyAxLjUwMi0xLjUwM3YtMy43MmMwLS44My0uNjcyLTEuNTAzLTEuNTAyLTEuNTAzWiIgZmlsbD0iI0YyRjJGMiI+PC9wYXRoPjxwYXRoIGQ9Ik0xMDUuOTg5IDQwLjE2NkgyMi4wMTFBMy4wMTEgMy4wMTEgMCAwIDAgMTkgNDMuMTc2djE4LjU4NmEzLjAxMSAzLjAxMSAwIDAgMCAzLjAxMSAzLjAxMWg4My45NzhhMy4wMTEgMy4wMTEgMCAwIDAgMy4wMTEtMy4wMVY0My4xNzZhMy4wMSAzLjAxIDAgMCAwLTMuMDExLTMuMDExWiIgZmlsbD0iIzkyNjZFNiI+PC9wYXRoPjxwYXRoIGQ9Ik0xMDAuMjMgNDQuNDY3aC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MyAxLjUwMi0xLjUwM3YtMy43MmMwLS44My0uNjcyLTEuNTAzLTEuNTAyLTEuNTAzWm0wIDkuMjczaC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MyAxLjUwMi0xLjUwMnYtMy43MmMwLS44My0uNjcyLTEuNTA0LTEuNTAyLTEuNTA0WiIgZmlsbD0iI0YyRjJGMiI+PC9wYXRoPjxwYXRoIGQ9Ik0xMDUuOTg5IDY5LjMyNkgyMi4wMTFBMy4wMTEgMy4wMTEgMCAwIDAgMTkgNzIuMzM2djE4LjU4NmEzLjAxMSAzLjAxMSAwIDAgMCAzLjAxMSAzLjAxMWg4My45NzhhMy4wMSAzLjAxIDAgMCAwIDMuMDExLTMuMDFWNzIuMzM2YTMuMDExIDMuMDExIDAgMCAwLTMuMDExLTMuMDExWiIgZmlsbD0iIzU1MkY5OSI+PC9wYXRoPjxwYXRoIGQ9Ik0xMDAuMjMgNzMuNjI3aC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MyAxLjUwMi0xLjUwMlY3NS4xM2MwLS44My0uNjcyLTEuNTAzLTEuNTAyLTEuNTAzWm0wIDkuMjczaC0zLjcyYy0uODMgMC0xLjUwNC42NzMtMS41MDQgMS41MDN2My43MmMwIC44My42NzMgMS41MDMgMS41MDMgMS41MDNoMy43MjFjLjgzIDAgMS41MDItLjY3MiAxLjUwMi0xLjUwMnYtMy43MmMwLS44My0uNjcyLTEuNTA0LTEuNTAyLTEuNTA0WiIgZmlsbD0iI0YyRjJGMiI+PC9wYXRoPjwvZz48ZGVmcz4KPC9kZWZzPgo8L3N2Zz4=';

    // ── Colors (matching rack3d.js COLORS) ──
    var C = {
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

    // ── Draw a single rack frame (returns SVG group string) ──
    function drawRackFrame(ox, oy, rackLabel) {
        var innerH = TOTAL_U * U_H;
        var outerW = RACK_W + POST_W * 2;
        var outerH = innerH + 12; // top/bottom lip
        var parts = [];

        // Outer frame
        parts.push('<rect x="' + ox + '" y="' + oy + '" width="' + outerW + '" height="' + outerH + '" rx="3" fill="' + C.RACK_FRAME + '" stroke="#555" stroke-width="0.5"/>');

        // Inner area (empty slots background)
        parts.push('<rect x="' + (ox + POST_W) + '" y="' + (oy + 6) + '" width="' + RACK_W + '" height="' + innerH + '" fill="' + C.EMPTY_SLOT + '"/>');

        // Rail posts (left & right)
        parts.push('<rect x="' + ox + '" y="' + oy + '" width="' + POST_W + '" height="' + outerH + '" rx="1" fill="' + C.RACK_RAIL + '"/>');
        parts.push('<rect x="' + (ox + POST_W + RACK_W) + '" y="' + oy + '" width="' + POST_W + '" height="' + outerH + '" rx="1" fill="' + C.RACK_RAIL + '"/>');

        // U markers on left rail (every 5U)
        for (var u = 5; u <= TOTAL_U; u += 5) {
            var markerY = oy + 6 + innerH - u * U_H + U_H / 2;
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
        var innerH = TOTAL_U * U_H;
        var deviceW = RACK_W - 4;          // small inset from inner area
        var deviceH = heightU * U_H - 2;   // small gap between devices
        var dx = ox + POST_W + 2;
        // uStart=1 is bottom of rack; higher U is higher physically
        var dy = oy + 6 + innerH - uStart * U_H - (heightU - 1) * U_H + 1;

        var parts = [];
        parts.push('<rect x="' + dx + '" y="' + dy + '" width="' + deviceW + '" height="' + deviceH + '" rx="2" fill="' + color + '"/>');

        // Front panel inset (dark face)
        var panelInset = 3;
        var panelOpacity = '0.3';
        parts.push('<rect x="' + (dx + panelInset) + '" y="' + (dy + 1) + '" width="' + (deviceW - panelInset * 2) + '" height="' + (deviceH - 2) + '" rx="1" fill="#0d0d0d" opacity="' + panelOpacity + '"/>');

        // Label
        if (label) {
            var lc = labelColor || C.LABEL_LIGHT;
            var ly = dy + deviceH / 2 + LABEL_FONT * 0.35;
            parts.push('<text x="' + (dx + deviceW / 2) + '" y="' + ly + '" text-anchor="middle" font-size="' + LABEL_FONT + '" font-weight="500" fill="' + lc + '" font-family="Segoe UI, sans-serif">' + esc(label) + '</text>');
        }

        return parts.join('\n');
    }

    // ── Draw a server node (2U) with optional GPU accent ──
    function drawServer(ox, oy, uStart, label, isGpu) {
        var parts = [];
        var color = isGpu ? C.SERVER_GPU : C.SERVER;
        parts.push(drawDevice(ox, oy, uStart, 2, color, label, C.LABEL_LIGHT));

        // GPU accent stripe
        if (isGpu) {
            var innerH = TOTAL_U * U_H;
            var deviceW = RACK_W - 4;
            var dx = ox + POST_W + 2;
            var dy = oy + 6 + innerH - uStart * U_H - U_H + 1;
            var stripeH = 3;
            parts.push('<rect x="' + (dx + 4) + '" y="' + (dy + U_H * 2 - stripeH - 3) + '" width="' + (deviceW - 8) + '" height="' + stripeH + '" rx="1" fill="' + C.GPU_ACCENT + '" opacity="0.8"/>');
        }

        // Drive bays (left side)
        var innerH2 = TOTAL_U * U_H;
        var dx2 = ox + POST_W + 2;
        var dy2 = oy + 6 + innerH2 - uStart * U_H - U_H + 1;
        var deviceH2 = 2 * U_H - 2;
        var bayW = 8, bayH = deviceH2 * 0.4;
        var bayY = dy2 + deviceH2 / 2 - bayH / 2;
        for (var b = 0; b < 6; b++) {
            parts.push('<rect x="' + (dx2 + 8 + b * (bayW + 2)) + '" y="' + bayY + '" width="' + bayW + '" height="' + bayH + '" rx="1" fill="#333" opacity="0.4"/>');
        }

        // Status LEDs (right side, vertically centered)
        var ledX = dx2 + (RACK_W - 4) - 12;
        var ledY = dy2 + deviceH2 / 2;
        parts.push('<circle cx="' + ledX + '" cy="' + ledY + '" r="2" fill="#00ff66" opacity="0.7"/>');
        parts.push('<circle cx="' + (ledX + 6) + '" cy="' + ledY + '" r="2" fill="#3399ff" opacity="0.7"/>');

        return parts.join('\n');
    }

    // ── Draw a 1U switch (ToR or BMC) ──
    function drawSwitch(ox, oy, uStart, label, color, labelColor, isLight) {
        var parts = [];
        parts.push(drawDevice(ox, oy, uStart, 1, color, label, labelColor || C.LABEL_LIGHT, isLight));

        // Status LEDs
        var innerH = TOTAL_U * U_H;
        var dx = ox + POST_W + 2;
        var deviceW = RACK_W - 4;
        var dy = oy + 6 + innerH - uStart * U_H + 1;
        var deviceH = U_H - 2;
        var ledX = dx + deviceW - 16;
        var ledY = dy + deviceH / 2;
        for (var i = 0; i < 3; i++) {
            parts.push('<circle cx="' + (ledX + i * 5) + '" cy="' + ledY + '" r="1.5" fill="#00ff66" opacity="0.6"/>');
        }

        return parts.join('\n');
    }

    // ── Main generator ──
    // config: { clusterType, nodeCount, hasGpu }
    // Returns an SVG string.
    function generateRackSvg(config) {
        var clusterType = config.clusterType || 'standard';
        var isRackAware = clusterType === 'rack-aware';
        var rackCount = isRackAware ? 2 : 1;
        var nodeCount = config.nodeCount || 2;
        var hasGpu = config.hasGpu || false;
        var torPerRack = nodeCount > 1 ? 2 : 1;  // 2 ToRs for multi-node, 1 ToR for single
        var bmcPerRack = 1;

        // Distribute nodes across racks (same logic as rack3d.js)
        var racks = [];
        if (isRackAware) {
            var half = Math.ceil(nodeCount / 2);
            racks.push({ nodes: half, tor: torPerRack });
            racks.push({ nodes: nodeCount - half, tor: torPerRack });
        } else {
            racks.push({ nodes: nodeCount, tor: torPerRack });
        }

        // Calculate SVG dimensions
        var outerRackW = RACK_W + POST_W * 2;
        var innerH = TOTAL_U * U_H;
        var outerRackH = innerH + 12;
        var totalWidth = rackCount * outerRackW + (rackCount - 1) * RACK_GAP;
        var legendH = 50;
        var titleH = 30;
        var coreH = 36;           // Height for core switch box above racks
        var coreGap = 26;         // Gap between core switch and rack tops (room for rack labels)
        var bottomPad = 24;
        var svgW = totalWidth + 40;   // 20px padding each side
        var svgH = titleH + coreH + coreGap + outerRackH + bottomPad + legendH + 10;

        var parts = [];
        parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" width="' + svgW + '" height="' + svgH + '" style="font-family: \'Segoe UI\', sans-serif;">');

        // Background
        parts.push('<rect width="' + svgW + '" height="' + svgH + '" fill="' + C.BACKGROUND + '" rx="6"/>');

        // Title
        parts.push('<text x="' + (svgW / 2) + '" y="20" text-anchor="middle" font-size="13" font-weight="600" fill="#ccc" font-family="Segoe UI, sans-serif">Rack Layout — Front View</text>');
        // Brand: instance icon + "Azure Local" text (top-right)
        var brandX = svgW - 20;
        var brandY = 8;
        var iconSize = 20;
        parts.push('<image href="' + ICON_DATA_URI + '" x="' + (brandX - iconSize - 72) + '" y="' + brandY + '" width="' + iconSize + '" height="' + iconSize + '" opacity="0.85"/>');
        parts.push('<text x="' + (brandX - 68) + '" y="' + (brandY + 15) + '" font-size="12" font-weight="600" fill="#B596F5" font-family="Segoe UI, sans-serif">Azure Local</text>');
        // Core Switch / Router / Firewall above racks
        var coreW = Math.min(totalWidth, outerRackW * 1.2);
        var coreX = (svgW - coreW) / 2;
        var coreY = titleH;
        parts.push('<rect x="' + coreX + '" y="' + coreY + '" width="' + coreW + '" height="' + coreH + '" rx="4" fill="#1a6fc4" stroke="#2a8ad4" stroke-width="0.5"/>');
        parts.push('<rect x="' + (coreX + 3) + '" y="' + (coreY + 2) + '" width="' + (coreW - 6) + '" height="' + (coreH - 4) + '" rx="2" fill="#0d0d0d" opacity="0.4"/>');
        parts.push('<text x="' + (coreX + coreW / 2) + '" y="' + (coreY + coreH / 2 + 4) + '" text-anchor="middle" font-size="10" font-weight="500" fill="#ffffff" font-family="Segoe UI, sans-serif">Core Switch / Router / Firewall</text>');
        // LEDs on core switch
        for (var ci = 0; ci < 3; ci++) {
            parts.push('<circle cx="' + (coreX + coreW - 14 + ci * 6) + '" cy="' + (coreY + 8) + '" r="2" fill="#00ff66" opacity="0.7"/>');
        }

        // Rack top origin (below core switch)
        var rackTopY = titleH + coreH + coreGap;

        // Connecting lines from core switch down to each rack
        var coreBottomY = coreY + coreH;
        for (var cl = 0; cl < rackCount; cl++) {
            var clOx = 20 + cl * (outerRackW + RACK_GAP);
            var rackCenterX = clOx + outerRackW / 2;
            parts.push('<line x1="' + rackCenterX + '" y1="' + coreBottomY + '" x2="' + rackCenterX + '" y2="' + rackTopY + '" stroke="#2a8ad4" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.5"/>');
        }

        // Draw racks — Rack 1 on left
        for (var r = 0; r < rackCount; r++) {
            var rackIndex = r;  // Rack 1 = index 0 = left
            var ox = 20 + r * (outerRackW + RACK_GAP);
            var oy = rackTopY;
            var rackInfo = racks[rackIndex];

            var rackLabel = isRackAware ? 'Rack ' + (rackIndex + 1) : 'Rack';
            parts.push(drawRackFrame(ox, oy, rackLabel));

            // Place ToR switches at top (U42, U41)
            for (var t = 0; t < rackInfo.tor; t++) {
                var torU = TOTAL_U - t; // 42, 41
                var torNum = isRackAware ? (rackIndex * 2 + t + 1) : (t + 1);
                var torLabel = 'ToR ' + torNum;
                parts.push(drawSwitch(ox, oy, torU, torLabel, C.TOR_SWITCH, C.LABEL_LIGHT));
            }

            // Place BMC switch below ToRs (1U) — only when ToRs are present
            if (bmcPerRack > 0) {
                var bmcU = TOTAL_U - rackInfo.tor;
                var bmcNum = isRackAware ? (rackIndex + 1) : 1;
                parts.push(drawSwitch(ox, oy, bmcU, 'BMC ' + bmcNum, C.BMC_SWITCH, C.LABEL_LIGHT));
            }

            // Place server nodes below BMC, from top down (2U each)
            var topServerU = TOTAL_U - rackInfo.tor - bmcPerRack;
            var nodeOffset = 0;
            for (var pr = 0; pr < rackIndex; pr++) { nodeOffset += racks[pr].nodes; }
            for (var n = 0; n < rackInfo.nodes; n++) {
                var serverStartU = topServerU - (n * 2) - 1;
                if (serverStartU < 1) break;
                var nodeLabel = 'Node ' + (nodeOffset + n + 1);
                parts.push(drawServer(ox, oy, serverStartU, nodeLabel, hasGpu));
            }
        }

        // Legend
        var legendY = rackTopY + outerRackH + bottomPad;
        var legendItems = [
            { color: C.SERVER, label: 'Server Node' },
            { color: C.TOR_SWITCH, label: 'ToR Switch' },
            { color: C.BMC_SWITCH, label: 'BMC Switch' },
            { color: '#1a6fc4', label: 'Core Switch' }
        ];
        if (hasGpu) {
            legendItems.splice(1, 0, { color: C.GPU_ACCENT, label: 'GPU Accent' });
        }

        var legendTotalW = 0;
        var swatchW = 14;
        var swatchH = 10;
        var itemGap = 20;
        var textWidthEstimate = function (s) { return s.length * 6.2; };
        for (var li = 0; li < legendItems.length; li++) {
            legendTotalW += swatchW + 4 + textWidthEstimate(legendItems[li].label);
            if (li < legendItems.length - 1) legendTotalW += itemGap;
        }

        var legendX = (svgW - legendTotalW) / 2;
        for (var lj = 0; lj < legendItems.length; lj++) {
            var item = legendItems[lj];
            parts.push('<rect x="' + legendX + '" y="' + (legendY - swatchH / 2) + '" width="' + swatchW + '" height="' + swatchH + '" rx="2" fill="' + item.color + '" stroke="#555" stroke-width="0.5"/>');
            legendX += swatchW + 4;
            parts.push('<text x="' + legendX + '" y="' + (legendY + LEGEND_FONT * 0.35) + '" font-size="' + LEGEND_FONT + '" fill="#aaa" font-family="Segoe UI, sans-serif">' + esc(item.label) + '</text>');
            legendX += textWidthEstimate(item.label) + itemGap;
        }

        // U count summary
        var nodesU = nodeCount * 2;
        var switchesU = torPerRack * rackCount;
        var bmcSwitchesU = bmcPerRack * rackCount;
        var usedU = nodesU + switchesU + bmcSwitchesU;
        var totalU = TOTAL_U * rackCount;
        parts.push('<text x="' + (svgW / 2) + '" y="' + (legendY + 18) + '" text-anchor="middle" font-size="9" fill="#888" font-family="Segoe UI, sans-serif">' + usedU + 'U used / ' + totalU + 'U total</text>');

        parts.push('</svg>');
        return parts.join('\n');
    }

    // ── Disaggregated Rack SVG Generator ──
    // config: { storageType, backupEnabled, rackCount, nodesPerRack, spineCount, rackAsns }
    function generateDisaggregatedRackSvg(config) {
        var storageType = config.storageType || 'fc_san';
        var backupEnabled = config.backupEnabled || false;
        var rackCount = config.rackCount || 4;
        var nodesPerRack = config.nodesPerRack || 16;
        var spineCount = config.spineCount || 2;
        var baseAsn = 64789;
        var spineAsn = 64841;
        var serviceLeafAsn = 65005;

        // Colors for disaggregated-specific components
        var DC = {
            LEAF_SWITCH: '#444444',
            BMC_SWITCH:  '#3b82f6',
            FC_SWITCH:   '#7c3aed',
            SAN_ARRAY:   '#6d28d9',
            ISCSI_ARRAY: '#ea580c',
            SPINE:       '#1a6fc4',
            SERVICE_LEAF:'#0d9488'
        };

        var hasFC = storageType === 'fc_san';
        var hasIscsi = storageType === 'iscsi_4nic' || storageType === 'iscsi_6nic';
        var fcDevices = hasFC ? 2 : 0;  // FC Switch A + B per rack

        var outerRackW = RACK_W + POST_W * 2;
        var innerH = TOTAL_U * U_H;
        var outerRackH = innerH + 12;
        var rackGap = rackCount > 4 ? 20 : 30;
        var totalRackWidth = rackCount * outerRackW + (rackCount - 1) * rackGap;

        // Layout heights
        var titleH = 30;
        var spineH = 70;    // Spine + service leaf area
        var rackLabelH = 18;
        var sanH = hasFC ? 50 : (hasIscsi ? 50 : 0);
        var legendH = 50;
        var padX = 20;
        var svgW = totalRackWidth + padX * 2;
        var svgH = titleH + spineH + rackLabelH + outerRackH + sanH + legendH + 40;

        var parts = [];
        parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" width="' + svgW + '" font-family="Segoe UI, sans-serif">');
        parts.push('<rect width="' + svgW + '" height="' + svgH + '" fill="' + C.BACKGROUND + '"/>');

        // Title
        var storageLabel = storageType === 'fc_san' ? 'FC SAN' : (storageType === 'iscsi_4nic' ? 'iSCSI 4-NIC' : 'iSCSI 6-NIC');
        parts.push('<text x="' + (svgW / 2) + '" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="#ccc">Rack Layout — Front View (Disaggregated, ' + esc(storageLabel) + ')</text>');

        // Azure Local brand: icon + text (top-right)
        var brandX = svgW - padX;
        var brandY = 4;
        var iconSize = 16;
        parts.push('<image href="' + ICON_DATA_URI + '" x="' + (brandX - iconSize - 62) + '" y="' + brandY + '" width="' + iconSize + '" height="' + iconSize + '" opacity="0.85"/>');
        parts.push('<text x="' + (brandX - 58) + '" y="' + (brandY + 13) + '" font-size="10" font-weight="600" fill="#B596F5" font-family="Segoe UI, sans-serif">Azure Local</text>');

        // ── Service Leaf + Spine layer ──
        var slBoxW = 120;
        var slBoxH = 20;
        var slY = titleH + 8;
        var slStartX = (svgW - 2 * slBoxW - 20) / 2;
        var slLabels = ['Service Leaf A', 'Service Leaf B'];
        for (var sl = 0; sl < 2; sl++) {
            var slx = slStartX + sl * (slBoxW + 20);
            parts.push('<rect x="' + slx + '" y="' + slY + '" width="' + slBoxW + '" height="' + slBoxH + '" rx="3" fill="' + DC.SERVICE_LEAF + '"/>');
            parts.push('<text x="' + (slx + slBoxW / 2) + '" y="' + (slY + 11) + '" text-anchor="middle" font-size="8" font-weight="600" fill="#fff">' + slLabels[sl] + '</text>');
            parts.push('<text x="' + (slx + slBoxW / 2) + '" y="' + (slY + slBoxH - 2) + '" text-anchor="middle" font-size="6" fill="rgba(255,255,255,0.6)">ASN ' + serviceLeafAsn + '</text>');
        }

        // Spine pair
        var spineBoxW = 160;
        var spineBoxH = 22;
        var spineY = slY + slBoxH + 8;
        var spineGap = 20;
        var totalSpineW = spineCount * spineBoxW + (spineCount - 1) * spineGap;
        var spineStartX = (svgW - totalSpineW) / 2;

        for (var s = 0; s < spineCount; s++) {
            var sx = spineStartX + s * (spineBoxW + spineGap);
            parts.push('<rect x="' + sx + '" y="' + spineY + '" width="' + spineBoxW + '" height="' + spineBoxH + '" rx="4" fill="' + DC.SPINE + '"/>');
            parts.push('<text x="' + (sx + spineBoxW / 2) + '" y="' + (spineY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">Spine ' + (s + 1) + '</text>');
            parts.push('<text x="' + (sx + spineBoxW / 2) + '" y="' + (spineY + spineBoxH - 2) + '" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.6)">ASN ' + spineAsn + '</text>');
        }

        // ── Racks ──
        var racksY = titleH + spineH + rackLabelH;
        for (var r = 0; r < rackCount; r++) {
            var rackAsn = baseAsn + r;
            var rx = padX + r * (outerRackW + rackGap);

            // Rack label
            parts.push('<text x="' + (rx + outerRackW / 2) + '" y="' + (racksY - 4) + '" text-anchor="middle" font-size="' + (LABEL_FONT + 1) + '" font-weight="600" fill="#ccc">Rack ' + (r + 1) + ' (ASN ' + rackAsn + ')</text>');

            // Rack frame
            parts.push(drawRackFrame(rx, racksY, null));

            // U positions: Leaf A=U42, Leaf B=U41, BMC=U40, Servers start U39 going down (2U each)
            // FC switches (if any) at bottom: U2, U1
            parts.push(drawDevice(rx, racksY, 42, 1, DC.LEAF_SWITCH, 'Leaf ' + (r + 1) + 'A', C.LABEL_LIGHT));
            parts.push(drawDevice(rx, racksY, 41, 1, DC.LEAF_SWITCH, 'Leaf ' + (r + 1) + 'B', C.LABEL_LIGHT));

            // LEDs for leaves
            var leafDy42 = racksY + 6 + innerH - 42 * U_H + 1;
            var leafDy41 = racksY + 6 + innerH - 41 * U_H + 1;
            var ledBaseX = rx + POST_W + 2 + RACK_W - 4 - 16;
            for (var led = 0; led < 3; led++) {
                parts.push('<circle cx="' + (ledBaseX + led * 5) + '" cy="' + (leafDy42 + (U_H - 2) / 2) + '" r="1.5" fill="#00ff66" opacity="0.6"/>');
                parts.push('<circle cx="' + (ledBaseX + led * 5) + '" cy="' + (leafDy41 + (U_H - 2) / 2) + '" r="1.5" fill="#00ff66" opacity="0.6"/>');
            }

            // BMC switch at U40
            parts.push(drawDevice(rx, racksY, 40, 1, DC.BMC_SWITCH, 'BMC Switch ' + (r + 1), C.LABEL_LIGHT, false));
            var bmcDy = racksY + 6 + innerH - 40 * U_H + 1;
            for (var bled = 0; bled < 2; bled++) {
                parts.push('<circle cx="' + (ledBaseX + bled * 6) + '" cy="' + (bmcDy + (U_H - 2) / 2) + '" r="2" fill="#00ff66" opacity="0.7"/>');
            }

            // Server nodes starting from U38, going down (2U each)
            // Note: drawDevice for 2U extends upward by 1U, so U38 occupies U38-U39 visually
            var nodeStart = r * nodesPerRack + 1;
            for (var n = 0; n < nodesPerRack; n++) {
                var uPos = 38 - n * 2;
                if (uPos < 3) break;  // Don't overlap with FC switches
                var nodeLabel = 'Node ' + (nodeStart + n);
                parts.push(drawDevice(rx, racksY, uPos, 2, C.SERVER, nodeLabel, C.LABEL_LIGHT));

                // Drive bays (left side of node)
                var dx = rx + POST_W + 2;
                var dy = racksY + 6 + innerH - uPos * U_H - U_H + 1;
                var devH = 2 * U_H - 2;
                var devW = RACK_W - 4;
                var bayW = 8, bayH = devH * 0.4;
                var bayY = dy + devH / 2 - bayH / 2;
                for (var b = 0; b < 6; b++) {
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
                var fcDy2 = racksY + 6 + innerH - 2 * U_H + 1;
                var fcDy1 = racksY + 6 + innerH - 1 * U_H + 1;
                for (var fled = 0; fled < 3; fled++) {
                    parts.push('<circle cx="' + (ledBaseX + fled * 5) + '" cy="' + (fcDy2 + (U_H - 2) / 2) + '" r="1.5" fill="#00ff66" opacity="0.6"/>');
                    parts.push('<circle cx="' + (ledBaseX + fled * 5) + '" cy="' + (fcDy1 + (U_H - 2) / 2) + '" r="1.5" fill="#00ff66" opacity="0.6"/>');
                }
            }

            // Spine → Leaf connector lines
            for (var sp = 0; sp < spineCount; sp++) {
                var spCenterX = spineStartX + sp * (spineBoxW + spineGap) + spineBoxW / 2;
                var leafACenterY = racksY + 6 + innerH - 42 * U_H + U_H / 2;
                var leafCenterX = rx + outerRackW / 2;
                parts.push('<line x1="' + spCenterX + '" y1="' + (spineY + spineBoxH) + '" x2="' + leafCenterX + '" y2="' + leafACenterY + '" stroke="#7dd3fc" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.25"/>');
            }
        }

        // ── SAN layer ──
        var sanY = racksY + outerRackH + 12;
        if (hasFC) {
            var sanBoxW = (totalRackWidth - 20) / 2;
            var sanBoxH = 30;
            var sanX1 = padX;
            var sanX2 = padX + sanBoxW + 20;
            parts.push('<rect x="' + sanX1 + '" y="' + sanY + '" width="' + sanBoxW + '" height="' + sanBoxH + '" rx="4" fill="' + DC.SAN_ARRAY + '"/>');
            parts.push('<text x="' + (sanX1 + sanBoxW / 2) + '" y="' + (sanY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">SAN Storage Array — Fabric A</text>');
            parts.push('<text x="' + (sanX1 + sanBoxW / 2) + '" y="' + (sanY + 24) + '" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">FC 32G / Connected to FC Switch A in each rack</text>');
            parts.push('<rect x="' + sanX2 + '" y="' + sanY + '" width="' + sanBoxW + '" height="' + sanBoxH + '" rx="4" fill="' + DC.SAN_ARRAY + '"/>');
            parts.push('<text x="' + (sanX2 + sanBoxW / 2) + '" y="' + (sanY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">SAN Storage Array — Fabric B</text>');
            parts.push('<text x="' + (sanX2 + sanBoxW / 2) + '" y="' + (sanY + 24) + '" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">FC 32G / Connected to FC Switch B in each rack</text>');

            // FC → SAN connector lines
            for (var fr = 0; fr < rackCount; fr++) {
                var frx = padX + fr * (outerRackW + rackGap) + outerRackW / 2;
                var fcBottomY = racksY + outerRackH;
                parts.push('<line x1="' + frx + '" y1="' + fcBottomY + '" x2="' + (sanX1 + sanBoxW / 2) + '" y2="' + sanY + '" stroke="#c4b5fd" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.25"/>');
                parts.push('<line x1="' + frx + '" y1="' + fcBottomY + '" x2="' + (sanX2 + sanBoxW / 2) + '" y2="' + sanY + '" stroke="#c4b5fd" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.25"/>');
            }
        } else if (hasIscsi) {
            var iscsiBoxW = (totalRackWidth - 20) / 2;
            var iscsiBoxH = 30;
            var iscsiX1 = padX;
            var iscsiX2 = padX + iscsiBoxW + 20;
            var portLabel = storageType === 'iscsi_6nic' ? 'Ports 33-48, VLAN 500' : 'Ports 17-32 (shared)';
            var port2Label = storageType === 'iscsi_6nic' ? 'Ports 33-48, VLAN 600' : 'Ports 17-32 (shared)';
            parts.push('<rect x="' + iscsiX1 + '" y="' + sanY + '" width="' + iscsiBoxW + '" height="' + iscsiBoxH + '" rx="4" fill="' + DC.ISCSI_ARRAY + '"/>');
            parts.push('<text x="' + (iscsiX1 + iscsiBoxW / 2) + '" y="' + (sanY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">iSCSI Storage Array — Target A</text>');
            parts.push('<text x="' + (iscsiX1 + iscsiBoxW / 2) + '" y="' + (sanY + 24) + '" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">' + esc(portLabel) + '</text>');
            parts.push('<rect x="' + iscsiX2 + '" y="' + sanY + '" width="' + iscsiBoxW + '" height="' + iscsiBoxH + '" rx="4" fill="' + DC.ISCSI_ARRAY + '"/>');
            parts.push('<text x="' + (iscsiX2 + iscsiBoxW / 2) + '" y="' + (sanY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">iSCSI Storage Array — Target B</text>');
            parts.push('<text x="' + (iscsiX2 + iscsiBoxW / 2) + '" y="' + (sanY + 24) + '" text-anchor="middle" font-size="7" fill="rgba(255,255,255,0.5)">' + esc(port2Label) + '</text>');

            for (var ir = 0; ir < rackCount; ir++) {
                var irx = padX + ir * (outerRackW + rackGap) + outerRackW / 2;
                var iscsiTopY = racksY + outerRackH;
                parts.push('<line x1="' + irx + '" y1="' + iscsiTopY + '" x2="' + (iscsiX1 + iscsiBoxW / 2) + '" y2="' + sanY + '" stroke="#fdba74" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.25"/>');
                parts.push('<line x1="' + irx + '" y1="' + iscsiTopY + '" x2="' + (iscsiX2 + iscsiBoxW / 2) + '" y2="' + sanY + '" stroke="#fdba74" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.25"/>');
            }
        }

        // ── Legend ──
        var legendY = svgH - legendH;
        var legendItems = [
            { color: C.SERVER, label: 'Server Node' },
            { color: DC.LEAF_SWITCH, label: 'Leaf Switch' },
            { color: DC.BMC_SWITCH, label: 'BMC Switch' }
        ];
        if (hasFC) legendItems.push({ color: DC.FC_SWITCH, label: 'FC Switch' });
        if (hasIscsi) legendItems.push({ color: DC.ISCSI_ARRAY, label: 'iSCSI Storage' });
        legendItems.push({ color: DC.SPINE, label: 'Spine Switch' });
        legendItems.push({ color: DC.SERVICE_LEAF, label: 'Service Leaf' });
        if (hasFC) legendItems.push({ color: DC.SAN_ARRAY, label: 'SAN Storage' });

        var lgW = 14, lgH = 10, lgGap = 14;
        var totalLegendW = 0;
        legendItems.forEach(function (li) { totalLegendW += lgW + 4 + li.label.length * 5.5 + lgGap; });
        var lgX = (svgW - totalLegendW) / 2;

        legendItems.forEach(function (li) {
            parts.push('<rect x="' + lgX + '" y="' + (legendY + 4) + '" width="' + lgW + '" height="' + lgH + '" rx="2" fill="' + li.color + '"/>');
            var tc = li.textColor || '#aaa';
            parts.push('<text x="' + (lgX + lgW + 4) + '" y="' + (legendY + 12) + '" font-size="' + LEGEND_FONT + '" fill="' + tc + '">' + esc(li.label) + '</text>');
            lgX += lgW + 4 + li.label.length * 5.5 + lgGap;
        });

        // Summary line
        var totalNodes = rackCount * nodesPerRack;
        var usedU = rackCount * (3 + nodesPerRack * 2 + fcDevices);
        var totalU = rackCount * TOTAL_U;
        var backupStr = backupEnabled ? ' | Backup' : '';
        parts.push('<text x="' + (svgW / 2) + '" y="' + (legendY + 30) + '" text-anchor="middle" font-size="9" fill="#888">' + usedU + 'U used / ' + totalU + 'U total | ' + totalNodes + ' nodes | ' + rackCount + ' racks | ' + spineCount + ' spines | ' + esc(storageLabel) + backupStr + '</text>');

        parts.push('</svg>');
        return parts.join('\n');
    }

    // Expose globally
    window.generateRackSvg = generateRackSvg;
    window.generateDisaggregatedRackSvg = generateDisaggregatedRackSvg;
})();
