#!/usr/bin/env node
/**
 * Generates switchless disconnected draw.io diagrams from existing switched diagrams.
 * Only mgmt-compute intent is valid for switchless configurations.
 * Creates 2-node, 3-node, and 4-node variants for each outbound type.
 * 
 * Input: 2 existing mgmt-compute diagrams (air-gapped + limited-connectivity)
 * Output: 6 new diagrams (2 outbound types × 3 node counts)
 * 
 * Changes from source:
 * 1. Removes second workload cluster (Cluster 2) and associated elements
 * 2. Adjusts workload cluster 1 to show specific node count (2, 3, or 4)
 * 3. Updates storage ports per node count: 2-node=2 ports, 3-node=4 ports, 4-node=6 ports
 * 4. For 3-node: also applies switchless pattern to management cluster (always 3 nodes)
 * 5. Updates title to include "switchless" and node count
 * 6. Reduces page width and background rectangle
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'docs', 'disconnected-operations');

// Source files (only mgmt-compute is valid for switchless)
const SOURCE_FILES = [
    'ALDO-mgmt-compute-Air-Gapped.drawio',
    'ALDO-mgmt-compute-Limited-Connectivity.drawio'
];

// Cluster 2 cell IDs to REMOVE (common across all files)
const CLUSTER2_COMMON_IDS = [
    // Cluster 2 container, stacked nodes, icon, label
    'JwsQfcPdxONgqVIScywy-186',
    'JwsQfcPdxONgqVIScywy-187',
    'JwsQfcPdxONgqVIScywy-188',
    'JwsQfcPdxONgqVIScywy-189',
    'JwsQfcPdxONgqVIScywy-213',
    'JwsQfcPdxONgqVIScywy-215',
    // Children of -189 (VMs, AKS, icons)
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
    // Cluster 2 LNET cylinders
    'JwsQfcPdxONgqVIScywy-210',
    'JwsQfcPdxONgqVIScywy-214',
    // Cluster 2 edges
    'JwsQfcPdxONgqVIScywy-212',
    'JwsQfcPdxONgqVIScywy-216',
    'JwsQfcPdxONgqVIScywy-217',
    '5rdFPu6zPOaKkkA2_qyP-35',
    // Right-side Internet/router (associated with cluster 2)
    '8VQSKHo2EGNXFli9giS4-20',
    '8VQSKHo2EGNXFli9giS4-21',
    '8VQSKHo2EGNXFli9giS4-22',
    '8VQSKHo2EGNXFli9giS4-23',
    '8VQSKHo2EGNXFli9giS4-24',
    '8VQSKHo2EGNXFli9giS4-25',
];

// Additional cluster 2 IDs per architecture type
const CLUSTER2_ARCH_IDS = {
    fullyconverged: [
        'zp-9drkoqEdSkVLqGhjB-13',
        'zp-9drkoqEdSkVLqGhjB-14',
        'zp-9drkoqEdSkVLqGhjB-15',
        'zp-9drkoqEdSkVLqGhjB-16',
        'zp-9drkoqEdSkVLqGhjB-17',
        'zp-9drkoqEdSkVLqGhjB-18',
    ],
    'mgmt-compute': [
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
    ],
    dissaggregated: [
        '5rdFPu6zPOaKkkA2_qyP-20',
        '5rdFPu6zPOaKkkA2_qyP-21',
        '5rdFPu6zPOaKkkA2_qyP-22',
        '5rdFPu6zPOaKkkA2_qyP-23',
        '5rdFPu6zPOaKkkA2_qyP-24',
        '5rdFPu6zPOaKkkA2_qyP-25',
        '5rdFPu6zPOaKkkA2_qyP-26',
        '5rdFPu6zPOaKkkA2_qyP-27',
        '5rdFPu6zPOaKkkA2_qyP-28',
        '5rdFPu6zPOaKkkA2_qyP-29',
        '5rdFPu6zPOaKkkA2_qyP-30',
        '5rdFPu6zPOaKkkA2_qyP-31',
        '5rdFPu6zPOaKkkA2_qyP-32',
        '5rdFPu6zPOaKkkA2_qyP-33',
        '5rdFPu6zPOaKkkA2_qyP-34',
    ]
};

// Cluster 1 stacked node IDs
const CLUSTER1_BACK_NODE = 'JwsQfcPdxONgqVIScywy-132';  // "...16"
const CLUSTER1_MID_NODE = 'JwsQfcPdxONgqVIScywy-133';   // "node2"
const CLUSTER1_FRONT_NODE = 'JwsQfcPdxONgqVIScywy-134';  // "node1"

// Background rectangle
const BG_RECT = 'JwsQfcPdxONgqVIScywy-129';
// Cluster 1 background
const CL1_BG = 'JwsQfcPdxONgqVIScywy-182';
// Title cell
const TITLE_CELL = 'heOv2aa4RVyxCJM62_e7-10';
// Cluster 1 workloads LNET
const CL1_WORKLOADS_LNET = 'JwsQfcPdxONgqVIScywy-166';

// Workload cluster node1 storage container and children
const WL_STORAGE_CONTAINER = 'zp-9drkoqEdSkVLqGhjB-24';
const WL_STORAGE_LABEL = 'zp-9drkoqEdSkVLqGhjB-25';
const WL_STORAGE_PORT1 = 'zp-9drkoqEdSkVLqGhjB-27'; // Slot-1-Port-1
const WL_STORAGE_PORT2 = 'zp-9drkoqEdSkVLqGhjB-26'; // Slot-1-Port-2

// Management cluster cell IDs (always 3 nodes)
const MGMT_NODE1 = '5';
const MGMT_NODE2 = 'JwsQfcPdxONgqVIScywy-89';
const MGMT_NODE3 = 'JwsQfcPdxONgqVIScywy-100';
const MGMT_BG = 'JwsQfcPdxONgqVIScywy-218';
const MGMT_STORAGE_CONTAINER = 'zp-9drkoqEdSkVLqGhjB-19';
const MGMT_STORAGE_LABEL = 'zp-9drkoqEdSkVLqGhjB-20';
const MGMT_STORAGE_PORT1 = 'zp-9drkoqEdSkVLqGhjB-22'; // Slot-1-Port-1
const MGMT_STORAGE_PORT2 = 'zp-9drkoqEdSkVLqGhjB-21'; // Slot-1-Port-2

// Storage port geometry constants (from existing diagram)
const PORT_WIDTH = 56.76;
const PORT_HEIGHT = 31.4;
const PORT_LEFT_X = 6.65;
const PORT_RIGHT_X = 74.89;
const PORT_ROW1_Y = 28.86;
const PORT_ROW_SPACING = 34.4;
const PORT_STYLE = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#5B3ABF;strokeColor=none;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;';

function getArchType(filename) {
    if (filename.includes('fullyconverged')) return 'fullyconverged';
    if (filename.includes('dissaggregated')) return 'dissaggregated';
    if (filename.includes('mgmt-compute')) return 'mgmt-compute';
    throw new Error(`Unknown architecture type in: ${filename}`);
}

function getOutboundType(filename) {
    if (filename.includes('Air-Gapped')) return 'air-gapped';
    if (filename.includes('Limited-Connectivity')) return 'limited-connectivity';
    throw new Error(`Unknown outbound type in: ${filename}`);
}

function getIntentLabel(archType) {
    switch (archType) {
        case 'fullyconverged': return 'fully converged';
        case 'dissaggregated': return 'disaggregated';
        case 'mgmt-compute': return 'management + compute';
    }
}

function getOutboundLabel(outboundType) {
    return outboundType === 'air-gapped' ? 'air-gapped' : 'limited connectivity';
}

/**
 * Remove all mxCell elements whose id matches any in idsToRemove,
 * OR whose parent matches any in idsToRemove (catches nested children),
 * OR edges whose source/target references a removed cell.
 * 
 * In draw.io XML, all mxCell elements are siblings under <root>.
 * Child relationships use parent="..." attributes, not XML nesting.
 * So the only XML nesting inside an mxCell is mxGeometry/Array/mxPoint.
 */
function removeCells(content, idsToRemove) {
    const idSet = new Set(idsToRemove);
    const lines = content.split('\n');
    const result = [];
    let insideRemovedCell = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // If we're skipping a multi-line cell, look for its closing tag
        if (insideRemovedCell) {
            if (line.includes('</mxCell>')) {
                insideRemovedCell = false;
            }
            continue;
        }

        // Only check mxCell lines for removal
        if (line.includes('<mxCell')) {
            const idMatch = line.match(/\bid="([^"]+)"/);
            const parentMatch = line.match(/\bparent="([^"]+)"/);
            const sourceMatch = line.match(/\bsource="([^"]+)"/);
            const targetMatch = line.match(/\btarget="([^"]+)"/);

            const cellId = idMatch ? idMatch[1] : null;
            const parentId = parentMatch ? parentMatch[1] : null;
            const sourceId = sourceMatch ? sourceMatch[1] : null;
            const targetId = targetMatch ? targetMatch[1] : null;

            const shouldRemove =
                (cellId && idSet.has(cellId)) ||
                (parentId && idSet.has(parentId)) ||
                (line.includes('edge="1"') &&
                    ((sourceId && idSet.has(sourceId)) || (targetId && idSet.has(targetId))));

            if (shouldRemove) {
                if (!line.includes('/>')) {
                    // Multi-line cell — skip until </mxCell>
                    insideRemovedCell = true;
                }
                // Either way, skip this line
                continue;
            }
        }

        result.push(line);
    }

    return result.join('\n');
}

/**
 * Change value attribute of a cell with the given ID
 */
function setCellValue(content, cellId, newValue) {
    const escaped = cellId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(id="${escaped}"[^>]*\\bvalue=")([^"]*)(")`, 'g');
    return content.replace(regex, `$1${newValue}$3`);
}

/**
 * Modify geometry of a cell (width and/or height and/or x and/or y)
 */
function setCellGeometry(content, cellId, props) {
    const escaped = cellId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Find the cell line and its geometry line
    const lines = content.split('\n');
    let foundCell = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`id="${cellId}"`)) {
            foundCell = true;
        }
        if (foundCell && lines[i].includes('<mxGeometry')) {
            if (props.width !== undefined) {
                lines[i] = lines[i].replace(/\bwidth="[^"]*"/, `width="${props.width}"`);
            }
            if (props.height !== undefined) {
                lines[i] = lines[i].replace(/\bheight="[^"]*"/, `height="${props.height}"`);
            }
            if (props.x !== undefined) {
                lines[i] = lines[i].replace(/\bx="[^"]*"/, `x="${props.x}"`);
            }
            if (props.y !== undefined) {
                lines[i] = lines[i].replace(/\by="[^"]*"/, `y="${props.y}"`);
            }
            break;
        }
    }
    return lines.join('\n');
}

/**
 * Add extra stacked node(s) behind node2 for 3-node and 4-node variants.
 * In the existing diagrams, "...16" is behind node2. For switchless:
 * - 2-node: remove "...16", keep node1 + node2
 * - 3-node: change "...16" to "node3"
 * - 4-node: change "...16" to "node4", add "node3" between
 */
function adjustCluster1Nodes(content, nodeCount) {
    if (nodeCount === 2) {
        // Remove the back node ("...16")
        content = removeCells(content, [CLUSTER1_BACK_NODE]);
    } else if (nodeCount === 3) {
        // Change "...16" label to "node3"
        content = setCellValue(content, CLUSTER1_BACK_NODE, 'node3');
    } else if (nodeCount === 4) {
        // Change "...16" to "node4"
        content = setCellValue(content, CLUSTER1_BACK_NODE, 'node4');

        // Add node3 between node2 and node4 using line-based insertion.
        // node2 (-133) is at x=623.69, y=217.26, 300x225
        // node4 (-132, was "...16") is at x=653.5, y=247.26, 300x220
        // node3 goes at x=638.6, y=232.26, 300x222
        const node3Cell =
            '        <mxCell id="switchless-node3" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1E3A5F;strokeColor=#3B82F6;fontColor=#FFFFFF;fontSize=12;fontStyle=1;arcSize=3;verticalAlign=bottom;spacingTop=8;container=1;collapsible=0;align=center;fontFamily=Helvetica;" value="node3" vertex="1">\n' +
            '          <mxGeometry height="222" width="300" x="638.6" y="232.26" as="geometry" />\n' +
            '        </mxCell>';

        // Insert after node2's closing </mxCell> tag
        const lines = content.split('\n');
        let foundNode2 = false;
        const newLines = [];
        for (let i = 0; i < lines.length; i++) {
            newLines.push(lines[i]);
            if (lines[i].includes(`id="${CLUSTER1_MID_NODE}"`)) {
                foundNode2 = true;
            }
            if (foundNode2 && lines[i].includes('</mxCell>')) {
                newLines.push(node3Cell);
                foundNode2 = false;
            }
        }
        content = newLines.join('\n');
    }
    return content;
}

/**
 * Update the page width/height in mxGraphModel
 */
function setPageWidth(content, width) {
    return content.replace(/pageWidth="[^"]*"/, `pageWidth="${width}"`);
}

function setPageHeight(content, height) {
    return content.replace(/pageHeight="[^"]*"/, `pageHeight="${height}"`);
}

/**
 * Adjust storage ports in workload cluster node1 based on switchless node count.
 * - 2-node: 2 ports (1 peer × 2 redundant links) — already present
 * - 3-node: 4 ports (2 peers × 2 redundant links) — add Slot-2 row
 * - 4-node: 6 ports (3 peers × 2 redundant links) — add Slot-2 and Slot-3 rows
 */
function adjustStoragePorts(content, nodeCount) {
    if (nodeCount === 2) return content; // Already has 2 ports

    const extraRows = nodeCount === 3 ? 1 : 2; // 1 extra row for 3-node, 2 for 4-node
    const extraHeight = extraRows * PORT_ROW_SPACING;

    // 1. Increase storage container height
    const currentContainerH = 89.12;
    const newContainerH = currentContainerH + extraHeight;
    content = setCellGeometry(content, WL_STORAGE_CONTAINER, { height: newContainerH.toFixed(2) });

    // 2. Move storage label down
    const currentLabelY = 65.64;
    const newLabelY = currentLabelY + extraHeight;
    content = setCellGeometry(content, WL_STORAGE_LABEL, { y: newLabelY.toFixed(2) });

    // 3. Add extra port cells
    const newPorts = [];
    for (let row = 1; row <= extraRows; row++) {
        const slotNum = row + 1; // Slot-2 for row 1, Slot-3 for row 2
        const rowY = (PORT_ROW1_Y + row * PORT_ROW_SPACING).toFixed(2);

        newPorts.push(
            `        <mxCell id="switchless-storage-slot${slotNum}-port1" parent="${WL_STORAGE_CONTAINER}" style="${PORT_STYLE}" value="Slot-${slotNum}-Port-1" vertex="1">`,
            `          <mxGeometry height="${PORT_HEIGHT}" width="${PORT_WIDTH}" x="${PORT_LEFT_X}" y="${rowY}" as="geometry" />`,
            `        </mxCell>`,
            `        <mxCell id="switchless-storage-slot${slotNum}-port2" parent="${WL_STORAGE_CONTAINER}" style="${PORT_STYLE}" value="Slot-${slotNum}-Port-2" vertex="1">`,
            `          <mxGeometry height="${PORT_HEIGHT}" width="${PORT_WIDTH}" x="${PORT_RIGHT_X}" y="${rowY}" as="geometry" />`,
            `        </mxCell>`
        );
    }

    // Insert new ports after the last existing port (Slot-1-Port-1, id = WL_STORAGE_PORT1)
    const lines = content.split('\n');
    let foundPort1 = false;
    const result = [];
    for (let i = 0; i < lines.length; i++) {
        result.push(lines[i]);
        if (lines[i].includes(`id="${WL_STORAGE_PORT1}"`)) {
            foundPort1 = true;
        }
        // Insert after the geometry line of the last port
        if (foundPort1 && lines[i].includes('</mxCell>')) {
            result.push(...newPorts);
            foundPort1 = false;
        }
    }
    content = result.join('\n');

    // 4. Increase node1 height to fit expanded storage container
    content = adjustCellHeight(content, CLUSTER1_FRONT_NODE, extraHeight);

    // 5. Increase stacked node heights proportionally
    content = adjustCellHeight(content, CLUSTER1_MID_NODE, extraHeight);
    content = adjustCellHeight(content, CLUSTER1_BACK_NODE, extraHeight);
    if (nodeCount === 4) {
        content = adjustCellHeight(content, 'switchless-node3', extraHeight);
    }

    // 6. Increase cluster 1 background height
    content = adjustCellHeight(content, CL1_BG, extraHeight);

    // 7. Increase overall background height
    content = adjustCellHeight(content, BG_RECT, extraHeight);

    // 8. Increase page height
    const currentPageH = 490;
    content = setPageHeight(content, String(currentPageH + Math.round(extraHeight)));

    return content;
}

/**
 * Apply switchless pattern to the management cluster (only for 3-node).
 * The management cluster always has 3 nodes, so when the workload cluster
 * is also 3-node switchless, the mgmt cluster gets the same treatment:
 * - Add Slot-2 storage ports (4 total = 2 peers × 2 redundant links)
 * - Grow mgmt node/container/background heights
 * - Add a switchless note label below the mgmt cluster nodes
 */
function adjustMgmtClusterSwitchless(content) {
    const extraRows = 1; // 3-node = 1 extra row (Slot-2)
    const extraHeight = extraRows * PORT_ROW_SPACING;

    // 1. Increase mgmt storage container height
    const currentContainerH = 89.12;
    const newContainerH = currentContainerH + extraHeight;
    content = setCellGeometry(content, MGMT_STORAGE_CONTAINER, { height: newContainerH.toFixed(2) });

    // 2. Move mgmt storage label down
    const currentLabelY = 65.64;
    const newLabelY = currentLabelY + extraHeight;
    content = setCellGeometry(content, MGMT_STORAGE_LABEL, { y: newLabelY.toFixed(2) });

    // 3. Add Slot-2 port cells to mgmt storage container
    const rowY = (PORT_ROW1_Y + PORT_ROW_SPACING).toFixed(2);
    const mgmtNewPorts = [
        `        <mxCell id="switchless-mgmt-storage-slot2-port1" parent="${MGMT_STORAGE_CONTAINER}" style="${PORT_STYLE}" value="Slot-2-Port-1" vertex="1">`,
        `          <mxGeometry height="${PORT_HEIGHT}" width="${PORT_WIDTH}" x="${PORT_LEFT_X}" y="${rowY}" as="geometry" />`,
        `        </mxCell>`,
        `        <mxCell id="switchless-mgmt-storage-slot2-port2" parent="${MGMT_STORAGE_CONTAINER}" style="${PORT_STYLE}" value="Slot-2-Port-2" vertex="1">`,
        `          <mxGeometry height="${PORT_HEIGHT}" width="${PORT_WIDTH}" x="${PORT_RIGHT_X}" y="${rowY}" as="geometry" />`,
        `        </mxCell>`
    ];

    // Insert after the last existing mgmt port (Slot-1-Port-1, id = MGMT_STORAGE_PORT1)
    const lines = content.split('\n');
    let foundPort = false;
    const result = [];
    for (let i = 0; i < lines.length; i++) {
        result.push(lines[i]);
        if (lines[i].includes(`id="${MGMT_STORAGE_PORT1}"`)) {
            foundPort = true;
        }
        if (foundPort && lines[i].includes('</mxCell>')) {
            result.push(...mgmtNewPorts);
            foundPort = false;
        }
    }
    content = result.join('\n');

    // 4. Increase mgmt node heights
    content = adjustCellHeight(content, MGMT_NODE1, extraHeight);
    content = adjustCellHeight(content, MGMT_NODE2, extraHeight);
    content = adjustCellHeight(content, MGMT_NODE3, extraHeight);

    // 5. Increase mgmt cluster background height (extra space for note)
    const NOTE_SPACE = 30; // room for 22px note + 8px padding
    content = adjustCellHeight(content, MGMT_BG, extraHeight + NOTE_SPACE);

    // 6. Add switchless note below mgmt cluster nodes
    // After growth: node3(back) bottom = 250 + 220 + 34.4 = 504.4
    const mgmtNoteY = 508;
    const mgmtNoteText = '⚡ Switchless storage · 3-node · 4 storage ports · direct node-to-node connections';
    const mgmtNote =
        `        <mxCell id="switchless-mgmt-note-bg" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#2D1B00;strokeColor=#FF9900;strokeWidth=1;arcSize=50;opacity=90;" value="" vertex="1">\n` +
        `          <mxGeometry height="22" width="340" x="80" y="${mgmtNoteY}" as="geometry" />\n` +
        `        </mxCell>\n` +
        `        <mxCell id="switchless-mgmt-note" parent="1" style="text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=9;fontColor=#FF9900;fontStyle=1" value="${mgmtNoteText}" vertex="1">\n` +
        `          <mxGeometry height="22" width="340" x="80" y="${mgmtNoteY}" as="geometry" />\n` +
        `        </mxCell>`;

    content = content.replace('</root>', mgmtNote + '\n      </root>');

    return content;
}

/**
 * Increase the height of a cell's geometry by delta
 */
function adjustCellHeight(content, cellId, delta) {
    const lines = content.split('\n');
    let foundCell = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`id="${cellId}"`)) {
            foundCell = true;
        }
        if (foundCell && lines[i].includes('<mxGeometry')) {
            const hMatch = lines[i].match(/\bheight="([^"]+)"/);
            if (hMatch) {
                const newH = (parseFloat(hMatch[1]) + delta).toFixed(2);
                lines[i] = lines[i].replace(/\bheight="[^"]*"/, `height="${newH}"`);
            }
            foundCell = false;
            break;
        }
    }
    return lines.join('\n');
}

function generateSwitchlessDiagram(sourceFile, nodeCount) {
    const archType = getArchType(sourceFile);
    const outboundType = getOutboundType(sourceFile);
    const intentLabel = getIntentLabel(archType);
    const outboundLabel = getOutboundLabel(outboundType);

    // Read source file
    let content = fs.readFileSync(path.join(SRC_DIR, sourceFile), 'utf-8');

    // 1. Build list of IDs to remove (cluster 2 + right-side internet)
    const idsToRemove = [
        ...CLUSTER2_COMMON_IDS,
        ...(CLUSTER2_ARCH_IDS[archType] || [])
    ];

    // 2. Remove cluster 2 cells and edges
    content = removeCells(content, idsToRemove);

    // 3. Adjust cluster 1 node count
    content = adjustCluster1Nodes(content, nodeCount);

    // 4. Update title
    const newTitle = `Azure Local disconnected operations ${nodeCount}-node switchless ${outboundLabel} architecture`;
    content = setCellValue(content, TITLE_CELL, newTitle);

    // 5. Adjust storage ports for switchless node count (workload cluster)
    content = adjustStoragePorts(content, nodeCount);

    // 5b. For 3-node switchless, also apply switchless pattern to mgmt cluster
    // (mgmt cluster is always 3 nodes, so it matches the 3-node switchless scenario)
    if (nodeCount === 3) {
        content = adjustMgmtClusterSwitchless(content);
    }

    // 6. Reduce page width and background rectangle
    // Original: 1600 wide, background 1430 wide
    // New: ~1050 wide, background ~1000 wide (enough for mgmt cluster + 1 workload cluster)
    content = setPageWidth(content, '1100');
    content = setCellGeometry(content, BG_RECT, { width: '1000' });

    // 7. Add a "Switchless Storage" note below the node stack.
    // Calculate Y position dynamically — place it below the deepest node.
    // Base: node4/back node bottom is at y=247.26 + height.
    // Original back node: y=247.26, h=220 → bottom=467.26
    // Each extra row of storage ports adds PORT_ROW_SPACING to height.
    const extraRows = nodeCount === 3 ? 1 : nodeCount === 4 ? 2 : 0;
    const extraH = extraRows * PORT_ROW_SPACING;
    // Bottom of deepest node by node count:
    // 2-node: node2 at y=217.26, h=225 → bottom=442.26 (no port growth)
    // 3-node: back node at y=247.26, h=220+34.4=254.4 → bottom=501.66
    // 4-node: back node at y=250.26, h=220+68.8=288.8 → bottom=539.06
    const noteY = nodeCount === 2 ? 448 : nodeCount === 3 ? 508 : 545;
    const storagePortCount = nodeCount === 2 ? 2 : nodeCount === 3 ? 4 : 6;
    const noteText = `⚡ Switchless storage · ${nodeCount}-node · ${storagePortCount} storage ports · direct node-to-node connections`;
    const switchlessNote =
        `        <mxCell id="switchless-note-bg-${nodeCount}" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#2D1B00;strokeColor=#FF9900;strokeWidth=1;arcSize=50;opacity=90;" value="" vertex="1">\n` +
        `          <mxGeometry height="22" width="340" x="570" y="${noteY}" as="geometry" />\n` +
        `        </mxCell>\n` +
        `        <mxCell id="switchless-note-${nodeCount}" parent="1" style="text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;fontSize=9;fontColor=#FF9900;fontStyle=1" value="${noteText}" vertex="1">\n` +
        `          <mxGeometry height="22" width="340" x="570" y="${noteY}" as="geometry" />\n` +
        `        </mxCell>`;

    // Insert before </root>
    content = content.replace('</root>', switchlessNote + '\n      </root>');

    // 8. Ensure BG rect and page are tall enough to contain all notes
    const NOTE_H = 22;
    const NOTE_BOTTOM_PAD = 8;
    // For 3-node, mgmt note is at y=508; WL note is also at y=508
    // Use the highest note bottom across all clusters
    const mgmtNoteBottom = nodeCount === 3 ? (508 + NOTE_H + NOTE_BOTTOM_PAD) : 0;
    const wlNoteBottom = noteY + NOTE_H + NOTE_BOTTOM_PAD;
    const requiredBottom = Math.max(mgmtNoteBottom, wlNoteBottom);
    // Get the actual current BG height from the file (may have been grown by adjustMgmtClusterSwitchless)
    const bgHeightMatch = content.match(new RegExp(`id="${BG_RECT}"[\\s\\S]*?height="([^"]+)"`));
    let currentBgHeight = 480 + extraH; // fallback
    if (bgHeightMatch) {
        currentBgHeight = parseFloat(bgHeightMatch[1]);
    }
    const currentBgBottom = 6 + currentBgHeight;
    if (requiredBottom > currentBgBottom) {
        const delta = Math.ceil(requiredBottom - currentBgBottom);
        content = adjustCellHeight(content, BG_RECT, delta);
        const pageMatch = content.match(/pageHeight="(\d+)"/);
        if (pageMatch) {
            content = setPageHeight(content, String(parseInt(pageMatch[1]) + delta));
        }
    }

    // 9. Generate output filename
    const outboundSuffix = outboundType === 'air-gapped' ? 'Air-Gapped' : 'Limited-Connectivity';
    const outputFile = `ALDO-mgmt-compute-${nodeCount}node-switchless-${outboundSuffix}.drawio`;

    // Write output
    fs.writeFileSync(path.join(SRC_DIR, outputFile), content, 'utf-8');
    console.log(`  Created: ${outputFile}`);
    return outputFile;
}

// Main
console.log('Generating switchless disconnected diagrams...\n');

const generatedFiles = [];
for (const sourceFile of SOURCE_FILES) {
    const archType = getArchType(sourceFile);
    const outboundType = getOutboundType(sourceFile);
    console.log(`Source: ${sourceFile} (${archType}, ${outboundType})`);

    for (const nodeCount of [2, 3, 4]) {
        const outputFile = generateSwitchlessDiagram(sourceFile, nodeCount);
        generatedFiles.push(outputFile);
    }
    console.log('');
}

console.log(`\nDone! Generated ${generatedFiles.length} switchless diagrams.`);
console.log('\nGenerated files:');
generatedFiles.forEach(f => console.log(`  ${f}`));
