#!/usr/bin/env node
/**
 * Create ALDO-mgmt-compute-1wl-Air-Gapped.drawio from ALDO-mgmt-compute-Air-Gapped.drawio
 * Removes workload cluster 2 (container -186 and all related cells/edges),
 * resizes the canvas, and repositions the right-side router/internet.
 */
const fs = require('fs');
const path = require('path');

const defaultSrcFile = path.join(__dirname, '..', 'docs', 'disconnected-operations', 'ALDO-mgmt-compute-Air-Gapped.drawio');
const defaultDstFile = path.join(__dirname, '..', 'docs', 'disconnected-operations', 'ALDO-mgmt-compute-1wl-Air-Gapped.drawio');

const srcFile = process.env.SRC_FILE || process.argv[2] || defaultSrcFile;
const dstFile = process.env.DST_FILE || process.argv[3] || defaultDstFile;

// Horizontal offset (in draw.io units) applied to shift right-side router/internet
// elements from their original x-range (~1360–1400) into the new canvas region (~990–1030).
const RIGHT_SIDE_X_OFFSET = 370;

const src = fs.readFileSync(srcFile, 'utf8');
const lines = src.split('\n');

// Cell IDs belonging to workload cluster 2 (container -186, nodes, their children, LNETs, labels, edges)
// Container cell
const wl2Container = 'JwsQfcPdxONgqVIScywy-186';
// Node cells that are direct children drawn inside the WL2 container
const wl2Nodes = [
    'JwsQfcPdxONgqVIScywy-187',  // ...16
    'JwsQfcPdxONgqVIScywy-188',  // node2
    'JwsQfcPdxONgqVIScywy-189',  // node1
];
// Children of node1 (-189)
const wl2Node1Children = [
    'JwsQfcPdxONgqVIScywy-200',
    'JwsQfcPdxONgqVIScywy-201',
    'JwsQfcPdxONgqVIScywy-202',
    'JwsQfcPdxONgqVIScywy-203',
    'JwsQfcPdxONgqVIScywy-204',
    'JwsQfcPdxONgqVIScywy-205',
    'JwsQfcPdxONgqVIScywy-206',
    'JwsQfcPdxONgqVIScywy-207',
    'JwsQfcPdxONgqVIScywy-208',
    'JwsQfcPdxONgqVIScywy-209',
    'zp-9drkoqEdSkVLqGhjB-13',
    'zp-9drkoqEdSkVLqGhjB-14',
    'zp-9drkoqEdSkVLqGhjB-15',
    'zp-9drkoqEdSkVLqGhjB-16',
    'zp-9drkoqEdSkVLqGhjB-17',
    'zp-9drkoqEdSkVLqGhjB-18',
    'zp-9drkoqEdSkVLqGhjB-28',
    'zp-9drkoqEdSkVLqGhjB-29',
    'zp-9drkoqEdSkVLqGhjB-30',
    'zp-9drkoqEdSkVLqGhjB-31',
];
// WL2 infra LNET
const wl2InfraLnet = 'JwsQfcPdxONgqVIScywy-210';
// WL2 workload LNET
const wl2WorkloadLnet = 'JwsQfcPdxONgqVIScywy-214';
// WL2 cluster icon
const wl2ClusterIcon = 'JwsQfcPdxONgqVIScywy-213';
// WL2 label
const wl2Label = 'JwsQfcPdxONgqVIScywy-215';
// Edge from infra LNET
const wl2InfraLnetEdge = 'JwsQfcPdxONgqVIScywy-212';
// Edges from workload VMs/LNET vNICs to workload LNET
const wl2WorkloadEdges = [
    'JwsQfcPdxONgqVIScywy-216',
    'JwsQfcPdxONgqVIScywy-217',
];
// Edge from mgmt vNIC to infra LNET (this edge connects zp-9drkoqEdSkVLqGhjB-18 to -210)
const wl2MgmtEdge = '5rdFPu6zPOaKkkA2_qyP-35';
// Edge from WL2 workload LNET to right router
const wl2ToRouter = '8VQSKHo2EGNXFli9giS4-23';

// All IDs to remove
const removeIds = new Set([
    wl2Container,
    ...wl2Nodes,
    ...wl2Node1Children,
    wl2InfraLnet,
    wl2WorkloadLnet,
    wl2ClusterIcon,
    wl2Label,
    wl2InfraLnetEdge,
    ...wl2WorkloadEdges,
    wl2MgmtEdge,
    wl2ToRouter,
]);

// Right-side router/internet elements to reposition (from x~1360-1400 to x~1000)
const rightSideIds = new Set([
    '8VQSKHo2EGNXFli9giS4-20',   // router
    '8VQSKHo2EGNXFli9giS4-21',   // internet cloud
    '8VQSKHo2EGNXFli9giS4-22',   // "Internet" label
]);

// Process lines
const result = [];
let skipBlock = false;
let removedCount = 0;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Check if this line starts a cell we want to remove
    let shouldRemove = false;
    for (const id of removeIds) {
        if (line.includes('id="' + id + '"')) {
            shouldRemove = true;
            break;
        }
    }

    if (shouldRemove) {
        // If self-closing tag, skip just this line
        if (line.trim().endsWith('/>')) {
            removedCount++;
            continue;
        }
        // Otherwise skip until we find the closing </mxCell>
        skipBlock = true;
        removedCount++;
        continue;
    }

    if (skipBlock) {
        if (line.trim() === '</mxCell>') {
            skipBlock = false;
        }
        continue;
    }

    // Resize canvas: pageWidth 1600 → 1100
    if (line.includes('pageWidth="1600"')) {
        line = line.replace('pageWidth="1600"', 'pageWidth="1100"');
    }

    // Resize background rect: width 1430 → 1050
    if (line.includes('id="JwsQfcPdxONgqVIScywy-129"')) {
        line = line.replace('width="1430"', 'width="1050"');
    }

    // Reposition right-side router/internet elements
    let isRightSide = false;
    for (const id of rightSideIds) {
        if (line.includes('id="' + id + '"')) {
            isRightSide = true;
            break;
        }
    }
    if (isRightSide) {
        // Shift x coordinates: ~1360-1400 → ~990-1030
        line = line.replace(/x="(1[3-4]\d{2}(?:\.\d+)?)"/, function(match, xVal) {
            const newX = parseFloat(xVal) - RIGHT_SIDE_X_OFFSET;
            return 'x="' + newX + '"';
        });
    }

    // Adjust edge from WL1 workload LNET to right router - update target point.
    // This edge has a target entry point that references the router position.
    // The mxPoint array points need adjustment too.

    // Handle mxPoint arrays inside WL1-to-router edge
    // The edge 8VQSKHo2EGNXFli9giS4-24 has points at x=838 and x=1380
    // Shift x=1380 → 1010
    if (line.includes('x="1380"')) {
        line = line.replace('x="1380"', 'x="1010"');
    }
    // x="838" kept as-is — it's WL1's position, no transformation needed

    // Title adjustment: update width of title cell that may be too wide
    if (line.includes('id="heOv2aa4RVyxCJM62_e7-10"')) {
        // Move title to center in narrower canvas
        line = line.replace(/x="(\d+(?:\.\d+)?)"/, function(match, xVal) {
            return 'x="400"';
        });
        line = line.replace(/width="(\d+(?:\.\d+)?)"/, function(match, wVal) {
            return 'width="446.31"'; // keep same width
        });
    }

    // No-connectivity edges from router to internet cloud
    // 8VQSKHo2EGNXFli9giS4-25 connects router(8VQSKHo2EGNXFli9giS4-20) to Internet label (8VQSKHo2EGNXFli9giS4-22)
    // This edge likely uses auto routing so no point adjustments needed

    result.push(line);
}

fs.writeFileSync(dstFile, result.join('\n'), 'utf8');
console.log('Created: ' + dstFile);
console.log('Removed ' + removedCount + ' cells');
console.log('Output lines: ' + result.length + ' (from ' + lines.length + ')');
