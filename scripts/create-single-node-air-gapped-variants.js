#!/usr/bin/env node
/**
 * Create air-gapped variants of single-node fullyconverged and disaggregated diagrams.
 * Applies the same intent-box transformations used on the limited-connectivity versions,
 * but sourcing from the air-gapped base diagram instead.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'docs', 'disconnected-operations');
const SRC = path.join(DIR, 'ALDO-single-node-wl-Air-Gapped.drawio');

function createFullyConverged() {
  let xml = fs.readFileSync(SRC, 'utf8');

  // Title
  xml = xml.replace(
    /Azure Local disconnected operations workoad cluster air.gapped architecture/i,
    'Azure Local disconnected operations fully converged workload cluster air-gapped architecture'
  );

  // Mgmt cluster label
  xml = xml.replace(
    /id="5rdFPu6zPOaKkkA2_qyP-38"([^>]*?)Management \+ Compute/,
    'id="5rdFPu6zPOaKkkA2_qyP-38"$1Mgmt + Compute + Storage'
  );

  // Workload cluster label
  xml = xml.replace(
    /id="zp-9drkoqEdSkVLqGhjB-8"([^>]*?)Management \+ Compute/,
    'id="zp-9drkoqEdSkVLqGhjB-8"$1Mgmt + Compute + Storage'
  );

  // Remove storage intent boxes + children (mgmt and workload clusters)
  const storageIds = [
    'zp-9drkoqEdSkVLqGhjB-19', 'zp-9drkoqEdSkVLqGhjB-20',
    'zp-9drkoqEdSkVLqGhjB-21', 'zp-9drkoqEdSkVLqGhjB-22',
    'zp-9drkoqEdSkVLqGhjB-24', 'zp-9drkoqEdSkVLqGhjB-25',
    'zp-9drkoqEdSkVLqGhjB-26', 'zp-9drkoqEdSkVLqGhjB-27',
  ];
  for (const id of storageIds) {
    const re = new RegExp(`\\s*<mxCell id="${id}"[^>]*(?:/>|>[\\s\\S]*?</mxCell>)\\s*`, 'g');
    xml = xml.replace(re, '\n');
  }

  const dst = path.join(DIR, 'ALDO-single-node-wl-fullyconverged-Air-Gapped.drawio');
  fs.writeFileSync(dst, xml, 'utf8');
  console.log(`Created: ${dst} (${fs.statSync(dst).size} bytes)`);
}

function createDisaggregated() {
  let xml = fs.readFileSync(SRC, 'utf8');

  // Title
  xml = xml.replace(
    /Azure Local disconnected operations workoad cluster air.gapped architecture/i,
    'Azure Local disconnected operations disaggregated workload cluster air-gapped architecture'
  );

  // ═══ MANAGEMENT CLUSTER (parent="5") ═══
  // Shrink Management intent box: 145→95
  xml = xml.replace(
    /(id="5rdFPu6zPOaKkkA2_qyP-37" parent="5"[^>]*vertex="1">)\s*<mxGeometry height="88.65" width="145"/,
    '$1\n          <mxGeometry height="89.65" width="95"'
  );
  // Rename label
  xml = xml.replace(
    /id="5rdFPu6zPOaKkkA2_qyP-38"([^>]*?)Management \+ Compute([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post) => {
      return `id="5rdFPu6zPOaKkkA2_qyP-38"${pre}Management${post}vertex="1">\n          <mxGeometry height="21.35" width="53.52" x="20.36" y="66.17" as="geometry" />`;
    }
  );
  // Reparent Slot-0-Port-1 to node 5
  xml = xml.replace(
    /id="5rdFPu6zPOaKkkA2_qyP-49" parent="5rdFPu6zPOaKkkA2_qyP-37"([^>]*?)fontSize=9([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post) => {
      return `id="5rdFPu6zPOaKkkA2_qyP-49" parent="5"${pre}fontSize=6${post}vertex="1">\n          <mxGeometry height="36.29" width="40" x="11" y="131.23" as="geometry" />`;
    }
  );
  // Reparent Slot-0-Port-2 to node 5
  xml = xml.replace(
    /id="5rdFPu6zPOaKkkA2_qyP-48" parent="5rdFPu6zPOaKkkA2_qyP-37"([^>]*?)fontSize=9([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post) => {
      return `id="5rdFPu6zPOaKkkA2_qyP-48" parent="5"${pre}fontSize=6${post}vertex="1">\n          <mxGeometry height="36.29" width="40" x="53" y="131.23" as="geometry" />`;
    }
  );
  // Reparent SET vSwitch to node 5
  xml = xml.replace(
    /id="5rdFPu6zPOaKkkA2_qyP-50" parent="5rdFPu6zPOaKkkA2_qyP-37"([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre) => {
      return `id="5rdFPu6zPOaKkkA2_qyP-50" parent="5"${pre}vertex="1">\n          <mxGeometry height="17.08" width="80" x="12" y="110.02" as="geometry" />`;
    }
  );
  // Reposition Mgmt vNIC
  xml = xml.replace(
    /(id="5rdFPu6zPOaKkkA2_qyP-51" parent="5"[^>]*vertex="1">)\s*<mxGeometry height="27.599999999999998" width="56" x="49.5" y="79.75"/,
    '$1\n          <mxGeometry height="27.599999999999998" width="56" x="24" y="80"'
  );

  // Resize storage intent
  xml = xml.replace(
    /(id="zp-9drkoqEdSkVLqGhjB-19" parent="5"[^>]*vertex="1">)\s*<mxGeometry height="89.12" width="138.31" x="157" y="101.88"/,
    '$1\n          <mxGeometry height="89.65" width="95" x="200" y="101.35"'
  );
  // Resize storage label
  xml = xml.replace(
    /(id="zp-9drkoqEdSkVLqGhjB-20"[^>]*?)fontSize=10([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post) => {
      return `${pre}fontSize=12${post}vertex="1">\n          <mxGeometry height="21.35" width="53.52" x="20.36" y="66.17" as="geometry" />`;
    }
  );
  // Reparent Slot-1-Port-2 → Slot-2-Port-2
  xml = xml.replace(
    /id="zp-9drkoqEdSkVLqGhjB-21" parent="zp-9drkoqEdSkVLqGhjB-19"([^>]*?)fontSize=9([^>]*?)value="Slot-1-Port-2"([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post, post2) => {
      return `id="zp-9drkoqEdSkVLqGhjB-21" parent="5"${pre}fontSize=6${post}value="Slot-2-Port-2"${post2}vertex="1">\n          <mxGeometry height="36.29" width="40" x="248" y="131.23" as="geometry" />`;
    }
  );
  // Reparent Slot-1-Port-1 → Slot-2-Port-1
  xml = xml.replace(
    /id="zp-9drkoqEdSkVLqGhjB-22" parent="zp-9drkoqEdSkVLqGhjB-19"([^>]*?)fontSize=9([^>]*?)value="Slot-1-Port-1"([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post, post2) => {
      return `id="zp-9drkoqEdSkVLqGhjB-22" parent="5"${pre}fontSize=6${post}value="Slot-2-Port-1"${post2}vertex="1">\n          <mxGeometry height="36.29" width="40" x="206" y="131.23" as="geometry" />`;
    }
  );

  // Add compute intent block for management cluster
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
  xml = xml.replace(
    /(id="zp-9drkoqEdSkVLqGhjB-22"[^>]*>[\s\S]*?<\/mxCell>)/,
    '$1' + mgmtComputeBlock
  );

  // ═══ WORKLOAD CLUSTER (parent="JwsQfcPdxONgqVIScywy-134") ═══
  // Shrink Management intent box
  xml = xml.replace(
    /(id="zp-9drkoqEdSkVLqGhjB-7" parent="JwsQfcPdxONgqVIScywy-134"[^>]*vertex="1">)\s*<mxGeometry height="89.65" width="145"/,
    '$1\n          <mxGeometry height="89.65" width="95"'
  );
  // Fix x position
  xml = xml.replace(
    /(id="zp-9drkoqEdSkVLqGhjB-7"[^>]*>)\s*<mxGeometry height="89.65" width="95" x="6.75" y="124.34/,
    '$1\n          <mxGeometry height="89.65" width="95" x="5" y="120'
  );
  // Rename label
  xml = xml.replace(
    /id="zp-9drkoqEdSkVLqGhjB-8"([^>]*?)Management \+ Compute([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post) => {
      return `id="zp-9drkoqEdSkVLqGhjB-8"${pre}Management${post}vertex="1">\n          <mxGeometry height="21.35" width="53.52" x="20.36" y="66.17" as="geometry" />`;
    }
  );
  // Reparent Slot-0-Port-1
  xml = xml.replace(
    /id="zp-9drkoqEdSkVLqGhjB-9" parent="zp-9drkoqEdSkVLqGhjB-7"([^>]*?)fontSize=9([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post) => {
      return `id="zp-9drkoqEdSkVLqGhjB-9" parent="JwsQfcPdxONgqVIScywy-134"${pre}fontSize=6${post}vertex="1">\n          <mxGeometry height="36.29" width="40" x="11" y="149.88" as="geometry" />`;
    }
  );
  // Reparent Slot-0-Port-2
  xml = xml.replace(
    /id="zp-9drkoqEdSkVLqGhjB-10" parent="zp-9drkoqEdSkVLqGhjB-7"([^>]*?)fontSize=9([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post) => {
      return `id="zp-9drkoqEdSkVLqGhjB-10" parent="JwsQfcPdxONgqVIScywy-134"${pre}fontSize=6${post}vertex="1">\n          <mxGeometry height="36.29" width="40" x="53" y="149.88" as="geometry" />`;
    }
  );
  // Reparent SET vSwitch
  xml = xml.replace(
    /id="zp-9drkoqEdSkVLqGhjB-11" parent="zp-9drkoqEdSkVLqGhjB-7"([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre) => {
      return `id="zp-9drkoqEdSkVLqGhjB-11" parent="JwsQfcPdxONgqVIScywy-134"${pre}vertex="1">\n          <mxGeometry height="17.08" width="80" x="12" y="128.68" as="geometry" />`;
    }
  );
  // Reposition Mgmt vNIC
  xml = xml.replace(
    /(id="zp-9drkoqEdSkVLqGhjB-12" parent="JwsQfcPdxONgqVIScywy-134"[^>]*vertex="1">)\s*<mxGeometry height="27.599999999999998" width="56" x="51.25" y="102.74/,
    '$1\n          <mxGeometry height="27.599999999999998" width="56" x="24" y="100'
  );

  // Resize storage intent
  xml = xml.replace(
    /(id="zp-9drkoqEdSkVLqGhjB-24" parent="JwsQfcPdxONgqVIScywy-134"[^>]*vertex="1">)\s*<mxGeometry height="89.12" width="138.31" x="154.69[^"]*" y="124.34/,
    '$1\n          <mxGeometry height="89.65" width="95" x="200" y="120'
  );
  // Resize storage label
  xml = xml.replace(
    /(id="zp-9drkoqEdSkVLqGhjB-25"[^>]*?)fontSize=10([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post) => {
      return `${pre}fontSize=12${post}vertex="1">\n          <mxGeometry height="21.35" width="53.52" x="20.36" y="66.17" as="geometry" />`;
    }
  );
  // Reparent Slot-1-Port-2 → Slot-2-Port-2
  xml = xml.replace(
    /id="zp-9drkoqEdSkVLqGhjB-26" parent="zp-9drkoqEdSkVLqGhjB-24"([^>]*?)fontSize=9([^>]*?)value="Slot-1-Port-2"([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post, post2) => {
      return `id="zp-9drkoqEdSkVLqGhjB-26" parent="JwsQfcPdxONgqVIScywy-134"${pre}fontSize=6${post}value="Slot-2-Port-2"${post2}vertex="1">\n          <mxGeometry height="36.29" width="40" x="248" y="149.88" as="geometry" />`;
    }
  );
  // Reparent Slot-1-Port-1 → Slot-2-Port-1
  xml = xml.replace(
    /id="zp-9drkoqEdSkVLqGhjB-27" parent="zp-9drkoqEdSkVLqGhjB-24"([^>]*?)fontSize=9([^>]*?)value="Slot-1-Port-1"([^>]*?)vertex="1">\s*<mxGeometry[^/]*\/>/,
    (m, pre, post, post2) => {
      return `id="zp-9drkoqEdSkVLqGhjB-27" parent="JwsQfcPdxONgqVIScywy-134"${pre}fontSize=6${post}value="Slot-2-Port-1"${post2}vertex="1">\n          <mxGeometry height="36.29" width="40" x="206" y="149.88" as="geometry" />`;
    }
  );

  // Add compute intent block for workload cluster
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
  xml = xml.replace(
    /(id="zp-9drkoqEdSkVLqGhjB-27"[^>]*>[\s\S]*?<\/mxCell>)/,
    '$1' + wlComputeBlock
  );

  const dst = path.join(DIR, 'ALDO-single-node-wl-disaggregated-Air-Gapped.drawio');
  fs.writeFileSync(dst, xml, 'utf8');
  console.log(`Created: ${dst} (${fs.statSync(dst).size} bytes)`);
}

createFullyConverged();
createDisaggregated();
