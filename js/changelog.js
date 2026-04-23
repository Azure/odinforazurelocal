// Shared changelog modal - loaded by both Designer and Sizer pages
// Show changelog/what's new
/**
 * Opens the shared "What's New" changelog modal.
 * Intended to be called from HTML (e.g. onclick handlers).
 * @global
 */
function showChangelog() { // eslint-disable-line no-unused-vars
    const overlay = document.createElement('div');

    // Reusable close handler — used by X button, overlay click, and Escape key.
    const closeChangelog = () => {
        document.removeEventListener('keydown', onKeyDown);
        overlay.removeEventListener('click', onOverlayClick);
        if (overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }
        if (window.closeChangelog === closeChangelog) {
            window.closeChangelog = undefined;
        }
    };
    const onOverlayClick = (e) => {
        if (e.target === overlay) {
            window.closeChangelog && window.closeChangelog();
        }
    };
    const onKeyDown = (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') closeChangelog();
    };
    window.closeChangelog = closeChangelog;
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
        padding: 10px;
        box-sizing: border-box;
    `;

    overlay.innerHTML = `
        <div style="background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 20px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--accent-blue); font-size: 18px;">What's New</h3>
                <button onclick="closeChangelog()" style="background: transparent; border: none; color: var(--text-secondary); font-size: 28px; cursor: pointer; padding: 0 8px; line-height: 1;">&times;</button>
            </div>

            <div style="color: var(--text-primary); line-height: 1.8;">
                <div style="margin-bottom: 24px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-left: 4px solid var(--accent-blue); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-blue);">Version 0.20.06</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">April 23, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🧩 Disaggregated ARM Parameters (create-cluster-san)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>New ARM branch:</strong> Generate ARM now emits an Azure-Local-SAN–shaped <code>deploymentParameters.json</code> when Designer is in the Disaggregated architecture — based on the upstream <code>microsoft.azurestackhci/create-cluster-san</code> quickstart. Emits <code>configurationMode: "InfraOnly"</code>, <code>infraVolLunId</code>, <code>infraPerfLunId</code>, <code>sanNetworkList</code>, and a single <code>MgmtCompute</code> intent; HCI-only params (<code>storageNetworkList</code>, <code>enableStorageAutoIp</code>) are suppressed.</li>
                        <li><strong>DA8 Step 16 — Storage Pool + LUN IDs:</strong> Auto-locked to <code>InfraOnly</code> for Disaggregated with required inputs for the two SAN LUN IDs the template needs (Infrastructure Volume + Cluster Performance History).</li>
                        <li><strong>DA4 — Cluster VLAN access/trunk toggle:</strong> Per-row mode toggle for cluster1/cluster2 on the VLAN grid. Access mode (default) emits <code>vlanId: 0</code> in ARM — host sends untagged, matching the reference template. Trunk mode passes the numeric VLAN through. cluster1 and cluster2 are paired (toggling one toggles the other). DA8 cluster inputs are now read-only and track the DA4 mode.</li>
                        <li><strong>Readiness gate:</strong> Generate ARM is blocked with a clear message when Disaggregated is selected but the LUN IDs are blank or Storage Pool Configuration is not <code>InfraOnly</code>.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔌 Disaggregated Prerequisites &amp; Leaf-Scope Banners</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>ARM Tools — SAN pre-deployment checklist:</strong> When the payload is Disaggregated, the ARM Tools page shows a purple pre-deployment checklist banner listing what must be staged before Validate: fabric zoning, array host registrations, LUN mapping, leaf VLAN config, and cluster-network reachability.</li>
                        <li><strong>Switch Config — leaf-only scope banner:</strong> Switch Config page shows a banner when the Designer is Disaggregated, calling out that it emits leaf-only configuration and that spine/EVPN fabric, SAN fibre-channel zoning, and array host registrations are out of scope.</li>
                        <li><strong>Switch Config — Per-Rack Leaf Switches (up to 8 racks / 16 ToRs):</strong> New "Per-Rack Leaf Switches" panel (SC1b) for disaggregated deployments covering <strong>every rack (Rack 1–N, 1–8 racks)</strong>. Each rack has its own collapsible card — grouped under Identity, Loopbacks &amp; BGP, Management SVI IPs, P2P Links to Spine, and iBGP Peering — with editable ToR-A/ToR-B/BMC hostnames, site, per-rack BGP ASN (auto-increments from 64789), loopback pair, Mgmt SVI IPs, per-rack P2P underlay links to Border1/Border2 (/30), and per-rack iBGP peering IPs. Legacy single-rack Rack 1 fields in SC1/SC3 are hidden for disaggregated; only the shared Border Router BGP ASN remains in SC3. Generator emits up to 16 ToR + 8 BMC configs per run; tabs scroll horizontally.</li>
                        <li><strong>DA4 — Editable Cluster Network names:</strong> Disaggregated DA4 Cluster A / Cluster B rows now have a Network Name input. Custom names flow to the DA8 Adapter Mapping intent-zone titles, the DA8 Overrides card headings, and ARM <code>sanNetworkList.clusterNetworkConfig.adapterIPConfig[*].name</code> (sanitized: spaces → hyphens).</li>
                        <li><strong>Report — Responsive rack layout:</strong> Rack Layout SVG now uses <code>viewBox</code> + <code>max-width: 100%</code> so 6-, 8-, and 16-rack disaggregated layouts scale to fit the report column instead of overflowing horizontally.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🏗️ Disaggregated Architecture Wizard</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>New disaggregated wizard:</strong> End-to-end wizard for disaggregated deployments with external SAN storage (Fibre Channel, iSCSI 4-NIC, iSCSI 6-NIC) and Clos leaf-spine fabric — up to 64 nodes across multiple racks.</li>
                        <li><strong>VLAN/VNI/VRF configuration:</strong> Full VLAN, VNI, and VRF setup for management, cluster, iSCSI, and backup networks with tenant network management.</li>
                        <li><strong>QoS policy &amp; IP planning:</strong> QoS policy configuration, Clos topology diagram, and per-network IP allocation with subnet planning.</li>
                        <li><strong>Drag-and-drop NIC mapping:</strong> Map physical NICs to intent zones (Compute+Mgmt, Cluster, Storage/Backup) with per-port speed configuration.</li>
                        <li><strong>Breadcrumb navigation:</strong> Step progress breadcrumb with auto-completion tracking across the DA wizard flow.</li>
                        <li><strong>Host networking preview:</strong> Interactive SVG diagrams for hyperconverged, switchless, FC SAN, and iSCSI topologies with light/dark SVG export.</li>
                        <li><strong>SVG rack topology:</strong> Interactive multi-rack topology diagram with leaf-spine interconnects and downloadable SVG.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔌 ToR Switch Config Generator &amp; QoS Validator</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>New Switch Config page:</strong> Full-featured ToR switch configuration generator for Cisco NX-OS and Dell OS10 platforms — generates ToR, BMC, and border switch configs from a structured JSON data model.</li>
                        <li><strong>Rack-aware 4-ToR support:</strong> TOR1–TOR4 configurations with correct iBGP peering, loopback IPs, storage VLAN assignment, and per-rack HSRP/VRRP priorities.</li>
                        <li><strong>BMC switch configs:</strong> BMC switch config with access VLANs, trunks to ToRs, and static default route.</li>
                        <li><strong>Infrastructure tokens:</strong> Timezone (with DST), NTP, syslog, TACACS+, SNMP, management VLAN, and management gateway — all replaceable placeholders in rendered configs.</li>
                        <li><strong>JSON export:</strong> Export structured JSON data model for each switch section (TOR1, TOR2, TOR3, TOR4, BMC).</li>
                        <li><strong>Designer integration:</strong> "Generate / Validate ToR Switch Configuration" button on the Designer summary page transfers deployment state to the switch config page (opens in new tab).</li>
                        <li><strong>QoS Configuration Validator:</strong> Paste a <code>show running-config</code> (Cisco) or <code>show running-configuration</code> (Dell OS10) to validate PFC, ETS bandwidth reservations, ECN, MTU 9216, system QoS policy, and interface-level PFC/trunking against Azure Local requirements — all processing is client-side.</li>
                        <li><strong>Validator — Deployment Type profiles:</strong> Dropdown to score the pasted config against the right rule set: <em>Auto-detect from Designer</em>, <em>Hyperconverged — Switched</em>, <em>Hyperconverged — Switchless</em>, <em>Disaggregated — Fibre Channel SAN</em>, and <em>Disaggregated — iSCSI (evolving guidance)</em>. HCI Switchless reports PFC/ECN/ETS-storage/ETS-cluster/system-qos/interface-PFC as <strong>N/A</strong> (storage &amp; cluster NICs are back-to-back, not on the ToR). Disaggregated FC SAN reports the Ethernet-side storage checks as N/A (storage is on the FC fabric) while Cluster CSV/LM QoS still applies. Disaggregated iSCSI demotes storage-side checks from <code>fail</code> to <code>warn</code> as a placeholder — authoritative guidance is tracked for a future release. Results include a grey <code>&#x2139;&#xFE0F; N not applicable</code> count alongside pass/warn/fail.</li>
                        <li><strong>Cisco 93108TC-FX3P as ToR:</strong> Added 10GBASE-T copper switch model as a ToR option (fully converged, switched, and switchless).</li>
                        <li><strong>Per-Rack Site / Location:</strong> Rack-aware deployments support separate Site / Location for Rack 1 and Rack 2 (SNMP location).</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📐 Report: 2D SVG Rack Diagram</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>SVG rack layout:</strong> Static 2D front-view SVG rack diagram in the Report page with 42U rack frames, server nodes (2U), ToR switches (1U), BMC switches (1U), and U-position markers.</li>
                        <li><strong>Core switch visualization:</strong> Core Switch / Router / Firewall box rendered above racks.</li>
                        <li><strong>Rack-aware layout:</strong> Multi-rack diagrams with contiguous node numbering across racks (Node 1–4 in Rack 1, Node 5–8 in Rack 2).</li>
                        <li><strong>Azure Local branding:</strong> Azure Local instance icon and "Azure Local" text in top-right corner.</li>
                        <li><strong>Download:</strong> "Download Rack Diagram SVG" button exports the diagram as a standalone SVG file.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🖥️ 3D Rack Visualization Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Azure Local branding:</strong> Replaced Microsoft Azure logo with Azure Local instance icon + "Azure Local" purple text; replaced Azure "A" on server fronts with azurelocal-machine.svg.</li>
                        <li><strong>BMC switch:</strong> Added 1U BMC switch (white/light grey) below ToR switches in every rack, including single-node.</li>
                        <li><strong>ToR switch color:</strong> Changed from green to dark grey (#444444) for better visual contrast.</li>
                        <li><strong>Single-node topology:</strong> Single-node deployments now show 1 ToR switch and 1 BMC switch with ToR-to-router cabling.</li>
                        <li><strong>Label cleanup:</strong> Removed "(Front)" suffix from all devices; renamed "TOR" → "ToR"; contiguous node numbering across racks.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📝 Designer: Management VLAN Guidance</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Improved VLAN descriptions:</strong> Default VLAN card now reads "Untagged — management traffic uses the native VLAN (ID 0 on the host)"; Custom VLAN card updated to "Tag management traffic with a specific VLAN ID on the host NICs".</li>
                        <li><strong>Expanded info box:</strong> Explains that even with untagged host traffic (ID 0), the ToR switch assigns it to a VLAN internally, and the switch-side VLAN ID is configured separately in the Switch Config Generator.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">⚖️ Sizer: Low Capacity Cluster Type</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Low Capacity deployment type:</strong> New cluster type option enforcing Azure Local low capacity hardware limits — 1–3 nodes, single socket, max 14 physical cores, 32–128 GB memory per node, max 192 GB GPU VRAM.</li>
                        <li><strong>Auto-constrained hardware:</strong> Core dropdown, socket count, and memory slider automatically limited to deployment maximums. All-flash storage only (no cache tier).</li>
                        <li><strong>3D Visualization:</strong> Rack visualization renders correctly for 1–3 node low capacity configurations.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">⚖️ Sizer: Disaggregated Storage</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Disaggregated Storage deployment type:</strong> Rack count <strong>1–8</strong>, spine switch count (2/4), and storage connectivity (Fibre Channel / iSCSI) selectors — total cluster capped at 64 nodes with per-rack node maximum reduced (16/12/10/9/8 for 4/5/6/7/8 racks).</li>
                        <li><strong>Two-row 3D layout for 5+ racks:</strong> Disaggregated deployments with more than 4 racks render in two rows with a true hot-aisle / cold-aisle orientation — spine switches sit centered above the hot aisle, per-rack uplink cables exit the ToR rear, route above and beside the spine stack, and land on the spine rear face.</li>
                        <li><strong>3D Visualization:</strong> FC switches (purple) rendered per rack for Fibre Channel; per-rack blue uplink cables to spine switches; no SMB/LAG cables for disaggregated; explanatory note clarifying that the external SAN appliance is not rendered.</li>
                        <li><strong>Auto-scale beyond 16 nodes:</strong> Sizer auto-scaler can now grow node count beyond the single-site 16-node limit when workload demand requires it (up to 64 nodes for disaggregated).</li>
                        <li><strong>Designer → Sizer transfer:</strong> Rack count, spine count, and storage type transfer from Designer; <code>disaggSpineCount</code> is preserved in both directions; all buttons open in new tabs.</li>
                        <li><strong>Import/Export:</strong> Disaggregated state persisted in save, resume, and JSON import/export.</li>
                        <li><strong>QoS Validator:</strong> Smart PFC detection using QoS service-policy; dynamic CoS detection; actionable warnings listing specific interfaces.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-blue); margin: 0 0 12px 0;">🏢 Sizer: Enterprise Features</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Import from Azure Portal:</strong> Paste a machine JSON View to import exact CPU model, core count, sockets, and memory — non-catalog CPUs shown with "(imported)" label.</li>
                        <li><strong>Share Config as URL:</strong> Encode your full Sizer configuration in a shareable URL with optional name — recipients see a branded confirmation banner.</li>
                        <li><strong>CSV Export:</strong> Download hardware BOM as a CSV spreadsheet for procurement and planning.</li>
                        <li><strong>Save as PDF:</strong> New "Save as PDF" export on both the Designer and the Sizer — renders the current summary / sizing view as a multi-page PDF for sharing and archiving.</li>
                        <li><strong>Capacity Runway:</strong> 5-year growth projection table showing when vCPU, memory, or storage will exceed 90% capacity.</li>
                        <li><strong>Power Breakdown:</strong> Verbose per-component power calculations with PSU efficiency (Titanium 96%), network infrastructure, and full assumptions.</li>
                        <li><strong>VM Capacity Check:</strong> VMs exceeding per-machine capacity trigger errors, block Designer export, and show toast warnings.</li>
                        <li><strong>Pricing Link:</strong> Azure Local pricing calculator link with hardware cost caveat.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-blue); margin: 0 0 12px 0;">📄 Report & Site Structure</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Outbound / Arc / Proxy / Private Endpoints:</strong> Moved into the Configuration Summary immediately after Infrastructure Network for a more logical read-order, and a new direct link to the Interactive Outbound Connectivity Diagram Builder. The redundant higher-level Connectivity section has been removed.</li>
                        <li><strong>Leaf &amp; Spine fabric diagrams:</strong> Stacked full-width in the report for better readability on wide screens.</li>
                        <li><strong>Cleaner Switch Config URL:</strong> The Switch Config Generator now lives at <code>/switch-config/</code> (was <code>/switch-config.html</code>).</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--success); margin: 0 0 12px 0;">🔧 Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>SDN Feature Toggle:</strong> Generate buttons now update immediately when checking LNET/NSG features.</li>
                        <li><strong>Disaggregated Resume:</strong> DA wizard steps now fully restore card selections and slider values on session resume.</li>
                        <li><strong>Sizer Logo Toggle:</strong> ODIN logo correctly switches between dark/light variants in the Sizer.</li>
                        <li><strong>Leaf &amp; Spine heading:</strong> Fixed a double-escaped ampersand in the "Leaf &amp; Spine Fabric Requirements" heading.</li>
                        <li><strong>Rack Layout badge:</strong> Fixed a malformed step-number badge in the cluster report.</li>
                        <li><strong>Onboarding on touch:</strong> Hover transform restricted to hover-capable devices so touch users no longer see sticky hover states.</li>
                        <li><strong>969 Tests:</strong> Test suite grew to 969 tests covering disaggregated 1–8 racks, two-row 3D math, <code>disaggSpineCount</code> round-trip, PDF export, and all session-resume state keys.</li>
                    </ul>
                </div>

                <hr style="border: none; border-top: 2px solid var(--glass-border); margin: 24px 0;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Previous: Version 0.18.04</div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 12px 0;">🖥️ Sizer: 3D Rack Visualization</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Interactive 3D rack preview:</strong> Renders 42U open-frame server cabinets with detailed 2U server nodes (disk bays, LEDs, Azure logo, dual PSUs, network ports) and 1U ToR switches (48-port ethernet, QSFP uplinks).</li>
                        <li><strong>Rack-aware support:</strong> Rack-aware deployments render two side-by-side cabinets with balanced node distribution and blue core switch/router.</li>
                        <li><strong>Network topology:</strong> Management/compute uplinks (blue), SMB storage trunks (pink) between cross-rack ToR pairs, and LAG inter-switch links (orange) between paired ToRs.</li>
                        <li><strong>Dynamic updates:</strong> Visualization re-renders in real-time as sizer inputs change (node count, cluster type, disk config).</li>
                        <li><strong>Interactive controls:</strong> Left-click and hold to rotate, scroll to zoom, right-click and hold to move. Touch-device friendly.</li>
                        <li><strong>Azure branding:</strong> Microsoft Azure logo overlay and Azure "A" logo on each server node.</li>
                    </ul>
                </div>

                <hr style="border: none; border-top: 2px solid var(--glass-border); margin: 24px 0;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Previous: Version 0.18.03</div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 12px 0;">🔧 ARM Parameters: Fix Custom Location Name (fixes <a href="https://github.com/Azure/odinforazurelocal/issues/189" target="_blank">#189</a>)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Fix customLocation parameter key:</strong> Fixed a bug where the "Custom Location Name" input field on the ARM Parameters page was not updating the <code>customLocation</code> value in the generated parameter JSON — the update code referenced a mismatched key (<code>customLocationName</code> instead of <code>customLocation</code>).</li>
                        <li><strong>Pre-population fix:</strong> The custom location input field also now correctly pre-populates from the parameter JSON when loading a template.</li>
                    </ul>
                </div>

                <hr style="border: none; border-top: 2px solid var(--glass-border); margin: 24px 0;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Previous: Version 0.18.02</div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 12px 0;">🔧 Designer: Fix NIC overrideAdapterProperty (fixes <a href="https://github.com/Azure/odinforazurelocal/issues/187" target="_blank">#187</a>)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Fix overrideAdapterProperty:</strong> Fixed a bug where disabling RDMA on NICs assigned to the Management+Compute intent (e.g., in a switchless 4+ NIC configuration) would generate <code>"overrideAdapterProperty": false</code> in the ARM parameter JSON instead of <code>true</code>.</li>
                        <li><strong>NIC-Level RDMA Detection:</strong> The ARM intent generator now detects NIC-level RDMA changes made at Step 07 (Port Configuration) and correctly sets the override flag.</li>
                        <li><strong>Auto-Disable Flag:</strong> When Step 08 auto-disables RDMA for an intent group because no NICs are RDMA-capable, the adapter property touched flag is now set.</li>
                    </ul>
                </div>

                <hr style="border: none; border-top: 2px solid var(--glass-border); margin: 24px 0;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Previous: Version 0.18.01</div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 12px 0;">🎮 Sizer: GPU Capacity Planning (closes <a href="https://github.com/Azure/odinforazurelocal/issues/180" target="_blank">#180</a>)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>GPU Workload Requirements:</strong> All three workload types (Azure Local VMs, AKS Arc, AVD) now support GPU mode selection — DDA and GPU-P.</li>
                        <li><strong>GPU Model Selectors:</strong> DDA and GPU-P modes include GPU model dropdowns with homogeneous locking — once a GPU model is selected, it's enforced across all workloads and the hardware config (WORKLOAD badge).</li>
                        <li><strong>Per-Model GPU-P Partitions:</strong> Partition sizes filter based on selected GPU model, showing VRAM per partition (e.g., A2 up to 1:8, L40S up to 1:16).</li>
                        <li><strong>GPU Capacity Bar:</strong> New GPU capacity bar showing consumed vs available GPUs with N−1 node awareness.</li>
                        <li><strong>GPU Auto-Scaling:</strong> GPU demand drives node count and GPUs-per-node auto-scaling (AUTO badge) up to each model's physical maximum.</li>
                        <li><strong>GPU Models:</strong> Added NVIDIA T4, RTX Pro 6000, and H100 with correct maxPerNode limits (up to 2/node).</li>
                        <li><strong>AKS GPU VM Sizes:</strong> All supported GPU-enabled VM SKUs with fixed vCPU/memory — auto-sets hardware GPU type.</li>
                        <li><strong>GPU Badge:</strong> Workload cards show a yellow "GPU" badge when GPU-enabled.</li>
                        <li><strong>Threshold Warnings:</strong> GPU ≥90% triggers warnings and blocks Designer export.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 12px 0;">📊 Sizer: Total VM Requirements (closes <a href="https://github.com/Azure/odinforazurelocal/issues/181" target="_blank">#181</a>)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Total VM Input Mode:</strong> New "Total VM Requirements" option — enter aggregate vCPU, memory, storage, and GPU totals directly.</li>
                        <li><strong>Input Mode First:</strong> Input Mode selector is now the first field in the VM modal.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 12px 0;">⚙️ Sizer: 3:1 vCPU Overcommit Ratio</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>3:1 Option:</strong> Added the missing 3:1 vCPU overcommit ratio to the Advanced Settings dropdown.</li>
                    </ul>
                </div>

                <hr style="border: none; border-top: 2px solid var(--glass-border); margin: 24px 0;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Previous: Version 0.17.61</div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 12px 0;">🔧 Sizer: Fix Resume Session Banner (fixes <a href="https://github.com/Azure/odinforazurelocal/issues/178" target="_blank">#178</a>)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Fix Resume Banner:</strong> Fixed the "Previous Sizer Session Found" banner appearing unconditionally on every page load, even when no workloads were added — the banner now only appears when there are actual workloads to resume.</li>
                        <li><strong>Fix Start Fresh Re-Save:</strong> Fixed "Start Fresh" immediately re-saving default state, causing the banner to reappear on the next page load.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">⚙️ Sizer: Intel® 6th Gen Xeon® (Granite Rapids / Sierra Forest)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Intel® 6th Gen Xeon® Expanded:</strong> Expanded the Intel® 6th Gen Xeon® CPU generation in the Sizer to cover the full 8–172 core range from the <a href="https://azurelocalsolutions.azure.microsoft.com" target="_blank">Azure Local hardware catalog</a> — includes both Granite Rapids (P-cores) and Sierra Forest (E-cores) codenames.</li>
                        <li><strong>Updated Intel Default:</strong> Intel CPU default changed from 5th Gen Xeon® (Emerald Rapids) to Intel® 6th Gen Xeon® (Granite Rapids / Sierra Forest).</li>
                    </ul>
                </div>

                <hr style="border: none; border-top: 2px solid var(--glass-border); margin: 24px 0;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Previous: Version 0.17.58</div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🏷️ Sizer: Individual MANUAL Override Dismiss</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Per-Field Dismiss:</strong> Each MANUAL badge now includes a small × button to remove that individual override — no need to clear all overrides at once.</li>
                        <li><strong>Shared Flag Handling:</strong> CPU-related fields (cores, sockets, manufacturer, generation) share a single lock — dismissing any one clears all four CPU badges together.</li>
                        <li><strong>Remove All Button:</strong> The existing "Remove MANUAL overrides" button is renamed to "Remove all MANUAL overrides" for clarity.</li>
                        <li><strong>Auto-Scale on Dismiss:</strong> Dismissing a MANUAL override immediately triggers auto-scaling — the field reverts to an optimal value and receives the purple AUTO badge.</li>
                    </ul>
                </div>

                <hr style="border: none; border-top: 2px solid var(--glass-border); margin: 24px 0;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Previous: Version 0.17.56</div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">⚖️ Designer-to-Sizer Transfer</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Add Workloads Button:</strong> New "⚖️ Sizer: Add Workloads to this Cluster" button at the bottom of the Designer — transfers deployment type and node count to the Sizer so you can add workloads to the cluster you have designed.</li>
                        <li><strong>Smart Mapping:</strong> Automatically maps Designer scenario and scale to the correct Sizer deployment type — Standard, Rack-Aware, Single Node, ALDO Management, and ALDO Workload clusters are all supported.</li>
                        <li><strong>Sizer Import:</strong> The Sizer now accepts configuration from the Designer — pre-populates cluster type and node count with a confirmation banner showing what was imported.</li>
                        <li><strong>MANUAL Node Lock:</strong> Node count transferred from the Designer is locked as MANUAL in the Sizer — prevents auto-scaling from overriding the cluster size you designed.</li>
                        <li><strong>Workload Persistence:</strong> Workloads from a prior Sizer session are automatically restored when returning from the Designer; the import banner shows how many workloads were restored.</li>
                    </ul>
                </div>

                <hr style="border: none; border-top: 2px solid var(--glass-border); margin: 24px 0;">
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Previous: Version 0.17.55</div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🧭 Navigation: Tab-Based Routing & Consistency</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>URL Parameter Routing:</strong> All top navigation links (Designer, Knowledge, Sizer) now use <code>?tab=</code> URL parameters for consistent tab switching — parameters cleaned after processing.</li>
                        <li><strong>Designer Link Fix:</strong> Fixed intermittent bug where clicking Designer from the Sizer navigated to the Knowledge tab — stale sessionStorage combined with missing <code>?tab=designer</code> parameter.</li>
                        <li><strong>Session Popup Fix:</strong> Fixed "Previous Session Found" popup appearing incorrectly on the Knowledge tab.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🎨 Knowledge: Flow Diagram Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Flat Background:</strong> Replaced animated stars/space WebGL effects with flat dark backgrounds (<code>#111111</code>) on Public and Private Path flow diagrams.</li>
                        <li><strong>Layout Fix:</strong> Shifted all Public Path Flow diagram elements down to prevent overlap with the Architecture navigation bar.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📐 Sizer: ALDO Workload Cluster</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>New Deployment Type:</strong> Added "ALDO Workload Cluster" — integrates disconnected scenario with workload cluster role in the Designer.</li>
                        <li><strong>FQDN Prompt:</strong> Prompts for Autonomous Cloud FQDN before transferring to Designer.</li>
                        <li><strong>Region Skip:</strong> Skips the region picker when transferring ALDO Workload Cluster to Designer.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🖌️ Sizer: Header Redesign & UI</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Header Layout:</strong> Restructured Sizer header to match the Designer layout — centered title, absolutely-positioned logo, and Firebase analytics stats bar.</li>
                        <li><strong>Disclaimer Banner:</strong> Added disclaimer banner matching the Designer's warning banner.</li>
                        <li><strong>Preview Badge Removed:</strong> Removed the purple "Preview" badge from the Sizer navigation link.</li>
                        <li><strong>Title Update:</strong> Changed page title to "ODIN Sizer for Azure Local" with updated description.</li>
                        <li><strong>Deployment Type:</strong> Renamed "Cluster Type" to "Deployment Type" throughout the Sizer.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Sizer: Analytics Fix</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Missing Dependency:</strong> Fixed page view statistics not loading on the Sizer — added missing <code>utils.js</code> dependency providing <code>formatNumber()</code>.</li>
                        <li><strong>Fallback Fetch:</strong> Added explicit <code>fetchAndDisplayStats()</code> call with 1-second delay as a fallback.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🛠️ Sizer: Configure in Designer Fix</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Navigation Fix:</strong> Fixed "Configure in Designer" navigating to the Knowledge tab instead of Designer — added <code>?tab=designer</code> to the Sizer navigation URL.</li>
                        <li><strong>Import Fix:</strong> Fixed Sizer hardware/workload auto-import not applying in Designer — <code>?from=sizer</code> URL param was being stripped by the tab routing cleanup; now only <code>?tab=</code> is removed.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📊 Analytics & UI</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Visitors Rename:</strong> Renamed "Page Views" to "Visitors" in the stats bar on both Designer and Sizer pages.</li>
                        <li><strong>Feedback Link:</strong> Feedback button now opens GitHub Issues in a full new browser tab instead of a popup window.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📤 Sizer: Export/Import JSON</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Export:</strong> Export complete Sizer configuration (hardware settings, workloads, MANUAL overrides) as a shareable JSON file.</li>
                        <li><strong>Import:</strong> Import previously exported JSON files to restore full Sizer configuration — validates file structure before applying.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔒 Sizer: MANUAL Node Count</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Persistent Lock:</strong> Number of Physical Nodes now supports persistent MANUAL override — selecting a node count locks it from auto-recommendation until cleared.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">💾 Sizer: Configurable S2D Repair Disks</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>New Dropdown:</strong> "Capacity Disks Reserved for Repair" dropdown (0–4) in the Disk Configuration section — defaults to AUTO (1 per node, max 4).</li>
                        <li><strong>MANUAL Override:</strong> Manually set the repair disk count with a persistent MANUAL badge.</li>
                        <li><strong>Warning Note:</strong> Sizing notes display a ⚠️ warning when the manual value is below the recommended reservation based on cluster size.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 8px 0;">Version 0.17.11</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 26, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📚 Knowledge Tab: Embedded Content & Interactive Diagrams</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Embedded Knowledge Tab:</strong> Knowledge tab now loads inline within the main page instead of navigating to a separate page — outbound connectivity architecture guide displayed in an embedded iframe.</li>
                        <li><strong>Interactive Diagrams:</strong> Added interactive WebGL flow diagrams for Public Path and Private Path outbound connectivity architectures, selectable via a left sidebar.</li>
                        <li><strong>Sidebar Navigation:</strong> Left sidebar with links to switch between the Architecture Guide, Public Path Flow diagram, and Private Path Flow diagram — all rendered in-page.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📐 Sizer: ALDO Management Cluster</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>New Cluster Type:</strong> Added "ALDO Management Cluster" to the Sizer — a fixed 3-node, all-flash configuration with three-way mirror resiliency.</li>
                        <li><strong>Fixed Infrastructure:</strong> Node count locked at 3, storage forced to all-flash, resiliency locked to three-way mirror only.</li>
                        <li><strong>Minimum Hardware:</strong> Automatically enforces ALDO minimums — 96 GB memory, 24 physical cores, and 2 TB SSD/NVMe storage per node.</li>
                        <li><strong>Appliance Overhead:</strong> Reserves 64 GB memory per node (192 GB total) for the disconnected operations appliance VM — deducted from available workload capacity.</li>
                        <li><strong>IRVM1 Auto-Workload:</strong> Fixed infrastructure workload (IRVM1 — 24 vCPUs, 78 GB memory, 2 TB storage) automatically added; Add Workload buttons disabled, workload locked from edit/clone/delete.</li>
                        <li><strong>Boot Disk:</strong> Sizing notes recommend 960 GB SSD/NVMe boot disk per node.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">⚙️ Sizer: ARB Overhead</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Cluster-Level Deduction:</strong> Azure Resource Bridge appliance VM (8 GB memory, 4 vCPUs) deducted from available cluster capacity in sizing and capacity bars.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🏷️ Sizer: MANUAL Override Badges</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>MANUAL Badge:</strong> Green "MANUAL" badge appears on any hardware dropdown when a user manually edits the value — visually distinguishes user choices from auto-scaled values.</li>
                        <li><strong>Override Persistence:</strong> MANUAL overrides persist across workload add, edit, delete, and clone — only the explicit button or full reset clears them.</li>
                        <li><strong>Remove Overrides:</strong> "Remove MANUAL overrides" button appears when any override is active — clears all user locks and re-runs auto-scaling.</li>
                        <li><strong>Capacity Warning:</strong> Amber warning when capacity ≥90% while MANUAL overrides are active — identifies which overrides prevent auto-scaling.</li>
                        <li><strong>Independent Disk Locks:</strong> Disk size and disk count are independently lockable — manually setting one still allows auto-scaling on the other.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🔒 Sizer: Three-Way Mirror for 3+ Nodes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Resiliency Lock:</strong> Standard clusters with 3 or more nodes are now locked to three-way mirror only — two-way mirror option removed for 3+ node configurations.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">📝 Sizer: Sizing Notes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Text:</strong> Replaced "RAM" with "memory", updated boot drive text, added spacing around × in storage layout notes.</li>
                        <li><strong>ALDO Link:</strong> Sizing notes include a link to the disconnected operations overview documentation.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🌍 Sizer: Region Picker</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Region Selection Modal:</strong> Select your Azure region in the Sizer before navigating to Designer — prevents the cascade reset that wiped imported cluster configuration.</li>
                        <li><strong>Cloud Toggle:</strong> Radio toggle between Azure Commercial (8 regions) and Azure Government (1 region).</li>
                        <li><strong>Region in Banner:</strong> Import confirmation banner shows the selected region (e.g. "📍 Azure region: West Europe").</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">📋 Report: Sizer Hardware & Workloads</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Hardware in Report:</strong> Full "Hardware Configuration (from Sizer)" section now rendered in the HTML report — CPU, memory, GPU, disks, resiliency, growth, and workload totals.</li>
                        <li><strong>Individual Workloads:</strong> New "Workloads (from Sizer)" section shows per-workload details — VM count/specs, AKS cluster config, AVD users/profile — with subtotals.</li>
                        <li><strong>Transparent Pass-Through:</strong> Individual workload details are passed from Sizer → Designer → Report automatically (not visible in Designer UI).</li>
                        <li><strong>Disconnected Network Link:</strong> "Plan your network for disconnected operations" link in Connectivity for disconnected deployments.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">📋 Report: AKS Arc Network Requirements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Port/VLAN Table:</strong> When AKS workloads are configured, the report shows network port requirements (22, 6443, 55000, 65000) with cross-VLAN notes.</li>
                        <li><strong>Documentation Link:</strong> Links to AKS Arc network system requirements on MS Learn.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">📋 Report: Firewall Allow List</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Endpoint Requirements:</strong> Added Firewall Allow List Endpoint Requirements row to the report Connectivity section.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🐛 Designer: Edge Gateway Fix</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Default Gateway:</strong> Fixed the Default Gateway field being empty and disabled on the Edge 2-Node Switchless template — changed IP assignment from DHCP to static with gateway <code>192.168.100.1</code>.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🐛 Sizer: Tiered Storage Fix</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Disk Size Badge:</strong> Fixed MANUAL badge not appearing on disk size for all-flash configurations — replaced incorrect tiered detection with <code>_isTieredStorage()</code> helper.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🐛 Sizer: ALDO Configure in Designer Fix</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Disconnected Scenario:</strong> "Configure in Designer" for ALDO Management Cluster now correctly selects the Disconnected scenario with Management Cluster role — previously defaulted to Hyperconverged.</li>
                        <li><strong>FQDN Prompt:</strong> ALDO users are prompted for their Autonomous Cloud FQDN before navigating to the Designer, ensuring the FQDN and cluster role are pre-populated.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">📊 Sizer: ALDO Analytics Tracking</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Usage Tracking:</strong> Selecting ALDO Management Cluster now increments the Sizer analytics counter, matching the tracking behavior of workload additions.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🔧 CI: ESLint Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Global Declaration:</strong> Added <code>selectDisconnectedOption</code> to ESLint globals to resolve CI errors.</li>
                        <li><strong>Code Style:</strong> Fixed <code>loadTemplate()</code> try-block indentation and <code>var</code>→<code>const</code> declarations.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🐛 Sizer: ALDO Cluster Type Switch-Back Fix</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Workload Buttons:</strong> Fixed bug where Add Workload buttons remained disabled after switching away from ALDO Management Cluster back to Standard or Rack-Aware.</li>
                        <li><strong>Node Dropdown:</strong> Fixed Number of Physical Nodes dropdown staying greyed out after switching away from ALDO Management Cluster.</li>
                        <li><strong>Root Cause:</strong> <code>renderWorkloads()</code> innerHTML replacement destroyed the <code>#empty-state</code> DOM element — re-rendering with no workloads caused a TypeError that halted the cluster-type change handler before re-enabling controls. Fixed by caching the element reference.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 8px 0;">Version 0.17.04</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 23, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Example Template Fix (#140)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Template Completeness:</strong> Fixed issue where loading an Example Configuration Template resulted in incomplete wizard progress (67–76%) instead of 100% — all five templates now load fully complete.</li>
                        <li><strong>Template Loading Race Condition:</strong> Suppressed <code>updateUI()</code> during template loading to prevent cascading auto-defaults and disabled card recalculation between <code>selectOption()</code> calls.</li>
                        <li><strong>Template Data Fixes:</strong> Corrected <code>ports</code>, <code>intent</code>, <code>arc</code>, <code>rackAwareTorsPerRoom</code>, <code>rackAwareTorArchitecture</code> values; added missing <code>privateEndpoints</code>, <code>adOuPath</code>, disconnected fields; removed invalid <code>switchlessLinkMode</code> from Edge template.</li>
                        <li><strong>Template DOM Restoration:</strong> Fixed AD domain/DNS/OU Path inputs, SDN feature checkboxes, and management card not populating after template load due to <code>selectOption()</code> cascade resets.</li>
                        <li><strong>Edge 2-Node Switchless:</strong> Fixed ports <code>'2'→'4'</code>, intent <code>'all_traffic'→'mgmt_compute'</code>, 4-entry portConfig (mandatory for low_capacity + switchless + 2-node topology).</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🧪 Template Regression Tests</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>46 New CI Tests:</strong> Progress validation, check counts, rack-aware zones, disconnected constraints, data completeness, and updateUI() constraint validation tests to prevent future template/designer mismatches.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 8px 0;">Version 0.17.00</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 23, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔌 Disconnected Operations Wizard</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Cluster Role Selection:</strong> New D1 wizard step — choose Management Cluster (fixed 3 nodes, hosts the disconnected operations appliance VM) or Workload Cluster (1–16 nodes, connects via Autonomous Cloud FQDN).</li>
                        <li><strong>Autonomous Cloud FQDN Endpoint:</strong> New D2 step with real-time FQDN validation and confirm/edit gate — all subsequent wizard steps are hidden until the FQDN is confirmed.</li>
                        <li><strong>Context Banner:</strong> "Why Azure Cloud & Region are still required" info banner displayed for management clusters alongside the FQDN step.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">📊 Disconnected Network Diagrams</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>26 Network Topology Diagrams:</strong> Complete set covering all intent configurations (fully converged, disaggregated, mgmt+compute, compute+storage, 4-intent, 4-storage, switchless 2/3/4-node, single-node workload variants) × 2 outbound modes (Limited Connectivity + Air-Gapped).</li>
                        <li><strong>Intelligent Diagram Routing:</strong> Automatic diagram selection based on cluster role, node count, intent type, storage topology, port count, and custom NIC assignments.</li>
                        <li><strong>Single-Node Workload Variants:</strong> Dedicated diagrams for single-node workload clusters in fully converged (1 intent), mgmt+compute/storage (2 intent), and disaggregated (3 intent) configurations.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">⚙️ Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>DNS Validation:</strong> DNS servers are now validated against node IPs and default gateway to prevent IP conflicts.</li>
                        <li><strong>Scenario Description:</strong> Updated disconnected mode description with accurate feature availability information.</li>
                        <li><strong>Outbound Comparison:</strong> Removed cons section from Air-Gapped and Limited Connectivity comparison cards for cleaner presentation.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--text-secondary); margin: 0 0 8px 0;">Version 0.16.04</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 20, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ Sizer UI Layout Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>ODIN Logo & What's New:</strong> Added the ODIN logo and version/What's New link to the Sizer header, matching the Designer page branding.</li>
                        <li><strong>Reset Button Repositioned:</strong> Moved Reset into the Workload Scenarios section with a confirmation prompt when workloads exist.</li>
                        <li><strong>Export Buttons Below Notes:</strong> Save as PDF and Download Word buttons relocated below the Sizing Notes section.</li>
                        <li><strong>Shared Changelog Module:</strong> Extracted What's New into a shared JavaScript module used by both Designer and Sizer.</li>
                        <li><strong>S2D Resiliency Repair Storage Reservation:</strong> 1 × capacity disk per node (up to 4 × max) of raw pool space is now reserved for S2D repair jobs, reducing reported usable storage.</li>
                        <li><strong>Workload Analytics Tracking:</strong> Each new workload added (VM, AKS, or AVD) is now tracked via Firebase analytics, displayed as "Sizes Calculated" on the main page stats bar.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🎨 Mobile & UI Polish</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Designer: Mobile stats bar 2×2:</strong> Page analytics bar displays as a 2×2 grid on mobile devices instead of a single row of 4.</li>
                        <li><strong>Sizer: "Estimated Power, Heat & Rack Space":</strong> Updated heading to include "Heat" since BTU/hr values are displayed; power units expanded to "Watts"; BTU is now a Wikipedia hyperlink.</li>
                        <li><strong>Sizer: Mobile layout consistency:</strong> On mobile, the Sizer header now matches the Designer page — ODIN logo and What's New centered at top, title and subtitle below.</li>
                        <li><strong>Sizer: iOS Safari Mobile Centering:</strong> Fixed centering of logo, What's New, and title text on iOS Safari mobile devices.</li>
                        <li><strong>Sizer: Mobile Logo & Text Size:</strong> Increased logo and What's New text size on mobile for improved readability.</li>
                        <li><strong>Sizer: Default 2 Node cluster:</strong> Default cluster changed from 3 Node / Three-Way Mirror to 2 Node / Two-Way Mirror, reducing the starting hardware cost. Three-Way Mirror is auto-selected when 3+ nodes are configured.</li>
                        <li><strong>Security: Removed invalid meta tags:</strong> Removed X-Frame-Options and X-XSS-Protection meta tags (HTTP-header-only, caused console warnings).</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">⚙️ Sizer Scaling Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Node Preference over Ratio/Memory:</strong> The sizer now prefers adding additional nodes before escalating the vCPU ratio above 4:1 or bumping memory above 2 TB — conservative auto-scaling caps memory at 2 TB and holds ratio at 4:1, with an aggressive pass only when needed.</li>
                        <li><strong>Auto-Down-Scaling after Aggressive Pass:</strong> After the aggressive pass bumps memory or ratio, a node-reduction loop steps the node count back down while keeping utilization under 90%, re-running conservative auto-scale at each step.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🐛 Sizer Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>vCPU Ratio AUTO Badge:</strong> Fixed AUTO badge not persisting on the vCPU Overcommit Ratio field after auto-scaling.</li>
                        <li><strong>vCPU Ratio Label:</strong> Corrected "pCPU to vCPU" to "vCPU to pCPU" overcommit ratio in sizing notes.</li>
                        <li><strong>Node Recommendation Memory Cap:</strong> Fixed node recommendation underestimating per-node capacity when memory exceeds 1 TB, preventing unnecessary node scaling.</li>
                        <li><strong>Stale Node Recommendation:</strong> Node recommendation message now recalculates when manually changing node count, showing accurate guidance.</li>
                        <li><strong>Manual Hardware Override:</strong> Memory, CPU cores, and CPU sockets manual changes are now respected by auto-scaling instead of being overridden.</li>
                        <li><strong>Node Count Manual Increase:</strong> Fixed node count resetting to the auto-recommended value when manually increased (e.g. 5 → 6).</li>
                        <li><strong>1.5 TB Memory Threshold:</strong> For small clusters (&lt; 10 nodes), per-node memory is capped at 1.5 TB in both node recommendations and memory headroom auto-scaling, preferring to add a node over jumping to expensive 2 TB+ DIMMs.</li>
                        <li><strong>Memory Headroom Threshold:</strong> Raised memory headroom from 80% to 85% to avoid unnecessary DIMM tier jumps when utilisation is within range.</li>
                        <li><strong>Bidirectional Memory &amp; CPU Auto-Scaling:</strong> Memory and CPU cores now scale down when more nodes reduce per-node requirements, keeping hardware at the smallest sufficient option.</li>
                        <li><strong>Sizing Notes Reorder:</strong> Cluster size + N+1 note is now the first item (e.g. "5 x Node Cluster - N+1 capacity"); hardware note updated to "Per node hardware configuration" format.</li>
                        <li><strong>Resiliency Sync:</strong> Fixed sizing notes showing "Two-way mirror" while the dropdown displayed "Three-Way" for large clusters — resiliency variables are now re-read after node recommendation changes the dropdown.</li>
                        <li><strong>Deterministic Node Estimation:</strong> Fixed adding future growth (e.g. 10%) reducing the recommended node count — node estimation now uses a fixed memory cap instead of reading stale DOM state.</li>
                        <li><strong>AMD Auto-Switch before 6:1 Ratio:</strong> Before escalating from 5:1 to 6:1 vCPU ratio, the sizer now tries switching to AMD CPUs with more physical cores (e.g. AMD Turin 192 cores/socket) to resolve compute pressure at 5:1, keeping the overcommit ratio lower.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🧪 Tests: Large Cluster & Scaling</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>New Test Suites:</strong> Added tests for node-weight constants, deterministic memory cap, conservative/aggressive auto-scale modes, large cluster node recommendations, node preference verification, and AMD auto-switch before 6:1 ratio.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.16.03</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 19, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Custom Intent 8-Port Zone Restrictions (<a href='https://github.com/Azure/odinforazurelocal/issues/130'>#130</a> follow-up)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Restricted Zones:</strong> For 8-port custom intent, the wizard now only shows the 4 valid zones: Management + Compute (required), Compute 1 (optional), Compute 2 (optional), and Storage (required). Management, Compute + Storage, and Group All Traffic zones are hidden.</li>
                        <li><strong>Smart Defaults:</strong> The default adapter mapping pre-assigns the first 2 non-RDMA ports to Management + Compute and the last 2 RDMA ports to Storage.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.16.02</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 19, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Custom Intent 8-Port Compute Intent Fix (<a href='https://github.com/Azure/odinforazurelocal/issues/130'>#130</a>)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Separate Compute Intents:</strong> With 8 ports and custom intent, the wizard now offers two distinct compute zones (Compute 1 and Compute 2) instead of a single shared compute bucket. This allows users to create two independent compute intents as required by the Azure Local Network ATC specification.</li>
                        <li><strong>Report &amp; ARM Alignment:</strong> The Configuration Report diagram and ARM template output correctly reflect the user's custom intent assignment with separate compute intents.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.16.01</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 17, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🧮 Sizer: UX Improvements, Power Estimates, Auto-Scale Enhancements &amp; Storage Limit Enforcement</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Standardised Disk Size Dropdown:</strong> Disk size inputs replaced with a dropdown of standard NVMe/SSD capacities (0.96, 1.92, 3.84, 7.68, 15.36 TB), eliminating invalid free-text entries.</li>
                        <li><strong>Delete Confirmation Dialog:</strong> Deleting a workload now requires confirmation, preventing accidental removal.</li>
                        <li><strong>Clone Workload:</strong> New clone button on each workload card to duplicate a workload with all its settings.</li>
                        <li><strong>Estimated Power &amp; Rack Space:</strong> New section showing per-node power (W), total cluster power, BTU/hr, and rack units (including 2× ToR switches). Estimates based on CPU TDP, memory DIMMs, data disks, OS boot disks, GPUs, and system overhead. Consult your OEM hardware partner for accurate planning.</li>
                        <li><strong>AVD Custom Profile Validation:</strong> Custom AVD profiles now warn if RAM/vCPU or vCPUs/user values fall outside recommended ranges.</li>
                        <li><strong>Print Stylesheet:</strong> Improved print/PDF output — hides config panel and action buttons, results go full-width, page breaks avoided inside sections.</li>
                        <li><strong>Keyboard Accessibility:</strong> Escape closes the active modal; Tab/Shift+Tab focus is trapped inside open modals; first input auto-focused on open.</li>
                        <li><strong>vCPU Ratio Manual Override:</strong> Users can now manually set the vCPU Overcommit Ratio without auto-scaling overriding their selection. The lock resets when workloads are added or removed.</li>
                        <li><strong>AMD CPU Suggestion Tip:</strong> When Intel cores/sockets are maxed and compute ≥80% at baseline 4:1, a tip suggests AMD EPYC Turin with up to 192 cores per socket (384 dual socket).</li>
                        <li><strong>AMD EPYC Turin Core Options:</strong> Updated to include 144, 160, and 192 cores per socket, reflecting the full Turin product line.</li>
                        <li><strong>Auto-Scaled Field Indicators:</strong> Auto-scaled hardware fields now show a purple glow animation and "AUTO" badge for clear visual feedback.</li>
                        <li><strong>Capacity Label Clarity:</strong> "Capacity Breakdown" → "Capacity Usage for Workload"; sub-labels now include "- Consumed" suffix.</li>
                        <li><strong>Infrastructure_1 Volume:</strong> 256 GB usable capacity reserved by Storage Spaces Direct is now deducted from usable storage in all calculations.</li>
                        <li><strong>Disk Bay Consolidation:</strong> When ≥50% of disk bays would be filled, the sizer evaluates fewer larger disks to free bays for future expansion.</li>
                        <li><strong>Storage Limit Enforcement:</strong> Configurations exceeding 400 TB/machine or 4 PB/pool are flagged with 🚫 errors, a red banner, and export/Designer are blocked.</li>
                        <li><strong>Dead Code Cleanup:</strong> Removed unused dual parity option, dead functions, and consolidated resiliency constants.</li>
                        <li><strong>Power Estimate Core Scaling:</strong> CPU TDP now scales with selected core count (40% base + 60% proportional), so reducing cores visibly reduces estimated power.</li>
                        <li><strong>Single Node Default Resiliency:</strong> Single-node clusters now default to Two-Way Mirror instead of Simple (No Fault Tolerance).</li>
                        <li><strong>Sizing Notes Consistency:</strong> Fixed edit-vs-add inconsistencies in vCPU ratio warnings and memory calculations.</li>
                        <li><strong>Cluster Type &amp; Nodes Label Styling:</strong> Bolder weight, larger font, and primary text colour for the Cluster Type and Number of Physical Nodes labels.</li>
                        <li><strong>Disk Consolidation Count Fix:</strong> Fixed consolidation only increasing disk count — now bidirectional; stale counts no longer persist after page refresh/resume.</li>
                        <li><strong>Consolidation Note After Headroom:</strong> Fixed consolidation sizing note showing the wrong disk count when the storage headroom pass added extra disks.</li>
                        <li><strong>HTML Validation Fix:</strong> Encoded raw &amp; as &amp;amp; in the sizer heading to resolve validation errors.</li>
                        <li><strong>AUTO Badge Persistence Fix:</strong> Fixed AUTO badges disappearing from CPU Cores per Socket and Memory per Node when adding workloads that scale nodes without changing per-node hardware values.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.15.98</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 16, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Default Gateway Field Fix for Safari (<a href='https://github.com/Azure/odinforazurelocal/issues/98'>#98</a>)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Gateway Field Consistency:</strong> Default Gateway is now disabled with opacity when no IP type is selected, matching sibling inputs. Fixes an issue on Safari (macOS) where the field could become unclickable due to inconsistent compositing states.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.15.97</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 16, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 Dynamic Storage Networks for Switched Storage (<a href='https://github.com/Azure/odinforazurelocal/issues/113'>#113</a>)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Dynamic Storage Network Count:</strong> Switched storage now dynamically determines the number of storage networks based on NIC count, supporting up to 8 per Network ATC (previously hardcoded to 2).</li>
                        <li><strong>VLAN Override UI:</strong> Step 08 Intent Overrides renders the correct number of VLAN ID fields with defaults 711–718.</li>
                        <li><strong>ARM Template:</strong> The storageNetworkList array now includes all N storage network entries with correct adapter names and VLANs.</li>
                        <li><strong>All Traffic Intent:</strong> Fully converged (all_traffic) with 4+ ports correctly recognises all ports as carrying storage traffic.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.15.96</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 16, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 DCB QoS System/Cluster Priority Default Correction (<a href='https://github.com/Azure/odinforazurelocal/issues/117'>#117</a>)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Fixed Default Cluster Priority:</strong> Corrected the System/Cluster Priority dropdown default from "5" to "7" per <a href="https://learn.microsoft.com/en-us/windows-server/networking/network-atc/network-atc#default-data-center-bridging-dcb-configuration" target="_blank">Microsoft Network ATC documentation</a>.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.15.95</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 15, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🧮 Sizer: Free-Input Configuration, Hardware Validation &amp; Catalog Alignment (<a href='https://github.com/Azure/odinforazurelocal/issues/119'>#119</a>)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>DIMM-Symmetric Memory:</strong> Memory per Node uses server-realistic DIMM-symmetric values (64–4096 GB) matching symmetric DIMM populations across 24 DIMM slots.</li>
                        <li><strong>Expanded Disk Count Options:</strong> Capacity Disks per Node and Cache Disks per Node dropdowns now include every value from 2–24 (capacity, all-flash) / 2–16 (capacity, hybrid) and 2–8 (cache).</li>
                        <li><strong>Disk Size Auto-Scaling:</strong> When disk count reaches 24 and storage is still insufficient, auto-scale steps up disk size through standard capacities (0.96 → 1.92 → 3.84 → 7.68 → 15.36 TB).</li>
                        <li><strong>CPU Sockets Capped at 2:</strong> Removed 4-socket option — Azure Local certified hardware supports 1 or 2 sockets only.</li>
                        <li><strong>Configurable vCPU Ratio:</strong> New Advanced Settings with selectable vCPU-to-pCPU ratio (1:1, 2:1, 4:1, 5:1, 6:1) — replaces the hardcoded 4:1 assumption.</li>
                        <li><strong>GPU Model Granularity:</strong> GPU dropdown now lists individual NVIDIA models (A2, A16, L4, L40, L40S) with VRAM and TDP per model — select 0, 1, or 2 GPUs per node.</li>
                        <li><strong>Intel Xeon D 27xx (Edge):</strong> Added Intel Xeon D-2700 (Ice Lake-D) CPU generation for edge/rugged deployments.</li>
                        <li><strong>Min 2 Capacity &amp; Cache Disks:</strong> Disk count minimums raised from 1 to 2, matching Azure Local system requirements.</li>
                        <li><strong>Hybrid Disk Chassis Limit:</strong> Cache disks capped at 8, hybrid capacity at 16 (24 total drive bays per 2U chassis, 1:2 cache-to-capacity ratio).</li>
                        <li><strong>Mixed All-Flash Disk Limit:</strong> Same 24 drive bay constraint for mixed all-flash (NVMe cache + SSD capacity). All-flash single-type recommended for increased capacity.</li>
                        <li><strong>Single-Node All-Flash Only:</strong> Single-node clusters now block hybrid storage.</li>
                        <li><strong>Storage Warnings:</strong> New sizing notes for cache metadata overhead (4 GB/TB), 400 TB per-machine limit, and 4 PB cluster cap.</li>
                        <li><strong>Infrastructure Notes:</strong> New sizing notes for RDMA/25 GbE+ networking and boot/OS drive requirements.</li>
                        <li><strong>Updated Auto-Scale Logic:</strong> Hardware auto-scaling steps through DIMM-symmetric memory options and disk counts instead of arbitrary increments.</li>
                        <li><strong>Cluster Size Bar:</strong> New capacity bar showing physical node count with N+1 servicing and redundancy note.</li>
                        <li><strong>Rack-Aware Cluster Size:</strong> Cluster size bar adjusts maximum from 16 to 8 nodes for Rack-Aware clusters.</li>
                        <li><strong>vCPU Ratio Auto-Escalation:</strong> When compute ≥90% and cores/sockets are maxed, auto-escalates from 4:1 → 5:1 → 6:1 with a 🔴 warning in sizing notes.</li>
                        <li><strong>Sizer-to-Report Data Flow:</strong> vCPU ratio, GPU, future growth, and cluster type now carry through to Configuration Report.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.15.01</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 12, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🧮 ODIN Sizer (Preview)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Hardware Sizing Tool:</strong> New sizer calculates cluster requirements based on workload scenarios (VMs, AKS, AVD), storage resiliency, and capacity needs with an intelligent auto-sizing engine.</li>
                        <li><strong>Scale-Up Before Scale-Out:</strong> Auto-sizing favours increasing CPU cores, memory (up to 1 TB), and disks per node before recommending additional cluster nodes.</li>
                        <li><strong>Capacity Utilization Guard:</strong> Blocks configurations when Compute, Memory, or Storage utilization ≥ 90% — visual warning, red capacity bars, and disabled Designer button.</li>
                        <li><strong>Hybrid Cache Ratio:</strong> Hybrid storage enforces a 1:2 cache-to-capacity disk ratio (e.g., 6 cache + 12 HDD).</li>
                        <li><strong>Sizer-to-Designer Integration:</strong> "Configure in Designer" button transfers the full sizer configuration into the Designer, auto-populating steps 01–05 (Hyperconverged, Azure Commercial, East US, cluster type, and node count).</li>
                        <li><strong>"Unsure? Start with Sizer" Links:</strong> Steps 04 (Cluster Configuration) and 05 (Cluster Size) now include a navigation link to launch the Sizer for users who need guidance.</li>
                        <li><strong>Hardware in Configuration Report:</strong> When imported from Sizer, reports include CPU, memory, storage, resiliency, and workload summary details.</li>
                        <li><strong>Session Persistence:</strong> Sizer state auto-saves to localStorage with Resume / Start Fresh prompt on return.</li>
                        <li><strong>Export Options:</strong> Save as PDF and Word export for sizer results.</li>
                        <li><strong>Edit Workloads:</strong> Edit existing workloads via cog icon on workload cards.</li>
                        <li><strong>Official Azure Icons:</strong> VM, AKS Arc, and AVD workload types use official Azure service icons.</li>
                        <li><strong>ODIN Favicon:</strong> ODIN logo shown as browser favicon across all pages.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🖥️ AVD Workload Enhancements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Session Type:</strong> Multi-session (shared VMs) / single-session (dedicated VM per user) dropdown aligned to Microsoft session host sizing guidelines.</li>
                        <li><strong>Heavy Profile:</strong> New workload tier for engineers and content creators.</li>
                        <li><strong>Max Concurrency %:</strong> Default 90% reduces compute/memory sizing for realistic peak loads. Auto-hidden for single-session.</li>
                        <li><strong>FSLogix Profile Storage:</strong> Optional per-user profile container storage (default 30 GB).</li>
                        <li><strong>Knowledge Links:</strong> Links to AVD for Azure Local architecture guide and session host sizing guidelines.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🛡️ Resiliency &amp; Sizing Notes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>2-Way Mirror Warning:</strong> Recommendation banner when 2-way mirror is selected on a 3+ node cluster.</li>
                        <li><strong>80% Headroom Auto-Scale:</strong> Automatically bumps CPU cores/sockets and memory when capacity exceeds 80%.</li>
                        <li><strong>Improved Resiliency Notes:</strong> Clearer descriptions for 2-way, 3-way, and 4-way mirror efficiency and fault domain details.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.61</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 12, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>2-Node Switchless Diagram Port Labels (<a href='https://github.com/Azure/odinforazurelocal/issues/93'>#93</a>):</strong> The Configuration Report diagram for 2-node switchless now correctly reflects the user's custom adapter mapping instead of always showing the default Port 1,2 / Port 3,4 split.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.59</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 12, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Summary Blade NIC Mapping (<a href='https://github.com/Azure/odinforazurelocal/issues/88'>#88</a>):</strong> The right-side summary blade now updates to reflect custom adapter mapping after confirming, instead of always showing the default port assignments.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.58</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 12, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Character Encoding Fix (<a href='https://github.com/Azure/odinforazurelocal/issues/103'>#103</a>):</strong> Fixed corrupted UTF-8 characters in Configuration Report diagram titles and legends (em dashes, arrows, emojis displaying as garbled text).</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.57</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 12, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Storage Subnet CIDRs (<a href='https://github.com/Azure/odinforazurelocal/issues/99'>#99</a>):</strong> SVG diagram legends now show correct Network ATC default subnets (10.71.x.0/24) when Auto IP is enabled, instead of incorrect 10.0.x.0/24 addresses.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.56</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 11, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>draw.io Orthogonal Routing (<a href='https://github.com/Azure/odinforazurelocal/issues/94'>#94</a>):</strong> Switchless storage connectors now use L-shaped orthogonal routing with dedicated lanes per subnet instead of straight overlapping lines.</li>
                        <li><strong>Canonical Switchless Port Layout:</strong> Switchless topologies force canonical port allocation ensuring correct mesh connectivity for all node counts.</li>
                        <li><strong>Report-Only Export:</strong> draw.io download is now available exclusively on the Configuration Report page.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.55</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 11, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Diagram Export for draw.io (<a href='https://github.com/Azure/odinforazurelocal/issues/94'>#94</a>):</strong> Replaced Mermaid export with draw.io format for higher-quality, editable network topology diagrams.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.54</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 10, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>NIC Mapping to Intent (#88):</strong> Fixed adapter-to-intent assignment ignoring RDMA status on Low Capacity scale. Non-RDMA ports are now correctly preferred for Management + Compute across all scales, keeping RDMA ports available for Storage.</li>
                        <li><strong>Safari Drag-and-Drop (#88):</strong> Fixed adapter mapping "flip-flop" on Safari where a click event fired after drag-and-drop, causing the click-to-swap fallback to unintentionally reverse the user's drag operation.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Mobile-Responsive Navigation (#87):</strong> Nav bar collapses to icon-only on mobile portrait (≤768px). Onboarding card is now scrollable with the "Next" button always reachable on small screens.</li>
                        <li><strong>Mermaid Diagram Export (#86):</strong> Copy or download the network topology diagram as portable Mermaid markup with intent-grouped adapter subgraphs and switchless storage subnet connections with CIDR labels.</li>
                        <li><strong>Touch Device Support:</strong> Added tap-to-select fallback for adapter mapping on mobile Safari and other touch devices where HTML5 drag-and-drop is not supported.</li>
                        <li><strong>215 Unit Tests:</strong> Expanded test suite from 198 to 215 tests with regression coverage for NIC mapping fixes.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.53</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 9, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>ARM Storage Adapter Naming (#74):</strong> Fixed ARM template where both StorageNetwork1 and StorageNetwork2 incorrectly used the same adapter name (SMB1). StorageNetwork2 now correctly references the second adapter.</li>
                        <li><strong>VLAN ID Defaults of Zero (#75):</strong> Fixed empty string and zero VLAN values being treated as valid, which produced invalid VLAN ID 0. Proper defaults (711/712) are now applied.</li>
                        <li><strong>NIC Speed Locked on Single-Node (#76):</strong> Removed forced 10 GbE speed override on single-node clusters, allowing users to retain their selected NIC speed.</li>
                        <li><strong>IP Address Validation (#78):</strong> Node IPs, DNS servers, and inline validators now reject network (.0) and broadcast (.255) addresses with clear error messages.</li>
                        <li><strong>Switchless Intent Adapters:</strong> Fixed ARM <code>intentList</code> where switchless storage adapters were named SMB1, SMB2 instead of using the wizard's port display names (Port 3, Port 4, etc.).</li>
                        <li><strong>Default Gateway Validation:</strong> Fixed "Complete These Sections: Default Gateway" warning appearing incorrectly after resuming a saved session or loading a template.</li>
                        <li><strong>Storage VLAN Placeholders:</strong> Fixed ARM output showing <code>REPLACE_WITH_STORAGE_VLAN</code> instead of actual VLAN IDs when using custom intent with adapter mapping confirmed.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Port Name Consistency:</strong> ARM parameter file adapter names now match the wizard's port display names (e.g., Port 1, Port 2) instead of generic NIC1/SMB1 prefixes.</li>
                        <li><strong>Configuration Summary Labels:</strong> The sidebar Configuration Summary now shows custom port names instead of generic "NIC X" labels.</li>
                        <li><strong>DNS Validation Gating:</strong> DNS server validation now blocks report and ARM generation instead of only showing a warning.</li>
                        <li><strong>Shared Navigation Bar:</strong> Centralized nav bar into a shared <code>js/nav.js</code> component used by all pages, with a new 💡 Feedback link to GitHub Issues.</li>
                        <li><strong>Sizer Disclaimer:</strong> Added development status notice on the Sizer page.</li>
                        <li><strong>CI Pipeline Hardening:</strong> ESLint, unit tests, and HTML validation CI jobs now block pull request merges on failure.</li>
                        <li><strong>198 Unit Tests:</strong> Expanded test suite from 136 to 198 tests with regression coverage for all bug fixes.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.52</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 6, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 New Features & Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Markdown Report Export:</strong> New "Download Markdown" button on the Configuration Report page — export your full report as a <code>.md</code> file with embedded network diagrams for documentation, wikis, or version control.</li>
                        <li><strong>Custom Intent Diagram Grouping:</strong> Fixed network diagram to properly group adapters by intent when using custom intent configurations.</li>
                        <li><strong>Non-Contiguous Port Support:</strong> When ports from different slots are assigned to the same intent, they are now displayed adjacent to each other in the diagram.</li>
                        <li><strong>Duplicate Adapter Name Validation:</strong> Prevents duplicate adapter names in port configuration with visual feedback (red border, warning label) and blocks report generation until resolved.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.51</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 5, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🚀 Automated Build Pipeline</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>GitHub Actions CI/CD:</strong> Automated build validation pipeline runs on every push and pull request.</li>
                        <li><strong>ESLint Integration:</strong> JavaScript code quality checks with comprehensive linting rules.</li>
                        <li><strong>HTML Validation:</strong> Automated HTML5 validation to catch markup errors early.</li>
                        <li><strong>136 Unit Tests:</strong> Automated test suite runs in headless Chromium browser.</li>
                        <li><strong>Code Quality Gates:</strong> Pull requests must pass all checks before merge.</li>
                        <li><strong>RFC 1918 DNS Validation:</strong> DNS servers must be private IPs when using Active Directory.</li>
                        <li><strong>Light Mode Input Fix:</strong> All input fields now display correctly in light theme.</li>
                        <li><strong>Keyboard Navigation:</strong> Option cards support Tab and Enter/Space selection.</li>
                        <li><strong>SDN Management Resume Fix:</strong> SDN Management selection now restores when resuming a session.</li>
                        <li><strong>Infrastructure Network Resume Fix:</strong> Infrastructure Network validation now works correctly when resuming a session.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.50</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 5, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🛠️ Codebase Optimization & Modularization</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Project Reorganized:</strong> Cleaner folder structure with dedicated directories for ARM, Report, CSS, Images, JS modules, Tests, and Scripts.</li>
                        <li><strong>Phase 2A Modularization:</strong> Extracted formatting, validation, and DNS functions into dedicated JavaScript modules for better maintainability.</li>
                        <li><strong>136 Unit Tests:</strong> Comprehensive test coverage expanded from 34 to 136 tests covering all utility modules.</li>
                        <li><strong>Preview Button Removed:</strong> Removed redundant "Preview Cluster Configuration" button - use the Configuration Summary panel instead.</li>
                        <li><strong>Documentation Refreshed:</strong> Updated Quick Start guide and archived outdated planning documents.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.14.2</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 5, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 ARM Template Import Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Adapter Names Preserved:</strong> Importing ARM templates now preserves adapter names (NIC1, NIC2, SMB1, SMB2, etc.) from the template.</li>
                        <li><strong>Single-Node Diagram:</strong> Fixed host networking diagram display for single-node deployments.</li>
                        <li><strong>Management + Compute Adapters:</strong> Fixed NIC adapter loading for Management + Compute intent during ARM import.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.13.30</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 5, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📥 ARM Import & Theme Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Private Endpoints Import:</strong> ARM import dialog now asks about Private Endpoints usage - select Yes to specify which Azure services have Private Link configured.</li>
                        <li><strong>Rack-Aware Node Validation:</strong> Rack-Aware clusters now only allow 2, 4, 6, or 8 nodes (even numbers for balanced rack distribution).</li>
                        <li><strong>Sizer Section Reorder:</strong> Workload Scenario section now appears first, followed by Cluster Configuration.</li>
                        <li><strong>Progress Bar Theme:</strong> The designer wizard progress bar now properly responds to light/dark theme changes.</li>
                        <li><strong>Navigation Theme Support:</strong> Navigation bar and dropdowns now properly respond to light/dark theme changes.</li>
                        <li><strong>Disclaimer Banner Theme:</strong> The disclaimer banner now properly responds to light/dark theme changes.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.13.19</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 5, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🌙 Theme Toggle & Sizer Preview</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Sizer Preview Badge:</strong> "Preview" badge now appears on the Sizer tab button in the navigation bar.</li>
                        <li><strong>Theme Toggle in Nav:</strong> Light/Dark mode toggle added to the navigation bar for easy access on all pages.</li>
                        <li><strong>Cross-Page Theme Sync:</strong> Theme preference now syncs across Designer, Knowledge, and Sizer pages.</li>
                        <li><strong>Custom Network Adapter Names:</strong> Rename physical ports in Port Configuration - names propagate everywhere.</li>
                        <li><strong>ARM Import Enhancements:</strong> Importing ARM templates preserves custom adapter names and auto-confirms configurations.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.11.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 4, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🧭 Tab Navigation System</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Top Navigation Bar:</strong> New fixed navigation with ODIN branding and tabs for Designer, Knowledge, and Sizer sections.</li>
                        <li><strong>ODIN Designer:</strong> The existing wizard is now accessible via the Designer tab (default view).</li>
                        <li><strong>ODIN Knowledge:</strong> Quick access to documentation including the Outbound Connectivity Guide.</li>
                        <li><strong>ODIN Sizer:</strong> Placeholder for upcoming cluster sizing tool (Coming Soon).</li>
                        <li><strong>Consistent Navigation:</strong> Main site and docs pages share the same navigation pattern.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.12</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">February 3, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📡 Outbound Connectivity Guide</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Architecture Documentation:</strong> Comprehensive guide for Public Path vs Private Path (ExpressRoute) scenarios.</li>
                        <li><strong>Private Endpoints Selection:</strong> New wizard step for selecting Azure services that use Private Link.</li>
                        <li><strong>Dynamic Connectivity Diagrams:</strong> Report displays appropriate architecture diagram based on your selections.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.11</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 28, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 Switchless Storage IPs by Adapter</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>ARM Template Alignment:</strong> Switchless storage adapter IPs now display grouped by SMB adapter (SMB1, SMB2, etc.) matching the ARM template structure.</li>
                        <li><strong>Node-to-IP Mapping:</strong> Each adapter shows which node gets which IP, consistent with the generated ARM parameters.</li>
                        <li><strong>2/3/4-Node Support:</strong> Proper subnet-to-adapter mapping for all switchless node counts.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.10</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 28, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 Switchless Storage Adapter IPs</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Switchless Support:</strong> Configuration Report now displays storage adapter IPs for switchless storage when Auto IP is disabled.</li>
                        <li><strong>Subnet-Based Display:</strong> Shows each switchless subnet with its two assigned IPs (one per connected node pair).</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.9</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 28, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 Auto IP Storage Display Correction</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Auto IP Subnet Only:</strong> When Storage Auto IP is enabled, report now shows only the subnet (10.71.0.0/16) since IPs are assigned automatically by Network ATC.</li>
                        <li><strong>Custom Subnets Unchanged:</strong> Storage adapter IPs continue to display when Auto IP is disabled (user-defined subnets).</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.8</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 28, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 Storage Adapter IPs for Auto IP Enabled</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Auto IP Storage IPs:</strong> Configuration Report now shows default Network ATC storage adapter IPs (10.71.x.x) when Storage Auto IP is enabled.</li>
                        <li><strong>Both Scenarios Covered:</strong> Storage adapter IPs now display for both Auto IP enabled and disabled configurations.</li>
                        <li><strong>Improved Node IP Display:</strong> More robust node name fallback when displaying infrastructure IPs.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.7</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 28, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 IP Address Display in Report (Issue #11)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Node Infrastructure IPs:</strong> Configuration Report now shows each node's name and IP address in the Infrastructure Network section.</li>
                        <li><strong>Storage Adapter IPs:</strong> When Storage Auto IP is disabled, report displays calculated storage adapter IPs for each node per subnet.</li>
                        <li><strong>ARM Template Alignment:</strong> Report now shows the exact IP addresses that will be used in ARM template deployment.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.6</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 28, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 Storage Intent Subnet Display (Issue #9)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Storage Subnets in Report:</strong> Configuration Report now displays storage intent subnet information.</li>
                        <li><strong>Auto IP Enabled:</strong> Shows default Network ATC subnet (10.71.0.0/16) when Storage Auto IP is enabled.</li>
                        <li><strong>Custom Subnets:</strong> Displays user-defined storage subnets when Storage Auto IP is disabled.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.5</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 28, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 Configuration Report Security Details (Issue #7)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Security Details Display:</strong> Configuration Report now shows all security configuration details when using customized security settings.</li>
                        <li><strong>Fixed Property Names:</strong> Corrected property name mismatches between wizard state and report rendering.</li>
                        <li><strong>All Settings Visible:</strong> WDAC, Credential Guard, Drift Control, SMB Signing, SMB Encryption, and BitLocker settings now display correctly.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.4</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 22, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 Single-Node Storage Intent Support (Issue #100)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Storage Intent for Single-Node:</strong> Single-node (1-node) clusters can now configure storage intent with all options available.</li>
                        <li><strong>All Intents Available:</strong> All Traffic, Mgmt + Compute, Compute + Storage, and Custom intents now work for single-node.</li>
                        <li><strong>RDMA Requirements:</strong> Non-low-capacity requires 2 RDMA ports; Low Capacity keeps RDMA optional.</li>
                        <li><strong>Updated Defaults:</strong> Non-low-capacity single-node now defaults to 10GbE with RoCEv2 RDMA enabled.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.3</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 20, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📝 Auto-Populate Storage Subnets (Issue #95)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Storage Subnet Auto-Fill:</strong> Entering the first storage subnet automatically populates remaining fields by incrementing the 3rd octet.</li>
                        <li><strong>Smart Population:</strong> Only empty fields are auto-filled; existing values are preserved.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.2</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 20, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">⚙️ SDN Configuration Redesign (Step 18)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Enable/Disable Selection:</strong> Step 18 now starts with a clear Yes/No choice for enabling SDN.</li>
                        <li><strong>Conditional Features:</strong> SDN feature cards (LNET, NSG, VNET, SLB) only appear when SDN is enabled.</li>
                        <li><strong>Clearer Flow:</strong> Since SDN is optional and not reflected in ARM templates, this provides a clearer user experience.</li>
                        <li><strong>Import Support:</strong> ARM template imports with SDN settings now properly restore the enabled state and features.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.1</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 19, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📥 ARM Template Import Options (Issue #90)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Import Options Dialog:</strong> When importing ARM templates, a dialog now prompts for settings not included in ARM templates.</li>
                        <li><strong>Arc Gateway:</strong> Specify if the deployment uses Arc Gateway for secure connectivity.</li>
                        <li><strong>Enterprise Proxy:</strong> Specify if the deployment routes through an enterprise proxy.</li>
                        <li><strong>SDN Configuration:</strong> Choose SDN mode: None, Arc-managed (LNets/NSGs or full), or Legacy (WAC-managed).</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.10.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 19, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 ARM Parameters Pre-Population (Issue #85, #86)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>OU Path Auto-Population:</strong> The OU Path field is now pre-filled with the value from the wizard. If already provided, the input field is hidden.</li>
                        <li><strong>Cluster Name Loading:</strong> The Cluster Name field is now properly loaded when navigating to the ARM Parameters page.</li>
                        <li><strong>HCI Resource Provider Object ID:</strong> This field is now pre-populated from the parameters payload when present.</li>
                        <li><strong>Additional Fields:</strong> Extended pre-population to Tenant ID, Key Vault, Storage Accounts, and Custom Location.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.9.9</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 14, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ ARM Placeholder Input Enhancement</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Complete Placeholder Form:</strong> Users can now input all ARM template placeholder values directly on the ARM page.</li>
                        <li><strong>Organized Sections:</strong> Inputs grouped into Azure Context, Cluster Configuration, Azure Resources, and Arc Node Resource IDs.</li>
                        <li><strong>Dynamic Arc Node Inputs:</strong> Arc node resource ID fields automatically generated based on cluster node count.</li>
                        <li><strong>Real-time Updates:</strong> Parameters JSON updates instantly as values are entered.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.9.8</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 14, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Required Badge Styling (Issue #76)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Badge-Style Labels:</strong> "Required" indicators for Cloud Witness and Storage Switched now use the same badge styling as "Recommended" badges.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.9.7</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 14, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ Deploy to Azure UX Enhancement</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Step-by-Step Instructions:</strong> Added detailed guide on how to copy parameters to Azure Portal.</li>
                        <li><strong>Copy Parameters Button:</strong> New button copies JSON and scrolls to the parameters section with visual feedback.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.9.5</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 14, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ Enhancements (Issues #69, #70, #71)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Alphabetized Azure Regions:</strong> Commercial regions now displayed in alphabetical order for easier navigation.</li>
                        <li><strong>Low Capacity & Rack Aware Links:</strong> Added "Learn more" documentation links to cluster configuration options.</li>
                        <li><strong>Knowledge Links:</strong> Added info icons (ℹ️) to Cloud Witness and Network Traffic Intents steps linking to Microsoft documentation.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.9.4</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 14, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fix (Issue #67)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Custom Adapter Mapping Fixed:</strong> ARM output and diagrams now correctly reflect user's custom adapter port assignments (e.g., Ports 2 & 4 for Storage instead of defaulting to Ports 3 & 4).</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.9.3</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 13, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes (Issues #64, #65)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>DNS Server Display Fixed:</strong> DNS servers now properly display after ARM template import or session resume.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.9.2</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 13, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes (Issue #59)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Template Loading Fixed:</strong> Example configurations now load all fields correctly (Ports, Traffic Intent, Outbound).</li>
                        <li><strong>Missing Sections Navigation:</strong> Clicking on missing section links now scrolls to the correct step.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.9.1</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 13, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🎨 UI Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Page Statistics Repositioned:</strong> Moved Page Stats below header description for better visual flow.</li>
                        <li><strong>Renamed Label:</strong> Changed "Documents Generated" to "Designs Generated" for clarity.</li>
                        <li><strong>Compact Layout:</strong> Reduced spacing below header for tighter design.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.9.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">January 13, 2026</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ New Features (Issues #55, #56)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Missing Sections Display:</strong> Dynamic red-bordered container shows incomplete sections with clickable navigation links.</li>
                        <li><strong>Complete Example Templates:</strong> All 5 templates now include full configurations (network, DNS, nodes, ports).</li>
                        <li><strong>ARM Template Import:</strong> Import Azure ARM templates directly from Azure Portal exports with automatic parameter mapping.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.8.2</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 19, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Custom Storage Subnets (Issue #50):</strong> Switchless diagram legends now display custom subnet CIDRs when Storage Auto IP is disabled.</li>
                        <li><strong>RDMA Tooltip:</strong> Clarified hardware requirement applies to multi-node clusters only.</li>
                        <li><strong>Code Cleanup:</strong> Simplified redundant null checks per Copilot review.</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">✨ Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>MLAG Peer Links:</strong> Added visual MLAG links between ToR switches in Storage Switched diagram.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.8.1</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 19, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes (Issue #48)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Compare Options Popup:</strong> Fixed styling - added max-height with scrolling, visible close button with hover effect, and sticky header.</li>
                        <li><strong>ToR Switch Logic:</strong> Fixed conditional logic so 1-3 node Hyperconverged clusters can choose Single or Dual ToR, while 4+ nodes correctly restrict to Dual only.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.8.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 19, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ New Features (Issue #47)</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>ToR Switch Options:</strong> Added Single/Dual ToR Switch selection for Storage Switched scenarios with Hyperconverged or Low Capacity clusters. Dual is required for 4+ node Hyperconverged clusters.</li>
                        <li><strong>Improved Storage Switched Diagram:</strong> Completely redesigned network diagram showing ToR switches at top, horizontal adapter layout, and uplink connections from adapters to switches.</li>
                        <li><strong>Storage Connectivity Labels:</strong> Renamed options to "Storage Switched" and "Storage Switchless" for clarity.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.7.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 19, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ Features</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Deploy to Azure Button:</strong> One-click deployment to Azure Portal with correct ARM template pre-loaded.</li>
                        <li><strong>Node Name Auto-Population:</strong> Auto-fill sequential node names from Node 1 pattern.</li>
                        <li><strong>DCB QoS Overrides:</strong> Customize Storage Priority, System/Cluster Priority, and Bandwidth Reservation.</li>
                        <li><strong>Proxy Bypass String:</strong> Auto-generated bypass string when proxy is enabled.</li>
                        <li><strong>Custom Storage Subnets:</strong> Specify custom storage subnet CIDRs when Auto IP is disabled.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.6.2</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 18, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 iOS Mobile Layout Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Summary Panel Fixed:</strong> Configuration Summary no longer blocks the page on iOS - now properly stacks below wizard steps.</li>
                        <li><strong>Header Layout Fixed:</strong> Logo no longer overlaps title on mobile - displays above with proper sizing.</li>
                        <li><strong>Improved Reliability:</strong> Stronger CSS rules ensure proper mobile layout on iOS Safari.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.6.1</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 18, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📱 Mobile Browser Support</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Responsive Design:</strong> Full mobile and tablet support with optimized layouts for all screen sizes.</li>
                        <li><strong>Touch-Friendly:</strong> Larger touch targets, removed hover effects on touch devices, and added active states.</li>
                        <li><strong>Mobile Modals:</strong> Preview and onboarding modals now display full-screen on mobile for better usability.</li>
                        <li><strong>iOS Support:</strong> Input fields use 16px font to prevent auto-zoom on focus.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.6.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 18, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ New Features</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Selected Option Checkmarks:</strong> Option cards now display a blue checkmark when selected for clear visual feedback.</li>
                        <li><strong>Renamed Action Buttons:</strong> "Generate Report" → "📋 Generate Cluster Design Document", "Generate ARM" → "🚀 Generate Cluster ARM Deployment Files".</li>
                    </ul>
                    <h4 style="color: var(--accent-purple); margin: 16px 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Step Indicators:</strong> Fixed all 19 step indicators to correctly show completion status.</li>
                        <li><strong>Validation Fixes:</strong> Improved validation for Network Traffic Intents, Management Connectivity, Infrastructure Network, and Active Directory steps.</li>
                        <li><strong>Import Stability:</strong> Fixed browser crash when importing configuration files.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.5.3</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 18, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Multi-Rack Message Visibility:</strong> Fixed issue where Multi-Rack option note remained visible after changing scenarios.</li>
                        <li><strong>RDMA Dropdown Auto-Disable:</strong> RDMA dropdown now auto-disables when NICs don't have RDMA enabled in Port Configuration.</li>
                        <li><strong>Low Capacity RDMA Enforcement:</strong> Low Capacity scenarios with Switched storage no longer enforce RDMA for storage intent.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.5.2</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 18, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🎨 Logo and Header Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Updated Logo:</strong> New Odin logo with improved design and proper aspect ratio.</li>
                        <li><strong>Theme-Aware Logo:</strong> Logo automatically switches between dark and light variants when toggling theme.</li>
                        <li><strong>Improved Header Layout:</strong> Title centered independently, logo on the right with version info below.</li>
                        <li><strong>Updated Disclaimer:</strong> Revised disclaimer text for clarity.</li>
                        <li><strong>Centered Disclaimer Box:</strong> Disclaimer now centered with fit-content width.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.5.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 17, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ Professional UX Enhancements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Configuration Preview:</strong> New preview button shows complete configuration summary before generating outputs.</li>
                        <li><strong>Breadcrumb Navigation:</strong> Clickable step indicators at the top for quick navigation between sections.</li>
                        <li><strong>Keyboard Shortcuts:</strong> Press Alt+? to see all shortcuts (Alt+P preview, Alt+R report, Alt+E export, etc.).</li>
                        <li><strong>PDF Export:</strong> Export your configuration summary as a printable PDF document.</li>
                        <li><strong>Onboarding Tutorial:</strong> First-time users see a helpful 3-step introduction to the wizard.</li>
                        <li><strong>Animated Transitions:</strong> Smooth fade-in animations for steps and modals.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.4.3</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 17, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🐛 Bug Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Scale Option Names:</strong> Renamed Step 04 options for clarity: "Low Capacity" → "Hyperconverged Low Capacity", "Standard" → "Hyperconverged", "Rack Aware" → "Hyperconverged Rack Aware".</li>
                        <li><strong>AD-Less Initial State:</strong> Fixed AD-Less option showing enabled on page load before infra IP is configured.</li>
                        <li><strong>M365 Local Warning:</strong> Fixed warning message persisting after selecting another deployment type.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.4.2</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 17, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📋 Example Configuration Templates</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Renamed Button & Modal:</strong> "Load Configuration Template" → "Load Example Configuration Template" for clarity.</li>
                        <li><strong>Complete Templates:</strong> All 5 templates now include ALL required wizard settings (witnessType, proxy, securityConfiguration, activeDirectory).</li>
                        <li><strong>Fixed Disconnected Template:</strong> Now correctly uses local_identity and NoWitness for air-gapped scenarios.</li>
                        <li><strong>Improved Descriptions:</strong> Updated template descriptions to be more informative about use cases.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.4.1</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 17, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📋 Updates & Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Disclaimer Notice:</strong> Added disclaimer informing users this tool is provided as-is without Microsoft support.</li>
                        <li><strong>Updated Description:</strong> Streamlined the main description text.</li>
                        <li><strong>Report Page Title:</strong> Fixed title to use "Odin for Azure Local" branding.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.4.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 16, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🚀 ARM Parameters - Deployment Automation</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Deployment Script Generation:</strong> Generate PowerShell and Azure CLI deployment scripts with one click.</li>
                        <li><strong>Parameter Input Fields:</strong> Editable fields for Subscription ID, Resource Group, and Deployment Name.</li>
                        <li><strong>Auto-Update Parameters:</strong> Parameters JSON updates in real-time as you fill in the fields.</li>
                        <li><strong>Bicep/Terraform Guidance:</strong> Modal showing IaC alternatives with conversion instructions.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.3.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 16, 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🎨 User Experience Enhancements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Font Size Controls:</strong> Adjust text size with A+ and A- buttons (4 size options: small, medium, large, x-large).</li>
                        <li><strong>Dark/Light Theme Toggle:</strong> Switch between dark and light themes instantly.</li>
                        <li><strong>Step Progress Indicators:</strong> Green checkmarks (✓) show completed configuration steps.</li>
                        <li><strong>Configuration Templates:</strong> 5 pre-built templates for common deployment scenarios.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📚 Documentation & Branding</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Tool Rebranding:</strong> Now called "Odin for Azure Local" (Optimal Deployment and Infrastructure Navigator).</li>
                        <li><strong>Firewall Requirements Link:</strong> Direct access to firewall and endpoint documentation in Outbound Connectivity step.</li>
                        <li><strong>Microsoft 365 Local Guidance:</strong> Selecting Microsoft 365 Local deployment type shows documentation link.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--success); margin: 0 0 12px 0;">🔧 Fixes & Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Rack Aware Restriction:</strong> Local Identity option is now properly disabled for Rack Aware deployments.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-blue); margin: 0 0 12px 0;">📋 Configuration Templates Included</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li>2-Node Standard Cluster (small production with cloud witness)</li>
                        <li>4-Node High Performance (medium cluster with dedicated storage)</li>
                        <li>8-Node Rack Aware (large rack-aware production cluster)</li>
                        <li>Disconnected - Management Cluster 3-Node (air-gapped with Autonomous Cloud endpoint)</li>
                        <li>Edge 2-Node Switchless (cost-optimized edge deployment)</li>
                    </ul>
                </div>
                        <li><strong>Documentation Links:</strong> Direct links to Microsoft Learn for security features and best practices.</li>
                        <li><strong>Enhanced Validation:</strong> All new configuration options included in readiness checks.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.1); border-left: 4px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.1.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🎉 Major Enhancements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Auto-Save & Resume:</strong> Your progress is automatically saved. Return anytime and pick up where you left off.</li>
                        <li><strong>Export/Import Configuration:</strong> Save your configuration as JSON and share it with your team or restore it later.</li>
                        <li><strong>CIDR Calculator:</strong> Built-in subnet calculator to help with IP address planning.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ User Experience</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Real-time Validation:</strong> Instant feedback on input fields with helpful error messages.</li>
                        <li><strong>Contextual Help:</strong> Click help icons throughout for detailed explanations.</li>
                        <li><strong>Toast Notifications:</strong> Clear feedback for actions like copy, export, and import.</li>
                        <li><strong>Improved Accessibility:</strong> Enhanced keyboard navigation and screen reader support.</li>
                    </ul>
                </div>

                <div>
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 Technical Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Enhanced Input Sanitization:</strong> Improved security for all user inputs.</li>
                        <li><strong>Version Tracking:</strong> All exports and saves include version information.</li>
                        <li><strong>Change Detection:</strong> See what changed when importing configurations.</li>
                        <li><strong>Better Error Handling:</strong> More informative error messages throughout.</li>
                    </ul>
                </div>
            </div>

            <div style="margin-top: 24px; padding: 16px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; text-align: center;">
                <div style="font-size: 14px; color: var(--accent-blue); margin-bottom: 8px;">Need Help?</div>
                <a href="https://github.com/Azure/AzureLocal-Supportability" target="_blank" style="color: var(--accent-blue); text-decoration: none; font-weight: 600;">View Documentation →</a>
            </div>
        </div>
    `;

    overlay.addEventListener('click', onOverlayClick);

    document.body.appendChild(overlay);
    // Allow closing the modal with the Escape key for accessibility.
    document.addEventListener('keydown', onKeyDown);
}
