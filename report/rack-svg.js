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

    // ── Colors (matching rack3d.js COLORS) ──
    var C = {
        RACK_FRAME:  '#2a2a2a',
        RACK_RAIL:   '#3a3a3a',
        EMPTY_SLOT:  '#1a1a1a',
        SERVER:      '#aaaaaa',
        SERVER_GPU:  '#d97706',
        TOR_SWITCH:  '#444444',
        BMC_SWITCH:  '#e0e0e0',
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

        // Front panel inset (dark face) — lighter overlay for light-colored devices
        var panelInset = 3;
        var panelOpacity = isLight ? '0.15' : '0.5';
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
        var color = isGpu ? C.SERVER : C.SERVER;
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

        // Drive bays (small rectangles on left side)
        var innerH2 = TOTAL_U * U_H;
        var dx2 = ox + POST_W + 2;
        var dy2 = oy + 6 + innerH2 - uStart * U_H - U_H + 1;
        var deviceH2 = 2 * U_H - 2;
        var bayW = 8;
        var bayH = deviceH2 * 0.4;
        var bayY = dy2 + deviceH2 / 2 - bayH / 2;
        var numBays = 6;
        var bayStartX = dx2 + 8;
        for (var b = 0; b < numBays; b++) {
            parts.push('<rect x="' + (bayStartX + b * (bayW + 2)) + '" y="' + bayY + '" width="' + bayW + '" height="' + bayH + '" rx="1" fill="#333" opacity="0.4"/>');
        }

        // Status LEDs (right side, small circles)
        var ledX = dx2 + (RACK_W - 4) - 16;
        var ledY = dy2 + 5;
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
        parts.push('<image href="../images/azurelocal-instance.svg" x="' + (brandX - iconSize - 72) + '" y="' + brandY + '" width="' + iconSize + '" height="' + iconSize + '" opacity="0.85"/>');
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
                parts.push(drawSwitch(ox, oy, bmcU, 'BMC ' + bmcNum, C.BMC_SWITCH, C.LABEL_DARK, true));
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
            { color: C.BMC_SWITCH, label: 'BMC Switch', textColor: C.LABEL_DARK },
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

    // Expose globally
    window.generateRackSvg = generateRackSvg;
})();
