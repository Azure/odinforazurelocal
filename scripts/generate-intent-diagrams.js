#!/usr/bin/env node
/**
 * Generates compute-storage (3-intent) and 4-intent draw.io diagrams
 * from existing disaggregated templates.
 *
 * Input: 2 existing disaggregated diagrams (air-gapped + limited-connectivity)
 * Output: 4 new diagrams:
 *   - 2 compute-storage: relabel Management → Mgmt + Compute, same 3-intent layout
 *   - 2 4-intent: add Compute 2 container + ports, narrow all containers/ports
 *
 * Compute-Storage (3 intents, 6 ports):
 *   Slot-0: Mgmt + Compute (blue) | Slot-1: Compute (green) | Slot-2: Storage (purple)
 *
 * 4-Intent (4 intents, 8 ports):
 *   Slot-0: Mgmt + Compute (blue) | Slot-1: Compute 1 (green) |
 *   Slot-2: Compute 2 (green) | Slot-3: Storage (purple)
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'docs', 'disconnected-operations');

const SOURCE_FILES = [
    'ALDO-disaggregated-Air-Gapped.drawio',
    'ALDO-disaggregated-Limited-Connectivity.drawio'
];

const TITLE_CELL = 'heOv2aa4RVyxCJM62_e7-10';

// ============================================================
// Cluster definitions — exact cell IDs from disaggregated template
// ============================================================
const CLUSTERS = [
    {
        name: 'mgmt',
        nodeId: '5',
        nodeX: 89.5,
        containers: {
            mgmt:    { id: '5rdFPu6zPOaKkkA2_qyP-37', labelId: '5rdFPu6zPOaKkkA2_qyP-38' },
            compute: { id: '5rdFPu6zPOaKkkA2_qyP-39', labelId: '5rdFPu6zPOaKkkA2_qyP-40',
                       setId: '5rdFPu6zPOaKkkA2_qyP-41' },
            storage: { id: '5rdFPu6zPOaKkkA2_qyP-44', labelId: '5rdFPu6zPOaKkkA2_qyP-45' }
        },
        ports: {
            slot0: { p1: '5rdFPu6zPOaKkkA2_qyP-49', p2: '5rdFPu6zPOaKkkA2_qyP-48' },
            slot1: { p1: '5rdFPu6zPOaKkkA2_qyP-43', p2: '5rdFPu6zPOaKkkA2_qyP-42' },
            slot2: { p1: '5rdFPu6zPOaKkkA2_qyP-47', p2: '5rdFPu6zPOaKkkA2_qyP-46' }
        },
        mgmtSetId:  '5rdFPu6zPOaKkkA2_qyP-50',
        mgmtVnicId: '5rdFPu6zPOaKkkA2_qyP-51',
        containerY: 101.35,  // y offset of containers within node
        portY: 131.23,       // y offset of ports within node
        absoluteSlot0: false  // all children use parent=nodeId (relative)
    },
    {
        name: 'wl1',
        nodeId: 'JwsQfcPdxONgqVIScywy-134',
        nodeX: 593.5,
        containers: {
            mgmt:    { id: 'JwsQfcPdxONgqVIScywy-135', labelId: 'JwsQfcPdxONgqVIScywy-136' },
            compute: { id: '5rdFPu6zPOaKkkA2_qyP-10', labelId: '5rdFPu6zPOaKkkA2_qyP-11',
                       setId: '5rdFPu6zPOaKkkA2_qyP-18' },
            storage: { id: '5rdFPu6zPOaKkkA2_qyP-14', labelId: '5rdFPu6zPOaKkkA2_qyP-15' }
        },
        ports: {
            // Slot-0 ports have parent="1" (absolute canvas coordinates)
            slot0: { p1: 'JwsQfcPdxONgqVIScywy-137', p2: 'JwsQfcPdxONgqVIScywy-138',
                     absolute: true },
            slot1: { p1: '5rdFPu6zPOaKkkA2_qyP-13', p2: '5rdFPu6zPOaKkkA2_qyP-12' },
            slot2: { p1: '5rdFPu6zPOaKkkA2_qyP-17', p2: '5rdFPu6zPOaKkkA2_qyP-16' }
        },
        // These cells also have parent="1" (absolute positioning)
        mgmtSetId:  'JwsQfcPdxONgqVIScywy-139',
        mgmtVnicId: 'JwsQfcPdxONgqVIScywy-144',
        mgmtSetAbsolute:  true,
        mgmtVnicAbsolute: true,
        containerY: 120,
        portY: 149.88,
        absoluteSlot0: true
    },
    {
        name: 'wl2',
        nodeId: 'JwsQfcPdxONgqVIScywy-189',
        nodeX: 1045.5,
        containers: {
            mgmt:    { id: '5rdFPu6zPOaKkkA2_qyP-20', labelId: '5rdFPu6zPOaKkkA2_qyP-21' },
            compute: { id: '5rdFPu6zPOaKkkA2_qyP-22', labelId: '5rdFPu6zPOaKkkA2_qyP-23',
                       setId: '5rdFPu6zPOaKkkA2_qyP-24' },
            storage: { id: '5rdFPu6zPOaKkkA2_qyP-27', labelId: '5rdFPu6zPOaKkkA2_qyP-28' }
        },
        ports: {
            slot0: { p1: '5rdFPu6zPOaKkkA2_qyP-32', p2: '5rdFPu6zPOaKkkA2_qyP-31' },
            slot1: { p1: '5rdFPu6zPOaKkkA2_qyP-26', p2: '5rdFPu6zPOaKkkA2_qyP-25' },
            slot2: { p1: '5rdFPu6zPOaKkkA2_qyP-30', p2: '5rdFPu6zPOaKkkA2_qyP-29' }
        },
        mgmtSetId:  '5rdFPu6zPOaKkkA2_qyP-33',
        mgmtVnicId: '5rdFPu6zPOaKkkA2_qyP-34',
        containerY: 121.09,
        portY: 150.97,
        absoluteSlot0: false
    }
];

// ============================================================
// 4-intent layout constants (within 300px-wide node)
// ============================================================
const LAYOUT_4 = {
    containerWidth: 70,
    // Positions: Mgmt+Compute=5, Compute1=78, Compute2=151, Storage=224
    containerX: { mgmt: 5, compute1: 78, compute2: 151, storage: 224 },
    portWidth: 30,
    // Port positions (p1, p2) relative to node for each slot
    portX: {
        slot0: [8, 40],    // under Mgmt+Compute container
        slot1: [81, 113],  // under Compute 1 container
        slot2: [154, 186], // under Compute 2 container (NEW)
        slot3: [227, 259]  // under Storage container (was Slot-2)
    },
    setVSwitchWidth: 56,     // inside Compute containers (was 80)
    setVSwitchX: 7,          // inside Compute containers (was 7.12)
    mgmtSetWidth: 56,        // Mgmt SET vSwitch on node (was 80)
    mgmtSetX: 9,             // (was 12)
    mgmtVnicWidth: 44,       // Mgmt vNIC on node (was 56)
    mgmtVnicX: 18            // (was 24)
};

// ============================================================
// Helper functions
// ============================================================

function getOutboundType(filename) {
    if (filename.includes('Air-Gapped')) return 'air-gapped';
    if (filename.includes('Limited-Connectivity')) return 'limited-connectivity';
    throw new Error(`Unknown outbound type in: ${filename}`);
}

function getOutboundLabel(outboundType) {
    return outboundType === 'air-gapped' ? 'air-gapped' : 'limited connectivity';
}

function getOutboundSuffix(filename) {
    return filename.includes('Air-Gapped') ? 'Air-Gapped' : 'Limited-Connectivity';
}

/**
 * Change value attribute of a cell with the given ID.
 */
function setCellValue(content, cellId, newValue) {
    const escaped = cellId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(id="${escaped}"[^>]*\\bvalue=")([^"]*)(")`, 'g');
    return content.replace(regex, `$1${newValue}$3`);
}

/**
 * Modify geometry of a cell (width, height, x, y).
 * Finds the cell by ID, then modifies the next <mxGeometry> element.
 */
function setCellGeometry(content, cellId, props) {
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

// ============================================================
// Compute-Storage diagram generation (simple label swap)
// ============================================================

function generateComputeStorageDiagram(sourceFile) {
    let content = fs.readFileSync(path.join(SRC_DIR, sourceFile), 'utf-8');

    // 1. Replace Management → Mgmt + Compute in all HTML-wrapped labels.
    //    Pattern: &gt;Management&lt; appears inside font tags in value attributes.
    //    This catches all 3 clusters (mgmt, WL1, WL2) at once.
    content = content.replace(/&gt;Management&lt;/g, '&gt;Mgmt + Compute&lt;');

    // 2. Update title
    const outboundLabel = getOutboundLabel(getOutboundType(sourceFile));
    content = setCellValue(content, TITLE_CELL,
        `Azure Local disconnected operations compute + storage ${outboundLabel} architecture`);

    // 3. Write output
    const suffix = getOutboundSuffix(sourceFile);
    const outputFile = `ALDO-compute-storage-${suffix}.drawio`;
    fs.writeFileSync(path.join(SRC_DIR, outputFile), content, 'utf-8');
    console.log(`  Created: ${outputFile}`);
    return outputFile;
}

// ============================================================
// 4-Intent diagram generation (add Compute 2, reposition all)
// ============================================================

function generate4IntentDiagram(sourceFile) {
    let content = fs.readFileSync(path.join(SRC_DIR, sourceFile), 'utf-8');

    // ---- Step 1: Rename labels globally ----
    // Management → Mgmt + Compute
    content = content.replace(/&gt;Management&lt;/g, '&gt;Mgmt + Compute&lt;');
    // Compute → Compute 1 (safe: won't match "Mgmt + Compute" since "&gt;" prefix)
    content = content.replace(/&gt;Compute&lt;/g, '&gt;Compute 1&lt;');

    // ---- Step 2: Rename storage ports Slot-2 → Slot-3 ----
    content = content.replace(/value="Slot-2-Port-1"/g, 'value="Slot-3-Port-1"');
    content = content.replace(/value="Slot-2-Port-2"/g, 'value="Slot-3-Port-2"');

    // ---- Step 3: Resize/reposition containers, ports, SET vSwitches per cluster ----
    for (const cluster of CLUSTERS) {
        const L = LAYOUT_4;

        // 3a. Containers: narrow to 70px, reposition
        content = setCellGeometry(content, cluster.containers.mgmt.id,
            { width: L.containerWidth });  // x stays at 5
        content = setCellGeometry(content, cluster.containers.compute.id,
            { width: L.containerWidth, x: L.containerX.compute1 });
        content = setCellGeometry(content, cluster.containers.storage.id,
            { width: L.containerWidth, x: L.containerX.storage });

        // 3b. Labels: adjust geometry for narrower containers
        content = setCellGeometry(content, cluster.containers.mgmt.labelId,
            { x: 8, width: 54 });
        content = setCellGeometry(content, cluster.containers.compute.labelId,
            { x: 8, width: 54 });
        content = setCellGeometry(content, cluster.containers.storage.labelId,
            { x: 8, width: 54 });

        // 3c. Compute SET vSwitch (inside compute container): narrow
        content = setCellGeometry(content, cluster.containers.compute.setId,
            { width: L.setVSwitchWidth, x: L.setVSwitchX });

        // 3d. Mgmt SET vSwitch (on node or absolute)
        if (cluster.mgmtSetAbsolute) {
            content = setCellGeometry(content, cluster.mgmtSetId,
                { width: L.mgmtSetWidth, x: cluster.nodeX + L.mgmtSetX });
        } else {
            content = setCellGeometry(content, cluster.mgmtSetId,
                { width: L.mgmtSetWidth, x: L.mgmtSetX });
        }

        // 3e. Mgmt vNIC (on node or absolute)
        if (cluster.mgmtVnicAbsolute) {
            content = setCellGeometry(content, cluster.mgmtVnicId,
                { width: L.mgmtVnicWidth, x: cluster.nodeX + L.mgmtVnicX });
        } else {
            content = setCellGeometry(content, cluster.mgmtVnicId,
                { width: L.mgmtVnicWidth, x: L.mgmtVnicX });
        }

        // 3f. Slot-0 ports (Mgmt+Compute)
        if (cluster.absoluteSlot0) {
            content = setCellGeometry(content, cluster.ports.slot0.p1,
                { width: L.portWidth, x: cluster.nodeX + L.portX.slot0[0] });
            content = setCellGeometry(content, cluster.ports.slot0.p2,
                { width: L.portWidth, x: cluster.nodeX + L.portX.slot0[1] });
        } else {
            content = setCellGeometry(content, cluster.ports.slot0.p1,
                { width: L.portWidth, x: L.portX.slot0[0] });
            content = setCellGeometry(content, cluster.ports.slot0.p2,
                { width: L.portWidth, x: L.portX.slot0[1] });
        }

        // 3g. Slot-1 ports (Compute 1)
        content = setCellGeometry(content, cluster.ports.slot1.p1,
            { width: L.portWidth, x: L.portX.slot1[0] });
        content = setCellGeometry(content, cluster.ports.slot1.p2,
            { width: L.portWidth, x: L.portX.slot1[1] });

        // 3h. Slot-2→Slot-3 storage ports (already renamed, reposition)
        content = setCellGeometry(content, cluster.ports.slot2.p1,
            { width: L.portWidth, x: L.portX.slot3[0] });
        content = setCellGeometry(content, cluster.ports.slot2.p2,
            { width: L.portWidth, x: L.portX.slot3[1] });
    }

    // ---- Step 4: Add new Compute 2 containers, labels, SET vSwitches, ports ----
    let newCells = '';

    // Styles (copied from existing Compute intent cells)
    const CONTAINER_STYLE = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#006600;strokeColor=#80FF00;' +
        'strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;';
    const LABEL_STYLE = 'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;' +
        'fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;';
    const SET_STYLE = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#808080;strokeColor=none;' +
        'fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;';
    const PORT_STYLE = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#4D9900;strokeColor=none;' +
        'fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;' +
        'fontFamily=Helvetica;';

    const LABEL_VALUE = '&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Compute 2&lt;/font&gt;';

    for (const cluster of CLUSTERS) {
        const prefix = `4intent-${cluster.name}`;
        const L = LAYOUT_4;
        const parentId = cluster.nodeId;

        // Compute 2 container
        newCells += `        <mxCell id="${prefix}-compute2" parent="${parentId}" ` +
            `style="${CONTAINER_STYLE}" value="" vertex="1">\n`;
        newCells += `          <mxGeometry height="89.65" width="${L.containerWidth}" ` +
            `x="${L.containerX.compute2}" y="${cluster.containerY}" as="geometry" />\n`;
        newCells += `        </mxCell>\n`;

        // Compute 2 label
        newCells += `        <mxCell id="${prefix}-compute2-label" parent="${prefix}-compute2" ` +
            `style="${LABEL_STYLE}" value="${LABEL_VALUE}" vertex="1">\n`;
        newCells += `          <mxGeometry height="21.35" width="54" x="8" y="66.17" as="geometry" />\n`;
        newCells += `        </mxCell>\n`;

        // Compute 2 SET vSwitch
        newCells += `        <mxCell id="${prefix}-compute2-set" parent="${prefix}-compute2" ` +
            `style="${SET_STYLE}" value="SET vSwitch" vertex="1">\n`;
        newCells += `          <mxGeometry height="17.08" width="${L.setVSwitchWidth}" ` +
            `x="${L.setVSwitchX}" y="10.74" as="geometry" />\n`;
        newCells += `        </mxCell>\n`;

        // Slot-2-Port-1 (Compute 2)
        newCells += `        <mxCell id="${prefix}-slot2-port1" parent="${parentId}" ` +
            `style="${PORT_STYLE}" value="Slot-2-Port-1" vertex="1">\n`;
        newCells += `          <mxGeometry height="36.29" width="${L.portWidth}" ` +
            `x="${L.portX.slot2[0]}" y="${cluster.portY}" as="geometry" />\n`;
        newCells += `        </mxCell>\n`;

        // Slot-2-Port-2 (Compute 2)
        newCells += `        <mxCell id="${prefix}-slot2-port2" parent="${parentId}" ` +
            `style="${PORT_STYLE}" value="Slot-2-Port-2" vertex="1">\n`;
        newCells += `          <mxGeometry height="36.29" width="${L.portWidth}" ` +
            `x="${L.portX.slot2[1]}" y="${cluster.portY}" as="geometry" />\n`;
        newCells += `        </mxCell>\n`;
    }

    // Insert all new cells before </root>
    content = content.replace('</root>', newCells + '      </root>');

    // ---- Step 5: Update title ----
    const outboundLabel = getOutboundLabel(getOutboundType(sourceFile));
    content = setCellValue(content, TITLE_CELL,
        `Azure Local disconnected operations 4-intent ${outboundLabel} architecture`);

    // ---- Step 6: Write output ----
    const suffix = getOutboundSuffix(sourceFile);
    const outputFile = `ALDO-4intent-${suffix}.drawio`;
    fs.writeFileSync(path.join(SRC_DIR, outputFile), content, 'utf-8');
    console.log(`  Created: ${outputFile}`);
    return outputFile;
}

// ============================================================
// Main
// ============================================================

console.log('Generating compute-storage and 4-intent diagrams...\n');

const generatedFiles = [];
for (const sourceFile of SOURCE_FILES) {
    const outboundType = getOutboundType(sourceFile);
    console.log(`Source: ${sourceFile} (${outboundType})`);

    generatedFiles.push(generateComputeStorageDiagram(sourceFile));
    generatedFiles.push(generate4IntentDiagram(sourceFile));
    console.log('');
}

console.log(`Done! Generated ${generatedFiles.length} diagrams.\n`);
console.log('Generated files:');
generatedFiles.forEach(f => console.log(`  ${f}`));
