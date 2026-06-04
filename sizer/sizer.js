// ============================================
// ODIN Sizer - JavaScript
// ============================================

// LocalStorage keys for sizer state persistence
const SIZER_STATE_KEY = 'odinSizerState';
const SIZER_TIMESTAMP_KEY = 'odinSizerTimestamp';
// Bumped 1 → 2 in v0.22.62: GitHub Enterprise Local (GHEL) became a
// first-class workload type (tier + HA fields added to the export shape).
const SIZER_VERSION = 2;
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
            name: 'Intel® 4th Gen Xeon® (Sapphire Rapids)',
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
            name: 'Intel® 5th Gen Xeon® (Emerald Rapids)',
            minCores: 8,
            // Catalog v2026-05: top SKUs (e.g. Platinum 8593Q) ship at 128 cores/socket.
            maxCores: 128,
            coreOptions: [8, 10, 12, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 80, 96, 128],
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
            name: 'Intel® 6th Gen Xeon® (Granite Rapids / Sierra Forest)',
            minCores: 8,
            maxCores: 172,
            coreOptions: [8, 12, 16, 24, 32, 36, 48, 64, 72, 80, 86, 96, 128, 144, 172],
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
// Ref: https://learn.microsoft.com/en-us/azure/azure-local/manage/gpu-preparation?view=azloc-2602#supported-gpu-models
// A100 / A40 added in v0.21.11 to reflect OEM SKUs seen in the public Azure Local
// Solutions catalog (https://azurelocalsolutions.azure.microsoft.com). A100 uses
// hardware Multi-Instance GPU (MIG) which tops out at 7 slices/board, so it does
// NOT expose the '1/16' partition Sizer offers for vGPU-software GPUs.
const GPU_MODELS = {
    t4:        { name: 'NVIDIA T4',              vramGB: 16, tdpW: 70,  maxPerNode: 2, supportsAzureLocalVMs: true,  supportsAKS: true,  supportsGpuP: false, validPartitions: [] },
    a2:        { name: 'NVIDIA A2',              vramGB: 16, tdpW: 60,  maxPerNode: 2, supportsAzureLocalVMs: true,  supportsAKS: true,  supportsGpuP: true,  validPartitions: ['1', '1/2', '1/4', '1/8'] },
    a16:       { name: 'NVIDIA A16',             vramGB: 64, tdpW: 250, maxPerNode: 2, supportsAzureLocalVMs: true,  supportsAKS: true,  supportsGpuP: true,  validPartitions: ['1', '1/2', '1/4', '1/8'] },
    a40:       { name: 'NVIDIA A40',             vramGB: 48, tdpW: 300, maxPerNode: 2, supportsAzureLocalVMs: true,  supportsAKS: true,  supportsGpuP: true,  validPartitions: ['1', '1/2', '1/4', '1/8', '1/16'] },
    a100:      { name: 'NVIDIA A100',            vramGB: 80, tdpW: 300, maxPerNode: 2, supportsAzureLocalVMs: true,  supportsAKS: true,  supportsGpuP: true,  validPartitions: ['1', '1/2', '1/4', '1/8'] },
    l4:        { name: 'NVIDIA L4',              vramGB: 24, tdpW: 72,  maxPerNode: 4, supportsAzureLocalVMs: true,  supportsAKS: true,  supportsGpuP: true,  validPartitions: ['1', '1/2', '1/4', '1/8'] },
    l40:       { name: 'NVIDIA L40',             vramGB: 48, tdpW: 300, maxPerNode: 2, supportsAzureLocalVMs: true,  supportsAKS: true,  supportsGpuP: true,  validPartitions: ['1', '1/2', '1/4', '1/8', '1/16'] },
    l40s:      { name: 'NVIDIA L40S',            vramGB: 48, tdpW: 350, maxPerNode: 4, supportsAzureLocalVMs: true,  supportsAKS: true,  supportsGpuP: true,  validPartitions: ['1', '1/2', '1/4', '1/8', '1/16'] },
    rtxpro6000:{ name: 'NVIDIA RTX Pro 6000',    vramGB: 48, tdpW: 600, maxPerNode: 2, supportsAzureLocalVMs: true,  supportsAKS: true,  supportsGpuP: true,  validPartitions: ['1', '1/2', '1/4', '1/8', '1/16'] },
    h100:      { name: 'NVIDIA H100',            vramGB: 80, tdpW: 700, maxPerNode: 2, supportsAzureLocalVMs: true,  supportsAKS: false, supportsGpuP: true,  validPartitions: ['1', '1/2', '1/4', '1/8', '1/16'] }
};

// AKS GPU-enabled VM sizes (DDA only — AKS does not support GPU-P)
// Ref: https://learn.microsoft.com/en-us/azure/aks/hybrid/deploy-gpu-node-pool#supported-gpu-vm-sizes
const AKS_GPU_VM_SIZES = {
    t4: [
        { name: 'Standard_NK6',              gpus: 1, vramGB: 8,  vcpus: 6,  memoryGB: 12  },
        { name: 'Standard_NK12',             gpus: 2, vramGB: 16, vcpus: 12, memoryGB: 24  }
    ],
    a2: [
        { name: 'Standard_NC4_A2',           gpus: 1, vramGB: 16, vcpus: 4,  memoryGB: 8   },
        { name: 'Standard_NC8_A2',           gpus: 1, vramGB: 16, vcpus: 8,  memoryGB: 16  },
        { name: 'Standard_NC16_A2',          gpus: 2, vramGB: 32, vcpus: 16, memoryGB: 64  },
        { name: 'Standard_NC32_A2',          gpus: 2, vramGB: 32, vcpus: 32, memoryGB: 128 }
    ],
    a16: [
        { name: 'Standard_NC4_A16',          gpus: 1, vramGB: 16, vcpus: 4,  memoryGB: 8   },
        { name: 'Standard_NC8_A16',          gpus: 1, vramGB: 16, vcpus: 8,  memoryGB: 16  },
        { name: 'Standard_NC16_A16',         gpus: 2, vramGB: 32, vcpus: 16, memoryGB: 64  },
        { name: 'Standard_NC32_A16',         gpus: 2, vramGB: 32, vcpus: 32, memoryGB: 128 }
    ],
    l4: [
        { name: 'Standard_NC16_L4_1',        gpus: 1, vramGB: 24, vcpus: 16, memoryGB: 64  },
        { name: 'Standard_NC16_L4_2',        gpus: 2, vramGB: 48, vcpus: 16, memoryGB: 64  },
        { name: 'Standard_NC32_L4_1',        gpus: 1, vramGB: 24, vcpus: 32, memoryGB: 128 },
        { name: 'Standard_NC32_L4_2',        gpus: 2, vramGB: 48, vcpus: 32, memoryGB: 128 }
    ],
    l40: [
        { name: 'Standard_NC16_L40_1',       gpus: 1, vramGB: 48, vcpus: 16, memoryGB: 64  },
        { name: 'Standard_NC16_L40_2',       gpus: 2, vramGB: 96, vcpus: 16, memoryGB: 64  },
        { name: 'Standard_NC32_L40_1',       gpus: 1, vramGB: 48, vcpus: 32, memoryGB: 128 },
        { name: 'Standard_NC32_L40_2',       gpus: 2, vramGB: 96, vcpus: 32, memoryGB: 128 }
    ],
    l40s: [
        { name: 'Standard_NC16_L40S_1',      gpus: 1, vramGB: 48, vcpus: 16, memoryGB: 64  },
        { name: 'Standard_NC16_L40S_2',      gpus: 2, vramGB: 96, vcpus: 16, memoryGB: 64  },
        { name: 'Standard_NC32_L40S_1',      gpus: 1, vramGB: 48, vcpus: 32, memoryGB: 128 },
        { name: 'Standard_NC32_L40S_2',      gpus: 2, vramGB: 96, vcpus: 32, memoryGB: 128 }
    ],
    rtxpro6000: [
        { name: 'Standard_NC16_RTX6000Pro_1', gpus: 1, vramGB: 48, vcpus: 16, memoryGB: 64  },
        { name: 'Standard_NC16_RTX6000Pro_2', gpus: 2, vramGB: 96, vcpus: 16, memoryGB: 64  },
        { name: 'Standard_NC32_RTX6000Pro_1', gpus: 1, vramGB: 48, vcpus: 32, memoryGB: 128 },
        { name: 'Standard_NC32_RTX6000Pro_2', gpus: 2, vramGB: 96, vcpus: 32, memoryGB: 128 }
    ]
};

// Workload types that run on AKS Arc node pools. These inherit AKS Arc's
// supported-GPU constraints — they can only attach GPUs that AKS Arc itself
// supports (i.e. GPUs that appear as keys in AKS_GPU_VM_SIZES). Foundry Local,
// Edge RAG and Video Indexer all run on AKS Arc clusters; their DDA GPU model
// list must therefore match AKS Arc, not the full Azure Local VM GPU list.
const AKS_HOSTED_WORKLOAD_TYPES = new Set(['aks', 'foundry', 'edgerag', 'videoindexer']);

function isAksHostedWorkloadType(workloadType) {
    return AKS_HOSTED_WORKLOAD_TYPES.has(workloadType);
}

// Returns the set of GPU keys that AKS Arc supports (i.e. that have at least
// one published AKS GPU VM SKU). Currently: t4, a2, a16, l4, l40, l40s,
// rtxpro6000. NOT included: a40, a100, h100.
function getAksSupportedGpuKeys() {
    return new Set(Object.keys(AKS_GPU_VM_SIZES));
}

// GPU-P partition sizes (fraction of a physical GPU)
// See: https://learn.microsoft.com/en-us/azure/azure-local/manage/gpu-preparation
const GPU_PARTITION_PROFILES = [
    { id: '1',     label: 'Full GPU (1:1)',     fraction: 1 },
    { id: '1/2',   label: 'Half GPU (1:2)',     fraction: 0.5 },
    { id: '1/4',   label: 'Quarter GPU (1:4)',  fraction: 0.25 },
    { id: '1/8',   label: 'Eighth GPU (1:8)',   fraction: 0.125 },
    { id: '1/16',  label: 'Sixteenth GPU (1:16)', fraction: 0.0625 }
];

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

// Dedicated handler for the Future Growth dropdown — any user change (including
// picking "No additional growth") locks the choice as MANUAL so it's clear the
// 10% default was a deliberate override rather than just left as-is.
function onFutureGrowthChange() {
    markManualSet('future-growth');
    onHardwareConfigChange();
}

// Handler for the "Size for 5-year compound growth" No/Yes dropdown inside the
// Capacity Runway section (issue #254). Switching this changes getGrowthFactor()
// from (1+pct/100)^1 to (1+pct/100)^5, so a full recalculation is required to
// re-roll workload totals, recommendation, auto-scale, and capacity bars.
function onSizeFor5YrGrowthChange() {
    onHardwareConfigChange();
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
    updateHwGpuTypeLock();
}

// Lock hardware GPU Type dropdown when any workload has selected a GPU model
function updateHwGpuTypeLock() {
    const gpuTypeEl = document.getElementById('gpu-type');
    const badge = document.getElementById('gpu-type-lock-badge');
    if (!gpuTypeEl) return;
    const lockedType = getLockedGpuType();
    if (lockedType) {
        gpuTypeEl.disabled = true;
        gpuTypeEl.title = 'GPU type is locked by workload configuration — all machines must use the same GPU model (homogeneous). Remove all GPU workloads to change the GPU type.';
        if (badge) badge.style.display = '';
    } else {
        gpuTypeEl.disabled = false;
        gpuTypeEl.title = '';
        if (badge) badge.style.display = 'none';
    }
}

// Handler for GPU count dropdown — enforce maxPerNode for the selected GPU model
function onGpuCountChange() {
    _gpuCountUserSet = true;
    markManualSet('gpu-count');
    updateGpuTypeVisibility();
    enforceGpuMaxPerNode();
    onHardwareConfigChange();
}

// Handler for GPU type dropdown — enforce maxPerNode when GPU model changes
function onGpuTypeChange() {
    enforceGpuMaxPerNode();
    onHardwareConfigChange();
}

// Enforce that GPU count does not exceed the selected model's maxPerNode
function enforceGpuMaxPerNode() {
    const gpuCountEl = document.getElementById('gpu-count');
    const gpuTypeEl = document.getElementById('gpu-type');
    const warningEl = document.getElementById('gpu-max-warning');
    if (!gpuCountEl || !gpuTypeEl) return;
    const gpuCount = parseInt(gpuCountEl.value) || 0;
    if (gpuCount === 0) {
        if (warningEl) warningEl.style.display = 'none';
        return;
    }
    const gpuType = gpuTypeEl.value;
    const model = GPU_MODELS[gpuType];
    const maxPerNode = model ? model.maxPerNode : 2;
    if (gpuCount > maxPerNode) {
        gpuCountEl.value = maxPerNode;
        if (warningEl) warningEl.style.display = '';
    } else {
        if (warningEl) warningEl.style.display = 'none';
    }
}

// Get the locked GPU type from existing workloads (homogeneous requirement).
// Returns the GPU type key if any workload has selected a GPU, or null if none.
function getLockedGpuType() {
    for (const w of workloads) {
        const t = getWorkloadGpuType(w);
        if (t) return t;
        // Edge case: workload has gpuMode != 'none' but no resolvable model
        // (malformed/in-progress workload). Fall back to the hardware-config
        // GPU type so the lock still engages — matches pre-helper behaviour.
        if (w && w.gpuMode && w.gpuMode !== 'none') {
            const hwGpuTypeEl = document.getElementById('gpu-type');
            if (hwGpuTypeEl) return hwGpuTypeEl.value;
        }
    }
    return null;
}

// Pure helper: return the GPU type key implied by a single workload, or null
// if the workload has no GPU configured. Mirrors getLockedGpuType()'s priority
// (gpu-p model → dda model → AKS VM-size lookup) but does NOT fall back to
// the hardware-config GPU type — callers wanting that behaviour should add it
// at the call site. Pure data, no DOM, safe for unit tests.
function getWorkloadGpuType(w) {
    if (!w || typeof w !== 'object') return null;
    if (!w.gpuMode || w.gpuMode === 'none') return null;
    if (w.gpuMode === 'gpu-p' && w.gpuPModel) return w.gpuPModel;
    if (w.gpuMode === 'dda' && w.gpuDdaModel) return w.gpuDdaModel;
    if (w.aksGpuVmSize) {
        for (const [gpuKey, sizes] of Object.entries(AKS_GPU_VM_SIZES)) {
            if (sizes.some(s => s.name === w.aksGpuVmSize)) return gpuKey;
        }
    }
    return null;
}

// Get the vCPU to physical core overcommit ratio from dropdown
function getVcpuRatio() {
    const el = document.getElementById('vcpu-ratio');
    return el ? parseInt(el.value) || 4 : 4;
}

// Debounce the "VM exceeds per-machine capacity" toast. calculateRequirements()
// runs in cascades during Designer import, RVTools import, cluster-type
// changes, etc. — and intermediate passes can see a too-small hardware default
// that auto-scale immediately resolves. Only surface the toast if the
// condition is still true after the cascade settles.
let _vmExceedsToastTimer = null;
function _scheduleVmExceedsToast() {
    if (_vmExceedsToastTimer) clearTimeout(_vmExceedsToastTimer);
    _vmExceedsToastTimer = setTimeout(function() {
        _vmExceedsToastTimer = null;
        if (window._sizerVmExceedsNode) {
            showToast('One or more VMs exceed per-machine capacity — configuration cannot be deployed', 'error');
        }
    }, 300);
}
function _clearVmExceedsToast() {
    if (_vmExceedsToastTimer) {
        clearTimeout(_vmExceedsToastTimer);
        _vmExceedsToastTimer = null;
    }
}

// Get human-readable GPU label from GPU type key
function getGpuLabel(gpuType) {
    const model = GPU_MODELS[gpuType];
    if (model) return `${model.name} (${model.vramGB} GB VRAM, ${model.tdpW}W TDP)`;
    return gpuType || 'Unknown';
}

// Build GPU requirement fields HTML for workload modals
// workloadType: 'vm', 'aks', 'avd', 'foundry', 'edgerag', or 'videoindexer'
function getGpuRequirementFields(workloadType) {
    // GPU-P (partitioning) is unsupported on AKS Arc, and Foundry Local, Edge
    // RAG, and Video Indexer all run on top of AKS Arc, so none of those
    // four offer GPU-P.
    const supportGpuP = workloadType !== 'aks' && workloadType !== 'foundry' && workloadType !== 'edgerag' && workloadType !== 'videoindexer';
    const gpuPOption = supportGpuP
        ? '<option value="gpu-p">GPU-P (GPU Partitioning)</option>'
        : '';
    const gpuPNote = !supportGpuP
        ? (workloadType === 'foundry'
            ? '<span class="hint">Note: Foundry Local runs on AKS Arc, which does not support GPU-P at this time.</span>'
            : workloadType === 'edgerag'
                ? '<span class="hint">Note: Edge RAG runs on AKS Arc, which does not support GPU-P at this time.</span>'
                : workloadType === 'videoindexer'
                    ? '<span class="hint">Note: Video Indexer runs on AKS Arc, which does not support GPU-P at this time.</span>'
                    : '<span class="hint">Note: AKS Arc does not support GPU-P at this time.</span>')
        : '';

    // For AKS, build a GPU VM size selector instead of manual DDA count
    let aksGpuVmSizeField = '';
    if (workloadType === 'aks') {
        aksGpuVmSizeField = `
        <div id="wl-gpu-aks-vm-fields" style="display: none;">
            <div class="form-group">
                <label>GPU VM Size
                    <span class="info-icon" title="AKS GPU-enabled worker nodes must use a supported VM SKU. vCPU and memory per worker node are set by the selected VM size.">ⓘ</span>
                </label>
                <select id="wl-gpu-aks-vm-size" onchange="onAksGpuVmSizeChange()">
                    <option value="" selected>Select a GPU VM size...</option>
                </select>
            </div>
            <div id="wl-gpu-aks-vm-info" class="hint" style="margin-top: 4px;"></div>
        </div>`;
    }

    // Documentation link varies by workload type
    let gpuDocsLink = '';
    if (workloadType === 'aks') {
        gpuDocsLink = '<div style="margin-bottom: 10px; font-size: 11px;"><a href="https://learn.microsoft.com/azure/aks/aksarc/deploy-gpu-node-pool#supported-gpu-models" target="_blank" style="color: var(--link-color);">📖 Supported GPU Information for AKS Arc</a></div>';
    } else if (workloadType === 'foundry') {
        gpuDocsLink = '<div style="margin-bottom: 10px; font-size: 11px;"><a href="https://learn.microsoft.com/azure/aks/aksarc/deploy-gpu-node-pool#supported-gpu-models" target="_blank" style="color: var(--link-color);">📖 Supported GPU Information for AKS Arc (Foundry Local runs on AKS Arc)</a></div>';
    } else if (workloadType === 'edgerag') {
        gpuDocsLink = '<div style="margin-bottom: 10px; font-size: 11px;"><a href="https://learn.microsoft.com/azure/aks/aksarc/deploy-gpu-node-pool#supported-gpu-models" target="_blank" style="color: var(--link-color);">📖 Supported GPU Information for AKS Arc (Edge RAG runs on AKS Arc)</a></div>';
    } else if (workloadType === 'videoindexer') {
        gpuDocsLink = '<div style="margin-bottom: 10px; font-size: 11px;"><a href="https://learn.microsoft.com/azure/aks/aksarc/deploy-gpu-node-pool#supported-gpu-models" target="_blank" style="color: var(--link-color);">📖 Supported GPU Information for AKS Arc (Video Indexer runs on AKS Arc)</a></div>';
    } else if (workloadType === 'vm' || workloadType === 'avd') {
        gpuDocsLink = '<div style="margin-bottom: 10px; font-size: 11px;"><a href="https://learn.microsoft.com/azure/azure-local/manage/gpu-preparation#supported-gpu-models" target="_blank" style="color: var(--link-color);">📖 Supported GPU Information for Azure Local VMs</a></div>';
    }

    // DDA label varies by workload type
    const ddaLabel = workloadType === 'avd' ? 'GPUs per Session Host'
        : workloadType === 'foundry' ? 'GPUs per replica'
            : workloadType === 'edgerag' ? 'GPUs per worker node'
                : workloadType === 'videoindexer' ? 'GPUs per worker node'
                    : 'GPUs per VM';
    const ddaTooltip = workloadType === 'avd'
        ? 'Number of physical GPUs assigned via DDA to each AVD session host.'
        : workloadType === 'foundry'
            ? 'Number of physical GPUs assigned via DDA to each Foundry Local model replica.'
            : workloadType === 'edgerag'
                ? `Number of physical GPUs assigned via DDA to each of the ${EDGERAG_WORKER_NODES} Edge RAG worker nodes (typically 1 per worker = ${EDGERAG_WORKER_NODES} total).`
                : workloadType === 'videoindexer'
                    ? 'Number of physical GPUs assigned via DDA to each Video Indexer worker node. Optional — Video Indexer’s default models are CPU-only; add a GPU only if you bring your own GPU-bound model.'
                    : 'Number of physical GPUs assigned via DDA to each VM.';

    return `
        <h4 style="margin: 20px 0 12px; font-size: 14px; color: var(--text-secondary);">GPU Requirements</h4>
        ${gpuDocsLink}
        <div class="form-group">
            <label>GPU Mode
                <span class="info-icon" title="None: no GPU needed. DDA: dedicates entire physical GPU(s) to a VM. GPU-P: partitions a GPU to share across multiple VMs.">ⓘ</span>
            </label>
            <select id="wl-gpu-mode" onchange="toggleWorkloadGpuFields()">
                <option value="none" selected>None</option>
                <option value="dda">DDA (Discrete Device Assignment)</option>
                ${gpuPOption}
            </select>
            ${gpuPNote}
        </div>
        <div id="wl-gpu-dda-fields" style="display: none;">
            <div class="form-group">
                <label>GPU Model
                    <span class="info-icon" title="Select the GPU model for DDA. This sets the hardware GPU type. All machines must use the same GPU model.">ⓘ</span>
                </label>
                <select id="wl-gpu-dda-model" onchange="onDdaModelChange()">
                </select>
                <div id="wl-gpu-dda-info" class="hint" style="margin-top: 4px;"></div>
            </div>
            <div class="form-group">
                <label id="wl-gpu-dda-label">${ddaLabel}
                    <span class="info-icon" title="${ddaTooltip}">ⓘ</span>
                </label>
                <select id="wl-gpu-dda-count">
                    <option value="1" selected>1</option>
                    <option value="2">2</option>
                </select>
            </div>
        </div>
        ${aksGpuVmSizeField}
        <div id="wl-gpu-p-fields" style="display: none;">
            <div style="margin-bottom: 10px; font-size: 11px;"><a href="https://learn.microsoft.com/azure/azure-local/manage/gpu-manage-via-partitioning" target="_blank" style="color: var(--link-color);">📖 GPU Partitioning (GPU-P) Management Guide</a></div>
            <div class="form-group">
                <label>GPU Model
                    <span class="info-icon" title="Select the GPU model for partitioning. This sets the hardware GPU type and determines available partition sizes.">ⓘ</span>
                </label>
                <select id="wl-gpu-p-model" onchange="onGpuPModelChange()">
                </select>
            </div>
            <div class="form-group">
                <label>GPU Partition Size
                    <span class="info-icon" title="Fraction of a physical GPU allocated to each VM. Smaller partitions allow more VMs to share a single GPU.">ⓘ</span>
                </label>
                <select id="wl-gpu-p-partition">
                </select>
                <div id="wl-gpu-p-vram-info" class="hint" style="margin-top: 4px;"></div>
            </div>
        </div>
    `;
}

// Toggle GPU fields visibility based on selected GPU mode
function toggleWorkloadGpuFields() {
    const mode = document.getElementById('wl-gpu-mode').value;
    const ddaFields = document.getElementById('wl-gpu-dda-fields');
    const gpuPFields = document.getElementById('wl-gpu-p-fields');
    const aksVmFields = document.getElementById('wl-gpu-aks-vm-fields');
    const isAks = !!aksVmFields; // AKS modal has the VM size selector
    // For AKS DDA: hide the manual DDA fields (VM size determines GPU count)
    if (ddaFields) ddaFields.style.display = (mode === 'dda' && !isAks) ? '' : 'none';
    if (gpuPFields) gpuPFields.style.display = mode === 'gpu-p' ? '' : 'none';
    // Populate DDA model and count for non-AKS DDA
    if (mode === 'dda' && !isAks) {
        populateDdaModels();
        populateDdaCountOptions();
    }
    // Populate GPU-P model and partition options
    if (mode === 'gpu-p') {
        populateGpuPModels();
        populateGpuPartitions();
    }
    // For AKS DDA, show the GPU VM size selector and populate it
    if (aksVmFields) {
        aksVmFields.style.display = mode === 'dda' ? '' : 'none';
        if (mode === 'dda') {
            populateAksGpuVmSizes();
        } else {
            // Re-enable worker vCPU/memory fields when GPU mode is not DDA
            const vcpuEl = document.getElementById('aks-worker-vcpus');
            const memEl = document.getElementById('aks-worker-memory');
            if (vcpuEl) vcpuEl.disabled = false;
            if (memEl) memEl.disabled = false;
        }
    }
}

// Populate DDA GPU model dropdown. Filters by workload type:
//   - VM / AVD: any GPU with supportsAzureLocalVMs === true.
//   - Foundry / Edge RAG / Video Indexer: AKS-hosted workloads, so the list
//     is further restricted to GPUs that AKS Arc itself supports (those that
//     have published AKS GPU VM SKUs in AKS_GPU_VM_SIZES). AKS itself doesn't
//     use this dropdown — it has the dedicated `wl-gpu-aks-vm-size` selector.
function populateDdaModels() {
    const modelSelect = document.getElementById('wl-gpu-dda-model');
    if (!modelSelect) return;
    const currentValue = modelSelect.value;
    modelSelect.innerHTML = '';
    const lockedType = getLockedGpuType();
    const hwGpuTypeEl = document.getElementById('gpu-type');
    const hwGpuType = hwGpuTypeEl ? hwGpuTypeEl.value : '';
    const restrictToAks = currentModalType && currentModalType !== 'aks' && isAksHostedWorkloadType(currentModalType);
    const aksSupportedKeys = restrictToAks ? getAksSupportedGpuKeys() : null;
    for (const [key, model] of Object.entries(GPU_MODELS)) {
        if (!model.supportsAzureLocalVMs) continue;
        if (restrictToAks && !aksSupportedKeys.has(key)) continue;
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${model.name} (${model.vramGB} GB, max ${model.maxPerNode}/machine)`;
        modelSelect.appendChild(opt);
    }
    // Show a contextual hint about the AKS Arc restriction (and warn if a
    // workload elsewhere has locked the cluster's GPU to a model that is NOT
    // supported on AKS Arc — the dropdown will then be either empty or filled
    // with options that conflict with the locked GPU, so the user needs to
    // remediate before saving).
    const infoEl = document.getElementById('wl-gpu-dda-info');
    const lockedNotInDropdown = lockedType && !modelSelect.querySelector(`option[value="${lockedType}"]`);
    if (infoEl) {
        if (restrictToAks && lockedNotInDropdown) {
            // Either the dropdown is empty (no options matched) or it has options
            // but none of them match the locked GPU. Either way the user can't
            // pick a GPU without breaking homogeneity, so show the actionable
            // warning instead of the bland "Filtered to..." note.
            const lockedModel = GPU_MODELS[lockedType];
            const lockedName = escapeHtmlSizer(lockedModel ? lockedModel.name : lockedType);
            infoEl.innerHTML =
                '<span style="color: var(--warning);"><strong>⚠ ' + lockedName +
                ' is not supported on AKS Arc.</strong> Another workload selected ' + lockedName +
                ', and ' + workloadTypeDisplayName(currentModalType) + ' runs on AKS Arc — which currently only supports ' +
                'T4, A2, A16, L4, L40, L40S, and RTX Pro 6000. ' +
                'Either change that workload\'s GPU model to an AKS-supported one, or set this workload\'s GPU Mode to None.</span>';
        } else if (restrictToAks) {
            infoEl.innerHTML =
                '<em>Filtered to GPUs supported by AKS Arc — ' + workloadTypeDisplayName(currentModalType) +
                ' runs on AKS Arc node pools.</em>';
        } else if (lockedNotInDropdown) {
            // Non-AKS-hosted modal but the locked GPU still isn't in the dropdown
            // (e.g. the workload's locked GPU has supportsAzureLocalVMs=false).
            // Defensive — shouldn't happen with current data but covers the case.
            const lockedModel = GPU_MODELS[lockedType];
            const lockedName = escapeHtmlSizer(lockedModel ? lockedModel.name : lockedType);
            infoEl.innerHTML =
                '<span style="color: var(--warning);"><strong>⚠ GPU model conflict.</strong> Another workload selected ' + lockedName +
                ', which is not available for this workload type. Remove or change that workload first.</span>';
        } else {
            infoEl.textContent = '';
        }
    }
    // If locked, force to that type and disable
    if (lockedType && modelSelect.querySelector(`option[value="${lockedType}"]`)) {
        modelSelect.value = lockedType;
        modelSelect.disabled = true;
        modelSelect.title = 'GPU model is locked \u2014 all machines must use the same GPU model (homogeneous configuration).';
    } else if (lockedType) {
        // Locked GPU is NOT in the (possibly AKS-filtered) dropdown — e.g. another
        // workload locked the cluster to H100 but this is an AKS-hosted modal that
        // filters to AKS-supported GPUs only. Disable the dropdown and clear any
        // stale selection so the user cannot save a heterogeneous-GPU config.
        // validateWorkloadBeforeSave() also backstops this via the cross-workload
        // homogeneous-GPU rule.
        modelSelect.value = '';
        modelSelect.disabled = true;
        modelSelect.title = 'GPU model is locked by another workload to a GPU that is not supported by AKS Arc \u2014 remove that workload (or change its GPU) before adding this one.';
    } else {
        modelSelect.disabled = false;
        modelSelect.title = '';
        if (currentValue && modelSelect.querySelector(`option[value="${currentValue}"]`)) {
            modelSelect.value = currentValue;
        } else if (hwGpuType && modelSelect.querySelector(`option[value="${hwGpuType}"]`)) {
            modelSelect.value = hwGpuType;
        }
    }
}

// Human-readable name for a workload type (used in warning text).
function workloadTypeDisplayName(t) {
    switch (t) {
        case 'aks': return 'AKS Arc';
        case 'foundry': return 'Foundry Local';
        case 'edgerag': return 'Edge RAG';
        case 'videoindexer': return 'Video Indexer';
        case 'vm': return 'VM';
        case 'avd': return 'AVD';
        case 'ghel': return 'GitHub Enterprise Local';
        default: return t || 'this workload';
    }
}

// Populate DDA GPU count dropdown based on selected model's maxPerNode
function populateDdaCountOptions() {
    const countSelect = document.getElementById('wl-gpu-dda-count');
    const modelSelect = document.getElementById('wl-gpu-dda-model');
    if (!countSelect) return;
    const gpuType = modelSelect ? modelSelect.value : 'a2';
    const gpuModel = GPU_MODELS[gpuType];
    const maxPerNode = gpuModel ? gpuModel.maxPerNode : 2;
    const currentValue = parseInt(countSelect.value) || 1;
    countSelect.innerHTML = '';
    for (let i = 1; i <= maxPerNode; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        countSelect.appendChild(opt);
    }
    // Restore previous selection if still valid
    countSelect.value = currentValue <= maxPerNode ? currentValue : 1;
}

// Handle DDA model selection \u2014 update hardware GPU type and count options
function onDdaModelChange() {
    const modelSelect = document.getElementById('wl-gpu-dda-model');
    if (!modelSelect) return;
    const selectedGpuType = modelSelect.value;
    // Auto-set hardware GPU type to match
    const hwGpuTypeEl = document.getElementById('gpu-type');
    if (hwGpuTypeEl && hwGpuTypeEl.value !== selectedGpuType) {
        hwGpuTypeEl.value = selectedGpuType;
    }
    // Auto-enable GPU in hardware config if not already set
    const hwGpuCountEl = document.getElementById('gpu-count');
    if (hwGpuCountEl && parseInt(hwGpuCountEl.value) === 0) {
        hwGpuCountEl.value = '1';
        updateGpuTypeVisibility();
    }
    enforceGpuMaxPerNode();
    populateDdaCountOptions();
}

// Populate GPU-P model dropdown with models that support GPU-P
function populateGpuPModels() {
    const modelSelect = document.getElementById('wl-gpu-p-model');
    if (!modelSelect) return;
    const currentValue = modelSelect.value;
    modelSelect.innerHTML = '';
    // Check if GPU type is locked by an existing workload
    const lockedType = getLockedGpuType();
    const hwGpuTypeEl = document.getElementById('gpu-type');
    const hwGpuType = hwGpuTypeEl ? hwGpuTypeEl.value : '';
    for (const [key, model] of Object.entries(GPU_MODELS)) {
        if (!model.supportsGpuP || !model.validPartitions || model.validPartitions.length === 0) continue;
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${model.name} (${model.vramGB} GB VRAM)`;
        modelSelect.appendChild(opt);
    }
    // If locked, force to that type and disable
    if (lockedType && modelSelect.querySelector(`option[value="${lockedType}"]`)) {
        modelSelect.value = lockedType;
        modelSelect.disabled = true;
        modelSelect.title = 'GPU model is locked — all machines must use the same GPU model (homogeneous configuration). Change the GPU type in Hardware Configuration or remove existing GPU workloads first.';
    } else {
        modelSelect.disabled = false;
        modelSelect.title = '';
        // Pre-select the hardware GPU type if it supports GPU-P
        if (currentValue && modelSelect.querySelector(`option[value="${currentValue}"]`)) {
            modelSelect.value = currentValue;
        } else if (hwGpuType && modelSelect.querySelector(`option[value="${hwGpuType}"]`)) {
            modelSelect.value = hwGpuType;
        }
    }
}

// Handle GPU-P model selection — update partitions and hardware GPU type
function onGpuPModelChange() {
    const modelSelect = document.getElementById('wl-gpu-p-model');
    if (!modelSelect) return;
    const selectedGpuType = modelSelect.value;
    // Auto-set hardware GPU type to match
    const hwGpuTypeEl = document.getElementById('gpu-type');
    if (hwGpuTypeEl && hwGpuTypeEl.value !== selectedGpuType) {
        hwGpuTypeEl.value = selectedGpuType;
    }
    // Auto-enable GPU in hardware config if not already set
    const hwGpuCountEl = document.getElementById('gpu-count');
    if (hwGpuCountEl && parseInt(hwGpuCountEl.value) === 0) {
        hwGpuCountEl.value = '1';
        updateGpuTypeVisibility();
    }
    enforceGpuMaxPerNode();
    populateGpuPartitions();
}

function populateGpuPartitions() {
    const partSelect = document.getElementById('wl-gpu-p-partition');
    if (!partSelect) return;
    // Read from GPU-P model dropdown if present, otherwise fall back to hardware GPU type
    const gpuPModelEl = document.getElementById('wl-gpu-p-model');
    const gpuTypeEl = document.getElementById('gpu-type');
    const gpuType = (gpuPModelEl && gpuPModelEl.value) ? gpuPModelEl.value : (gpuTypeEl ? gpuTypeEl.value : 'a2');
    const gpuModel = GPU_MODELS[gpuType];
    const validIds = gpuModel && gpuModel.validPartitions ? gpuModel.validPartitions : ['1', '1/2', '1/4', '1/8'];
    const vramGB = gpuModel ? gpuModel.vramGB : 16;
    const currentValue = partSelect.value;
    partSelect.innerHTML = '';
    validIds.forEach(id => {
        const profile = GPU_PARTITION_PROFILES.find(p => p.id === id);
        if (!profile) return;
        const vramPerPartition = Math.round(vramGB * profile.fraction * 10) / 10;
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${profile.label} — ${vramPerPartition} GB VRAM per VM`;
        partSelect.appendChild(opt);
    });
    // Restore previous selection if still valid
    if (validIds.includes(currentValue)) {
        partSelect.value = currentValue;
    }
    // Update info text
    const infoEl = document.getElementById('wl-gpu-p-vram-info');
    if (infoEl) {
        infoEl.textContent = `${gpuModel ? gpuModel.name : 'Unknown'} (${vramGB} GB VRAM total). Partition sizes filtered to this model.`;
    }
}

// Populate AKS GPU VM size dropdown with ALL supported GPU VM sizes
function populateAksGpuVmSizes() {
    const vmSizeSelect = document.getElementById('wl-gpu-aks-vm-size');
    if (!vmSizeSelect) return;
    vmSizeSelect.innerHTML = '<option value="" selected>Select a GPU VM size...</option>';
    // Check if GPU type is locked by an existing workload
    const lockedType = getLockedGpuType();
    let optionsAdded = 0;
    // Iterate GPU types — filter to locked type if set
    for (const gpuKey of Object.keys(AKS_GPU_VM_SIZES)) {
        if (lockedType && gpuKey !== lockedType) continue;
        const sizes = AKS_GPU_VM_SIZES[gpuKey];
        const gpuModel = GPU_MODELS[gpuKey];
        const gpuName = gpuModel ? gpuModel.name : gpuKey;
        sizes.forEach(s => {
            vmSizeSelect.innerHTML += `<option value="${s.name}" data-gpu-type="${gpuKey}">${s.name} [${gpuName}] (${s.gpus} GPU, ${s.vcpus} vCPUs, ${s.memoryGB} GB RAM)</option>`;
            optionsAdded++;
        });
    }
    const infoEl = document.getElementById('wl-gpu-aks-vm-info');
    if (infoEl) {
        if (lockedType && optionsAdded === 0) {
            // The cluster's GPU type is locked by another workload to a model
            // that has NO published AKS Arc VM SKUs (e.g. A100, A40, H100).
            // Warn the user *before* they try to save — addWorkload() will
            // also block save via validateWorkloadBeforeSave() as a backstop.
            const lockedModel = GPU_MODELS[lockedType];
            const lockedName = escapeHtmlSizer(lockedModel ? lockedModel.name : lockedType);
            infoEl.innerHTML =
                '<span style="color: var(--warning);"><strong>⚠ ' + lockedName +
                ' has no AKS Arc GPU VM SKUs.</strong> Another workload selected ' + lockedName +
                ', which is not currently supported by AKS Arc node pools. ' +
                'Either change that workload\'s GPU model to one with AKS VM SKUs ' +
                '(T4, A2, A16, L4, L40, L40S, RTX Pro 6000), or set this AKS cluster\'s GPU Mode to None.</span>';
        } else if (lockedType) {
            const lockedModel = GPU_MODELS[lockedType];
            infoEl.textContent = `GPU model locked to ${lockedModel ? lockedModel.name : lockedType} — all machines must use the same GPU (homogeneous configuration).`;
        } else {
            infoEl.textContent = '';
        }
    }
}

// Handle AKS GPU VM size selection — auto-set worker vCPU/memory and hardware GPU type
function onAksGpuVmSizeChange() {
    const vmSizeSelect = document.getElementById('wl-gpu-aks-vm-size');
    const infoEl = document.getElementById('wl-gpu-aks-vm-info');
    if (!vmSizeSelect) return;
    const selectedOption = vmSizeSelect.selectedOptions[0];
    if (!selectedOption || !selectedOption.value) {
        if (infoEl) infoEl.textContent = '';
        return;
    }
    const selectedName = selectedOption.value;
    const gpuType = selectedOption.getAttribute('data-gpu-type');
    // Find the VM size details
    const sizes = AKS_GPU_VM_SIZES[gpuType] || [];
    const vmSize = sizes.find(s => s.name === selectedName);
    if (vmSize) {
        // Auto-fill worker node vCPU and memory fields and lock them
        const vcpuEl = document.getElementById('aks-worker-vcpus');
        const memEl = document.getElementById('aks-worker-memory');
        if (vcpuEl) { vcpuEl.value = vmSize.vcpus; vcpuEl.disabled = true; }
        if (memEl) { memEl.value = vmSize.memoryGB; memEl.disabled = true; }
        // Update the DDA GPU count to match the VM size
        const ddaCountEl = document.getElementById('wl-gpu-dda-count');
        if (ddaCountEl) ddaCountEl.value = vmSize.gpus;
        // Auto-set hardware GPU type to match the selected VM size
        const hwGpuTypeEl = document.getElementById('gpu-type');
        if (hwGpuTypeEl && hwGpuTypeEl.value !== gpuType) {
            hwGpuTypeEl.value = gpuType;
        }
        // Auto-enable GPU in hardware config if not already set
        const hwGpuCountEl = document.getElementById('gpu-count');
        if (hwGpuCountEl && parseInt(hwGpuCountEl.value) === 0) {
            hwGpuCountEl.value = '1';
            updateGpuTypeVisibility();
        }
        // Enforce maxPerNode after changing GPU type
        enforceGpuMaxPerNode();
        const gpuModel = GPU_MODELS[gpuType];
        const gpuName = gpuModel ? gpuModel.name : gpuType;
        if (infoEl) infoEl.textContent = `Worker nodes: ${vmSize.vcpus} vCPUs, ${vmSize.memoryGB} GB RAM per node. Hardware GPU set to ${gpuName}.`;
    }
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

    const effectiveMaxMemory = PREFERRED_MAX_MEMORY_GB;

    // Use max disk size (15.36 TB) for node recommendation — favour scaling up disk size before adding nodes
    const maxDiskSizeGB = DISK_SIZE_OPTIONS_TB[DISK_SIZE_OPTIONS_TB.length - 1] * 1024;
    let maxDiskConfig = hwConfig.diskConfig;
    if (maxDiskConfig && maxDiskConfig.capacity) {
        maxDiskConfig = JSON.parse(JSON.stringify(maxDiskConfig)); // deep clone
        maxDiskConfig.capacity.sizeGB = Math.max(maxDiskConfig.capacity.sizeGB, maxDiskSizeGB);
    }

    return {
        totalPhysicalCores: maxCoresPerSocket * MAX_SOCKETS,
        memoryGB: effectiveMaxMemory,
        sockets: MAX_SOCKETS,
        coresPerSocket: maxCoresPerSocket,
        diskConfig: maxDiskConfig // disk size scaled to max for node recommendation
    };
}

// Pure helper: compound (1 + pct/100) over N years. Extracted from
// getGrowthFactor() so the math is unit-testable without DOM stubs.
function _computeGrowthMultiplier(growthPct, years) {
    const pct = parseInt(growthPct, 10) || 0;
    const yrs = parseInt(years, 10);
    const y = (isNaN(yrs) || yrs < 1) ? 1 : yrs;
    return Math.pow(1 + pct / 100, y);
}

// How many years of compound growth the hardware should be sized to absorb.
// Read from the "Size for 5-year compound growth" No/Yes dropdown inside the
// Capacity Runway section (issue #254). Defaults to 1 year (i.e. (1+pct/100)^1,
// the historical behaviour) when the dropdown is set to 'no' or absent.
function getGrowthYears() {
    const el = document.getElementById('size-for-5yr-growth');
    return (el && el.value === 'yes') ? 5 : 1;
}

// Get growth factor from the future-growth dropdown, compounded across
// getGrowthYears() years. With the 5-year dropdown set to 'yes', a 10% annual
// growth becomes 1.10^5 ≈ 1.611 so all downstream sizing math (workload
// totals, recommendation, auto-scale, capacity bars) targets year-5 demand.
function getGrowthFactor() {
    const el = document.getElementById('future-growth');
    const pct = el ? (parseInt(el.value) || 0) : 0;
    return _computeGrowthMultiplier(pct, getGrowthYears());
}

// Calculate recommended node count based on workload demands and per-node hardware
function getRecommendedNodeCount(totalVcpus, totalMemoryGB, totalStorageGB, hwConfig, resiliencyMultiplier, resiliency, totalGpus) {
    const vcpuToCore = getVcpuRatio(); // configurable overcommit ratio
    const ctEl = document.getElementById('cluster-type');
    const clusterTypeForOverhead = ctEl ? ctEl.value : 'standard';
    const hostOverheadMemoryGB = getHostMemoryReservedGB(hwConfig, clusterTypeForOverhead);
    const hostReservedCores = getHostCpuReservedCores(hwConfig, clusterTypeForOverhead);

    // Available capacity per node from hardware config (host CPU reserve excluded)
    const vcpusPerNode = Math.max((hwConfig.totalPhysicalCores || 0) - hostReservedCores, 0) * vcpuToCore;
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
    const computeNodes = vcpusPerNode > 0 ? Math.ceil(totalVcpusWithARB / vcpusPerNode) : 1;
    const memoryNodes = usableMemoryPerNode > 0 ? Math.ceil(totalMemoryWithARB / usableMemoryPerNode) : 1;
    // Disaggregated storage: external SAN, no S2D — skip storage node sizing
    const isDisaggCluster = document.getElementById('cluster-type') && document.getElementById('cluster-type').value === 'disaggregated';
    const storageNodes = (!isDisaggCluster && maxRawStoragePerNodeGB > 0) ? Math.ceil(totalRawStorageNeededGB / maxRawStoragePerNodeGB) : 0;

    // GPU node calculation: GPUs need N+1 for maintenance (same as compute/memory)
    let gpuNodes = 0;
    const gpuCountPerNode = hwConfig.gpuCount || 0;
    if (totalGpus > 0 && gpuCountPerNode > 0) {
        // Determine max GPUs per node based on GPU model
        const gpuModel = GPU_MODELS[hwConfig.gpuType];
        const maxGpuPerNode = gpuModel ? gpuModel.maxPerNode : gpuCountPerNode;
        gpuNodes = Math.ceil(totalGpus / maxGpuPerNode);
    }

    // Base minimum from workload
    // N+1 only applies to compute, memory, and GPU (storage remains accessible during node drain)
    const computeWithN1 = computeNodes >= 2 ? computeNodes + 1 : computeNodes;
    const memoryWithN1 = memoryNodes >= 2 ? memoryNodes + 1 : memoryNodes;
    const gpuWithN1 = gpuNodes >= 2 ? gpuNodes + 1 : gpuNodes;
    let recommended = Math.max(computeWithN1, memoryWithN1, storageNodes, gpuWithN1);

    // Enforce resiliency minimum
    const config = RESILIENCY_CONFIG[resiliency];
    if (config) {
        recommended = Math.max(recommended, config.minNodes);
    }

    // At least 1
    recommended = Math.max(recommended, 1);

    // Determine sizing driver (bottleneck)
    let bottleneck = 'compute';
    const maxDimension = Math.max(computeNodes, memoryNodes, storageNodes, gpuNodes);
    if (gpuNodes === maxDimension && gpuNodes > 0) bottleneck = 'gpu';
    else if (memoryNodes >= computeNodes && memoryNodes >= storageNodes) bottleneck = 'memory';
    else if (storageNodes >= computeNodes && storageNodes >= memoryNodes) bottleneck = 'storage';

    return {
        recommended,
        computeNodes,
        memoryNodes,
        storageNodes,
        gpuNodes,
        bottleneck
    };
}

// Disaggregated: maximum nodes per rack, matching Designer logic.
// Total cluster is capped at 64 nodes across 1–8 racks. Per-rack port
// budget allows up to 16 nodes, so effective limit = min(16, floor(64 / racks)).
// Results: 1–4 racks → 16/rack; 5 → 12; 6 → 10; 7 → 9; 8 → 8.
function getDisaggMaxNodesPerRack(rackCount) {
    let rc = parseInt(rackCount, 10) || 1;
    if (rc < 1) rc = 1;
    return Math.min(16, Math.floor(64 / rc));
}

// Conservative auto-scale node-count options for a given cluster type.
// - 'rack-aware': [2,4,6,8] (must stay even for balanced rack distribution)
// - 'disaggregated': multiples of rackCount up to maxPerRack*rackCount, so the
//   loop can scale past the HCI 16-node cap (disagg supports up to 64 nodes).
// - everything else (standard HCI): [2..16]
function getConservativeNodeOptions(clusterType, rackCount) {
    if (clusterType === 'rack-aware') return [2, 4, 6, 8];
    if (clusterType === 'disaggregated') {
        let rc = parseInt(rackCount, 10) || 1;
        if (rc < 1) rc = 1;
        const maxPerRack = getDisaggMaxNodesPerRack(rc);
        const opts = [];
        for (let i = 1; i <= maxPerRack; i++) opts.push(i * rc);
        return opts;
    }
    return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
}

// Decide whether a standard (HCI) cluster should be auto-upgraded to
// disaggregated when the conservative node loop has reached the 16-node cap.
// Only upgrades when the disaggregated recommendation genuinely exceeds 16 —
// otherwise the same 16-node count is reachable on HCI and aggressive
// memory/ratio scaling should be tried first (cheaper than adding a SAN).
// Returns { upgrade: false } or { upgrade: true, racks, estimatedNodes }.
function shouldUpgradeToDisaggregated(currentNodeCount, disaggRecommended) {
    const HCI_MAX = 16;
    const cur = parseInt(currentNodeCount, 10) || 0;
    if (cur < HCI_MAX) return { upgrade: false };
    const rec = parseInt(disaggRecommended, 10) || 0;
    if (rec <= HCI_MAX) return { upgrade: false };
    const racks = Math.min(4, Math.max(1, Math.ceil(rec / 16)));
    return { upgrade: true, racks: racks, estimatedNodes: rec };
}

// On a Disaggregated cluster already running, decide whether to auto-bump the
// rack count (1 → 2 → 3 → 4) when the conservative node loop has hit the
// per-rack cap (rackCount × 16) with utilisation still ≥ 90%. Capped at 4
// racks — going to 5–8 racks forces maxPerRack < 16 (a real floor-space /
// fabric change) which should stay a manual decision.
//
// Fires in EITHER of two cases:
//   (a) The workload recommendation already exceeds current rackCount × 16 —
//       guaranteed insufficient capacity at any per-machine memory size.
//   (b) The conservative auto-scale loop hit the per-rack node cap with
//       utilisation still ≥ 90 % on some resource (conservativeFailed=true).
//       This is the "prefer more machines over higher DIMMs" weighting:
//       without it the engine falls through to aggressive memory escalation
//       (e.g. 2 TB → 3 TB DIMMs) instead of adding the cheaper next rack.
// Returns { scale: false } or { scale: true, racks: N }.
function shouldAutoScaleDisaggRacks(currentRackCount, recommendedNodes, conservativeFailed) {
    const MAX_AUTO_RACKS = 4;
    const cur = Math.max(1, parseInt(currentRackCount, 10) || 1);
    if (cur >= MAX_AUTO_RACKS) return { scale: false };
    const rec = parseInt(recommendedNodes, 10) || 0;
    const recExceedsCap = rec > cur * 16;
    if (!recExceedsCap && !conservativeFailed) return { scale: false };
    // Target rack count: enough to fit the recommendation, otherwise just
    // bump by one tier. Always capped at MAX_AUTO_RACKS.
    const targetByRec = rec > 0 ? Math.ceil(rec / 16) : (cur + 1);
    const newRacks = Math.min(MAX_AUTO_RACKS, Math.max(cur + 1, targetByRec));
    if (newRacks <= cur) return { scale: false };
    return { scale: true, racks: newRacks };
}

// Inverse of shouldAutoScaleDisaggRacks(): when workloads have been removed
// (or shrunk), drop the Disaggregated rack count by one tier if the workload
// still fits at (cur - 1) racks with ≥ 20 % headroom on per-rack capacity.
// Only ever shrinks ONE tier per recalc (single-step) to prevent oscillation
// at the rack-count / DIMM-size boundary. The 20 % buffer means scale-up and
// shrink fire at different recommendation thresholds, so a workload sitting
// right at e.g. 32 nodes won't ping-pong between 2 and 3 racks.
// Returns { shrink: false } or { shrink: true, racks: N }.
function shouldAutoShrinkDisaggRacks(currentRackCount, recommendedNodes) {
    const cur = Math.max(1, parseInt(currentRackCount, 10) || 1);
    if (cur <= 1) return { shrink: false };
    const rec = parseInt(recommendedNodes, 10) || 0;
    // ≥ 20 % headroom at the lower tier: rec must be ≤ floor((cur-1) × 16 × 0.80)
    //   cur=4 → lower-cap-with-headroom = 38  (3 racks, ≤ 38 nodes recommended)
    //   cur=3 → lower-cap-with-headroom = 25  (2 racks, ≤ 25 nodes recommended)
    //   cur=2 → lower-cap-with-headroom = 12  (1 rack, ≤ 12 nodes recommended)
    const lowerCapWithHeadroom = Math.floor((cur - 1) * 16 * 0.80);
    if (rec > lowerCapWithHeadroom) return { shrink: false };
    return { shrink: true, racks: cur - 1 };
}

// Inverse of shouldUpgradeToDisaggregated(): when a previously auto-upgraded
// disaggregated cluster's workload now fits comfortably on Hyperconverged,
// downgrade back to standard HCI in one shot (skipping the rack-by-rack
// shrink). Threshold matches the per-rack shrink buffer (16 × 0.80 = 12) so
// the boundary is consistent and oscillation-safe with shouldUpgradeToDisaggregated()
// which fires only when disagg rec > 16.
// Returns { downgrade: false } or { downgrade: true, recommended: N }.
function shouldDowngradeFromDisaggregated(standardRecommendedNodes) {
    const HCI_MAX_WITH_HEADROOM = Math.floor(16 * 0.80); // 12
    const rec = parseInt(standardRecommendedNodes, 10) || 0;
    if (rec <= 0 || rec > HCI_MAX_WITH_HEADROOM) return { downgrade: false };
    return { downgrade: true, recommended: rec };
}

// Get the maximum node cap for the current cluster type
function getMaxNodeCap() {
    const ct = document.getElementById('cluster-type').value;
    if (ct === 'disaggregated') {
        const rc = parseInt((document.getElementById('disagg-rack-count') || {}).value, 10) || 4;
        return rc * getDisaggMaxNodesPerRack(rc);
    }
    if (ct === 'rack-aware') return 8;
    if (ct === 'single') return 1;
    if (ct === 'aldo-mgmt') return 3;
    return 16;
}

// Snap a recommended node count to the nearest available dropdown option
function snapToAvailableNodeCount(recommended) {
    const clusterType = document.getElementById('cluster-type').value;
    if (clusterType === 'single') return 1;
    if (clusterType === 'aldo-mgmt') return 3;
    if (clusterType === 'disaggregated') {
        const rackCountEl = document.getElementById('disagg-rack-count');
        const rackCount = rackCountEl ? parseInt(rackCountEl.value) || 2 : 2;
        // Snap to nearest multiple of rackCount (capped by Designer-matched per-rack max)
        const maxPerRack = getDisaggMaxNodesPerRack(rackCount);
        const snapped = Math.ceil(recommended / rackCount) * rackCount;
        return Math.min(snapped, maxPerRack * rackCount);
    }
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
        const bottleneckLabels = { compute: 'Compute (vCPUs)', memory: 'Memory', storage: 'Storage', gpu: 'GPU' };
        const driver = bottleneckLabels[recommendation.bottleneck];

        let msg = '';
        if (recommendation.recommended > getMaxNodeCap()) {
            msg = `Auto-scaling requires ~${recommendation.recommended} machines which exceeds max ${getMaxNodeCap()}. Consider increasing per-machine hardware capacity.`;
        } else {
            msg = `Auto-configured ${snapped} machine(s) based on ${driver} requirements.`;
            if (recommendation.bottleneck !== 'storage' && recommendation.recommended > 1) {
                msg += ' Includes N+1 maintenance capacity for compute and memory.';
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

    const bottleneckLabels = { compute: 'Compute (vCPUs)', memory: 'Memory', storage: 'Storage', gpu: 'GPU' };
    const driver = bottleneckLabels[recommendation.bottleneck];
    const snapped = snapToAvailableNodeCount(recommendation.recommended);

    let msg = '';
    if (recommendation.recommended > getMaxNodeCap()) {
        msg = `⚠️ Workload requires ~${recommendation.recommended} machines (${driver} bottleneck) which exceeds max ${getMaxNodeCap()}. Consider increasing per-machine hardware capacity (CPU cores, memory, or disk size).`;
    } else if (snapped > currentNodeCount) {
        msg = `ℹ️ Workload recommends ${snapped} machine(s) based on ${driver} requirements. Current selection: ${currentNodeCount} machine(s).`;
    } else {
        msg = `✅ Current ${currentNodeCount} machine(s) meets workload requirements (${driver} driven, ${snapped} recommended).`;
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

// When a 2-node hyperconverged solution would need more than this much memory
// per node, the auto-scaler prefers adding a third node instead. Rationale:
// (a) 2 nodes only supports a 2-way mirror (single fault domain after one node
// fails); 3 nodes unlocks 3-way mirror for stronger data resiliency, and
// (b) DIMM cost climbs steeply above 768 GB/node, so a third node is usually
// cheaper than packing two nodes with 1 TB+ DIMMs. User-set node count always
// wins. See "Sizer hardware scaling weighting logic" info popup for the full rules.
const NODE_WEIGHT_2NODE_MEMORY_DENSITY_THRESHOLD_GB = 768;

// ALDO Management Cluster minimum hardware requirements
// Source: https://learn.microsoft.com/en-us/azure/azure-local/manage/disconnected-operations-overview#eligibility-criteria
const ALDO_MIN_MEMORY_GB = 96;          // Minimum 96 GB memory per node
const ALDO_MIN_CORES_PER_NODE = 24;     // Minimum 24 physical cores per node
const ALDO_MIN_STORAGE_PER_NODE_TB = 2; // Minimum 2 TB SSD/NVMe storage per node
const ALDO_APPLIANCE_OVERHEAD_GB = 64;  // Disconnected operations appliance VM reservation per node

// GPU multi-node clusters: minimum cores-per-node for AUTO sizing.
// Rationale: GPU workloads (Foundry Local model serving, Edge RAG vLLM workers,
// AI Video Indexer transcoding/inference) are CPU-heavy on the host side for
// data preprocessing, scheduling, and feeding the GPU. An 8-core node will
// bottleneck the GPU. 24 cores/node is a reasonable AUTO floor that still
// leaves the user free to manually pick a smaller value if they have a
// specific reason to (e.g. low-throughput inference workloads).
const GPU_MIN_CORES_PER_NODE = 24;

const ARB_MEMORY_OVERHEAD_GB = 8;       // Azure Resource Bridge (ARB) appliance VM memory per cluster
const ARB_VCPU_OVERHEAD = 4;            // Azure Resource Bridge (ARB) appliance VM vCPUs per cluster

// ── Physical host (root partition) compute overhead — Issue #232 ──
// Per-node memory and CPU reserved for the Azure Local management OS / Hyper-V
// root partition, Failover Clustering / CSV, the S2D stack (Software Storage Bus,
// pool/ReFS runtime, CSV in-memory read cache, cache-drive metadata), Arc/AMA/ATC/
// Defender agents, and live-migration / repair / patching headroom. See
// docs/module-planning/issues-232-233-plan.md for the model and citations.
const HOST_MEM_BASE_S2D_GB = 32;            // S2D deployment types baseline
const HOST_MEM_BASE_DISAGGREGATED_GB = 24;  // Disaggregated (external SAN — no S2D stack)
const HOST_MEM_CACHE_METADATA_GB_PER_TB = 4; // S2D cache-drive metadata: 4 GB per TB of cache
const HOST_MEM_HOST_RAM_FRACTION = 0.08;    // Hyper-V root-partition reserve scaling term (8% of host RAM)

// Cache TB per node from a hardware config's disk layout (tiered S2D only; 0 otherwise).
function getCacheTBPerNode(hwConfig) {
    if (!hwConfig || !hwConfig.diskConfig) return 0;
    const dc = hwConfig.diskConfig;
    if (dc.isTiered && dc.cache) {
        return (dc.cache.count * dc.cache.sizeGB) / 1024;
    }
    return 0;
}

// Per-node host memory reservation (GB), S2D-aware.
//   S2D types:      max( 32 + (tiered ? 4 × cacheTB : 0) + aldo, ceil(0.08 × hostMemGB) )
//   Disaggregated:  max( 24 + aldo,                              ceil(0.08 × hostMemGB) )
// Cache metadata is forced to 0 for disaggregated (no S2D) and for non-tiered configs.
function getHostMemoryReservedGB(hwConfig, clusterType) {
    const isDisaggregated = clusterType === 'disaggregated';
    const base = isDisaggregated ? HOST_MEM_BASE_DISAGGREGATED_GB : HOST_MEM_BASE_S2D_GB;
    const cacheMetadataGB = isDisaggregated ? 0 : Math.ceil(getCacheTBPerNode(hwConfig) * HOST_MEM_CACHE_METADATA_GB_PER_TB);
    const aldo = clusterType === 'aldo-mgmt' ? ALDO_APPLIANCE_OVERHEAD_GB : 0;
    const hostMemGB = (hwConfig && hwConfig.memoryGB) || 0;
    const ramFractionGB = Math.ceil(HOST_MEM_HOST_RAM_FRACTION * hostMemGB);
    return Math.max(base + cacheMetadataGB + aldo, ramFractionGB);
}

// Per-node host CPU reservation (physical cores) for the root partition.
//   Disaggregated (all-flash): max(10%, 1 core)
//   Standard / S2D with ARB (default):        max(10%, 2 cores)
//   ALDO-mgmt:                                max(20%, 2 cores)
function getHostCpuReservedCores(hwConfig, clusterType) {
    const physicalCores = (hwConfig && hwConfig.totalPhysicalCores) || 0;
    let pct, floor;
    if (clusterType === 'aldo-mgmt') {
        pct = 0.20; floor = 2;
    } else if (clusterType === 'disaggregated') {
        pct = 0.10; floor = 1;
    } else {
        pct = 0.10; floor = 2;
    }
    return Math.max(Math.ceil(pct * physicalCores), floor);
}

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
const DISK_SIZE_OPTIONS_TB = [0.96, 1.92, 3.84, 5.68, 7.68, 15.36];

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

// Physical port count from Designer (default 4 if user hasn't come from Designer)
let _designerPortCount = 4;
// Spine count carried across the Designer↔Sizer boundary. The Sizer has no
// spine-count UI of its own, so this preserves the Designer-chosen value (2
// or 4) through import, save/resume, and export back to the Designer. Default
// 2 matches the Designer's default 2-spine Clos fabric.
let _designerSpineCount = 2;

// Last computed power / heat / rack-space estimate from updatePowerRackEstimates().
// Populated each time the panel renders so the Sizer→Designer handoff
// (selectRegionAndConfigure) and JSON export can attach the numeric values
// to the payload without re-deriving them or scraping the DOM.
let _lastPowerEstimate = null;

// Cached value of the dynamically-rendered Multi-Instance electricity price
// input — used by updateMultiInstanceSummary() to repopulate the input across
// re-renders (including after a localStorage restore where the element does
// not yet exist).
let _lastMultiPowerPrice = '';

// Track whether the user manually set disk size or disk count (independently)
// Only the specific field the user touched is locked; the other remains auto-scalable.
let _diskSizeUserSet = false;
let _diskCountUserSet = false;

// Track whether the user manually set GPU count per node (prevents GPU auto-scaling from overriding)
let _gpuCountUserSet = false;

// Track whether auto-upgrade from Standard → Disaggregated has already fired (prevents re-triggering)
let _disaggAutoUpgraded = false;

// Track disk bay consolidation details for sizing notes
let _diskConsolidationInfo = null;

// Track whether storage limits are exceeded (blocks export)
let _storageLimitExceeded = false;

// Track which hardware fields were auto-scaled so we can highlight them
const _autoScaledFields = new Set();

// Track which hardware fields were manually set by the user
const _manualFields = new Set();

// Mark a field element as manually set by the user (add green highlight + MANUAL badge with × dismiss)
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
                badge.title = 'This value was manually set and will not be changed by auto-scaling';

                const textNode = document.createTextNode('manual');
                badge.appendChild(textNode);

                const dismiss = document.createElement('span');
                dismiss.className = 'manual-badge-dismiss';
                dismiss.textContent = '\u00d7';
                dismiss.title = 'Remove this override';
                dismiss.setAttribute('role', 'button');
                dismiss.setAttribute('aria-label', 'Remove ' + (_MANUAL_FIELD_LABELS[elementId] || elementId) + ' override');
                dismiss.addEventListener('click', function(e) {
                    e.stopPropagation();
                    clearSingleManualOverride(elementId);
                });
                badge.appendChild(dismiss);

                label.appendChild(badge);
            }
        }
    }
    // Show the "Remove all MANUAL overrides" button
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
    _gpuCountUserSet = false;
    _nodeCountUserSet = false;
    _repairDisksUserSet = false;
    _disaggAutoUpgraded = false;
    clearManualBadges();
    // Restore future-growth to the 10% recommended default + AUTO badge,
    // matching the per-field × dismiss behaviour.
    const growthEl = document.getElementById('future-growth');
    if (growthEl) growthEl.value = '10';
    markAutoScaled('future-growth');
    calculateRequirements();
}

// Human-readable names for manually-set hardware fields
const _MANUAL_FIELD_LABELS = {
    'cluster-type': 'Deployment Type',
    'node-count': 'Machine Count',
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
    'tiered-repair-disk-count': 'S2D Repair Disks',
    'disagg-rack-count': 'Number of Racks',
    'future-growth': 'Allow for Future Growth'
};

// Map element IDs to their corresponding _*UserSet flag name and sibling IDs
// that share the same flag (clearing one clears all siblings).
const _MANUAL_FIELD_TO_FLAG = {
    'cluster-type':              { flag: 'clusterType', siblings: [] },
    'node-count':                { flag: 'nodeCount',   siblings: [] },
    'vcpu-ratio':                { flag: 'vcpuRatio',   siblings: [] },
    'node-memory':               { flag: 'memory',      siblings: [] },
    'cpu-cores':                 { flag: 'cpuConfig',   siblings: ['cpu-sockets', 'cpu-manufacturer', 'cpu-generation'] },
    'cpu-sockets':               { flag: 'cpuConfig',   siblings: ['cpu-cores', 'cpu-manufacturer', 'cpu-generation'] },
    'cpu-manufacturer':          { flag: 'cpuConfig',   siblings: ['cpu-cores', 'cpu-sockets', 'cpu-generation'] },
    'cpu-generation':            { flag: 'cpuConfig',   siblings: ['cpu-cores', 'cpu-sockets', 'cpu-manufacturer'] },
    'capacity-disk-size':        { flag: 'diskSize',    siblings: ['tiered-capacity-disk-size'] },
    'tiered-capacity-disk-size': { flag: 'diskSize',    siblings: ['capacity-disk-size'] },
    'capacity-disk-count':       { flag: 'diskCount',   siblings: ['tiered-capacity-disk-count'] },
    'tiered-capacity-disk-count':{ flag: 'diskCount',   siblings: ['capacity-disk-count'] },
    'repair-disk-count':         { flag: 'repairDisks', siblings: ['tiered-repair-disk-count'] },
    'tiered-repair-disk-count':  { flag: 'repairDisks', siblings: ['repair-disk-count'] },
    'gpu-count':                 { flag: 'gpuCount',    siblings: [] },
    'disagg-rack-count':         { flag: 'rackCount',   siblings: [] },
    'future-growth':             { flag: 'futureGrowth', siblings: [] }
};

// Remove a single manual override — clears the flag (and sibling badges that share it), then re-runs auto-scaling
function clearSingleManualOverride(elementId) {
    const mapping = _MANUAL_FIELD_TO_FLAG[elementId];
    if (!mapping) return;

    // Reset the corresponding _*UserSet flag
    switch (mapping.flag) {
        case 'clusterType': _disaggAutoUpgraded  = false; break;
        case 'nodeCount':   _nodeCountUserSet   = false; break;
        case 'vcpuRatio':   _vcpuRatioUserSet   = false; break;
        case 'memory':      _memoryUserSet       = false; break;
        case 'cpuConfig':   _cpuConfigUserSet    = false; break;
        case 'diskSize':    _diskSizeUserSet     = false; break;
        case 'diskCount':   _diskCountUserSet    = false; break;
        case 'gpuCount':    _gpuCountUserSet     = false; break;
        case 'repairDisks': _repairDisksUserSet  = false; break;
    }

    // Remove badge from this element and all siblings sharing the same flag
    const idsToRemove = [elementId, ...mapping.siblings];
    for (const id of idsToRemove) {
        _manualFields.delete(id);
        const el = document.getElementById(id);
        if (el) el.classList.remove('manual-set');
        const row = el?.closest('.config-row');
        if (row) {
            const badge = row.querySelector('.manual-set-badge');
            if (badge) badge.remove();
        }
    }

    // Hide "Remove all" button if no manual fields remain
    if (_manualFields.size === 0) {
        const clearBtn = document.getElementById('clear-manual-overrides');
        if (clearBtn) clearBtn.style.display = 'none';
    }

    // node-count dismiss: reset the dropdown to the cluster's minimum option
    // before recalc so any cascaded resiliency change (e.g. 2-way → 3-way mirror
    // when going 2 → 3 nodes) unwinds first. Otherwise the 3-way minNodes=3
    // requirement re-pins the recommendation at 3 and the user can never get
    // back to a 2-node + 2-way solution by clicking ×.
    if (elementId === 'node-count') {
        const nodeSelect = document.getElementById('node-count');
        if (nodeSelect && nodeSelect.options.length > 0) {
            nodeSelect.value = nodeSelect.options[0].value;
            updateResiliencyOptions();
            updateClusterInfo();
        }
    }

    // future-growth has no auto-scaler that would re-flag it as AUTO on the
    // next calc, so do it explicitly: reset to the 10% recommended default
    // and re-apply the AUTO badge.
    if (elementId === 'future-growth') {
        const growthEl = document.getElementById('future-growth');
        if (growthEl) growthEl.value = '10';
        markAutoScaled('future-growth');
    }

    calculateRequirements();
}

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
    const ctEl = document.getElementById('cluster-type');
    const clusterTypeForOverhead = ctEl ? ctEl.value : 'standard';
    const usableCap = (physCores, ratio) => Math.max(physCores - getHostCpuReservedCores({ totalPhysicalCores: physCores }, clusterTypeForOverhead), 0) * effectiveNodes * ratio;
    let targetCores = null;
    for (const c of bestGen.coreOptions) {
        if (c * MAX_SOCKETS <= currentPhysCores) continue; // must exceed current config
        const candidateCap = usableCap(c * MAX_SOCKETS, currentRatio);
        const candidatePct = candidateCap > 0 ? Math.round(totalVcpus / candidateCap * 100) : 100;
        if (candidatePct < threshold) {
            targetCores = c;
            break;
        }
    }
    // If no single option resolves it, use max cores (still better than 6:1)
    if (!targetCores) {
        const maxCoresOption = bestGen.coreOptions[bestGen.coreOptions.length - 1];
        const maxCap = usableCap(maxCoresOption * MAX_SOCKETS, currentRatio);
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
    const hostOverheadMemoryGB = getHostMemoryReservedGB(hwConfig, clusterTypeForOverhead);
    const hostReservedCores = getHostCpuReservedCores(hwConfig, clusterTypeForOverhead);
    const effectiveNodes = nodeCount > 1 ? nodeCount - 1 : 1;

    let changed = false;

    // --- Auto-scale CPU cores (and sockets if needed) ---
    // Skip when the user has manually set CPU cores/sockets (respect user override).
    // For ALDO management clusters, enforce minimum 24 physical cores per node
    const aldoMinCores = (clusterTypeForOverhead === 'aldo-mgmt') ? ALDO_MIN_CORES_PER_NODE : 0;
    // Multi-node GPU clusters: enforce a minimum cores-per-node floor so AUTO
    // doesn't pick e.g. 8-core CPUs that will starve the GPU.
    const gpuCountPerNodeForCpu = parseInt((document.getElementById('gpu-count') || {}).value, 10) || 0;
    const gpuMinCores = (nodeCount > 1 && gpuCountPerNodeForCpu > 0) ? GPU_MIN_CORES_PER_NODE : 0;
    const requiredCoresPerNode = Math.max(Math.ceil((totalVcpus + ARB_VCPU_OVERHEAD) / effectiveNodes / vcpuToCore) + hostReservedCores, aldoMinCores, gpuMinCores);
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
        const minDisksForType = MIN_DISK_COUNT;
        let targetDisks = Math.max(minDisksForType, Math.min(disksNeeded, maxDisksForType));

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

    // Usable vCPU capacity per cluster, excluding the per-node host CPU reserve.
    // Declared at function scope so both the physical core/socket scaling pass and
    // the vCPU-ratio escalation pass (which may run even when cores are locked) can use it.
    const usableVcpuCap = (coresPerNode, ratio) => Math.max(coresPerNode - getHostCpuReservedCores({ totalPhysicalCores: coresPerNode }, clusterTypeForOverhead), 0) * effectiveNodes * (ratio || vcpuToCore);

    // CPU headroom — bump cores first, then sockets.
    // Skip the PHYSICAL core/socket scaling when the user has manually set (or
    // imported) the CPU config — physical silicon cannot be changed on a fixed
    // cluster. The vCPU overcommit ratio is NOT a physical property and is handled
    // separately below so it can still escalate even when cores/sockets are locked.
    // Re-read manufacturer/genId in case AMD auto-switch changed them.
    manufacturer = document.getElementById('cpu-manufacturer').value;
    genId = document.getElementById('cpu-generation').value;
    if (manufacturer && genId && !_cpuConfigUserSet) {
        const gen = CPU_GENERATIONS[manufacturer].find(g => g.id === genId);
        if (gen) {
            let cpuCap = usableVcpuCap(hrCores * hrSockets);
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
                cpuCap = usableVcpuCap(hrCores * hrSockets);
                cpuPct = cpuCap > 0 ? Math.round(totalVcpus / cpuCap * 100) : 0;
            }
        }
    }

    // vCPU ratio auto-escalation — when compute ≥90%, bump the overcommit ratio
    // (4→5→6) to reduce over-threshold pressure.
    // Decoupled from the physical CPU lock (_cpuConfigUserSet): the overcommit
    // ratio is NOT a physical property, so it must still escalate on a fixed /
    // imported cluster whose cores & sockets are locked. It is gated ONLY by the
    // user manually pinning the ratio (_vcpuRatioUserSet → shows MANUAL).
    // Only auto-escalate from default (4) or a previously auto-escalated value (5).
    // In conservative mode (default), skip ratio escalation entirely — prefer adding
    // nodes first. Only allow escalation in the final aggressive pass when nodes are maxed.
    //
    // Before escalating from 5→6, try switching to an AMD generation with more
    // physical cores (e.g. AMD Turin Dense with 192 cores/socket = 384 cores dual-socket).
    // This keeps the overcommit ratio lower (5:1) by adding real physical cores — but
    // ONLY when the physical CPU is not locked, since that step changes the silicon.
    if (manufacturer && genId) {
        // Use the current cores/sockets (possibly just scaled above, or locked).
        let cpuCap = usableVcpuCap(hrCores * hrSockets);
        let cpuPct = cpuCap > 0 ? Math.round(totalVcpus / cpuCap * 100) : 0;
        const VCPU_ESCALATION_THRESHOLD = 90;
        const VCPU_RATIO_STEPS = [5, 6];
        if (allowRatioEscalation && !_vcpuRatioUserSet && cpuPct >= VCPU_ESCALATION_THRESHOLD && vcpuToCore >= 4 && vcpuToCore < 6) {
            for (const nextRatio of VCPU_RATIO_STEPS) {
                if (nextRatio <= vcpuToCore) continue; // skip ratios we're already at or past

                // Before jumping to 6:1, try switching to AMD with higher core counts
                // at the current ratio — but only when the physical CPU is not locked
                // (an imported/fixed cluster cannot swap silicon).
                if (nextRatio === 6 && !_cpuConfigUserSet) {
                    const amdSwitch = _tryAmdCoreUpgrade(
                        totalVcpus, effectiveNodes, vcpuToCore,
                        hrCores, hrSockets, VCPU_ESCALATION_THRESHOLD
                    );
                    if (amdSwitch) {
                        // AMD switch resolved compute pressure — apply the change
                        hrCores = amdSwitch.cores;
                        hrSockets = amdSwitch.sockets;
                        changed = true;
                        cpuCap = usableVcpuCap(hrCores * hrSockets);
                        cpuPct = cpuCap > 0 ? Math.round(totalVcpus / cpuCap * 100) : 0;
                        if (cpuPct < VCPU_ESCALATION_THRESHOLD) {
                            // AMD cores resolved pressure at 5:1 — check if we can
                            // step back to 4:1 and still stay under threshold
                            const pctAt4 = Math.round(totalVcpus / usableVcpuCap(hrCores * hrSockets, 4) * 100);
                            if (pctAt4 < VCPU_ESCALATION_THRESHOLD) {
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
                cpuCap = usableVcpuCap(hrCores * hrSockets);
                cpuPct = cpuCap > 0 ? Math.round(totalVcpus / cpuCap * 100) : 0;
                if (cpuPct < VCPU_ESCALATION_THRESHOLD) break;
            }
        } else if (previouslyAutoScaled && previouslyAutoScaled.has('vcpu-ratio')) {
            // Ratio was auto-escalated in a prior cycle and is still adequate — re-apply badge
            markAutoScaled('vcpu-ratio');
            _vcpuRatioAutoEscalated = true;
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
        clusterName: (document.getElementById('cluster-name') || {}).value || '',
        disaggRackCount: (document.getElementById('disagg-rack-count') || {}).value || null,
        disaggStorageType: (document.getElementById('disagg-storage-type') || {}).value || null,
        disaggSpineCount: _designerSpineCount || 2,
        nodeCount: document.getElementById('node-count').value,
        nodeCountUserSet: _nodeCountUserSet,
        futureGrowth: document.getElementById('future-growth').value,
        sizeFor5YrGrowth: (document.getElementById('size-for-5yr-growth') || {}).value === 'yes',
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
        workloadIdCounter: workloadIdCounter,
        instanceCount: (document.getElementById('instance-count') || {}).value || '1',
        powerPriceInput: (document.getElementById('power-price-input') || {}).value || '',
        multiPowerPriceInput: (document.getElementById('multi-power-price-input') || {}).value || _lastMultiPowerPrice || '',
        importedProcessorName: window._importedProcessorName || null,
        importedCoresPerSocket: window._importedCoresPerSocket || null,
        autoScaledFields: Array.from(_autoScaledFields),
        disaggAutoUpgraded: _disaggAutoUpgraded
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

        // For disaggregated, apply rack count before updating node options
        if (payload.clusterType === 'disaggregated' && payload.disaggRackCount) {
            const rackCountSelect = document.getElementById('disagg-rack-count');
            if (rackCountSelect) {
                rackCountSelect.value = String(payload.disaggRackCount);
            }
        }

        // Trigger cluster type change handlers to update node options, storage, etc.
        const isDisaggImport = payload.clusterType === 'disaggregated';
        updateNodeOptionsForClusterType();
        updateStorageForClusterType();
        if (isDisaggImport) updateDisaggregatedUI(true);
        updateResiliencyOptions();
        updateAldoWorkloadButtons();

        // Store physical port count from Designer for 3D rack visualization
        if (payload.ports) {
            _designerPortCount = parseInt(payload.ports, 10) || 4;
        }
        // Preserve Designer-chosen spine count (2 or 4) so the Sizer's 3D
        // visualization and any subsequent Sizer→Designer round-trip keep
        // the original fabric width.
        if (payload.spineCount) {
            _designerSpineCount = parseInt(payload.spineCount, 10) || 2;
        }
        if (payload.disaggStorageType) {
            const storageTypeSelect = document.getElementById('disagg-storage-type');
            if (storageTypeSelect) storageTypeSelect.value = payload.disaggStorageType;
        }

        // Apply node count (after node options are updated for the cluster type)
        // Mark as MANUAL so auto-scaling does not override the Designer's node count
        const nodeCountSelect = document.getElementById('node-count');
        if (nodeCountSelect && payload.nodeCount) {
            // Check the option exists before setting
            const optionExists = Array.from(nodeCountSelect.options).some(
                function(opt) { return opt.value === payload.nodeCount; }
            );
            if (optionExists) {
                nodeCountSelect.value = payload.nodeCount;
                _nodeCountUserSet = true;
                markManualSet('node-count');
            }
        }

        // Silently restore workloads from previously saved Sizer state (if any)
        const savedSizer = loadSizerState();
        let restoredCount = 0;
        if (savedSizer && savedSizer.data) {
            const sd = savedSizer.data;
            if (sd.workloads && sd.workloads.length > 0) {
                workloads = sd.workloads;
                workloadIdCounter = sd.workloadIdCounter || workloads.length;
                restoredCount = workloads.length;
                renderWorkloads();
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
            'single': 'Single Machine',
            'standard': 'Hyperconverged',
            'rack-aware': 'Rack-Aware Instance',
            'disaggregated': 'Disaggregated Storage',
            'aldo-mgmt': 'ALDO Management Cluster'
        };
        const typeLabel = clusterLabels[payload.clusterType] || payload.clusterType;
        const nodeLabel = payload.nodeCount === '1' ? '1 machine' : (payload.nodeCount + ' machines');

        // Show confirmation banner
        const banner = document.createElement('div');
        banner.id = 'designer-import-banner';
        banner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;padding:16px 24px;background:linear-gradient(135deg,rgba(139,92,246,0.95),rgba(59,130,246,0.95));color:white;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-size:14px;font-weight:500;display:flex;align-items:center;gap:16px;animation:slideDown 0.3s ease;max-width:600px;';
        let subtitleText = typeLabel + ' \u2022 ' + nodeLabel;
        if (restoredCount > 0) {
            subtitleText += ' \u2022 ' + restoredCount + ' workload' + (restoredCount > 1 ? 's' : '') + ' restored \u2014 add more or review sizing';
        } else {
            subtitleText += ' \u2014 add workloads to size your hardware';
        }
        banner.innerHTML = '<div style="flex:1;"><div style="font-weight:700;margin-bottom:4px;">Designer Configuration Imported</div><div style="font-size:12px;opacity:0.9;">' +
            subtitleText + '</div></div>' +
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

    // Only show if there are actual workloads to resume
    const d = saved.data;
    const hasWorkloads = d.workloads && d.workloads.length > 0;
    if (!hasWorkloads) return;

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
    const clusterNameEl = document.getElementById('cluster-name');
    if (clusterNameEl) {
        clusterNameEl.value = d.clusterName || '';
        if (typeof onClusterNameInput === 'function') onClusterNameInput();
    }
    // Restore disaggregated rack count before updating node options
    if (d.clusterType === 'disaggregated' && d.disaggRackCount) {
        const rackEl = document.getElementById('disagg-rack-count');
        if (rackEl) rackEl.value = String(d.disaggRackCount);
    }
    if (d.disaggSpineCount) {
        _designerSpineCount = parseInt(d.disaggSpineCount, 10) || 2;
    }
    updateNodeOptionsForClusterType();
    updateStorageForClusterType();
    if (d.clusterType === 'disaggregated') updateDisaggregatedUI(true);
    document.getElementById('node-count').value = d.nodeCount || '3';
    document.getElementById('future-growth').value = d.futureGrowth || '10';
    const sizeFor5YrResume = document.getElementById('size-for-5yr-growth');
    if (sizeFor5YrResume) sizeFor5YrResume.value = (d.sizeFor5YrGrowth === true) ? 'yes' : 'no';

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
    // Spine count is always 2 (legacy saves may have had other values)

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

    // Restore Multi-Instance Scale-Out controls and the optional electricity prices.
    // The per-instance #power-price-input is static HTML so we set it directly.
    // The multi-instance #multi-power-price-input is rendered dynamically inside
    // updateMultiInstanceSummary(), so we stash the value in _lastMultiPowerPrice
    // and let the render pick it up. instance-count must be set BEFORE
    // calculateRequirements() so the multi-instance summary uses the restored
    // count rather than the default 1.
    const instanceCountElResume = document.getElementById('instance-count');
    if (instanceCountElResume && d.instanceCount) {
        const optResume = Array.from(instanceCountElResume.options).find(o => o.value === String(d.instanceCount));
        if (optResume) instanceCountElResume.value = String(d.instanceCount);
    }
    const powerPriceElResume = document.getElementById('power-price-input');
    if (powerPriceElResume && typeof d.powerPriceInput === 'string') {
        powerPriceElResume.value = d.powerPriceInput;
    }
    if (typeof d.multiPowerPriceInput === 'string') {
        _lastMultiPowerPrice = d.multiPowerPriceInput;
    }

    // Re-hydrate which fields were AUTO-scaled in the prior session. Without this,
    // the cluster-type AUTO badge is missing after F5/Resume and the auto-downgrade
    // block (which gates on `_autoScaledFields.has('cluster-type')`) can never fire
    // when the user later removes a MANUAL override that had forced the upgrade.
    // calculateRequirements() snapshots `_autoScaledFields` into `previouslyAutoScaled`
    // before clearing it, so the existing re-apply blocks will re-render the badges.
    if (Array.isArray(d.autoScaledFields)) {
        for (const fid of d.autoScaledFields) {
            markAutoScaled(fid);
        }
    }
    _disaggAutoUpgraded = !!d.disaggAutoUpgraded;

    calculateRequirements();

    dismissSizerResumeBanner();
}

// Start fresh - clear saved state and reset
function startSizerFresh() {
    clearSizerState();
    dismissSizerResumeBanner();
    resetScenario();
    // resetScenario → calculateRequirements re-saves state; clear it again
    clearSizerState();
}

// Dismiss the resume banner
function dismissSizerResumeBanner() {
    const banner = document.getElementById('sizer-resume-banner');
    if (banner) {
        banner.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => banner.remove(), 300);
    }
}

// Show a toast notification in the Sizer
function showSizerToast(message, type) {
    // Remove any existing toast
    const existing = document.getElementById('sizer-toast');
    if (existing) existing.remove();

    const bgColor = type === 'info' ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))'
        : type === 'success' ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.95))'
            : type === 'error' ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))';

    const icon = type === 'info' ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink:0"><circle cx="10" cy="10" r="9" stroke="white" stroke-width="1.5"/><path d="M10 9v5M10 6.5v0" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>'
        : type === 'success' ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink:0"><circle cx="10" cy="10" r="9" stroke="white" stroke-width="1.5"/><path d="M6 10l3 3 5-6" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink:0"><circle cx="10" cy="10" r="9" stroke="white" stroke-width="1.5"/><path d="M10 6v5M10 13.5v0" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>';

    const toast = document.createElement('div');
    toast.id = 'sizer-toast';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;padding:14px 24px;background:' + bgColor + ';color:white;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-size:14px;font-weight:500;display:flex;align-items:center;gap:12px;animation:slideDown 0.3s ease;max-width:600px;cursor:pointer;';
    toast.innerHTML = icon + '<span>' + message + '</span>';
    toast.onclick = function() {
        toast.style.animation = 'slideUp 0.3s ease';
        setTimeout(function() { toast.remove(); }, 300);
    };
    document.body.appendChild(toast);

    // Auto-dismiss after 6 seconds
    setTimeout(function() {
        if (toast.parentNode) {
            toast.style.animation = 'slideUp 0.3s ease';
            setTimeout(function() { toast.remove(); }, 300);
        }
    }, 6000);
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
    },
    foundry: {
        name: 'Foundry Local',
        modelClass: 'medium', // small, medium, large, custom
        replicas: 1,
        engine: 'onnx-genai' // onnx-genai (CPU or GPU) or vllm (GPU only)
    },
    edgerag: {
        name: 'Edge RAG',
        computeMode: 'gpu', // gpu (recommended) or cpu
        corpusGB: 100        // total document corpus size in GB (drives vector DB / embedding storage)
    },
    videoindexer: {
        name: 'AI Video Indexer',
        configuration: 'recommended' // 'minimum' (1 worker) or 'recommended' (2 workers, HA)
    },
    ghel: {
        name: 'GitHub Enterprise Local',
        tier: 'up-to-1000', // see GHEL_TIERS
        ha: true,           // GHES replica-based HA (doubles the VM footprint); defaults to Yes per production guidance
        replicas: 1         // 0-7 additional replicas (GitHub caps total HA replicas at 8). Mirrors `ha` for the basic case; Advanced section can override up to 7.
    }
};

// GitHub Enterprise Server "Minimum recommended requirements" table, as
// published by GitHub for GHES 3.20 (the version GHEL ships).
// Source: https://docs.github.com/en/enterprise-server@3.20/admin/monitoring-and-managing-your-instance/updating-the-virtual-machine-and-physical-resources/increasing-storage-capacity#minimum-recommended-requirements
// Storage = root disk + data disk, both presented to the GHEL VM as a single
// total in the Sizer (Azure Local doesn't surface root vs data separately at
// sizing time). Network-throughput column is informational only.
const GHEL_TIERS = {
    'trial': {
        name: 'Trial / demo (10 light users)',
        users: 'Up to 10 light users',
        vcpus: 4,
        memory: 32,        // GB
        rootStorage: 400,  // GB
        dataStorage: 500,  // GB
        throughputMbps: 600
    },
    'up-to-1000': {
        name: 'Up to 1,000 users',
        users: 'Up to 1,000 users',
        vcpus: 8,
        memory: 48,
        rootStorage: 400,
        dataStorage: 500,
        throughputMbps: 3000
    },
    '1000-to-3000': {
        name: '1,000 to 3,000 users',
        users: '1,000\u20133,000 users',
        vcpus: 16,
        memory: 64,
        rootStorage: 400,
        dataStorage: 1000,
        throughputMbps: 6000
    },
    '3000-to-5000': {
        name: '3,000 to 5,000 users',
        users: '3,000\u20135,000 users',
        vcpus: 32,
        memory: 128,
        rootStorage: 400,
        dataStorage: 1500,
        throughputMbps: 9000
    },
    '5000-to-8000': {
        name: '5,000 to 8,000 users',
        users: '5,000\u20138,000 users',
        vcpus: 48,
        memory: 256,
        rootStorage: 400,
        dataStorage: 3000,
        throughputMbps: 12000
    },
    '8000-to-10000': {
        name: '8,000 to 10,000+ users',
        users: '8,000\u201310,000+ users',
        vcpus: 64,
        memory: 512,
        rootStorage: 400,
        dataStorage: 5000,
        throughputMbps: 15000
    }
};

// Foundry Local model size classes (per replica resource estimates).
// Numbers are conservative rules-of-thumb (memory ~= params * bytes-per-weight + KV cache + overhead).
// These are estimates only — actual sizing depends on the model, quantization,
// batch size and concurrent request load. Validate with your OEM hardware partner.
const FOUNDRY_MODEL_CLASSES = {
    small: {
        name: 'Small SLM',
        description: 'Phi-3.5-mini, Phi-4-mini, Phi-4-mini-reasoning, Qwen3 (0.6b–14b), Qwen2.5, Whisper (~1–7B params)',
        vcpus: 4,
        memory: 8,
        storage: 20,
        recommendedGpu: 'optional' // CPU OK with ONNX-GenAI; vLLM still requires GPU
    },
    medium: {
        name: 'Medium SLM',
        description: 'Phi-4, Phi-4-reasoning, gpt-oss-20b, Mistral-7B-v0.2, DeepSeek-R1 (7b/14b), NVIDIA Nemotron (~7–20B params)',
        vcpus: 8,
        memory: 16,
        storage: 40,
        recommendedGpu: 'recommended'
    },
    large: {
        name: 'Large LLM',
        description: 'gpt-oss-120b (vLLM-only), plus larger BYO models served via vLLM on GPU (~30–120B+ params)',
        vcpus: 16,
        memory: 64,
        storage: 100,
        recommendedGpu: 'required'
    },
    custom: {
        name: 'Custom',
        description: 'Custom per-replica resource specification',
        vcpus: 8,
        memory: 16,
        storage: 40,
        recommendedGpu: 'optional'
    }
};

// Foundry Local fixed sizing constants. Foundry runs on a 3-node Arc-enabled
// Kubernetes (AKS Arc) control plane plus N model deployment replicas.
// Numbers below mirror the AKS_OS_DISK_GB constant used in the AKS workload.
const FOUNDRY_CP_NODES = 3;
const FOUNDRY_CP_VCPU_PER_NODE = 4;
const FOUNDRY_CP_MEM_PER_NODE = 8;
const FOUNDRY_OS_DISK_GB = 200;
const FOUNDRY_OPERATOR_VCPU = 2;
const FOUNDRY_OPERATOR_MEM_GB = 4;

// Edge RAG fixed sizing constants. Edge RAG (Azure Arc-enabled Kubernetes
// extension, Preview) runs on a 3-node AKS Arc control plane plus a fixed
// 4-VM worker node pool. Per Microsoft's published minimum hardware
// requirements (https://learn.microsoft.com/azure/azure-arc/edge-rag/requirements):
//   GPU mode: 4 GPU-enabled VMs (NC8_A2 or NC8_A16 — 8 vCPU / ~28-32 GB) with 1 GPU each
//   CPU mode: 4 CPU VMs at minimum 8 vCPU / 32 GB each (D8s_v3)
// Plus an Edge RAG operator overhead and a vector-database storage allowance
// driven by the user-supplied document corpus size (typical RAG embedding
// overhead is ~1.5x the source corpus once chunked, embedded and indexed).
const EDGERAG_CP_NODES = 3;
const EDGERAG_CP_VCPU_PER_NODE = 4;
const EDGERAG_CP_MEM_PER_NODE = 8;
const EDGERAG_OS_DISK_GB = 200;
const EDGERAG_WORKER_NODES = 4;
const EDGERAG_WORKER_VCPU_PER_NODE = 8;
const EDGERAG_WORKER_MEM_PER_NODE = 32;
const EDGERAG_WORKER_GPU_PER_NODE = 1; // GPU mode only — DDA, 1 GPU per worker (4 total)
const EDGERAG_OPERATOR_VCPU = 2;
const EDGERAG_OPERATOR_MEM_GB = 4;
const EDGERAG_VECTOR_DB_MULTIPLIER = 1.5; // total storage = corpusGB * 1.5 (chunks + embeddings + index)

// Video Indexer enabled by Arc fixed sizing constants. Video Indexer (Azure
// Arc-enabled Kubernetes extension, Preview) runs on a 3-node AKS Arc control
// plane plus a dedicated worker node pool. Per Microsoft's published minimum
// hardware requirements (https://learn.microsoft.com/azure/azure-video-indexer/arc/azure-video-indexer-enabled-by-arc-overview#minimum-hardware-requirements):
//   Minimum:     1 worker node, 32 cores / 64 GB RAM / 50 GB storage (cluster-wide)
//   Recommended: 2 worker nodes, 64 cores / 256 GB RAM / 100 GB storage (cluster-wide, HA)
// The cluster-wide vCPU and memory totals are split evenly across the worker
// pool (e.g. 2 nodes -> 32 vCPU / 128 GB each in Recommended mode). The 50 /
// 100 GB storage figure is the ReadWriteMany persistent-volume requirement
// for the VI extension; AKS Arc adds 200 GB OS disk per node.
const VI_CP_NODES = 3;
const VI_CP_VCPU_PER_NODE = 4;
const VI_CP_MEM_PER_NODE = 8;
const VI_OS_DISK_GB = 200;
const VI_OPERATOR_VCPU = 2;
const VI_OPERATOR_MEM_GB = 4;
const VI_MIN_WORKER_NODES = 1;
const VI_MIN_VCPU = 32;       // cluster-wide minimum vCPU for VI
const VI_MIN_MEM_GB = 64;     // cluster-wide minimum memory
const VI_MIN_STORAGE_GB = 50; // cluster-wide minimum PV storage
const VI_REC_WORKER_NODES = 2;
const VI_REC_VCPU = 64;       // cluster-wide recommended vCPU (upper bound of 48-64)
const VI_REC_MEM_GB = 256;    // cluster-wide recommended memory
const VI_REC_STORAGE_GB = 100; // cluster-wide recommended PV storage

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
    '4way': { multiplier: 4, minNodes: 4, name: 'Four-way Mirror' },
    'external': { multiplier: 1, minNodes: 1, name: 'External SAN Storage' }
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

// Handle cluster type change (single / standard / rack-aware / disaggregated)
function onClusterTypeChange() {
    const clusterType = document.getElementById('cluster-type').value;
    const wasAldo = workloads.some(w => w.isAldoFixed);
    const isAldo = clusterType === 'aldo-mgmt';
    const isDisagg = clusterType === 'disaggregated';

    // Suppress auto-upgrade when user manually selects a cluster type.
    _disaggAutoUpgraded = true;
    markManualSet('cluster-type');

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
    updateDisaggregatedUI(isDisagg);
    updateResiliencyOptions();
    updateResiliencyRecommendation();
    updateClusterInfo();
    enforceAldoMinimums();
    calculateRequirements();
}

// Handle disaggregated rack count change
function onDisaggRackCountChange() { // eslint-disable-line no-unused-vars
    markManualSet('disagg-rack-count');
    updateNodeOptionsForClusterType();
    updateDisaggregatedUI(true);
    calculateRequirements();
}

// Handle disaggregated storage type change
function onDisaggStorageTypeChange() { // eslint-disable-line no-unused-vars
    updateDisaggLegend();
    calculateRequirements();
}

// Update legend items for disaggregated vs rack-aware
function updateDisaggLegend() {
    const clusterType = document.getElementById('cluster-type').value;
    const isDisagg = clusterType === 'disaggregated';
    const storageType = (document.getElementById('disagg-storage-type') || {}).value || 'fc_san';
    const smbEl = document.getElementById('legend-smb-trunk');
    const lagEl = document.getElementById('legend-lag');
    const fcEl = document.getElementById('legend-fc-switch');
    const sanEl = document.getElementById('legend-san-appliance');
    if (smbEl) smbEl.style.display = isDisagg ? 'none' : '';
    if (lagEl) lagEl.style.display = isDisagg ? 'none' : '';
    if (fcEl) fcEl.style.display = (isDisagg && storageType === 'fc_san') ? '' : 'none';
    if (sanEl) sanEl.style.display = isDisagg ? '' : 'none';
}

// Show/hide disaggregated-specific UI and disable storage fields
function updateDisaggregatedUI(isDisagg) {
    // Show/hide rack count row
    const rackRow = document.getElementById('disagg-rack-count-row');
    if (rackRow) rackRow.style.display = isDisagg ? '' : 'none';

    // Show/hide storage type row
    const storageTypeRow = document.getElementById('disagg-storage-type-row');
    if (storageTypeRow) storageTypeRow.style.display = isDisagg ? '' : 'none';

    // Update legend for disaggregated
    updateDisaggLegend();

    // Storage section fields to disable
    const storageFieldIds = [
        'storage-config', 'storage-tiering',
        'capacity-disk-count', 'capacity-disk-size', 'repair-disk-count',
        'cache-disk-count', 'cache-disk-size',
        'tiered-capacity-disk-count', 'tiered-capacity-disk-size', 'tiered-repair-disk-count'
    ];
    const tooltip = isDisagg ? 'External SAN storage is used for workload storage requirements' : '';
    storageFieldIds.forEach(function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = isDisagg;
            el.title = tooltip;
            el.style.opacity = isDisagg ? '0.4' : '';
        }
    });

    // Storage capacity bar is always visible — styled differently for disaggregated in calculateRequirements()

    // Update HA/DR tip for disaggregated
    const hadrTip = document.getElementById('hadr-tip');
    if (hadrTip) {
        if (isDisagg) {
            hadrTip.querySelector('span').textContent = 'Disaggregated storage: compute machines use external SAN storage (Fibre Channel or iSCSI). Storage Spaces Direct is not used. Configure up to 4 racks with up to 16 machines each (64 machines maximum).';
        } else {
            hadrTip.querySelector('span').textContent = 'Tip: For business or mission-critical workloads, it is recommended to implement two separate Azure Local instances, to enable workload HA/DR capabilities between two locations, or consider a Rack-Aware Cluster Deployment Type.';
        }
    }
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
    if (clusterType === 'rack-aware' || clusterType === 'single' || clusterType === 'aldo-mgmt' || clusterType === 'disaggregated') {
        // Rack-aware, single-node, ALDO management, and disaggregated require all-flash (or external SAN)
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
    // Show warning only for standard clusters with 3+ nodes that chose 2-way mirror
    el.style.display = (clusterType === 'standard' && nodeCount >= 3 && resiliency === '2way') ? 'flex' : 'none';
}

// Update a label's visible text without wiping any child elements (e.g. the
// MANUAL / AUTO-SCALED badge spans appended by markManualSet / markAutoScaled).
// label.textContent = '...' would destroy those badges; this only touches the
// leading text node.
function _setLabelText(label, newText) {
    if (!label) return;
    for (let i = 0; i < label.childNodes.length; i++) {
        if (label.childNodes[i].nodeType === Node.TEXT_NODE) {
            label.childNodes[i].textContent = newText;
            return;
        }
    }
    label.insertBefore(document.createTextNode(newText), label.firstChild);
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
        nodeSelect.innerHTML = '<option value="3">3 Machines (ALDO Management)</option>';
        nodeSelect.value = 3;
        nodeSelect.disabled = true;
    } else if (clusterType === 'rack-aware') {
        // Rack-aware: only 2, 4, 6, 8 nodes (even numbers for balanced rack distribution)
        nodeSelect.disabled = false;
        const nodeOptions = [2, 4, 6, 8];
        nodeSelect.innerHTML = nodeOptions.map(n => {
            let label = `${n} Machines`;
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
    } else if (clusterType === 'disaggregated') {
        // Disaggregated: nodes per rack, label shows "per rack".
        // Per-rack maximum matches the Designer: min(16, floor(64 / rackCount))
        // so total nodes stay within the 64-node cluster cap across 1–8 racks.
        nodeSelect.disabled = false;
        const rackCountEl = document.getElementById('disagg-rack-count');
        const rackCount = rackCountEl ? parseInt(rackCountEl.value) || 2 : 2;
        const maxPerRack = getDisaggMaxNodesPerRack(rackCount);
        const nodeOptions = [];
        for (let n = 1; n <= maxPerRack; n++) nodeOptions.push(n);
        nodeSelect.innerHTML = nodeOptions.map(function(n) {
            const total = n * rackCount;
            return '<option value="' + total + '">' + n + ' Nodes per Rack (' + total + ' total)</option>';
        }).join('');
        // Preserve closest valid value
        let closestTotal = Math.min(Math.max(currentValue, rackCount), maxPerRack * rackCount);
        // Snap to a multiple of rackCount
        closestTotal = Math.round(closestTotal / rackCount) * rackCount;
        if (closestTotal < rackCount) closestTotal = rackCount;
        if (closestTotal > maxPerRack * rackCount) closestTotal = maxPerRack * rackCount;
        nodeSelect.value = closestTotal;
        // If exact match not found, pick closest
        if (!nodeSelect.value || nodeSelect.selectedIndex < 0) {
            nodeSelect.selectedIndex = 0;
        }
        // Update label to say "Physical Machines per Rack"
        const nodeLabel = document.querySelector('label[for="node-count"]');
        _setLabelText(nodeLabel, 'Physical Machines per Rack');
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

    // Reset node label back to default for non-disaggregated types
    if (clusterType !== 'disaggregated') {
        const nodeLabel = document.querySelector('label[for="node-count"]');
        _setLabelText(nodeLabel, 'Number of Physical Machines');
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
    } else if (clusterType === 'disaggregated') {
        // Disaggregated: external SAN storage — no S2D resiliency applies
        options = `
            <option value="external">External SAN Storage (resiliency managed by SAN)</option>
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
            <option value="2way">Two-way Mirror (50% efficiency)</option>
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
        message = `Warning: Three-way Mirror requires minimum ${config.minNodes} fault domains (machines). Current configuration has only ${nodeCount} machine${nodeCount === 1 ? '' : 's'}.`;
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
        tipText.textContent = 'Tip: Single Machine instances will always incur workload downtime during updates. No N+1 capacity is available.';
    } else if (clusterType === 'aldo-mgmt') {
        tipText.textContent = 'Tip: ALDO Management Cluster is fixed at 3 machines. N+1 capacity is reserved for maintenance (2 effective machines during servicing).';
    } else {
        tipText.textContent = 'Tip: Minimum N+1 capacity must be reserved for Compute and Memory when applying updates (ability to drain a machine). Single Machine instances will always incur workload downtime during updates.';
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
        case 'foundry':
            title.textContent = 'Add Foundry Local';
            body.innerHTML = getFoundryModalContent();
            break;
        case 'edgerag':
            title.textContent = 'Add Edge RAG';
            body.innerHTML = getEdgeRagModalContent();
            break;
        case 'videoindexer':
            title.textContent = 'Add Video Indexer enabled by Arc';
            body.innerHTML = getVideoIndexerModalContent();
            break;
        case 'ghel':
            title.textContent = 'Add GitHub Enterprise Local (Preview)';
            body.innerHTML = getGhelModalContent();
            updateGhelTierDescription();
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
        <div style="margin-bottom: 16px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
            <span style="margin-right: 4px;">\uD83D\uDCD6</span>
            <a href="https://learn.microsoft.com/azure/azure-local/manage/azure-arc-vm-management-overview#limitations-of-azure-local-vm-management" target="_blank" style="color: var(--link-color);">Azure Local VM management - Overview &amp; limitations</a>
        </div>
        <div class="form-group">
            <label>Input Mode
                <span class="info-icon" title="Per VM: specify resources per VM and multiply by count. Total: enter aggregate vCPU, memory, and storage totals directly.">ⓘ</span>
            </label>
            <select id="vm-input-mode" onchange="toggleVMInputMode()">
                <option value="per-vm" selected>Per VM Requirements</option>
                <option value="total">Total VM Requirements</option>
            </select>
        </div>
        <div class="form-group">
            <label>Workload Name</label>
            <input type="text" id="workload-name" value="${defaults.name}" placeholder="e.g., Production VMs">
        </div>
        <div id="vm-count-group" class="form-group">
            <label>Number of VMs</label>
            <input type="number" id="vm-count" value="${defaults.count}" min="1" max="10000">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label id="vm-vcpus-label">vCPUs per VM</label>
                <input type="number" id="vm-vcpus" value="${defaults.vcpus}" min="1" max="10000">
            </div>
            <div class="form-group">
                <label id="vm-memory-label">Memory per VM (GB)</label>
                <input type="number" id="vm-memory" value="${defaults.memory}" min="1" max="65536">
            </div>
        </div>
        <div class="form-group">
            <label id="vm-storage-label">Storage per VM (GB)</label>
            <input type="number" id="vm-storage" value="${defaults.storage}" min="1" max="640000">
            <span class="hint" id="vm-storage-hint">Total disk capacity including OS</span>
        </div>
        ${getGpuRequirementFields('vm')}
    `;
}

// Toggle VM input mode between Per VM and Total
function toggleVMInputMode() {
    const mode = document.getElementById('vm-input-mode').value;
    const countGroup = document.getElementById('vm-count-group');
    const vcpusLabel = document.getElementById('vm-vcpus-label');
    const memoryLabel = document.getElementById('vm-memory-label');
    const storageLabel = document.getElementById('vm-storage-label');
    const storageHint = document.getElementById('vm-storage-hint');
    const gpuDdaLabel = document.getElementById('wl-gpu-dda-label');

    if (mode === 'total') {
        countGroup.style.display = 'none';
        vcpusLabel.textContent = 'Total vCPUs';
        memoryLabel.textContent = 'Total Memory (GB)';
        storageLabel.textContent = 'Total Storage (GB)';
        storageHint.textContent = 'Aggregate storage across all VMs';
        if (gpuDdaLabel) gpuDdaLabel.innerHTML = 'Total GPUs Required <span class="info-icon" title="Total number of physical GPUs needed for this workload (DDA).">ⓘ</span>';
    } else {
        countGroup.style.display = '';
        vcpusLabel.textContent = 'vCPUs per VM';
        memoryLabel.textContent = 'Memory per VM (GB)';
        storageLabel.textContent = 'Storage per VM (GB)';
        storageHint.textContent = 'Total disk capacity including OS';
        if (gpuDdaLabel) gpuDdaLabel.innerHTML = 'GPUs per VM/Unit <span class="info-icon" title="Number of physical GPUs assigned via DDA to each VM or workload unit.">ⓘ</span>';
    }
}

// Get AKS modal content
function getAKSModalContent() {
    const defaults = WORKLOAD_DEFAULTS.aks;
    return `
        <div style="margin-bottom: 16px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
            <span style="margin-right: 4px;">\uD83D\uDCD6</span>
            <a href="https://learn.microsoft.com/en-us/azure/aks/aksarc/scale-requirements" target="_blank" style="color: var(--link-color);">AKS Arc on Azure Local - Scale requirements &amp; limits</a>
        </div>
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
        <div class="form-group">
            <label>OS Disk per Node (GB)</label>
            <input type="number" id="aks-cp-storage" value="200" disabled style="opacity: 0.5;" title="Fixed 200 GB dynamically expanding virtual hard disk per AKS Arc node (since Azure Local 2509)">
            <span class="hint">Fixed 200 GB dynamically expanding virtual hard disk — <a href="https://learn.microsoft.com/azure/aks/aksarc/scale-requirements#default-values-for-virtual-machine-sizes:~:text=the%20default%20OS%20disk%20size%20for%20VMs%20used%20as%20AKS%20Arc%20nodes%20is%20set%20to%20200%20GB" target="_blank" style="color: var(--link-color);">learn more</a></span>
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
                <label>Data Storage per Node (GB)
                    <span class="info-icon" title="Additional data disk capacity per worker node (on top of the fixed 200 GB OS disk).">&#9432;</span>
                </label>
                <input type="number" id="aks-worker-storage" value="${defaults.workerStorage}" min="0" max="4000">
            </div>
        </div>
        <div class="form-group" style="margin-top: 8px;">
            <label>OS Disk per Worker Node (GB)</label>
            <input type="number" value="200" disabled style="opacity: 0.5;" title="Fixed 200 GB dynamically expanding virtual hard disk per AKS Arc node (since Azure Local 2509)">
            <span class="hint">Fixed 200 GB dynamically expanding virtual hard disk — <a href="https://learn.microsoft.com/azure/aks/aksarc/scale-requirements#default-values-for-virtual-machine-sizes:~:text=the%20default%20OS%20disk%20size%20for%20VMs%20used%20as%20AKS%20Arc%20nodes%20is%20set%20to%20200%20GB" target="_blank" style="color: var(--link-color);">learn more</a></span>
        </div>
        ${getGpuRequirementFields('aks')}
    `;
}

// Get AVD modal content
function getAVDModalContent() {
    const defaults = WORKLOAD_DEFAULTS.avd;
    const medSpecs = AVD_PROFILES.medium.multi;
    const custSpecs = AVD_PROFILES.custom.multi;
    return `
        <div style="margin-bottom: 16px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
            <span style="margin-right: 4px;">\uD83D\uDCD6</span>
            <a href="https://learn.microsoft.com/azure/virtual-desktop/azure-local-overview#supported-deployment-configurations" target="_blank" style="color: var(--link-color);">Azure Virtual Desktop for Azure Local - Supported configurations</a>
        </div>
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
        ${getGpuRequirementFields('avd')}
    `;
}

// Get Foundry Local modal content
function getFoundryModalContent() {
    const defaults = WORKLOAD_DEFAULTS.foundry;
    const cls = FOUNDRY_MODEL_CLASSES[defaults.modelClass] || FOUNDRY_MODEL_CLASSES.medium;
    const customCls = FOUNDRY_MODEL_CLASSES.custom;
    return `
        <div style="margin-bottom: 12px; padding: 8px 12px; background: rgba(245, 158, 11, 0.12); border-left: 3px solid var(--accent-orange); border-radius: 6px; font-size: 12px; color: var(--text-secondary);">
            <strong style="color: var(--accent-orange);">Preview</strong> &mdash; Foundry Local on Azure Local is available by request during preview. <a href="https://aka.ms/FoundryLocalAzure_PreviewRequest" target="_blank" style="color: var(--link-color);">Request preview deployment access</a>.
        </div>
        <div style="margin-bottom: 16px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
            <div style="margin-bottom: 4px;"><span style="margin-right: 4px;">\uD83D\uDCD6</span><a href="https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/foundry-local/what-is-foundry-local-on-azure-local" target="_blank" style="color: var(--link-color);">What is Foundry Local on Azure Local?</a></div>
            <div style="margin-bottom: 4px;"><span style="margin-right: 4px;">\uD83D\uDCDA</span><a href="https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/azure-local/ai-workloads-overview" target="_blank" style="color: var(--link-color);">AI workloads on Azure Local (overview)</a></div>
            <div style="margin-bottom: 4px;"><span style="margin-right: 4px;">\uD83D\uDCE2</span><a href="https://aka.ms/build26blog" target="_blank" style="color: var(--link-color);">Build 2026: Foundry Local on Azure Local announcement</a></div>
            <div style="margin-bottom: 4px;"><span style="margin-right: 4px;">\uD83E\uDDE0</span><a href="https://aka.ms/FoundryLoca_Techcommunity_Build_blog" target="_blank" style="color: var(--link-color);">Multi-node inference, vLLM &amp; expanded model catalog</a></div>
            <div><span style="margin-right: 4px;">\uD83E\uDD16</span><a href="https://aka.ms/AgentsAndToolsBuildBlog2026" target="_blank" style="color: var(--link-color);">Agentic Retrieval, Knowledge &amp; Chat UI in Foundry Local</a></div>
        </div>
        <div class="form-group">
            <label>Workload Name</label>
            <input type="text" id="workload-name" value="${defaults.name}" placeholder="e.g., Production Foundry">
        </div>
        <div class="form-group">
            <label>Model Size Class
                <span class="info-icon" title="Pick the model size class. Sizing presets are conservative rules of thumb (model weights + KV cache + overhead). Validate with your OEM hardware partner and your actual model.">ⓘ</span>
            </label>
            <select id="foundry-model-class" onchange="updateFoundryClassDescription()">
                <option value="small">${FOUNDRY_MODEL_CLASSES.small.name} &mdash; ${FOUNDRY_MODEL_CLASSES.small.description}</option>
                <option value="medium" selected>${FOUNDRY_MODEL_CLASSES.medium.name} &mdash; ${FOUNDRY_MODEL_CLASSES.medium.description}</option>
                <option value="large">${FOUNDRY_MODEL_CLASSES.large.name} &mdash; ${FOUNDRY_MODEL_CLASSES.large.description}</option>
                <option value="custom">${FOUNDRY_MODEL_CLASSES.custom.name} &mdash; ${FOUNDRY_MODEL_CLASSES.custom.description}</option>
            </select>
            <span class="hint" id="foundry-class-desc">${cls.description}</span>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Number of Replicas
                    <span class="info-icon" title="Number of model deployment replicas (pods). Each replica handles a share of inference traffic.">ⓘ</span>
                </label>
                <input type="number" id="foundry-replicas" value="${defaults.replicas}" min="1" max="100">
            </div>
            <div class="form-group">
                <label>Inference Engine
                    <span class="info-icon" title="ONNX-GenAI runs on CPU or GPU. vLLM is GPU-only and provides higher-throughput batched inference.">ⓘ</span>
                </label>
                <select id="foundry-engine" onchange="onFoundryEngineChange()">
                    <option value="onnx-genai" selected>ONNX-GenAI (CPU or GPU — broadest compatibility)</option>
                    <option value="vllm">vLLM (GPU only — high-throughput batched, multi-user)</option>
                </select>
            </div>
        </div>
        <div id="foundry-custom-fields" style="display: none;">
            <div class="form-row">
                <div class="form-group">
                    <label>vCPUs per Replica</label>
                    <input type="number" id="foundry-custom-vcpus" value="${customCls.vcpus}" min="1" max="256">
                </div>
                <div class="form-group">
                    <label>Memory per Replica (GB)</label>
                    <input type="number" id="foundry-custom-memory" value="${customCls.memory}" min="1" max="2048">
                </div>
            </div>
            <div class="form-group">
                <label>Storage per Replica (GB)
                    <span class="info-icon" title="Disk space for model weights, KV cache and tokenizer artefacts. Excludes the fixed 200 GB AKS Arc OS disk per node.">ⓘ</span>
                </label>
                <input type="number" id="foundry-custom-storage" value="${customCls.storage}" min="5" max="2048">
            </div>
        </div>
        <div id="foundry-specs-panel" style="margin-top: 12px; padding: 14px; background: var(--subtle-bg); border-radius: 8px;">
            <h4 style="font-size: 13px; color: var(--text-secondary); margin-bottom: 10px;">Per-Replica Specifications</h4>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 12px;">
                <div>
                    <span style="color: var(--text-secondary);">vCPUs:</span>
                    <span id="foundry-spec-vcpus">${cls.vcpus}</span>
                </div>
                <div>
                    <span style="color: var(--text-secondary);">Memory:</span>
                    <span id="foundry-spec-memory">${cls.memory} GB</span>
                </div>
                <div>
                    <span style="color: var(--text-secondary);">Storage:</span>
                    <span id="foundry-spec-storage">${cls.storage} GB</span>
                </div>
            </div>
            <div style="margin-top: 8px; font-size: 11px; color: var(--text-secondary);">
                GPU: <span id="foundry-spec-gpu">${cls.recommendedGpu}</span>
            </div>
        </div>
        <div style="margin-top: 12px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 11px; color: var(--text-secondary);">
            <strong>Includes:</strong> ${FOUNDRY_CP_NODES}-node Kubernetes control plane (${FOUNDRY_CP_VCPU_PER_NODE} vCPU / ${FOUNDRY_CP_MEM_PER_NODE} GB / ${FOUNDRY_OS_DISK_GB} GB OS each), N model deployment replicas (scheduled across cluster-wide GPU / CPU capacity for multi-node inference), and ${FOUNDRY_OPERATOR_VCPU} vCPU / ${FOUNDRY_OPERATOR_MEM_GB} GB inference operator overhead. Each replica also adds a fixed ${FOUNDRY_OS_DISK_GB} GB AKS Arc OS disk.
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: var(--text-secondary); font-style: italic;">
            Estimates only &mdash; actual sizing depends on the model, quantization, batch size and concurrent request load. Validate with your OEM hardware partner.
        </div>
        ${getGpuRequirementFields('foundry')}
    `;
}

// Update Foundry class description and per-replica specs panel when class changes
function updateFoundryClassDescription() {
    const classSelect = document.getElementById('foundry-model-class');
    if (!classSelect) return;
    const classId = classSelect.value;
    const cls = FOUNDRY_MODEL_CLASSES[classId] || FOUNDRY_MODEL_CLASSES.medium;
    const customFields = document.getElementById('foundry-custom-fields');
    const specsPanel = document.getElementById('foundry-specs-panel');
    const descEl = document.getElementById('foundry-class-desc');
    if (descEl) descEl.textContent = cls.description;
    if (classId === 'custom') {
        if (customFields) customFields.style.display = 'block';
        if (specsPanel) specsPanel.style.display = 'none';
    } else {
        if (customFields) customFields.style.display = 'none';
        if (specsPanel) specsPanel.style.display = 'block';
        const vcpusEl = document.getElementById('foundry-spec-vcpus');
        const memEl = document.getElementById('foundry-spec-memory');
        const storEl = document.getElementById('foundry-spec-storage');
        const gpuEl = document.getElementById('foundry-spec-gpu');
        if (vcpusEl) vcpusEl.textContent = cls.vcpus;
        if (memEl) memEl.textContent = cls.memory + ' GB';
        if (storEl) storEl.textContent = cls.storage + ' GB';
        if (gpuEl) gpuEl.textContent = cls.recommendedGpu;
    }
}

// When the Foundry inference engine changes, force GPU mode if vLLM is selected
function onFoundryEngineChange() {
    const engineEl = document.getElementById('foundry-engine');
    if (!engineEl) return;
    const gpuModeEl = document.getElementById('wl-gpu-mode');
    if (!gpuModeEl) return;
    if (engineEl.value === 'vllm') {
        // vLLM is GPU-only — switch to DDA if currently 'none'
        if (gpuModeEl.value === 'none') {
            gpuModeEl.value = 'dda';
            toggleWorkloadGpuFields();
        }
        // Disable the 'none' option to prevent users from un-selecting GPU
        const noneOpt = gpuModeEl.querySelector('option[value="none"]');
        if (noneOpt) noneOpt.disabled = true;
    } else {
        const noneOpt = gpuModeEl.querySelector('option[value="none"]');
        if (noneOpt) noneOpt.disabled = false;
    }
}

// Get Edge RAG modal content
function getEdgeRagModalContent() {
    const defaults = WORKLOAD_DEFAULTS.edgerag;
    return `
        <div style="margin-bottom: 12px; padding: 8px 12px; background: rgba(245, 158, 11, 0.12); border-left: 3px solid var(--accent-orange); border-radius: 6px; font-size: 12px; color: var(--text-secondary);">
            <strong style="color: var(--accent-orange);">Preview</strong> &mdash; Edge RAG Preview, enabled by Azure Arc, packages a turnkey Retrieval Augmented Generation pipeline (LLM + embeddings + vector DB) on AKS Arc.
        </div>
        <div style="margin-bottom: 16px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
            <span style="margin-right: 4px;">\uD83D\uDCD6</span>
            <a href="https://learn.microsoft.com/en-us/azure/azure-arc/edge-rag/overview?context=/azure/azure-sovereign-clouds/context/context" target="_blank" style="color: var(--link-color);">What is Edge RAG?</a>
            <span style="margin: 0 6px;">|</span>
            <a href="https://learn.microsoft.com/en-us/azure/azure-arc/edge-rag/requirements" target="_blank" style="color: var(--link-color);">Edge RAG requirements</a>
        </div>
        <div class="form-group">
            <label>Workload Name</label>
            <input type="text" id="workload-name" value="${defaults.name}" placeholder="e.g., Production Edge RAG">
        </div>
        <div class="form-group">
            <label>Compute Mode
                <span class="info-icon" title="GPU mode (recommended) deploys 4 GPU-enabled VMs (NC8_A2 / NC8_A16 — 8 vCPU / 32 GB / 1 GPU each). CPU mode deploys 4 CPU-only VMs (8 vCPU / 32 GB each); CPU mode supports smaller files (≤5 MB) and slower retrieval.">ⓘ</span>
            </label>
            <select id="edgerag-compute-mode" onchange="updateEdgeRagComputeMode()">
                <option value="gpu" selected>GPU mode (recommended) &mdash; 4 \u00d7 GPU-enabled VMs</option>
                <option value="cpu">CPU mode &mdash; 4 \u00d7 CPU-only VMs (≤ 5 MB per file)</option>
            </select>
            <span class="hint" id="edgerag-mode-desc">GPU mode: 4 \u00d7 NC8_A2 / NC8_A16 worker VMs (8 vCPU, 32 GB, 1 GPU each). Larger documents (≤ 30 MB), faster ingestion and retrieval.</span>
        </div>
        <div class="form-group">
            <label>Document Corpus Size (GB)
                <span class="info-icon" title="Total size of the on-premises documents (PDF, DOCX, TXT, MHTML, MD, JPG, PNG) you plan to ingest. Drives the vector-database storage estimate (chunks + embeddings + index ≈ 1.5 \u00d7 corpus).">ⓘ</span>
            </label>
            <input type="number" id="edgerag-corpus-gb" value="${defaults.corpusGB}" min="1" max="100000">
            <span class="hint">Vector DB storage \u2248 ${EDGERAG_VECTOR_DB_MULTIPLIER} \u00d7 corpus size (chunks + embeddings + index).</span>
        </div>
        <div style="margin-top: 12px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 11px; color: var(--text-secondary);">
            <strong>Includes:</strong> ${EDGERAG_CP_NODES}-node AKS Arc control plane (${EDGERAG_CP_VCPU_PER_NODE} vCPU / ${EDGERAG_CP_MEM_PER_NODE} GB / ${EDGERAG_OS_DISK_GB} GB OS each), ${EDGERAG_WORKER_NODES} \u00d7 worker VMs at ${EDGERAG_WORKER_VCPU_PER_NODE} vCPU / ${EDGERAG_WORKER_MEM_PER_NODE} GB / ${EDGERAG_OS_DISK_GB} GB OS each, vector DB storage, and ${EDGERAG_OPERATOR_VCPU} vCPU / ${EDGERAG_OPERATOR_MEM_GB} GB Edge RAG operator overhead.
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: var(--text-secondary); font-style: italic;">
            Estimates only &mdash; actual sizing depends on document mix, chunking strategy, embedding model, and concurrent query load. Validate with your OEM hardware partner.
        </div>
        ${getGpuRequirementFields('edgerag')}
    `;
}

// Update Edge RAG compute mode hint and force GPU mode on / off when switched
function updateEdgeRagComputeMode() {
    const modeEl = document.getElementById('edgerag-compute-mode');
    if (!modeEl) return;
    const descEl = document.getElementById('edgerag-mode-desc');
    const gpuModeEl = document.getElementById('wl-gpu-mode');
    if (modeEl.value === 'gpu') {
        if (descEl) descEl.textContent = 'GPU mode: 4 \u00d7 NC8_A2 / NC8_A16 worker VMs (8 vCPU, 32 GB, 1 GPU each). Larger documents (\u2264 30 MB), faster ingestion and retrieval.';
        if (gpuModeEl) {
            if (gpuModeEl.value === 'none') {
                gpuModeEl.value = 'dda';
                toggleWorkloadGpuFields();
            }
            const noneOpt = gpuModeEl.querySelector('option[value="none"]');
            if (noneOpt) noneOpt.disabled = true;
            // Default to 1 GPU per worker (4 total) if user hasn't customised
            const gpuCountEl = document.getElementById('wl-gpu-dda-count');
            if (gpuCountEl && (!gpuCountEl.value || gpuCountEl.value === '0')) {
                gpuCountEl.value = EDGERAG_WORKER_GPU_PER_NODE;
            }
        }
    } else {
        if (descEl) descEl.textContent = 'CPU mode: 4 \u00d7 D8s_v3-equivalent worker VMs (8 vCPU, 32 GB each). Smaller documents only (\u2264 5 MB), slower ingestion and retrieval.';
        if (gpuModeEl) {
            const noneOpt = gpuModeEl.querySelector('option[value="none"]');
            if (noneOpt) noneOpt.disabled = false;
            gpuModeEl.value = 'none';
            toggleWorkloadGpuFields();
        }
    }
}

// GitHub Enterprise Local (Preview) modal.
// Sizing is driven by the official GHES "Minimum recommended requirements"
// table (GHES 3.20 docs), selected via an active-seat-count tier dropdown.
// The basic HA toggle adds 1 replica (primary + 1). An optional Advanced
// section lets users override with up to 7 replicas (GitHub's documented
// maximum of 8 HA replicas per instance). Each additional replica is sized
// identically to the primary; GHES HA is active/passive so adding replicas
// adds resilience / read locality, not write throughput.
// All numbers and links here come from the public docs cited in the modal.
function getGhelModalContent() {
    const defaults = WORKLOAD_DEFAULTS.ghel;
    const tierOptions = Object.keys(GHEL_TIERS).map(function(key) {
        const t = GHEL_TIERS[key];
        const selected = key === defaults.tier ? ' selected' : '';
        return `<option value="${key}"${selected}>${t.name} &mdash; ${t.vcpus} vCPU / ${t.memory} GB RAM / ${(t.rootStorage + t.dataStorage)} GB total disk</option>`;
    }).join('');
    // Advanced replica-count options: 0 through 7 additional replicas
    // (GHES caps total HA replicas at 8 per instance).
    let advancedReplicaOptions = '<option value="">(use basic selection above)</option>';
    for (let r = 0; r <= 7; r++) {
        const label = r === 0 ? '0 replicas \u2014 single VM (no HA)'
            : r === 1 ? '1 replica (primary + 1)'
                : r === 7 ? '7 replicas (primary + 7) \u2014 GitHub max'
                    : r + ' replicas (primary + ' + r + ')';
        advancedReplicaOptions += '<option value="' + r + '">' + label + '</option>';
    }
    return `
        <div style="margin-bottom: 12px; padding: 8px 12px; background: rgba(245, 158, 11, 0.12); border-left: 3px solid var(--accent-orange); border-radius: 6px; font-size: 12px; color: var(--text-secondary);">
            <strong style="color: var(--accent-orange);">Public Preview</strong> &mdash; GitHub Enterprise Local (GHEL) delivers GitHub Enterprise Server (GHES) as a prebuilt VM image on Azure Local, so you can run source control, Actions CI/CD, Packages, and DevSecOps fully on-prem in sovereign or disconnected environments.
        </div>
        <div style="margin-bottom: 16px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
            <div style="margin-bottom: 6px;">
                <span style="margin-right: 4px;">\uD83D\uDCD6</span>
                <a href="https://aka.ms/GHEL" target="_blank" rel="noopener" style="color: var(--link-color);">GitHub Enterprise Local on Azure Local</a>
                <span style="margin: 0 6px;">|</span>
                <a href="https://docs.github.com/en/enterprise-server@latest/admin/monitoring-and-managing-your-instance/updating-the-virtual-machine-and-physical-resources/increasing-storage-capacity#minimum-recommended-requirements" target="_blank" rel="noopener" style="color: var(--link-color);">GHES minimum recommended requirements</a>
            </div>
            <div>
                <span style="margin-right: 4px;">\uD83D\uDCDD</span>
                <a href="https://forms.office.com/pages/responsepage.aspx?id=v4j5cvGGr0GRqy180BHbRw9dxZ_D1b1FnjqEPJdlIB5UQTUxRUhUWExXNFQzNFRRSUJDVDFTSkFINC4u&origin=lprLink&route=shorturl" target="_blank" rel="noopener" style="color: var(--link-color);">Prepare for public preview onboarding</a>
            </div>
        </div>
        <div class="form-group">
            <label>Workload Name</label>
            <input type="text" id="workload-name" value="${defaults.name}" placeholder="e.g., GitHub Enterprise Local (prod)">
        </div>
        <div class="form-group">
            <label>Active developer seats (sizing tier)
                <span class="info-icon" title="Pick the tier closest to your peak active-developer-seat count. Each tier maps to the vCPU / memory / root-disk / data-disk values published by GitHub in the GHES minimum recommended requirements table.">&#9432;</span>
            </label>
            <select id="ghel-tier" onchange="updateGhelTierDescription()">
                ${tierOptions}
            </select>
            <span class="hint" id="ghel-tier-desc"></span>
        </div>
        <div class="form-group">
            <label>GHES replica-based high availability
                <span class="info-icon" title="Adds a second GHEL VM with the same spec as the primary. GHES replicates data from the primary to the replica; on failover the replica is promoted. Doubles the vCPU / memory / storage footprint for this workload.">&#9432;</span>
            </label>
            <select id="ghel-ha" onchange="updateGhelTierDescription()">
                <option value="yes"${defaults.ha ? ' selected' : ''}>Yes &mdash; deploy 2 VMs (primary + replica)</option>
                <option value="no"${defaults.ha ? '' : ' selected'}>No &mdash; single VM (PoC / non-production)</option>
            </select>
            <span class="hint">Recommended for production resilience. Doubles the workload footprint.</span>
        </div>
        <details id="ghel-advanced-details" style="margin-top: 4px; margin-bottom: 12px; padding: 8px 12px; background: var(--subtle-bg); border-radius: 6px;">
            <summary style="cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text-secondary);">Advanced configuration</summary>
            <div class="form-group" style="margin-top: 10px; margin-bottom: 0;">
                <label>Number of HA replicas (override)
                    <span class="info-icon" title="Overrides the basic HA dropdown above. GitHub Enterprise Server supports up to 8 high availability replicas (passive HA, geo-replicas, and repository caches combined). Each replica is sized identically to the primary, so vCPU / memory / storage scales linearly with the replica count.">&#9432;</span>
                </label>
                <select id="ghel-replicas-advanced" onchange="updateGhelTierDescription()">
                    ${advancedReplicaOptions}
                </select>
                <span class="hint">When set, overrides the basic HA dropdown. Total footprint = (1 + replicas) &times; per-VM spec. Includes passive HA, geo-replicas, and repository caches.</span>
                <div style="margin-top: 10px; padding: 8px 10px; background: rgba(245, 158, 11, 0.08); border-left: 2px solid var(--accent-orange); border-radius: 4px; font-size: 11px; color: var(--text-secondary); line-height: 1.5;">
                    <strong style="color: var(--accent-orange);">Note:</strong> GHES HA is <em>active/passive</em> &mdash; additional replicas add resilience and read locality (geo / repo cache), <strong>not write throughput</strong>. Write performance remains limited to the primary appliance. See <a href="https://docs.github.com/en/enterprise-server@latest/admin/monitoring-and-managing-your-instance/configuring-high-availability/about-high-availability-configuration" target="_blank" rel="noopener" style="color: var(--link-color);">About high availability configuration (GHES 3.20)</a>.
                </div>
            </div>
        </details>
        <div id="ghel-spec-panel" style="margin-top: 12px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 11px; color: var(--text-secondary);">
            <!-- Populated by updateGhelTierDescription() -->
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: var(--text-secondary); font-style: italic;">
            Sizing tiers are taken directly from the GHES <a href="https://docs.github.com/en/enterprise-server@latest/admin/monitoring-and-managing-your-instance/updating-the-virtual-machine-and-physical-resources/increasing-storage-capacity#minimum-recommended-requirements" target="_blank" rel="noopener" style="color: var(--link-color);">minimum recommended requirements</a>. Actions logs / artifacts and Packages may require additional storage (Azure Blob Storage or S3-compatible object store) &mdash; not included in the on-cluster footprint above.
        </div>
    `;
}

// Read the effective replica count from the GHEL modal (Advanced override
// wins over basic HA dropdown). Returns an integer 0-7.
function getGhelReplicasFromModal() {
    const advEl = document.getElementById('ghel-replicas-advanced');
    if (advEl && advEl.value !== '') {
        const n = parseInt(advEl.value, 10);
        if (!isNaN(n) && n >= 0 && n <= 7) return n;
    }
    const haEl = document.getElementById('ghel-ha');
    return (haEl && haEl.value === 'yes') ? 1 : 0;
}

// Read the effective replica count from a saved workload (handles legacy
// w.ha boolean before w.replicas existed). Returns an integer 0-7.
function getGhelReplicasFromWorkload(w) {
    if (typeof w.replicas === 'number' && w.replicas >= 0 && w.replicas <= 7) {
        return w.replicas;
    }
    return w.ha ? 1 : 0;
}

// Update the live spec readout under the GHEL tier dropdown.
function updateGhelTierDescription() {
    const tierEl = document.getElementById('ghel-tier');
    const descEl = document.getElementById('ghel-tier-desc');
    const panel = document.getElementById('ghel-spec-panel');
    if (!tierEl || !panel) return;
    const tier = GHEL_TIERS[tierEl.value] || GHEL_TIERS['up-to-1000'];
    const replicas = getGhelReplicasFromModal();
    const vmCount = 1 + replicas;
    const totalVcpu = tier.vcpus * vmCount;
    const totalMem = tier.memory * vmCount;
    const totalStorage = (tier.rootStorage + tier.dataStorage) * vmCount;
    if (descEl) {
        descEl.textContent = tier.users + ' \u2014 ' + tier.vcpus + ' vCPU / ' + tier.memory + ' GB RAM per GHEL VM.';
    }
    const topology = replicas === 0 ? 'single VM (no HA)'
        : replicas === 1 ? 'primary + 1 replica (HA pair)'
            : 'primary + ' + replicas + ' replicas';
    panel.innerHTML =
        '<strong>Per GHEL VM:</strong> ' + tier.vcpus + ' vCPU \u00b7 ' + tier.memory + ' GB RAM \u00b7 ' +
        tier.rootStorage + ' GB root disk + ' + tier.dataStorage + ' GB data disk' +
        ' (' + (tier.rootStorage + tier.dataStorage) + ' GB total) \u00b7 ~' + tier.throughputMbps + ' Mbps network throughput.' +
        '<br><strong>This workload (' + vmCount + ' VM' + (vmCount > 1 ? 's' : '') + ', ' + topology + '):</strong> ' +
        totalVcpu + ' vCPU \u00b7 ' + totalMem + ' GB RAM \u00b7 ' + totalStorage + ' GB storage.';
}

// Get Video Indexer enabled by Arc modal content
function getVideoIndexerModalContent() {
    const defaults = WORKLOAD_DEFAULTS.videoindexer;
    return `
        <div style="margin-bottom: 12px; padding: 8px 12px; background: rgba(245, 158, 11, 0.12); border-left: 3px solid var(--accent-orange); border-radius: 6px; font-size: 12px; color: var(--text-secondary);">
            <strong style="color: var(--accent-orange);">Preview / gated</strong> &mdash; Azure AI Video Indexer enabled by Arc runs video and audio analysis (transcription, translation, OCR, object/scene detection, summarization with Phi) on AKS Arc. Subscription must be approved via the <a href="https://aka.ms/vi-register" target="_blank" style="color: var(--accent-orange);">gated services application form</a>.
        </div>
        <div style="margin-bottom: 16px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 12px; color: var(--text-secondary);">
            <span style="margin-right: 4px;">\uD83D\uDCD6</span>
            <a href="https://learn.microsoft.com/en-us/azure/azure-video-indexer/arc/azure-video-indexer-enabled-by-arc-overview?context=/azure/azure-sovereign-clouds/context/context" target="_blank" style="color: var(--link-color);">What is Video Indexer enabled by Arc?</a>
            <span style="margin: 0 6px;">|</span>
            <a href="https://learn.microsoft.com/en-us/azure/azure-video-indexer/arc/azure-video-indexer-enabled-by-arc-overview#minimum-hardware-requirements" target="_blank" style="color: var(--link-color);">Hardware requirements</a>
        </div>
        <div class="form-group">
            <label>Workload Name</label>
            <input type="text" id="workload-name" value="${defaults.name}" placeholder="e.g., Production Video Indexer">
        </div>
        <div class="form-group">
            <label>Configuration
                <span class="info-icon" title="Microsoft publishes two cluster-wide sizing tiers. Minimum: 1 worker node, 32 cores / 64 GB / 50 GB. Recommended: 2 worker nodes (HA), 64 cores / 256 GB / 100 GB total. Storage class must support ReadWriteMany (e.g. Azure Container Storage enabled by Arc).">ⓘ</span>
            </label>
            <select id="vi-configuration" onchange="updateVideoIndexerConfiguration()">
                <option value="recommended"${defaults.configuration === 'recommended' ? ' selected' : ''}>Recommended &mdash; ${VI_REC_WORKER_NODES} workers, ${VI_REC_VCPU} vCPU / ${VI_REC_MEM_GB} GB / ${VI_REC_STORAGE_GB} GB (HA)</option>
                <option value="minimum"${defaults.configuration === 'minimum' ? ' selected' : ''}>Minimum &mdash; ${VI_MIN_WORKER_NODES} worker, ${VI_MIN_VCPU} vCPU / ${VI_MIN_MEM_GB} GB / ${VI_MIN_STORAGE_GB} GB</option>
            </select>
            <span class="hint" id="vi-config-desc">Recommended: ${VI_REC_WORKER_NODES} worker nodes (HA), ${VI_REC_VCPU} cores / ${VI_REC_MEM_GB} GB / ${VI_REC_STORAGE_GB} GB cluster-wide. Storage class must support ReadWriteMany.</span>
        </div>
        <div style="margin-top: 12px; padding: 10px 12px; background: var(--subtle-bg); border-radius: 8px; font-size: 11px; color: var(--text-secondary);">
            <strong>Includes:</strong> ${VI_CP_NODES}-node AKS Arc control plane (${VI_CP_VCPU_PER_NODE} vCPU / ${VI_CP_MEM_PER_NODE} GB / ${VI_OS_DISK_GB} GB OS each), Video Indexer worker pool (${VI_OS_DISK_GB} GB OS per worker + cluster-wide PV storage), Phi language model (included for textual summarization), and ${VI_OPERATOR_VCPU} vCPU / ${VI_OPERATOR_MEM_GB} GB Video Indexer extension overhead.
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: var(--text-secondary); font-style: italic;">
            Estimates only &mdash; actual sizing depends on video volume, resolution, codecs, and concurrent indexing jobs. Volume performance (storage class) significantly affects indexing turnaround. Validate with your OEM hardware partner.
        </div>
        ${getGpuRequirementFields('videoindexer')}
    `;
}

// Update Video Indexer configuration hint when toggled
function updateVideoIndexerConfiguration() {
    const cfgEl = document.getElementById('vi-configuration');
    if (!cfgEl) return;
    const descEl = document.getElementById('vi-config-desc');
    if (!descEl) return;
    if (cfgEl.value === 'minimum') {
        descEl.textContent = `Minimum: ${VI_MIN_WORKER_NODES} worker node, ${VI_MIN_VCPU} cores / ${VI_MIN_MEM_GB} GB / ${VI_MIN_STORAGE_GB} GB cluster-wide. No HA — for development/evaluation.`;
    } else {
        descEl.textContent = `Recommended: ${VI_REC_WORKER_NODES} worker nodes (HA), ${VI_REC_VCPU} cores / ${VI_REC_MEM_GB} GB / ${VI_REC_STORAGE_GB} GB cluster-wide. Storage class must support ReadWriteMany.`;
    }
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

// Read GPU requirement fields from the workload modal
function readWorkloadGpuFields() {
    const modeEl = document.getElementById('wl-gpu-mode');
    const mode = modeEl ? modeEl.value : 'none';
    const result = { gpuMode: mode };
    if (mode === 'dda') {
        result.gpuDdaCount = parseInt(document.getElementById('wl-gpu-dda-count').value) || 1;
        // Store DDA model if present (VM/AVD)
        const ddaModelEl = document.getElementById('wl-gpu-dda-model');
        if (ddaModelEl && ddaModelEl.value) {
            result.gpuDdaModel = ddaModelEl.value;
        }
        // Store AKS GPU VM size if present
        const aksVmSizeEl = document.getElementById('wl-gpu-aks-vm-size');
        if (aksVmSizeEl && aksVmSizeEl.value) {
            result.aksGpuVmSize = aksVmSizeEl.value;
        }
    } else if (mode === 'gpu-p') {
        result.gpuPartition = document.getElementById('wl-gpu-p-partition').value || '1';
        const gpuPModelEl = document.getElementById('wl-gpu-p-model');
        if (gpuPModelEl && gpuPModelEl.value) {
            result.gpuPModel = gpuPModelEl.value;
        }
    }
    return result;
}

// Validate a workload object before it's added/saved. Returns null when the
// workload is valid, or `{ code, message }` describing the problem so the
// caller can surface it (the modal flow uses alert()).
//
// Factored as a pure-data helper (no DOM access) so unit tests can cover
// every branch without mocking the workload modal.
//
// Current rules:
//   - AKS Arc workloads with `gpuMode === 'dda'` MUST have an `aksGpuVmSize`
//     selected. The "GPU VM Size" dropdown can legitimately end up empty when
//     another workload has locked the cluster's GPU type to a model that has
//     no AKS Arc VM SKUs (e.g. A100, A40, H100), or when the user simply
//     forgot to pick one. Without this guard the worker-node sizing math
//     downstream would silently use the default vCPU/memory values from the
//     plain (non-GPU) AKS modal fields, mis-sizing the cluster.
//   - Foundry Local / Edge RAG / Video Indexer all run on AKS Arc node pools,
//     so when they use `gpuMode === 'dda'` the selected GPU model must be one
//     that AKS Arc supports (i.e. has at least one entry in AKS_GPU_VM_SIZES).
//     This catches the case where the GPU dropdown was filtered to zero items
//     by a homogeneous-GPU lock from another workload.
//   - Cross-workload homogeneous-GPU rule: an Azure Local cluster has one
//     GPU model installed in its nodes — every GPU-using workload must use
//     that same model. If the new workload's effective GPU type differs from
//     any *other* GPU-using workload's type, save is blocked. Backstops the
//     UI dropdown lock for the case where the AKS-supported filter removed
//     the locked GPU from the dropdown (e.g. VM with H100 + Foundry trying
//     to pick L40S would otherwise slip past the UI).
function validateWorkloadBeforeSave(workload, otherWorkloads) {
    if (!workload || typeof workload !== 'object') return null;
    if (workload.type === 'aks' && workload.gpuMode === 'dda' && !workload.aksGpuVmSize) {
        return {
            code: 'aks-dda-missing-vm-size',
            message:
                'Please select a GPU VM Size for the AKS GPU worker nodes.\n\n' +
                'AKS Arc requires a supported GPU VM SKU (for example Standard_NC16_L4_1) to run GPU-accelerated worker nodes via DDA. ' +
                'If the "GPU VM Size" dropdown is empty, the GPU model selected by another workload (such as A100, A40, or H100) is not currently supported by AKS Arc — choose a different GPU model on that workload, or set this cluster\'s GPU Mode to None.'
        };
    }
    // Foundry / Edge RAG / Video Indexer all run on AKS Arc — their DDA GPU
    // must be one that AKS Arc supports.
    if (workload.type !== 'aks' && isAksHostedWorkloadType(workload.type) &&
        workload.gpuMode === 'dda' && workload.gpuDdaModel) {
        const aksSupported = getAksSupportedGpuKeys();
        if (!aksSupported.has(workload.gpuDdaModel)) {
            const model = GPU_MODELS[workload.gpuDdaModel];
            const modelName = model ? model.name : workload.gpuDdaModel;
            const wlName = workloadTypeDisplayName(workload.type);
            return {
                code: 'aks-hosted-dda-unsupported-gpu',
                message:
                    'The selected GPU (' + modelName + ') is not supported on AKS Arc.\n\n' +
                    wlName + ' runs on AKS Arc node pools, which currently only support ' +
                    'T4, A2, A16, L4, L40, L40S, and RTX Pro 6000 via DDA. ' +
                    'Either select a different GPU model, or set this workload\'s GPU Mode to None.'
            };
        }
    }
    // Cross-workload homogeneous-GPU rule. Compare this workload's effective
    // GPU type against any other workload that already has a GPU configured.
    if (Array.isArray(otherWorkloads) && otherWorkloads.length > 0) {
        const myGpu = getWorkloadGpuType(workload);
        if (myGpu) {
            for (const ow of otherWorkloads) {
                const otherGpu = getWorkloadGpuType(ow);
                if (otherGpu && otherGpu !== myGpu) {
                    const myModel = GPU_MODELS[myGpu];
                    const otherModel = GPU_MODELS[otherGpu];
                    const myName = myModel ? myModel.name : myGpu;
                    const otherName = otherModel ? otherModel.name : otherGpu;
                    const otherWlName = workloadTypeDisplayName(ow.type) + (ow.name ? ' "' + ow.name + '"' : '');
                    return {
                        code: 'gpu-conflicts-with-locked-type',
                        message:
                            'GPU model conflict.\n\n' +
                            'Another workload (' + otherWlName + ') is already using ' + otherName + ', ' +
                            'but this workload is set to use ' + myName + '. ' +
                            'An Azure Local cluster installs one GPU model in its machines — every GPU-using workload must use the same model (homogeneous configuration).\n\n' +
                            'Either change this workload\'s GPU to ' + otherName + ', or remove the existing ' + otherName + ' workload first.'
                    };
                }
            }
        }
    }
    return null;
}

function addWorkload() {
    if (!currentModalType) return;

    const name = document.getElementById('workload-name').value;
    const workload = {
        id: editingWorkloadId || ++workloadIdCounter,
        type: currentModalType,
        name: name
    };

    switch (currentModalType) {
        case 'vm':
            workload.inputMode = document.getElementById('vm-input-mode').value || 'per-vm';
            workload.vcpus = parseInt(document.getElementById('vm-vcpus').value) || 4;
            workload.memory = parseInt(document.getElementById('vm-memory').value) || 16;
            workload.storage = parseInt(document.getElementById('vm-storage').value) || 100;
            workload.count = workload.inputMode === 'total' ? 1 : (parseInt(document.getElementById('vm-count').value) || 1);
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
        case 'foundry':
            workload.modelClass = document.getElementById('foundry-model-class').value || 'medium';
            workload.replicas = parseInt(document.getElementById('foundry-replicas').value) || 1;
            workload.engine = document.getElementById('foundry-engine').value || 'onnx-genai';
            if (workload.modelClass === 'custom') {
                workload.customVcpus = parseInt(document.getElementById('foundry-custom-vcpus').value) || 8;
                workload.customMemory = parseInt(document.getElementById('foundry-custom-memory').value) || 16;
                workload.customStorage = parseInt(document.getElementById('foundry-custom-storage').value) || 40;
            }
            break;
        case 'edgerag':
            workload.computeMode = document.getElementById('edgerag-compute-mode').value || 'gpu';
            workload.corpusGB = parseInt(document.getElementById('edgerag-corpus-gb').value) || 100;
            break;
        case 'videoindexer':
            workload.configuration = document.getElementById('vi-configuration').value || 'recommended';
            break;
        case 'ghel': {
            const tierKey = document.getElementById('ghel-tier').value || 'up-to-1000';
            workload.tier = GHEL_TIERS[tierKey] ? tierKey : 'up-to-1000';
            workload.replicas = getGhelReplicasFromModal();
            // Keep legacy boolean mirror in sync so older exports / Designer
            // round-trips continue to behave (ha == any replicas present).
            workload.ha = workload.replicas >= 1;
            break;
        }
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

    // Read GPU requirements (common to all workload types)
    const gpuFields = readWorkloadGpuFields();
    Object.assign(workload, gpuFields);

    // Pre-save validation (e.g. AKS+DDA requires a GPU VM size). Helper is
    // pure-data so it's also covered by unit tests in tests/index.html.
    // Pass other workloads (excluding the one being edited, if any) so the
    // cross-workload homogeneous-GPU rule can detect conflicts.
    const otherWorkloads = editingWorkloadId
        ? workloads.filter(w => w.id !== editingWorkloadId)
        : workloads;
    const validationError = validateWorkloadBeforeSave(workload, otherWorkloads);
    if (validationError) {
        alert(validationError.message);
        return;
    }

    // Auto-enable GPUs in hardware config if workload requires them
    if (workload.gpuMode && workload.gpuMode !== 'none') {
        const hwGpuCount = parseInt(document.getElementById('gpu-count').value) || 0;
        if (hwGpuCount === 0) {
            document.getElementById('gpu-count').value = '1';
            updateGpuTypeVisibility();
            const gpuTypeEl = document.getElementById('gpu-type');
            const gpuModel = gpuTypeEl ? GPU_MODELS[gpuTypeEl.value] : null;
            const gpuName = gpuModel ? gpuModel.name : 'default';
            alert(`GPU hardware has been automatically enabled in the Hardware Configuration (${gpuName}). The GPU count per machine and machine count will auto-scale to meet your workload demand.`);
        }
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
            if (w.inputMode === 'total') {
                document.getElementById('vm-input-mode').value = 'total';
                toggleVMInputMode();
            }
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
        case 'foundry':
            title.textContent = 'Edit Foundry Local';
            body.innerHTML = getFoundryModalContent();
            document.getElementById('workload-name').value = w.name;
            document.getElementById('foundry-model-class').value = w.modelClass || 'medium';
            document.getElementById('foundry-replicas').value = w.replicas || 1;
            document.getElementById('foundry-engine').value = w.engine || 'onnx-genai';
            updateFoundryClassDescription();
            if (w.modelClass === 'custom') {
                document.getElementById('foundry-custom-vcpus').value = w.customVcpus || 8;
                document.getElementById('foundry-custom-memory').value = w.customMemory || 16;
                document.getElementById('foundry-custom-storage').value = w.customStorage || 40;
            }
            // Apply vLLM constraint to GPU mode after restoring engine
            onFoundryEngineChange();
            break;
        case 'edgerag':
            title.textContent = 'Edit Edge RAG';
            body.innerHTML = getEdgeRagModalContent();
            document.getElementById('workload-name').value = w.name;
            document.getElementById('edgerag-compute-mode').value = w.computeMode || 'gpu';
            document.getElementById('edgerag-corpus-gb').value = w.corpusGB || 100;
            // Apply GPU/CPU mode constraint after restoring compute mode
            updateEdgeRagComputeMode();
            break;
        case 'videoindexer':
            title.textContent = 'Edit Video Indexer enabled by Arc';
            body.innerHTML = getVideoIndexerModalContent();
            document.getElementById('workload-name').value = w.name;
            document.getElementById('vi-configuration').value = w.configuration || 'recommended';
            updateVideoIndexerConfiguration();
            break;
        case 'ghel': {
            title.textContent = 'Edit GitHub Enterprise Local (Preview)';
            body.innerHTML = getGhelModalContent();
            document.getElementById('workload-name').value = w.name;
            const tierKey = GHEL_TIERS[w.tier] ? w.tier : 'up-to-1000';
            document.getElementById('ghel-tier').value = tierKey;
            const replicas = getGhelReplicasFromWorkload(w);
            const advEl = document.getElementById('ghel-replicas-advanced');
            const haEl = document.getElementById('ghel-ha');
            if (replicas <= 1) {
                // Representable by the basic dropdown.
                if (haEl) haEl.value = replicas === 1 ? 'yes' : 'no';
                if (advEl) advEl.value = '';
            } else {
                // Needs the Advanced override; open the panel so it's visible.
                if (haEl) haEl.value = 'yes';
                if (advEl) advEl.value = String(replicas);
                const det = document.getElementById('ghel-advanced-details');
                if (det) det.open = true;
            }
            updateGhelTierDescription();
            break;
        }
    }

    // Restore GPU fields (common to all types)
    if (w.gpuMode && w.gpuMode !== 'none') {
        const gpuModeEl = document.getElementById('wl-gpu-mode');
        if (gpuModeEl) {
            gpuModeEl.value = w.gpuMode;
            toggleWorkloadGpuFields();
            if (w.gpuMode === 'dda' && w.gpuDdaCount) {
                // Restore DDA model first (VM/AVD), then count options
                if (w.gpuDdaModel) {
                    const ddaModelEl = document.getElementById('wl-gpu-dda-model');
                    if (ddaModelEl) {
                        ddaModelEl.value = w.gpuDdaModel;
                        populateDdaCountOptions();
                    }
                }
                document.getElementById('wl-gpu-dda-count').value = w.gpuDdaCount;
                // Restore AKS GPU VM size if present
                if (w.aksGpuVmSize) {
                    const aksVmSizeEl = document.getElementById('wl-gpu-aks-vm-size');
                    if (aksVmSizeEl) aksVmSizeEl.value = w.aksGpuVmSize;
                }
            } else if (w.gpuMode === 'gpu-p' && w.gpuPartition) {
                // Restore GPU-P model first, then partitions
                if (w.gpuPModel) {
                    const gpuPModelEl = document.getElementById('wl-gpu-p-model');
                    if (gpuPModelEl) {
                        gpuPModelEl.value = w.gpuPModel;
                        populateGpuPartitions();
                    }
                }
                document.getElementById('wl-gpu-p-partition').value = w.gpuPartition;
            }
        }
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
        updateHwGpuTypeLock();
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
                        ${w.gpuMode && w.gpuMode !== 'none' ? '<span style="font-size: 10px; background: #ca8a04; color: white; padding: 1px 6px; border-radius: 4px; margin-left: 6px; font-weight: 600;">GPU</span>' : ''}
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
    // Issue #230: when the list grows large (e.g. after an RVTools per-VM import),
    // cap its height and switch to a denser layout so it stays scannable.
    if (workloads.length > 5) {
        container.classList.add('compact');
    } else {
        container.classList.remove('compact');
    }
    updateHwGpuTypeLock();
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
        case 'foundry':
            return '<img src="../images/foundry-icon.png" alt="Foundry Local" width="20" height="20" style="vertical-align: middle;">';
        case 'edgerag':
            return '<img src="../images/edge-rag-icon.svg" alt="Edge RAG" width="20" height="20" style="vertical-align: middle;">';
        case 'videoindexer':
            return '<img src="../images/video-indexer-icon.svg" alt="Video Indexer" width="20" height="20" style="vertical-align: middle;">';
        case 'ghel':
            return '<img src="../images/github-logo.png" alt="GitHub Enterprise Local" width="20" height="20" style="vertical-align: middle;">';
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
        case 'foundry': return 'Foundry Local';
        case 'edgerag': return 'Edge RAG';
        case 'videoindexer': return 'AI Video Indexer';
        case 'ghel': return 'GitHub Enterprise Local';
        default: return '';
    }
}

// Get workload details string
function getWorkloadDetails(w) {
    let detail = '';
    switch (w.type) {
        case 'vm':
            if (w.inputMode === 'total') {
                detail = `Total: ${w.vcpus} vCPUs, ${w.memory} GB RAM, ${w.storage} GB storage`;
            } else {
                detail = `${w.count} VMs \u00d7 ${w.vcpus} vCPUs, ${w.memory} GB RAM, ${w.storage} GB storage`;
            }
            break;
        case 'aks': {
            const totalNodes = (w.controlPlaneNodes + w.workerNodes) * w.clusterCount;
            detail = `${w.clusterCount} cluster(s) × ${totalNodes / w.clusterCount} nodes each`;
            break;
        }
        case 'avd': {
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
            detail = avdDesc;
            break;
        }
        case 'foundry': {
            const fcls = FOUNDRY_MODEL_CLASSES[w.modelClass] || FOUNDRY_MODEL_CLASSES.medium;
            const className = w.modelClass === 'custom'
                ? `Custom (${w.customVcpus} vCPU / ${w.customMemory} GB / ${w.customStorage} GB per replica)`
                : fcls.name;
            const engineLabel = w.engine === 'vllm' ? 'vLLM' : 'ONNX-GenAI';
            detail = `${w.replicas || 1} replica${(w.replicas || 1) > 1 ? 's' : ''} \u2022 ${className} \u2022 ${engineLabel}`;
            break;
        }
        case 'edgerag': {
            const modeLabel = w.computeMode === 'cpu' ? 'CPU mode' : 'GPU mode';
            const corpus = w.corpusGB || 100;
            detail = `${EDGERAG_WORKER_NODES} worker VMs \u2022 ${modeLabel} \u2022 ${corpus} GB corpus`;
            break;
        }
        case 'videoindexer': {
            const isMin = w.configuration === 'minimum';
            const workers = isMin ? VI_MIN_WORKER_NODES : VI_REC_WORKER_NODES;
            const totVcpu = isMin ? VI_MIN_VCPU : VI_REC_VCPU;
            const totMem = isMin ? VI_MIN_MEM_GB : VI_REC_MEM_GB;
            detail = `${workers} worker${workers > 1 ? 's' : ''} \u2022 ${isMin ? 'Minimum' : 'Recommended'} \u2022 ${totVcpu} vCPU / ${totMem} GB cluster-wide`;
            break;
        }
        case 'ghel': {
            const ghelTier = GHEL_TIERS[w.tier] || GHEL_TIERS['up-to-1000'];
            const ghelReplicas = getGhelReplicasFromWorkload(w);
            const ghelVms = 1 + ghelReplicas;
            const ghelTopology = ghelReplicas === 0 ? '1 VM'
                : ghelReplicas === 1 ? '2 VMs (HA pair)'
                    : ghelVms + ' VMs (primary + ' + ghelReplicas + ' replicas)';
            detail = `${ghelTopology} \u2022 ${ghelTier.users} \u2022 ${ghelTier.vcpus} vCPU / ${ghelTier.memory} GB / ${(ghelTier.rootStorage + ghelTier.dataStorage)} GB per VM <a href="https://docs.github.com/en/enterprise-server@latest/admin/monitoring-and-managing-your-instance/updating-the-virtual-machine-and-physical-resources/increasing-storage-capacity#minimum-recommended-requirements" target="_blank" rel="noopener" style="color: var(--link-color); font-size: 11px; margin-left: 4px;" title="GitHub Enterprise Server: Minimum recommended requirements">(sizing info)</a>`;
            break;
        }
        default:
            return '';
    }
    // Append GPU info if configured
    if (w.gpuMode === 'dda') {
        const gpuCount = w.gpuDdaCount || 1;
        detail += ` \u2022 DDA ${gpuCount} GPU${gpuCount > 1 ? 's' : ''}/unit`;
        if (w.aksGpuVmSize) detail += ` (${w.aksGpuVmSize})`;
    } else if (w.gpuMode === 'gpu-p') {
        const partProfile = GPU_PARTITION_PROFILES.find(p => p.id === w.gpuPartition);
        detail += ` \u2022 GPU-P ${partProfile ? partProfile.label : w.gpuPartition}`;
    }
    return detail;
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
        case 'aks': {
            // Control plane requirements per cluster
            const cpVcpus = w.controlPlaneNodes * w.controlPlaneVcpus;
            const cpMemory = w.controlPlaneNodes * w.controlPlaneMemory;
            const AKS_OS_DISK_GB = 200; // Fixed OS disk size per AKS Arc node (since Azure Local 2509)
            const cpStorage = w.controlPlaneNodes * AKS_OS_DISK_GB;

            // Worker requirements per cluster
            const workerVcpus = w.workerNodes * w.workerVcpus;
            const workerMemory = w.workerNodes * w.workerMemory;
            const workerStorage = w.workerNodes * (AKS_OS_DISK_GB + w.workerStorage); // OS disk + data storage

            // Total for all clusters
            vcpus = (cpVcpus + workerVcpus) * w.clusterCount;
            memory = (cpMemory + workerMemory) * w.clusterCount;
            storage = (cpStorage + workerStorage) * w.clusterCount;
            break;
        }
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
        case 'foundry': {
            // Per-replica resources (model class preset OR custom override)
            let perReplicaVcpu, perReplicaMem, perReplicaStor;
            if (w.modelClass === 'custom') {
                perReplicaVcpu = w.customVcpus || 8;
                perReplicaMem = w.customMemory || 16;
                perReplicaStor = w.customStorage || 40;
            } else {
                const cls = FOUNDRY_MODEL_CLASSES[w.modelClass] || FOUNDRY_MODEL_CLASSES.medium;
                perReplicaVcpu = cls.vcpus;
                perReplicaMem = cls.memory;
                perReplicaStor = cls.storage;
            }
            const replicas = w.replicas || 1;
            // Foundry runs on a 3-node Kubernetes control plane. Each model
            // replica = 1 worker node sized to the model class, plus the fixed
            // 200 GB AKS Arc OS disk (matching the AKS workload pattern).
            const cpVcpus = FOUNDRY_CP_NODES * FOUNDRY_CP_VCPU_PER_NODE;
            const cpMemory = FOUNDRY_CP_NODES * FOUNDRY_CP_MEM_PER_NODE;
            const cpStorage = FOUNDRY_CP_NODES * FOUNDRY_OS_DISK_GB;
            const workerVcpus = perReplicaVcpu * replicas;
            const workerMemory = perReplicaMem * replicas;
            const workerStorage = (FOUNDRY_OS_DISK_GB + perReplicaStor) * replicas;
            vcpus = cpVcpus + workerVcpus + FOUNDRY_OPERATOR_VCPU;
            memory = cpMemory + workerMemory + FOUNDRY_OPERATOR_MEM_GB;
            storage = cpStorage + workerStorage;
            break;
        }
        case 'edgerag': {
            // Edge RAG runs on a 3-node AKS Arc control plane plus a fixed
            // 4-VM worker pool. Per Microsoft's published minimum requirements:
            //   GPU mode: 4 \u00d7 NC8_A2/NC8_A16 (8 vCPU / 32 GB / 1 GPU)
            //   CPU mode: 4 \u00d7 D8s_v3-equivalent (8 vCPU / 32 GB)
            // Vector DB storage is estimated as corpus \u00d7 EDGERAG_VECTOR_DB_MULTIPLIER.
            const cpVcpus = EDGERAG_CP_NODES * EDGERAG_CP_VCPU_PER_NODE;
            const cpMemory = EDGERAG_CP_NODES * EDGERAG_CP_MEM_PER_NODE;
            const cpStorage = EDGERAG_CP_NODES * EDGERAG_OS_DISK_GB;
            const workerVcpus = EDGERAG_WORKER_NODES * EDGERAG_WORKER_VCPU_PER_NODE;
            const workerMemory = EDGERAG_WORKER_NODES * EDGERAG_WORKER_MEM_PER_NODE;
            const workerStorageOs = EDGERAG_WORKER_NODES * EDGERAG_OS_DISK_GB;
            const corpusGB = w.corpusGB || 100;
            const vectorDbStorage = Math.ceil(corpusGB * EDGERAG_VECTOR_DB_MULTIPLIER);
            vcpus = cpVcpus + workerVcpus + EDGERAG_OPERATOR_VCPU;
            memory = cpMemory + workerMemory + EDGERAG_OPERATOR_MEM_GB;
            storage = cpStorage + workerStorageOs + vectorDbStorage;
            break;
        }
        case 'videoindexer': {
            // Video Indexer enabled by Arc runs on a 3-node AKS Arc control
            // plane plus a worker pool sized per Microsoft's published
            // minimum hardware requirements (cluster-wide totals):
            //   Minimum:     1 worker, 32 vCPU / 64 GB / 50 GB PV storage
            //   Recommended: 2 workers (HA), 64 vCPU / 256 GB / 100 GB PV
            const isMin = w.configuration === 'minimum';
            const workerNodes = isMin ? VI_MIN_WORKER_NODES : VI_REC_WORKER_NODES;
            const workerVcpus = isMin ? VI_MIN_VCPU : VI_REC_VCPU;
            const workerMemory = isMin ? VI_MIN_MEM_GB : VI_REC_MEM_GB;
            const pvStorage = isMin ? VI_MIN_STORAGE_GB : VI_REC_STORAGE_GB;
            const cpVcpus = VI_CP_NODES * VI_CP_VCPU_PER_NODE;
            const cpMemory = VI_CP_NODES * VI_CP_MEM_PER_NODE;
            const cpStorage = VI_CP_NODES * VI_OS_DISK_GB;
            const workerStorageOs = workerNodes * VI_OS_DISK_GB;
            vcpus = cpVcpus + workerVcpus + VI_OPERATOR_VCPU;
            memory = cpMemory + workerMemory + VI_OPERATOR_MEM_GB;
            storage = cpStorage + workerStorageOs + pvStorage;
            break;
        }
        case 'ghel': {
            // GHEL = GHES VM(s) sized from the "Minimum recommended
            // requirements" table. 1 primary + 0-7 replicas (GitHub caps
            // total HA replicas at 8). Each replica is sized identically
            // to the primary; HA is active/passive so adding replicas does
            // not add write throughput.
            const ghelTier = GHEL_TIERS[w.tier] || GHEL_TIERS['up-to-1000'];
            const vmCount = 1 + getGhelReplicasFromWorkload(w);
            vcpus = ghelTier.vcpus * vmCount;
            memory = ghelTier.memory * vmCount;
            storage = (ghelTier.rootStorage + ghelTier.dataStorage) * vmCount;
            break;
        }
    }

    // Calculate GPU requirements
    let gpus = 0; // In units of whole physical GPUs
    if (w.gpuMode === 'dda') {
        const ddaCount = w.gpuDdaCount || 1;
        switch (w.type) {
            case 'vm':
                gpus = ddaCount * w.count;
                break;
            case 'aks':
                // DDA GPUs per worker node × worker nodes × clusters
                gpus = ddaCount * w.workerNodes * w.clusterCount;
                break;
            case 'avd':
                // DDA GPUs per session host (approximation: concurrent users, 1 GPU per session host)
                gpus = ddaCount * (w.sessionType === 'single'
                    ? w.userCount
                    : Math.ceil(w.userCount * ((w.concurrency || 100) / 100)));
                break;
            case 'foundry':
                // DDA GPUs per replica × replicas (one model pod per worker node)
                gpus = ddaCount * (w.replicas || 1);
                break;
            case 'edgerag':
                // Edge RAG GPU mode: ddaCount GPUs per worker × 4 worker nodes
                // (CPU mode never reaches this branch because gpuMode='none')
                gpus = ddaCount * EDGERAG_WORKER_NODES;
                break;
            case 'videoindexer':
                // Video Indexer GPU is optional (BYO model). ddaCount GPUs per
                // worker × worker nodes (1 minimum, 2 recommended).
                gpus = ddaCount * (w.configuration === 'minimum' ? VI_MIN_WORKER_NODES : VI_REC_WORKER_NODES);
                break;
        }
    } else if (w.gpuMode === 'gpu-p') {
        const partProfile = GPU_PARTITION_PROFILES.find(p => p.id === w.gpuPartition);
        const fraction = partProfile ? partProfile.fraction : 1;
        switch (w.type) {
            case 'vm':
                gpus = fraction * w.count;
                break;
            case 'avd': {
                const concUsers = w.sessionType === 'single'
                    ? w.userCount
                    : Math.ceil(w.userCount * ((w.concurrency || 100) / 100));
                gpus = fraction * concUsers;
                break;
            }
        }
    }

    return { vcpus, memory, storage, gpus };
}

// Calculate all requirements
function calculateRequirements(options) {
    if (isCalculating) return;
    isCalculating = true;
    const skipAutoNodeRecommend = _nodeCountUserSet || (options && options.skipAutoNodeRecommend);

    try {
        // Sum all workload requirements (raw, before growth)
        let totalVcpus = 0, totalMemory = 0, totalStorage = 0, totalGpus = 0;

        workloads.forEach(w => {
            const reqs = calculateWorkloadRequirements(w);
            totalVcpus += reqs.vcpus;
            totalMemory += reqs.memory;
            totalStorage += reqs.storage;
            totalGpus += reqs.gpus || 0;
        });

        // Apply future growth factor
        const growthFactor = getGrowthFactor();
        // Stash raw (pre-growth) workload totals for the Capacity Runway
        // projection, which compounds growth year-by-year off of "Now".
        const rawTotalVcpus = totalVcpus;
        const rawTotalMemory = totalMemory;
        const rawTotalStorage = totalStorage;
        const rawTotalGpus = totalGpus;
        totalVcpus = Math.ceil(totalVcpus * growthFactor);
        totalMemory = Math.ceil(totalMemory * growthFactor);
        totalStorage = Math.ceil(totalStorage * growthFactor);
        totalGpus = Math.ceil(totalGpus * growthFactor);

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
                    maxHwConfig, resiliencyMultiplier, resiliency, totalGpus
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
                    maxHwConfig, resiliencyMultiplier, resiliency, totalGpus
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

        // future-growth has no auto-scaler that re-applies its AUTO badge inside
        // this cycle, so restore it here whenever the user hasn't manually set it.
        if (!_manualFields.has('future-growth')) {
            markAutoScaled('future-growth');
        }

        // disagg-rack-count auto-scaler only fires inside the `if (!conservativeSuccess)`
        // branch below — on a follow-up calc where conservative now succeeds at the bumped
        // rack count, the branch doesn't re-fire and the AUTO badge would disappear. Re-apply
        // it here when it was set by a prior cycle and the user still hasn't pinned it.
        if (previouslyAutoScaled.has('disagg-rack-count') && !_manualFields.has('disagg-rack-count')) {
            markAutoScaled('disagg-rack-count');
        }

        // cluster-type auto-upgrade fires once (in the `!conservativeSuccess` branch below)
        // and then triggers a recursive calculateRequirements(); on that follow-up pass the
        // upgrade block doesn't re-fire (we're already disaggregated) so the AUTO badge would
        // disappear. Worse, the auto-downgrade block requires `_autoScaledFields.has('cluster-type')`
        // — if we don't re-apply it here, the downgrade can never see the badge and never fires
        // when a user later removes a manual override that was forcing the upgrade.
        if (previouslyAutoScaled.has('cluster-type') && !_manualFields.has('cluster-type')) {
            markAutoScaled('cluster-type');
        }

        // --- Auto-scale GPUs per node to meet GPU workload demand ---
        if (workloads.length > 0 && totalGpus > 0 && !_gpuCountUserSet) {
            const gpuCountEl = document.getElementById('gpu-count');
            const gpuTypeEl = document.getElementById('gpu-type');
            const currentGpuCount = parseInt(gpuCountEl.value) || 0;
            const gpuType = gpuTypeEl ? gpuTypeEl.value : 'a2';
            const gpuModel = GPU_MODELS[gpuType];
            const maxPerNode = gpuModel ? gpuModel.maxPerNode : 2;
            if (currentGpuCount > 0 && currentGpuCount < maxPerNode) {
                // Calculate needed GPUs per node: totalGpus / effectiveNodes, rounded up
                const effNodesForGpu = nodeCount > 1 ? nodeCount - 1 : 1;
                const neededPerNode = Math.ceil(totalGpus / effNodesForGpu);
                const targetPerNode = Math.min(neededPerNode, maxPerNode);
                if (targetPerNode > currentGpuCount) {
                    gpuCountEl.value = targetPerNode;
                    markAutoScaled('gpu-count');
                    updateGpuTypeVisibility();
                    hwConfig = getHardwareConfig();
                }
            }
        }

        // --- Auto-scale CPU cores, memory & disk count to avoid >100% capacity ---
        if (workloads.length > 0) {
            const hwChanged = autoScaleHardware(totalVcpus, totalMemory, totalStorage, nodeCount, resiliencyMultiplier, hwConfig, previouslyAutoScaled);
            if (hwChanged) {
                // Re-read hardware config with the updated dropdown values
                hwConfig = getHardwareConfig();

                // Re-run node recommendation with maxHwConfig so the message stays consistent
                const updatedRec = getRecommendedNodeCount(
                    totalVcpus, totalMemory, totalStorage,
                    maxHwConfig, resiliencyMultiplier, resiliency, totalGpus
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
                const disaggRackEl = document.getElementById('disagg-rack-count');
                const disaggRackCountForOpts = disaggRackEl ? (parseInt(disaggRackEl.value, 10) || 1) : 1;
                const nodeOptions = getConservativeNodeOptions(clusterType, disaggRackCountForOpts);
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

                    // Use the same host-reservation math as the capacity bars / banner
                    // (getHostCpuReservedCores + getHostMemoryReservedGB) so this loop's
                    // utilisation check agrees with the >90% warning. Previously this used a
                    // hardcoded 32 GB host overhead and didn't reserve host cores, so it
                    // stopped adding nodes at ~89% while the banner showed >90% (invalid).
                    const hostReservedCoresLoop = getHostCpuReservedCores(hwConfig, clusterType);
                    const availVcpus = Math.max(physCores - hostReservedCoresLoop, 0) * effNodes * vcpuToCore - ARB_VCPU_OVERHEAD;
                    const hostOverheadMemoryGBLoop = getHostMemoryReservedGB(hwConfig, clusterType);
                    const availMem = Math.max(memPerNode - hostOverheadMemoryGBLoop, 0) * effNodes - ARB_MEMORY_OVERHEAD_GB;
                    // Subtract Infrastructure_1 volume (256 GB usable) and S2D repair reservation from available storage
                    const s2dRepairTB = getS2dRepairReservedGB(nodeCount, rawGBPerNode > 0 ? (rawGBPerNode / (hwConfig.diskConfig.capacity.count || 1)) : 0) / 1024;
                    const availStorage = Math.max((rawTBPerNode * nodeCount) / resiliencyMultiplier - 0.25 - s2dRepairTB / resiliencyMultiplier, 0);

                    const cpuPct = availVcpus > 0 ? Math.round((totalVcpus / availVcpus) * 100) : 0;
                    const memPct = availMem > 0 ? Math.round((totalMemory / availMem) * 100) : 0;
                    const stoPct = availStorage > 0 ? Math.round(((totalStorage / 1000) / availStorage) * 100) : 0;

                    // GPU utilization check
                    const loopGpuPerNode = hwConfig.gpuCount || 0;
                    const availGpus = loopGpuPerNode * effNodes;
                    const gpuPct = (totalGpus > 0 && availGpus > 0) ? Math.round((totalGpus / availGpus) * 100) : 0;

                    if (cpuPct < UTIL_THRESHOLD && memPct < UTIL_THRESHOLD && stoPct < UTIL_THRESHOLD && gpuPct < UTIL_THRESHOLD) {
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
                    hwConfig, resiliencyMultiplier, resiliency, totalGpus
                );
                if (finalRec) {
                    // Override recommended with actual final node count so message matches dropdown
                    finalRec.recommended = nodeCount;
                    updateNodeRecommendation(finalRec);
                }

                // --- 2-node memory-density preference: prefer 3 nodes over high-DIMM 2-node ---
                // When the conservative pass lands on exactly 2 nodes but per-node memory has
                // climbed above NODE_WEIGHT_2NODE_MEMORY_DENSITY_THRESHOLD_GB (default 768 GB),
                // prefer a 3-node cluster instead. Rationale: 2 nodes only supports a 2-way
                // mirror (single fault domain after one node failure); a 3rd node unlocks
                // 3-way mirror and spreads memory across more (smaller, cheaper) DIMMs.
                // Only runs when conservative scaling already succeeded (no >=90% pressure),
                // user has not pinned the node count, and the cluster supports 3 nodes.
                if (conservativeSuccess && nodeCount === 2 && hwConfig.memoryGB > NODE_WEIGHT_2NODE_MEMORY_DENSITY_THRESHOLD_GB && nodeOptions.indexOf(3) !== -1) {
                    const savedNodeCount2 = nodeCount;
                    const savedHwConfig2 = hwConfig;
                    const savedMem2 = parseInt(document.getElementById('node-memory').value) || 512;
                    const savedResiliency2 = resiliency;
                    const savedResiliencyMultiplier2 = resiliencyMultiplier;

                    nodeCount = 3;
                    document.getElementById('node-count').value = nodeCount;
                    updateRepairDiskCountAuto();
                    updateResiliencyOptions();
                    updateClusterInfo();
                    resiliency = document.getElementById('resiliency').value;
                    resiliencyMultiplier = RESILIENCY_CONFIG[resiliency].multiplier;

                    // Re-run conservative auto-scale so per-node memory can drop now that
                    // the workload is spread across 3 nodes instead of 2.
                    autoScaleHardware(totalVcpus, totalMemory, totalStorage, nodeCount, resiliencyMultiplier, hwConfig, previouslyAutoScaled);
                    hwConfig = getHardwareConfig();

                    // Verify the 3-node solution stays under the 90% utilisation threshold
                    // across CPU / memory / storage / GPU. If anything is over, revert.
                    const effNodes3 = nodeCount - 1;
                    const vcpuToCore3 = getVcpuRatio();
                    const physCores3 = hwConfig.totalPhysicalCores || DEFAULT_PHYSICAL_CORES_PER_NODE;
                    const memPerNode3 = hwConfig.memoryGB || 512;
                    let rawGBPerNode3 = 0;
                    if (hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
                        rawGBPerNode3 = hwConfig.diskConfig.capacity.count * hwConfig.diskConfig.capacity.sizeGB;
                    }
                    const rawTBPerNode3 = (rawGBPerNode3 / 1024) || DEFAULT_RAW_TB_PER_NODE;
                    const hostReservedCores3 = getHostCpuReservedCores(hwConfig, clusterType);
                    const availVcpus3 = Math.max(physCores3 - hostReservedCores3, 0) * effNodes3 * vcpuToCore3 - ARB_VCPU_OVERHEAD;
                    const hostOverhead3 = getHostMemoryReservedGB(hwConfig, clusterType);
                    const availMem3 = Math.max(memPerNode3 - hostOverhead3, 0) * effNodes3 - ARB_MEMORY_OVERHEAD_GB;
                    const s2dRepair3TB = getS2dRepairReservedGB(nodeCount, rawGBPerNode3 > 0 ? (rawGBPerNode3 / (hwConfig.diskConfig.capacity.count || 1)) : 0) / 1024;
                    const availStorage3 = Math.max((rawTBPerNode3 * nodeCount) / resiliencyMultiplier - 0.25 - s2dRepair3TB / resiliencyMultiplier, 0);
                    const cpuPct3 = availVcpus3 > 0 ? Math.round((totalVcpus / availVcpus3) * 100) : 0;
                    const memPct3 = availMem3 > 0 ? Math.round((totalMemory / availMem3) * 100) : 0;
                    const stoPct3 = availStorage3 > 0 ? Math.round(((totalStorage / 1000) / availStorage3) * 100) : 0;
                    const gpuPerNode3 = hwConfig.gpuCount || 0;
                    const availGpus3 = gpuPerNode3 * effNodes3;
                    const gpuPct3 = (totalGpus > 0 && availGpus3 > 0) ? Math.round((totalGpus / availGpus3) * 100) : 0;

                    if (cpuPct3 >= UTIL_THRESHOLD || memPct3 >= UTIL_THRESHOLD || stoPct3 >= UTIL_THRESHOLD || gpuPct3 >= UTIL_THRESHOLD) {
                        // 3-node solution doesn't actually relieve pressure (e.g. resiliency
                        // jump from 2-way → 3-way mirror chewed up the storage saving) — revert.
                        nodeCount = savedNodeCount2;
                        document.getElementById('node-count').value = savedNodeCount2;
                        document.getElementById('node-memory').value = savedMem2;
                        hwConfig = savedHwConfig2;
                        resiliency = savedResiliency2;
                        resiliencyMultiplier = savedResiliencyMultiplier2;
                        updateResiliencyOptions();
                        document.getElementById('resiliency').value = savedResiliency2;
                        updateRepairDiskCountAuto();
                        updateClusterInfo();
                    } else {
                        // Accepted — refresh recommendation banner to reflect the new node count
                        markAutoScaled('node-count');
                        const memDensityRec = getRecommendedNodeCount(
                            totalVcpus, totalMemory, totalStorage,
                            hwConfig, resiliencyMultiplier, resiliency, totalGpus
                        );
                        if (memDensityRec) {
                            memDensityRec.recommended = nodeCount;
                            updateNodeRecommendation(memDensityRec);
                        }
                    }
                }

                // --- Auto-downgrade Disaggregated → Hyperconverged when workload now fits on HCI ---
                // Symmetric inverse of the disagg auto-upgrade block below: when the
                // conservative loop succeeded AND cluster-type was originally set by an
                // auto-upgrade (AUTO badge still on) AND the user hasn't manually pinned
                // it, drop back to standard HCI in one shot when the workload fits in
                // ≤ 12 nodes (16 × 0.80 headroom, matching shouldDowngradeFromDisaggregated).
                // Runs BEFORE the rack-shrink so we collapse e.g. 3-rack disagg → HCI in
                // one toast instead of three rack-shrink steps. _disaggAutoUpgraded is
                // reset to false so the upgrade path remains available if workloads grow.
                if (conservativeSuccess && clusterType === 'disaggregated'
                    && _autoScaledFields.has('cluster-type')
                    && !_manualFields.has('cluster-type')) {
                    // getRecommendedNodeCount() reads cluster-type from the DOM (for
                    // host-overhead calc and the SAN-skips-storage-nodes branch), so
                    // flip the DOM value temporarily to get an apples-to-apples HCI rec.
                    const ctElDown = document.getElementById('cluster-type');
                    const savedCt = ctElDown ? ctElDown.value : 'disaggregated';
                    if (ctElDown) ctElDown.value = 'standard';
                    const standardRec = getRecommendedNodeCount(
                        totalVcpus, totalMemory, totalStorage,
                        hwConfig, resiliencyMultiplier, resiliency, totalGpus
                    );
                    if (ctElDown) ctElDown.value = savedCt;
                    const downgradeDecision = shouldDowngradeFromDisaggregated(
                        standardRec ? standardRec.recommended : 0
                    );
                    if (downgradeDecision.downgrade) {
                        if (ctElDown) ctElDown.value = 'standard';
                        markAutoScaled('cluster-type');
                        _disaggAutoUpgraded = false;
                        // Restore rack-count default so a later re-upgrade starts from 2 racks
                        const rackElDown = document.getElementById('disagg-rack-count');
                        if (rackElDown) rackElDown.value = '2';
                        updateNodeOptionsForClusterType();
                        updateStorageForClusterType();
                        updateResiliencyOptions();
                        updateClusterInfo();
                        updateDisaggregatedUI(false);
                        _nodeCountUserSet = false;

                        // Defer the toast until AFTER the recursive recalc has
                        // settled the final node count — at this point
                        // `downgradeDecision.recommended` is the raw recommendation
                        // (e.g. 10) which the recalc then bumps up via the N+1
                        // maintenance-headroom auto-scale (typically to 13). Read
                        // the post-recalc value out of the DOM so the toast shows
                        // what the user actually sees in the dropdown.
                        isCalculating = false;
                        calculateRequirements();
                        const finalNodeEl = document.getElementById('node-count');
                        const finalNodeCount = finalNodeEl ? (parseInt(finalNodeEl.value, 10) || downgradeDecision.recommended) : downgradeDecision.recommended;
                        showSizerToast('Workload no longer exceeds hyperconverged capacity \u2014 automatically scaled back to Hyperconverged (' + finalNodeCount + (finalNodeCount === 1 ? ' machine' : ' machines') + ').', 'info');
                        return;
                    }
                }

                // --- Auto-shrink Disaggregated rack count when workload now fits at fewer ---
                // Symmetric inverse of the rack-scale-up block below: when the conservative
                // loop succeeded AND the rack-count was set by a prior auto-scale (badge
                // still AUTO) AND the user has not pinned it, drop one rack tier per recalc
                // if the workload comfortably fits at (curRacks - 1) with ≥20% headroom.
                // Single-step + 20% buffer prevent oscillation at the boundary.
                if (conservativeSuccess && clusterType === 'disaggregated'
                    && _autoScaledFields.has('disagg-rack-count')
                    && !_manualFields.has('disagg-rack-count')) {
                    const rackElShrink = document.getElementById('disagg-rack-count');
                    const curRacksShrink = rackElShrink ? (parseInt(rackElShrink.value, 10) || 1) : 1;
                    const disaggRecShrink = getRecommendedNodeCount(
                        totalVcpus, totalMemory, totalStorage,
                        hwConfig, resiliencyMultiplier, resiliency, totalGpus
                    );
                    const shrinkDecision = shouldAutoShrinkDisaggRacks(
                        curRacksShrink,
                        disaggRecShrink ? disaggRecShrink.recommended : 0
                    );
                    if (shrinkDecision.shrink) {
                        if (rackElShrink) rackElShrink.value = String(shrinkDecision.racks);
                        markAutoScaled('disagg-rack-count');
                        updateNodeOptionsForClusterType();
                        updateClusterInfo();
                        _nodeCountUserSet = false;

                        // Defer toast until after the recursive recalc settles
                        // the per-rack node count. The disaggregated `#node-count`
                        // dropdown value is the TOTAL machine count (not per-rack),
                        // so read it directly.
                        isCalculating = false;
                        calculateRequirements();
                        const totalElS = document.getElementById('node-count');
                        const totalMachinesS = totalElS ? (parseInt(totalElS.value, 10) || 0) : 0;
                        const rackTextS = shrinkDecision.racks + (shrinkDecision.racks === 1 ? ' rack' : ' racks');
                        const machineTextS = totalMachinesS > 0
                            ? ' \u2014 ' + totalMachinesS + (totalMachinesS === 1 ? ' machine' : ' machines')
                            : '';
                        showSizerToast('Workload now fits comfortably \u2014 automatically scaled down to ' + rackTextS + machineTextS + '.', 'info');
                        return;
                    }
                }

                // --- Final aggressive pass: allow ratio escalation and high memory ---
                // Only run when the conservative node loop could NOT get all utilisation
                // below the 90% threshold (e.g. hit max nodes with util still over 90%).
                // When conservative scaling succeeded, skip this pass to avoid unnecessary
                // memory/ratio escalation (e.g. bumping from 2 TB to 3 TB for headroom).
                if (!conservativeSuccess) {

                    // --- Prefer disaggregated upgrade over aggressive memory/ratio escalation ---
                    // When we've hit the 16-node max on a standard cluster AND the disaggregated
                    // recommendation calls for more than 16 nodes, pivot to disaggregated before
                    // resorting to expensive 3-4 TB DIMMs or high ratios. If disaggregated would
                    // also land at ≤16 nodes, the SAN brings no extra capacity — stay HCI and let
                    // the aggressive memory/ratio escalation below fix the remaining utilisation.
                    if (clusterType === 'standard' && !_disaggAutoUpgraded) {
                        const disaggRec = getRecommendedNodeCount(
                            totalVcpus, totalMemory, totalStorage,
                            hwConfig, resiliencyMultiplier, resiliency, totalGpus
                        );
                        const upgradeDecision = shouldUpgradeToDisaggregated(
                            nodeCount, disaggRec ? disaggRec.recommended : 0
                        );
                        if (upgradeDecision.upgrade) {
                            const minRacks = upgradeDecision.racks;

                            _disaggAutoUpgraded = true;
                            document.getElementById('cluster-type').value = 'disaggregated';
                            markAutoScaled('cluster-type');
                            const rackEl = document.getElementById('disagg-rack-count');
                            if (rackEl) rackEl.value = String(minRacks);
                            updateNodeOptionsForClusterType();
                            updateStorageForClusterType();
                            updateResiliencyOptions();
                            updateClusterInfo();
                            updateDisaggregatedUI(true);
                            _nodeCountUserSet = false;

                            // Defer the toast until AFTER the recursive recalc
                            // has settled the per-rack node count — at this
                            // point `node-count` is still showing the pre-disagg
                            // standard value, but the recalc will rebuild the
                            // dropdown for disaggregated and then auto-scale up
                            // with N+1 maintenance headroom. The disaggregated
                            // `#node-count` options carry the TOTAL machine
                            // count as their value (e.g. value="22" with display
                            // text "11 Nodes per Rack (22 total)"), so read it
                            // directly — do NOT multiply by rackCount.
                            isCalculating = false;
                            calculateRequirements();
                            const totalEl = document.getElementById('node-count');
                            const totalMachines = totalEl ? (parseInt(totalEl.value, 10) || 0) : 0;
                            const rackText = minRacks + (minRacks === 1 ? ' rack' : ' racks');
                            const machineText = totalMachines > 0
                                ? ' \u2014 ' + totalMachines + (totalMachines === 1 ? ' machine' : ' machines')
                                : '';
                            showSizerToast('Workload exceeds 16-machine hyperconverged instance capacity \u2014 automatically upgraded to Disaggregated Storage (' + rackText + machineText + ').', 'info');
                            return;
                        }
                    }

                    // --- Auto-scale Disaggregated rack count when at per-rack cap ---
                    // Disaggregated supports 1–4 racks via the dropdown; when the conservative
                    // loop has hit (rackCount × 16) machines with utilisation still ≥ 90% AND
                    // the user has not manually pinned the rack count, bump rack count up
                    // (capped at 4) before resorting to aggressive memory/ratio escalation.
                    // We're inside `if (!conservativeSuccess)` so conservativeFailed is true —
                    // this is what makes the rack-scale path preferred over 3-4 TB DIMMs.
                    if (clusterType === 'disaggregated' && !_manualFields.has('disagg-rack-count')) {
                        const rackElAuto = document.getElementById('disagg-rack-count');
                        const curRacks = rackElAuto ? (parseInt(rackElAuto.value, 10) || 1) : 1;
                        const disaggRec = getRecommendedNodeCount(
                            totalVcpus, totalMemory, totalStorage,
                            hwConfig, resiliencyMultiplier, resiliency, totalGpus
                        );
                        const rackDecision = shouldAutoScaleDisaggRacks(
                            curRacks,
                            disaggRec ? disaggRec.recommended : 0,
                            true /* conservativeFailed */
                        );
                        if (rackDecision.scale) {
                            if (rackElAuto) rackElAuto.value = String(rackDecision.racks);
                            markAutoScaled('disagg-rack-count');
                            updateNodeOptionsForClusterType();
                            updateClusterInfo();
                            _nodeCountUserSet = false;

                            // Defer toast until after the recursive recalc
                            // settles the node count. The disaggregated
                            // `#node-count` dropdown value is the TOTAL machine
                            // count (not per-rack), so read it directly.
                            isCalculating = false;
                            calculateRequirements();
                            const totalElU = document.getElementById('node-count');
                            const totalMachinesU = totalElU ? (parseInt(totalElU.value, 10) || 0) : 0;
                            const rackTextU = rackDecision.racks + (rackDecision.racks === 1 ? ' rack' : ' racks');
                            const machineTextU = totalMachinesU > 0
                                ? ' \u2014 ' + totalMachinesU + (totalMachinesU === 1 ? ' machine' : ' machines')
                                : '';
                            showSizerToast('Disaggregated workload exceeds ' + (curRacks * 16) + '-machine capacity \u2014 automatically scaled to ' + rackTextU + machineTextU + '.', 'info');
                            return;
                        }
                    }

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

                            const dAvailVcpus = Math.max(dPhysCores - getHostCpuReservedCores(hwConfig, clusterType), 0) * dEffNodes * dVcpuToCore - ARB_VCPU_OVERHEAD;
                            const dHostOverhead = getHostMemoryReservedGB(hwConfig, clusterType);
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
                    hwConfig, resiliencyMultiplier, resiliency, totalGpus
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

        // Determine if disaggregated for storage display logic
        const isDisaggPerNode = document.getElementById('cluster-type').value === 'disaggregated';
        // SAN overhead: Infrastructure_1 (256 GB) + PerformanceHistory (20 GB), once per instance
        const sanInfraOverheadForDisplay = 0.27; // 0.25 + 0.02 TB
        const sanTotalTB = (totalStorage / 1000) + sanInfraOverheadForDisplay;

        // Update total requirement cards
        document.getElementById('total-vcpus').textContent = totalVcpus;
        document.getElementById('total-memory').textContent = totalMemory + ' GB';
        // For disaggregated, include infra volume overhead in total storage display
        const totalStorageDisplayTB = isDisaggPerNode ? sanTotalTB : (totalStorage / 1000);
        document.getElementById('total-storage').textContent = totalStorageDisplayTB.toFixed(2) + ' TB';
        document.getElementById('total-workloads').textContent = workloads.length;

        // Update per-node requirement cards
        document.getElementById('per-node-cores').textContent = perNodeCores || 0;
        document.getElementById('per-node-memory').textContent = (perNodeMemory || 0) + ' GB';

        // Reflect the current node count and vCPU overcommit ratio in the per-node heading
        const perNodeTitleEl = document.getElementById('per-node-title');
        if (perNodeTitleEl) {
            perNodeTitleEl.textContent = nodeCount + ' x Physical Machines Hardware Requirements:';
        }
        const perNodeSubtitleEl = document.getElementById('per-node-subtitle');
        if (perNodeSubtitleEl) {
            perNodeSubtitleEl.innerHTML = '- includes N+1 machines (for HA and update resiliency), compute uses a '
                + '<a href="#vcpu-ratio" class="per-node-ratio-link" '
                + 'onclick="document.getElementById(\'vcpu-ratio\').scrollIntoView({behavior:\'smooth\',block:\'center\'});'
                + 'document.getElementById(\'vcpu-ratio\').focus();return false;">'
                + getVcpuRatio() + ':1 vCPU overcommit ratio</a>';
        }

        // For disaggregated, show SAN storage requirement instead of per-node raw/usable
        const perNodeStorageLabel = document.getElementById('per-node-storage-label');
        const perNodeUsableLabel = document.getElementById('per-node-usable-label');
        const perNodeUsableSection = document.getElementById('per-node-usable-section');
        if (isDisaggPerNode) {
            if (perNodeStorageLabel) perNodeStorageLabel.textContent = 'SAN Storage Required (Total)';
            document.getElementById('per-node-storage').textContent = sanTotalTB.toFixed(2) + ' TB';
            if (perNodeUsableSection) perNodeUsableSection.style.display = 'none';
        } else {
            if (perNodeStorageLabel) perNodeStorageLabel.textContent = 'Raw Storage';
            if (perNodeUsableLabel) perNodeUsableLabel.textContent = 'Usable Storage';
            document.getElementById('per-node-storage').textContent = perNodeStorageRaw.toFixed(2) + ' TB';
            document.getElementById('per-node-usable').textContent = perNodeUsable.toFixed(2) + ' TB';
            if (perNodeUsableSection) perNodeUsableSection.style.display = '';
        }

        // --- Capacity bars from hardware config ---
        // Physical Nodes bar
        const clusterType = document.getElementById('cluster-type').value;
        let MAX_NODES;
        if (clusterType === 'disaggregated') {
            MAX_NODES = 64; // Always show max 64 for disaggregated (4 racks × 16 nodes)
        } else if (clusterType === 'rack-aware') {
            MAX_NODES = 8;
        } else if (clusterType === 'single') {
            MAX_NODES = 1;
        } else if (clusterType === 'aldo-mgmt') {
            MAX_NODES = 3;
        } else {
            MAX_NODES = 16;
        }
        const nodesPercent = Math.round((nodeCount / MAX_NODES) * 100);
        document.getElementById('nodes-count-label').textContent = nodeCount + ' / ' + MAX_NODES;
        document.getElementById('nodes-fill').style.width = nodesPercent + '%';
        const nodesBarLabel = document.getElementById('nodes-bar-label');
        if (nodesBarLabel) {
            if (clusterType === 'disaggregated') {
                nodesBarLabel.textContent = 'Azure Local disaggregated instance size';
            } else {
                nodesBarLabel.textContent = 'Azure Local hyperconverged instance size';
            }
        }
        const isDisaggregated = clusterType === 'disaggregated';
        const storageLabelEl = document.getElementById('total-storage-label');
        if (storageLabelEl) {
            storageLabelEl.textContent = isDisaggregated ? 'Storage (SAN usable) required:' : 'Storage (usable) required:';
        }

        const physicalCoresPerNode = hwConfig.totalPhysicalCores || DEFAULT_PHYSICAL_CORES_PER_NODE;
        const memoryPerNode = hwConfig.memoryGB || 512;

        let rawStoragePerNodeGB = 0;
        if (hwConfig.diskConfig.capacity) {
            rawStoragePerNodeGB = hwConfig.diskConfig.capacity.count * hwConfig.diskConfig.capacity.sizeGB;
        }
        const rawStoragePerNodeTB = rawStoragePerNodeGB / 1024 || DEFAULT_RAW_TB_PER_NODE;

        const hostReservedCores = getHostCpuReservedCores(hwConfig, clusterType);
        const totalAvailableVcpus = Math.max(physicalCoresPerNode - hostReservedCores, 0) * effectiveNodes * vcpuToCore - ARB_VCPU_OVERHEAD;
        const hostOverheadGB = getHostMemoryReservedGB(hwConfig, clusterType); // Azure Local host OS + management overhead per node (S2D-aware + ALDO appliance)
        const totalAvailableMemory = Math.max((memoryPerNode - hostOverheadGB), 0) * effectiveNodes - ARB_MEMORY_OVERHEAD_GB;
        // Infrastructure_1 volume: 256 GB usable reserved by Storage Spaces Direct on all clusters
        const infraVolumeUsableTB = 0.25; // 256 GB
        // S2D repair reservation: min(nodeCount, 4) capacity disks reserved from pool raw space
        const capacityDiskSizeGB = (hwConfig.diskConfig.capacity ? hwConfig.diskConfig.capacity.sizeGB : 0);
        const s2dRepairReservedTB = getS2dRepairReservedGB(nodeCount, capacityDiskSizeGB) / 1024;

        const totalAvailableStorage = isDisaggregated ? 0 : Math.max((rawStoragePerNodeTB * nodeCount) / resiliencyMultiplier - infraVolumeUsableTB - s2dRepairReservedTB / resiliencyMultiplier, 0);

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

        // Update storage bar label and style for disaggregated (SAN requirement, not utilization)
        const storageBarLabel = document.getElementById('storage-bar-label');
        if (isDisaggregated) {
            const sanStorageTBDisplay = sanTotalTB.toFixed(1);
            if (storageBarLabel) storageBarLabel.textContent = 'SAN Storage — Usable Capacity Required';
            document.getElementById('storage-percent').textContent = sanStorageTBDisplay + ' TB';
            document.getElementById('storage-fill').style.width = workloads.length > 0 ? '100%' : '0%';
            document.getElementById('storage-fill').className = 'breakdown-fill storage san-storage';
            document.getElementById('storage-used').textContent = sanStorageTBDisplay;
            document.getElementById('storage-total').textContent = 'External SAN';
        } else {
            if (storageBarLabel) storageBarLabel.textContent = 'Usable Storage - Consumed';
            document.getElementById('storage-fill').className = 'breakdown-fill storage';
        }

        // --- GPU Capacity Bar ---
        const gpuCountPerNode = hwConfig.gpuCount || 0;
        const gpuCapacitySection = document.getElementById('gpu-capacity-section');
        let gpuPercent = 0;
        if (gpuCountPerNode > 0 && totalGpus > 0) {
            // Available GPUs use N-1 effective nodes (resiliency — must be able to drain a node)
            const totalAvailableGpus = gpuCountPerNode * effectiveNodes;
            // Cap totalGpus at physical limit (growth factor cannot exceed physical hardware)
            const cappedGpus = Math.min(totalGpus, gpuCountPerNode * nodeCount);
            gpuPercent = Math.min(100, Math.round((cappedGpus / totalAvailableGpus) * 100)) || 0;
            document.getElementById('gpu-percent').textContent = gpuPercent + '%';
            document.getElementById('gpu-fill').style.width = gpuPercent + '%';
            document.getElementById('gpu-used').textContent = totalGpus % 1 === 0 ? totalGpus : totalGpus.toFixed(1);
            document.getElementById('gpu-total').textContent = totalAvailableGpus;
            document.getElementById('gpu-fill').classList.toggle('over-threshold', gpuPercent >= 90);
            if (gpuCapacitySection) gpuCapacitySection.style.display = '';
        } else {
            if (gpuCapacitySection) gpuCapacitySection.style.display = 'none';
            document.getElementById('gpu-percent').textContent = '0%';
            document.getElementById('gpu-fill').style.width = '0%';
            document.getElementById('gpu-used').textContent = '0';
            document.getElementById('gpu-total').textContent = '0';
        }

        // Toggle over-threshold (red) on any capacity bar >= 90%
        const UTILIZATION_THRESHOLD = 90;
        document.getElementById('compute-fill').classList.toggle('over-threshold', computePercent >= UTILIZATION_THRESHOLD);
        document.getElementById('memory-fill').classList.toggle('over-threshold', memoryPercent >= UTILIZATION_THRESHOLD);
        document.getElementById('storage-fill').classList.toggle('over-threshold', !isDisaggregated && storagePercent >= UTILIZATION_THRESHOLD);

        // Show/hide utilization warning banner (include GPU, exclude storage for disaggregated)
        const storageOverThreshold = !isDisaggregated && storagePercent >= UTILIZATION_THRESHOLD;
        const anyOverThreshold = (computePercent >= UTILIZATION_THRESHOLD || memoryPercent >= UTILIZATION_THRESHOLD || storageOverThreshold || (gpuCountPerNode > 0 && totalGpus > 0 && gpuPercent >= UTILIZATION_THRESHOLD)) && workloads.length > 0;
        const warningBanner = document.getElementById('capacity-utilization-warning');
        if (warningBanner) {
            warningBanner.style.display = anyOverThreshold ? 'flex' : 'none';
        }

        // Show/hide manual-override capacity warning
        updateManualOverrideWarning(computePercent, memoryPercent, isDisaggregated ? 0 : storagePercent);

        // --- Power & Rack Space Estimates ---
        updatePowerRackEstimates(nodeCount, hwConfig);

        // Update sizing notes
        updateSizingNotes(nodeCount, totalVcpus, totalMemory, totalStorage, resiliency, hwConfig, totalGpus, effectiveNodes);

        // Update capacity runway projection — passes RAW pre-growth totals so
        // the table can compound Year 1..5 off "Now" without round-tripping
        // through the already-grown totals (which caused drift bug #3).
        updateGrowthProjection(rawTotalVcpus, rawTotalMemory, rawTotalStorage, rawTotalGpus, hwConfig, effectiveNodes);

        // Auto-save state after every calculation (skip during initial page load)
        if (!isInitialLoad) {
            saveSizerState();
        }
    } finally {
        isCalculating = false;
    }
}

// Format an annual energy figure (in kWh) for display. Auto-scales to MWh/yr
// when the value reaches one million kWh (1 MWh = 1000 kWh) so the
// Multi-Instance Scale-Out summary doesn't read as e.g. "1,605,710 kWh/yr"
// when "1,605.7 MWh/yr" is clearer.
function formatAnnualEnergy(kwh) {
    if (kwh == null || !isFinite(kwh)) return '\u2014';
    if (kwh >= 1000000) {
        return (kwh / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' MWh/yr';
    }
    return Math.round(kwh).toLocaleString() + ' kWh/yr';
}

// Estimate power consumption and rack space per cluster
function updatePowerRackEstimates(nodeCount, hwConfig) {
    const section = document.getElementById('power-rack-section');
    if (!section) return;

    // Power & rack estimates are derived purely from hardware config + node count,
    // so we always show the section — even before any workload is added — to give
    // users an immediate read on the data-centre footprint of their hardware
    // selection. (3D rack visualization at the bottom likewise uses hwConfig.)

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

    // Motherboard, fans, NICs, BMC: ~100W baseline (excludes PSU efficiency loss)
    const baseOverheadW = 100;

    // Component power (DC) before PSU efficiency
    const componentPowerW = cpuPowerW + memPowerW + diskPowerW + osDiskPowerW + gpuPowerW + baseOverheadW;

    // PSU efficiency: 80 Plus Titanium at ~50% load ≈ 96% efficiency (17th gen 2U servers)
    // Wall power = component power / efficiency
    const psuEfficiency = 0.96;
    const perNodeW = Math.round(componentPowerW / psuEfficiency);
    const totalNodeW = perNodeW * nodeCount;

    // Network infrastructure power (switches, spine switches)
    let infraPowerW = 0;
    let infraPowerNote = '';
    const clusterType = document.getElementById('cluster-type').value;
    let drc, dst, spineCount, torSwitchPower, torCount, bmcSwitchPower, bmcCount, fcSwitchPower, fcCount, spineSwitchPower;
    if (clusterType === 'disaggregated') {
        drc = parseInt((document.getElementById('disagg-rack-count') || {}).value, 10) || 2;
        dst = (document.getElementById('disagg-storage-type') || {}).value || 'fc_san';
        spineCount = 2;
        // ToR/Leaf switches: ~250W each (Cisco 93180YC-FX class)
        torSwitchPower = 250;
        torCount = drc * 2;
        // BMC switches: ~150W each (Cisco 9348GC class)
        bmcSwitchPower = 150;
        bmcCount = drc;
        // FC switches: ~200W each (if FC SAN)
        fcSwitchPower = (dst === 'fc_san') ? 200 : 0;
        fcCount = (dst === 'fc_san') ? drc * 2 : 0;
        // Spine switches: ~350W each
        spineSwitchPower = 350;
        infraPowerW = (torCount * torSwitchPower) + (bmcCount * bmcSwitchPower) + (fcCount * fcSwitchPower) + (spineCount * spineSwitchPower);
        infraPowerNote = torCount + '× ToR (' + torSwitchPower + 'W), ' + bmcCount + '× BMC (' + bmcSwitchPower + 'W)';
        if (fcCount > 0) infraPowerNote += ', ' + fcCount + '× FC (' + fcSwitchPower + 'W)';
        infraPowerNote += ', ' + spineCount + '× Spine (' + spineSwitchPower + 'W)';
    } else if (nodeCount > 1) {
        // Standard HCI: 1 rack × (2 × ToR + 1 × BMC)
        // Rack-Aware: 2 racks × (2 × ToR + 1 × BMC)
        // ToR: ~250W (Cisco 93180YC-FX class), BMC: ~150W (Cisco 9348GC class)
        const rackCount = (clusterType === 'rack-aware') ? 2 : 1;
        infraPowerW = rackCount * ((2 * 250) + (1 * 150));
    } else {
        // Single-node: 1 × BMC switch only (no ToR rendered for single-node).
        // Matches the 3D rack viz which shows a BMC switch in every rack
        // including single-node deployments.
        infraPowerW = 1 * 150;
    }

    const totalW = totalNodeW + infraPowerW;
    const totalBtu = Math.round(totalW * 3.412); // 1W ≈ 3.412 BTU/hr
    // Annual energy assuming continuous (24/7/365) operation at the estimated load.
    const annualKwh = Math.round(totalW * 24 * 365 / 1000);

    // Rack units: 2U per node + switches per rack
    let rackUnits;
    let rackUnitLabel;
    // The breakdown text appears below the value when the user clicks the
    // expand toggle (▸). Always populated; the cell stays collapsed by default.
    let rackUnitsBreakdown = '';
    if (clusterType === 'disaggregated') {
        const torPerRack = 2; // 2 × 1U leaf/ToR switches per rack
        const bmcPerRack = 1; // 1 × 1U BMC switch per rack
        const fcPerRack = (dst === 'fc_san') ? 2 : 0; // 2 × 1U FC switches per rack (FC only)
        // External SAN storage appliances are excluded from the rack-U total —
        // form factor varies wildly by vendor (Pure Storage, NetApp, EMC, etc.)
        // and is the customer's choice. Consult the SAN vendor for actual U.
        const switchesPerRack = torPerRack + bmcPerRack + fcPerRack;
        rackUnits = (nodeCount * 2) + (drc * switchesPerRack);
        rackUnitLabel = rackUnits + 'U';
        rackUnitsBreakdown = 'Across ' + drc + ' racks: ' +
            nodeCount + ' \u00d7 server machine (2U each) + ' +
            (drc * torPerRack) + ' \u00d7 ToR (1U), ' +
            drc + ' \u00d7 BMC (1U)' +
            (fcPerRack > 0 ? ', ' + (drc * fcPerRack) + ' \u00d7 FC (1U)' : '') +
            '. External SAN storage appliance(s) are not counted \u2014 consult your SAN vendor for actual rack-U.';
    } else {
        // Standard / Rack-Aware / Single-node HCI:
        //   - Single-node (1):       0 × ToR + 1 × BMC = 1U of switches (matches 3D viz)
        //   - Standard HCI (2-16):   2 × ToR + 1 × BMC = 3U of switches in 1 rack
        //   - Rack-Aware (2-8):      2 racks × (2 × ToR + 1 × BMC) = 6U of switches across 2 racks
        // Server nodes are 2U each, distributed across racks for Rack-Aware.
        const torPerRackHci = nodeCount > 1 ? 2 : 0; // single-node has no ToR in the viz
        const bmcPerRackHci = 1;                     // BMC switch in every rack incl. single-node
        const racksHci = (clusterType === 'rack-aware') ? 2 : 1;
        const switchUnitsHci = racksHci * (torPerRackHci + bmcPerRackHci);
        rackUnits = (nodeCount * 2) + switchUnitsHci;
        rackUnitLabel = rackUnits + 'U';
        if (clusterType === 'rack-aware') {
            rackUnitsBreakdown = 'Across 2 racks: ' +
                nodeCount + ' \u00d7 server machine (2U each, distributed across racks) + ' +
                (racksHci * torPerRackHci) + ' \u00d7 ToR (1U) + ' +
                (racksHci * bmcPerRackHci) + ' \u00d7 BMC (1U).';
        } else if (nodeCount > 1) {
            rackUnitsBreakdown = '1 rack: ' +
                nodeCount + ' \u00d7 server machine (2U each) + ' +
                (racksHci * torPerRackHci) + ' \u00d7 ToR (1U) + ' +
                (racksHci * bmcPerRackHci) + ' \u00d7 BMC (1U).';
        } else {
            rackUnitsBreakdown = '1 rack: 1 \u00d7 server machine (2U) + 1 \u00d7 BMC switch (1U). Single-machine clusters share BMC traffic via the same management switch shown in the 3D rack view.';
        }
    }

    // Update DOM
    document.getElementById('power-per-node').textContent = perNodeW.toLocaleString() + ' Watts';
    document.getElementById('power-total').textContent = totalW.toLocaleString() + ' Watts';
    const powerKwhEl = document.getElementById('power-kwh');
    if (powerKwhEl) { powerKwhEl.textContent = formatAnnualEnergy(annualKwh); }
    document.getElementById('power-btu').textContent = totalBtu.toLocaleString();
    document.getElementById('rack-units').innerHTML = rackUnitLabel;

    // Capture the computed numbers so they can flow into the Sizer→Designer
    // handoff payload (and from there into report.html and the PPT export)
    // without re-deriving from the DOM.
    _lastPowerEstimate = {
        perNodeW: perNodeW,
        totalW: totalW,
        totalBtu: totalBtu,
        annualKwh: annualKwh,
        rackUnits: rackUnits,
        nodeCount: nodeCount,
        infraPowerW: infraPowerW,
        infraPowerNote: infraPowerNote || null,
        clusterType: clusterType,
        // Component breakdown for the report's "Power calculations" expander.
        components: {
            cpuW: cpuPowerW,
            memoryW: memPowerW,
            dataDisksW: diskPowerW,
            bootDisksW: osDiskPowerW,
            gpuW: gpuPowerW,
            baseOverheadW: baseOverheadW,
            psuEfficiency: psuEfficiency
        }
    };

    // Refresh the optional running-cost estimate against the new annual energy.
    updateRunningCost();

    // Update rack units label
    const rackUnitsLabelEl = document.getElementById('rack-units-label');
    if (rackUnitsLabelEl) {
        rackUnitsLabelEl.textContent = 'Rack Units (est.)';
    }

    // Populate the inline expandable breakdown beneath the value, and toggle
    // the chevron's visibility.
    const rackUnitsToggleEl = document.getElementById('rack-units-toggle');
    const rackUnitsDetailEl = document.getElementById('rack-units-detail');
    if (rackUnitsToggleEl && rackUnitsDetailEl) {
        if (rackUnitsBreakdown) {
            rackUnitsDetailEl.textContent = rackUnitsBreakdown;
            rackUnitsToggleEl.hidden = false;
        } else {
            rackUnitsDetailEl.textContent = '';
            rackUnitsDetailEl.hidden = true;
            rackUnitsToggleEl.hidden = true;
            rackUnitsToggleEl.setAttribute('aria-expanded', 'false');
        }
    }

    // Infrastructure power breakdown note
    const infraNoteEl = document.getElementById('power-infra-note');
    if (infraNoteEl) {
        if (clusterType === 'disaggregated' && infraPowerNote) {
            infraNoteEl.innerHTML = '<strong>Network infrastructure power:</strong> ' + infraPowerW.toLocaleString() + ' W (' + infraPowerNote + ') included in total.'
                + '<br><strong>Note:</strong> SAN storage appliance power is <em>not included</em> in the estimate above \u2014 consult your SAN vendor for storage array power requirements.';
            infraNoteEl.style.display = '';
        } else {
            infraNoteEl.style.display = 'none';
        }
    }

    section.style.display = 'block';

    // Populate Advanced Detail breakdown
    const detailEl = document.getElementById('power-detail-content');
    if (detailEl) {
        const lines = [];
        lines.push('<strong>Per-Machine Component Power (DC):</strong>');
        lines.push('CPU: ' + sockets + ' × ' + cpuTdp + 'W TDP = <strong>' + cpuPowerW + 'W</strong>');
        if (hwConfig.generation && hwConfig.generation.maxCores && hwConfig.coresPerSocket) {
            lines.push('&nbsp;&nbsp;&nbsp;↳ ' + hwConfig.coresPerSocket + '/' + hwConfig.generation.maxCores + ' cores × ' + maxTdp + 'W max TDP (40% base + 60% proportional)');
        }
        lines.push('Memory: ' + dimmCount + ' DIMMs × 4W = <strong>' + memPowerW + 'W</strong> (' + memoryGB + ' GB ÷ 32 GB/DIMM)');
        lines.push('Data disks: <strong>' + diskPowerW + 'W</strong> (NVMe/SSD: 8W each, HDD: 12W each)');
        lines.push('Boot disks: 2 × 8W = <strong>' + osDiskPowerW + 'W</strong> (M.2 boot drives)');
        if (gpuPowerW > 0) {
            const gpuName = hwConfig.gpuType ? (GPU_MODELS[hwConfig.gpuType] ? GPU_MODELS[hwConfig.gpuType].name : hwConfig.gpuType) : '';
            const gpuTdpEach = GPU_MODELS[hwConfig.gpuType] ? GPU_MODELS[hwConfig.gpuType].tdpW : 0;
            lines.push('GPU: ' + hwConfig.gpuCount + ' × ' + gpuTdpEach + 'W (' + gpuName + ') = <strong>' + gpuPowerW + 'W</strong>');
        }
        lines.push('Base overhead: <strong>' + baseOverheadW + 'W</strong> (fans, motherboard, NICs, BMC)');
        lines.push('');
        lines.push('<strong>Component total (DC): ' + componentPowerW + 'W</strong>');
        lines.push('');
        lines.push('<strong>PSU Efficiency:</strong> 80 Plus Titanium @ ~50% load = ' + Math.round(psuEfficiency * 100) + '%');
        lines.push('Wall power per machine: ' + componentPowerW + 'W ÷ ' + psuEfficiency + ' = <strong>' + perNodeW + 'W</strong>');
        lines.push('');
        lines.push('<strong>Instance Total:</strong>');
        lines.push('Machines: ' + nodeCount + ' × ' + perNodeW + 'W = ' + totalNodeW.toLocaleString() + 'W');
        if (infraPowerW > 0) {
            lines.push('');
            lines.push('<strong>Network Infrastructure Power:</strong>');
            if (clusterType === 'disaggregated') {
                lines.push('ToR/Leaf switches: ' + torCount + ' × ' + torSwitchPower + 'W = ' + (torCount * torSwitchPower).toLocaleString() + 'W');
                lines.push('BMC switches: ' + bmcCount + ' × ' + bmcSwitchPower + 'W = ' + (bmcCount * bmcSwitchPower).toLocaleString() + 'W');
                if (fcCount > 0) {
                    lines.push('FC switches: ' + fcCount + ' × ' + fcSwitchPower + 'W = ' + (fcCount * fcSwitchPower).toLocaleString() + 'W');
                }
                lines.push('Spine switches: ' + spineCount + ' × ' + spineSwitchPower + 'W = ' + (spineCount * spineSwitchPower).toLocaleString() + 'W');
                lines.push('Network infrastructure total: <strong>' + infraPowerW.toLocaleString() + 'W</strong>');
            } else if (nodeCount > 1) {
                // Standard HCI (1 rack) or Rack-Aware (2 racks): 2 × ToR + 1 × BMC per rack
                const racksLbl = (clusterType === 'rack-aware') ? 2 : 1;
                lines.push('ToR switches: ' + (racksLbl * 2) + ' × 250W = ' + (racksLbl * 2 * 250).toLocaleString() + 'W');
                lines.push('BMC switches: ' + racksLbl + ' × 150W = ' + (racksLbl * 150).toLocaleString() + 'W');
                lines.push('Network infrastructure total: <strong>' + infraPowerW.toLocaleString() + 'W</strong>');
            } else {
                // Single-node: BMC only
                lines.push('BMC switch: 1 × 150W = <strong>' + infraPowerW.toLocaleString() + 'W</strong>');
            }
        }
        lines.push('');
        lines.push('Total wall power: <strong>' + totalW.toLocaleString() + 'W</strong>');
        lines.push('BTU/hr: ' + totalW.toLocaleString() + 'W × 3.412 = <strong>' + totalBtu.toLocaleString() + ' BTU/hr</strong>');
        if (clusterType === 'disaggregated') {
            lines.push('');
            lines.push('<strong>⚠️ Note:</strong> SAN storage appliance/array power is <em>not included</em> in the estimate above — consult your SAN vendor for storage array power requirements.');
        }
        if (gpuPowerW === 0) {
            lines.push('');
            lines.push('<em>No GPUs configured. GPU power will be added when GPU acceleration is enabled on a workload.</em>');
        }
        lines.push('');
        lines.push('<strong>Assumptions:</strong>');
        lines.push('• CPU TDP scaled by core count: 40% base (uncore, memory controller, PCIe, I/O) + 60% proportional to active cores');
        lines.push('• Memory: ~4W per DIMM, 1 DIMM per 32 GB (DDR5 RDIMM)');
        lines.push('• NVMe/SSD: ~8W per drive, HDD: ~12W per drive');
        lines.push('• Boot: 2 × M.2 boot drives at ~8W each');
        lines.push('• Base overhead: ~100W per machine (fans, motherboard chipset, NICs, BMC)');
        lines.push('• PSU: 80 Plus Titanium rated, ~96% efficient at 50% load');
        lines.push('• ToR switch: ~250W (48-port 25GbE class), BMC switch: ~150W, Spine: ~350W, FC: ~200W');
        lines.push('• Actual power varies by OEM hardware, workload intensity, ambient temperature, and PSU load point');
        detailEl.innerHTML = lines.join('<br>');
    }

    // Update 3D rack visualization
    if (typeof renderRack3D === 'function') {
        let diskTotal = 0;
        if (hwConfig.diskConfig) {
            if (hwConfig.diskConfig.isTiered) {
                diskTotal = (hwConfig.diskConfig.cache ? hwConfig.diskConfig.cache.count : 0)
                          + (hwConfig.diskConfig.capacity ? hwConfig.diskConfig.capacity.count : 0);
            } else {
                diskTotal = hwConfig.diskConfig.capacity ? hwConfig.diskConfig.capacity.count : 4;
            }
        }
        renderRack3D({
            clusterType: document.getElementById('cluster-type').value || 'standard',
            nodeCount: nodeCount,
            disaggRackCount: parseInt((document.getElementById('disagg-rack-count') || {}).value, 10) || 2,
            disaggStorageType: (document.getElementById('disagg-storage-type') || {}).value || 'fc_san',
            spineCount: _designerSpineCount || 2,
            hasGpu: hwConfig.gpuCount > 0,
            gpuModel: hwConfig.gpuType || '',
            perNodeWatts: perNodeW,
            diskCount: diskTotal || 8,
            portCount: _designerPortCount || 4
        });
    }
}

// Update the optional annual running-cost figure from the user-supplied
// electricity unit price (per kWh) × the last computed annual energy (kWh/yr).
// The price is currency-agnostic — the cost is shown in whatever currency the
// user enters. Leaving the price box empty (or entering 0 / an invalid value)
// clears the estimate back to a dash — the input is entirely optional.
function updateRunningCost() {
    const costEl = document.getElementById('power-cost');
    const hintEl = document.getElementById('power-cost-hint');
    const priceEl = document.getElementById('power-price-input');
    if (!costEl) { return; }
    const annualKwh = _lastPowerEstimate ? _lastPowerEstimate.annualKwh : null;
    const price = priceEl ? parseFloat(priceEl.value) : NaN;
    if (annualKwh == null || !isFinite(price) || price <= 0) {
        costEl.textContent = '—';
        if (hintEl) hintEl.style.display = 'none';
        return;
    }
    const annualCost = annualKwh * price;
    costEl.textContent = annualCost.toLocaleString(undefined, {
        maximumFractionDigits: 0
    }) + '/yr';
    if (hintEl) hintEl.style.display = '';
}

// Update sizing notes
function updateSizingNotes(nodeCount, totalVcpus, totalMemory, totalStorage, resiliency, hwConfig, totalGpus, effectiveNodes) {
    const notes = [];
    const clusterType = document.getElementById('cluster-type').value;

    if (workloads.length === 0) {
        notes.push('Add workloads to see sizing recommendations');
    } else {
        // Cluster size + N+1 note — always first
        if (clusterType === 'single') {
            notes.push('1 x Machine Instance — Single machine deployment: No machine fault tolerance or maintenance capacity');
        } else {
            notes.push(`${nodeCount} x Machine Instance - N+1 capacity: hardware requirements calculated assuming ${nodeCount - 1} machines available during servicing / maintenance`);
        }

        // Per node hardware config note — always second
        if (hwConfig && hwConfig.generation) {
            notes.push(`Per machine hardware configuration: ${hwConfig.generation.name} — ${hwConfig.coresPerSocket} cores × ${hwConfig.sockets} socket(s) = ${hwConfig.totalPhysicalCores} physical cores, ${hwConfig.memoryGB} GB memory`);
            if (hwConfig.gpuCount > 0) {
                const gpuLabel = getGpuLabel(hwConfig.gpuType);
                notes.push(`GPU: ${hwConfig.gpuCount} × ${gpuLabel} per machine`);
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
            notes.push('Single Machine requires minimum 2 capacity drives (NVMe or SSD) of the same type');
        } else if (clusterType === 'aldo-mgmt') {
            notes.push('ALDO Management Cluster: Fixed 3-machine cluster for Azure Local Disconnected Operations (ALDO) management.');
            notes.push(`ALDO Infrastructure VM (IRVM1): ${ALDO_IRVM.vcpus} vCPUs, ${ALDO_IRVM.memory} GB memory, ${(ALDO_IRVM.storage / 1024).toFixed(0)} TB storage — automatically added as a fixed workload for the ALDO management infrastructure, additional infrastructure workloads may be added in a future release`);
            notes.push('Boot disk: 960 GB SSD/NVMe recommended per machine to reduce deployment complexity. Systems with smaller boot disks require extra data disks for the appliance installation');
            notes.push('📖 Learn more: <a href="https://learn.microsoft.com/azure/azure-local/manage/disconnected-operations-overview" target="_blank" rel="noopener noreferrer">Azure Local disconnected operations overview</a>');
        } else {
            // Rack-aware note
            if (clusterType === 'rack-aware') {
                notes.push('Rack-Aware Cluster (RAC): Each rack acts as a fault domain, physical machines are split evenly between two racks, minimum 2 machines, maximum 8 machines.');
            }
        }

        // Resiliency note
        const resiliencyNames = {
            'simple': 'Simple (no redundancy, 1x raw storage)',
            '2way': 'Two-way mirror (50% efficiency for two copies of data), performant and resilient to one fault domain (machine) failure',
            '3way': 'Three-way mirror (33% efficiency for three copies of data), most performant and resilient to two fault domain (machines) failures',
            '4way': 'Four-way mirror (25% efficiency), implemented as a rack-level nested mirror',
            'external': 'External SAN Storage — resiliency managed by the SAN array (not Storage Spaces Direct)'
        };
        notes.push(`Storage resiliency: ${resiliencyNames[resiliency]}`);

        // Storage config note (skip for disaggregated — external SAN, no local S2D disks)
        if (clusterType !== 'disaggregated' && hwConfig && hwConfig.diskConfig) {
            const dc = hwConfig.diskConfig;
            if (dc.isTiered) {
                notes.push(`Storage layout: ${dc.cache.count} × ${dc.cache.type} cache + ${dc.capacity.count} × ${dc.capacity.type} capacity disks per machine`);
                // Mixed all-flash recommendation
                if (hwConfig.storageConfig === 'mixed-flash') {
                    notes.push('ℹ️ All-Flash (single type SSD or NVMe) configuration is recommended for increased capacity. Mixed all-flash (NVMe cache + SSD capacity) uses tiered storage which limits capacity disks to 16 per machine (24 total drive bays).');
                }
            } else {
                notes.push(`Storage layout: ${dc.capacity.count} × ${dc.capacity.type} capacity disks per machine (${(dc.capacity.sizeGB / 1024).toFixed(1)} TB each)`);
            }
        }

        // Memory recommendation
        if (totalMemory > 0) {
            const memPerNode = Math.ceil(totalMemory / (nodeCount > 1 ? nodeCount - 1 : 1));
            const totalOverheadPerNode = getHostMemoryReservedGB(hwConfig, clusterType); // host reservation per node (see Physical Host Compute Overhead section)
            const arbSharePerNode = Math.ceil(ARB_MEMORY_OVERHEAD_GB / (nodeCount > 1 ? nodeCount - 1 : 1));
            if (hwConfig && memPerNode + arbSharePerNode > hwConfig.memoryGB - totalOverheadPerNode) {
                notes.push(`⚠️ Workload memory (${memPerNode} GB/machine + ${ARB_MEMORY_OVERHEAD_GB} GB ARB per cluster) approaches or exceeds usable machine memory (${hwConfig.memoryGB - totalOverheadPerNode} GB after ${totalOverheadPerNode} GB host reservation — see breakdown below). Consider increasing memory or adding machines.`);
            }
        }

        // Compute check
        if (hwConfig && hwConfig.totalPhysicalCores > 0 && totalVcpus > 0) {
            const vcpuToCore = getVcpuRatio();
            const effectiveNodes = nodeCount > 1 ? nodeCount - 1 : 1;
            const hostReservedCores = getHostCpuReservedCores(hwConfig, clusterType);
            const requiredCoresPerNode = Math.ceil((totalVcpus + ARB_VCPU_OVERHEAD) / effectiveNodes / vcpuToCore) + hostReservedCores;
            if (requiredCoresPerNode > hwConfig.totalPhysicalCores) {
                notes.push(`⚠️ Required cores per machine (${requiredCoresPerNode}, including ${hostReservedCores} reserved for the host root partition) exceed configured physical cores (${hwConfig.totalPhysicalCores}). Consider more cores or additional machines.`);
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
                        notes.push(`💡 Tip: ${hwConfig.generation.name} is at maximum cores (${maxIntelCores} per socket × ${hwConfig.sockets} sockets = ${hwConfig.totalPhysicalCores} physical cores per machine). ${bestAmdGen.name} offers up to ${bestAmdMaxCores} cores per socket (${bestAmdMaxCores * 2} with dual socket), which could provide additional compute headroom`);
                    }
                }
            }
        }

        // Utilization threshold checks (compute, memory, storage)
        const currentComputePercent = parseInt(document.getElementById('compute-percent').textContent) || 0;
        const currentMemoryPercent = parseInt(document.getElementById('memory-percent').textContent) || 0;
        const currentStoragePercent = parseInt(document.getElementById('storage-percent').textContent) || 0;
        if (currentComputePercent >= 90) {
            notes.push('🚫 Compute utilization is at ' + currentComputePercent + '% — configurations at or above 90% are not recommended. Increase CPU cores, add machines, or reduce workloads.');
        }
        if (currentMemoryPercent >= 90) {
            notes.push('🚫 Memory utilization is at ' + currentMemoryPercent + '% — configurations at or above 90% are not recommended. Increase memory per machine, add machines, or reduce workloads.');
        }
        if (clusterType !== 'disaggregated' && currentStoragePercent >= 90) {
            notes.push('🚫 Storage utilization is at ' + currentStoragePercent + '% — configurations at or above 90% are not recommended. Add machines, increase disk count/size, or reduce workloads.');
        }
        const currentGpuPercent = parseInt(document.getElementById('gpu-percent').textContent) || 0;
        const gpuSectionVisible = document.getElementById('gpu-capacity-section') && document.getElementById('gpu-capacity-section').style.display !== 'none';
        if (gpuSectionVisible && currentGpuPercent >= 90) {
            const maxNodesGpu = getMaxNodeCap();
            const atMaxNodes = nodeCount >= maxNodesGpu;
            const gpuAdvice = atMaxNodes
                ? 'Reduce GPU workloads or increase GPUs per machine. Machine count is at maximum (' + maxNodesGpu + ').'
                : 'Add more machines with GPUs, or reduce GPU workloads.';
            notes.push('🚫 GPU utilization is at ' + currentGpuPercent + '% — configurations at or above 90% are not recommended. ' + gpuAdvice + ' Remember that N−1 machine capacity must be maintained for updates and draining.');
        }
        if (gpuSectionVisible && totalGpus > 0) {
            const gpuCountPerNode = hwConfig.gpuCount || 0;
            const physicalMaxGpus = gpuCountPerNode * nodeCount;
            if (totalGpus > physicalMaxGpus) {
                const gpuModel = GPU_MODELS[hwConfig.gpuType];
                const maxPerNode = gpuModel ? gpuModel.maxPerNode : gpuCountPerNode;
                const maxNodes = getMaxNodeCap();
                const canAddNodes = nodeCount < maxNodes;
                const canAddGpus = gpuCountPerNode < maxPerNode;
                let advice = '';
                if (canAddGpus && canAddNodes) advice = 'Increase GPUs per machine (up to ' + maxPerNode + '), add more machines, or reduce GPU workloads.';
                else if (canAddGpus) advice = 'Increase GPUs per machine (up to ' + maxPerNode + ') or reduce GPU workloads. Machine count is at maximum (' + maxNodes + ').';
                else if (canAddNodes) advice = 'Add more machines or reduce GPU workloads. GPUs per machine is at maximum (' + maxPerNode + ').';
                else advice = 'Reduce GPU workloads — machine count (' + maxNodes + ') and GPUs per machine (' + maxPerNode + ') are both at maximum.';
                notes.push('🚫 GPU demand (' + totalGpus + ' GPUs) exceeds the physical capacity (' + physicalMaxGpus + ' GPUs across ' + nodeCount + ' machines × ' + gpuCountPerNode + ' GPUs/machine). ' + advice);
            } else if (totalGpus > gpuCountPerNode * effectiveNodes) {
                notes.push('⚠️ GPU demand (' + totalGpus + ' GPUs) fits the physical hardware but exceeds N−1 effective capacity (' + (gpuCountPerNode * effectiveNodes) + ' GPUs). During machine maintenance/updates, GPU workloads may not all be accommodated.');
            }
        }

        // Storage Spaces Direct cache-drive metadata (4 GB per TB of cache) is now
        // included in the host-memory reservation and detailed in the "Physical Host
        // Compute Overhead" section below — no separate flat note here.

        // 400 TB per-machine storage validation (S2D only)
        let storageLimitExceeded = false;
        const storageLimitMessages = [];

        // Single workload exceeds per-node capacity check
        let _vmExceedsNode = false;
        if (hwConfig) {
            const singleVmVcpuRatio = getVcpuRatio();
            const hostMemReservedGB = getHostMemoryReservedGB(hwConfig, clusterType);
            const hostCoresReserved = getHostCpuReservedCores(hwConfig, clusterType);
            const usableMemPerNode = hwConfig.memoryGB - hostMemReservedGB;
            const maxVcpuPerNode = Math.max(hwConfig.totalPhysicalCores - hostCoresReserved, 0) * singleVmVcpuRatio;
            workloads.forEach(function(w) {
                // Only check single-VM placement for per-VM input mode. In 'total'
                // input mode w.vcpus / w.memory are fleet aggregates with count=1,
                // not the spec of any individual VM, so this check would be a
                // false positive for any reasonably-sized fleet.
                if (w.type === 'vm' && w.inputMode !== 'total') {
                    if (w.vcpus > maxVcpuPerNode) {
                        notes.push('🚫 Workload "' + (w.name || 'VM') + '" requires ' + w.vcpus + ' vCPUs per VM, which exceeds the per-machine vCPU capacity (' + maxVcpuPerNode + ' vCPUs at ' + singleVmVcpuRatio + ':1 ratio with ' + (hwConfig.totalPhysicalCores - hostCoresReserved) + ' usable cores after a ' + hostCoresReserved + '-core host reservation). This VM cannot be placed on a single machine.');
                        _vmExceedsNode = true;
                    }
                    if (w.memory > usableMemPerNode) {
                        notes.push('🚫 Workload "' + (w.name || 'VM') + '" requires ' + w.memory + ' GB memory per VM, which exceeds usable per-machine memory (' + usableMemPerNode + ' GB after a ' + hostMemReservedGB + ' GB host reservation — see breakdown below). This VM cannot be placed on a single machine.');
                        _vmExceedsNode = true;
                    }
                }
            });
            if (_vmExceedsNode) {
                _scheduleVmExceedsToast();
            } else {
                _clearVmExceedsToast();
            }
        }
        // Store flag for Designer button gating
        window._sizerVmExceedsNode = _vmExceedsNode;
        if (clusterType !== 'disaggregated' && hwConfig && hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
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
                notes.push(`🚫 Total cluster raw storage (~${totalClusterRawTB.toFixed(0)} TB) exceeds the Azure Local supported maximum of 4 PB (4,000 TB) per storage pool. Reduce machines, disk count, or disk size.`);
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
            notes.push(`⚠️ Warning: vCPU overcommit ratio has been auto-scaled to ${vcpuRatio}:1 — physical CPU cores and sockets are maxed out for required vCPUs. A ${vcpuRatio}:1 or higher overcommit ratio is required to accommodate the workload. Consider adding more machines / clusters, or reducing workload vCPU requirements.`);
        } else {
            notes.push(`vCPU calculations use ${vcpuRatio}:1 vCPU to pCPU overcommit ratio`);
        }

        // Infrastructure_1 volume + ARB appliance note
        if (clusterType === 'disaggregated') {
            notes.push('Disaggregated SAN storage requirement includes 256 GB for the Infrastructure_1 volume and 20 GB for the PerformanceHistory volume (276 GB total, once per instance), in addition to workload storage. Azure Resource Bridge (ARB) appliance VM reserves ' + ARB_MEMORY_OVERHEAD_GB + ' GB memory and ' + ARB_VCPU_OVERHEAD + ' vCPUs per cluster.');
        } else {
            notes.push('Infrastructure overhead: 256 GB usable storage reserved by Storage Spaces Direct (Infrastructure_1 volume) has been deducted from the overall usable storage. Azure Resource Bridge (ARB) appliance VM reserves ' + ARB_MEMORY_OVERHEAD_GB + ' GB memory and ' + ARB_VCPU_OVERHEAD + ' vCPUs per cluster.');
        }

        // S2D Resiliency Repair note (skip for disaggregated — no S2D)
        if (clusterType !== 'disaggregated' && nodeCount >= 1 && hwConfig && hwConfig.diskConfig && hwConfig.diskConfig.capacity) {
            const reservedDisks = getRepairDiskCount();
            const recommendedDisks = Math.min(nodeCount, S2D_REPAIR_MAX_RESERVED_DISKS);
            const reservedDiskSizeGB = hwConfig.diskConfig.capacity.sizeGB;
            const reservedTotalGB = reservedDisks * reservedDiskSizeGB;
            const reservedTotalTB = (reservedTotalGB / 1024).toFixed(2);
            if (_repairDisksUserSet && reservedDisks < recommendedDisks) {
                notes.push('⚠️ S2D Resiliency Repair: Warning — recommended ' + recommendedDisks + ' × capacity disks should be reserved based on the cluster size (' + nodeCount + ' machines), but currently only ' + reservedDisks + ' × capacity disk' + (reservedDisks !== 1 ? 's are' : ' is') + ' reserved (' + reservedTotalTB + ' TB). This raw capacity has been deducted from the available usable storage.');
            } else if (_repairDisksUserSet) {
                notes.push('ℹ️ S2D Resiliency Repair: ' + reservedDisks + ' × capacity disk (' + (reservedDiskSizeGB / 1024).toFixed(2) + ' TB each = ' + reservedTotalTB + ' TB total) free space reserved in the storage pool for Storage Spaces Direct repair jobs (manually set). This raw capacity has been deducted from the available usable storage.');
            } else {
                notes.push('ℹ️ S2D Resiliency Repair: ' + reservedDisks + ' × capacity disk (' + (reservedDiskSizeGB / 1024).toFixed(2) + ' TB each = ' + reservedTotalTB + ' TB total) free space reserved in the storage pool for Storage Spaces Direct repair jobs, up to a maximum of ' + S2D_REPAIR_MAX_RESERVED_DISKS + ' × capacity disks. This raw capacity has been deducted from the available usable storage.');
            }
        }

        // Disk bay consolidation note (skip for disaggregated)
        if (clusterType !== 'disaggregated' && _diskConsolidationInfo) {
            const info = _diskConsolidationInfo;
            notes.push(`💡 Disk bay optimization: ${info.originalCount} × ${info.originalSizeTB} TB capacity disks would use ${Math.round(info.originalCount / info.maxBays * 100)}% of available disk bays (${info.maxBays} max). Auto-scaled to ${info.newCount} × ${info.newSizeTB} TB disks instead, freeing ${info.baysFreed} bay${info.baysFreed > 1 ? 's' : ''} per machine for future expansion. Note: Disk size and number can be edited, if you prefer a larger number of smaller capacity disks.`);
        }

        // Host overhead note — concise summary; full math in the collapsed section below
        if (hwConfig) {
            const hostMemReserved = getHostMemoryReservedGB(hwConfig, clusterType);
            const hostCoresReserved = getHostCpuReservedCores(hwConfig, clusterType);
            notes.push(`ℹ️ Host (root partition) reservation: ${hostMemReserved} GB memory and ${hostCoresReserved} physical core${hostCoresReserved === 1 ? '' : 's'} reserved per machine for Azure Local OS, Hyper-V root partition, clustering and the S2D stack — excluded from workload-available capacity. See "Physical Host Compute Overhead — Assumptions &amp; Math" below for the breakdown.`);
        }

        // Network note
        if (clusterType === 'disaggregated') {
            notes.push('Network: Disaggregated deployments use a Clos leaf-spine fabric with RDMA-capable NICs (25 GbE+ recommended). Compute machines connect to external SAN storage via Fibre Channel HBAs or iSCSI over the leaf switches.');
        } else {
            notes.push('Network: Azure Local multi-machine hyperconverged instances require RDMA-capable NICs (25 GbE+ recommended). Storage traffic uses dedicated NICs for east-west storage replication bandwidth.');
        }

        // Boot/OS drive note — only shown when memory exceeds 768 GB (larger boot drive needed)
        if (hwConfig && hwConfig.memoryGB > 768) {
            notes.push('ℹ️ Boot drive: minimum 400 GB OS disks recommended for systems with >768 GB memory.');
        }
    }

    const notesList = document.getElementById('sizing-notes');
    notesList.innerHTML = notes.map(n => `<li>${n}</li>`).join('');

    // Populate the collapsed "Physical Host Compute Overhead" breakdown
    updateHostOverheadBreakdown(hwConfig, clusterType);

    // Show/hide "Configure in Designer" button
    updateDesignerActionVisibility();

    // Update multi-instance summary if visible
    updateMultiInstanceSummary();
}

// ── Physical Host Compute Overhead — Assumptions & Math (Issue #232) ──
// Renders the collapsed breakdown beneath the sizing notes showing exactly how the
// per-node host memory and CPU reservations are derived for the current deployment.
function updateHostOverheadBreakdown(hwConfig, clusterType) {
    const section = document.getElementById('host-overhead-section');
    const content = document.getElementById('host-overhead-content');
    if (!section || !content) return;

    if (!hwConfig) {
        section.style.display = 'none';
        content.innerHTML = '';
        return;
    }

    const isDisaggregated = clusterType === 'disaggregated';
    const isAldo = clusterType === 'aldo-mgmt';
    const hostMemGB = hwConfig.memoryGB || 0;
    const physicalCores = hwConfig.totalPhysicalCores || 0;

    // Memory terms
    const base = isDisaggregated ? HOST_MEM_BASE_DISAGGREGATED_GB : HOST_MEM_BASE_S2D_GB;
    const cacheTB = getCacheTBPerNode(hwConfig);
    const cacheMetadataGB = isDisaggregated ? 0 : Math.ceil(cacheTB * HOST_MEM_CACHE_METADATA_GB_PER_TB);
    const aldoGB = isAldo ? ALDO_APPLIANCE_OVERHEAD_GB : 0;
    const fixedSum = base + cacheMetadataGB + aldoGB;
    const ramFractionGB = Math.ceil(HOST_MEM_HOST_RAM_FRACTION * hostMemGB);
    const memReserved = Math.max(fixedSum, ramFractionGB);
    const ramFractionWins = ramFractionGB > fixedSum;

    // CPU terms
    let cpuPct, cpuFloor;
    if (isAldo) { cpuPct = 0.20; cpuFloor = 2; } else if (isDisaggregated) { cpuPct = 0.10; cpuFloor = 1; } else { cpuPct = 0.10; cpuFloor = 2; }
    const cpuPctCores = Math.ceil(cpuPct * physicalCores);
    const coresReserved = Math.max(cpuPctCores, cpuFloor);
    const cpuFloorWins = cpuFloor > cpuPctCores;

    const deployLabel = isDisaggregated ? 'Disaggregated (external SAN — no local S2D stack)'
        : isAldo ? 'Azure Local Disconnected Operations (ALDO) management cluster'
            : 'Standard hyperconverged (Storage Spaces Direct)';
    const s2dInUse = !isDisaggregated;
    const win = (active) => active
        ? 'color: var(--accent-blue); font-weight: 600;'
        : 'color: var(--text-secondary);';

    let html = '';
    html += `<div style="margin-bottom: 8px;"><strong>Deployment type:</strong> ${deployLabel}. `;
    html += s2dInUse
        ? 'Storage Spaces Direct (S2D) <strong>is</strong> in use, so the host reserves memory for the storage stack and (on tiered configs) cache-drive metadata.'
        : 'S2D is <strong>not</strong> in use on these hosts, so the storage-stack memory reservation is reduced.';
    html += '</div>';

    // Memory table
    html += '<div style="font-weight: 600; margin: 8px 0 4px;">Per-Machine memory reservation</div>';
    html += '<table style="border-collapse: collapse; font-size: 12px; width: 100%; max-width: 520px;">';
    html += `<tr><td style="padding: 2px 8px 2px 0;">Base (${isDisaggregated ? 'disaggregated, no S2D' : 'S2D host OS + storage stack'})</td><td style="text-align: right; padding: 2px 0;">${base} GB</td></tr>`;
    if (!isDisaggregated) {
        html += `<tr><td style="padding: 2px 8px 2px 0;">S2D cache metadata${cacheTB > 0 ? ` (${cacheTB.toFixed(1)} TB cache × ${HOST_MEM_CACHE_METADATA_GB_PER_TB} GB/TB)` : ' (no cache tier)'}</td><td style="text-align: right; padding: 2px 0;">${cacheMetadataGB} GB</td></tr>`;
    }
    if (isAldo) {
        html += `<tr><td style="padding: 2px 8px 2px 0;">ALDO appliance reservation</td><td style="text-align: right; padding: 2px 0;">${aldoGB} GB</td></tr>`;
    }
    html += `<tr style="border-top: 1px solid rgba(148,163,184,0.3);"><td style="padding: 4px 8px 2px 0; ${win(!ramFractionWins)}">Fixed-term subtotal</td><td style="text-align: right; padding: 4px 0 2px; ${win(!ramFractionWins)}">${fixedSum} GB</td></tr>`;
    html += `<tr><td style="padding: 2px 8px 2px 0; ${win(ramFractionWins)}">Host-RAM scaling term (${Math.round(HOST_MEM_HOST_RAM_FRACTION * 100)}% × ${hostMemGB} GB)</td><td style="text-align: right; padding: 2px 0; ${win(ramFractionWins)}">${ramFractionGB} GB</td></tr>`;
    html += `<tr style="border-top: 1px solid rgba(148,163,184,0.3);"><td style="padding: 4px 8px 2px 0; font-weight: 600;">Reserved per machine = max(of the two)</td><td style="text-align: right; padding: 4px 0 2px; font-weight: 600;">${memReserved} GB</td></tr>`;
    html += '</table>';
    html += `<div style="font-size: 11px; margin-top: 2px;">The <span style="${win(ramFractionWins)}">highlighted</span> term wins because it is the larger of the fixed subtotal and the 8%-of-host-RAM scaling term.</div>`;

    // CPU table
    html += '<div style="font-weight: 600; margin: 10px 0 4px;">Per-Machine CPU reservation (physical cores)</div>';
    html += '<table style="border-collapse: collapse; font-size: 12px; width: 100%; max-width: 520px;">';
    html += `<tr><td style="padding: 2px 8px 2px 0; ${win(!cpuFloorWins)}">Percentage term (${Math.round(cpuPct * 100)}% × ${physicalCores} cores, rounded up)</td><td style="text-align: right; padding: 2px 0; ${win(!cpuFloorWins)}">${cpuPctCores} core${cpuPctCores === 1 ? '' : 's'}</td></tr>`;
    html += `<tr><td style="padding: 2px 8px 2px 0; ${win(cpuFloorWins)}">Minimum floor</td><td style="text-align: right; padding: 2px 0; ${win(cpuFloorWins)}">${cpuFloor} core${cpuFloor === 1 ? '' : 's'}</td></tr>`;
    html += `<tr style="border-top: 1px solid rgba(148,163,184,0.3);"><td style="padding: 4px 8px 2px 0; font-weight: 600;">Reserved per machine = max(of the two)</td><td style="text-align: right; padding: 4px 0 2px; font-weight: 600;">${coresReserved} core${coresReserved === 1 ? '' : 's'}</td></tr>`;
    html += '</table>';

    // Assumptions + public references
    html += '<div style="font-weight: 600; margin: 10px 0 4px;">Assumptions</div>';
    html += '<ul style="margin: 0 0 4px 16px; padding: 0; font-size: 12px;">';
    html += isDisaggregated
        ? '<li>Reservations cover the Hyper-V root partition, Failover Clustering / CSV, external SAN connectivity (MPIO / HBA or iSCSI initiator), Arc/AMA/ATC/Defender agents, and live-migration / patching headroom. The S2D storage stack is not present on disaggregated hosts, so no Software Storage Bus / pool / CSV cache or storage-repair reservation applies.</li>'
        : '<li>Reservations cover the Hyper-V root partition, Failover Clustering / CSV, the S2D stack (Software Storage Bus, pool/ReFS runtime, CSV in-memory read cache), Arc/AMA/ATC/Defender agents, and live-migration / repair / patching headroom.</li>';
    html += '<li>The 8%-of-host-RAM term scales the reservation on large-memory machines where fixed terms alone under-provision the root partition.</li>';
    html += '<li>Reserved capacity is excluded from workload-available vCPU and memory in all sizing calculations on this page.</li>';
    html += '</ul>';
    html += '<div style="font-size: 11px; margin-top: 4px;">References: ';
    html += '<a href="https://learn.microsoft.com/windows-server/virtualization/hyper-v/manage/performance-tuning-for-hyper-v-servers" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: underline;">Hyper-V performance tuning</a>, ';
    html += '<a href="https://learn.microsoft.com/windows-server/storage/storage-spaces/storage-spaces-direct-hardware-requirements" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: underline;">S2D hardware requirements</a>, ';
    html += '<a href="https://learn.microsoft.com/azure/azure-local/concepts/system-requirements" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: underline;">Azure Local system requirements</a>.';
    html += '</div>';

    content.innerHTML = html;
    section.style.display = '';
}

// ── Capacity Runway — 5 Year-over-Year (YoY) Additional Workload Growth Projection ──
// Inputs are the RAW workload totals (pre-growth-factor) so the table can
// compound Year 0..5 cleanly without round-tripping through already-grown
// totals.
function updateGrowthProjection(rawVcpus, rawMemory, rawStorage, rawGpus, hwConfig, effectiveNodes) {
    const section = document.getElementById('growth-projection-section');
    const content = document.getElementById('growth-projection-content');
    if (!section || !content) return;

    const growthPct = parseInt((document.getElementById('future-growth') || {}).value, 10) || 0;
    const sizedFor5Yr = (document.getElementById('size-for-5yr-growth') || {}).value === 'yes';

    // Hide if no workloads or no growth configured
    if (workloads.length === 0 || growthPct === 0 || !hwConfig) {
        section.style.display = 'none';
        return;
    }

    // Capacity ceilings — match what the capacity bars use
    const vcpuRatio = getVcpuRatio();
    const clusterType = document.getElementById('cluster-type').value;
    const isDisaggregated = clusterType === 'disaggregated';
    const hostReservedCores = getHostCpuReservedCores(hwConfig, clusterType);
    const totalVcpuCap = Math.max(hwConfig.totalPhysicalCores - hostReservedCores, 0) * effectiveNodes * vcpuRatio;
    const usableMemPerNode = Math.max(hwConfig.memoryGB - getHostMemoryReservedGB(hwConfig, clusterType), 0);
    const totalMemCap = usableMemPerNode * effectiveNodes;

    // Storage cap: read the usable-TB figure the capacity bar shows. For
    // disaggregated the cap is "External SAN" (free text) → parseFloat → NaN
    // → 0 → storage % suppressed, since SAN scaling isn't bounded by node count.
    let totalStorageCapGB = 0;
    const storageTotalEl = document.getElementById('storage-total');
    if (storageTotalEl) {
        const parsed = parseFloat((storageTotalEl.textContent || '').replace(/,/g, ''));
        if (!isNaN(parsed)) totalStorageCapGB = Math.round(parsed * 1000); // TB usable → GB (decimal)
    }

    // GPU cap (only relevant when workloads request GPUs and the design has them)
    const gpuPerNode = hwConfig.gpuCount || 0;
    const totalGpuCap = gpuPerNode * effectiveNodes;
    const hasGpuWorkload = (rawGpus || 0) > 0;
    // Show the GPU column whenever GPUs are in play on either side — either
    // workloads request them, or the hardware has them configured. This way
    // GPU-equipped clusters always surface their GPU runway, and GPU
    // workloads on non-GPU hardware show the (always 0 %) cap mismatch.
    const showGpuColumn = hasGpuWorkload || gpuPerNode > 0;

    const years = 5;
    const rows = [];
    let runwayYear = null;
    let nowAtCapacity = false;

    for (let y = 0; y <= years; y++) {
        const factor = Math.pow(1 + growthPct / 100, y);
        const yVcpu = Math.ceil(rawVcpus * factor);
        const yMem = Math.ceil(rawMemory * factor);
        const yStor = Math.ceil(rawStorage * factor);
        const yGpu = Math.ceil((rawGpus || 0) * factor);

        const vcpuPct = totalVcpuCap > 0 ? Math.min(999, Math.round((yVcpu / totalVcpuCap) * 100)) : 0;
        const memPct = totalMemCap > 0 ? Math.min(999, Math.round((yMem / totalMemCap) * 100)) : 0;
        const storPct = (!isDisaggregated && totalStorageCapGB > 0)
            ? Math.min(999, Math.round((yStor / totalStorageCapGB) * 100)) : 0;
        const gpuPct = (hasGpuWorkload && totalGpuCap > 0)
            ? Math.min(999, Math.round((yGpu / totalGpuCap) * 100)) : 0;
        const maxPct = Math.max(vcpuPct, memPct, storPct, gpuPct);

        let status;
        if (maxPct >= 90) {
            status = '🚫 ' + maxPct + '%';
            if (y === 0) nowAtCapacity = true;
            if (runwayYear === null && y > 0) runwayYear = y;
        } else if (maxPct >= 75) {
            status = '⚠️ ' + maxPct + '%';
        } else {
            status = '✅ ' + maxPct + '%';
        }

        const storLabel = isDisaggregated
            ? (yStor >= 1000 ? (yStor / 1000).toFixed(1) + ' TB SAN' : yStor + ' GB SAN')
            : (yStor >= 1000 ? (yStor / 1000).toFixed(1) + ' TB' : yStor + ' GB');

        rows.push({
            label: y === 0 ? 'Now' : 'Year ' + y,
            vcpu: yVcpu.toLocaleString(),
            mem: yMem.toLocaleString() + ' GB',
            stor: storLabel,
            gpu: yGpu.toLocaleString(),
            status: status
        });
    }

    // Build table
    let html = '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
    html += '<thead><tr style="border-bottom: 1px solid var(--glass-border); text-align: left;">';
    html += '<th style="padding: 4px 8px;">Year</th>';
    html += '<th style="padding: 4px 8px;">vCPU</th>';
    html += '<th style="padding: 4px 8px;">Memory</th>';
    html += '<th style="padding: 4px 8px;">Storage' + (isDisaggregated ? ' (SAN required)' : ' (usable)') + '</th>';
    if (showGpuColumn) html += '<th style="padding: 4px 8px;">GPU</th>';
    html += '<th style="padding: 4px 8px;">Peak Utilization</th>';
    html += '</tr></thead><tbody>';

    rows.forEach(function(r) {
        html += '<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">';
        html += '<td style="padding: 4px 8px; font-weight: 600;">' + r.label + '</td>';
        html += '<td style="padding: 4px 8px;">' + r.vcpu + '</td>';
        html += '<td style="padding: 4px 8px;">' + r.mem + '</td>';
        html += '<td style="padding: 4px 8px;">' + r.stor + '</td>';
        if (showGpuColumn) html += '<td style="padding: 4px 8px;">' + r.gpu + '</td>';
        html += '<td style="padding: 4px 8px;">' + r.status + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table>';

    if (nowAtCapacity) {
        html += '<p style="margin: 8px 0 0 0; color: var(--danger); font-weight: 600;">🚫 Already at capacity (≥&nbsp;90&nbsp;%) at current demand — design cannot absorb additional ' + growthPct + '% annual growth.</p>';
    } else if (runwayYear !== null) {
        html += '<p style="margin: 8px 0 0 0; color: var(--danger); font-weight: 600;">⏳ Capacity runway: ~' + runwayYear + ' year' + (runwayYear > 1 ? 's' : '') + ' before expansion is needed at ' + growthPct + '% annual growth.</p>';
    } else {
        html += '<p style="margin: 8px 0 0 0; color: var(--success); font-weight: 600;">✅ Capacity runway: 5+ years at ' + growthPct + '% annual growth' + (sizedFor5Yr ? ' (hardware sized for the full 5-year horizon)' : '') + '.</p>';
    }

    const fiveYrMultiplier = Math.pow(1 + growthPct / 100, 5);
    const factorNote = sizedFor5Yr
        ? 'Hardware is sized for the <strong>full 5-year compound horizon</strong> (' + growthPct + '% YoY × 5y ≈ ×' + fiveYrMultiplier.toFixed(2) + '). All five years should fit within capacity.'
        : 'Hardware is sized for <strong>Year&nbsp;1</strong> demand (current + ' + growthPct + '%). To pre-provision for all 5 years (×' + fiveYrMultiplier.toFixed(2) + '), set the dropdown above to <strong>Yes</strong>.';
    html += '<p style="margin: 4px 0 0 0; font-size: 11px; color: var(--text-secondary);">' + factorNote + '</p>';

    // Explain a zeroed GPU column when the hardware has GPUs but no workload
    // currently requests them — otherwise the all-zero column reads as a bug.
    if (showGpuColumn && !hasGpuWorkload) {
        html += '<p style="margin: 4px 0 0 0; font-size: 11px; color: var(--text-secondary);">GPU column shows 0 because none of the current workloads are configured with GPUs (DDA or GPU-P). Assign a GPU mode to a workload to see GPU runway projections.</p>';
    }

    content.innerHTML = html;
    section.style.display = '';
}

// Show "Configure in Designer" button only when workloads exist and all resources are under 90%
// Update multi-instance summary (scale-out view — visual only, not used in sizing)
function updateMultiInstanceSummary() {
    const section = document.getElementById('multi-instance-section');
    const summaryDiv = document.getElementById('multi-instance-summary');
    if (!section || !summaryDiv) return;

    // Show the section when workloads exist
    section.style.display = workloads.length > 0 ? '' : 'none';

    const count = parseInt((document.getElementById('instance-count') || {}).value, 10) || 1;
    if (count <= 1) {
        summaryDiv.style.display = 'none';
        return;
    }

    const nodeCount = parseInt(document.getElementById('node-count').value, 10) || 2;
    const clusterType = document.getElementById('cluster-type').value;
    const totalPowerText = document.getElementById('power-total');
    const totalBtuText = document.getElementById('power-btu');
    const rackUnitsEl = document.getElementById('rack-units');

    // Parse single-instance values
    const singlePowerW = parseInt((totalPowerText ? totalPowerText.textContent : '0').replace(/,/g, ''), 10) || 0;
    const singleBtu = parseInt((totalBtuText ? totalBtuText.textContent : '0').replace(/,/g, ''), 10) || 0;
    // Extract numeric rack units from the beginning of the text
    const rackUnitText = rackUnitsEl ? rackUnitsEl.textContent : '0';
    const singleRU = parseInt(rackUnitText, 10) || 0;
    let racksPerInstance = 1;
    if (clusterType === 'disaggregated') {
        racksPerInstance = parseInt((document.getElementById('disagg-rack-count') || {}).value, 10) || 2;
    } else if (clusterType === 'rack-aware') {
        racksPerInstance = 2;
    }

    const totalNodes = nodeCount * count;
    const totalRacks = racksPerInstance * count;
    const totalPower = singlePowerW * count;
    const totalBtu = singleBtu * count;
    const totalRU = singleRU * count;
    const singleAnnualKwh = _lastPowerEstimate ? _lastPowerEstimate.annualKwh : null;
    const totalAnnualKwh = (singleAnnualKwh != null) ? singleAnnualKwh * count : null;
    const hwConfig = getHardwareConfig();
    const totalCores = (hwConfig.totalPhysicalCores || 0) * nodeCount * count;
    let gpuLine = '';
    if (hwConfig.gpuCount > 0 && hwConfig.gpuType) {
        const totalGpus = hwConfig.gpuCount * nodeCount * count;
        const gpuModel = GPU_MODELS[hwConfig.gpuType];
        const gpuSpec = gpuModel ? gpuModel.name + ' (' + gpuModel.vramGB + ' GB VRAM)' : hwConfig.gpuType;
        gpuLine = '<span>Total GPUs: <strong>' + totalGpus.toLocaleString() + ' \u00d7 ' + gpuSpec + '</strong></span>';
    }
    const totalMemoryGB = (hwConfig.memoryGB || 0) * nodeCount * count;
    const totalMemoryLabel = totalMemoryGB >= 1048576 ? (totalMemoryGB / 1048576).toFixed(2) + ' PB'
        : totalMemoryGB >= 1024 ? (totalMemoryGB / 1024).toFixed(1) + ' TB'
            : totalMemoryGB.toLocaleString() + ' GB';
    const totalPowerKW = (totalPower / 1000).toFixed(1);
    const powerLabel = totalPower >= 1000000
        ? totalPower.toLocaleString() + ' W (' + (totalPower / 1000000).toFixed(2) + ' MW)'
        : totalPower.toLocaleString() + ' W (' + totalPowerKW + ' kW)';

    // Preserve any user-entered multi-instance electricity price across re-renders.
    // Element may not exist yet on first render after a state restore — fall back
    // to the cached value stashed by updateMultiRunningCost() / applyImportedSizerState().
    const existingMultiPriceEl = document.getElementById('multi-power-price-input');
    const preservedMultiPrice = existingMultiPriceEl
        ? existingMultiPriceEl.value
        : (typeof _lastMultiPowerPrice === 'string' ? _lastMultiPowerPrice : '');

    const annualKwhLabel = (totalAnnualKwh != null)
        ? formatAnnualEnergy(totalAnnualKwh)
        : '\u2014';

    summaryDiv.innerHTML = '<strong>Multi-Instance Scale-Out Summary (\u00d7' + count + ' instances)</strong>'
        + '<div style="display: flex; flex-wrap: wrap; gap: 24px; margin-top: 8px;">'
        + '<span>Total Machines: <strong>' + totalNodes.toLocaleString() + '</strong></span>'
        + '<span>Total Racks: <strong>' + totalRacks.toLocaleString() + '</strong></span>'
        + '<span>Total Cores: <strong>' + totalCores.toLocaleString() + '</strong></span>'
        + '<span>Total Memory: <strong>' + totalMemoryLabel + '</strong></span>'
        + '</div>'
        + (gpuLine ? '<div style="display: flex; flex-wrap: wrap; gap: 24px; margin-top: 6px;">' + gpuLine + '</div>' : '')
        + '<div style="display: flex; flex-wrap: wrap; gap: 24px; margin-top: 6px;">'
        + '<span>Total Power: <strong>' + powerLabel + '</strong></span>'
        + '<span>Total BTU/hr: <strong>' + totalBtu.toLocaleString() + '</strong></span>'
        + '<span>Total Rack Units: <strong>' + totalRU.toLocaleString() + 'U</strong></span>'
        + '</div>'
        + '<div style="display: flex; flex-wrap: wrap; gap: 24px; margin-top: 6px; align-items: center;">'
        + '<span>Total Annual Energy: <strong id="multi-power-kwh">' + annualKwhLabel + '</strong></span>'
        + '</div>'
        + '<div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; align-items: center;">'
        +   '<label for="multi-power-price-input" style="font-weight: 600;">Electricity Price (per kWh):</label>'
        +   '<span class="power-price-help" role="img" aria-label="Help: this field is currency-agnostic. Enter your electricity price per kWh in any currency and the total annual cost is shown in the same currency." title="Optional and currency-agnostic. Enter your electricity unit price per kilowatt-hour (kWh) in any currency (e.g. USD, GBP, EUR) \u2014 the estimated total annual cost across all instances is shown in that same currency. Independent of the per-instance Electricity Price above.">\u24d8</span>'
        +   '<span style="font-size: 12px; color: var(--text-secondary);">Input:</span>'
        +   '<input type="number" id="multi-power-price-input" min="0" step="0.01" inputmode="decimal" placeholder="0.15"'
        +     ' value="' + preservedMultiPrice.replace(/"/g, '&quot;') + '"'
        +     ' aria-label="Multi-instance electricity unit price per kilowatt-hour, in your local currency"'
        +     ' oninput="updateMultiRunningCost(); saveSizerState();"'
        +     ' style="width: 90px; padding: 4px 8px; background: var(--card-bg); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 6px; font-size: 13px;">'
        +   '<span style="margin-left: 16px; display: inline-flex; align-items: center; gap: 6px;"><span style="text-align: right; line-height: 1.2; font-size: 12px; color: var(--text-secondary);">Total Annual Cost:<br>(estimated)</span> <strong id="multi-power-cost">\u2014</strong></span>'
        + '</div>'
        + '<div style="margin-top: 10px; padding: 8px 12px; background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.25); border-radius: 6px; font-size: 12px; color: var(--text-secondary); display: flex; align-items: flex-start; gap: 8px;">'
        + '<span style="color: #eab308; font-size: 14px; flex-shrink: 0;">\u26A0\uFE0F</span>'
        + '<span>Multi-instance estimates are approximate projections based on the single-instance configuration above. Each instance is independently sized and deployed. Actual power, cooling, and rack requirements may vary by site, OEM hardware, and deployment configuration. Contact your preferred hardware partner for detailed and accurate information.</span>'
        + '</div>';
    summaryDiv.style.display = '';
    updateMultiRunningCost();
}

// Update the optional multi-instance annual running-cost figure from the
// user-supplied electricity unit price (per kWh) × total annual energy across
// all instances. Currency-agnostic and independent of the per-instance price.
function updateMultiRunningCost() {
    const costEl = document.getElementById('multi-power-cost');
    const priceEl = document.getElementById('multi-power-price-input');
    if (priceEl) { _lastMultiPowerPrice = priceEl.value || ''; }
    if (!costEl) { return; }
    const count = parseInt((document.getElementById('instance-count') || {}).value, 10) || 1;
    const singleAnnualKwh = _lastPowerEstimate ? _lastPowerEstimate.annualKwh : null;
    const price = priceEl ? parseFloat(priceEl.value) : NaN;
    if (singleAnnualKwh == null || !isFinite(price) || price <= 0) {
        costEl.textContent = '\u2014';
        return;
    }
    costEl.textContent = (singleAnnualKwh * count * price).toLocaleString(undefined, {
        maximumFractionDigits: 0
    }) + '/yr';
}

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
        const clusterTypeForBtn = document.getElementById('cluster-type').value;
        const storagePercent = clusterTypeForBtn === 'disaggregated' ? 0 : (parseInt(document.getElementById('storage-percent').textContent) || 0);
        const overResources = [];
        if (computePercent >= 90) overResources.push('Compute');
        if (memoryPercent >= 90) overResources.push('Memory');
        if (storagePercent >= 90) overResources.push('Storage');
        const gpuSec = document.getElementById('gpu-capacity-section');
        if (gpuSec && gpuSec.style.display !== 'none') {
            const gpuPct = parseInt(document.getElementById('gpu-percent').textContent) || 0;
            if (gpuPct >= 90) overResources.push('GPU');
        }

        if (overResources.length > 0 && workloads.length > 0) {
            designerBtn.disabled = true;
            designerBtn.title = overResources.join(', ') + ' utilization must be below 90% before configuring in Designer';
        } else if (window._sizerVmExceedsNode) {
            designerBtn.disabled = true;
            designerBtn.title = 'One or more VMs exceed per-machine capacity. Reduce VM specs or increase hardware configuration.';
        } else {
            designerBtn.disabled = false;
            designerBtn.title = '';
        }
    }

    // Gate share URL buttons on workload presence
    const shareButtonIds = ['share-url-btn-header', 'share-url-btn-footer'];
    shareButtonIds.forEach(function(id) {
        const btn = document.getElementById(id);
        if (btn) {
            if (workloads.length === 0) {
                btn.disabled = true;
                btn.title = 'Add workload(s) before you can share your Sizer configuration with others';
            } else {
                btn.disabled = false;
                btn.title = 'Copy a shareable URL with your configuration encoded';
            }
        }
    });
}

// Map sizer cluster type to Designer scale value
function mapSizerToDesignerScale(clusterType) {
    if (clusterType === 'rack-aware') return 'rack_aware';
    if (clusterType === 'aldo-mgmt') return 'medium';
    if (clusterType === 'disaggregated') return 'medium';
    // Both 'single' and 'standard' map to 'medium' (Hyperconverged)
    return 'medium';
}

// Transfer sizer configuration to the Designer via localStorage
// ============================================
// Export Functions
// ============================================

// Export sizer results as PDF using html2canvas + jsPDF
function exportSizerPDF() { // eslint-disable-line no-unused-vars
    const sizerLayout = document.querySelector('.sizer-layout');
    if (!sizerLayout) {
        alert('No results to export. Add workloads first.');
        return;
    }

    showToast('Generating PDF — this may take a few seconds...', 'success');

    // Collect sections to capture individually for clean page breaks
    const sections = [];
    // Config panel sections
    const configPanel = document.querySelector('.config-panel');
    if (configPanel) {
        configPanel.querySelectorAll('.panel-section, .workloads-list, .cluster-config').forEach(function(s) {
            if (s.offsetHeight > 0) sections.push(s);
        });
    }
    // Results panel sections
    const resultsPanel = document.querySelector('.results-panel');
    if (resultsPanel) {
        resultsPanel.querySelectorAll('.panel-section, .requirements-grid, .per-node-section, .capacity-breakdown, .power-rack-estimate, #growth-projection-section, .notes-section, #multi-instance-section').forEach(function(s) {
            if (s.offsetHeight > 0 && s.style.display !== 'none') sections.push(s);
        });
    }

    // Expand all collapsed sections
    const allDetails = sizerLayout.querySelectorAll('details');
    const wasOpen = [];
    allDetails.forEach(function(d) { wasOpen.push(d.open); d.open = true; });

    // Hide buttons
    const hideEls = sizerLayout.querySelectorAll('.export-actions, #designer-action, .rack-viz-section, .workload-card-actions, .onboarding-overlay, .section-header-actions');
    hideEls.forEach(function(el) { el.style.display = 'none'; });

    const { jsPDF } = window.jspdf; // eslint-disable-line no-undef
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableW = pageWidth - margin * 2;

    // Header
    pdf.setFontSize(14);
    pdf.setTextColor(0, 120, 212);
    pdf.text('ODIN Sizer for Azure Local', margin, 12);
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text('Generated: ' + new Date().toLocaleString(), margin, 17);

    let currentY = 22;
    let sectionIndex = 0;

    function captureNextSection() {
        if (sectionIndex >= sections.length) {
            // Done — restore and save
            allDetails.forEach(function(d, i) { d.open = wasOpen[i]; });
            hideEls.forEach(function(el) { el.style.display = ''; });
            const st = getSizerState();
            const dateStr = new Date().toISOString().slice(0, 10);
            pdf.save('odin-sizer_' + (st.clusterType || 'standard') + '_' + (st.nodeCount || '0') + 'n_' + dateStr + '.pdf');
            showToast('PDF downloaded', 'success');
            return;
        }

        const section = sections[sectionIndex];
        html2canvas(section, {
            backgroundColor: '#000000',
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 800
        }).then(function(canvas) {
            const imgH = (canvas.height * usableW) / canvas.width;

            // If this section won't fit on current page, add a new page
            if (currentY + imgH > pageHeight - margin && currentY > 25) {
                pdf.addPage();
                currentY = margin;
            }

            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, currentY, usableW, imgH);
            currentY += imgH + 4; // 4mm gap between sections

            sectionIndex++;
            captureNextSection();
        }).catch(function() {
            sectionIndex++;
            captureNextSection();
        });
    }

    captureNextSection();
}

function exportSizerWord() {
    // Block export if storage limits are exceeded
    if (_storageLimitExceeded) {
        alert('Export blocked: The current storage configuration exceeds Azure Local supported limits (400 TB per machine or 4 PB per storage pool). Please reduce disk count, disk size, or machine count before exporting.');
        return;
    }

    const hwConfig = getHardwareConfig();
    const clusterType = document.getElementById('cluster-type').value;
    const nodeCount = document.getElementById('node-count').value;
    const resiliency = document.getElementById('resiliency').value;
    const futureGrowth = document.getElementById('future-growth').value;
    const resConfig = RESILIENCY_CONFIG[resiliency] || {};

    const clusterLabels = { 'single': 'Single Machine', 'standard': 'Hyperconverged', 'rack-aware': 'Rack-Aware Instance', 'aldo-mgmt': 'ALDO Management Cluster', 'disaggregated': 'Disaggregated Storage' };
    const storageLabels = { 'all-flash': 'All-Flash (NVMe or SSD)', 'mixed-flash': 'Mixed All-Flash (NVMe + SSD)', 'hybrid': 'Hybrid (SSD/NVMe + HDD)' };
    const growthLabels = { '0': 'None', '10': '10%', '20': '20%', '30': '30%', '50': '50%' };

    // Build workload rows
    let workloadRows = '';
    workloads.forEach(function(w) {
        const reqs = calculateWorkloadRequirements(w);
        // Long-form labels for the report (kept distinct from the short
        // workloadTypeDisplayName helper used in inline warnings).
        let typeLabel;
        switch (w.type) {
            case 'vm':           typeLabel = 'Virtual Machine'; break;
            case 'aks':          typeLabel = 'AKS Cluster'; break;
            case 'avd':          typeLabel = 'Azure Virtual Desktop'; break;
            case 'foundry':      typeLabel = 'Foundry Local'; break;
            case 'edgerag':      typeLabel = 'Edge RAG'; break;
            case 'videoindexer': typeLabel = 'AI Video Indexer'; break;
            case 'ghel':         typeLabel = 'GitHub Enterprise Local'; break;
            default:             typeLabel = w.type || 'Workload'; break;
        }
        workloadRows += '<tr><td>' + escapeHtmlSizer(w.name || typeLabel) + '</td><td>' + typeLabel + '</td><td>' + reqs.vcpus + '</td><td>' + reqs.memory + ' GB</td><td>' + (reqs.storage / 1000).toFixed(2) + ' TB</td></tr>';
    });

    // Read totals from the DOM
    const totalVcpus = document.getElementById('total-vcpus').textContent || '0';
    const totalMemory = document.getElementById('total-memory').textContent || '0';
    const totalStorage = document.getElementById('total-storage').textContent || '0';
    const perNodeCores = document.getElementById('per-node-cores').textContent || '0';
    const perNodeMemory = document.getElementById('per-node-memory').textContent || '0';
    const perNodeStorage = document.getElementById('per-node-storage').textContent || '0';
    const perNodeUsable = document.getElementById('per-node-usable').textContent || '0';
    const computePercent = document.getElementById('compute-percent').textContent || '0%';
    const memoryPercent = document.getElementById('memory-percent').textContent || '0%';
    const storagePercent = document.getElementById('storage-percent').textContent || '0%';
    const gpuPercent = document.getElementById('gpu-percent').textContent || '0%';
    const gpuVisible = document.getElementById('gpu-capacity-section') && document.getElementById('gpu-capacity-section').style.display !== 'none';

    // Disk config description
    let diskDesc = '';
    if (hwConfig.diskConfig.isTiered) {
        const cache = hwConfig.diskConfig.cache;
        const cap = hwConfig.diskConfig.capacity;
        diskDesc = 'Cache: ' + cache.count + 'x ' + formatDiskSize(cache.sizeGB) + ' (' + cache.type + ') + Capacity: ' + cap.count + 'x ' + formatDiskSize(cap.sizeGB) + ' (' + cap.type + ')';
    } else if (hwConfig.diskConfig.capacity) {
        const cap = hwConfig.diskConfig.capacity;
        diskDesc = cap.count + 'x ' + formatDiskSize(cap.sizeGB) + ' (' + cap.type + ')';
    }

    // Sizing notes
    const notesEl = document.getElementById('sizing-notes');
    let notesHtml = '';
    if (notesEl) {
        const items = notesEl.querySelectorAll('li');
        for (let i = 0; i < items.length; i++) {
            notesHtml += '<li>' + items[i].textContent + '</li>';
        }
    }

    const css = [
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

    let html = '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
        + '<head><meta charset="UTF-8"><title>ODIN Sizer Report</title><style>' + css + '</style></head><body>';

    html += '<h1>ODIN Sizer Report</h1>';
    html += '<p class="subtitle">Azure Local Instance Sizing Tool</p>';
    html += '<p class="timestamp">Generated: ' + new Date().toLocaleString() + '</p>';

    // Cluster Configuration
    html += '<h2>Cluster Configuration</h2>';
    html += '<table class="kv-table"><tbody>';
    html += '<tr><td>Deployment Type</td><td>' + (clusterLabels[clusterType] || clusterType) + '</td></tr>';
    html += '<tr><td>Machine Count</td><td>' + nodeCount + '</td></tr>';
    html += '<tr><td>Storage Resiliency</td><td>' + (resConfig.name || resiliency) + '</td></tr>';
    html += '<tr><td>Future Growth</td><td>' + (growthLabels[futureGrowth] || futureGrowth + '%') + '</td></tr>';
    html += '</tbody></table>';

    // Hardware Configuration
    html += '<h2>Hardware Configuration (per Machine)</h2>';
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
    html += '<h3>' + nodeCount + ' x Physical Machines Hardware Requirements:</h3>';
    html += '<p style="font-size:10pt; color:#555; margin:0 0 8pt;">- includes N+1 machines (for HA and update resiliency), compute uses a ' + getVcpuRatio() + ':1 vCPU overcommit ratio</p>';
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
    if (gpuVisible) {
        html += '<tr><td>GPU (Physical Units) - Consumed</td><td>' + gpuPercent + '</td></tr>';
    }
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
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const ts = new Date();
    const pad2 = function(n) { return n < 10 ? '0' + n : String(n); };
    const fileName = 'ODIN-Sizer-Report-' + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate()) + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes()) + '.doc';
    const a = document.createElement('a');
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
        alert('Configure in Designer blocked: The current storage configuration exceeds Azure Local supported limits (400 TB per machine or 4 PB per storage pool). Please reduce disk count, disk size, or machine count before proceeding.');
        return;
    }

    const clusterType = document.getElementById('cluster-type').value;

    // ALDO Management Cluster: always disconnected — show FQDN modal directly
    if (clusterType === 'aldo-mgmt') {
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

    // All other cluster types: ask Connected or Disconnected first
    showConnectivityChoice();
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
// Connected / Disconnected Choice
// ============================================

// Show connectivity choice modal before proceeding to Designer
function showConnectivityChoice() {
    // Remove any existing modal
    const existing = document.getElementById('connectivity-choice-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'connectivity-choice-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);';

    overlay.innerHTML = '<div style="background:var(--card-bg);border:1px solid var(--glass-border);border-radius:16px;padding:24px;max-width:500px;width:100%;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
        + '<h3 style="margin:0;color:var(--accent-blue);">Deployment Connectivity</h3>'
        + '<button onclick="document.getElementById(\'connectivity-choice-overlay\').remove()" style="background:transparent;border:none;color:var(--text-secondary);font-size:24px;cursor:pointer;">&times;</button>'
        + '</div>'
        + '<p style="color:var(--text-secondary);margin-bottom:20px;font-size:14px;">Will this cluster be cloud-connected or disconnected (air-gapped)?</p>'
        + '<div style="display:flex;flex-direction:column;gap:12px;">'
        + '<button onclick="selectConnectivity(\'connected\')" style="padding:16px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:var(--text-primary);border-radius:8px;cursor:pointer;text-align:left;font-size:14px;">'
        + '<strong style="color:var(--accent-blue);">Connected</strong><br><span style="font-size:12px;color:var(--text-secondary);">Cloud-connected deployment with full Azure Arc integration</span></button>'
        + '<button onclick="selectConnectivity(\'disconnected\')" style="padding:16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:var(--text-primary);border-radius:8px;cursor:pointer;text-align:left;font-size:14px;">'
        + '<strong style="color:#ef4444;">Disconnected</strong><br><span style="font-size:12px;color:var(--text-secondary);">Air-gapped operation with Autonomous Cloud endpoint</span></button>'
        + '</div></div>';

    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

// Handle connectivity choice
function selectConnectivity(mode) { // eslint-disable-line no-unused-vars
    const overlay = document.getElementById('connectivity-choice-overlay');
    if (overlay) overlay.remove();

    if (mode === 'disconnected') {
        // Store choice and show FQDN modal
        window._sizerConnectivityChoice = 'disconnected';
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
    } else {
        // Connected: show region picker
        window._sizerConnectivityChoice = 'connected';
        const modal = document.getElementById('region-picker-modal');
        const regionOverlay = document.getElementById('region-modal-overlay');
        if (modal && regionOverlay) {
            const commercialRadio = document.querySelector('input[name="region-cloud"][value="azure_commercial"]');
            if (commercialRadio) commercialRadio.checked = true;
            updateRegionOptions();
            modal.classList.add('active');
            regionOverlay.classList.add('active');
        }
    }
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

    // Disconnected workload cluster (non-ALDO): skip region picker
    if (clusterType !== 'aldo-mgmt' && window._sizerConnectivityChoice === 'disconnected') {
        window._aldoPendingFqdn = fqdn;
        window._sizerConnectivityChoice = 'disconnected';
        selectRegionAndConfigure('', '');
        return;
    }

    // ALDO Management Cluster: show region picker next
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

    // Determine connectivity mode from user choice or ALDO type
    const isAldo = clusterType === 'aldo-mgmt';
    const isDisconnected = isAldo || window._sizerConnectivityChoice === 'disconnected';
    const aldoFqdn = window._aldoPendingFqdn || null;
    if (isAldo || isDisconnected) {
        delete window._aldoPendingFqdn;
        delete window._sizerConnectivityChoice;
    }

    // Build the sizer-to-designer payload
    const sizerPayload = {
        source: 'sizer',
        timestamp: new Date().toISOString(),
        // Cluster name (carried Sizer → Designer → ARM). Optional; may be ''.
        clusterName: (document.getElementById('cluster-name') || {}).value || '',
        // Scenario: disconnected when ALDO or user chose disconnected
        scenario: isDisconnected ? 'disconnected' : 'connected',
        // Architecture: disaggregated or hyperconverged
        architecture: clusterType === 'disaggregated' ? 'disaggregated' : 'hyperconverged',
        // Disconnected cluster role
        clusterRole: isAldo ? 'management' : (isDisconnected ? 'workload' : undefined),
        autonomousCloudFqdn: aldoFqdn || undefined,
        fqdnConfirmed: aldoFqdn ? true : undefined,
        // Region selected by user
        cloud: cloud,
        region: region,
        // Designer-compatible fields
        scale: mapSizerToDesignerScale(clusterType),
        nodes: nodeCount,
        // Disaggregated-specific fields (passed through to Designer state)
        disaggStorageType: clusterType === 'disaggregated' ? ((document.getElementById('disagg-storage-type') || {}).value || 'fc_san') : undefined,
        disaggRackCount: clusterType === 'disaggregated' ? (parseInt((document.getElementById('disagg-rack-count') || {}).value, 10) || 2) : undefined,
        disaggNodesPerRack: clusterType === 'disaggregated' ? Math.ceil(parseInt(nodeCount, 10) / (parseInt((document.getElementById('disagg-rack-count') || {}).value, 10) || 2)) : undefined,
        disaggSpineCount: clusterType === 'disaggregated' ? (_designerSpineCount || 2) : undefined,
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
            },
            // Power, heat & rack-space estimate captured from the Sizer's
            // "Estimated Power, Heat & Rack Space per Instance" panel. These
            // surface on the Designer's report and as a dedicated Power & Heat
            // PPT slide. May be null if calculateRequirements() has not yet run.
            power: _lastPowerEstimate ? {
                perNodeW: _lastPowerEstimate.perNodeW,
                totalW: _lastPowerEstimate.totalW,
                totalBtu: _lastPowerEstimate.totalBtu,
                rackUnits: _lastPowerEstimate.rackUnits,
                infraPowerW: _lastPowerEstimate.infraPowerW,
                infraPowerNote: _lastPowerEstimate.infraPowerNote,
                components: _lastPowerEstimate.components
            } : null
        },
        // Individual workload details (transparent pass-through to Report)
        sizerWorkloads: workloads.map(function(w) {
            const req = calculateWorkloadRequirements(w);
            const entry = {
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
                case 'foundry':
                    entry.modelClass = w.modelClass;
                    entry.replicas = w.replicas;
                    entry.engine = w.engine;
                    if (w.modelClass === 'custom') {
                        entry.customVcpus = w.customVcpus;
                        entry.customMemory = w.customMemory;
                        entry.customStorage = w.customStorage;
                    }
                    break;
                case 'edgerag':
                    entry.computeMode = w.computeMode;
                    entry.corpusGB = w.corpusGB;
                    break;
                case 'videoindexer':
                    entry.configuration = w.configuration;
                    break;
                case 'ghel':
                    entry.tier = w.tier;
                    entry.replicas = getGhelReplicasFromWorkload(w);
                    entry.ha = entry.replicas >= 1;
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

// Export hardware BOM as CSV spreadsheet
function exportSizerCSV() { // eslint-disable-line no-unused-vars
    try {
        const st = getSizerState();
        const hwConfig = getHardwareConfig();
        const rows = [];
        rows.push(['Category', 'Item', 'Value']);

        // Cluster
        rows.push(['Cluster', 'Deployment Type', st.clusterType || 'standard']);
        rows.push(['Cluster', 'Number of Machines', st.nodeCount || '']);
        rows.push(['Cluster', 'Resiliency', st.resiliency || '']);
        rows.push(['Cluster', 'Future Growth', (st.futureGrowth || 0) + '%']);

        // CPU
        rows.push(['CPU', 'Manufacturer', st.cpuManufacturer || '']);
        rows.push(['CPU', 'Generation', hwConfig.generation ? hwConfig.generation.name : (st.cpuGeneration || '')]);
        rows.push(['CPU', 'Cores per Socket', st.cpuCores || '']);
        rows.push(['CPU', 'Sockets', st.cpuSockets || '']);
        rows.push(['CPU', 'Total Physical Cores per Machine', (parseInt(st.cpuCores, 10) || 0) * (parseInt(st.cpuSockets, 10) || 1)]);

        // Memory
        rows.push(['Memory', 'Per Machine (GB)', st.nodeMemory || '']);

        // Storage
        const isTiered = st.storageTiering === 'tiered';
        if (isTiered) {
            rows.push(['Storage', 'Type', 'Hybrid (Tiered)']);
            rows.push(['Storage', 'Cache Disk Count', st.cacheDiskCount || '']);
            rows.push(['Storage', 'Cache Disk Size (TB)', st.cacheDiskSize || '']);
            rows.push(['Storage', 'Capacity Disk Count', st.tieredCapacityDiskCount || '']);
            rows.push(['Storage', 'Capacity Disk Size (TB)', st.tieredCapacityDiskSize || '']);
        } else {
            rows.push(['Storage', 'Type', 'All-Flash']);
            rows.push(['Storage', 'Capacity Disk Count', st.capacityDiskCount || '']);
            rows.push(['Storage', 'Capacity Disk Size (TB)', st.capacityDiskSize || '']);
        }

        // GPU
        if (st.gpuCount && parseInt(st.gpuCount, 10) > 0) {
            const gpuModel = GPU_MODELS[st.gpuType];
            rows.push(['GPU', 'Model', gpuModel ? gpuModel.name : (st.gpuType || '')]);
            rows.push(['GPU', 'Per Machine', st.gpuCount]);
            rows.push(['GPU', 'VRAM (GB)', gpuModel ? gpuModel.vramGB : '']);
            rows.push(['GPU', 'TDP (W)', gpuModel ? gpuModel.tdpW : '']);
        }

        // Power estimates
        const perNodeEl = document.getElementById('power-per-node');
        const totalPowerEl = document.getElementById('power-total');
        const btuEl = document.getElementById('power-btu');
        const rackEl = document.getElementById('rack-units');
        if (perNodeEl && perNodeEl.textContent !== '—') {
            rows.push(['Power', 'Per Machine (est.)', perNodeEl.textContent]);
            rows.push(['Power', 'Total Instance (est.)', totalPowerEl ? totalPowerEl.textContent : '']);
            rows.push(['Power', 'BTU/hr (est.)', btuEl ? btuEl.textContent : '']);
            rows.push(['Rack', 'Rack Units (est.)', rackEl ? rackEl.textContent : '']);
        }

        // Workloads
        if (st.workloads && st.workloads.length > 0) {
            rows.push([]);
            rows.push(['Workload', 'Type', 'Detail', 'vCPUs', 'Memory (GB)', 'Storage (GB)', 'GPU']);
            st.workloads.forEach(function(w) {
                if (w.type === 'vm') {
                    const vmCount = w.count || 1;
                    const totalVcpus = (w.vcpus || 0) * vmCount;
                    const totalMem = (w.memory || 0) * vmCount;
                    const totalStor = (w.storage || 0) * vmCount;
                    rows.push(['Workload', 'Azure Local VM', vmCount + ' VMs (' + (w.vcpus || 0) + ' vCPU, ' + (w.memory || 0) + ' GB, ' + (w.storage || 0) + ' GB each)', totalVcpus, totalMem, totalStor, w.gpuEnabled ? 'Yes' : 'No']);
                } else if (w.type === 'aks') {
                    const aksReqs = calculateWorkloadRequirements(w);
                    const aksDetail = (w.clusterCount || 1) + ' cluster(s), ' + (w.controlPlaneNodes || 3) + ' CP + ' + (w.workerNodes || 3) + ' workers each';
                    rows.push(['Workload', 'AKS Arc', aksDetail, aksReqs.vcpus, aksReqs.memory, aksReqs.storage, w.gpuEnabled ? 'Yes' : 'No']);
                } else if (w.type === 'avd') {
                    const avdProfile = w.profile || 'medium';
                    const users = w.userCount || 0;
                    const reqs = calculateWorkloadRequirements(w);
                    rows.push(['Workload', 'AVD', users + ' users (' + avdProfile + ')', reqs.vcpus, reqs.memory, reqs.storage, w.gpuEnabled ? 'Yes' : 'No']);
                } else if (w.type === 'foundry') {
                    const foundryReqs = calculateWorkloadRequirements(w);
                    const foundryClass = w.modelClass === 'custom'
                        ? 'Custom (' + (w.customVcpus || 0) + ' vCPU / ' + (w.customMemory || 0) + ' GB / ' + (w.customStorage || 0) + ' GB per replica)'
                        : (FOUNDRY_MODEL_CLASSES[w.modelClass] && FOUNDRY_MODEL_CLASSES[w.modelClass].name) || (w.modelClass || 'medium');
                    const foundryDetail = (w.replicas || 1) + ' replica(s) \u00b7 ' + foundryClass + ' \u00b7 ' + (w.engine === 'vllm' ? 'vLLM' : 'ONNX-GenAI');
                    rows.push(['Workload', 'Foundry Local', foundryDetail, foundryReqs.vcpus, foundryReqs.memory, foundryReqs.storage, (w.gpuMode && w.gpuMode !== 'none') ? 'Yes' : 'No']);
                } else if (w.type === 'edgerag') {
                    const edgeragReqs = calculateWorkloadRequirements(w);
                    const edgeragDetail = EDGERAG_WORKER_NODES + ' worker VMs \u00b7 ' + (w.computeMode === 'cpu' ? 'CPU mode' : 'GPU mode') + ' \u00b7 ' + (w.corpusGB || 0) + ' GB corpus';
                    rows.push(['Workload', 'Edge RAG', edgeragDetail, edgeragReqs.vcpus, edgeragReqs.memory, edgeragReqs.storage, (w.gpuMode && w.gpuMode !== 'none') ? 'Yes' : 'No']);
                } else if (w.type === 'videoindexer') {
                    const viReqs = calculateWorkloadRequirements(w);
                    const isMin = w.configuration === 'minimum';
                    const viWorkers = isMin ? VI_MIN_WORKER_NODES : VI_REC_WORKER_NODES;
                    const viDetail = viWorkers + ' worker' + (viWorkers > 1 ? 's' : '') + ' \u00b7 ' + (isMin ? 'Minimum' : 'Recommended') + ' \u00b7 ' + (isMin ? VI_MIN_VCPU : VI_REC_VCPU) + ' vCPU / ' + (isMin ? VI_MIN_MEM_GB : VI_REC_MEM_GB) + ' GB cluster-wide';
                    rows.push(['Workload', 'AI Video Indexer', viDetail, viReqs.vcpus, viReqs.memory, viReqs.storage, (w.gpuMode && w.gpuMode !== 'none') ? 'Yes' : 'No']);
                } else if (w.type === 'ghel') {
                    const ghelReqs = calculateWorkloadRequirements(w);
                    const ghelTier = GHEL_TIERS[w.tier] || GHEL_TIERS['up-to-1000'];
                    const ghelReplicas = getGhelReplicasFromWorkload(w);
                    const ghelVms = 1 + ghelReplicas;
                    const ghelTopo = ghelReplicas === 0 ? 'Single VM'
                        : ghelReplicas === 1 ? 'HA pair (primary + 1 replica)'
                            : 'Primary + ' + ghelReplicas + ' replicas';
                    const ghelDetail = ghelVms + ' VM' + (ghelVms > 1 ? 's' : '') + ' \u00b7 ' + ghelTopo + ' \u00b7 ' + ghelTier.users + ' \u00b7 ' + ghelTier.vcpus + ' vCPU / ' + ghelTier.memory + ' GB / ' + (ghelTier.rootStorage + ghelTier.dataStorage) + ' GB per VM';
                    rows.push(['Workload', 'GitHub Enterprise Local', ghelDetail, ghelReqs.vcpus, ghelReqs.memory, ghelReqs.storage, 'No']);
                }
            });
        }

        // Convert to CSV string
        const csv = rows.map(function(row) {
            return row.map(function(cell) {
                const s = String(cell == null ? '' : cell);
                if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }).join(',');
        }).join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = 'odin-sizer-bom_' + (st.clusterType || 'standard') + '_' + (st.nodeCount || '0') + 'n_' + dateStr + '.csv';
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('CSV export failed:', e);
        alert('Failed to export CSV. See console for details.');
    }
}

// Share sizer configuration via URL (compressed base64 in query parameter)
function shareSizerURL() { // eslint-disable-line no-unused-vars
    if (workloads.length === 0) {
        showToast('Add at least one workload before sharing', 'error');
        return;
    }
    try {
        const clusterNameEl = document.getElementById('cluster-name');
        const defaultName = (clusterNameEl && clusterNameEl.value ? clusterNameEl.value.trim() : '').substring(0, 100);
        const shareName = prompt('Enter a name for this configuration (optional):', defaultName);
        if (shareName === null) return; // User cancelled

        const state = getSizerState();
        if (shareName.trim()) {
            // Limit to 100 characters
            state._shareName = shareName.trim().substring(0, 100);
        }
        const json = JSON.stringify(state);
        const encoded = btoa(unescape(encodeURIComponent(json)));
        const url = window.location.origin + window.location.pathname + '?config=' + encodeURIComponent(encoded);

        if (url.length > 8000) {
            alert('Configuration is too large to share via URL (' + Math.round(url.length / 1024) + ' KB). Use Export JSON instead.');
            return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function() {
                showToast('Shareable URL copied to clipboard!', 'success');
            }).catch(function() {
                prompt('Copy this URL to share your configuration:', url);
            });
        } else {
            prompt('Copy this URL to share your configuration:', url);
        }
    } catch (e) {
        console.error('Share URL failed:', e);
        alert('Failed to generate shareable URL. Use Export JSON instead.');
    }
}

// Import sizer configuration from URL query parameter on page load
function loadSizerFromURL() {
    const params = new URLSearchParams(window.location.search);
    const configParam = params.get('config');
    if (!configParam) return false;

    try {
        const json = decodeURIComponent(escape(atob(decodeURIComponent(configParam))));
        const data = JSON.parse(json);
        if (data && (data.clusterType || data.workloads)) {
            const shareName = data._shareName || '';
            applyImportedSizerState(data);
            // Clean URL after loading
            history.replaceState(null, '', window.location.pathname);
            // Dismiss any resume banner that may have been triggered
            const existingBanner = document.getElementById('sizer-resume-banner');
            if (existingBanner) existingBanner.remove();
            // Show a confirmation banner with Ok button
            const wlCount = data.workloads ? data.workloads.length : 0;
            let bannerMsg = shareName
                ? 'Shared configuration loaded: <strong>"' + escapeHtml(shareName) + '"</strong>'
                : 'Configuration loaded from a shared URL';
            if (wlCount > 0) bannerMsg += ' — ' + wlCount + ' workload(s)';
            const urlBanner = document.createElement('div');
            urlBanner.id = 'sizer-resume-banner';
            urlBanner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;padding:16px 24px;background:linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95));color:white;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-size:14px;font-weight:500;display:flex;align-items:center;gap:16px;animation:slideDown 0.3s ease;max-width:600px;';
            urlBanner.innerHTML = '<span>🔗 ' + bannerMsg + '</span>'
                + '<button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:white;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;">Ok</button>';
            document.body.appendChild(urlBanner);
            return true;
        }
    } catch (e) {
        console.error('Failed to load configuration from URL:', e);
    }
    return false;
}

// ============================================================================
// RVTools import (issue #230) — pure transform + cluster-name helpers
// ============================================================================
// These functions are deliberately pure (no DOM, no globals) so they are unit
// tested directly in tests/index.html. SheetJS turns the .xlsx binary into
// plain row arrays (the `sheet_to_json` shape); everything below operates on
// those already-extracted rows. Privacy: VM names are read ONLY in 'per-vm'
// mode (opt-in); the default 'grouped' mode never puts a VM name anywhere.

// Convert a mebibyte (MiB) value to whole gigabytes for Sizer workloads.
// RVTools reports Memory / Provisioned MiB / In Use MiB in MiB. We divide by
// 1024 and round to the nearest whole GB (minimum 1 so a workload is never 0).
function rvtoolsMiBToGB(mib) {
    const n = parseFloat(mib);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.max(1, Math.round(n / 1024));
}

// Is this vInfo row an RVTools template? `Template` is an RVTools boolean
// (is-this-a-template), surfaced as boolean true or the string "True".
function rvtoolsIsTemplate(row) {
    const t = row.Template;
    return t === true || String(t).trim().toLowerCase() === 'true';
}

// Is this vInfo row powered on? RVTools uses "poweredOn" / "poweredOff".
function rvtoolsIsPoweredOn(row) {
    return String(row.Powerstate).trim().toLowerCase() === 'poweredon';
}

// Format an aggregate capacity (GB) for the totals banner. Large figures
// (> 10000 GB) are rolled down to whole TB for readability; smaller figures
// stay in GB. Returns a bold-wrapped value plus its unit.
function rvtoolsFormatCapacity(gb) {
    const n = Number(gb) || 0;
    if (n > 10000) {
        return '<strong>' + Math.floor(n / 1024) + '</strong> TB';
    }
    return '<strong>' + n + '</strong> GB';
}

// Convert a GB figure to TB for the source-cluster table cells. Rounded to two
// decimals so small clusters still show a meaningful (non-zero) value.
function rvtoolsGBtoTB(gb) {
    return (Number(gb) || 0) / 1024;
}

// Pure transform: take extracted RVTools sheets + options, return a structured
// result the UI applies. Never throws on a missing vInfo — it returns a warning
// the caller surfaces as a friendly message.
//
//   sheets  = { vInfo: [ {VM, Powerstate, Template, CPUs, Memory,
//                         'Provisioned MiB', 'In Use MiB', Cluster, Host,
//                         Datacenter}, ... ], vCluster?: [...], vHost?: [...] }
//   options = { includePoweredOff: false, storageSource: 'provisioned'|'inuse',
//               mode: 'grouped'|'per-vm', cluster: '<name>'|null }
//
// Returns { clusters, workloads, totals, warnings }.
function transformRVToolsRows(sheets, options) {
    options = options || {};
    const includePoweredOff = !!options.includePoweredOff;
    const storageKey = options.storageSource === 'inuse' ? 'In Use MiB' : 'Provisioned MiB';
    const mode = options.mode === 'per-vm' ? 'per-vm' : 'grouped';
    // Accept either `clusters` (array, multi-select) or legacy `cluster` (string).
    let selectedClusters = null;
    if (Array.isArray(options.clusters) && options.clusters.length) {
        selectedClusters = options.clusters.slice();
    } else if (typeof options.cluster === 'string' && options.cluster) {
        selectedClusters = [options.cluster];
    }

    const warnings = [];
    const vInfo = sheets && sheets.vInfo;
    if (!Array.isArray(vInfo)) {
        warnings.push('missing-vinfo');
        return { clusters: [], workloads: [], totals: emptyRVToolsTotals(), warnings: warnings };
    }

    // Filter: drop templates always; drop powered-off unless asked to include.
    const included = vInfo.filter(function(row) {
        if (rvtoolsIsTemplate(row)) return false;
        if (!includePoweredOff && !rvtoolsIsPoweredOn(row)) return false;
        return true;
    });

    // Per-cluster summary (built from vInfo.Cluster alone — never depends on a
    // vCluster sheet being present). Drives the preview table / picker.
    const byCluster = {};
    const clusterOrder = [];
    included.forEach(function(row) {
        const cname = (row.Cluster === undefined || row.Cluster === null || row.Cluster === '')
            ? '(no cluster)' : String(row.Cluster);
        if (!byCluster[cname]) {
            byCluster[cname] = { name: cname, vmCount: 0, vcpus: 0, memoryGB: 0, storageGB: 0, hosts: {} };
            clusterOrder.push(cname);
        }
        const c = byCluster[cname];
        c.vmCount += 1;
        c.vcpus += parseInt(row.CPUs, 10) || 0;
        c.memoryGB += rvtoolsMiBToGB(row.Memory);
        c.storageGB += rvtoolsMiBToGB(row[storageKey]);
        if (row.Host !== undefined && row.Host !== null && row.Host !== '') {
            c.hosts[String(row.Host)] = true;
        }
    });
    const clusters = clusterOrder.map(function(name) {
        const c = byCluster[name];
        return {
            name: c.name,
            vmCount: c.vmCount,
            vcpus: c.vcpus,
            memoryGB: c.memoryGB,
            storageGB: c.storageGB,
            hostCount: Object.keys(c.hosts).length
        };
    });

    // Totals across all included VMs (banner), independent of the selection.
    const allHosts = {};
    included.forEach(function(row) {
        if (row.Host !== undefined && row.Host !== null && row.Host !== '') allHosts[String(row.Host)] = true;
    });
    const totals = {
        clusterCount: clusters.length,
        hostCount: Object.keys(allHosts).length,
        vmCount: included.length,
        vcpus: clusters.reduce(function(s, c) { return s + c.vcpus; }, 0),
        memoryGB: clusters.reduce(function(s, c) { return s + c.memoryGB; }, 0),
        storageGB: clusters.reduce(function(s, c) { return s + c.storageGB; }, 0)
    };

    // Rows that become workloads: VMs from the selected cluster(s). Two or more
    // clusters are consolidated into a single Sizer cluster (grouped bands merge
    // by size class; per-VM lists concatenate). If nothing is selected, fall back
    // to all included rows (used by tests and the combined preview).
    const workloadRows = selectedClusters
        ? included.filter(function(row) {
            const cname = (row.Cluster === undefined || row.Cluster === null || row.Cluster === '')
                ? '(no cluster)' : String(row.Cluster);
            return selectedClusters.indexOf(cname) !== -1;
        })
        : included;

    const workloads = mode === 'per-vm'
        ? buildPerVMWorkloads(workloadRows, storageKey)
        : buildGroupedWorkloads(workloadRows, storageKey);

    return { clusters: clusters, workloads: workloads, totals: totals, warnings: warnings };
}

function emptyRVToolsTotals() {
    return { clusterCount: 0, hostCount: 0, vmCount: 0, vcpus: 0, memoryGB: 0, storageGB: 0 };
}

// One workload per VM (opt-in). The workload NAME is the source VM name — the
// single place VM names are read into Sizer state. Stays client-side only.
function buildPerVMWorkloads(rows, storageKey) {
    return rows.map(function(row) {
        return {
            type: 'vm',
            name: String(row.VM === undefined || row.VM === null ? '' : row.VM),
            inputMode: 'per-vm',
            vcpus: parseInt(row.CPUs, 10) || 1,
            memory: rvtoolsMiBToGB(row.Memory),
            storage: rvtoolsMiBToGB(row[storageKey]),
            count: 1
        };
    });
}

// Grouped by VM size class (default). VMs band by (vCPU, RAM GB); each band is
// one workload named after its characteristics — never a VM name. Storage per
// VM is the band average (rounded) so count × storage ≈ band total.
function buildGroupedWorkloads(rows, storageKey) {
    const bands = {};
    const order = [];
    rows.forEach(function(row) {
        const vcpus = parseInt(row.CPUs, 10) || 1;
        const memGB = rvtoolsMiBToGB(row.Memory);
        const key = vcpus + '|' + memGB;
        if (!bands[key]) {
            bands[key] = { vcpus: vcpus, memory: memGB, count: 0, storageTotal: 0 };
            order.push(key);
        }
        bands[key].count += 1;
        bands[key].storageTotal += rvtoolsMiBToGB(row[storageKey]);
    });
    return order.map(function(key) {
        const b = bands[key];
        const perVMStorage = Math.max(1, Math.round(b.storageTotal / b.count));
        return {
            type: 'vm',
            name: b.vcpus + ' vCPU / ' + b.memory + ' GB \u00d7' + b.count,
            inputMode: 'per-vm',
            vcpus: b.vcpus,
            memory: b.memory,
            storage: perVMStorage,
            count: b.count
        };
    });
}

// --- Cluster name sanitiser + validator (shared with the ARM field) ---------
// Windows failover cluster / NetBIOS rules: 1–15 chars, letters/numbers/hyphen,
// not all-numeric, no leading/trailing hyphen.

// Map a raw (e.g. VMware) cluster name to a valid candidate: replace illegal
// chars with '-', collapse repeats, trim hyphens, truncate to 15, trim again.
// May return '' if the input has no usable characters — the caller then leaves
// the field blank rather than inventing a name.
function sanitiseClusterName(raw) {
    if (typeof raw !== 'string') return '';
    let s = raw.replace(/[^A-Za-z0-9-]/g, '-'); // illegal -> hyphen
    s = s.replace(/-+/g, '-');                  // collapse repeats
    s = s.replace(/^-+|-+$/g, '');              // trim hyphens
    if (s.length > 15) s = s.slice(0, 15);
    s = s.replace(/-+$/g, '');                  // truncation may leave a trailing hyphen
    return s;
}

// Validate the editable cluster-name field. Returns boolean.
function isValidClusterName(name) {
    if (typeof name !== 'string') return false;
    if (name.length < 1 || name.length > 15) return false;
    if (!/^[A-Za-z0-9-]+$/.test(name)) return false; // letters/numbers/hyphen only
    if (/^[0-9]+$/.test(name)) return false;          // not all-numeric
    if (name.charAt(0) === '-' || name.charAt(name.length - 1) === '-') return false; // no edge hyphen
    return true;
}

// Trigger file picker for JSON import
function importSizerJSON() { // eslint-disable-line no-unused-vars
    showImportModal();
}

// Open the import modal, optionally jumping straight to a named tab. The
// dedicated 📊 RVTools toolbar button calls openImportModal('rvtools').
function openImportModal(initialTab) { // eslint-disable-line no-unused-vars
    showImportModal(initialTab);
}

// Show the import modal
function showImportModal(initialTab) {
    const overlay = document.getElementById('import-modal-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        switchImportTab(initialTab || 'sizer');
        // Clear previous state
        const textarea = document.getElementById('cluster-json-input');
        if (textarea) textarea.value = '';
        const err = document.getElementById('cluster-json-error');
        if (err) err.style.display = 'none';
        const preview = document.getElementById('cluster-json-preview');
        if (preview) preview.style.display = 'none';
        const applyBtn = document.getElementById('cluster-import-apply-btn');
        if (applyBtn) applyBtn.style.display = 'none';
        // Restore the Parse & Preview button (hidden after a successful parse).
        const parseBtn = document.getElementById('cluster-import-parse-btn');
        if (parseBtn) parseBtn.style.display = '';
        window._pendingClusterImport = null;
    }
}

function closeImportModal() { // eslint-disable-line no-unused-vars
    const overlay = document.getElementById('import-modal-overlay');
    if (overlay) overlay.style.display = 'none';
}

function showHardwareWeightingInfo() { // eslint-disable-line no-unused-vars
    const overlay = document.getElementById('hw-weighting-info-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function closeHardwareWeightingInfo() { // eslint-disable-line no-unused-vars
    const overlay = document.getElementById('hw-weighting-info-overlay');
    if (overlay) overlay.style.display = 'none';
}

function switchImportTab(tab) { // eslint-disable-line no-unused-vars
    const panels = {
        sizer: document.getElementById('import-panel-sizer'),
        cluster: document.getElementById('import-panel-cluster'),
        rvtools: document.getElementById('import-panel-rvtools')
    };
    const tabs = {
        sizer: document.getElementById('import-tab-sizer'),
        cluster: document.getElementById('import-tab-cluster'),
        rvtools: document.getElementById('import-tab-rvtools')
    };
    if (tab !== 'sizer' && tab !== 'cluster' && tab !== 'rvtools') tab = 'sizer';
    Object.keys(panels).forEach(function(key) {
        if (panels[key]) panels[key].style.display = (key === tab) ? '' : 'none';
        if (tabs[key]) {
            tabs[key].className = 'onboarding-btn ' +
                (key === tab ? 'onboarding-btn-primary' : 'onboarding-btn-secondary');
        }
    });
    // Lazy-load the ~930 KB SheetJS blob only when the RVTools tab is first
    // activated — users of the other two tabs never download it.
    if (tab === 'rvtools') ensureSheetJSLoaded();
}

// Inject the vendored SheetJS <script> at most once per page load. Returns a
// Promise that resolves when XLSX is available (or rejects on load failure).
let _sheetJSPromise = null;
function ensureSheetJSLoaded() {
    if (typeof window.XLSX !== 'undefined') return Promise.resolve();
    if (_sheetJSPromise) return _sheetJSPromise;
    _sheetJSPromise = new Promise(function(resolve, reject) {
        const s = document.createElement('script');
        s.src = '../vendor/xlsx-0.20.3.min.js';
        s.async = true;
        s.onload = function() { resolve(); };
        s.onerror = function() {
            _sheetJSPromise = null;
            reject(new Error('Failed to load the Excel reader (vendor/xlsx-0.20.3.min.js).'));
        };
        document.head.appendChild(s);
    });
    return _sheetJSPromise;
}

function importSizerJSONFromModal() { // eslint-disable-line no-unused-vars
    closeImportModal();
    const fileInput = document.getElementById('sizer-import-file');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
}

function parseAndPreviewClusterJSON() { // eslint-disable-line no-unused-vars
    const textarea = document.getElementById('cluster-json-input');
    const errDiv = document.getElementById('cluster-json-error');
    const previewDiv = document.getElementById('cluster-json-preview');
    const applyBtn = document.getElementById('cluster-import-apply-btn');
    if (!textarea) return;

    // Issue #207 follow-up: if the user has already clicked Parse & Preview
    // once and then customised the in-preview controls (machine count,
    // deployment type, S2D disk count / size), preserve those choices across
    // a re-click of Parse & Preview so accidental re-parsing does not silently
    // reset their selections to the defaults.
    const previouslyVisible = previewDiv && previewDiv.style.display !== 'none' && previewDiv.innerHTML.trim() !== '';
    let preservedSelections = null;
    if (previouslyVisible) {
        const prevNodeInput = document.getElementById('cluster-node-count-input');
        const prevDeployRadio = document.querySelector('input[name="cluster-import-deploy-type"]:checked');
        const prevDiskCountSel = document.getElementById('cluster-import-disk-count');
        const prevDiskSizeSel = document.getElementById('cluster-import-disk-size');
        preservedSelections = {
            nodeCount: prevNodeInput ? prevNodeInput.value : null,
            deployType: prevDeployRadio ? prevDeployRadio.value : null,
            diskCount: prevDiskCountSel ? prevDiskCountSel.value : null,
            diskSize: prevDiskSizeSel ? prevDiskSizeSel.value : null
        };
    }

    errDiv.style.display = 'none';
    previewDiv.style.display = 'none';
    applyBtn.style.display = 'none';
    window._pendingClusterImport = null;

    const text = textarea.value.trim();
    if (!text) {
        errDiv.textContent = 'Please paste the Azure Local cluster JSON.';
        errDiv.style.display = '';
        return;
    }

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        errDiv.textContent = 'Invalid JSON: ' + e.message;
        errDiv.style.display = '';
        return;
    }

    // Validate it's an Azure Local machine resource
    const resourceType = (data.type || '').toLowerCase();
    const isNode = resourceType === 'microsoft.hybridcompute/machines';

    if (!isNode) {
        errDiv.textContent = 'Please paste the JSON View of a machine, not the instance. Navigate to a machine in your instance in the Azure Portal → JSON View.';
        errDiv.style.display = '';
        return;
    }

    let coreCount, memoryGiB, cpuMfr, sockets;

    // Node-level JSON — rich data available
    const nProps = data.properties;
    const hwProfile = nProps && nProps.hardwareProfile;
    const detected = nProps && nProps.detectedProperties;

    const clusterName = (nProps && nProps.displayName) || data.name || 'Unknown';
    const manufacturer = (detected && detected.manufacturer) || 'Unknown';
    const model = (detected && detected.model) || 'Unknown';

    // Extract sockets, total cores, and processor name from the JSON.
    //
    // Bug #207 follow-up: the two source paths in Azure Local machine JSON have
    // DIFFERENT semantics for "core count":
    //   • detectedProperties.coreCount      — TOTAL physical cores across all sockets
    //   • detectedProperties.processorCount — number of CPU sockets
    //   • hardwareProfile.processors[i].numberOfCores — cores PER SOCKET
    //   • hardwareProfile.numberOfCpuSockets          — number of CPU sockets
    //
    // Real-world payloads (e.g. ASEPRO2 / Intel Xeon Gold 6209U) sometimes omit
    // `hwProfile.numberOfCpuSockets`, so the previous code hit `sockets = 1` and
    // then mis-treated `proc.numberOfCores` (per-socket = 20) as if it were total
    // cores, producing "20 cores (20 × 1 socket)" for a real 2 × 10 = 20 cores
    // machine. We now prefer `detected` (which is unambiguous) and fall back to
    // hwProfile only when `detected` is missing or invalid.
    const procFromHw = (hwProfile && hwProfile.processors && hwProfile.processors[0]) || null;
    const processorName = (detected && detected.processorNames) || (procFromHw && procFromHw.name) || '';

    // Sockets: prefer detected.processorCount, fall back to hwProfile.numberOfCpuSockets
    const detectedSockets = detected ? parseInt(detected.processorCount, 10) : NaN;
    if (!isNaN(detectedSockets) && detectedSockets >= 1 && detectedSockets <= 8) {
        sockets = detectedSockets;
    } else if (hwProfile && hwProfile.numberOfCpuSockets >= 1 && hwProfile.numberOfCpuSockets <= 8) {
        sockets = hwProfile.numberOfCpuSockets;
    } else {
        sockets = 0; // unknown — heuristic below
    }

    // Total core count: prefer detected.coreCount (already total). Otherwise
    // derive from hwProfile.processors[0].numberOfCores × sockets.
    const detectedCores = detected ? parseInt(detected.coreCount, 10) : NaN;
    if (!isNaN(detectedCores) && detectedCores > 0) {
        coreCount = detectedCores;
    } else if (procFromHw && procFromHw.numberOfCores > 0) {
        // numberOfCores is per-socket; multiply by sockets when known.
        coreCount = procFromHw.numberOfCores * (sockets > 0 ? sockets : 1);
    } else {
        errDiv.textContent = 'No hardware profile found in the machine JSON.';
        errDiv.style.display = '';
        return;
    }

    if (hwProfile && hwProfile.totalPhysicalMemoryInBytes) {
        memoryGiB = Math.round(hwProfile.totalPhysicalMemoryInBytes / (1024 * 1024 * 1024));
    } else if (detected && detected.totalPhysicalMemoryInGigabytes) {
        memoryGiB = parseInt(detected.totalPhysicalMemoryInGigabytes, 10) || 0;
    } else {
        memoryGiB = 0;
    }

    const nodeCount = 2; // default — user sets in preview

    // Determine CPU manufacturer from processor name or heuristics
    cpuMfr = 'intel'; // default
    const cpuNameLower = (processorName || '').toLowerCase();
    if (cpuNameLower.indexOf('amd') !== -1 || cpuNameLower.indexOf('epyc') !== -1) {
        cpuMfr = 'amd';
    }

    let coresPerSocket = Math.round(coreCount / sockets);
    const dimmOptions = [64, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096];
    const snappedMemory = dimmOptions.reduce(function(prev, curr) {
        return Math.abs(curr - memoryGiB) < Math.abs(prev - memoryGiB) ? curr : prev;
    });
    // Preserve the actual imported memory value so we can inject a custom
    // option in the node-memory dropdown when the JSON value is not a standard
    // DIMM total (e.g. an 80 GB lab VM). Fixes silent rounding from 80 → 64 GB.
    const memoryIsCustom = (memoryGiB > 0 && memoryGiB !== snappedMemory);

    // Sanity-check the socket count from JSON. Some Azure Local machine JSON
    // payloads expose `numberOfCpuSockets` correctly (use as-is); when it is
    // missing or obviously wrong we fall back to a heuristic based on core count.
    // Bug #207 fix: do NOT unconditionally override the imported sockets value.
    if (!sockets || sockets < 1 || sockets > 8) {
        sockets = coreCount > 64 ? 2 : 1;
    }
    coresPerSocket = sockets > 0 ? Math.round(coreCount / sockets) : coreCount;

    // Find best matching CPU generation
    let bestGen = null;
    let genMatchConfidence = 'none';
    const gens = CPU_GENERATIONS[cpuMfr] || [];
    // Find the generation where coresPerSocket falls within the core range
    for (let g = 0; g < gens.length; g++) {
        const gen = gens[g];
        if (coresPerSocket >= gen.minCores && coresPerSocket <= gen.maxCores) {
            // Check if the exact core count is available as an option
            if (gen.coreOptions.indexOf(coresPerSocket) !== -1) {
                bestGen = gen;
                genMatchConfidence = 'exact';
                break;
            } else if (!bestGen) {
                bestGen = gen;
                genMatchConfidence = 'range';
            }
        }
    }
    // If no range match, find closest — but mark as uncertain
    if (!bestGen && gens.length > 0) {
        bestGen = gens.reduce(function(prev, curr) {
            return Math.abs(curr.maxCores - coresPerSocket) < Math.abs(prev.maxCores - coresPerSocket) ? curr : prev;
        });
        genMatchConfidence = 'approximate';
    }

    // Build preview.
    // CodeQL js/xss-through-dom (#15): coerce all numeric JSON-derived values
    // to Number() at the construction site so the analyser recognises a
    // type-narrowing barrier on the path from textarea.value → JSON.parse →
    // innerHTML. String values continue to be escaped via escapeHtml() below.
    coreCount = Number(coreCount) || 0;
    coresPerSocket = Number(coresPerSocket) || 0;
    sockets = Number(sockets) || 0;
    memoryGiB = Number(memoryGiB) || 0;
    let previewHTML = '<strong style="color: var(--accent-purple);">Detected Machine: ' + escapeHtml(clusterName) + '</strong><br>';
    previewHTML += '<div style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 12px;">';
    previewHTML += '<span style="grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 6px; font-size: 13px; font-weight: 600; margin-bottom: 4px;">How many machines in this instance? <input type="number" id="cluster-node-count-input" value="2" min="1" max="16" oninput="validateClusterImportSelection()" style="width: 56px; background: var(--card-bg); border: 2px solid var(--accent-purple); color: var(--text-primary); border-radius: 6px; padding: 4px 8px; font-size: 14px; font-weight: 700; text-align: center;"></span>';
    previewHTML += '<span style="grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 8px 12px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 6px; font-size: 13px; font-weight: 600; margin-bottom: 4px;">'
        + '<span>Deployment type:</span>'
        + '<label style="font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"><input type="radio" name="cluster-import-deploy-type" value="standard" checked onchange="validateClusterImportSelection()"> Hyperconverged</label>'
        + '<label style="font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"><input type="radio" name="cluster-import-deploy-type" value="rack-aware" onchange="validateClusterImportSelection()"> Rack-Aware Cluster</label>'
        + '<label style="font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"><input type="radio" name="cluster-import-deploy-type" value="disaggregated" onchange="validateClusterImportSelection()"> Disaggregated Storage</label>'
        + '<span style="font-weight: 400; color: var(--text-secondary); font-size: 11px;">(auto-switches to <strong>Single Machine</strong> if you set machines = 1)</span>'
        + '</span>';
    // Storage (S2D capacity disks per node) — not in the JSON, must be supplied by the user.
    // Issue #235: hidden when Disaggregated Storage is chosen (external SAN — no S2D disks).
    previewHTML += '<span id="cluster-import-s2d-row" style="grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 8px 12px; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 6px; font-size: 13px; font-weight: 600; margin-bottom: 4px;">'
        + '<span>S2D capacity disks per machine:</span>'
        + '<select id="cluster-import-disk-count" style="background: var(--card-bg); border: 1px solid var(--accent-green, #22c55e); color: var(--text-primary); border-radius: 6px; padding: 4px 8px; font-size: 13px; font-weight: 600;">'
        +   '<option value="2">2</option><option value="3">3</option><option value="4" selected>4</option>'
        +   '<option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option>'
        +   '<option value="10">10</option><option value="12">12</option><option value="16">16</option><option value="24">24</option>'
        + '</select>'
        + '<span>Capacity per disk:</span>'
        + '<select id="cluster-import-disk-size" style="background: var(--card-bg); border: 1px solid var(--accent-green, #22c55e); color: var(--text-primary); border-radius: 6px; padding: 4px 8px; font-size: 13px; font-weight: 600;">'
        +   '<option value="0.96">960 GB (0.96 TB)</option>'
        +   '<option value="1.92">1.92 TB</option>'
        +   '<option value="3.84" selected>3.84 TB</option>'
        +   '<option value="5.68">5.68 TB</option>'
        +   '<option value="7.68">7.68 TB</option>'
        +   '<option value="8">8 TB</option>'
        +   '<option value="12">12 TB</option>'
        +   '<option value="15.36">15.36 TB</option>'
        +   '<option value="16">16 TB</option>'
        +   '<option value="20">20 TB</option>'
        + '</select>'
        + '<span style="font-weight: 400; color: var(--text-secondary); font-size: 11px;">(not in the JSON — supply for accurate sizing)</span>'
        + '</span>';
    previewHTML += '<span style="grid-column: 1 / -1;" id="cluster-import-validation"></span>';
    previewHTML += '<span>Cores/Machine: <strong>' + coreCount + '</strong> (' + coresPerSocket + ' × ' + sockets + ' socket' + (sockets > 1 ? 's' : '') + ')</span>';
    if (memoryIsCustom) {
        previewHTML += '<span>Memory/Machine: <strong>' + memoryGiB + ' GB</strong> <em style="color: var(--warning);">(custom — not a standard DIMM total; will be added as a custom option in the dropdown)</em></span>';
    } else {
        previewHTML += '<span>Memory/Machine: <strong>' + memoryGiB + ' GB</strong> (DIMM-aligned)</span>';
    }
    previewHTML += '<span>Model: <strong>' + escapeHtml(model) + '</strong></span>';
    previewHTML += '<span>Manufacturer: <strong>' + escapeHtml(manufacturer) + '</strong></span>';
    if (processorName) {
        previewHTML += '<span>CPU: <strong>' + escapeHtml(processorName) + '</strong></span>';
    } else if (genMatchConfidence === 'exact') {
        previewHTML += '<span>CPU Generation: <strong>' + escapeHtml(bestGen.name) + '</strong></span>';
    } else if (bestGen) {
        previewHTML += '<span>CPU Generation: <strong>' + escapeHtml(bestGen.name) + '</strong> <em style="color: var(--warning);">(closest match)</em></span>';
    } else {
        previewHTML += '<span>CPU Generation: <em style="color: var(--text-secondary);">Not in catalog</em></span>';
    }
    previewHTML += '<span>Location: <strong>' + escapeHtml(data.location || '—') + '</strong></span>';
    previewHTML += '</div>';
    if (genMatchConfidence !== 'exact' && processorName) {
        previewHTML += '<div style="margin-top: 8px; color: var(--warning); font-size: 12px;">⚠️ CPU "' + escapeHtml(processorName) + '" is not in the current hardware catalog. The exact processor name and core count will be imported — verify the configuration after import.</div>';
    }

    previewDiv.innerHTML = previewHTML;
    previewDiv.style.display = '';
    applyBtn.style.display = '';

    // The data parsed cleanly and the physical-node preview is shown — hide the
    // Parse & Preview button so only "Load Cluster Configuration" remains as the
    // next step. To parse again, the user closes and reopens the import dialog
    // (showImportModal restores the button).
    const parseBtn = document.getElementById('cluster-import-parse-btn');
    if (parseBtn) parseBtn.style.display = 'none';
    // Issue #207 follow-up: restore any user-modified selections that were
    // captured at the top of this function so an accidental re-click of
    // Parse & Preview does not silently reset the user's choices.
    if (preservedSelections) {
        const restNodeInput = document.getElementById('cluster-node-count-input');
        if (restNodeInput && preservedSelections.nodeCount !== null && preservedSelections.nodeCount !== '') {
            restNodeInput.value = preservedSelections.nodeCount;
        }
        if (preservedSelections.deployType) {
            const restRadio = document.querySelector('input[name="cluster-import-deploy-type"][value="' + preservedSelections.deployType + '"]');
            if (restRadio) restRadio.checked = true;
        }
        const restDiskCountSel = document.getElementById('cluster-import-disk-count');
        if (restDiskCountSel && preservedSelections.diskCount) {
            const dcOpts = Array.prototype.map.call(restDiskCountSel.options, function(o) { return o.value; });
            if (dcOpts.indexOf(preservedSelections.diskCount) !== -1) {
                restDiskCountSel.value = preservedSelections.diskCount;
            }
        }
        const restDiskSizeSel = document.getElementById('cluster-import-disk-size');
        if (restDiskSizeSel && preservedSelections.diskSize) {
            const dsOpts = Array.prototype.map.call(restDiskSizeSel.options, function(o) { return o.value; });
            if (dsOpts.indexOf(preservedSelections.diskSize) !== -1) {
                restDiskSizeSel.value = preservedSelections.diskSize;
            }
        }
    }

    // Run an initial validation pass so the Load button reflects the default
    // selection (Hyperconverged + 2 machines = always valid, but this also
    // resets any stale error / disabled state from a previous preview).
    validateClusterImportSelection();

    // Store parsed data for apply
    window._pendingClusterImport = {
        clusterName: clusterName,
        nodeCount: nodeCount,
        coresPerSocket: coresPerSocket,
        sockets: sockets,
        memoryGB: memoryGiB > 0 ? memoryGiB : snappedMemory,
        memoryIsCustom: memoryIsCustom,
        cpuManufacturer: cpuMfr,
        cpuGeneration: bestGen ? bestGen.id : null,
        genMatchConfidence: genMatchConfidence,
        processorName: processorName || '',
        model: model
    };
}

// Validate the deployment-type + node-count combination chosen in the cluster
// JSON import preview. Disables the "Load Cluster Configuration" button and
// shows an inline error when Rack-Aware Cluster is selected with anything other
// than 2/4/6/8 machines (the only supported counts for that deployment type).
// Bug #207 follow-up.
function validateClusterImportSelection() { // eslint-disable-line no-unused-vars
    const nodeInput = document.getElementById('cluster-node-count-input');
    const applyBtn = document.getElementById('cluster-import-apply-btn');
    const msgEl = document.getElementById('cluster-import-validation');
    if (!nodeInput || !applyBtn) return;

    const nodeCount = parseInt(nodeInput.value, 10);
    const deployRadio = document.querySelector('input[name="cluster-import-deploy-type"]:checked');
    const deployType = deployRadio ? deployRadio.value : 'standard';

    // Issue #235: Disaggregated Storage uses an external SAN — the S2D capacity-disk
    // picker is irrelevant, so grey it out (and ignore it on apply).
    const s2dRow = document.getElementById('cluster-import-s2d-row');
    if (s2dRow) {
        const isDisagg = (deployType === 'disaggregated');
        s2dRow.style.opacity = isDisagg ? '0.4' : '';
        s2dRow.style.pointerEvents = isDisagg ? 'none' : '';
        s2dRow.title = isDisagg ? 'External SAN storage is used — S2D capacity disks do not apply' : '';
        const s2dCountEl = document.getElementById('cluster-import-disk-count');
        const s2dSizeEl = document.getElementById('cluster-import-disk-size');
        if (s2dCountEl) s2dCountEl.disabled = isDisagg;
        if (s2dSizeEl) s2dSizeEl.disabled = isDisagg;
    }

    const errors = [];
    if (isNaN(nodeCount) || nodeCount < 1 || nodeCount > 16) {
        errors.push('Number of machines must be between 1 and 16.');
    } else if (deployType === 'rack-aware' && nodeCount !== 1) {
        // 1 node is auto-switched to Single Node, so it is allowed at this
        // stage; we only block the radio's actual rack-aware case (2/4/6/8).
        const validRackAware = [2, 4, 6, 8];
        if (validRackAware.indexOf(nodeCount) === -1) {
            errors.push('Rack-Aware Cluster only supports 2, 4, 6, or 8 machines. Adjust the count or choose Hyperconverged.');
        }
    }

    if (errors.length === 0) {
        applyBtn.disabled = false;
        applyBtn.style.opacity = '';
        applyBtn.style.cursor = '';
        applyBtn.title = '';
        if (msgEl) {
            msgEl.innerHTML = '';
            msgEl.style.display = 'none';
        }
    } else {
        applyBtn.disabled = true;
        applyBtn.style.opacity = '0.55';
        applyBtn.style.cursor = 'not-allowed';
        applyBtn.title = errors.join(' ');
        if (msgEl) {
            msgEl.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 6px; color: var(--danger); font-size: 12px;">⚠️ ' + escapeHtml(errors.join(' ')) + '</span>';
            msgEl.style.display = '';
        }
    }
}

function applyClusterJSONImport() { // eslint-disable-line no-unused-vars
    const cfg = window._pendingClusterImport;
    if (!cfg) return;

    // Read the deployment-type radio BEFORE the modal closes.
    // Bug #207 fix: respect the user's choice between Hyperconverged and Rack-Aware,
    // and force Single Node when nodeCount === 1 regardless of the radio selection.
    const deployTypeRadio = document.querySelector('input[name="cluster-import-deploy-type"]:checked');
    const chosenDeployType = deployTypeRadio ? deployTypeRadio.value : 'standard';

    // Read the S2D capacity-disk choices supplied in the preview banner BEFORE
    // the modal closes. The Azure Local machine JSON does not enumerate S2D
    // capacity disks (they only appear after deployment), so the user supplies
    // them here for accurate sizing.
    const diskCountSel = document.getElementById('cluster-import-disk-count');
    const diskSizeSel = document.getElementById('cluster-import-disk-size');
    let chosenDiskCount = diskCountSel ? parseInt(diskCountSel.value, 10) : NaN;
    let chosenDiskSizeTB = diskSizeSel ? parseFloat(diskSizeSel.value) : NaN;
    if (isNaN(chosenDiskCount) || chosenDiskCount < 1) chosenDiskCount = null;
    if (isNaN(chosenDiskSizeTB) || chosenDiskSizeTB <= 0) chosenDiskSizeTB = null;

    // Re-check the deployment-type / node-count combination as a defense-in-depth
    // guard: the button is disabled when invalid, but a stale click or DOM
    // manipulation could still reach this code path.
    const preNodeInput = document.getElementById('cluster-node-count-input');
    const preNodeCount = preNodeInput ? parseInt(preNodeInput.value, 10) : NaN;
    if (chosenDeployType === 'rack-aware' && preNodeCount !== 1
        && [2, 4, 6, 8].indexOf(preNodeCount) === -1) {
        if (typeof showToast === 'function') {
            showToast('Rack-Aware Cluster only supports 2, 4, 6, or 8 machines. Adjust the count or choose Hyperconverged.', 'error');
        }
        return;
    }

    closeImportModal();

    // Apply to sizer dropdowns
    const nodeCountInput = document.getElementById('cluster-node-count-input');
    let actualNodeCount = nodeCountInput ? (parseInt(nodeCountInput.value, 10) || 2) : cfg.nodeCount;
    if (actualNodeCount < 1) actualNodeCount = 1;
    if (actualNodeCount > 16) actualNodeCount = 16;

    // Bug #207 fix: a 1-node cluster MUST be Single Node, not Hyperconverged.
    const resolvedClusterType = (actualNodeCount === 1) ? 'single' : chosenDeployType;

    // Issue #235: Disaggregated Storage uses an external SAN — there are no S2D
    // capacity disks to apply, so drop any disk choices from the equation.
    if (resolvedClusterType === 'disaggregated') {
        chosenDiskCount = null;
        chosenDiskSizeTB = null;
    }

    // Set node-count BEFORE cluster-type so that onClusterTypeChange() →
    // updateResiliencyOptions() sees the correct node count and produces the
    // right set of <option> entries (otherwise the resiliency select can be
    // populated for the old node count and silently reject our chosen value).
    const nodeCountEl = document.getElementById('node-count');
    if (nodeCountEl) nodeCountEl.value = String(actualNodeCount);
    _nodeCountUserSet = true;
    markManualSet('node-count');

    const clusterTypeEl = document.getElementById('cluster-type');
    if (clusterTypeEl) {
        clusterTypeEl.value = resolvedClusterType;
        if (typeof onClusterTypeChange === 'function') {
            try { onClusterTypeChange(); } catch (e) { console.warn('onClusterTypeChange threw during import:', e); }
        }
        markManualSet('cluster-type');
    }

    // Bug #207 fix: pick the correct storage resiliency for the chosen node count.
    // Two-way mirror is only valid for 2-node clusters; 3+ nodes should default
    // to Three-way mirror. Single-node has no mirror choice (handled by the
    // cluster type itself), but we still default it sensibly.
    const resiliencyEl = document.getElementById('resiliency');
    if (resiliencyEl && resolvedClusterType !== 'disaggregated') {
        const desiredResiliency = (actualNodeCount >= 3) ? '3way' : '2way';
        // Only assign if the option actually exists in the select (the cluster
        // type may have already constrained the available options, e.g.
        // rack-aware 4+ → only "4way").
        const available = Array.prototype.map.call(resiliencyEl.options, function(o) { return o.value; });
        if (available.indexOf(desiredResiliency) !== -1 && resiliencyEl.value !== desiredResiliency) {
            resiliencyEl.value = desiredResiliency;
            if (typeof onResiliencyChange === 'function') {
                try { onResiliencyChange(); } catch (e) { console.warn('onResiliencyChange threw during import:', e); }
            }
        }
        markManualSet('resiliency');
    }

    const cpuMfrEl = document.getElementById('cpu-manufacturer');
    if (cpuMfrEl) cpuMfrEl.value = cfg.cpuManufacturer;

    // Trigger generation dropdown population
    if (typeof onCpuManufacturerChange === 'function') {
        try { onCpuManufacturerChange(); } catch (e) { console.warn('onCpuManufacturerChange threw during import:', e); }
    }

    // Select the matched generation or inject imported processor name
    const genEl = document.getElementById('cpu-generation');
    if (cfg.processorName && genEl) {
        // Always show exact processor name from import when available
        const importedGenOption = document.createElement('option');
        importedGenOption.value = cfg.cpuGeneration || 'imported';
        importedGenOption.textContent = cfg.processorName + ' (imported)';
        genEl.insertBefore(importedGenOption, genEl.firstChild);
        genEl.value = importedGenOption.value;
        // Trigger core options if we have a valid generation
        if (cfg.cpuGeneration && typeof onCpuGenerationChange === 'function') {
            try { onCpuGenerationChange(); } catch (e) { console.warn('onCpuGenerationChange threw during import:', e); }
        }
    } else if (cfg.cpuGeneration && genEl) {
        genEl.value = cfg.cpuGeneration;
        if (typeof onCpuGenerationChange === 'function') {
            try { onCpuGenerationChange(); } catch (e) { console.warn('onCpuGenerationChange threw during import:', e); }
        }
    }
    markManualSet('cpu-manufacturer');
    markManualSet('cpu-generation');
    // Issue #235: an imported Azure Local instance has fixed hardware — lock CPU
    // so auto-scaling cannot silently change it (markManualSet only paints the
    // badge; the auto-scaler checks the _*UserSet flags).
    _cpuConfigUserSet = true;

    const cpuCoresEl = document.getElementById('cpu-cores');
    if (cpuCoresEl) {
        const options = Array.from(cpuCoresEl.options).map(function(o) { return parseInt(o.value, 10); });
        const exactMatch = options.indexOf(cfg.coresPerSocket) !== -1;

        if (exactMatch) {
            cpuCoresEl.value = String(cfg.coresPerSocket);
        } else {
            // Inject a custom option with the exact imported core count
            const importedOption = document.createElement('option');
            importedOption.value = String(cfg.coresPerSocket);
            importedOption.textContent = cfg.coresPerSocket + ' cores (imported)';
            // Insert in sorted position
            let inserted = false;
            for (let oi = 0; oi < cpuCoresEl.options.length; oi++) {
                if (parseInt(cpuCoresEl.options[oi].value, 10) > cfg.coresPerSocket) {
                    cpuCoresEl.insertBefore(importedOption, cpuCoresEl.options[oi]);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) cpuCoresEl.appendChild(importedOption);
            cpuCoresEl.value = String(cfg.coresPerSocket);
        }
    }
    markManualSet('cpu-cores');

    // Store imported CPU info for URL sharing / export persistence
    window._importedProcessorName = cfg.processorName || null;
    window._importedCoresPerSocket = cfg.coresPerSocket || null;

    const cpuSocketsEl = document.getElementById('cpu-sockets');
    if (cpuSocketsEl) cpuSocketsEl.value = String(cfg.sockets);
    markManualSet('cpu-sockets');

    const memEl = document.getElementById('node-memory');
    if (memEl) {
        // If the imported memory is a non-standard DIMM total (e.g. 80 GB lab VM),
        // inject a custom option so the actual value is preserved instead of being
        // silently rounded to the nearest standard DIMM size. Mirrors the cpu-cores
        // pattern above. Bug #207 follow-up.
        const memOptions = Array.from(memEl.options).map(function(o) { return parseInt(o.value, 10); });
        if (cfg.memoryGB && memOptions.indexOf(cfg.memoryGB) === -1) {
            const importedMemOption = document.createElement('option');
            importedMemOption.value = String(cfg.memoryGB);
            importedMemOption.textContent = cfg.memoryGB + ' GB (imported)';
            let memInserted = false;
            for (let mi = 0; mi < memEl.options.length; mi++) {
                if (parseInt(memEl.options[mi].value, 10) > cfg.memoryGB) {
                    memEl.insertBefore(importedMemOption, memEl.options[mi]);
                    memInserted = true;
                    break;
                }
            }
            if (!memInserted) memEl.appendChild(importedMemOption);
        }
        memEl.value = String(cfg.memoryGB);
    }
    markManualSet('node-memory');
    // Issue #235: lock imported memory so it does not auto-scale.
    _memoryUserSet = true;

    // Apply S2D capacity-disk choices supplied in the import preview to BOTH
    // the single-tier (capacity-disk-*) and tiered (tiered-capacity-disk-*)
    // selectors so the values are correct regardless of which storage
    // architecture the user later picks. Issue #207 follow-up.
    if (chosenDiskCount !== null) {
        ['capacity-disk-count', 'tiered-capacity-disk-count'].forEach(function(id) {
            const el = document.getElementById(id);
            if (!el) return;
            const avail = Array.from(el.options).map(function(o) { return parseInt(o.value, 10); });
            if (avail.indexOf(chosenDiskCount) !== -1) {
                el.value = String(chosenDiskCount);
                markManualSet(id);
            }
        });
        // Issue #235: lock imported capacity-disk count so it does not auto-scale.
        _diskCountUserSet = true;
    }
    if (chosenDiskSizeTB !== null) {
        ['capacity-disk-size', 'tiered-capacity-disk-size'].forEach(function(id) {
            const el = document.getElementById(id);
            if (!el) return;
            const avail = Array.from(el.options).map(function(o) { return parseFloat(o.value); });
            // Floating-point compare — match within 0.001 TB.
            const found = avail.some(function(v) { return Math.abs(v - chosenDiskSizeTB) < 0.001; });
            if (found) {
                el.value = String(chosenDiskSizeTB);
                markManualSet(id);
            }
        });
        // Issue #235: lock imported capacity-disk size so it does not auto-scale.
        _diskSizeUserSet = true;
    }

    calculateRequirements({ skipAutoNodeRecommend: true });

    // Show post-import instructions
    const summary = document.getElementById('post-import-summary');
    if (summary) {
        const deployTypeLabel = resolvedClusterType === 'single' ? 'Single Machine'
            : resolvedClusterType === 'rack-aware' ? 'Rack-Aware Cluster'
                : resolvedClusterType === 'disaggregated' ? 'Disaggregated Storage'
                    : 'Hyperconverged';
        let resiliencyLabel = '';
        if (resolvedClusterType !== 'single' && resolvedClusterType !== 'disaggregated') {
            resiliencyLabel = (actualNodeCount >= 3)
                ? ' Storage resiliency set to <strong>Three-way Mirror</strong>.'
                : ' Storage resiliency set to <strong>Two-way Mirror</strong>.';
        }
        let diskLabel = '';
        if (chosenDiskCount !== null && chosenDiskSizeTB !== null) {
            diskLabel = ' S2D capacity: <strong>' + chosenDiskCount + ' × ' + chosenDiskSizeTB + ' TB</strong> per machine.';
        }
        summary.innerHTML = 'Imported <strong>' + actualNodeCount + ' machine' + (actualNodeCount !== 1 ? 's' : '') + '</strong> from <strong>"' + escapeHtml(cfg.clusterName) + '"</strong>'
            + ' — ' + cfg.coresPerSocket + ' cores × ' + cfg.sockets + ' socket' + (cfg.sockets > 1 ? 's' : '') + ', ' + cfg.memoryGB + ' GB memory per machine.'
            + '<br>Deployment type: <strong>' + deployTypeLabel + '</strong>.' + resiliencyLabel + diskLabel
            + '<br><br>To complete your sizing, configure the items below to match your cluster:';
    }
    const postOverlay = document.getElementById('post-import-overlay');
    if (postOverlay) postOverlay.style.display = 'flex';

    showToast('"' + escapeHtml(cfg.clusterName) + '" imported (' + actualNodeCount + ' machines) — configure storage and add workloads', 'success');
}

function closePostImportOverlay() { // eslint-disable-line no-unused-vars
    const overlay = document.getElementById('post-import-overlay');
    if (overlay) overlay.style.display = 'none';
}

// ============================================================================
// RVTools import — UI handlers (issue #230)
// ============================================================================
// These wire the pure transform above to the modal: pick a file, read it with
// the lazily-loaded SheetJS, preview per-cluster totals, then apply the chosen
// cluster's VMs as Sizer workloads. The parsed sheets are held only in memory
// for the life of the modal interaction and discarded on close.

// Holds the extracted { vInfo, vCluster, vHost } row arrays between parse and
// apply. Never persisted. Exposed as window._rvtoolsSheets for test harness reset.
var _rvtoolsSheets = null; // eslint-disable-line no-var

// Last cluster-name value WE auto-populated from an RVTools import. Lets a
// subsequent import refresh the field to the newly-selected cluster, while
// still never clobbering a name the user typed themselves. Issue #230.
// Exposed as window._rvtoolsAutoClusterName for test harness reset.
var _rvtoolsAutoClusterName = ''; // eslint-disable-line no-var

function triggerRVToolsFilePicker() { // eslint-disable-line no-unused-vars
    const input = document.getElementById('rvtools-file');
    if (input) {
        input.value = '';
        input.click();
    }
}

// Clear all RVTools import UI + held workbook state so a previous import's
// preview never lingers (e.g. after the Reset button or a fresh import).
function resetRVToolsImport() {
    _rvtoolsSheets = null;
    _rvtoolsAutoClusterName = '';
    const input = document.getElementById('rvtools-file');
    if (input) input.value = '';
    const previewDiv = document.getElementById('rvtools-preview');
    if (previewDiv) { previewDiv.style.display = 'none'; previewDiv.innerHTML = ''; }
    const applyBtn = document.getElementById('rvtools-apply-btn');
    if (applyBtn) applyBtn.style.display = 'none';
    const status = document.getElementById('rvtools-status');
    if (status) { status.textContent = ''; status.style.display = 'none'; }
    const errDiv = document.getElementById('rvtools-error');
    if (errDiv) { errDiv.textContent = ''; errDiv.style.display = 'none'; }
}

function _showRVToolsError(msg) {
    const err = document.getElementById('rvtools-error');
    if (err) {
        err.textContent = msg;
        err.style.display = '';
    }
    const status = document.getElementById('rvtools-status');
    if (status) status.style.display = 'none';
}

// Read the selected .xlsx, extract the relevant sheets, and render the preview.
function handleRVToolsFile(event) { // eslint-disable-line no-unused-vars
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const errDiv = document.getElementById('rvtools-error');
    if (errDiv) errDiv.style.display = 'none';
    const previewDiv = document.getElementById('rvtools-preview');
    if (previewDiv) { previewDiv.style.display = 'none'; previewDiv.innerHTML = ''; }
    const applyBtn = document.getElementById('rvtools-apply-btn');
    if (applyBtn) applyBtn.style.display = 'none';
    _rvtoolsSheets = null;

    if (!/\.xlsx$/i.test(file.name)) {
        _showRVToolsError('Please select an RVTools .xlsx export (the "all" workbook).');
        return;
    }

    const status = document.getElementById('rvtools-status');
    if (status) { status.textContent = 'Reading "' + file.name + '"…'; status.style.display = ''; }

    ensureSheetJSLoaded().then(function() {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                _rvtoolsSheets = extractRVToolsSheets(workbook);
                const result = transformRVToolsRows(_rvtoolsSheets, { mode: 'grouped', storageSource: 'provisioned', includePoweredOff: false });
                if (result.warnings.indexOf('missing-vinfo') !== -1) {
                    _showRVToolsError('Could not find a "vInfo" sheet in this workbook. Export the full RVTools "all" workbook (it must include the vInfo tab).');
                    _rvtoolsSheets = null;
                    return;
                }
                if (status) status.style.display = 'none';
                renderRVToolsPreview(result);
            } catch (parseErr) {
                console.error('RVTools parse failed:', parseErr);
                _showRVToolsError('Could not read this file. If it is password-protected, open it in Excel and save an unprotected copy, then try again.');
                _rvtoolsSheets = null;
            }
        };
        reader.onerror = function() {
            _showRVToolsError('Could not read the file from disk. Please try again.');
            _rvtoolsSheets = null;
        };
        reader.readAsArrayBuffer(file);
    }).catch(function(loadErr) {
        console.error(loadErr);
        _showRVToolsError('Could not load the Excel reader. Check your connection to the page assets and try again.');
    });
}

// Pull the sheets we care about out of a SheetJS workbook as row-object arrays.
// Sheet names are matched case-insensitively (vInfo / vCluster / vHost).
function extractRVToolsSheets(workbook) {
    function sheetRows(target) {
        const match = workbook.SheetNames.filter(function(n) {
            return String(n).trim().toLowerCase() === target;
        })[0];
        if (!match) return null;
        return window.XLSX.utils.sheet_to_json(workbook.Sheets[match], { defval: '' });
    }
    return {
        vInfo: sheetRows('vinfo'),
        vCluster: sheetRows('vcluster'),
        vHost: sheetRows('vhost')
    };
}

// Re-run the transform with the currently selected options and update the
// totals banner. Called when the user flips storage source / powered-off.
function refreshRVToolsPreview() { // eslint-disable-line no-unused-vars
    if (!_rvtoolsSheets) return;
    const opts = readRVToolsOptions();
    const result = transformRVToolsRows(_rvtoolsSheets, { mode: opts.mode, storageSource: opts.storageSource, includePoweredOff: opts.includePoweredOff });
    renderRVToolsPreview(result, true);
}

// Select or clear every cluster checkbox in the picker table, then refresh.
function toggleAllRVToolsClusters(headerCheckbox) { // eslint-disable-line no-unused-vars
    const checks = document.querySelectorAll('input[name="rvtools-cluster"]');
    Array.prototype.forEach.call(checks, function(el) { el.checked = headerCheckbox.checked; });
    refreshRVToolsPreview();
}

function readRVToolsOptions() {
    const storageRadio = document.querySelector('input[name="rvtools-storage"]:checked');
    const modeRadio = document.querySelector('input[name="rvtools-mode"]:checked');
    const poweredOff = document.getElementById('rvtools-powered-off');
    const clusterChecks = document.querySelectorAll('input[name="rvtools-cluster"]:checked');
    return {
        storageSource: storageRadio ? storageRadio.value : 'provisioned',
        mode: modeRadio ? modeRadio.value : 'per-vm',
        includePoweredOff: !!(poweredOff && poweredOff.checked),
        clusters: Array.prototype.map.call(clusterChecks, function(el) { return el.value; })
    };
}

// In-place refresh helper for renderRVToolsPreview. Returns true if it
// successfully updated the existing DOM (cluster set unchanged), false if
// the caller should fall back to a full innerHTML rebuild. Updating in place
// preserves the modal's scroll position when the user clicks a cluster
// checkbox or flips one of the option radios.
function _updateRVToolsPreviewInPlace(previewDiv, result, selectedClusters) {
    const tbody = previewDiv.querySelector('.rvtools-table tbody');
    const totals = previewDiv.querySelector('.rvtools-totals');
    if (!tbody || !totals) return false;
    const rows = tbody.querySelectorAll('tr');
    if (rows.length !== result.clusters.length) return false;
    for (let i = 0; i < rows.length; i++) {
        const cb = rows[i].querySelector('input[type="checkbox"][name="rvtools-cluster"]');
        if (!cb || cb.value !== result.clusters[i].name) return false;
    }

    const t = result.totals;
    totals.innerHTML = 'Found <strong>' + t.vmCount + '</strong> VM' + (t.vmCount !== 1 ? 's' : '')
        + ' across <strong>' + t.clusterCount + '</strong> cluster' + (t.clusterCount !== 1 ? 's' : '')
        + (t.hostCount ? ' / <strong>' + t.hostCount + '</strong> host' + (t.hostCount !== 1 ? 's' : '') : '')
        + ' — <strong>' + t.vcpus + '</strong> vCPU, ' + rvtoolsFormatCapacity(t.memoryGB) + ' RAM, ' + rvtoolsFormatCapacity(t.storageGB) + ' storage total.'
        + '<br><span style="color: var(--text-secondary);">Pick one or more source clusters to size below — selecting several consolidates their workloads into one cluster.</span>';

    for (let i = 0; i < rows.length; i++) {
        const c = result.clusters[i];
        const cells = rows[i].querySelectorAll('td');
        if (cells.length < 7) continue;
        cells[2].textContent = c.vmCount;
        cells[3].textContent = c.hostCount || '—';
        cells[4].textContent = c.vcpus;
        cells[5].textContent = c.memoryGB;
        cells[6].textContent = rvtoolsGBtoTB(c.storageGB).toFixed(2);
    }

    const selectAll = previewDiv.querySelector('#rvtools-select-all');
    if (selectAll) {
        const selCount = result.clusters.filter(function(c) { return selectedClusters.indexOf(c.name) !== -1; }).length;
        selectAll.indeterminate = selCount > 0 && selCount < result.clusters.length;
        selectAll.checked = result.clusters.length > 0 && selCount === result.clusters.length;
    }

    const applyBtn = document.getElementById('rvtools-apply-btn');
    if (applyBtn) applyBtn.style.display = result.clusters.length ? '' : 'none';

    return true;
}

// Build the preview UI: totals banner, a per-cluster picker table, and the
// consolidation / storage / powered-off options. When `keepSelection` is true
// the existing cluster/option selections are preserved across a refresh.
function renderRVToolsPreview(result, keepSelection) {
    const previewDiv = document.getElementById('rvtools-preview');
    if (!previewDiv) return;

    const prev = keepSelection ? readRVToolsOptions() : null;
    // Selection rules: on a refresh (prev is set) respect the user's CURRENT
    // selection exactly — including an empty one — so the last-ticked cluster
    // can be cleared without it springing back. On the first render (prev is
    // null) start with nothing selected rather than auto-selecting the first
    // cluster, so the user is never stuck with a default they can't clear.
    const selectedClusters = prev ? (prev.clusters || []) : [];
    const storageSource = prev ? prev.storageSource : 'provisioned';
    const mode = prev ? prev.mode : 'per-vm';
    const includePoweredOff = prev ? prev.includePoweredOff : false;

    // Fast path: when only option/selection state changed (cluster set is
    // structurally identical to what's already rendered) update the totals
    // banner and per-row numeric cells in place. Avoids rewriting innerHTML,
    // which would reset the modal's scroll position on every checkbox click.
    if (keepSelection && _updateRVToolsPreviewInPlace(previewDiv, result, selectedClusters)) {
        return;
    }

    const t = result.totals;
    let html = '';
    html += '<div class="rvtools-totals">Found <strong>' + t.vmCount + '</strong> VM' + (t.vmCount !== 1 ? 's' : '')
        + ' across <strong>' + t.clusterCount + '</strong> cluster' + (t.clusterCount !== 1 ? 's' : '')
        + (t.hostCount ? ' / <strong>' + t.hostCount + '</strong> host' + (t.hostCount !== 1 ? 's' : '') : '')
        + ' — <strong>' + t.vcpus + '</strong> vCPU, ' + rvtoolsFormatCapacity(t.memoryGB) + ' RAM, ' + rvtoolsFormatCapacity(t.storageGB) + ' storage total.'
        + '<br><span style="color: var(--text-secondary);">Pick one or more source clusters to size below — selecting several consolidates their workloads into one cluster.</span></div>';

    const allSelected = result.clusters.length > 0 && result.clusters.every(function(c) { return selectedClusters.indexOf(c.name) !== -1; });
    html += '<div class="rvtools-table-wrap"><table class="rvtools-table"><thead><tr>'
        + '<th><input type="checkbox" id="rvtools-select-all" title="Select all clusters" aria-label="Select all clusters"' + (allSelected ? ' checked' : '') + ' onchange="toggleAllRVToolsClusters(this)"></th><th>Source cluster</th><th class="num">VMs</th><th class="num">Hosts</th>'
        + '<th class="num">vCPU</th><th class="num">Memory (GB)</th><th class="num">Storage (TB)</th>'
        + '</tr></thead><tbody>';
    result.clusters.forEach(function(c, i) {
        const id = 'rvtools-cluster-' + i;
        const checked = (selectedClusters.indexOf(c.name) !== -1) ? ' checked' : '';
        html += '<tr>'
            + '<td><input type="checkbox" name="rvtools-cluster" id="' + id + '" value="' + escapeHtml(c.name) + '"' + checked + ' onchange="refreshRVToolsPreview()"></td>'
            + '<td><label for="' + id + '">' + escapeHtml(c.name) + '</label></td>'
            + '<td class="num">' + c.vmCount + '</td>'
            + '<td class="num">' + (c.hostCount || '—') + '</td>'
            + '<td class="num">' + c.vcpus + '</td>'
            + '<td class="num">' + c.memoryGB + '</td>'
            + '<td class="num">' + rvtoolsGBtoTB(c.storageGB).toFixed(2) + '</td>'
            + '</tr>';
    });
    html += '</tbody></table></div>';

    html += '<div class="rvtools-options">'
        + '<fieldset><legend>Workload Entries - Consolidation</legend>'
        + '<label><input type="radio" name="rvtools-mode" value="per-vm"' + (mode === 'per-vm' ? ' checked' : '') + ' onchange="refreshRVToolsPreview()"> One workload per VM <span style="color: var(--text-secondary);">(reads VM names)</span></label>'
        + '<label><input type="radio" name="rvtools-mode" value="grouped"' + (mode === 'grouped' ? ' checked' : '') + ' onchange="refreshRVToolsPreview()"> One entry per VM size <span style="color: var(--text-secondary);">(grouped)</span></label>'
        + '</fieldset>'
        + '<fieldset><legend>Storage figure</legend>'
        + '<label><input type="radio" name="rvtools-storage" value="provisioned"' + (storageSource === 'provisioned' ? ' checked' : '') + ' onchange="refreshRVToolsPreview()"> Provisioned</label>'
        + '<label><input type="radio" name="rvtools-storage" value="inuse"' + (storageSource === 'inuse' ? ' checked' : '') + ' onchange="refreshRVToolsPreview()"> In use</label>'
        + '</fieldset>'
        + '<label><input type="checkbox" id="rvtools-powered-off"' + (includePoweredOff ? ' checked' : '') + ' onchange="refreshRVToolsPreview()"> Include powered-off VMs</label>'
        + '</div>';

    previewDiv.innerHTML = html;
    previewDiv.style.display = '';
    const selectAll = document.getElementById('rvtools-select-all');
    if (selectAll) {
        const selCount = result.clusters.filter(function(c) { return selectedClusters.indexOf(c.name) !== -1; }).length;
        selectAll.indeterminate = selCount > 0 && selCount < result.clusters.length;
    }
    const applyBtn = document.getElementById('rvtools-apply-btn');
    if (applyBtn) applyBtn.style.display = result.clusters.length ? '' : 'none';
}

// Apply the selected cluster's VMs as workloads, seed the cluster-name field,
// close the modal, and recalculate.
function applyRVToolsImport() { // eslint-disable-line no-unused-vars
    if (!_rvtoolsSheets) return;
    const opts = readRVToolsOptions();
    if (!opts.clusters.length) {
        _showRVToolsError('Select at least one source cluster to import.');
        return;
    }
    const result = transformRVToolsRows(_rvtoolsSheets, {
        mode: opts.mode,
        storageSource: opts.storageSource,
        includePoweredOff: opts.includePoweredOff,
        clusters: opts.clusters
    });
    if (!result.workloads.length) {
        _showRVToolsError('The selected cluster' + (opts.clusters.length !== 1 ? 's have' : ' has') + ' no VMs to import with the current options.');
        return;
    }

    // Assign ids and add to the in-memory workload list.
    result.workloads.forEach(function(w) {
        w.id = ++workloadIdCounter;
        workloads.push(w);
    });

    // Track the RVTools import as a single "Sizes Calculated" event. Issue #230.
    if (typeof trackFormCompletion === 'function') {
        trackFormCompletion('sizerCalculation');
    }

    // Seed the cluster-name field. For a single source cluster, use its name
    // (sanitised to failover-cluster rules); for a multi-cluster consolidation
    // use a generic "Consolidated" placeholder. Fill it when blank, or refresh it
    // when it still holds a value WE auto-populated from a previous import — but
    // never clobber a name the user typed themselves. Issue #230.
    const nameInput = document.getElementById('cluster-name');
    if (nameInput) {
        let seedSource = null;
        if (opts.clusters.length === 1 && opts.clusters[0] !== '(no cluster)') {
            seedSource = opts.clusters[0];
        } else if (opts.clusters.length > 1) {
            seedSource = 'Consolidated';
        }
        if (seedSource) {
            const currentName = nameInput.value.trim();
            const ourPriorAutoName = _rvtoolsAutoClusterName;
            if (currentName === '' || currentName === ourPriorAutoName) {
                const candidate = sanitiseClusterName(seedSource);
                if (candidate) {
                    nameInput.value = candidate;
                    _rvtoolsAutoClusterName = candidate;
                    onClusterNameInput();
                }
            }
        }
    }

    const importedCount = result.workloads.length;
    const clusterLabel = opts.clusters.join(', ');

    // Default the growth buffer to 10% for RVTools imports so the sized hardware
    // carries headroom — but only if the user hasn't already chosen a value
    // (i.e. it's still on the "No additional growth" default). Issue #230.
    const growthSel = document.getElementById('future-growth');
    let growthApplied = false;
    if (growthSel && (growthSel.value === '0' || growthSel.value === '')) {
        growthSel.value = '10';
        growthApplied = true;
    }

    // Totals for the imported workloads (count-weighted), shown in the summary.
    let impVms = 0, impVcpus = 0, impMemGB = 0, impStorageGB = 0;
    result.workloads.forEach(function(w) {
        const c = w.count || 1;
        impVms += c;
        impVcpus += (w.vcpus || 0) * c;
        impMemGB += (w.memory || 0) * c;
        impStorageGB += (w.storage || 0) * c;
    });

    _rvtoolsSheets = null;
    closeImportModal();
    renderWorkloads();
    calculateRequirements();

    // Post-import overlay (mirrors the Azure Local JSON import experience) —
    // richer than a toast, so we can surface totals, the growth default, and
    // the estimate caveats. Issue #230.
    const summary = document.getElementById('rvtools-post-import-summary');
    if (summary) {
        const modeLabel = opts.mode === 'per-vm' ? 'one workload per VM' : 'grouped by VM size';
        const storageLabel = opts.storageSource === 'inuse' ? 'in-use' : 'provisioned';
        const clusterCount = opts.clusters.length;
        const sourceLabel = clusterCount > 1
            ? clusterCount + ' source clusters consolidated (<strong>"' + escapeHtml(clusterLabel) + '"</strong>)'
            : 'source cluster <strong>"' + escapeHtml(clusterLabel) + '"</strong>';
        summary.innerHTML = 'Imported <strong>' + importedCount + '</strong> workload' + (importedCount !== 1 ? 's' : '')
            + ' (<strong>' + impVms + '</strong> VM' + (impVms !== 1 ? 's' : '') + ', ' + modeLabel + ')'
            + ' from ' + sourceLabel + '.'
            + '<br>Totals: <strong>' + impVcpus + '</strong> vCPU, <strong>' + impMemGB + '</strong> GB RAM, <strong>'
            + (impStorageGB / 1000).toFixed(2) + '</strong> TB ' + storageLabel + ' storage.'
            + (growthApplied
                ? '<br><br><em>Allow for Future Growth</em> has been set to <strong>10%</strong> for this import.'
                : '<br><br>Your existing <em>Allow for Future Growth</em> setting was kept.');
    }
    const postOverlay = document.getElementById('rvtools-post-import-overlay');
    if (postOverlay) postOverlay.style.display = 'flex';

    showToast('Imported ' + importedCount + ' workload' + (importedCount !== 1 ? 's' : '')
        + ' from ' + (opts.clusters.length > 1 ? opts.clusters.length + ' clusters' : '"' + escapeHtml(clusterLabel) + '"'), 'success');
}

function closeRVToolsPostImport() { // eslint-disable-line no-unused-vars
    const overlay = document.getElementById('rvtools-post-import-overlay');
    if (overlay) overlay.style.display = 'none';
}

// Inline validation for the editable cluster-name field. Shows a hint when the
// value is non-empty but invalid; clears it otherwise.
function onClusterNameInput() { // eslint-disable-line no-unused-vars
    const input = document.getElementById('cluster-name');
    const hint = document.getElementById('cluster-name-hint');
    const hintText = document.getElementById('cluster-name-hint-text');
    if (!input) return;
    const val = input.value;
    if (val === '') {
        input.classList.remove('invalid');
        if (hint) hint.style.display = 'none';
        return;
    }
    if (isValidClusterName(val)) {
        input.classList.remove('invalid');
        if (hint) hint.style.display = 'none';
    } else {
        input.classList.add('invalid');
        if (hint) hint.style.display = '';
        if (hintText) hintText.textContent = 'Cluster name must be 1–15 characters, use only letters, numbers and hyphens, not be all-numeric, and not start or end with a hyphen.';
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
    reader.onload = function(e) {
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

            // Confirm success, mirroring the Azure Local Instance and RVTools
            // import flows (which both end with a success toast). Without this,
            // importing a Sizer Configuration JSON gave zero feedback. Issue
            // raised: the file-based import felt inconsistent with the other two
            // import options. Use the post-apply workload count so the message
            // reflects what actually loaded.
            if (typeof showToast === 'function') {
                const importedWlCount = Array.isArray(workloads) ? workloads.length : 0;
                const importedName = (d.clusterName || '').toString().trim();
                let toastMsg = importedName
                    ? 'Imported "' + escapeHtml(importedName) + '"'
                    : 'Sizer configuration imported';
                if (importedWlCount > 0) {
                    toastMsg += ' — ' + importedWlCount + ' workload' + (importedWlCount !== 1 ? 's' : '');
                }
                showToast(toastMsg, 'success');
            }

        } catch (err) {
            console.error('Import parse error:', err);
            alert('Failed to parse the JSON file. Please ensure it is a valid ODIN Sizer export.');
        }
    };
    reader.readAsText(file);
}

// Apply an imported sizer state object to the UI (mirrors resumeSizerState)
function applyImportedSizerState(d) {
    // Import hardening (#237): the Sizer reads named properties off `d` rather
    // than bulk-copying into a target, so it is not directly prototype-pollutable;
    // but strip dangerous keys defensively in case future code iterates `d`, and
    // validate the workloads[] array shape before trusting it (a hand-edited or
    // malformed file could carry non-objects / unknown types that break the
    // renderer and calculator). Invalid entries are dropped with a soft warning —
    // the rest of the import still applies.
    if (d && typeof d === 'object') {
        ['__proto__', 'constructor', 'prototype'].forEach(function(k) {
            if (Object.prototype.hasOwnProperty.call(d, k)) {
                try { delete d[k]; } catch (e) { /* non-configurable — leave it, named reads ignore it */ }
            }
        });
    }
    const VALID_WORKLOAD_TYPES = ['vm', 'aks', 'avd', 'foundry', 'edgerag', 'videoindexer', 'ghel'];
    if (d && d.workloads !== undefined && d.workloads !== null) {
        if (!Array.isArray(d.workloads)) {
            console.warn('Import: workloads was not an array — ignoring it.');
            d.workloads = [];
        } else {
            const originalCount = d.workloads.length;
            d.workloads = d.workloads.filter(function(w) {
                return w && typeof w === 'object' && !Array.isArray(w) &&
                    typeof w.type === 'string' && VALID_WORKLOAD_TYPES.indexOf(w.type) !== -1;
            });
            if (d.workloads.length !== originalCount) {
                console.warn('Import: dropped ' + (originalCount - d.workloads.length) +
                    ' invalid workload entr' + ((originalCount - d.workloads.length) === 1 ? 'y' : 'ies') + '.');
            }
        }
    }

    // Restore cluster config
    document.getElementById('cluster-type').value = d.clusterType || 'standard';
    const clusterNameEl = document.getElementById('cluster-name');
    if (clusterNameEl) {
        clusterNameEl.value = d.clusterName || '';
        if (typeof onClusterNameInput === 'function') onClusterNameInput();
    }
    // Restore disaggregated rack count before updating node options
    if (d.clusterType === 'disaggregated' && d.disaggRackCount) {
        const rackEl = document.getElementById('disagg-rack-count');
        if (rackEl) rackEl.value = String(d.disaggRackCount);
    }
    if (d.disaggSpineCount) {
        _designerSpineCount = parseInt(d.disaggSpineCount, 10) || 2;
    }
    updateNodeOptionsForClusterType();
    updateStorageForClusterType();
    if (d.clusterType === 'disaggregated') updateDisaggregatedUI(true);
    document.getElementById('node-count').value = d.nodeCount || '3';
    document.getElementById('future-growth').value = d.futureGrowth || '10';
    const sizeFor5YrImport = document.getElementById('size-for-5yr-growth');
    if (sizeFor5YrImport) sizeFor5YrImport.value = (d.sizeFor5YrGrowth === true) ? 'yes' : 'no';

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

            // Inject imported core count if not a standard option
            if (d.importedCoresPerSocket && gen.coreOptions.indexOf(d.importedCoresPerSocket) === -1) {
                const impCoreOpt = document.createElement('option');
                impCoreOpt.value = String(d.importedCoresPerSocket);
                impCoreOpt.textContent = d.importedCoresPerSocket + ' cores (imported)';
                let inserted = false;
                for (let oi = 0; oi < coresSelect.options.length; oi++) {
                    if (parseInt(coresSelect.options[oi].value, 10) > d.importedCoresPerSocket) {
                        coresSelect.insertBefore(impCoreOpt, coresSelect.options[oi]);
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) coresSelect.appendChild(impCoreOpt);
                coresSelect.value = String(d.importedCoresPerSocket);
            }
        }

        // Inject imported processor name as generation option
        if (d.importedProcessorName) {
            const impGenOpt = document.createElement('option');
            impGenOpt.value = d.cpuGeneration || 'imported';
            impGenOpt.textContent = d.importedProcessorName + ' (imported)';
            genSelect.insertBefore(impGenOpt, genSelect.firstChild);
            genSelect.value = impGenOpt.value;
            window._importedProcessorName = d.importedProcessorName;
            window._importedCoresPerSocket = d.importedCoresPerSocket;
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
    // Spine count is always 2 (legacy saves may have had other values)

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

    // Restore Multi-Instance Scale-Out controls and the optional electricity prices.
    // The per-instance #power-price-input is static HTML so it can be set directly.
    // The multi-instance #multi-power-price-input is rendered dynamically inside
    // updateMultiInstanceSummary(), so we stash the value in _lastMultiPowerPrice
    // and let the render pick it up. instance-count must also be set BEFORE
    // calculateRequirements() runs so the multi-instance summary uses the restored
    // count rather than the default 1.
    const instanceCountEl = document.getElementById('instance-count');
    if (instanceCountEl && d.instanceCount) {
        const opt = Array.from(instanceCountEl.options).find(o => o.value === String(d.instanceCount));
        if (opt) instanceCountEl.value = String(d.instanceCount);
    }
    const powerPriceEl = document.getElementById('power-price-input');
    if (powerPriceEl && typeof d.powerPriceInput === 'string') {
        powerPriceEl.value = d.powerPriceInput;
    }
    if (typeof d.multiPowerPriceInput === 'string') {
        _lastMultiPowerPrice = d.multiPowerPriceInput;
    }

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
    _gpuCountUserSet = false;
    _nodeCountUserSet = false;
    _repairDisksUserSet = false;
    _disaggAutoUpgraded = false;
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
    document.getElementById('future-growth').value = '10';
    const sizeFor5YrReset = document.getElementById('size-for-5yr-growth');
    if (sizeFor5YrReset) sizeFor5YrReset.value = 'no';
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
    // Hide the disaggregated-only rows (Number of Racks, Storage Connectivity)
    // and re-enable the S2D storage fields. resetScenario() sets cluster-type
    // back to 'standard' directly rather than going through onClusterTypeChange(),
    // so without this the disaggregated UI stays visible after a reset from a
    // Disaggregated Storage configuration.
    updateDisaggregatedUI(false);
    // Restore the disaggregated controls to their HTML defaults so a later
    // switch back to Disaggregated Storage starts clean rather than carrying
    // the previous rack count / storage connectivity.
    const disaggRackEl = document.getElementById('disagg-rack-count');
    if (disaggRackEl) disaggRackEl.value = '2';
    const disaggStorageEl = document.getElementById('disagg-storage-type');
    if (disaggStorageEl) disaggStorageEl.value = 'fc_san';
    document.getElementById('node-count').value = '2';
    updateResiliencyOptions();
    document.getElementById('resiliency').value = '2way';

    // Reset Multi-Instance Scale-Out controls + optional electricity prices.
    // The multi-instance price input is rendered dynamically inside
    // updateMultiInstanceSummary(), and that re-render reads the live DOM value
    // first (to preserve user input across recalcs) — so we must clear the live
    // field *and* the cached fallback before calculateRequirements() re-renders.
    const instanceCountEl = document.getElementById('instance-count');
    if (instanceCountEl) instanceCountEl.value = '1';
    const powerPriceEl = document.getElementById('power-price-input');
    if (powerPriceEl) powerPriceEl.value = '';
    const multiPowerPriceEl = document.getElementById('multi-power-price-input');
    if (multiPowerPriceEl) multiPowerPriceEl.value = '';
    _lastMultiPowerPrice = '';

    updateClusterInfo();
    renderWorkloads();
    calculateRequirements();

    // Clear the editable cluster-name field and its inline validation hint.
    const clusterNameInput = document.getElementById('cluster-name');
    if (clusterNameInput) {
        clusterNameInput.value = '';
        onClusterNameInput();
    }

    // Clear any lingering RVTools import preview/state.
    resetRVToolsImport();
}

// Set default hardware config (Intel 6th Gen Xeon Granite Rapids / Sierra Forest, 32 cores)
function initHardwareDefaults() {
    const manufacturer = document.getElementById('cpu-manufacturer').value;
    if (!manufacturer) return;

    const generations = CPU_GENERATIONS[manufacturer];
    const genSelect = document.getElementById('cpu-generation');
    genSelect.innerHTML = generations.map(g =>
        `<option value="${g.id}" ${g.id === 'xeon-6' && manufacturer === 'intel' ? 'selected' : ''}>${g.name}</option>`
    ).join('');
    genSelect.disabled = false;

    // Set default generation
    const defaultGenId = manufacturer === 'intel' ? 'xeon-6' : generations[0].id;
    genSelect.value = defaultGenId;

    // Populate cores for the default generation
    const generation = generations.find(g => g.id === defaultGenId);
    if (generation) {
        const coresSelect = document.getElementById('cpu-cores');
        coresSelect.innerHTML = generation.coreOptions.map(c =>
            `<option value="${c}" ${c === generation.defaultCores ? 'selected' : ''}>${c} cores</option>`
        ).join('');
        coresSelect.disabled = false;
        coresSelect.value = String(generation.defaultCores);
    }
}

// Initialize on page load
let isInitialLoad = true;
document.addEventListener('DOMContentLoaded', function() {
    // Skip UI initialization when running in test harness (no sizer DOM elements present)
    if (window.__SIZER_TEST_MODE__) return;

    // Check for Designer-to-Sizer transfer BEFORE saved state check
    const designerImported = checkForDesignerImport();

    // Check for URL-based config sharing
    const urlImported = !designerImported && loadSizerFromURL();

    // Check for saved session BEFORE initial calc (so it doesn't get overwritten)
    if (!designerImported && !urlImported) {
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
    updateDesignerActionVisibility(); // Gate share/designer buttons on initial load

    // Flag the 10% Future Growth default as AUTO so users see it was a
    // recommended default and not their own choice. Skipped when a previous
    // session restored saved state — that value belongs to the user.
    const savedState = !designerImported && !urlImported && loadSizerState();
    if (!savedState) {
        markAutoScaled('future-growth');
    }

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

const SIZER_ONBOARDING_KEY = 'odin_sizer_onboarding_v0_22_62';

const sizerOnboardingSteps = [
    {
        icon: '<img src="../images/odin-logo.png" alt="ODIN Logo" style="width: 100px; height: 100px; object-fit: contain;">',
        isImage: true,
        title: 'Welcome to the ODIN Sizer',
        description: 'Plan your Azure Local hardware requirements by modelling workloads, resiliency, and capacity — before you buy.',
        features: [
            { icon: '🖥️', title: 'Workload Modelling', text: 'Add VMs, AKS Arc, AVD, GHEL, SQL, Foundry, and File Server workloads with CPU, memory, and storage needs' },
            { icon: '⚖️', title: 'Deployment Types', text: 'Single Node, Hyperconverged, Rack-Aware Cluster, Disaggregated Storage, or ALDO Management Cluster' },
            { icon: '📊', title: 'Live Capacity Bars', text: 'Compute, memory, storage, and GPU utilization update in real time as you add workloads' },
            { icon: '💾', title: 'Auto-Save & Import/Export', text: 'Progress is auto-saved locally — export/import JSON, or import an existing estate from an RVTools spreadsheet' }
        ]
    },
    {
        icon: '🔧',
        title: 'How It Works',
        description: 'Configure your cluster, add workloads, and let the sizer recommend the right hardware.',
        features: [
            { icon: '1️⃣', title: 'Choose Deployment Type', text: 'Single Node, Hyperconverged, Rack-Aware, Disaggregated, or ALDO Management — each with its own constraints' },
            { icon: '2️⃣', title: 'Add Workloads', text: 'Use the workload buttons (VM, AKS, AVD, SQL, GHEL, Foundry, File Server) to define your scenarios — or import from RVTools' },
            { icon: '3️⃣', title: 'Review Sizing', text: 'Auto-sizing recommends machine count, cores per machine, memory, and disks to fit your workloads' },
            { icon: '4️⃣', title: 'Send to Designer', text: 'Click "Configure in Designer" to transfer your config and pick matching hardware (opens in a new tab)' }
        ]
    },
    {
        icon: '⚡',
        title: 'Pro Tips',
        description: 'Get the most out of the ODIN Sizer with these features.',
        features: [
            { icon: '📈', title: 'Future Growth', text: '10% headroom is applied by default — adjust the slider (0–100%) to reserve capacity for future workload growth' },
            { icon: '🔄', title: 'Auto-Scaling', text: 'The engine scales up cores, memory, and disks per machine before adding more physical machines' },
            { icon: '🏗️', title: 'Disaggregated Storage', text: 'External SAN mode with 1–4 racks, up to 64 compute machines, no S2D local storage' },
            { icon: '📦', title: 'Multi-Instance Scale-Out', text: 'Model multiple identical instances (rooms, sites, regions) and see total racks, machines, power, and cost' },
            { icon: '📷', title: '3D Rack Visualization', text: 'Interactive 3D preview of your rack layout with multi-rack support and a full hardware bill of materials' }
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

// Toggle the rack-units breakdown disclosure beneath the value in the
// "Estimated Power, Heat & Rack Space per Instance" panel.
function toggleRackUnitsDetail() {
    const btn = document.getElementById('rack-units-toggle');
    const detail = document.getElementById('rack-units-detail');
    if (!btn || !detail) return;
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    detail.hidden = expanded;
}

function applyTheme() {
    const root = document.documentElement;
    const themeButton = document.getElementById('theme-toggle');
    const logo = document.getElementById('odin-logo') || document.querySelector('.odin-tab-logo img');

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
