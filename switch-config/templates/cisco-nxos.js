/**
 * Cisco NX-OS Config Renderer
 *
 * Converts standard JSON (produced by builder.js) into Cisco NX-OS
 * configuration text. Ported from upstream Jinja2 templates:
 * https://github.com/microsoft/Azure_Local_Physical_Network_Config_Tool
 * (input/jinja2_templates/cisco/nxos/)
 */
/* global window */
(function () {
    'use strict';

    var CiscoNxos = {};

    // ── system.j2 ────────────────────────────────────────────────────
    CiscoNxos.renderSystem = function (data) {
        var sw = data.switch;
        var lines = [];

        // Hostname and Banner
        lines.push('! system.j2');
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

        // System Features
        lines.push('no feature telnet');
        lines.push('feature scp-server');
        lines.push('feature bgp');
        lines.push('feature interface-vlan');
        lines.push('feature lldp');
        lines.push('feature dhcp');
        lines.push('feature vpc');
        lines.push('feature hsrp');
        lines.push('feature lacp');
        lines.push('feature ssh');
        lines.push('feature tacacs+');
        lines.push('');

        // Time and NTP
        lines.push('clock timezone [TZ_ABBR] [TZ_OFFSET_H] [TZ_OFFSET_M]');
        lines.push('[TZ_SUMMER_TIME]');
        lines.push('ntp server [NTP_SERVER_IP]');
        lines.push('ntp source-interface [MGMT_VLAN]');
        lines.push('');

        // Syslog
        lines.push('logging server [LOG_SERVER_IP] 7 facility local7 use-vrf default');
        lines.push('logging source-interface [MGMT_VLAN]');
        lines.push('logging level local7 7');
        lines.push('no logging console');
        lines.push('login on-success log');
        lines.push('logging origin-id hostname');
        lines.push('');
        lines.push('logging level acllog 7');
        lines.push('logging level aclmgr 7');
        lines.push('logging level eth_port_channel 7');
        lines.push('logging level hsrp 7');
        lines.push('logging level icam 7');
        lines.push('logging level interface-vlan 7');
        lines.push('logging level ipqosmgr 7');
        lines.push('logging level vlan_mgr 7');
        lines.push('logging level vpc 7');
        lines.push('logging level netstack 7');
        lines.push('logging level bgp 7');
        lines.push('');

        // Global Settings
        lines.push('no cdp enable');
        lines.push('lldp tlv-select dcbxp egress-queuing');
        lines.push('');
        lines.push('service dhcp');
        lines.push('ip dhcp relay');
        lines.push('');
        lines.push('ip load-sharing address source-destination port source-destination');
        lines.push('');
        lines.push('ip icmp-errors source-interface [MGMT_VLAN]');
        lines.push('');
        lines.push('cli alias name wr copy running-config startup-config');
        lines.push('');

        // SNMP
        lines.push('snmp-server community [PLACEHOLDER] ro');
        lines.push('snmp-server community [PLACEHOLDER] rW');
        lines.push('snmp-server contact "Contact Support"');
        lines.push('snmp-server location ' + (sw.site || '[SITE_NAME]'));

        return lines.join('\n');
    };

    // ── login.j2 ─────────────────────────────────────────────────────
    CiscoNxos.renderLogin = function () {
        var lines = [];
        lines.push('! login.j2');
        lines.push('fips mode enable');
        lines.push('user max-logins 1');
        lines.push('password prompt username');
        lines.push('userpassphrase min-length 15 max-length 80');
        lines.push('username admin password 0 $CREDENTIAL_PLACEHOLDER$ role network-admin');
        lines.push('username $CREDENTIAL_PLACEHOLDER$ password 0 $CREDENTIAL_PLACEHOLDER$ role network-admin');
        lines.push('');
        lines.push('no feature ssh');
        lines.push('no ssh key ecdsa');
        lines.push('no ssh key rsa');
        lines.push('ssh key rsa 2048 force');
        lines.push('ssh key ecdsa 256 force');
        lines.push('feature ssh');
        lines.push('');
        lines.push('line console');
        lines.push('  exec-timeout 10');
        lines.push('line vty');
        lines.push('  exec-timeout 10');
        lines.push('  session-limit 3');
        lines.push('');
        lines.push('! Replace [TACACS_SERVER_IP], [TACACS_KEY], [TACACS_GROUP], [MGMT_VLAN] with actual values.');
        lines.push('tacacs-server key [TACACS_KEY]');
        lines.push('tacacs-server timeout 2');
        lines.push('ip tacacs source-interface [MGMT_VLAN]');
        lines.push('');
        lines.push('tacacs-server host [TACACS_SERVER_IP]');
        lines.push('tacacs-server host [TACACS_SERVER_IP]');
        lines.push('');
        lines.push('aaa group server tacacs+ [TACACS_GROUP]');
        lines.push('  server [TACACS_SERVER_IP]');
        lines.push('  server [TACACS_SERVER_IP]');
        lines.push('  source-interface [MGMT_VLAN]');
        lines.push('');
        lines.push('aaa authentication login default group [TACACS_GROUP]');
        lines.push('aaa authentication login console group [TACACS_GROUP]');
        lines.push('aaa accounting default group [TACACS_GROUP]');
        return lines.join('\n');
    };

    // ── qos.j2 ───────────────────────────────────────────────────────
    CiscoNxos.renderQos = function (data) {
        if (!data.qos) return '';
        var lines = [];
        lines.push('! qos.j2');
        lines.push('policy-map type network-qos AZLOCAL-NWQOS');
        lines.push('  class type network-qos AZLOCAL-NWQOS-RDMA');
        lines.push('    pause pfc-cos 3');
        lines.push('    mtu 9216');
        lines.push('  class type network-qos AZLOCAL-NWQOS-DEFAULT');
        lines.push('    mtu 9216');
        lines.push('  class type network-qos AZLOCAL-NWQOS-CLUSTER');
        lines.push('    mtu 9216');
        lines.push('');
        lines.push('class-map type qos match-all AZLOCAL-QOS-RDMA');
        lines.push('  match cos 3');
        lines.push('class-map type qos match-all AZLOCAL-QOS-CLUSTER');
        lines.push('  match cos 7');
        lines.push('');
        lines.push('policy-map type qos AZLOCAL-QOS-MAP');
        lines.push('  class AZLOCAL-QOS-RDMA');
        lines.push('    set qos-group 3');
        lines.push('  class AZLOCAL-QOS-CLUSTER');
        lines.push('    set qos-group 7');
        lines.push('');
        lines.push('policy-map type queuing AZLOCAL-QUEUE-OUT');
        lines.push('  class type queuing c-out-8q-q3');
        lines.push('    bandwidth remaining percent 50');
        lines.push('    random-detect minimum-threshold 300 kbytes maximum-threshold 300 kbytes drop-probability 100 weight 0 ecn');
        lines.push('  class type queuing c-out-8q-q-default');
        lines.push('    bandwidth remaining percent 48');
        lines.push('  class type queuing c-out-8q-q7');
        lines.push('    bandwidth percent 2');
        lines.push('');
        lines.push('system qos');
        lines.push('  service-policy type network-qos AZLOCAL-NWQOS');
        lines.push('  service-policy type queuing output AZLOCAL-QUEUE-OUT');
        return lines.join('\n');
    };

    // ── vlan.j2 ──────────────────────────────────────────────────────
    CiscoNxos.renderVlans = function (data) {
        if (!data.vlans || !data.vlans.length) return '';
        var lines = [];
        lines.push('! vlan.j2');

        // VLAN definitions
        for (var i = 0; i < data.vlans.length; i++) {
            var vlan = data.vlans[i];
            lines.push('vlan ' + vlan.vlan_id);
            lines.push('  name ' + vlan.name);
            if (vlan.shutdown) lines.push('  shutdown');
            lines.push('');
        }

        // SVI interfaces
        for (var j = 0; j < data.vlans.length; j++) {
            var v = data.vlans[j];
            if (!v.interface) continue;
            lines.push('interface vlan' + v.vlan_id);
            lines.push('  description ' + v.name);
            lines.push('  mtu ' + (v.interface.mtu || 9216));
            if (v.shutdown) {
                lines.push('  shutdown');
            } else {
                lines.push('  no shutdown');
            }
            lines.push('  ip address ' + v.interface.ip + '/' + v.interface.cidr);
            lines.push('  no ip redirects');
            lines.push('  no ipv6 redirects');

            // DHCP Relay
            if (v.interface.dhcp_relay) {
                for (var d = 0; d < v.interface.dhcp_relay.length; d++) {
                    lines.push('  ip dhcp relay address ' + v.interface.dhcp_relay[d]);
                }
            }

            // Redundancy (HSRP)
            if (v.interface.redundancy && v.interface.redundancy.type === 'hsrp') {
                var r = v.interface.redundancy;
                lines.push('  hsrp version 2');
                lines.push('  hsrp ' + r.group);
                lines.push('    priority ' + r.priority);
                lines.push('    ip ' + r.virtual_ip);
            }
            lines.push('');
        }

        return lines.join('\n');
    };

    // ── interface.j2 ─────────────────────────────────────────────────
    CiscoNxos.renderInterfaces = function (data) {
        if (!data.interfaces || !data.interfaces.length) return '';
        var lines = [];
        lines.push('! interface.j2');

        // Access interfaces
        for (var a = 0; a < data.interfaces.length; a++) {
            var iface = data.interfaces[a];
            if (iface.type !== 'Access') continue;
            var intfRange = iface.intf || (iface.start_intf + (iface.end_intf && iface.end_intf !== iface.start_intf ? '-' + iface.end_intf : ''));
            var intfName = iface.intf_type + ' ' + intfRange;
            lines.push('interface ' + intfName);
            lines.push('  description ' + iface.name);
            lines.push('  no cdp enable');
            lines.push('  switchport');
            lines.push('  switchport mode access');
            lines.push('  switchport access vlan ' + iface.access_vlan);
            lines.push('  spanning-tree port type edge');
            lines.push('  no logging event port link-status');
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
            var tName = ti.intf_type + ' ' + tRange;
            lines.push('interface ' + tName);
            lines.push('  description ' + ti.name);
            lines.push('  no cdp enable');
            lines.push('  switchport');
            lines.push('  switchport mode trunk');
            lines.push('  switchport trunk native vlan ' + ti.native_vlan);
            lines.push('  switchport trunk allowed vlan ' + ti.tagged_vlans);
            lines.push('  priority-flow-control mode on send-tlv');
            lines.push('  spanning-tree port type edge trunk');
            lines.push('  no logging event port link-status');
            lines.push('  mtu 9216');
            if (ti.service_policy && ti.service_policy.qos_input) {
                lines.push('  service-policy type qos input ' + ti.service_policy.qos_input);
            }
            if (ti.shutdown) {
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
            var lName = li.intf_type + ' ' + lRange;
            lines.push('interface ' + lName);
            lines.push('  description ' + li.name);
            lines.push('  no cdp enable');
            lines.push('  no switchport');
            lines.push('  ip address ' + li.ipv4);
            lines.push('  no ip redirects');
            lines.push('  no ipv6 redirects');
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
    CiscoNxos.renderPortChannels = function (data) {
        if (!data.port_channels || !data.port_channels.length) return '';
        var lines = [];
        lines.push('! port-channel.j2');

        for (var p = 0; p < data.port_channels.length; p++) {
            var pc = data.port_channels[p];

            // Port-channel interface
            lines.push('interface port-channel' + pc.id);
            lines.push('  description ' + pc.description);

            if ((pc.type || '').toLowerCase() === 'trunk') {
                lines.push('  switchport');
                lines.push('  switchport mode trunk');
                lines.push('  switchport trunk native vlan ' + pc.native_vlan);
                if (pc.tagged_vlans) {
                    lines.push('  switchport trunk allowed vlan ' + pc.tagged_vlans);
                }
                lines.push('  spanning-tree port type network');
                lines.push('  logging event port link-status');
            } else if ((pc.type || '').toLowerCase() === 'l3') {
                lines.push('  no switchport');
                lines.push('  ip address ' + pc.ipv4 + (pc.ipv4.indexOf('/') === -1 ? '/30' : ''));
                lines.push('  logging event port link-status');
            }
            lines.push('  mtu 9216');
            lines.push('  no shutdown');
            lines.push('');

            // Member interfaces
            for (var m = 0; m < (pc.members || []).length; m++) {
                lines.push('interface Ethernet ' + pc.members[m]);
                lines.push('  description ' + pc.description);
                lines.push('  no cdp enable');
                if ((pc.type || '').toLowerCase() === 'trunk') {
                    lines.push('  switchport');
                    lines.push('  switchport mode trunk');
                    lines.push('  switchport trunk native vlan ' + pc.native_vlan);
                    if (pc.tagged_vlans) {
                        lines.push('  switchport trunk allowed vlan ' + pc.tagged_vlans);
                    }
                    lines.push('  spanning-tree port type network');
                    lines.push('  logging event port link-status');
                    lines.push('  mtu 9216');
                    lines.push('  channel-group ' + pc.id + ' mode active');
                } else if ((pc.type || '').toLowerCase() === 'l3') {
                    lines.push('  logging event port link-status');
                    lines.push('  mtu 9216');
                    lines.push('  channel-group ' + pc.id + ' mode active');
                }
                lines.push('  no shutdown');
                lines.push('');
            }
        }

        return lines.join('\n');
    };

    // ── prefix_list.j2 ──────────────────────────────────────────────
    CiscoNxos.renderPrefixLists = function (data) {
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
    CiscoNxos.renderBgp = function (data) {
        if (!data.bgp) return '';
        var bgp = data.bgp;
        var lines = [];
        lines.push('! bgp.j2');
        lines.push('router bgp ' + bgp.asn);
        lines.push('  router-id ' + bgp.router_id);
        lines.push('  bestpath as-path multipath-relax');
        lines.push('  log-neighbor-changes');
        lines.push('');

        // Networks
        lines.push('  address-family ipv4 unicast');
        for (var n = 0; n < (bgp.networks || []).length; n++) {
            lines.push('    network ' + bgp.networks[n]);
        }
        lines.push('    maximum-paths 8');
        lines.push('    maximum-paths ibgp 8');
        lines.push('');

        // Neighbors
        for (var i = 0; i < (bgp.neighbors || []).length; i++) {
            var nb = bgp.neighbors[i];
            if (!nb.ip) continue;
            lines.push('  neighbor ' + nb.ip);
            lines.push('    description ' + nb.description);
            lines.push('    remote-as ' + nb.remote_as);
            if (nb.update_source) {
                lines.push('    update-source ' + nb.update_source);
            }
            if (nb.ebgp_multihop) {
                lines.push('    ebgp-multihop ' + nb.ebgp_multihop);
            }
            lines.push('    address-family ipv4 unicast');
            lines.push('      maximum-prefix 12000 warning-only');
            if (nb.af_ipv4_unicast && nb.af_ipv4_unicast.prefix_list_out) {
                lines.push('      prefix-list ' + nb.af_ipv4_unicast.prefix_list_out + ' out');
            }
            if (nb.af_ipv4_unicast && nb.af_ipv4_unicast.prefix_list_in) {
                lines.push('      prefix-list ' + nb.af_ipv4_unicast.prefix_list_in + ' in');
            }
            lines.push('');
        }

        return lines.join('\n');
    };

    // ── static_route.j2 ─────────────────────────────────────────────
    CiscoNxos.renderStaticRoutes = function (data) {
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
    CiscoNxos.renderFullConfig = function (data) {
        var sections = [];
        var isBmc = data.switch && data.switch.type === 'BMC';

        sections.push(CiscoNxos.renderSystem(data));
        sections.push(CiscoNxos.renderLogin());
        if (!isBmc) sections.push(CiscoNxos.renderQos(data));
        sections.push(CiscoNxos.renderVlans(data));
        sections.push(CiscoNxos.renderInterfaces(data));
        sections.push(CiscoNxos.renderPortChannels(data));
        if (!isBmc) {
            sections.push(CiscoNxos.renderPrefixLists(data));
            sections.push(CiscoNxos.renderBgp(data));
        }
        sections.push(CiscoNxos.renderStaticRoutes(data));

        var output = sections.filter(function (s) { return s; }).join('\n\n');
        return CiscoNxos.replaceInfraTokens(output, data.infrastructure);
    };

    // ── Replace infrastructure placeholder tokens ────────────────────
    CiscoNxos.replaceInfraTokens = function (text, infra) {
        if (!infra) return text;
        // Timezone replacement
        if (infra.timezone) {
            text = text.split('[TZ_ABBR]').join(infra.timezone.abbr);
            text = text.split('[TZ_OFFSET_H]').join(infra.timezone.offsetH);
            text = text.split('[TZ_OFFSET_M]').join(infra.timezone.offsetM);
            if (infra.timezone.dstAbbr && infra.timezone.dstRule) {
                text = text.split('[TZ_SUMMER_TIME]').join(
                    'clock summer-time ' + infra.timezone.dstAbbr + ' ' + infra.timezone.dstRule);
            } else {
                // No DST — remove the placeholder line
                text = text.split('[TZ_SUMMER_TIME]\n').join('');
                text = text.split('[TZ_SUMMER_TIME]').join('');
            }
        }
        // Management VLAN replacement
        if (infra.mgmtVlan) {
            text = text.split('[MGMT_VLAN]').join(infra.mgmtVlan);
        }
        var replacements = {
            '[NTP_SERVER_IP]': infra.ntpServer,
            '[LOG_SERVER_IP]': infra.syslogServer,
            '[TACACS_KEY]': infra.tacacsKey,
            '[SNMP_COMMUNITY_RO]': infra.snmpRo,
            '[SNMP_COMMUNITY_RW]': infra.snmpRw
        };
        // Cisco uses generic [TACACS_SERVER_IP] for both servers
        if (infra.tacacsServer1 || infra.tacacsServer2) {
            // Replace sequentially: first occurrence → server1, second → server2
            var s1 = infra.tacacsServer1 || infra.tacacsServer2;
            var s2 = infra.tacacsServer2 || infra.tacacsServer1;
            var idx = text.indexOf('[TACACS_SERVER_IP]');
            if (idx !== -1) {
                text = text.substring(0, idx) + s1 + text.substring(idx + '[TACACS_SERVER_IP]'.length);
            }
            // Replace all remaining [TACACS_SERVER_IP] with s2
            text = text.split('[TACACS_SERVER_IP]').join(s2);
        }
        // Cisco uses [PLACEHOLDER] for SNMP (from original template)
        if (infra.snmpRo || infra.snmpRw) {
            // The Cisco template has two [PLACEHOLDER] lines — first is RO, second is RW
            var roVal = infra.snmpRo || '[PLACEHOLDER]';
            var rwVal = infra.snmpRw || '[PLACEHOLDER]';
            var pIdx = text.indexOf('[PLACEHOLDER]');
            if (pIdx !== -1) {
                text = text.substring(0, pIdx) + roVal + text.substring(pIdx + '[PLACEHOLDER]'.length);
            }
            pIdx = text.indexOf('[PLACEHOLDER]');
            if (pIdx !== -1) {
                text = text.substring(0, pIdx) + rwVal + text.substring(pIdx + '[PLACEHOLDER]'.length);
            }
        }
        for (var token in replacements) {
            if (replacements[token]) {
                text = text.split(token).join(replacements[token]);
            }
        }
        return text;
    };

    window.CiscoNxosRenderer = CiscoNxos;
})();
