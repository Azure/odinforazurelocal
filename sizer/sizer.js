// ============================================
// ODIN Sizer - JavaScript
// ============================================

// Workload scenarios storage
let workloads = [];
let workloadIdCounter = 0;

// Default workload configurations
const WORKLOAD_DEFAULTS = {
    vm: {
        name: 'Azure Local VMs',
        vcpus: 4,
        memory: 16,
        storage: 100,
        count: 10
    },
    aks: {
        name: 'AKS Arc Cluster',
        controlPlaneNodes: 3,
        controlPlaneVcpus: 4,
        controlPlaneMemory: 8,
        workerNodes: 3,
        workerVcpus: 8,
        workerMemory: 16,
        workerStorage: 200,
        clusterCount: 1
    },
    avd: {
        name: 'Azure Virtual Desktop',
        profile: 'medium', // light, medium, power
        userCount: 50
    }
};

// AVD Profile specifications
const AVD_PROFILES = {
    light: {
        name: 'Light',
        description: 'Task workers (basic apps, web browsing)',
        vcpusPerUser: 0.5,
        memoryPerUser: 2,
        storagePerUser: 20
    },
    medium: {
        name: 'Medium',
        description: 'Knowledge workers (Office, email, multi-tasking)',
        vcpusPerUser: 1,
        memoryPerUser: 4,
        storagePerUser: 40
    },
    power: {
        name: 'Power',
        description: 'Power users (development, data analysis)',
        vcpusPerUser: 2,
        memoryPerUser: 8,
        storagePerUser: 80
    }
};

// Storage resiliency multipliers and minimum nodes
const RESILIENCY_CONFIG = {
    'simple': { multiplier: 1, minNodes: 1, name: 'Simple (No Fault Tolerance)', singleNodeOnly: true },
    '2way': { multiplier: 2, minNodes: 1, name: 'Two-way Mirror' },
    '3way': { multiplier: 3, minNodes: 3, name: 'Three-way Mirror' },
    'parity': { multiplier: 1.5, minNodes: 4, name: 'Dual Parity' }
};

// Storage resiliency multipliers (for backward compatibility)
const RESILIENCY_MULTIPLIERS = {
    'simple': 1,    // Simple = no redundancy (1x raw storage)
    '2way': 2,      // Two-way mirror = 2x raw storage
    '3way': 3,      // Three-way mirror = 3x raw storage
    'parity': 1.5   // Dual parity ≈ 1.5x raw storage
};

// Current modal state
let currentModalType = null;

// Handle node count change
function onNodeCountChange() {
    updateRackAwareOptions();
    updateResiliencyOptions();
    updateClusterInfo();
    calculateRequirements();
}

// Handle cluster type (rack-aware) change
function onClusterTypeChange() {
    updateNodeOptionsForRackAware();
    updateResiliencyOptions();
    updateClusterInfo();
    calculateRequirements();
}

// Handle resiliency change
function onResiliencyChange() {
    updateClusterInfo();
    calculateRequirements();
}

// Update rack-aware option availability based on node count
function updateRackAwareOptions() {
    const nodeCount = parseInt(document.getElementById('node-count').value) || 1;
    const rackAwareSelect = document.getElementById('rack-aware');
    const currentValue = rackAwareSelect.value;
    
    // Rack-aware requires 2-8 nodes
    if (nodeCount < 2 || nodeCount > 8) {
        // Force standard cluster if outside rack-aware range
        rackAwareSelect.value = 'false';
        rackAwareSelect.disabled = true;
        rackAwareSelect.title = nodeCount < 2 
            ? 'Rack-aware requires minimum 2 nodes' 
            : 'Rack-aware supports maximum 8 nodes';
    } else {
        rackAwareSelect.disabled = false;
        rackAwareSelect.title = '';
    }
}

// Update node count options when rack-aware is selected
function updateNodeOptionsForRackAware() {
    const rackAware = document.getElementById('rack-aware').value === 'true';
    const nodeSelect = document.getElementById('node-count');
    const currentValue = parseInt(nodeSelect.value) || 3;
    
    if (rackAware) {
        // Rack-aware: only 2, 4, 6, 8 nodes (even numbers for balanced rack distribution)
        const nodeOptions = [2, 4, 6, 8];
        nodeSelect.innerHTML = nodeOptions.map(n => {
            let label = `${n} Nodes`;
            if (n === 2) label += ' (Minimum for Rack-Aware)';
            if (n === 8) label += ' (Maximum for Rack-Aware)';
            return `<option value="${n}">${label}</option>`;
        }).join('');
        
        // Adjust current value to nearest valid even number
        if (currentValue <= 2) {
            nodeSelect.value = 2;
        } else if (currentValue <= 4) {
            nodeSelect.value = 4;
        } else if (currentValue <= 6) {
            nodeSelect.value = 6;
        } else {
            nodeSelect.value = 8;
        }
    } else {
        // Standard cluster: 1-16 nodes
        const nodeOptions = [1, 2, 3, 4, 5, 6, 7, 8, 12, 16];
        nodeSelect.innerHTML = nodeOptions.map(n => {
            let label = n === 1 ? '1 Node (Single)' : `${n} Nodes`;
            return `<option value="${n}">${label}</option>`;
        }).join('');
        
        // Preserve current value if valid
        if (nodeOptions.includes(currentValue)) {
            nodeSelect.value = currentValue;
        } else {
            nodeSelect.value = 3;
        }
    }
}

// Update node count dropdown based on resiliency requirements (legacy - kept for compatibility)
function updateNodeOptions() {
    const resiliency = document.getElementById('resiliency').value;
    const rackAware = document.getElementById('rack-aware').value === 'true';
    const nodeSelect = document.getElementById('node-count');
    const config = RESILIENCY_CONFIG[resiliency];
    
    // Minimum nodes based on resiliency (fault domains)
    const minNodes = config.minNodes;
    
    // Get current selection
    const currentValue = parseInt(nodeSelect.value) || minNodes;
    
    // Rebuild options starting from minimum
    const nodeOptions = [];
    for (let i = minNodes; i <= 16; i++) {
        if (i <= 8 || i === 12 || i === 16) {
            nodeOptions.push(i);
        }
    }
    
    nodeSelect.innerHTML = nodeOptions.map(n => {
        let label = n === 1 ? '1 Node (Single)' : `${n} Nodes`;
        if (n === minNodes && minNodes > 1) {
            label += ` (Minimum for ${config.name})`;
        }
        return `<option value="${n}">${label}</option>`;
    }).join('');
    
    // Set to previous value if valid, otherwise minimum
    if (currentValue >= minNodes) {
        nodeSelect.value = currentValue;
    } else {
        nodeSelect.value = minNodes;
    }
    
    // Also update resiliency options based on node count
    updateResiliencyOptions();
}

// Update resiliency options based on node count
function updateResiliencyOptions() {
    const nodeCount = parseInt(document.getElementById('node-count').value) || 1;
    const resiliencySelect = document.getElementById('resiliency');
    const currentResiliency = resiliencySelect.value;
    
    // Build resiliency options based on node count
    let options = '';
    
    if (nodeCount === 1) {
        // Single node: only simple and 2-way mirror available
        options = `
            <option value="simple">Simple (No Fault Tolerance - 1 drive)</option>
            <option value="2way">Two-way Mirror (2+ drives, single fault tolerance)</option>
        `;
    } else if (nodeCount === 2) {
        // 2 nodes: simple, 2-way mirror
        options = `
            <option value="2way">Two-way Mirror (min 2 nodes)</option>
        `;
    } else if (nodeCount === 3) {
        // 3 nodes: 2-way or 3-way mirror
        options = `
            <option value="2way">Two-way Mirror (min 2 nodes)</option>
            <option value="3way">Three-way Mirror (min 3 nodes)</option>
        `;
    } else {
        // 4+ nodes: all options available
        options = `
            <option value="2way">Two-way Mirror (min 2 nodes)</option>
            <option value="3way">Three-way Mirror (min 3 nodes)</option>
            <option value="parity">Dual Parity (min 4 nodes)</option>
        `;
    }
    
    resiliencySelect.innerHTML = options;
    
    // Try to preserve current selection if valid
    const validOptions = Array.from(resiliencySelect.options).map(o => o.value);
    if (validOptions.includes(currentResiliency)) {
        resiliencySelect.value = currentResiliency;
    }
}

// Update cluster info text
function updateClusterInfo() {
    const resiliency = document.getElementById('resiliency').value;
    const rackAware = document.getElementById('rack-aware').value === 'true';
    const nodeCount = parseInt(document.getElementById('node-count').value) || 1;
    const config = RESILIENCY_CONFIG[resiliency];
    const infoText = document.getElementById('cluster-info-text');
    
    let message = '';
    
    if (nodeCount === 1) {
        if (resiliency === 'simple') {
            message = 'Single node with simple resiliency: No fault tolerance. Requires minimum 2 capacity drives.';
        } else {
            message = 'Single node with two-way mirror: Drive fault tolerance only. Requires minimum 2 capacity drives.';
        }
        message += ' No maintenance window capacity.';
    } else if (rackAware) {
        message = `Tip: Rack-aware cluster (2-8 nodes): Each rack is a fault domain. ${config.name} requires minimum ${config.minNodes} racks. For multi-node clusters, N+1 capacity must be reserved when applying updates (ability to drain a node).`;
    } else {
        message = `Tip: ${config.name} requires minimum ${config.minNodes} fault domains (nodes). For multi-node clusters, N+1 capacity must be reserved when applying updates (ability to drain a node).`;
    }
    
    infoText.textContent = message;
}

// Show add workload modal
function showAddWorkloadModal(type) {
    currentModalType = type;
    const modal = document.getElementById('add-workload-modal');
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    
    // Set title
    switch (type) {
        case 'vm':
            title.textContent = 'Add Azure Local VMs';
            body.innerHTML = getVMModalContent();
            break;
        case 'aks':
            title.textContent = 'Add AKS Arc Cluster';
            body.innerHTML = getAKSModalContent();
            break;
        case 'avd':
            title.textContent = 'Add Azure Virtual Desktop';
            body.innerHTML = getAVDModalContent();
            break;
    }
    
    modal.classList.add('active');
    overlay.classList.add('active');
}

// Close modal
function closeModal() {
    const modal = document.getElementById('add-workload-modal');
    const overlay = document.getElementById('modal-overlay');
    modal.classList.remove('active');
    overlay.classList.remove('active');
    currentModalType = null;
}

// Get VM modal content
function getVMModalContent() {
    const defaults = WORKLOAD_DEFAULTS.vm;
    return `
        <div class="form-group">
            <label>Workload Name</label>
            <input type="text" id="workload-name" value="${defaults.name}" placeholder="e.g., Production VMs">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>vCPUs per VM</label>
                <input type="number" id="vm-vcpus" value="${defaults.vcpus}" min="1" max="128">
            </div>
            <div class="form-group">
                <label>Memory per VM (GB)</label>
                <input type="number" id="vm-memory" value="${defaults.memory}" min="1" max="1024">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Storage per VM (GB)</label>
                <input type="number" id="vm-storage" value="${defaults.storage}" min="1" max="64000">
                <span class="hint">Total disk capacity including OS</span>
            </div>
            <div class="form-group">
                <label>Number of VMs</label>
                <input type="number" id="vm-count" value="${defaults.count}" min="1" max="10000">
            </div>
        </div>
    `;
}

// Get AKS modal content
function getAKSModalContent() {
    const defaults = WORKLOAD_DEFAULTS.aks;
    return `
        <div class="form-group">
            <label>Workload Name</label>
            <input type="text" id="workload-name" value="${defaults.name}" placeholder="e.g., Production AKS">
        </div>
        <div class="form-group">
            <label>Number of Clusters</label>
            <input type="number" id="aks-cluster-count" value="${defaults.clusterCount}" min="1" max="100">
        </div>
        <h4 style="margin: 20px 0 12px; font-size: 14px; color: var(--text-secondary);">Control Plane Nodes (per cluster)</h4>
        <div class="form-row">
            <div class="form-group">
                <label>Node Count</label>
                <select id="aks-cp-nodes">
                    <option value="1">1 (Non-HA)</option>
                    <option value="3" selected>3 (HA)</option>
                    <option value="5">5 (Large)</option>
                </select>
            </div>
            <div class="form-group">
                <label>vCPUs per Node</label>
                <input type="number" id="aks-cp-vcpus" value="${defaults.controlPlaneVcpus}" min="2" max="32">
            </div>
        </div>
        <div class="form-group">
            <label>Memory per Node (GB)</label>
            <input type="number" id="aks-cp-memory" value="${defaults.controlPlaneMemory}" min="4" max="128">
        </div>
        <h4 style="margin: 20px 0 12px; font-size: 14px; color: var(--text-secondary);">Worker Nodes (per cluster)</h4>
        <div class="form-row">
            <div class="form-group">
                <label>Node Count</label>
                <input type="number" id="aks-worker-nodes" value="${defaults.workerNodes}" min="1" max="500">
            </div>
            <div class="form-group">
                <label>vCPUs per Node</label>
                <input type="number" id="aks-worker-vcpus" value="${defaults.workerVcpus}" min="2" max="64">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Memory per Node (GB)</label>
                <input type="number" id="aks-worker-memory" value="${defaults.workerMemory}" min="4" max="256">
            </div>
            <div class="form-group">
                <label>Storage per Node (GB)</label>
                <input type="number" id="aks-worker-storage" value="${defaults.workerStorage}" min="50" max="4000">
            </div>
        </div>
    `;
}

// Get AVD modal content
function getAVDModalContent() {
    const defaults = WORKLOAD_DEFAULTS.avd;
    return `
        <div class="form-group">
            <label>Workload Name</label>
            <input type="text" id="workload-name" value="${defaults.name}" placeholder="e.g., Corporate AVD">
        </div>
        <div class="form-group">
            <label>User Profile</label>
            <select id="avd-profile" onchange="updateAVDDescription()">
                <option value="light">Light - Task Workers</option>
                <option value="medium" selected>Medium - Knowledge Workers</option>
                <option value="power">Power - Power Users</option>
            </select>
            <span class="hint" id="avd-profile-desc">${AVD_PROFILES.medium.description}</span>
        </div>
        <div class="form-group">
            <label>Number of Users</label>
            <input type="number" id="avd-users" value="${defaults.userCount}" min="1" max="10000">
        </div>
        <div style="margin-top: 16px; padding: 16px; background: var(--subtle-bg); border-radius: 8px;">
            <h4 style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Profile Specifications</h4>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 12px;">
                <div>
                    <span style="color: var(--text-secondary);">vCPUs/User:</span>
                    <span id="avd-spec-vcpus">${AVD_PROFILES.medium.vcpusPerUser}</span>
                </div>
                <div>
                    <span style="color: var(--text-secondary);">Memory/User:</span>
                    <span id="avd-spec-memory">${AVD_PROFILES.medium.memoryPerUser} GB</span>
                </div>
                <div>
                    <span style="color: var(--text-secondary);">Storage/User:</span>
                    <span id="avd-spec-storage">${AVD_PROFILES.medium.storagePerUser} GB</span>
                </div>
            </div>
        </div>
    `;
}

// Update AVD description when profile changes
function updateAVDDescription() {
    const profile = document.getElementById('avd-profile').value;
    const profileData = AVD_PROFILES[profile];
    document.getElementById('avd-profile-desc').textContent = profileData.description;
    document.getElementById('avd-spec-vcpus').textContent = profileData.vcpusPerUser;
    document.getElementById('avd-spec-memory').textContent = profileData.memoryPerUser + ' GB';
    document.getElementById('avd-spec-storage').textContent = profileData.storagePerUser + ' GB';
}

// Add workload
function addWorkload() {
    if (!currentModalType) return;
    
    const name = document.getElementById('workload-name').value;
    let workload = {
        id: ++workloadIdCounter,
        type: currentModalType,
        name: name
    };
    
    switch (currentModalType) {
        case 'vm':
            workload.vcpus = parseInt(document.getElementById('vm-vcpus').value) || 4;
            workload.memory = parseInt(document.getElementById('vm-memory').value) || 16;
            workload.storage = parseInt(document.getElementById('vm-storage').value) || 100;
            workload.count = parseInt(document.getElementById('vm-count').value) || 1;
            break;
        case 'aks':
            workload.clusterCount = parseInt(document.getElementById('aks-cluster-count').value) || 1;
            workload.controlPlaneNodes = parseInt(document.getElementById('aks-cp-nodes').value) || 3;
            workload.controlPlaneVcpus = parseInt(document.getElementById('aks-cp-vcpus').value) || 4;
            workload.controlPlaneMemory = parseInt(document.getElementById('aks-cp-memory').value) || 8;
            workload.workerNodes = parseInt(document.getElementById('aks-worker-nodes').value) || 3;
            workload.workerVcpus = parseInt(document.getElementById('aks-worker-vcpus').value) || 8;
            workload.workerMemory = parseInt(document.getElementById('aks-worker-memory').value) || 16;
            workload.workerStorage = parseInt(document.getElementById('aks-worker-storage').value) || 200;
            break;
        case 'avd':
            workload.profile = document.getElementById('avd-profile').value;
            workload.userCount = parseInt(document.getElementById('avd-users').value) || 50;
            break;
    }
    
    workloads.push(workload);
    closeModal();
    renderWorkloads();
    calculateRequirements();
}

// Delete workload
function deleteWorkload(id) {
    workloads = workloads.filter(w => w.id !== id);
    renderWorkloads();
    calculateRequirements();
}

// Render workloads list
function renderWorkloads() {
    const container = document.getElementById('workloads-list');
    const emptyState = document.getElementById('empty-state');
    
    if (workloads.length === 0) {
        container.innerHTML = '';
        container.appendChild(emptyState);
        emptyState.style.display = 'flex';
        return;
    }
    
    let html = '';
    workloads.forEach(w => {
        const iconClass = w.type;
        const details = getWorkloadDetails(w);
        html += `
            <div class="workload-card">
                <div class="workload-icon ${iconClass}">
                    ${getWorkloadIcon(w.type)}
                </div>
                <div class="workload-card-content">
                    <div class="workload-card-title">
                        ${w.name}
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 400;">${getWorkloadTypeName(w.type)}</span>
                    </div>
                    <div class="workload-card-details">${details}</div>
                </div>
                <div class="workload-card-actions">
                    <button class="delete" onclick="deleteWorkload(${w.id})" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Get workload icon SVG
function getWorkloadIcon(type) {
    switch (type) {
        case 'vm':
            return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
        case 'aks':
            return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
        case 'avd':
            return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M6 21h12"/><path d="M9 17v4M15 17v4"/></svg>';
        default:
            return '';
    }
}

// Get workload type name
function getWorkloadTypeName(type) {
    switch (type) {
        case 'vm': return 'VMs';
        case 'aks': return 'AKS Arc';
        case 'avd': return 'AVD';
        default: return '';
    }
}

// Get workload details string
function getWorkloadDetails(w) {
    switch (w.type) {
        case 'vm':
            return `${w.count} VMs × ${w.vcpus} vCPUs, ${w.memory} GB RAM, ${w.storage} GB storage`;
        case 'aks':
            const totalNodes = (w.controlPlaneNodes + w.workerNodes) * w.clusterCount;
            return `${w.clusterCount} cluster(s) × ${totalNodes / w.clusterCount} nodes each`;
        case 'avd':
            const profile = AVD_PROFILES[w.profile];
            return `${w.userCount} ${profile.name} users`;
        default:
            return '';
    }
}

// Calculate workload requirements
function calculateWorkloadRequirements(w) {
    let vcpus = 0, memory = 0, storage = 0;
    
    switch (w.type) {
        case 'vm':
            vcpus = w.vcpus * w.count;
            memory = w.memory * w.count;
            storage = w.storage * w.count;
            break;
        case 'aks':
            // Control plane requirements per cluster
            const cpVcpus = w.controlPlaneNodes * w.controlPlaneVcpus;
            const cpMemory = w.controlPlaneNodes * w.controlPlaneMemory;
            const cpStorage = w.controlPlaneNodes * 100; // ~100GB per CP node
            
            // Worker requirements per cluster
            const workerVcpus = w.workerNodes * w.workerVcpus;
            const workerMemory = w.workerNodes * w.workerMemory;
            const workerStorage = w.workerNodes * w.workerStorage;
            
            // Total for all clusters
            vcpus = (cpVcpus + workerVcpus) * w.clusterCount;
            memory = (cpMemory + workerMemory) * w.clusterCount;
            storage = (cpStorage + workerStorage) * w.clusterCount;
            break;
        case 'avd':
            const profile = AVD_PROFILES[w.profile];
            vcpus = Math.ceil(profile.vcpusPerUser * w.userCount);
            memory = profile.memoryPerUser * w.userCount;
            storage = profile.storagePerUser * w.userCount;
            break;
    }
    
    return { vcpus, memory, storage };
}

// Calculate all requirements
function calculateRequirements() {
    // Sum all workload requirements
    let totalVcpus = 0, totalMemory = 0, totalStorage = 0;
    
    workloads.forEach(w => {
        const reqs = calculateWorkloadRequirements(w);
        totalVcpus += reqs.vcpus;
        totalMemory += reqs.memory;
        totalStorage += reqs.storage;
    });
    
    // Get cluster settings
    const nodeCount = parseInt(document.getElementById('node-count').value) || 3;
    const resiliency = document.getElementById('resiliency').value;
    const resiliencyMultiplier = RESILIENCY_MULTIPLIERS[resiliency];
    
    // Calculate per-node requirements (with N+1 capacity)
    // N+1 means we need to size for nodeCount-1 nodes worth of capacity
    const effectiveNodes = nodeCount > 1 ? nodeCount - 1 : 1;
    
    // vCPU to physical core ratio (typically 4:1 to 8:1)
    const vcpuToCore = 4;
    
    const perNodeCores = Math.ceil(totalVcpus / effectiveNodes / vcpuToCore);
    const perNodeMemory = Math.ceil(totalMemory / effectiveNodes);
    const perNodeStorageRaw = (totalStorage / 1000) * resiliencyMultiplier / nodeCount; // Convert to TB
    const perNodeUsable = totalStorage / 1000 / effectiveNodes; // Usable storage per node
    
    // Update UI
    document.getElementById('total-vcpus').textContent = totalVcpus;
    document.getElementById('total-memory').textContent = totalMemory + ' GB';
    document.getElementById('total-storage').textContent = (totalStorage / 1000).toFixed(2) + ' TB';
    document.getElementById('total-workloads').textContent = workloads.length;
    
    document.getElementById('per-node-cores').textContent = perNodeCores || 0;
    document.getElementById('per-node-memory').textContent = (perNodeMemory || 0) + ' GB';
    document.getElementById('per-node-storage').textContent = perNodeStorageRaw.toFixed(2) + ' TB';
    document.getElementById('per-node-usable').textContent = perNodeUsable.toFixed(2) + ' TB';
    
    // Update capacity breakdown (assuming recommended capacity)
    const recommendedVcpusPerNode = 64; // Example: 32 cores with HT
    const recommendedMemoryPerNode = 512; // GB
    const recommendedStoragePerNode = 10; // TB raw
    
    const totalAvailableVcpus = recommendedVcpusPerNode * effectiveNodes * vcpuToCore;
    const totalAvailableMemory = recommendedMemoryPerNode * effectiveNodes;
    const totalAvailableStorage = (recommendedStoragePerNode * nodeCount) / resiliencyMultiplier;
    
    const computePercent = Math.min(100, Math.round((totalVcpus / totalAvailableVcpus) * 100)) || 0;
    const memoryPercent = Math.min(100, Math.round((totalMemory / totalAvailableMemory) * 100)) || 0;
    const storagePercent = Math.min(100, Math.round(((totalStorage / 1000) / totalAvailableStorage) * 100)) || 0;
    
    document.getElementById('compute-percent').textContent = computePercent + '%';
    document.getElementById('compute-fill').style.width = computePercent + '%';
    document.getElementById('compute-used').textContent = totalVcpus;
    document.getElementById('compute-total').textContent = totalAvailableVcpus;
    
    document.getElementById('memory-percent').textContent = memoryPercent + '%';
    document.getElementById('memory-fill').style.width = memoryPercent + '%';
    document.getElementById('memory-used').textContent = totalMemory;
    document.getElementById('memory-total').textContent = totalAvailableMemory;
    
    document.getElementById('storage-percent').textContent = storagePercent + '%';
    document.getElementById('storage-fill').style.width = storagePercent + '%';
    document.getElementById('storage-used').textContent = (totalStorage / 1000).toFixed(1);
    document.getElementById('storage-total').textContent = totalAvailableStorage.toFixed(1);
    
    // Update sizing notes
    updateSizingNotes(nodeCount, totalVcpus, totalMemory, totalStorage, resiliency);
}

// Update sizing notes
function updateSizingNotes(nodeCount, totalVcpus, totalMemory, totalStorage, resiliency) {
    const notes = [];
    const rackAware = document.getElementById('rack-aware').value === 'true';
    const config = RESILIENCY_CONFIG[resiliency];
    
    if (workloads.length === 0) {
        notes.push('Add workloads to see sizing recommendations');
    } else {
        // Single node specific notes
        if (nodeCount === 1) {
            notes.push('⚠️ Single node deployment: No node fault tolerance or maintenance capacity');
            if (resiliency === 'simple') {
                notes.push('Simple resiliency: No drive fault tolerance. Single drive failure causes data loss.');
            } else {
                notes.push('Two-way mirror: Provides drive fault tolerance. Requires minimum 2 capacity drives.');
            }
            notes.push('Single node requires minimum 2 capacity drives (NVMe or SSD) of the same type');
        } else {
            // Rack-aware note
            if (rackAware) {
                notes.push(`Rack-aware cluster: Each rack acts as a fault domain. Minimum ${config.minNodes} racks required.`);
            }
            
            // N+1 note
            notes.push(`N+1 capacity: Requirements calculated assuming ${nodeCount - 1} nodes available during maintenance`);
        }
        
        // Resiliency note
        const resiliencyNames = {
            'simple': 'Simple (no redundancy, 1x raw storage)',
            '2way': 'Two-way mirror (2x raw storage)',
            '3way': 'Three-way mirror (3x raw storage)',
            'parity': 'Dual parity (~1.5x raw storage)'
        };
        notes.push(`Storage resiliency: ${resiliencyNames[resiliency]}`);
        
        // Memory recommendation
        if (totalMemory > 0) {
            const memPerNode = Math.ceil(totalMemory / (nodeCount > 1 ? nodeCount - 1 : 1));
            if (memPerNode > 768) {
                notes.push('⚠️ High memory per node: Consider larger servers (>768 GB requires 400GB+ OS drive)');
            }
        }
        
        // vCPU to core ratio
        notes.push('vCPU calculations assume 4:1 overcommit ratio');
        
        // Minimum requirements
        notes.push('Minimum per node: 32 GB RAM, 4 cores (Azure Local requirements)');
    }
    
    const notesList = document.getElementById('sizing-notes');
    notesList.innerHTML = notes.map(n => `<li>${n}</li>`).join('');
}

// Reset scenario
function resetScenario() {
    workloads = [];
    workloadIdCounter = 0;
    document.getElementById('node-count').value = '3';
    document.getElementById('rack-aware').value = 'false';
    document.getElementById('rack-aware').disabled = false;
    updateResiliencyOptions();
    document.getElementById('resiliency').value = '3way';
    updateClusterInfo();
    renderWorkloads();
    calculateRequirements();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updateRackAwareOptions();
    updateResiliencyOptions();
    updateClusterInfo();
    calculateRequirements();
    applyTheme(); // Apply saved theme
});

// Theme toggle functionality
let currentTheme = localStorage.getItem('odin-theme') || 'dark';

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme();
    localStorage.setItem('odin-theme', currentTheme);
}

function applyTheme() {
    const root = document.documentElement;
    const themeButton = document.getElementById('theme-toggle');
    const logo = document.querySelector('.odin-tab-logo img');
    
    if (currentTheme === 'light') {
        root.style.setProperty('--bg-dark', '#f5f5f5');
        root.style.setProperty('--card-bg', '#ffffff');
        root.style.setProperty('--card-bg-transparent', 'rgba(255, 255, 255, 0.95)');
        root.style.setProperty('--text-primary', '#000000');
        root.style.setProperty('--text-secondary', '#6b7280');
        root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.1)');
        root.style.setProperty('--subtle-bg', 'rgba(0, 0, 0, 0.03)');
        root.style.setProperty('--subtle-bg-hover', 'rgba(0, 0, 0, 0.06)');
        // Navigation bar theme variables for light mode
        root.style.setProperty('--nav-bg', 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 245, 245, 0.95) 100%)');
        root.style.setProperty('--nav-hover-bg', 'rgba(0, 0, 0, 0.05)');
        root.style.setProperty('--nav-active-bg', 'rgba(0, 120, 212, 0.12)');
        // Select/dropdown theme variables for light mode
        root.style.setProperty('--select-bg', '#ffffff');
        root.style.setProperty('--select-disabled-bg', '#e5e5e5');
        root.style.setProperty('--banner-bg', 'linear-gradient(90deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)');
        root.style.setProperty('--banner-border', 'rgba(139, 92, 246, 0.4)');
        if (themeButton) themeButton.textContent = '☀️';
        if (logo) logo.src = '../odin-logo-white-background.png';
        document.body.style.background = '#f5f5f5';
    } else {
        root.style.setProperty('--bg-dark', '#000000');
        root.style.setProperty('--card-bg', '#111111');
        root.style.setProperty('--card-bg-transparent', 'rgba(17, 17, 17, 0.95)');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#a1a1aa');
        root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
        root.style.setProperty('--subtle-bg', 'rgba(255, 255, 255, 0.03)');
        root.style.setProperty('--subtle-bg-hover', 'rgba(255, 255, 255, 0.06)');
        // Navigation bar theme variables for dark mode
        root.style.setProperty('--nav-bg', 'linear-gradient(180deg, rgba(17, 17, 17, 0.98) 0%, rgba(17, 17, 17, 0.95) 100%)');
        root.style.setProperty('--nav-hover-bg', 'rgba(255, 255, 255, 0.05)');
        root.style.setProperty('--nav-active-bg', 'rgba(0, 120, 212, 0.15)');
        // Select/dropdown theme variables for dark mode
        root.style.setProperty('--select-bg', '#1a1a1a');
        root.style.setProperty('--select-disabled-bg', '#0d0d0d');
        root.style.setProperty('--banner-bg', 'linear-gradient(90deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)');
        root.style.setProperty('--banner-border', 'rgba(139, 92, 246, 0.3)');
        if (themeButton) themeButton.textContent = '🌙';
        if (logo) logo.src = '../odin-logo.png';
        document.body.style.background = '#000000';
    }
}
