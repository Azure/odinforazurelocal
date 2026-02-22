#!/usr/bin/env node
/**
 * Create single-node workload cluster FULLY CONVERGED diagram
 * from the existing single-node workload cluster (mgmt+compute / storage) diagram.
 *
 * Fully converged = single intent box "Mgmt + Compute + Storage" with all ports blue.
 * Changes:
 *   - Management cluster node1: merge 2 intent boxes → 1
 *   - Workload cluster node1: merge 2 intent boxes → 1
 *   - Remove storage intent containers + children
 *   - Change label from "Management + Compute" → "Mgmt + Compute + Storage"
 *   - Update title
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'docs', 'disconnected-operations',
  'ALDO-single-node-wl-Limited-Connectivity.drawio');
const DST = path.join(__dirname, '..', 'docs', 'disconnected-operations',
  'ALDO-single-node-wl-fullyconverged-Limited-Connectivity.drawio');

let xml = fs.readFileSync(SRC, 'utf8');

// ─── 1. Update title ────────────────────────────────────────────────────────
xml = xml.replace(
  'Azure Local disconnected operations workoad cluster limited connectivity architecture',
  'Azure Local disconnected operations fully converged workload cluster limited connectivity architecture'
);

// ─── 2. MANAGEMENT CLUSTER node1 (parent="5") ──────────────────────────────
// 2a. Change label from "Management + Compute" to "Mgmt + Compute + Storage"
//     (inside intent box 5rdFPu6zPOaKkkA2_qyP-38, parent=5rdFPu6zPOaKkkA2_qyP-37)
xml = xml.replace(
  'id="5rdFPu6zPOaKkkA2_qyP-38" parent="5rdFPu6zPOaKkkA2_qyP-37"' +
  ' style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;' +
  'fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;"' +
  ' value="&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Management + Compute&lt;/font&gt;"',
  'id="5rdFPu6zPOaKkkA2_qyP-38" parent="5rdFPu6zPOaKkkA2_qyP-37"' +
  ' style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;' +
  'fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;"' +
  ' value="&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Mgmt + Compute + Storage&lt;/font&gt;"'
);

// 2b. Remove storage intent container + children (zp-9drkoqEdSkVLqGhjB-19, -20, -21, -22)
const mgmtStorageIds = ['zp-9drkoqEdSkVLqGhjB-19', 'zp-9drkoqEdSkVLqGhjB-20',
  'zp-9drkoqEdSkVLqGhjB-21', 'zp-9drkoqEdSkVLqGhjB-22'];
for (const id of mgmtStorageIds) {
  // Remove entire <mxCell ... /> or <mxCell ...>...</mxCell> element
  const re = new RegExp(`\\s*<mxCell id="${id}"[^>]*(?:/>|>[\\s\\S]*?</mxCell>)\\s*`, 'g');
  xml = xml.replace(re, '\n');
}

// ─── 3. WORKLOAD CLUSTER node1 (parent="JwsQfcPdxONgqVIScywy-134") ────────
// 3a. Change label from "Management + Compute" to "Mgmt + Compute + Storage"
//     (inside intent box zp-9drkoqEdSkVLqGhjB-8, parent=zp-9drkoqEdSkVLqGhjB-7)
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-8" parent="zp-9drkoqEdSkVLqGhjB-7"' +
  ' style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;' +
  'fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;"' +
  ' value="&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Management + Compute&lt;/font&gt;"',
  'id="zp-9drkoqEdSkVLqGhjB-8" parent="zp-9drkoqEdSkVLqGhjB-7"' +
  ' style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;' +
  'fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;"' +
  ' value="&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Mgmt + Compute + Storage&lt;/font&gt;"'
);

// 3b. Remove storage intent container + children (zp-9drkoqEdSkVLqGhjB-24, -25, -26, -27)
const wlStorageIds = ['zp-9drkoqEdSkVLqGhjB-24', 'zp-9drkoqEdSkVLqGhjB-25',
  'zp-9drkoqEdSkVLqGhjB-26', 'zp-9drkoqEdSkVLqGhjB-27'];
for (const id of wlStorageIds) {
  const re = new RegExp(`\\s*<mxCell id="${id}"[^>]*(?:/>|>[\\s\\S]*?</mxCell>)\\s*`, 'g');
  xml = xml.replace(re, '\n');
}

fs.writeFileSync(DST, xml, 'utf8');
console.log(`Created: ${DST}`);
console.log(`Size: ${fs.statSync(DST).size} bytes`);
