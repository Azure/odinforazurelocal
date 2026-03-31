/**
 * Switch Config Generator — Main Page Logic
 *
 * Reads Designer state from localStorage, populates form fields,
 * orchestrates config generation, and renders output.
 */
/* global window, document, SwitchConfigBuilder, CiscoNxosRenderer, DellOs10Renderer, getTorModels, getBmcModels, SWITCH_MODELS */
(function () {
    'use strict';

    var STORAGE_KEY = 'odinDesignerToSwitchConfig';
    var designerState = null;

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

        // Deployment info banner
        var pattern = resolveDeploymentPattern(ds);
        var patternLabel = {
            fully_converged: 'Fully Converged (HyperConverged)',
            switched: 'Switched (Compute + Storage)',
            switchless: 'Switchless (Compute only on TOR)'
        };
        var bannerText = (patternLabel[pattern] || pattern) +
            ' · ' + (ds.nodes || '?') + ' nodes' +
            (ds.scale === 'rack-aware' ? ' · Rack-Aware (2 racks)' : ' · Single Rack');
        document.getElementById('sc-deployment-text').textContent = bannerText;

        // Infrastructure VLAN
        var infraVlanNote = document.getElementById('sc-infra-vlan-note');
        if (ds.infraVlan === 'custom' && ds.infraVlanId) {
            setVal('sc-infra-vlan', ds.infraVlanId);
            if (infraVlanNote) {
                infraVlanNote.style.display = 'block';
                infraVlanNote.textContent = 'Your Designer chose a custom management VLAN (ID ' + ds.infraVlanId + '). ' +
                    'This has been pre-filled below — the same VLAN must be configured on the TOR switch.';
            }
        } else {
            // Default (untagged) — host sends on native VLAN, switch must still define which VLAN that maps to
            if (infraVlanNote) {
                infraVlanNote.style.display = 'block';
                infraVlanNote.textContent = 'Your Designer uses the default (untagged) management VLAN. ' +
                    'The hosts send management traffic without a VLAN tag. Enter the native VLAN ID ' +
                    'configured on your TOR switch for this traffic (e.g. 7).';
            }
        }
        if (ds.infraCidr) {
            // infraCidr may be "10.0.0.0/24" or just "24"
            var cidr = ds.infraCidr;
            if (cidr.indexOf('/') !== -1) cidr = cidr.split('/')[1];
            setVal('sc-infra-cidr', cidr);
        }
        if (ds.infraGateway) setVal('sc-infra-gateway', ds.infraGateway);

        // Storage VLANs
        if (pattern === 'switchless') {
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

        // Default example IPs
        setVal('sc-loopback1', '10.0.255.1/32');
        setVal('sc-loopback2', '10.0.255.2/32');
        setVal('sc-p2p-b1-tor1', '10.0.0.2/30');
        setVal('sc-p2p-b1-tor2', '10.0.0.6/30');
        setVal('sc-p2p-b2-tor1', '10.0.0.10/30');
        setVal('sc-p2p-b2-tor2', '10.0.0.14/30');
        setVal('sc-ibgp-tor1', '10.0.0.17');
        setVal('sc-ibgp-tor2', '10.0.0.18');

        // Rack-aware: show TOR3/TOR4 fields
        if (ds.scale === 'rack-aware' || ds.scale === 'rack_aware') {
            var r2Host = document.getElementById('sc-rack2-hostnames');
            var r2Ips = document.getElementById('sc-rack2-ips');
            if (r2Host) r2Host.style.display = '';
            if (r2Ips) r2Ips.style.display = '';
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
    }

    function resolveDeploymentPattern(ds) {
        var storage = (ds.storage || '').toLowerCase();
        var intent = (ds.intent || '').toLowerCase();
        if (storage === 'switchless') return 'switchless';
        if (storage === 'switched' || storage === 'network_switch' || storage === 'network switch') return 'switched';
        if (intent === 'all_traffic' || intent === 'all traffic') return 'fully_converged';
        return 'fully_converged';
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

    // ── Generate Configs ─────────────────────────────────────────────
    window.generateConfigs = function () {
        var torModelKey = getVal('sc-tor-model');
        var bmcModelKey = getVal('sc-bmc-model');

        if (!torModelKey) {
            alert('Please select a TOR switch model.');
            return;
        }

        var isRackAware = designerState && (designerState.scale === 'rack-aware' || designerState.scale === 'rack_aware');

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
                    ip_tor2: getVal('sc-infra-ip-tor2')
                },
                compute: {
                    id: getVal('sc-compute-vlan'),
                    name: 'Tenant_' + getVal('sc-compute-vlan')
                },
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
            label: 'TOR1 (' + (getVal('sc-hostname-tor1') || 'tor-1a') + ')',
            id: 'tor1',
            config: renderer.renderFullConfig(tor1Json),
            json: tor1Json
        });

        // TOR2
        var tor2Json = builder.buildTor('TOR2');
        tor2Json.infrastructure = infrastructure;
        configs.push({
            label: 'TOR2 (' + (getVal('sc-hostname-tor2') || 'tor-1b') + ')',
            id: 'tor2',
            config: renderer.renderFullConfig(tor2Json),
            json: tor2Json
        });

        // Rack-aware: TOR3 & TOR4
        if (isRackAware) {
            var tor3Json = builder.buildTor('TOR3');
            tor3Json.infrastructure = infrastructure;
            configs.push({
                label: 'TOR3 (' + (getVal('sc-hostname-tor3') || 'tor-2a') + ')',
                id: 'tor3',
                config: renderer.renderFullConfig(tor3Json),
                json: tor3Json
            });

            var tor4Json = builder.buildTor('TOR4');
            tor4Json.infrastructure = infrastructure;
            configs.push({
                label: 'TOR4 (' + (getVal('sc-hostname-tor4') || 'tor-2b') + ')',
                id: 'tor4',
                config: renderer.renderFullConfig(tor4Json),
                json: tor4Json
            });
        }

        // BMC
        if (bmcModelKey) {
            var bmcJson = builder.buildBmc();
            if (bmcJson) {
                bmcJson.infrastructure = infrastructure;
                var bmcModel = SWITCH_MODELS[bmcModelKey];
                var bmcRenderer = bmcModel.firmware === 'nxos' ? CiscoNxosRenderer : DellOs10Renderer;
                configs.push({
                    label: 'BMC (' + (getVal('sc-hostname-bmc') || 'bmc-1') + ')',
                    id: 'bmc',
                    config: bmcRenderer.renderFullConfig(bmcJson),
                    json: bmcJson
                });
            }
        }

        renderOutput(configs);
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
