/**
 * Disaggregated Architecture Wizard Logic
 * Handles DA1-DA8 steps for Clos leaf-spine fabric with external SAN storage.
 */

// ── Port Budget Calculator ──────────────────────────────────────────────────
function getMaxNodesPerRack(storageType, backupEnabled) {
    // Cisco Nexus 93180YC-FX3: 48 × 25G ports + 6 × 100G
    // Port 49 = iBGP between leaf-A/B, Ports 51-54 = 100G spine uplinks
    // Usable 25G ports: 1-48
    const portsPerLeaf = 48;
    let portsUsedPerNode = 2; // OCP (Compute/Mgmt) = ports 1-16 range (1 per leaf)

    // Cluster NICs always use 1 port per leaf (PCIe1, ports 17-32 range)
    portsUsedPerNode += 1; // +1 cluster NIC per leaf

    if (storageType === 'iscsi_6nic' && !backupEnabled) {
        portsUsedPerNode += 1; // +1 dedicated iSCSI NIC per leaf (ports 33-48 range)
    }
    if (backupEnabled) {
        portsUsedPerNode += 1; // +1 backup NIC per leaf (ports 33-48 range)
    }

    // Each "port range" block holds 16 ports (1-16, 17-32, 33-48)
    return 16;
}

// ── DA Step Selection Handler ───────────────────────────────────────────────
function selectDisaggOption(category, value) {
    if (category === 'storageType') {
        state.disaggStorageType = value;
        state.disaggBackupEnabled = false;
        state.disaggPortCount = null;
        state.disaggRackCount = null;
        state.disaggNodesPerRack = null;
        state.disaggSpineCount = null;
        // Reset port config on storage type change
        state.disaggPortConfig = {};
        state.disaggPortConfigConfirmed = false;
        state.disaggAdapterMapping = {};
        state.disaggAdapterMappingConfirmed = false;
        state.disaggOverridesConfirmed = false;
        state.disaggVlanConfigConfirmed = false;
        state.disaggIpConfigConfirmed = false;
        state.disaggWorkloadVlans = [];

        // Show explanation
        const exp = document.getElementById('da1-explanation');
        if (exp) {
            const explanations = {
                fc_san: '<strong style="color: var(--accent-purple);">Fibre Channel SAN</strong> — Dedicated FC HBAs connect to separate FC switches. Storage traffic is completely isolated from the Ethernet leaf-spine fabric. Max 16 nodes per rack.',
                iscsi_4nic: '<strong style="color: var(--accent-purple);">iSCSI SAN (4-NIC)</strong> — iSCSI storage shares cluster standalone ports and VLAN. No additional NICs required. Max 16 nodes per rack.',
                iscsi_6nic: '<strong style="color: var(--accent-purple);">iSCSI SAN (6-NIC)</strong> — Dedicated iSCSI NICs on PCIe2 slot with own VLANs and subnets. If backup is enabled, iSCSI falls back to sharing cluster ports and PCIe2 is used for backup. Max 16 nodes per rack.'
            };
            exp.innerHTML = explanations[value] || '';
            exp.classList.add('visible');
        }

        // Select card visually
        document.querySelectorAll('#step-da1 .option-card').forEach(card => {
            card.classList.toggle('selected', card.getAttribute('data-value') === value);
        });
        renderDisaggNicConfig();

    } else if (category === 'backup') {
        state.disaggBackupEnabled = value;
        state.disaggRackCount = null;
        state.disaggNodesPerRack = null;
        // Reset adapter mapping when backup changes (vNIC mode affects port assignments)
        state.disaggAdapterMapping = {};
        state.disaggAdapterMappingConfirmed = false;
        state.disaggOverridesConfirmed = false;
        state.disaggVlanConfigConfirmed = false;

        // Show warning for iSCSI 6-NIC + backup
        const warning = document.getElementById('da2-warning');
        if (warning) {
            if (value && state.disaggStorageType === 'iscsi_6nic') {
                warning.innerHTML = '<strong style="color: #a78bfa;">&#9432; iSCSI Shared Mode</strong><p>With backup enabled, iSCSI 6-NIC loses its dedicated NICs. iSCSI traffic will <strong>share the cluster standalone ports and VLAN</strong> instead. The PCIe2 ports will be used for the <strong>Backup Compute Intent</strong>.</p>';
                warning.classList.remove('hidden');
            } else {
                warning.classList.add('hidden');
            }
        }

        // Show explanation
        const exp = document.getElementById('da2-explanation');
        if (exp) {
            if (value) {
                exp.innerHTML = '<strong style="color: var(--accent-purple);">Backup Network Enabled</strong> — 2 additional NICs per node for in-guest VM backup traffic on dedicated VLAN 800.';
            } else {
                exp.innerHTML = '<strong style="color: var(--accent-purple);">No Backup Network</strong> — Standard deployment without dedicated backup NICs.';
            }
            exp.classList.add('visible');
        }

        // Select card visually
        document.querySelectorAll('#step-da2 .option-card').forEach(card => {
            card.classList.toggle('selected', String(card.getAttribute('data-value')) === String(value));
        });
        renderDisaggNicConfig();

    } else if (category === 'racks') {
        state.disaggRackCount = value;
        const maxNodes = getMaxNodesPerRack(state.disaggStorageType, state.disaggBackupEnabled);
        state.disaggNodesPerRack = Math.min(state.disaggNodesPerRack || maxNodes, maxNodes);

        // Update slider max
        const slider = document.getElementById('da-nodes-per-rack');
        if (slider) {
            slider.max = maxNodes;
            slider.value = state.disaggNodesPerRack;
        }
        const valSpan = document.getElementById('da-nodes-per-rack-value');
        if (valSpan) valSpan.textContent = state.disaggNodesPerRack;

        updateScaleSummary();

        // Select card visually
        document.querySelectorAll('#step-da3 .option-card[onclick*="racks"]').forEach(card => {
            card.classList.toggle('selected', String(card.getAttribute('data-value')) === String(value));
        });

    } else if (category === 'nodesPerRack') {
        const maxNodes = getMaxNodesPerRack(state.disaggStorageType, state.disaggBackupEnabled);
        state.disaggNodesPerRack = Math.min(value, maxNodes);

        const valSpan = document.getElementById('da-nodes-per-rack-value');
        if (valSpan) valSpan.textContent = state.disaggNodesPerRack;

        updateScaleSummary();

    } else if (category === 'spines') {
        state.disaggSpineCount = value;
        state.disaggIpConfigConfirmed = false;

        const exp = document.getElementById('da4-explanation');
        if (exp) {
            if (value === 2) {
                exp.innerHTML = '<strong style="color: var(--accent-purple);">2 Spines</strong> — Standard redundancy with 2× 100G uplinks per leaf to each spine (400 Gbps total per leaf pair). 26 unused spine ports available for future expansion.';
            } else {
                exp.innerHTML = '<strong style="color: var(--accent-purple);">4 Spines</strong> — Maximum bandwidth and redundancy with 4× 100G uplinks per leaf (800 Gbps total per leaf pair). Recommended for >2 racks or high east-west traffic.';
            }
            exp.classList.add('visible');
        }

        // Select card visually
        document.querySelectorAll('#step-da4 .option-card').forEach(card => {
            card.classList.toggle('selected', String(card.getAttribute('data-value')) === String(value));
        });

        // Trigger downstream renders
        renderVlanGrid();
        renderQosSummary();
        renderIpPlanning();
        renderDisaggSummary();
        renderDisaggNicConfig();
    }

    updateUI();
}

function updateScaleSummary() {
    const total = (state.disaggRackCount || 0) * (state.disaggNodesPerRack || 0);
    const maxPerRack = getMaxNodesPerRack(state.disaggStorageType, state.disaggBackupEnabled);
    const info = document.getElementById('da-max-nodes-info');
    if (info) info.textContent = `Max per rack: ${maxPerRack} | Total: ${total} nodes`;

    // Sync state.nodes so shared steps (step-10 node config) work with the right count
    if (total > 0) {
        state.nodes = String(total);
    }

    const summary = document.getElementById('da3-scale-summary');
    if (summary && state.disaggRackCount && state.disaggNodesPerRack) {
        summary.innerHTML = `<strong style="color: var(--accent-purple);">Scale Configuration</strong> — ${state.disaggRackCount} rack(s) × ${state.disaggNodesPerRack} nodes = <strong>${total} total nodes</strong>. Each rack: 2 leaf switches + 1 BMC switch${state.disaggStorageType === 'fc_san' ? ' + 2 FC switches' : ''}.`;
        summary.classList.add('visible');
    }
}

// ── VLAN Grid (DA5) ─────────────────────────────────────────────────────────
function renderVlanGrid() {
    const grid = document.getElementById('da5-vlan-grid');
    if (!grid) return;

    const vlans = state.disaggVlans;
    const vnis = state.disaggVnis;
    const confirmed = state.disaggVlanConfigConfirmed === true;

    let rows = [
        { key: 'mgmt', label: 'Management (Infra)', vlan: vlans.mgmt, vni: vnis.mgmt },
        { key: 'cluster1', label: 'Cluster (CSV/LM) A', vlan: vlans.cluster1, vni: vnis.cluster1 },
        { key: 'cluster2', label: 'Cluster (CSV/LM) B', vlan: vlans.cluster2, vni: vnis.cluster2 }
    ];

    if (state.disaggStorageType === 'iscsi_4nic' || state.disaggStorageType === 'iscsi_6nic') {
        rows.push({ key: 'iscsiA', label: 'iSCSI Fabric A', vlan: vlans.iscsiA, vni: vnis.iscsiA });
        rows.push({ key: 'iscsiB', label: 'iSCSI Fabric B', vlan: vlans.iscsiB, vni: vnis.iscsiB });
    }

    if (state.disaggBackupEnabled) {
        rows.push({ key: 'backup', label: 'Backup Network', vlan: vlans.backup, vni: vnis.backup });
    }

    grid.innerHTML = rows.map(r => `
        <div style="background: var(--subtle-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px;">
            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 8px;">${r.label}</label>
            <div style="display: flex; gap: 8px;">
                <div style="flex: 1;">
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">VLAN</span>
                    <input type="number" value="${r.vlan}" min="1" max="4094"
                        style="width: 100%; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.9rem;"
                        ${confirmed ? 'disabled' : ''}
                        onchange="updateDisaggVlan('${r.key}', parseInt(this.value))">
                </div>
                <div style="flex: 1;">
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">VNI</span>
                    <input type="number" value="${r.vni}" min="1" max="16777215"
                        style="width: 100%; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.9rem;"
                        ${confirmed ? 'disabled' : ''}
                        onchange="updateDisaggVni('${r.key}', parseInt(this.value))">
                </div>
            </div>
        </div>
    `).join('');

    renderDisaggWorkloadVlans();
    renderDisaggVlanConfirmState();
}

function updateDisaggVlan(key, value) {
    if (value >= 1 && value <= 4094) state.disaggVlans[key] = value;
    state.disaggVlanConfigConfirmed = false;
    renderDisaggVlanConfirmState();
}
function updateDisaggVni(key, value) {
    if (value >= 1 && value <= 16777215) state.disaggVnis[key] = value;
    state.disaggVlanConfigConfirmed = false;
    renderDisaggVlanConfirmState();
}
function updateDisaggVrf(value) {
    state.disaggVrfName = value;
    state.disaggVlanConfigConfirmed = false;
    renderDisaggVlanConfirmState();
}

// ── Workload VLANs ──────────────────────────────────────────────────────────

function addDisaggWorkloadVlan() {
    if (!state.disaggWorkloadVlans) state.disaggWorkloadVlans = [];
    // Find next available VLAN ID
    var usedVlans = state.disaggWorkloadVlans.map(function(w) { return w.vlan; });
    var nextVlan = 100;
    while (usedVlans.indexOf(nextVlan) !== -1 && nextVlan < 4094) nextVlan++;
    var nextVni = 10000 + nextVlan;

    var vrfName = 'TENANT' + (state.disaggWorkloadVlans.length + 1);
    state.disaggWorkloadVlans.push({ name: 'Workload ' + (state.disaggWorkloadVlans.length + 1), vlan: nextVlan, vni: nextVni, vrf: vrfName });
    state.disaggVlanConfigConfirmed = false;
    renderDisaggWorkloadVlans();
    renderDisaggVlanConfirmState();
}

function removeDisaggWorkloadVlan(index) {
    if (!state.disaggWorkloadVlans) return;
    state.disaggWorkloadVlans.splice(index, 1);
    state.disaggVlanConfigConfirmed = false;
    renderDisaggWorkloadVlans();
    renderDisaggVlanConfirmState();
}

function updateDisaggWorkloadVlan(index, field, value) {
    if (!state.disaggWorkloadVlans || !state.disaggWorkloadVlans[index]) return;
    if (field === 'name') {
        state.disaggWorkloadVlans[index].name = value;
    } else if (field === 'vlan') {
        var v = parseInt(value);
        if (v >= 1 && v <= 4094) state.disaggWorkloadVlans[index].vlan = v;
    } else if (field === 'vni') {
        var n = parseInt(value);
        if (n >= 1 && n <= 16777215) state.disaggWorkloadVlans[index].vni = n;
    } else if (field === 'vrf') {
        state.disaggWorkloadVlans[index].vrf = String(value || '').trim();
    }
    state.disaggVlanConfigConfirmed = false;
    renderDisaggVlanConfirmState();
}

function renderDisaggWorkloadVlans() {
    var list = document.getElementById('da5-workload-vlan-list');
    if (!list) return;
    var wlVlans = state.disaggWorkloadVlans || [];
    var confirmed = state.disaggVlanConfigConfirmed === true;

    if (wlVlans.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = wlVlans.map(function(w, i) {
        return '<div style="background: var(--subtle-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 10px 12px; margin-bottom: 8px;">'
            + '<div style="display: flex; align-items: center; gap: 8px;">'
            + '<div style="flex: 2;">'
            + '<span style="font-size: 0.75rem; color: var(--text-secondary);">Name</span>'
            + '<input type="text" value="' + (w.name || '') + '" placeholder="Workload name"'
            + ' style="width: 100%; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.9rem;"'
            + (confirmed ? ' disabled' : '')
            + ' onchange="updateDisaggWorkloadVlan(' + i + ', \'name\', this.value)">'
            + '</div>'
            + '<div style="flex: 1;">'
            + '<span style="font-size: 0.75rem; color: var(--text-secondary);">VLAN</span>'
            + '<input type="number" value="' + w.vlan + '" min="1" max="4094"'
            + ' style="width: 100%; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.9rem;"'
            + (confirmed ? ' disabled' : '')
            + ' onchange="updateDisaggWorkloadVlan(' + i + ', \'vlan\', this.value)">'
            + '</div>'
            + '<div style="flex: 1;">'
            + '<span style="font-size: 0.75rem; color: var(--text-secondary);">VNI</span>'
            + '<input type="number" value="' + w.vni + '" min="1" max="16777215"'
            + ' style="width: 100%; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.9rem;"'
            + (confirmed ? ' disabled' : '')
            + ' onchange="updateDisaggWorkloadVlan(' + i + ', \'vni\', this.value)">'
            + '</div>'
            + (confirmed ? '' : '<button type="button" onclick="removeDisaggWorkloadVlan(' + i + ')" style="align-self: flex-end; margin-bottom: 2px; background: transparent; border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;" title="Remove">✕</button>')
            + '</div>'
            + '<div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">'
            + '<div style="flex: 1;">'
            + '<span style="font-size: 0.75rem; color: var(--text-secondary);">VRF Name</span>'
            + '<input type="text" value="' + (w.vrf || '') + '" placeholder="e.g. TENANT1"'
            + ' style="width: 100%; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.9rem;"'
            + (confirmed ? ' disabled' : '')
            + ' onchange="updateDisaggWorkloadVlan(' + i + ', \'vrf\', this.value)">'
            + '</div>'
            + '<div style="flex: 2; font-size: 0.8rem; color: var(--text-secondary); padding-top: 14px;">Isolated routing domain for this tenant\'s workload traffic</div>'
            + '</div>'
            + '</div>';
    }).join('');
}

function confirmDisaggVlanConfig() {
    // Validate all VLAN IDs are filled
    var vlans = state.disaggVlans || {};
    var missing = [];
    if (!vlans.mgmt) missing.push('Management VLAN');
    if (!vlans.cluster1) missing.push('Cluster A VLAN');
    if (!vlans.cluster2) missing.push('Cluster B VLAN');
    if ((state.disaggStorageType === 'iscsi_4nic' || state.disaggStorageType === 'iscsi_6nic') && !vlans.iscsiA) missing.push('iSCSI A VLAN');
    if ((state.disaggStorageType === 'iscsi_4nic' || state.disaggStorageType === 'iscsi_6nic') && !vlans.iscsiB) missing.push('iSCSI B VLAN');
    if (state.disaggBackupEnabled && !vlans.backup) missing.push('Backup VLAN');

    if (missing.length > 0) {
        if (typeof showToast === 'function') showToast('Missing required fields: ' + missing.join(', '), 'error');
        return;
    }

    state.disaggVlanConfigConfirmed = true;
    renderDisaggVlanConfirmState();
    renderVlanGrid();
    renderDisaggWorkloadVlans();
    if (typeof showToast === 'function') showToast('VLAN configuration confirmed', 'success');
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function editDisaggVlanConfig() {
    state.disaggVlanConfigConfirmed = false;
    renderDisaggVlanConfirmState();
    renderVlanGrid();
    renderDisaggWorkloadVlans();
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function renderDisaggVlanConfirmState() {
    var confirmContainer = document.getElementById('da5-confirm-container');
    var confirmedMsg = document.getElementById('da5-confirmed-msg');
    var addBtn = document.getElementById('da5-add-workload-btn');
    var vrfInput = document.getElementById('da-vrf-name');
    var confirmed = state.disaggVlanConfigConfirmed === true;

    if (confirmContainer) confirmContainer.classList.toggle('hidden', confirmed);
    if (confirmedMsg) confirmedMsg.classList.toggle('hidden', !confirmed);
    if (addBtn) addBtn.style.display = confirmed ? 'none' : '';
    if (vrfInput) vrfInput.disabled = confirmed;

    if (typeof updateBreadcrumbs === 'function') updateBreadcrumbs();
}

// ── QoS Summary (DA6) ──────────────────────────────────────────────────────
function renderQosSummary() {
    const container = document.getElementById('da6-qos-summary');
    if (!container) return;

    const isIscsi = state.disaggStorageType === 'iscsi_4nic' || state.disaggStorageType === 'iscsi_6nic';
    const isFcSan = state.disaggStorageType === 'fc_san';
    const exp = document.getElementById('da6-explanation');

    let rows = [
        { priority: 0, desc: 'Default Traffic', pfc: 'No', bw: '79%' },
        { priority: 3, desc: 'CSV / Live Migration', pfc: 'No', bw: '20%' },
        { priority: 7, desc: 'Cluster Heartbeat', pfc: 'No', bw: '1%' }
    ];

    if (isIscsi) {
        rows.push({ priority: 4, desc: 'iSCSI Storage', pfc: 'No', bw: '50%' });
        rows[0].bw = '29%';
    }

    if (state.disaggBackupEnabled) {
        rows.push({ priority: 5, desc: 'Backup Traffic', pfc: 'No', bw: '10%' });
        const defRow = rows.find(r => r.priority === 0);
        if (defRow) defRow.bw = isIscsi ? '19%' : '69%';
    }

    rows.sort((a, b) => a.priority - b.priority);

    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; background: var(--subtle-bg); border-radius: 6px; overflow: hidden;">
            <thead>
                <tr style="background: var(--card-bg);">
                    <th style="padding: 8px 12px; text-align: left; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">802.1p Priority</th>
                    <th style="padding: 8px 12px; text-align: left; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">Description</th>
                    <th style="padding: 8px 12px; text-align: center; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">PFC</th>
                    <th style="padding: 8px 12px; text-align: center; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">ETS Bandwidth</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => `
                    <tr>
                        <td style="padding: 8px 12px; border-bottom: 1px solid var(--glass-border); color: var(--text-primary);">${r.priority}</td>
                        <td style="padding: 8px 12px; border-bottom: 1px solid var(--glass-border); color: var(--text-primary);">${r.desc}</td>
                        <td style="padding: 8px 12px; border-bottom: 1px solid var(--glass-border); text-align: center; color: var(--text-secondary);">${r.pfc}</td>
                        <td style="padding: 8px 12px; border-bottom: 1px solid var(--glass-border); text-align: center; color: var(--accent-blue); font-weight: 600;">${r.bw}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    if (exp) {
        if (isFcSan) {
            exp.innerHTML = '<strong style="color: var(--accent-purple);">802.1p + ETS</strong> — QoS is required for CSV/Live Migration traffic even with FC SAN. Storage traffic runs on a separate Fibre Channel fabric and does not need Ethernet QoS, but cluster traffic sharing the leaf ports still needs traffic classification and bandwidth reservation.';
        } else {
            exp.innerHTML = '<strong style="color: var(--accent-purple);">802.1p + ETS</strong> — No PFC (Priority Flow Control) required. iSCSI is loss-tolerant unlike RDMA. 802.1p CoS marking with Weighted Round Robin (WRR) bandwidth allocation ensures each traffic class gets guaranteed bandwidth.';
        }
        exp.classList.add('visible');
    }
}

// ── IP Planning (DA7) ───────────────────────────────────────────────────────

function renderDisaggTopologyDiagram() {
    var container = document.getElementById('da7-topology-diagram');
    if (!container) return;

    var rackCount = state.disaggRackCount || 1;
    var spineCount = state.disaggSpineCount || 2;

    // Layout
    var SPINE_W = 160, SPINE_H = 36;
    var SL_W = 140, SL_H = 30;
    var LEAF_W = 110, LEAF_H = 26;
    var RACK_PAD = 30;

    var rackGroupW = rackCount * (2 * LEAF_W + 20) + (rackCount - 1) * RACK_PAD;
    var spinesGroupW = spineCount * SPINE_W + (spineCount - 1) * 24;
    var slGroupW = 2 * SL_W + 24;
    var totalW = Math.max(rackGroupW + 80, spinesGroupW + 80, slGroupW + 80, 500);

    var SPINE_Y = 40, SL_Y = 110, LEAF_Y = 210, BOTTOM_PAD = 30;
    var totalH = LEAF_Y + LEAF_H + BOTTOM_PAD + 30;

    var C = {
        BG: '#1a1a2e', SPINE: '#1a6fc4', SL: '#14b8a6', LEAF: '#6b7280',
        LINK: 'rgba(255,255,255,0.15)', LINK_ACTIVE: 'rgba(255,255,255,0.35)',
        TEXT: '#e0e0e0', TEXT_DIM: '#999', RACK_BORDER: '#444466'
    };

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalW + ' ' + totalH + '" style="width:100%;max-width:' + totalW + 'px;background:' + C.BG + ';font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;border-radius:6px;">';

    // Title
    svg += '<text x="' + (totalW / 2) + '" y="22" text-anchor="middle" fill="' + C.TEXT + '" font-size="13" font-weight="600">Clos Fabric Topology — BGP Peering &amp; Loopback Map</text>';

    // Spine positions
    var spineStartX = (totalW - spinesGroupW) / 2;
    var spinePositions = [];
    for (var s = 0; s < spineCount; s++) {
        var sx = spineStartX + s * (SPINE_W + 24);
        spinePositions.push({ x: sx, cx: sx + SPINE_W / 2, y: SPINE_Y });
    }

    // Service leaf positions
    var slStartX = (totalW - slGroupW) / 2;
    var slPositions = [];
    for (var sl = 0; sl < 2; sl++) {
        var slx = slStartX + sl * (SL_W + 24);
        slPositions.push({ x: slx, cx: slx + SL_W / 2, y: SL_Y });
    }

    // Rack leaf positions
    var rackStartX = (totalW - rackGroupW) / 2;
    var leafPositions = []; // [{x, cx, y, rack, idx}]
    for (var r = 0; r < rackCount; r++) {
        var rx = rackStartX + r * (2 * LEAF_W + 20 + RACK_PAD);
        for (var li = 0; li < 2; li++) {
            var lx = rx + li * (LEAF_W + 20);
            leafPositions.push({ x: lx, cx: lx + LEAF_W / 2, y: LEAF_Y, rack: r, idx: li });
        }
    }

    // Draw connections: each spine connects to every service leaf and every rack leaf
    // Spine → Service Leafs
    for (var si = 0; si < spinePositions.length; si++) {
        for (var sli = 0; sli < slPositions.length; sli++) {
            svg += '<line x1="' + spinePositions[si].cx + '" y1="' + (SPINE_Y + SPINE_H) + '" x2="' + slPositions[sli].cx + '" y2="' + SL_Y + '" stroke="' + C.LINK_ACTIVE + '" stroke-width="1.5" stroke-dasharray="4,3"/>';
        }
    }
    // Spine → Rack Leafs
    for (var si2 = 0; si2 < spinePositions.length; si2++) {
        for (var li2 = 0; li2 < leafPositions.length; li2++) {
            svg += '<line x1="' + spinePositions[si2].cx + '" y1="' + (SPINE_Y + SPINE_H) + '" x2="' + leafPositions[li2].cx + '" y2="' + LEAF_Y + '" stroke="' + C.LINK + '" stroke-width="1"/>';
        }
    }
    // Service Leafs → Spines already drawn; Service Leafs don't connect to rack leafs

    // Draw spine boxes
    for (var s2 = 0; s2 < spinePositions.length; s2++) {
        var sp = spinePositions[s2];
        svg += '<rect x="' + sp.x + '" y="' + sp.y + '" width="' + SPINE_W + '" height="' + SPINE_H + '" rx="5" fill="' + C.SPINE + '" stroke="#2a8ad4" stroke-width="1.5"/>';
        svg += '<text x="' + sp.cx + '" y="' + (sp.y + 15) + '" text-anchor="middle" fill="white" font-size="11" font-weight="600">Spine ' + (s2 + 1) + '</text>';
        svg += '<text x="' + sp.cx + '" y="' + (sp.y + 28) + '" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="9">ASN 64841</text>';
    }

    // Draw service leaf boxes
    for (var s3 = 0; s3 < slPositions.length; s3++) {
        var slp = slPositions[s3];
        svg += '<rect x="' + slp.x + '" y="' + slp.y + '" width="' + SL_W + '" height="' + SL_H + '" rx="4" fill="' + C.SL + '" stroke="#0d9488" stroke-width="1.5"/>';
        svg += '<text x="' + slp.cx + '" y="' + (slp.y + 13) + '" text-anchor="middle" fill="white" font-size="10" font-weight="600">Service Leaf ' + (s3 === 0 ? 'A' : 'B') + '</text>';
        svg += '<text x="' + slp.cx + '" y="' + (slp.y + 25) + '" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="8">ASN 65005</text>';
    }

    // Draw rack groups and leaf boxes
    for (var r2 = 0; r2 < rackCount; r2++) {
        var asn = 64789 + r2;
        var rackLeafs = leafPositions.filter(function(l) { return l.rack === r2; });
        var groupX = rackLeafs[0].x - 8;
        var groupW = 2 * LEAF_W + 20 + 16;

        // Rack group outline
        svg += '<rect x="' + groupX + '" y="' + (LEAF_Y - 18) + '" width="' + groupW + '" height="' + (LEAF_H + 32) + '" rx="6" fill="none" stroke="' + C.RACK_BORDER + '" stroke-width="1" stroke-dasharray="4,2"/>';
        svg += '<text x="' + (groupX + groupW / 2) + '" y="' + (LEAF_Y - 5) + '" text-anchor="middle" fill="' + C.TEXT_DIM + '" font-size="9">Rack ' + (r2 + 1) + ' (ASN ' + asn + ')</text>';

        for (var li3 = 0; li3 < rackLeafs.length; li3++) {
            var lp = rackLeafs[li3];
            svg += '<rect x="' + lp.x + '" y="' + lp.y + '" width="' + LEAF_W + '" height="' + LEAF_H + '" rx="4" fill="' + C.LEAF + '" stroke="#888" stroke-width="1"/>';
            svg += '<text x="' + lp.cx + '" y="' + (lp.y + 11) + '" text-anchor="middle" fill="white" font-size="9" font-weight="600">Leaf ' + (r2 + 1) + (li3 === 0 ? 'A' : 'B') + '</text>';
            svg += '<text x="' + lp.cx + '" y="' + (lp.y + 22) + '" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="7">Loopback</text>';
        }
    }

    // Legend
    var legY = totalH - 18;
    var legItems = [
        { color: C.SPINE, label: 'Spine' },
        { color: C.SL, label: 'Service Leaf' },
        { color: C.LEAF, label: 'Rack Leaf' }
    ];
    var legStartX = totalW / 2 - legItems.length * 55;
    for (var lg = 0; lg < legItems.length; lg++) {
        var lx2 = legStartX + lg * 110;
        svg += '<rect x="' + lx2 + '" y="' + (legY - 6) + '" width="10" height="10" rx="2" fill="' + legItems[lg].color + '"/>';
        svg += '<text x="' + (lx2 + 14) + '" y="' + (legY + 3) + '" fill="' + C.TEXT_DIM + '" font-size="9">' + legItems[lg].label + '</text>';
    }

    svg += '</svg>';
    container.innerHTML = svg;
}

function renderIpPlanning() {
    var grid = document.getElementById('da7-ip-grid');
    if (!grid) return;

    // Render topology diagram
    renderDisaggTopologyDiagram();

    var rackCount = state.disaggRackCount || 1;
    var confirmed = state.disaggIpConfigConfirmed === true;

    var html = '';
    var disabledAttr = confirmed ? ' disabled' : '';

    // Spine loopbacks
    html += `
        <div style="background: var(--subtle-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px;">
            <h4 style="margin: 0 0 8px 0; color: var(--accent-blue); font-size: 0.9rem;">Spine Loopbacks</h4>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">ASN 64841</p>
            ${Array.from({length: state.disaggSpineCount || 2}, (_, i) => `
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                    <span style="font-size: 0.8rem; color: var(--text-secondary); min-width: 60px;">Spine ${i+1}:</span>
                    <input type="text" value="10.255.0.${i+1}" placeholder="Loopback IP"${disabledAttr}
                        style="flex: 1; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.85rem;">
                </div>
            `).join('')}
        </div>
    `;

    // Service leaf loopbacks
    html += `
        <div style="background: var(--subtle-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px;">
            <h4 style="margin: 0 0 8px 0; color: #14b8a6; font-size: 0.9rem;">Service Leaf Loopbacks</h4>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">ASN 65005</p>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                <span style="font-size: 0.8rem; color: var(--text-secondary); min-width: 80px;">Svc Leaf A:</span>
                <input type="text" value="10.255.1.1" placeholder="Loopback IP"${disabledAttr}
                    style="flex: 1; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.85rem;">
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                <span style="font-size: 0.8rem; color: var(--text-secondary); min-width: 80px;">Svc Leaf B:</span>
                <input type="text" value="10.255.1.2" placeholder="Loopback IP"${disabledAttr}
                    style="flex: 1; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.85rem;">
            </div>
        </div>
    `;

    // Per-rack leaf loopbacks
    for (var r = 0; r < rackCount; r++) {
        var asn = 64789 + r;
        html += `
            <div style="background: var(--subtle-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px;">
                <h4 style="margin: 0 0 8px 0; color: var(--accent-purple); font-size: 0.9rem;">Rack ${r+1} Leaf Loopbacks</h4>
                <p style="margin: 0; color: var(--text-secondary); font-size: 0.85rem;">ASN ${asn}</p>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                    <span style="font-size: 0.8rem; color: var(--text-secondary); min-width: 60px;">Leaf ${r+1}A:</span>
                    <input type="text" value="10.255.${10+r}.1" placeholder="Loopback IP"${disabledAttr}
                        style="flex: 1; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.85rem;">
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                    <span style="font-size: 0.8rem; color: var(--text-secondary); min-width: 60px;">Leaf ${r+1}B:</span>
                    <input type="text" value="10.255.${10+r}.2" placeholder="Loopback IP"${disabledAttr}
                        style="flex: 1; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.85rem;">
                </div>
            </div>
        `;
    }

    grid.innerHTML = html;
    renderDisaggIpConfirmState();
}

function confirmDisaggIpConfig() {
    state.disaggIpConfigConfirmed = true;
    renderIpPlanning();
    if (typeof showToast === 'function') showToast('IP routing configuration confirmed', 'success');
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function editDisaggIpConfig() {
    state.disaggIpConfigConfirmed = false;
    renderIpPlanning();
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function renderDisaggIpConfirmState() {
    var confirmContainer = document.getElementById('da7-confirm-container');
    var confirmedMsg = document.getElementById('da7-confirmed-msg');
    var confirmed = state.disaggIpConfigConfirmed === true;

    if (confirmContainer) confirmContainer.classList.toggle('hidden', confirmed);
    if (confirmedMsg) confirmedMsg.classList.toggle('hidden', !confirmed);

    if (typeof updateBreadcrumbs === 'function') updateBreadcrumbs();
}

// ── Summary & Rack Diagram (DA8) ───────────────────────────────────────────
function renderDisaggSummary() {
    const container = document.getElementById('da8-config-summary');
    if (!container) return;

    const total = (state.disaggRackCount || 0) * (state.disaggNodesPerRack || 0);
    const storageLabels = { fc_san: 'Fibre Channel SAN', iscsi_4nic: 'iSCSI SAN (4-NIC)', iscsi_6nic: 'iSCSI SAN (6-NIC)' };

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
            <div style="background: var(--subtle-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px; text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: var(--accent-purple);">${total}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Nodes</div>
            </div>
            <div style="background: var(--subtle-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px; text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: var(--accent-blue);">${state.disaggRackCount || '—'}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">Racks</div>
            </div>
            <div style="background: var(--subtle-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px; text-align: center;">
                <div style="font-size: 2rem; font-weight: 700; color: #14b8a6;">${state.disaggSpineCount || '—'}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">Spine Switches</div>
            </div>
            <div style="background: var(--subtle-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px; text-align: center;">
                <div style="font-size: 1rem; font-weight: 600; color: var(--accent-purple);">${storageLabels[state.disaggStorageType] || '—'}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">Storage Type</div>
            </div>
            <div style="background: var(--subtle-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px; text-align: center;">
                <div style="font-size: 1rem; font-weight: 600; color: ${state.disaggBackupEnabled ? '#f59e0b' : 'var(--text-secondary)'};">${state.disaggBackupEnabled ? 'Enabled' : 'Disabled'}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">Backup Network</div>
            </div>
        </div>
    `;

    // Generate rack diagram SVG
    generateDisaggRackDiagram();
}

// ── Dynamic Rack Layout SVG Generator ───────────────────────────────────────
function generateDisaggRackDiagram() {
    const container = document.getElementById('da8-rack-diagram');
    if (!container) return;

    const rackCount = state.disaggRackCount || 1;
    const nodesPerRack = state.disaggNodesPerRack || 1;
    const spineCount = state.disaggSpineCount || 2;
    const storageType = state.disaggStorageType || 'fc_san';
    const hasFc = storageType === 'fc_san';

    // Layout constants
    const RACK_W = 220;
    const RACK_GAP = 30;
    const U_H = 14;
    const RACK_US = 42;
    const PAD = { top: 120, left: 40, bottom: 100, right: 40 };

    // Calculate total SVG size
    const totalW = PAD.left + rackCount * RACK_W + (rackCount - 1) * RACK_GAP + PAD.right;
    const innerH = RACK_US * U_H;
    const totalH = PAD.top + innerH + 60 + PAD.bottom + (hasFc ? 60 : 40);

    // Colors
    const C = {
        BG: '#1a1a2e',
        RACK_BG: '#2a2a3a',
        RACK_BORDER: '#444466',
        SPINE: '#1a6fc4',
        SERVICE_LEAF: '#14b8a6',
        LEAF: '#6b7280',
        BMC: '#3b82f6',
        NODE: '#4a4a5a',
        NODE_STROKE: '#666680',
        FC: '#7c3aed',
        SAN: '#9333ea',
        ISCSI: '#f59e0b',
        TEXT: '#e0e0e0',
        TEXT_DIM: '#999',
        DRIVE: '#6a6a7a',
        LED_GREEN: '#22c55e',
        LED_AMBER: '#f59e0b'
    };

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" style="width: 100%; max-width: ${totalW}px; background: ${C.BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">`;

    // Title
    svg += `<text x="${totalW/2}" y="20" text-anchor="middle" fill="${C.TEXT}" font-size="14" font-weight="600">Rack Layout — Front View (Disaggregated, ${hasFc ? 'FC SAN' : storageType === 'iscsi_4nic' ? 'iSCSI 4-NIC' : 'iSCSI 6-NIC'})</text>`;
    svg += `<image href="images/odin-logo.png" x="${totalW - 100}" y="8" width="16" height="16" opacity="0.8"/>`;
    svg += `<text x="${totalW - 80}" y="21" fill="${C.SERVICE_LEAF}" font-size="11" font-weight="500">Azure Local</text>`;

    // ── Spine Layer ──
    const spineW = 150;
    const spineH = 28;
    const spinesGroupW = spineCount * spineW + (spineCount - 1) * 20;
    const spineStartX = (totalW - spinesGroupW) / 2;

    for (let s = 0; s < spineCount; s++) {
        const sx = spineStartX + s * (spineW + 20);
        svg += `<rect x="${sx}" y="35" width="${spineW}" height="${spineH}" rx="4" fill="${C.SPINE}" stroke="#2a8ad4" stroke-width="1"/>`;
        svg += `<text x="${sx + spineW/2}" y="50" text-anchor="middle" fill="white" font-size="10" font-weight="600">Spine ${s+1}</text>`;
        svg += `<text x="${sx + spineW/2}" y="60" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="8">ASN 64841</text>`;
        // Status LEDs
        for (let l = 0; l < 3; l++) {
            svg += `<circle cx="${sx + spineW - 12 + l*5}" cy="41" r="1.5" fill="${C.LED_GREEN}" opacity="0.8"/>`;
        }
    }

    // ── Service Leaf Layer ──
    const slW = 130;
    const slStartX = (totalW - 2 * slW - 20) / 2;
    for (let s = 0; s < 2; s++) {
        const sx = slStartX + s * (slW + 20);
        svg += `<rect x="${sx}" y="72" width="${slW}" height="24" rx="3" fill="${C.SERVICE_LEAF}" stroke="#0d9488" stroke-width="1"/>`;
        svg += `<text x="${sx + slW/2}" y="85" text-anchor="middle" fill="white" font-size="9" font-weight="600">Service Leaf ${s === 0 ? 'A' : 'B'}</text>`;
        svg += `<text x="${sx + slW/2}" y="93" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="7">ASN 65005</text>`;
    }

    // ── Connectors: Spine to Leaves (drawn later after racks) ──
    const rackXPositions = [];

    // ── Racks ──
    const racksStartX = PAD.left;
    for (let r = 0; r < rackCount; r++) {
        const rx = racksStartX + r * (RACK_W + RACK_GAP);
        rackXPositions.push(rx);
        const oy = PAD.top;
        const asn = 64789 + r;

        // Rack label
        svg += `<text x="${rx + RACK_W/2}" y="${oy - 6}" text-anchor="middle" fill="${C.TEXT}" font-size="10" font-weight="600">Rack ${r+1} (ASN ${asn})</text>`;

        // Rack frame
        svg += `<rect x="${rx}" y="${oy}" width="${RACK_W}" height="${innerH + 10}" rx="2" fill="${C.RACK_BG}" stroke="${C.RACK_BORDER}" stroke-width="1" stroke-dasharray="4 2"/>`;

        // Draw device helper
        function drawDev(uStart, heightU, label, color) {
            const pad = 6;
            const w = RACK_W - 2 * pad;
            const dy = oy + pad + innerH - uStart * U_H;
            const h = heightU * U_H - 2;
            svg += `<rect x="${rx + pad}" y="${dy}" width="${w}" height="${h}" rx="2" fill="${color}" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>`;
            svg += `<text x="${rx + RACK_W/2}" y="${dy + h/2 + 3}" text-anchor="middle" fill="white" font-size="8" font-weight="600">${label}</text>`;
            // Status LEDs
            svg += `<circle cx="${rx + RACK_W - pad - 12}" cy="${dy + h/2}" r="2" fill="${C.LED_GREEN}" opacity="0.8"/>`;
            svg += `<circle cx="${rx + RACK_W - pad - 6}" cy="${dy + h/2}" r="2" fill="${C.LED_GREEN}" opacity="0.6"/>`;
            return dy;
        }

        // Leaf-A: U42
        drawDev(42, 1, `Leaf ${r+1}A`, C.LEAF);
        // Leaf-B: U41
        drawDev(41, 1, `Leaf ${r+1}B`, C.LEAF);
        // BMC Switch: U40-U39 (2U for visibility)
        drawDev(40, 2, `BMC Switch ${r+1}`, C.BMC);

        // Server nodes: U38 downward
        for (let n = 0; n < nodesPerRack; n++) {
            const nodeU = 38 - n * 2;
            if (nodeU < 1) break;
            const nodeNum = r * nodesPerRack + n + 1;
            const pad = 6;
            const w = RACK_W - 2 * pad;
            const dy = oy + pad + innerH - nodeU * U_H;
            const h = 2 * U_H - 2;

            svg += `<rect x="${rx + pad}" y="${dy}" width="${w}" height="${h}" rx="2" fill="${C.NODE}" stroke="${C.NODE_STROKE}" stroke-width="0.5"/>`;

            // Node label (centered)
            svg += `<text x="${rx + RACK_W/2}" y="${dy + h/2 + 3}" text-anchor="middle" fill="${C.TEXT}" font-size="8" font-weight="500">Node ${nodeNum}</text>`;

            // Status LEDs (right edge)
            svg += `<circle cx="${rx + RACK_W - pad - 12}" cy="${dy + h/2}" r="2" fill="${C.LED_GREEN}" opacity="0.7"/>`;
            svg += `<circle cx="${rx + RACK_W - pad - 6}" cy="${dy + h/2}" r="2" fill="${C.LED_AMBER}" opacity="0.5"/>`;
        }

        // FC switches at bottom of rack (U2, U1)
        if (hasFc) {
            drawDev(2, 1, `FC Switch ${r+1}A`, C.FC);
            drawDev(1, 1, `FC Switch ${r+1}B`, C.FC);
        }
    }

    // ── Spine-to-Leaf connectors ──
    for (let s = 0; s < spineCount; s++) {
        const sx = spineStartX + s * (spineW + 20) + spineW / 2;
        for (let r = 0; r < rackCount; r++) {
            const lx = rackXPositions[r] + RACK_W / 2;
            svg += `<line x1="${sx}" y1="63" x2="${lx}" y2="${PAD.top + 6}" stroke="#7dd3fc" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.25"/>`;
        }
    }

    // ── Service Leaf-to-Spine connectors ──
    for (let s = 0; s < 2; s++) {
        const slx = slStartX + s * (slW + 20) + slW / 2;
        for (let sp = 0; sp < spineCount; sp++) {
            const spx = spineStartX + sp * (spineW + 20) + spineW / 2;
            svg += `<line x1="${slx}" y1="72" x2="${spx}" y2="63" stroke="#5eead4" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.25"/>`;
        }
    }

    // ── SAN at bottom ──
    const sanY = PAD.top + innerH + 30;
    if (hasFc) {
        const sanW = (totalW - PAD.left - PAD.right - 20) / 2;
        svg += `<rect x="${PAD.left}" y="${sanY}" width="${sanW}" height="36" rx="4" fill="${C.SAN}" opacity="0.9"/>`;
        svg += `<text x="${PAD.left + sanW/2}" y="${sanY + 15}" text-anchor="middle" fill="white" font-size="10" font-weight="600">SAN Storage Array — Fabric A</text>`;
        svg += `<text x="${PAD.left + sanW/2}" y="${sanY + 28}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="8">FC 32G / Connected to FC Switch A in each rack</text>`;

        svg += `<rect x="${PAD.left + sanW + 20}" y="${sanY}" width="${sanW}" height="36" rx="4" fill="${C.SAN}" opacity="0.9"/>`;
        svg += `<text x="${PAD.left + sanW + 20 + sanW/2}" y="${sanY + 15}" text-anchor="middle" fill="white" font-size="10" font-weight="600">SAN Storage Array — Fabric B</text>`;
        svg += `<text x="${PAD.left + sanW + 20 + sanW/2}" y="${sanY + 28}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="8">FC 32G / Connected to FC Switch B in each rack</text>`;

        // FC-to-SAN connectors
        for (let r = 0; r < rackCount; r++) {
            const lx = rackXPositions[r] + RACK_W / 2;
            svg += `<line x1="${lx - 15}" y1="${PAD.top + innerH + 10}" x2="${PAD.left + sanW/2}" y2="${sanY}" stroke="#c4b5fd" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.25"/>`;
            svg += `<line x1="${lx + 15}" y1="${PAD.top + innerH + 10}" x2="${PAD.left + sanW + 20 + sanW/2}" y2="${sanY}" stroke="#c4b5fd" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.25"/>`;
        }
    } else {
        // iSCSI targets
        const sanW = (totalW - PAD.left - PAD.right - 20) / 2;
        svg += `<rect x="${PAD.left}" y="${sanY}" width="${sanW}" height="36" rx="4" fill="${C.ISCSI}" opacity="0.9"/>`;
        svg += `<text x="${PAD.left + sanW/2}" y="${sanY + 15}" text-anchor="middle" fill="white" font-size="10" font-weight="600">iSCSI Storage Target A</text>`;
        svg += `<text x="${PAD.left + sanW/2}" y="${sanY + 28}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="8">VLAN ${state.disaggVlans.iscsiA} / Via Leaf ports</text>`;

        svg += `<rect x="${PAD.left + sanW + 20}" y="${sanY}" width="${sanW}" height="36" rx="4" fill="${C.ISCSI}" opacity="0.9"/>`;
        svg += `<text x="${PAD.left + sanW + 20 + sanW/2}" y="${sanY + 15}" text-anchor="middle" fill="white" font-size="10" font-weight="600">iSCSI Storage Target B</text>`;
        svg += `<text x="${PAD.left + sanW + 20 + sanW/2}" y="${sanY + 28}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="8">VLAN ${state.disaggVlans.iscsiB} / Via Leaf ports</text>`;

        // iSCSI-to-target connectors (through leaf)
        for (let r = 0; r < rackCount; r++) {
            const lx = rackXPositions[r] + RACK_W / 2;
            svg += `<line x1="${lx - 15}" y1="${PAD.top + innerH + 10}" x2="${PAD.left + sanW/2}" y2="${sanY}" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.25"/>`;
            svg += `<line x1="${lx + 15}" y1="${PAD.top + innerH + 10}" x2="${PAD.left + sanW + 20 + sanW/2}" y2="${sanY}" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.25"/>`;
        }
    }

    // ── Legend ──
    const legendY = sanY + 50;
    const legendItems = [
        { color: C.NODE, label: 'Server Node', stroke: C.NODE_STROKE },
        { color: C.LEAF, label: 'Leaf Switch', stroke: '#888' },
        { color: C.BMC, label: 'BMC Switch', stroke: '#60a5fa' },
    ];
    if (hasFc) legendItems.push({ color: C.FC, label: 'FC Switch', stroke: '#9333ea' });
    legendItems.push({ color: C.SPINE, label: 'Spine Switch', stroke: '#2a8ad4' });
    legendItems.push({ color: C.SERVICE_LEAF, label: 'Service Leaf', stroke: '#0d9488' });
    legendItems.push({ color: hasFc ? C.SAN : C.ISCSI, label: hasFc ? 'SAN Storage' : 'iSCSI Target', stroke: hasFc ? '#7c3aed' : '#d97706' });

    const itemW = totalW / legendItems.length;
    legendItems.forEach((item, i) => {
        const ix = i * itemW + itemW / 2;
        svg += `<rect x="${ix - 30}" y="${legendY}" width="12" height="10" rx="2" fill="${item.color}" stroke="${item.stroke}" stroke-width="0.5"/>`;
        svg += `<text x="${ix - 14}" y="${legendY + 8}" fill="${C.TEXT_DIM}" font-size="7">${item.label}</text>`;
    });

    // Summary line
    const uPerRack = 4 + nodesPerRack * 2 + (hasFc ? 2 : 0);
    const totalU = rackCount * uPerRack;
    const totalNodes = rackCount * nodesPerRack;
    svg += `<text x="${totalW/2}" y="${legendY + 22}" text-anchor="middle" fill="${C.TEXT_DIM}" font-size="7">${totalU}U used / ${rackCount * RACK_US}U total | ${totalNodes} nodes | ${rackCount} racks | ${spineCount} spines | ${hasFc ? 'FC SAN' : storageType === 'iscsi_4nic' ? 'iSCSI 4-NIC' : 'iSCSI 6-NIC'}</text>`;

    svg += '</svg>';
    container.innerHTML = svg;
}

function downloadDisaggRackDiagram() {
    const container = document.getElementById('da8-rack-diagram');
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disaggregated-rack-layout-${state.disaggRackCount}racks-${state.disaggNodesPerRack}nodes.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── DA10: NIC / Adapter Configuration ─────────────────────────

// Get all physical NIC slots for the current disaggregated config
function getDisaggNicSlots() {
    const st = state.disaggStorageType;
    const backup = state.disaggBackupEnabled;
    const slots = [];

    // OCP: always present (2 ports)
    slots.push({ key: 'ocp', label: 'OCP (Compute + Management)', ports: 2, defaultSpeed: '25GbE', allowedSpeeds: ['10GbE', '25GbE', '100GbE'] });
    // PCIe1: always present (2 ports) — Cluster (or Cluster+iSCSI in 4-NIC)
    const pcie1Label = st === 'iscsi_4nic' ? 'PCIe1 (Cluster + iSCSI Shared)' : 'PCIe1 (Cluster / CSV / Live Migration)';
    slots.push({ key: 'pcie1', label: pcie1Label, ports: 2, defaultSpeed: '25GbE', allowedSpeeds: ['10GbE', '25GbE', '100GbE'] });
    // PCIe2: 6-NIC iSCSI dedicated (only when no backup)
    if (st === 'iscsi_6nic' && !backup) {
        slots.push({ key: 'pcie2', label: 'PCIe2 (iSCSI Dedicated)', ports: 2, defaultSpeed: '25GbE', allowedSpeeds: ['10GbE', '25GbE', '100GbE'] });
    }
    // PCIe2 as Backup: 6-NIC iSCSI + backup (iSCSI falls back to sharing cluster ports)
    if (st === 'iscsi_6nic' && backup) {
        slots.push({ key: 'pcie2', label: 'PCIe2 (Backup)', ports: 2, defaultSpeed: '25GbE', allowedSpeeds: ['10GbE', '25GbE', '100GbE'] });
    }
    // Backup: FC SAN or iSCSI 4-NIC with backup enabled
    if (backup && st !== 'iscsi_6nic') {
        slots.push({ key: 'backup', label: 'Backup (In-Guest VM Backup)', ports: 2, defaultSpeed: '25GbE', allowedSpeeds: ['10GbE', '25GbE', '100GbE'] });
    }
    // BMC: always (1 port, fixed 1GbE)
    slots.push({ key: 'bmc', label: 'BMC (Out-of-Band Management)', ports: 1, defaultSpeed: '1GbE', allowedSpeeds: ['1GbE'] });

    return slots;
}

// Get all individual physical ports (flattened from slots)
function getDisaggPhysicalPorts() {
    const slots = getDisaggNicSlots();
    const ports = [];
    for (const slot of slots) {
        if (slot.key === 'bmc') {
            ports.push({ id: 'bmc', label: 'BMC', slotKey: 'bmc', slotLabel: slot.label });
            continue;
        }
        for (let p = 1; p <= slot.ports; p++) {
            const portId = slot.key + '_p' + p;
            const leafSide = p === 1 ? 'Leaf-A' : 'Leaf-B';
            ports.push({ id: portId, label: slot.label.split('(')[0].trim() + ' Port ' + p + ' → ' + leafSide, slotKey: slot.key, slotLabel: slot.label });
        }
    }
    return ports;
}

// Initialize default port speeds if not set
function ensureDisaggPortSpeeds() {
    if (!state.disaggPortSpeeds || typeof state.disaggPortSpeeds !== 'object') {
        state.disaggPortSpeeds = {};
    }
    const slots = getDisaggNicSlots();
    for (const slot of slots) {
        if (state.disaggPortSpeeds[slot.key] === undefined) {
            state.disaggPortSpeeds[slot.key] = slot.defaultSpeed;
        }
    }
}

// Initialize default intent mapping if not set
function ensureDisaggIntentMapping() {
    if (!state.disaggIntentMapping || typeof state.disaggIntentMapping !== 'object') {
        state.disaggIntentMapping = {};
    }
    // Default: OCP ports form the Mgmt+Compute SET intent
    if (!state.disaggIntentMapping.mgmt_compute) {
        state.disaggIntentMapping.mgmt_compute = ['ocp_p1', 'ocp_p2'];
    }
}

// Initialize default cluster port-to-VLAN mapping
function ensureDisaggClusterMapping() {
    if (!state.disaggClusterPortMapping || typeof state.disaggClusterPortMapping !== 'object') {
        state.disaggClusterPortMapping = {};
    }
    const vlans = state.disaggVlans || { cluster1: 711, cluster2: 712 };
    if (!state.disaggClusterPortMapping.pcie1_p1) {
        state.disaggClusterPortMapping.pcie1_p1 = String(vlans.cluster1);
    }
    if (!state.disaggClusterPortMapping.pcie1_p2) {
        state.disaggClusterPortMapping.pcie1_p2 = String(vlans.cluster2);
    }
}

function renderDisaggNicConfig() {
    renderDisaggPortCountSelector();
    if (state.disaggPortCount) {
        initDisaggAdapterMapping();
        renderDisaggPortCards();
        renderDisaggAdapterMappingUi();
        renderDisaggOverrides();
        validateDisaggNicConfig();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PORT COUNT SELECTOR (mirrors HCI Step 5 port count cards)
// ═══════════════════════════════════════════════════════════════════════════

function getDisaggPortCountOptions() {
    var st = state.disaggStorageType || 'fc_san';
    var backup = !!state.disaggBackupEnabled;
    var options = [];

    if (st === 'fc_san') {
        if (backup) {
            options.push({ value: 4, label: '4 Ports', desc: 'OCP (2) + Cluster (2). FC HBA handles storage separately.', dots: [5, 9, 15, 19], disabled: true, disabledReason: 'Backup network requires 6 ports' });
            options.push({ value: 6, label: '6 Ports', desc: 'OCP (2) + Cluster (2) + Backup (2). FC HBA handles storage separately.', dots: [6, 10, 14, 6, 10, 14], twoRow: true });
        } else {
            options.push({ value: 4, label: '4 Ports', desc: 'OCP (2) + Cluster (2). FC HBA handles storage separately.', dots: [5, 9, 15, 19] });
            options.push({ value: 6, label: '6 Ports', desc: 'OCP (2) + Cluster (2) + Backup (2). FC HBA handles storage separately.', dots: [6, 10, 14, 6, 10, 14], twoRow: true, disabled: true, disabledReason: 'Enable backup network on step DA2 to use 6 ports' });
        }
    } else if (st === 'iscsi_4nic') {
        if (backup) {
            options.push({ value: 4, label: '4 Ports', desc: 'OCP (2) + Cluster/iSCSI shared (2). Not enough ports for backup.', dots: [5, 9, 15, 19], disabled: true, disabledReason: 'Backup network requires 6 ports' });
            options.push({ value: 6, label: '6 Ports', desc: 'OCP (2) + Cluster/iSCSI shared (2) + Backup (2).', dots: [6, 10, 14, 6, 10, 14], twoRow: true });
        } else {
            options.push({ value: 4, label: '4 Ports', desc: 'OCP (2) + Cluster/iSCSI shared (2). iSCSI shares standalone ports with cluster.', dots: [5, 9, 15, 19] });
            options.push({ value: 6, label: '6 Ports', desc: 'OCP (2) + Cluster/iSCSI shared (2) + Backup (2). Requires backup enabled.', dots: [6, 10, 14, 6, 10, 14], twoRow: true, disabled: true, disabledReason: 'Enable backup network on step DA2 to use 6 ports' });
        }
    } else if (st === 'iscsi_6nic') {
        if (backup) {
            options.push({ value: 6, label: '6 Ports', desc: 'OCP (2) + Cluster/iSCSI shared (2) + Backup (2). iSCSI shares cluster ports.', dots: [6, 10, 14, 6, 10, 14], twoRow: true });
        } else {
            options.push({ value: 6, label: '6 Ports', desc: 'OCP (2) + Cluster (2) + iSCSI dedicated (2).', dots: [6, 10, 14, 6, 10, 14], twoRow: true });
        }
    }

    return options;
}

function renderDisaggPortCountSelector() {
    var grid = document.getElementById('da10-port-count-grid');
    if (!grid) return;
    grid.innerHTML = '';

    var options = getDisaggPortCountOptions();
    var currentCount = state.disaggPortCount;

    // If current selection is no longer valid or disabled, reset it
    var validValues = options.filter(function(o) { return !o.disabled; }).map(function(o) { return o.value; });
    if (currentCount && validValues.indexOf(currentCount) < 0) {
        state.disaggPortCount = null;
        currentCount = null;
        state.disaggPortConfig = {};
        state.disaggPortConfigConfirmed = false;
        state.disaggAdapterMapping = {};
        state.disaggAdapterMappingConfirmed = false;
        state.disaggOverridesConfirmed = false;
    }

    // Auto-select if only one enabled option available
    if (!currentCount && validValues.length === 1) {
        selectDisaggPortCount(validValues[0]);
        return;
    }

    for (var i = 0; i < options.length; i++) {
        var opt = options[i];
        var card = document.createElement('div');
        card.className = 'option-card';
        card.dataset.value = opt.value;
        if (currentCount === opt.value) card.classList.add('selected');
        if (opt.disabled) {
            card.classList.add('disabled');
            card.style.opacity = '0.4';
            card.style.pointerEvents = 'none';
            card.title = opt.disabledReason || 'Not available';
        }

        var svgDots = '';
        if (opt.twoRow) {
            var half = opt.dots.length / 2;
            for (var d = 0; d < half; d++) svgDots += '<circle cx="' + opt.dots[d] + '" cy="9" r="1" fill="currentColor" />';
            for (var d = half; d < opt.dots.length; d++) svgDots += '<circle cx="' + opt.dots[d] + '" cy="15" r="1" fill="currentColor" />';
        } else {
            for (var d = 0; d < opt.dots.length; d++) svgDots += '<circle cx="' + opt.dots[d] + '" cy="12" r="1.5" fill="currentColor" />';
        }

        card.innerHTML =
            '<div class="icon">' +
                '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">' +
                    '<rect x="2" y="' + (opt.twoRow ? '5' : '8') + '" width="20" height="' + (opt.twoRow ? '14' : '8') + '" rx="2" fill="rgba(255, 255, 255, 0.05)" />' +
                    svgDots +
                '</svg>' +
            '</div>' +
            '<h3>' + opt.label + '</h3>' +
            '<p>' + opt.desc + '</p>';

        card.addEventListener('click', (function(val) {
            return function() { selectDisaggPortCount(val); };
        })(opt.value));

        grid.appendChild(card);
    }

    // vNIC mode info banner — no longer used
    var vnicBanner = document.getElementById('da10-vnic-mode-banner');
    if (vnicBanner) {
        vnicBanner.innerHTML = '';
    }

    // Show/hide downstream sections based on port count selection
    var portConfigSection = document.getElementById('da10-port-configuration');
    var intentSection = document.getElementById('da10-intent-section');
    if (portConfigSection) portConfigSection.classList.toggle('visible', !!currentCount);
    if (intentSection) {
        if (currentCount) intentSection.style.display = '';
        else intentSection.style.display = 'none';
    }
}

function selectDisaggPortCount(count) {
    var prev = state.disaggPortCount;
    state.disaggPortCount = count;

    // Reset port config and adapter mapping if count changed
    if (prev !== count) {
        state.disaggPortConfig = {};
        state.disaggPortConfigConfirmed = false;
        state.disaggAdapterMapping = {};
        state.disaggAdapterMappingConfirmed = false;
        state.disaggOverridesConfirmed = false;
    }

    // Re-render everything
    initDisaggAdapterMapping();
    renderDisaggPortCountSelector();
    renderDisaggPortCards();
    renderDisaggAdapterMappingUi();
    renderDisaggOverrides();
    validateDisaggNicConfig();

    if (typeof updateUI === 'function') updateUI();
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

// ═══════════════════════════════════════════════════════════════════════════
// PORT CONFIGURATION (mirrors HCI Step 5 — port-config-card per port)
// ═══════════════════════════════════════════════════════════════════════════

function getDisaggPortList() {
    // Build flat list of all physical ports based on storage type + port count
    var st = state.disaggStorageType || 'fc_san';
    var portCount = state.disaggPortCount || 0;
    var backupEnabled = !!state.disaggBackupEnabled;
    var ports = [];

    if (!portCount) return ports;

    // OCP ports (always present)
    ports.push({ id: 'ocp_p1', slot: 'ocp', label: 'OCP Port 1', defaultName: 'OCP-NIC1', defaultSpeed: '25GbE', rdmaDefault: true, connection: 'Leaf-A' });
    ports.push({ id: 'ocp_p2', slot: 'ocp', label: 'OCP Port 2', defaultName: 'OCP-NIC2', defaultSpeed: '25GbE', rdmaDefault: true, connection: 'Leaf-B' });

    // PCIe1 ports — Cluster (always present)
    ports.push({ id: 'pcie1_p1', slot: 'pcie1', label: 'PCIe1 Port 1', defaultName: 'PCIe1-NIC3', defaultSpeed: '25GbE', rdmaDefault: true, connection: 'Leaf-A' });
    ports.push({ id: 'pcie1_p2', slot: 'pcie1', label: 'PCIe1 Port 2', defaultName: 'PCIe1-NIC4', defaultSpeed: '25GbE', rdmaDefault: true, connection: 'Leaf-B' });

    // PCIe2 ports
    // iSCSI 6-NIC without backup: PCIe2 = dedicated iSCSI
    // iSCSI 6-NIC with backup: PCIe2 = backup (iSCSI shares cluster ports)
    if (st === 'iscsi_6nic') {
        if (backupEnabled) {
            // 6-NIC + backup: PCIe2 is backup compute intent, iSCSI shares cluster
            ports.push({ id: 'pcie2_p1', slot: 'backup', label: 'PCIe2 Port 1 (Backup)', defaultName: 'PCIe2-NIC5', defaultSpeed: '25GbE', rdmaDefault: true, connection: 'Leaf-A' });
            ports.push({ id: 'pcie2_p2', slot: 'backup', label: 'PCIe2 Port 2 (Backup)', defaultName: 'PCIe2-NIC6', defaultSpeed: '25GbE', rdmaDefault: true, connection: 'Leaf-B' });
        } else {
            // 6-NIC no backup: PCIe2 = dedicated iSCSI
            ports.push({ id: 'pcie2_p1', slot: 'pcie2', label: 'PCIe2 Port 1', defaultName: 'PCIe2-NIC5', defaultSpeed: '25GbE', rdmaDefault: true, connection: 'Leaf-A' });
            ports.push({ id: 'pcie2_p2', slot: 'pcie2', label: 'PCIe2 Port 2', defaultName: 'PCIe2-NIC6', defaultSpeed: '25GbE', rdmaDefault: true, connection: 'Leaf-B' });
        }
    }

    // Backup ports — present for FC SAN + backup or iSCSI 4-NIC + backup
    var baseCount = (st === 'iscsi_6nic') ? 6 : 4;
    if (portCount > baseCount && st !== 'iscsi_6nic') {
        ports.push({ id: 'backup_p1', slot: 'backup', label: 'Backup Port 1', defaultName: 'BK-NIC1', defaultSpeed: '25GbE', rdmaDefault: true, connection: 'Leaf-A' });
        ports.push({ id: 'backup_p2', slot: 'backup', label: 'Backup Port 2', defaultName: 'BK-NIC2', defaultSpeed: '25GbE', rdmaDefault: true, connection: 'Leaf-B' });
    }

    // BMC port (always, separate fabric)
    ports.push({ id: 'bmc_p1', slot: 'bmc', label: 'BMC Port', defaultName: 'BMC', defaultSpeed: '1GbE', rdmaDefault: false, connection: 'BMC Switch' });

    return ports;
}

function ensureDisaggPortConfig() {
    var ports = getDisaggPortList();
    if (!state.disaggPortConfig) state.disaggPortConfig = {};
    for (var i = 0; i < ports.length; i++) {
        var p = ports[i];
        if (!state.disaggPortConfig[p.id]) {
            state.disaggPortConfig[p.id] = {
                customName: null,
                speed: p.defaultSpeed,
                rdma: p.rdmaDefault
            };
        }
    }
}

function getDisaggPortDisplayName(port) {
    ensureDisaggPortConfig();
    var cfg = state.disaggPortConfig[port.id];
    if (cfg && cfg.customName && cfg.customName.trim()) return cfg.customName.trim();
    return port.defaultName;
}

function renderDisaggPortCards() {
    var container = document.getElementById('da10-port-config-grid');
    if (!container) return;
    container.innerHTML = '';

    ensureDisaggPortConfig();
    var ports = getDisaggPortList();
    var isPortConfirmed = state.disaggPortConfigConfirmed === true;

    // Check for duplicate names
    var nameCount = {};
    for (var i = 0; i < ports.length; i++) {
        var dn = getDisaggPortDisplayName(ports[i]).toLowerCase();
        nameCount[dn] = (nameCount[dn] || 0) + 1;
    }

    for (var i = 0; i < ports.length; i++) {
        var port = ports[i];
        var cfg = state.disaggPortConfig[port.id];
        var displayName = getDisaggPortDisplayName(port);
        var hasCustom = cfg.customName && cfg.customName.trim();
        var isDuplicate = nameCount[displayName.toLowerCase()] > 1;
        var isBmc = port.slot === 'bmc';

        var borderColor = isDuplicate ? '#ef4444' : (hasCustom ? 'var(--accent-blue)' : 'rgba(255,255,255,0.15)');
        var labelHtml = isDuplicate
            ? '<span style="font-size:10px; color:#ef4444; font-weight:600;">\u26a0 duplicate</span>'
            : (hasCustom ? '<span style="font-size:10px; color:var(--accent-blue); opacity:0.7;">custom</span>' : '');

        var card = document.createElement('div');
        card.className = 'port-config-card' + (cfg.rdma ? ' rdma-active' : '') + (isPortConfirmed ? ' confirmed' : '');

        var speedOptions = isBmc
            ? '<option value="1GbE" selected>1 GbE</option>'
            : '<option value="10GbE"' + (cfg.speed === '10GbE' ? ' selected' : '') + '>10 GbE</option>' +
              '<option value="25GbE"' + (cfg.speed === '25GbE' ? ' selected' : '') + '>25 GbE</option>' +
              '<option value="100GbE"' + (cfg.speed === '100GbE' ? ' selected' : '') + '>100 GbE</option>';

        card.innerHTML =
            '<div class="port-name-row" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">' +
                '<div class="port-name-display" style="display:flex; align-items:center; gap:6px;">' +
                    '<input type="text" class="port-name-input" value="' + displayName.replace(/"/g, '&quot;') + '" ' +
                        'placeholder="' + port.label + '" maxlength="30" ' +
                        (isPortConfirmed ? 'readonly ' : '') +
                        'data-port-id="' + port.id + '" ' +
                        'style="background:' + (isPortConfirmed ? 'transparent' : 'rgba(255,255,255,0.05)') + '; border:1px solid ' + borderColor + '; color:var(--text-primary); font-size:1rem; font-weight:600; padding:4px 8px; border-radius:4px; width:140px; transition:all 0.2s; cursor:' + (isPortConfirmed ? 'default' : 'text') + ';" ' +
                        'onchange="updateDisaggPortConfig(\'' + port.id + '\', \'customName\', this.value);" ' +
                        'title="' + (isDuplicate ? 'Duplicate name' : port.label + ' \u2192 ' + port.connection) + '">' +
                    (cfg.rdma ? '<span style="color:var(--accent-purple); font-size:16px;">\u26a1</span>' : '') +
                '</div>' +
                labelHtml +
            '</div>' +
            '<div class="config-row">' +
                '<span class="config-label">Speed</span>' +
                '<select class="speed-select" onchange="updateDisaggPortConfig(\'' + port.id + '\', \'speed\', this.value)" ' + (isPortConfirmed || isBmc ? 'disabled' : '') + '>' +
                    speedOptions +
                '</select>' +
            '</div>' +
            '<div class="config-row">' +
                '<label class="rdma-check-container">' +
                    '<input type="checkbox" class="rdma-checkbox" ' +
                        (cfg.rdma ? 'checked ' : '') +
                        (isPortConfirmed || isBmc ? 'disabled ' : '') +
                        'onchange="updateDisaggPortConfig(\'' + port.id + '\', \'rdma\', this.checked)">' +
                    '<span class="rdma-label">RDMA Capable</span>' +
                '</label>' +
            '</div>' +
            '<div style="margin-top:6px; font-size:0.75rem; color:var(--text-secondary);">' +
                port.label + ' \u2192 ' + port.connection +
            '</div>';

        container.appendChild(card);
    }

    // Show/hide confirm controls
    var confirmContainer = document.getElementById('da10-port-config-confirm-container');
    var confirmedMsg = document.getElementById('da10-port-config-confirmed-msg');
    if (confirmContainer && confirmedMsg) {
        if (isPortConfirmed) {
            confirmContainer.classList.add('hidden');
            confirmedMsg.classList.remove('hidden');
        } else {
            confirmContainer.classList.remove('hidden');
            confirmedMsg.classList.add('hidden');
        }
    }
}

function updateDisaggPortConfig(portId, key, value) {
    ensureDisaggPortConfig();
    if (!state.disaggPortConfig[portId]) return;

    if (key === 'customName') {
        var trimmed = String(value || '').trim();
        state.disaggPortConfig[portId].customName = trimmed || null;
        renderDisaggPortCards();
    } else {
        state.disaggPortConfig[portId][key] = value;
    }
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function confirmDisaggPortConfig() {
    state.disaggPortConfigConfirmed = true;
    renderDisaggPortCards();
    renderDisaggAdapterMappingUi();
    if (typeof showToast === 'function') showToast('Port configuration confirmed', 'success');
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function editDisaggPortConfig() {
    state.disaggPortConfigConfirmed = false;
    state.disaggAdapterMappingConfirmed = false;
    renderDisaggPortCards();
    renderDisaggAdapterMappingUi();
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTER MAPPING (mirrors HCI Step 6 — drag & drop pills to intent zones)
// ═══════════════════════════════════════════════════════════════════════════

var _disaggSelectedPill = null;

function getDisaggIntentZones() {
    var st = state.disaggStorageType || 'fc_san';
    var backup = state.disaggBackupEnabled;
    var vlans = state.disaggVlans || {};

    var zones = [];

    // Management + Compute — blue, same as HCI
    zones.push({
        key: 'mgmt_compute',
        title: 'Management + Compute',
        description: 'Trunk ports, VLAN ' + (vlans.mgmt || 7) + ' native + tenant VLANs. Requires at least 2 adapters.',
        titleClass: 'mgmt',
        cardClass: 'zone-mgmt',
        minAdapters: 2,
        requiresRdma: false
    });

    // Cluster Network 1 — Standalone, 1 NIC to Leaf-A
    zones.push({
        key: 'cluster_1',
        title: 'Cluster Network 1 (VLAN ' + (vlans.cluster1 || 711) + ')',
        description: 'Access port to Leaf-A. One standalone NIC, no SET teaming.',
        titleClass: 'compute',
        cardClass: 'zone-cluster',
        minAdapters: 1,
        maxAdapters: 1,
        requiresRdma: false
    });

    // Cluster Network 2 — Standalone, 1 NIC to Leaf-B
    zones.push({
        key: 'cluster_2',
        title: 'Cluster Network 2 (VLAN ' + (vlans.cluster2 || 712) + ')',
        description: 'Access port to Leaf-B. One standalone NIC, no SET teaming.',
        titleClass: 'compute',
        cardClass: 'zone-cluster',
        minAdapters: 1,
        maxAdapters: 1,
        requiresRdma: false
    });

    // iSCSI zones: only show dedicated iSCSI zones for 6-NIC without backup
    if (st === 'iscsi_6nic' && !backup) {
        // 6-NIC no backup: separate physical iSCSI intent zones with own VLANs
        zones.push({
            key: 'iscsi_a',
            title: 'iSCSI Storage A (VLAN ' + (vlans.iscsiA || 500) + ')',
            description: 'Access port to Leaf-A. Dedicated iSCSI NIC, MTU 9216, MPIO.',
            titleClass: 'storage',
            cardClass: 'zone-storage',
            minAdapters: 1,
            maxAdapters: 1,
            requiresRdma: false
        });
        zones.push({
            key: 'iscsi_b',
            title: 'iSCSI Storage B (VLAN ' + (vlans.iscsiB || 600) + ')',
            description: 'Access port to Leaf-B. Dedicated iSCSI NIC, MTU 9216, MPIO.',
            titleClass: 'storage',
            cardClass: 'zone-storage',
            minAdapters: 1,
            maxAdapters: 1,
            requiresRdma: false
        });
    }
    // For iSCSI 4-NIC (any) or iSCSI 6-NIC + backup: iSCSI shares cluster ports/VLAN
    // No separate iSCSI zones needed — traffic flows on the same cluster standalone NICs

    // Compute Intent for In-Guest Backup Network — orange
    if (backup) {
        zones.push({
            key: 'backup',
            title: 'Compute Intent for In-Guest Backup Network',
            description: 'In-guest VM backup traffic over network, VLAN ' + (vlans.backup || 800) + '. SET team for redundancy.',
            titleClass: 'backup',
            cardClass: 'zone-backup',
            minAdapters: 2,
            requiresRdma: false
        });
    }

    return zones;
}

function getDisaggDefaultMapping() {
    var st = state.disaggStorageType || 'fc_san';
    var backup = state.disaggBackupEnabled;
    var mapping = {};

    mapping['ocp_p1'] = 'mgmt_compute';
    mapping['ocp_p2'] = 'mgmt_compute';
    mapping['pcie1_p1'] = 'cluster_1';
    mapping['pcie1_p2'] = 'cluster_2';

    if (st === 'iscsi_6nic' && !backup) {
        // Dedicated iSCSI on PCIe2
        mapping['pcie2_p1'] = 'iscsi_a';
        mapping['pcie2_p2'] = 'iscsi_b';
    } else if (st === 'iscsi_6nic' && backup) {
        // iSCSI shares cluster ports; PCIe2 used for backup
        mapping['pcie2_p1'] = 'backup';
        mapping['pcie2_p2'] = 'backup';
    }
    if (backup && st !== 'iscsi_6nic') {
        // FC SAN or iSCSI 4-NIC: separate backup ports
        mapping['backup_p1'] = 'backup';
        mapping['backup_p2'] = 'backup';
    }

    mapping['bmc_p1'] = 'pool'; // BMC stays in pool (separate fabric, no intent)

    return mapping;
}

function initDisaggAdapterMapping() {
    ensureDisaggPortConfig();
    if (!state.disaggAdapterMapping || Object.keys(state.disaggAdapterMapping).length === 0) {
        state.disaggAdapterMapping = getDisaggDefaultMapping();
        state.disaggAdapterMappingConfirmed = false;
    }
}

function renderDisaggAdapterMappingUi() {
    var container = document.getElementById('da10-adapter-mapping-container');
    if (!container) return;

    var ports = getDisaggPortList();
    if (ports.length === 0) { container.classList.remove('visible'); return; }

    // Only show adapter mapping after port config is confirmed
    if (!state.disaggPortConfigConfirmed) { container.classList.remove('visible'); return; }

    container.classList.add('visible');
    initDisaggAdapterMapping();
    var confirmed = Boolean(state.disaggAdapterMappingConfirmed);
    container.classList.toggle('is-locked', confirmed);

    // Render pool
    renderDisaggAdapterPool(ports, confirmed);

    // Render intent zones
    renderDisaggIntentZones(ports, confirmed);

    // Update buttons
    updateDisaggAdapterMappingButtons(confirmed);

    // Validate
    validateDisaggAdapterMapping(ports);
}

function buildDisaggAdapterPill(port, confirmed) {
    var displayName = getDisaggPortDisplayName(port);
    var cfg = state.disaggPortConfig[port.id] || {};
    var pill = document.createElement('div');
    pill.className = 'adapter-pill';
    if (confirmed) pill.classList.add('is-locked');
    pill.dataset.portId = port.id;
    pill.setAttribute('draggable', confirmed ? 'false' : 'true');

    pill.innerHTML =
        '<span class="adapter-pill-name">' + displayName + '</span>' +
        '<span class="adapter-pill-speed">' + (cfg.speed || '25GbE') + '</span>' +
        (cfg.rdma ? '<span class="adapter-pill-rdma" title="RDMA Capable">\u26a1</span>' : '');

    if (!confirmed) {
        pill.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', port.id);
            pill.classList.add('dragging');
        });
        pill.addEventListener('dragend', function() {
            pill.classList.remove('dragging');
        });
        pill.addEventListener('click', function() {
            if (_disaggSelectedPill === port.id) {
                _disaggSelectedPill = null;
                document.querySelectorAll('#da10-adapter-mapping-container .adapter-pill').forEach(function(p) { p.classList.remove('selected'); });
            } else {
                _disaggSelectedPill = port.id;
                document.querySelectorAll('#da10-adapter-mapping-container .adapter-pill').forEach(function(p) { p.classList.remove('selected'); });
                pill.classList.add('selected');
            }
        });
    }
    return pill;
}

function renderDisaggAdapterPool(ports, confirmed) {
    var poolDrop = document.getElementById('da10-adapter-pool-drop');
    if (!poolDrop) return;
    poolDrop.innerHTML = '';

    var poolPorts = ports.filter(function(p) {
        return state.disaggAdapterMapping[p.id] === 'pool' || !state.disaggAdapterMapping[p.id];
    });

    if (poolPorts.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'adapter-empty';
        empty.textContent = 'All adapters assigned.';
        poolDrop.appendChild(empty);
    } else {
        poolPorts.forEach(function(p) { poolDrop.appendChild(buildDisaggAdapterPill(p, confirmed)); });
    }

    setDisaggDropHandlers(poolDrop, 'pool', confirmed);
}

function renderDisaggIntentZones(ports, confirmed) {
    var grid = document.getElementById('da10-intent-zones-grid');
    if (!grid) return;
    grid.innerHTML = '';

    var zones = getDisaggIntentZones();

    zones.forEach(function(zone) {
        var card = document.createElement('div');
        card.className = 'intent-zone-card' + (zone.cardClass ? ' ' + zone.cardClass : '');
        card.dataset.zone = zone.key;

        var assigned = ports.filter(function(p) { return state.disaggAdapterMapping[p.id] === zone.key; });
        var meetsMin = assigned.length >= zone.minAdapters;

        if (assigned.length > 0) card.classList.add('has-adapters');
        if (meetsMin && assigned.length > 0) card.classList.add('is-complete');

        card.innerHTML =
            '<div class="intent-zone-header">' +
                '<span class="intent-zone-title ' + zone.titleClass + '">' + zone.title + '</span>' +
            '</div>' +
            '<div class="intent-zone-desc">' + zone.description + '</div>' +
            '<div id="da10-zone-drop-' + zone.key + '" class="intent-zone-drop" data-zone="' + zone.key + '"></div>' +
            (zone.minAdapters > 0 ? '<div class="intent-zone-min ' + (meetsMin ? 'met' : 'not-met') + '">' +
                (meetsMin ? '' : '! ') + 'Minimum: ' + zone.minAdapters + ' adapter(s)</div>' : '');

        grid.appendChild(card);

        var drop = document.getElementById('da10-zone-drop-' + zone.key);
        if (drop) {
            assigned.forEach(function(p) { drop.appendChild(buildDisaggAdapterPill(p, confirmed)); });
            if (assigned.length === 0) {
                var hint = document.createElement('div');
                hint.className = 'adapter-empty';
                hint.textContent = 'Drop adapters here';
                drop.appendChild(hint);
            }
            setDisaggDropHandlers(drop, zone.key, confirmed);
        }
    });
}

function setDisaggDropHandlers(el, zoneKey, confirmed) {
    if (confirmed) return;

    el.addEventListener('dragover', function(e) {
        e.preventDefault();
        el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', function() {
        el.classList.remove('drag-over');
    });
    el.addEventListener('drop', function(e) {
        e.preventDefault();
        el.classList.remove('drag-over');
        var portId = e.dataTransfer.getData('text/plain');
        if (portId) moveDisaggAdapter(portId, zoneKey);
    });
    el.addEventListener('click', function(e) {
        if (_disaggSelectedPill && !e.target.closest('.adapter-pill')) {
            moveDisaggAdapter(_disaggSelectedPill, zoneKey);
            _disaggSelectedPill = null;
        }
    });
}

function moveDisaggAdapter(portId, targetZone) {
    if (!state.disaggAdapterMapping) return;

    // Enforce maxAdapters — don't allow dropping into a full zone
    if (targetZone !== 'pool') {
        var zones = getDisaggIntentZones();
        var zone = null;
        for (var z = 0; z < zones.length; z++) {
            if (zones[z].key === targetZone) { zone = zones[z]; break; }
        }
        if (zone && zone.maxAdapters) {
            var ports = getDisaggPortList();
            var currentCount = ports.filter(function(p) { return state.disaggAdapterMapping[p.id] === targetZone && p.id !== portId; }).length;
            if (currentCount >= zone.maxAdapters) {
                if (typeof showToast === 'function') showToast(zone.title + ' accepts only ' + zone.maxAdapters + ' adapter', 'error');
                return;
            }
        }
    }

    state.disaggAdapterMapping[portId] = targetZone;
    renderDisaggAdapterMappingUi();
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function updateDisaggAdapterMappingButtons(confirmed) {
    var confirmBtn = document.getElementById('da10-adapter-mapping-confirm-btn');
    var resetBtn = document.getElementById('da10-adapter-mapping-reset-btn');
    var statusEl = document.getElementById('da10-adapter-mapping-status');

    if (confirmBtn) confirmBtn.style.display = confirmed ? 'none' : '';
    if (resetBtn) resetBtn.style.display = confirmed ? 'none' : '';
    if (statusEl) {
        if (confirmed) {
            statusEl.innerHTML = '<span style="color:var(--accent-green); font-weight:600;">\u2713 Adapter mapping confirmed</span>' +
                ' <button style="margin-left:0.75rem; background:transparent; border:1px solid var(--text-secondary); color:var(--text-secondary); padding:4px 12px; border-radius:4px; cursor:pointer; font-size:0.85rem;" onclick="editDisaggAdapterMapping()">Edit</button>';
        } else {
            statusEl.textContent = '';
        }
    }
}

function confirmDisaggAdapterMapping() {
    state.disaggAdapterMappingConfirmed = true;
    renderDisaggAdapterMappingUi();
    renderDisaggOverrides();
    if (typeof showToast === 'function') showToast('Adapter mapping confirmed', 'success');
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function editDisaggAdapterMapping() {
    state.disaggAdapterMappingConfirmed = false;
    state.disaggOverridesConfirmed = false;
    renderDisaggAdapterMappingUi();
    renderDisaggOverrides();
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function resetDisaggAdapterMapping() {
    state.disaggAdapterMapping = getDisaggDefaultMapping();
    state.disaggAdapterMappingConfirmed = false;
    state.disaggOverridesConfirmed = false;
    renderDisaggAdapterMappingUi();
    renderDisaggOverrides();
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function validateDisaggAdapterMapping(ports) {
    var validationEl = document.getElementById('da10-adapter-mapping-validation');
    if (!validationEl) return;

    var errors = [];
    var zones = getDisaggIntentZones();

    zones.forEach(function(zone) {
        var count = ports.filter(function(p) { return state.disaggAdapterMapping[p.id] === zone.key; }).length;
        if (zone.minAdapters > 0 && count < zone.minAdapters) {
            errors.push(zone.title + ' needs at least ' + zone.minAdapters + ' adapter(s)');
        }
        if (zone.maxAdapters && count > zone.maxAdapters) {
            errors.push(zone.title + ' accepts at most ' + zone.maxAdapters + ' adapter(s), has ' + count);
        }
    });

    if (errors.length > 0) {
        validationEl.innerHTML = '<strong>\u26a0 Mapping Issues</strong><ul style="margin:0.5rem 0 0 1.2rem; padding:0;">' +
            errors.map(function(e) { return '<li>' + e + '</li>'; }).join('') + '</ul>';
        validationEl.classList.remove('hidden');
    } else {
        validationEl.classList.add('hidden');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERRIDES (mirrors HCI intent-overrides — VLAN, Subnet, RDMA, Jumbo, SR-IOV per network)
// ═══════════════════════════════════════════════════════════════════════════

function ensureDisaggIntentOverrides() {
    if (!state.disaggIntentOverrides || typeof state.disaggIntentOverrides !== 'object') {
        state.disaggIntentOverrides = {};
    }
    // Defaults for Management + Compute
    if (!state.disaggIntentOverrides.mgmt_compute) {
        state.disaggIntentOverrides.mgmt_compute = { rdmaMode: 'Disabled', jumboFrames: '1514', enableIov: '' };
    }
    // Defaults for Backup (compute intent)
    if (!state.disaggIntentOverrides.backup) {
        state.disaggIntentOverrides.backup = { rdmaMode: 'Disabled', jumboFrames: '1514', enableIov: '' };
    }
}

function renderDisaggOverrides() {
    var overridesSection = document.getElementById('da10-intent-overrides');
    var container = document.getElementById('da10-intent-overrides-container');
    if (!overridesSection || !container) return;

    // Only show after adapter mapping is confirmed
    if (!state.disaggAdapterMappingConfirmed) {
        overridesSection.classList.add('hidden');
        return;
    }
    overridesSection.classList.remove('hidden');
    ensureDisaggIntentOverrides();

    var confirmed = state.disaggOverridesConfirmed === true;
    var vlans = state.disaggVlans || {};
    var subnets = state.disaggSubnets || {};
    var st = state.disaggStorageType || 'fc_san';
    var backup = state.disaggBackupEnabled;
    var intOv = state.disaggIntentOverrides || {};
    var mgmtOv = intOv.mgmt_compute || {};
    var backupOv = intOv.backup || {};

    var rdmaOptions = ['RoCE', 'RoCEv2', 'iWarp', 'Disabled'];
    var jumboOptions = ['1514', '4088', '9014'];
    var sriovOptions = [
        { value: '', label: 'Enabled' },
        { value: 'false', label: 'Disabled' }
    ];

    function renderSelect(groupKey, key, options, currentValue, isDisabled) {
        var dis = (confirmed || isDisabled) ? 'disabled' : '';
        var html = '<select class="speed-select" ' + dis + ' onchange="updateDisaggIntentOverride(\'' + groupKey + '\', \'' + key + '\', this.value)">';
        for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            var val = typeof opt === 'object' ? opt.value : opt;
            var label = typeof opt === 'object' ? opt.label : opt;
            var sel = String(currentValue) === String(val) ? 'selected' : '';
            html += '<option value="' + val + '" ' + sel + '>' + label + '</option>';
        }
        html += '</select>';
        return html;
    }

    function renderInput(networkKey, fieldId, value, placeholder, type, isReadonly) {
        var ro = isReadonly ? 'readonly' : '';
        var bg = isReadonly ? 'transparent' : 'var(--subtle-bg)';
        return '<input type="' + type + '" value="' + String(value).replace(/"/g, '&quot;') + '" ' +
            (placeholder ? 'placeholder="' + placeholder + '" ' : '') + ro + ' ' +
            'oninput="updateDisaggOverride(\'' + networkKey + '\', \'' + fieldId + '\', this.value)" ' +
            'style="width: 100%; padding: 6px 10px; background: ' + bg + '; border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-size: 0.9rem;">';
    }

    // Check if RDMA is enabled on any OCP port (for mgmt+compute intent)
    var ports = getDisaggPortList();
    var mgmtRdma = ports.some(function(p) {
        return (p.id === 'ocp1' || p.id === 'ocp2') && state.disaggPortConfig && state.disaggPortConfig[p.id] && state.disaggPortConfig[p.id].rdma;
    });
    var backupRdma = ports.some(function(p) {
        return (p.id === 'bk1' || p.id === 'bk2') && state.disaggPortConfig && state.disaggPortConfig[p.id] && state.disaggPortConfig[p.id].rdma;
    });

    // If no RDMA on ports, force disabled
    if (!mgmtRdma && mgmtOv.rdmaMode !== 'Disabled') { mgmtOv.rdmaMode = 'Disabled'; }
    if (!backupRdma && backupOv.rdmaMode !== 'Disabled') { backupOv.rdmaMode = 'Disabled'; }

    var html = '';

    // ── Management + Compute Intent Overrides ──
    var mgmtNicHint = 'OCP NICs (SET Team)';
    html += '<div class="override-card" style="padding: 12px; border: 1px solid #3b82f640; border-left: 4px solid #3b82f6; border-radius: 6px; background: #3b82f608; margin-bottom: 12px; min-width: 0; overflow: hidden;">';
    html += '<h5 style="margin: 0 0 8px 0;"><span style="color: #3b82f6;">Management + Compute</span> <span class="override-hint" style="font-size:0.8rem; color:var(--text-secondary); margin-left:8px;">' + mgmtNicHint + '</span></h5>';
    html += '<div class="config-row" style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">';
    html += '<span class="config-label" style="min-width:120px;">RDMA</span>';
    html += renderSelect('mgmt_compute', 'rdmaMode', rdmaOptions, mgmtOv.rdmaMode || 'Disabled', !mgmtRdma);
    html += '</div>';
    html += '<div class="config-row" style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">';
    html += '<span class="config-label" style="min-width:120px;">Jumbo Frames</span>';
    html += renderSelect('mgmt_compute', 'jumboFrames', jumboOptions, mgmtOv.jumboFrames || '1514', false);
    html += '</div>';
    html += '<div class="config-row" style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">';
    html += '<span class="config-label" style="min-width:120px;">SR-IOV</span>';
    html += renderSelect('mgmt_compute', 'enableIov', sriovOptions, mgmtOv.enableIov || '', false);
    html += '</div>';
    html += '</div>';

    // ── Cluster Network Overrides (VLAN + Subnet) ──
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px;">';
    html += '<div style="padding: 12px; border: 1px solid #22c55e40; border-left: 4px solid #22c55e; border-radius: 6px; background: #22c55e08; min-width: 0; overflow: hidden;">';
    html += '<h5 style="margin: 0 0 8px 0; color: #22c55e;">Cluster Network 1 (Standalone)</h5>';
    html += '<div style="margin-bottom:6px;"><label style="display:block; margin-bottom:4px; font-size:0.82rem; color:var(--text-secondary);">VLAN</label>';
    html += renderInput('cluster1', 'cluster1_vlan', vlans.cluster1 || 711, '', 'number', confirmed);
    html += '</div><div><label style="display:block; margin-bottom:4px; font-size:0.82rem; color:var(--text-secondary);">Subnet (CIDR)</label>';
    html += renderInput('cluster1', 'cluster1_subnet', subnets.cluster1 || '', '10.71.1.0/24', 'text', confirmed);
    html += '</div></div>';

    html += '<div style="padding: 12px; border: 1px solid #22c55e40; border-left: 4px solid #22c55e; border-radius: 6px; background: #22c55e08; min-width: 0; overflow: hidden;">';
    html += '<h5 style="margin: 0 0 8px 0; color: #22c55e;">Cluster Network 2 (Standalone)</h5>';
    html += '<div style="margin-bottom:6px;"><label style="display:block; margin-bottom:4px; font-size:0.82rem; color:var(--text-secondary);">VLAN</label>';
    html += renderInput('cluster2', 'cluster2_vlan', vlans.cluster2 || 712, '', 'number', confirmed);
    html += '</div><div><label style="display:block; margin-bottom:4px; font-size:0.82rem; color:var(--text-secondary);">Subnet (CIDR)</label>';
    html += renderInput('cluster2', 'cluster2_subnet', subnets.cluster2 || '', '10.71.2.0/24', 'text', confirmed);
    html += '</div></div>';
    html += '</div>';

    // ── iSCSI Overrides — only for dedicated iSCSI (6-NIC without backup) ──
    if (st === 'iscsi_6nic' && !backup) {
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px;">';
        html += '<div style="padding: 12px; border: 1px solid #8b5cf640; border-left: 4px solid #8b5cf6; border-radius: 6px; background: #8b5cf608; min-width: 0; overflow: hidden;">';
        html += '<h5 style="margin: 0 0 8px 0; color: #8b5cf6;">iSCSI Network A (Standalone)</h5>';
        html += '<div style="margin-bottom:6px;"><label style="display:block; margin-bottom:4px; font-size:0.82rem; color:var(--text-secondary);">VLAN</label>';
        html += renderInput('iscsiA', 'iscsiA_vlan', vlans.iscsiA || 500, '', 'number', confirmed);
        html += '</div><div><label style="display:block; margin-bottom:4px; font-size:0.82rem; color:var(--text-secondary);">Subnet (CIDR)</label>';
        html += renderInput('iscsiA', 'iscsiA_subnet', subnets.iscsiA || '', '10.50.1.0/24', 'text', confirmed);
        html += '</div></div>';

        html += '<div style="padding: 12px; border: 1px solid #8b5cf640; border-left: 4px solid #8b5cf6; border-radius: 6px; background: #8b5cf608; min-width: 0; overflow: hidden;">';
        html += '<h5 style="margin: 0 0 8px 0; color: #8b5cf6;">iSCSI Network B (Standalone)</h5>';
        html += '<div style="margin-bottom:6px;"><label style="display:block; margin-bottom:4px; font-size:0.82rem; color:var(--text-secondary);">VLAN</label>';
        html += renderInput('iscsiB', 'iscsiB_vlan', vlans.iscsiB || 600, '', 'number', confirmed);
        html += '</div><div><label style="display:block; margin-bottom:4px; font-size:0.82rem; color:var(--text-secondary);">Subnet (CIDR)</label>';
        html += renderInput('iscsiB', 'iscsiB_subnet', subnets.iscsiB || '', '10.60.1.0/24', 'text', confirmed);
        html += '</div></div>';
        html += '</div>';
    }

    // ── Backup / Compute Intent Overrides (RDMA, Jumbo, SR-IOV only — no VLAN/Subnet for Compute Intents) ──
    if (backup) {
        var bkNicHint = 'Backup NICs (SET Team)';
        html += '<div class="override-card" style="padding: 12px; border: 1px solid #f9731640; border-left: 4px solid #f97316; border-radius: 6px; background: #f9731608; margin-bottom: 12px; min-width: 0; overflow: hidden;">';
        html += '<h5 style="margin: 0 0 8px 0; display:flex; flex-wrap:wrap; gap:6px;"><span style="color: #f97316;">Compute Intent for In-Guest Backup Network</span> <span class="override-hint" style="font-size:0.8rem; color:var(--text-secondary);">' + bkNicHint + '</span></h5>';
        html += '<div class="config-row" style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">';
        html += '<span class="config-label" style="min-width:120px;">RDMA</span>';
        html += renderSelect('backup', 'rdmaMode', rdmaOptions, backupOv.rdmaMode || 'Disabled', !backupRdma);
        html += '</div>';
        html += '<div class="config-row" style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">';
        html += '<span class="config-label" style="min-width:120px;">Jumbo Frames</span>';
        html += renderSelect('backup', 'jumboFrames', jumboOptions, backupOv.jumboFrames || '1514', false);
        html += '</div>';
        html += '<div class="config-row" style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">';
        html += '<span class="config-label" style="min-width:120px;">SR-IOV</span>';
        html += renderSelect('backup', 'enableIov', sriovOptions, backupOv.enableIov || '', false);
        html += '</div>';
        html += '</div>';
    }

    container.innerHTML = html;

    // Update confirm state
    var confirmBtn = document.getElementById('da10-overrides-confirm-btn');
    var statusEl = document.getElementById('da10-overrides-status');
    if (confirmBtn) confirmBtn.style.display = confirmed ? 'none' : '';
    if (statusEl) {
        if (confirmed) {
            statusEl.innerHTML = '<span style="color:var(--accent-green); font-weight:600;">\u2713 Overrides confirmed</span>' +
                ' <button style="margin-left:0.75rem; background:transparent; border:1px solid var(--text-secondary); color:var(--text-secondary); padding:4px 12px; border-radius:4px; cursor:pointer; font-size:0.85rem;" onclick="editDisaggOverrides()">Edit</button>';
        } else {
            statusEl.textContent = 'Configure network overrides for each intent and standalone network.';
        }
    }
}

function updateDisaggIntentOverride(groupKey, key, value) {
    ensureDisaggIntentOverrides();
    if (!state.disaggIntentOverrides[groupKey]) state.disaggIntentOverrides[groupKey] = {};
    state.disaggIntentOverrides[groupKey][key] = value;
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function updateDisaggOverride(networkKey, fieldId, value) {
    // Parse fieldId: e.g. "cluster1_vlan" -> target = vlans, key = cluster1
    var parts = fieldId.split('_');
    var type = parts[parts.length - 1]; // 'vlan' or 'subnet'
    var netKey = parts.slice(0, parts.length - 1).join('_'); // 'cluster1', 'iscsiA', 'backup'

    if (type === 'vlan') {
        if (!state.disaggVlans) state.disaggVlans = {};
        state.disaggVlans[netKey] = parseInt(value) || 0;
    } else if (type === 'subnet') {
        if (!state.disaggSubnets) state.disaggSubnets = {};
        state.disaggSubnets[netKey] = value.trim();
        validateDisaggSubnets();
    }
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function validateDisaggSubnets() {
    var subnets = state.disaggSubnets || {};
    var st = state.disaggStorageType || 'fc_san';
    var backup = !!state.disaggBackupEnabled;
    var hasDedicatedIscsi = (st === 'iscsi_6nic' && !backup);

    // Collect all active subnet keys and their values
    var entries = [
        { key: 'cluster1', label: 'Cluster 1' },
        { key: 'cluster2', label: 'Cluster 2' }
    ];
    if (hasDedicatedIscsi) {
        entries.push({ key: 'iscsiA', label: 'iSCSI A' });
        entries.push({ key: 'iscsiB', label: 'iSCSI B' });
    }

    // Find duplicates — compare each pair
    var conflicts = {};
    for (var i = 0; i < entries.length; i++) {
        var valI = (subnets[entries[i].key] || '').trim();
        if (!valI) continue;
        for (var j = i + 1; j < entries.length; j++) {
            var valJ = (subnets[entries[j].key] || '').trim();
            if (!valJ) continue;
            if (valI === valJ) {
                conflicts[entries[i].key] = true;
                conflicts[entries[j].key] = true;
            }
        }
    }

    // Apply/remove error styling on subnet inputs
    var allKeys = ['cluster1', 'cluster2', 'iscsiA', 'iscsiB'];
    for (var k = 0; k < allKeys.length; k++) {
        var fieldId = allKeys[k] + '_subnet';
        var inputs = document.querySelectorAll('input[oninput*="' + fieldId + '"]');
        for (var m = 0; m < inputs.length; m++) {
            var inp = inputs[m];
            if (conflicts[allKeys[k]]) {
                inp.style.borderColor = '#ef4444';
                inp.style.boxShadow = '0 0 0 1px #ef444480';
                // Add or update error hint after input
                var hintId = 'subnet-err-' + allKeys[k];
                var hint = document.getElementById(hintId);
                if (!hint) {
                    hint = document.createElement('div');
                    hint.id = hintId;
                    hint.style.cssText = 'color:#ef4444; font-size:0.78rem; margin-top:2px;';
                    inp.parentNode.appendChild(hint);
                }
                hint.textContent = 'Subnet must be unique across all standalone networks';
            } else {
                inp.style.borderColor = '';
                inp.style.boxShadow = '';
                var hintId = 'subnet-err-' + allKeys[k];
                var hint = document.getElementById(hintId);
                if (hint) hint.remove();
            }
        }
    }
}

function confirmDisaggOverrides() {
    // Block confirm if there are duplicate subnets
    if (document.querySelector('[id^="subnet-err-"]')) {
        if (typeof showToast === 'function') showToast('Fix duplicate subnets before confirming', 'error');
        return;
    }

    // Validate required fields are not empty
    var vlans = state.disaggVlans || {};
    var subnets = state.disaggSubnets || {};
    var st = state.disaggStorageType || 'fc_san';
    var backup = !!state.disaggBackupEnabled;
    var hasDedicatedIscsi = (st === 'iscsi_6nic' && !backup);
    var missing = [];

    if (!vlans.cluster1) missing.push('Cluster 1 VLAN');
    if (!(subnets.cluster1 || '').trim()) missing.push('Cluster 1 Subnet');
    if (!vlans.cluster2) missing.push('Cluster 2 VLAN');
    if (!(subnets.cluster2 || '').trim()) missing.push('Cluster 2 Subnet');

    if (hasDedicatedIscsi) {
        if (!vlans.iscsiA) missing.push('iSCSI A VLAN');
        if (!(subnets.iscsiA || '').trim()) missing.push('iSCSI A Subnet');
        if (!vlans.iscsiB) missing.push('iSCSI B VLAN');
        if (!(subnets.iscsiB || '').trim()) missing.push('iSCSI B Subnet');
    }

    if (missing.length > 0) {
        if (typeof showToast === 'function') showToast('Missing required fields: ' + missing.join(', '), 'error');
        return;
    }

    state.disaggOverridesConfirmed = true;
    state.disaggNicConfigConfirmed = true;
    renderDisaggOverrides();
    renderDisaggHostNetworkingPreview();
    if (typeof showToast === 'function') showToast('Network configuration confirmed', 'success');
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

function editDisaggOverrides() {
    state.disaggOverridesConfirmed = false;
    state.disaggNicConfigConfirmed = false;
    renderDisaggOverrides();
    var previewEl = document.getElementById('da10-nic-layout-diagram');
    if (previewEl) previewEl.innerHTML = '';
    if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
}

// ═══════════════════════════════════════════════════════════════════════════
// HOST NETWORKING DIAGRAM PREVIEW (shown after DA10 overrides confirmed)
// ═══════════════════════════════════════════════════════════════════════════

function renderDisaggHostNetworkingPreview() {
    var container = document.getElementById('da10-nic-layout-diagram');
    if (!container) return;
    if (!state.disaggOverridesConfirmed) { container.innerHTML = ''; return; }

    var storageType = state.disaggStorageType || 'fc_san';
    var backupEnabled = !!state.disaggBackupEnabled;
    var portCount = parseInt(state.disaggPortCount, 10) || 4;
    var totalNodes = (parseInt(state.disaggRackCount, 10) || 1) * (parseInt(state.disaggNodesPerRack, 10) || 1);
    var hasFc = (storageType === 'fc_san');
    var hasIscsi = (storageType === 'iscsi_4nic' || storageType === 'iscsi_6nic');
    var hasDedicatedIscsi = (storageType === 'iscsi_6nic' && !backupEnabled);
    var hasSharedIscsi = (storageType === 'iscsi_4nic' || (storageType === 'iscsi_6nic' && backupEnabled));
    var adapterMapping = state.disaggAdapterMapping || {};

    function colorRgb(hex) {
        return parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16);
    }

    // Port list and NIC name helpers
    var portList = getDisaggPortList();

    function getNicName(port) {
        var cfg = state.disaggPortConfig && state.disaggPortConfig[port.id];
        return (cfg && (cfg.customName || cfg.name)) || port.defaultName;
    }
    function getPortSpeed(port) {
        var cfg = state.disaggPortConfig && state.disaggPortConfig[port.id];
        return (cfg && cfg.speed) || port.defaultSpeed || '25GbE';
    }

    // Zone metadata
    var clusterLabel1 = hasSharedIscsi ? 'CSV/LiveMig' : 'Cluster 1';
    var clusterLabel2 = hasSharedIscsi ? 'CSV/LiveMig' : 'Cluster 2';
    var vlans = state.disaggVlans || {};
    var zoneMeta = {
        mgmt_compute: { label: 'Mgmt + Compute', color: '#3b82f6', vnicAbove: { name: 'Mgmt vNIC', vlan: 'VLAN ' + (vlans.mgmt || '7') } },
        cluster_1: { label: clusterLabel1, color: '#22c55e', subLabel: hasSharedIscsi ? '+ iSCSI' : '', vlanBelow: 'VLAN ' + (vlans.cluster1 || '711'), forcedLeaf: 'A' },
        cluster_2: { label: clusterLabel2, color: '#22c55e', subLabel: hasSharedIscsi ? '+ iSCSI' : '', vlanBelow: 'VLAN ' + (vlans.cluster2 || '712'), forcedLeaf: 'B' },
        iscsi_a: { label: 'iSCSI Storage A', color: '#8b5cf6', vlanBelow: 'VLAN ' + (vlans.iscsiA || '500'), forcedLeaf: 'A' },
        iscsi_b: { label: 'iSCSI Storage B', color: '#8b5cf6', vlanBelow: 'VLAN ' + (vlans.iscsiB || '600'), forcedLeaf: 'B' },
        backup: { label: 'In-Guest Backup Compute Intent', color: '#f97316' }
    };
    var zoneOrder = ['mgmt_compute', 'cluster_1', 'cluster_2', 'iscsi_a', 'iscsi_b', 'backup'];

    // Group ports by zone
    var groupsByZone = {};
    var zoneLeafCounters = {};
    for (var pi = 0; pi < portList.length; pi++) {
        var port = portList[pi];
        var zone = adapterMapping[port.id];
        if (!zone || zone === 'pool' || port.slot === 'bmc') continue;
        if (!groupsByZone[zone]) groupsByZone[zone] = [];
        if (!zoneLeafCounters[zone]) zoneLeafCounters[zone] = 0;
        var zmeta = zoneMeta[zone];
        var leafLabel = (zmeta && zmeta.forcedLeaf) ? zmeta.forcedLeaf : ((zoneLeafCounters[zone] % 2 === 0) ? 'A' : 'B');
        zoneLeafCounters[zone]++;
        groupsByZone[zone].push({ name: getNicName(port), speed: getPortSpeed(port), leaf: leafLabel });
    }

    // Build nicGroups in zone order
    var nicGroups = [];
    for (var zi = 0; zi < zoneOrder.length; zi++) {
        var zk = zoneOrder[zi];
        if (!groupsByZone[zk] || groupsByZone[zk].length === 0) continue;
        var meta = zoneMeta[zk];
        if (!meta) continue;
        var grp = { key: zk, label: meta.label, color: meta.color, nics: groupsByZone[zk] };
        if (meta.vnicAbove) grp.vnicAbove = meta.vnicAbove;
        if (meta.vlanBelow) grp.vlanBelow = meta.vlanBelow;
        if (meta.subLabel) grp.subLabel = meta.subLabel;
        nicGroups.push(grp);
    }
    if (nicGroups.length === 0) return;

    // Storage adapters (FC only — iSCSI shown at leaf level)
    // FC HBAs are separate hardware not in the wizard port list, so add them directly
    var storageAdapters = [];
    if (hasFc) {
        var fcName1 = 'FC-HBA1', fcName2 = 'FC-HBA2', fcSpeed = '32G FC';
        if (state.disaggPortConfig) {
            if (state.disaggPortConfig['fc_p1']) { fcName1 = state.disaggPortConfig['fc_p1'].customName || state.disaggPortConfig['fc_p1'].name || fcName1; if (state.disaggPortConfig['fc_p1'].speed) fcSpeed = state.disaggPortConfig['fc_p1'].speed; }
            if (state.disaggPortConfig['fc_p2']) { fcName2 = state.disaggPortConfig['fc_p2'].customName || state.disaggPortConfig['fc_p2'].name || fcName2; if (state.disaggPortConfig['fc_p2'].speed) fcSpeed = state.disaggPortConfig['fc_p2'].speed; }
        }
        storageAdapters.push({ name: fcName1, speed: fcSpeed, target: 'A', color: '#8b5cf6' });
        storageAdapters.push({ name: fcName2, speed: fcSpeed, target: 'B', color: '#8b5cf6' });
    }

    // Layout constants
    var adapterW = 62, adapterH = 38, adapterGap = 10, groupGap = 18;
    var mgmtVnicAreaH = 48;
    var leafH = 50, leafW = 160, leafGap = 70;
    var iscsiArrayW = 170, iscsiArrayH = 56, iscsiArrayGap = 50;

    function rowWidth(groups) {
        var w = 0;
        for (var i = 0; i < groups.length; i++) {
            w += groups[i].nics.length * adapterW + (groups[i].nics.length - 1) * adapterGap;
            if (i < groups.length - 1) w += groupGap;
        }
        return w;
    }

    var nicRowW = rowWidth(nicGroups);
    var storageW = storageAdapters.length * adapterW + Math.max(0, storageAdapters.length - 1) * adapterGap;
    var nodeW = Math.max(440, Math.max(nicRowW, storageW) + 60);
    var nodeH = 225 + mgmtVnicAreaH + (storageAdapters.length > 0 ? 70 : 0);
    var marginX = 50, marginTop = 90, marginBottom = 60;
    var leafToNodeGap = 90;
    var sanAreaH = storageAdapters.length > 0 ? 70 : 0;
    var leafAreaH = leafH + leafToNodeGap;
    var totalLeafW = 2 * leafW + leafGap;
    var topRowW = totalLeafW + (hasIscsi ? (iscsiArrayGap + iscsiArrayW) : 0);
    var svgW = Math.max(nodeW + marginX * 2, topRowW + marginX * 2);
    // When iSCSI array shifts leaf block left, ensure node centered on leafs still fits
    if (hasIscsi) {
        var minSvgWForNode = topRowW - totalLeafW + nodeW + marginX * 2;
        if (svgW < minSvgWForNode) svgW = minSvgWForNode;
    }
    var svgH = marginTop + leafAreaH + nodeH + sanAreaH + marginBottom;

    var leafY = marginTop + 10;
    var leafBlockStartX = hasIscsi ? ((svgW - topRowW) / 2) : ((svgW - totalLeafW) / 2);
    var leaf1X = leafBlockStartX;
    var leaf2X = leaf1X + leafW + leafGap;
    var iscsiArrayX = leaf2X + leafW + iscsiArrayGap;
    var iscsiArrayY = leafY - 3;
    var leafCenterX = leaf1X + totalLeafW / 2;
    var nodeX = leafCenterX - nodeW / 2;
    var nodeY = marginTop + leafAreaH + 10;

    var uplinkPositions = [];
    var storagePositions = [];

    // Build SVG — single node preview
    var svg = '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="width:100%; max-width:' + svgW + 'px;" role="img" aria-label="Host networking preview">';
    svg += '<rect x="20" y="45" width="' + (svgW - 40) + '" height="' + (svgH - 65) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(0,120,212,0.35)" stroke-dasharray="6 4" />';

    // Title
    var storageLabel = storageType === 'fc_san' ? 'FC SAN' : storageType === 'iscsi_4nic' ? 'iSCSI 4-NIC' : 'iSCSI 6-NIC';
    svg += '<text x="' + (svgW / 2) + '" y="36" text-anchor="middle" font-size="13" fill="var(--text-secondary)">Host Networking — ' + escapeHtml(storageLabel) + ' — ' + portCount + ' ports' + (backupEnabled ? ' + Backup' : '') + '</text>';

    // Leaf switches
    svg += '<rect x="' + leaf1X + '" y="' + leafY + '" width="' + leafW + '" height="' + leafH + '" rx="10" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.6)" stroke-width="2" />';
    svg += '<text x="' + (leaf1X + leafW / 2) + '" y="' + (leafY + 30) + '" text-anchor="middle" font-size="13" fill="var(--text-primary)" font-weight="600">Leaf-A</text>';
    svg += '<rect x="' + leaf2X + '" y="' + leafY + '" width="' + leafW + '" height="' + leafH + '" rx="10" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.6)" stroke-width="2" />';
    svg += '<text x="' + (leaf2X + leafW / 2) + '" y="' + (leafY + 30) + '" text-anchor="middle" font-size="13" fill="var(--text-primary)" font-weight="600">Leaf-B</text>';

    // iBGP link
    var ibgpX1 = leaf1X + leafW, ibgpX2 = leaf2X, ibgpMidY = leafY + leafH / 2;
    svg += '<line x1="' + ibgpX1 + '" y1="' + ibgpMidY + '" x2="' + ibgpX2 + '" y2="' + ibgpMidY + '" stroke="rgba(250,204,21,0.7)" stroke-width="2" stroke-dasharray="6 3" />';
    svg += '<text x="' + ((ibgpX1 + ibgpX2) / 2) + '" y="' + (ibgpMidY - 8) + '" text-anchor="middle" font-size="9" fill="rgba(250,204,21,0.9)">iBGP P49</text>';

    // Node box
    svg += '<rect x="' + nodeX + '" y="' + nodeY + '" width="' + nodeW + '" height="' + nodeH + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
    var nodeName = (state.nodeSettings && state.nodeSettings[0] && state.nodeSettings[0].name) ? state.nodeSettings[0].name : 'Node 1';
    svg += '<text x="' + (nodeX + nodeW / 2) + '" y="' + (nodeY + 28) + '" text-anchor="middle" font-size="14" fill="var(--text-primary)" font-weight="700">' + escapeHtml(nodeName) + '</text>';

    // BMC
    var bmcX = nodeX + nodeW - 75, bmcY = nodeY + 12;
    svg += '<rect x="' + bmcX + '" y="' + bmcY + '" width="55" height="22" rx="5" fill="rgba(160,160,160,0.12)" stroke="rgba(160,160,160,0.4)" />';
    svg += '<text x="' + (bmcX + 27) + '" y="' + (bmcY + 14) + '" text-anchor="middle" font-size="7.5" fill="var(--text-secondary)">BMC</text>';
    svg += '<text x="' + (bmcX + 27) + '" y="' + (bmcY + 31) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">BMC Switch</text>';

    // NIC groups
    var nicRowY = nodeY + 80 + mgmtVnicAreaH;
    var rw = rowWidth(nicGroups);
    var currentX = nodeX + (nodeW - rw) / 2;
    for (var gi = 0; gi < nicGroups.length; gi++) {
        var grp = nicGroups[gi];
        var grpW = grp.nics.length * adapterW + (grp.nics.length - 1) * adapterGap;
        var boxX = currentX - 8, boxTotalW = grpW + 16;
        var hasVnic = !!grp.vnicAbove;
        var vnicH = hasVnic ? mgmtVnicAreaH : 0;
        var boxH = adapterH + 28 + vnicH;
        var boxY = nicRowY - 14 - vnicH;
        var rgb = colorRgb(grp.color);

        svg += '<rect x="' + boxX + '" y="' + boxY + '" width="' + boxTotalW + '" height="' + boxH + '" rx="10" fill="rgba(' + rgb + ',0.08)" stroke="rgba(' + rgb + ',0.45)" stroke-dasharray="5 3" />';

        var labelY = hasIscsi ? (boxY + boxH + 12) : (boxY - 5);
        svg += '<text x="' + (boxX + boxTotalW / 2) + '" y="' + labelY + '" text-anchor="middle" font-size="9" fill="rgba(' + rgb + ',0.85)" font-weight="600">' + escapeHtml(grp.label) + '</text>';
        if (grp.subLabel) {
            svg += '<text x="' + (boxX + boxTotalW / 2) + '" y="' + (labelY + 11) + '" text-anchor="middle" font-size="8" fill="rgba(' + rgb + ',0.70)">' + escapeHtml(grp.subLabel) + '</text>';
        }

        if (hasVnic) {
            var vaW = 80, vaH = 30;
            var vaX = boxX + (boxTotalW - vaW) / 2, vaY2 = boxY + 10;
            svg += '<rect x="' + vaX + '" y="' + vaY2 + '" width="' + vaW + '" height="' + vaH + '" rx="6" fill="rgba(' + rgb + ',0.10)" stroke="rgba(' + rgb + ',0.55)" stroke-dasharray="4 2" />';
            svg += '<text x="' + (vaX + vaW / 2) + '" y="' + (vaY2 + 13) + '" text-anchor="middle" font-size="8" fill="var(--text-primary)" font-weight="600">' + escapeHtml(grp.vnicAbove.name) + '</text>';
            svg += '<text x="' + (vaX + vaW / 2) + '" y="' + (vaY2 + 24) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">' + escapeHtml(grp.vnicAbove.vlan) + '</text>';
            svg += '<line x1="' + (boxX + 6) + '" y1="' + (nicRowY - 6) + '" x2="' + (boxX + boxTotalW - 6) + '" y2="' + (nicRowY - 6) + '" stroke="rgba(' + rgb + ',0.3)" stroke-dasharray="3 2" />';
        }

        for (var ni = 0; ni < grp.nics.length; ni++) {
            var nic = grp.nics[ni];
            var x = currentX + ni * (adapterW + adapterGap), y = nicRowY;
            svg += '<rect x="' + x + '" y="' + y + '" width="' + adapterW + '" height="' + adapterH + '" rx="6" fill="rgba(' + rgb + ',0.20)" stroke="rgba(' + rgb + ',0.60)" />';
            svg += '<text x="' + (x + adapterW / 2) + '" y="' + (y + 16) + '" text-anchor="middle" font-size="8" fill="var(--text-primary)" font-weight="600">' + escapeHtml(nic.name) + '</text>';
            svg += '<text x="' + (x + adapterW / 2) + '" y="' + (y + 28) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">' + escapeHtml(nic.speed) + '</text>';
            uplinkPositions.push({ x: x + adapterW / 2, y: y, leaf: nic.leaf, color: grp.color });
        }

        if (grp.vlanBelow) {
            var vlanY = grp.subLabel ? (boxY + boxH + 34) : (hasIscsi ? (boxY + boxH + 24) : (boxY + boxH + 12));
            svg += '<text x="' + (boxX + boxTotalW / 2) + '" y="' + vlanY + '" text-anchor="middle" font-size="8" fill="rgba(' + rgb + ',0.75)" font-style="italic">' + escapeHtml(grp.vlanBelow) + '</text>';
        }
        currentX += grpW + groupGap;
    }

    // Storage adapters (FC only)
    if (storageAdapters.length > 0) {
        var saY = nodeY + nodeH - adapterH - 20;
        var saStartX = nodeX + (nodeW - storageW) / 2;
        var saRgb = colorRgb('#8b5cf6');
        svg += '<text x="' + (nodeX + nodeW / 2) + '" y="' + (saY - 18) + '" text-anchor="middle" font-size="9" fill="rgba(' + saRgb + ',0.85)" font-weight="600">FC HBA — SAN Fabric</text>';
        svg += '<line x1="' + (nodeX + 20) + '" y1="' + (saY - 24) + '" x2="' + (nodeX + nodeW - 20) + '" y2="' + (saY - 24) + '" stroke="rgba(' + saRgb + ',0.2)" stroke-dasharray="4 3" />';
        for (var si = 0; si < storageAdapters.length; si++) {
            var sa = storageAdapters[si];
            var sx = saStartX + si * (adapterW + adapterGap);
            svg += '<rect x="' + sx + '" y="' + saY + '" width="' + adapterW + '" height="' + adapterH + '" rx="6" fill="rgba(' + saRgb + ',0.15)" stroke="rgba(' + saRgb + ',0.55)" stroke-dasharray="4 2" />';
            svg += '<text x="' + (sx + adapterW / 2) + '" y="' + (saY + 16) + '" text-anchor="middle" font-size="7.5" fill="var(--text-primary)" font-weight="600">' + escapeHtml(sa.name) + '</text>';
            svg += '<text x="' + (sx + adapterW / 2) + '" y="' + (saY + 28) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">' + escapeHtml(sa.speed) + '</text>';
            storagePositions.push({ x: sx + adapterW / 2, y: saY + adapterH, target: sa.target, color: sa.color });
        }
    }

    // Uplink lines from NICs to leaf switches
    var leafBottomY = leafY + leafH;
    for (var ai = 0; ai < uplinkPositions.length; ai++) {
        var ap = uplinkPositions[ai];
        var targetLX = (ap.leaf === 'A') ? (leaf1X + leafW / 2) : (leaf2X + leafW / 2);
        var uRgb = colorRgb(ap.color);
        svg += '<line x1="' + ap.x + '" y1="' + ap.y + '" x2="' + targetLX + '" y2="' + leafBottomY + '" stroke="rgba(' + uRgb + ',0.35)" stroke-width="1.5" stroke-dasharray="4 2" />';
    }

    // iSCSI Storage Array or FC SAN targets
    if (hasIscsi) {
        var arrRgb = colorRgb('#8b5cf6');
        svg += '<rect x="' + iscsiArrayX + '" y="' + iscsiArrayY + '" width="' + iscsiArrayW + '" height="' + iscsiArrayH + '" rx="10" fill="rgba(' + arrRgb + ',0.12)" stroke="rgba(' + arrRgb + ',0.6)" stroke-width="2" />';
        svg += '<text x="' + (iscsiArrayX + iscsiArrayW / 2) + '" y="' + (iscsiArrayY + 22) + '" text-anchor="middle" font-size="11" fill="rgba(' + arrRgb + ',0.95)" font-weight="700">iSCSI Storage Array</text>';
        svg += '<text x="' + (iscsiArrayX + iscsiArrayW / 2) + '" y="' + (iscsiArrayY + 38) + '" text-anchor="middle" font-size="8" fill="var(--text-secondary)">Dual Controllers (A + B)</text>';
        svg += '<text x="' + (iscsiArrayX + iscsiArrayW / 2) + '" y="' + (iscsiArrayY + 50) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">MPIO Active/Active</text>';
        var routeY2 = leafY - 18;
        svg += '<polyline points="' + (leaf1X + leafW) + ',' + leafY + ' ' + (leaf1X + leafW) + ',' + routeY2 + ' ' + iscsiArrayX + ',' + routeY2 + ' ' + iscsiArrayX + ',' + (iscsiArrayY + 16) + '" fill="none" stroke="rgba(' + arrRgb + ',0.4)" stroke-width="1.5" stroke-dasharray="5 3" />';
        svg += '<line x1="' + (leaf2X + leafW) + '" y1="' + (leafY + leafH - 12) + '" x2="' + iscsiArrayX + '" y2="' + (iscsiArrayY + iscsiArrayH - 16) + '" stroke="rgba(' + arrRgb + ',0.4)" stroke-width="1.5" stroke-dasharray="5 3" />';
    } else if (storagePositions.length > 0) {
        var sanY2 = nodeY + nodeH + 20;
        var sanW2 = 160, sanH2 = 36, sanGap2 = 60;
        var totSanW = 2 * sanW2 + sanGap2;
        var sanStartX2 = (svgW - totSanW) / 2;
        var sanRgb = colorRgb('#8b5cf6');
        svg += '<rect x="' + sanStartX2 + '" y="' + sanY2 + '" width="' + sanW2 + '" height="' + sanH2 + '" rx="10" fill="rgba(' + sanRgb + ',0.12)" stroke="rgba(' + sanRgb + ',0.55)" stroke-width="1.5" />';
        svg += '<text x="' + (sanStartX2 + sanW2 / 2) + '" y="' + (sanY2 + 22) + '" text-anchor="middle" font-size="11" fill="rgba(' + sanRgb + ',0.9)" font-weight="600">SAN Fabric A</text>';
        var sanBX2 = sanStartX2 + sanW2 + sanGap2;
        svg += '<rect x="' + sanBX2 + '" y="' + sanY2 + '" width="' + sanW2 + '" height="' + sanH2 + '" rx="10" fill="rgba(' + sanRgb + ',0.12)" stroke="rgba(' + sanRgb + ',0.55)" stroke-width="1.5" />';
        svg += '<text x="' + (sanBX2 + sanW2 / 2) + '" y="' + (sanY2 + 22) + '" text-anchor="middle" font-size="11" fill="rgba(' + sanRgb + ',0.9)" font-weight="600">SAN Fabric B</text>';
        var tAcx = sanStartX2 + sanW2 / 2, tBcx = sanBX2 + sanW2 / 2;
        for (var sp = 0; sp < storagePositions.length; sp++) {
            var spp = storagePositions[sp];
            var tCx = (spp.target === 'A') ? tAcx : tBcx;
            var spRgb = colorRgb(spp.color);
            svg += '<line x1="' + spp.x + '" y1="' + spp.y + '" x2="' + tCx + '" y2="' + sanY2 + '" stroke="rgba(' + spRgb + ',0.4)" stroke-width="1.5" stroke-dasharray="5 3" />';
        }
    }

    svg += '</svg>';

    container.innerHTML = '<div style="margin-top:1.5rem; text-align:center;">'
        + '<h4 style="color:var(--accent-purple); margin-bottom:0.75rem;">Host Networking Preview</h4>'
        + '<div class="switchless-diagram" style="display:inline-block; text-align:left;">' + svg + '</div>'
        + '<div style="margin-top:0.75rem; display:flex; gap:0.5rem; justify-content:center;">'
        + '<button type="button" class="report-action-button" onclick="window.downloadWizardHostNetworkingSvg(\'light\')">Download SVG (Light)</button>'
        + '<button type="button" class="report-action-button" onclick="window.downloadWizardHostNetworkingSvg(\'dark\')">Download SVG (Dark)</button>'
        + '</div>'
        + '</div>';
}

window.downloadWizardHostNetworkingSvg = function(variant) {
    try {
        var container = document.getElementById('da10-nic-layout-diagram');
        if (!container) return;
        var svg = container.querySelector('svg.switchless-diagram__svg');
        if (!svg) return;

        var theme = (variant === 'light' || variant === 'dark') ? variant : 'dark';
        var clone = svg.cloneNode(true);
        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        var exportBg = '#000000';
        try {
            var rootStyle = window.getComputedStyle(document.documentElement);
            var themeVars = {
                '--bg-dark': (rootStyle.getPropertyValue('--bg-dark') || '').trim(),
                '--card-bg': (rootStyle.getPropertyValue('--card-bg') || '').trim(),
                '--text-primary': (rootStyle.getPropertyValue('--text-primary') || '').trim(),
                '--text-secondary': (rootStyle.getPropertyValue('--text-secondary') || '').trim(),
                '--accent-blue': (rootStyle.getPropertyValue('--accent-blue') || '').trim(),
                '--accent-purple': (rootStyle.getPropertyValue('--accent-purple') || '').trim(),
                '--success': (rootStyle.getPropertyValue('--success') || '').trim(),
                '--glass-border': (rootStyle.getPropertyValue('--glass-border') || '').trim()
            };
            if (theme === 'light') {
                themeVars['--bg-dark'] = '#ffffff';
                themeVars['--card-bg'] = '#ffffff';
                themeVars['--text-primary'] = '#0b0b0b';
                themeVars['--text-secondary'] = '#404040';
                themeVars['--glass-border'] = 'rgba(0, 0, 0, 0.14)';
            }
            exportBg = (theme === 'light') ? '#ffffff' : (themeVars['--bg-dark'] || '#000000');

            var decls = Object.keys(themeVars).map(function(k) {
                var v = (themeVars[k] || '').trim();
                return v ? (k + ': ' + v + ';') : '';
            }).filter(Boolean).join(' ');

            if (decls) {
                var defs = clone.querySelector('defs');
                if (!defs) {
                    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                    clone.insertBefore(defs, clone.firstChild);
                }
                var styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
                styleEl.textContent = ':root { ' + decls + ' }';
                defs.appendChild(styleEl);
            }
        } catch (eVars) { /* ignore */ }

        try {
            var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('fill', exportBg);
            var vb = (clone.getAttribute('viewBox') || '').trim();
            if (vb) {
                var parts = vb.split(/\s+/).map(function(p) { return parseFloat(p); });
                if (parts.length === 4 && parts.every(function(n) { return Number.isFinite(n); })) {
                    rect.setAttribute('x', String(parts[0]));
                    rect.setAttribute('y', String(parts[1]));
                    rect.setAttribute('width', String(parts[2]));
                    rect.setAttribute('height', String(parts[3]));
                } else {
                    rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
                    rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%');
                }
            } else {
                rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
                rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%');
            }
            var defsNode = clone.querySelector('defs');
            if (defsNode && defsNode.nextSibling) {
                clone.insertBefore(rect, defsNode.nextSibling);
            } else {
                clone.insertBefore(rect, clone.firstChild);
            }
        } catch (eBg) { /* ignore */ }

        var serializer = new XMLSerializer();
        var svgText = serializer.serializeToString(clone);
        if (svgText.indexOf('<?xml') !== 0) {
            svgText = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgText;
        }

        var blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var ts = new Date();
        var pad2 = function(n) { return String(n).padStart(2, '0'); };
        var fileName = 'host-networking-preview-' + theme + '-'
            + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate())
            + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes()) + '.svg';

        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { /* ignore */ }
};

function validateDisaggNicConfig() {
    var errorEl = document.getElementById('da10-nic-error');
    var successEl = document.getElementById('da10-nic-success');
    if (!errorEl || !successEl) return;

    var errors = [];

    // Check port config duplicate names
    var ports = getDisaggPortList();
    var nameCount = {};
    for (var i = 0; i < ports.length; i++) {
        var dn = getDisaggPortDisplayName(ports[i]).toLowerCase();
        nameCount[dn] = (nameCount[dn] || 0) + 1;
    }
    for (var dn in nameCount) {
        if (nameCount[dn] > 1) { errors.push('Duplicate adapter name detected'); break; }
    }

    // Check adapter mapping completeness
    var zones = getDisaggIntentZones();
    zones.forEach(function(zone) {
        if (zone.minAdapters > 0) {
            var count = ports.filter(function(p) { return state.disaggAdapterMapping && state.disaggAdapterMapping[p.id] === zone.key; }).length;
            if (count < zone.minAdapters) {
                errors.push(zone.title + ' needs at least ' + zone.minAdapters + ' adapter(s)');
            }
        }
    });

    if (errors.length > 0) {
        errorEl.textContent = errors[0];
        errorEl.classList.remove('hidden');
        successEl.classList.add('hidden');
        state.disaggNicNamesConfirmed = false;
    } else {
        errorEl.classList.add('hidden');
        successEl.classList.remove('hidden');
        state.disaggNicNamesConfirmed = true;
    }
}
