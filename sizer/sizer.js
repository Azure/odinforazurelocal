// ============================================
// ODIN Sizer - JavaScript
// ============================================

// LocalStorage keys for sizer state persistence
const SIZER_STATE_KEY = 'odinSizerState';
const SIZER_TIMESTAMP_KEY = 'odinSizerTimestamp';
const SIZER_VERSION = 1;

// Initialize and track page view for analytics
if (typeof initializeAnalytics === 'function') {
    initializeAnalytics();
}
if (typeof trackPageView === 'function') {
    trackPageView();
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
            pcieVersion: '5.0'
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
            pcieVersion: '5.0'
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
            pcieVersion: '5.0'
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
            pcieVersion: '5.0'
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
            pcieVersion: '5.0'
        },
        {
            id: 'epyc-5th',
            name: 'AMD 5th Gen EPYC™ (Turin)',
            minCores: 8,
            maxCores: 128,
            coreOptions: [8, 16, 24, 32, 36, 48, 64, 72, 96, 128],
            defaultCores: 32,
            architecture: 'Zen 5',
            socket: 'SP5 (LGA 6096)',
            memoryType: 'DDR5-6400',
            memoryChannels: 12,
            pcieVersion: '5.0'
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
            pcieVersion: '5.0'
        }
    ]
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

        // Update capacity disk type info
        const capacityInfo = document.getElementById('capacity-disk-type-info');
        capacityInfo.querySelector('span').innerHTML = `Disk type: <strong>${selectedTier.diskTypes.capacity}</strong> — All disks are used for capacity storage.`;
    }

    onHardwareConfigChange();
}

// Enforce 1:2 cache-to-capacity disk ratio for hybrid storage
function enforceCacheToCapacityRatio() {
    const storageConfig = document.getElementById('storage-config').value;
    if (storageConfig !== 'hybrid') return;

    const tieringId = document.getElementById('storage-tiering').value;
    const options = STORAGE_TIERING_OPTIONS[storageConfig];
    const selectedTier = options.find(o => o.id === tieringId) || options[0];
    if (!selectedTier.isTiered) return;

    const capacityCount = parseInt(document.getElementById('tiered-capacity-disk-count').value) || 4;
    const targetCacheCount = Math.ceil(capacityCount / 2);
    const cacheDiskSelect = document.getElementById('cache-disk-count');

    const cacheOptions = Array.from(cacheDiskSelect.options).map(o => parseInt(o.value));
    let bestCache = cacheOptions[cacheOptions.length - 1];
    for (const c of cacheOptions) {
        if (c >= targetCacheCount) {
            bestCache = c;
            break;
        }
    }

    cacheDiskSelect.value = bestCache;
}

// Generic hardware config change handler
function onHardwareConfigChange() {
    enforceCacheToCapacityRatio();
    calculateRequirements();
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
        const cacheDiskSize = parseFloat(document.getElementById('cache-disk-size').value) || 1.6;
        const cacheDiskUnit = document.getElementById('cache-disk-unit').value;
        const capacityDiskCount = parseInt(document.getElementById('tiered-capacity-disk-count').value) || 4;
        const capacityDiskSize = parseFloat(document.getElementById('tiered-capacity-disk-size').value) || 3.5;
        const capacityDiskUnit = document.getElementById('tiered-capacity-disk-unit').value;

        diskConfig = {
            isTiered: true,
            cache: {
                count: cacheDiskCount,
                sizeGB: cacheDiskUnit === 'TB' ? cacheDiskSize * 1024 : cacheDiskSize,
                type: selectedTier.diskTypes.cache
            },
            capacity: {
                count: capacityDiskCount,
                sizeGB: capacityDiskUnit === 'TB' ? capacityDiskSize * 1024 : capacityDiskSize,
                type: selectedTier.diskTypes.capacity
            }
        };
    } else {
        const diskCount = parseInt(document.getElementById('capacity-disk-count').value) || 4;
        const diskSize = parseFloat(document.getElementById('capacity-disk-size').value) || 3.5;
        const diskUnit = document.getElementById('capacity-disk-unit').value;

        diskConfig = {
            isTiered: false,
            capacity: {
                count: diskCount,
                sizeGB: diskUnit === 'TB' ? diskSize * 1024 : diskSize,
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
    // Use max 4 sockets — favour scaling sockets before adding nodes
    const MAX_SOCKETS = 4;

    // Preferred max memory: 1 TB — favour scaling memory before adding nodes
    const PREFERRED_MAX_MEMORY_GB = 1024;

    return {
        totalPhysicalCores: maxCoresPerSocket * MAX_SOCKETS,
        memoryGB: PREFERRED_MAX_MEMORY_GB,
        sockets: MAX_SOCKETS,
        coresPerSocket: maxCoresPerSocket,
        diskConfig: hwConfig.diskConfig // disk config unchanged (getRecommendedNodeCount already uses maxDiskCount)
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
    const vcpuToCore = 4; // vCPU overcommit ratio
    const hostOverheadMemoryGB = 32; // Azure Local host OS + management overhead

    // Available capacity per node from hardware config
    const vcpusPerNode = (hwConfig.totalPhysicalCores || 0) * vcpuToCore;
    const usableMemoryPerNode = Math.max((hwConfig.memoryGB || 0) - hostOverheadMemoryGB, 0);

    // For storage node calculation, use MAX possible disk count (24) per node
    // so we recommend fewer nodes and let autoScaleHardware increase disk count instead
    const maxDiskCount = DISK_COUNT_OPTIONS[DISK_COUNT_OPTIONS.length - 1]; // 24
    let diskSizeGB = 0;
    if (hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
        diskSizeGB = hwConfig.diskConfig.capacity.sizeGB;
    }
    const maxRawStoragePerNodeGB = maxDiskCount * diskSizeGB;

    // Total raw storage needed = usable * resiliency multiplier
    const totalRawStorageNeededGB = totalStorageGB * resiliencyMultiplier;

    // Minimum working nodes for each resource dimension
    let computeNodes = vcpusPerNode > 0 ? Math.ceil(totalVcpus / vcpusPerNode) : 1;
    let memoryNodes = usableMemoryPerNode > 0 ? Math.ceil(totalMemoryGB / usableMemoryPerNode) : 1;
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

// Hide node recommendation info
function hideNodeRecommendation() {
    const recDiv = document.getElementById('node-recommendation');
    if (recDiv) recDiv.style.display = 'none';
}

// ============================================
// Auto-Scale Per-Node Hardware
// ============================================

// Available memory options in GB (must match the <select id="node-memory"> values)
const MEMORY_OPTIONS_GB = [128, 256, 512, 1024, 1536, 2048];

// Available disk count options (must match the capacity-disk-count / tiered-capacity-disk-count select values)
const DISK_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];

// Automatically increase CPU cores, memory, and disk count dropdowns so capacity bars stay below 100%
function autoScaleHardware(totalVcpus, totalMemoryGB, totalStorageGB, nodeCount, resiliencyMultiplier, hwConfig) {
    const vcpuToCore = 4;
    const hostOverheadMemoryGB = 32;
    const effectiveNodes = nodeCount > 1 ? nodeCount - 1 : 1;

    let changed = false;

    // --- Auto-scale CPU cores (and sockets if needed) ---
    const requiredCoresPerNode = Math.ceil(totalVcpus / effectiveNodes / vcpuToCore);
    let sockets = parseInt(document.getElementById('cpu-sockets').value) || 2;
    const socketsSelect = document.getElementById('cpu-sockets');
    const SOCKET_OPTIONS = [1, 2, 4];

    const manufacturer = document.getElementById('cpu-manufacturer').value;
    const genId = document.getElementById('cpu-generation').value;
    if (manufacturer && genId) {
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
            if (targetCores === null && sockets < 4) {
                for (const s of SOCKET_OPTIONS) {
                    if (s <= sockets) continue;
                    // Re-check with more sockets — find smallest cores that work
                    for (const c of generation.coreOptions) {
                        if (c * s >= requiredCoresPerNode) {
                            targetCores = c;
                            sockets = s;
                            socketsSelect.value = s;
                            changed = true;
                            break;
                        }
                    }
                    if (targetCores !== null) break;
                }
            }

            // If still no option is big enough, pick max cores and max sockets
            if (targetCores === null) {
                targetCores = maxCoresForGen;
                if (sockets < 4) {
                    sockets = 4;
                    socketsSelect.value = 4;
                    changed = true;
                }
            }

            if (targetCores > currentCores) {
                coresSelect.value = targetCores;
                changed = true;
            }
        }
    }

    // --- Auto-scale memory ---
    const requiredMemPerNode = Math.ceil(totalMemoryGB / effectiveNodes) + hostOverheadMemoryGB;
    const memSelect = document.getElementById('node-memory');
    const currentMem = parseInt(memSelect.value) || 512;

    let targetMem = null;
    for (const m of MEMORY_OPTIONS_GB) {
        if (m >= requiredMemPerNode) {
            targetMem = m;
            break;
        }
    }
    if (targetMem === null) {
        targetMem = MEMORY_OPTIONS_GB[MEMORY_OPTIONS_GB.length - 1];
    }
    if (targetMem > currentMem) {
        memSelect.value = targetMem;
        changed = true;
    }

    // --- Auto-scale disk count (capacity disks) ---
    // Total raw storage needed across all nodes = usable * resiliency multiplier
    const totalRawNeededGB = totalStorageGB * resiliencyMultiplier;
    // Raw storage each node must provide
    const rawPerNodeNeededGB = totalRawNeededGB / nodeCount;

    // Determine which disk count / size controls to use
    const isTiered = hwConfig.diskConfig && hwConfig.diskConfig.isTiered;
    const diskCountId = isTiered ? 'tiered-capacity-disk-count' : 'capacity-disk-count';
    const diskSizeId = isTiered ? 'tiered-capacity-disk-size' : 'capacity-disk-size';
    const diskUnitId = isTiered ? 'tiered-capacity-disk-unit' : 'capacity-disk-unit';

    const diskSizeRaw = parseFloat(document.getElementById(diskSizeId).value) || 3.5;
    const diskUnit = document.getElementById(diskUnitId).value;
    const diskSizeGB = diskUnit === 'TB' ? diskSizeRaw * 1024 : diskSizeRaw;

    if (diskSizeGB > 0) {
        const disksNeeded = Math.ceil(rawPerNodeNeededGB / diskSizeGB);
        const diskCountSelect = document.getElementById(diskCountId);
        const currentDiskCount = parseInt(diskCountSelect.value) || 4;

        // Find smallest available option >= disksNeeded
        let targetDisks = null;
        for (const d of DISK_COUNT_OPTIONS) {
            if (d >= disksNeeded) {
                targetDisks = d;
                break;
            }
        }
        if (targetDisks === null) {
            targetDisks = DISK_COUNT_OPTIONS[DISK_COUNT_OPTIONS.length - 1]; // cap at 24
        }
        if (targetDisks > currentDiskCount) {
            diskCountSelect.value = targetDisks;
            changed = true;
        }
    }

    // --- Enforce 1:2 cache-to-capacity ratio for hybrid storage ---
    if (isTiered && hwConfig.storageConfig === 'hybrid') {
        const finalCapacityCount = parseInt(document.getElementById(diskCountId).value) || 4;
        const targetCacheCount = Math.ceil(finalCapacityCount / 2);
        const cacheDiskSelect = document.getElementById('cache-disk-count');
        const currentCacheCount = parseInt(cacheDiskSelect.value) || 2;

        // Find the smallest available cache option >= target
        const cacheOptions = Array.from(cacheDiskSelect.options).map(o => parseInt(o.value));
        let bestCache = cacheOptions[cacheOptions.length - 1];
        for (const c of cacheOptions) {
            if (c >= targetCacheCount) {
                bestCache = c;
                break;
            }
        }

        if (bestCache !== currentCacheCount) {
            cacheDiskSelect.value = bestCache;
            changed = true;
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
        futureGrowth: document.getElementById('future-growth').value,
        resiliency: document.getElementById('resiliency').value,
        cpuManufacturer: document.getElementById('cpu-manufacturer').value,
        cpuGeneration: document.getElementById('cpu-generation').value,
        cpuCores: document.getElementById('cpu-cores').value,
        cpuSockets: document.getElementById('cpu-sockets').value,
        nodeMemory: document.getElementById('node-memory').value,
        storageConfig: document.getElementById('storage-config').value,
        storageTiering: document.getElementById('storage-tiering').value,
        capacityDiskCount: document.getElementById('capacity-disk-count').value,
        capacityDiskSize: document.getElementById('capacity-disk-size').value,
        capacityDiskUnit: document.getElementById('capacity-disk-unit').value,
        cacheDiskCount: document.getElementById('cache-disk-count').value,
        cacheDiskSize: document.getElementById('cache-disk-size').value,
        cacheDiskUnit: document.getElementById('cache-disk-unit').value,
        tieredCapacityDiskCount: document.getElementById('tiered-capacity-disk-count').value,
        tieredCapacityDiskSize: document.getElementById('tiered-capacity-disk-size').value,
        tieredCapacityDiskUnit: document.getElementById('tiered-capacity-disk-unit').value,
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

// Check for saved state and show resume banner
function checkForSavedSizerState() {
    const saved = loadSizerState();
    if (!saved || !saved.data) return;

    // Only show if there are workloads or non-default settings
    const d = saved.data;
    const hasWorkloads = d.workloads && d.workloads.length > 0;
    const hasNonDefaults = d.clusterType !== 'standard' || d.nodeCount !== '3' ||
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

    // Restore storage config (must trigger change to populate tiering options)
    document.getElementById('storage-config').value = d.storageConfig || 'all-flash';
    onStorageConfigChange();
    if (d.storageTiering) {
        document.getElementById('storage-tiering').value = d.storageTiering;
        onStorageTieringChange();
    }

    // Restore disk configs
    document.getElementById('capacity-disk-count').value = d.capacityDiskCount || '4';
    document.getElementById('capacity-disk-size').value = d.capacityDiskSize || '3.5';
    document.getElementById('capacity-disk-unit').value = d.capacityDiskUnit || 'TB';
    document.getElementById('cache-disk-count').value = d.cacheDiskCount || '2';
    document.getElementById('cache-disk-size').value = d.cacheDiskSize || '1.6';
    document.getElementById('cache-disk-unit').value = d.cacheDiskUnit || 'TB';
    document.getElementById('tiered-capacity-disk-count').value = d.tieredCapacityDiskCount || '4';
    document.getElementById('tiered-capacity-disk-size').value = d.tieredCapacityDiskSize || '3.5';
    document.getElementById('tiered-capacity-disk-unit').value = d.tieredCapacityDiskUnit || 'TB';

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

    // Update UI
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
    },
    custom: {
        name: 'Custom',
        description: 'Custom per-user resource specification',
        vcpusPerUser: 2,
        memoryPerUser: 8,
        storagePerUser: 50
    }
};

// Storage resiliency multipliers and minimum nodes
const RESILIENCY_CONFIG = {
    'simple': { multiplier: 1, minNodes: 1, name: 'Simple (No Fault Tolerance)', singleNodeOnly: true },
    '2way': { multiplier: 2, minNodes: 1, name: 'Two-way Mirror' },
    '3way': { multiplier: 3, minNodes: 3, name: 'Three-way Mirror' },
    '4way': { multiplier: 4, minNodes: 4, name: 'Four-way Mirror' },
    'parity': { multiplier: 1.5, minNodes: 4, name: 'Dual Parity' }
};

// Storage resiliency multipliers (for backward compatibility)
const RESILIENCY_MULTIPLIERS = {
    'simple': 1,    // Simple = no redundancy (1x raw storage)
    '2way': 2,      // Two-way mirror = 2x raw storage
    '3way': 3,      // Three-way mirror = 3x raw storage
    '4way': 4,      // Four-way mirror = 4x raw storage (rack-aware 4+ nodes)
    'parity': 1.5   // Dual parity ≈ 1.5x raw storage
};

// Current modal state
let currentModalType = null;

// Handle node count change
function onNodeCountChange() {
    updateResiliencyOptions();
    updateClusterInfo();
    calculateRequirements();
}

// Handle cluster type change (single / standard / rack-aware)
function onClusterTypeChange() {
    updateNodeOptionsForClusterType();
    updateStorageForClusterType();
    updateResiliencyOptions();
    updateClusterInfo();
    calculateRequirements();
}

// Enforce storage constraints for rack-aware clusters (All-Flash only)
function updateStorageForClusterType() {
    const clusterType = document.getElementById('cluster-type').value;
    const storageSelect = document.getElementById('storage-config');
    if (!storageSelect) return; // Guard for test harness
    if (clusterType === 'rack-aware') {
        storageSelect.value = 'all-flash';
        storageSelect.disabled = true;
        onStorageConfigChange();
    } else {
        storageSelect.disabled = false;
    }
}

// Handle resiliency change
function onResiliencyChange() {
    updateClusterInfo();
    calculateRequirements();
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
            nodeSelect.value = 3;
        }
    }
}

// Update node count dropdown based on resiliency requirements (legacy - kept for compatibility)
function updateNodeOptions() {
    const resiliency = document.getElementById('resiliency').value;
    const clusterType = document.getElementById('cluster-type').value;
    const nodeSelect = document.getElementById('node-count');
    const config = RESILIENCY_CONFIG[resiliency];
    
    // Minimum nodes based on resiliency (fault domains)
    const minNodes = config.minNodes;
    
    // Get current selection
    const currentValue = parseInt(nodeSelect.value) || minNodes;
    
    // Rebuild options starting from minimum
    const nodeOptions = [];
    for (let i = minNodes; i <= 16; i++) {
        nodeOptions.push(i);
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
    
    // Default to best option: rack-aware auto-selects, standard defaults to 3-way when available
    const validOptions = Array.from(resiliencySelect.options).map(o => o.value);
    if (clusterType === 'rack-aware') {
        // Rack-aware has only one option per node count — already selected
    } else if (validOptions.includes('3way') && clusterType !== 'single') {
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
    
    // Only show warning when resiliency requirements aren't met, or info for rack-aware
    let showWarning = false;
    let message = '';
    
    if (clusterType === 'rack-aware') {
        showWarning = true;
        if (nodeCount <= 2) {
            message = 'Rack-aware cluster: Two-way Mirror with 50% storage efficiency. Only All-Flash storage is supported.';
        } else {
            message = 'Rack-aware cluster: Four-way Mirror with 25% storage efficiency. Only All-Flash storage is supported.';
        }
    } else if (clusterType !== 'single' && resiliency === '3way' && nodeCount < config.minNodes) {
        showWarning = true;
        if (clusterType === 'rack-aware') {
            message = `Warning: Three-way Mirror requires minimum ${config.minNodes} fault domains (racks). Current configuration has only ${nodeCount} nodes.`;
        } else {
            message = `Warning: Three-way Mirror requires minimum ${config.minNodes} fault domains (nodes). Current configuration has only ${nodeCount} nodes.`;
        }
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
    } else {
        tipText.textContent = 'Tip: Minimum N+1 capacity must be reserved for Compute and Memory when applying updates (ability to drain a node). Storage remains accessible across all nodes during maintenance. Single Node clusters will always incur workload downtime during updates.';
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
            <label>User Profile</label>
            <select id="avd-profile" onchange="updateAVDDescription()">
                <option value="light">Light - Task Workers</option>
                <option value="medium" selected>Medium - Knowledge Workers</option>
                <option value="power">Power - Power Users</option>
                <option value="custom">Custom</option>
            </select>
            <span class="hint" id="avd-profile-desc">${AVD_PROFILES.medium.description}</span>
        </div>
        <div id="avd-custom-fields" style="display: none; margin-top: 12px;">
            <div class="form-group">
                <label>vCPUs per User</label>
                <input type="number" id="avd-custom-vcpus" value="${AVD_PROFILES.custom.vcpusPerUser}" min="0.25" max="16" step="0.25">
            </div>
            <div class="form-group">
                <label>Memory per User (GB)</label>
                <input type="number" id="avd-custom-memory" value="${AVD_PROFILES.custom.memoryPerUser}" min="1" max="64" step="1">
            </div>
            <div class="form-group">
                <label>Storage per User (GB)</label>
                <input type="number" id="avd-custom-storage" value="${AVD_PROFILES.custom.storagePerUser}" min="5" max="500" step="5">
            </div>
        </div>
        <div id="avd-specs-panel" style="margin-top: 16px; padding: 16px; background: var(--subtle-bg); border-radius: 8px;">
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
    const customFields = document.getElementById('avd-custom-fields');
    const specsPanel = document.getElementById('avd-specs-panel');

    document.getElementById('avd-profile-desc').textContent = profileData.description;

    if (profile === 'custom') {
        // Show editable custom fields, hide read-only specs panel
        customFields.style.display = 'block';
        specsPanel.style.display = 'none';
    } else {
        // Hide custom fields, show read-only specs panel
        customFields.style.display = 'none';
        specsPanel.style.display = 'block';
        document.getElementById('avd-spec-vcpus').textContent = profileData.vcpusPerUser;
        document.getElementById('avd-spec-memory').textContent = profileData.memoryPerUser + ' GB';
        document.getElementById('avd-spec-storage').textContent = profileData.storagePerUser + ' GB';
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
            if (workload.profile === 'custom') {
                workload.customVcpus = parseFloat(document.getElementById('avd-custom-vcpus').value) || 2;
                workload.customMemory = parseFloat(document.getElementById('avd-custom-memory').value) || 8;
                workload.customStorage = parseFloat(document.getElementById('avd-custom-storage').value) || 50;
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
    }
    closeModal();
    renderWorkloads();
    calculateRequirements();
}

// Edit workload - open modal pre-populated with existing values
function editWorkload(id) {
    const w = workloads.find(wl => wl.id === id);
    if (!w) return;

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
            document.getElementById('avd-profile').value = w.profile;
            document.getElementById('avd-users').value = w.userCount;
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
                    <button class="edit" onclick="editWorkload(${w.id})" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
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
            if (w.profile === 'custom') {
                return `${w.userCount} Custom users (${w.customVcpus} vCPUs, ${w.customMemory} GB RAM, ${w.customStorage} GB storage each)`;
            }
            const avdProfile = AVD_PROFILES[w.profile];
            return `${w.userCount} ${avdProfile.name} users`;
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
            if (w.profile === 'custom') {
                vcpus = Math.ceil((w.customVcpus || 2) * w.userCount);
                memory = (w.customMemory || 8) * w.userCount;
                storage = (w.customStorage || 50) * w.userCount;
            } else {
                const profile = AVD_PROFILES[w.profile];
                vcpus = Math.ceil(profile.vcpusPerUser * w.userCount);
                memory = profile.memoryPerUser * w.userCount;
                storage = profile.storagePerUser * w.userCount;
            }
            break;
    }
    
    return { vcpus, memory, storage };
}

// Calculate all requirements
function calculateRequirements() {
    if (isCalculating) return;
    isCalculating = true;

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
        const resiliency = document.getElementById('resiliency').value;
        const resiliencyMultiplier = RESILIENCY_MULTIPLIERS[resiliency];

        // Get hardware configuration (per-node specs)
        let hwConfig = getHardwareConfig();

        // Build "max possible" config to favour scaling up before adding nodes
        const maxHwConfig = buildMaxHardwareConfig(hwConfig);

        // --- Auto-recommend node count based on max hardware potential ---
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

        // Read (possibly updated) node count
        let nodeCount = parseInt(document.getElementById('node-count').value) || 3;

        // --- Auto-scale CPU cores, memory & disk count to avoid >100% capacity ---
        if (workloads.length > 0) {
            const hwChanged = autoScaleHardware(totalVcpus, totalMemory, totalStorage, nodeCount, resiliencyMultiplier, hwConfig);
            if (hwChanged) {
                // Re-read hardware config with the updated dropdown values
                hwConfig = getHardwareConfig();

                // Re-run node recommendation with maxHwConfig so the message stays consistent
                const updatedRec = getRecommendedNodeCount(
                    totalVcpus, totalMemory, totalStorage,
                    maxHwConfig, resiliencyMultiplier, resiliency
                );
                if (updatedRec) {
                    updateNodeRecommendation(updatedRec);
                }
            }

            // --- Auto-increment node count if any resource is still >= 90% after hw scale-up ---
            const clusterType = document.getElementById('cluster-type').value;
            if (clusterType !== 'single') {
                const nodeOptions = clusterType === 'rack-aware' ? [2, 4, 6, 8] : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
                const maxNodeOption = nodeOptions[nodeOptions.length - 1];
                const UTIL_THRESHOLD = 90;
                let attempts = 0;

                while (nodeCount < maxNodeOption && attempts < 16) {
                    attempts++;
                    const effNodes = nodeCount > 1 ? nodeCount - 1 : 1;
                    const vcpuToCore = 4;
                    const physCores = hwConfig.totalPhysicalCores || 64;
                    const memPerNode = hwConfig.memoryGB || 512;
                    let rawGBPerNode = 0;
                    if (hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
                        rawGBPerNode = hwConfig.diskConfig.capacity.count * hwConfig.diskConfig.capacity.sizeGB;
                    }
                    const rawTBPerNode = rawGBPerNode / 1024 || 10;

                    const availVcpus = physCores * effNodes * vcpuToCore;
                    const availMem = memPerNode * effNodes;
                    const availStorage = (rawTBPerNode * nodeCount) / resiliencyMultiplier;

                    const cpuPct = availVcpus > 0 ? Math.round((totalVcpus / availVcpus) * 100) : 0;
                    const memPct = availMem > 0 ? Math.round((totalMemory / availMem) * 100) : 0;
                    const stoPct = availStorage > 0 ? Math.round(((totalStorage / 1000) / availStorage) * 100) : 0;

                    if (cpuPct < UTIL_THRESHOLD && memPct < UTIL_THRESHOLD && stoPct < UTIL_THRESHOLD) break;

                    // Bump to next available node option
                    let nextNode = null;
                    for (const opt of nodeOptions) {
                        if (opt > nodeCount) { nextNode = opt; break; }
                    }
                    if (!nextNode) break;

                    nodeCount = nextNode;
                    const nodeSelect = document.getElementById('node-count');
                    nodeSelect.value = nodeCount;
                    updateResiliencyOptions();
                    updateClusterInfo();

                    // Re-run autoScale with the new node count
                    autoScaleHardware(totalVcpus, totalMemory, totalStorage, nodeCount, resiliencyMultiplier, hwConfig);
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
            }
        }

        // N+1: effective nodes for capacity sizing (drain one node during updates)
        const effectiveNodes = nodeCount > 1 ? nodeCount - 1 : 1;

        // vCPU to physical core overcommit ratio
        const vcpuToCore = 4;

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
        const physicalCoresPerNode = hwConfig.totalPhysicalCores || 64;
        const memoryPerNode = hwConfig.memoryGB || 512;

        let rawStoragePerNodeGB = 0;
        if (hwConfig.diskConfig.capacity) {
            rawStoragePerNodeGB = hwConfig.diskConfig.capacity.count * hwConfig.diskConfig.capacity.sizeGB;
        }
        const rawStoragePerNodeTB = rawStoragePerNodeGB / 1024 || 10;

        const totalAvailableVcpus = physicalCoresPerNode * effectiveNodes * vcpuToCore;
        const totalAvailableMemory = memoryPerNode * effectiveNodes;
        const totalAvailableStorage = (rawStoragePerNodeTB * nodeCount) / resiliencyMultiplier;

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

// Update sizing notes
function updateSizingNotes(nodeCount, totalVcpus, totalMemory, totalStorage, resiliency, hwConfig) {
    const notes = [];
    const clusterType = document.getElementById('cluster-type').value;
    const config = RESILIENCY_CONFIG[resiliency];
    
    if (workloads.length === 0) {
        notes.push('Add workloads to see sizing recommendations');
    } else {
        // Growth buffer note
        const growthFactor = getGrowthFactor();
        if (growthFactor > 1) {
            notes.push(`Growth buffer: ${Math.round((growthFactor - 1) * 100)}% — all requirements include future growth headroom`);
        }

        // Hardware config note
        if (hwConfig && hwConfig.generation) {
            notes.push(`Hardware: ${hwConfig.generation.name} — ${hwConfig.coresPerSocket} cores × ${hwConfig.sockets} socket(s) = ${hwConfig.totalPhysicalCores} physical cores, ${hwConfig.memoryGB} GB RAM per node`);
        }
        
        // Single node specific notes
        if (clusterType === 'single') {
            notes.push('⚠️ Single node deployment: No node fault tolerance or maintenance capacity');
            if (resiliency === 'simple') {
                notes.push('Simple resiliency: No drive fault tolerance. Single drive failure causes data loss.');
            } else {
                notes.push('Two-way mirror: Provides drive fault tolerance. Requires minimum 2 capacity drives.');
            }
            notes.push('Single node requires minimum 2 capacity drives (NVMe or SSD) of the same type');
        } else {
            // Rack-aware note
            if (clusterType === 'rack-aware') {
                notes.push(`Rack-aware cluster: Each rack acts as a fault domain. Minimum ${config.minNodes} racks required.`);
            }
            
            // N+1 note
            notes.push(`N+1 capacity: Requirements calculated assuming ${nodeCount - 1} nodes available during maintenance`);
        }
        
        // Resiliency note
        const resiliencyNames = {
            'simple': 'Simple (no redundancy, 1x raw storage)',
            '2way': 'Two-way mirror (2x raw storage, 50% efficiency)',
            '3way': 'Three-way mirror (3x raw storage)',
            '4way': 'Four-way mirror (4x raw storage, 25% efficiency)',
            'parity': 'Dual parity (~1.5x raw storage)'
        };
        notes.push(`Storage resiliency: ${resiliencyNames[resiliency]}`);
        
        // Storage config note
        if (hwConfig && hwConfig.diskConfig) {
            const dc = hwConfig.diskConfig;
            if (dc.isTiered) {
                notes.push(`Storage layout: ${dc.cache.count}× ${dc.cache.type} cache + ${dc.capacity.count}× ${dc.capacity.type} capacity disks per node`);
            } else {
                notes.push(`Storage layout: ${dc.capacity.count}× ${dc.capacity.type} capacity disks per node (${(dc.capacity.sizeGB / 1024).toFixed(1)} TB each)`);
            }
        }
        
        // Memory recommendation
        if (totalMemory > 0) {
            const memPerNode = Math.ceil(totalMemory / (nodeCount > 1 ? nodeCount - 1 : 1));
            if (hwConfig && memPerNode > hwConfig.memoryGB) {
                notes.push(`⚠️ Workload memory (${memPerNode} GB/node) exceeds configured node memory (${hwConfig.memoryGB} GB). Consider increasing memory or adding nodes.`);
            }
            if (memPerNode > 768) {
                notes.push('⚠️ High memory per node: Consider larger servers (>768 GB requires 400GB+ OS drive)');
            }
        }
        
        // Compute check
        if (hwConfig && hwConfig.totalPhysicalCores > 0 && totalVcpus > 0) {
            const vcpuToCore = 4;
            const effectiveNodes = nodeCount > 1 ? nodeCount - 1 : 1;
            const requiredCoresPerNode = Math.ceil(totalVcpus / effectiveNodes / vcpuToCore);
            if (requiredCoresPerNode > hwConfig.totalPhysicalCores) {
                notes.push(`⚠️ Required cores per node (${requiredCoresPerNode}) exceed configured physical cores (${hwConfig.totalPhysicalCores}). Consider more cores or additional nodes.`);
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
        
        // vCPU to core ratio
        notes.push('vCPU calculations assume 4:1 overcommit ratio');
        
        // Minimum requirements
        notes.push('Minimum per node: 32 GB RAM, 4 cores (Azure Local requirements)');
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
    // Both 'single' and 'standard' map to 'medium' (Hyperconverged)
    return 'medium';
}

// Transfer sizer configuration to the Designer via localStorage
// ============================================
// Export Functions
// ============================================

function exportSizerWord() {
    var hwConfig = getHardwareConfig();
    var clusterType = document.getElementById('cluster-type').value;
    var nodeCount = document.getElementById('node-count').value;
    var resiliency = document.getElementById('resiliency').value;
    var futureGrowth = document.getElementById('future-growth').value;
    var resConfig = RESILIENCY_CONFIG[resiliency] || {};

    var clusterLabels = { 'single': 'Single Node', 'standard': 'Standard Cluster', 'rack-aware': 'Rack Aware Cluster' };
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
    html += '<tr><td>Cluster Type</td><td>' + (clusterLabels[clusterType] || clusterType) + '</td></tr>';
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
    html += '<tr><td>Memory</td><td>' + hwConfig.memoryGB + ' GB</td></tr>';
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
    html += '<h3>Per-Node Requirements (with N+1)</h3>';
    html += '<table class="kv-table"><tbody>';
    html += '<tr><td>Physical Cores</td><td>' + perNodeCores + '</td></tr>';
    html += '<tr><td>Memory</td><td>' + perNodeMemory + '</td></tr>';
    html += '<tr><td>Raw Storage</td><td>' + perNodeStorage + '</td></tr>';
    html += '<tr><td>Usable Storage</td><td>' + perNodeUsable + '</td></tr>';
    html += '</tbody></table>';

    // Capacity Utilization
    html += '<h3>Capacity Utilization</h3>';
    html += '<table><thead><tr><th>Resource</th><th>Utilization</th></tr></thead><tbody>';
    html += '<tr><td>Compute (vCPUs)</td><td>' + computePercent + '</td></tr>';
    html += '<tr><td>Memory</td><td>' + memoryPercent + '</td></tr>';
    html += '<tr><td>Storage</td><td>' + storagePercent + '</td></tr>';
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
        html += '<h2>Sizing Notes</h2>';
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
    const clusterType = document.getElementById('cluster-type').value;
    const nodeCount = document.getElementById('node-count').value;
    const resiliency = document.getElementById('resiliency').value;
    const hwConfig = getHardwareConfig();

    // Build the sizer-to-designer payload
    const sizerPayload = {
        source: 'sizer',
        timestamp: new Date().toISOString(),
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
        }
    };

    // Store in localStorage for the Designer to pick up
    try {
        localStorage.setItem('odinSizerToDesigner', JSON.stringify(sizerPayload));
    } catch (e) {
        console.warn('Failed to store sizer payload:', e);
    }

    // Navigate to Designer
    window.location.href = '../?from=sizer';
}

// Reset scenario
function resetScenario() {
    clearSizerState();
    workloads = [];
    workloadIdCounter = 0;
    
    // Reset hardware config
    document.getElementById('cpu-manufacturer').value = 'intel';
    initHardwareDefaults();
    document.getElementById('cpu-sockets').value = '2';
    document.getElementById('node-memory').value = '512';
    document.getElementById('storage-config').value = 'all-flash';
    document.getElementById('future-growth').value = '0';
    onStorageConfigChange();
    
    // Reset disk config
    document.getElementById('capacity-disk-count').value = '4';
    document.getElementById('capacity-disk-size').value = '3.5';
    document.getElementById('capacity-disk-unit').value = 'TB';
    document.getElementById('cache-disk-count').value = '2';
    document.getElementById('cache-disk-size').value = '1.6';
    document.getElementById('cache-disk-unit').value = 'TB';
    document.getElementById('tiered-capacity-disk-count').value = '4';
    document.getElementById('tiered-capacity-disk-size').value = '3.5';
    document.getElementById('tiered-capacity-disk-unit').value = 'TB';
    
    // Reset cluster config
    document.getElementById('cluster-type').value = 'standard';
    updateNodeOptionsForClusterType();
    updateStorageForClusterType();
    document.getElementById('node-count').value = '3';
    updateResiliencyOptions();
    document.getElementById('resiliency').value = '3way';
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

    // Check for saved session BEFORE initial calc (so it doesn't get overwritten)
    checkForSavedSizerState();

    updateNodeOptionsForClusterType();
    updateStorageForClusterType();
    updateResiliencyOptions();
    updateClusterInfo();
    // Initialize hardware defaults
    initHardwareDefaults();
    // Initialize storage config dropdowns
    onStorageConfigChange();
    calculateRequirements();
    applyTheme(); // Apply saved theme

    // Allow saves from now on
    isInitialLoad = false;
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
