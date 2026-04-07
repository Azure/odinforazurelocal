/**
 * Switch Model Definitions
 *
 * Port / interface layouts for each supported switch model.
 * Based on upstream: https://github.com/microsoft/Azure_Local_Physical_Network_Config_Tool
 * (input/switch_interface_templates/)
 */
/* global window */

window.SWITCH_MODELS = {
    // ── Cisco TOR Models ─────────────────────────────────────────────
    'cisco-93180YC-FX': {
        make: 'Cisco',
        model: '93180YC-FX',
        type: 'TOR',
        firmware: 'nxos',
        label: 'Cisco Nexus 93180YC-FX',
        interface_templates: {
            common: [
                { name: 'Unused', type: 'Access', description: 'initial unused for all interfaces then config as defined', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/54', access_vlan: '2', shutdown: true },
                { name: 'Loopback0', type: 'L3', intf_type: 'loopback', intf: 'loopback0', ipv4: '' },
                { name: 'P2P_Border1', type: 'L3', intf_type: 'Ethernet', intf: '1/48', ipv4: '' },
                { name: 'P2P_Border2', type: 'L3', intf_type: 'Ethernet', intf: '1/47', ipv4: '' },
                { name: 'Trunk_TO_BMC_SWITCH', type: 'Trunk', intf_type: 'Ethernet', intf: '1/49', native_vlan: '99', tagged_vlans: 'B' }
            ],
            fully_converged: [
                { name: 'HyperConverged_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', native_vlan: 'M', tagged_vlans: 'M,C,S', service_policy: { qos_input: 'AZLOCAL-QOS-MAP' } }
            ],
            switched: [
                { name: 'Switched_Compute_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', native_vlan: 'M', tagged_vlans: 'M,C' },
                { name: 'Switched_Storage_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/17', end_intf: '1/32', native_vlan: '99', tagged_vlans: 'S', service_policy: { qos_input: 'AZLOCAL-QOS-MAP' } }
            ],
            switchless: [
                { name: 'Switchless_Compute_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', native_vlan: 'M', tagged_vlans: 'M,C' }
            ]
        },
        port_channels: [
            { id: 50, description: 'P2P_IBGP', type: 'L3', ipv4: '', members: ['1/41', '1/42'] },
            { id: 101, description: 'ToR_Peer_Link', type: 'Trunk', native_vlan: '99', members: ['1/49', '1/50', '1/51'] }
        ]
    },

    'cisco-93180YC-FX3': {
        make: 'Cisco',
        model: '93180YC-FX3',
        type: 'TOR',
        firmware: 'nxos',
        label: 'Cisco Nexus 93180YC-FX3',
        interface_templates: {
            common: [
                { name: 'Unused', type: 'Access', description: 'initial unused for all interfaces then config as defined', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/54', access_vlan: '2', shutdown: true },
                { name: 'Loopback0', type: 'L3', intf_type: 'loopback', intf: 'loopback0', ipv4: '' },
                { name: 'P2P_Border1', type: 'L3', intf_type: 'Ethernet', intf: '1/48', ipv4: '' },
                { name: 'P2P_Border2', type: 'L3', intf_type: 'Ethernet', intf: '1/47', ipv4: '' },
                { name: 'Trunk_TO_BMC_SWITCH', type: 'Trunk', intf_type: 'Ethernet', intf: '1/49', native_vlan: '99', tagged_vlans: 'B' }
            ],
            fully_converged: [
                { name: 'HyperConverged_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', native_vlan: 'M', tagged_vlans: 'M,C,S', service_policy: { qos_input: 'AZLOCAL-QOS-MAP' } }
            ],
            switched: [
                { name: 'Switched_Compute_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', native_vlan: 'M', tagged_vlans: 'M,C' },
                { name: 'Switched_Storage_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/17', end_intf: '1/32', native_vlan: '99', tagged_vlans: 'S', service_policy: { qos_input: 'AZLOCAL-QOS-MAP' } }
            ],
            switchless: [
                { name: 'Switchless_Compute_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', native_vlan: 'M', tagged_vlans: 'M,C' }
            ]
        },
        port_channels: [
            { id: 50, description: 'P2P_IBGP', type: 'L3', ipv4: '', members: ['1/41', '1/42'] },
            { id: 101, description: 'ToR_Peer_Link', type: 'Trunk', native_vlan: '99', members: ['1/49', '1/50', '1/51'] }
        ]
    },

    'cisco-93108TC-FX3P-TOR': {
        make: 'Cisco',
        model: '93108TC-FX3P',
        type: 'TOR',
        firmware: 'nxos',
        label: 'Cisco Nexus 93108TC-FX3P (10GBASE-T)',
        interface_templates: {
            common: [
                { name: 'Unused', type: 'Access', description: 'initial unused for all interfaces then config as defined', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/54', access_vlan: '2', shutdown: true },
                { name: 'Loopback0', type: 'L3', intf_type: 'loopback', intf: 'loopback0', ipv4: '' },
                { name: 'P2P_Border1', type: 'L3', intf_type: 'Ethernet', intf: '1/48', ipv4: '' },
                { name: 'P2P_Border2', type: 'L3', intf_type: 'Ethernet', intf: '1/47', ipv4: '' },
                { name: 'Trunk_TO_BMC_SWITCH', type: 'Trunk', intf_type: 'Ethernet', intf: '1/49', native_vlan: '99', tagged_vlans: 'B' }
            ],
            fully_converged: [
                { name: 'HyperConverged_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', native_vlan: 'M', tagged_vlans: 'M,C,S', service_policy: { qos_input: 'AZLOCAL-QOS-MAP' } }
            ],
            switched: [
                { name: 'Switched_Compute_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', native_vlan: 'M', tagged_vlans: 'M,C' },
                { name: 'Switched_Storage_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/17', end_intf: '1/32', native_vlan: '99', tagged_vlans: 'S', service_policy: { qos_input: 'AZLOCAL-QOS-MAP' } }
            ],
            switchless: [
                { name: 'Switchless_Compute_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', native_vlan: 'M', tagged_vlans: 'M,C' }
            ]
        },
        port_channels: [
            { id: 50, description: 'P2P_IBGP', type: 'L3', ipv4: '', members: ['1/41', '1/42'] },
            { id: 101, description: 'ToR_Peer_Link', type: 'Trunk', native_vlan: '99', members: ['1/49', '1/50', '1/51'] }
        ]
    },

    // ── Dell EMC TOR Model ───────────────────────────────────────────
    'dell-S5248F-ON': {
        make: 'DellEMC',
        model: 'S5248F-ON',
        type: 'TOR',
        firmware: 'os10',
        label: 'Dell EMC S5248F-ON',
        interface_templates: {
            common: [
                { name: 'Unused', type: 'Access', description: 'initial unused for all interfaces then config as defined', intf_type: 'Ethernet', start_intf: '1/1/1', end_intf: '1/1/56', access_vlan: '2', shutdown: true },
                { name: 'Loopback0', type: 'L3', intf_type: 'loopback', intf: 'loopback0', ipv4: '' },
                { name: 'MLAG_Peer_Links', type: 'MLAG', intf_type: 'Ethernet', start_intf: '1/1/49', end_intf: '1/1/52' },
                { name: 'P2P_Border1', type: 'L3', intf_type: 'Ethernet', intf: '1/1/48:1', ipv4: '' },
                { name: 'P2P_Border2', type: 'L3', intf_type: 'Ethernet', intf: '1/1/47:1', ipv4: '' },
                { name: 'Trunk_TO_BMC_SWITCH', type: 'Trunk', intf_type: 'Ethernet', intf: '1/1/44', native_vlan: '99', tagged_vlans: 'B' }
            ],
            fully_converged1: [
                { name: 'HyperConverged_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1/1', end_intf: '1/1/40', native_vlan: 'M', tagged_vlans: 'M,C,S', service_policy: { qos_input: 'AZLOCAL-QOS-MAP' } }
            ],
            fully_converged2: [
                { name: 'HyperConverged_For_vENV', type: 'Access', intf_type: 'Ethernet', start_intf: '1/1/1', end_intf: '1/1/40', access_vlan: 'M' }
            ],
            switched: [
                { name: 'Switched_Compute_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1/1', end_intf: '1/1/18', native_vlan: 'M', tagged_vlans: 'M,C' },
                { name: 'Switched_Storage_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1/19', end_intf: '1/1/35', native_vlan: '99', tagged_vlans: 'S', service_policy: { qos_input: 'AZLOCAL-QOS-MAP' } }
            ],
            switchless: [
                { name: 'Switchless_Compute_To_Host', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1/1', end_intf: '1/1/18', native_vlan: 'M', tagged_vlans: 'M,C' }
            ]
        },
        port_channels: [
            { id: 50, description: 'P2P_IBGP', type: 'L3', ipv4: '', members: ['1/1/45:1', '1/1/46:1'] },
            { id: 102, description: 'ToR_Peer_Link', type: 'Trunk', native_vlan: '99', tagged_vlans: '', members: ['1/1/44:1'] }
        ]
    },

    // ── Cisco BMC Models ─────────────────────────────────────────────
    'cisco-93108TC-FX3P': {
        make: 'Cisco',
        model: '93108TC-FX3P',
        type: 'BMC',
        firmware: 'nxos',
        label: 'Cisco Nexus 93108TC-FX3P',
        interface_templates: {
            common: [
                { name: 'Unused', type: 'Access', description: 'initial unused for all interfaces then config as defined', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/54', access_vlan: '2', shutdown: true },
                { name: 'Host_BMC', type: 'Access', description: 'Host BMC Connection', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', access_vlan: 'B' },
                { name: 'HLH_BMC', type: 'Access', description: 'HLH BMC Connection', intf_type: 'Ethernet', intf: '1/46', access_vlan: 'B' },
                { name: 'HLH_OS', type: 'Access', description: 'HLH OS Connection', intf_type: 'Ethernet', start_intf: '1/49', end_intf: '1/50', access_vlan: 'B' },
                { name: 'To_TORs', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/51', end_intf: '1/52', native_vlan: '99', tagged_vlans: 'B' }
            ]
        },
        port_channels: [
            { id: 102, description: 'TOR_BMC', type: 'Trunk', native_vlan: '99', tagged_vlans: 'B', members: ['1/51', '1/52'] }
        ]
    },

    'cisco-9348GC-FXP': {
        make: 'Cisco',
        model: '9348GC-FXP',
        type: 'BMC',
        firmware: 'nxos',
        label: 'Cisco Nexus 9348GC-FXP',
        interface_templates: {
            common: [
                { name: 'Unused', type: 'Access', description: 'initial unused for all interfaces then config as defined', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/54', access_vlan: '2', shutdown: true },
                { name: 'Host_BMC', type: 'Access', description: 'Host BMC Connection', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/16', access_vlan: 'B' },
                { name: 'HLH_BMC', type: 'Access', description: 'HLH BMC Connection', intf_type: 'Ethernet', intf: '1/46', access_vlan: 'B' },
                { name: 'HLH_OS', type: 'Access', description: 'HLH OS Connection', intf_type: 'Ethernet', start_intf: '1/49', end_intf: '1/50', access_vlan: 'B' },
                { name: 'To_TORs', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/51', end_intf: '1/52', native_vlan: '99', tagged_vlans: 'B' }
            ]
        },
        port_channels: [
            { id: 102, description: 'TOR_BMC', type: 'Trunk', native_vlan: '99', tagged_vlans: 'B', members: ['1/51', '1/52'] }
        ]
    },

    'cisco-9348GC-FX3': {
        make: 'Cisco',
        model: '9348GC-FX3',
        type: 'BMC',
        firmware: 'nxos',
        label: 'Cisco Nexus 9348GC-FX3',
        interface_templates: {
            common: [
                { name: 'Unused', type: 'Access', description: 'initial unused for all interfaces then config as defined', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/54', access_vlan: '2', shutdown: true },
                { name: 'Host_BMC', type: 'Access', description: 'Host BMC Connection', intf_type: 'Ethernet', start_intf: '1/1', end_intf: '1/20', access_vlan: 'B' },
                { name: 'HLH_BMC', type: 'Access', description: 'HLH BMC Connection', intf_type: 'Ethernet', intf: '1/46', access_vlan: 'B' },
                { name: 'HLH_OS', type: 'Access', description: 'HLH OS Connection', intf_type: 'Ethernet', start_intf: '1/49', end_intf: '1/50', access_vlan: 'B' },
                { name: 'To_TORs', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/51', end_intf: '1/52', native_vlan: '99', tagged_vlans: 'B' }
            ]
        },
        port_channels: [
            { id: 102, description: 'TOR_BMC', type: 'Trunk', native_vlan: '99', tagged_vlans: 'B', members: ['1/51', '1/52'] }
        ]
    },

    // ── Dell EMC BMC Model ───────────────────────────────────────────
    'dell-N3248TE-ON': {
        make: 'DellEMC',
        model: 'N3248TE-ON',
        type: 'BMC',
        firmware: 'os10',
        label: 'Dell EMC N3248TE-ON',
        interface_templates: {
            common: [
                { name: 'Unused', type: 'Access', description: 'initial unused for all interfaces then config as defined', intf_type: 'Ethernet', start_intf: '1/1/1', end_intf: '1/1/54', access_vlan: '2', shutdown: true },
                { name: 'Host_BMC', type: 'Access', description: 'Host BMC Connection', intf_type: 'Ethernet', start_intf: '1/1/1', end_intf: '1/1/40', access_vlan: 'B' },
                { name: 'HLH_BMC', type: 'Access', description: 'HLH BMC Connection', intf_type: 'Ethernet', intf: '1/1/46', access_vlan: 'B' },
                { name: 'HLH_OS', type: 'Access', description: 'HLH OS Connection', intf_type: 'Ethernet', start_intf: '1/1/49', end_intf: '1/1/50', access_vlan: '7' },
                { name: 'To_TORs', type: 'Trunk', intf_type: 'Ethernet', start_intf: '1/1/51', end_intf: '1/1/52', native_vlan: '99', tagged_vlans: '7,B' }
            ]
        },
        port_channels: []
    }
};

/**
 * Helper: Get all TOR models (for dropdown)
 */
window.getTorModels = function () {
    var models = [];
    for (var key in window.SWITCH_MODELS) {
        if (window.SWITCH_MODELS[key].type === 'TOR') {
            models.push({ key: key, label: window.SWITCH_MODELS[key].label, firmware: window.SWITCH_MODELS[key].firmware });
        }
    }
    return models;
};

/**
 * Helper: Get all BMC models (for dropdown)
 */
window.getBmcModels = function () {
    var models = [];
    for (var key in window.SWITCH_MODELS) {
        if (window.SWITCH_MODELS[key].type === 'BMC') {
            models.push({ key: key, label: window.SWITCH_MODELS[key].label, firmware: window.SWITCH_MODELS[key].firmware });
        }
    }
    return models;
};
