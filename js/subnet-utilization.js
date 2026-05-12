/* =====================================================================
   Infrastructure Subnet Utilisation — shared SVG builder
   ---------------------------------------------------------------------
   Renders the horizontal "subnet usage" bar that visualises the
   Infrastructure Network CIDR with overlays for:
     - Default Gateway
     - Infrastructure IP Pool (Cluster IP, ARB VMs, etc.)
     - Node IPs (grouped into contiguous runs)
     - Unused address space

   Used by:
     - Wizard Step 15 (live preview as the user types)
     - Configuration Report (HTML — Infrastructure Network section)
     - PPT export (slide footer diagram, via a thin wrapper)

   Exposes:
     window.OdinSubnetUtil.buildInfraSubnetBarSvg(state, options?)
       state   — same object shape as window.__odinGetReportState()
                 (s.infraCidr, s.infraGateway, s.infra.{start,end},
                  s.nodeSettings[i].ipCidr)
       options — optional layout overrides (width, height, background,
                 textColor, mutedColor, font, etc.)
       returns — SVG string, or null if state is incomplete/invalid.
   ===================================================================== */

(function () {
    'use strict';

    function ipToInt(ip) {
        var parts = String(ip || '').split('.').map(Number);
        if (parts.length !== 4) return null;
        for (var i = 0; i < 4; i++) {
            if (isNaN(parts[i]) || parts[i] < 0 || parts[i] > 255) return null;
        }
        return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    }

    function intToIp(v) {
        return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff].join('.');
    }

    function escXml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function buildInfraSubnetBarSvg(state, options) {
        if (!state) return null;
        var opts = options || {};

        var cidr = String(state.infraCidr || '').trim();
        var m = cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
        if (!m) return null;
        var prefix = parseInt(m[2], 10);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;
        var baseInt = ipToInt(m[1]);
        if (baseInt === null) return null;
        var hostBits = 32 - prefix;
        var size = Math.pow(2, hostBits);
        baseInt = baseInt - (baseInt % size);

        // Collect used ranges as { start, end (inclusive), kind }.
        var used = [];
        var gwInt = ipToInt(state.infraGateway);
        if (gwInt !== null && gwInt >= baseInt && gwInt < baseInt + size) {
            used.push({ start: gwInt, end: gwInt, kind: 'gw' });
        } else {
            gwInt = null;
        }

        var poolEntry = null;
        if (state.infra && state.infra.start && state.infra.end) {
            var ps = ipToInt(state.infra.start);
            var pe = ipToInt(state.infra.end);
            if (ps !== null && pe !== null && pe >= ps) {
                poolEntry = { start: ps, end: pe, kind: 'pool' };
                used.push(poolEntry);
            }
        }

        var nodeCount = 0;
        if (Array.isArray(state.nodeSettings)) {
            // Group contiguous node IPs into runs for cleaner bar segments.
            var ips = state.nodeSettings.map(function (n) {
                if (!n || !n.ipCidr) return null;
                return ipToInt(String(n.ipCidr).split('/')[0]);
            }).filter(function (v) {
                // Only include node IPs that fall inside the CIDR being drawn.
                return v !== null && v >= baseInt && v < baseInt + size;
            }).sort(function (a, b) { return a - b; });

            if (ips.length) {
                var run = { start: ips[0], end: ips[0] };
                for (var i = 1; i < ips.length; i++) {
                    if (ips[i] === run.end + 1) {
                        run.end = ips[i];
                    } else {
                        used.push({ start: run.start, end: run.end, kind: 'node' });
                        run = { start: ips[i], end: ips[i] };
                    }
                }
                used.push({ start: run.start, end: run.end, kind: 'node' });
                nodeCount = ips.length;
            }
        }

        // Layout (defaults sized for in-page rendering; PPT passes its own).
        var W = opts.width || 1600;
        var H = opts.height || 320;
        var pad = opts.pad || 30;
        var barY = opts.barY || 90;
        var barH = opts.barH || 70;
        var barX = pad;
        var barW = W - pad * 2;

        var COLOR = {
            unused: opts.unusedColor || '#1f2937',
            border: opts.borderColor || '#475569',
            gw:     opts.gwColor     || '#fbbf24',
            pool:   opts.poolColor   || '#3b82f6',
            node:   opts.nodeColor   || '#10b981'
        };
        var BG = opts.background || '#0b1220';
        var TEXT = opts.textColor || '#e5e7eb';
        var MUTED = opts.mutedColor || '#94a3b8';
        var FONT_FAMILY = opts.fontFamily || 'Segoe UI, Arial, sans-serif';
        var TITLE_SIZE = opts.titleFontSize || 26;
        var SUBTITLE_SIZE = opts.subtitleFontSize || 20;
        var AXIS_SIZE = opts.axisFontSize || 18;
        var LEGEND_SIZE = opts.legendFontSize || 20;

        function pxFor(intVal) {
            var rel = intVal - baseInt;
            return barX + Math.round((rel / size) * barW);
        }

        var poolCount = poolEntry ? (poolEntry.end - poolEntry.start + 1) : 0;
        var totalUsable = size > 2 ? size - 2 : size; // exclude network + broadcast
        var totalUsed = nodeCount + poolCount + (gwInt !== null ? 1 : 0);

        var endIp = baseInt + size - 1;

        // Build segment rects. Order: pool first (wide), then nodes, then gw
        // so single-pixel slivers stay visible on top.
        var segs = '';
        used.sort(function (a, b) {
            var rank = { pool: 0, node: 1, gw: 2 };
            return rank[a.kind] - rank[b.kind];
        }).forEach(function (u) {
            var x1 = pxFor(u.start);
            var x2 = pxFor(u.end + 1);
            var w = Math.max(2, x2 - x1);
            segs += '<rect x="' + x1 + '" y="' + barY + '" width="' + w + '" height="' + barH + '" fill="' + COLOR[u.kind] + '"/>';
        });

        var title = 'Infrastructure Subnet Utilisation — ' + cidr + '  (' + size + ' addresses)';
        var subtitle = 'Used: ' + totalUsed + ' / ' + totalUsable + ' usable  ·  '
            + 'Gateway: ' + (gwInt !== null ? intToIp(gwInt) : '—') + '  ·  '
            + 'Pool: ' + (poolEntry ? intToIp(poolEntry.start) + '–' + intToIp(poolEntry.end) + ' (' + poolCount + ')' : '—') + '  ·  '
            + 'Nodes: ' + nodeCount;

        // Legend — flow as a single row, centred, with proportional spacing
        // so it scales cleanly with the chosen width.
        var legendY = barY + barH + 60;
        var legendItems = [
            { color: COLOR.gw,     label: 'Default Gateway (' + (gwInt !== null ? '1' : '0') + ')' },
            { color: COLOR.pool,   label: 'Infra IP Pool (' + poolCount + ' — incl. Cluster IP + 3 ARB IPs)' },
            { color: COLOR.node,   label: 'Node IPs (' + nodeCount + ')' },
            { color: COLOR.unused, label: 'Unused (' + Math.max(0, totalUsable - totalUsed) + ')' }
        ];
        // Approximate text widths so swatches don't collide on narrow renders.
        var swatchW = 22, swatchH = 16, gap = 30;
        var charPx = LEGEND_SIZE * 0.55;
        var totalLegendW = 0;
        legendItems.forEach(function (li) {
            totalLegendW += swatchW + 8 + (li.label.length * charPx) + gap;
        });
        totalLegendW = Math.max(0, totalLegendW - gap);
        var legendStartX = Math.max(pad, (W - totalLegendW) / 2);

        var legendSvg = '';
        var lx = legendStartX;
        legendItems.forEach(function (li) {
            legendSvg += '<rect x="' + lx + '" y="' + (legendY - 14) + '" width="' + swatchW + '" height="' + swatchH + '" fill="' + li.color + '"/>';
            legendSvg += '<text x="' + (lx + swatchW + 8) + '" y="' + legendY + '" fill="' + TEXT + '" font-size="' + LEGEND_SIZE + '" font-family="' + FONT_FAMILY + '">' + escXml(li.label) + '</text>';
            lx += swatchW + 8 + (li.label.length * charPx) + gap;
        });

        var svg = ''
            + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" style="width:100%; height:auto; display:block;">'
            + '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + BG + '"/>'
            + '<text x="' + pad + '" y="40" fill="' + TEXT + '" font-size="' + TITLE_SIZE + '" font-weight="700" font-family="' + FONT_FAMILY + '">' + escXml(title) + '</text>'
            + '<text x="' + pad + '" y="72" fill="' + MUTED + '" font-size="' + SUBTITLE_SIZE + '" font-family="' + FONT_FAMILY + '">' + escXml(subtitle) + '</text>'
            + '<rect x="' + barX + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" fill="' + COLOR.unused + '"/>'
            + segs
            + '<rect x="' + barX + '" y="' + barY + '" width="' + barW + '" height="' + barH + '" fill="none" stroke="' + COLOR.border + '" stroke-width="1.5"/>'
            + '<text x="' + barX + '" y="' + (barY + barH + 26) + '" fill="' + MUTED + '" font-size="' + AXIS_SIZE + '" font-family="' + FONT_FAMILY + '">' + intToIp(baseInt) + '</text>'
            + '<text x="' + (barX + barW) + '" y="' + (barY + barH + 26) + '" text-anchor="end" fill="' + MUTED + '" font-size="' + AXIS_SIZE + '" font-family="' + FONT_FAMILY + '">' + intToIp(endIp) + '</text>'
            + legendSvg
            + '</svg>';
        return svg;
    }

    window.OdinSubnetUtil = {
        buildInfraSubnetBarSvg: buildInfraSubnetBarSvg
    };
})();
