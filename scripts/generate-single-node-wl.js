#!/usr/bin/env node
/**
 * Generates single-node workload cluster diagrams from existing mgmt-compute templates.
 *
 * Configuration:
 *   - Management cluster: 3 stacked nodes (unchanged)
 *   - 1 Workload cluster (WL1): single node (remove node2/node3 stacking)
 *   - Remove WL2 cluster entirely
 *   - Storage: 2 ports (standard Slot-1)
 *   - Intents: Mgmt+Compute (2 ports) + Storage (2 ports)
 *
 * Input:  2 mgmt-compute diagrams (Air-Gapped + Limited-Connectivity)
 * Output: 2 single-node-wl diagrams
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'docs', 'disconnected-operations');

const SOURCE_FILES = [
    'ALDO-mgmt-compute-Air-Gapped.drawio',
    'ALDO-mgmt-compute-Limited-Connectivity.drawio'
];

const TITLE_CELL = 'heOv2aa4RVyxCJM62_e7-10';
const OVERALL_BG = 'JwsQfcPdxONgqVIScywy-129';

// ============================================================
// Cells to REMOVE — WL2 cluster (all nodes, children, edges)
// ============================================================
const WL2_CELLS = [
    // WL2 background
    'JwsQfcPdxONgqVIScywy-186',
    // WL2 stacked nodes
    'JwsQfcPdxONgqVIScywy-187',  // node3 "...16"
    'JwsQfcPdxONgqVIScywy-188',  // node2
    'JwsQfcPdxONgqVIScywy-189',  // node1
    // Children of WL2 node1 (-189)
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
    // WL2 Mgmt+Compute container and children
    'zp-9drkoqEdSkVLqGhjB-13',
    'zp-9drkoqEdSkVLqGhjB-14',
    'zp-9drkoqEdSkVLqGhjB-15',
    'zp-9drkoqEdSkVLqGhjB-16',
    'zp-9drkoqEdSkVLqGhjB-17',
    // WL2 Mgmt vNIC
    'zp-9drkoqEdSkVLqGhjB-18',
    // WL2 Storage container and children
    'zp-9drkoqEdSkVLqGhjB-28',
    'zp-9drkoqEdSkVLqGhjB-29',
    'zp-9drkoqEdSkVLqGhjB-30',
    'zp-9drkoqEdSkVLqGhjB-31',
    // WL2 infra LNET cylinder
    'JwsQfcPdxONgqVIScywy-210',
    // WL2 storage icon
    'JwsQfcPdxONgqVIScywy-213',
    // WL2 workloads LNETs cylinder
    'JwsQfcPdxONgqVIScywy-214',
    // WL2 cluster label
    'JwsQfcPdxONgqVIScywy-215',
    // Edges referencing WL2
    'JwsQfcPdxONgqVIScywy-212',  // WL2 infra LNET → mgmt router
    'JwsQfcPdxONgqVIScywy-216',  // WL2 VM LNET vNICs → WL2 workloads LNETs
    'JwsQfcPdxONgqVIScywy-217',  // WL2 AKS LNET vNICs → WL2 workloads LNETs
    '5rdFPu6zPOaKkkA2_qyP-35',   // WL2 Mgmt vNIC → WL2 infra LNET
    '8VQSKHo2EGNXFli9giS4-23',   // WL2 workloads LNETs → Internet router
];

// WL1 stacking nodes to remove (keep only node1)
const WL1_STACKING = [
    'JwsQfcPdxONgqVIScywy-132',  // node3 "...16"
    'JwsQfcPdxONgqVIScywy-133',  // node2
];

const ALL_REMOVE = [...WL2_CELLS, ...WL1_STACKING];

// ============================================================
// Repositioning — workloads Internet router/cloud/text
// ============================================================
const REPOSITION = [
    { id: '8VQSKHo2EGNXFli9giS4-20', prop: 'x', from: '1368.75',  to: '985' },
    { id: '8VQSKHo2EGNXFli9giS4-21', prop: 'x', from: '1362.6',   to: '979' },
    { id: '8VQSKHo2EGNXFli9giS4-22', prop: 'x', from: '1357.12',  to: '973' },
];

// ============================================================
// Helper functions
// ============================================================

/**
 * Remove cells by their IDs from draw.io XML content.
 * Handles both self-closing <mxCell .../> and multi-line <mxCell ...>...</mxCell>.
 */
function removeCells(content, cellIds) {
    const idSet = new Set(cellIds);
    const lines = content.split('\n');
    const result = [];
    let removingUntilClose = false;

    for (const line of lines) {
        if (removingUntilClose) {
            if (line.includes('</mxCell>')) {
                removingUntilClose = false;
            }
            continue;
        }

        let shouldRemove = false;
        for (const id of idSet) {
            if (line.includes(`id="${id}"`)) {
                shouldRemove = true;
                break;
            }
        }

        if (shouldRemove) {
            if (line.trim().endsWith('/>')) {
                continue; // self-closing, skip single line
            }
            // Multi-line cell — skip until closing </mxCell>
            if (line.includes('</mxCell>')) {
                continue; // opening and closing on same line
            }
            removingUntilClose = true;
            continue;
        }

        result.push(line);
    }

    return result.join('\n');
}

function setCellValue(content, cellId, newValue) {
    const escaped = cellId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(id="${escaped}"[^>]*\\bvalue=")([^"]*)(")`, 'g');
    return content.replace(regex, `$1${newValue}$3`);
}

function setCellGeomProp(content, cellId, prop, value) {
    const lines = content.split('\n');
    let foundCell = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`id="${cellId}"`)) foundCell = true;
        if (foundCell && lines[i].includes('<mxGeometry')) {
            lines[i] = lines[i].replace(
                new RegExp(`\\b${prop}="[^"]*"`),
                `${prop}="${value}"`
            );
            break;
        }
    }
    return lines.join('\n');
}

// ============================================================
// Main generation
// ============================================================

function generateSingleNodeWL(sourceFile) {
    let content = fs.readFileSync(path.join(SRC_DIR, sourceFile), 'utf-8');

    // 1. Remove all WL2 cells and WL1 stacking nodes
    content = removeCells(content, ALL_REMOVE);
    console.log(`  Removed ${ALL_REMOVE.length} cells`);

    // 2. Reposition workloads Internet router/cloud/text (closer to WL1)
    for (const r of REPOSITION) {
        content = setCellGeomProp(content, r.id, r.prop, r.to);
    }

    // 3. Update edge 8VQSKHo2EGNXFli9giS4-24 waypoint (WL1 LNETs → router)
    //    Waypoint x=1380 → x=1003
    content = content.replace(
        /<mxPoint x="1380" y="120" \/>/,
        '<mxPoint x="1003" y="120" />'
    );

    // 4. Shrink overall background width (remove WL2 space)
    content = setCellGeomProp(content, OVERALL_BG, 'width', '1040');

    // 5. Shrink page width
    content = content.replace(/pageWidth="1600"/, 'pageWidth="1120"');

    // 6. Update title
    const isAirGapped = sourceFile.includes('Air-Gapped');
    const connLabel = isAirGapped ? 'air-gapped' : 'limited connectivity';
    content = setCellValue(content, TITLE_CELL,
        `Azure Local disconnected operations single node workloads cluster ${connLabel} architecture`);

    // 7. Write output
    const suffix = isAirGapped ? 'Air-Gapped' : 'Limited-Connectivity';
    const outputFile = `ALDO-single-node-wl-${suffix}.drawio`;
    fs.writeFileSync(path.join(SRC_DIR, outputFile), content, 'utf-8');
    console.log(`  Created: ${outputFile}`);
    return outputFile;
}

// Main
console.log('Generating single-node workload cluster diagrams...\n');

const generatedFiles = [];
for (const sourceFile of SOURCE_FILES) {
    console.log(`Source: ${sourceFile}`);
    generatedFiles.push(generateSingleNodeWL(sourceFile));
}

console.log(`\nDone! Generated ${generatedFiles.length} diagrams.`);
console.log('\nGenerated files:');
generatedFiles.forEach(f => console.log(`  ${f}`));
