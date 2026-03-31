/**
 * Dell EMC OS10 Config Renderer
 *
 * Converts standard JSON (produced by builder.js) into Dell EMC OS10
 * configuration text. Ported from upstream Jinja2 templates:
 * https://github.com/microsoft/Azure_Local_Physical_Network_Config_Tool
 * (input/jinja2_templates/dellemc/os10/)
 */
/* global window */
(function () {
    'use strict';

    var DellOs10 = {};

    // ── system.j2 ────────────────────────────────────────────────────
    DellOs10.renderSystem = function (data) {
        var sw = data.switch;
        var isBmc = sw.type === 'BMC';
        var lines = [];

        // Hostname and Banner
        lines.push('! system.j2 - hostname');
        lines.push('! Name: ' + sw.hostname);
        lines.push('! Make: ' + sw.make);
        lines.push('! Model: ' + sw.model);
        lines.push('hostname ' + sw.hostname);
        lines.push('');
        lines.push('banner motd #');
        lines.push('NOTICE   NOTICE   NOTICE   NOTICE   NOTICE   NOTICE   NOTICE   NOTICE   NOTICE');
        lines.push('');
        lines.push('hostname ' + sw.hostname);
        lines.push('Unauthorized access and/or use prohibited.');
        lines.push('All access and/or use subject to monitoring.');
        lines.push('');
        lines.push('NOTICE   NOTICE   NOTICE   NOTICE   NOTICE   NOTICE   NOTICE   NOTICE   NOTICE');
        lines.push('#');
        lines.push('');

        // Feature Enablement
        lines.push('! system.j2 - features');
        lines.push('lldp enable');
        lines.push('dcbx enable');
        lines.push('');

        // NTP
        lines.push('! system.j2 - ntp');
        lines.push('clock timezone standard-timezone [TZ_IANA]');
        lines.push('ntp server [NTP_SERVER_IP]');
        lines.push('ntp source [MGMT_VLAN]');
        lines.push('');

        // Syslog
        lines.push('! system.j2 - syslog');
        lines.push('logging server [LOG_SERVER_IP]');
        lines.push('logging source-interface [MGMT_VLAN]');
        lines.push('logging audit enable');
        lines.push('logging console disable');
        lines.push('');

        // Global Settings
        lines.push('! system.j2 - global_settings');
        lines.push('ztd cancel');
        lines.push('mac address-table aging-time 1000000');
        lines.push('');
        lines.push('no ip dhcp-relay information-option');
        lines.push('no ip dhcp snooping');
        lines.push('');

        // VRRP (skip for BMC)
        if (!isBmc) {
            lines.push('vrrp version 3');
            lines.push('vrrp delay reload 180');
            lines.push('');
        }

        // SNMP
        lines.push('! system.j2 - snmp_settings');
        lines.push('snmp-server community [SNMP_COMMUNITY_RO] ro');
        lines.push('snmp-server community [SNMP_COMMUNITY_RW] rw');
        lines.push('snmp-server contact "Contact Support"');
        lines.push('snmp-server location ' + (sw.site || '[SITE_NAME]'));
        lines.push('');

        // Management VRF
        lines.push('! system.j2 - management_vrf');
        lines.push('ip vrf management');
        lines.push(' interface management');
        lines.push('');
        lines.push('management route 0.0.0.0/0 [MGMT_GATEWAY_IP]');

        return lines.join('\n');
    };

    // ── login.j2 ─────────────────────────────────────────────────────
    DellOs10.renderLogin = function () {
        var lines = [];
        lines.push('! login.j2');
        lines.push('password-attributes character-restriction upper 1 lower 1 numeric 1 special-char 1 min-length 15');
        lines.push('lockout-period 15 max-retry 3');
        lines.push('password-attributes lockout-period 5');
        lines.push('');
        lines.push('enable password 0 $CREDENTIAL_PLACEHOLDER$ priv-lvl 15');
        lines.push('username admin password $CREDENTIAL_PLACEHOLDER$ role sysadmin');
        lines.push('username $CREDENTIAL_PLACEHOLDER$ password $CREDENTIAL_PLACEHOLDER$ role sysadmin');
        lines.push('');
        lines.push('ip ssh server enable');
        lines.push('ip ssh server cipher aes256-ctr aes192-ctr aes128-ctr');
        lines.push('ip ssh server mac hmac-sha1 hmac-sha2-256');
        lines.push('ip ssh server max-auth-tries 3');
        lines.push('no ip telnet server enable');
        lines.push('');
        lines.push('login concurrent-session limit 3');
        lines.push('login statistics enable');
        lines.push('');
        lines.push('! Replace [TACACS_SERVER1], [TACACS_SERVER2], [TACACS_KEY], and [MGMT_VLAN] with actual values.');
        lines.push('ip tacacs source-interface [MGMT_VLAN]');
        lines.push('tacacs-server host [TACACS_SERVER1] key [TACACS_KEY]');
        lines.push('tacacs-server host [TACACS_SERVER2] key [TACACS_KEY]');
        lines.push('');
        lines.push('aaa authentication login default group tacacs+');
        lines.push('aaa authentication login console group tacacs+ local');
        lines.push('aaa accounting commands all default start-stop group tacacs+');
        return lines.join('\n');
    };

    // ── qos.j2 ───────────────────────────────────────────────────────
    DellOs10.renderQos = function (data) {
        if (!data.qos) return '';
        var lines = [];
        lines.push('! qos.j2');

        // ECN
        lines.push('wred ecn');
        lines.push('  random-detect color green minimum-threshold 150 maximum-threshold 1500 drop-probability 100');
        lines.push('  random-detect ecn');
        lines.push('');

        // Network QoS Class Maps
        lines.push('class-map type network-qos AZLOCAL_COS3');
        lines.push('  match qos-group 3');
        lines.push('');
        lines.push('class-map type network-qos AZLOCAL_COS7');
        lines.push('  match qos-group 7');
        lines.push('');

        // Queuing Class Maps
        lines.push('class-map type queuing AZLOCAL_QUEUE0');
        lines.push('  match queue 0');
        lines.push('');
        lines.push('class-map type queuing AZLOCAL_QUEUE3');
        lines.push('  match queue 3');
        lines.push('');
        lines.push('class-map type queuing AZLOCAL_QUEUE7');
        lines.push('  match queue 7');
        lines.push('');

        // Trust Dot1p Map
        lines.push('trust dot1p-map AZLOCAL_DOT1P_TRUST');
        lines.push('  qos-group 0 dot1p 0-2,4-6');
        lines.push('  qos-group 3 dot1p 3');
        lines.push('  qos-group 7 dot1p 7');
        lines.push('');

        // QoS Group to Queue
        lines.push('qos-map traffic-class AZLOCAL_QOS_MAP');
        lines.push('  queue 0 qos-group 0-2,4-6');
        lines.push('  queue 3 qos-group 3');
        lines.push('  queue 7 qos-group 7');
        lines.push('');

        // PFC Policy
        lines.push('policy-map type network-qos AZLOCAL_PFC');
        lines.push('  class AZLOCAL_COS3');
        lines.push('    pause');
        lines.push('    pfc-cos 3');
        lines.push('');

        // ETS Policy
        lines.push('policy-map type queuing AZLOCAL_ETS');
        lines.push('  class AZLOCAL_QUEUE0');
        lines.push('    bandwidth percent 48');
        lines.push('');
        lines.push('  class AZLOCAL_QUEUE3');
        lines.push('    bandwidth percent 50');
        lines.push('    random-detect ecn');
        lines.push('');
        lines.push('  class AZLOCAL_QUEUE7');
        lines.push('    bandwidth percent 2');
        lines.push('');

        // System-Level QoS
        lines.push('system qos');
        lines.push('  trust-map dot1p AZLOCAL_DOT1P_TRUST');
        lines.push('  ets mode on');

        return lines.join('\n');
    };

    // ── vlan.j2 ──────────────────────────────────────────────────────
    DellOs10.renderVlans = function (data) {
        if (!data.vlans || !data.vlans.length) return '';
        var lines = [];
        lines.push('! vlan.j2');

        for (var i = 0; i < data.vlans.length; i++) {
            var v = data.vlans[i];
            lines.push('interface vlan' + v.vlan_id);
            lines.push('  description ' + v.name);

            if (v.interface && v.interface.mtu) {
                lines.push('  mtu ' + v.interface.mtu);
            }

            if (v.shutdown) {
                lines.push('  shutdown');
            } else {
                lines.push('  no shutdown');
            }

            if (v.interface && v.interface.ip && v.interface.cidr) {
                lines.push('  ip address ' + v.interface.ip + '/' + v.interface.cidr);
            }

            // DHCP Relay
            if (v.interface && v.interface.dhcp_relay) {
                for (var d = 0; d < v.interface.dhcp_relay.length; d++) {
                    lines.push('  ip helper-address ' + v.interface.dhcp_relay[d]);
                }
            }

            // Redundancy (VRRP)
            if (v.interface && v.interface.redundancy && v.interface.redundancy.type === 'vrrp') {
                var r = v.interface.redundancy;
                lines.push('  vrrp-group ' + r.group);
                lines.push('    priority ' + r.priority);
                lines.push('    virtual-address ' + r.virtual_ip);
                lines.push('    no preempt');
            }

            lines.push('');
        }

        return lines.join('\n');
    };

    // ── interface.j2 ─────────────────────────────────────────────────
    DellOs10.renderInterfaces = function (data) {
        if (!data.interfaces || !data.interfaces.length) return '';
        var lines = [];
        lines.push('! interface.j2 - dell');

        // Access interfaces
        for (var a = 0; a < data.interfaces.length; a++) {
            var iface = data.interfaces[a];
            if (iface.type !== 'Access') continue;
            var intfRange = iface.intf || (iface.start_intf + (iface.end_intf && iface.end_intf !== iface.start_intf ? '-' + iface.end_intf : ''));
            var isRange = intfRange.indexOf('-') !== -1;

            if (iface.shutdown) {
                lines.push('! NOTE: This interface configuration initializes ports in shutdown state for security.');
                lines.push('! This is a recommended best practice to prevent unauthorized access on unused ports.');
                lines.push('! User may choose to apply this initial configuration or customize based on deployment requirements.');
            }
            lines.push('interface ' + (isRange ? 'range ' : '') + iface.intf_type + ' ' + intfRange);
            lines.push('  description ' + iface.name);
            lines.push('  switchport mode access');
            lines.push('  switchport access vlan ' + iface.access_vlan);
            lines.push('  spanning-tree bpduguard enable');
            lines.push('  spanning-tree guard root');
            lines.push('  spanning-tree port type edge');
            lines.push('  mtu 9216');
            if (iface.service_policy && iface.service_policy.qos_input) {
                lines.push('  service-policy type qos input ' + iface.service_policy.qos_input);
            }
            if (iface.shutdown) {
                lines.push('  shutdown');
            } else {
                lines.push('  no shutdown');
            }
            lines.push('');
        }

        // Trunk interfaces
        for (var t = 0; t < data.interfaces.length; t++) {
            var ti = data.interfaces[t];
            if (ti.type !== 'Trunk') continue;
            var tRange = ti.intf || (ti.start_intf + (ti.end_intf && ti.end_intf !== ti.start_intf ? '-' + ti.end_intf : ''));
            var tIsRange = tRange.indexOf('-') !== -1;
            lines.push('interface ' + (tIsRange ? 'range ' : '') + ti.intf_type + ' ' + tRange);
            lines.push('  description ' + ti.name);
            lines.push('  switchport mode trunk');
            lines.push('  switchport trunk native vlan ' + ti.native_vlan);
            lines.push('  switchport trunk allowed vlan ' + ti.tagged_vlans);
            if (ti.pfc) {
                lines.push('  flowcontrol receive off');
                lines.push('  priority-flow-control mode on');
                lines.push('  ets mode on');
            }
            lines.push('  mtu 9216');
            if (ti.service_policy && ti.service_policy.qos_input) {
                lines.push('  service-policy input type network-qos ' + ti.service_policy.qos_input);
            }
            if (ti.qos_map) {
                lines.push('  qos-map traffic-class ' + ti.qos_map);
            }
            if (ti.shutdown) {
                lines.push('  shutdown');
            } else {
                lines.push('  no shutdown');
            }
            lines.push('');
        }

        // MLAG Peer Link interfaces
        for (var ml = 0; ml < data.interfaces.length; ml++) {
            var mi = data.interfaces[ml];
            if (mi.type !== 'MLAG') continue;
            var mRange = mi.intf || (mi.start_intf + (mi.end_intf && mi.end_intf !== mi.start_intf ? '-' + mi.end_intf : ''));
            var mIsRange = mRange.indexOf('-') !== -1;
            lines.push('interface ' + (mIsRange ? 'range ' : '') + mi.intf_type + ' ' + mRange);
            lines.push('  description ' + mi.name);
            lines.push('  no switchport');
            lines.push('  mtu 9216');
            lines.push('  flowcontrol receive off');
            lines.push('  priority-flow-control mode on');
            if (mi.shutdown) {
                lines.push('  shutdown');
            } else {
                lines.push('  no shutdown');
            }
            lines.push('');
        }

        // L3 interfaces (Ethernet)
        for (var l = 0; l < data.interfaces.length; l++) {
            var li = data.interfaces[l];
            if (li.type !== 'L3' || (li.intf_type || '').toLowerCase() === 'loopback') continue;
            var lRange = li.intf || (li.start_intf + (li.end_intf && li.end_intf !== li.start_intf ? '-' + li.end_intf : ''));
            var lIsRange = lRange.indexOf('-') !== -1;
            lines.push('interface ' + (lIsRange ? 'range ' : '') + li.intf_type + ' ' + lRange);
            lines.push('  description ' + li.name);
            lines.push('  no switchport');
            lines.push('  ip address ' + li.ipv4);
            lines.push('  mtu 9216');
            if (li.shutdown) {
                lines.push('  shutdown');
            } else {
                lines.push('  no shutdown');
            }
            lines.push('');
        }

        // Loopback interfaces
        for (var lb = 0; lb < data.interfaces.length; lb++) {
            var lbi = data.interfaces[lb];
            if ((lbi.intf_type || '').toLowerCase() !== 'loopback') continue;
            lines.push('interface ' + lbi.intf);
            lines.push('  description ' + lbi.name);
            lines.push('  ip address ' + lbi.ipv4);
            lines.push('  mtu 9216');
            if (lbi.shutdown) {
                lines.push('  shutdown');
            } else {
                lines.push('  no shutdown');
            }
            lines.push('');
        }

        return lines.join('\n');
    };

    // ── port_channel.j2 ──────────────────────────────────────────────
    DellOs10.renderPortChannels = function (data) {
        if (!data.port_channels || !data.port_channels.length) return '';
        var lines = [];
        lines.push('! port-channel.j2');

        for (var p = 0; p < data.port_channels.length; p++) {
            var pc = data.port_channels[p];

            // Port-channel interface
            lines.push('interface port-channel' + pc.id);
            lines.push('  description ' + pc.description);

            if ((pc.type || '').toLowerCase() === 'trunk') {
                lines.push('  no shutdown');
                lines.push('  switchport mode trunk');
                lines.push('  switchport trunk native vlan ' + pc.native_vlan);
                if (pc.tagged_vlans) {
                    lines.push('  switchport trunk allowed vlan ' + pc.tagged_vlans);
                }
                // VLT for peer-link or explicitly marked
                if (pc.vlt_port || (pc.description || '').toLowerCase().indexOf('peer') !== -1) {
                    lines.push('  vlt-port-channel ' + pc.id);
                }
                lines.push('  priority-flow-control mode on');
                lines.push('  mtu 9216');
            } else if ((pc.type || '').toLowerCase() === 'l3') {
                lines.push('  no shutdown');
                lines.push('  no switchport');
                lines.push('  mtu 9216');
                lines.push('  ip address ' + pc.ipv4 + (pc.ipv4.indexOf('/') === -1 ? '/30' : ''));
            }
            lines.push('');

            // Member interfaces
            for (var m = 0; m < (pc.members || []).length; m++) {
                var member = pc.members[m];
                lines.push('interface Ethernet ' + member);
                lines.push('  description ' + pc.description);
                lines.push('  no shutdown');
                lines.push('  channel-group ' + pc.id + ' mode active');

                if ((pc.type || '').toLowerCase() === 'l3') {
                    lines.push('  no switchport');
                    lines.push('  mtu 9216');
                    lines.push('  flowcontrol receive off');
                } else if ((pc.type || '').toLowerCase() === 'trunk') {
                    // For VLT/BMC peer-link members (po102), render as no switchport
                    if (pc.id === 102 || (pc.description || '').toLowerCase().indexOf('tor_bmc') !== -1) {
                        lines.push('  no switchport');
                        lines.push('  mtu 9216');
                        lines.push('  flowcontrol receive off');
                    } else {
                        lines.push('  switchport');
                        lines.push('  switchport mode trunk');
                        lines.push('  switchport trunk native vlan ' + pc.native_vlan);
                        if (pc.tagged_vlans) {
                            lines.push('  switchport trunk allowed vlan ' + pc.tagged_vlans);
                        }
                        lines.push('  spanning-tree port type network');
                        lines.push('  mtu 9216');
                        lines.push('  flowcontrol receive off');
                    }
                }
                lines.push('');
            }
        }

        return lines.join('\n');
    };

    // ── vlt.j2 ───────────────────────────────────────────────────────
    DellOs10.renderVlt = function (data) {
        // Find MLAG peer link interface range
        var mlagRange = '';
        if (data.interfaces) {
            for (var i = 0; i < data.interfaces.length; i++) {
                var iface = data.interfaces[i];
                if (iface.type === 'MLAG') {
                    if (iface.start_intf && iface.end_intf) {
                        mlagRange = 'ethernet' + iface.start_intf + '-' + iface.end_intf;
                    } else if (iface.intf) {
                        mlagRange = 'ethernet' + iface.intf;
                    }
                    break;
                }
            }
        }

        // Find iBGP peer IP
        var ibgpPeerIp = '';
        if (data.bgp && data.bgp.neighbors) {
            for (var n = 0; n < data.bgp.neighbors.length; n++) {
                if (data.bgp.neighbors[n].description === 'iBGP_PEER') {
                    ibgpPeerIp = data.bgp.neighbors[n].ip;
                    break;
                }
            }
        }

        if (!ibgpPeerIp || !mlagRange) {
            if (ibgpPeerIp && !mlagRange) {
                return '! vlt.j2 - NOTICE: VLT configuration skipped - MLAG peer link interface not found';
            }
            return '';
        }

        var priority = (data.switch && data.switch.type === 'TOR1') ? 1 : 2;

        var lines = [];
        lines.push('! vlt.j2');
        lines.push('vlt-domain 1');
        lines.push('  backup destination ' + ibgpPeerIp);
        lines.push('  discovery-interface ' + mlagRange);
        lines.push('  peer-routing');
        lines.push('  primary-priority ' + priority);
        lines.push('  vlt-mac de:ad:00:be:ef:01');
        return lines.join('\n');
    };

    // ── prefix_list.j2 ──────────────────────────────────────────────
    DellOs10.renderPrefixLists = function (data) {
        if (!data.prefix_lists) return '';
        var lines = [];
        lines.push('! prefix_list.j2');
        for (var name in data.prefix_lists) {
            var entries = data.prefix_lists[name];
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                var line = 'ip prefix-list ' + name + ' seq ' + e.seq + ' ' + e.action + ' ' + e.prefix;
                if (e.prefix_filter) line += ' ' + e.prefix_filter;
                lines.push(line);
            }
        }
        return lines.join('\n');
    };

    // ── bgp.j2 ──────────────────────────────────────────────────────
    DellOs10.renderBgp = function (data) {
        if (!data.bgp) return '';
        var bgp = data.bgp;
        var lines = [];
        lines.push('! bgp.j2');
        lines.push('router bgp ' + bgp.asn);
        lines.push('  router-id ' + bgp.router_id);
        lines.push('  bestpath as-path multipath-relax');
        lines.push('  log-neighbor-changes');
        lines.push('  maximum-paths ibgp 8');
        lines.push('  maximum-paths ebgp 8');

        // Networks
        lines.push('  address-family ipv4 unicast');
        for (var n = 0; n < (bgp.networks || []).length; n++) {
            lines.push('    network ' + bgp.networks[n]);
        }
        lines.push('');

        // Neighbors
        for (var i = 0; i < (bgp.neighbors || []).length; i++) {
            var nb = bgp.neighbors[i];
            if (!nb.ip) continue;

            // Subnet-based neighbor (HNVPA template)
            if (nb.ip.indexOf('/') !== -1) {
                lines.push('  template TO_' + nb.description);
                if (nb.ebgp_multihop) {
                    lines.push('    ebgp-multihop ' + nb.ebgp_multihop);
                }
                lines.push('    listen ' + nb.ip + ' limit 5');
                lines.push('    remote-as ' + nb.remote_as);
                if (nb.update_source) {
                    lines.push('    update-source ' + nb.update_source);
                }
            } else {
                // Standard neighbor
                lines.push('  neighbor ' + nb.ip);
                lines.push('    description ' + nb.description);
                lines.push('    remote-as ' + nb.remote_as);
                lines.push('    no shutdown');
                if (nb.update_source) {
                    lines.push('    update-source ' + nb.update_source);
                }
                if (nb.ebgp_multihop) {
                    lines.push('    ebgp-multihop ' + nb.ebgp_multihop);
                }
                lines.push('    address-family ipv4 unicast');
                lines.push('      activate');
                if (nb.af_ipv4_unicast) {
                    if (nb.af_ipv4_unicast.prefix_list_in) {
                        lines.push('      prefix-list ' + nb.af_ipv4_unicast.prefix_list_in + ' in');
                    }
                    if (nb.af_ipv4_unicast.prefix_list_out) {
                        lines.push('      prefix-list ' + nb.af_ipv4_unicast.prefix_list_out + ' out');
                    }
                }
                // iBGP peer gets next-hop-self
                if (nb.description === 'iBGP_PEER') {
                    lines.push('      next-hop-self');
                }
            }
            lines.push('');
        }

        return lines.join('\n');
    };

    // ── static_route.j2 ─────────────────────────────────────────────
    DellOs10.renderStaticRoutes = function (data) {
        if (!data.static_routes || !data.static_routes.length) return '';
        var lines = [];
        lines.push('! static_route.j2');
        for (var i = 0; i < data.static_routes.length; i++) {
            var r = data.static_routes[i];
            lines.push('ip route ' + r.prefix + ' ' + r.next_hop);
        }
        return lines.join('\n');
    };

    // ── Full config (combines all sections) ──────────────────────────
    DellOs10.renderFullConfig = function (data) {
        var sections = [];
        var isBmc = data.switch && data.switch.type === 'BMC';

        sections.push(DellOs10.renderSystem(data));
        sections.push(DellOs10.renderLogin());
        if (!isBmc) sections.push(DellOs10.renderQos(data));
        sections.push(DellOs10.renderVlans(data));
        sections.push(DellOs10.renderInterfaces(data));
        sections.push(DellOs10.renderPortChannels(data));
        if (!isBmc) {
            sections.push(DellOs10.renderVlt(data));
            sections.push(DellOs10.renderPrefixLists(data));
            sections.push(DellOs10.renderBgp(data));
        }
        sections.push(DellOs10.renderStaticRoutes(data));

        var output = sections.filter(function (s) { return s; }).join('\n\n');
        return DellOs10.replaceInfraTokens(output, data.infrastructure);
    };

    // ── Replace infrastructure placeholder tokens ────────────────────
    DellOs10.replaceInfraTokens = function (text, infra) {
        if (!infra) return text;
        // Timezone replacement (Dell uses IANA name)
        if (infra.timezone && infra.timezone.iana) {
            text = text.split('[TZ_IANA]').join(infra.timezone.iana);
        }
        // Management VLAN replacement
        if (infra.mgmtVlan) {
            text = text.split('[MGMT_VLAN]').join(infra.mgmtVlan);
        }
        // Management gateway IP (Dell management VRF default route)
        if (infra.mgmtGateway) {
            text = text.split('[MGMT_GATEWAY_IP]').join(infra.mgmtGateway);
        }
        var replacements = {
            '[NTP_SERVER_IP]': infra.ntpServer,
            '[LOG_SERVER_IP]': infra.syslogServer,
            '[TACACS_KEY]': infra.tacacsKey,
            '[SNMP_COMMUNITY_RO]': infra.snmpRo,
            '[SNMP_COMMUNITY_RW]': infra.snmpRw
        };
        // Dell uses [TACACS_SERVER1] and [TACACS_SERVER2] separately
        if (infra.tacacsServer1) {
            text = text.split('[TACACS_SERVER1]').join(infra.tacacsServer1);
        }
        if (infra.tacacsServer2) {
            text = text.split('[TACACS_SERVER2]').join(infra.tacacsServer2);
        }
        for (var token in replacements) {
            if (replacements[token]) {
                text = text.split(token).join(replacements[token]);
            }
        }
        return text;
    };

    window.DellOs10Renderer = DellOs10;
})();
