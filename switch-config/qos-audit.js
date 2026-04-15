/**
 * QoS Configuration Audit — Parser & Validator
 *
 * Parses Cisco NX-OS and Dell OS10 "show running-config" / "show running-configuration" output and validates
 * that QoS settings meet Azure Local requirements for storage (RDMA) and
 * cluster heartbeat traffic.
 *
 * Reference: https://github.com/Azure/AzureLocal-Supportability/blob/main/
 *   TSG/Networking/Top-Of-Rack-Switch/Reference-TOR-QOS-Policy-Configuration.md
 *
 * Requirements:
 *   - PFC on CoS 3 (lossless storage/RDMA)
 *   - CoS 3 class-map (RDMA classification)
 *   - CoS 7 class-map (Cluster Heartbeat)
 *   - ETS: Storage queue ≥ 50% bandwidth
 *   - ETS: Cluster queue 1–2% bandwidth
 *   - ECN on storage queue
 *   - MTU 9216 (jumbo frames) in network-qos policy
 *   - System QoS policy applied
 *   - Interface-level PFC enabled on host-facing trunks
 *   - Interface-level QoS service-policy on storage trunks
 *   - VLAN trunking on host interfaces
 */
/* global window */
(function () {
    'use strict';

    // ── Platform Detection ───────────────────────────────────────────
    function detectPlatform(config) {
        // NX-OS has 'feature' commands and Ethernet1/x interfaces
        if (/^feature\s+/m.test(config) || /^hostname\s+/m.test(config) && /interface\s+Ethernet1\//m.test(config)) {
            return 'nxos';
        }
        // OS10 uses ethernet1/1/x style interfaces and OS10 markers
        if (/interface\s+ethernet\s*1\/1\//im.test(config) || /^OS10/m.test(config) || /trust\s+dot1p-map/m.test(config)) {
            return 'os10';
        }
        // Fallback: guess from interface naming
        if (/interface\s+Ethernet\s*1\//im.test(config)) return 'nxos';
        return null;
    }

    // ── Cisco NX-OS Parser ───────────────────────────────────────────
    function parseNxos(config) {
        var result = {
            platform: 'nxos',
            pfcCos: [],
            classMapCos3: false,
            classMapCos7: false,
            cosValues: [],
            etsBandwidthQueue3: null,
            etsBandwidthQueue7: null,
            etsBandwidthDefault: null,
            ecnOnStorageQueue: false,
            mtu9216: false,
            systemQosNetworkPolicy: false,
            systemQosQueuingPolicy: false,
            interfacePfc: [],
            interfaceQosPolicy: [],
            interfaceTrunks: [],
            interfaceMtu: []
        };

        var lines = config.split('\n');
        var i, line, trimmed;

        // Parse block-structured config line by line
        var currentBlock = null;   // 'network-qos', 'qos-map', 'queuing', 'class-map', 'system-qos', 'interface'
        var currentSubBlock = null;
        var currentIntf = null;

        for (i = 0; i < lines.length; i++) {
            line = lines[i];
            trimmed = line.trim();
            if (!trimmed || trimmed === '!') {
                // Blank/comment lines: don't reset block state — NX-OS policy-maps
                // have blank lines between sub-classes within the same block.
                // Block resets only happen when a new top-level command is found.
                continue;
            }

            // Top-level blocks (no leading whitespace)
            if (line[0] !== ' ' && line[0] !== '\t') {
                currentBlock = null;
                currentSubBlock = null;
                currentIntf = null;

                // policy-map type network-qos ...
                if (/^policy-map\s+type\s+network-qos\s+/i.test(trimmed)) {
                    currentBlock = 'network-qos';
                    continue;
                }
                // policy-map type queuing ...
                if (/^policy-map\s+type\s+queuing\s+/i.test(trimmed)) {
                    currentBlock = 'queuing';
                    continue;
                }
                // policy-map type qos ...
                if (/^policy-map\s+type\s+qos\s+/i.test(trimmed)) {
                    currentBlock = 'qos-map';
                    continue;
                }
                // class-map type qos ...
                if (/^class-map\s+type\s+qos\s+/i.test(trimmed)) {
                    currentBlock = 'class-map';
                    continue;
                }
                // system qos
                if (/^system\s+qos/i.test(trimmed)) {
                    currentBlock = 'system-qos';
                    continue;
                }
                // interface Ethernet...
                var intfMatch = trimmed.match(/^interface\s+(Ethernet\s*\d+\/\d+)/i);
                if (intfMatch) {
                    currentBlock = 'interface';
                    currentIntf = { name: intfMatch[1].replace(/\s+/g, ''), pfc: false, qosPolicy: false, trunk: false, mtu: null, vlans: '' };
                    continue;
                }
                continue;
            }

            // Indented lines — children of current block
            // network-qos block: look for pause pfc-cos and mtu
            if (currentBlock === 'network-qos') {
                var pfcMatch = trimmed.match(/pause\s+pfc-cos\s+(\d+)/i);
                if (pfcMatch) {
                    result.pfcCos.push(parseInt(pfcMatch[1], 10));
                }
                if (/mtu\s+9216/i.test(trimmed)) {
                    result.mtu9216 = true;
                }
                continue;
            }

            // class-map block: look for match cos
            if (currentBlock === 'class-map') {
                var cosMatch = trimmed.match(/match\s+cos\s+(\d+)/i);
                if (cosMatch) {
                    var cos = parseInt(cosMatch[1], 10);
                    if (cos === 3) result.classMapCos3 = true;
                    if (cos === 7) result.classMapCos7 = true;
                    if (result.cosValues.indexOf(cos) === -1) result.cosValues.push(cos);
                }
                continue;
            }

            // queuing block: look for bandwidth and ecn
            if (currentBlock === 'queuing') {
                // Track which sub-class we're in
                var qClassMatch = trimmed.match(/class\s+type\s+queuing\s+([\w-]+)/i);
                if (qClassMatch) {
                    currentSubBlock = qClassMatch[1].toLowerCase();
                    continue;
                }
                var bwMatch = trimmed.match(/bandwidth\s+(?:remaining\s+)?percent\s+(\d+)/i);
                if (bwMatch) {
                    var bw = parseInt(bwMatch[1], 10);
                    if (currentSubBlock && currentSubBlock.indexOf('q3') !== -1) {
                        result.etsBandwidthQueue3 = bw;
                    } else if (currentSubBlock && currentSubBlock.indexOf('q7') !== -1) {
                        result.etsBandwidthQueue7 = bw;
                    } else if (currentSubBlock && (currentSubBlock.indexOf('default') !== -1 || currentSubBlock.indexOf('q0') !== -1)) {
                        result.etsBandwidthDefault = bw;
                    }
                }
                if (/ecn/i.test(trimmed) && currentSubBlock && currentSubBlock.indexOf('q3') !== -1) {
                    result.ecnOnStorageQueue = true;
                }
                continue;
            }

            // system qos block: look for service-policy bindings
            if (currentBlock === 'system-qos') {
                if (/service-policy\s+type\s+network-qos/i.test(trimmed)) {
                    result.systemQosNetworkPolicy = true;
                }
                if (/service-policy\s+type\s+queuing/i.test(trimmed)) {
                    result.systemQosQueuingPolicy = true;
                }
                continue;
            }

            // interface block: look for PFC, service-policy, trunk, mtu
            if (currentBlock === 'interface' && currentIntf) {
                if (/priority-flow-control\s+mode\s+on/i.test(trimmed)) {
                    currentIntf.pfc = true;
                }
                if (/service-policy\s+type\s+qos\s+input/i.test(trimmed)) {
                    currentIntf.qosPolicy = true;
                }
                if (/switchport\s+mode\s+trunk/i.test(trimmed)) {
                    currentIntf.trunk = true;
                }
                var mtuMatch = trimmed.match(/mtu\s+(\d+)/i);
                if (mtuMatch) {
                    currentIntf.mtu = parseInt(mtuMatch[1], 10);
                }
                var vlanMatch = trimmed.match(/switchport\s+trunk\s+allowed\s+vlan\s+([\d,\-]+)/i);
                if (vlanMatch) {
                    currentIntf.vlans = vlanMatch[1];
                }
                // Check for shutdown — if shutdown, skip this interface
                if (/^\s*shutdown\s*$/i.test(line)) {
                    currentIntf.shutdown = true;
                }
                // End of interface block detection: next top-level line will reset
                // But we need to push the interface when the block ends
                // We'll check at the start of the next top-level line — use a lookahead approach
                // Actually, push after each interface definition completes
                // Use a flag to avoid double-push: we'll collect and push at block reset
            }
        }

        // Push last interface if any
        if (currentBlock === 'interface' && currentIntf && !currentIntf.shutdown) {
            if (currentIntf.pfc) result.interfacePfc.push(currentIntf.name);
            if (currentIntf.qosPolicy) result.interfaceQosPolicy.push(currentIntf.name);
            if (currentIntf.trunk) result.interfaceTrunks.push(currentIntf.name);
            if (currentIntf.mtu) result.interfaceMtu.push({ name: currentIntf.name, mtu: currentIntf.mtu });
        }

        // Re-parse interfaces properly: collect all interfaces in a second pass
        result.interfacePfc = [];
        result.interfaceQosPolicy = [];
        result.interfaceTrunks = [];
        result.interfaceMtu = [];

        currentIntf = null;
        for (i = 0; i < lines.length; i++) {
            line = lines[i];
            trimmed = line.trim();

            if (line[0] !== ' ' && line[0] !== '\t' && trimmed.length > 0 && trimmed !== '!') {
                // Save previous interface
                if (currentIntf && !currentIntf.shutdown) {
                    if (currentIntf.pfc) result.interfacePfc.push(currentIntf.name);
                    if (currentIntf.qosPolicy) result.interfaceQosPolicy.push(currentIntf.name);
                    if (currentIntf.trunk) result.interfaceTrunks.push(currentIntf.name);
                    if (currentIntf.mtu) result.interfaceMtu.push({ name: currentIntf.name, mtu: currentIntf.mtu });
                }
                currentIntf = null;

                var im = trimmed.match(/^interface\s+(Ethernet\s*\d+\/\d+)/i);
                if (im) {
                    currentIntf = { name: im[1].replace(/\s+/g, ''), pfc: false, qosPolicy: false, trunk: false, mtu: null, shutdown: false };
                }
            } else if (currentIntf && trimmed.length > 0) {
                if (/priority-flow-control\s+mode\s+on/i.test(trimmed)) currentIntf.pfc = true;
                if (/service-policy\s+type\s+qos\s+input/i.test(trimmed)) currentIntf.qosPolicy = true;
                if (/switchport\s+mode\s+trunk/i.test(trimmed)) currentIntf.trunk = true;
                var mm = trimmed.match(/^mtu\s+(\d+)/i);
                if (mm) currentIntf.mtu = parseInt(mm[1], 10);
                if (/^shutdown$/i.test(trimmed)) currentIntf.shutdown = true;
            }
        }
        // Push final interface
        if (currentIntf && !currentIntf.shutdown) {
            if (currentIntf.pfc) result.interfacePfc.push(currentIntf.name);
            if (currentIntf.qosPolicy) result.interfaceQosPolicy.push(currentIntf.name);
            if (currentIntf.trunk) result.interfaceTrunks.push(currentIntf.name);
            if (currentIntf.mtu) result.interfaceMtu.push({ name: currentIntf.name, mtu: currentIntf.mtu });
        }

        return result;
    }

    // ── Dell OS10 Parser ─────────────────────────────────────────────
    function parseOs10(config) {
        var result = {
            platform: 'os10',
            pfcCos: [],
            classMapCos3: false,
            classMapCos7: false,
            cosValues: [],
            etsBandwidthQueue3: null,
            etsBandwidthQueue7: null,
            etsBandwidthDefault: null,
            ecnOnStorageQueue: false,
            mtu9216: false,
            systemQosEts: false,
            systemQosTrustMap: false,
            interfacePfc: [],
            interfaceEts: [],
            interfaceQosPolicy: [],
            interfaceTrunks: [],
            interfaceMtu: []
        };

        var lines = config.split('\n');
        var i, line, trimmed;
        var currentBlock = null;
        var currentSubBlock = null;
        var currentIntf = null;

        for (i = 0; i < lines.length; i++) {
            line = lines[i];
            trimmed = line.trim();
            if (!trimmed || trimmed === '!') {
                // Don't reset block on blank lines — OS10 policy-maps have blank
                // lines between sub-classes. Block resets on new top-level commands.
                continue;
            }

            // Top-level blocks
            if (line[0] !== ' ' && line[0] !== '\t') {
                // Save previous interface
                if (currentBlock === 'interface' && currentIntf && !currentIntf.shutdown) {
                    if (currentIntf.pfc) result.interfacePfc.push(currentIntf.name);
                    if (currentIntf.ets) result.interfaceEts.push(currentIntf.name);
                    if (currentIntf.qosPolicy) result.interfaceQosPolicy.push(currentIntf.name);
                    if (currentIntf.trunk) result.interfaceTrunks.push(currentIntf.name);
                    if (currentIntf.mtu) result.interfaceMtu.push({ name: currentIntf.name, mtu: currentIntf.mtu });
                }
                currentBlock = null;
                currentSubBlock = null;
                currentIntf = null;

                if (/^class-map\s+type\s+network-qos\s+/i.test(trimmed)) {
                    currentBlock = 'class-map-nq';
                    continue;
                }
                if (/^policy-map\s+type\s+network-qos\s+/i.test(trimmed)) {
                    currentBlock = 'pfc-policy';
                    continue;
                }
                if (/^policy-map\s+type\s+queuing\s+/i.test(trimmed)) {
                    currentBlock = 'ets-policy';
                    continue;
                }
                if (/^system\s+qos/i.test(trimmed)) {
                    currentBlock = 'system-qos';
                    continue;
                }
                if (/^wred\s+ecn/i.test(trimmed)) {
                    currentBlock = 'wred';
                    continue;
                }
                var intfMatch = trimmed.match(/^interface\s+(ethernet\s*\d+\/\d+\/\d+)/i);
                if (intfMatch) {
                    currentBlock = 'interface';
                    currentIntf = { name: intfMatch[1].replace(/\s+/g, ''), pfc: false, ets: false, qosPolicy: false, trunk: false, mtu: null, shutdown: false };
                    continue;
                }
                continue;
            }

            // Children
            if (currentBlock === 'class-map-nq') {
                var qgMatch = trimmed.match(/match\s+qos-group\s+(\d+)/i);
                if (qgMatch) {
                    var qg = parseInt(qgMatch[1], 10);
                    if (qg === 3) result.classMapCos3 = true;
                    if (qg === 7) result.classMapCos7 = true;
                    if (result.cosValues.indexOf(qg) === -1) result.cosValues.push(qg);
                }
                continue;
            }

            if (currentBlock === 'pfc-policy') {
                var pfcCosMatch = trimmed.match(/pfc-cos\s+(\d+)/i);
                if (pfcCosMatch) {
                    result.pfcCos.push(parseInt(pfcCosMatch[1], 10));
                }
                continue;
            }

            if (currentBlock === 'ets-policy') {
                var classMatch = trimmed.match(/class\s+([\w]+)/i);
                if (classMatch) {
                    var cn = classMatch[1].toLowerCase();
                    if (cn.indexOf('queue3') !== -1 || cn.indexOf('q3') !== -1 || cn === 'azlocal_queue3') {
                        currentSubBlock = 'q3';
                    } else if (cn.indexOf('queue7') !== -1 || cn.indexOf('q7') !== -1 || cn === 'azlocal_queue7') {
                        currentSubBlock = 'q7';
                    } else if (cn.indexOf('queue0') !== -1 || cn.indexOf('q0') !== -1 || cn === 'azlocal_queue0') {
                        currentSubBlock = 'q0';
                    } else {
                        currentSubBlock = cn;
                    }
                    continue;
                }
                var bwMatch = trimmed.match(/bandwidth\s+percent\s+(\d+)/i);
                if (bwMatch) {
                    var bw = parseInt(bwMatch[1], 10);
                    if (currentSubBlock === 'q3') result.etsBandwidthQueue3 = bw;
                    else if (currentSubBlock === 'q7') result.etsBandwidthQueue7 = bw;
                    else if (currentSubBlock === 'q0') result.etsBandwidthDefault = bw;
                }
                if (/random-detect\s+ecn/i.test(trimmed) && currentSubBlock === 'q3') {
                    result.ecnOnStorageQueue = true;
                }
                continue;
            }

            if (currentBlock === 'system-qos') {
                if (/ets\s+mode\s+on/i.test(trimmed)) result.systemQosEts = true;
                if (/trust-map\s+dot1p/i.test(trimmed)) result.systemQosTrustMap = true;
                continue;
            }

            if (currentBlock === 'wred') {
                // WRED/ECN block — just presence confirms ECN is configured globally
                continue;
            }

            if (currentBlock === 'interface' && currentIntf) {
                if (/priority-flow-control\s+mode\s+on/i.test(trimmed)) currentIntf.pfc = true;
                if (/ets\s+mode\s+on/i.test(trimmed)) currentIntf.ets = true;
                if (/service-policy\s+input/i.test(trimmed)) currentIntf.qosPolicy = true;
                if (/switchport\s+mode\s+trunk/i.test(trimmed)) currentIntf.trunk = true;
                var mtuM = trimmed.match(/^mtu\s+(\d+)/i);
                if (mtuM) currentIntf.mtu = parseInt(mtuM[1], 10);
                if (/^shutdown$/i.test(trimmed)) currentIntf.shutdown = true;
            }
        }

        // Push final interface
        if (currentBlock === 'interface' && currentIntf && !currentIntf.shutdown) {
            if (currentIntf.pfc) result.interfacePfc.push(currentIntf.name);
            if (currentIntf.ets) result.interfaceEts.push(currentIntf.name);
            if (currentIntf.qosPolicy) result.interfaceQosPolicy.push(currentIntf.name);
            if (currentIntf.trunk) result.interfaceTrunks.push(currentIntf.name);
            if (currentIntf.mtu) result.interfaceMtu.push({ name: currentIntf.name, mtu: currentIntf.mtu });
        }

        // MTU check: OS10 uses interface-level mtu; also check for global jumbo frame
        if (/mtu\s+9216/m.test(config)) {
            result.mtu9216 = true;
        }

        return result;
    }

    // ── Validator ────────────────────────────────────────────────────
    function validate(parsed) {
        var checks = [];
        var isNxos = parsed.platform === 'nxos';
        var detectedCos = parsed.cosValues && parsed.cosValues.length > 0 ? parsed.cosValues.sort(function(a,b){return a-b;}) : [];
        var cosNote = detectedCos.length > 0 ? ' (detected CoS values: ' + detectedCos.join(', ') + ')' : '';

        // 1. PFC on CoS 3 (or custom storage CoS)
        checks.push({
            id: 'pfc-cos3',
            name: 'PFC on CoS 3 (Lossless Storage/RDMA)',
            description: 'Priority Flow Control (IEEE 802.1Qbb) must be enabled for the storage CoS (default: 3) to provide lossless transport for RDMA traffic' + cosNote + '.',
            status: parsed.pfcCos.indexOf(3) !== -1 ? 'pass' : 'fail',
            expected: 'pfc-cos 3 / pause pfc-cos 3',
            found: parsed.pfcCos.length > 0 ? 'pfc-cos ' + parsed.pfcCos.join(', ') : 'Not found'
        });

        // 2. CoS 3 class-map (RDMA classification)
        checks.push({
            id: 'classmap-cos3',
            name: 'Storage CoS Class-Map (RDMA Classification)',
            description: isNxos
                ? 'A class-map matching the storage CoS (default: 3) must exist to classify storage/RDMA traffic' + cosNote + '.'
                : 'A network-qos class-map matching the storage qos-group (default: 3) must exist to classify storage/RDMA traffic' + cosNote + '.',
            status: parsed.classMapCos3 ? 'pass' : 'fail',
            expected: isNxos ? 'match cos 3' : 'match qos-group 3',
            found: parsed.classMapCos3 ? 'Present' : 'Not found'
        });

        // 3. CoS 7 class-map (Cluster Heartbeat)
        checks.push({
            id: 'classmap-cos7',
            name: 'Cluster CoS Class-Map (Cluster Heartbeat)',
            description: isNxos
                ? 'A class-map matching the cluster CoS (default: 7) must exist to classify cluster heartbeat traffic' + cosNote + '.'
                : 'A network-qos class-map matching the cluster qos-group (default: 7) must exist to classify cluster heartbeat traffic' + cosNote + '.',
            status: parsed.classMapCos7 ? 'pass' : 'fail',
            expected: isNxos ? 'match cos 7' : 'match qos-group 7',
            found: parsed.classMapCos7 ? 'Present' : 'Not found'
        });

        // 4. ETS: Storage queue ≥ 50%
        var q3bw = parsed.etsBandwidthQueue3;
        var q3Status = 'fail';
        if (q3bw !== null && q3bw >= 50) q3Status = 'pass';
        else if (q3bw !== null && q3bw >= 40) q3Status = 'warn';
        checks.push({
            id: 'ets-storage',
            name: 'ETS: Storage Queue Bandwidth (\u226550%)',
            description: 'Enhanced Transmission Selection (IEEE 802.1Qaz) must reserve at least 50% of interface bandwidth for the storage queue (queue 3).',
            status: q3Status,
            expected: '\u226550%',
            found: q3bw !== null ? q3bw + '%' + (q3Status === 'warn' ? ' \u2014 below recommended 50% but functional; verify this meets your performance requirements' : '') : 'Not found'
        });

        // 5. ETS: Cluster queue 1–2%
        var q7bw = parsed.etsBandwidthQueue7;
        var q7Status = 'fail';
        if (q7bw !== null && q7bw >= 1 && q7bw <= 2) q7Status = 'pass';
        else if (q7bw !== null && q7bw > 0) q7Status = 'warn';
        checks.push({
            id: 'ets-cluster',
            name: 'ETS: Cluster Queue Bandwidth (1\u20132%)',
            description: 'Cluster heartbeat traffic (queue 7) must be reserved 1\u20132% of interface bandwidth (2% for 10G, 1% for 25G+).',
            status: q7Status,
            expected: '1\u20132%',
            found: q7bw !== null ? q7bw + '%' + (q7Status === 'warn' ? ' \u2014 outside recommended 1\u20132% range; verify this is appropriate for your interface speed' : '') : 'Not found'
        });

        // 6. ECN on storage queue
        checks.push({
            id: 'ecn-storage',
            name: 'ECN on Storage Queue',
            description: 'Explicit Congestion Notification must be enabled on the storage queue (queue 3) for RDMA congestion management.',
            status: parsed.ecnOnStorageQueue ? 'pass' : 'fail',
            expected: isNxos ? 'random-detect ... ecn' : 'random-detect ecn',
            found: parsed.ecnOnStorageQueue ? 'Present' : 'Not found'
        });

        // 7. MTU 9216 (jumbo frames)
        checks.push({
            id: 'mtu-9216',
            name: 'MTU 9216 (Jumbo Frames)',
            description: 'MTU must be set to 9216 for jumbo frame support across all QoS traffic classes.',
            status: parsed.mtu9216 ? 'pass' : 'fail',
            expected: 'mtu 9216',
            found: parsed.mtu9216 ? 'Present' : 'Not found'
        });

        // 8. System QoS policy applied
        var sysQosOk;
        if (isNxos) {
            sysQosOk = parsed.systemQosNetworkPolicy && parsed.systemQosQueuingPolicy;
        } else {
            sysQosOk = parsed.systemQosEts;
        }
        checks.push({
            id: 'system-qos',
            name: 'System QoS Policy Applied',
            description: isNxos
                ? 'The system qos section must bind both the network-qos and queuing output policies globally.'
                : 'The system qos section must enable ETS mode globally.',
            status: sysQosOk ? 'pass' : 'fail',
            expected: isNxos ? 'service-policy type network-qos + queuing output under system qos' : 'ets mode on under system qos',
            found: sysQosOk ? 'Present' : 'Not found'
        });

        // 9. Interface PFC enabled on storage-facing interfaces
        // The QoS service-policy is the definitive marker — interfaces with the QoS input
        // policy are the ones that classify storage traffic and MUST have PFC.
        // Interfaces without the policy (uplinks, BMC trunks, etc.) don't need PFC.
        var trunkCount = parsed.interfaceTrunks.length;
        var pfcCount = parsed.interfacePfc.length;
        var qosPolicyInterfaces = parsed.interfaceQosPolicy;
        var intfPfcStatus = 'fail';
        var intfPfcFound;

        if (qosPolicyInterfaces.length > 0) {
            // Smart check: compare PFC against QoS-policy interfaces (storage-facing)
            var storageMissingPfc = qosPolicyInterfaces.filter(function (intf) { return parsed.interfacePfc.indexOf(intf) === -1; });
            var nonStorageTrunks = parsed.interfaceTrunks.filter(function (t) { return qosPolicyInterfaces.indexOf(t) === -1; });

            if (storageMissingPfc.length === 0 && qosPolicyInterfaces.length > 0) {
                intfPfcStatus = 'pass';
                intfPfcFound = 'All ' + qosPolicyInterfaces.length + ' storage-facing interface(s) have PFC: ' + qosPolicyInterfaces.join(', ');
                if (nonStorageTrunks.length > 0) {
                    intfPfcFound += '. ' + nonStorageTrunks.length + ' non-storage trunk(s) correctly omit PFC: ' + nonStorageTrunks.join(', ');
                }
            } else if (pfcCount > 0) {
                intfPfcStatus = 'warn';
                intfPfcFound = storageMissingPfc.length + ' of ' + qosPolicyInterfaces.length + ' storage-facing interface(s) are MISSING PFC: ' + storageMissingPfc.join(', ') + '. These interfaces have the QoS service-policy and need priority-flow-control mode on';
            } else {
                intfPfcFound = 'Not found on any interface \u2014 ' + qosPolicyInterfaces.length + ' interface(s) have QoS service-policy and require PFC';
            }
        } else {
            // Fallback: no QoS policy detected, use simple trunk-based check
            if (pfcCount > 0 && pfcCount >= trunkCount && trunkCount > 0) intfPfcStatus = 'pass';
            else if (pfcCount > 0) intfPfcStatus = 'warn';

            if (pfcCount === 0) {
                intfPfcFound = 'Not found on any interface';
            } else if (intfPfcStatus === 'warn') {
                var nonPfcTrunks = parsed.interfaceTrunks.filter(function (t) { return parsed.interfacePfc.indexOf(t) === -1; });
                intfPfcFound = pfcCount + ' of ' + trunkCount + ' trunk interface(s) have PFC. Enabled: ' + parsed.interfacePfc.join(', ') + '. Missing (requires validation): ' + nonPfcTrunks.join(', ');
            } else {
                intfPfcFound = 'All ' + trunkCount + ' trunk interface(s) have PFC: ' + parsed.interfacePfc.join(', ');
            }
        }
        checks.push({
            id: 'intf-pfc',
            name: 'Interface-Level PFC Enabled',
            description: 'priority-flow-control mode on must be configured on host-facing trunk interfaces that carry storage traffic.',
            status: intfPfcStatus,
            expected: 'priority-flow-control mode on',
            found: intfPfcFound
        });

        // 10. Interface QoS service-policy
        var qosPolicyCount = parsed.interfaceQosPolicy.length;
        var intfQosStatus = 'fail';
        if (qosPolicyCount > 0) intfQosStatus = 'pass';
        checks.push({
            id: 'intf-qos-policy',
            name: 'Interface QoS Service-Policy',
            description: isNxos
                ? 'A QoS input service-policy must be applied on storage-facing trunk interfaces (service-policy type qos input).'
                : 'A network-qos input service-policy must be applied on storage-facing interfaces (service-policy input type network-qos).',
            status: intfQosStatus,
            expected: isNxos ? 'service-policy type qos input ...' : 'service-policy input ...',
            found: qosPolicyCount > 0 ? qosPolicyCount + ' interface(s): ' + parsed.interfaceQosPolicy.join(', ') : 'Not found on any interface'
        });

        // 11. VLAN Trunking on host interfaces (Option B)
        checks.push({
            id: 'intf-trunks',
            name: 'VLAN Trunking on Host Interfaces',
            description: 'Host-facing interfaces must be configured as trunk ports to carry tagged VLAN traffic for management, compute, and storage.',
            status: trunkCount > 0 ? 'pass' : 'fail',
            expected: 'switchport mode trunk',
            found: trunkCount > 0 ? trunkCount + ' trunk interface(s) found' : 'No trunk interfaces found'
        });

        return checks;
    }

    // ── Render Results ───────────────────────────────────────────────
    function renderResults(checks, platform) {
        var passCount = 0, warnCount = 0, failCount = 0;
        for (var c = 0; c < checks.length; c++) {
            if (checks[c].status === 'pass') passCount++;
            else if (checks[c].status === 'warn') warnCount++;
            else failCount++;
        }

        var platformLabel = platform === 'nxos' ? 'Cisco NX-OS' : (platform === 'os10' ? 'Dell OS10' : 'Unknown');
        var overallStatus = failCount === 0 ? (warnCount === 0 ? 'COMPLIANT' : 'COMPLIANT WITH WARNINGS') : 'NOT COMPLIANT';
        var overallClass = failCount === 0 ? (warnCount === 0 ? 'qa-pass' : 'qa-warn') : 'qa-fail';

        var html = '';

        // Summary banner
        html += '<div class="qa-summary ' + overallClass + '">';
        html += '<div class="qa-summary-status">' + escapeHtml(overallStatus) + '</div>';
        html += '<div class="qa-summary-detail">Platform: <strong>' + escapeHtml(platformLabel) + '</strong> &nbsp;|&nbsp; ';
        html += '<span class="qa-stat-pass">\u2705 ' + passCount + ' passed</span>';
        if (warnCount > 0) html += ' &nbsp; <span class="qa-stat-warn">\u26A0\uFE0F ' + warnCount + ' warning(s)</span>';
        if (failCount > 0) html += ' &nbsp; <span class="qa-stat-fail">\u274C ' + failCount + ' failed</span>';
        html += '</div></div>';

        // Detail table
        html += '<table class="qa-table">';
        html += '<thead><tr><th></th><th>Check</th><th>Expected</th><th>Found</th></tr></thead>';
        html += '<tbody>';
        for (var i = 0; i < checks.length; i++) {
            var ch = checks[i];
            var icon = ch.status === 'pass' ? '\u2705' : (ch.status === 'warn' ? '\u26A0\uFE0F' : '\u274C');
            var rowClass = 'qa-row-' + ch.status;
            html += '<tr class="' + rowClass + '">';
            html += '<td class="qa-icon">' + icon + '</td>';
            html += '<td><strong>' + escapeHtml(ch.name) + '</strong><br><span class="qa-desc">' + escapeHtml(ch.description) + '</span></td>';
            html += '<td class="qa-mono">' + escapeHtml(ch.expected) + '</td>';
            html += '<td class="qa-mono">' + escapeHtml(ch.found) + '</td>';
            html += '</tr>';
        }
        html += '</tbody></table>';

        // Reference link
        html += '<p class="qa-reference">Reference: <a href="https://github.com/Azure/AzureLocal-Supportability/blob/main/TSG/Networking/Top-Of-Rack-Switch/Reference-TOR-QOS-Policy-Configuration.md" target="_blank" rel="noopener noreferrer">Azure Local \u2014 QoS Policy Configuration</a></p>';

        return html;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Public API ───────────────────────────────────────────────────
    window.runQosAudit = function () {
        var textarea = document.getElementById('sc-qos-audit-input');
        var resultsDiv = document.getElementById('sc-qos-audit-results');
        if (!textarea || !resultsDiv) return;

        var config = textarea.value;
        if (!config || config.trim().length < 50) {
            alert('Please paste a complete switch running-config output (minimum 50 characters).');
            return;
        }
        if (config.length > 500000) {
            alert('Config is too large (maximum 500 KB). Please paste only the relevant running-config output.');
            return;
        }

        var platform = detectPlatform(config);
        if (!platform) {
            alert('Unable to detect switch platform. Please paste a Cisco NX-OS or Dell OS10 running-config.');
            return;
        }

        var parsed = platform === 'nxos' ? parseNxos(config) : parseOs10(config);
        var checks = validate(parsed);
        resultsDiv.innerHTML = renderResults(checks, platform);
        resultsDiv.style.display = 'block';
        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Expose internals for testing
    window.QosAudit = {
        detectPlatform: detectPlatform,
        parseNxos: parseNxos,
        parseOs10: parseOs10,
        validate: validate
    };
})();
