/**
 * Switch Config Generator — Main Page Logic
 *
 * Reads Designer state from localStorage, populates form fields,
 * orchestrates config generation, and renders output.
 */
/* global window, document, SwitchConfigBuilder, CiscoNxosRenderer, DellOs10Renderer, getTorModels, getBmcModels, SWITCH_MODELS, initializeAnalytics, trackPageView, trackFormCompletion */
(function () {
    'use strict';

    var STORAGE_KEY = 'odinDesignerToSwitchConfig';
    var designerState = null;

    // Initialize analytics + record page view (mirrors index.html / sizer.js bootstrap).
    if (typeof initializeAnalytics === 'function') {
        initializeAnalytics();
    }
    if (typeof trackPageView === 'function') {
        trackPageView();
    }

    // ── Initialization ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        loadDesignerData();
        populateModelDropdowns();
        if (designerState) {
            populateFromDesigner();
            document.getElementById('sc-main').style.display = 'block';
        } else {
            document.getElementById('sc-no-data').style.display = 'block';
        }
    });

    // ── Load Designer state from localStorage ────────────────────────
    function loadDesignerData() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            designerState = JSON.parse(raw);
        } catch (e) {
            console.warn('Failed to load switch-config payload:', e);
        }
    }

    // ── Populate model dropdowns ─────────────────────────────────────
    function populateModelDropdowns() {
        var torSelect = document.getElementById('sc-tor-model');
        var bmcSelect = document.getElementById('sc-bmc-model');

        var torModels = getTorModels();
        for (var t = 0; t < torModels.length; t++) {
            var opt = document.createElement('option');
            opt.value = torModels[t].key;
            opt.textContent = torModels[t].label;
            torSelect.appendChild(opt);
        }

        var bmcModels = getBmcModels();
        for (var b = 0; b < bmcModels.length; b++) {
            var bOpt = document.createElement('option');
            bOpt.value = bmcModels[b].key;
            bOpt.textContent = bmcModels[b].label;
            bmcSelect.appendChild(bOpt);
        }
    }

    // ── Pre-populate form from Designer state ────────────────────────
    function populateFromDesigner() {
        if (!designerState) return;
        var ds = designerState;

        // Deployment info banner — only show if we have meaningful data
        var banner = document.getElementById('sc-deployment-banner');
        if (ds.scenario && ds.nodes) {
            var pattern = resolveDeploymentPattern(ds);
            var patternLabel = {
                fully_converged: 'Fully Converged (HyperConverged)',
                switched: 'Storage Switched',
                switchless: 'Storage Switchless'
            };
            var bannerText = '';
            if (ds.architecture === 'disaggregated') {
                var stLabel = { fc_san: 'FC SAN', iscsi_4nic: 'iSCSI 4-NIC', iscsi_6nic: 'iSCSI 6-NIC' };
                bannerText = 'Disaggregated Storage (' + (stLabel[ds.disaggStorageType] || 'FC SAN') + ')' +
                    ' \u00B7 ' + (ds.nodes || '?') + ' nodes';
            } else {
                bannerText = (patternLabel[pattern] || pattern) +
                    ' \u00B7 ' + (ds.nodes || '?') + ' nodes' +
                    (ds.scale === 'rack_aware' || ds.scale === 'rack-aware' ? ' \u00B7 Rack-Aware Cluster (2 racks)' : ' \u00B7 Single Rack');
            }
            var textEl = document.getElementById('sc-deployment-text');
            if (textEl) textEl.innerHTML = bannerText + ' \u00B7 or use the <a href="#sc-qos-audit-section" style="color: var(--accent-blue); text-decoration: underline;">QoS Validator</a> to analyze an existing switch config.';
        } else {
            // Partial data — update the deployment banner with helpful guidance
            if (banner) {
                var textEl = document.getElementById('sc-deployment-text');
                if (textEl) textEl.innerHTML = 'Designer data is partial \u2014 configure switch settings below, or use the <a href="#sc-qos-audit-section" style="color: var(--accent-blue); text-decoration: underline;">QoS Validator</a> to analyze an existing switch config.';
            }
        }

        // Leaf-only scope banner for disaggregated deployments. The external SAN
        // fabric (FC zoning, iSCSI targets) and the EVPN spine/underlay are out
        // of scope for this leaf-focused generator — make that crystal clear.
        var disaggScopeBanner = document.getElementById('sc-disagg-scope-banner');
        if (disaggScopeBanner) {
            disaggScopeBanner.style.display = (ds.architecture === 'disaggregated') ? 'flex' : 'none';
        }

        // Per-rack leaf switches panel (disaggregated only, 2+ racks).
        // Renders one collapsible card per rack, with auto-defaults that
        // operators can override. Results are collected in generateConfigs()
        // and used to drive a per-rack builder call.
        renderDisaggRackCards(ds);

        // Infrastructure VLAN
        var infraVlanNote = document.getElementById('sc-infra-vlan-note');
        if (ds.architecture === 'disaggregated' && ds.disaggVlans && ds.disaggVlans.mgmt) {
            setVal('sc-infra-vlan', String(ds.disaggVlans.mgmt));
            if (infraVlanNote) {
                infraVlanNote.style.display = 'block';
                infraVlanNote.textContent = 'Your Designer configured a disaggregated management VLAN (ID ' + ds.disaggVlans.mgmt + '). ' +
                    'This has been pre-filled below.';
            }
        } else if (ds.infraVlan === 'custom' && ds.infraVlanId) {
            setVal('sc-infra-vlan', ds.infraVlanId);
            if (infraVlanNote) {
                infraVlanNote.style.display = 'block';
                infraVlanNote.textContent = 'Your Designer chose a custom management VLAN (ID ' + ds.infraVlanId + '). ' +
                    'This has been pre-filled below — the same VLAN must be configured on the ToR switch.';
            }
        } else {
            // Default (untagged) — host sends on native VLAN, switch must still define which VLAN that maps to
            if (infraVlanNote) {
                infraVlanNote.style.display = 'block';
                infraVlanNote.textContent = 'Your Designer uses the default (untagged) management VLAN. ' +
                    'The hosts send management traffic without a VLAN tag. Enter the native VLAN ID ' +
                    'configured on your ToR switch for this traffic (e.g. 7).';
            }
        }
        if (ds.infraCidr) {
            // infraCidr may be "10.0.0.0/24" or just "24"
            var cidr = ds.infraCidr;
            if (cidr.indexOf('/') !== -1) cidr = cidr.split('/')[1];
            setVal('sc-infra-cidr', cidr);
        }
        if (ds.infraGateway) setVal('sc-infra-gateway', ds.infraGateway);

        // Default infra VLAN values — only set if Designer didn't provide them
        if (!getVal('sc-infra-vlan')) setVal('sc-infra-vlan', '7');
        if (!getVal('sc-infra-cidr')) setVal('sc-infra-cidr', '24');

        // Derive default SVI IPs from the infrastructure gateway
        var isRackAware = ds.scale === 'rack-aware' || ds.scale === 'rack_aware';
        var infraGw = getVal('sc-infra-gateway') || '10.0.1.1';
        if (!getVal('sc-infra-gateway')) setVal('sc-infra-gateway', infraGw);
        var infraSvis = deriveSviIps(infraGw, isRackAware ? 4 : 2);
        if (infraSvis[0]) setVal('sc-infra-ip-tor1', infraSvis[0]);
        if (infraSvis[1]) setVal('sc-infra-ip-tor2', infraSvis[1]);
        if (isRackAware && infraSvis[2]) setVal('sc-infra-ip-tor3', infraSvis[2]);
        if (isRackAware && infraSvis[3]) setVal('sc-infra-ip-tor4', infraSvis[3]);

        // Default compute VLAN 1 — derive SVIs from gateway
        // For disaggregated clusters, use tenant network VLANs from Designer
        var isDisaggregated = ds.architecture === 'disaggregated';
        var tenantVlans = isDisaggregated && ds.disaggTenantNetworks ? flattenTenantVlans(ds.disaggTenantNetworks) : [];
        if (tenantVlans.length > 0) {
            // Populate compute VLAN slots from disaggregated tenant networks (up to 3)
            for (var tv = 0; tv < Math.min(tenantVlans.length, 3); tv++) {
                var idx = tv + 1;
                var block = document.getElementById('sc-compute-vlan-' + idx);
                if (block) block.style.display = '';
                setVal('sc-compute-vlan' + idx + '-id', String(tenantVlans[tv].vlan));
            }
        } else {
            setVal('sc-compute-vlan1-id', '201');
            setVal('sc-compute-vlan1-cidr', '24');
            setVal('sc-compute-vlan1-gw', '10.0.201.1');
            var compSvis = deriveSviIps('10.0.201.1', isRackAware ? 4 : 2);
            if (compSvis[0]) setVal('sc-compute-vlan1-tor1', compSvis[0]);
            if (compSvis[1]) setVal('sc-compute-vlan1-tor2', compSvis[1]);
            if (isRackAware && compSvis[2]) setVal('sc-compute-vlan1-tor3', compSvis[2]);
            if (isRackAware && compSvis[3]) setVal('sc-compute-vlan1-tor4', compSvis[3]);
        }

        // Storage VLANs — for disaggregated, use cluster VLANs from Designer
        // and relabel the section as "Cluster Networks" using Designer-supplied names.
        if (isDisaggregated && ds.disaggVlans) {
            if (ds.disaggVlans.cluster1) setVal('sc-storage1-vlan', String(ds.disaggVlans.cluster1));
            if (ds.disaggVlans.cluster2) setVal('sc-storage2-vlan', String(ds.disaggVlans.cluster2));
            var cNames = ds.disaggClusterNetworkNames || {};
            var cName1 = (cNames.cluster1 && String(cNames.cluster1).trim()) || 'Cluster Network 1';
            var cName2 = (cNames.cluster2 && String(cNames.cluster2).trim()) || 'Cluster Network 2';
            var sectionTitle = document.getElementById('sc-storage-section-title');
            if (sectionTitle) sectionTitle.textContent = 'Cluster Networks';
            var lbl1 = document.getElementById('sc-storage1-vlan-label');
            if (lbl1) lbl1.innerHTML = escapeAttr(cName1) + ' \u2014 <abbr title="Virtual Local Area Network">VLAN</abbr> (<abbr title="Top of Rack">ToR</abbr>1)';
            var lbl2 = document.getElementById('sc-storage2-vlan-label');
            if (lbl2) lbl2.innerHTML = escapeAttr(cName2) + ' \u2014 <abbr title="Virtual Local Area Network">VLAN</abbr> (<abbr title="Top of Rack">ToR</abbr>2)';
        } else if (pattern === 'switchless') {
            document.getElementById('sc-storage-section').style.display = 'none';
        } else {
            var storageVlans = extractStorageVlans(ds);
            if (storageVlans[0]) setVal('sc-storage1-vlan', storageVlans[0]);
            if (storageVlans[1]) setVal('sc-storage2-vlan', storageVlans[1]);
        }

        // Default hostnames
        setVal('sc-hostname-tor1', 'tor-1a');
        setVal('sc-hostname-tor2', 'tor-1b');
        setVal('sc-hostname-bmc', 'bmc-1');
        if (isRackAware) setVal('sc-hostname-bmc2', 'bmc-2');

        // Default example IPs
        setVal('sc-loopback1', '10.0.255.1/32');
        setVal('sc-loopback2', '10.0.255.2/32');
        setVal('sc-p2p-b1-tor1', '10.0.0.2/30');
        setVal('sc-p2p-b1-tor2', '10.0.0.6/30');
        setVal('sc-p2p-b2-tor1', '10.0.0.10/30');
        setVal('sc-p2p-b2-tor2', '10.0.0.14/30');
        setVal('sc-ibgp-tor1', '10.0.0.17');
        setVal('sc-ibgp-tor2', '10.0.0.18');

        // Rack-aware: show TOR3/TOR4 fields and set defaults
        toggleRack2Sections(isRackAware);
        if (isRackAware) {
            setVal('sc-hostname-tor3', 'tor-2a');
            setVal('sc-hostname-tor4', 'tor-2b');
            setVal('sc-loopback3', '10.0.255.3/32');
            setVal('sc-loopback4', '10.0.255.4/32');
            setVal('sc-p2p-b1-tor3', '10.0.0.42/30');
            setVal('sc-p2p-b1-tor4', '10.0.0.46/30');
            setVal('sc-p2p-b2-tor3', '10.0.0.50/30');
            setVal('sc-p2p-b2-tor4', '10.0.0.54/30');
            setVal('sc-ibgp-tor3', '10.0.0.33');
            setVal('sc-ibgp-tor4', '10.0.0.34');
        }

        // Pre-select the QoS Validator deployment-type dropdown to match the
        // Designer handoff, so validating an existing switch config against
        // the right rule set is one click away.
        var profileSelect = document.getElementById('sc-qos-audit-profile');
        if (profileSelect) {
            var profileKey = 'hci_switched';
            if (ds.architecture === 'disaggregated') {
                if (ds.disaggStorageType === 'fc_san') profileKey = 'disagg_fc';
                else if (ds.disaggStorageType === 'iscsi_4nic' || ds.disaggStorageType === 'iscsi_6nic') profileKey = 'disagg_iscsi';
                else profileKey = 'disagg_fc';
            } else if ((ds.storage || '').toLowerCase() === 'switchless') {
                profileKey = 'hci_switchless';
            }
            profileSelect.value = profileKey;
        }
    }

    function resolveDeploymentPattern(ds) {
        var storage = (ds.storage || '').toLowerCase();
        var intent = (ds.intent || '').toLowerCase();
        if (storage === 'switchless') return 'switchless';
        if (storage === 'switched' || storage === 'network_switch' || storage === 'network switch') return 'switched';
        if (intent === 'all_traffic' || intent === 'all traffic') return 'fully_converged';
        return 'fully_converged';
    }

    /**
     * Flatten disaggregated tenant networks into a simple array of VLAN objects.
     * Each tenant VRF can have multiple VLANs; we collect them all in order.
     */
    function flattenTenantVlans(tenantNetworks) {
        var vlans = [];
        for (var t = 0; t < tenantNetworks.length; t++) {
            var tenant = tenantNetworks[t];
            if (!tenant.vlans) continue;
            for (var v = 0; v < tenant.vlans.length; v++) {
                vlans.push({ vlan: tenant.vlans[v].vlan, name: tenant.vlans[v].name, vrf: tenant.vrf });
            }
        }
        return vlans;
    }

    function extractStorageVlans(ds) {
        var vlans = [null, null];
        if (!ds.intentOverrides) return vlans;

        // Try multiple possible keys for storage overrides
        var keys = ['storage', 'custom_storage'];
        for (var k = 0; k < keys.length; k++) {
            var ov = ds.intentOverrides[keys[k]];
            if (!ov) continue;
            if (ov.storageNetwork1VlanId != null) vlans[0] = ov.storageNetwork1VlanId;
            if (ov.storageVlanNic1 != null && vlans[0] == null) vlans[0] = ov.storageVlanNic1;
            if (ov.storageNetwork2VlanId != null) vlans[1] = ov.storageNetwork2VlanId;
            if (ov.storageVlanNic2 != null && vlans[1] == null) vlans[1] = ov.storageVlanNic2;
            if (vlans[0] != null) break;
        }
        return vlans;
    }

    function setVal(id, value) {
        var el = document.getElementById(id);
        if (el && value != null) el.value = value;
    }

    function getVal(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    /**
     * Derive default SVI IPs from a gateway IP.
     * Given gateway "10.0.1.1", returns ["10.0.1.2", "10.0.1.3", "10.0.1.4", "10.0.1.5"]
     */
    function deriveSviIps(gatewayIp, count) {
        var parts = gatewayIp.split('.');
        if (parts.length !== 4) return [];
        var lastOctet = parseInt(parts[3], 10);
        var prefix = parts[0] + '.' + parts[1] + '.' + parts[2] + '.';
        var ips = [];
        for (var i = 1; i <= count; i++) {
            var val = lastOctet + i;
            if (val > 254) break;
            ips.push(prefix + val);
        }
        return ips;
    }

    /**
     * Show or hide rack-2 SVI sections throughout the page based on rack-aware state.
     */
    function toggleRack2Sections(show) {
        show = !!show;
        // Infra Rack 2 SVI fields
        var r2Infra = document.getElementById('sc-rack2-infra');
        if (r2Infra) r2Infra.style.display = show ? '' : 'none';

        // Compute VLAN Rack 2 SVI fields (class-based toggle)
        var r2Compute = document.querySelectorAll('.sc-rack2-compute');
        for (var i = 0; i < r2Compute.length; i++) {
            r2Compute[i].style.display = show ? '' : 'none';
        }

        // Rack-2 hostname fields (inline within the hostname grid)
        var r2Host = document.getElementById('sc-rack2-hostnames');
        var r2HostTor4 = document.getElementById('sc-rack2-hostnames-tor4');
        if (r2Host) r2Host.style.display = show ? '' : 'none';
        if (r2HostTor4) r2HostTor4.style.display = show ? '' : 'none';

        // Rack headings
        var rack1Heading = document.getElementById('sc-rack1-heading');
        var rack2Heading = document.getElementById('sc-rack2-heading');
        if (rack1Heading) rack1Heading.style.display = show ? '' : 'none';
        if (rack2Heading) rack2Heading.style.display = show ? '' : 'none';

        // Switch hostname grid to 4 columns when rack-aware
        var hostGrid = document.getElementById('sc-hostname-grid');
        if (hostGrid) {
            if (show) hostGrid.classList.add('sc-grid-4');
            else hostGrid.classList.remove('sc-grid-4');
        }

        // Rack-2 BMC hostname
        var r2Bmc = document.getElementById('sc-rack2-bmc');
        if (r2Bmc) r2Bmc.style.display = show ? '' : 'none';

        // Rack-2 Site / Location field
        var r2Site = document.getElementById('sc-rack2-site');
        if (r2Site) r2Site.style.display = show ? '' : 'none';

        // Update Site label to include "Rack 1" when rack-aware
        var siteLabel = document.getElementById('sc-site-label');
        if (siteLabel) {
            siteLabel.textContent = show ? 'Rack 1 \u2014 Site / Location' : 'Site / Location';
        }

        // Update BMC1 label to include "Rack 1" when rack-aware
        var bmcLabel = document.querySelector('label[for="sc-hostname-bmc"]');
        if (bmcLabel) {
            bmcLabel.innerHTML = show
                ? 'Rack 1 \u2014 <abbr title="Baseboard Management Controller">BMC</abbr> Switch Hostname'
                : '<abbr title="Baseboard Management Controller">BMC</abbr> Switch Hostname';
        }

        // Existing rack-2 sections (loopback/P2P/iBGP)
        var r2Ips = document.getElementById('sc-rack2-ips');
        if (r2Ips) r2Ips.style.display = show ? '' : 'none';
    }

    // ── Read compute VLANs from form (up to 3) ──────────────────────
    function readComputeVlans() {
        var vlans = [];
        for (var i = 1; i <= 3; i++) {
            var block = document.getElementById('sc-compute-vlan-' + i);
            if (!block || block.style.display === 'none') continue;
            var id = getVal('sc-compute-vlan' + i + '-id');
            if (!id) continue;
            vlans.push({
                id: id,
                name: 'Tenant_' + id,
                cidr: getVal('sc-compute-vlan' + i + '-cidr'),
                gateway: getVal('sc-compute-vlan' + i + '-gw'),
                ip_tor1: getVal('sc-compute-vlan' + i + '-tor1'),
                ip_tor2: getVal('sc-compute-vlan' + i + '-tor2'),
                ip_tor3: getVal('sc-compute-vlan' + i + '-tor3'),
                ip_tor4: getVal('sc-compute-vlan' + i + '-tor4')
            });
        }
        return vlans;
    }

    // ── Subnet validation helpers ──────────────────────────────────
    function ipToInt(ip) {
        var parts = ip.split('.');
        return ((parseInt(parts[0], 10) << 24) |
                (parseInt(parts[1], 10) << 16) |
                (parseInt(parts[2], 10) << 8) |
                parseInt(parts[3], 10)) >>> 0;
    }

    function sameSubnet(ip1, ip2, cidr) {
        var mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
        return ((ipToInt(ip1) & mask) >>> 0) === ((ipToInt(ip2) & mask) >>> 0);
    }

    function isValidIp(ip) {
        var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
        if (!m) return false;
        for (var i = 1; i <= 4; i++) {
            var n = parseInt(m[i], 10);
            if (n < 0 || n > 255) return false;
        }
        return true;
    }

    /**
     * Validate that Gateway VIP and TOR SVI IPs are on the same subnet.
     * Returns an error message string, or empty string if valid.
     */
    function validateSubnetGroups() {
        var errors = [];
        var cidrStr, cidr, gw, tor1, tor2, tor3, tor4;
        var isRackAware = designerState && (designerState.scale === 'rack-aware' || designerState.scale === 'rack_aware');

        // Infrastructure / Management
        cidrStr = getVal('sc-infra-cidr');
        gw = getVal('sc-infra-gateway');
        tor1 = getVal('sc-infra-ip-tor1');
        tor2 = getVal('sc-infra-ip-tor2');
        tor3 = getVal('sc-infra-ip-tor3');
        tor4 = getVal('sc-infra-ip-tor4');
        cidr = parseInt(cidrStr, 10);
        if (gw && tor1 && cidrStr && !isNaN(cidr)) {
            if (!isValidIp(gw)) errors.push('Infrastructure: Gateway is not a valid IP address.');
            else if (!isValidIp(tor1)) errors.push('Infrastructure: TOR1 SVI IP is not a valid IP address.');
            else {
                if (!sameSubnet(gw, tor1, cidr))
                    errors.push('Infrastructure: Gateway (' + gw + ') and ToR1 SVI (' + tor1 + ') are not on the same /' + cidr + ' subnet.');
                if (tor2 && isValidIp(tor2) && !sameSubnet(gw, tor2, cidr))
                    errors.push('Infrastructure: Gateway (' + gw + ') and ToR2 SVI (' + tor2 + ') are not on the same /' + cidr + ' subnet.');
                if (isRackAware && tor3 && isValidIp(tor3) && !sameSubnet(gw, tor3, cidr))
                    errors.push('Infrastructure: Gateway (' + gw + ') and ToR3 SVI (' + tor3 + ') are not on the same /' + cidr + ' subnet.');
                if (isRackAware && tor4 && isValidIp(tor4) && !sameSubnet(gw, tor4, cidr))
                    errors.push('Infrastructure: Gateway (' + gw + ') and ToR4 SVI (' + tor4 + ') are not on the same /' + cidr + ' subnet.');
            }
        }

        // Compute VLANs 1–3
        for (var i = 1; i <= 3; i++) {
            var block = document.getElementById('sc-compute-vlan-' + i);
            if (!block || block.style.display === 'none') continue;
            var vlanId = getVal('sc-compute-vlan' + i + '-id');
            if (!vlanId) continue;

            var label = 'Compute VLAN ' + i + ' (' + vlanId + ')';
            cidrStr = getVal('sc-compute-vlan' + i + '-cidr');
            gw = getVal('sc-compute-vlan' + i + '-gw');
            tor1 = getVal('sc-compute-vlan' + i + '-tor1');
            tor2 = getVal('sc-compute-vlan' + i + '-tor2');
            tor3 = getVal('sc-compute-vlan' + i + '-tor3');
            tor4 = getVal('sc-compute-vlan' + i + '-tor4');

            // Require CIDR and Gateway when a compute VLAN ID is entered
            if (!cidrStr) errors.push(label + ': Subnet prefix length (CIDR) is required.');
            if (!gw) errors.push(label + ': Default gateway IP is required.');
            if (!tor1) errors.push(label + ': ToR1 SVI IP is required.');
            if (!tor2) errors.push(label + ': ToR2 SVI IP is required.');
            if (isRackAware && !tor3) errors.push(label + ': ToR3 SVI IP is required.');
            if (isRackAware && !tor4) errors.push(label + ': ToR4 SVI IP is required.');

            cidr = parseInt(cidrStr, 10);
            if (gw && tor1 && cidrStr && !isNaN(cidr)) {
                if (!isValidIp(gw)) errors.push(label + ': Gateway is not a valid IP address.');
                else if (!isValidIp(tor1)) errors.push(label + ': ToR1 SVI IP is not a valid IP address.');
                else {
                    if (!sameSubnet(gw, tor1, cidr))
                        errors.push(label + ': Gateway (' + gw + ') and ToR1 SVI (' + tor1 + ') are not on the same /' + cidr + ' subnet.');
                    if (tor2 && isValidIp(tor2) && !sameSubnet(gw, tor2, cidr))
                        errors.push(label + ': Gateway (' + gw + ') and ToR2 SVI (' + tor2 + ') are not on the same /' + cidr + ' subnet.');
                    if (isRackAware && tor3 && isValidIp(tor3) && !sameSubnet(gw, tor3, cidr))
                        errors.push(label + ': Gateway (' + gw + ') and ToR3 SVI (' + tor3 + ') are not on the same /' + cidr + ' subnet.');
                    if (isRackAware && tor4 && isValidIp(tor4) && !sameSubnet(gw, tor4, cidr))
                        errors.push(label + ': Gateway (' + gw + ') and ToR4 SVI (' + tor4 + ') are not on the same /' + cidr + ' subnet.');
                }
            }
        }

        return errors.join('\n');
    }

    // ── Disaggregated per-rack leaf overrides ─────────────────────────
    // Rack 1 ALWAYS uses the existing SC1 fields (sc-hostname-tor1/2,
    // sc-loopback1/2, sc-infra-ip-tor1/2, sc-hostname-bmc, sc-site). Racks
    // 2..N get their own collapsible card rendered into #sc-disagg-racks-container.
    // Each rack generates its own pair of ToR + BMC configs using a fresh
    // SwitchConfigBuilder with rack-scoped hostnames, ASN, loopbacks, and
    // Mgmt SVI IPs. Common VLAN/QoS/TACACS/NTP/BGP-underlay settings (SC2/SC3)
    // flow into every rack unchanged.
    function renderDisaggRackCards(ds) {
        var section = document.getElementById('sc-disagg-racks-section');
        var container = document.getElementById('sc-disagg-racks-container');
        if (!section || !container) return;

        var rackCount = parseInt(ds.disaggRackCount, 10) || 0;
        var isDisagg = ds.architecture === 'disaggregated';

        // Show for any disaggregated deployment (1..8 racks). Every rack gets
        // its own card — Rack 1 inclusive — so all rack-specific values
        // (hostnames, ASN, loopbacks, SVIs, P2P, iBGP) live in one place.
        if (!isDisagg) {
            section.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        if (rackCount < 1) rackCount = 1;
        if (rackCount > 8) rackCount = 8;

        section.style.display = '';
        var parts = [];

        // Emit cards for racks 1..N.
        for (var r = 1; r <= rackCount; r++) {
            var defAsn = 64789 + (r - 1);                          // Rack 1 = 64789
            var defLoopA = '10.0.255.' + (2 * r - 1) + '/32';
            var defLoopB = '10.0.255.' + (2 * r) + '/32';
            var defHostA = r === 1 ? 'tor-1a' : ('Rack' + r + '-tor-a');
            var defHostB = r === 1 ? 'tor-1b' : ('Rack' + r + '-tor-b');
            var defBmc   = r === 1 ? 'bmc-1' : ('Rack' + r + '-bmc');
            var defSite  = 'Datacenter-A Rack-' + r;
            // Per-rack P2P underlay IPs to the spine Border1/Border2.
            // Default scheme: /30 blocks of 4 starting at 10.0.0.2 for Rack 1.
            var p2pBase = (r - 1) * 16;  // 16 addresses per rack to leave room
            var defP2pB1A = '10.0.0.' + (p2pBase + 2)  + '/30';
            var defP2pB1B = '10.0.0.' + (p2pBase + 6)  + '/30';
            var defP2pB2A = '10.0.0.' + (p2pBase + 10) + '/30';
            var defP2pB2B = '10.0.0.' + (p2pBase + 14) + '/30';
            var defIbgpA  = '10.0.' + (100 + r) + '.1';
            var defIbgpB  = '10.0.' + (100 + r) + '.2';
            var open = (r === 1) ? ' open' : '';

            parts.push(
                '<details class="sc-rack-card" id="sc-disagg-rack-card-' + r + '"' + open + ' style="border: 1px solid var(--glass-border); border-radius: 6px; padding: 0.5rem 0.75rem; background: var(--subtle-bg);">' +
                '<summary style="cursor:pointer; font-weight:600; padding: 0.25rem 0;">Rack ' + r + ' — Leaf Pair <span style="font-weight:400; color:var(--text-secondary); font-size:0.85rem;">(ASN ' + defAsn + ', ' + defHostA + ' + ' + defHostB + ')</span></summary>' +
                '<h4 class="sc-rack-subhead">Identity</h4>' +
                '<div class="sc-grid" style="margin-top: 0.25rem;">' +
                  rackField(r, 'host-a',   'ToR-A Hostname',   defHostA, 'text') +
                  rackField(r, 'host-b',   'ToR-B Hostname',   defHostB, 'text') +
                  rackField(r, 'host-bmc', 'BMC Hostname',     defBmc,   'text') +
                  rackField(r, 'site',     'Site / Location',  defSite,  'text') +
                '</div>' +
                '<h4 class="sc-rack-subhead">Loopbacks &amp; BGP</h4>' +
                '<div class="sc-grid" style="margin-top: 0.25rem;">' +
                  rackField(r, 'asn',      'Leaf ASN',         String(defAsn), 'number') +
                  rackField(r, 'loop-a',   'Loopback ToR-A',   defLoopA, 'text') +
                  rackField(r, 'loop-b',   'Loopback ToR-B',   defLoopB, 'text') +
                '</div>' +
                '<h4 class="sc-rack-subhead">Management SVI IPs</h4>' +
                '<div class="sc-grid" style="margin-top: 0.25rem;">' +
                  rackField(r, 'svi-a',    'Mgmt SVI ToR-A',   '',       'text', 'e.g. 10.0.' + r + '.2') +
                  rackField(r, 'svi-b',    'Mgmt SVI ToR-B',   '',       'text', 'e.g. 10.0.' + r + '.3') +
                '</div>' +
                '<h4 class="sc-rack-subhead">P2P Links to Spine (Border1 / Border2)</h4>' +
                '<div class="sc-grid" style="margin-top: 0.25rem;">' +
                  rackField(r, 'p2p-b1-a', 'ToR-A → Border1',  defP2pB1A, 'text') +
                  rackField(r, 'p2p-b1-b', 'ToR-B → Border1',  defP2pB1B, 'text') +
                  rackField(r, 'p2p-b2-a', 'ToR-A → Border2',  defP2pB2A, 'text') +
                  rackField(r, 'p2p-b2-b', 'ToR-B → Border2',  defP2pB2B, 'text') +
                '</div>' +
                '<h4 class="sc-rack-subhead">iBGP Peering (within leaf pair)</h4>' +
                '<div class="sc-grid" style="margin-top: 0.25rem;">' +
                  rackField(r, 'ibgp-a',   'ToR-A iBGP IP',    defIbgpA, 'text') +
                  rackField(r, 'ibgp-b',   'ToR-B iBGP IP',    defIbgpB, 'text') +
                '</div>' +
                '</details>'
            );
        }

        container.innerHTML = parts.join('');

        // Hide the single-rack SC1/SC3 fields that are now superseded by the
        // per-rack cards. Border Router ASN stays in SC3 because it is shared
        // across the whole fabric.
        var sc1Rack1 = document.getElementById('sc-sc1-rack1-fields');
        var sc3ToRAsn = document.getElementById('sc-sc3-tor-asn-wrap');
        var sc3Routing = document.getElementById('sc-sc3-rack1-routing');
        if (sc1Rack1)   sc1Rack1.style.display   = 'none';
        if (sc3ToRAsn)  sc3ToRAsn.style.display  = 'none';
        if (sc3Routing) sc3Routing.style.display = 'none';
    }

    function rackField(rackNum, slug, label, defaultVal, type, placeholder) {
        var id = 'sc-disagg-rack-' + rackNum + '-' + slug;
        var ph = placeholder ? placeholder : (defaultVal || '');
        var pat = (slug === 'host-a' || slug === 'host-b' || slug === 'host-bmc')
            ? ' pattern="[a-zA-Z0-9]([a-zA-Z0-9\\-]{0,61}[a-zA-Z0-9])?" title="Alphanumeric and hyphens only, cannot start or end with a hyphen" maxlength="63"'
            : '';
        var min = (type === 'number') ? ' min="1" max="4294967294"' : '';
        return '<div class="sc-field">' +
            '<label for="' + id + '">' + escapeAttr(label) + '</label>' +
            '<input type="' + type + '" id="' + id + '" value="' + escapeAttr(defaultVal) + '" placeholder="' + escapeAttr(ph) + '"' + pat + min + '>' +
            '</div>';
    }

    // Collect per-rack overrides from the UI. For disaggregated deployments,
    // EVERY rack (including Rack 1) has its own card in SC1b. Returns an array
    // of rack objects ordered by rack number. Safe to call with rackCount < 1.
    function collectDisaggRackOverrides(rackCount) {
        var racks = [];
        if (rackCount < 1) return racks;
        if (rackCount > 8) rackCount = 8;
        for (var r = 1; r <= rackCount; r++) {
            var defAsn = 64789 + (r - 1);
            var p2pBase = (r - 1) * 16;
            var defHostA = r === 1 ? 'tor-1a' : ('Rack' + r + '-tor-a');
            var defHostB = r === 1 ? 'tor-1b' : ('Rack' + r + '-tor-b');
            var defBmc   = r === 1 ? 'bmc-1' : ('Rack' + r + '-bmc');
            racks.push({
                rackNumber: r,
                hostA:   getVal('sc-disagg-rack-' + r + '-host-a')   || defHostA,
                hostB:   getVal('sc-disagg-rack-' + r + '-host-b')   || defHostB,
                hostBmc: getVal('sc-disagg-rack-' + r + '-host-bmc') || defBmc,
                asn:     parseInt(getVal('sc-disagg-rack-' + r + '-asn'), 10) || defAsn,
                loopA:   getVal('sc-disagg-rack-' + r + '-loop-a')   || ('10.0.255.' + (2 * r - 1) + '/32'),
                loopB:   getVal('sc-disagg-rack-' + r + '-loop-b')   || ('10.0.255.' + (2 * r) + '/32'),
                sviA:    getVal('sc-disagg-rack-' + r + '-svi-a')    || '',
                sviB:    getVal('sc-disagg-rack-' + r + '-svi-b')    || '',
                site:    getVal('sc-disagg-rack-' + r + '-site')     || ('Datacenter-A Rack-' + r),
                p2pB1A:  getVal('sc-disagg-rack-' + r + '-p2p-b1-a') || ('10.0.0.' + (p2pBase + 2)  + '/30'),
                p2pB1B:  getVal('sc-disagg-rack-' + r + '-p2p-b1-b') || ('10.0.0.' + (p2pBase + 6)  + '/30'),
                p2pB2A:  getVal('sc-disagg-rack-' + r + '-p2p-b2-a') || ('10.0.0.' + (p2pBase + 10) + '/30'),
                p2pB2B:  getVal('sc-disagg-rack-' + r + '-p2p-b2-b') || ('10.0.0.' + (p2pBase + 14) + '/30'),
                ibgpA:   getVal('sc-disagg-rack-' + r + '-ibgp-a')   || ('10.0.' + (100 + r) + '.1'),
                ibgpB:   getVal('sc-disagg-rack-' + r + '-ibgp-b')   || ('10.0.' + (100 + r) + '.2')
            });
        }
        return racks;
    }

    // ── Generate Configs ─────────────────────────────────────────────
    window.generateConfigs = function () {
        var torModelKey = getVal('sc-tor-model');
        var bmcModelKey = getVal('sc-bmc-model');

        if (!torModelKey) {
            alert('Please select a ToR switch model.');
            return;
        }

        var validationErrors = validateSubnetGroups();
        if (validationErrors) {
            alert('Subnet validation failed:\n\n' + validationErrors);
            return;
        }

        var isRackAware = designerState && (designerState.scale === 'rack-aware' || designerState.scale === 'rack_aware');
        var isDisagg = designerState && designerState.architecture === 'disaggregated';
        var disaggRackCount = isDisagg ? (parseInt(designerState.disaggRackCount, 10) || 1) : 1;
        var isDisaggMulti = isDisagg && disaggRackCount >= 2;

        // For disaggregated deployments, Rack 1's identity/routing fields live
        // in the SC1b Rack 1 card. Sync them into the legacy SC1/SC3 field IDs
        // so the existing single-rack build path below (TOR1/TOR2/BMC) picks
        // up the per-rack values without further refactoring.
        if (isDisagg) {
            var r1 = collectDisaggRackOverrides(1)[0];
            if (r1) {
                setVal('sc-hostname-tor1', r1.hostA);
                setVal('sc-hostname-tor2', r1.hostB);
                setVal('sc-hostname-bmc',  r1.hostBmc);
                setVal('sc-site',          r1.site);
                setVal('sc-bgp-tor-asn',   String(r1.asn));
                setVal('sc-loopback1',     r1.loopA);
                setVal('sc-loopback2',     r1.loopB);
                setVal('sc-p2p-b1-tor1',   r1.p2pB1A);
                setVal('sc-p2p-b1-tor2',   r1.p2pB1B);
                setVal('sc-p2p-b2-tor1',   r1.p2pB2A);
                setVal('sc-p2p-b2-tor2',   r1.p2pB2B);
                setVal('sc-ibgp-tor1',     r1.ibgpA);
                setVal('sc-ibgp-tor2',     r1.ibgpB);
                if (r1.sviA) setVal('sc-infra-ip-tor1', r1.sviA);
                if (r1.sviB) setVal('sc-infra-ip-tor2', r1.sviB);
            }
        }

        var builder = new SwitchConfigBuilder({
            designerState: designerState || {},
            torModelKey: torModelKey,
            bmcModelKey: bmcModelKey || null,
            hostnames: {
                tor1: getVal('sc-hostname-tor1') || 'tor-1a',
                tor2: getVal('sc-hostname-tor2') || 'tor-1b',
                tor3: getVal('sc-hostname-tor3') || 'tor-2a',
                tor4: getVal('sc-hostname-tor4') || 'tor-2b',
                bmc: getVal('sc-hostname-bmc') || 'bmc-1'
            },
            site: getVal('sc-site'),
            site2: getVal('sc-site2'),
            bgp: {
                torAsn: parseInt(getVal('sc-bgp-tor-asn'), 10) || 65001,
                borderAsn: parseInt(getVal('sc-bgp-border-asn'), 10) || 64512,
                muxAsn: null
            },
            ips: {
                loopback1: getVal('sc-loopback1'),
                loopback2: getVal('sc-loopback2'),
                loopback3: getVal('sc-loopback3'),
                loopback4: getVal('sc-loopback4'),
                p2pBorder1Tor1: getVal('sc-p2p-b1-tor1'),
                p2pBorder1Tor2: getVal('sc-p2p-b1-tor2'),
                p2pBorder2Tor1: getVal('sc-p2p-b2-tor1'),
                p2pBorder2Tor2: getVal('sc-p2p-b2-tor2'),
                p2pBorder1Tor3: getVal('sc-p2p-b1-tor3'),
                p2pBorder1Tor4: getVal('sc-p2p-b1-tor4'),
                p2pBorder2Tor3: getVal('sc-p2p-b2-tor3'),
                p2pBorder2Tor4: getVal('sc-p2p-b2-tor4'),
                ibgpTor1: getVal('sc-ibgp-tor1'),
                ibgpTor2: getVal('sc-ibgp-tor2'),
                ibgpTor3: getVal('sc-ibgp-tor3'),
                ibgpTor4: getVal('sc-ibgp-tor4'),
                bmcGateway: getVal('sc-bmc-gateway')
            },
            vlans: {
                infra: {
                    id: getVal('sc-infra-vlan'),
                    name: 'Infra_' + getVal('sc-infra-vlan'),
                    cidr: getVal('sc-infra-cidr'),
                    gateway: getVal('sc-infra-gateway'),
                    ip_tor1: getVal('sc-infra-ip-tor1'),
                    ip_tor2: getVal('sc-infra-ip-tor2'),
                    ip_tor3: getVal('sc-infra-ip-tor3'),
                    ip_tor4: getVal('sc-infra-ip-tor4')
                },
                compute: readComputeVlans(),
                storage1: {
                    id: getVal('sc-storage1-vlan'),
                    name: 'Storage_' + getVal('sc-storage1-vlan') + '_TOR1'
                },
                storage2: {
                    id: getVal('sc-storage2-vlan'),
                    name: 'Storage_' + getVal('sc-storage2-vlan') + '_TOR2'
                },
                bmc: {
                    id: getVal('sc-bmc-vlan') || '125',
                    name: 'BMC_Mgmt_' + (getVal('sc-bmc-vlan') || '125'),
                    gateway: getVal('sc-bmc-gateway')
                },
                hnvpa: null
            }
        });

        // Build standard JSON for each switch
        var configs = [];
        var torModel = SWITCH_MODELS[torModelKey];
        var renderer = torModel.firmware === 'nxos' ? CiscoNxosRenderer : DellOs10Renderer;

        // Collect infrastructure service values for placeholder replacement
        var tzVal = getVal('sc-timezone');
        var tzParts = tzVal ? tzVal.split('|') : [];
        // tzParts: [abbr, offsetH, offsetM, dstAbbr, dstRule, ianaName]
        var infrastructure = {
            ntpServer: getVal('sc-ntp-server'),
            syslogServer: getVal('sc-syslog-server'),
            tacacsServer1: getVal('sc-tacacs-server1'),
            tacacsServer2: getVal('sc-tacacs-server2'),
            tacacsKey: getVal('sc-tacacs-key'),
            snmpRo: getVal('sc-snmp-ro'),
            snmpRw: getVal('sc-snmp-rw'),
            mgmtVlan: getVal('sc-mgmt-vlan'),
            mgmtGateway: getVal('sc-mgmt-gateway'),
            timezone: tzParts.length >= 6 ? {
                abbr: tzParts[0], offsetH: tzParts[1], offsetM: tzParts[2],
                dstAbbr: tzParts[3], dstRule: tzParts[4], iana: tzParts[5]
            } : null
        };

        // TOR1
        var tor1Json = builder.buildTor('TOR1');
        tor1Json.infrastructure = infrastructure;
        configs.push({
            label: (isDisaggMulti ? 'Rack 1 — ToR-A (' : 'ToR1 (') + (getVal('sc-hostname-tor1') || 'tor-1a') + ')',
            id: 'tor1',
            config: renderer.renderFullConfig(tor1Json),
            json: tor1Json
        });

        // TOR2
        var tor2Json = builder.buildTor('TOR2');
        tor2Json.infrastructure = infrastructure;
        configs.push({
            label: (isDisaggMulti ? 'Rack 1 — ToR-B (' : 'ToR2 (') + (getVal('sc-hostname-tor2') || 'tor-1b') + ')',
            id: 'tor2',
            config: renderer.renderFullConfig(tor2Json),
            json: tor2Json
        });

        // Rack-aware: TOR3 & TOR4
        if (isRackAware) {
            var tor3Json = builder.buildTor('TOR3');
            tor3Json.infrastructure = infrastructure;
            configs.push({
                label: 'ToR3 (' + (getVal('sc-hostname-tor3') || 'tor-2a') + ')',
                id: 'tor3',
                config: renderer.renderFullConfig(tor3Json),
                json: tor3Json
            });

            var tor4Json = builder.buildTor('TOR4');
            tor4Json.infrastructure = infrastructure;
            configs.push({
                label: 'ToR4 (' + (getVal('sc-hostname-tor4') || 'tor-2b') + ')',
                id: 'tor4',
                config: renderer.renderFullConfig(tor4Json),
                json: tor4Json
            });
        }

        // BMC
        if (bmcModelKey) {
            var bmcModel = SWITCH_MODELS[bmcModelKey];
            var bmcRenderer = bmcModel.firmware === 'nxos' ? CiscoNxosRenderer : DellOs10Renderer;

            var bmcJson = builder.buildBmc(getVal('sc-hostname-bmc') || 'bmc-1', getVal('sc-site'));
            if (bmcJson) {
                bmcJson.infrastructure = infrastructure;
                configs.push({
                    label: (isRackAware || isDisaggMulti ? 'Rack 1 — ' : '') + 'BMC (' + (getVal('sc-hostname-bmc') || 'bmc-1') + ')',
                    id: 'bmc',
                    config: bmcRenderer.renderFullConfig(bmcJson),
                    json: bmcJson
                });
            }

            // Rack-aware: second BMC switch for Rack 2
            if (isRackAware) {
                var bmc2Json = builder.buildBmc(getVal('sc-hostname-bmc2') || 'bmc-2', getVal('sc-site2'));
                if (bmc2Json) {
                    bmc2Json.infrastructure = infrastructure;
                    configs.push({
                        label: 'Rack 2 — BMC (' + (getVal('sc-hostname-bmc2') || 'bmc-2') + ')',
                        id: 'bmc2',
                        config: bmcRenderer.renderFullConfig(bmc2Json),
                        json: bmc2Json
                    });
                }
            }
        }

        // ── Disaggregated multi-rack: emit additional leaf pairs + BMCs ─────
        // Rack 1 is already emitted via the single-rack path above (its values
        // were synced from the SC1b Rack 1 card). For racks 2..N, build a
        // fresh SwitchConfigBuilder per rack scoped to that rack's hostnames,
        // ASN, loopbacks, Mgmt SVI IPs, and P2P/iBGP underlay peering while
        // reusing the common VLAN/QoS settings.
        if (isDisaggMulti) {
            var rackOverrides = collectDisaggRackOverrides(disaggRackCount);
            for (var ri = 0; ri < rackOverrides.length; ri++) {
                var ro = rackOverrides[ri];
                if (ro.rackNumber === 1) continue; // already emitted above
                var rackBuilder = new SwitchConfigBuilder({
                    designerState: designerState || {},
                    torModelKey: torModelKey,
                    bmcModelKey: bmcModelKey || null,
                    hostnames: {
                        tor1: ro.hostA,
                        tor2: ro.hostB,
                        bmc:  ro.hostBmc
                    },
                    site: ro.site || getVal('sc-site'),
                    site2: '',
                    bgp: {
                        torAsn: ro.asn,
                        borderAsn: parseInt(getVal('sc-bgp-border-asn'), 10) || 64512,
                        muxAsn: null
                    },
                    ips: {
                        loopback1: ro.loopA,
                        loopback2: ro.loopB,
                        // Per-rack underlay: each leaf pair has its own P2P
                        // links to the shared spine borders and its own iBGP
                        // within the pair.
                        p2pBorder1Tor1: ro.p2pB1A,
                        p2pBorder1Tor2: ro.p2pB1B,
                        p2pBorder2Tor1: ro.p2pB2A,
                        p2pBorder2Tor2: ro.p2pB2B,
                        ibgpTor1: ro.ibgpA,
                        ibgpTor2: ro.ibgpB,
                        bmcGateway: getVal('sc-bmc-gateway')
                    },
                    vlans: {
                        infra: {
                            id: getVal('sc-infra-vlan'),
                            name: 'Infra_' + getVal('sc-infra-vlan'),
                            cidr: getVal('sc-infra-cidr'),
                            gateway: getVal('sc-infra-gateway'),
                            ip_tor1: ro.sviA || getVal('sc-infra-ip-tor1'),
                            ip_tor2: ro.sviB || getVal('sc-infra-ip-tor2')
                        },
                        compute: readComputeVlans(),
                        storage1: {
                            id: getVal('sc-storage1-vlan'),
                            name: 'Storage_' + getVal('sc-storage1-vlan') + '_TOR1'
                        },
                        storage2: {
                            id: getVal('sc-storage2-vlan'),
                            name: 'Storage_' + getVal('sc-storage2-vlan') + '_TOR2'
                        },
                        bmc: {
                            id: getVal('sc-bmc-vlan') || '125',
                            name: 'BMC_Mgmt_' + (getVal('sc-bmc-vlan') || '125'),
                            gateway: getVal('sc-bmc-gateway')
                        },
                        hnvpa: null
                    }
                });

                var rTor1 = rackBuilder.buildTor('TOR1');
                rTor1.infrastructure = infrastructure;
                configs.push({
                    label: 'Rack ' + ro.rackNumber + ' — ToR-A (' + ro.hostA + ')',
                    id: 'r' + ro.rackNumber + '-tor-a',
                    config: renderer.renderFullConfig(rTor1),
                    json: rTor1
                });

                var rTor2 = rackBuilder.buildTor('TOR2');
                rTor2.infrastructure = infrastructure;
                configs.push({
                    label: 'Rack ' + ro.rackNumber + ' — ToR-B (' + ro.hostB + ')',
                    id: 'r' + ro.rackNumber + '-tor-b',
                    config: renderer.renderFullConfig(rTor2),
                    json: rTor2
                });

                if (bmcModelKey) {
                    var rBmcModel = SWITCH_MODELS[bmcModelKey];
                    var rBmcRenderer = rBmcModel.firmware === 'nxos' ? CiscoNxosRenderer : DellOs10Renderer;
                    var rBmcJson = rackBuilder.buildBmc(ro.hostBmc, ro.site || getVal('sc-site'));
                    if (rBmcJson) {
                        rBmcJson.infrastructure = infrastructure;
                        configs.push({
                            label: 'Rack ' + ro.rackNumber + ' — BMC (' + ro.hostBmc + ')',
                            id: 'r' + ro.rackNumber + '-bmc',
                            config: rBmcRenderer.renderFullConfig(rBmcJson),
                            json: rBmcJson
                        });
                    }
                }
            }
        }

        renderOutput(configs);

        // Anonymous usage counter — fire only on a successful generation
        // (after validation + renderOutput). Increments analytics/formCompletions/switchConfigGenerated.
        if (typeof trackFormCompletion === 'function') {
            trackFormCompletion('switchConfigGenerated');
        }
    };

    // ── Render tabbed output ─────────────────────────────────────────
    var configJsonMap = {};

    function renderOutput(configs) {
        var section = document.getElementById('sc-output-section');
        var tabsEl = document.getElementById('sc-output-tabs');
        var panelsEl = document.getElementById('sc-output-panels');

        tabsEl.innerHTML = '';
        panelsEl.innerHTML = '';
        configJsonMap = {};

        for (var i = 0; i < configs.length; i++) {
            var c = configs[i];
            configJsonMap[c.id] = c.json;

            // Tab button
            var tab = document.createElement('button');
            tab.className = 'sc-tab' + (i === 0 ? ' active' : '');
            tab.textContent = c.label;
            tab.setAttribute('data-tab', c.id);
            tab.onclick = switchTab;
            tabsEl.appendChild(tab);

            // Panel
            var panel = document.createElement('div');
            panel.className = 'sc-tab-content' + (i === 0 ? ' active' : '');
            panel.id = 'sc-panel-' + c.id;

            // Code header with copy/download/json
            var header = document.createElement('div');
            header.className = 'sc-code-header';
            header.innerHTML =
                '<span>Full Configuration</span>' +
                '<div class="sc-code-actions">' +
                '<button class="sc-code-btn" data-config-id="' + c.id + '" onclick="copySwitchConfig(this)">📋 Copy</button>' +
                '<button class="sc-code-btn" data-config-id="' + c.id + '" data-hostname="' + escapeAttr(c.label) + '" onclick="downloadSwitchConfig(this)">💾 Download</button>' +
                '<button class="sc-code-btn" data-config-id="' + c.id + '" data-hostname="' + escapeAttr(c.label) + '" onclick="exportSwitchJson(this)">📦 JSON</button>' +
                '</div>';
            panel.appendChild(header);

            // Code block
            var code = document.createElement('div');
            code.className = 'sc-code-block';
            code.id = 'sc-code-' + c.id;
            code.textContent = c.config;
            panel.appendChild(code);

            panelsEl.appendChild(panel);
        }

        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function switchTab(e) {
        var tabId = e.currentTarget.getAttribute('data-tab');
        // Deactivate all tabs and panels
        var tabs = document.querySelectorAll('.sc-tab');
        var panels = document.querySelectorAll('.sc-tab-content');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
        for (var j = 0; j < panels.length; j++) panels[j].classList.remove('active');
        // Activate selected
        e.currentTarget.classList.add('active');
        var panel = document.getElementById('sc-panel-' + tabId);
        if (panel) panel.classList.add('active');
    }

    // ── Copy config to clipboard ─────────────────────────────────────
    window.copySwitchConfig = function (btn) {
        var configId = btn.getAttribute('data-config-id');
        var codeEl = document.getElementById('sc-code-' + configId);
        if (!codeEl) return;
        var text = codeEl.textContent;
        navigator.clipboard.writeText(text).then(function () {
            var orig = btn.textContent;
            btn.textContent = '✓ Copied';
            setTimeout(function () { btn.textContent = orig; }, 2000);
        });
    };

    // ── Download config as file ──────────────────────────────────────
    window.downloadSwitchConfig = function (btn) {
        var configId = btn.getAttribute('data-config-id');
        var hostname = btn.getAttribute('data-hostname') || configId;
        var codeEl = document.getElementById('sc-code-' + configId);
        if (!codeEl) return;
        var text = codeEl.textContent;
        var blob = new Blob([text], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        // Sanitize filename
        var safeName = hostname.replace(/[^a-zA-Z0-9_\-]/g, '_');
        a.download = safeName + '_config.cfg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ── Export JSON data as file ─────────────────────────────────────
    window.exportSwitchJson = function (btn) {
        var configId = btn.getAttribute('data-config-id');
        var hostname = btn.getAttribute('data-hostname') || configId;
        var jsonData = configJsonMap[configId];
        if (!jsonData) return;
        var text = JSON.stringify(jsonData, null, 2);
        var blob = new Blob([text], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var safeName = hostname.replace(/[^a-zA-Z0-9_\-]/g, '_');
        a.download = safeName + '_config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    function escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
})();

// ── Compute VLAN add/remove (global for onclick) ─────────────────
/* global addComputeVlan, removeComputeVlan */
window.addComputeVlan = function () {
    for (var i = 2; i <= 3; i++) {
        var block = document.getElementById('sc-compute-vlan-' + i);
        if (block && block.style.display === 'none') {
            block.style.display = '';
            // Auto-populate SVI defaults for rack-aware deployments
            var dsRaw = null;
            try {
                dsRaw = JSON.parse(localStorage.getItem('odinDesignerToSwitchConfig'));
            } catch (e) {
                console.warn('Failed to parse odinDesignerToSwitchConfig from localStorage; falling back to defaults:', e);
            }
            var ra = dsRaw && (dsRaw.scale === 'rack-aware' || dsRaw.scale === 'rack_aware');
            var gwField = document.getElementById('sc-compute-vlan' + i + '-gw');
            if (gwField && gwField.value) {
                var parts = gwField.value.split('.');
                if (parts.length === 4) {
                    var last = parseInt(parts[3], 10);
                    var pfx = parts[0] + '.' + parts[1] + '.' + parts[2] + '.';
                    var torCount = ra ? 4 : 2;
                    var ids = ['tor1', 'tor2', 'tor3', 'tor4'];
                    for (var j = 0; j < torCount; j++) {
                        var v = last + j + 1;
                        if (v > 254) break;
                        var f = document.getElementById('sc-compute-vlan' + i + '-' + ids[j]);
                        if (f && !f.value) f.value = pfx + v;
                    }
                }
            }
            break;
        }
    }
    updateAddComputeBtn();
};
window.removeComputeVlan = function (n) {
    var block = document.getElementById('sc-compute-vlan-' + n);
    if (block) {
        block.style.display = 'none';
        // Clear values
        var inputs = block.querySelectorAll('input');
        for (var i = 0; i < inputs.length; i++) inputs[i].value = '';
    }
    updateAddComputeBtn();
};
function updateAddComputeBtn() {
    var btn = document.getElementById('sc-add-compute-vlan');
    if (!btn) return;
    var allVisible = true;
    for (var i = 2; i <= 3; i++) {
        var block = document.getElementById('sc-compute-vlan-' + i);
        if (block && block.style.display === 'none') { allVisible = false; break; }
    }
    btn.disabled = allVisible;
}
