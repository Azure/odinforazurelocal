// ============================================
// ODIN Sizer - JavaScript
// ============================================

// LocalStorage keys for sizer state persistence
const SIZER_STATE_KEY = 'odinSizerState';
const SIZER_TIMESTAMP_KEY = 'odinSizerTimestamp';
const SIZER_VERSION = 1;
const DEFAULT_PHYSICAL_CORES_PER_NODE = 64; // Fallback when totalPhysicalCores is not specified in hwConfig
const DEFAULT_RAW_TB_PER_NODE = 10;         // Fallback raw storage per node (TB) when disk config is not specified

// Initialize and track page view for analytics
if (typeof initializeAnalytics === 'function') {
    initializeAnalytics();
}
if (typeof trackPageView === 'function') {
    trackPageView();
}
// Fetch stats explicitly (in case trackPageView write hasn't completed yet)
if (typeof fetchAndDisplayStats === 'function') {
    // Small delay to allow Firebase init to complete
    setTimeout(function() { fetchAndDisplayStats(); }, 1000);
}

// ============================================
// CPU Generation Data
// ============================================
const CPU_GENERATIONS = {
    intel: [
        {
            id: 'xeon-4th',
            name: 'Intel® 4th Gen Xeon® Scalable (Sapphire Rapids)',
            minCores: 8,
            maxCores: 60,
            coreOptions: [8, 12, 16, 24, 32, 40, 48, 56, 60],
            defaultCores: 24,
            architecture: 'Golden Cove',
            socket: 'LGA 4677',
            memoryType: 'DDR5-4800',
            memoryChannels: 8,
            pcieVersion: '5.0',
            tdpPerSocketW: 350
        },
        {
            id: 'xeon-5th',
            name: 'Intel® 5th Gen Xeon® Scalable (Emerald Rapids)',
            minCores: 8,
            maxCores: 64,
            coreOptions: [8, 12, 16, 24, 32, 48, 64],
            defaultCores: 24,
            architecture: 'Raptor Cove',
            socket: 'LGA 4677',
            memoryType: 'DDR5-5600',
            memoryChannels: 8,
            pcieVersion: '5.0',
            tdpPerSocketW: 350
        },
        {
            id: 'xeon-6',
            name: 'Intel® Xeon® 6 (Granite Rapids)',
            minCores: 16,
            maxCores: 128,
            coreOptions: [16, 24, 32, 48, 64, 72, 86, 96, 128],
            defaultCores: 32,
            architecture: 'Lion Cove / Skymont',
            socket: 'LGA 4710',
            memoryType: 'DDR5-6400 / MCR-8800',
            memoryChannels: 8,
            pcieVersion: '5.0',
            tdpPerSocketW: 500
        }
    ],
    amd: [
        {
            id: 'epyc-4th',
            name: 'AMD 4th Gen EPYC™ (Genoa)',
            minCores: 8,
            maxCores: 96,
            coreOptions: [8, 16, 24, 32, 48, 64, 84, 96],
            defaultCores: 24,
            architecture: 'Zen 4',
            socket: 'SP5 (LGA 6096)',
            memoryType: 'DDR5-4800',
            memoryChannels: 12,
            pcieVersion: '5.0',
            tdpPerSocketW: 360
        },
        {
            id: 'epyc-4th-c',
            name: 'AMD 4th Gen EPYC™ (Bergamo, Zen 4c)',
            minCores: 8,
            maxCores: 128,
            coreOptions: [8, 16, 32, 64, 112, 128],
            defaultCores: 64,
            architecture: 'Zen 4c',
            socket: 'SP5 (LGA 6096)',
            memoryType: 'DDR5-4800',
            memoryChannels: 12,
            pcieVersion: '5.0',
            tdpPerSocketW: 400
        },
        {
            id: 'epyc-5th',
            name: 'AMD 5th Gen EPYC™ (Turin)',
            minCores: 8,
            maxCores: 128,
            coreOptions: [8, 16, 24, 32, 36, 48, 64, 72, 128],
            defaultCores: 32,
            architecture: 'Zen 5',
            socket: 'SP5 (LGA 6096)',
            memoryType: 'DDR5-6400',
            memoryChannels: 12,
            pcieVersion: '5.0',
            tdpPerSocketW: 500
        },
        {
            id: 'epyc-5th-c',
            name: 'AMD 5th Gen EPYC™ (Turin Dense, Zen 5c)',
            minCores: 96,
            maxCores: 192,
            coreOptions: [96, 128, 144, 160, 192],
            defaultCores: 128,
            architecture: 'Zen 5c',
            socket: 'SP5 (LGA 6096)',
            memoryType: 'DDR5-6400',
            memoryChannels: 12,
            pcieVersion: '5.0',
            tdpPerSocketW: 500
        }
    ],
    intel_edge: [
        {
            id: 'xeon-d-27xx',
            name: 'Intel® Xeon® D-2700 (Ice Lake-D)',
            minCores: 4,
            maxCores: 20,
            coreOptions: [4, 8, 10, 12, 16, 20],
            defaultCores: 8,
            architecture: 'Sunny Cove',
            socket: 'FCBGA 3820',
            memoryType: 'DDR4-3200',
            memoryChannels: 4,
            pcieVersion: '4.0',
            tdpPerSocketW: 100
        }
    ]
};

// GPU model specifications
const GPU_MODELS = {
    a2:  { name: 'NVIDIA A2',  vramGB: 16, tdpW: 60 },
    a16: { name: 'NVIDIA A16', vramGB: 64, tdpW: 250 },
    l4:  { name: 'NVIDIA L4',  vramGB: 24, tdpW: 72 },
    l40: { name: 'NVIDIA L40', vramGB: 48, tdpW: 300 },
    l40s:{ name: 'NVIDIA L40S', vramGB: 48, tdpW: 350 }
};

// Storage tiering configuration
const STORAGE_TIERING_OPTIONS = {
    'all-flash': [
        { id: 'nvme-capacity', label: 'No cache - All NVMe as capacity', diskTypes: { capacity: 'NVMe' }, isTiered: false },
        { id: 'ssd-capacity', label: 'No cache - All SSD as capacity', diskTypes: { capacity: 'SSD' }, isTiered: false }
    ],
    'mixed-flash': [
        { id: 'nvme-cache-ssd-capacity', label: 'NVMe as cache - SSD as capacity', diskTypes: { cache: 'NVMe', capacity: 'SSD' }, isTiered: true }
    ],
    'hybrid': [
        { id: 'ssd-cache-hdd-capacity', label: 'SSD as cache - HDD as capacity', diskTypes: { cache: 'SSD', capacity: 'HDD' }, isTiered: true },
        { id: 'nvme-cache-hdd-capacity', label: 'NVMe as cache - HDD as capacity', diskTypes: { cache: 'NVMe', capacity: 'HDD' }, isTiered: true }
    ]
};

// ============================================
// Hardware Configuration Event Handlers
// ============================================

// Handle CPU manufacturer change
function onCpuManufacturerChange() {
    const manufacturer = document.getElementById('cpu-manufacturer').value;
    const genSelect = document.getElementById('cpu-generation');
    const coresSelect = document.getElementById('cpu-cores');

    if (!manufacturer) {
        genSelect.innerHTML = '<option value="" disabled selected>-- Select manufacturer first --</option>';
        genSelect.disabled = true;
        coresSelect.innerHTML = '<option value="" disabled selected>-- Select generation first --</option>';
        coresSelect.disabled = true;
        return;
    }

    const generations = CPU_GENERATIONS[manufacturer];
    genSelect.innerHTML = '<option value="" disabled selected>-- Select generation --</option>' +
        generations.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    genSelect.disabled = false;

    // Reset cores
    coresSelect.innerHTML = '<option value="" disabled selected>-- Select generation first --</option>';
    coresSelect.disabled = true;

    _cpuConfigUserSet = true;
    markManualSet('cpu-manufacturer');
    onHardwareConfigChange();
}

// Handle CPU generation change
function onCpuGenerationChange() {
    const manufacturer = document.getElementById('cpu-manufacturer').value;
    const genId = document.getElementById('cpu-generation').value;
    const coresSelect = document.getElementById('cpu-cores');

    if (!manufacturer || !genId) {
        coresSelect.innerHTML = '<option value="" disabled selected>-- Select generation first --</option>';
        coresSelect.disabled = true;
        return;
    }

    const generation = CPU_GENERATIONS[manufacturer].find(g => g.id === genId);
    if (!generation) return;

    // Populate core options
    coresSelect.innerHTML = generation.coreOptions.map(c =>
        `<option value="${c}" ${c === generation.defaultCores ? 'selected' : ''}>${c} cores</option>`
    ).join('');
    coresSelect.disabled = false;

    _cpuConfigUserSet = true;
    markManualSet('cpu-generation');
    onHardwareConfigChange();
}

// Handle storage configuration change
function onStorageConfigChange() {
    const storageConfig = document.getElementById('storage-config').value;
    const tieringSelect = document.getElementById('storage-tiering');
    if (!tieringSelect) return; // Guard for test harness
    const options = STORAGE_TIERING_OPTIONS[storageConfig];

    // Show/hide hybrid warning
    const hybridWarning = document.getElementById('hybrid-storage-warning');
    if (hybridWarning) {
        hybridWarning.style.display = storageConfig === 'hybrid' ? 'flex' : 'none';
    }

    // Populate tiering options
    tieringSelect.innerHTML = options.map((opt, i) =>
        `<option value="${opt.id}" ${i === (storageConfig === 'all-flash' ? 1 : 0) ? 'selected' : ''}>${opt.label}</option>`
    ).join('');

    onStorageTieringChange();
}

// Handle storage tiering change
function onStorageTieringChange() {
    const storageConfig = document.getElementById('storage-config').value;
    const tieringId = document.getElementById('storage-tiering').value;
    const options = STORAGE_TIERING_OPTIONS[storageConfig];
    const selectedTier = options.find(o => o.id === tieringId) || options[0];

    const singleTierDiv = document.getElementById('single-tier-disks');
    const twoTierDiv = document.getElementById('two-tier-disks');

    if (selectedTier.isTiered) {
        // Two-tier: cache + capacity
        singleTierDiv.style.display = 'none';
        twoTierDiv.style.display = 'block';

        // Update labels
        document.getElementById('cache-disk-type-label').textContent = selectedTier.diskTypes.cache;
        document.getElementById('capacity-disk-type-label').textContent = selectedTier.diskTypes.capacity;
    } else {
        // Single-tier: capacity only
        singleTierDiv.style.display = 'block';
        twoTierDiv.style.display = 'none';


    }

    onHardwareConfigChange();
}

// Enforce tiered disk limits: 2U chassis = max 24 total drive bays (cache + capacity)
// Hybrid: also enforces 1:2 cache-to-capacity ratio
function enforceCacheToCapacityRatio() {
    const storageConfig = document.getElementById('storage-config').value;
    if (storageConfig !== 'hybrid' && storageConfig !== 'mixed-flash') return;

    const tieringId = document.getElementById('storage-tiering').value;
    const options = STORAGE_TIERING_OPTIONS[storageConfig];
    const selectedTier = options.find(o => o.id === tieringId) || options[0];
    if (!selectedTier.isTiered) return;

    // Cap capacity disks at tiered maximum (16) — applies to both hybrid and mixed-flash
    const capacityDiskInput = document.getElementById('tiered-capacity-disk-count');
    let capacityCount = parseInt(capacityDiskInput.value) || 4;
    if (capacityCount > MAX_TIERED_CAPACITY_DISK_COUNT) {
        capacityCount = MAX_TIERED_CAPACITY_DISK_COUNT;
        capacityDiskInput.value = capacityCount;
    }

    // Cap cache at MAX_CACHE_DISK_COUNT (8) — applies to both hybrid and mixed-flash
    const cacheDiskInput = document.getElementById('cache-disk-count');
    let currentCache = parseInt(cacheDiskInput.value) || 2;
    if (currentCache > MAX_CACHE_DISK_COUNT) {
        currentCache = MAX_CACHE_DISK_COUNT;
        cacheDiskInput.value = currentCache;
    }

    // Hybrid only: enforce cache = ceil(capacity / 2)
    if (storageConfig === 'hybrid') {
        const targetCacheCount = Math.min(Math.ceil(capacityCount / 2), MAX_CACHE_DISK_COUNT);
        if (currentCache < targetCacheCount) {
            cacheDiskInput.value = targetCacheCount;
        }
    }
}

// Generic hardware config change handler
function onHardwareConfigChange() {
    updateGpuTypeVisibility();
    enforceCacheToCapacityRatio();
    calculateRequirements();
}

// Dedicated handler for vCPU ratio dropdown — locks the ratio against auto-escalation
function onVcpuRatioChange() {
    _vcpuRatioUserSet = true;
    markManualSet('vcpu-ratio');
    onHardwareConfigChange();
}

// Dedicated handler for memory dropdown — locks memory against auto-scaling
function onMemoryChange() {
    _memoryUserSet = true;
    markManualSet('node-memory');
    onHardwareConfigChange();
}

// Dedicated handler for CPU cores/sockets dropdowns — locks CPU config against auto-scaling
function onCpuConfigChange() {
    _cpuConfigUserSet = true;
    markManualSet('cpu-cores');
    markManualSet('cpu-sockets');
    onHardwareConfigChange();
}

// Dedicated handlers for capacity disk dropdowns — lock only the specific field against auto-scaling
function onDiskSizeChange() {
    _diskSizeUserSet = true;
    const isTiered = _isTieredStorage();
    markManualSet(isTiered ? 'tiered-capacity-disk-size' : 'capacity-disk-size');
    onHardwareConfigChange();
}
function onDiskCountChange() {
    _diskCountUserSet = true;
    const isTiered = _isTieredStorage();
    markManualSet(isTiered ? 'tiered-capacity-disk-count' : 'capacity-disk-count');
    onHardwareConfigChange();
}

// Check if current storage tiering is a two-tier (cache + capacity) configuration
function _isTieredStorage() {
    const storageEl = document.getElementById('storage-config');
    const tieringEl = document.getElementById('storage-tiering');
    if (!storageEl || !tieringEl) return false;
    const storageConfig = storageEl.value;
    const tieringId = tieringEl.value;
    const options = STORAGE_TIERING_OPTIONS[storageConfig];
    if (!options) return false;
    const selectedTier = options.find(o => o.id === tieringId) || options[0];
    return selectedTier.isTiered;
}

// Show/hide GPU type dropdown based on GPU count
function updateGpuTypeVisibility() {
    const gpuCount = parseInt(document.getElementById('gpu-count').value) || 0;
    const gpuTypeRow = document.getElementById('gpu-type-row');
    if (gpuTypeRow) {
        gpuTypeRow.style.display = gpuCount > 0 ? '' : 'none';
    }
}

// Get the vCPU to physical core overcommit ratio from dropdown
function getVcpuRatio() {
    const el = document.getElementById('vcpu-ratio');
    return el ? parseInt(el.value) || 4 : 4;
}

// Get human-readable GPU label from GPU type key
function getGpuLabel(gpuType) {
    const model = GPU_MODELS[gpuType];
    if (model) return `${model.name} (${model.vramGB} GB VRAM, ${model.tdpW}W TDP)`;
    return gpuType || 'Unknown';
}

// Get current hardware configuration
function getHardwareConfig() {
    const manufacturer = document.getElementById('cpu-manufacturer').value;
    const genId = document.getElementById('cpu-generation').value;
    const cores = parseInt(document.getElementById('cpu-cores').value) || 0;
    const sockets = parseInt(document.getElementById('cpu-sockets').value) || 2;
    const memory = parseInt(document.getElementById('node-memory').value) || 512;
    const storageConfig = document.getElementById('storage-config').value;
    const tieringId = document.getElementById('storage-tiering').value;

    const options = STORAGE_TIERING_OPTIONS[storageConfig];
    const selectedTier = options.find(o => o.id === tieringId) || options[0];

    let diskConfig = {};
    if (selectedTier.isTiered) {
        const cacheDiskCount = parseInt(document.getElementById('cache-disk-count').value) || 2;
        const cacheDiskSizeTB = parseFloat(document.getElementById('cache-disk-size').value) || 1.92;
        const capacityDiskCount = parseInt(document.getElementById('tiered-capacity-disk-count').value) || 4;
        const capacityDiskSizeTB = parseFloat(document.getElementById('tiered-capacity-disk-size').value) || 3.84;

        diskConfig = {
            isTiered: true,
            cache: {
                count: cacheDiskCount,
                sizeGB: cacheDiskSizeTB * 1024,
                type: selectedTier.diskTypes.cache
            },
            capacity: {
                count: capacityDiskCount,
                sizeGB: capacityDiskSizeTB * 1024,
                type: selectedTier.diskTypes.capacity
            }
        };
    } else {
        const diskCount = parseInt(document.getElementById('capacity-disk-count').value) || 4;
        const diskSizeTB = parseFloat(document.getElementById('capacity-disk-size').value) || 3.84;

        diskConfig = {
            isTiered: false,
            capacity: {
                count: diskCount,
                sizeGB: diskSizeTB * 1024,
                type: selectedTier.diskTypes.capacity
            }
        };
    }

    // Find generation info if available
    let generation = null;
    if (manufacturer && genId) {
        generation = CPU_GENERATIONS[manufacturer].find(g => g.id === genId);
    }

    return {
        manufacturer,
        generation,
        coresPerSocket: cores,
        sockets,
        totalPhysicalCores: cores * sockets,
        memoryGB: memory,
        gpuCount: parseInt(document.getElementById('gpu-count').value) || 0,
        gpuType: document.getElementById('gpu-type').value || 'a2',
        storageConfig,
        tieringId,
        diskConfig
    };
}

// ============================================
// Growth Factor & Node Recommendation
// ============================================

// Build a "max possible" hardware config to favour scaling up per-node specs
// (CPU cores, memory, disk count) before recommending additional nodes.
function buildMaxHardwareConfig(hwConfig) {
    // Max CPU cores for selected generation (fall back to current if no generation info)
    let maxCoresPerSocket = hwConfig.coresPerSocket || 24;
    if (hwConfig.generation && hwConfig.generation.coreOptions && hwConfig.generation.coreOptions.length > 0) {
        maxCoresPerSocket = hwConfig.generation.coreOptions[hwConfig.generation.coreOptions.length - 1];
    }
    // Use max 2 sockets — Azure Local certified hardware supports 1 or 2 sockets only
    const MAX_SOCKETS = 2;

    // Use a fixed per-node memory cap (1.5 TB) for node estimation to prefer adding
    // nodes over expensive high-capacity DIMMs. This cap must NOT depend on the current
    // node count displayed in the DOM, because that value is stale from the previous
    // calculation and creates path-dependent results (e.g. adding growth could reduce
    // the recommended node count instead of increasing it).
    // The actual per-node memory is scaled by autoScaleHardware() and its headroom
    // logic, which correctly uses the real node count at the time of scaling.
    // Only override the cap with the current hardware setting when the user manually
    // set memory — otherwise a prior auto-scale result could defeat the cap.
    const PREFERRED_MAX_MEMORY_GB = _memoryUserSet
        ? Math.max(NODE_WEIGHT_PREFERRED_MEMORY_GB, hwConfig.memoryGB || 0)
        : NODE_WEIGHT_PREFERRED_MEMORY_GB;

    // Use max disk size (15.36 TB) for node recommendation — favour scaling up disk size before adding nodes
    const maxDiskSizeGB = DISK_SIZE_OPTIONS_TB[DISK_SIZE_OPTIONS_TB.length - 1] * 1024;
    let maxDiskConfig = hwConfig.diskConfig;
    if (maxDiskConfig && maxDiskConfig.capacity) {
        maxDiskConfig = JSON.parse(JSON.stringify(maxDiskConfig)); // deep clone
        maxDiskConfig.capacity.sizeGB = Math.max(maxDiskConfig.capacity.sizeGB, maxDiskSizeGB);
    }

    return {
        totalPhysicalCores: maxCoresPerSocket * MAX_SOCKETS,
        memoryGB: PREFERRED_MAX_MEMORY_GB,
        sockets: MAX_SOCKETS,
        coresPerSocket: maxCoresPerSocket,
        diskConfig: maxDiskConfig // disk size scaled to max for node recommendation
    };
}

// Get growth factor from the future-growth dropdown
function getGrowthFactor() {
    const el = document.getElementById('future-growth');
    if (!el) return 1;
    return 1 + (parseInt(el.value) || 0) / 100;
}

// Calculate recommended node count based on workload demands and per-node hardware
function getRecommendedNodeCount(totalVcpus, totalMemoryGB, totalStorageGB, hwConfig, resiliencyMultiplier, resiliency) {
    const vcpuToCore = getVcpuRatio(); // configurable overcommit ratio
    const hostOverheadMemoryGB = 32; // Azure Local host OS + management overhead per node

    // Available capacity per node from hardware config
    const vcpusPerNode = (hwConfig.totalPhysicalCores || 0) * vcpuToCore;
    const usableMemoryPerNode = Math.max((hwConfig.memoryGB || 0) - hostOverheadMemoryGB, 0);

    // For storage node calculation, use MAX possible disk count per node
    // so we recommend fewer nodes and let autoScaleHardware increase disk count instead
    // Tiered (hybrid/mixed-flash): max 16 capacity disks (2U chassis limit); all-flash: max 24
    const isTieredStorage = hwConfig.storageConfig === 'hybrid' || hwConfig.storageConfig === 'mixed-flash';
    const maxDiskCount = isTieredStorage ? MAX_TIERED_CAPACITY_DISK_COUNT : MAX_DISK_COUNT;
    let diskSizeGB = 0;
    if (hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
        diskSizeGB = hwConfig.diskConfig.capacity.sizeGB;
    }
    const maxRawStoragePerNodeGB = maxDiskCount * diskSizeGB;

    // Total raw storage needed = (usable + Infrastructure_1 volume) * resiliency multiplier
    // Infrastructure_1 volume: 256 GB usable, reserved by Storage Spaces Direct
    const infraVolumeRawGB = 256 * resiliencyMultiplier;
    // S2D repair reservation: reserve min(nodeCount, 4) capacity disks of raw pool space
    // Use a conservative estimate based on the current disk size for node recommendation
    const s2dRepairRawGB = getS2dRepairReservedGB(1, diskSizeGB); // assume at least 1 node for recommendation
    const totalRawStorageNeededGB = totalStorageGB * resiliencyMultiplier + infraVolumeRawGB + s2dRepairRawGB;

    // Minimum working nodes for each resource dimension
    // Add per-cluster ARB overhead to total demand before dividing by per-node capacity
    const totalVcpusWithARB = totalVcpus + ARB_VCPU_OVERHEAD;
    const totalMemoryWithARB = totalMemoryGB + ARB_MEMORY_OVERHEAD_GB;
    let computeNodes = vcpusPerNode > 0 ? Math.ceil(totalVcpusWithARB / vcpusPerNode) : 1;
    let memoryNodes = usableMemoryPerNode > 0 ? Math.ceil(totalMemoryWithARB / usableMemoryPerNode) : 1;
    let storageNodes = maxRawStoragePerNodeGB > 0 ? Math.ceil(totalRawStorageNeededGB / maxRawStoragePerNodeGB) : 1;

    // Base minimum from workload
    // N+1 only applies to compute and memory (storage remains accessible during node drain)
    let computeWithN1 = computeNodes >= 2 ? computeNodes + 1 : computeNodes;
    let memoryWithN1 = memoryNodes >= 2 ? memoryNodes + 1 : memoryNodes;
    let recommended = Math.max(computeWithN1, memoryWithN1, storageNodes);

    // Enforce resiliency minimum
    const config = RESILIENCY_CONFIG[resiliency];
    if (config) {
        recommended = Math.max(recommended, config.minNodes);
    }

    // At least 1
    recommended = Math.max(recommended, 1);

    // Determine sizing driver (bottleneck)
    let bottleneck = 'compute';
    if (memoryNodes >= computeNodes && memoryNodes >= storageNodes) bottleneck = 'memory';
    else if (storageNodes >= computeNodes && storageNodes >= memoryNodes) bottleneck = 'storage';

    return {
        recommended,
        computeNodes,
        memoryNodes,
        storageNodes,
        bottleneck
    };
}

// Snap a recommended node count to the nearest available dropdown option
function snapToAvailableNodeCount(recommended) {
    const clusterType = document.getElementById('cluster-type').value;
    if (clusterType === 'single') return 1;
    if (clusterType === 'aldo-mgmt') return 3;
    const options = clusterType === 'rack-aware' ? [2, 4, 6, 8] : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    for (const opt of options) {
        if (opt >= recommended) return opt;
    }
    return options[options.length - 1]; // Cap at max
}

// Apply node recommendation to the UI
function updateNodeRecommendation(recommendation) {
    const snapped = snapToAvailableNodeCount(recommendation.recommended);

    // Auto-set node count dropdown
    const nodeSelect = document.getElementById('node-count');
    const availableValues = Array.from(nodeSelect.options).map(o => parseInt(o.value));
    if (availableValues.includes(snapped)) {
        nodeSelect.value = snapped;
    }

    // Mark the node-count field as auto-scaled (purple glow + AUTO badge)
    markAutoScaled('node-count');

    // Update dependent UI (without triggering calculateRequirements)
    updateResiliencyOptions();
    updateClusterInfo();

    // Show recommendation info
    const recDiv = document.getElementById('node-recommendation');
    const recText = document.getElementById('node-recommendation-text');
    if (recDiv && recText) {
        const bottleneckLabels = { compute: 'Compute (vCPUs)', memory: 'Memory', storage: 'Storage' };
        const driver = bottleneckLabels[recommendation.bottleneck];

        let msg = '';
        if (recommendation.recommended > 16) {
            msg = `⚠️ Workload requires ~${recommendation.recommended} nodes which exceeds max 16. Consider increasing per-node hardware capacity.`;
        } else {
            msg = `Auto-configured ${snapped} node(s) based on ${driver} requirements.`;
            if (recommendation.bottleneck !== 'storage' && recommendation.recommended > 1) {
                msg += ` Includes N+1 maintenance capacity for compute and memory.`;
            }
        }

        recText.textContent = msg;
        recDiv.style.display = 'flex';
    }
}

// Show node recommendation info without changing the dropdown (for manual node changes)
function updateNodeRecommendationInfo(recommendation, currentNodeCount) {
    const recDiv = document.getElementById('node-recommendation');
    const recText = document.getElementById('node-recommendation-text');
    if (!recDiv || !recText) return;

    const bottleneckLabels = { compute: 'Compute (vCPUs)', memory: 'Memory', storage: 'Storage' };
    const driver = bottleneckLabels[recommendation.bottleneck];
    const snapped = snapToAvailableNodeCount(recommendation.recommended);

    let msg = '';
    if (recommendation.recommended > 16) {
        msg = `⚠️ Workload requires ~${recommendation.recommended} nodes (${driver} bottleneck) which exceeds max 16. Consider increasing per-node hardware capacity (CPU cores, memory, or disk size).`;
    } else if (snapped > currentNodeCount) {
        msg = `ℹ️ Workload recommends ${snapped} node(s) based on ${driver} requirements. Current selection: ${currentNodeCount} node(s).`;
    } else {
        msg = `✅ Current ${currentNodeCount} node(s) meets workload requirements (${driver} driven, ${snapped} recommended).`;
    }

    recText.textContent = msg;
    recDiv.style.display = 'flex';
}

// Hide node recommendation info
function hideNodeRecommendation() {
    const recDiv = document.getElementById('node-recommendation');
    if (recDiv) recDiv.style.display = 'none';
}

// ============================================
// Auto-Scale Per-Node Hardware
// ============================================

// Max memory per node in GB
const MAX_MEMORY_GB = 4096;
const MIN_MEMORY_GB = 64;
const MEMORY_OPTIONS_GB = [64, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096];

// Per-node efficiency weight for node recommendations.
// buildMaxHardwareConfig uses NODE_WEIGHT_PREFERRED_MEMORY_GB as a fixed cap when
// estimating minimum nodes, always preferring additional nodes over expensive
// high-capacity DIMMs (2 TB+). This cap is intentionally NOT dependent on the
// current node count to ensure deterministic results (see buildMaxHardwareConfig).
// The large-cluster constants are used by autoScaleHardware's memory headroom
// logic: for clusters with 10+ nodes, headroom can escalate to 2 TB; for smaller
// clusters, headroom is capped at 1.5 TB to let the node loop add nodes instead.
const NODE_WEIGHT_PREFERRED_MEMORY_GB = 1536;
const NODE_WEIGHT_PREFERRED_MEMORY_LARGE_CLUSTER_GB = 2048;
// Threshold above which autoScaleHardware allows higher memory headroom
const NODE_WEIGHT_LARGE_CLUSTER_THRESHOLD = 10;

// ALDO Management Cluster minimum hardware requirements
// Source: https://learn.microsoft.com/en-us/azure/azure-local/manage/disconnected-operations-overview#eligibility-criteria
const ALDO_MIN_MEMORY_GB = 96;          // Minimum 96 GB memory per node
const ALDO_MIN_CORES_PER_NODE = 24;     // Minimum 24 physical cores per node
const ALDO_MIN_STORAGE_PER_NODE_TB = 2; // Minimum 2 TB SSD/NVMe storage per node
const ALDO_APPLIANCE_OVERHEAD_GB = 64;  // Disconnected operations appliance VM reservation per node
const ARB_MEMORY_OVERHEAD_GB = 8;       // Azure Resource Bridge (ARB) appliance VM memory per cluster
const ARB_VCPU_OVERHEAD = 4;            // Azure Resource Bridge (ARB) appliance VM vCPUs per cluster

// ALDO Infrastructure Requirement VM (IRVM1) — auto-added when ALDO Management Cluster is selected
const ALDO_IRVM = {
    name: 'IRVM1',
    type: 'vm',
    vcpus: 24,
    memory: 78,
    storage: 2048,  // 2 TB usable storage
    count: 1,
    isAldoFixed: true  // marker to prevent edit/delete/clone
};

// Disk count per node
const MIN_DISK_COUNT = 2; // Azure Local minimum; matches dropdown minimum
const MAX_DISK_COUNT = 24;
const MAX_CACHE_DISK_COUNT = 8;
const MAX_TIERED_CAPACITY_DISK_COUNT = 16; // 2U chassis: 8 cache + 16 capacity = 24 total (hybrid & mixed-flash)

// Standard capacity disk sizes (TB) for auto-scaling — stepped in order
const DISK_SIZE_OPTIONS_TB = [0.96, 1.92, 3.84, 7.68, 15.36];

// S2D resiliency repair: reserve 1 capacity disk per node (up to 4 max) from the storage pool
const S2D_REPAIR_MAX_RESERVED_DISKS = 4;

// Track whether the user manually set the repair disk count
let _repairDisksUserSet = false;

// Calculate S2D repair reserved raw space (GB) for a given node count and disk size.
// Uses the configurable repair disk count from the dropdown when available.
function getS2dRepairReservedGB(nodeCount, capacityDiskSizeGB) {
    if (nodeCount <= 0) return 0;
    const reservedDisks = getRepairDiskCount(nodeCount);
    return reservedDisks * capacityDiskSizeGB;
}

// Get the current repair disk count — from the dropdown if visible, else calculate from node count
function getRepairDiskCount(nodeCountOverride) {
    const isTiered = _isTieredStorage();
    const selectId = isTiered ? 'tiered-repair-disk-count' : 'repair-disk-count';
    const el = document.getElementById(selectId);
    if (el) {
        return parseInt(el.value) || 0;
    }
    // Fallback: compute from node count
    const nodeCount = nodeCountOverride || (parseInt(document.getElementById('node-count').value) || 2);
    return Math.min(nodeCount, S2D_REPAIR_MAX_RESERVED_DISKS);
}

// Auto-update the repair disk dropdown based on node count (1 per node, max 4).
// Only runs when the user has NOT manually set the value.
function updateRepairDiskCountAuto() {
    if (_repairDisksUserSet) return;
    const nodeCount = parseInt(document.getElementById('node-count').value) || 2;
    const autoValue = Math.min(nodeCount, S2D_REPAIR_MAX_RESERVED_DISKS);

    // Update both single-tier and tiered dropdowns
    const repairSelect = document.getElementById('repair-disk-count');
    const tieredRepairSelect = document.getElementById('tiered-repair-disk-count');
    if (repairSelect) repairSelect.value = autoValue;
    if (tieredRepairSelect) tieredRepairSelect.value = autoValue;

    // Mark as auto-scaled
    const isTiered = _isTieredStorage();
    const activeId = isTiered ? 'tiered-repair-disk-count' : 'repair-disk-count';
    markAutoScaled(activeId);

}

// Handler for repair disk count dropdown change (MANUAL override)
function onRepairDiskCountChange() {
    _repairDisksUserSet = true;
    const isTiered = _isTieredStorage();
    const activeId = isTiered ? 'tiered-repair-disk-count' : 'repair-disk-count';
    markManualSet(activeId);

    // Sync the other dropdown to the same value
    const value = document.getElementById(activeId).value;
    const otherId = isTiered ? 'repair-disk-count' : 'tiered-repair-disk-count';
    const otherEl = document.getElementById(otherId);
    if (otherEl) otherEl.value = value;

    onHardwareConfigChange();
}

// Track whether the vCPU ratio was auto-escalated from default (4:1) during auto-scale
let _vcpuRatioAutoEscalated = false;

// Track whether the user manually set the vCPU ratio (prevents auto-escalation from overriding)
let _vcpuRatioUserSet = false;

// Track whether the user manually set memory (prevents memory auto-scaling from overriding)
let _memoryUserSet = false;

// Track whether the user manually set CPU cores or sockets (prevents CPU auto-scaling from overriding)
let _cpuConfigUserSet = false;

// Track whether the user manually set the node count (prevents auto-node-recommendation from overriding)
let _nodeCountUserSet = false;

// Track whether the user manually set disk size or disk count (independently)
// Only the specific field the user touched is locked; the other remains auto-scalable.
let _diskSizeUserSet = false;
let _diskCountUserSet = false;

// Track disk bay consolidation details for sizing notes
let _diskConsolidationInfo = null;

// Track whether storage limits are exceeded (blocks export)
let _storageLimitExceeded = false;

// Track which hardware fields were auto-scaled so we can highlight them
let _autoScaledFields = new Set();

// Track which hardware fields were manually set by the user
let _manualFields = new Set();

// Mark a field element as manually set by the user (add green highlight + MANUAL badge)
function markManualSet(elementId) {
    _manualFields.add(elementId);
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.add('manual-set');
    // Remove any existing auto-scaled badge first
    const configRow = el.closest('.config-row');
    if (configRow) {
        const label = configRow.querySelector('label');
        if (label) {
            const autoBadge = label.querySelector('.auto-scaled-badge');
            if (autoBadge) autoBadge.remove();
            if (!label.querySelector('.manual-set-badge')) {
                const badge = document.createElement('span');
                badge.className = 'manual-set-badge';
                badge.textContent = 'manual';
                badge.title = 'This value was manually set and will not be changed by auto-scaling';
                label.appendChild(badge);
            }
        }
    }
    // Show the "Remove MANUAL overrides" button
    const clearBtn = document.getElementById('clear-manual-overrides');
    if (clearBtn) clearBtn.style.display = 'block';
}

// Clear all manual-set highlights and badges
function clearManualBadges() {
    for (const id of _manualFields) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('manual-set');
        const row = el?.closest('.config-row');
        if (row) {
            const badge = row.querySelector('.manual-set-badge');
            if (badge) badge.remove();
        }
    }
    _manualFields.clear();
    // Hide the "Remove MANUAL overrides" button
    const clearBtn = document.getElementById('clear-manual-overrides');
    if (clearBtn) clearBtn.style.display = 'none';
}

// Remove all manual overrides — resets user locks and re-runs auto-scaling
function clearAllManualOverrides() {
    _vcpuRatioUserSet = false;
    _memoryUserSet = false;
    _cpuConfigUserSet = false;
    _diskSizeUserSet = false;
    _diskCountUserSet = false;
    _nodeCountUserSet = false;
    _repairDisksUserSet = false;
    clearManualBadges();
    calculateRequirements();
}

// Human-readable names for manually-set hardware fields
const _MANUAL_FIELD_LABELS = {
    'node-count': 'Node Count',
    'vcpu-ratio': 'vCPU Ratio',
    'node-memory': 'Memory',
    'cpu-cores': 'CPU Cores',
    'cpu-sockets': 'CPU Sockets',
    'cpu-manufacturer': 'CPU Manufacturer',
    'cpu-generation': 'CPU Generation',
    'capacity-disk-size': 'Capacity Disk Size',
    'capacity-disk-count': 'Capacity Disk Count',
    'tiered-capacity-disk-size': 'Capacity Disk Size',
    'tiered-capacity-disk-count': 'Capacity Disk Count',
    'repair-disk-count': 'S2D Repair Disks',
    'tiered-repair-disk-count': 'S2D Repair Disks'
};

// Show or hide the manual-override capacity warning based on current utilization
// and active manual overrides. Called after capacity bars are updated.
function updateManualOverrideWarning(computePercent, memoryPercent, storagePercent) {
    const warningEl = document.getElementById('manual-override-warning');
    const warningText = document.getElementById('manual-override-warning-text');
    if (!warningEl || !warningText) return;

    const THRESHOLD = 90;
    const anyOver = (computePercent >= THRESHOLD || memoryPercent >= THRESHOLD || storagePercent >= THRESHOLD);

    if (!anyOver || _manualFields.size === 0 || workloads.length === 0) {
        warningEl.style.display = 'none';
        return;
    }

    // Build list of which resources are over threshold
    const overResources = [];
    if (computePercent >= THRESHOLD) overResources.push('Compute');
    if (memoryPercent >= THRESHOLD) overResources.push('Memory');
    if (storagePercent >= THRESHOLD) overResources.push('Storage');

    // Build list of active manual override labels
    const overrideLabels = [];
    for (const fieldId of _manualFields) {
        const label = _MANUAL_FIELD_LABELS[fieldId] || fieldId;
        if (!overrideLabels.includes(label)) overrideLabels.push(label);
    }

    const resourceStr = overResources.join(', ');
    const overrideStr = overrideLabels.join(', ');
    warningText.textContent = `${resourceStr} capacity cannot be auto-scaled because of MANUAL override${overrideLabels.length > 1 ? 's' : ''} on: ${overrideStr}. Remove manual overrides or adjust the locked values to accommodate the workload.`;
    warningEl.style.display = 'flex';
}

// Mark a field element as auto-scaled (add visual highlight + badge)
function markAutoScaled(elementId) {
    _autoScaledFields.add(elementId);
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.add('auto-scaled');
    el.classList.remove('manual-set');
    // Remove any manual badge first, then add auto badge
    const configRow = el.closest('.config-row');
    if (configRow) {
        const label = configRow.querySelector('label');
        if (label) {
            const manualBadge = label.querySelector('.manual-set-badge');
            if (manualBadge) manualBadge.remove();
            if (!label.querySelector('.auto-scaled-badge')) {
                const badge = document.createElement('span');
                badge.className = 'auto-scaled-badge';
                badge.textContent = 'auto';
                badge.title = 'This value was automatically adjusted to fit workload requirements';
                label.appendChild(badge);
            }
        }
    }
    // Remove highlight when user manually interacts with the field
    const clearHandler = () => {
        el.classList.remove('auto-scaled');
        _autoScaledFields.delete(elementId);
        const row = el.closest('.config-row');
        if (row) {
            const badge = row.querySelector('.auto-scaled-badge');
            if (badge) badge.remove();
        }
        el.removeEventListener('change', clearHandler);
        el.removeEventListener('input', clearHandler);
    };
    el.addEventListener('change', clearHandler, { once: true });
    el.addEventListener('input', clearHandler, { once: true });
}

// Clear all auto-scaled highlights (called at start of each auto-scale cycle)
function clearAutoScaledHighlights() {
    for (const id of _autoScaledFields) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('auto-scaled');
        const row = el?.closest('.config-row');
        if (row) {
            const badge = row.querySelector('.auto-scaled-badge');
            if (badge) badge.remove();
        }
    }
    _autoScaledFields.clear();
}

// Automatically increase CPU cores, memory, disk count, and disk size so capacity bars stay below 100%
// previouslyAutoScaled: Set of field IDs that were auto-scaled in the prior calculation cycle,
// used to re-apply AUTO badges when values haven't changed (still at auto-scaled levels).
// options.allowRatioEscalation: when true, allow vCPU ratio to escalate beyond 4:1 (default: false)
// options.allowHighMemory: when true, allow memory above 2 TB per node (default: false)
// The default conservative mode prefers adding nodes over escalating ratio or memory.

// --- AMD core upgrade helper ---
// Before escalating the vCPU ratio from 5:1 to 6:1, check if switching to an AMD
// generation with more physical cores would resolve compute pressure at the current
// ratio. Returns { manufacturer, genId, cores, sockets, genName } if a switch is
// beneficial, otherwise null. Applies the switch to the DOM (manufacturer, generation,
// cores, sockets) and marks affected fields as auto-scaled.
function _tryAmdCoreUpgrade(totalVcpus, effectiveNodes, currentRatio, currentCores, currentSockets, threshold) {
    const currentPhysCores = currentCores * currentSockets;
    const currentManufacturer = document.getElementById('cpu-manufacturer').value;

    // Find the best AMD generation whose max dual-socket cores exceeds current config
    let bestGen = null;
    let bestMaxCores = 0;
    for (const gen of CPU_GENERATIONS.amd) {
        const genMaxCores = gen.coreOptions[gen.coreOptions.length - 1];
        const genMaxPhys = genMaxCores * 2; // dual socket
        if (genMaxPhys <= currentPhysCores) continue; // no improvement possible
        if (genMaxCores > bestMaxCores) {
            bestMaxCores = genMaxCores;
            bestGen = gen;
        }
    }
    if (!bestGen) return null; // no AMD gen offers more cores

    // Find the smallest core option in the best AMD gen that resolves pressure
    const MAX_SOCKETS = 2;
    let targetCores = null;
    for (const c of bestGen.coreOptions) {
        if (c * MAX_SOCKETS <= currentPhysCores) continue; // must exceed current config
        const candidateCap = c * MAX_SOCKETS * effectiveNodes * currentRatio;
        const candidatePct = candidateCap > 0 ? Math.round(totalVcpus / candidateCap * 100) : 100;
        if (candidatePct < threshold) {
            targetCores = c;
            break;
        }
    }
    // If no single option resolves it, use max cores (still better than 6:1)
    if (!targetCores) {
        const maxCoresOption = bestGen.coreOptions[bestGen.coreOptions.length - 1];
        const maxCap = maxCoresOption * MAX_SOCKETS * effectiveNodes * currentRatio;
        const maxPct = maxCap > 0 ? Math.round(totalVcpus / maxCap * 100) : 100;
        if (maxPct >= threshold) return null; // even max AMD cores won't help at this ratio
        targetCores = maxCoresOption;
    }

    // Apply the switch to the DOM
    const mfgSelect = document.getElementById('cpu-manufacturer');
    const genSelect = document.getElementById('cpu-generation');
    const coresSelect = document.getElementById('cpu-cores');
    const socketsSelect = document.getElementById('cpu-sockets');

    // Switch manufacturer to AMD if not already
    if (currentManufacturer !== 'amd') {
        mfgSelect.value = 'amd';
        // Repopulate generation dropdown for AMD
        genSelect.innerHTML = CPU_GENERATIONS.amd.map(g =>
            `<option value="${g.id}">${g.name}</option>`
        ).join('');
        genSelect.disabled = false;
        markAutoScaled('cpu-manufacturer');
    }

    // Set generation
    genSelect.value = bestGen.id;
    markAutoScaled('cpu-generation');

    // Populate core options for the selected generation and set target
    coresSelect.innerHTML = bestGen.coreOptions.map(c =>
        `<option value="${c}">${c} cores</option>`
    ).join('');
    coresSelect.disabled = false;
    coresSelect.value = targetCores;
    markAutoScaled('cpu-cores');

    // Ensure dual socket
    socketsSelect.value = MAX_SOCKETS;
    markAutoScaled('cpu-sockets');

    return {
        manufacturer: 'amd',
        genId: bestGen.id,
        genName: bestGen.name,
        cores: targetCores,
        sockets: MAX_SOCKETS
    };
}

function autoScaleHardware(totalVcpus, totalMemoryGB, totalStorageGB, nodeCount, resiliencyMultiplier, hwConfig, previouslyAutoScaled, options) {
    const allowRatioEscalation = options && options.allowRatioEscalation;
    const allowHighMemory = options && options.allowHighMemory;
    // Preferred memory cap: 2 TB unless allowHighMemory permits the full range
    const PREFERRED_MEM_CAP_GB = 2048;
    let vcpuToCore = getVcpuRatio();
    // Note: _vcpuRatioAutoEscalated is reset once per calculateRequirements() call,
    // NOT per autoScaleHardware() call, so the flag survives multiple auto-scale passes.
    const clusterTypeForOverhead = document.getElementById('cluster-type').value;
    const hostOverheadMemoryGB = 32 + (clusterTypeForOverhead === 'aldo-mgmt' ? ALDO_APPLIANCE_OVERHEAD_GB : 0);
    const effectiveNodes = nodeCount > 1 ? nodeCount - 1 : 1;

    let changed = false;

    // --- Auto-scale CPU cores (and sockets if needed) ---
    // Skip when the user has manually set CPU cores/sockets (respect user override).
    // For ALDO management clusters, enforce minimum 24 physical cores per node
    const aldoMinCores = (clusterTypeForOverhead === 'aldo-mgmt') ? ALDO_MIN_CORES_PER_NODE : 0;
    const requiredCoresPerNode = Math.max(Math.ceil((totalVcpus + ARB_VCPU_OVERHEAD) / effectiveNodes / vcpuToCore), aldoMinCores);
    let sockets = parseInt(document.getElementById('cpu-sockets').value) || 2;
    const socketsSelect = document.getElementById('cpu-sockets');
    const SOCKET_OPTIONS = [1, 2];

    let manufacturer = document.getElementById('cpu-manufacturer').value;
    let genId = document.getElementById('cpu-generation').value;
    if (manufacturer && genId && !_cpuConfigUserSet) {
        const generation = CPU_GENERATIONS[manufacturer].find(g => g.id === genId);
        if (generation) {
            const coresSelect = document.getElementById('cpu-cores');
            const currentCores = parseInt(coresSelect.value) || 0;
            const maxCoresForGen = generation.coreOptions[generation.coreOptions.length - 1];

            // Find the smallest core option that satisfies the requirement at current sockets
            let targetCores = null;
            for (const c of generation.coreOptions) {
                if (c * sockets >= requiredCoresPerNode) {
                    targetCores = c;
                    break;
                }
            }

            // If max cores at current sockets still aren't enough, try increasing sockets
            if (targetCores === null && sockets < 2) {
                for (const s of SOCKET_OPTIONS) {
                    if (s <= sockets) continue;
                    // Re-check with more sockets — find smallest cores that work
                    for (const c of generation.coreOptions) {
                        if (c * s >= requiredCoresPerNode) {
                            targetCores = c;
                            sockets = s;
                            socketsSelect.value = s;
                            changed = true;
                            markAutoScaled('cpu-sockets');
                            break;
                        }
                    }
                    if (targetCores !== null) break;
                }
            }

            // If still no option is big enough, pick max cores and max sockets
            if (targetCores === null) {
                targetCores = maxCoresForGen;
                if (sockets < 2) {
                    sockets = 2;
                    socketsSelect.value = 2;
                    changed = true;
                    markAutoScaled('cpu-sockets');
                }
            }

            if (targetCores !== currentCores) {
                coresSelect.value = targetCores;
                changed = true;
                markAutoScaled('cpu-cores');
            } else if (previouslyAutoScaled && previouslyAutoScaled.has('cpu-cores')) {
                // Value was set by auto-scale in a prior cycle and is still adequate — re-apply badge
                markAutoScaled('cpu-cores');
            }
        }
    }

    // --- Auto-scale memory ---
    // Skip when the user has manually set memory (respect user override).
    const requiredMemPerNode = Math.ceil((totalMemoryGB + ARB_MEMORY_OVERHEAD_GB) / effectiveNodes) + hostOverheadMemoryGB;
    const memInput = document.getElementById('node-memory');
    const currentMem = parseInt(memInput.value) || 512;

    if (!_memoryUserSet) {
        // Set memory to the smallest DIMM-symmetric option that meets the requirement.
        // This also scales DOWN from a prior auto-scaled value when more nodes are
        // available (e.g. after node count increased), keeping per-node memory minimal.
        // In conservative mode (default), cap at 2 TB and let node scaling add nodes instead.
        // For ALDO management clusters, enforce minimum 96 GB per node
        const aldoMinMem = (clusterTypeForOverhead === 'aldo-mgmt') ? ALDO_MIN_MEMORY_GB : 0;
        const effectiveMinMem = Math.max(requiredMemPerNode, aldoMinMem);
        let targetMem = MEMORY_OPTIONS_GB.find(m => m >= effectiveMinMem) || MAX_MEMORY_GB;
        if (!allowHighMemory && targetMem > PREFERRED_MEM_CAP_GB) {
            targetMem = PREFERRED_MEM_CAP_GB;
        }
        if (targetMem !== currentMem) {
            memInput.value = targetMem;
            changed = true;
            markAutoScaled('node-memory');
        } else if (previouslyAutoScaled && previouslyAutoScaled.has('node-memory')) {
            // Value was set by auto-scale in a prior cycle and is still adequate — re-apply badge
            markAutoScaled('node-memory');
        }
    }

    // --- Auto-scale disk count (capacity disks) ---
    // Infrastructure_1 volume: 256 GB usable, consumes raw storage based on resiliency
    const infraVolumeUsableGB = 256;
    const infraVolumeRawGB = infraVolumeUsableGB * resiliencyMultiplier;

    // Determine which disk count / size controls to use
    const isTiered = hwConfig.diskConfig && hwConfig.diskConfig.isTiered;
    const isTieredCapped = isTiered && (hwConfig.storageConfig === 'hybrid' || hwConfig.storageConfig === 'mixed-flash');
    const diskCountId = isTiered ? 'tiered-capacity-disk-count' : 'capacity-disk-count';
    const diskSizeId = isTiered ? 'tiered-capacity-disk-size' : 'capacity-disk-size';

    // S2D repair reservation: min(nodeCount, 4) capacity disks of raw pool space reserved for repair jobs
    const diskSizeTBForRepair = parseFloat(document.getElementById(diskSizeId).value) || 3.84;
    const s2dRepairRawGB = getS2dRepairReservedGB(nodeCount, diskSizeTBForRepair * 1024);
    // Total raw storage needed across all nodes = (usable + Infrastructure_1) * resiliency multiplier + S2D repair
    const totalRawNeededGB = totalStorageGB * resiliencyMultiplier + infraVolumeRawGB + s2dRepairRawGB;
    // Raw storage each node must provide
    const rawPerNodeNeededGB = totalRawNeededGB / nodeCount;

    const diskSizeTB = parseFloat(document.getElementById(diskSizeId).value) || 3.84;
    const diskSizeGB = diskSizeTB * 1024;

    // Always reset consolidation info — even when user locked disk config
    _diskConsolidationInfo = null;

    // Disk auto-scaling: size and count are independently lockable.
    // When user manually sets disk size, count can still be auto-scaled (and vice versa).
    // Disk bay consolidation (changes both) only runs when neither is locked.
    if (diskSizeGB > 0 && (!_diskSizeUserSet || !_diskCountUserSet)) {
        const disksNeeded = Math.ceil(rawPerNodeNeededGB / diskSizeGB);
        const diskCountInput = document.getElementById(diskCountId);
        const currentDiskCount = parseInt(diskCountInput.value) || 4;

        // Set disk count to the required amount, clamped between min (2) and max for storage type
        const maxDisksForType = isTieredCapped ? MAX_TIERED_CAPACITY_DISK_COUNT : MAX_DISK_COUNT;
        let targetDisks = Math.max(MIN_DISK_COUNT, Math.min(disksNeeded, maxDisksForType));

        // --- Disk bay consolidation ---
        // When the required disk count reaches ≥50% of max bays, check if fewer
        // larger capacity disks could meet the requirement while leaving more bays
        // free for future expansion. Evaluate all larger standard sizes and pick
        // the smallest one that brings disk count below the 50% threshold; if none
        // can, pick the one that saves the most bays.
        // Only runs when BOTH size and count are auto-managed (consolidation changes both).
        const DISK_BAY_CONSOLIDATION_THRESHOLD = 0.5; // 50% of max bays
        let consolidatedDiskSize = diskSizeGB;
        const bayThreshold = Math.ceil(maxDisksForType * DISK_BAY_CONSOLIDATION_THRESHOLD);
        if (!_diskSizeUserSet && !_diskCountUserSet && targetDisks >= bayThreshold) {
            // Collect all standard sizes larger than current
            const largerSizes = DISK_SIZE_OPTIONS_TB.filter(s => s * 1024 > diskSizeGB);
            let bestCandidate = null;
            for (const candidateTB of largerSizes) {
                const candidateGB = candidateTB * 1024;
                const fewerDisks = Math.ceil(rawPerNodeNeededGB / candidateGB);
                if (fewerDisks < targetDisks && fewerDisks <= maxDisksForType) {
                    // First size that brings count below threshold wins
                    if (fewerDisks < bayThreshold) {
                        bestCandidate = { sizeTB: candidateTB, sizeGB: candidateGB, count: fewerDisks };
                        break; // smallest size that meets target — ideal
                    }
                    // Otherwise track the best bay savings so far
                    if (!bestCandidate || fewerDisks < bestCandidate.count) {
                        bestCandidate = { sizeTB: candidateTB, sizeGB: candidateGB, count: fewerDisks };
                    }
                }
            }
            if (bestCandidate) {
                _diskConsolidationInfo = {
                    originalCount: targetDisks,
                    originalSizeTB: diskSizeTB,
                    newCount: bestCandidate.count,
                    newSizeTB: bestCandidate.sizeTB,
                    maxBays: maxDisksForType,
                    baysFreed: targetDisks - bestCandidate.count
                };
                targetDisks = bestCandidate.count;
                consolidatedDiskSize = bestCandidate.sizeGB;
                // Update disk size select
                document.getElementById(diskSizeId).value = bestCandidate.sizeTB;
                // Update disk count to the consolidated (lower) value
                diskCountInput.value = bestCandidate.count;
                changed = true;
                markAutoScaled(diskSizeId);
                markAutoScaled(diskCountId);
            }
        }

        // Auto-scale disk count (when count is not user-locked).
        // Recalculates based on current disk size — including when user increased size manually.
        if (!_diskCountUserSet && !_diskConsolidationInfo && targetDisks !== currentDiskCount) {
            diskCountInput.value = targetDisks;
            changed = true;
            markAutoScaled(diskCountId);
        } else if (!_diskCountUserSet && previouslyAutoScaled && previouslyAutoScaled.has(diskCountId)) {
            markAutoScaled(diskCountId);
        }

        // --- Auto-scale disk size when disk count alone isn't enough ---
        // If we've maxed out disk count and per-node storage is still insufficient,
        // step up to the next standard disk size (3.84 → 7.68 → 15.36 TB)
        // Only when disk size is not user-locked.
        if (!_diskSizeUserSet) {
            const currentDiskCountFinal = parseInt(diskCountInput.value) || 4;
            const currentDiskSizeGB = consolidatedDiskSize;
            if (currentDiskCountFinal >= maxDisksForType) {
                const currentStoragePerNodeGB = currentDiskCountFinal * currentDiskSizeGB;
                if (currentStoragePerNodeGB < rawPerNodeNeededGB) {
                    const diskSizeSelect = document.getElementById(diskSizeId);
                    // Find the smallest standard size that provides enough per-node storage
                    for (const sizeTB of DISK_SIZE_OPTIONS_TB) {
                        const candidateGB = sizeTB * 1024;
                        if (candidateGB > currentDiskSizeGB && currentDiskCountFinal * candidateGB >= rawPerNodeNeededGB) {
                            diskSizeSelect.value = sizeTB;
                            changed = true;
                            markAutoScaled(diskSizeId);
                            break;
                        }
                    }
                    // If no standard size is big enough, set to max available
                    if (!changed || (currentDiskCountFinal * (parseFloat(document.getElementById(diskSizeId).value) * 1024)) < rawPerNodeNeededGB) {
                        const maxSize = DISK_SIZE_OPTIONS_TB[DISK_SIZE_OPTIONS_TB.length - 1];
                        if (maxSize * 1024 > currentDiskSizeGB) {
                            diskSizeSelect.value = maxSize;
                            changed = true;
                            markAutoScaled(diskSizeId);
                        }
                    }
                }
            }
        }
    }

    // --- Headroom pass: nudge cores / memory / storage up if capacity bars exceed threshold ---
    // The initial auto-scale above ensures resources fit (< 100%). This pass
    // provides additional headroom wherever a larger per-node option is available.
    // CPU & storage use 80%; memory uses a higher 85% threshold because the cost
    // jump between DIMM tiers (e.g. 1 TB → 1.5 TB) is significant, so we accept
    // slightly higher utilisation rather than over-provisioning expensive DIMMs.
    const HEADROOM_THRESHOLD = 80;
    const MEMORY_HEADROOM_THRESHOLD = 85;

    // Re-read current hardware after initial auto-scale
    let hrCores = parseInt(document.getElementById('cpu-cores').value) || 0;
    let hrSockets = parseInt(document.getElementById('cpu-sockets').value) || 2;
    let hrMemory = parseInt(document.getElementById('node-memory').value) || 512;

    // CPU headroom — bump cores first, then sockets
    // Skip when the user has manually set CPU config (respect user override).
    // Re-read manufacturer/genId in case AMD auto-switch changed them
    manufacturer = document.getElementById('cpu-manufacturer').value;
    genId = document.getElementById('cpu-generation').value;
    if (manufacturer && genId && !_cpuConfigUserSet) {
        const gen = CPU_GENERATIONS[manufacturer].find(g => g.id === genId);
        if (gen) {
            let cpuCap = hrCores * hrSockets * effectiveNodes * vcpuToCore;
            let cpuPct = cpuCap > 0 ? Math.round(totalVcpus / cpuCap * 100) : 0;
            let safety = 0;
            while (cpuPct > HEADROOM_THRESHOLD && safety < 20) {
                safety++;
                const coreIdx = gen.coreOptions.indexOf(hrCores);
                if (coreIdx >= 0 && coreIdx < gen.coreOptions.length - 1) {
                    hrCores = gen.coreOptions[coreIdx + 1];
                    document.getElementById('cpu-cores').value = hrCores;
                    changed = true;
                    markAutoScaled('cpu-cores');
                } else if (hrSockets < 2) {
                    const nextSocket = SOCKET_OPTIONS.find(s => s > hrSockets);
                    if (nextSocket) {
                        hrSockets = nextSocket;
                        document.getElementById('cpu-sockets').value = hrSockets;
                        changed = true;
                        markAutoScaled('cpu-sockets');
                    } else {
                        break;
                    }
                } else {
                    break; // maxed out on both cores and sockets
                }
                cpuCap = hrCores * hrSockets * effectiveNodes * vcpuToCore;
                cpuPct = cpuCap > 0 ? Math.round(totalVcpus / cpuCap * 100) : 0;
            }

            // vCPU ratio auto-escalation — when cores & sockets are maxed and compute ≥90%,
            // bump the overcommit ratio (4→5→6) to reduce over-threshold pressure.
            // Only auto-escalate from default (4) or a previously auto-escalated value (5).
            // Skip if the user has manually set the ratio (respect user override).
            // In conservative mode (default), skip ratio escalation entirely — prefer adding
            // nodes first. Only allow escalation in the final aggressive pass when nodes are maxed.
            //
            // Before escalating from 5→6, try switching to an AMD generation with more
            // physical cores (e.g. AMD Turin Dense with 192 cores/socket = 384 cores dual-socket).
            // This keeps the overcommit ratio lower (5:1) by adding real physical cores.
            const VCPU_ESCALATION_THRESHOLD = 90;
            const VCPU_RATIO_STEPS = [5, 6];
            if (allowRatioEscalation && !_vcpuRatioUserSet && cpuPct >= VCPU_ESCALATION_THRESHOLD && vcpuToCore >= 4 && vcpuToCore < 6) {
                for (const nextRatio of VCPU_RATIO_STEPS) {
                    if (nextRatio <= vcpuToCore) continue; // skip ratios we're already at or past

                    // Before jumping to 6:1, try switching to AMD with higher core counts
                    // at the current ratio. Only attempt when currently on Intel or an AMD
                    // generation whose max cores are lower than what's available in other
                    // AMD generations.
                    if (nextRatio === 6) {
                        const amdSwitch = _tryAmdCoreUpgrade(
                            totalVcpus, effectiveNodes, vcpuToCore,
                            hrCores, hrSockets, VCPU_ESCALATION_THRESHOLD
                        );
                        if (amdSwitch) {
                            // AMD switch resolved compute pressure — apply the change
                            hrCores = amdSwitch.cores;
                            hrSockets = amdSwitch.sockets;
                            changed = true;
                            cpuCap = hrCores * hrSockets * effectiveNodes * vcpuToCore;
                            cpuPct = cpuCap > 0 ? Math.round(totalVcpus / cpuCap * 100) : 0;
                            if (cpuPct < VCPU_ESCALATION_THRESHOLD) {
                                // AMD cores resolved pressure at 5:1 — check if we can
                                // step back to 4:1 and still stay under threshold
                                const pctAt4 = Math.round(totalVcpus / (hrCores * hrSockets * effectiveNodes * 4) * 100);
                                if (pctAt4 < VCPU_ESCALATION_THRESHOLD) {
                                    vcpuToCore = 4;
                                    document.getElementById('vcpu-ratio').value = 4;
                                    // Ratio back at default — no auto-escalation badge needed
                                    _vcpuRatioAutoEscalated = false;
                                }
                                break; // resolved, skip 6:1
                            }
                        }
                    }

                    vcpuToCore = nextRatio;
                    document.getElementById('vcpu-ratio').value = nextRatio;
                    changed = true;
                    markAutoScaled('vcpu-ratio');
                    _vcpuRatioAutoEscalated = true;
                    cpuCap = hrCores * hrSockets * effectiveNodes * vcpuToCore;
                    cpuPct = cpuCap > 0 ? Math.round(totalVcpus / cpuCap * 100) : 0;
                    if (cpuPct < VCPU_ESCALATION_THRESHOLD) break;
                }
            } else if (previouslyAutoScaled && previouslyAutoScaled.has('vcpu-ratio')) {
                // Ratio was auto-escalated in a prior cycle and is still adequate — re-apply badge
                markAutoScaled('vcpu-ratio');
                _vcpuRatioAutoEscalated = true;
            }
        }
    }

    // Memory headroom — step through DIMM-symmetric options until below threshold or maxed.
    // Uses higher threshold (85%) than CPU/storage to avoid expensive DIMM tier jumps.
    // Prefer adding nodes over expensive high-capacity DIMMs:
    //   - Small clusters (< 10 nodes): cap at 1.5 TB
    //   - Default (conservative) mode: cap at 2 TB
    //   - Aggressive mode (allowHighMemory): full range up to 4 TB
    // Skip when the user has manually set memory (respect user override).
    if (!_memoryUserSet) {
        const baseMemCap = allowHighMemory ? MAX_MEMORY_GB : PREFERRED_MEM_CAP_GB;
        const memCapLimit = nodeCount < NODE_WEIGHT_LARGE_CLUSTER_THRESHOLD
            ? Math.min(NODE_WEIGHT_PREFERRED_MEMORY_GB, baseMemCap)
            : baseMemCap;
        let memCap = (hrMemory - hostOverheadMemoryGB) * effectiveNodes - ARB_MEMORY_OVERHEAD_GB;
        let memPct = memCap > 0 ? Math.round(totalMemoryGB / memCap * 100) : 0;
        let memIdx = MEMORY_OPTIONS_GB.indexOf(hrMemory);
        if (memIdx < 0) memIdx = MEMORY_OPTIONS_GB.findIndex(m => m >= hrMemory);
        while (memPct > MEMORY_HEADROOM_THRESHOLD && memIdx < MEMORY_OPTIONS_GB.length - 1) {
            const nextMem = MEMORY_OPTIONS_GB[memIdx + 1];
            // For small clusters, don't exceed the preferred memory cap — let node scaling handle it
            if (nextMem > memCapLimit) break;
            memIdx++;
            hrMemory = nextMem;
            document.getElementById('node-memory').value = hrMemory;
            changed = true;
            markAutoScaled('node-memory');
            memCap = (hrMemory - hostOverheadMemoryGB) * effectiveNodes - ARB_MEMORY_OVERHEAD_GB;
            memPct = memCap > 0 ? Math.round(totalMemoryGB / memCap * 100) : 0;
        }
    }

    // Storage headroom — bump disk count first, then disk size, until below threshold
    // Each action respects its own user-lock flag independently.
    if (!_diskCountUserSet || !_diskSizeUserSet) {
        const hrDiskCountInput = document.getElementById(diskCountId);
        const hrDiskSizeSelect = document.getElementById(diskSizeId);
        let hrDiskCount = parseInt(hrDiskCountInput.value) || 4;
        const hrDiskSizeTB = parseFloat(hrDiskSizeSelect.value) || 3.84;
        let hrDiskSizeGB = hrDiskSizeTB * 1024;
        let storageCap = hrDiskCount * hrDiskSizeGB * nodeCount;
        let storagePct = storageCap > 0 ? Math.round(totalRawNeededGB / storageCap * 100) : 0;
        const diskCountBeforeHeadroom = hrDiskCount;
        let storageSafety = 0;
        while (storagePct > HEADROOM_THRESHOLD && storageSafety < 30) {
            storageSafety++;
            // Try increasing disk count first (if not user-locked)
            const hrMaxDisks = isTieredCapped ? MAX_TIERED_CAPACITY_DISK_COUNT : MAX_DISK_COUNT;
            if (!_diskCountUserSet && hrDiskCount < hrMaxDisks) {
                hrDiskCount++;
                hrDiskCountInput.value = hrDiskCount;
                changed = true;
                markAutoScaled(diskCountId);
            } else if (!_diskSizeUserSet) {
                // Disk count maxed or user-locked — try stepping up disk size
                const nextSize = DISK_SIZE_OPTIONS_TB.find(s => s * 1024 > hrDiskSizeGB);
                if (nextSize) {
                    hrDiskSizeGB = nextSize * 1024;
                    hrDiskSizeSelect.value = nextSize;
                    changed = true;
                    markAutoScaled(diskSizeId);
                } else {
                    break; // maxed out on available disk size options
                }
            } else {
                break; // both dimensions are user-locked or maxed
            }
            storageCap = hrDiskCount * hrDiskSizeGB * nodeCount;
            storagePct = storageCap > 0 ? Math.round(totalRawNeededGB / storageCap * 100) : 0;
        }

        // If storage headroom bumped disk count after consolidation, update the
        // consolidation info so the sizing note reflects the actual final count.
        if (_diskConsolidationInfo && hrDiskCount !== diskCountBeforeHeadroom) {
            _diskConsolidationInfo.newCount = hrDiskCount;
            _diskConsolidationInfo.baysFreed = _diskConsolidationInfo.originalCount - hrDiskCount;
        }
    }

    // --- Enforce 1:2 cache-to-capacity ratio for hybrid storage ---
    if (isTiered && (hwConfig.storageConfig === 'hybrid' || hwConfig.storageConfig === 'mixed-flash')) {
        const finalCapacityCount = parseInt(document.getElementById(diskCountId).value) || 4;
        const targetCacheCount = Math.ceil(finalCapacityCount / 2);
        const cacheDiskInput = document.getElementById('cache-disk-count');
        const currentCacheCount = parseInt(cacheDiskInput.value) || 2;

        if (currentCacheCount < targetCacheCount) {
            cacheDiskInput.value = Math.min(targetCacheCount, MAX_CACHE_DISK_COUNT);
            changed = true;
            markAutoScaled('cache-disk-count');
        }
    }

    return changed;
}

// Flag to prevent recursive calculation
let isCalculating = false;

// ============================================
// State Persistence (Save / Resume / Start Fresh)
// ============================================

// Gather current sizer state into a serializable object
function getSizerState() {
    return {
        clusterType: document.getElementById('cluster-type').value,
        nodeCount: document.getElementById('node-count').value,
        nodeCountUserSet: _nodeCountUserSet,
        futureGrowth: document.getElementById('future-growth').value,
        resiliency: document.getElementById('resiliency').value,
        cpuManufacturer: document.getElementById('cpu-manufacturer').value,
        cpuGeneration: document.getElementById('cpu-generation').value,
        cpuCores: document.getElementById('cpu-cores').value,
        cpuSockets: document.getElementById('cpu-sockets').value,
        cpuConfigUserSet: _cpuConfigUserSet,
        nodeMemory: document.getElementById('node-memory').value,
        memoryUserSet: _memoryUserSet,
        gpuCount: document.getElementById('gpu-count').value,
        gpuType: document.getElementById('gpu-type').value,
        vcpuRatio: document.getElementById('vcpu-ratio').value,
        vcpuRatioUserSet: _vcpuRatioUserSet,
        storageConfig: document.getElementById('storage-config').value,
        storageTiering: document.getElementById('storage-tiering').value,
        capacityDiskCount: document.getElementById('capacity-disk-count').value,
        capacityDiskSize: document.getElementById('capacity-disk-size').value,
        cacheDiskCount: document.getElementById('cache-disk-count').value,
        cacheDiskSize: document.getElementById('cache-disk-size').value,
        tieredCapacityDiskCount: document.getElementById('tiered-capacity-disk-count').value,
        tieredCapacityDiskSize: document.getElementById('tiered-capacity-disk-size').value,
        diskSizeUserSet: _diskSizeUserSet,
        diskCountUserSet: _diskCountUserSet,
        repairDiskCount: document.getElementById('repair-disk-count').value,
        repairDisksUserSet: _repairDisksUserSet,
        workloads: workloads,
        workloadIdCounter: workloadIdCounter
    };
}

// Save sizer state to localStorage
function saveSizerState() {
    try {
        const stateWithMeta = {
            version: SIZER_VERSION,
            timestamp: new Date().toISOString(),
            data: getSizerState()
        };
        localStorage.setItem(SIZER_STATE_KEY, JSON.stringify(stateWithMeta));
        localStorage.setItem(SIZER_TIMESTAMP_KEY, stateWithMeta.timestamp);
    } catch (e) {
        console.warn('Failed to save sizer state:', e);
    }
}

// Load sizer state from localStorage
function loadSizerState() {
    try {
        const saved = localStorage.getItem(SIZER_STATE_KEY);
        if (!saved) return null;
        const parsed = JSON.parse(saved);
        if (parsed.version && parsed.data) return parsed;
        return null;
    } catch (e) {
        console.warn('Failed to load sizer state:', e);
        return null;
    }
}

// Clear saved sizer state
function clearSizerState() {
    try {
        localStorage.removeItem(SIZER_STATE_KEY);
        localStorage.removeItem(SIZER_TIMESTAMP_KEY);
    } catch (e) {
        console.warn('Failed to clear sizer state:', e);
    }
}

// ============================================
// DESIGNER-TO-SIZER IMPORT
// ============================================
// When the Designer transfers deployment type and node count to the Sizer,
// we pre-populate the cluster config and show a confirmation banner.
// ============================================

function checkForDesignerImport() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') !== 'designer') return false;

    try {
        const raw = localStorage.getItem('odinDesignerToSizer');
        if (!raw) return false;

        const payload = JSON.parse(raw);
        if (!payload || payload.source !== 'designer') return false;

        // Apply cluster type
        const clusterTypeSelect = document.getElementById('cluster-type');
        if (clusterTypeSelect && payload.clusterType) {
            clusterTypeSelect.value = payload.clusterType;
        }

        // Trigger cluster type change handlers to update node options, storage, etc.
        updateNodeOptionsForClusterType();
        updateStorageForClusterType();
        updateResiliencyOptions();
        updateAldoWorkloadButtons();

        // Apply node count (after node options are updated for the cluster type)
        const nodeCountSelect = document.getElementById('node-count');
        if (nodeCountSelect && payload.nodeCount) {
            // Check the option exists before setting
            const optionExists = Array.from(nodeCountSelect.options).some(
                function(opt) { return opt.value === payload.nodeCount; }
            );
            if (optionExists) {
                nodeCountSelect.value = payload.nodeCount;
            }
        }

        // Clean up payload
        localStorage.removeItem('odinDesignerToSizer');

        // Clean URL
        if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Build cluster type label for banner
        const clusterLabels = {
            'single': 'Single Node',
            'standard': 'Standard Cluster',
            'rack-aware': 'Rack-Aware Cluster',
            'aldo-mgmt': 'ALDO Management Cluster',
            'aldo-wl': 'ALDO Workload Cluster'
        };
        const typeLabel = clusterLabels[payload.clusterType] || payload.clusterType;
        const nodeLabel = payload.nodeCount === '1' ? '1 node' : (payload.nodeCount + ' nodes');

        // Show confirmation banner
        const banner = document.createElement('div');
        banner.id = 'designer-import-banner';
        banner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;padding:16px 24px;background:linear-gradient(135deg,rgba(139,92,246,0.95),rgba(59,130,246,0.95));color:white;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-size:14px;font-weight:500;display:flex;align-items:center;gap:16px;animation:slideDown 0.3s ease;max-width:600px;';
        banner.innerHTML = '<div style="flex:1;"><div style="font-weight:700;margin-bottom:4px;">Designer Configuration Imported</div><div style="font-size:12px;opacity:0.9;">' +
            typeLabel + ' \u2022 ' + nodeLabel + ' \u2014 add workloads to size your hardware</div></div>' +
            '<button onclick="this.parentElement.remove()" style="padding:8px 16px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Dismiss</button>';
        document.body.appendChild(banner);

        // Auto-dismiss after 8 seconds
        setTimeout(function() {
            const el = document.getElementById('designer-import-banner');
            if (el) el.remove();
        }, 8000);

        return true;
    } catch (e) {
        console.warn('Failed to import designer configuration:', e);
        return false;
    }
}

// Check for saved state and show resume banner
function checkForSavedSizerState() {
    const saved = loadSizerState();
    if (!saved || !saved.data) return;

    // Only show if there are workloads or non-default settings
    const d = saved.data;
    const hasWorkloads = d.workloads && d.workloads.length > 0;
    const hasNonDefaults = (d.clusterType !== 'standard' && d.clusterType !== 'aldo-mgmt' && d.clusterType !== 'aldo-wl') || d.nodeCount !== '3' ||
        d.resiliency !== '3way' || d.futureGrowth !== '0';
    if (!hasWorkloads && !hasNonDefaults) return;

    const timestamp = saved.timestamp ? new Date(saved.timestamp).toLocaleString() : 'Unknown time';
    const workloadCount = d.workloads ? d.workloads.length : 0;

    const banner = document.createElement('div');
    banner.id = 'sizer-resume-banner';
    banner.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        padding: 16px 24px;
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95));
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 16px;
        animation: slideDown 0.3s ease;
        max-width: 600px;
    `;

    const details = workloadCount > 0
        ? `${workloadCount} workload(s) • Last saved: ${timestamp}`
        : `Last saved: ${timestamp}`;

    banner.innerHTML = `
        <div style="flex: 1;">
            <div style="font-weight: 700; margin-bottom: 4px;">Previous Sizer Session Found</div>
            <div style="font-size: 12px; opacity: 0.9;">${details}</div>
        </div>
        <button onclick="resumeSizerState()" style="padding: 8px 16px; background: white; color: #2563eb; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Resume</button>
        <button onclick="startSizerFresh()" style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Start Fresh</button>
    `;

    document.body.appendChild(banner);
}

// Resume saved sizer state
function resumeSizerState() {
    const saved = loadSizerState();
    if (!saved || !saved.data) return;
    const d = saved.data;

    // Restore cluster config
    document.getElementById('cluster-type').value = d.clusterType || 'standard';
    updateNodeOptionsForClusterType();
    updateStorageForClusterType();
    document.getElementById('node-count').value = d.nodeCount || '3';
    document.getElementById('future-growth').value = d.futureGrowth || '0';

    // Restore CPU config
    document.getElementById('cpu-manufacturer').value = d.cpuManufacturer || 'intel';
    // Re-populate generations for manufacturer
    const manufacturer = d.cpuManufacturer || 'intel';
    const generations = CPU_GENERATIONS[manufacturer];
    const genSelect = document.getElementById('cpu-generation');
    genSelect.innerHTML = generations.map(g =>
        `<option value="${g.id}">${g.name}</option>`
    ).join('');
    genSelect.disabled = false;
    genSelect.value = d.cpuGeneration || generations[0].id;

    // Re-populate core options for generation
    const gen = generations.find(g => g.id === (d.cpuGeneration || generations[0].id));
    if (gen) {
        const coresSelect = document.getElementById('cpu-cores');
        coresSelect.innerHTML = gen.coreOptions.map(c =>
            `<option value="${c}">${c} cores</option>`
        ).join('');
        coresSelect.disabled = false;
        coresSelect.value = d.cpuCores || '24';
    }

    document.getElementById('cpu-sockets').value = d.cpuSockets || '2';
    document.getElementById('node-memory').value = d.nodeMemory || '512';

    // Restore GPU config
    document.getElementById('gpu-count').value = d.gpuCount || '0';
    document.getElementById('gpu-type').value = d.gpuType || 'a2';
    updateGpuTypeVisibility();

    // Restore vCPU ratio
    if (d.vcpuRatio) {
        document.getElementById('vcpu-ratio').value = d.vcpuRatio;
    }

    // Restore storage config (must trigger change to populate tiering options)
    document.getElementById('storage-config').value = d.storageConfig || 'all-flash';
    onStorageConfigChange();
    if (d.storageTiering) {
        document.getElementById('storage-tiering').value = d.storageTiering;
        onStorageTieringChange();
    }

    // Restore disk configs
    document.getElementById('capacity-disk-count').value = d.capacityDiskCount || '4';
    document.getElementById('capacity-disk-size').value = d.capacityDiskSize || '3.84';
    document.getElementById('cache-disk-count').value = d.cacheDiskCount || '2';
    document.getElementById('cache-disk-size').value = d.cacheDiskSize || '1.92';
    document.getElementById('tiered-capacity-disk-count').value = d.tieredCapacityDiskCount || '4';
    document.getElementById('tiered-capacity-disk-size').value = d.tieredCapacityDiskSize || '3.84';

    // Restore resiliency (after node count is set so options are correct)
    updateResiliencyOptions();
    if (d.resiliency) {
        const resSelect = document.getElementById('resiliency');
        const validOptions = Array.from(resSelect.options).map(o => o.value);
        if (validOptions.includes(d.resiliency)) {
            resSelect.value = d.resiliency;
        }
    }

    // Restore workloads
    workloads = d.workloads || [];
    workloadIdCounter = d.workloadIdCounter || 0;

    // Restore all MANUAL override flags
    _nodeCountUserSet = !!d.nodeCountUserSet;
    if (_nodeCountUserSet) {
        markManualSet('node-count');
    }

    _vcpuRatioUserSet = !!d.vcpuRatioUserSet;
    if (_vcpuRatioUserSet) {
        markManualSet('vcpu-ratio');
    }

    _memoryUserSet = !!d.memoryUserSet;
    if (_memoryUserSet) {
        markManualSet('node-memory');
    }

    _cpuConfigUserSet = !!d.cpuConfigUserSet;
    if (_cpuConfigUserSet) {
        markManualSet('cpu-manufacturer');
        markManualSet('cpu-generation');
        markManualSet('cpu-cores');
        markManualSet('cpu-sockets');
    }

    _diskSizeUserSet = !!d.diskSizeUserSet;
    if (_diskSizeUserSet) {
        const isTiered = _isTieredStorage();
        markManualSet(isTiered ? 'tiered-capacity-disk-size' : 'capacity-disk-size');
    }

    _diskCountUserSet = !!d.diskCountUserSet;
    if (_diskCountUserSet) {
        const isTiered = _isTieredStorage();
        markManualSet(isTiered ? 'tiered-capacity-disk-count' : 'capacity-disk-count');
    }

    // Restore repair disk count
    _repairDisksUserSet = !!d.repairDisksUserSet;
    if (d.repairDiskCount !== undefined) {
        document.getElementById('repair-disk-count').value = d.repairDiskCount;
        document.getElementById('tiered-repair-disk-count').value = d.repairDiskCount;
        if (_repairDisksUserSet) {
            markManualSet('repair-disk-count');
            markManualSet('tiered-repair-disk-count');
        }
    }

    // Update UI
    updateAldoWorkloadButtons();
    updateClusterInfo();
    renderWorkloads();
    calculateRequirements();

    dismissSizerResumeBanner();
}

// Start fresh - clear saved state and reset
function startSizerFresh() {
    clearSizerState();
    dismissSizerResumeBanner();
    resetScenario();
}

// Dismiss the resume banner
function dismissSizerResumeBanner() {
    const banner = document.getElementById('sizer-resume-banner');
    if (banner) {
        banner.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => banner.remove(), 300);
    }
}

// ============================================
// Workload Configuration
// ============================================

// Workload scenarios storage
let workloads = [];
let workloadIdCounter = 0;

// Cached reference to #empty-state element (survives innerHTML replacement)
let _emptyStateEl = null;

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
        profile: 'medium', // light, medium, heavy, power
        sessionType: 'multi', // multi or single
        concurrency: 90,
        fslogix: false,
        fslogixSize: 30,
        userCount: 50
    }
};

// AVD Profile specifications — multi-session per-user shares, single-session per-VM
const AVD_PROFILES = {
    light: {
        name: 'Light',
        description: 'Task workers (basic data entry, web browsing)',
        maxUsersPerVcpu: 6,
        multi:  { vcpusPerUser: 0.5, memoryPerUser: 2,  storagePerUser: 20 },
        single: { vcpusPerUser: 2,   memoryPerUser: 8,  storagePerUser: 32 }
    },
    medium: {
        name: 'Medium',
        description: 'Knowledge workers (Office, email, multi-tasking)',
        maxUsersPerVcpu: 4,
        multi:  { vcpusPerUser: 1,   memoryPerUser: 4,  storagePerUser: 40 },
        single: { vcpusPerUser: 4,   memoryPerUser: 16, storagePerUser: 32 }
    },
    heavy: {
        name: 'Heavy',
        description: 'Engineers & content creators (dev, Outlook, PowerPoint)',
        maxUsersPerVcpu: 2,
        multi:  { vcpusPerUser: 1.5, memoryPerUser: 6,  storagePerUser: 60 },
        single: { vcpusPerUser: 8,   memoryPerUser: 32, storagePerUser: 32 }
    },
    power: {
        name: 'Power',
        description: 'Graphic designers, 3D modelers, CAD/CAM, ML',
        maxUsersPerVcpu: 1,
        multi:  { vcpusPerUser: 2,   memoryPerUser: 8,  storagePerUser: 80 },
        single: { vcpusPerUser: 8,   memoryPerUser: 32, storagePerUser: 80 }
    },
    custom: {
        name: 'Custom',
        description: 'Custom per-user resource specification',
        maxUsersPerVcpu: 4,
        multi:  { vcpusPerUser: 2,   memoryPerUser: 8,  storagePerUser: 50 },
        single: { vcpusPerUser: 4,   memoryPerUser: 16, storagePerUser: 50 }
    }
};

// Storage resiliency multipliers and minimum nodes
const RESILIENCY_CONFIG = {
    'simple': { multiplier: 1, minNodes: 1, name: 'Simple (No Fault Tolerance)', singleNodeOnly: true },
    '2way': { multiplier: 2, minNodes: 1, name: 'Two-way Mirror' },
    '3way': { multiplier: 3, minNodes: 3, name: 'Three-way Mirror' },
    '4way': { multiplier: 4, minNodes: 4, name: 'Four-way Mirror' }
};



// Current modal state
let currentModalType = null;

// Handle node count change
function onNodeCountChange() {
    _nodeCountUserSet = true;
    markManualSet('node-count');
    updateResiliencyOptions();
    updateResiliencyRecommendation();
    updateClusterInfo();
    calculateRequirements();
}

// Handle cluster type change (single / standard / rack-aware)
function onClusterTypeChange() {
    const clusterType = document.getElementById('cluster-type').value;
    const wasAldo = workloads.some(w => w.isAldoFixed);
    const isAldo = clusterType === 'aldo-mgmt';

    // Switching TO aldo-mgmt: clear workloads and add IRVM1
    if (isAldo && !wasAldo) {
        workloads = [];
        const irvm = Object.assign({}, ALDO_IRVM, { id: ++workloadIdCounter });
        workloads.push(irvm);
        renderWorkloads();
        // Track ALDO Management Cluster selection for analytics
        if (typeof trackFormCompletion === 'function') {
            trackFormCompletion('sizerCalculation');
        }
    }
    // Switching AWAY from aldo-mgmt: remove the fixed IRVM workload
    if (!isAldo && wasAldo) {
        workloads = workloads.filter(w => !w.isAldoFixed);
        renderWorkloads();
    }

    updateAldoWorkloadButtons();
    updateNodeOptionsForClusterType();
    updateStorageForClusterType();
    updateResiliencyOptions();
    updateResiliencyRecommendation();
    updateClusterInfo();
    enforceAldoMinimums();
    calculateRequirements();
}

// Enable/disable workload add buttons for ALDO Management Cluster
function updateAldoWorkloadButtons() {
    const clusterType = document.getElementById('cluster-type').value;
    const isAldo = clusterType === 'aldo-mgmt';
    const buttons = document.querySelectorAll('.workload-type-btn');
    buttons.forEach(btn => {
        btn.disabled = isAldo;
        btn.style.opacity = isAldo ? '0.4' : '';
        btn.style.cursor = isAldo ? 'not-allowed' : '';
        btn.title = isAldo ? 'Workloads are fixed for ALDO Management Cluster' : '';
    });
}

// Enforce ALDO Management Cluster minimum hardware requirements
// Sets memory, CPU cores, and storage to documented minimums when below threshold
function enforceAldoMinimums() {
    const clusterType = document.getElementById('cluster-type').value;
    if (clusterType !== 'aldo-mgmt') return;

    // Enforce minimum memory: 96 GB per node
    const memInput = document.getElementById('node-memory');
    if (memInput) {
        const currentMem = parseInt(memInput.value) || 0;
        if (currentMem < ALDO_MIN_MEMORY_GB) {
            const minOption = MEMORY_OPTIONS_GB.find(m => m >= ALDO_MIN_MEMORY_GB) || ALDO_MIN_MEMORY_GB;
            memInput.value = minOption;
        }
    }

    // Enforce minimum cores: 24 physical cores per node (cores × sockets ≥ 24)
    const coresSelect = document.getElementById('cpu-cores');
    const socketsSelect = document.getElementById('cpu-sockets');
    if (coresSelect && socketsSelect) {
        const cores = parseInt(coresSelect.value) || 0;
        const sockets = parseInt(socketsSelect.value) || 2;
        if (cores * sockets < ALDO_MIN_CORES_PER_NODE) {
            // Try to meet requirement by increasing cores first
            const manufacturer = document.getElementById('cpu-manufacturer').value;
            const genId = document.getElementById('cpu-generation').value;
            if (manufacturer && genId) {
                const generation = CPU_GENERATIONS[manufacturer].find(g => g.id === genId);
                if (generation) {
                    const targetCores = generation.coreOptions.find(c => c * sockets >= ALDO_MIN_CORES_PER_NODE);
                    if (targetCores) {
                        coresSelect.value = targetCores;
                    } else if (sockets < 2) {
                        // Increase sockets if needed
                        socketsSelect.value = 2;
                        const targetCores2 = generation.coreOptions.find(c => c * 2 >= ALDO_MIN_CORES_PER_NODE);
                        if (targetCores2) coresSelect.value = targetCores2;
                    }
                }
            }
        }
    }

    // Enforce minimum storage: 2 TB per node
    const diskSizeSelect = document.getElementById('capacity-disk-size');
    const diskCountInput = document.getElementById('capacity-disk-count');
    if (diskSizeSelect && diskCountInput) {
        const diskSizeTB = parseFloat(diskSizeSelect.value) || 0;
        const diskCount = parseInt(diskCountInput.value) || 0;
        const totalPerNodeTB = diskSizeTB * diskCount;
        if (totalPerNodeTB < ALDO_MIN_STORAGE_PER_NODE_TB) {
            // Prefer increasing disk size first, then count
            const minSize = DISK_SIZE_OPTIONS_TB.find(s => s * diskCount >= ALDO_MIN_STORAGE_PER_NODE_TB);
            if (minSize) {
                diskSizeSelect.value = minSize;
            } else {
                // Increase disk count at current size
                const minCount = Math.ceil(ALDO_MIN_STORAGE_PER_NODE_TB / diskSizeTB);
                diskCountInput.value = Math.min(minCount, MAX_DISK_COUNT);
            }
        }
    }
}

// Enforce storage constraints based on cluster type
function updateStorageForClusterType() {
    const clusterType = document.getElementById('cluster-type').value;
    const storageSelect = document.getElementById('storage-config');
    if (!storageSelect) return; // Guard for test harness
    if (clusterType === 'rack-aware' || clusterType === 'single' || clusterType === 'aldo-mgmt') {
        // Rack-aware, single-node, and ALDO management require all-flash
        storageSelect.value = 'all-flash';
        storageSelect.disabled = true;
        onStorageConfigChange();
    } else {
        storageSelect.disabled = false;
    }
}

// Handle resiliency change
function onResiliencyChange() {
    updateResiliencyRecommendation();
    updateClusterInfo();
    calculateRequirements({ skipAutoNodeRecommend: true });
}

// Show a recommendation warning when user picks 2-way on a standard 3+ node cluster
function updateResiliencyRecommendation() {
    const el = document.getElementById('resiliency-recommendation');
    if (!el) return;
    const clusterType = document.getElementById('cluster-type').value;
    const nodeCount = parseInt(document.getElementById('node-count').value) || 3;
    const resiliency = document.getElementById('resiliency').value;
    // Show warning only for standard or aldo-wl clusters with 3+ nodes that chose 2-way mirror
    el.style.display = ((clusterType === 'standard' || clusterType === 'aldo-wl') && nodeCount >= 3 && resiliency === '2way') ? 'flex' : 'none';
}

// Update node count options based on cluster type
function updateNodeOptionsForClusterType() {
    const clusterType = document.getElementById('cluster-type').value;
    const nodeSelect = document.getElementById('node-count');
    const currentValue = parseInt(nodeSelect.value) || 3;
    
    if (clusterType === 'single') {
        // Single node: fixed at 1, disable dropdown
        nodeSelect.innerHTML = '<option value="1">1 Node</option>';
        nodeSelect.value = 1;
        nodeSelect.disabled = true;
    } else if (clusterType === 'aldo-mgmt') {
        // ALDO Management Cluster: fixed at 3 nodes
        nodeSelect.innerHTML = '<option value="3">3 Nodes (ALDO Management)</option>';
        nodeSelect.value = 3;
        nodeSelect.disabled = true;
    } else if (clusterType === 'rack-aware') {
        // Rack-aware: only 2, 4, 6, 8 nodes (even numbers for balanced rack distribution)
        nodeSelect.disabled = false;
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
        // Standard cluster: 2-16 nodes
        nodeSelect.disabled = false;
        const nodeOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        nodeSelect.innerHTML = nodeOptions.map(n => `<option value="${n}">${n} Nodes</option>`).join('');
        
        // Preserve current value if valid
        if (nodeOptions.includes(currentValue)) {
            nodeSelect.value = currentValue;
        } else {
            nodeSelect.value = 2;
        }
    }
}

// Update resiliency options based on cluster type and node count
function updateResiliencyOptions() {
    const clusterType = document.getElementById('cluster-type').value;
    const nodeCount = parseInt(document.getElementById('node-count').value) || 1;
    const resiliencySelect = document.getElementById('resiliency');
    const currentResiliency = resiliencySelect.value;
    
    // Build resiliency options based on cluster type and node count
    let options = '';
    
    if (clusterType === 'single') {
        // Single node: only simple and 2-way mirror available
        options = `
            <option value="simple">Simple (No Fault Tolerance - 1 drive)</option>
            <option value="2way">Two-way Mirror (2+ drives, single fault tolerance)</option>
        `;
    } else if (clusterType === 'aldo-mgmt') {
        // ALDO Management: fixed 3 nodes, three-way mirror only
        options = `
            <option value="3way">Three-way Mirror (33% efficiency)</option>
        `;
    } else if (clusterType === 'rack-aware') {
        // Rack-aware: 2-node = 2-way mirror only; 4/6/8-node = 4-way mirror only
        if (nodeCount <= 2) {
            options = `
                <option value="2way">Two-way Mirror (50% efficiency)</option>
            `;
        } else {
            options = `
                <option value="4way">Four-way Mirror (25% efficiency)</option>
            `;
        }
    } else if (nodeCount === 2) {
        // 2 nodes: 2-way mirror
        options = `
            <option value="2way">Two-way Mirror (min 2 nodes)</option>
        `;
    } else {
        // 3+ nodes: three-way mirror only
        options = `
            <option value="3way">Three-way Mirror (33% efficiency)</option>
        `;
    }
    
    resiliencySelect.innerHTML = options;
    
    // Default selection: for standard clusters with 3+ nodes, prefer 3-way mirror;
    // otherwise keep current selection if still valid
    const validOptions = Array.from(resiliencySelect.options).map(o => o.value);
    if (clusterType === 'rack-aware') {
        // Rack-aware has only one option per node count — already selected
    } else if (clusterType === 'single') {
        // Single node: default to 2-way mirror for fault tolerance
        resiliencySelect.value = '2way';
    } else if (clusterType === 'aldo-mgmt') {
        // ALDO Management: default to 3-way mirror
        resiliencySelect.value = '3way';
    } else if (validOptions.includes('3way')) {
        resiliencySelect.value = '3way';
    } else if (validOptions.includes(currentResiliency)) {
        resiliencySelect.value = currentResiliency;
    }
}

// Update cluster info text (3-way mirror warning - shown only when relevant)
function updateClusterInfo() {
    const resiliency = document.getElementById('resiliency').value;
    const clusterType = document.getElementById('cluster-type').value;
    const nodeCount = parseInt(document.getElementById('node-count').value) || 1;
    const config = RESILIENCY_CONFIG[resiliency];
    const infoDiv = document.getElementById('cluster-info');
    const infoText = document.getElementById('cluster-info-text');
    
    // Only show warning when resiliency requirements aren't met
    let showWarning = false;
    let message = '';
    
    if (clusterType !== 'single' && clusterType !== 'rack-aware' && clusterType !== 'aldo-mgmt' && resiliency === '3way' && nodeCount < config.minNodes) {
        showWarning = true;
        message = `Warning: Three-way Mirror requires minimum ${config.minNodes} fault domains (nodes). Current configuration has only ${nodeCount} nodes.`;
    }
    
    infoDiv.style.display = showWarning ? 'flex' : 'none';
    infoText.textContent = message;
    
    // Update N+1 tip text based on cluster type
    updateNodeTip();
}

// Update the N+1 capacity tip below node count
function updateNodeTip() {
    const clusterType = document.getElementById('cluster-type').value;
    const tipDiv = document.getElementById('node-n1-tip');
    const tipText = document.getElementById('node-n1-tip-text');
    
    if (clusterType === 'single') {
        tipText.textContent = 'Tip: Single node clusters will always incur workload downtime during updates. No N+1 capacity is available.';
    } else if (clusterType === 'aldo-mgmt') {
        tipText.textContent = 'Tip: ALDO Management Cluster is fixed at 3 nodes. N+1 capacity is reserved for maintenance (2 effective nodes during servicing).';
    } else if (clusterType === 'aldo-wl') {
        tipText.textContent = 'Tip: ALDO Workload Cluster is used for disconnected operations workloads. N+1 capacity is reserved for maintenance (ability to drain a node during servicing).';
    } else {
        tipText.textContent = 'Tip: Minimum N+1 capacity must be reserved for Compute and Memory when applying updates (ability to drain a node). Single Node clusters will always incur workload downtime during updates.';
    }
    tipDiv.style.display = 'flex';
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
    // Focus first input for keyboard accessibility
    requestAnimationFrame(() => {
        const firstInput = modal.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
    });
}

// Close modal
function closeModal() {
    const modal = document.getElementById('add-workload-modal');
    const overlay = document.getElementById('modal-overlay');
    modal.classList.remove('active');
    overlay.classList.remove('active');
    currentModalType = null;
    editingWorkloadId = null;
    // Reset button text
    const submitBtn = document.getElementById('modal-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Add Workload';
}

// Get VM modal content
function getVMModalContent() {
    const defaults = WORKLOAD_DEFAULTS.vm;
    return `
        <div class="form-group">
            <label>Workload Name</label>
            <input type="text" id="workload-name" value="${defaults.name}" placeholder="e.g., Production VMs">
        </div>
        <div class="form-group">
            <label>Number of VMs</label>
            <input type="number" id="vm-count" value="${defaults.count}" min="1" max="10000">
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
        <div class="form-group">
            <label>Storage per VM (GB)</label>
            <input type="number" id="vm-storage" value="${defaults.storage}" min="1" max="64000">
            <span class="hint">Total disk capacity including OS</span>
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
    const medSpecs = AVD_PROFILES.medium.multi;
    const custSpecs = AVD_PROFILES.custom.multi;
    return `
        <div class="form-group">
            <label>Workload Name</label>
            <input type="text" id="workload-name" value="${defaults.name}" placeholder="e.g., Corporate AVD">
        </div>
        <div class="form-group">
            <label>Number of Users</label>
            <input type="number" id="avd-users" value="${defaults.userCount}" min="1" max="10000">
        </div>
        <div class="form-group">
            <label>Session Type
                <span class="info-icon" title="Multi-session: multiple users share VMs (Windows 10/11 Enterprise multi-session). Single-session: one dedicated VM per user (personal desktop).">ⓘ</span>
            </label>
            <select id="avd-session-type" onchange="updateAVDDescription()">
                <option value="multi" selected>Multi-session (shared VMs)</option>
                <option value="single">Single-session (1 VM per user)</option>
            </select>
        </div>
        <div class="form-group">
            <label>User Profile</label>
            <select id="avd-profile" onchange="updateAVDDescription()">
                <option value="light">Light - Task Workers</option>
                <option value="medium" selected>Medium - Knowledge Workers</option>
                <option value="heavy">Heavy - Engineers & Content Creators</option>
                <option value="power">Power - 3D / CAD / ML</option>
                <option value="custom">Custom</option>
            </select>
            <span class="hint" id="avd-profile-desc">${AVD_PROFILES.medium.description}</span>
        </div>
        <div class="form-group" id="avd-concurrency-group">
            <label>Max Concurrency %
                <span class="info-icon" title="Peak percentage of users active simultaneously. Most organisations see 60-90% peak concurrency. Reduces compute/memory requirements.">ⓘ</span>
            </label>
            <input type="number" id="avd-concurrency" value="${defaults.concurrency}" min="10" max="100" step="5">
            <span class="hint">Peak concurrent user percentage (default 90%)</span>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
            <input type="checkbox" id="avd-fslogix" style="width: auto; margin: 0;" onchange="toggleFSLogixSize()">
            <label for="avd-fslogix" style="margin: 0; cursor: pointer;">Add FSLogix user profile storage
                <span class="info-icon" title="FSLogix profile containers store user profiles on a file share. Adds per-user storage for profiles, settings, and data.">ⓘ</span>
            </label>
        </div>
        <div id="avd-fslogix-size-group" class="form-group" style="display: none; margin-left: 28px;">
            <label>Profile Size per User (GB)</label>
            <input type="number" id="avd-fslogix-size" value="${defaults.fslogixSize}" min="5" max="100" step="5">
            <span class="hint">Typical: 20-30 GB per user for Office / profile data</span>
        </div>
        <div id="avd-custom-fields" style="display: none; margin-top: 12px;">
            <div class="form-group">
                <label>vCPUs per User</label>
                <input type="number" id="avd-custom-vcpus" value="${custSpecs.vcpusPerUser}" min="0.25" max="16" step="0.25">
            </div>
            <div class="form-group">
                <label>Memory per User (GB)</label>
                <input type="number" id="avd-custom-memory" value="${custSpecs.memoryPerUser}" min="1" max="64" step="1">
            </div>
            <div class="form-group">
                <label>Storage per User (GB)</label>
                <input type="number" id="avd-custom-storage" value="${custSpecs.storagePerUser}" min="5" max="500" step="5">
            </div>
        </div>
        <div id="avd-specs-panel" style="margin-top: 16px; padding: 16px; background: var(--subtle-bg); border-radius: 8px;">
            <h4 style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Profile Specifications</h4>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 12px;">
                <div>
                    <span style="color: var(--text-secondary);">vCPUs/User:</span>
                    <span id="avd-spec-vcpus">${medSpecs.vcpusPerUser}</span>
                </div>
                <div>
                    <span style="color: var(--text-secondary);">Memory/User:</span>
                    <span id="avd-spec-memory">${medSpecs.memoryPerUser} GB</span>
                </div>
                <div>
                    <span style="color: var(--text-secondary);">Storage/User:</span>
                    <span id="avd-spec-storage">${medSpecs.storagePerUser} GB</span>
                </div>
            </div>
            <div id="avd-spec-density" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                Max density: ${AVD_PROFILES.medium.maxUsersPerVcpu} users/vCPU
            </div>
        </div>
        <div style="margin-top: 16px; padding: 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
            <span style="margin-right: 4px;">📖</span>
            <a href="https://learn.microsoft.com/en-us/azure/architecture/hybrid/azure-local-workload-virtual-desktop" target="_blank" style="color: var(--link-color);">AVD for Azure Local architecture guide</a>
            <span style="margin: 0 6px;">|</span>
            <a href="https://learn.microsoft.com/en-us/windows-server/remote/remote-desktop-services/virtual-machine-recs" target="_blank" style="color: var(--link-color);">Session host sizing guidelines</a>
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: var(--text-secondary); font-style: italic;">
            We recommend using simulation tools (e.g. LoginVSI) to validate sizing with stress tests and real-life usage simulations.
        </div>
    `;
}

// Toggle FSLogix size input visibility
function toggleFSLogixSize() {
    const cb = document.getElementById('avd-fslogix');
    const sizeGroup = document.getElementById('avd-fslogix-size-group');
    sizeGroup.style.display = cb.checked ? 'block' : 'none';
}

// Update AVD description when profile or session type changes
function updateAVDDescription() {
    const profile = document.getElementById('avd-profile').value;
    const sessionType = document.getElementById('avd-session-type').value;
    const profileData = AVD_PROFILES[profile];
    const specs = profileData[sessionType] || profileData.multi;
    const customFields = document.getElementById('avd-custom-fields');
    const specsPanel = document.getElementById('avd-specs-panel');

    document.getElementById('avd-profile-desc').textContent = profileData.description;

    // Hide concurrency for single-session (every user gets a dedicated VM)
    const concGroup = document.getElementById('avd-concurrency-group');
    if (concGroup) {
        concGroup.style.display = sessionType === 'single' ? 'none' : 'block';
    }

    if (profile === 'custom') {
        // Show editable custom fields, hide read-only specs panel
        customFields.style.display = 'block';
        specsPanel.style.display = 'none';
    } else {
        // Hide custom fields, show read-only specs panel
        customFields.style.display = 'none';
        specsPanel.style.display = 'block';
        document.getElementById('avd-spec-vcpus').textContent = specs.vcpusPerUser;
        document.getElementById('avd-spec-memory').textContent = specs.memoryPerUser + ' GB';
        document.getElementById('avd-spec-storage').textContent = specs.storagePerUser + ' GB';
        const densityEl = document.getElementById('avd-spec-density');
        if (densityEl) {
            densityEl.textContent = sessionType === 'multi'
                ? 'Max density: ' + profileData.maxUsersPerVcpu + ' users/vCPU'
                : 'Dedicated VM per user';
        }
    }
}

// Add workload
// Track edit mode
let editingWorkloadId = null;

function addWorkload() {
    if (!currentModalType) return;
    
    const name = document.getElementById('workload-name').value;
    let workload = {
        id: editingWorkloadId || ++workloadIdCounter,
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
            workload.sessionType = document.getElementById('avd-session-type').value || 'multi';
            workload.concurrency = parseInt(document.getElementById('avd-concurrency').value) || 90;
            workload.fslogix = document.getElementById('avd-fslogix').checked;
            workload.fslogixSize = parseInt(document.getElementById('avd-fslogix-size').value) || 30;
            if (workload.profile === 'custom') {
                workload.customVcpus = parseFloat(document.getElementById('avd-custom-vcpus').value) || 2;
                workload.customMemory = parseFloat(document.getElementById('avd-custom-memory').value) || 8;
                workload.customStorage = parseFloat(document.getElementById('avd-custom-storage').value) || 50;
                // Validate custom profile — warn on extreme ratios
                const memPerVcpu = workload.customMemory / workload.customVcpus;
                if (memPerVcpu < 1) {
                    if (!confirm('Warning: Less than 1 GB RAM per vCPU may lead to poor performance. Continue anyway?')) return;
                } else if (memPerVcpu > 32) {
                    if (!confirm(`Warning: ${memPerVcpu.toFixed(0)} GB RAM per vCPU is unusually high and may indicate a misconfiguration. Continue anyway?`)) return;
                }
                if (workload.customVcpus > 16) {
                    if (!confirm(`Warning: ${workload.customVcpus} vCPUs per user is very high for AVD. Typical range is 1-8 vCPUs per user. Continue anyway?`)) return;
                }
            }
            break;
    }
    
    if (editingWorkloadId) {
        // Replace existing workload
        const idx = workloads.findIndex(w => w.id === editingWorkloadId);
        if (idx !== -1) workloads[idx] = workload;
        editingWorkloadId = null;
    } else {
        workloads.push(workload);
        // Track new workload addition for analytics
        if (typeof trackFormCompletion === 'function') {
            trackFormCompletion('sizerCalculation');
        }
    }
    closeModal();
    renderWorkloads();
    calculateRequirements();
}

// Edit workload - open modal pre-populated with existing values
function editWorkload(id) {
    const w = workloads.find(wl => wl.id === id);
    if (!w) return;
    if (w.isAldoFixed) return; // Cannot edit ALDO fixed workload

    editingWorkloadId = id;
    currentModalType = w.type;

    const modal = document.getElementById('add-workload-modal');
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const submitBtn = document.getElementById('modal-submit-btn');

    switch (w.type) {
        case 'vm':
            title.textContent = 'Edit Azure Local VMs';
            body.innerHTML = getVMModalContent();
            document.getElementById('workload-name').value = w.name;
            document.getElementById('vm-count').value = w.count;
            document.getElementById('vm-vcpus').value = w.vcpus;
            document.getElementById('vm-memory').value = w.memory;
            document.getElementById('vm-storage').value = w.storage;
            break;
        case 'aks':
            title.textContent = 'Edit AKS Arc Cluster';
            body.innerHTML = getAKSModalContent();
            document.getElementById('workload-name').value = w.name;
            document.getElementById('aks-cluster-count').value = w.clusterCount;
            document.getElementById('aks-cp-nodes').value = w.controlPlaneNodes;
            document.getElementById('aks-cp-vcpus').value = w.controlPlaneVcpus;
            document.getElementById('aks-cp-memory').value = w.controlPlaneMemory;
            document.getElementById('aks-worker-nodes').value = w.workerNodes;
            document.getElementById('aks-worker-vcpus').value = w.workerVcpus;
            document.getElementById('aks-worker-memory').value = w.workerMemory;
            document.getElementById('aks-worker-storage').value = w.workerStorage;
            break;
        case 'avd':
            title.textContent = 'Edit Azure Virtual Desktop';
            body.innerHTML = getAVDModalContent();
            document.getElementById('workload-name').value = w.name;
            document.getElementById('avd-session-type').value = w.sessionType || 'multi';
            document.getElementById('avd-profile').value = w.profile;
            document.getElementById('avd-users').value = w.userCount;
            document.getElementById('avd-concurrency').value = w.concurrency != null ? w.concurrency : 90;
            document.getElementById('avd-fslogix').checked = !!w.fslogix;
            if (w.fslogix) {
                document.getElementById('avd-fslogix-size-group').style.display = 'block';
                document.getElementById('avd-fslogix-size').value = w.fslogixSize || 30;
            }
            updateAVDDescription();
            if (w.profile === 'custom') {
                document.getElementById('avd-custom-vcpus').value = w.customVcpus || 2;
                document.getElementById('avd-custom-memory').value = w.customMemory || 8;
                document.getElementById('avd-custom-storage').value = w.customStorage || 50;
            }
            break;
    }

    if (submitBtn) submitBtn.textContent = 'Update Workload';
    modal.classList.add('active');
    overlay.classList.add('active');
}

// Delete workload
function deleteWorkload(id) {
    const w = workloads.find(wl => wl.id === id);
    if (!w) return;
    if (w.isAldoFixed) return; // Cannot delete ALDO fixed workload
    const label = w.name;
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    workloads = workloads.filter(w => w.id !== id);
    renderWorkloads();
    calculateRequirements();
}

// Clone workload
function cloneWorkload(id) {
    const original = workloads.find(w => w.id === id);
    if (!original) return;
    if (original.isAldoFixed) return; // Cannot clone ALDO fixed workload
    const clone = JSON.parse(JSON.stringify(original));
    clone.id = ++workloadIdCounter;
    clone.name = original.name + ' (copy)';
    workloads.push(clone);
    renderWorkloads();
    calculateRequirements();
}

// Render workloads list
function renderWorkloads() {
    const container = document.getElementById('workloads-list');
    // Use cached reference — getElementById returns null after innerHTML replacement
    if (!_emptyStateEl) {
        _emptyStateEl = document.getElementById('empty-state');
    }
    
    if (workloads.length === 0) {
        container.innerHTML = '';
        if (_emptyStateEl) {
            container.appendChild(_emptyStateEl);
            _emptyStateEl.style.display = 'flex';
        }
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
                        ${w.isAldoFixed ? '<span style="font-size: 10px; background: #7c3aed; color: white; padding: 1px 6px; border-radius: 4px; margin-left: 6px; font-weight: 600;">ALDO FIXED</span>' : ''}
                    </div>
                    <div class="workload-card-details">${details}</div>
                </div>
                <div class="workload-card-actions"${w.isAldoFixed ? ' style="display:none"' : ''}>
                    <button class="edit" onclick="editWorkload(${w.id})" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                    </button>
                    <button class="clone" onclick="cloneWorkload(${w.id})" title="Clone">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
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
            return '<img src="../images/vm-icon.png" alt="VM" width="20" height="20" style="vertical-align: middle;">';
        case 'aks':
            return '<img src="../images/aks-arc-icon.png" alt="AKS Arc" width="20" height="20" style="vertical-align: middle;">';
        case 'avd':
            return '<img src="../images/avd-icon.png" alt="AVD" width="20" height="20" style="vertical-align: middle;">';
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
            const sessionLabel = (w.sessionType || 'multi') === 'multi' ? 'multi-session' : 'single-session';
            const conc = w.concurrency != null ? w.concurrency : 100;
            const concurrentUsers = Math.ceil(w.userCount * conc / 100);
            let avdDesc;
            if (w.profile === 'custom') {
                avdDesc = `${w.userCount} Custom users (${w.customVcpus} vCPUs, ${w.customMemory} GB RAM each)`;
            } else {
                const avdProfile = AVD_PROFILES[w.profile];
                avdDesc = `${w.userCount} ${avdProfile.name} users`;
            }
            avdDesc += ` \u2022 ${sessionLabel} \u2022 ${conc}% concurrency (${concurrentUsers} peak)`;
            if (w.fslogix) avdDesc += ` \u2022 FSLogix ${w.fslogixSize || 30} GB/user`;
            return avdDesc;
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
        case 'avd': {
            // Single-session = every user gets a dedicated VM, so concurrency is always 100%
            const concPct = (w.sessionType === 'single') ? 1 : (w.concurrency != null ? w.concurrency : 100) / 100;
            const concUsers = Math.ceil(w.userCount * concPct);
            const sType = w.sessionType || 'multi';
            let vPerUser, mPerUser, sPerUser;
            if (w.profile === 'custom') {
                vPerUser = w.customVcpus || 2;
                mPerUser = w.customMemory || 8;
                sPerUser = w.customStorage || 50;
            } else {
                const profile = AVD_PROFILES[w.profile];
                const specs = profile[sType] || profile.multi;
                vPerUser = specs.vcpusPerUser;
                mPerUser = specs.memoryPerUser;
                sPerUser = specs.storagePerUser;
            }
            // Compute & memory scale with concurrent users; storage with total users
            vcpus = Math.ceil(vPerUser * concUsers);
            memory = mPerUser * concUsers;
            storage = sPerUser * w.userCount;
            // FSLogix profile storage (all users, not just concurrent)
            if (w.fslogix) {
                storage += (w.fslogixSize || 30) * w.userCount;
            }
            break;
        }
    }
    
    return { vcpus, memory, storage };
}

// Calculate all requirements
function calculateRequirements(options) {
    if (isCalculating) return;
    isCalculating = true;
    const skipAutoNodeRecommend = _nodeCountUserSet || (options && options.skipAutoNodeRecommend);

    try {
        // Sum all workload requirements (raw, before growth)
        let totalVcpus = 0, totalMemory = 0, totalStorage = 0;

        workloads.forEach(w => {
            const reqs = calculateWorkloadRequirements(w);
            totalVcpus += reqs.vcpus;
            totalMemory += reqs.memory;
            totalStorage += reqs.storage;
        });

        // Apply future growth factor
        const growthFactor = getGrowthFactor();
        totalVcpus = Math.ceil(totalVcpus * growthFactor);
        totalMemory = Math.ceil(totalMemory * growthFactor);
        totalStorage = Math.ceil(totalStorage * growthFactor);

        // Get current resiliency setting
        let resiliency = document.getElementById('resiliency').value;
        let resiliencyMultiplier = RESILIENCY_CONFIG[resiliency].multiplier;

        // Get hardware configuration (per-node specs)
        let hwConfig = getHardwareConfig();

        // Build "max possible" config to favour scaling up before adding nodes
        const maxHwConfig = buildMaxHardwareConfig(hwConfig);

        // --- Auto-recommend node count based on max hardware potential ---
        if (!skipAutoNodeRecommend) {
            // Auto-set node count from workload demands
            if (workloads.length > 0) {
                const recommendation = getRecommendedNodeCount(
                    totalVcpus, totalMemory, totalStorage,
                    maxHwConfig, resiliencyMultiplier, resiliency
                );
                if (recommendation) {
                    updateNodeRecommendation(recommendation);
                }
            } else {
                hideNodeRecommendation();
            }
        } else {
            // User manually changed node count — recalculate recommendation with
            // current ACTUAL hardware so the message reflects reality, but don't
            // auto-set the dropdown.
            if (workloads.length > 0) {
                const infoRec = getRecommendedNodeCount(
                    totalVcpus, totalMemory, totalStorage,
                    maxHwConfig, resiliencyMultiplier, resiliency
                );
                if (infoRec) {
                    updateNodeRecommendationInfo(infoRec, parseInt(document.getElementById('node-count').value) || 3);
                }
            } else {
                hideNodeRecommendation();
            }
        }

        // Read (possibly updated) node count
        let nodeCount = parseInt(document.getElementById('node-count').value) || 3;

        // Auto-update repair disk reservation based on node count (if not manually set)
        updateRepairDiskCountAuto();

        // Re-read resiliency after node recommendation may have changed it
        // (e.g. updateNodeRecommendation → updateResiliencyOptions changes
        // 2-way → 3-way when node count jumps from 2 to 3+)
        resiliency = document.getElementById('resiliency').value;
        resiliencyMultiplier = RESILIENCY_CONFIG[resiliency].multiplier;

        // Reset vCPU auto-escalation flag once per calculation cycle.
        // Capture the initial ratio so we can detect if any autoScaleHardware()
        // call within this cycle bumped it — this avoids the flag being lost
        // when autoScaleHardware is called multiple times (e.g. in the node loop).
        const initialVcpuRatio = getVcpuRatio();
        _vcpuRatioAutoEscalated = false;

        // Save which fields were previously auto-scaled so we can re-apply badges
        // for values that remain at their auto-scaled level (unchanged across cycles)
        const previouslyAutoScaled = new Set(_autoScaledFields);

        // Clear previous auto-scaled highlights before re-running auto-scale
        clearAutoScaledHighlights();
        _diskConsolidationInfo = null;

        // --- Auto-scale CPU cores, memory & disk count to avoid >100% capacity ---
        if (workloads.length > 0) {
            const hwChanged = autoScaleHardware(totalVcpus, totalMemory, totalStorage, nodeCount, resiliencyMultiplier, hwConfig, previouslyAutoScaled);
            if (hwChanged) {
                // Re-read hardware config with the updated dropdown values
                hwConfig = getHardwareConfig();

                // Re-run node recommendation with maxHwConfig so the message stays consistent
                const updatedRec = getRecommendedNodeCount(
                    totalVcpus, totalMemory, totalStorage,
                    maxHwConfig, resiliencyMultiplier, resiliency
                );
                if (updatedRec) {
                    if (!skipAutoNodeRecommend) {
                        updateNodeRecommendation(updatedRec);
                    } else {
                        // User manually set node count — show info but don't override their selection
                        updateNodeRecommendationInfo(updatedRec, nodeCount);
                    }
                }
            }

            // --- Auto-increment node count if any resource is still >= 90% after hw scale-up ---
            // Skip when user manually changed node count to respect their selection
            const clusterType = document.getElementById('cluster-type').value;
            if (clusterType !== 'single' && clusterType !== 'aldo-mgmt' && !skipAutoNodeRecommend) {
                const nodeOptions = clusterType === 'rack-aware' ? [2, 4, 6, 8] : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
                const maxNodeOption = nodeOptions[nodeOptions.length - 1];
                const UTIL_THRESHOLD = 90;
                let attempts = 0;
                let conservativeSuccess = false;

                while (nodeCount < maxNodeOption && attempts < 16) {
                    attempts++;
                    const effNodes = nodeCount > 1 ? nodeCount - 1 : 1;
                    const vcpuToCore = getVcpuRatio();                    const physCores = hwConfig.totalPhysicalCores || DEFAULT_PHYSICAL_CORES_PER_NODE;
                    const memPerNode = hwConfig.memoryGB || 512;
                    let rawGBPerNode = 0;
                    if (hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
                        rawGBPerNode = hwConfig.diskConfig.capacity.count * hwConfig.diskConfig.capacity.sizeGB;
                    }
                    const rawTBPerNode = (rawGBPerNode / 1024) || DEFAULT_RAW_TB_PER_NODE;

                    const availVcpus = physCores * effNodes * vcpuToCore - ARB_VCPU_OVERHEAD;
                    const hostOverheadMemoryGBLoop = 32 + (clusterType === 'aldo-mgmt' ? ALDO_APPLIANCE_OVERHEAD_GB : 0);
                    const availMem = Math.max(memPerNode - hostOverheadMemoryGBLoop, 0) * effNodes - ARB_MEMORY_OVERHEAD_GB;
                    // Subtract Infrastructure_1 volume (256 GB usable) and S2D repair reservation from available storage
                    const s2dRepairTB = getS2dRepairReservedGB(nodeCount, rawGBPerNode > 0 ? (rawGBPerNode / (hwConfig.diskConfig.capacity.count || 1)) : 0) / 1024;
                    const availStorage = Math.max((rawTBPerNode * nodeCount) / resiliencyMultiplier - 0.25 - s2dRepairTB / resiliencyMultiplier, 0);

                    const cpuPct = availVcpus > 0 ? Math.round((totalVcpus / availVcpus) * 100) : 0;
                    const memPct = availMem > 0 ? Math.round((totalMemory / availMem) * 100) : 0;
                    const stoPct = availStorage > 0 ? Math.round(((totalStorage / 1000) / availStorage) * 100) : 0;

                    if (cpuPct < UTIL_THRESHOLD && memPct < UTIL_THRESHOLD && stoPct < UTIL_THRESHOLD) {
                        conservativeSuccess = true;
                        break;
                    }

                    // Bump to next available node option
                    let nextNode = null;
                    for (const opt of nodeOptions) {
                        if (opt > nodeCount) { nextNode = opt; break; }
                    }
                    if (!nextNode) break;

                    nodeCount = nextNode;
                    const nodeSelect = document.getElementById('node-count');
                    nodeSelect.value = nodeCount;
                    updateRepairDiskCountAuto();
                    updateResiliencyOptions();
                    updateClusterInfo();

                    // Re-read resiliency after updateResiliencyOptions() may have changed it
                    // (e.g. 2-way → 3-way when going from 2 to 3+ nodes)
                    resiliency = document.getElementById('resiliency').value;
                    resiliencyMultiplier = RESILIENCY_CONFIG[resiliency].multiplier;

                    // Re-run autoScale with the new node count and updated resiliency
                    autoScaleHardware(totalVcpus, totalMemory, totalStorage, nodeCount, resiliencyMultiplier, hwConfig, previouslyAutoScaled);
                    hwConfig = getHardwareConfig();
                }

                // Update the recommendation message to reflect the final node count
                const finalRec = getRecommendedNodeCount(
                    totalVcpus, totalMemory, totalStorage,
                    hwConfig, resiliencyMultiplier, resiliency
                );
                if (finalRec) {
                    // Override recommended with actual final node count so message matches dropdown
                    finalRec.recommended = nodeCount;
                    updateNodeRecommendation(finalRec);
                }

                // --- Final aggressive pass: allow ratio escalation and high memory ---
                // Only run when the conservative node loop could NOT get all utilisation
                // below the 90% threshold (e.g. hit max nodes with util still over 90%).
                // When conservative scaling succeeded, skip this pass to avoid unnecessary
                // memory/ratio escalation (e.g. bumping from 2 TB to 3 TB for headroom).
                if (!conservativeSuccess) {
                const aggressiveChanged = autoScaleHardware(
                    totalVcpus, totalMemory, totalStorage, nodeCount,
                    resiliencyMultiplier, hwConfig, previouslyAutoScaled,
                    { allowRatioEscalation: true, allowHighMemory: true }
                );
                if (aggressiveChanged) {
                    hwConfig = getHardwareConfig();

                    // --- Node-reduction pass after aggressive scale-up ---
                    // The aggressive pass may have bumped memory or ratio high enough
                    // that fewer nodes are now sufficient. Try stepping node count back
                    // down while all utilisation stays under the threshold ( < 90% ).
                    // At each candidate node count, re-run conservative auto-scale so
                    // per-node hardware (memory, ratio) scales down to preferred levels.
                    const DOWN_UTIL_THRESHOLD = UTIL_THRESHOLD;
                    const minNodeOption = nodeOptions[0]; // enforce cluster minimum (e.g. 2)
                    const resiliencyMin = (RESILIENCY_CONFIG[resiliency] && RESILIENCY_CONFIG[resiliency].minNodes) || 2;
                    const absoluteMin = Math.max(minNodeOption, resiliencyMin);
                    let downAttempts = 0;

                    while (nodeCount > absoluteMin && downAttempts < 16) {
                        downAttempts++;
                        // Find the next lower node option
                        let prevNode = null;
                        for (let i = nodeOptions.length - 1; i >= 0; i--) {
                            if (nodeOptions[i] < nodeCount) { prevNode = nodeOptions[i]; break; }
                        }
                        if (!prevNode || prevNode < absoluteMin) break;

                        // Tentatively reduce node count and re-run conservative auto-scale
                        // Save current state so we can revert if utilisation is too high
                        const savedNodeCount = nodeCount;
                        const savedHwConfig = hwConfig;
                        const savedRatio = getVcpuRatio();
                        const savedMem = parseInt(document.getElementById('node-memory').value) || 512;
                        const savedResiliency = resiliency;
                        const savedResiliencyMultiplier = resiliencyMultiplier;

                        nodeCount = prevNode;
                        document.getElementById('node-count').value = nodeCount;

                        // Reset ratio back to 4:1 (prefer nodes over ratio) if not user-set
                        if (!_vcpuRatioUserSet && savedRatio > 4) {
                            document.getElementById('vcpu-ratio').value = 4;
                        }

                        // Re-run conservative auto-scale at the lower node count
                        autoScaleHardware(totalVcpus, totalMemory, totalStorage, nodeCount, resiliencyMultiplier, hwConfig, previouslyAutoScaled);
                        hwConfig = getHardwareConfig();

                        // Check utilisation at the reduced node count
                        const dEffNodes = nodeCount > 1 ? nodeCount - 1 : 1;
                        const dVcpuToCore = getVcpuRatio();
                        const dPhysCores = hwConfig.totalPhysicalCores || DEFAULT_PHYSICAL_CORES_PER_NODE;
                        const dMemPerNode = hwConfig.memoryGB || 512;
                        let dRawGBPerNode = 0;
                        if (hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
                            dRawGBPerNode = hwConfig.diskConfig.capacity.count * hwConfig.diskConfig.capacity.sizeGB;
                        }
                        const dRawTBPerNode = dRawGBPerNode / 1024 || DEFAULT_RAW_TB_PER_NODE;

                        const dAvailVcpus = dPhysCores * dEffNodes * dVcpuToCore - ARB_VCPU_OVERHEAD;
                        const dHostOverhead = 32 + (clusterType === 'aldo-mgmt' ? ALDO_APPLIANCE_OVERHEAD_GB : 0);
                        const dAvailMem = Math.max(dMemPerNode - dHostOverhead, 0) * dEffNodes - ARB_MEMORY_OVERHEAD_GB;
                        const dS2dRepairTB = getS2dRepairReservedGB(nodeCount, dRawGBPerNode > 0 ? (dRawGBPerNode / (hwConfig.diskConfig.capacity.count || 1)) : 0) / 1024;
                        const dAvailStorage = Math.max((dRawTBPerNode * nodeCount) / resiliencyMultiplier - 0.25 - dS2dRepairTB / resiliencyMultiplier, 0);

                        const dCpuPct = dAvailVcpus > 0 ? Math.round((totalVcpus / dAvailVcpus) * 100) : 0;
                        const dMemPct = dAvailMem > 0 ? Math.round((totalMemory / dAvailMem) * 100) : 0;
                        const dStoPct = dAvailStorage > 0 ? Math.round(((totalStorage / 1000) / dAvailStorage) * 100) : 0;

                        if (dCpuPct >= DOWN_UTIL_THRESHOLD || dMemPct >= DOWN_UTIL_THRESHOLD || dStoPct >= DOWN_UTIL_THRESHOLD) {
                            // Can't reduce further — revert to the previous node count
                            nodeCount = savedNodeCount;
                            document.getElementById('node-count').value = savedNodeCount;
                            if (!_vcpuRatioUserSet && savedRatio > 4) {
                                document.getElementById('vcpu-ratio').value = savedRatio;
                            }
                            document.getElementById('node-memory').value = savedMem;
                            hwConfig = savedHwConfig;
                            resiliency = savedResiliency;
                            resiliencyMultiplier = savedResiliencyMultiplier;
                            // Restore resiliency dropdown
                            updateResiliencyOptions();
                            document.getElementById('resiliency').value = savedResiliency;
                            break;
                        }
                        // Successfully reduced — update UI and continue trying
                        updateResiliencyOptions();
                        updateClusterInfo();
                        resiliency = document.getElementById('resiliency').value;
                        resiliencyMultiplier = RESILIENCY_CONFIG[resiliency].multiplier;
                        markAutoScaled('node-count');
                    }

                    // After node reduction, do one final aggressive pass in case we
                    // reduced nodes and now need ratio/memory to creep up slightly
                    autoScaleHardware(
                        totalVcpus, totalMemory, totalStorage, nodeCount,
                        resiliencyMultiplier, hwConfig, previouslyAutoScaled,
                        { allowRatioEscalation: true, allowHighMemory: true }
                    );
                    hwConfig = getHardwareConfig();
                }
                } // end if (!conservativeSuccess)

                // Update recommendation to reflect final node count after all passes
                const postAggressiveRec = getRecommendedNodeCount(
                    totalVcpus, totalMemory, totalStorage,
                    hwConfig, resiliencyMultiplier, resiliency
                );
                if (postAggressiveRec) {
                    postAggressiveRec.recommended = nodeCount;
                    updateNodeRecommendation(postAggressiveRec);
                }
            }

            // --- Aggressive pass for single-node / manual-node-count paths ---
            // When auto-node-recommendation is skipped (user manually set node count)
            // or single-node cluster, still allow ratio/memory escalation as last resort.
            if (clusterType === 'single' || clusterType === 'aldo-mgmt' || skipAutoNodeRecommend) {
                const aggressiveFallback = autoScaleHardware(
                    totalVcpus, totalMemory, totalStorage, nodeCount,
                    resiliencyMultiplier, hwConfig, previouslyAutoScaled,
                    { allowRatioEscalation: true, allowHighMemory: true }
                );
                if (aggressiveFallback) {
                    hwConfig = getHardwareConfig();
                }
            }

            // If the vCPU ratio changed from its value at the start of this
            // calculation cycle, ensure the auto-escalation flag is set so the
            // sizing notes show the appropriate warning — even if the flag was
            // not explicitly set during one of the autoScaleHardware passes
            // (e.g. ratio was bumped in pass 1, then pass 2 reset the flag).
            if (getVcpuRatio() !== initialVcpuRatio) {
                _vcpuRatioAutoEscalated = true;
            }
        }

        // N+1: effective nodes for capacity sizing (drain one node during updates)
        const effectiveNodes = nodeCount > 1 ? nodeCount - 1 : 1;

        // vCPU to physical core overcommit ratio
        const vcpuToCore = getVcpuRatio();

        // Per-node requirement breakdown
        const perNodeCores = Math.ceil(totalVcpus / effectiveNodes / vcpuToCore);
        const perNodeMemory = Math.ceil(totalMemory / effectiveNodes);
        const perNodeStorageRaw = (totalStorage / 1000) * resiliencyMultiplier / nodeCount; // TB raw per node
        const perNodeUsable = totalStorage / 1000 / nodeCount; // TB usable per node (storage accessible during drain)

        // Update total requirement cards
        document.getElementById('total-vcpus').textContent = totalVcpus;
        document.getElementById('total-memory').textContent = totalMemory + ' GB';
        document.getElementById('total-storage').textContent = (totalStorage / 1000).toFixed(2) + ' TB';
        document.getElementById('total-workloads').textContent = workloads.length;

        // Update per-node requirement cards
        document.getElementById('per-node-cores').textContent = perNodeCores || 0;
        document.getElementById('per-node-memory').textContent = (perNodeMemory || 0) + ' GB';
        document.getElementById('per-node-storage').textContent = perNodeStorageRaw.toFixed(2) + ' TB';
        document.getElementById('per-node-usable').textContent = perNodeUsable.toFixed(2) + ' TB';

        // --- Capacity bars from hardware config ---
        // Physical Nodes bar
        const clusterType = document.getElementById('cluster-type').value;
        const MAX_NODES = clusterType === 'rack-aware' ? 8 : clusterType === 'single' ? 1 : clusterType === 'aldo-mgmt' ? 3 : 16;
        const nodesPercent = Math.round((nodeCount / MAX_NODES) * 100);
        document.getElementById('nodes-count-label').textContent = nodeCount + ' / ' + MAX_NODES;
        document.getElementById('nodes-fill').style.width = nodesPercent + '%';

        const physicalCoresPerNode = hwConfig.totalPhysicalCores || DEFAULT_PHYSICAL_CORES_PER_NODE;
        const memoryPerNode = hwConfig.memoryGB || 512;

        let rawStoragePerNodeGB = 0;
        if (hwConfig.diskConfig.capacity) {
            rawStoragePerNodeGB = hwConfig.diskConfig.capacity.count * hwConfig.diskConfig.capacity.sizeGB;
        }
        const rawStoragePerNodeTB = rawStoragePerNodeGB / 1024 || DEFAULT_RAW_TB_PER_NODE;

        const totalAvailableVcpus = physicalCoresPerNode * effectiveNodes * vcpuToCore - ARB_VCPU_OVERHEAD;
        const hostOverheadGB = 32 + (clusterType === 'aldo-mgmt' ? ALDO_APPLIANCE_OVERHEAD_GB : 0); // Azure Local host OS + management overhead per node (+ ALDO appliance)
        const totalAvailableMemory = Math.max((memoryPerNode - hostOverheadGB), 0) * effectiveNodes - ARB_MEMORY_OVERHEAD_GB;
        // Infrastructure_1 volume: 256 GB usable reserved by Storage Spaces Direct on all clusters
        const infraVolumeUsableTB = 0.25; // 256 GB
        // S2D repair reservation: min(nodeCount, 4) capacity disks reserved from pool raw space
        const capacityDiskSizeGB = (hwConfig.diskConfig.capacity ? hwConfig.diskConfig.capacity.sizeGB : 0);
        const s2dRepairReservedTB = getS2dRepairReservedGB(nodeCount, capacityDiskSizeGB) / 1024;
        const totalAvailableStorage = Math.max((rawStoragePerNodeTB * nodeCount) / resiliencyMultiplier - infraVolumeUsableTB - s2dRepairReservedTB / resiliencyMultiplier, 0);

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

        // Toggle over-threshold (red) on any capacity bar >= 90%
        const UTILIZATION_THRESHOLD = 90;
        document.getElementById('compute-fill').classList.toggle('over-threshold', computePercent >= UTILIZATION_THRESHOLD);
        document.getElementById('memory-fill').classList.toggle('over-threshold', memoryPercent >= UTILIZATION_THRESHOLD);
        document.getElementById('storage-fill').classList.toggle('over-threshold', storagePercent >= UTILIZATION_THRESHOLD);

        // Show/hide utilization warning banner
        const anyOverThreshold = (computePercent >= UTILIZATION_THRESHOLD || memoryPercent >= UTILIZATION_THRESHOLD || storagePercent >= UTILIZATION_THRESHOLD) && workloads.length > 0;
        const warningBanner = document.getElementById('capacity-utilization-warning');
        if (warningBanner) {
            warningBanner.style.display = anyOverThreshold ? 'flex' : 'none';
        }

        // Show/hide manual-override capacity warning
        updateManualOverrideWarning(computePercent, memoryPercent, storagePercent);

        // --- Power & Rack Space Estimates ---
        updatePowerRackEstimates(nodeCount, hwConfig);

        // Update sizing notes
        updateSizingNotes(nodeCount, totalVcpus, totalMemory, totalStorage, resiliency, hwConfig);

        // Auto-save state after every calculation (skip during initial page load)
        if (!isInitialLoad) {
            saveSizerState();
        }
    } finally {
        isCalculating = false;
    }
}

// Estimate power consumption and rack space per cluster
function updatePowerRackEstimates(nodeCount, hwConfig) {
    const section = document.getElementById('power-rack-section');
    if (!section) return;

    if (workloads.length === 0) {
        section.style.display = 'none';
        return;
    }

    // CPU power: Scale TDP by selected core count relative to max cores for the generation.
    // Lower core-count SKUs have proportionally lower TDP, but there is a base power floor
    // (~40% of max TDP) for uncore, memory controller, PCIe, etc.
    const maxTdp = (hwConfig.generation && hwConfig.generation.tdpPerSocketW) ? hwConfig.generation.tdpPerSocketW : 350;
    const sockets = hwConfig.sockets || 2;
    let cpuTdp = maxTdp;
    if (hwConfig.generation && hwConfig.generation.maxCores && hwConfig.coresPerSocket) {
        const coreRatio = hwConfig.coresPerSocket / hwConfig.generation.maxCores;
        // TDP scales: 40% base (uncore/IO) + 60% proportional to cores
        cpuTdp = Math.round(maxTdp * (0.4 + 0.6 * coreRatio));
    }
    const cpuPowerW = cpuTdp * sockets;

    // Memory power: ~4W per DIMM, estimate 1 DIMM per 32 GB
    const memoryGB = hwConfig.memoryGB || 512;
    const dimmCount = Math.ceil(memoryGB / 32);
    const memPowerW = dimmCount * 4;

    // Disk power: ~8W for NVMe/SSD, ~12W for HDD per data disk
    let diskPowerW = 0;
    if (hwConfig.diskConfig) {
        if (hwConfig.diskConfig.isTiered) {
            const cacheCount = hwConfig.diskConfig.cache ? hwConfig.diskConfig.cache.count : 0;
            const capCount = hwConfig.diskConfig.capacity ? hwConfig.diskConfig.capacity.count : 0;
            const capType = hwConfig.diskConfig.capacity ? hwConfig.diskConfig.capacity.type : 'SSD';
            diskPowerW = cacheCount * 8 + capCount * (capType === 'HDD' ? 12 : 8);
        } else {
            const capCount = hwConfig.diskConfig.capacity ? hwConfig.diskConfig.capacity.count : 4;
            diskPowerW = capCount * 8;
        }
    }
    // OS boot disks: 2 × M.2/SSD per node (~8W each)
    const osDiskPowerW = 2 * 8;

    // GPU power
    let gpuPowerW = 0;
    if (hwConfig.gpuCount > 0 && hwConfig.gpuType) {
        const gpuModel = GPU_MODELS[hwConfig.gpuType];
        if (gpuModel) gpuPowerW = gpuModel.tdpW * hwConfig.gpuCount;
    }

    // Motherboard, fans, PSU efficiency loss, NICs, BMC: ~150W baseline
    const baseOverheadW = 150;

    const perNodeW = cpuPowerW + memPowerW + diskPowerW + osDiskPowerW + gpuPowerW + baseOverheadW;
    const totalW = perNodeW * nodeCount;
    const totalBtu = Math.round(totalW * 3.412); // 1W ≈ 3.412 BTU/hr

    // Rack units: 2U per node + 2 × ToR switches (1U each) for multi-node clusters
    const torSwitchUnits = nodeCount > 1 ? 2 : 0; // 2 × 1U ToR switches
    const rackUnits = (nodeCount * 2) + torSwitchUnits;

    // Update DOM
    document.getElementById('power-per-node').textContent = perNodeW.toLocaleString() + ' Watts';
    document.getElementById('power-total').textContent = totalW.toLocaleString() + ' Watts';
    document.getElementById('power-btu').textContent = totalBtu.toLocaleString();
    document.getElementById('rack-units').textContent = rackUnits + 'U';
    section.style.display = 'block';
}

// Update sizing notes
function updateSizingNotes(nodeCount, totalVcpus, totalMemory, totalStorage, resiliency, hwConfig) {
    const notes = [];
    const clusterType = document.getElementById('cluster-type').value;
    
    if (workloads.length === 0) {
        notes.push('Add workloads to see sizing recommendations');
    } else {
        // Cluster size + N+1 note — always first
        if (clusterType === 'single') {
            notes.push('1 x Node Cluster — Single node deployment: No node fault tolerance or maintenance capacity');
        } else {
            notes.push(`${nodeCount} x Node Cluster - N+1 capacity: hardware requirements calculated assuming ${nodeCount - 1} nodes available during servicing / maintenance`);
        }

        // Per node hardware config note — always second
        if (hwConfig && hwConfig.generation) {
            notes.push(`Per node hardware configuration: ${hwConfig.generation.name} — ${hwConfig.coresPerSocket} cores × ${hwConfig.sockets} socket(s) = ${hwConfig.totalPhysicalCores} physical cores, ${hwConfig.memoryGB} GB memory`);
            if (hwConfig.gpuCount > 0) {
                const gpuLabel = getGpuLabel(hwConfig.gpuType);
                notes.push(`GPU: ${hwConfig.gpuCount} × ${gpuLabel} per node`);
            }
        }

        // Growth buffer note
        const growthFactor = getGrowthFactor();
        if (growthFactor > 1) {
            notes.push(`Future growth buffer: ${Math.round((growthFactor - 1) * 100)}% \u2014 hardware configuration allows for workload future growth headroom`);
        }
        
        // Single node specific notes (cluster size + N+1 already shown above)
        if (clusterType === 'single') {
            if (resiliency === 'simple') {
                notes.push('Simple resiliency: No drive fault tolerance. Single drive failure causes data loss.');
            } else {
                notes.push('Two-way mirror: Provides drive fault tolerance. Requires minimum 2 capacity drives.');
            }
            notes.push('Single node requires minimum 2 capacity drives (NVMe or SSD) of the same type');
        } else if (clusterType === 'aldo-mgmt') {
            notes.push('ALDO Management Cluster: Fixed 3-node cluster for Azure Local Disconnected Operations (ALDO) management.');
            notes.push(`ALDO Infrastructure VM (IRVM1): ${ALDO_IRVM.vcpus} vCPUs, ${ALDO_IRVM.memory} GB memory, ${(ALDO_IRVM.storage / 1024).toFixed(0)} TB storage — automatically added as a fixed workload for the ALDO management infrastructure, additional infrastructure workloads may be added in a future release`);
            notes.push('Boot disk: 960 GB SSD/NVMe recommended per node to reduce deployment complexity. Systems with smaller boot disks require extra data disks for the appliance installation');
            notes.push('📖 Learn more: <a href="https://learn.microsoft.com/azure/azure-local/manage/disconnected-operations-overview" target="_blank" rel="noopener noreferrer">Azure Local disconnected operations overview</a>');
        } else if (clusterType === 'aldo-wl') {
            notes.push('ALDO Workload Cluster: A multi-node cluster for Azure Local Disconnected Operations (ALDO) workloads. Configured as a Disconnected Workload Cluster in the Designer.');
            notes.push('📖 Learn more: <a href="https://learn.microsoft.com/azure/azure-local/manage/disconnected-operations-overview" target="_blank" rel="noopener noreferrer">Azure Local disconnected operations overview</a>');
        } else {
            // Rack-aware note
            if (clusterType === 'rack-aware') {
                notes.push('Rack-Aware Cluster (RAC): Each rack acts as a fault domain, physical nodes are split evenly between two racks, minimum 2 nodes, maximum 8 nodes.');
            }
        }
        
        // Resiliency note
        const resiliencyNames = {
            'simple': 'Simple (no redundancy, 1x raw storage)',
            '2way': 'Two-way mirror (50% efficiency for two copies of data), performant and resilient to one fault domain (node) failure',
            '3way': 'Three-way mirror (33% efficiency for three copies of data), most performant and resilient to two fault domain (nodes) failures',
            '4way': 'Four-way mirror (25% efficiency), implemented as a rack-level nested mirror'
        };
        notes.push(`Storage resiliency: ${resiliencyNames[resiliency]}`);
        
        // Storage config note
        if (hwConfig && hwConfig.diskConfig) {
            const dc = hwConfig.diskConfig;
            if (dc.isTiered) {
                notes.push(`Storage layout: ${dc.cache.count} × ${dc.cache.type} cache + ${dc.capacity.count} × ${dc.capacity.type} capacity disks per node`);
                // Mixed all-flash recommendation
                if (hwConfig.storageConfig === 'mixed-flash') {
                    notes.push('ℹ️ All-Flash (single type SSD or NVMe) configuration is recommended for increased capacity. Mixed all-flash (NVMe cache + SSD capacity) uses tiered storage which limits capacity disks to 16 per node (24 total drive bays).');
                }
            } else {
                notes.push(`Storage layout: ${dc.capacity.count} × ${dc.capacity.type} capacity disks per node (${(dc.capacity.sizeGB / 1024).toFixed(1)} TB each)`);
            }
        }
        
        // Memory recommendation
        if (totalMemory > 0) {
            const memPerNode = Math.ceil(totalMemory / (nodeCount > 1 ? nodeCount - 1 : 1));
            const totalOverheadPerNode = 32; // host OS overhead per node
            const arbSharePerNode = Math.ceil(ARB_MEMORY_OVERHEAD_GB / (nodeCount > 1 ? nodeCount - 1 : 1));
            if (hwConfig && memPerNode + arbSharePerNode > hwConfig.memoryGB - totalOverheadPerNode) {
                notes.push(`⚠️ Workload memory (${memPerNode} GB/node + ${ARB_MEMORY_OVERHEAD_GB} GB ARB per cluster) approaches or exceeds usable node memory (${hwConfig.memoryGB - totalOverheadPerNode} GB after ${totalOverheadPerNode} GB host overhead). Consider increasing memory or adding nodes.`);
            }
        }
        
        // Compute check
        if (hwConfig && hwConfig.totalPhysicalCores > 0 && totalVcpus > 0) {
            const vcpuToCore = getVcpuRatio();
            const effectiveNodes = nodeCount > 1 ? nodeCount - 1 : 1;
            const requiredCoresPerNode = Math.ceil((totalVcpus + ARB_VCPU_OVERHEAD) / effectiveNodes / vcpuToCore);
            if (requiredCoresPerNode > hwConfig.totalPhysicalCores) {
                notes.push(`⚠️ Required cores per node (${requiredCoresPerNode}) exceed configured physical cores (${hwConfig.totalPhysicalCores}). Consider more cores or additional nodes.`);
            }

            // AMD suggestion when Intel cores are maxed out and compute ≥80% at 4:1.
            // Use the baseline 4:1 ratio for the check so the tip still shows even
            // when the ratio has been auto-scaled to 5:1 or 6:1 (which artificially
            // lowers the displayed compute %).
            if (hwConfig.manufacturer === 'intel' && hwConfig.generation) {
                const maxIntelCores = hwConfig.generation.coreOptions[hwConfig.generation.coreOptions.length - 1];
                const isMaxCores = hwConfig.coresPerSocket >= maxIntelCores;
                const isMaxSockets = hwConfig.sockets >= 2;
                const baselineRatio = 4; // default overcommit ratio
                const baselineVcpuCap = hwConfig.totalPhysicalCores * effectiveNodes * baselineRatio;
                const computePctAtBaseline = baselineVcpuCap > 0 ? Math.min(100, Math.round((totalVcpus / baselineVcpuCap) * 100)) : 0;
                if (isMaxCores && isMaxSockets && computePctAtBaseline >= 80) {
                    // Find the AMD generation with the most cores
                    let bestAmdGen = null;
                    let bestAmdMaxCores = 0;
                    for (const gen of CPU_GENERATIONS.amd) {
                        const genMax = gen.coreOptions[gen.coreOptions.length - 1];
                        if (genMax > bestAmdMaxCores) {
                            bestAmdMaxCores = genMax;
                            bestAmdGen = gen;
                        }
                    }
                    if (bestAmdGen && bestAmdMaxCores * 2 > hwConfig.totalPhysicalCores) {
                        notes.push(`💡 Tip: ${hwConfig.generation.name} is at maximum cores (${maxIntelCores} per socket × ${hwConfig.sockets} sockets = ${hwConfig.totalPhysicalCores} physical cores per node). ${bestAmdGen.name} offers up to ${bestAmdMaxCores} cores per socket (${bestAmdMaxCores * 2} with dual socket), which could provide additional compute headroom`);
                    }
                }
            }
        }

        // Utilization threshold checks (compute, memory, storage)
        const currentComputePercent = parseInt(document.getElementById('compute-percent').textContent) || 0;
        const currentMemoryPercent = parseInt(document.getElementById('memory-percent').textContent) || 0;
        const currentStoragePercent = parseInt(document.getElementById('storage-percent').textContent) || 0;
        if (currentComputePercent >= 90) {
            notes.push('🚫 Compute utilization is at ' + currentComputePercent + '% — configurations at or above 90% are not recommended. Increase CPU cores, add nodes, or reduce workloads.');
        }
        if (currentMemoryPercent >= 90) {
            notes.push('🚫 Memory utilization is at ' + currentMemoryPercent + '% — configurations at or above 90% are not recommended. Increase memory per node, add nodes, or reduce workloads.');
        }
        if (currentStoragePercent >= 90) {
            notes.push('🚫 Storage utilization is at ' + currentStoragePercent + '% — configurations at or above 90% are not recommended. Add nodes, increase disk count/size, or reduce workloads.');
        }

        // Storage metadata memory overhead note (4 GB per TB of cache drive capacity)
        if (hwConfig && hwConfig.diskConfig) {
            const dc = hwConfig.diskConfig;
            let cacheTB = 0;
            if (dc.isTiered && dc.cache) {
                cacheTB = (dc.cache.count * dc.cache.sizeGB) / 1024;
            }
            if (cacheTB > 0) {
                const metadataGB = Math.ceil(cacheTB * 4);
                notes.push(`ℹ️ Storage Spaces Direct metadata: ~${metadataGB} GB memory reserved per node for cache drives (4 GB per TB of cache capacity). Not included in workload memory calculations.`);
            }
        }

        // 400 TB per-machine storage validation
        let storageLimitExceeded = false;
        let storageLimitMessages = [];
        if (hwConfig && hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
            const dc = hwConfig.diskConfig;
            let rawStoragePerMachineTB = (dc.capacity.count * dc.capacity.sizeGB) / 1024;
            if (dc.isTiered && dc.cache) {
                rawStoragePerMachineTB += (dc.cache.count * dc.cache.sizeGB) / 1024;
            }
            if (rawStoragePerMachineTB > 400) {
                notes.push(`🚫 Raw storage per machine (~${rawStoragePerMachineTB.toFixed(0)} TB) exceeds the Azure Local supported maximum of 400 TB per machine. Reduce disk count or disk size.`);
                storageLimitExceeded = true;
                storageLimitMessages.push(`Raw storage per machine (~${rawStoragePerMachineTB.toFixed(0)} TB) exceeds 400 TB max`);
            }
        }

        // 4 PB cluster storage validation
        if (hwConfig && hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
            const dc = hwConfig.diskConfig;
            let rawPerNodeTB = (dc.capacity.count * dc.capacity.sizeGB) / 1024;
            if (dc.isTiered && dc.cache) {
                rawPerNodeTB += (dc.cache.count * dc.cache.sizeGB) / 1024;
            }
            const totalClusterRawTB = rawPerNodeTB * nodeCount;
            if (totalClusterRawTB > 4000) {
                notes.push(`🚫 Total cluster raw storage (~${totalClusterRawTB.toFixed(0)} TB) exceeds the Azure Local supported maximum of 4 PB (4,000 TB) per storage pool. Reduce nodes, disk count, or disk size.`);
                storageLimitExceeded = true;
                storageLimitMessages.push(`Cluster raw storage (~${totalClusterRawTB.toFixed(0)} TB) exceeds 4 PB (4,000 TB) max`);
            }
        }

        // Update storage limit banner and global flag
        _storageLimitExceeded = storageLimitExceeded;
        const storageLimitBanner = document.getElementById('storage-limit-warning');
        const storageLimitText = document.getElementById('storage-limit-warning-text');
        if (storageLimitBanner) {
            storageLimitBanner.style.display = storageLimitExceeded ? 'flex' : 'none';
            if (storageLimitExceeded && storageLimitText) {
                storageLimitText.textContent = storageLimitMessages.join('. ') + '. This is an unsupported configuration — export is blocked until corrected.';
            }
        }
        
        // vCPU to core ratio
        const vcpuRatio = getVcpuRatio();
        if (_vcpuRatioAutoEscalated) {
            notes.push(`⚠️ Warning: vCPU overcommit ratio has been auto-scaled to ${vcpuRatio}:1 — physical CPU cores and sockets are maxed out for required vCPUs. A ${vcpuRatio}:1 or higher overcommit ratio is required to accommodate the workload. Consider adding more nodes / clusters, or reducing workload vCPU requirements.`);
        } else {
            notes.push(`vCPU calculations use ${vcpuRatio}:1 vCPU to pCPU overcommit ratio`);
        }

        // Infrastructure_1 volume + ARB appliance note
        notes.push('ℹ️ Infrastructure overhead: 256 GB usable storage reserved by Storage Spaces Direct (Infrastructure_1 volume) has been deducted from the overall usable storage. Azure Resource Bridge (ARB) appliance VM reserves ' + ARB_MEMORY_OVERHEAD_GB + ' GB memory and ' + ARB_VCPU_OVERHEAD + ' vCPUs per cluster — deducted from workload-available capacity.');

        // S2D Resiliency Repair note
        if (nodeCount >= 1 && hwConfig && hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
            const reservedDisks = getRepairDiskCount();
            const recommendedDisks = Math.min(nodeCount, S2D_REPAIR_MAX_RESERVED_DISKS);
            const reservedDiskSizeGB = hwConfig.diskConfig.capacity.sizeGB;
            const reservedTotalGB = reservedDisks * reservedDiskSizeGB;
            const reservedTotalTB = (reservedTotalGB / 1024).toFixed(2);
            if (_repairDisksUserSet && reservedDisks < recommendedDisks) {
                notes.push('⚠️ S2D Resiliency Repair: Warning — recommended ' + recommendedDisks + ' × capacity disks should be reserved based on the cluster size (' + nodeCount + ' nodes), but currently only ' + reservedDisks + ' × capacity disk' + (reservedDisks !== 1 ? 's are' : ' is') + ' reserved (' + reservedTotalTB + ' TB). This raw capacity has been deducted from the available usable storage.');
            } else if (_repairDisksUserSet) {
                notes.push('ℹ️ S2D Resiliency Repair: ' + reservedDisks + ' × capacity disk (' + (reservedDiskSizeGB / 1024).toFixed(2) + ' TB each = ' + reservedTotalTB + ' TB total) free space reserved in the storage pool for Storage Spaces Direct repair jobs (manually set). This raw capacity has been deducted from the available usable storage.');
            } else {
                notes.push('ℹ️ S2D Resiliency Repair: ' + reservedDisks + ' × capacity disk (' + (reservedDiskSizeGB / 1024).toFixed(2) + ' TB each = ' + reservedTotalTB + ' TB total) free space reserved in the storage pool for Storage Spaces Direct repair jobs, up to a maximum of ' + S2D_REPAIR_MAX_RESERVED_DISKS + ' × capacity disks. This raw capacity has been deducted from the available usable storage.');
            }
        }

        // Disk bay consolidation note
        if (_diskConsolidationInfo) {
            const info = _diskConsolidationInfo;
            notes.push(`💡 Disk bay optimization: ${info.originalCount} × ${info.originalSizeTB} TB capacity disks would use ${Math.round(info.originalCount / info.maxBays * 100)}% of available disk bays (${info.maxBays} max). Auto-scaled to ${info.newCount} × ${info.newSizeTB} TB disks instead, freeing ${info.baysFreed} bay${info.baysFreed > 1 ? 's' : ''} per node for future expansion. Note: Disk size and number can be edited, if you prefer a larger number of smaller capacity disks.`);
        }

        // Host overhead note
        notes.push('ℹ️ Host overhead: 32 GB memory reserved per node for Azure Local OS and management — excluded from workload-available memory in capacity calculations.');

        // Network note
        notes.push('ℹ️ Network: Multinode Azure Local hyperconverged instances requires RDMA-capable NICs (25 GbE+ recommended). Storage traffic uses dedicated NICs for east-west storage replication bandwidth.');

        // Boot/OS drive note — only shown when memory exceeds 768 GB (larger boot drive needed)
        if (hwConfig && hwConfig.memoryGB > 768) {
            notes.push('ℹ️ Boot drive: minimum 400 GB OS disks recommended for systems with >768 GB memory.');
        }
    }
    
    const notesList = document.getElementById('sizing-notes');
    notesList.innerHTML = notes.map(n => `<li>${n}</li>`).join('');

    // Show/hide "Configure in Designer" button
    updateDesignerActionVisibility();
}

// Show "Configure in Designer" button only when workloads exist and all resources are under 90%
function updateDesignerActionVisibility() {
    const actionDiv = document.getElementById('designer-action');
    const designerBtn = document.querySelector('.btn-designer');
    if (actionDiv) {
        actionDiv.style.display = workloads.length > 0 ? 'block' : 'none';
    }
    // Disable button when any resource >= 90%
    if (designerBtn) {
        const computePercent = parseInt(document.getElementById('compute-percent').textContent) || 0;
        const memoryPercent = parseInt(document.getElementById('memory-percent').textContent) || 0;
        const storagePercent = parseInt(document.getElementById('storage-percent').textContent) || 0;
        const overResources = [];
        if (computePercent >= 90) overResources.push('Compute');
        if (memoryPercent >= 90) overResources.push('Memory');
        if (storagePercent >= 90) overResources.push('Storage');

        if (overResources.length > 0 && workloads.length > 0) {
            designerBtn.disabled = true;
            designerBtn.title = overResources.join(', ') + ' utilization must be below 90% before configuring in Designer';
        } else {
            designerBtn.disabled = false;
            designerBtn.title = '';
        }
    }
}

// Map sizer cluster type to Designer scale value
function mapSizerToDesignerScale(clusterType) {
    if (clusterType === 'rack-aware') return 'rack_aware';
    if (clusterType === 'aldo-mgmt') return 'medium';
    if (clusterType === 'aldo-wl') return 'medium';
    // Both 'single' and 'standard' map to 'medium' (Hyperconverged)
    return 'medium';
}

// Transfer sizer configuration to the Designer via localStorage
// ============================================
// Export Functions
// ============================================

function exportSizerWord() {
    // Block export if storage limits are exceeded
    if (_storageLimitExceeded) {
        alert('Export blocked: The current storage configuration exceeds Azure Local supported limits (400 TB per machine or 4 PB per storage pool). Please reduce disk count, disk size, or node count before exporting.');
        return;
    }

    var hwConfig = getHardwareConfig();
    var clusterType = document.getElementById('cluster-type').value;
    var nodeCount = document.getElementById('node-count').value;
    var resiliency = document.getElementById('resiliency').value;
    var futureGrowth = document.getElementById('future-growth').value;
    var resConfig = RESILIENCY_CONFIG[resiliency] || {};

    var clusterLabels = { 'single': 'Single Node', 'standard': 'Standard Cluster', 'rack-aware': 'Rack Aware Cluster', 'aldo-mgmt': 'ALDO Management Cluster', 'aldo-wl': 'ALDO Workload Cluster' };
    var storageLabels = { 'all-flash': 'All-Flash (NVMe or SSD)', 'mixed-flash': 'Mixed All-Flash (NVMe + SSD)', 'hybrid': 'Hybrid (SSD/NVMe + HDD)' };
    var growthLabels = { '0': 'None', '10': '10%', '20': '20%', '30': '30%', '50': '50%' };

    // Build workload rows
    var workloadRows = '';
    workloads.forEach(function(w) {
        var reqs = calculateWorkloadRequirements(w);
        var typeLabel = w.type === 'vm' ? 'Virtual Machine' : w.type === 'aks' ? 'AKS Cluster' : 'Azure Virtual Desktop';
        workloadRows += '<tr><td>' + escapeHtmlSizer(w.name || typeLabel) + '</td><td>' + typeLabel + '</td><td>' + reqs.vcpus + '</td><td>' + reqs.memory + ' GB</td><td>' + (reqs.storage / 1000).toFixed(2) + ' TB</td></tr>';
    });

    // Read totals from the DOM
    var totalVcpus = document.getElementById('total-vcpus').textContent || '0';
    var totalMemory = document.getElementById('total-memory').textContent || '0';
    var totalStorage = document.getElementById('total-storage').textContent || '0';
    var perNodeCores = document.getElementById('per-node-cores').textContent || '0';
    var perNodeMemory = document.getElementById('per-node-memory').textContent || '0';
    var perNodeStorage = document.getElementById('per-node-storage').textContent || '0';
    var perNodeUsable = document.getElementById('per-node-usable').textContent || '0';
    var computePercent = document.getElementById('compute-percent').textContent || '0%';
    var memoryPercent = document.getElementById('memory-percent').textContent || '0%';
    var storagePercent = document.getElementById('storage-percent').textContent || '0%';

    // Disk config description
    var diskDesc = '';
    if (hwConfig.diskConfig.isTiered) {
        var cache = hwConfig.diskConfig.cache;
        var cap = hwConfig.diskConfig.capacity;
        diskDesc = 'Cache: ' + cache.count + 'x ' + formatDiskSize(cache.sizeGB) + ' (' + cache.type + ') + Capacity: ' + cap.count + 'x ' + formatDiskSize(cap.sizeGB) + ' (' + cap.type + ')';
    } else if (hwConfig.diskConfig.capacity) {
        var cap = hwConfig.diskConfig.capacity;
        diskDesc = cap.count + 'x ' + formatDiskSize(cap.sizeGB) + ' (' + cap.type + ')';
    }

    // Sizing notes
    var notesEl = document.getElementById('sizing-notes');
    var notesHtml = '';
    if (notesEl) {
        var items = notesEl.querySelectorAll('li');
        for (var i = 0; i < items.length; i++) {
            notesHtml += '<li>' + items[i].textContent + '</li>';
        }
    }

    var css = [
        'body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; padding: 0.75in; }',
        'h1 { font-size: 22pt; color: #0078d4; margin: 0 0 4pt; }',
        'h2 { font-size: 14pt; color: #111; border-bottom: 2px solid #0078d4; padding-bottom: 4pt; margin: 18pt 0 10pt; }',
        'h3 { font-size: 12pt; color: #333; margin: 14pt 0 8pt; }',
        'table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt; }',
        'th { background: #0078d4; color: white; text-align: left; padding: 6pt 10pt; font-weight: 600; }',
        'td { border: 1px solid #d1d5db; padding: 6pt 10pt; }',
        'tr:nth-child(even) td { background: #f9fafb; }',
        '.kv-table td:first-child { width: 35%; font-weight: 600; background: #f3f4f6; }',
        '.summary-box { display: inline-block; width: 22%; text-align: center; border: 1px solid #d1d5db; border-radius: 8px; padding: 10pt; margin: 4pt 1%; vertical-align: top; }',
        '.summary-box .val { font-size: 18pt; font-weight: 700; color: #0078d4; }',
        '.summary-box .lbl { font-size: 9pt; color: #666; }',
        'ul { margin: 4pt 0 8pt 18pt; }',
        'li { margin: 0 0 3pt; }',
        '.subtitle { color: #666; font-size: 10pt; margin: 0 0 14pt; }',
        '.timestamp { color: #999; font-size: 9pt; }',
        '@page { margin: 0.75in; }'
    ].join('\n');

    var html = '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
        + '<head><meta charset="UTF-8"><title>ODIN Sizer Report</title><style>' + css + '</style></head><body>';

    html += '<h1>ODIN Sizer Report</h1>';
    html += '<p class="subtitle">Azure Local Instance Sizing Tool</p>';
    html += '<p class="timestamp">Generated: ' + new Date().toLocaleString() + '</p>';

    // Cluster Configuration
    html += '<h2>Cluster Configuration</h2>';
    html += '<table class="kv-table"><tbody>';
    html += '<tr><td>Deployment Type</td><td>' + (clusterLabels[clusterType] || clusterType) + '</td></tr>';
    html += '<tr><td>Node Count</td><td>' + nodeCount + '</td></tr>';
    html += '<tr><td>Storage Resiliency</td><td>' + (resConfig.name || resiliency) + '</td></tr>';
    html += '<tr><td>Future Growth</td><td>' + (growthLabels[futureGrowth] || futureGrowth + '%') + '</td></tr>';
    html += '</tbody></table>';

    // Hardware Configuration
    html += '<h2>Hardware Configuration (per Node)</h2>';
    html += '<table class="kv-table"><tbody>';
    html += '<tr><td>CPU</td><td>' + (hwConfig.generation ? hwConfig.generation.name : 'Unknown') + '</td></tr>';
    html += '<tr><td>Cores per Socket</td><td>' + hwConfig.coresPerSocket + '</td></tr>';
    html += '<tr><td>CPU Sockets</td><td>' + hwConfig.sockets + '</td></tr>';
    html += '<tr><td>Total Physical Cores</td><td>' + hwConfig.totalPhysicalCores + '</td></tr>';
    html += '<tr><td>vCPU Ratio (pCPU:vCPU)</td><td>' + getVcpuRatio() + ':1</td></tr>';
    html += '<tr><td>Memory</td><td>' + hwConfig.memoryGB + ' GB</td></tr>';
    if (hwConfig.gpuCount > 0) {
        const gpuLabel = getGpuLabel(hwConfig.gpuType);
        html += '<tr><td>GPU</td><td>' + hwConfig.gpuCount + ' × ' + gpuLabel + '</td></tr>';
    }
    html += '<tr><td>Storage Configuration</td><td>' + (storageLabels[hwConfig.storageConfig] || hwConfig.storageConfig) + '</td></tr>';
    html += '<tr><td>Disk Configuration</td><td>' + diskDesc + '</td></tr>';
    html += '</tbody></table>';

    // Requirements Summary
    html += '<h2>Requirements Summary</h2>';
    html += '<div>';
    html += '<div class="summary-box"><div class="val">' + totalVcpus + '</div><div class="lbl">Total vCPUs</div></div>';
    html += '<div class="summary-box"><div class="val">' + totalMemory + '</div><div class="lbl">Total Memory</div></div>';
    html += '<div class="summary-box"><div class="val">' + totalStorage + '</div><div class="lbl">Total Storage</div></div>';
    html += '<div class="summary-box"><div class="val">' + workloads.length + '</div><div class="lbl">Workloads</div></div>';
    html += '</div>';

    // Per-Node Requirements
    html += '<h3>Workload Per-Node Requirements (with N+1)</h3>';
    html += '<table class="kv-table"><tbody>';
    html += '<tr><td>Physical Cores</td><td>' + perNodeCores + '</td></tr>';
    html += '<tr><td>Memory</td><td>' + perNodeMemory + '</td></tr>';
    html += '<tr><td>Raw Storage</td><td>' + perNodeStorage + '</td></tr>';
    html += '<tr><td>Usable Storage</td><td>' + perNodeUsable + '</td></tr>';
    html += '</tbody></table>';

    // Capacity Utilization
    html += '<h3>Capacity Utilization</h3>';
    html += '<table><thead><tr><th>Resource</th><th>Utilization</th></tr></thead><tbody>';
    html += '<tr><td>Compute (vCPUs) - Consumed</td><td>' + computePercent + '</td></tr>';
    html += '<tr><td>Memory - Consumed</td><td>' + memoryPercent + '</td></tr>';
    html += '<tr><td>Usable Storage - Consumed</td><td>' + storagePercent + '</td></tr>';
    html += '</tbody></table>';

    // Workloads
    if (workloads.length > 0) {
        html += '<h2>Workloads (' + workloads.length + ')</h2>';
        html += '<table><thead><tr><th>Name</th><th>Type</th><th>vCPUs</th><th>Memory</th><th>Storage</th></tr></thead><tbody>';
        html += workloadRows;
        html += '</tbody></table>';
    }

    // Sizing Notes
    if (notesHtml) {
        html += '<h2>Azure Local Instance - Sizing Notes</h2>';
        html += '<ul>' + notesHtml + '</ul>';
    }

    html += '</body></html>';

    // Download as .doc
    var blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var ts = new Date();
    var pad2 = function(n) { return n < 10 ? '0' + n : String(n); };
    var fileName = 'ODIN-Sizer-Report-' + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate()) + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes()) + '.doc';
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

function formatDiskSize(sizeGB) {
    if (sizeGB >= 1024) return (sizeGB / 1024).toFixed(1) + ' TB';
    return sizeGB + ' GB';
}

function escapeHtmlSizer(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function configureInDesigner() {
    // Block if storage limits are exceeded
    if (_storageLimitExceeded) {
        alert('Configure in Designer blocked: The current storage configuration exceeds Azure Local supported limits (400 TB per machine or 4 PB per storage pool). Please reduce disk count, disk size, or node count before proceeding.');
        return;
    }

    const clusterType = document.getElementById('cluster-type').value;

    // ALDO Management or Workload Cluster: show FQDN modal instead of region picker
    if (clusterType === 'aldo-mgmt' || clusterType === 'aldo-wl') {
        const fqdnModal = document.getElementById('aldo-fqdn-modal');
        const fqdnOverlay = document.getElementById('aldo-fqdn-modal-overlay');
        if (fqdnModal && fqdnOverlay) {
            const fqdnInput = document.getElementById('aldo-fqdn-input');
            if (fqdnInput) fqdnInput.value = '';
            clearAldoFqdnValidation();
            fqdnModal.classList.add('active');
            fqdnOverlay.classList.add('active');
            if (fqdnInput) fqdnInput.focus();
        }
        return;
    }

    // Show region picker modal — the user selects a region, then we navigate
    const modal = document.getElementById('region-picker-modal');
    const overlay = document.getElementById('region-modal-overlay');
    if (modal && overlay) {
        // Reset to Azure Commercial and show its regions
        const commercialRadio = document.querySelector('input[name="region-cloud"][value="azure_commercial"]');
        if (commercialRadio) commercialRadio.checked = true;
        updateRegionOptions();
        modal.classList.add('active');
        overlay.classList.add('active');
    }
}

// Update visible region buttons based on selected cloud type
function updateRegionOptions() {
    const selectedCloud = document.querySelector('input[name="region-cloud"]:checked')?.value || 'azure_commercial';
    const buttons = document.querySelectorAll('#region-grid .region-btn');
    buttons.forEach(btn => {
        btn.style.display = btn.getAttribute('data-cloud') === selectedCloud ? '' : 'none';
    });
}

// ============================================
// ALDO FQDN Modal Functions
// ============================================

function closeAldoFqdnModal() {
    const modal = document.getElementById('aldo-fqdn-modal');
    const overlay = document.getElementById('aldo-fqdn-modal-overlay');
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

function clearAldoFqdnValidation() {
    const errEl = document.getElementById('aldo-fqdn-error');
    const succEl = document.getElementById('aldo-fqdn-success');
    const btn = document.getElementById('aldo-fqdn-confirm-btn');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (succEl) succEl.style.display = 'none';
    if (btn) btn.disabled = true;
}

function validateAldoFqdn() {
    const input = document.getElementById('aldo-fqdn-input');
    const errEl = document.getElementById('aldo-fqdn-error');
    const succEl = document.getElementById('aldo-fqdn-success');
    const btn = document.getElementById('aldo-fqdn-confirm-btn');
    if (!input) return;

    const fqdn = input.value.trim();
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (succEl) succEl.style.display = 'none';
    if (btn) btn.disabled = true;

    if (!fqdn) return;

    // Validate FQDN format (same rules as Designer)
    const fqdnRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
    if (!fqdnRegex.test(fqdn)) {
        if (errEl) { errEl.textContent = '\u26A0 Invalid FQDN format. Use a host FQDN (e.g. mgmt.contoso.com).'; errEl.style.display = 'block'; }
        return;
    }
    const labels = fqdn.toLowerCase().split('.');
    if (labels.length < 3) {
        if (errEl) { errEl.textContent = '\u26A0 Root domains (e.g. contoso.com) are not supported. Use a host FQDN.'; errEl.style.display = 'block'; }
        return;
    }
    if (labels[labels.length - 1] === 'local') {
        if (errEl) { errEl.textContent = '\u26A0 .local domains are not supported for disconnected operations.'; errEl.style.display = 'block'; }
        return;
    }

    // Valid
    if (succEl) succEl.style.display = 'block';
    if (btn) btn.disabled = false;
}

function confirmAldoFqdnAndConfigure() {
    const input = document.getElementById('aldo-fqdn-input');
    if (!input) return;
    const fqdn = input.value.trim();
    if (!fqdn) return;

    closeAldoFqdnModal();

    const clusterType = document.getElementById('cluster-type').value;

    // ALDO Workload Cluster: skip region picker (region not used for disconnected workload)
    if (clusterType === 'aldo-wl') {
        window._aldoPendingFqdn = fqdn;
        selectRegionAndConfigure('', '');
        return;
    }

    // ALDO Management Cluster: show region picker next
    // Pass FQDN through a temporary variable
    window._aldoPendingFqdn = fqdn;

    const modal = document.getElementById('region-picker-modal');
    const overlay = document.getElementById('region-modal-overlay');
    if (modal && overlay) {
        const commercialRadio = document.querySelector('input[name="region-cloud"][value="azure_commercial"]');
        if (commercialRadio) commercialRadio.checked = true;
        updateRegionOptions();
        modal.classList.add('active');
        overlay.classList.add('active');
    }
}

// Close the region picker modal
function closeRegionModal() {
    const modal = document.getElementById('region-picker-modal');
    const overlay = document.getElementById('region-modal-overlay');
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// User selected a region — build payload and navigate to Designer
function selectRegionAndConfigure(region, cloud) {
    closeRegionModal();

    const clusterType = document.getElementById('cluster-type').value;
    const nodeCount = document.getElementById('node-count').value;
    const resiliency = document.getElementById('resiliency').value;
    const hwConfig = getHardwareConfig();

    // ALDO Management or Workload Cluster: set disconnected scenario + cluster role
    const isAldo = clusterType === 'aldo-mgmt' || clusterType === 'aldo-wl';
    const aldoFqdn = window._aldoPendingFqdn || null;
    if (isAldo) delete window._aldoPendingFqdn;

    // Build the sizer-to-designer payload
    const sizerPayload = {
        source: 'sizer',
        timestamp: new Date().toISOString(),
        // Scenario: disconnected for ALDO types, hyperconverged for others
        scenario: isAldo ? 'disconnected' : 'hyperconverged',
        // ALDO-specific fields
        clusterRole: clusterType === 'aldo-mgmt' ? 'management' : (clusterType === 'aldo-wl' ? 'workload' : undefined),
        autonomousCloudFqdn: aldoFqdn || undefined,
        fqdnConfirmed: aldoFqdn ? true : undefined,
        // Region selected by user
        cloud: cloud,
        region: region,
        // Designer-compatible fields
        scale: mapSizerToDesignerScale(clusterType),
        nodes: nodeCount,
        // Hardware details (hidden in Designer, shown in report)
        sizerHardware: {
            clusterType: clusterType,
            nodeCount: parseInt(nodeCount),
            resiliency: resiliency,
            cpu: {
                manufacturer: hwConfig.manufacturer,
                generation: hwConfig.generation ? hwConfig.generation.name : 'Unknown',
                coresPerSocket: hwConfig.coresPerSocket,
                sockets: hwConfig.sockets,
                totalCores: hwConfig.totalPhysicalCores
            },
            memory: {
                perNodeGB: hwConfig.memoryGB
            },
            gpu: {
                countPerNode: hwConfig.gpuCount,
                type: hwConfig.gpuCount > 0 ? getGpuLabel(hwConfig.gpuType) : 'None'
            },
            vcpuRatio: getVcpuRatio(),
            futureGrowth: document.getElementById('future-growth').value,
            storage: {
                config: hwConfig.storageConfig,
                tiering: hwConfig.tieringId,
                diskConfig: hwConfig.diskConfig
            },
            workloadSummary: {
                count: workloads.length,
                totalVcpus: parseInt(document.getElementById('total-vcpus').textContent) || 0,
                totalMemoryGB: parseInt(document.getElementById('total-memory').textContent) || 0,
                totalStorageTB: parseFloat(document.getElementById('total-storage').textContent) || 0
            }
        },
        // Individual workload details (transparent pass-through to Report)
        sizerWorkloads: workloads.map(function(w) {
            var req = calculateWorkloadRequirements(w);
            var entry = {
                type: w.type,
                name: w.name,
                totalVcpus: req.vcpus,
                totalMemoryGB: req.memory,
                totalStorageGB: req.storage
            };
            // Type-specific details for the report
            switch (w.type) {
                case 'vm':
                    entry.vcpusPerVm = w.vcpus;
                    entry.memoryPerVmGB = w.memory;
                    entry.storagePerVmGB = w.storage;
                    entry.count = w.count;
                    break;
                case 'aks':
                    entry.clusterCount = w.clusterCount;
                    entry.controlPlaneNodes = w.controlPlaneNodes;
                    entry.controlPlaneVcpus = w.controlPlaneVcpus;
                    entry.controlPlaneMemory = w.controlPlaneMemory;
                    entry.workerNodes = w.workerNodes;
                    entry.workerVcpus = w.workerVcpus;
                    entry.workerMemory = w.workerMemory;
                    entry.workerStorage = w.workerStorage;
                    break;
                case 'avd':
                    entry.profile = w.profile;
                    entry.userCount = w.userCount;
                    entry.sessionType = w.sessionType;
                    entry.concurrency = w.concurrency;
                    entry.fslogix = w.fslogix;
                    entry.fslogixSize = w.fslogixSize;
                    if (w.profile === 'custom') {
                        entry.customVcpus = w.customVcpus;
                        entry.customMemory = w.customMemory;
                        entry.customStorage = w.customStorage;
                    }
                    break;
            }
            return entry;
        })
    };

    // Store in localStorage for the Designer to pick up
    try {
        localStorage.setItem('odinSizerToDesigner', JSON.stringify(sizerPayload));
    } catch (e) {
        console.warn('Failed to store sizer payload:', e);
    }

    // Navigate to Designer
    window.location.href = '../?tab=designer&from=sizer';
}

// ============================================
// Export / Import Sizer Configuration (JSON)
// ============================================

// Export current sizer state to a downloadable JSON file
function exportSizerJSON() {
    try {
        const state = getSizerState();
        const exportPayload = {
            _meta: {
                tool: 'ODIN Sizer for Azure Local',
                version: SIZER_VERSION,
                exportedAt: new Date().toISOString(),
                url: window.location.href
            },
            data: state
        };

        const json = JSON.stringify(exportPayload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Build a descriptive filename
        const dateStr = new Date().toISOString().slice(0, 10);
        const clusterType = state.clusterType || 'standard';
        const nodeCount = state.nodeCount || '0';
        const wlCount = (state.workloads && state.workloads.length) || 0;
        const filename = `odin-sizer_${clusterType}_${nodeCount}n_${wlCount}wl_${dateStr}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Export failed:', e);
        alert('Failed to export sizer configuration. See console for details.');
    }
}

// Trigger file picker for JSON import
function importSizerJSON() {
    const fileInput = document.getElementById('sizer-import-file');
    if (fileInput) {
        fileInput.value = ''; // reset so the same file can be re-selected
        fileInput.click();
    }
}

// Handle the selected file for import
function handleSizerFileImport(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
        alert('Please select a valid JSON file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const parsed = JSON.parse(e.target.result);

            // Accept either { _meta, data } wrapper or raw state object
            const d = parsed.data || parsed;

            // Basic validation: ensure it looks like sizer state
            if (!d.clusterType && !d.workloads) {
                alert('The selected file does not appear to be a valid ODIN Sizer configuration.');
                return;
            }

            // Confirm before overwriting current state
            if (workloads.length > 0) {
                if (!confirm('Importing will replace your current configuration and all workloads. Continue?')) {
                    return;
                }
            }

            // Apply via the same restore logic used by resumeSizerState
            applyImportedSizerState(d);

        } catch (err) {
            console.error('Import parse error:', err);
            alert('Failed to parse the JSON file. Please ensure it is a valid ODIN Sizer export.');
        }
    };
    reader.readAsText(file);
}

// Apply an imported sizer state object to the UI (mirrors resumeSizerState)
function applyImportedSizerState(d) {
    // Restore cluster config
    document.getElementById('cluster-type').value = d.clusterType || 'standard';
    updateNodeOptionsForClusterType();
    updateStorageForClusterType();
    document.getElementById('node-count').value = d.nodeCount || '3';
    document.getElementById('future-growth').value = d.futureGrowth || '0';

    // Restore CPU config
    document.getElementById('cpu-manufacturer').value = d.cpuManufacturer || 'intel';
    const manufacturer = d.cpuManufacturer || 'intel';
    const generations = CPU_GENERATIONS[manufacturer];
    if (generations) {
        const genSelect = document.getElementById('cpu-generation');
        genSelect.innerHTML = generations.map(g =>
            `<option value="${g.id}">${g.name}</option>`
        ).join('');
        genSelect.disabled = false;
        genSelect.value = d.cpuGeneration || generations[0].id;

        const gen = generations.find(g => g.id === (d.cpuGeneration || generations[0].id));
        if (gen) {
            const coresSelect = document.getElementById('cpu-cores');
            coresSelect.innerHTML = gen.coreOptions.map(c =>
                `<option value="${c}">${c} cores</option>`
            ).join('');
            coresSelect.disabled = false;
            coresSelect.value = d.cpuCores || '24';
        }
    }

    document.getElementById('cpu-sockets').value = d.cpuSockets || '2';
    document.getElementById('node-memory').value = d.nodeMemory || '512';

    // Restore GPU config
    document.getElementById('gpu-count').value = d.gpuCount || '0';
    document.getElementById('gpu-type').value = d.gpuType || 'a2';
    updateGpuTypeVisibility();

    // Restore vCPU ratio
    if (d.vcpuRatio) {
        document.getElementById('vcpu-ratio').value = d.vcpuRatio;
    }

    // Restore storage config
    document.getElementById('storage-config').value = d.storageConfig || 'all-flash';
    onStorageConfigChange();
    if (d.storageTiering) {
        document.getElementById('storage-tiering').value = d.storageTiering;
        onStorageTieringChange();
    }

    // Restore disk configs
    document.getElementById('capacity-disk-count').value = d.capacityDiskCount || '4';
    document.getElementById('capacity-disk-size').value = d.capacityDiskSize || '3.84';
    document.getElementById('cache-disk-count').value = d.cacheDiskCount || '2';
    document.getElementById('cache-disk-size').value = d.cacheDiskSize || '1.92';
    document.getElementById('tiered-capacity-disk-count').value = d.tieredCapacityDiskCount || '4';
    document.getElementById('tiered-capacity-disk-size').value = d.tieredCapacityDiskSize || '3.84';

    // Restore resiliency
    updateResiliencyOptions();
    if (d.resiliency) {
        const resSelect = document.getElementById('resiliency');
        const validOptions = Array.from(resSelect.options).map(o => o.value);
        if (validOptions.includes(d.resiliency)) {
            resSelect.value = d.resiliency;
        }
    }

    // Restore workloads
    workloads = d.workloads || [];
    workloadIdCounter = d.workloadIdCounter || 0;

    // Restore all MANUAL override flags
    _nodeCountUserSet = !!d.nodeCountUserSet;
    if (_nodeCountUserSet) {
        markManualSet('node-count');
    }

    _vcpuRatioUserSet = !!d.vcpuRatioUserSet;
    if (_vcpuRatioUserSet) {
        markManualSet('vcpu-ratio');
    }

    _memoryUserSet = !!d.memoryUserSet;
    if (_memoryUserSet) {
        markManualSet('node-memory');
    }

    _cpuConfigUserSet = !!d.cpuConfigUserSet;
    if (_cpuConfigUserSet) {
        markManualSet('cpu-manufacturer');
        markManualSet('cpu-generation');
        markManualSet('cpu-cores');
        markManualSet('cpu-sockets');
    }

    _diskSizeUserSet = !!d.diskSizeUserSet;
    if (_diskSizeUserSet) {
        const isTiered = _isTieredStorage();
        markManualSet(isTiered ? 'tiered-capacity-disk-size' : 'capacity-disk-size');
    }

    _diskCountUserSet = !!d.diskCountUserSet;
    if (_diskCountUserSet) {
        const isTiered = _isTieredStorage();
        markManualSet(isTiered ? 'tiered-capacity-disk-count' : 'capacity-disk-count');
    }

    // Restore repair disk count
    _repairDisksUserSet = !!d.repairDisksUserSet;
    if (d.repairDiskCount !== undefined) {
        document.getElementById('repair-disk-count').value = d.repairDiskCount;
        document.getElementById('tiered-repair-disk-count').value = d.repairDiskCount;
        if (_repairDisksUserSet) {
            markManualSet('repair-disk-count');
            markManualSet('tiered-repair-disk-count');
        }
    }

    // Update UI
    updateAldoWorkloadButtons();
    updateClusterInfo();
    renderWorkloads();
    calculateRequirements();

    // Persist to localStorage
    saveSizerState();
}

// Reset scenario
function resetScenario() {
    // Confirm if there are workloads added
    if (workloads.length > 0) {
        if (!confirm('Are you sure you want to reset? This will remove all workloads and restore default settings.')) {
            return;
        }
    }
    clearSizerState();
    workloads = [];
    workloadIdCounter = 0;
    _vcpuRatioUserSet = false;
    _memoryUserSet = false;
    _cpuConfigUserSet = false;
    _diskSizeUserSet = false;
    _diskCountUserSet = false;
    _nodeCountUserSet = false;
    _repairDisksUserSet = false;
    clearManualBadges();
    
    // Reset hardware config
    document.getElementById('cpu-manufacturer').value = 'intel';
    initHardwareDefaults();
    document.getElementById('cpu-sockets').value = '2';
    document.getElementById('node-memory').value = '512';
    document.getElementById('gpu-count').value = '0';
    document.getElementById('gpu-type').value = 'a2';
    updateGpuTypeVisibility();
    document.getElementById('vcpu-ratio').value = '4';
    document.getElementById('storage-config').value = 'all-flash';
    document.getElementById('future-growth').value = '0';
    onStorageConfigChange();
    
    // Reset disk config
    document.getElementById('capacity-disk-count').value = '4';
    document.getElementById('capacity-disk-size').value = '3.84';
    document.getElementById('cache-disk-count').value = '2';
    document.getElementById('cache-disk-size').value = '1.92';
    document.getElementById('tiered-capacity-disk-count').value = '4';
    document.getElementById('tiered-capacity-disk-size').value = '3.84';
    document.getElementById('repair-disk-count').value = '2';
    document.getElementById('tiered-repair-disk-count').value = '2';
    
    // Reset cluster config
    document.getElementById('cluster-type').value = 'standard';
    updateNodeOptionsForClusterType();
    updateStorageForClusterType();
    document.getElementById('node-count').value = '2';
    updateResiliencyOptions();
    document.getElementById('resiliency').value = '2way';
    updateClusterInfo();
    renderWorkloads();
    calculateRequirements();
}

// Set default hardware config (Intel Emerald Rapids, 24 cores)
function initHardwareDefaults() {
    const manufacturer = document.getElementById('cpu-manufacturer').value;
    if (!manufacturer) return;

    const generations = CPU_GENERATIONS[manufacturer];
    const genSelect = document.getElementById('cpu-generation');
    genSelect.innerHTML = generations.map(g =>
        `<option value="${g.id}" ${g.id === 'xeon-5th' && manufacturer === 'intel' ? 'selected' : ''}>${g.name}</option>`
    ).join('');
    genSelect.disabled = false;

    // Set default generation
    const defaultGenId = manufacturer === 'intel' ? 'xeon-5th' : generations[0].id;
    genSelect.value = defaultGenId;

    // Populate cores for the default generation
    const generation = generations.find(g => g.id === defaultGenId);
    if (generation) {
        const coresSelect = document.getElementById('cpu-cores');
        coresSelect.innerHTML = generation.coreOptions.map(c =>
            `<option value="${c}" ${c === 24 ? 'selected' : ''}>${c} cores</option>`
        ).join('');
        coresSelect.disabled = false;
        coresSelect.value = '24';
    }
}

// Initialize on page load
var isInitialLoad = true;
document.addEventListener('DOMContentLoaded', function() {
    // Skip UI initialization when running in test harness (no sizer DOM elements present)
    if (window.__SIZER_TEST_MODE__) return;

    // Check for Designer-to-Sizer transfer BEFORE saved state check
    const designerImported = checkForDesignerImport();

    // Check for saved session BEFORE initial calc (so it doesn't get overwritten)
    if (!designerImported) {
        checkForSavedSizerState();
    }

    updateNodeOptionsForClusterType();
    updateStorageForClusterType();
    updateResiliencyOptions();
    updateClusterInfo();
    updateAldoWorkloadButtons();
    // Initialize hardware defaults
    initHardwareDefaults();
    // Initialize storage config dropdowns
    onStorageConfigChange();
    calculateRequirements();
    applyTheme(); // Apply saved theme

    // Allow saves from now on
    isInitialLoad = false;

    // Show onboarding walkthrough on first visit
    if (!localStorage.getItem(SIZER_ONBOARDING_KEY)) {
        showSizerOnboarding();
    }
});

// ============================================
// ONBOARDING WALKTHROUGH
// ============================================

const SIZER_ONBOARDING_KEY = 'odin_sizer_onboarding_complete';

const sizerOnboardingSteps = [
    {
        icon: '<img src="../images/odin-logo.png" alt="Odin Logo" style="width: 100px; height: 100px; object-fit: contain;">',
        isImage: true,
        title: 'Welcome to the ODIN Sizer',
        description: 'Plan your Azure Local hardware requirements by modelling workloads, resiliency, and capacity — before you buy.',
        features: [
            { icon: '🖥️', title: 'Workload Modelling', text: 'Add VMs, AKS Arc, and AVD workloads with CPU, memory, and storage needs' },
            { icon: '⚖️', title: 'Resiliency Options', text: 'Choose mirror types and see the real impact on usable storage' },
            { icon: '📊', title: 'Live Capacity Bars', text: 'Compute, memory, and storage utilization update in real time' },
            { icon: '💾', title: 'Auto-Save & Import/Export', text: 'Progress is auto-saved to your browser — export your config as JSON to share or back up, and import it later to resume' }
        ]
    },
    {
        icon: '🔧',
        title: 'How It Works',
        description: 'Configure your cluster, add workloads, and let the sizer recommend the right hardware.',
        features: [
            { icon: '1️⃣', title: 'Choose Cluster Type', text: 'Standard, Rack-Aware, or Single Node — each with its own constraints' },
            { icon: '2️⃣', title: 'Add Workloads', text: 'Click VM, AKS, or AVD buttons to define your workload scenarios' },
            { icon: '3️⃣', title: 'Review Sizing', text: 'Auto-sizing recommends nodes, cores, memory, and disks' },
            { icon: '4️⃣', title: 'Send to Designer', text: 'Click "Configure in Designer" to transfer your config into the deployment wizard' }
        ]
    },
    {
        icon: '⚡',
        title: 'Pro Tips',
        description: 'Get the most out of the ODIN Sizer with these features.',
        features: [
            { icon: '📈', title: 'Growth Factor', text: 'Plan for future growth — the sizer applies your growth % to all workloads' },
            { icon: '🔄', title: 'Auto-Scaling', text: 'The engine scales up cores, memory, and disks before adding nodes' },
            { icon: '🚫', title: 'Utilization Guard', text: 'Configurations above 90% utilization are flagged with warnings' },
            { icon: '📄', title: 'Export Results', text: 'Download your sizing as PDF or Word for stakeholder review' }
        ]
    }
];

let currentSizerOnboardingStep = 0;

function showSizerOnboarding() {
    currentSizerOnboardingStep = 0;
    renderSizerOnboardingStep();
}

function renderSizerOnboardingStep() {
    const step = sizerOnboardingSteps[currentSizerOnboardingStep];

    // Remove existing overlay if any
    document.querySelectorAll('.onboarding-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
        <div class="onboarding-card">
            <div class="onboarding-icon${step.isImage ? ' onboarding-icon-image' : ''}">${step.icon}</div>
            <h2 class="onboarding-title">${step.title}</h2>
            <p class="onboarding-description">${step.description}</p>

            <div class="onboarding-features">
                ${step.features.map(f => `
                    <div class="onboarding-feature">
                        <span class="onboarding-feature-icon">${f.icon}</span>
                        <div class="onboarding-feature-text">
                            <strong>${f.title}</strong>
                            ${f.text}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="onboarding-progress">
                ${sizerOnboardingSteps.map((_, i) => `<div class="onboarding-dot ${i === currentSizerOnboardingStep ? 'active' : ''}"></div>`).join('')}
            </div>

            <div class="onboarding-buttons">
                <button class="onboarding-btn onboarding-btn-secondary" data-action="skip">Skip</button>
                <button class="onboarding-btn onboarding-btn-primary" data-action="next">
                    ${currentSizerOnboardingStep === sizerOnboardingSteps.length - 1 ? 'Get Started' : 'Next'}
                </button>
            </div>
        </div>
    `;

    overlay.querySelector('[data-action="skip"]').addEventListener('click', skipSizerOnboarding);
    overlay.querySelector('[data-action="next"]').addEventListener('click', () => {
        if (currentSizerOnboardingStep === sizerOnboardingSteps.length - 1) {
            finishSizerOnboarding();
        } else {
            nextSizerOnboardingStep();
        }
    });

    document.body.appendChild(overlay);
}

function nextSizerOnboardingStep() {
    currentSizerOnboardingStep++;
    if (currentSizerOnboardingStep < sizerOnboardingSteps.length) {
        renderSizerOnboardingStep();
    } else {
        finishSizerOnboarding();
    }
}

function skipSizerOnboarding() {
    localStorage.setItem(SIZER_ONBOARDING_KEY, 'true');
    document.querySelectorAll('.onboarding-overlay').forEach(el => el.remove());
}

function finishSizerOnboarding() {
    localStorage.setItem(SIZER_ONBOARDING_KEY, 'true');
    document.querySelectorAll('.onboarding-overlay').forEach(el => el.remove());
}

// Close onboarding overlay or workload modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        // Workload modal takes precedence
        const modal = document.getElementById('add-workload-modal');
        if (modal && modal.classList.contains('active')) {
            closeModal();
            return;
        }
        const overlay = document.querySelector('.onboarding-overlay');
        if (overlay) {
            skipSizerOnboarding();
            return;
        }
    }

    // Focus trap inside active modal (Tab / Shift+Tab)
    if (e.key === 'Tab') {
        const modal = document.getElementById('add-workload-modal');
        if (!modal || !modal.classList.contains('active')) return;
        const focusable = modal.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
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
        if (logo) logo.src = '../images/odin-logo-white-background.png';
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
        if (logo) logo.src = '../images/odin-logo.png';
        document.body.style.background = '#000000';
    }
}
