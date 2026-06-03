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

(function() {
    'use strict';

    function ipToInt(ip) {
        const parts = String(ip || '').split('.').map(Number);
        if (parts.length !== 4) return null;
        for (let i = 0; i < 4; i++) {
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
        const opts = options || {};

        const cidr = String(state.infraCidr || '').trim();
        const m = cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
        if (!m) return null;
        const prefix = parseInt(m[2], 10);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;
        let baseInt = ipToInt(m[1]);
        if (baseInt === null) return null;
        const hostBits = 32 - prefix;
        const size = Math.pow(2, hostBits);
        baseInt = baseInt - (baseInt % size);

        // Collect used ranges as { start, end (inclusive), kind }.
        const used = [];
        let gwInt = ipToInt(state.infraGateway);
        if (gwInt !== null && gwInt >= baseInt && gwInt < baseInt + size) {
            used.push({ start: gwInt, end: gwInt, kind: 'gw' });
        } else {
            gwInt = null;
        }

        let poolEntry = null;
        if (state.infra && state.infra.start && state.infra.end) {
            const ps = ipToInt(state.infra.start);
            const pe = ipToInt(state.infra.end);
            if (ps !== null && pe !== null && pe >= ps) {
                poolEntry = { start: ps, end: pe, kind: 'pool' };
                used.push(poolEntry);
            }
        }

        let nodeCount = 0;
        if (Array.isArray(state.nodeSettings)) {
            // Group contiguous node IPs into runs for cleaner bar segments.
            const ips = state.nodeSettings.map(function(n) {
                if (!n || !n.ipCidr) return null;
                return ipToInt(String(n.ipCidr).split('/')[0]);
            }).filter(function(v) {
                // Only include node IPs that fall inside the CIDR being drawn.
                return v !== null && v >= baseInt && v < baseInt + size;
            }).sort(function(a, b) { return a - b; });

            if (ips.length) {
                let run = { start: ips[0], end: ips[0] };
                for (let i = 1; i < ips.length; i++) {
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
        const W = opts.width || 1600;
        const H = opts.height || 320;
        const pad = opts.pad || 30;
        const barY = opts.barY || 90;
        const barH = opts.barH || 70;
        const barX = pad;
        const barW = W - pad * 2;

        const COLOR = {
            unused: opts.unusedColor || '#1f2937',
            border: opts.borderColor || '#475569',
            gw:     opts.gwColor     || '#fbbf24',
            pool:   opts.poolColor   || '#3b82f6',
            node:   opts.nodeColor   || '#10b981'
        };
        const BG = opts.background || '#0b1220';
        const TEXT = opts.textColor || '#e5e7eb';
        const MUTED = opts.mutedColor || '#94a3b8';
        const FONT_FAMILY = opts.fontFamily || 'Segoe UI, Arial, sans-serif';
        const TITLE_SIZE = opts.titleFontSize || 26;
        const SUBTITLE_SIZE = opts.subtitleFontSize || 20;
        const AXIS_SIZE = opts.axisFontSize || 18;
        const LEGEND_SIZE = opts.legendFontSize || 20;

        function pxFor(intVal) {
            const rel = intVal - baseInt;
            return barX + Math.round((rel / size) * barW);
        }

        const poolCount = poolEntry ? (poolEntry.end - poolEntry.start + 1) : 0;
        const totalUsable = size > 2 ? size - 2 : size; // exclude network + broadcast
        const totalUsed = nodeCount + poolCount + (gwInt !== null ? 1 : 0);

        const endIp = baseInt + size - 1;

        // Build segment rects. Order: pool first (wide), then nodes, then gw
        // so single-pixel slivers stay visible on top.
        let segs = '';
        used.sort(function(a, b) {
            const rank = { pool: 0, node: 1, gw: 2 };
            return rank[a.kind] - rank[b.kind];
        }).forEach(function(u) {
            const x1 = pxFor(u.start);
            const x2 = pxFor(u.end + 1);
            const w = Math.max(2, x2 - x1);
            segs += '<rect x="' + x1 + '" y="' + barY + '" width="' + w + '" height="' + barH + '" fill="' + COLOR[u.kind] + '"/>';
        });

        const title = 'Infrastructure Subnet Utilisation — ' + cidr + '  (' + size + ' addresses)';
        const subtitle = 'Used: ' + totalUsed + ' / ' + totalUsable + ' usable  ·  '
            + 'Gateway: ' + (gwInt !== null ? intToIp(gwInt) : '—') + '  ·  '
            + 'Pool: ' + (poolEntry ? intToIp(poolEntry.start) + '–' + intToIp(poolEntry.end) + ' (' + poolCount + ')' : '—') + '  ·  '
            + 'Nodes: ' + nodeCount;

        // Legend — flow as a single row, centred, with proportional spacing
        // so it scales cleanly with the chosen width.
        const legendY = barY + barH + 60;
        const legendItems = [
            { color: COLOR.gw,     label: 'Default Gateway (' + (gwInt !== null ? '1' : '0') + ')' },
            { color: COLOR.pool,   label: 'Infra IP Pool (' + poolCount + ' — incl. Cluster IP + 3 ARB IPs)' },
            { color: COLOR.node,   label: 'Node IPs (' + nodeCount + ')' },
            { color: COLOR.unused, label: 'Unused (' + Math.max(0, totalUsable - totalUsed) + ')' }
        ];
        // Approximate text widths so swatches don't collide on narrow renders.
        const swatchW = 22, swatchH = 16, gap = 30;
        const charPx = LEGEND_SIZE * 0.55;
        let totalLegendW = 0;
        legendItems.forEach(function(li) {
            totalLegendW += swatchW + 8 + (li.label.length * charPx) + gap;
        });
        totalLegendW = Math.max(0, totalLegendW - gap);
        const legendStartX = Math.max(pad, (W - totalLegendW) / 2);

        let legendSvg = '';
        let lx = legendStartX;
        legendItems.forEach(function(li) {
            legendSvg += '<rect x="' + lx + '" y="' + (legendY - 14) + '" width="' + swatchW + '" height="' + swatchH + '" fill="' + li.color + '"/>';
            legendSvg += '<text x="' + (lx + swatchW + 8) + '" y="' + legendY + '" fill="' + TEXT + '" font-size="' + LEGEND_SIZE + '" font-family="' + FONT_FAMILY + '">' + escXml(li.label) + '</text>';
            lx += swatchW + 8 + (li.label.length * charPx) + gap;
        });

        const svg = ''
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
