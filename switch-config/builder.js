/**
 * Switch Config Builder
 *
 * Transforms ODIN Designer state + user inputs into standard JSON format
 * (one per switch) that can be rendered by the vendor-specific templates.
 *
 * Based on: https://github.com/microsoft/Azure_Local_Physical_Network_Config_Tool
 * (src/convertors/convertors_lab_switch_json.py — StandardJSONBuilder)
 */
/* global window, SWITCH_MODELS */
(function () {
    'use strict';

    var JUMBO_MTU = 9216;

    // ── Deep clone helper ────────────────────────────────────────────
    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // ── IP helper: compute network address from ip/cidr ──────────────
    function ipToInt(ip) {
        var parts = ip.split('.');
        return ((parseInt(parts[0], 10) << 24) |
                (parseInt(parts[1], 10) << 16) |
                (parseInt(parts[2], 10) << 8) |
                parseInt(parts[3], 10)) >>> 0;
    }

    function intToIp(num) {
        return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
    }

    function networkAddress(ip, cidr) {
        var mask = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
        return intToIp((ipToInt(ip) & mask) >>> 0);
    }

    function networkCidr(ip, cidr) {
        return networkAddress(ip, cidr) + '/' + cidr;
    }

    // ──────────────────────────────────────────────────────────────────
    //  SwitchConfigBuilder
    //
    //  @param {Object} params
    //    .designerState   — ODIN Designer state from localStorage
    //    .torModelKey     — Key into SWITCH_MODELS for TOR switch
    //    .bmcModelKey     — Key into SWITCH_MODELS for BMC switch
    //    .hostnames       — { tor1: '', tor2: '', bmc: '' }
    //    .site            — Free-text site/location string
    //    .bgp             — { torAsn: Number, borderAsn: Number, muxAsn: Number|null }
    //    .ips             — { loopback1: '', loopback2: '', p2pBorder1Tor1: '',
    //                         p2pBorder1Tor2: '', p2pBorder2Tor1: '', p2pBorder2Tor2: '',
    //                         ibgpTor1: '', ibgpTor2: '', bmcGateway: '' }
    //    .vlans           — { infra: { id, name, cidr, gateway, ip_tor1, ip_tor2 },
    //                         compute: { id, name }, storage1: { id, name },
    //                         storage2: { id, name }, bmc: { id, name, cidr, gateway, ip_bmc },
    //                         hnvpa: { id, name, subnet } }
    // ──────────────────────────────────────────────────────────────────
    function SwitchConfigBuilder(params) {
        this.designerState = params.designerState || {};
        this.torModel = SWITCH_MODELS[params.torModelKey];
        this.bmcModel = params.bmcModelKey ? SWITCH_MODELS[params.bmcModelKey] : null;
        this.hostnames = params.hostnames || {};
        this.site = params.site || '';
        this.bgp = params.bgp || {};
        this.ips = params.ips || {};
        this.vlans = params.vlans || {};

        // Determine deployment pattern from Designer state
        this.deploymentPattern = this._resolveDeploymentPattern();
    }

    SwitchConfigBuilder.prototype._resolveDeploymentPattern = function () {
        var ds = this.designerState;
        var storage = (ds.storage || '').toLowerCase();
        var intent = (ds.intent || '').toLowerCase();

        if (storage === 'switchless') return 'switchless';
        if (storage === 'switched' || storage === 'network_switch') return 'switched';
        // "All Traffic" or "HyperConverged"
        if (intent === 'all_traffic' || intent === 'all traffic') return 'fully_converged';
        // Default for other intents with switched storage
        if (storage === 'network switch' || storage === 'network_switch') return 'switched';
        return 'fully_converged';
    };

    // ── Build standard JSON for a TOR switch ─────────────────────────
    SwitchConfigBuilder.prototype.buildTor = function (switchType) {
        var sw = this._buildSwitchSection(switchType);
        var vlanMapResult = this._buildVlans(switchType);
        var vlans = vlanMapResult.vlans;
        var vlanMap = vlanMapResult.vlanMap;
        var ipMap = this._buildIpMap(switchType);
        var interfaces = this._buildInterfaces(switchType, vlanMap, ipMap);
        var portChannels = this._buildPortChannels(switchType, vlanMap, ipMap);
        var bgp = this._buildBgp(switchType, ipMap, vlans);
        var prefixLists = this._buildPrefixLists();

        return {
            switch: sw,
            vlans: vlans,
            interfaces: interfaces,
            port_channels: portChannels,
            bgp: bgp,
            prefix_lists: prefixLists,
            qos: this.deploymentPattern !== 'switchless'
        };
    };

    // ── Build standard JSON for a BMC switch ─────────────────────────
    SwitchConfigBuilder.prototype.buildBmc = function (hostnameOverride) {
        if (!this.bmcModel) return null;

        var sw = {
            make: this.bmcModel.make.toLowerCase(),
            model: this.bmcModel.model.toLowerCase(),
            type: 'BMC',
            hostname: hostnameOverride || this.hostnames.bmc || 'bmc-switch',
            version: '',
            firmware: this.bmcModel.firmware,
            site: this.site
        };

        // BMC VLANs: hardcoded Unused(2) + Native(99) + BMC VLAN (125 or user-defined)
        var bmcVlan = this.vlans.bmc || {};
        var bmcVlanId = parseInt(bmcVlan.id, 10) || 125;
        var vlans = [
            { vlan_id: 2, name: 'UNUSED_VLAN', shutdown: true },
            { vlan_id: 99, name: 'NATIVE_VLAN' }
        ];

        var bmcVlanEntry = {
            vlan_id: bmcVlanId,
            name: bmcVlan.name || 'BMC_Mgmt_' + bmcVlanId
        };

        // Add SVI if BMC IP info provided
        if (bmcVlan.ip_bmc && bmcVlan.cidr) {
            bmcVlanEntry.interface = {
                ip: bmcVlan.ip_bmc,
                cidr: parseInt(bmcVlan.cidr, 10),
                mtu: JUMBO_MTU
            };
        }
        vlans.push(bmcVlanEntry);
        vlans.sort(function (a, b) { return a.vlan_id - b.vlan_id; });

        // Interfaces: use common templates from model
        var interfaces = deepClone(this.bmcModel.interface_templates.common || []);

        // Port channels
        var portChannels = deepClone(this.bmcModel.port_channels || []);

        // Resolve symbolic 'B' VLAN references in interfaces and port channels
        var bmcVlanMap = { B: [bmcVlanId] };
        for (var ii = 0; ii < interfaces.length; ii++) {
            var iface = interfaces[ii];
            if (iface.type === 'Access' && iface.access_vlan) {
                iface.access_vlan = this._resolveVlans('BMC', iface.access_vlan, bmcVlanMap);
            }
            if (iface.type === 'Trunk') {
                if (iface.tagged_vlans) {
                    iface.tagged_vlans = this._resolveVlans('BMC', iface.tagged_vlans, bmcVlanMap);
                }
            }
        }
        for (var pi = 0; pi < portChannels.length; pi++) {
            var pc = portChannels[pi];
            if (pc.tagged_vlans) {
                pc.tagged_vlans = this._resolveVlans('BMC', pc.tagged_vlans, bmcVlanMap);
            }
        }

        // Static routes: default route via BMC gateway
        var staticRoutes = [];
        if (this.ips.bmcGateway || (bmcVlan.gateway)) {
            staticRoutes.push({
                prefix: '0.0.0.0/0',
                next_hop: this.ips.bmcGateway || bmcVlan.gateway
            });
        }

        return {
            switch: sw,
            vlans: vlans,
            interfaces: interfaces,
            port_channels: portChannels,
            static_routes: staticRoutes
        };
    };

    // ── Private: build switch section ────────────────────────────────
    SwitchConfigBuilder.prototype._buildSwitchSection = function (switchType) {
        var hostnameMap = { TOR1: this.hostnames.tor1, TOR2: this.hostnames.tor2, TOR3: this.hostnames.tor3, TOR4: this.hostnames.tor4 };
        return {
            make: this.torModel.make.toLowerCase(),
            model: this.torModel.model.toLowerCase(),
            type: switchType,
            hostname: hostnameMap[switchType] || switchType.toLowerCase(),
            version: '',
            firmware: this.torModel.firmware,
            site: this.site
        };
    };

    // ── Private: build VLAN section ──────────────────────────────────
    SwitchConfigBuilder.prototype._buildVlans = function (switchType) {
        var vlansOut = [];
        var vlanMap = { M: [], C: [], S: [], S1: [], S2: [], B: [], UNUSED: [], NATIVE: [] };
        var v = this.vlans;

        // UNUSED VLAN (always present)
        vlansOut.push({ vlan_id: 2, name: 'UNUSED_VLAN', shutdown: true });
        vlanMap.UNUSED.push(2);

        // Infrastructure (M) VLAN
        if (v.infra && v.infra.id) {
            var infraId = parseInt(v.infra.id, 10);
            vlanMap.M.push(infraId);
            var infraEntry = { vlan_id: infraId, name: v.infra.name || 'Infra_' + infraId };
            var infraIpMap = { TOR1: v.infra.ip_tor1, TOR2: v.infra.ip_tor2, TOR3: v.infra.ip_tor3, TOR4: v.infra.ip_tor4 };
            var infraIp = infraIpMap[switchType];
            // TOR3/TOR4 priority mirrors TOR1/TOR2: odd TORs get 150, even get 140
            var infraPriority = (switchType === 'TOR1' || switchType === 'TOR3') ? 150 : 140;
            if (infraIp && v.infra.cidr) {
                infraEntry.interface = {
                    ip: infraIp,
                    cidr: parseInt(v.infra.cidr, 10),
                    mtu: JUMBO_MTU,
                    redundancy: {
                        type: this.torModel.firmware === 'nxos' ? 'hsrp' : 'vrrp',
                        group: infraId,
                        priority: infraPriority,
                        virtual_ip: v.infra.gateway || ''
                    }
                };
            }
            vlansOut.push(infraEntry);
        }

        // BMC VLAN (carried on TOR trunks to BMC switch)
        if (v.bmc && v.bmc.id) {
            var bmcId = parseInt(v.bmc.id, 10);
            vlanMap.B.push(bmcId);
            var bmcEntry = { vlan_id: bmcId, name: v.bmc.name || 'BMC_Mgmt_' + bmcId };
            if (v.bmc.ip_tor1 && v.bmc.cidr) {
                var bmcIpMap = { TOR1: v.bmc.ip_tor1, TOR2: v.bmc.ip_tor2, TOR3: v.bmc.ip_tor3, TOR4: v.bmc.ip_tor4 };
                var bmcIp = bmcIpMap[switchType];
                var bmcPriority = (switchType === 'TOR1' || switchType === 'TOR3') ? 150 : 140;
                if (bmcIp) {
                    bmcEntry.interface = {
                        ip: bmcIp,
                        cidr: parseInt(v.bmc.cidr, 10),
                        mtu: JUMBO_MTU,
                        redundancy: {
                            type: this.torModel.firmware === 'nxos' ? 'hsrp' : 'vrrp',
                            group: bmcId,
                            priority: bmcPriority,
                            virtual_ip: v.bmc.gateway || ''
                        }
                    };
                }
            }
            vlansOut.push(bmcEntry);
        }

        // Compute / Tenant (C) VLANs — supports single object (legacy) or array
        var computeList = Array.isArray(v.compute) ? v.compute : (v.compute && v.compute.id ? [v.compute] : []);
        for (var ci = 0; ci < computeList.length; ci++) {
            var comp = computeList[ci];
            if (!comp.id) continue;
            var compId = parseInt(comp.id, 10);
            vlanMap.C.push(compId);
            var compEntry = { vlan_id: compId, name: comp.name || 'Tenant_' + compId };
            // If subnet info provided, create L3 SVI with HSRP/VRRP
            if (comp.ip_tor1 && comp.cidr) {
                var compIpMap = { TOR1: comp.ip_tor1, TOR2: comp.ip_tor2, TOR3: comp.ip_tor3, TOR4: comp.ip_tor4 };
                var compIp = compIpMap[switchType];
                var compPriority = (switchType === 'TOR1' || switchType === 'TOR3') ? 150 : 140;
                if (compIp) {
                    compEntry.interface = {
                        ip: compIp,
                        cidr: parseInt(comp.cidr, 10),
                        mtu: JUMBO_MTU,
                        redundancy: {
                            type: this.torModel.firmware === 'nxos' ? 'hsrp' : 'vrrp',
                            group: compId,
                            priority: compPriority,
                            virtual_ip: comp.gateway || ''
                        }
                    };
                }
            }
            vlansOut.push(compEntry);
        }

        // HNVPA VLAN (also classified as C)
        if (v.hnvpa && v.hnvpa.id) {
            var hnvpaId = parseInt(v.hnvpa.id, 10);
            vlanMap.C.push(hnvpaId);
            var hnvpaEntry = { vlan_id: hnvpaId, name: v.hnvpa.name || 'HNVPA_' + hnvpaId };
            if (v.hnvpa.ip_tor1 && v.hnvpa.cidr) {
                var hIpMap = { TOR1: v.hnvpa.ip_tor1, TOR2: v.hnvpa.ip_tor2, TOR3: v.hnvpa.ip_tor3, TOR4: v.hnvpa.ip_tor4 };
                var hIp = hIpMap[switchType];
                var hPriority = (switchType === 'TOR1' || switchType === 'TOR3') ? 150 : 140;
                if (hIp) {
                    hnvpaEntry.interface = {
                        ip: hIp,
                        cidr: parseInt(v.hnvpa.cidr, 10),
                        mtu: JUMBO_MTU,
                        redundancy: {
                            type: this.torModel.firmware === 'nxos' ? 'hsrp' : 'vrrp',
                            group: hnvpaId,
                            priority: hPriority,
                            virtual_ip: v.hnvpa.gateway || ''
                        }
                    };
                }
            }
            vlansOut.push(hnvpaEntry);
        }

        // Storage (S) VLANs
        if (this.deploymentPattern !== 'switchless') {
            if (v.storage1 && v.storage1.id) {
                var s1Id = parseInt(v.storage1.id, 10);
                vlanMap.S.push(s1Id);
                vlanMap.S1.push(s1Id);
                // In switched pattern, storage1 → TOR1/TOR3 only (odd TORs)
                if (this.deploymentPattern === 'switched' && (switchType === 'TOR2' || switchType === 'TOR4')) {
                    // skip — this VLAN belongs to TOR1/TOR3
                } else {
                    vlansOut.push({ vlan_id: s1Id, name: v.storage1.name || 'Storage_' + s1Id + '_TOR1' });
                }
            }
            if (v.storage2 && v.storage2.id) {
                var s2Id = parseInt(v.storage2.id, 10);
                vlanMap.S.push(s2Id);
                vlanMap.S2.push(s2Id);
                // In switched pattern, storage2 → TOR2/TOR4 only (even TORs)
                if (this.deploymentPattern === 'switched' && (switchType === 'TOR1' || switchType === 'TOR3')) {
                    // skip — this VLAN belongs to TOR2/TOR4
                } else {
                    vlansOut.push({ vlan_id: s2Id, name: v.storage2.name || 'Storage_' + s2Id + '_TOR2' });
                }
            }
        }

        vlansOut.sort(function (a, b) { return a.vlan_id - b.vlan_id; });
        return { vlans: vlansOut, vlanMap: vlanMap };
    };

    // ── Private: build IP map ────────────────────────────────────────
    SwitchConfigBuilder.prototype._buildIpMap = function (switchType) {
        var ip = this.ips;
        var map = {};

        // Loopback0
        if (switchType === 'TOR1' && ip.loopback1) {
            map.LOOPBACK0_TOR1 = ip.loopback1;
        } else if (switchType === 'TOR2' && ip.loopback2) {
            map.LOOPBACK0_TOR2 = ip.loopback2;
        } else if (switchType === 'TOR3' && ip.loopback3) {
            map.LOOPBACK0_TOR3 = ip.loopback3;
        } else if (switchType === 'TOR4' && ip.loopback4) {
            map.LOOPBACK0_TOR4 = ip.loopback4;
        }

        // P2P to Border routers
        if (ip.p2pBorder1Tor1) {
            map.P2P_BORDER1_TOR1 = ip.p2pBorder1Tor1;
            // Peer IP = first IP in /30 (our IP is last)
            map.P2P_TOR1_BORDER1 = this._peerIp(ip.p2pBorder1Tor1);
        }
        if (ip.p2pBorder1Tor2) {
            map.P2P_BORDER1_TOR2 = ip.p2pBorder1Tor2;
            map.P2P_TOR2_BORDER1 = this._peerIp(ip.p2pBorder1Tor2);
        }
        if (ip.p2pBorder2Tor1) {
            map.P2P_BORDER2_TOR1 = ip.p2pBorder2Tor1;
            map.P2P_TOR1_BORDER2 = this._peerIp(ip.p2pBorder2Tor1);
        }
        if (ip.p2pBorder2Tor2) {
            map.P2P_BORDER2_TOR2 = ip.p2pBorder2Tor2;
            map.P2P_TOR2_BORDER2 = this._peerIp(ip.p2pBorder2Tor2);
        }

        // TOR3/TOR4 P2P (rack-aware)
        if (ip.p2pBorder1Tor3) {
            map.P2P_BORDER1_TOR3 = ip.p2pBorder1Tor3;
            map.P2P_TOR3_BORDER1 = this._peerIp(ip.p2pBorder1Tor3);
        }
        if (ip.p2pBorder1Tor4) {
            map.P2P_BORDER1_TOR4 = ip.p2pBorder1Tor4;
            map.P2P_TOR4_BORDER1 = this._peerIp(ip.p2pBorder1Tor4);
        }
        if (ip.p2pBorder2Tor3) {
            map.P2P_BORDER2_TOR3 = ip.p2pBorder2Tor3;
            map.P2P_TOR3_BORDER2 = this._peerIp(ip.p2pBorder2Tor3);
        }
        if (ip.p2pBorder2Tor4) {
            map.P2P_BORDER2_TOR4 = ip.p2pBorder2Tor4;
            map.P2P_TOR4_BORDER2 = this._peerIp(ip.p2pBorder2Tor4);
        }

        // iBGP P2P
        if (ip.ibgpTor1) map.P2P_IBGP_TOR1 = ip.ibgpTor1;
        if (ip.ibgpTor2) map.P2P_IBGP_TOR2 = ip.ibgpTor2;
        if (ip.ibgpTor3) map.P2P_IBGP_TOR3 = ip.ibgpTor3;
        if (ip.ibgpTor4) map.P2P_IBGP_TOR4 = ip.ibgpTor4;

        // HNVPA subnet
        if (this.vlans.hnvpa && this.vlans.hnvpa.subnet) {
            map.HNVPA = this.vlans.hnvpa.subnet;
        }

        return map;
    };

    // ── Private: get peer IP from a /30 address string ───────────────
    SwitchConfigBuilder.prototype._peerIp = function (addrWithCidr) {
        // addr like "10.0.0.2/30" → peer is "10.0.0.1"
        var parts = addrWithCidr.split('/');
        var ip = parts[0];
        var n = ipToInt(ip);
        // In a /30, there are 2 usable hosts: .1 and .2
        // Our IP's last bit: if it's .2 → peer is .1, if .1 → peer is .2
        var last = n & 3;
        if (last === 1) return intToIp(n + 1);
        if (last === 2) return intToIp(n - 1);
        return ip;
    };

    // ── Private: resolve VLAN symbolic refs to IDs ───────────────────
    SwitchConfigBuilder.prototype._resolveVlans = function (switchType, vlanStr, vlanMap) {
        if (!vlanStr) return '';
        var parts = vlanStr.split(',');
        var resolved = [];
        var seen = {};

        for (var i = 0; i < parts.length; i++) {
            var part = parts[i].trim();

            if (part === 'S') {
                // Prefer TOR-specific storage, then fall back to generic
                // TOR1/TOR3 (odd) → S1, TOR2/TOR4 (even) → S2
                var sList = [];
                if ((switchType === 'TOR1' || switchType === 'TOR3') && vlanMap.S1 && vlanMap.S1.length) {
                    sList = vlanMap.S1;
                } else if ((switchType === 'TOR2' || switchType === 'TOR4') && vlanMap.S2 && vlanMap.S2.length) {
                    sList = vlanMap.S2;
                } else if (vlanMap.S && vlanMap.S.length) {
                    sList = vlanMap.S;
                }
                for (var s = 0; s < sList.length; s++) {
                    var sv = String(sList[s]);
                    if (!seen[sv]) { resolved.push(sv); seen[sv] = true; }
                }
                continue;
            }

            if (part === 'S1' || part === 'S2') {
                var list = vlanMap[part] || [];
                for (var j = 0; j < list.length; j++) {
                    var v = String(list[j]);
                    if (!seen[v]) { resolved.push(v); seen[v] = true; }
                }
                continue;
            }

            if (vlanMap[part]) {
                for (var k = 0; k < vlanMap[part].length; k++) {
                    var vv = String(vlanMap[part][k]);
                    if (!seen[vv]) { resolved.push(vv); seen[vv] = true; }
                }
                continue;
            }

            // Literal VLAN ID
            if (/^\d+$/.test(part) && !seen[part]) {
                resolved.push(part);
                seen[part] = true;
            }
        }

        return resolved.join(',');
    };

    // ── Private: build interfaces ────────────────────────────────────
    SwitchConfigBuilder.prototype._buildInterfaces = function (switchType, vlanMap, ipMap) {
        var templates = this.torModel.interface_templates;
        var commonTemplates = templates.common || [];

        // Select deployment-pattern templates
        var effectivePattern = this.deploymentPattern;
        // Dell: pick fully_converged1 (trunk) vs fully_converged2 (access)
        if (this.torModel.firmware === 'os10' && effectivePattern === 'fully_converged') {
            var hasC = vlanMap.C && vlanMap.C.length > 0;
            var hasS = (vlanMap.S && vlanMap.S.length) || (vlanMap.S1 && vlanMap.S1.length) || (vlanMap.S2 && vlanMap.S2.length);
            if (vlanMap.M && vlanMap.M.length && !hasC && !hasS) {
                effectivePattern = 'fully_converged2';
            } else {
                effectivePattern = 'fully_converged1';
            }
        }

        var patternTemplates = templates[effectivePattern] || [];

        var interfaces = [];
        var allTemplates = commonTemplates.concat(patternTemplates);

        for (var i = 0; i < allTemplates.length; i++) {
            var tmpl = deepClone(allTemplates[i]);
            interfaces.push(this._processInterfaceTemplate(switchType, tmpl, vlanMap, ipMap));
        }

        return interfaces;
    };

    SwitchConfigBuilder.prototype._processInterfaceTemplate = function (switchType, iface, vlanMap, ipMap) {
        // Resolve Access VLAN
        if (iface.type === 'Access' && iface.access_vlan) {
            iface.access_vlan = this._resolveVlans(switchType, iface.access_vlan, vlanMap);
        }

        // Resolve Trunk VLANs
        if (iface.type === 'Trunk') {
            if (iface.native_vlan) {
                iface.native_vlan = this._resolveVlans(switchType, iface.native_vlan, vlanMap);
            }
            if (iface.tagged_vlans) {
                iface.tagged_vlans = this._resolveVlans(switchType, iface.tagged_vlans, vlanMap);
            }
        }

        // Resolve L3 IP
        if (iface.type === 'L3' && iface.ipv4 === '') {
            var key = (iface.name + '_' + switchType).toUpperCase();
            if (ipMap[key]) {
                iface.ipv4 = ipMap[key];
            }
        }

        return iface;
    };

    // ── Private: build port channels ─────────────────────────────────
    SwitchConfigBuilder.prototype._buildPortChannels = function (switchType, vlanMap, ipMap) {
        var pcs = deepClone(this.torModel.port_channels || []);

        for (var i = 0; i < pcs.length; i++) {
            var pc = pcs[i];

            // Resolve trunk VLANs
            if (pc.type === 'Trunk') {
                if (pc.native_vlan) {
                    pc.native_vlan = this._resolveVlans(switchType, pc.native_vlan, vlanMap);
                }
                if (pc.tagged_vlans !== undefined) {
                    pc.tagged_vlans = this._resolveVlans(switchType, pc.tagged_vlans, vlanMap);
                }
            }

            // Enrich L3 port-channels (iBGP)
            if (pc.description === 'P2P_IBGP' && pc.type === 'L3') {
                var ibgpKey = 'P2P_IBGP_' + switchType.toUpperCase();
                if (ipMap[ibgpKey]) {
                    pc.ipv4 = ipMap[ibgpKey];
                }
            }
        }

        return pcs;
    };

    // ── Private: build BGP section ───────────────────────────────────
    SwitchConfigBuilder.prototype._buildBgp = function (switchType, ipMap, vlans) {
        var torAsn = this.bgp.torAsn || 65001;
        var borderAsn = this.bgp.borderAsn || 64512;

        var loopbackKey = 'LOOPBACK0_' + switchType.toUpperCase();
        var loopback = ipMap[loopbackKey] || '';
        var routerId = loopback ? loopback.split('/')[0] : '';

        // Build network advertisements
        var networks = [];
        var seenNet = {};

        function addNetwork(n) {
            if (n && !seenNet[n]) { networks.push(n); seenNet[n] = true; }
        }

        // P2P Border subnets — advertise the connected /30 prefix, not the host address
        var b1Key = 'P2P_BORDER1_' + switchType.toUpperCase();
        var b2Key = 'P2P_BORDER2_' + switchType.toUpperCase();
        if (ipMap[b1Key]) addNetwork(networkCidr(ipMap[b1Key].split('/')[0], 30));
        if (ipMap[b2Key]) addNetwork(networkCidr(ipMap[b2Key].split('/')[0], 30));

        // Loopback
        if (loopback) addNetwork(loopback);

        // iBGP subnet (derive /30)
        var ibgpPeerIp = '';
        // TOR1↔TOR2 pair, TOR3↔TOR4 pair
        var ibgpPeerMap = { TOR1: 'P2P_IBGP_TOR2', TOR2: 'P2P_IBGP_TOR1', TOR3: 'P2P_IBGP_TOR4', TOR4: 'P2P_IBGP_TOR3' };
        var ibgpPeerKey = ibgpPeerMap[switchType];
        if (ibgpPeerKey && ipMap[ibgpPeerKey]) {
            ibgpPeerIp = ipMap[ibgpPeerKey].split('/')[0];
        }
        if (ibgpPeerIp) {
            addNetwork(networkCidr(ibgpPeerIp, 30));
        }

        // VLAN interface subnets
        for (var vi = 0; vi < vlans.length; vi++) {
            var vlan = vlans[vi];
            if (vlan.interface && vlan.interface.ip && vlan.interface.cidr) {
                addNetwork(networkCidr(vlan.interface.ip, vlan.interface.cidr));
            }
        }

        // Compute/Tenant networks
        if (ipMap.C) addNetwork(ipMap.C);

        // Neighbor IPs
        var border1PeerKey = 'P2P_' + switchType.toUpperCase() + '_BORDER1';
        var border2PeerKey = 'P2P_' + switchType.toUpperCase() + '_BORDER2';

        var neighbors = [
            {
                ip: ipMap[border1PeerKey] || '',
                description: 'TO_Border1',
                remote_as: borderAsn,
                af_ipv4_unicast: { prefix_list_in: 'DefaultRoute' }
            },
            {
                ip: ipMap[border2PeerKey] || '',
                description: 'TO_Border2',
                remote_as: borderAsn,
                af_ipv4_unicast: { prefix_list_in: 'DefaultRoute' }
            },
            {
                ip: ibgpPeerIp,
                description: 'iBGP_PEER',
                remote_as: torAsn,
                af_ipv4_unicast: {}
            }
        ];

        // HNVPA neighbor (if MUX ASN defined)
        if (this.bgp.muxAsn && ipMap.HNVPA) {
            neighbors.push({
                ip: ipMap.HNVPA,
                description: 'TO_HNVPA',
                remote_as: this.bgp.muxAsn,
                update_source: 'Loopback0',
                ebgp_multihop: 3,
                af_ipv4_unicast: { prefix_list_out: 'DefaultRoute' }
            });
        }

        return {
            asn: torAsn,
            router_id: routerId,
            networks: networks,
            neighbors: neighbors
        };
    };

    // ── Private: build prefix lists ──────────────────────────────────
    SwitchConfigBuilder.prototype._buildPrefixLists = function () {
        return {
            DefaultRoute: [
                { seq: 10, action: 'permit', prefix: '0.0.0.0/0' },
                { seq: 50, action: 'deny', prefix: '0.0.0.0/0', prefix_filter: 'le 32' }
            ]
        };
    };

    // ── Expose globally ──────────────────────────────────────────────
    window.SwitchConfigBuilder = SwitchConfigBuilder;
})();
