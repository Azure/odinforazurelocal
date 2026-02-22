#!/usr/bin/env node
/**
 * Create single-node workload cluster DISAGGREGATED diagram
 * from the existing single-node workload cluster (mgmt+compute / storage) diagram.
 *
 * Disaggregated = 3 separate intent boxes: Management, Compute, Storage
 * Each intent has 2 ports (6 total per node): Slot-0 (blue), Slot-1 (green), Slot-2 (purple)
 *
 * Changes on both management cluster node1 and workload cluster node1:
 *   - Shrink Management+Compute intent box (145→95w), relabel to "Management"
 *   - Move ports from intent box children → node children, shrink to 40w, fontSize 6
 *   - Shrink storage intent box (138→95w), reposition
 *   - Rename Slot-1 ports → Slot-2, change x positions
 *   - Add Compute intent box (green, 95w) between management and storage
 *   - Add 2 green Slot-1 ports as node children
 *   - Add SET vSwitch inside compute intent
 *   - Reposition Mgmt SET vSwitch as node child
 *   - Update title
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'docs', 'disconnected-operations',
  'ALDO-single-node-wl-Limited-Connectivity.drawio');
const DST = path.join(__dirname, '..', 'docs', 'disconnected-operations',
  'ALDO-single-node-wl-disaggregated-Limited-Connectivity.drawio');

let xml = fs.readFileSync(SRC, 'utf8');

// ─── TITLE ──────────────────────────────────────────────────────────────────
xml = xml.replace(
  'Azure Local disconnected operations workoad cluster limited connectivity architecture',
  'Azure Local disconnected operations disaggregated workload cluster limited connectivity architecture'
);

// ════════════════════════════════════════════════════════════════════════════
// MANAGEMENT CLUSTER — node1 (parent="5")
// ════════════════════════════════════════════════════════════════════════════

// ── 1. Management intent box: shrink width 145→95 ──
xml = xml.replace(
  'id="5rdFPu6zPOaKkkA2_qyP-37" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1E3A5F;strokeColor=#0078D4;strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;spacingBottom=0;spacingTop=0;" value="" vertex="1">\n' +
  '          <mxGeometry height="88.65" width="145" x="5" y="101.35" as="geometry" />',
  'id="5rdFPu6zPOaKkkA2_qyP-37" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1E3A5F;strokeColor=#0078D4;strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;spacingBottom=0;spacingTop=0;" value="" vertex="1">\n' +
  '          <mxGeometry height="89.65" width="95" x="5" y="101.35" as="geometry" />'
);

// ── 2. Management label: rename, resize ──
xml = xml.replace(
  'id="5rdFPu6zPOaKkkA2_qyP-38" parent="5rdFPu6zPOaKkkA2_qyP-37" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;" value="&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Management + Compute&lt;/font&gt;" vertex="1">\n' +
  '          <mxGeometry height="18.472355065391373" width="127.27" x="9" y="66.2513224673043" as="geometry" />',
  'id="5rdFPu6zPOaKkkA2_qyP-38" parent="5rdFPu6zPOaKkkA2_qyP-37" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;" value="&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Management&lt;/font&gt;" vertex="1">\n' +
  '          <mxGeometry height="21.35" width="53.52" x="20.36" y="66.17" as="geometry" />'
);

// ── 3. Slot-0-Port-1: reparent to node 5, shrink to 40w, fontSize 6 ──
xml = xml.replace(
  'id="5rdFPu6zPOaKkkA2_qyP-49" parent="5rdFPu6zPOaKkkA2_qyP-37" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#0055A4;strokeColor=#005A9E;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;" value="Slot-0-Port-1" vertex="1">\n' +
  '          <mxGeometry height="31.398677532695686" width="56.76" x="9" y="28.622644934608626" as="geometry" />',
  'id="5rdFPu6zPOaKkkA2_qyP-49" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#0055A4;strokeColor=#005A9E;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;" value="Slot-0-Port-1" vertex="1">\n' +
  '          <mxGeometry height="36.29" width="40" x="11" y="131.23" as="geometry" />'
);

// ── 4. Slot-0-Port-2: reparent to node 5, shrink ──
xml = xml.replace(
  'id="5rdFPu6zPOaKkkA2_qyP-48" parent="5rdFPu6zPOaKkkA2_qyP-37" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#0055A4;strokeColor=#005A9E;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;" value="Slot-0-Port-2" vertex="1">\n' +
  '          <mxGeometry height="31.398677532695686" width="58.43" x="76.57" y="28.622644934608626" as="geometry" />',
  'id="5rdFPu6zPOaKkkA2_qyP-48" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#0055A4;strokeColor=#005A9E;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;" value="Slot-0-Port-2" vertex="1">\n' +
  '          <mxGeometry height="36.29" width="40" x="53" y="131.23" as="geometry" />'
);

// ── 5. SET vSwitch in management: reparent to node 5 ──
xml = xml.replace(
  'id="5rdFPu6zPOaKkkA2_qyP-50" parent="5rdFPu6zPOaKkkA2_qyP-37" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#808080;strokeColor=none;fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;" value="SET vSwitch" vertex="1">\n' +
  '          <mxGeometry height="14.777884052313096" width="94.7505301602262" x="25.120054194156456" y="8.073898106578177" as="geometry" />',
  'id="5rdFPu6zPOaKkkA2_qyP-50" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#808080;strokeColor=none;fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;" value="SET vSwitch" vertex="1">\n' +
  '          <mxGeometry height="17.08" width="80" x="12" y="110.02" as="geometry" />'
);

// ── 6. Mgmt vNIC: reposition ──
xml = xml.replace(
  'id="5rdFPu6zPOaKkkA2_qyP-51" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#006600;strokeColor=none;fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;" value="Mgmt vNIC" vertex="1">\n' +
  '          <mxGeometry height="27.599999999999998" width="56" x="49.5" y="79.75" as="geometry" />',
  'id="5rdFPu6zPOaKkkA2_qyP-51" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#006600;strokeColor=none;fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;" value="Mgmt vNIC" vertex="1">\n' +
  '          <mxGeometry height="27.599999999999998" width="56" x="24" y="80" as="geometry" />'
);

// ── 7. Storage intent container: resize 138→95, reposition ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-19" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#2D1B69;strokeColor=#8B5CF6;strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;align=center;fontFamily=Helvetica;fontSize=12;fontColor=default;" value="" vertex="1">\n' +
  '          <mxGeometry height="89.12" width="138.31" x="157" y="101.88" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-19" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#2D1B69;strokeColor=#8B5CF6;strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;align=center;fontFamily=Helvetica;fontSize=12;fontColor=default;" value="" vertex="1">\n' +
  '          <mxGeometry height="89.65" width="95" x="200" y="101.35" as="geometry" />'
);

// ── 8. Storage label: resize ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-20" parent="zp-9drkoqEdSkVLqGhjB-19" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=default;fontSize=10;fontFamily=Helvetica;" value="Storage" vertex="1">\n' +
  '          <mxGeometry height="21.223781372002232" width="77.92112676056338" x="30.19078650852483" y="65.63881093139989" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-20" parent="zp-9drkoqEdSkVLqGhjB-19" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=default;fontSize=12;fontFamily=Helvetica;" value="Storage" vertex="1">\n' +
  '          <mxGeometry height="21.35" width="53.52" x="20.36" y="66.17" as="geometry" />'
);

// ── 9. Storage Slot-1-Port-2 → Slot-2-Port-2, reparent to 5, recolor, resize ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-21" parent="zp-9drkoqEdSkVLqGhjB-19" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#5B3ABF;strokeColor=none;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Slot-1-Port-2" vertex="1">\n' +
  '          <mxGeometry height="31.398677532695686" width="56.76" x="74.88999999999999" y="28.860000000000024" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-21" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#5B3ABF;strokeColor=none;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Slot-2-Port-2" vertex="1">\n' +
  '          <mxGeometry height="36.29" width="40" x="248" y="131.23" as="geometry" />'
);

// ── 10. Storage Slot-1-Port-1 → Slot-2-Port-1, reparent to 5, recolor, resize ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-22" parent="zp-9drkoqEdSkVLqGhjB-19" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#5B3ABF;strokeColor=none;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Slot-1-Port-1" vertex="1">\n' +
  '          <mxGeometry height="31.398677532695686" width="56.76" x="6.650000000000006" y="28.860000000000024" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-22" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#5B3ABF;strokeColor=none;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Slot-2-Port-1" vertex="1">\n' +
  '          <mxGeometry height="36.29" width="40" x="206" y="131.23" as="geometry" />'
);

// ── 11. Add Compute intent box + label + SET vSwitch + green ports (mgmt cluster) ──
const mgmtComputeBlock = `
        <mxCell id="DIS-SNWL-1" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#006600;strokeColor=#80FF00;strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;" value="" vertex="1">
          <mxGeometry height="89.65" width="95" x="102.5" y="101.35" as="geometry" />
        </mxCell>
        <mxCell id="DIS-SNWL-2" parent="DIS-SNWL-1" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;" value="&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Compute&lt;/font&gt;" vertex="1">
          <mxGeometry height="21.35" width="53.52" x="20.36" y="66.17" as="geometry" />
        </mxCell>
        <mxCell id="DIS-SNWL-3" parent="DIS-SNWL-1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#808080;strokeColor=none;fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;" value="SET vSwitch" vertex="1">
          <mxGeometry height="17.08" width="80" x="7.12" y="10.74" as="geometry" />
        </mxCell>
        <mxCell id="DIS-SNWL-4" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#4D9900;strokeColor=none;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;" value="Slot-1-Port-1" vertex="1">
          <mxGeometry height="36.29" width="40" x="108.5" y="131.23" as="geometry" />
        </mxCell>
        <mxCell id="DIS-SNWL-5" parent="5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#4D9900;strokeColor=none;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Slot-1-Port-2" vertex="1">
          <mxGeometry height="36.29" width="40" x="150.5" y="131.23" as="geometry" />
        </mxCell>`;

// Insert after the storage intent block (after zp-9drkoqEdSkVLqGhjB-22's closing tag)
// Find last mgmt-cluster storage port (zp-9drkoqEdSkVLqGhjB-22) closing
xml = xml.replace(
  /(id="zp-9drkoqEdSkVLqGhjB-22"[^>]*>[\s\S]*?<\/mxCell>)/,
  '$1' + mgmtComputeBlock
);


// ════════════════════════════════════════════════════════════════════════════
// WORKLOAD CLUSTER — node1 (parent="JwsQfcPdxONgqVIScywy-134")
// ════════════════════════════════════════════════════════════════════════════

// ── 12. Management intent box: shrink width 145→95 ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-7" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1E3A5F;strokeColor=#0078D4;strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;" value="" vertex="1">\n' +
  '          <mxGeometry height="89.65" width="145" x="6.75" y="124.34000000000003" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-7" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1E3A5F;strokeColor=#0078D4;strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;" value="" vertex="1">\n' +
  '          <mxGeometry height="89.65" width="95" x="5" y="120" as="geometry" />'
);

// ── 13. Management label rename ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-8" parent="zp-9drkoqEdSkVLqGhjB-7" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;" value="&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Management + Compute&lt;/font&gt;" vertex="1">\n' +
  '          <mxGeometry height="21.35" width="127.27" x="9" y="66.17" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-8" parent="zp-9drkoqEdSkVLqGhjB-7" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;" value="&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Management&lt;/font&gt;" vertex="1">\n' +
  '          <mxGeometry height="21.35" width="53.52" x="20.36" y="66.17" as="geometry" />'
);

// ── 14. Slot-0-Port-1: reparent to workload node, shrink ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-9" parent="zp-9drkoqEdSkVLqGhjB-7" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#0055A4;strokeColor=#005A9E;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;" value="Slot-0-Port-1" vertex="1">\n' +
  '          <mxGeometry height="31.398677532695686" width="56.76" x="8.24" y="29.88" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-9" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#0055A4;strokeColor=#005A9E;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;" value="Slot-0-Port-1" vertex="1">\n' +
  '          <mxGeometry height="36.29" width="40" x="11" y="149.88" as="geometry" />'
);

// ── 15. Slot-0-Port-2: reparent to workload node, shrink ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-10" parent="zp-9drkoqEdSkVLqGhjB-7" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#0055A4;strokeColor=#005A9E;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;" value="Slot-0-Port-2" vertex="1">\n' +
  '          <mxGeometry height="31.398677532695686" width="58.43" x="76.57" y="29.88" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-10" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#0055A4;strokeColor=#005A9E;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;" value="Slot-0-Port-2" vertex="1">\n' +
  '          <mxGeometry height="36.29" width="40" x="53" y="149.88" as="geometry" />'
);

// ── 16. SET vSwitch in management: reparent to workload node ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-11" parent="zp-9drkoqEdSkVLqGhjB-7" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#808080;strokeColor=none;fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;" value="SET vSwitch" vertex="1">\n' +
  '          <mxGeometry height="17.08" width="94.7505301602262" x="23.830054194156457" y="8.8" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-11" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#808080;strokeColor=none;fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;" value="SET vSwitch" vertex="1">\n' +
  '          <mxGeometry height="17.08" width="80" x="12" y="128.68" as="geometry" />'
);

// ── 17. Mgmt vNIC: reposition ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-12" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#333333;strokeColor=none;fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Mgmt vNIC" vertex="1">\n' +
  '          <mxGeometry height="27.599999999999998" width="56" x="51.25" y="102.74000000000001" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-12" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#333333;strokeColor=none;fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Mgmt vNIC" vertex="1">\n' +
  '          <mxGeometry height="27.599999999999998" width="56" x="24" y="100" as="geometry" />'
);

// ── 18. Storage intent container: resize + reposition ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-24" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#2D1B69;strokeColor=#8B5CF6;strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;align=center;fontFamily=Helvetica;fontSize=12;fontColor=default;" value="" vertex="1">\n' +
  '          <mxGeometry height="89.12" width="138.31" x="154.69000000000005" y="124.34000000000003" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-24" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#2D1B69;strokeColor=#8B5CF6;strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;align=center;fontFamily=Helvetica;fontSize=12;fontColor=default;" value="" vertex="1">\n' +
  '          <mxGeometry height="89.65" width="95" x="200" y="120" as="geometry" />'
);

// ── 19. Storage label resize ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-25" parent="zp-9drkoqEdSkVLqGhjB-24" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=default;fontSize=10;fontFamily=Helvetica;" value="Storage" vertex="1">\n' +
  '          <mxGeometry height="21.223781372002232" width="77.92112676056338" x="30.19078650852483" y="65.63881093139989" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-25" parent="zp-9drkoqEdSkVLqGhjB-24" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=default;fontSize=12;fontFamily=Helvetica;" value="Storage" vertex="1">\n' +
  '          <mxGeometry height="21.35" width="53.52" x="20.36" y="66.17" as="geometry" />'
);

// ── 20. Slot-1-Port-2 → Slot-2-Port-2, reparent, reposition ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-26" parent="zp-9drkoqEdSkVLqGhjB-24" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#5B3ABF;strokeColor=none;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Slot-1-Port-2" vertex="1">\n' +
  '          <mxGeometry height="31.398677532695686" width="56.76" x="74.88999999999999" y="28.860000000000024" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-26" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#5B3ABF;strokeColor=none;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Slot-2-Port-2" vertex="1">\n' +
  '          <mxGeometry height="36.29" width="40" x="248" y="149.88" as="geometry" />'
);

// ── 21. Slot-1-Port-1 → Slot-2-Port-1, reparent, reposition ──
xml = xml.replace(
  'id="zp-9drkoqEdSkVLqGhjB-27" parent="zp-9drkoqEdSkVLqGhjB-24" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#5B3ABF;strokeColor=none;fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Slot-1-Port-1" vertex="1">\n' +
  '          <mxGeometry height="31.398677532695686" width="56.76" x="6.650000000000006" y="28.860000000000024" as="geometry" />',
  'id="zp-9drkoqEdSkVLqGhjB-27" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#5B3ABF;strokeColor=none;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Slot-2-Port-1" vertex="1">\n' +
  '          <mxGeometry height="36.29" width="40" x="206" y="149.88" as="geometry" />'
);

// ── 22. Add Compute intent box + label + SET vSwitch + green ports (workload cluster) ──
const wlComputeBlock = `
        <mxCell id="DIS-SNWL-10" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#006600;strokeColor=#80FF00;strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;" value="" vertex="1">
          <mxGeometry height="89.65" width="95" x="102.5" y="120" as="geometry" />
        </mxCell>
        <mxCell id="DIS-SNWL-11" parent="DIS-SNWL-10" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;" value="&lt;font style=&quot;color: rgb(255, 255, 255);&quot;&gt;Compute&lt;/font&gt;" vertex="1">
          <mxGeometry height="21.35" width="53.52" x="20.36" y="66.17" as="geometry" />
        </mxCell>
        <mxCell id="DIS-SNWL-12" parent="DIS-SNWL-10" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#808080;strokeColor=none;fontColor=#ffffff;fontSize=9;fontStyle=0;arcSize=15;" value="SET vSwitch" vertex="1">
          <mxGeometry height="17.08" width="80" x="7.12" y="10.74" as="geometry" />
        </mxCell>
        <mxCell id="DIS-SNWL-13" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#4D9900;strokeColor=none;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;" value="Slot-1-Port-1" vertex="1">
          <mxGeometry height="36.29" width="40" x="108.5" y="149.88" as="geometry" />
        </mxCell>
        <mxCell id="DIS-SNWL-14" parent="JwsQfcPdxONgqVIScywy-134" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#4D9900;strokeColor=none;fontColor=#FFFFFF;fontSize=6;fontStyle=1;arcSize=15;align=center;verticalAlign=middle;fontFamily=Helvetica;" value="Slot-1-Port-2" vertex="1">
          <mxGeometry height="36.29" width="40" x="150.5" y="149.88" as="geometry" />
        </mxCell>`;

// Insert after last workload storage port (zp-9drkoqEdSkVLqGhjB-27)
xml = xml.replace(
  /(id="zp-9drkoqEdSkVLqGhjB-27"[^>]*>[\s\S]*?<\/mxCell>)/,
  '$1' + wlComputeBlock
);

fs.writeFileSync(DST, xml, 'utf8');
console.log(`Created: ${DST}`);
console.log(`Size: ${fs.statSync(DST).size} bytes`);
