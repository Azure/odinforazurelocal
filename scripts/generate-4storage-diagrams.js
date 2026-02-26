#!/usr/bin/env node
/**
 * Generates mgmt-compute-4storage diagrams from existing mgmt-compute templates.
 *
 * Configuration: Mgmt+Compute intent (2 ports) + Storage intent (4 ports) = 6 ports total
 * The standard mgmt-compute has only 2 storage ports. This adds a second row (Slot-2).
 *
 * Changes from source:
 * 1. Add Slot-2-Port-1 and Slot-2-Port-2 to each cluster's storage container
 * 2. Expand storage container height for the extra row
 * 3. Move storage labels down
 * 4. Grow all node, background, and page heights
 * 5. Update title
 *
 * Input: 2 mgmt-compute diagrams (Air-Gapped + Limited-Connectivity)
 * Output: 2 new diagrams with 4 storage ports
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'docs', 'disconnected-operations');

const SOURCE_FILES = [
    'ALDO-mgmt-compute-Air-Gapped.drawio',
    'ALDO-mgmt-compute-Limited-Connectivity.drawio'
];

// Port geometry constants (from existing mgmt-compute template)
const PORT_WIDTH = 56.76;
const PORT_HEIGHT = 31.4;
const PORT_LEFT_X = 6.65;
const PORT_RIGHT_X = 74.89;
const PORT_ROW1_Y = 28.86;
const PORT_ROW_SPACING = 34.4;
const PORT_STYLE = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#5B3ABF;strokeColor=none;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;';

const TITLE_CELL = 'heOv2aa4RVyxCJM62_e7-10';

// ============================================================
// Cluster storage cell IDs
// ============================================================
const CLUSTERS = [
    {
        name: 'mgmt',
        storageContainer: 'zp-9drkoqEdSkVLqGhjB-19',
        storageLabel: 'zp-9drkoqEdSkVLqGhjB-20',
        storagePort1: 'zp-9drkoqEdSkVLqGhjB-22',  // Slot-1-Port-1 (insert after this)
        storagePort2: 'zp-9drkoqEdSkVLqGhjB-21',  // Slot-1-Port-2
        nodeIds: ['5', 'JwsQfcPdxONgqVIScywy-89', 'JwsQfcPdxONgqVIScywy-100'],
        bgId: 'JwsQfcPdxONgqVIScywy-218'
    },
    {
        name: 'wl1',
        storageContainer: 'zp-9drkoqEdSkVLqGhjB-24',
        storageLabel: 'zp-9drkoqEdSkVLqGhjB-25',
        storagePort1: 'zp-9drkoqEdSkVLqGhjB-27',  // Slot-1-Port-1
        storagePort2: 'zp-9drkoqEdSkVLqGhjB-26',
        nodeIds: ['JwsQfcPdxONgqVIScywy-134', 'JwsQfcPdxONgqVIScywy-133', 'JwsQfcPdxONgqVIScywy-132'],
        bgId: 'JwsQfcPdxONgqVIScywy-182'
    },
    {
        name: 'wl2',
        storageContainer: 'zp-9drkoqEdSkVLqGhjB-28',
        storageLabel: 'zp-9drkoqEdSkVLqGhjB-29',
        storagePort1: 'zp-9drkoqEdSkVLqGhjB-31',  // Slot-1-Port-1
        storagePort2: 'zp-9drkoqEdSkVLqGhjB-30',
        nodeIds: ['JwsQfcPdxONgqVIScywy-189', 'JwsQfcPdxONgqVIScywy-188', 'JwsQfcPdxONgqVIScywy-187'],
        bgId: 'JwsQfcPdxONgqVIScywy-186'
    }
];

const OVERALL_BG = 'JwsQfcPdxONgqVIScywy-129';

// ============================================================
// Helper functions
// ============================================================

function setCellValue(content, cellId, newValue) {
    const escaped = cellId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(id="${escaped}"[^>]*\\bvalue=")([^"]*)(")`, 'g');
    return content.replace(regex, `$1${newValue}$3`);
}

function adjustCellHeight(content, cellId, delta) {
    const lines = content.split('\n');
    let foundCell = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`id="${cellId}"`)) foundCell = true;
        if (foundCell && lines[i].includes('<mxGeometry')) {
            const hMatch = lines[i].match(/\bheight="([^"]+)"/);
            if (hMatch) {
                const newH = (parseFloat(hMatch[1]) + delta).toFixed(2);
                lines[i] = lines[i].replace(/\bheight="[^"]*"/, `height="${newH}"`);
            }
            break;
        }
    }
    return lines.join('\n');
}

function setPageHeight(content, height) {
    return content.replace(/pageHeight="[^"]*"/, `pageHeight="${height}"`);
}

// ============================================================
// Main generation
// ============================================================

function generate4StorageDiagram(sourceFile) {
    let content = fs.readFileSync(path.join(SRC_DIR, sourceFile), 'utf-8');
    const delta = PORT_ROW_SPACING; // 34.4px for one extra row

    for (const cluster of CLUSTERS) {
        // 1. Increase storage container height
        content = adjustCellHeight(content, cluster.storageContainer, delta);

        // 2. Move storage label down
        const lines = content.split('\n');
        let foundLabel = false;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`id="${cluster.storageLabel}"`)) foundLabel = true;
            if (foundLabel && lines[i].includes('<mxGeometry')) {
                const yMatch = lines[i].match(/\by="([^"]+)"/);
                if (yMatch) {
                    const newY = (parseFloat(yMatch[1]) + delta).toFixed(2);
                    lines[i] = lines[i].replace(/\by="[^"]*"/, `y="${newY}"`);
                }
                foundLabel = false;
                break;
            }
        }
        content = lines.join('\n');

        // 3. Add Slot-2 port cells inside storage container
        const slot2Y = (PORT_ROW1_Y + PORT_ROW_SPACING).toFixed(2);
        const newPorts = [
            `        <mxCell id="4storage-${cluster.name}-slot2-port1" parent="${cluster.storageContainer}" style="${PORT_STYLE}" value="Slot-2-Port-1" vertex="1">`,
            `          <mxGeometry height="${PORT_HEIGHT}" width="${PORT_WIDTH}" x="${PORT_LEFT_X}" y="${slot2Y}" as="geometry" />`,
            `        </mxCell>`,
            `        <mxCell id="4storage-${cluster.name}-slot2-port2" parent="${cluster.storageContainer}" style="${PORT_STYLE}" value="Slot-2-Port-2" vertex="1">`,
            `          <mxGeometry height="${PORT_HEIGHT}" width="${PORT_WIDTH}" x="${PORT_RIGHT_X}" y="${slot2Y}" as="geometry" />`,
            `        </mxCell>`
        ];

        // Insert after Slot-1-Port-1's closing tag
        const portLines = content.split('\n');
        let foundPort = false;
        const result = [];
        for (let i = 0; i < portLines.length; i++) {
            result.push(portLines[i]);
            if (portLines[i].includes(`id="${cluster.storagePort1}"`)) foundPort = true;
            if (foundPort && portLines[i].includes('</mxCell>')) {
                result.push(...newPorts);
                foundPort = false;
            }
        }
        content = result.join('\n');

        // 4. Increase all node heights in this cluster
        for (const nodeId of cluster.nodeIds) {
            content = adjustCellHeight(content, nodeId, delta);
        }

        // 5. Increase cluster background height
        content = adjustCellHeight(content, cluster.bgId, delta);
    }

    // 6. Increase overall background height
    content = adjustCellHeight(content, OVERALL_BG, delta);

    // 7. Increase page height
    const pageMatch = content.match(/pageHeight="(\d+)"/);
    if (pageMatch) {
        content = setPageHeight(content, String(parseInt(pageMatch[1]) + Math.round(delta)));
    }

    // 8. Update title
    const isAirGapped = sourceFile.includes('Air-Gapped');
    const connLabel = isAirGapped ? 'air-gapped' : 'limited connectivity';
    content = setCellValue(content, TITLE_CELL,
        `Azure Local disconnected operations management + compute (4 storage ports) ${connLabel} architecture`);

    // 9. Write output
    const suffix = isAirGapped ? 'Air-Gapped' : 'Limited-Connectivity';
    const outputFile = `ALDO-mgmt-compute-4storage-${suffix}.drawio`;
    fs.writeFileSync(path.join(SRC_DIR, outputFile), content, 'utf-8');
    console.log(`  Created: ${outputFile}`);
    return outputFile;
}

// Main
console.log('Generating mgmt-compute-4storage diagrams...\n');

const generatedFiles = [];
for (const sourceFile of SOURCE_FILES) {
    console.log(`Source: ${sourceFile}`);
    generatedFiles.push(generate4StorageDiagram(sourceFile));
}

console.log(`\nDone! Generated ${generatedFiles.length} diagrams.`);
console.log('\nGenerated files:');
generatedFiles.forEach(f => console.log(`  ${f}`));
