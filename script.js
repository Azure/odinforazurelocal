// Odin for Azure Local - version for tracking changes
const WIZARD_VERSION = '0.4.2';
const WIZARD_STATE_KEY = 'azureLocalWizardState';
const WIZARD_TIMESTAMP_KEY = 'azureLocalWizardTimestamp';

const state = {
    scenario: null,
    region: null,
    localInstanceRegion: null,
    scale: null,
    nodes: null,
    witnessType: null,
    theme: 'dark',
    fontSize: 'medium',
    ports: null,
    storage: null,
    switchlessLinkMode: null,
    storagePoolConfiguration: null,
    rackAwareZones: null,
    rackAwareZonesConfirmed: false,
    rackAwareZoneSwapSelection: null,
    rackAwareTorsPerRoom: null,
    rackAwareTorArchitecture: null,
    intent: null,
    customIntentConfirmed: false,
    outbound: null,
    arc: null,
    proxy: null,
    ip: null,
    infra: null,
    infraCidr: null,
    infraCidrAuto: true,
    infraGateway: null,
    infraGatewayManual: false,
    nodeSettings: [],
    infraVlan: null,
    infraVlanId: null,
    storageAutoIp: null,
    activeDirectory: null,
    adDomain: null,
    adOuPath: null,
    adfsServerName: null,
    dnsServers: [],
    localDnsZone: null,
    dnsServiceExisting: null,
    sdnFeatures: [],
    sdnManagement: null,
    intentOverrides: {},
    customIntents: {},
    securityConfiguration: null, // 'recommended' or 'customized'
    securitySettings: {
        driftControlEnforced: true,
        bitlockerBootVolume: true,
        bitlockerDataVolumes: true,
        wdacEnforced: true,
        credentialGuardEnforced: true,
        smbSigningEnforced: true,
        smbClusterEncryption: true
    },
    rdmaGuardMessage: null
};

// Auto-save state to localStorage
function saveStateToLocalStorage() {
    try {
        const stateWithMeta = {
            version: WIZARD_VERSION,
            timestamp: new Date().toISOString(),
            data: state
        };
        localStorage.setItem(WIZARD_STATE_KEY, JSON.stringify(stateWithMeta));
        localStorage.setItem(WIZARD_TIMESTAMP_KEY, stateWithMeta.timestamp);
    } catch (e) {
        console.warn('Failed to save state to localStorage:', e);
    }
}

// Load state from localStorage
function loadStateFromLocalStorage() {
    try {
        const saved = localStorage.getItem(WIZARD_STATE_KEY);
        if (!saved) return null;
        
        const parsed = JSON.parse(saved);
        if (parsed.version && parsed.data) {
            return parsed;
        }
        return null;
    } catch (e) {
        console.warn('Failed to load state from localStorage:', e);
        return null;
    }
}

// Clear saved state
function clearSavedState() {
    try {
        localStorage.removeItem(WIZARD_STATE_KEY);
        localStorage.removeItem(WIZARD_TIMESTAMP_KEY);
    } catch (e) {
        console.warn('Failed to clear saved state:', e);
    }
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Enhanced sanitization for various contexts
function sanitizeInput(input, type = 'text') {
    if (!input) return '';
    const str = String(input).trim();
    
    switch (type) {
        case 'html':
            return escapeHtml(str);
        case 'json':
            return JSON.stringify(str).slice(1, -1);
        case 'url':
            return encodeURIComponent(str);
        case 'filename':
            return str.replace(/[^a-z0-9_\-\.]/gi, '_');
        default:
            return escapeHtml(str);
    }
}

// Copy to clipboard utility
function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMessage, 'success');
        }).catch(err => {
            fallbackCopyToClipboard(text, successMessage);
        });
    } else {
        fallbackCopyToClipboard(text, successMessage);
    }
}

function fallbackCopyToClipboard(text, successMessage) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast(successMessage, 'success');
    } catch (err) {
        showToast('Failed to copy to clipboard', 'error');
    }
    document.body.removeChild(textArea);
}

// Toast notification system
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function reportUiError(err, context) {
    try {
        const message = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
        const text = `UI error${context ? ` (${context})` : ''}: ${message}`;
        // eslint-disable-next-line no-console
        console.error(text);

        let banner = document.getElementById('__ui-error-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = '__ui-error-banner';
            banner.style.position = 'fixed';
            banner.style.left = '16px';
            banner.style.right = '16px';
            banner.style.bottom = '16px';
            banner.style.zIndex = '9999';
            banner.style.padding = '12px 14px';
            banner.style.borderRadius = '10px';
            banner.style.background = 'var(--card-bg)';
            banner.style.border = '1px solid var(--accent-purple)';
            banner.style.color = 'var(--text-primary)';
            banner.style.fontSize = '12px';
            banner.style.whiteSpace = 'pre-wrap';
            banner.style.maxHeight = '35vh';
            banner.style.overflow = 'auto';

            const close = document.createElement('button');
            close.type = 'button';
            close.textContent = 'Dismiss';
            close.style.marginLeft = '12px';
            close.style.background = 'transparent';
            close.style.border = '1px solid var(--glass-border)';
            close.style.color = 'var(--text-primary)';
            close.style.borderRadius = '8px';
            close.style.padding = '4px 8px';
            close.style.cursor = 'pointer';
            close.addEventListener('click', () => banner.remove());

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.justifyContent = 'space-between';
            header.style.gap = '12px';

            const title = document.createElement('div');
            title.textContent = 'JavaScript runtime error (wizard UI)';
            title.style.fontWeight = '700';
            title.style.color = 'var(--accent-purple)';

            header.appendChild(title);
            header.appendChild(close);

            const body = document.createElement('div');
            body.id = '__ui-error-banner-body';
            body.style.marginTop = '8px';

            banner.appendChild(header);
            banner.appendChild(body);
            document.body.appendChild(banner);
        }

        const body = document.getElementById('__ui-error-banner-body');
        if (body) body.textContent = text;
    } catch (e) {
        // Last resort: swallow to avoid cascading failures.
    }
}

function computeWizardProgress() {
    // Progress is based on concrete, user-facing completion checkpoints.
    // Some checkpoints are conditional (e.g., default gateway only for static IP).
    const checks = [];
    const add = (label, done) => checks.push({ label, done: Boolean(done) });

    add('Deployment Type', Boolean(state.scenario));
    add('Azure Cloud', Boolean(state.region));
    add('Azure Local Instance Region', Boolean(state.localInstanceRegion));
    add('Cluster Scale', Boolean(state.scale));
    add('Nodes', Boolean(state.nodes));

    if (state.scale === 'rack_aware' && state.nodes) {
        const z = state.rackAwareZones;
        add('Local availability zones', Boolean(z && z.zone1Name && z.zone2Name && z.assignments && state.rackAwareZonesConfirmed));
        add('TOR switch architecture', Boolean(state.rackAwareTorsPerRoom && state.rackAwareTorArchitecture));
    }

    add('Ports', Boolean(state.ports));
    add('Storage Connectivity', Boolean(state.storage));
    add('Storage Pool Configuration', Boolean(state.storagePoolConfiguration));
    add('Traffic Intent', Boolean(state.intent));
    add('Outbound Connectivity', Boolean(state.outbound));
    add('Arc Gateway', Boolean(state.arc));
    add('Proxy', Boolean(state.proxy));
    add('IP Assignment', Boolean(state.ip));

    // Node settings appear after nodes + IP selection.
    if (state.nodes && state.nodes !== '16+' && state.ip) {
        const readiness = getNodeSettingsReadiness();
        add('Node Names/IPs', readiness.ready);
    }

    add('Infrastructure VLAN', Boolean(state.infraVlan));

    // Infrastructure network inputs
    add('Infrastructure CIDR', Boolean(state.infraCidr));
    add('Infrastructure IP Pool', Boolean(state.infra && state.infra.start && state.infra.end));

    if (state.ip === 'static') {
        add('Default Gateway', Boolean(state.infraGateway));
    }

    // Identity + DNS
    add('Identity Selection', Boolean(state.activeDirectory));
    if (state.activeDirectory === 'azure_ad') {
        add('AD Domain', Boolean(state.adDomain));
    }
    add('DNS Servers', Array.isArray(state.dnsServers) && state.dnsServers.filter(s => s && String(s).trim()).length > 0);
    if (state.activeDirectory === 'local_identity') {
        add('Local DNS Zone', Boolean(state.localDnsZone));
    }

    // Security Configuration
    add('Security Configuration', Boolean(state.securityConfiguration));

    // SDN management becomes required only when SDN features are selected.
    if (state.sdnFeatures && state.sdnFeatures.length > 0) {
        add('SDN Management', Boolean(state.sdnManagement));
    }

    const total = checks.length;
    const completed = checks.filter(c => c.done).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percent, checks };
}

function updateProgressUi() {
    const root = document.getElementById('wizard-progress');
    const text = document.getElementById('wizard-progress-text');
    const fill = document.getElementById('wizard-progress-fill');
    if (!root || !text || !fill) return;

    const p = computeWizardProgress();
    text.textContent = `${p.percent}% • ${p.completed}/${p.total}`;
    fill.style.width = `${p.percent}%`;
    root.setAttribute('aria-valuenow', String(p.percent));

    const bar = root.querySelector('[role="progressbar"]');
    if (bar) bar.setAttribute('aria-valuenow', String(p.percent));
}

window.addEventListener('error', (e) => {
    reportUiError(e && e.error ? e.error : (e && e.message ? new Error(e.message) : e), 'window.error');
});
window.addEventListener('unhandledrejection', (e) => {
    reportUiError(e && e.reason ? e.reason : e, 'unhandledrejection');
});

function getReportReadiness() {
    const missing = [];

    // If Multi-Rack, wizard intentionally stops early.
    if (state.scenario === 'multirack') {
        missing.push('Scenario must not be Multi-Rack (report is not available for Multi-Rack flow)');
        return { ready: false, missing };
    }

    if (!state.scenario) missing.push('Deployment Type');
    if (!state.region) missing.push('Azure Cloud');
    if (!state.localInstanceRegion) missing.push('Azure Local Instance Region');
    if (!state.scale) missing.push('Scale');
    if (!state.nodes) missing.push('Nodes');
    if (!state.witnessType) missing.push('Cloud Witness Type');

    if (state.scale === 'rack_aware') {
        const z = state.rackAwareZones;
        if (!(z && z.zone1Name && z.zone2Name && z.assignments && state.rackAwareZonesConfirmed)) {
            missing.push('Local availability zones');
        }
        if (!state.rackAwareTorsPerRoom) missing.push('ToR switches per room');
        if (!state.rackAwareTorArchitecture) missing.push('ToR switch architecture');
    }
    if (!state.storage) missing.push('Storage Connectivity');
    if (!state.ports) missing.push('Ports');
    if (!state.storagePoolConfiguration) missing.push('Storage Pool Configuration');
    if (!state.intent) missing.push('Traffic Intent');
    if (!state.outbound) missing.push('Outbound Connectivity');
    if (!state.arc) missing.push('Azure Arc Gateway');
    if (!state.proxy) missing.push('Proxy');
    if (!state.ip) missing.push('IP Assignment');

    // Static IP deployments require a default gateway.
    if (state.ip === 'static' && !state.infraGateway) missing.push('Default Gateway');

    // Node settings (names + IP CIDR)
    const nodeReadiness = getNodeSettingsReadiness();
    if (!nodeReadiness.ready) missing.push(...nodeReadiness.missing);

    // Infra VLAN defaults are applied in flow, but still treat as required.
    if (!state.infraVlan) missing.push('Infrastructure VLAN');
    if (state.infraVlan === 'custom' && !state.infraVlanId) missing.push('Infrastructure VLAN ID');

    if (!state.activeDirectory) {
        missing.push('Identity (Active Directory / Local Identity)');
    } else {
        if (state.activeDirectory === 'azure_ad' && !state.adDomain) missing.push('Active Directory Domain Name');
        // DNS required for both identity options in this wizard.
        if (!state.dnsServers || state.dnsServers.length <= 0) missing.push('DNS Servers');
        if (state.activeDirectory === 'local_identity' && !state.localDnsZone) missing.push('Local DNS Zone Name');
    }

    // Security Configuration
    if (!state.securityConfiguration) {
        missing.push('Security Configuration');
    }

    // SDN: optional features; but if selected, management is required.
    if (state.sdnFeatures && state.sdnFeatures.length > 0 && !state.sdnManagement) {
        missing.push('SDN Management');
    }

    // Custom intent: require confirm.
    if (state.intent === 'custom' && !state.customIntentConfirmed) {
        missing.push('Confirm adapter mapping for Custom intent');
    }

    // Step 07: Port Configuration validation
    // Unless Low Capacity, require a minimum number of RDMA-capable ports (varies by topology).
    try {
        const requiredRdma = getRequiredRdmaPortCount();
        const cfg = Array.isArray(state.portConfig) ? state.portConfig : null;
        if (requiredRdma > 0 && cfg && cfg.length > 0) {
            const rdmaEnabled = cfg.filter(p => p && p.rdma === true).length;
            if (rdmaEnabled < requiredRdma) {
                missing.push('RDMA: At least ' + String(requiredRdma) + ' port(s) must be RDMA-capable (Step 07)');
            }
        }
    } catch (e) {
        // ignore
    }

    // Step 08: Ensure RDMA-enabled ports map to Storage traffic NICs.
    try {
        const cfg = Array.isArray(state.portConfig) ? state.portConfig : null;
        const p = state.ports ? parseInt(state.ports, 10) : NaN;
        const portCount = Number.isFinite(p) ? p : 0;
        if (cfg && portCount > 0 && state.intent) {
            const storageIndices = getStorageNicIndicesForIntent(state.intent, portCount);

            const storageSet = new Set(storageIndices);
            const rdmaEnabledIndices = [];
            for (let i = 1; i <= portCount; i++) {
                const pc = cfg[i - 1];
                if (pc && pc.rdma === true) rdmaEnabledIndices.push(i);
            }

            const isStandard = state.scale === 'medium';
            const allRdma = rdmaEnabledIndices.length === portCount && portCount > 0;

            if (state.intent === 'mgmt_compute' && isStandard && portCount > 2 && !allRdma) {
                const assignment = getMgmtComputeNicAssignment(portCount);
                if (!assignment.valid) {
                    missing.push('Mgmt + Compute mapping: requires at least 2 non-RDMA ports unless all ports are RDMA-capable (Step 08)');
                }
            }

            // When all ports are RDMA-capable, allow Mgmt+Compute to share RDMA ports (standard scenarios only).
            const allowMgmtComputeOnRdmaPorts =
                isStandard && state.intent === 'mgmt_compute' && allRdma;
            // Custom intent: RDMA can be enabled on non-Storage adapters (e.g., Compute).
            const nonStorageRdma = (state.intent === 'custom')
                ? []
                : (allowMgmtComputeOnRdmaPorts ? [] : rdmaEnabledIndices.filter(i => !storageSet.has(i)));
            const requiredRdma = getRequiredRdmaPortCount();
            const rdmaOnStorage = rdmaEnabledIndices.filter(i => storageSet.has(i)).length;

            // Custom intent helper: do not allow assigning Storage traffic to non-RDMA adapters.
            if (state.intent === 'custom') {
                const storageOnNonRdma = storageIndices.filter(i => {
                    const pc = cfg[i - 1];
                    return !(pc && pc.rdma === true);
                });
                if (storageOnNonRdma.length > 0) {
                    missing.push('Custom mapping: Storage traffic must be assigned only to RDMA-capable adapters (Step 08)');
                }
            }

            if (nonStorageRdma.length > 0 || (requiredRdma > 0 && rdmaOnStorage < requiredRdma)) {
                missing.push('RDMA mapping: RDMA-enabled ports must be assigned to Storage traffic (Step 08)');
            }
        }
    } catch (e) {
        // ignore
    }

    return { ready: missing.length === 0, missing };
}

function getNumericNodeCount() {
    const raw = state.nodes;
    if (!raw) return null;
    if (raw === '16+') return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function getRdmaEnabledNicIndices(portCount) {
    const p = parseInt(portCount, 10) || 0;
    const out = [];
    const cfg = Array.isArray(state.portConfig) ? state.portConfig : null;
    if (!cfg || p <= 0) return out;
    for (let i = 1; i <= p; i++) {
        const pc = cfg[i - 1];
        if (pc && pc.rdma === true) out.push(i);
    }
    return out;
}

function getMgmtComputeNicAssignment(portCount) {
    const p = parseInt(portCount, 10) || 0;
    const indices = Array.from({ length: Math.max(0, p) }, (_, i) => i + 1);
    const rdmaEnabled = getRdmaEnabledNicIndices(p);
    const allRdma = rdmaEnabled.length === p && p > 0;
    const nonRdma = indices.filter(i => !rdmaEnabled.includes(i));

    // Preserve existing 2-port behavior used elsewhere in the wizard.
    if (p === 2) {
        return {
            mgmtCompute: [1],
            storage: [2],
            allRdma,
            valid: true,
            reason: ''
        };
    }

    const isStandard = state.scale === 'medium';
    if (isStandard) {
        // Exception: when all ports are RDMA-capable, keep NICs 1-2 as Mgmt+Compute.
        if (allRdma) {
            const mgmtCompute = [1, 2].filter(n => n <= p);
            const mgmtComputeSet = new Set(mgmtCompute);
            return {
                mgmtCompute,
                storage: indices.filter(n => !mgmtComputeSet.has(n)),
                allRdma: true,
                valid: true,
                reason: ''
            };
        }

        // Prefer Mgmt+Compute on non-RDMA ports.
        const mgmtCompute = nonRdma.slice(0, 2);
        const mgmtComputeSet = new Set(mgmtCompute);
        const storage = indices.filter(n => !mgmtComputeSet.has(n));
        const valid = mgmtCompute.length >= 2;
        return {
            mgmtCompute,
            storage,
            allRdma: false,
            valid,
            reason: valid ? '' : 'Mgmt + Compute requires at least 2 non-RDMA port(s) unless all ports are RDMA-capable.'
        };
    }

    // Non-standard scales keep the fixed Pair 1 / Pair 2+ model.
    const mgmtCompute = [1, 2].filter(n => n <= p);
    const mgmtComputeSet = new Set(mgmtCompute);
    return {
        mgmtCompute,
        storage: indices.filter(n => !mgmtComputeSet.has(n)),
        allRdma,
        valid: true,
        reason: ''
    };
}

function getStorageNicIndicesForIntent(intent, portCount) {
    const p = parseInt(portCount, 10) || 0;
    if (p <= 0) return [];
    if (intent === 'all_traffic') return Array.from({ length: p }, (_, i) => i + 1);
    if (intent === 'mgmt_compute') return getMgmtComputeNicAssignment(p).storage;
    if (intent === 'compute_storage') return Array.from({ length: Math.max(0, p - 2) }, (_, i) => i + 3);
    if (intent === 'custom') {
        const out = [];
        for (let i = 1; i <= p; i++) {
            const assignment = (state.customIntents && state.customIntents[i]) || 'unused';
            const carriesStorage = (assignment === 'storage' || assignment === 'compute_storage' || assignment === 'all');
            if (carriesStorage) out.push(i);
        }
        return out;
    }
    return [];
}

function isValidNetbiosName(name) {
    // NetBIOS computer name: max 15 chars; generally A-Z, 0-9, and hyphen.
    // Keep it strict: start/end alphanumeric, allow hyphens in the middle.
    if (!name) return false;
    const trimmed = String(name).trim();
    if (trimmed.length < 1 || trimmed.length > 15) return false;
    if (trimmed.length === 1) return /^[A-Za-z0-9]$/.test(trimmed);
    return /^[A-Za-z0-9][A-Za-z0-9-]{0,13}[A-Za-z0-9]$/.test(trimmed);
}

function isValidIpv4Cidr(value) {
    if (!value) return false;
    const trimmed = String(value).trim();
    const parts = trimmed.split('/');
    if (parts.length !== 2) return false;
    const ip = parts[0];
    const prefix = parseInt(parts[1], 10);
    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipv4Regex.test(ip)) return false;
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return false;
    return true;
}

function extractIpFromCidr(value) {
    if (!value) return '';
    const trimmed = String(value).trim();
    const parts = trimmed.split('/');
    return parts[0] ? parts[0].trim() : '';
}

function extractPrefixFromCidr(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    const parts = trimmed.split('/');
    if (parts.length !== 2) return null;
    const prefix = parseInt(parts[1], 10);
    return Number.isFinite(prefix) ? prefix : null;
}

function ipv4ToInt(ip) {
    if (!ip) return null;
    const parts = String(ip).trim().split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4) return null;
    if (parts.some(n => !Number.isFinite(n) || n < 0 || n > 255)) return null;
    // Use unsigned shifts to keep within 32-bit.
    return (((parts[0] << 24) >>> 0) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIpv4(n) {
    if (!Number.isFinite(n)) return '';
    const x = (n >>> 0);
    return [
        (x >>> 24) & 0xFF,
        (x >>> 16) & 0xFF,
        (x >>> 8) & 0xFF,
        x & 0xFF
    ].join('.');
}

function prefixToMask(prefix) {
    const p = parseInt(prefix, 10);
    if (!Number.isFinite(p) || p < 0 || p > 32) return null;
    return p === 0 ? 0 : ((0xFFFFFFFF << (32 - p)) >>> 0);
}

function tryAutoFillSequentialNodeIpsFromFirst() {
    // Fill Node 2..N using Node 1's IP as the base, incrementing by 1.
    // Only fills empty node IP fields; never overwrites user-provided values.
    const count = getNumericNodeCount();
    if (!count || count < 2) return;
    if (!Array.isArray(state.nodeSettings) || state.nodeSettings.length < 2) return;

    const first = state.nodeSettings[0] || {};
    const firstCidr = String(first.ipCidr || '').trim();
    if (!isValidIpv4Cidr(firstCidr)) return;

    const baseIp = extractIpFromCidr(firstCidr);
    const prefix = extractPrefixFromCidr(firstCidr);
    if (!baseIp || prefix === null) return;

    const baseInt = ipv4ToInt(baseIp);
    const mask = prefixToMask(prefix);
    if (baseInt === null || mask === null) return;

    // /32 cannot be incremented meaningfully.
    if (prefix === 32) return;

    const net = (baseInt & mask) >>> 0;
    const broadcast = (net | (~mask >>> 0)) >>> 0;
    const traditionalHostRange = prefix <= 30;

    for (let i = 1; i < count; i++) {
        const cur = state.nodeSettings[i] || {};
        const curVal = String(cur.ipCidr || '').trim();
        if (curVal) continue;

        const candidateInt = (baseInt + i) >>> 0;
        // Stay within the same subnet.
        if (((candidateInt & mask) >>> 0) !== net) break;

        // Avoid network/broadcast in traditional subnets.
        if (traditionalHostRange) {
            if (candidateInt === net) continue;
            if (candidateInt === broadcast) break;
        }

        state.nodeSettings[i].ipCidr = intToIpv4(candidateInt) + '/' + prefix;
    }
}

function ensureNodeSettingsInitialized() {
    const count = getNumericNodeCount();
    if (!count) return;

    if (!Array.isArray(state.nodeSettings)) state.nodeSettings = [];

    // Preserve existing entries where possible.
    const next = [];
    for (let i = 0; i < count; i++) {
        const existing = state.nodeSettings[i] || {};
        const defaultName = `node${i + 1}`;
        next.push({
            name: existing.name || defaultName,
            ipCidr: existing.ipCidr || ''
        });
    }
    state.nodeSettings = next;
}

function updateNodeName(index, value) {
    ensureNodeSettingsInitialized();
    if (!state.nodeSettings[index]) return;
    state.nodeSettings[index].name = String(value || '').trim();
    validateNodeSettings();
    updateSummary();
    updateUI();
}

function updateNodeIpCidr(index, value) {
    ensureNodeSettingsInitialized();
    if (!state.nodeSettings[index]) return;
    state.nodeSettings[index].ipCidr = String(value || '').trim();

    // Convenience: if the user sets Node 1 IP, auto-fill remaining empty node IPs sequentially.
    if (index === 0) {
        tryAutoFillSequentialNodeIpsFromFirst();
    }

    validateNodeSettings();
    updateSummary();
    updateUI();
}

function deriveInfraCidrFromNodeIps() {
    try {
        if (!Array.isArray(state.nodeSettings) || state.nodeSettings.length === 0) return null;

        // Prefer Node 1 if valid; otherwise first valid CIDR.
        let candidate = state.nodeSettings[0] && state.nodeSettings[0].ipCidr ? String(state.nodeSettings[0].ipCidr).trim() : '';
        if (!isValidIpv4Cidr(candidate)) {
            candidate = '';
            for (let i = 0; i < state.nodeSettings.length; i++) {
                const v = state.nodeSettings[i] && state.nodeSettings[i].ipCidr ? String(state.nodeSettings[i].ipCidr).trim() : '';
                if (isValidIpv4Cidr(v)) { candidate = v; break; }
            }
        }
        if (!candidate) return null;

        const ip = extractIpFromCidr(candidate);
        const prefix = extractPrefixFromCidr(candidate);
        if (!ip || prefix === null) return null;

        const ipL = ipv4ToInt(ip);
        const mask = prefixToMask(prefix);
        if (ipL === null || mask === null) return null;

        const net = (ipL & mask) >>> 0;
        return intToIpv4(net) + '/' + prefix;
    } catch (e) {
        return null;
    }
}

function autoFillInfraCidrFromNodes() {
    try {
        // Only when the infra step is relevant (IP assignment chosen) and the user hasn't overridden.
        if (!state.ip) return;
        if (state.infraCidrAuto === false) return;

        const cidrInput = document.getElementById('infra-cidr');
        if (!cidrInput || cidrInput.disabled) return;
        if (document.activeElement === cidrInput) return;

        const derived = deriveInfraCidrFromNodeIps();
        if (!derived) return;

        if (String(cidrInput.value || '').trim() !== derived) {
            cidrInput.value = derived;
        }
        state.infraCidr = derived;
        state.infraCidrAuto = true;
    } catch (e) {
        // ignore
    }
}

function renderNodeSettings() {
    const section = document.getElementById('node-config-section');
    const container = document.getElementById('node-config-container');
    if (!section || !container) return;

    // Only show after node count and IP assignment selection are known.
    const count = getNumericNodeCount();
    if (!count || !state.ip) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    ensureNodeSettingsInitialized();
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const node = state.nodeSettings[i] || { name: '', ipCidr: '' };
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:1rem; flex-wrap:wrap; margin-top:0.75rem;';

        row.innerHTML = `
            <div style="flex:1; min-width:220px;">
                <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">Node ${i + 1} Name</label>
                <input type="text" value="${escapeHtml(node.name)}" maxlength="15" placeholder="e.g. node${i + 1}"
                    title="NetBIOS name: max 15 chars; letters/numbers/hyphen; start/end alphanumeric"
                    style="width:100%; padding:0.75rem; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); color:white; border-radius:4px;"
                    onchange="updateNodeName(${i}, this.value)">
            </div>
            <div style="flex:1; min-width:220px;">
                <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">Node ${i + 1} IP (CIDR)</label>
                <input type="text" value="${escapeHtml(node.ipCidr)}" placeholder="e.g. 192.168.1.${10 + i}/24"
                    title="IPv4 CIDR (e.g. 192.168.1.10/24). Must be unique across nodes."
                    style="width:100%; padding:0.75rem; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); color:white; border-radius:4px;"
                    onchange="updateNodeIpCidr(${i}, this.value)">
            </div>
        `;

        container.appendChild(row);
    }

    validateNodeSettings();
}

function getNodeSettingsReadiness() {
    const missing = [];

    if (!state.nodes) {
        missing.push('Nodes');
        return { ready: false, missing };
    }

    if (state.nodes === '16+') {
        missing.push('Node Names/IPs (16+ nodes requires manual input outside this wizard)');
        return { ready: false, missing };
    }

    const count = getNumericNodeCount();
    if (!count) {
        missing.push('Node Names/IPs');
        return { ready: false, missing };
    }

    ensureNodeSettingsInitialized();

    // Require IP assignment to be chosen before validating node settings.
    if (!state.ip) {
        missing.push('IP Assignment');
        return { ready: false, missing };
    }

    const names = new Set();
    const ips = new Set();

    for (let i = 0; i < count; i++) {
        const node = state.nodeSettings[i] || {};
        const name = String(node.name || '').trim();
        const ipCidr = String(node.ipCidr || '').trim();

        if (!isValidNetbiosName(name)) {
            missing.push(`Node ${i + 1} Name`);
        } else {
            const key = name.toUpperCase();
            if (names.has(key)) missing.push(`Node names must be unique`);
            names.add(key);
        }

        if (!isValidIpv4Cidr(ipCidr)) {
            missing.push(`Node ${i + 1} IP (CIDR)`);
        } else {
            const ip = extractIpFromCidr(ipCidr);
            if (ips.has(ip)) missing.push('Node IPs must be unique');
            ips.add(ip);
        }
    }

    return { ready: missing.length === 0, missing: Array.from(new Set(missing)) };
}

function validateNodeSettings() {
    const err = document.getElementById('node-config-error');
    const succ = document.getElementById('node-config-success');

    if (err) err.classList.add('hidden');
    if (succ) succ.classList.add('hidden');

    // If not shown yet, don't show errors.
    const section = document.getElementById('node-config-section');
    if (section && section.classList.contains('hidden')) return;

    const readiness = getNodeSettingsReadiness();
    if (!readiness.ready) {
        if (err) {
            err.innerText = 'Please correct:\n- ' + readiness.missing.join('\n- ');
            err.classList.remove('hidden');
        }
        return;
    }

    if (succ) {
        succ.classList.remove('hidden');
    }
}

function getArmReadiness() {
    // Base readiness: reuse report readiness so we only generate from a coherent, supported wizard path.
    const base = getReportReadiness();
    if (!base.ready) return { ready: false, missing: base.missing, placeholders: [] };

    const placeholders = [];
    if (!state.infraCidr) placeholders.push('Infrastructure Network (CIDR)');
    if (!state.infra || !state.infra.start || !state.infra.end) placeholders.push('Infrastructure IP Pool (Start/End)');

    // The wizard does not collect these; warn that placeholders will be used.
    const isAdlessExternalDns = state.activeDirectory === 'local_identity';

    placeholders.push('Cluster Name');
    placeholders.push('Key Vault name');
    placeholders.push('Diagnostic storage account name');
    placeholders.push('Local admin credentials');
    if (!isAdlessExternalDns) {
        // The create-cluster quickstart templates require separate LCM credentials.
        placeholders.push('Deployment (LCM) credentials');
    }
    placeholders.push('HCI resource provider object ID');
    placeholders.push('Arc node resource IDs');

    // Physical nodes settings: the wizard collects these (names + node IP CIDRs).
    // Only warn when they aren't ready (so we'd fall back to REPLACE_WITH_* values).
    try {
        const nodeReadiness = (typeof getNodeSettingsReadiness === 'function') ? getNodeSettingsReadiness() : { ready: false };
        if (!nodeReadiness || !nodeReadiness.ready) {
            placeholders.push('Physical node names + IPs');
        }
    } catch (e) {
        placeholders.push('Physical node names + IPs');
    }
    if (state.nodes === '2') placeholders.push('Cloud witness storage account name');
    // Default gateway is only required/used for Static IP deployments.
    if (state.ip === 'static' && !state.infraGateway) {
        placeholders.push('Default gateway');
    }
    if (!isAdlessExternalDns) {
        placeholders.push('OU path (optional)');
    }
    // If we have enough info, we can fill intent adapters + storage VLANs.
    const hasPortCount = Boolean(state.ports && parseInt(state.ports, 10) > 0);
    const hasIntent = Boolean(state.intent);
    const needsCustomConfirm = (state.intent === 'custom' && !state.customIntentConfirmed);
    if (!hasPortCount || !hasIntent || needsCustomConfirm) {
        placeholders.push('Intent adapters/VLANs (intentList/storageNetworkList)');
    }
    placeholders.push('Custom location name (optional)');

    return { ready: true, missing: [], placeholders };
}

function toAzureLocationFromLocalInstanceRegion(value) {
    const map = {
        east_us: 'eastus',
        west_europe: 'westeurope',
        australia_east: 'australiaeast',
        southeast_asia: 'southeastasia',
        india_central: 'centralindia',
        canada_central: 'canadacentral',
        japan_east: 'japaneast',
        south_central_us: 'southcentralus',
        us_gov_virginia: 'usgovvirginia'
    };
    return map[value] || '';
}

function cidrToSubnetMask(cidr) {
    if (!cidr || typeof cidr !== 'string' || !cidr.includes('/')) return '';
    const parts = cidr.split('/');
    const prefix = parseInt(parts[1], 10);
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return '';

    const mask = prefix === 0 ? 0 : ((0xFFFFFFFF << (32 - prefix)) >>> 0);
    const octets = [
        (mask >>> 24) & 0xFF,
        (mask >>> 16) & 0xFF,
        (mask >>> 8) & 0xFF,
        mask & 0xFF
    ];
    return octets.join('.');
}

function downloadJson(filename, obj) {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function generateArmParameters() {
    try {
        const readiness = getArmReadiness();
        if (!readiness.ready) {
            const msg = 'Complete these items before generating the ARM parameters file:\n\n- ' + readiness.missing.join('\n- ');
            alert(msg);
            return;
        }

        const isUsGovCloud = state.region === 'azure_government';
        const isRackAware = state.scale === 'rack_aware';
        const isAdlessExternalDns = state.activeDirectory === 'local_identity';

        // Choose the ARM template reference based on wizard selections.
        // Priority: US Gov cloud template > Rack-Aware template > Commercial default.
        const referenceTemplate = isAdlessExternalDns
            ? {
                name: 'Azure Stack HCI ADLess cluster (external DNS) — Public Preview',
                url: 'https://github.com/Azure/azure-quickstart-templates/blob/master/quickstarts/microsoft.azurestackhci/create-adless-cluster-external-dns-public-preview/azuredeploy.json'
            }
            : isUsGovCloud
                ? {
                    name: 'Azure Stack HCI create-cluster (US Gov)',
                    url: 'https://github.com/Azure/azure-quickstart-templates/blob/master/quickstarts/microsoft.azurestackhci/create-cluster-for-usgov/azuredeploy.json'
                }
                : isRackAware
                    ? {
                        name: 'Azure Stack HCI create-cluster (Rack-Aware)',
                        url: 'https://github.com/Azure/azure-quickstart-templates/blob/master/quickstarts/microsoft.azurestackhci/create-cluster-rac-enabled/azuredeploy.json'
                    }
                    : {
                        name: 'Azure Stack HCI create-cluster',
                        url: 'https://github.com/Azure/azure-quickstart-templates/blob/master/quickstarts/microsoft.azurestackhci/create-cluster/azuredeploy.json'
                    };

        const isLikelyGovLocation = (loc) => {
            const s = String(loc || '').trim().toLowerCase();
            return s.startsWith('usgov');
        };

        let location = toAzureLocationFromLocalInstanceRegion(state.localInstanceRegion) || 'REPLACE_WITH_LOCATION';
        if (isUsGovCloud && !isLikelyGovLocation(location)) {
            location = 'REPLACE_WITH_USGOV_LOCATION';
        }
        const useDhcp = state.ip === 'dhcp';
        const startIp = state.infra && state.infra.start ? state.infra.start : 'REPLACE_WITH_STARTING_IP';
        const endIp = state.infra && state.infra.end ? state.infra.end : 'REPLACE_WITH_ENDING_IP';
        const subnetMask = cidrToSubnetMask(state.infraCidr) || 'REPLACE_WITH_SUBNET_MASK';

        const dnsServers = (Array.isArray(state.dnsServers) && state.dnsServers.length > 0)
            ? state.dnsServers
            : ['REPLACE_WITH_DNS_SERVER_1', 'REPLACE_WITH_DNS_SERVER_2'];

        const nodeCountRaw = parseInt(state.nodes, 10);
        const nodeCount = Number.isFinite(nodeCountRaw) && nodeCountRaw > 0 ? nodeCountRaw : 2;
        const witnessType = state.witnessType || 'NoWitness';

        const getNodeNameForArm = (index0Based) => {
            const fromWizard = (Array.isArray(state.nodeSettings) && state.nodeSettings[index0Based]) ? state.nodeSettings[index0Based] : null;
            const name = fromWizard && fromWizard.name ? String(fromWizard.name).trim() : '';
            return name || `node${index0Based + 1}`;
        };

        const intentToNetworkingPattern = {
            all_traffic: 'hyperConverged',
            mgmt_compute: 'convergedManagementCompute',
            compute_storage: 'convergedComputeStorage',
            custom: 'custom'
        };

        const networkingType = state.storage === 'switchless'
            ? 'switchlessMultiServerDeployment'
            : 'switchedMultiServerDeployment';

        const trafficTypeForIntent = {
            all_traffic: ['Management', 'Compute', 'Storage'],
            mgmt_compute: ['Management', 'Compute'],
            compute_storage: ['Compute', 'Storage'],
            custom: ['Management', 'Compute', 'Storage']
        };

        const portCount = parseInt(state.ports, 10) || 0;

        const armAdapterNameForNic = (nicIdx1Based) => {
            // Match Azure quickstart template naming convention (NIC1, NIC2, ...)
            return `NIC${nicIdx1Based}`;
        };

        const sanitizeIntentName = (raw) => {
            const s = String(raw || '').trim();
            if (!s) return 'Intent';
            // Keep ARM-friendly names: letters/numbers/underscore/hyphen.
            const cleaned = s.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-]/g, '');
            return cleaned || 'Intent';
        };

        const baseKeyForGroupKey = (k) => {
            const key = String(k || '');
            return key.startsWith('custom_') ? key.substring('custom_'.length) : key;
        };

        const trafficTypeForGroupBaseKey = (baseKey) => {
            if (baseKey === 'mgmt') return ['Management'];
            if (baseKey === 'compute') return ['Compute'];
            if (baseKey === 'storage') return ['Storage'];
            if (baseKey === 'mgmt_compute') return ['Management', 'Compute'];
            if (baseKey === 'compute_storage') return ['Compute', 'Storage'];
            if (baseKey === 'all') return ['Management', 'Compute', 'Storage'];
            return ['Management', 'Compute', 'Storage'];
        };

        const ensureIntentOverrideDefaults = () => {
            // Ensure defaults exist for storage VLANs even if the user never opened the overrides UI.
            try {
                const groups = getIntentNicGroups(state.intent, portCount);
                if (groups && groups.length) ensureDefaultOverridesForGroups(groups);
            } catch (e) {
                // ignore
            }
        };

        const getStorageOverrideKey = () => {
            // Keys used by getIntentNicGroups + ensureDefaultOverridesForGroups.
            if (state.intent === 'custom') return 'custom_storage';
            if (state.intent === 'all_traffic') return 'all';
            return 'storage';
        };

        const getStorageVlans = () => {
            ensureIntentOverrideDefaults();
            const key = getStorageOverrideKey();
            const ov = (state.intentOverrides && state.intentOverrides[key]) ? state.intentOverrides[key] : null;
            const vlan1 = ov && (ov.storageNetwork1VlanId ?? ov.storageVlanNic1);
            const vlan2 = ov && (ov.storageNetwork2VlanId ?? ov.storageVlanNic2);
            const v1 = Number.isInteger(Number(vlan1)) ? Number(vlan1) : null;
            const v2 = Number.isInteger(Number(vlan2)) ? Number(vlan2) : null;
            return { v1, v2 };
        };

        const getStorageNicCandidates = () => {
            if (portCount <= 0) return [];

            // Determine NICs used for storage traffic based on the wizard mapping.
            if (state.intent === 'custom') {
                const out = [];
                for (let i = 1; i <= portCount; i++) {
                    const assignment = (state.customIntents && state.customIntents[i]) || 'unused';
                    if (assignment === 'storage' || assignment === 'compute_storage' || assignment === 'all') {
                        out.push(i);
                    }
                }
                return out;
            }

            if (state.intent === 'mgmt_compute') {
                return getStorageNicIndicesForIntent('mgmt_compute', portCount);
            }

            if (state.intent === 'compute_storage') {
                return Array.from({ length: Math.max(0, portCount - 2) }, (_, i) => i + 3);
            }

            // all_traffic (fully converged): no dedicated storage adapters are collected in the wizard.
            // Choose NICs 1-2 as a deterministic default.
            return [1, 2].filter(n => n <= portCount);
        };

        const storageNetworkCount = getStorageVlanOverrideNetworkCount();
        const storageCandidates = getStorageNicCandidates();
        const storageNicsForNetworks = storageCandidates.slice(0, Math.max(0, storageNetworkCount));
        const { v1: storageVlan1, v2: storageVlan2 } = getStorageVlans();

        const storageNetworkList = (() => {
            // Special-case: 3-node switchless requires explicit storage subnet/IP assignment.
            // Use the same example subnet numbering shown in the report:
            // 1-2: Node1↔Node2, 3-4: Node1↔Node3, 5-6: Node2↔Node3.
            if (state.storage === 'switchless' && nodeCount === 3) {
                const vlanId = (storageVlan1 !== null && storageVlan1 !== undefined) ? storageVlan1 : 'REPLACE_WITH_STORAGE_VLAN_1';
                const storageSubnetMask = cidrToSubnetMask('10.0.1.0/24') || '255.255.255.0';

                const subnetPairs = {
                    1: [1, 2],
                    2: [1, 2],
                    3: [1, 3],
                    4: [1, 3],
                    5: [2, 3],
                    6: [2, 3]
                };

                // For each node (1..3), map SMB1..SMB4 to the correct subnet number.
                const nodeToSubnetBySmb = {
                    1: [1, 2, 3, 4],
                    2: [1, 2, 5, 6],
                    3: [3, 4, 5, 6]
                };

                const nodeNames = [
                    getNodeNameForArm(0),
                    getNodeNameForArm(1),
                    getNodeNameForArm(2)
                ];

                const makeIpv4 = (subnetNumber, hostOctet) => `10.0.${subnetNumber}.${hostOctet}`;
                const hostOctetForNodeInSubnet = (subnetNumber, nodeNumber) => {
                    const pair = subnetPairs[subnetNumber];
                    if (!pair) return null;
                    // Lower-numbered node gets .2, higher gets .3.
                    if (nodeNumber === pair[0]) return 2;
                    if (nodeNumber === pair[1]) return 3;
                    return null;
                };

                const list = [];
                for (let smbIdx = 1; smbIdx <= 4; smbIdx++) {
                    const storageAdapterIPInfo = [];
                    for (let nodeNumber = 1; nodeNumber <= 3; nodeNumber++) {
                        const subnets = nodeToSubnetBySmb[nodeNumber];
                        const subnetNumber = subnets ? subnets[smbIdx - 1] : null;
                        const hostOctet = subnetNumber ? hostOctetForNodeInSubnet(subnetNumber, nodeNumber) : null;
                        storageAdapterIPInfo.push({
                            physicalNode: nodeNames[nodeNumber - 1] || `node${nodeNumber}`,
                            ipv4Address: (subnetNumber && hostOctet) ? makeIpv4(subnetNumber, hostOctet) : `REPLACE_WITH_NODE_${nodeNumber}_SMB${smbIdx}_IP`,
                            subnetMask: storageSubnetMask
                        });
                    }

                    list.push({
                        name: `StorageNetwork${smbIdx}`,
                        networkAdapterName: `SMB${smbIdx}`,
                        vlanId: vlanId,
                        storageAdapterIPInfo: storageAdapterIPInfo
                    });
                }

                return list;
            }

            // Special-case: 4-node switchless requires explicit storage subnet/IP assignment.
            // Use the same example networks shown in the report (based on Microsoft Learn guidance)
            // so the generated parameters file is complete and matches the reference pattern.
            if (state.storage === 'switchless' && nodeCount === 4) {
                const vlanId = (storageVlan1 !== null && storageVlan1 !== undefined) ? storageVlan1 : 'REPLACE_WITH_STORAGE_VLAN_1';
                const storageSubnetMask = cidrToSubnetMask('10.0.1.0/24') || '255.255.255.0';

                // Subnet pairs (two subnets per node pair).
                const subnetPairs = {
                    1: [1, 2],
                    2: [1, 2],
                    3: [1, 3],
                    4: [1, 3],
                    5: [1, 4],
                    6: [1, 4],
                    7: [2, 3],
                    8: [2, 3],
                    9: [2, 4],
                    10: [2, 4],
                    11: [3, 4],
                    12: [3, 4]
                };

                // For each node (1..4), map SMB1..SMB6 to the correct subnet number.
                // This mirrors the wiring/subnet mapping in the Microsoft Learn 4-node switchless dual-link reference.
                const nodeToSubnetBySmb = {
                    1: [1, 2, 3, 4, 5, 6],
                    2: [1, 2, 7, 8, 9, 10],
                    3: [3, 4, 7, 8, 11, 12],
                    4: [5, 6, 9, 10, 11, 12]
                };

                const nodeNames = [
                    getNodeNameForArm(0),
                    getNodeNameForArm(1),
                    getNodeNameForArm(2),
                    getNodeNameForArm(3)
                ];

                const makeIpv4 = (subnetNumber, hostOctet) => `10.0.${subnetNumber}.${hostOctet}`;
                const hostOctetForNodeInSubnet = (subnetNumber, nodeNumber) => {
                    const pair = subnetPairs[subnetNumber];
                    if (!pair) return null;
                    // Lower-numbered node gets .2, higher gets .3 (matches Learn example).
                    if (nodeNumber === pair[0]) return 2;
                    if (nodeNumber === pair[1]) return 3;
                    return null;
                };

                const list = [];
                for (let smbIdx = 1; smbIdx <= 6; smbIdx++) {
                    const storageAdapterIPInfo = [];
                    for (let nodeNumber = 1; nodeNumber <= 4; nodeNumber++) {
                        const subnets = nodeToSubnetBySmb[nodeNumber];
                        const subnetNumber = subnets ? subnets[smbIdx - 1] : null;
                        const hostOctet = subnetNumber ? hostOctetForNodeInSubnet(subnetNumber, nodeNumber) : null;
                        storageAdapterIPInfo.push({
                            physicalNode: nodeNames[nodeNumber - 1] || `node${nodeNumber}`,
                            ipv4Address: (subnetNumber && hostOctet) ? makeIpv4(subnetNumber, hostOctet) : `REPLACE_WITH_NODE_${nodeNumber}_SMB${smbIdx}_IP`,
                            subnetMask: storageSubnetMask
                        });
                    }

                    list.push({
                        name: `StorageNetwork${smbIdx}`,
                        networkAdapterName: `SMB${smbIdx}`,
                        vlanId: vlanId,
                        storageAdapterIPInfo: storageAdapterIPInfo
                    });
                }

                return list;
            }

            const list = [];
            if (storageNetworkCount <= 0) return list;

            const nic1 = storageNicsForNetworks[0];
            const nic2 = storageNicsForNetworks[1];
            list.push({
                name: 'StorageNetwork1',
                networkAdapterName: nic1 ? `SMB${nic1}` : 'REPLACE_WITH_STORAGE_ADAPTER_1',
                vlanId: (storageVlan1 !== null && storageVlan1 !== undefined) ? storageVlan1 : 'REPLACE_WITH_STORAGE_VLAN_1'
            });
            if (storageNetworkCount >= 2) {
                list.push({
                    name: 'StorageNetwork2',
                    networkAdapterName: nic2 ? `SMB${nic2}` : 'REPLACE_WITH_STORAGE_ADAPTER_2',
                    vlanId: (storageVlan2 !== null && storageVlan2 !== undefined) ? storageVlan2 : 'REPLACE_WITH_STORAGE_VLAN_2'
                });
            }
            return list;
        })();

        const intentGroups = getIntentNicGroups(state.intent, portCount);
        const intentList = (() => {
            // Build intent list from the same NIC-grouping logic used in the wizard.
            const out = [];
            const usedNames = new Set();

            // Ensure defaults exist for RDMA/jumbo VLAN overrides even if the user never opened the overrides UI.
            ensureIntentOverrideDefaults();

            const getStorageAdapterNamesForIntent = (groupNics) => {
                // Storage intent adapters in the ARM template are SMBx.
                // - Switchless: SMB1..SMB{2*(n-1)} regardless of physical NIC numbering in the wizard.
                // - Switched: use SMB{NIC#} to match wizard labeling.
                if (state.storage === 'switchless') {
                    const n = nodeCount;
                    const smbCount = (Number.isFinite(n) && n > 1) ? (2 * (n - 1)) : 2;
                    return Array.from({ length: smbCount }, (_, i) => `SMB${i + 1}`);
                }

                return (Array.isArray(groupNics) ? groupNics : []).map(n => `SMB${n}`);
            };

            const buildAdapterPropertyOverrides = (groupKey) => {
                const ov = (state.intentOverrides && state.intentOverrides[groupKey]) ? state.intentOverrides[groupKey] : null;
                const touched = !!(ov && (
                    ov.__touchedAdapterProperty === true ||
                    (ov.__touched === true && ov.__touchedAdapterProperty === undefined && ov.__touchedVswitch === undefined && ov.__touchedVlan === undefined)
                ));

                const jumbo = ov && ov.jumboFrames ? String(ov.jumboFrames) : '';
                const rdmaMode = ov && ov.rdmaMode ? String(ov.rdmaMode) : '';
                const networkDirect = rdmaMode ? (rdmaMode === 'Disabled' ? 'Disabled' : 'Enabled') : '';
                const networkDirectTechnology = (rdmaMode && rdmaMode !== 'Disabled') ? rdmaMode : '';

                return {
                    touched,
                    overrides: {
                        jumboPacket: jumbo,
                        networkDirect: networkDirect,
                        networkDirectTechnology: networkDirectTechnology
                    }
                };
            };

            const buildVirtualSwitchConfigurationOverrides = (groupKey) => {
                const ov = (state.intentOverrides && state.intentOverrides[groupKey]) ? state.intentOverrides[groupKey] : null;
                const touched = !!(ov && ov.__touchedVswitch === true);
                const enableIov = ov && ov.enableIov ? String(ov.enableIov) : '';
                return {
                    touched,
                    overrides: {
                        enableIov,
                        loadBalancingAlgorithm: ''
                    }
                };
            };

            const baseGroups = (Array.isArray(intentGroups) ? intentGroups : []);

            if (baseGroups.length === 0) {
                // Fallback: preserve previous single-entry behavior.
                const adapters = [1, 2].filter(n => n <= portCount).map(armAdapterNameForNic);
                out.push({
                    name: 'Intent1',
                    trafficType: trafficTypeForIntent[state.intent] || ['Management', 'Compute', 'Storage'],
                    adapter: adapters.length ? adapters : ['REPLACE_WITH_ADAPTER_1', 'REPLACE_WITH_ADAPTER_2'],
                    overrideVirtualSwitchConfiguration: false,
                    virtualSwitchConfigurationOverrides: { enableIov: '', loadBalancingAlgorithm: '' },
                    overrideQosPolicy: false,
                    qosPolicyOverrides: { priorityValue8021Action_Cluster: '', priorityValue8021Action_SMB: '', bandwidthPercentage_SMB: '' },
                    overrideAdapterProperty: false,
                    adapterPropertyOverrides: { jumboPacket: '', networkDirect: '', networkDirectTechnology: '' }
                });
                return out;
            }

            baseGroups.forEach((g, idx) => {
                const baseKey = baseKeyForGroupKey(g.key);
                const niceName = baseKey === 'storage' ? 'Storage' :
                    baseKey === 'mgmt_compute' ? 'MgmtCompute' :
                        baseKey === 'compute_storage' ? 'ComputeStorage' :
                            baseKey === 'mgmt' ? 'Management' :
                                baseKey === 'compute' ? 'Compute' :
                                    baseKey === 'all' ? 'AllTraffic' : String(baseKey || 'Intent');

                let name = sanitizeIntentName(niceName);
                if (usedNames.has(name)) name = name + '_' + (idx + 1);
                usedNames.add(name);

                const adapters = (baseKey === 'storage')
                    ? getStorageAdapterNamesForIntent(g.nics)
                    : (Array.isArray(g.nics) ? g.nics : []).map(n => armAdapterNameForNic(n));

                const adapterOverrides = buildAdapterPropertyOverrides(g.key);
                const vswitchOverrides = buildVirtualSwitchConfigurationOverrides(g.key);

                out.push({
                    name,
                    trafficType: baseKey === 'storage' ? ['Storage'] : trafficTypeForGroupBaseKey(baseKey),
                    adapter: adapters.length ? adapters : ['REPLACE_WITH_ADAPTER_1', 'REPLACE_WITH_ADAPTER_2'],
                    overrideVirtualSwitchConfiguration: vswitchOverrides.touched,
                    virtualSwitchConfigurationOverrides: vswitchOverrides.overrides,
                    overrideQosPolicy: false,
                    qosPolicyOverrides: { priorityValue8021Action_Cluster: '', priorityValue8021Action_SMB: '', bandwidthPercentage_SMB: '' },
                    // Apply adapter properties only when the user explicitly changed overrides in the UI.
                    // (Defaults are still emitted but not enforced unless touched.)
                    overrideAdapterProperty: adapterOverrides.touched,
                    adapterPropertyOverrides: adapterOverrides.overrides
                });
            });

            return out;
        })();

        const physicalNodesSettings = Array.from({ length: nodeCount }, (_, i) => {
            const fromWizard = (Array.isArray(state.nodeSettings) && state.nodeSettings[i]) ? state.nodeSettings[i] : null;
            const name = getNodeNameForArm(i);
            const ipCidr = fromWizard && fromWizard.ipCidr ? String(fromWizard.ipCidr).trim() : '';
            const ip = isValidIpv4Cidr(ipCidr) ? extractIpFromCidr(ipCidr) : `REPLACE_WITH_NODE_${i + 1}_IP`;
            return { name, ipv4Address: ip };
        });

        const parameters = (() => {
            // ADLess external DNS template: different parameter surface vs the create-cluster quickstarts.
            if (isAdlessExternalDns) {
                const identityProvider = 'LocalIdentity';
                const dnsZoneName = state.localDnsZone ? String(state.localDnsZone).trim() : 'REPLACE_WITH_DNS_ZONE_NAME';
                const hasDnsServers = Array.isArray(dnsServers) && dnsServers.filter(s => s && String(s).trim()).length > 0;

                // Map the new UI toggle:
                // - Yes (existing DNS service): use provided DNS servers directly.
                // - No: fall back to forwarder-based config (requires DNS forwarder values).
                const dnsServerConfig = (state.dnsServiceExisting === false) ? 'UseForwarder' : 'UseDnsServer';

                const forwarders = (dnsServerConfig === 'UseForwarder')
                    ? (useDhcp
                        ? ['REPLACE_WITH_DNS_FORWARDER_1']
                        : (hasDnsServers ? dnsServers : ['REPLACE_WITH_DNS_FORWARDER_1']))
                    : [];

                return {
                    deploymentMode: { value: 'Validate' },

                    keyVaultName: { value: 'REPLACE_WITH_KEYVAULT_NAME' },
                    createNewKeyVault: { value: true },
                    softDeleteRetentionDays: { value: 30 },
                    diagnosticStorageAccountName: { value: 'REPLACE_WITH_DIAGNOSTIC_STORAGE_ACCOUNT' },
                    logsRetentionInDays: { value: 30 },
                    storageAccountType: { value: 'Standard_LRS' },

                    clusterName: { value: 'REPLACE_WITH_CLUSTER_NAME' },
                    location: { value: location },
                    tenantId: { value: '' },

                    witnessType: { value: witnessType },
                    clusterWitnessStorageAccountName: { value: witnessType === 'Cloud' ? 'REPLACE_WITH_WITNESS_STORAGE_ACCOUNT' : '' },

                    localAdminUserName: { value: 'REPLACE_WITH_LOCAL_ADMIN_USERNAME' },
                    localAdminPassword: { value: null },

                    hciResourceProviderObjectID: { value: '' },
                    arcNodeResourceIds: { value: ['REPLACE_WITH_ARC_NODE_RESOURCE_ID_1'] },

                    namingPrefix: { value: 'hci' },
                    identityProvider: { value: identityProvider },

                    securityLevel: { value: 'Recommended' },
                    driftControlEnforced: { value: true },
                    credentialGuardEnforced: { value: true },
                    smbSigningEnforced: { value: true },
                    smbClusterEncryption: { value: false },
                    bitlockerBootVolume: { value: true },
                    bitlockerDataVolumes: { value: true },
                    wdacEnforced: { value: true },

                    streamingDataClient: { value: true },
                    euLocation: { value: false },
                    episodicDataUpload: { value: true },

                    configurationMode: { value: state.storagePoolConfiguration || 'Express' },

                    subnetMask: { value: subnetMask },
                    defaultGateway: { value: useDhcp ? '' : (state.infraGateway || 'REPLACE_WITH_DEFAULT_GATEWAY') },
                    startingIPAddress: { value: startIp },
                    endingIPAddress: { value: endIp },
                    dnsServers: { value: useDhcp ? [''] : dnsServers },
                    useDhcp: { value: useDhcp },

                    dnsServerConfig: { value: dnsServerConfig },
                    dnsZones: {
                        value: [
                            {
                                dnsZoneName: dnsZoneName,
                                dnsForwarder: forwarders
                            }
                        ]
                    },

                    physicalNodesSettings: { value: physicalNodesSettings },

                    networkingType: { value: networkingType },
                    networkingPattern: { value: intentToNetworkingPattern[state.intent] || 'hyperConverged' },
                    intentList: { value: intentList },
                    storageNetworkList: { value: storageNetworkList },
                    storageConnectivitySwitchless: { value: state.storage === 'switchless' },
                    enableStorageAutoIp: { value: state.storageAutoIp === 'enabled' },

                    customLocation: { value: '' },

                    sbeVersion: { value: '' },
                    sbeFamily: { value: '' },
                    sbePublisher: { value: '' },
                    sbeManifestSource: { value: '' },
                    sbeManifestCreationDate: { value: '' },
                    partnerProperties: { value: [] },
                    partnerCredentiallist: { value: [] }
                };
            }

            // Default: Align with the create-cluster quickstart sample azuredeploy.parameters.json.
            const domainFqdn = (state.activeDirectory === 'azure_ad' && state.adDomain)
                ? state.adDomain
                : 'REPLACE_WITH_DOMAIN_FQDN';

            const base = {
                deploymentMode: { value: 'Validate' },

                keyVaultName: { value: 'REPLACE_WITH_KEYVAULT_NAME' },
                createNewKeyVault: { value: true },
                softDeleteRetentionDays: { value: 30 },
                diagnosticStorageAccountName: { value: 'REPLACE_WITH_DIAGNOSTIC_STORAGE_ACCOUNT' },
                logsRetentionInDays: { value: 30 },
                storageAccountType: { value: 'Standard_LRS' },

                clusterName: { value: 'REPLACE_WITH_CLUSTER_NAME' },
                location: { value: location },
                tenantId: { value: '' },

                witnessType: { value: witnessType },
                clusterWitnessStorageAccountName: { value: witnessType === 'Cloud' ? 'REPLACE_WITH_WITNESS_STORAGE_ACCOUNT' : '' },

                localAdminUserName: { value: 'REPLACE_WITH_LOCAL_ADMIN_USERNAME' },
                localAdminPassword: { value: null },

                AzureStackLCMAdminUsername: { value: 'REPLACE_WITH_LCM_USERNAME' },

                hciResourceProviderObjectID: { value: '' },
                arcNodeResourceIds: { value: ['REPLACE_WITH_ARC_NODE_RESOURCE_ID_1'] },

                domainFqdn: { value: domainFqdn },
                namingPrefix: { value: 'hci' },
                adouPath: { value: (state.activeDirectory === 'azure_ad' && state.adOuPath) ? state.adOuPath : '' },
                adfsServerName: { value: (state.scenario === 'disconnected' && state.adfsServerName) ? state.adfsServerName : '' },

                securityLevel: { value: state.securityConfiguration === 'customized' ? 'Customized' : 'Recommended' },
                driftControlEnforced: { value: state.securitySettings?.driftControlEnforced ?? true },
                credentialGuardEnforced: { value: state.securitySettings?.credentialGuardEnforced ?? true },
                smbSigningEnforced: { value: state.securitySettings?.smbSigningEnforced ?? true },
                smbClusterEncryption: { value: state.securitySettings?.smbClusterEncryption ?? true },
                bitlockerBootVolume: { value: state.securitySettings?.bitlockerBootVolume ?? true },
                bitlockerDataVolumes: { value: state.securitySettings?.bitlockerDataVolumes ?? true },
                wdacEnforced: { value: state.securitySettings?.wdacEnforced ?? true },

                streamingDataClient: { value: true },
                euLocation: { value: false },
                episodicDataUpload: { value: true },

                configurationMode: { value: state.storagePoolConfiguration || 'Express' },

                subnetMask: { value: subnetMask },
                defaultGateway: { value: useDhcp ? '' : (state.infraGateway || 'REPLACE_WITH_DEFAULT_GATEWAY') },
                startingIPAddress: { value: startIp },
                endingIPAddress: { value: endIp },
                dnsServers: { value: useDhcp ? [''] : dnsServers },
                useDhcp: { value: useDhcp },

                physicalNodesSettings: { value: physicalNodesSettings },

                networkingType: { value: networkingType },
                networkingPattern: { value: intentToNetworkingPattern[state.intent] || 'hyperConverged' },
                intentList: { value: intentList },
                storageNetworkList: { value: storageNetworkList },
                storageConnectivitySwitchless: { value: state.storage === 'switchless' },
                enableStorageAutoIp: { value: state.storageAutoIp === 'enabled' },

                customLocation: { value: '' },

                sbeVersion: { value: '' },
                sbeFamily: { value: '' },
                sbePublisher: { value: '' },
                sbeManifestSource: { value: '' },
                sbeManifestCreationDate: { value: '' },
                partnerProperties: { value: [] },
                partnerCredentiallist: { value: [] }
            };

            // Apply the correct LCM password parameter key based on the selected reference template.
            // - Commercial create-cluster: AzureStackLCMAdminPassword
            // - US Gov create-cluster-for-usgov: AzureStackLCMAdminPasssword (note the triple 's')
            // - Rack-Aware create-cluster-rac-enabled: AzureStackLCMAdminPasssword
            const lcmPasswordParamName = (isUsGovCloud || isRackAware) ? 'AzureStackLCMAdminPasssword' : 'AzureStackLCMAdminPassword';
            base[lcmPasswordParamName] = { value: null };

            // Rack-Aware quickstart template expects these additional parameters.
            if (isRackAware) {
                base.clusterPattern = { value: 'RackAware' };
                // create-cluster-rac-enabled expects:
                // localAvailabilityZones.value = [{ localAvailabilityZoneName: 'ZoneA', nodes: ['node1'] }, ...]
                const z = state.rackAwareZones;
                const zone1Name = (z && z.zone1Name) ? String(z.zone1Name).trim() : '';
                const zone2Name = (z && z.zone2Name) ? String(z.zone2Name).trim() : '';
                const assignments = (z && z.assignments && typeof z.assignments === 'object') ? z.assignments : null;

                const nodeNames = Array.from({ length: nodeCount }, (_, i) => getNodeNameForArm(i));
                const nodesForZone = (zoneNumber) => {
                    const out = [];
                    for (let nodeIndex0 = 0; nodeIndex0 < nodeCount; nodeIndex0++) {
                        const nodeId1 = String(nodeIndex0 + 1);
                        const assignedZone = assignments ? Number(assignments[nodeId1]) : null;
                        if (assignedZone === zoneNumber) out.push(nodeNames[nodeIndex0] || `node${nodeIndex0 + 1}`);
                    }
                    return out;
                };

                const zone1Nodes = nodesForZone(1);
                const zone2Nodes = nodesForZone(2);

                // If any nodes are unassigned (shouldn't happen due to UI enforcement), distribute them deterministically.
                const assignedSet = new Set([...zone1Nodes, ...zone2Nodes]);
                const unassigned = nodeNames.filter(n => n && !assignedSet.has(n));
                unassigned.forEach((n) => {
                    if (zone1Nodes.length <= zone2Nodes.length) zone1Nodes.push(n);
                    else zone2Nodes.push(n);
                });

                base.localAvailabilityZones = {
                    value: [
                        {
                            localAvailabilityZoneName: zone1Name || 'ZoneA',
                            nodes: zone1Nodes.length ? zone1Nodes : ['REPLACE_WITH_ZONEA_NODE_1']
                        },
                        {
                            localAvailabilityZoneName: zone2Name || 'ZoneB',
                            nodes: zone2Nodes.length ? zone2Nodes : ['REPLACE_WITH_ZONEB_NODE_1']
                        }
                    ]
                };
            }

            return base;
        })();

        const file = {
            $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
            contentVersion: '1.0.0.0',
            parameters
        };

        const payload = {
            generatedAt: new Date().toISOString(),
            version: '1.0',
            cloud: state.region || '',
            referenceTemplate: referenceTemplate,
            readiness: readiness,
            parametersFile: file
        };

        // Prefer localStorage but also include a URL hash fallback for file:// previews.
        try {
            localStorage.setItem('azloc_arm_payload', JSON.stringify(payload));
        } catch (e) {
            // ignore
        }

        let hash = '';
        try {
            hash = '#data=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
        } catch (e) {
            hash = '';
        }

        window.open('arm.html' + hash, '_blank');
    } catch (err) {
        reportUiError(err, 'generateArmParameters');
    }
}

function generateReport() {
    try {
        const readiness = getReportReadiness();
        if (!readiness.ready) {
            const msg = 'Complete these items before generating the report:\n\n- ' + readiness.missing.join('\n- ');
            alert(msg);
            return;
        }

        const payload = {
            generatedAt: new Date().toISOString(),
            version: '1.0',
            state: JSON.parse(JSON.stringify(state))
        };

        // Prefer localStorage but also include a URL hash fallback for file:// previews.
        try {
            localStorage.setItem('azloc_report_payload', JSON.stringify(payload));
        } catch (e) {
            // ignore
        }

        let hash = '';
        try {
            hash = '#data=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
        } catch (e) {
            hash = '';
        }

        window.open('report.html' + hash, '_blank');
    } catch (err) {
        reportUiError(err, 'generateReport');
    }
}

function selectOption(category, value) {
    // Special handling for M365 Local - stop workflow and show documentation
    if (category === 'scenario' && value === 'm365local') {
        showM365LocalInfo();
        return;
    }
    
    if (category === 'nodes') {
        const chip = document.querySelector(`.node-chip[onclick*="'${value}'"]`);
        if (chip && chip.classList.contains('disabled')) return;
        state.nodes = value;
        state.ports = null; state.storage = null; state.intent = null; state.outbound = null; state.arc = null; state.proxy = null; state.ip = null; state.customIntents = {};
        state.switchlessLinkMode = null;
        state.rackAwareZones = null;
        state.rackAwareZonesConfirmed = false;
        state.rackAwareZoneSwapSelection = null;
        state.rackAwareTorsPerRoom = null;
        state.rackAwareTorArchitecture = null;
        state.nodeSettings = [];
    } else {
        // data-value is not globally unique across the page.
        // Find the option-card that matches BOTH the category and the value.
        const catCandidates = Array.from(document.querySelectorAll(`.option-card[onclick*="selectOption('${category}'"]`));
        const v = (value == null ? '' : String(value));
        const card = catCandidates.find(c => String(c.getAttribute('data-value') || '') === v) || null;
        if (card && card.classList && card.classList.contains('disabled')) return;
        state[category] = value;
    }

    // Reset chains
    if (category === 'scenario') {
        state.scenario = value;
        state.region = null;
        state.localInstanceRegion = null;
        state.scale = null;
        state.nodes = null;
        state.ports = null;
        state.storage = null;
        state.switchlessLinkMode = null;
        state.rackAwareZones = null;
        state.rackAwareZonesConfirmed = false;
        state.rackAwareZoneSwapSelection = null;
        state.rackAwareTorsPerRoom = null;
        state.rackAwareTorArchitecture = null;
        state.intent = null;
        state.customIntentConfirmed = false;
        state.outbound = null;
        state.arc = null;
        state.proxy = null;
        state.ip = null;
        state.infra = null;
        state.infraCidr = null;
        state.infraCidrAuto = true;
        state.infraGateway = null;
        state.infraGatewayManual = false;
        state.infraVlan = null;
        state.infraVlanId = null;
        state.storageAutoIp = null;
        state.customIntents = {};
    } else if (category === 'region') {
        state.region = value;
        state.localInstanceRegion = null;
        state.scale = null;
        state.nodes = null;
        state.ports = null;
        state.storage = null;
        state.switchlessLinkMode = null;
        state.rackAwareZones = null;
        state.rackAwareZonesConfirmed = false;
        state.rackAwareZoneSwapSelection = null;
        state.rackAwareTorsPerRoom = null;
        state.rackAwareTorArchitecture = null;
        state.intent = null;
        state.customIntentConfirmed = false;
        state.outbound = null;
        state.arc = null;
        state.proxy = null;
        state.ip = null;
        state.infra = null;
        state.infraCidr = null;
        state.infraCidrAuto = true;
        state.infraGateway = null;
        state.infraGatewayManual = false;
        state.infraVlan = null;
        state.infraVlanId = null;
        state.storageAutoIp = null;
        state.customIntents = {};
    } else if (category === 'localInstanceRegion') {
        state.localInstanceRegion = value;
        state.scale = null;
        state.nodes = null;
        state.ports = null;
        state.storage = null;
        state.switchlessLinkMode = null;
        state.rackAwareZones = null;
        state.rackAwareZonesConfirmed = false;
        state.rackAwareZoneSwapSelection = null;
        state.rackAwareTorsPerRoom = null;
        state.rackAwareTorArchitecture = null;
        state.intent = null;
        state.customIntentConfirmed = false;
        state.outbound = null;
        state.arc = null;
        state.proxy = null;
        state.ip = null;
        state.infra = null;
        state.infraCidr = null;
        state.infraCidrAuto = true;
        state.infraGateway = null;
        state.infraGatewayManual = false;
        state.infraVlan = null;
        state.infraVlanId = null;
        state.storageAutoIp = null;
        state.customIntents = {};
    } else if (category === 'scale') {
        state.nodes = null; state.ports = null; state.storage = null; state.intent = null; state.customIntentConfirmed = false; state.storageAutoIp = null; state.outbound = null; state.arc = null; state.proxy = null; state.ip = null; state.infraVlan = null; state.infraVlanId = null;
        state.switchlessLinkMode = null;
        state.rackAwareZones = null;
        state.rackAwareZonesConfirmed = false;
        state.rackAwareZoneSwapSelection = null;
        state.rackAwareTorsPerRoom = null;
        state.rackAwareTorArchitecture = null;
        state.nodeSettings = [];
        updateWitnessType();
    } else if (category === 'nodes') {
        state.storage = null; state.ports = null; state.intent = null; state.customIntentConfirmed = false; state.storageAutoIp = null; state.outbound = null; state.arc = null; state.proxy = null; state.ip = null; state.infraVlan = null; state.infraVlanId = null;
        state.switchlessLinkMode = null;
        state.rackAwareZones = null;
        state.rackAwareZonesConfirmed = false;
        state.rackAwareZoneSwapSelection = null;
        state.rackAwareTorsPerRoom = null;
        state.rackAwareTorArchitecture = null;
        state.nodeSettings = [];
        updateWitnessType();
    } else if (category === 'witnessType') {
        // Only allow manual selection if not locked
        if (!isWitnessTypeLocked()) {
            state.witnessType = value;
        }
    } else if (category === 'storage') {
        state.ports = null; state.intent = null; state.customIntentConfirmed = false; state.storageAutoIp = null; state.infraVlan = null; state.infraVlanId = null;
        state.switchlessLinkMode = null;
        // Storage choice should not invalidate Rack Aware zone placement or ToR architecture.
        // (Rack Aware is a scale/topology decision; users expect ToR selections to persist
        // when moving to Step 06 and beyond.)
    } else if (category === 'switchlessLinkMode') {
        // Changing link mode changes the physical wiring requirements; force the user
        // to re-pick ports and downstream intent mappings.
        state.ports = null;
        state.intent = null;
        state.customIntentConfirmed = false;
        state.storageAutoIp = null;
        try { state.portConfig = null; } catch (e) { /* ignore */ }
    } else if (category === 'rackAwareTorsPerRoom') {
        state.rackAwareTorsPerRoom = value;
        state.rackAwareTorArchitecture = null;
    } else if (category === 'ports') {
        state.storagePoolConfiguration = null;
        state.intent = null;
        state.customIntentConfirmed = false;
        state.customIntents = {};
        state.intentOverrides = {};
        state.storageAutoIp = null;
        state.infraVlan = null;
        state.infraVlanId = null;
    } else if (category === 'storagePoolConfiguration') {
        state.storagePoolConfiguration = value;
    } else if (category === 'intent') {
        state.intent = value;
        state.customIntentConfirmed = false;
        state.storageAutoIp = null;
    } else if (category === 'outbound') {
        state.arc = null; state.proxy = null; state.ip = null; state.storageAutoIp = null; state.infraVlan = null; state.infraVlanId = null;
        state.nodeSettings = [];
        
        // For disconnected scenarios, Arc Gateway must be disabled (no_arc)
        if (state.scenario === 'disconnected') {
            state.arc = 'no_arc';
        }
    } else if (category === 'arc') {
        state.proxy = null; state.ip = null; state.storageAutoIp = null; state.infraVlan = null; state.infraVlanId = null;
        state.nodeSettings = [];
    } else if (category === 'proxy') {
        state.ip = null; state.infra = null; state.infraCidr = null; state.infraCidrAuto = true; state.infraGateway = null; state.infraGatewayManual = false; state.storageAutoIp = null; state.infraVlan = null; state.infraVlanId = null;
        state.nodeSettings = [];
    } else if (category === 'ip') {
        state.infra = null; state.infraCidr = null; state.infraCidrAuto = true; state.infraGateway = null; state.infraGatewayManual = false; state.infraVlan = 'default'; state.infraVlanId = null;
        state.nodeSettings = [];
    } else if (category === 'infraVlan') {
        state.infraVlan = value;
        if (value !== 'custom') {
            state.infraVlanId = null;
        }

        applyInfraVlanVisibility();
    } else if (category === 'activeDirectory') {
        state.activeDirectory = value;
        state.adDomain = null;
        state.adOuPath = null;
        state.adfsServerName = null;
        state.dnsServers = [];
        state.localDnsZone = null;
        state.dnsServiceExisting = (value === 'local_identity') ? true : null;
        renderDnsServers();
        const dnsSection = document.getElementById('dns-config-section');
        const localZone = document.getElementById('local-dns-zone');
        const dnsTitle = document.getElementById('dns-config-title');
        const adDomainSection = document.getElementById('ad-domain-section');
        const adDomainInput = document.getElementById('ad-domain');
        const adOuPathInput = document.getElementById('ad-ou-path');
        const adfsServerInput = document.getElementById('adfs-server-name');
        if (dnsSection) dnsSection.classList.remove('hidden');
        if (adDomainSection) {
            if (value === 'azure_ad') {
                adDomainSection.classList.remove('hidden');
            } else {
                adDomainSection.classList.add('hidden');
                if (adDomainInput) adDomainInput.value = '';
                if (adOuPathInput) adOuPathInput.value = '';
                if (adfsServerInput) adfsServerInput.value = '';
            }
        }
        if (localZone) {
            if (value === 'local_identity') {
                localZone.classList.remove('hidden');
            } else {
                localZone.classList.add('hidden');
            }
        }

        // When using Local Identity, show the DNS Service block and hide the generic DNS Configuration title.
        if (dnsTitle) {
            if (value === 'local_identity') {
                dnsTitle.classList.add('hidden');
            } else {
                dnsTitle.classList.remove('hidden');
            }
        }

        // Default the DNS Service radio to "Yes" for Local Identity.
        try {
            if (value === 'local_identity') {
                const yes = document.querySelector('input[name="dns-service-existing"][value="yes"]');
                if (yes) yes.checked = true;
                updateDnsServiceExistingNote();
            }
        } catch (e) {
            // ignore
        }
        // Add first DNS server automatically
        addDnsServer();
    } else if (category === 'securityConfiguration') {
        state.securityConfiguration = value;
        const customSecuritySection = document.getElementById('custom-security-section');
        if (customSecuritySection) {
            if (value === 'customized') {
                customSecuritySection.classList.remove('hidden');
            } else {
                customSecuritySection.classList.add('hidden');
                // Reset to recommended defaults
                state.securitySettings = {
                    driftControlEnforced: true,
                    bitlockerBootVolume: true,
                    bitlockerDataVolumes: true,
                    wdacEnforced: true,
                    credentialGuardEnforced: true,
                    smbSigningEnforced: true,
                    smbClusterEncryption: true
                };
                // Update all checkboxes to checked
                const checkboxes = customSecuritySection.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = true);
            }
        }
    } else if (category === 'sdnManagement') {
        state.sdnManagement = value;
    }

    updateUI();
}

function increaseFontSize() {
    const sizes = ['small', 'medium', 'large', 'x-large'];
    const currentIndex = sizes.indexOf(state.fontSize || 'medium');
    if (currentIndex < sizes.length - 1) {
        state.fontSize = sizes[currentIndex + 1];
        applyFontSize();
        saveStateToLocalStorage();
    }
}

function decreaseFontSize() {
    const sizes = ['small', 'medium', 'large', 'x-large'];
    const currentIndex = sizes.indexOf(state.fontSize || 'medium');
    if (currentIndex > 0) {
        state.fontSize = sizes[currentIndex - 1];
        applyFontSize();
        saveStateToLocalStorage();
    }
}

function applyFontSize() {
    const sizes = {
        'small': '14px',
        'medium': '16px',
        'large': '18px',
        'x-large': '20px'
    };
    document.documentElement.style.fontSize = sizes[state.fontSize || 'medium'];
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveStateToLocalStorage();
}

function applyTheme() {
    const root = document.documentElement;
    const themeButton = document.getElementById('theme-toggle');
    
    if (state.theme === 'light') {
        root.style.setProperty('--bg-dark', '#f5f5f5');
        root.style.setProperty('--card-bg', '#ffffff');
        root.style.setProperty('--text-primary', '#000000');
        root.style.setProperty('--text-secondary', '#6b7280');
        root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.1)');
        if (themeButton) themeButton.textContent = '☀️';
        document.body.style.background = '#f5f5f5';
    } else {
        root.style.setProperty('--bg-dark', '#000000');
        root.style.setProperty('--card-bg', '#111111');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#a1a1aa');
        root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
        if (themeButton) themeButton.textContent = '🌙';
        document.body.style.background = '#000000';
    }
}

function updateRackAwareZoneName(zoneIndex, value) {
    try {
        const zi = String(zoneIndex) === '2' ? 2 : 1;
        if (!state.rackAwareZones) {
            state.rackAwareZones = { zone1Name: 'Zone1', zone2Name: 'Zone2', assignments: {}, nodeCount: null };
        }
        const v = (value == null ? '' : String(value)).trim();
        if (zi === 1) state.rackAwareZones.zone1Name = v || 'Zone1';
        else state.rackAwareZones.zone2Name = v || 'Zone2';

        state.rackAwareZonesConfirmed = false;
        state.rackAwareZoneSwapSelection = null;
        state.rackAwareTorsPerRoom = null;
        state.rackAwareTorArchitecture = null;
        updateUI();
    } catch (err) {
        reportUiError(err, 'updateRackAwareZoneName');
    }
}

function ensureRackAwareZonesInitialized() {
    const n = state.nodes ? parseInt(state.nodes, 10) : NaN;
    if (state.scale !== 'rack_aware' || isNaN(n) || n <= 0) {
        state.rackAwareZones = null;
        state.rackAwareZonesConfirmed = false;
        state.rackAwareZoneSwapSelection = null;
        return;
    }

    if (!state.rackAwareZones) {
        state.rackAwareZones = { zone1Name: 'Zone1', zone2Name: 'Zone2', assignments: {}, nodeCount: null };
    }

    // Reinitialize assignments when node count changes.
    if (state.rackAwareZones.nodeCount !== n || !state.rackAwareZones.assignments || Object.keys(state.rackAwareZones.assignments).length !== n) {
        const existingName1 = state.rackAwareZones.zone1Name || 'Zone1';
        const existingName2 = state.rackAwareZones.zone2Name || 'Zone2';
        const assignments = {};
        const half = Math.floor(n / 2);
        for (let i = 1; i <= n; i++) {
            assignments[String(i)] = i <= half ? 1 : 2;
        }
        state.rackAwareZones = { zone1Name: existingName1, zone2Name: existingName2, assignments, nodeCount: n };
        state.rackAwareZonesConfirmed = false;
        state.rackAwareZoneSwapSelection = null;
    }
}

function getRackAwareNodeLabel(nodeId1Based) {
    try {
        const idx = nodeId1Based - 1;
        if (state.nodeSettings && state.nodeSettings[idx] && state.nodeSettings[idx].name) {
            const s = String(state.nodeSettings[idx].name).trim();
            if (s) return s;
        }
    } catch (e) {
        // ignore
    }
    return 'Node ' + nodeId1Based;
}

function toggleRackAwareZonesConfirmed() {
    try {
        ensureRackAwareZonesInitialized();
        const z = state.rackAwareZones;
        const ready = Boolean(z && z.zone1Name && z.zone2Name && z.assignments);
        if (!ready) return;

        const next = !state.rackAwareZonesConfirmed;
        
        // If confirming (not un-confirming), validate even split
        if (next) {
            const n = state.nodes ? parseInt(state.nodes, 10) : NaN;
            if (isNaN(n) || n <= 0) return;
            
            // Count nodes in each zone
            let zone1Count = 0;
            let zone2Count = 0;
            for (let i = 1; i <= n; i++) {
                const zone = z.assignments[String(i)];
                if (zone === 1) zone1Count++;
                else if (zone === 2) zone2Count++;
            }
            
            // Validate 50/50 split
            const expectedPerZone = n / 2;
            if (zone1Count !== expectedPerZone || zone2Count !== expectedPerZone) {
                alert(`Rack Aware clusters require an even 50/50 split of nodes between zones.\n\nCurrent distribution:\n• ${z.zone1Name || 'Zone1'}: ${zone1Count} node${zone1Count !== 1 ? 's' : ''}\n• ${z.zone2Name || 'Zone2'}: ${zone2Count} node${zone2Count !== 1 ? 's' : ''}\n\nRequired:\n• Each zone must have exactly ${expectedPerZone} node${expectedPerZone !== 1 ? 's' : ''}\n\nPlease adjust the node assignments and try again.`);
                return;
            }
        }
        
        state.rackAwareZonesConfirmed = next;
        state.rackAwareZoneSwapSelection = null;

        // If the user re-enters edit mode, ToR selections must be re-chosen.
        if (!next) {
            state.rackAwareTorsPerRoom = null;
            state.rackAwareTorArchitecture = null;
        }

        updateUI();
    } catch (e) {
        reportUiError(e, 'toggleRackAwareZonesConfirmed');
    }
}

function renderRackAwareZonesUi() {
    const root = document.getElementById('rack-aware-zones');
    if (!root) return;

    const n = state.nodes ? parseInt(state.nodes, 10) : NaN;
    const shouldShow = state.scale === 'rack_aware' && !isNaN(n) && n > 0;
    if (!shouldShow) {
        root.classList.add('hidden');
        return;
    }

    ensureRackAwareZonesInitialized();
    root.classList.remove('hidden');

    const z = state.rackAwareZones;
    const confirmed = Boolean(state.rackAwareZonesConfirmed);
    root.classList.toggle('rack-az-locked', confirmed);

    const input1 = document.getElementById('rack-az1-name');
    const input2 = document.getElementById('rack-az2-name');
    if (input1 && document.activeElement !== input1) input1.value = z.zone1Name || 'Zone1';
    if (input2 && document.activeElement !== input2) input2.value = z.zone2Name || 'Zone2';
    if (input1) input1.disabled = confirmed;
    if (input2) input2.disabled = confirmed;

    const confirmBtn = document.getElementById('rack-aware-zones-confirm-btn');
    const confirmStatus = document.getElementById('rack-aware-zones-confirm-status');
    if (confirmBtn) {
        if (confirmBtn.dataset && confirmBtn.dataset.bound !== '1') {
            confirmBtn.dataset.bound = '1';
            confirmBtn.addEventListener('click', () => toggleRackAwareZonesConfirmed());
        }
        confirmBtn.disabled = !(z && z.zone1Name && z.zone2Name && z.assignments);
        confirmBtn.classList.toggle('is-confirmed', confirmed);
        confirmBtn.textContent = confirmed ? 'Edit zones & node placement' : 'Confirm zones & node placement';
    }
    if (confirmStatus) {
        confirmStatus.textContent = confirmed ? 'Confirmed. Continue to TOR switch architecture.' : 'Not confirmed yet.';
    }

    const drop1 = document.getElementById('rack-az1-drop');
    const drop2 = document.getElementById('rack-az2-drop');
    if (!drop1 || !drop2) return;

    const half = Math.floor(n / 2);
    const zone1Ids = [];
    const zone2Ids = [];
    for (let i = 1; i <= n; i++) {
        const zone = z.assignments[String(i)] === 1 ? 1 : 2;
        (zone === 1 ? zone1Ids : zone2Ids).push(i);
    }

    function getNodeZone(nodeId) {
        return (state.rackAwareZones && state.rackAwareZones.assignments && state.rackAwareZones.assignments[String(nodeId)] === 1) ? 1 : 2;
    }

    function buildNodePill(nodeId, currentZone) {
        const pill = document.createElement('div');
        pill.className = 'rack-az-node';
        pill.draggable = !confirmed;
        pill.dataset.nodeId = String(nodeId);
        pill.setAttribute('aria-grabbed', 'false');
        pill.setAttribute('role', 'button');
        pill.setAttribute('tabindex', '0');

        const selectedId = state.rackAwareZoneSwapSelection ? parseInt(String(state.rackAwareZoneSwapSelection), 10) : NaN;
        if (!isNaN(selectedId) && selectedId === nodeId) pill.classList.add('is-selected');

        const idSpan = document.createElement('span');
        idSpan.className = 'rack-az-node__id';
        idSpan.textContent = String(nodeId);

        const labelSpan = document.createElement('span');
        labelSpan.textContent = getRackAwareNodeLabel(nodeId);

        pill.appendChild(idSpan);
        pill.appendChild(labelSpan);

        pill.addEventListener('dragstart', (e) => {
            try {
                if (confirmed) return;
                pill.setAttribute('aria-grabbed', 'true');
                e.dataTransfer.setData('text/plain', String(nodeId));
                e.dataTransfer.effectAllowed = 'move';
            } catch (err) {
                // ignore
            }
        });
        pill.addEventListener('dragend', () => {
            pill.setAttribute('aria-grabbed', 'false');
        });

        // Balanced zones means you can't "move" a node to the other zone without also
        // moving one back. Use a swap interaction: click a node to select it, then click
        // a node in the other zone to swap them.
        function handleSwapClick() {
            try {
                if (confirmed) return;
                const selectedRaw = state.rackAwareZoneSwapSelection;
                const selected = selectedRaw ? parseInt(String(selectedRaw), 10) : NaN;

                if (isNaN(selected)) {
                    state.rackAwareZoneSwapSelection = String(nodeId);
                    renderRackAwareZonesUi();
                    return;
                }

                if (selected === nodeId) {
                    state.rackAwareZoneSwapSelection = null;
                    renderRackAwareZonesUi();
                    return;
                }

                const zoneA = getNodeZone(selected);
                const zoneB = getNodeZone(nodeId);

                if (zoneA === zoneB) {
                    state.rackAwareZoneSwapSelection = String(nodeId);
                    renderRackAwareZonesUi();
                    return;
                }

                state.rackAwareZones.assignments[String(selected)] = zoneB;
                state.rackAwareZones.assignments[String(nodeId)] = zoneA;
                state.rackAwareZoneSwapSelection = null;
                renderRackAwareZonesUi();
            } catch (err) {
                reportUiError(err, 'rackAwareZones.swap');
            }
        }

        pill.addEventListener('click', (e) => {
            if (e && e.defaultPrevented) return;
            handleSwapClick();
        });
        pill.addEventListener('keydown', (e) => {
            const key = e && e.key ? String(e.key) : '';
            if (key === 'Enter' || key === ' ') {
                e.preventDefault();
                handleSwapClick();
            }
        });

        return pill;
    }

    function setDropHandlers(el, zoneTarget) {
        if (!el || el.dataset && el.dataset.dndBound === '1') return;
        if (el.dataset) el.dataset.dndBound = '1';

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            el.classList.add('is-over');
            try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* ignore */ }
        });
        el.addEventListener('dragleave', () => {
            el.classList.remove('is-over');
        });
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.classList.remove('is-over');
            try {
                if (confirmed) return;
                const nodeId = parseInt(e.dataTransfer.getData('text/plain'), 10);
                if (isNaN(nodeId) || nodeId < 1 || nodeId > n) return;

                const currentZone = (state.rackAwareZones && state.rackAwareZones.assignments && state.rackAwareZones.assignments[String(nodeId)] === 1) ? 1 : 2;
                if (currentZone === zoneTarget) return;

                // Enforce equal distribution: each zone must have exactly n/2 nodes.
                // For Rack Aware, nodes must always be split 50/50, so ALWAYS perform a swap.
                const swapId = zoneTarget === 1 ? zone1Ids[0] : zone2Ids[0];
                if (swapId && swapId !== nodeId) {
                    state.rackAwareZones.assignments[String(nodeId)] = zoneTarget;
                    state.rackAwareZones.assignments[String(swapId)] = currentZone;
                    state.rackAwareZoneSwapSelection = null;
                    renderRackAwareZonesUi();
                }
                return;
            } catch (err) {
                reportUiError(err, 'rackAwareZones.drop');
            }
        });
    }

    setDropHandlers(drop1, 1);
    setDropHandlers(drop2, 2);

    drop1.innerHTML = '';
    drop2.innerHTML = '';

    if (zone1Ids.length === 0) {
        const empty1 = document.createElement('div');
        empty1.className = 'rack-az-empty';
        empty1.textContent = 'Drag nodes here.';
        drop1.appendChild(empty1);
    } else {
        zone1Ids.forEach(id => drop1.appendChild(buildNodePill(id, 1)));
    }

    if (zone2Ids.length === 0) {
        const empty2 = document.createElement('div');
        empty2.className = 'rack-az-empty';
        empty2.textContent = 'Drag nodes here.';
        drop2.appendChild(empty2);
    } else {
        zone2Ids.forEach(id => drop2.appendChild(buildNodePill(id, 2)));
    }
}

function renderRackAwareTorUi() {
    try {
        const n = parseInt(state.nodes, 10);
        const shouldShow = state.scale === 'rack_aware' && !isNaN(n) && n > 0;

        const z = state.rackAwareZones;
        const zonesReady = Boolean(z && z.zone1Name && z.zone2Name && z.assignments);
        const confirmed = zonesReady && Boolean(state.rackAwareZonesConfirmed);

        const root = document.getElementById('rack-aware-tor');
        const opt1 = document.getElementById('rack-aware-tor-options-1');
        const opt2 = document.getElementById('rack-aware-tor-options-2');
        if (!root) return;

        if (!shouldShow) {
            root.classList.add('hidden');
            state.rackAwareTorsPerRoom = null;
            state.rackAwareTorArchitecture = null;
            if (opt1) opt1.classList.add('hidden');
            if (opt2) opt2.classList.add('hidden');
            return;
        }

        root.classList.remove('hidden');

        // Gate ToR selection until zones are confirmed.
        let lockMsg = document.getElementById('rack-aware-tor-locked-msg');
        if (!lockMsg) {
            lockMsg = document.createElement('div');
            lockMsg.id = 'rack-aware-tor-locked-msg';
            lockMsg.className = 'info-box warning visible';
            lockMsg.style.marginBottom = '0.9rem';
            root.insertBefore(lockMsg, root.firstChild.nextSibling);
        }
        lockMsg.classList.toggle('hidden', confirmed);
        lockMsg.innerHTML = '<strong>Confirm availability zones to continue</strong><p style="margin-top:0.35rem;">Use the “Confirm zones &amp; node placement” button above, then select TOR switches per room.</p>';

        // Disable cards until confirmed (visual + functional).
        try {
            const cards = root.querySelectorAll('.option-card');
            for (let i = 0; i < cards.length; i++) {
                cards[i].classList.toggle('disabled', !confirmed);
            }
        } catch (eCards) {
            // ignore
        }

        if (!confirmed) {
            state.rackAwareTorsPerRoom = null;
            state.rackAwareTorArchitecture = null;
            if (opt1) opt1.classList.add('hidden');
            if (opt2) opt2.classList.add('hidden');
            return;
        }

        const torsPerRoom = state.rackAwareTorsPerRoom ? String(state.rackAwareTorsPerRoom) : null;
        const arch = state.rackAwareTorArchitecture ? String(state.rackAwareTorArchitecture) : null;

        // Enforce valid combos.
        if (torsPerRoom === '2' && (arch === 'option_c' || arch === 'option_d')) state.rackAwareTorArchitecture = null;
        if (torsPerRoom === '1' && (arch === 'option_a' || arch === 'option_b')) state.rackAwareTorArchitecture = null;

        if (opt1) opt1.classList.toggle('hidden', torsPerRoom !== '1');
        if (opt2) opt2.classList.toggle('hidden', torsPerRoom !== '2');
    } catch (e) {
        reportUiError(e, 'renderRackAwareTorUi');
    }
}

function confirmCustomIntentSelection() {
    if (state.intent !== 'custom') return;
    state.customIntentConfirmed = true;
    updateUI();
}

// Some preview environments can block inline event handlers.
// Use click delegation (capture phase) to drive the wizard based on the existing
// inline onclick strings, while preventing the inline handler from firing twice.
function installClickDelegation() {
    if (window.__azlocClickDelegationInstalled) return;
    window.__azlocClickDelegationInstalled = true;

    document.addEventListener('click', (e) => {
        try {
            let target = e.target;
            if (!target) return;
            // In some WebViews/preview panes, click targets can be Text nodes.
            // Normalize to the element parent so we can walk up the DOM.
            if (target.nodeType === 3 && target.parentNode) target = target.parentNode;
            if (!target || target.nodeType !== 1) return;

            // Never intercept clicks intended for form controls.
            // In some preview/browser combinations, capture-phase preventDefault can block focusing inputs.
            let controlProbe = target;
            while (controlProbe && controlProbe !== document.body) {
                const tag = (controlProbe.tagName || '').toUpperCase();
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || tag === 'LABEL') {
                    return;
                }
                controlProbe = controlProbe.parentNode;
            }

            // Avoid relying on Element/closest in constrained preview environments.
            let el = target;
            while (el && el !== document.body) {
                if (el.getAttribute && el.getAttribute('onclick')) {
                    const isCard = el.classList && (el.classList.contains('option-card') || el.classList.contains('node-chip'));
                    if (isCard) break;
                }
                el = el.parentNode;
            }
            if (!el || el === document.body) return;

            const onclick = (el.getAttribute('onclick') || '').trim();
            const match = onclick.match(/selectOption\('([^']+)'\s*,\s*'([^']+)'\)/);
            if (!match) return;

            e.preventDefault();
            e.stopPropagation();

            const [, category, value] = match;
            selectOption(category, value);
        } catch (err) {
            reportUiError(err, 'click-delegation');
        }
    }, true);
}

installClickDelegation();

function updateUI() {
    const steps = [
        document.getElementById('step-cloud'),
        document.getElementById('step-local-region'),
        document.getElementById('step-2'),
        document.getElementById('step-3'),
        document.getElementById('step-3-5'),
        document.getElementById('step-4'),
        document.getElementById('step-5'),
        document.getElementById('step-6'),
        document.getElementById('step-7'),
        document.getElementById('step-8'),
        document.getElementById('step-9'),
        document.getElementById('step-10'),
        document.getElementById('step-11'),
        document.getElementById('step-12'),
        document.getElementById('step-5-5'),
        document.getElementById('step-13'),
        document.getElementById('step-13-5'),
        document.getElementById('step-14')
    ];

    try {
    // 1. SCENARIO LOGIC & VISIBILITY
    const scenarioExp = document.getElementById('scenario-explanation');
    const multiRackMsg = document.getElementById('multirack-message');

    // Reset Visibility first
    steps.forEach(s => s && s.classList.remove('hidden'));
    if (multiRackMsg) {
        multiRackMsg.classList.add('hidden');
        multiRackMsg.classList.remove('visible');
    }
    if (scenarioExp) scenarioExp.classList.remove('visible');

    if (state.scenario === 'multirack') {
        // Multi-Rack Logic: Hide everything, show message
        steps.forEach(s => s && s.classList.add('hidden'));
        if (multiRackMsg) {
            multiRackMsg.classList.remove('hidden');
            multiRackMsg.classList.add('visible');
        }

        // Keep Scenario option visually selected even though we stop the flow early.
        // (The normal card selection pass runs later in updateUI.)
        document.querySelectorAll('.option-card').forEach(card => {
            const clickFn = card.getAttribute('onclick') || '';
            if (!clickFn.includes("selectOption('scenario'")) return;
            const value = card.getAttribute('data-value');
            if (state.scenario === value) card.classList.add('selected');
            else card.classList.remove('selected');
        });

        // Summary hidden?
        const summaryPanel = document.getElementById('summary-panel');
        if (summaryPanel) summaryPanel.classList.add('hidden');
        return; // STOP FLOW
    } else if (state.scenario === 'disconnected') {
        if (scenarioExp) scenarioExp.innerHTML = `<strong style="color: #ef4444;">Disconnected Mode</strong>
        No Internet connection required. Updates must be applied manually. Arc Gateway and Remote Management features are unavailable. Only supports "Standard" scale deployment (3-16 nodes).`;
        if (scenarioExp) scenarioExp.classList.add('visible');
    } else if (state.scenario === 'm365local') {
        if (scenarioExp) scenarioExp.innerHTML = `<strong style="color: var(--accent-blue);">M365 Local Deployment</strong>
        Optimized for Microsoft 365 workloads. Requires a minimum of 9 physical nodes for high availability and performance. Supports Standard scale configuration only.
        <br><a href="https://learn.microsoft.com/azure/azure-local/concepts/microsoft-365-local-overview" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: underline; font-weight: 500;">📘 More information on M365 Local</a>`;
        if (scenarioExp) scenarioExp.classList.add('visible');
    } else if (state.scenario === 'hyperconverged') {
        if (scenarioExp) scenarioExp.innerHTML = `<strong style="color: var(--accent-blue);">Hyperconverged Infrastructure</strong>
        Consolidated compute and storage in a single rack. Supports Low Capacity and Standard Scale configurations.`;
        if (scenarioExp) scenarioExp.classList.add('visible');
    }

    // Outbound visibility logic (Step 7) moved later or handled here?
    const outboundConnected = document.getElementById('outbound-connected');
    const outboundDisconnected = document.getElementById('outbound-disconnected');

    // Disconnected scenario forces Step 7 options
    if (state.scenario === 'disconnected') {
        if (outboundConnected) outboundConnected.classList.add('hidden');
        if (outboundDisconnected) outboundDisconnected.classList.remove('hidden');
    } else {
        if (outboundConnected) outboundConnected.classList.remove('hidden');
        if (outboundDisconnected) outboundDisconnected.classList.add('hidden');
    }

    // ... remainder of updateUI unchanged ...

    } catch (err) {
        reportUiError(err, 'updateUI');
    }

    // Rack Aware: local availability zones UI (after nodes selection)
    try {
        renderRackAwareZonesUi();
    } catch (e) {
        reportUiError(e, 'renderRackAwareZonesUi');
    }

    // Rack Aware: ToR switch architecture UI (after nodes selection)
    try {
        renderRackAwareTorUi();
    } catch (e) {
        reportUiError(e, 'renderRackAwareTorUi');
    }

    // Report button gating (Step 16)
    const reportBtn = document.getElementById('generate-report-btn');
    if (reportBtn) {
        const readiness = getReportReadiness();
        reportBtn.disabled = !readiness.ready;
        reportBtn.title = readiness.ready ? 'Generate a configuration report' : ('Missing: ' + readiness.missing.join(', '));
    }

    // ARM parameters button gating (Step 16)
    const armBtn = document.getElementById('generate-arm-btn');
    if (armBtn) {
        const readiness = getArmReadiness();
        armBtn.disabled = !readiness.ready;
        armBtn.title = readiness.ready
            ? ('Open ARM parameters JSON (placeholders: ' + (readiness.placeholders || []).join(', ') + ')')
            : ('Missing: ' + readiness.missing.join(', '));
    }

    // Defaults (must run before visual selection updates)
    // Default intent selection (Step 08: Network Traffic Intents)
    // If ports are selected and the user hasn't chosen an intent yet, default to Mgmt + Compute.
    // Constraints later in updateUI may clear/override this if the topology disallows it.
    if (state.ports && !state.intent) {
        state.intent = 'mgmt_compute';
        state.customIntentConfirmed = false;
    }

    // Storage Auto IP defaults depend on storage connectivity and node count.
    // - Switched: Enabled is recommended
    // - Switchless: 3-4 nodes => Disabled is required; 2 nodes => Enabled recommended
    if (state.intent && !state.storageAutoIp) {
        const nodeCount = parseInt(state.nodes, 10);

        if (state.storage === 'switched') {
            state.storageAutoIp = 'enabled';
        } else if (state.storage === 'switchless') {
            if (nodeCount === 3 || nodeCount === 4) {
                state.storageAutoIp = 'disabled';
            } else if (nodeCount === 2) {
                state.storageAutoIp = 'enabled';
            }
        }
    }

    // 2. Visual Updates (Cards)
    document.querySelectorAll('.option-card').forEach(card => {
        const value = card.getAttribute('data-value');
        const clickFn = card.getAttribute('onclick');
        if (!clickFn) return;
        const categoryMatch = clickFn.match(/selectOption\('([^']+)'/);
        if (!categoryMatch) return;
        const category = categoryMatch[1];
        if (category === 'nodes') return;

        let isSelected = state[category] === value;
        if (isSelected) card.classList.add('selected');
        else card.classList.remove('selected');
    });

    // 3. Node Chips Logic & Visuals
    document.querySelectorAll('.node-chip').forEach(chip => {
        const clickFn = chip.getAttribute('onclick');
        if (!clickFn) return;
        const valueStr = clickFn.match(/'([^']+)'\)$/)[1];

        let isDisabled = false;

        if (!state.scale) {
            isDisabled = true;
        } else {
            if (state.scale === 'low_capacity') {
                if (parseInt(valueStr) > 3 || valueStr === '16+') isDisabled = true;
            } else if (state.scale === 'medium') {
                if (valueStr === '16+') isDisabled = true;
            } else if (state.scale === 'rack_aware') {
                if (!['2', '4', '6', '8'].includes(valueStr)) isDisabled = true;
            }
            if (state.scenario === 'disconnected') {
                // Disconnected forces Standard (Medium) scale usually? 
                // If user somehow is in Disconnected + Low Capacity (should be blocked), 
                // we still apply Disconnected Node Rules: Min 3.
                if (state.scale === 'medium') {
                    if (valueStr === '1' || valueStr === '2') isDisabled = true;
                }
            }
            if (state.scenario === 'm365local') {
                // M365 Local requires minimum 9 nodes
                if (valueStr === '1' || valueStr === '2' || valueStr === '3' || valueStr === '4' || valueStr === '5' || valueStr === '6' || valueStr === '7' || valueStr === '8') {
                    isDisabled = true;
                }
            }
            if (state.scenario === 'm365local') {
                // M365 Local requires minimum 9 nodes
                const nodeNum = parseInt(valueStr, 10);
                if (!isNaN(nodeNum) && nodeNum < 9) isDisabled = true;
                if (valueStr === '1' || valueStr === '2' || valueStr === '3' || valueStr === '4' || valueStr === '5' || valueStr === '6' || valueStr === '7' || valueStr === '8') isDisabled = true;
            }
        }

        if (state.nodes === valueStr) chip.classList.add('selected');
        else chip.classList.remove('selected');

        if (isDisabled) {
            chip.classList.add('disabled');
            if (state.nodes === valueStr) {
                state.nodes = null;
                chip.classList.remove('selected');
            }
        } else {
            chip.classList.remove('disabled');
        }
    });

    // 4. Global Constraints/Locks
    const cards = {
        region: {
            'azure_commercial': document.querySelector('[data-value="azure_commercial"]'),
            'azure_government': document.querySelector('[data-value="azure_government"]'),
            'azure_china': document.querySelector('[data-value="azure_china"]')
        },
        localInstanceRegion: {
            'east_us': document.querySelector('[data-value="east_us"][onclick*="localInstanceRegion"]'),
            'west_europe': document.querySelector('[data-value="west_europe"][onclick*="localInstanceRegion"]'),
            'australia_east': document.querySelector('[data-value="australia_east"][onclick*="localInstanceRegion"]'),
            'southeast_asia': document.querySelector('[data-value="southeast_asia"][onclick*="localInstanceRegion"]'),
            'india_central': document.querySelector('[data-value="india_central"][onclick*="localInstanceRegion"]'),
            'canada_central': document.querySelector('[data-value="canada_central"][onclick*="localInstanceRegion"]'),
            'japan_east': document.querySelector('[data-value="japan_east"][onclick*="localInstanceRegion"]'),
            'south_central_us': document.querySelector('[data-value="south_central_us"][onclick*="localInstanceRegion"]'),
            'us_gov_virginia': document.querySelector('[data-value="us_gov_virginia"][onclick*="localInstanceRegion"]')
        },
        scale: {
            'low_capacity': document.querySelector('[data-value="low_capacity"]'),
            'medium': document.querySelector('[data-value="medium"]'),
            'rack_aware': document.querySelector('[data-value="rack_aware"]')
        },
        ports: {
            '1': document.querySelector('[data-value="1"][onclick*="\'ports\'"]'),
            '2': document.querySelector('[data-value="2"][onclick*="\'ports\'"]'),
            '4': document.querySelector('[data-value="4"][onclick*="\'ports\'"]'),
            '6': document.querySelector('[data-value="6"][onclick*="\'ports\'"]'),
            '8': document.querySelector('[data-value="8"][onclick*="\'ports\'"]')
        },
        storage: {
            'switched': document.querySelector('[data-value="switched"]'),
            'switchless': document.querySelector('[data-value="switchless"]')
        },
        intent: {
            'all_traffic': document.querySelector('[data-value="all_traffic"]'),
            'mgmt_compute': document.querySelector('[data-value="mgmt_compute"]'),
            'compute_storage': document.querySelector('[data-value="compute_storage"]'),
            'custom': document.querySelector('[data-value="custom"]')
        },
        arc: {
            'arc_gateway': document.querySelector('[data-value="arc_gateway"]'),
            'no_arc': document.querySelector('[data-value="no_arc"]')
        },
        proxy: {
            'proxy': document.querySelector('[data-value="proxy"]'),
            'no_proxy': document.querySelector('[data-value="no_proxy"]')
        },
        ip: {
            'static': document.querySelector('[data-value="static"]'),
            'dhcp': document.querySelector('[data-value="dhcp"]')
        },
        infraVlan: {
            'default': document.querySelector('[data-value="default"][onclick*="infraVlan"]'),
            'custom': document.querySelector('[data-value="custom"][onclick*="infraVlan"]')
        },
        storageAutoIp: {
            'enabled': document.querySelector('[data-value="enabled"][onclick*="storageAutoIp"]'),
            'disabled': document.querySelector('[data-value="disabled"][onclick*="storageAutoIp"]')
        },
        witnessType: {
            'Cloud': document.querySelector('[data-value="Cloud"][onclick*="witnessType"]'),
            'NoWitness': document.querySelector('[data-value="NoWitness"][onclick*="witnessType"]')
        }
    };

    // Storage Auto IP badges
    // - Switched: Enabled = Recommended
    // - Switchless with 3-4 nodes: Disabled = Required
    // - Switchless with 2 nodes: Enabled = Recommended
    const autoIpBadgeClass = 'badge-recommended';
    const enabledAutoIpCard = cards.storageAutoIp && cards.storageAutoIp.enabled;
    const disabledAutoIpCard = cards.storageAutoIp && cards.storageAutoIp.disabled;

    const clearBadge = (card) => {
        if (!card) return;
        const existing = card.querySelector(`.${autoIpBadgeClass}`);
        if (existing) existing.remove();
    };
    const setBadge = (card, text) => {
        if (!card) return;
        clearBadge(card);
        const badge = document.createElement('span');
        badge.className = autoIpBadgeClass;
        badge.textContent = text;
        card.appendChild(badge);
    };

    clearBadge(enabledAutoIpCard);
    clearBadge(disabledAutoIpCard);

    const nodeCountForBadge = parseInt(state.nodes, 10);
    if (state.storage === 'switched') {
        setBadge(enabledAutoIpCard, 'Recommended');
    } else if (state.storage === 'switchless') {
        if (nodeCountForBadge === 3 || nodeCountForBadge === 4) {
            setBadge(disabledAutoIpCard, 'Required');
        } else if (nodeCountForBadge === 2) {
            setBadge(enabledAutoIpCard, 'Recommended');
        }
    }

    // Reset disabled
    document.querySelectorAll('.option-card').forEach(c => c.classList.remove('disabled'));
    const proxyText = document.getElementById('proxy-enabled-text');
    if (proxyText) proxyText.innerText = 'Traffic routed through proxy.';

    // NEW: Manage 1-Port Option Visibility
    const portOneOption = document.getElementById('port-option-1');
    if (portOneOption) {
        if (state.scale === 'low_capacity' && state.nodes === '1') {
            portOneOption.classList.remove('hidden');
        } else {
            portOneOption.classList.add('hidden');
            // If we hid it while it was selected, clear selection
            if (state.ports === '1') {
                state.ports = null;
                portOneOption.classList.remove('selected');
            }
        }
    }

    // Azure Local Instance Region options are constrained by the selected Azure Cloud.
    const localRegionCards = Object.values(cards.localInstanceRegion || {}).filter(Boolean);
    localRegionCards.forEach(c => c.classList.remove('hidden'));
    if (state.region === 'azure_commercial' || state.region === 'azure_government') {
        localRegionCards.forEach(c => {
            const cloud = c.getAttribute('data-cloud');
            if (cloud !== state.region) {
                c.classList.add('hidden');
                c.classList.add('disabled');
                c.classList.remove('selected');
            }
        });

        if (state.localInstanceRegion) {
            const selectedCard = cards.localInstanceRegion[state.localInstanceRegion];
            const selectedCloud = selectedCard ? selectedCard.getAttribute('data-cloud') : null;
            if (selectedCloud && selectedCloud !== state.region) {
                state.localInstanceRegion = null;
            }
        }
    }

    // Sequential Locks
    if (!state.scenario) Object.values(cards.scale).forEach(c => c && c.classList.add('disabled'));

    // Disconnected Logic -> Constraints on Scale
    if (state.scenario === 'disconnected') {
        // Only allow Medium (Standard)
        if (cards.scale.low_capacity) cards.scale.low_capacity.classList.add('disabled');

        // Disconnected does not support Azure China cloud
        if (cards.region && cards.region.azure_china) {
            cards.region.azure_china.classList.add('disabled');
            if (state.region === 'azure_china') {
                state.region = null;
                state.localInstanceRegion = null;
            }
        }

        // Auto-select Medium? The requirement says "only allow to select".
        // If Low is selected, deselect it.
        if (state.scale === 'low_capacity') state.scale = null;
    }

    // M365 Local Logic -> Constraints on Scale
    if (state.scenario === 'm365local') {
        // Only allow Medium (Standard) - block Low Capacity and Rack Aware
        if (cards.scale.low_capacity) cards.scale.low_capacity.classList.add('disabled');
        if (cards.scale.rack_aware) cards.scale.rack_aware.classList.add('disabled');

        // If invalid scale is selected, deselect it
        if (state.scale === 'low_capacity' || state.scale === 'rack_aware') state.scale = null;
    }

    // Step 1 -> Region -> Scale
    if (!state.scenario) {
        Object.values(cards.region).forEach(c => c && c.classList.add('disabled'));
        Object.values(cards.localInstanceRegion).forEach(c => c && c.classList.add('disabled'));
        Object.values(cards.scale).forEach(c => c && c.classList.add('disabled'));
    }

    if (!state.region) {
        Object.values(cards.localInstanceRegion).forEach(c => c && c.classList.add('disabled'));
        Object.values(cards.scale).forEach(c => c && c.classList.add('disabled'));
    }

    if (!state.localInstanceRegion) {
        Object.values(cards.scale).forEach(c => c && c.classList.add('disabled'));
    }

    // China Logic
    const chinaWarn = document.getElementById('china-warning');
    if (state.region === 'azure_china') {
        // Hide subsequent steps (from Scale onwards)
        // step-local-region is steps[1] (since step-cloud is steps[0])
        for (let i = 1; i < steps.length; i++) {
            if (steps[i]) steps[i].classList.add('hidden');
        }
        if (chinaWarn) {
            chinaWarn.classList.remove('hidden');
            chinaWarn.classList.add('visible');
        }
        document.getElementById('summary-panel').classList.add('hidden');
    } else {
        if (chinaWarn) {
            chinaWarn.classList.add('hidden');
            chinaWarn.classList.remove('visible');
        }
    }

    // Scale -> Nodes handled in loop above
    // NOTE: Do not apply scale-only port limits here.
    // Port requirements depend on node count + storage topology (e.g., 3-node switchless requires >=6 ports).

    // Nodes -> Storage -> Ports
    if (!state.nodes) Object.values(cards.storage).forEach(c => c.classList.add('disabled'));
    if (!state.storage) Object.values(cards.ports).forEach(c => c.classList.add('disabled'));
    
    // Step 5 -> Step 5.5 (Storage Pool Configuration)
    const storagePoolCards = {
        'Express': document.querySelector('#step-5-5 [data-value="Express"]'),
        'InfraOnly': document.querySelector('#step-5-5 [data-value="InfraOnly"]'),
        'KeepStorage': document.querySelector('#step-5-5 [data-value="KeepStorage"]')
    };
    if (!state.ports) {
        Object.values(storagePoolCards).forEach(c => c && c.classList.add('disabled'));
    } else {
        Object.values(storagePoolCards).forEach(c => c && c.classList.remove('disabled'));
    }
    
    if (!state.ports) Object.values(cards.intent).forEach(c => c.classList.add('disabled'));

    // Rack Aware constraints:
    // - Storage connectivity must be Switched
    // - Intent must be Mgmt + Compute
    if (state.scale === 'rack_aware') {
        // Storage
        if (cards.storage && cards.storage.switchless) {
            cards.storage.switchless.classList.add('disabled');
            if (state.storage === 'switchless') state.storage = null;
        }

        // Intent
        if (cards.intent) {
            ['all_traffic', 'compute_storage', 'custom'].forEach(k => {
                const c = cards.intent[k];
                if (!c) return;
                c.classList.add('disabled');
                c.classList.remove('selected');
            });
            if (state.intent && state.intent !== 'mgmt_compute') {
                state.intent = null;
                state.customIntentConfirmed = false;
                state.storageAutoIp = null;
            }
        }

        // Ports (Step 07): User requirement — Rack Aware supports only 4 ports per node.
        // Keep other options visible but disabled (so users can see they exist).
        if (cards.ports) {
            const card4 = cards.ports['4'];
            ['2', '6', '8'].forEach(k => {
                const c = cards.ports[k];
                if (!c) return;
                c.classList.remove('hidden');
                c.classList.add('disabled');
                c.classList.remove('selected');
            });
            if (card4) {
                card4.classList.remove('hidden');
                // If storage isn't selected yet, global gating will keep ports disabled.
            }
            // Keep state consistent: once storage is selected, force 4 ports.
            if (state.storage && state.ports !== '4') {
                state.ports = '4';
            }
        }
    }

    // Storage Auto IP selection is part of Step 07 and should only be interactive once an intent is chosen.
    if (!state.intent) {
        Object.values(cards.storageAutoIp).forEach(c => {
            if (!c) return;
            c.classList.add('disabled');
            c.classList.remove('selected');
        });
        state.storageAutoIp = null;
    } else {
        // Ensure enabled when intent exists
        Object.values(cards.storageAutoIp).forEach(c => c && c.classList.remove('disabled'));

        // Constraint: Switchless + 3/4 nodes requires Storage Auto IP Disabled.
        const nodeCount = parseInt(state.nodes, 10);
        const requiresAutoIpDisabled = (state.storage === 'switchless') && (nodeCount === 3 || nodeCount === 4);
        if (requiresAutoIpDisabled) {
            // Force selection.
            state.storageAutoIp = 'disabled';

            // Only allow the Disabled option.
            const enabledCard = cards.storageAutoIp && cards.storageAutoIp.enabled;
            if (enabledCard) {
                enabledCard.classList.add('disabled');
                enabledCard.classList.remove('selected');
                enabledCard.title = 'Required: Switchless 3–4 node clusters must use Storage Auto IP Disabled.';
            }
        }
    }
    
    // Cloud Witness Type: Lock based on cluster configuration
    const witnessLocked = isWitnessTypeLocked();
    const witnessInfoBox = document.getElementById('witness-info');
    
    if (!state.nodes) {
        // No nodes selected yet - disable both cards
        Object.values(cards.witnessType).forEach(c => c && c.classList.add('disabled'));
    } else if (witnessLocked) {
        // Locked to Cloud - disable NoWitness card
        const noWitnessCard = cards.witnessType && cards.witnessType.NoWitness;
        if (noWitnessCard) {
            noWitnessCard.classList.add('disabled');
            noWitnessCard.classList.remove('selected');
            
            let reason = '';
            if (state.scale === 'rack_aware') {
                reason = 'Rack Aware clusters require Cloud witness';
            } else if (state.nodes === '2') {
                reason = '2-node clusters require Cloud witness';
            }
            noWitnessCard.title = reason;
        }
        
        // Update info box
        if (witnessInfoBox) {
            witnessInfoBox.innerHTML = `<strong>Cloud witness is required</strong> for ${state.scale === 'rack_aware' ? 'Rack Aware clusters' : '2-node clusters'}.`;
        }
    } else {
        // Not locked - enable both cards
        Object.values(cards.witnessType).forEach(c => {
            if (c) {
                c.classList.remove('disabled');
                c.title = '';
            }
        });
        
        // Update info box
        if (witnessInfoBox) {
            witnessInfoBox.innerHTML = 'The witness type is automatically determined based on your cluster configuration.';
        }
    }
    
    if (!state.intent) {
        document.querySelectorAll('#outbound-connected .option-card').forEach(c => c.classList.add('disabled'));
        document.querySelectorAll('#outbound-disconnected .option-card').forEach(c => c.classList.add('disabled'));
    }

    // Step 6 -> 7 -> 8 (Arc)
    if (state.scenario === 'disconnected') {
        Object.values(cards.arc).forEach(c => c.classList.add('disabled'));
        // Force Arc Gateway to be disabled for disconnected scenarios
        if (state.arc !== 'no_arc') {
            state.arc = 'no_arc';
        }
    } else {
        if (!state.outbound) Object.values(cards.arc).forEach(c => c.classList.add('disabled'));
    }

    // Step 8 -> 9 (Proxy)
    if (state.scenario === 'disconnected') {
        if (!state.outbound) Object.values(cards.proxy).forEach(c => c.classList.add('disabled'));
    } else {
        if (!state.arc) Object.values(cards.proxy).forEach(c => c.classList.add('disabled'));
    }

    // Azure Gov Constraint
    if (state.region === 'azure_government') {
        cards.arc['arc_gateway'].classList.add('disabled');
        if (state.arc === 'arc_gateway') state.arc = null;
    }

    if (!state.proxy) Object.values(cards.ip).forEach(c => c.classList.add('disabled'));

    if (!state.ip) {
        Object.values(cards.infraVlan).forEach(c => {
            if (!c) return;
            c.classList.add('disabled');
            c.classList.remove('selected');
        });
        if (state.infraVlan !== null) {
            state.infraVlan = null;
            state.infraVlanId = null;
            const vlanInfo = document.getElementById('infra-vlan-info');
            const vlanCustom = document.getElementById('infra-vlan-custom');
            const vlanInput = document.getElementById('infra-vlan-id');
            if (vlanInfo) vlanInfo.classList.add('hidden');
            if (vlanInfo) vlanInfo.classList.remove('visible');
            if (vlanCustom) vlanCustom.classList.add('hidden');
            if (vlanCustom) vlanCustom.classList.remove('visible');
            if (vlanInput) {
                vlanInput.value = '';
                vlanInput.setCustomValidity('');
            }
        }
    } else {
        Object.values(cards.infraVlan).forEach(c => c && c.classList.remove('disabled'));
        if (!state.infraVlan) {
            state.infraVlan = 'default';
        }
    }

    // Step 11 -> Step 13 (Active Directory)
    const adCards = {
        'azure_ad': document.querySelector('[data-value="azure_ad"]'),
        'local_identity': document.getElementById('ad-local-identity-card')
    };
    // Check if infra is properly set (not just truthy, but has start and end)
    if (!state.infra || !state.infra.start || !state.infra.end) {
        Object.values(adCards).forEach(c => c && c.classList.add('disabled'));
    }
    
    // Disconnected scenario: Only Active Directory is allowed (disable Local Identity)
    // Rack Aware: Only Active Directory is allowed (disable Local Identity)
    if (state.scenario === 'disconnected' || state.scale === 'rack_aware') {
        if (adCards.local_identity) {
            adCards.local_identity.classList.add('disabled');
            adCards.local_identity.style.opacity = '0.5';
            adCards.local_identity.style.pointerEvents = 'none';
        }
        // Force Active Directory if Local Identity was selected
        if (state.activeDirectory === 'local_identity') {
            state.activeDirectory = null;
        }
    } else {
        if (adCards.local_identity) {
            adCards.local_identity.classList.remove('disabled');
            adCards.local_identity.style.opacity = '';
            adCards.local_identity.style.pointerEvents = '';
        }
    }
    
    // ADFS Server section visibility
    const adfsSection = document.getElementById('adfs-server-section');
    if (adfsSection) {
        if (state.scenario === 'disconnected' && state.activeDirectory === 'azure_ad') {
            adfsSection.classList.remove('hidden');
        } else {
            adfsSection.classList.add('hidden');
        }
    }

    // Step 13 -> Step 13.5 (Security Configuration)
    const securityCards = {
        'recommended': document.querySelector('#step-13-5 [data-value="recommended"]'),
        'customized': document.querySelector('#step-13-5 [data-value="customized"]')
    };
    if (!state.activeDirectory) {
        Object.values(securityCards).forEach(c => c && c.classList.add('disabled'));
    } else {
        Object.values(securityCards).forEach(c => c && c.classList.remove('disabled'));
    }

    // Step 13.5 -> Step 14 (SDN)
    const sdnCheckboxes = document.querySelectorAll('.sdn-feature-card input[type="checkbox"]');
    if (!state.securityConfiguration) {
        sdnCheckboxes.forEach(cb => {
            cb.disabled = true;
            cb.parentElement.style.opacity = '0.5';
        });
    } else {
        sdnCheckboxes.forEach(cb => {
            cb.disabled = false;
            cb.parentElement.style.opacity = '1';
        });
    }

    const infraInputCidr = document.getElementById('infra-cidr');
    const infraInputStart = document.getElementById('infra-ip-start');
    const infraInputEnd = document.getElementById('infra-ip-end');
    if (infraInputStart && infraInputEnd) {
        if (!state.ip) {
            if (infraInputCidr) {
                infraInputCidr.disabled = true;
                infraInputCidr.parentElement.style.opacity = '0.5';
            }
            infraInputStart.disabled = true;
            infraInputEnd.disabled = true;
            infraInputStart.parentElement.style.opacity = '0.5';
            infraInputEnd.parentElement.style.opacity = '0.5';
        } else {
            if (infraInputCidr) {
                infraInputCidr.disabled = false;
                infraInputCidr.parentElement.style.opacity = '1';
            }
            infraInputStart.disabled = false;
            infraInputEnd.disabled = false;
            infraInputStart.parentElement.style.opacity = '1';
            infraInputEnd.parentElement.style.opacity = '1';
        }
    }


    // RULE 1: Nodes -> Storage
    const contextDiv = document.getElementById('nodes-context');
    const countDisplay = document.getElementById('nodes-count-display');
    const implicationDisplay = document.getElementById('nodes-implication');

    if (state.nodes) {
        contextDiv.classList.add('visible');
        countDisplay.innerText = state.nodes;
        let nodeVal = state.nodes === '16+' ? 17 : parseInt(state.nodes);
        if (nodeVal >= 5) {
            cards.storage['switchless'].classList.add('disabled');
            if (state.storage === 'switchless') state.storage = null;
            implicationDisplay.innerText = "Requires Switched Storage.";
            implicationDisplay.style.color = "var(--accent-purple)";
        } else {
            implicationDisplay.innerText = "Supports Switchless & Switched.";
            implicationDisplay.style.color = "var(--success)";
        }
    } else {
        contextDiv.classList.remove('visible');
    }

    // Conditional UI: 3-node + Low Capacity + Switchless -> Link Mode (Single/Dual)
    (function updateSwitchlessLinkModeUi() {
        const linkModeBlock = document.getElementById('switchless-link-mode');
        if (!linkModeBlock) return;

        const n = state.nodes ? parseInt(state.nodes, 10) : NaN;
        const shouldShow = (n === 3) && (state.scale === 'low_capacity') && (state.storage === 'switchless');

        if (shouldShow) {
            linkModeBlock.classList.remove('hidden');
            if (!state.switchlessLinkMode) state.switchlessLinkMode = 'dual_link';
        } else {
            linkModeBlock.classList.add('hidden');
            state.switchlessLinkMode = null;
        }
    })();

    // New Rule: Storage (Switchless) -> Ports Constraints
    if (state.storage === 'switchless' && state.nodes) {
        const n = parseInt(state.nodes);
        if (n === 1) {
            // Low Capacity requirement: with 1 node + switchless, only 2 and 4 ports are allowed.
            if (state.scale === 'low_capacity') {
                cards.ports['1'].classList.add('disabled');
                cards.ports['6'].classList.add('disabled');
                cards.ports['8'].classList.add('disabled');
                if (state.ports === '1' || state.ports === '6' || state.ports === '8') state.ports = null;
            }
        } else if (n === 2) {
            cards.ports['1'].classList.add('disabled');
            if (state.scale !== 'low_capacity') {
                cards.ports['2'].classList.add('disabled');
                if (state.ports === '2') state.ports = null;
            } else {
                // Low Capacity + 2 nodes + switchless: only 4 ports are valid.
                cards.ports['2'].classList.add('disabled');
                cards.ports['6'].classList.add('disabled');
                cards.ports['8'].classList.add('disabled');
                if (state.ports === '2' || state.ports === '6' || state.ports === '8') state.ports = null;

                // UX: Since only one option remains valid, auto-select it.
                if (state.ports !== '4') {
                    const card4 = cards.ports['4'];
                    if (card4 && !card4.classList.contains('disabled')) {
                        state.ports = '4';
                    }
                }
            }
            if (state.ports === '1') state.ports = null;
        } else if (n === 3) {
            const isSingleLink = (state.scale === 'low_capacity') && (state.switchlessLinkMode === 'single_link');

            if (isSingleLink) {
                // 3-node switchless (single-link) requires 2 teamed ports (mgmt/compute) + 2 standalone RDMA ports (storage) = 4 physical ports.
                // Therefore, only 4 ports is valid for this topology.
                cards.ports['1'].classList.add('disabled');
                cards.ports['2'].classList.add('disabled');
                cards.ports['6'].classList.add('disabled');
                cards.ports['8'].classList.add('disabled');
                if (state.ports === '1' || state.ports === '2' || state.ports === '6' || state.ports === '8') state.ports = null;

                // UX: Since only one option remains valid, auto-select it.
                if (state.ports !== '4') {
                    // Ensure the 4-port card isn't disabled by other rules.
                    const card4 = cards.ports['4'];
                    if (card4 && !card4.classList.contains('disabled')) {
                        state.ports = '4';
                    }
                }
            } else {
                // 3-node switchless (dual-link) requires 2 teamed ports (mgmt/compute) + 4 standalone RDMA ports (storage) = 6 physical ports.
                // Therefore, 2 and 4 ports are never valid for this topology.
                cards.ports['1'].classList.add('disabled');
                cards.ports['2'].classList.add('disabled');
                cards.ports['4'].classList.add('disabled');
                // Only 6 ports is valid for 3-node switchless (dual-link).
                cards.ports['8'].classList.add('disabled');
                if (state.ports === '1' || state.ports === '2' || state.ports === '4' || state.ports === '8') state.ports = null;
            }
        } else if (n === 4) {
            // Require 8+ ports
            cards.ports['1'].classList.add('disabled');
            cards.ports['2'].classList.add('disabled');
            cards.ports['4'].classList.add('disabled');
            cards.ports['6'].classList.add('disabled');
            if (state.ports !== '8') state.ports = null;
        }
    }

    // Recommendation Rule: Low Capacity + Switched -> Recommend 4 Ports
    const port4Card = cards.ports['4'];
    const badgeClass = 'badge-recommended';
    const portsBadgeSelector = `.${badgeClass}[data-source="ports"]`;
    const existingPortsBadge = port4Card ? port4Card.querySelector(portsBadgeSelector) : null;

    const nForPortsBadge = state.nodes ? parseInt(state.nodes, 10) : NaN;
    const isSwitchless2NodeLowCapacityPortsRequired =
        state.scale === 'low_capacity' &&
        state.storage === 'switchless' &&
        nForPortsBadge === 2;

    if (isSwitchless2NodeLowCapacityPortsRequired) {
        if (!existingPortsBadge && port4Card && !port4Card.classList.contains('disabled')) {
            const badge = document.createElement('div');
            badge.className = badgeClass;
            badge.dataset.source = 'ports';
            port4Card.appendChild(badge);
        }
        if (port4Card && !port4Card.classList.contains('disabled')) {
            (port4Card.querySelector(portsBadgeSelector)).innerText = 'Required';
        }
    } else if (state.scale === 'low_capacity' && state.storage === 'switched') {
        if (!existingPortsBadge && port4Card && !port4Card.classList.contains('disabled')) {
            const badge = document.createElement('div');
            badge.className = badgeClass;
            badge.dataset.source = 'ports';
            port4Card.appendChild(badge);
        }
        if (port4Card && !port4Card.classList.contains('disabled')) {
            (port4Card.querySelector(portsBadgeSelector)).innerText = 'Recommended';
        }
    } else {
        if (existingPortsBadge) {
            existingPortsBadge.remove();
        }
    }

    // Recommendation Rule: 4 Ports -> Mgmt + Compute intent recommended
    const mgmtComputeCard = cards.intent['mgmt_compute'];
    if (mgmtComputeCard) {
        const selector = `.${badgeClass}[data-source="intent"]`;
        let intentBadge = mgmtComputeCard.querySelector(selector);

        const nForIntentBadge = parseInt(state.nodes, 10);
        const isSwitchless3NodeIntentRequired =
            state.storage === 'switchless' &&
            state.scale === 'low_capacity' &&
            nForIntentBadge === 3 &&
            (state.switchlessLinkMode === 'dual_link' || state.switchlessLinkMode === 'single_link');

        const isSwitchless2NodeLowCapacityIntentRequired =
            state.storage === 'switchless' &&
            state.scale === 'low_capacity' &&
            nForIntentBadge === 2;

        // Required takes precedence over Recommended.
        if (isSwitchless3NodeIntentRequired || isSwitchless2NodeLowCapacityIntentRequired) {
            if (!intentBadge) {
                intentBadge = document.createElement('div');
                intentBadge.className = badgeClass;
                intentBadge.dataset.source = 'intent';
                mgmtComputeCard.appendChild(intentBadge);
            }
            intentBadge.innerText = 'Required';
        } else if (state.ports === '4') {
            if (!intentBadge) {
                intentBadge = document.createElement('div');
                intentBadge.className = badgeClass;
                intentBadge.dataset.source = 'intent';
                mgmtComputeCard.appendChild(intentBadge);
            }
            intentBadge.innerText = 'Recommended';
        } else if (intentBadge) {
            intentBadge.remove();
        }
    }

    // RDMA Explanation & Port Configuration
    const portsExp = document.getElementById('ports-explanation');
    const portConfigSec = document.getElementById('port-configuration');
    const rdmaWarn = document.getElementById('rdma-validation-warning');

    if (state.ports) {
        portsExp.classList.add('visible');
        portConfigSec.classList.add('visible');

        // Hardware requirement note (Step 07)
        // Keep the header consistent with the static HTML, but tailor the content
        // to the selected topology.
        if (portsExp) {
            const header = '<strong style="color: var(--accent-purple);">Hardware Requirement</strong>';
            const rdmaSentence = 'At least two network ports must be RDMA-capable (iWARP/RoCEv2) to support high-performance Storage traffic.';

            const n = parseInt(state.nodes, 10);
            const isSwitchless = state.storage === 'switchless';

            // User request:
            // - Remove the generic RDMA sentence for switchless 3- and 4-node flows.
            // - Ensure 4-node switchless + 8 ports does not reuse the 3-node text.
            let includeRdmaSentence = true;
            let topologySentence = '';

            if (isSwitchless && (n === 3 || n === 4)) {
                includeRdmaSentence = false;
                if (n === 3) {
                    const isSingleLink = (state.scale === 'low_capacity') && (state.switchlessLinkMode === 'single_link');
                    topologySentence = isSingleLink
                        ? 'For a 3-node Switchless (Single-Link) deployment, you need 4 physical ports per node: two teamed ports for management/compute plus two standalone RDMA ports for storage.'
                        : 'For a 3-node Switchless (Dual-Link) deployment, you need at least 6 physical ports per node: two teamed ports for management/compute plus four standalone RDMA ports for storage.';
                } else {
                    topologySentence = 'For a 4-node Switchless deployment, you need 8 physical ports per node: two teamed ports for management/compute plus six standalone RDMA ports for storage.';
                }
            }

            let html = header;
            if (includeRdmaSentence) {
                html += '\n' + rdmaSentence;
            }
            if (topologySentence) {
                html += '<br><br>\n' + topologySentence;
            }
            portsExp.innerHTML = html;
        }

        // Convert to number, usually '2','4','6'. '6' means 6+. '1' is 1.
        let pCount = parseInt(state.ports);
        if (state.ports === '6') pCount = 6;

        // Render if not already rendered or if count changed? 
        // For simplicity, re-render if count mismatch or empty
        // We need to persist config though. 
        // Initial setup of state.portConfig if null
        if (!state.portConfig || state.portConfig.length !== pCount) {
            const isLowCapacity = state.scale === 'low_capacity';
            const isStandard = state.scale === 'medium';

            const isSwitchless3NodeStandard =
                isStandard &&
                state.storage === 'switchless' &&
                parseInt(state.nodes, 10) === 3;

            const defaultRdmaEnabled = isLowCapacity ? false : true;
            const defaultRdmaMode = isLowCapacity ? 'Disabled' : 'RoCEv2';
            const defaultPortSpeed = isLowCapacity ? '1GbE' : '25GbE';

            state.portConfig = Array(pCount).fill().map((_, idx) => {
                // Special default: 3-node switchless standard uses non-RDMA teamed ports for Mgmt+Compute.
                // Keep Port 1-2 non-RDMA by default; enable RDMA on the remaining ports.
                const rdmaEnabled = (isSwitchless3NodeStandard && idx < 2) ? false : defaultRdmaEnabled;
                return {
                    speed: defaultPortSpeed,
                    rdma: rdmaEnabled,
                    rdmaMode: rdmaEnabled ? defaultRdmaMode : 'Disabled',
                    rdmaManual: false
                };
            });
        } else {
            // If the user changes earlier choices (scale/nodes/storage) after portConfig was created,
            // keep the defaults aligned for 3-node switchless standard unless the user manually changed a port.
            const isLowCapacity = state.scale === 'low_capacity';
            const isStandard = state.scale === 'medium';
            const isSwitchless3NodeStandard =
                isStandard &&
                state.storage === 'switchless' &&
                parseInt(state.nodes, 10) === 3;
            const defaultRdmaEnabled = isLowCapacity ? false : true;
            const defaultRdmaMode = isLowCapacity ? 'Disabled' : 'RoCEv2';

            // Low Capacity default: always use 1GbE.
            if (isLowCapacity) {
                for (let idx = 0; idx < pCount; idx++) {
                    const pc = state.portConfig[idx];
                    if (!pc) continue;
                    pc.speed = '1GbE';
                }
            }

            if (isSwitchless3NodeStandard) {
                for (let idx = 0; idx < pCount; idx++) {
                    const pc = state.portConfig[idx];
                    if (!pc || pc.rdmaManual === true) continue;

                    const shouldBeNonRdma = idx < 2;
                    const rdmaEnabled = shouldBeNonRdma ? false : defaultRdmaEnabled;
                    pc.rdma = rdmaEnabled;
                    pc.rdmaMode = rdmaEnabled ? defaultRdmaMode : 'Disabled';
                }
            }
        }

        renderPortConfiguration(pCount);

        // Step 07 validation: Unless Low Capacity, require a minimum number of RDMA ports.
        if (rdmaWarn) {
            const requiredRdma = getRequiredRdmaPortCount();
            const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];
            const rdmaEnabled = cfg.filter(p => p && p.rdma === true).length;
            if (state.rdmaGuardMessage) {
                rdmaWarn.innerHTML = '<strong style="color:#ffc107;">' + escapeHtml(state.rdmaGuardMessage) + '</strong>';
                rdmaWarn.classList.remove('hidden');
                rdmaWarn.classList.add('visible');
                state.rdmaGuardMessage = null;
            } else if (requiredRdma > 0 && rdmaEnabled < requiredRdma) {
                rdmaWarn.innerHTML = '<strong style="color:#ffc107;">⚠ Not supported</strong><br>At least ' + escapeHtml(String(requiredRdma)) + ' port(s) must be RDMA capable unless you selected Low Capacity. Update Port Configuration to enable RDMA on at least ' + escapeHtml(String(requiredRdma)) + ' port(s).';
                rdmaWarn.classList.remove('hidden');
                rdmaWarn.classList.add('visible');
            } else {
                rdmaWarn.classList.add('hidden');
                rdmaWarn.classList.remove('visible');
                rdmaWarn.innerHTML = '';
            }
        }

        // HARD BLOCK (Step 07): If RDMA requirements are not met, do not allow the user
        // to proceed to Step 08 (Intent) or beyond.
        try {
            const requiredRdma = getRequiredRdmaPortCount();
            const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];
            const rdmaEnabled = cfg.filter(p => p && p.rdma === true).length;
            const rdmaOk = (requiredRdma <= 0) || (rdmaEnabled >= requiredRdma);
            if (!rdmaOk) {
                // Clear downstream state so progress gates don't advance.
                state.intent = null;
                state.customIntentConfirmed = false;
                state.storageAutoIp = null;
                state.outbound = null;
                state.arc = null;
                state.proxy = null;
                state.ip = null;
                state.infraVlan = null;
                state.infraVlanId = null;

                // Disable intent cards.
                if (cards && cards.intent) {
                    Object.values(cards.intent).forEach(c => {
                        if (!c) return;
                        c.classList.add('disabled');
                        c.classList.remove('selected');
                    });
                }
            }
        } catch (e) {
            // ignore
        }
    } else {
        portsExp.classList.remove('visible');
        portConfigSec.classList.remove('visible');
        state.portConfig = null;

        if (rdmaWarn) {
            rdmaWarn.classList.add('hidden');
            rdmaWarn.classList.remove('visible');
            rdmaWarn.innerHTML = '';
        }
    }


    // RULE 2: Ports -> Storage & Intents
    // 1 Port LOGIC
    if (state.ports === '1') {
        // 1 Node has no east-west, so switchless is moot, but typically single node is 'switched' (north-south) or just direct. 
        // Let's disable switchless to avoid confusion, or does it matter?
        // Actually, let's lock Storage to Switched for simplicity?
        cards.storage['switchless'].classList.add('disabled');
        if (state.storage === 'switchless') state.storage = null;

        // Intent rules for 1 port
        // Default: All Traffic (and Custom) only.
        // Low Capacity special case (1 node + switched + 1 port): allow Group All OR Mgmt + Compute only.
        const isLowCapSingleNodeSwitched =
            state.scale === 'low_capacity' &&
            state.nodes === '1' &&
            state.storage === 'switched';

        cards.intent['compute_storage'].classList.add('disabled');

        if (isLowCapSingleNodeSwitched) {
            // Keep mgmt_compute available, remove Custom.
            cards.intent['custom'].classList.add('disabled');
            if (state.intent !== 'all_traffic' && state.intent !== 'mgmt_compute') state.intent = null;
        } else {
            cards.intent['mgmt_compute'].classList.add('disabled');
            // Allow All Traffic (Converged) and Custom.
            if (state.intent !== 'all_traffic' && state.intent !== 'custom') state.intent = null;
        }
    }

    if (state.ports === '2') {
        if (state.scale !== 'low_capacity') {
            cards.storage['switchless'].classList.add('disabled');
            if (state.storage === 'switchless') state.storage = null;
        }

        cards.intent['compute_storage'].classList.add('disabled');
        cards.intent['custom'].classList.add('disabled');

        if (state.scale === 'low_capacity') {
            // Low Capacity: only allow Mgmt + Compute
            cards.intent['all_traffic'].classList.add('disabled');
            if (state.intent === 'all_traffic') state.intent = null;

            if (state.intent !== 'mgmt_compute') state.intent = null;
        } else {
            cards.intent['mgmt_compute'].classList.add('disabled');
            if (state.intent !== 'all_traffic') state.intent = null;
        }
    }
    if (state.ports === '4') {
        cards.intent['custom'].classList.add('disabled');
        if (state.intent === 'custom') state.intent = null;

        // Low Capacity: only allow Mgmt + Compute
        if (state.scale === 'low_capacity') {
            cards.intent['all_traffic'].classList.add('disabled');
            cards.intent['compute_storage'].classList.add('disabled');

            if (state.intent === 'all_traffic' || state.intent === 'compute_storage') state.intent = null;
            if (state.intent !== 'mgmt_compute') state.intent = null;
        }
    }

    // RULE 3: Storage -> Intent
    if (state.storage === 'switchless') {
        // User request: 3-node switchless (dual-link) forces Mgmt + Compute intent and disables other intent options.
        const nSwitchless = parseInt(state.nodes, 10);
        const isSwitchless3NodeDualLink = (nSwitchless === 3) && (state.switchlessLinkMode === 'dual_link');
        if (isSwitchless3NodeDualLink) {
            cards.intent['custom'].classList.add('disabled');
            cards.intent['all_traffic'].classList.add('disabled');
            cards.intent['compute_storage'].classList.add('disabled');
            if (state.intent !== 'mgmt_compute') {
                state.intent = 'mgmt_compute';
                state.customIntentConfirmed = false;
            }
        }

        if (state.scale !== 'low_capacity') {
            cards.intent['all_traffic'].classList.add('disabled');
            if (state.intent === 'all_traffic') state.intent = null;
        }
        cards.intent['compute_storage'].classList.add('disabled');
        if (state.intent === 'compute_storage') state.intent = null;

        // Switchless 4-node uses all 8 ports for the required topology.
        // In this scenario, only Mgmt + Compute intent is allowed.
        if (nSwitchless === 4 && state.ports === '8') {
            cards.intent['custom'].classList.add('disabled');
            cards.intent['all_traffic'].classList.add('disabled');
            cards.intent['compute_storage'].classList.add('disabled');
            if (state.intent !== 'mgmt_compute') {
                state.intent = 'mgmt_compute';
                state.customIntentConfirmed = false;
            }
        }

        // Low Capacity + 2 nodes + switchless: only Mgmt + Compute intent is allowed.
        const isSwitchless2NodeLowCapacity =
            (nSwitchless === 2) &&
            (state.scale === 'low_capacity');
        if (isSwitchless2NodeLowCapacity) {
            cards.intent['custom'].classList.add('disabled');
            cards.intent['all_traffic'].classList.add('disabled');
            cards.intent['compute_storage'].classList.add('disabled');
            if (state.intent !== 'mgmt_compute') {
                state.intent = 'mgmt_compute';
                state.customIntentConfirmed = false;
            }
        }
    }

    // RULE 4: Outbound -> Arc & Proxy
    if (state.outbound === 'private') {
        cards.arc['no_arc'].classList.add('disabled');
        if (state.arc !== 'arc_gateway') { state.arc = 'arc_gateway'; cards.arc['arc_gateway'].classList.add('selected'); }

        cards.proxy['no_proxy'].classList.add('disabled');
        if (proxyText) proxyText.innerText = 'Azure Firewall Explicit Proxy';
        if (state.proxy !== 'proxy') { state.proxy = 'proxy'; cards.proxy['proxy'].classList.add('selected'); }
    }


    // RULE 5: Intent Explanation & Visualization
    const intentExp = document.getElementById('intent-explanation');
    const nicVis = document.getElementById('nic-visualizer');
    const rdmaIntentWarn = document.getElementById('rdma-intent-warning');
    const intentOverrides = document.getElementById('intent-overrides');
    const intentOverridesContainer = document.getElementById('intent-overrides-container');
    const customConfirmBtn = document.getElementById('custom-intent-confirm');

    if (state.intent) {
        intentExp.classList.add('visible');
        let text = "";
        let portCount = parseInt(state.ports);
        let isSwitchless = state.storage === 'switchless';

        if (state.intent === 'all_traffic') {
            text = `<strong>Fully Converged Network</strong><br>All traffic types (Management, Compute, Storage) are permanently grouped onto a single SET team.`;
        } else if (state.intent === 'mgmt_compute') {
            const isStandard = state.scale === 'medium';
            const assignment = getMgmtComputeNicAssignment(portCount);
            if (isStandard && portCount > 2 && !assignment.allRdma) {
                text = `<strong>Converged Mgmt & Compute + Dedicated Storage</strong><br>Mgmt/Compute use the first two non-RDMA ports. Storage uses the remaining ports.`;
            } else {
                text = `<strong>Converged Mgmt & Compute + Dedicated Storage</strong><br>Mgmt/Compute share Pair 1. Storage uses Pair 2${portCount > 4 ? '+' : ''}.`;
            }
        } else if (state.intent === 'compute_storage') {
            text = `<strong>Converged Compute & Storage + Dedicated Mgmt</strong><br>Mgmt on Pair 1. Compute/Storage share Pair 2${portCount > 4 ? '+' : ''}.`;
        } else if (state.intent === 'custom') {
            text = `<strong>Custom Configuration</strong><br>Use the controls below to verify or modify adapter assignments.`;
        }
        intentExp.innerHTML = text;

        // Custom intent confirmation (gates Overrides)
        if (customConfirmBtn) {
            if (state.intent === 'custom') {
                const groups = getIntentNicGroups('custom', portCount);
                const hasAnyMapping = groups && groups.length > 0;

                if (state.customIntentConfirmed) {
                    customConfirmBtn.classList.add('hidden');
                } else {
                    customConfirmBtn.classList.remove('hidden');
                }

                customConfirmBtn.disabled = !hasAnyMapping;
            } else {
                customConfirmBtn.classList.add('hidden');
            }
        }

        // Intent overrides UI (per intent NIC set)
        if (intentOverrides && intentOverridesContainer) {
            const allowOverrides = (state.intent !== 'custom') || !!state.customIntentConfirmed;
            if (!allowOverrides) {
                intentOverrides.classList.add('hidden');
                intentOverrides.classList.remove('visible');
            } else {
                const rendered = renderIntentOverrides(intentOverridesContainer);
                if (rendered) {
                    intentOverrides.classList.remove('hidden');
                    intentOverrides.classList.add('visible');
                } else {
                    intentOverrides.classList.add('hidden');
                    intentOverrides.classList.remove('visible');
                }
            }
        }

        nicVis.classList.add('visible');
        renderNicVisualizer(portCount, state.intent, isSwitchless);

        // Step 08 validation: RDMA-enabled ports must map to Storage traffic NICs.
        if (rdmaIntentWarn) {
            const cfg = Array.isArray(state.portConfig) ? state.portConfig : null;
            const storageIndices = getStorageNicIndicesForIntent(state.intent, portCount);

            const storageSet = new Set(storageIndices);
            const rdmaEnabled = [];
            if (cfg) {
                for (let i = 1; i <= portCount; i++) {
                    const pc = cfg[i - 1];
                    if (pc && pc.rdma === true) rdmaEnabled.push(i);
                }
            }

            const isStandard = state.scale === 'medium';
            const allRdma = rdmaEnabled.length === portCount && portCount > 0;
            const requiresTwoNonRdmaForMgmtCompute =
                state.intent === 'mgmt_compute' && isStandard && portCount > 2 && !allRdma;
            const nonRdmaCount = portCount - rdmaEnabled.length;

            // When all ports are RDMA-capable, allow Mgmt+Compute to use RDMA ports (standard scenarios only).
            const allowMgmtComputeOnRdmaPorts =
                isStandard && state.intent === 'mgmt_compute' && allRdma;
            // Custom intent: RDMA can be enabled on non-Storage adapters (e.g., Compute).
            const nonStorageRdma = (state.intent === 'custom')
                ? []
                : (allowMgmtComputeOnRdmaPorts ? [] : rdmaEnabled.filter(i => !storageSet.has(i)));
            const rdmaOnStorage = rdmaEnabled.filter(i => storageSet.has(i)).length;
            const requiredRdma = getRequiredRdmaPortCount();

            const storageOnNonRdma = (state.intent === 'custom')
                ? storageIndices.filter(i => !(cfg && cfg[i - 1] && cfg[i - 1].rdma === true))
                : [];

            const mgmtComputeNonRdmaOk = !requiresTwoNonRdmaForMgmtCompute || nonRdmaCount >= 2;

            const mappingOk =
                mgmtComputeNonRdmaOk &&
                (nonStorageRdma.length === 0) &&
                (requiredRdma <= 0 || rdmaOnStorage >= requiredRdma) &&
                (storageOnNonRdma.length === 0);
            if (!mappingOk) {
                const parts = [];
                if (!mgmtComputeNonRdmaOk) {
                    parts.push('Mgmt + Compute requires at least 2 non-RDMA port(s) for teamed adapters (unless all ports are RDMA-capable).');
                }
                if (storageOnNonRdma.length > 0) {
                    parts.push('Storage traffic is assigned to non-RDMA port(s): ' + storageOnNonRdma.map(i => 'Port ' + i).join(', ') + '.');
                }
                if (requiredRdma > 0 && rdmaOnStorage < requiredRdma) {
                    parts.push('At least ' + escapeHtml(String(requiredRdma)) + ' RDMA-enabled port(s) must be assigned to Storage traffic (SMB).');
                }
                if (nonStorageRdma.length > 0) {
                    parts.push('RDMA is enabled on non-Storage port(s): ' + nonStorageRdma.map(i => 'Port ' + i).join(', ') + '.');
                }
                rdmaIntentWarn.innerHTML = '<strong style="color:#ffc107;">⚠ Not supported</strong><br>' + parts.join('<br>') + '<br>Update Step 07 Port Configuration so RDMA is enabled on the ports used for Storage traffic.';
                rdmaIntentWarn.classList.remove('hidden');
                rdmaIntentWarn.classList.add('visible');

                // HARD BLOCK (Step 08): Do not allow the user to proceed to Step 09+.
                // Keep the intent selection visible, but disable downstream selections.
                state.outbound = null;
                state.arc = null;
                state.proxy = null;
                state.ip = null;
                state.infraVlan = null;
                state.infraVlanId = null;
                state.storageAutoIp = null;
                document.querySelectorAll('#outbound-connected .option-card, #outbound-disconnected .option-card').forEach(c => {
                    c.classList.add('disabled');
                    c.classList.remove('selected');
                });
            } else {
                rdmaIntentWarn.classList.add('hidden');
                rdmaIntentWarn.classList.remove('visible');
                rdmaIntentWarn.innerHTML = '';
            }
        }

    } else {
        intentExp.classList.remove('visible');
        nicVis.classList.remove('visible');

        if (rdmaIntentWarn) {
            rdmaIntentWarn.classList.add('hidden');
            rdmaIntentWarn.classList.remove('visible');
            rdmaIntentWarn.innerHTML = '';
        }

        if (customConfirmBtn) {
            customConfirmBtn.classList.add('hidden');
        }

        if (intentOverrides) {
            intentOverrides.classList.add('hidden');
            intentOverrides.classList.remove('visible');
        }
    }

    // RULE 6: Arc Explanation
    const arcExp = document.getElementById('arc-explanation');

    // Clear previous classes
    arcExp.classList.remove('warning');

    if (state.arc === 'arc_gateway') {
        arcExp.classList.add('visible');
        arcExp.innerHTML = `<strong>Azure Arc Gateway (Recommended)</strong><br>
        Simplifies network requirements by routing traffic through a single endpoint.<br>
        <a href="https://learn.microsoft.com/en-us/azure/azure-local/deploy/deployment-azure-arc-gateway-overview?view=azloc-2511&tabs=portal" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">Read the documentation</a>.`;
    } else if (state.arc === 'no_arc') {
        arcExp.classList.add('visible');
        arcExp.classList.add('warning');
        arcExp.innerHTML = `<strong style="color:#ffc107;">⚠ Important</strong>
        <p>Disabling Arc Gateway requires you to allowlist 80+ individual endpoints in your firewall/proxy for proper operation.</p>
        <p><a href="https://learn.microsoft.com/en-us/azure/azure-local/concepts/firewall-requirements?view=azloc-2511" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">Review the required firewall endpoints</a></p>`;
    } else {
        if (arcExp) arcExp.classList.remove('visible');
    }

    // Proxy Warning
    const proxyWarn = document.getElementById('proxy-warning');
    if (proxyWarn) {
        if (state.proxy === 'proxy') {
            proxyWarn.classList.remove('hidden');
            proxyWarn.classList.add('visible');
        } else {
            proxyWarn.classList.add('hidden');
            proxyWarn.classList.remove('visible');
        }
    }

    // DHCP Warning
    const dhcpWarn = document.getElementById('dhcp-warning');
    if (dhcpWarn) {
        if (state.ip === 'dhcp') {
            dhcpWarn.classList.remove('hidden');
            dhcpWarn.classList.add('visible');
        } else {
            dhcpWarn.classList.add('hidden');
            dhcpWarn.classList.remove('visible');
        }
    }

    // Default Gateway field behavior
    const gwInput = document.getElementById('infra-default-gateway');
    if (gwInput) {
        if (state.ip === 'dhcp') {
            gwInput.value = '';
            gwInput.disabled = true;
            state.infraGateway = null;
            state.infraGatewayManual = false;

            const gwErr = document.getElementById('infra-gateway-error');
            const gwSucc = document.getElementById('infra-gateway-success');
            if (gwErr) gwErr.classList.add('hidden');
            if (gwSucc) gwSucc.classList.add('hidden');
        } else {
            gwInput.disabled = false;
        }
    }

    // IP Subnet Warning (Static OR DHCP)
    const ipSubnetWarn = document.getElementById('ip-subnet-warning');
    if (ipSubnetWarn) {
        if (state.ip) {
            ipSubnetWarn.classList.remove('hidden');
            ipSubnetWarn.classList.add('visible');
        } else {
            ipSubnetWarn.classList.add('hidden');
            ipSubnetWarn.classList.remove('visible');
        }
    }

    const infraNote = document.getElementById('infra-warning-note');
    if (infraNote) {
        if (state.ip && state.infraVlan) {
            infraNote.classList.remove('hidden');
            infraNote.classList.add('visible');
        } else {
            infraNote.classList.add('hidden');
            infraNote.classList.remove('visible');
        }
    }

    const infraVlanInfo = document.getElementById('infra-vlan-info');
    const infraVlanCustom = document.getElementById('infra-vlan-custom');
    const infraVlanIdInput = document.getElementById('infra-vlan-id');
    applyInfraVlanVisibility();

    // Node settings section (Step 12)
    renderNodeSettings();

    // Auto-fill Infrastructure Network CIDR from node IP CIDRs.
    autoFillInfraCidrFromNodes();

    // Re-sync visual selection after constraint logic may have mutated state.
    document.querySelectorAll('.option-card').forEach(card => {
        const value = card.getAttribute('data-value');
        const clickFn = card.getAttribute('onclick');
        if (!clickFn) return;
        const categoryMatch = clickFn.match(/selectOption\('([^']+)'/);
        if (!categoryMatch) return;
        const category = categoryMatch[1];
        if (category === 'nodes') return;

        const isSelected = state[category] === value;
        if (isSelected) card.classList.add('selected');
        else card.classList.remove('selected');
    });

    updateSummary();

    // Progress indicator
    updateProgressUi();
}

function renderNicVisualizer(portCount, intent, isSwitchless) {
    const container = document.getElementById('nic-grid-container');
    container.innerHTML = '';
    const TAG_MGMT = `<span class="traffic-tag tag-mgmt">Mgmt</span>`;
    const TAG_COMPUTE = `<span class="traffic-tag tag-compute">Compute</span>`;
    const TAG_STORAGE = `<span class="traffic-tag tag-storage">Storage</span>`;
    const getNicRdmaTag = (nicIndex1Based) => {
        const cfg = state.portConfig && state.portConfig[nicIndex1Based - 1];
        if (!cfg) return '';
        if (cfg.rdma === false) return '';
        if (cfg.rdmaMode && cfg.rdmaMode !== 'Disabled') {
            return `<span class="traffic-tag tag-rdma">RDMA: ${cfg.rdmaMode}</span>`;
        }
        // Fallback when rdma is enabled but mode isn't specified
        return `<span class="traffic-tag tag-rdma">RDMA Enabled</span>`;
    };

    const ensureTag = (tagsHtml, tagHtml, testClass) => {
        if (!tagsHtml) tagsHtml = '';
        if (tagsHtml.indexOf(testClass) !== -1) return tagsHtml;
        return tagsHtml + tagHtml;
    };

    const createCard = (i, tagsHTML, isCustom = false, isStorageRole = false) => {
        const cfg = state.portConfig && state.portConfig[i - 1];
        const isRdma = !!(cfg && cfg.rdma === true);
        const nicLabel = (isCustom ? isRdma : isStorageRole) ? `SMB${i}` : `NIC${i}`;
        let content = tagsHTML;
        if (isCustom) {
            let val = (state.customIntents && state.customIntents[i]) || 'unused';

            // If the adapter is not RDMA-capable, prevent assigning Storage traffic in Custom intent.
            const carriesStorage = (val === 'storage' || val === 'compute_storage' || val === 'all');
            if (!isRdma && carriesStorage) {
                if (!state.customIntents || typeof state.customIntents !== 'object') state.customIntents = {};
                state.customIntents[i] = 'unused';
                val = 'unused';
            }

            const rdmaTag = isRdma
                ? getNicRdmaTag(i)
                : `<span class="traffic-tag tag-rdma">RDMA: Not Supported</span>`;

            content = `
                <div class="nic-tags">${rdmaTag || ''}</div>
                <select class="custom-select" onchange="updateCustomNic(${i}, this.value)">
                    <option value="unused" ${val === 'unused' ? 'selected' : ''}>Unused</option>
                    <option value="compute" ${val === 'compute' ? 'selected' : ''}>Compute</option>
                    <option value="mgmt_compute" ${val === 'mgmt_compute' ? 'selected' : ''}>Mgmt + Comp</option>
                    ${isRdma ? `<option value="storage" ${val === 'storage' ? 'selected' : ''}>Storage</option>` : ''}
                    ${isRdma ? `<option value="compute_storage" ${val === 'compute_storage' ? 'selected' : ''}>Comp + Stor</option>` : ''}
                    ${isRdma ? `<option value="all" ${val === 'all' ? 'selected' : ''}>Group All</option>` : ''}
                </select>
            `;
        }
        return `
        <div class="nic-card">
            <div class="nic-card-header">
                <svg class="nic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                <span>Port ${i} - ${nicLabel}</span>
            </div>
            <div class="nic-tags">${content}</div>
        </div>
        `;
    };

    const mgmtComputeAssignment = (intent === 'mgmt_compute') ? getMgmtComputeNicAssignment(portCount) : null;
    const mgmtComputeSet = mgmtComputeAssignment ? new Set(mgmtComputeAssignment.mgmtCompute) : null;
    const storageSetForMgmtCompute = mgmtComputeAssignment ? new Set(mgmtComputeAssignment.storage) : null;

    for (let i = 1; i <= portCount; i++) {
        let tags = '';
        let isStorageRole = false;
        if (intent === 'all_traffic') {
            tags = TAG_MGMT + TAG_COMPUTE + TAG_STORAGE;
            isStorageRole = true;
        } else if (intent === 'mgmt_compute') {
            if (portCount === 2) {
                if (i === 1) tags = TAG_MGMT + TAG_COMPUTE;
                else {
                    tags = TAG_STORAGE;
                    isStorageRole = true;
                }
            } else {
                const isMgmtCompute = mgmtComputeSet ? mgmtComputeSet.has(i) : (i <= 2);
                if (isMgmtCompute) {
                    tags = TAG_MGMT + TAG_COMPUTE;
                } else {
                    tags = TAG_STORAGE;
                    isStorageRole = true;
                }
            }
        } else if (intent === 'compute_storage') {
            if (i <= 2) tags = TAG_MGMT;
            else {
                tags = TAG_COMPUTE + TAG_STORAGE;
                isStorageRole = true;
            }
        }

        // Always show RDMA capability, but do not imply Storage on Mgmt+Compute ports.
        const rdmaTag = getNicRdmaTag(i);
        if (rdmaTag) {
            tags = ensureTag(tags, rdmaTag, 'tag-rdma');
        }
        // For mgmt_compute we already computed the role. For other intents, infer from tag presence.
        if (intent === 'mgmt_compute' && storageSetForMgmtCompute) {
            isStorageRole = storageSetForMgmtCompute.has(i);
        } else if (intent !== 'custom') {
            isStorageRole = isStorageRole || (tags.indexOf('tag-storage') !== -1);
        }
        container.innerHTML += createCard(i, tags, intent === 'custom', isStorageRole);
    }
}

function getIntentNicGroups(intent, portCount) {
    const groups = [];
    const p = parseInt(portCount) || 0;
    if (!intent || p <= 0) return groups;

    const addGroup = (key, label, nics) => {
        if (!nics || !nics.length) return;
        groups.push({ key, label, nics });
    };

    if (intent === 'all_traffic') {
        addGroup('all', 'Group All Traffic', Array.from({ length: p }, (_, i) => i + 1));
        return groups;
    }

    if (intent === 'mgmt_compute') {
        if (p === 2) {
            addGroup('mgmt_compute', 'Mgmt + Compute', [1]);
            addGroup('storage', 'Storage', [2]);
        } else {
            const assignment = getMgmtComputeNicAssignment(p);
            addGroup('mgmt_compute', 'Mgmt + Compute', assignment.mgmtCompute);
            addGroup('storage', 'Storage', assignment.storage);
        }
        return groups;
    }

    if (intent === 'compute_storage') {
        addGroup('mgmt', 'Management', [1, 2].filter(n => n <= p));
        addGroup('compute_storage', 'Compute + Storage', Array.from({ length: Math.max(0, p - 2) }, (_, i) => i + 3));
        return groups;
    }

    if (intent === 'custom') {
        // Group by custom intent assignment.
        const trafficNames = {
            'mgmt': 'Management',
            'compute': 'Compute',
            'storage': 'Storage',
            'mgmt_compute': 'Mgmt + Compute',
            'compute_storage': 'Compute + Storage',
            'all': 'All Traffic',
            'unused': 'Unused'
        };

        const buckets = new Map();
        for (let i = 1; i <= p; i++) {
            const assignment = (state.customIntents && state.customIntents[i]) || 'unused';
            if (assignment === 'unused') continue;
            if (!buckets.has(assignment)) buckets.set(assignment, []);
            buckets.get(assignment).push(i);
        }

        // If nothing configured yet, don't show overrides until the user assigns NICs.
        if (buckets.size === 0) {
            return groups;
        }

        for (const [key, nics] of buckets.entries()) {
            addGroup(`custom_${key}`, `${trafficNames[key] || key}`, nics);
        }
        return groups;
    }

    return groups;
}

function ensureDefaultOverridesForGroups(groups) {
    if (!state.intentOverrides || typeof state.intentOverrides !== 'object') state.intentOverrides = {};

    const defaultRdmaMode = state.scale === 'low_capacity' ? 'Disabled' : 'RoCEv2';
    const defaultJumbo = '1514';

    for (const g of groups) {
        if (!state.intentOverrides[g.key]) state.intentOverrides[g.key] = {};
        if (!state.intentOverrides[g.key].rdmaMode) state.intentOverrides[g.key].rdmaMode = defaultRdmaMode;
        if (!state.intentOverrides[g.key].jumboFrames) state.intentOverrides[g.key].jumboFrames = defaultJumbo;

        // vSwitch overrides are only relevant for Mgmt+Compute and Compute-only intents.
        // Keep defaults empty (meaning: do not override template defaults).
        const baseKey = String(g.key || '').startsWith('custom_') ? String(g.key).substring('custom_'.length) : String(g.key || '');
        if (baseKey === 'mgmt_compute' || baseKey === 'compute') {
            const ov = state.intentOverrides[g.key];
            if (ov.enableIov === undefined) ov.enableIov = '';
        }

        // Storage intent VLAN override (Network ATC defaults)
        // Includes Group All Traffic because it contains storage traffic.
        if (g.key === 'storage' || g.key === 'custom_storage' || g.key === 'all') {
            const ov = state.intentOverrides[g.key];

            // Back-compat (older key names)
            if ((ov.storageNetwork1VlanId === undefined || ov.storageNetwork1VlanId === null) && (ov.storageVlanNic1 !== undefined && ov.storageVlanNic1 !== null)) {
                ov.storageNetwork1VlanId = ov.storageVlanNic1;
            }
            if ((ov.storageNetwork2VlanId === undefined || ov.storageNetwork2VlanId === null) && (ov.storageVlanNic2 !== undefined && ov.storageVlanNic2 !== null)) {
                ov.storageNetwork2VlanId = ov.storageVlanNic2;
            }

            if (ov.storageNetwork1VlanId === undefined || ov.storageNetwork1VlanId === null) {
                ov.storageNetwork1VlanId = 711;
            }
            if (ov.storageNetwork2VlanId === undefined || ov.storageNetwork2VlanId === null) {
                ov.storageNetwork2VlanId = 712;
            }
        }
    }
}

function getStorageVlanOverrideNetworkCount() {
    // Step 05 Storage Connectivity controls how many storage networks exist.
    // - Switched: 2 storage networks
    // - Switchless: 1 storage network
    if (state.storage === 'switchless') return 1;
    if (state.storage === 'switched') {
        return 2;
    }
    return 0;
}

function applyOverridesToPorts(groups) {
    if (!state.portConfig || !Array.isArray(state.portConfig)) return;

    for (const g of groups) {
        const ov = state.intentOverrides && state.intentOverrides[g.key];
        if (!ov) continue;
        for (const nic of g.nics) {
            const idx = nic - 1;
            if (!state.portConfig[idx]) continue;
            // Do not change which ports are RDMA-capable from Step 08 overrides.
            // Step 07 Port Configuration is authoritative for RDMA capability.
            // Only apply RDMA technology when the port is already RDMA-enabled and wasn't manually set.
            if (state.portConfig[idx].rdma === true && state.portConfig[idx].rdmaManual !== true) {
                if (ov.rdmaMode && ov.rdmaMode !== 'Disabled') {
                    state.portConfig[idx].rdmaMode = ov.rdmaMode;
                }
            }
            state.portConfig[idx].jumboFrames = ov.jumboFrames;
        }
    }
}

function renderIntentOverrides(container) {
    const portCount = parseInt(state.ports);
    const groups = getIntentNicGroups(state.intent, portCount);

    container.innerHTML = '';
    if (!groups.length) return false;

    ensureDefaultOverridesForGroups(groups);
    applyOverridesToPorts(groups);

    const rdmaOptions = ['RoCE', 'RoCEv2', 'iWarp', 'Disabled'];
    const jumboOptions = ['1514', '4088', '9014'];
    const sriovOptions = [
        { value: '', label: 'Enabled' },
        { value: 'false', label: 'Disabled' }
    ];

    for (const g of groups) {
        const ov = state.intentOverrides[g.key];

        const baseKey = String(g.key || '').startsWith('custom_') ? String(g.key).substring('custom_'.length) : String(g.key || '');
        const showVswitchOverrides = (baseKey === 'mgmt_compute' || baseKey === 'compute');

        const card = document.createElement('div');
        card.className = 'override-card';

        const nicHint = g.nics.length <= 4
            ? `NIC${g.nics.length > 1 ? 's' : ''}: ${g.nics.join(', ')}`
            : `NICs: ${Math.min(...g.nics)}-${Math.max(...g.nics)}`;

        const storageVlanCount = getStorageVlanOverrideNetworkCount();
        const storageVlanHtml = (g.key === 'storage' || g.key === 'custom_storage' || g.key === 'all') ? (() => {
            if (storageVlanCount <= 0) return '';

            let html = `
                <div class="config-row" style="margin-top:0.75rem;">
                    <span class="config-label">Storage Network 1 VLAN ID</span>
                    <input type="number" min="1" max="4096" class="speed-select" value="${(ov.storageNetwork1VlanId !== undefined && ov.storageNetwork1VlanId !== null) ? ov.storageNetwork1VlanId : ''}" data-override-group="${g.key}" data-override-key="storageNetwork1VlanId" />
                </div>
            `;

            if (storageVlanCount >= 2) {
                html += `
                    <div class="config-row" style="margin-top:0.75rem;">
                        <span class="config-label">Storage Network 2 VLAN ID</span>
                        <input type="number" min="1" max="4096" class="speed-select" value="${(ov.storageNetwork2VlanId !== undefined && ov.storageNetwork2VlanId !== null) ? ov.storageNetwork2VlanId : ''}" data-override-group="${g.key}" data-override-key="storageNetwork2VlanId" />
                    </div>
                `;
            }

            return html;
        })() : '';

        card.innerHTML = `
            <h5>
                <span>${g.label}</span>
                <span class="override-hint">${nicHint}</span>
            </h5>
            <div class="config-row">
                <span class="config-label">RDMA</span>
                <select class="speed-select" data-override-group="${g.key}" data-override-key="rdmaMode">
                    ${rdmaOptions.map(o => `<option value="${o}" ${ov.rdmaMode === o ? 'selected' : ''}>${o}</option>`).join('')}
                </select>
            </div>
            <div class="config-row" style="margin-top:0.75rem;">
                <span class="config-label">Jumbo Frames</span>
                <select class="speed-select" data-override-group="${g.key}" data-override-key="jumboFrames">
                    ${jumboOptions.map(o => `<option value="${o}" ${ov.jumboFrames === o ? 'selected' : ''}>${o}</option>`).join('')}
                </select>
            </div>
            ${showVswitchOverrides ? `
            <div class="config-row" style="margin-top:0.75rem;">
                <span class="config-label">SR-IOV</span>
                <select class="speed-select" data-override-group="${g.key}" data-override-key="enableIov">
                    ${sriovOptions.map(o => `<option value="${o.value}" ${String(ov.enableIov ?? '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
            </div>
            ` : ''}
            ${storageVlanHtml}
        `;

        // Wire change handlers
        card.querySelectorAll('select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const groupKey = e.target.getAttribute('data-override-group');
                const overrideKey = e.target.getAttribute('data-override-key');
                updateIntentGroupOverride(groupKey, overrideKey, e.target.value);
            });
        });

        card.querySelectorAll('input[data-override-group][data-override-key]').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const groupKey = e.target.getAttribute('data-override-group');
                const overrideKey = e.target.getAttribute('data-override-key');
                updateIntentGroupVlanOverride(groupKey, overrideKey, e.target.value, e.target);
            });
        });

        container.appendChild(card);
    }

    return true;
}

function updateIntentGroupOverride(groupKey, key, value) {
    if (!state.intentOverrides || typeof state.intentOverrides !== 'object') state.intentOverrides = {};
    if (!state.intentOverrides[groupKey]) state.intentOverrides[groupKey] = {};
    state.intentOverrides[groupKey][key] = value;

    // Track which section was touched so generated output only sets relevant override flags.
    state.intentOverrides[groupKey].__touched = true;
    if (key === 'enableIov') {
        state.intentOverrides[groupKey].__touchedVswitch = true;
    } else {
        // RDMA/Jumbo are adapter property overrides.
        state.intentOverrides[groupKey].__touchedAdapterProperty = true;
    }
    updateUI();
}

function updateIntentGroupVlanOverride(groupKey, key, raw, inputEl) {
    if (!state.intentOverrides || typeof state.intentOverrides !== 'object') state.intentOverrides = {};
    if (!state.intentOverrides[groupKey]) state.intentOverrides[groupKey] = {};

    state.intentOverrides[groupKey].__touched = true;
    state.intentOverrides[groupKey].__touchedVlan = true;

    const trimmed = String((raw === undefined || raw === null) ? '' : raw).trim();
    if (!trimmed) {
        state.intentOverrides[groupKey][key] = null;
        if (inputEl) inputEl.setCustomValidity('');
        updateSummary();
        return;
    }

    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 1 || value > 4096) {
        state.intentOverrides[groupKey][key] = null;
        if (inputEl) {
            inputEl.setCustomValidity('Enter a VLAN ID between 1 and 4096.');
            inputEl.reportValidity();
        }
        updateSummary();
        return;
    }

    state.intentOverrides[groupKey][key] = value;
    if (inputEl) inputEl.setCustomValidity('');
    updateSummary();
}

function updateCustomNic(index, value) {
    if (!state.customIntents) state.customIntents = {};
    state.customIntents[index] = value;
    state.customIntentConfirmed = false;
    updateUI();
}

function getNicMapping(intent, portCount, isSwitchless) {
    if (!intent || !portCount) return null;

    let mapping = [];

    if (intent === 'all_traffic') {
        mapping.push(`NICs 1-${portCount}: Management + Compute + Storage (Converged)`);
    } else if (intent === 'mgmt_compute') {
        if (portCount === 2) {
            mapping.push(`NIC 1: Management + Compute`);
            mapping.push(`NIC 2: Storage`);
        } else {
            mapping.push(`NICs 1-2: Management + Compute`);
            if (portCount > 2) {
                mapping.push(`NICs 3-${portCount}: Storage`);
            }
        }
    } else if (intent === 'compute_storage') {
        mapping.push(`NICs 1-2: Management`);
        if (portCount > 2) {
            mapping.push(`NICs 3-${portCount}: Compute + Storage`);
        }
    }

    return mapping.length > 0 ? mapping.join('<br>') : null;
}

function getCustomNicMapping(customIntents, portCount) {
    if (!customIntents || !portCount) return null;

    const trafficNames = {
        'mgmt': 'Management',
        'compute': 'Compute',
        'storage': 'Storage',
        'mgmt_compute': 'Management + Compute',
        'compute_storage': 'Compute + Storage',
        'all': 'All Traffic',
        'unused': 'Unused'
    };

    let mapping = [];
    for (let i = 1; i <= portCount; i++) {
        const assignment = customIntents[i] || 'unused';
        if (assignment !== 'unused') {
            mapping.push(`NIC ${i}: ${trafficNames[assignment] || assignment}`);
        }
    }

    return mapping.length > 0 ? mapping.join('<br>') : 'No NICs assigned';
}

function updateStepIndicators() {
    const steps = [
        { id: 'step-1', field: 'scenario', validation: () => state.scenario !== null },
        { id: 'step-2', field: 'region', validation: () => state.region !== null },
        { id: 'step-3', field: 'localInstanceRegion', validation: () => state.localInstanceRegion !== null },
        { id: 'step-4', field: 'scale', validation: () => state.scale !== null },
        { id: 'step-5', field: 'nodes', validation: () => state.nodes !== null },
        { id: 'step-6', field: 'ports', validation: () => state.ports !== null },
        { id: 'step-7', field: 'outbound', validation: () => state.outbound !== null },
        { id: 'step-8', field: 'arc', validation: () => state.arc !== null },
        { id: 'step-9', field: 'ip', validation: () => state.ip !== null },
        { id: 'step-10', field: 'activeDirectory', validation: () => state.activeDirectory !== null },
        { id: 'step-11', field: 'securityConfiguration', validation: () => state.securityConfiguration !== null }
    ];

    steps.forEach(step => {
        const stepElement = document.getElementById(step.id);
        if (!stepElement) return;

        const stepHeader = stepElement.querySelector('.step-header');
        if (!stepHeader) return;

        // Remove existing indicator
        const existingIndicator = stepHeader.querySelector('.step-indicator');
        if (existingIndicator) existingIndicator.remove();

        // Check validation
        const isValid = step.validation();
        
        if (isValid) {
            // Add checkmark indicator
            const indicator = document.createElement('span');
            indicator.className = 'step-indicator';
            indicator.innerHTML = '✓';
            indicator.style.cssText = 'color: var(--success); font-size: 20px; font-weight: bold; margin-left: 8px;';
            stepHeader.appendChild(indicator);
        }
    });
}

function updateSummary() {
    const summaryPanel = document.getElementById('summary-panel');
    const content = document.getElementById('summary-content');

    if (!summaryPanel || !content) return;

    // Always visible
    summaryPanel.classList.remove('hidden');

    const escapeHtml = (s) => String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderRow = (label, valueHtml, opts) => {
        const monoClass = (opts && opts.mono) ? ' mono' : '';
        return `<div class="summary-row">
            <div class="summary-label">${escapeHtml(label)}</div>
            <div class="summary-value${monoClass}">${valueHtml}</div>
        </div>`;
    };

    const renderMultilineValue = (lines, opts) => {
        const monoClass = (opts && opts.mono) ? ' mono' : '';
        const safeLines = (lines || []).map(l => `<div>${escapeHtml(l)}</div>`).join('');
        return `<div class="summary-value${monoClass}"><div class="summary-multiline">${safeLines}</div></div>`;
    };

    const renderSection = (title, titleClass, rowsHtml) => {
        if (!rowsHtml) return '';
        return `<div class="summary-section">
            <div class="summary-section-title ${titleClass}">${escapeHtml(title)}</div>
            ${rowsHtml}
        </div>`;
    };

    const getRackAwareTorUiTitle = (dataValue) => {
        try {
            const v = String(dataValue || '');
            if (!v) return null;
            const card = document.querySelector(`#rack-aware-tor .option-card[data-value="${CSS.escape(v)}"]`);
            if (!card) return null;
            const h3 = card.querySelector('h3');
            const t = h3 ? String(h3.textContent || '').trim() : '';
            return t || null;
        } catch (e) {
            return null;
        }
    };

    const formatRackAwareTorArchitectureFallback = (val) => {
        const v = String(val || '');
        if (v === 'option_a') return 'Dedicated storage links';
        if (v === 'option_b') return 'Aggregated storage links';
        if (v === 'option_c') return 'Per-room node connectivity';
        if (v === 'option_d') return 'Cross-room node connectivity';
        return v ? v : '-';
    };

    // Build section rows (grouped by step ranges)
    // Step 01–05: Scenario and Scale
    let scenarioScaleRows = '';
    if (state.scenario) scenarioScaleRows += renderRow('Scenario', escapeHtml(formatScenario(state.scenario)));
    if (state.region) scenarioScaleRows += renderRow('Azure Cloud', escapeHtml(formatRegion(state.region)));
    if (state.localInstanceRegion) scenarioScaleRows += renderRow('Azure Local Instance Region', escapeHtml(formatLocalInstanceRegion(state.localInstanceRegion)));
    if (state.scale) scenarioScaleRows += renderRow('Scale', escapeHtml(formatScale(state.scale)));
    if (state.nodes) scenarioScaleRows += renderRow('Nodes', escapeHtml(state.nodes), { mono: true });
    if (state.witnessType) scenarioScaleRows += renderRow('Cloud Witness Type', escapeHtml(state.witnessType));

    // Rack Aware additions (Availability Zones + ToR architecture)
    let rackAwareRows = '';
    if (state.scale === 'rack_aware') {
        const nRaw = state.nodes;
        const n = parseInt(nRaw === '16+' ? 16 : nRaw, 10);
        const z = state.rackAwareZones;
        const confirmed = Boolean(state.rackAwareZonesConfirmed);
        const zone1Name = (z && z.zone1Name) ? String(z.zone1Name).trim() : '';
        const zone2Name = (z && z.zone2Name) ? String(z.zone2Name).trim() : '';
        const assignments = (z && z.assignments && typeof z.assignments === 'object') ? z.assignments : null;

        if (zone1Name || zone2Name || confirmed) {
            const status = confirmed ? 'Confirmed' : 'Not confirmed';
            const names = `${zone1Name || 'Zone1'} / ${zone2Name || 'Zone2'}`;
            rackAwareRows += renderRow('Local availability zones', `${escapeHtml(names)} <span style="color:var(--text-secondary);">(${escapeHtml(status)})</span>`);
        }

        if (!isNaN(n) && n > 0 && assignments) {
            const lines = [];
            for (let i = 1; i <= n; i++) {
                const assigned = Number(assignments[String(i)]);
                const zoneName = assigned === 1 ? (zone1Name || 'Zone1') : (zone2Name || 'Zone2');
                const nodeName = (state.nodeSettings && state.nodeSettings[i - 1] && state.nodeSettings[i - 1].name)
                    ? String(state.nodeSettings[i - 1].name).trim()
                    : '';
                lines.push(`${nodeName || `Node ${i}`} → ${zoneName}`);
            }
            rackAwareRows += `<div class="summary-row">
                <div class="summary-label">Zone assignments</div>
                ${renderMultilineValue(lines)}
            </div>`;
        }

        if (state.rackAwareTorsPerRoom) {
            const torsTitle = getRackAwareTorUiTitle(String(state.rackAwareTorsPerRoom)) || String(state.rackAwareTorsPerRoom);
            rackAwareRows += renderRow('ToR switches per room', escapeHtml(torsTitle));
        }
        if (state.rackAwareTorArchitecture) {
            const archTitle = getRackAwareTorUiTitle(String(state.rackAwareTorArchitecture))
                || formatRackAwareTorArchitectureFallback(state.rackAwareTorArchitecture);
            rackAwareRows += renderRow('ToR switch architecture', escapeHtml(archTitle));
        }
    }

    // Step 06–08: Host Networking
    let hostNetworkingRows = '';
    if (state.storage) hostNetworkingRows += renderRow('Storage', escapeHtml(capitalize(state.storage)));
    if (state.ports) hostNetworkingRows += renderRow('Ports', escapeHtml(state.ports), { mono: true });
    if (state.storagePoolConfiguration) hostNetworkingRows += renderRow('Storage Pool', escapeHtml(state.storagePoolConfiguration));
    if (state.intent) {
        hostNetworkingRows += renderRow('Intent', escapeHtml(formatIntent(state.intent)));

        // NIC mapping (render multiline)
        if (state.ports && state.intent !== 'custom') {
            const portCount = parseInt(state.ports);
            const nicMapping = getNicMapping(state.intent, portCount, state.storage === 'switchless');
            if (nicMapping) {
                const lines = String(nicMapping).split('<br>').map(s => s.trim()).filter(Boolean);
                hostNetworkingRows += `<div class="summary-row">
                    <div class="summary-label">NIC Mapping</div>
                    ${renderMultilineValue(lines)}
                </div>`;
            }
        } else if (state.intent === 'custom' && state.customIntents) {
            const customMapping = getCustomNicMapping(state.customIntents, parseInt(state.ports));
            if (customMapping) {
                const lines = String(customMapping).split('<br>').map(s => s.trim()).filter(Boolean);
                hostNetworkingRows += `<div class="summary-row">
                    <div class="summary-label">NIC Mapping</div>
                    ${renderMultilineValue(lines)}
                </div>`;
            }
        }
    }
    if (state.storageAutoIp) {
        hostNetworkingRows += renderRow('Storage Auto IP', state.storageAutoIp === 'enabled' ? 'Enabled' : 'Disabled');
    }

    // Intent Overrides summary (per NIC set)
    if (state.intentOverrides && state.intent && state.ports) {
        const groups = getIntentNicGroups(state.intent, parseInt(state.ports));
        for (const g of groups) {
            const ov = state.intentOverrides[g.key];
            if (!ov) continue;
            if (ov.rdmaMode) hostNetworkingRows += renderRow(`RDMA — ${g.label}`, escapeHtml(ov.rdmaMode));
            if (ov.jumboFrames) hostNetworkingRows += renderRow(`Jumbo Frames — ${g.label}`, escapeHtml(ov.jumboFrames));

            if (g.key === 'storage' || g.key === 'custom_storage' || g.key === 'all') {
                const count = getStorageVlanOverrideNetworkCount();
                if (count >= 1) {
                    const v1 = (ov.storageNetwork1VlanId !== undefined && ov.storageNetwork1VlanId !== null)
                        ? ov.storageNetwork1VlanId
                        : ov.storageVlanNic1;
                    if (v1 !== undefined && v1 !== null) {
                        hostNetworkingRows += renderRow(`Storage Network 1 VLAN ID — ${g.label}`, escapeHtml(v1), { mono: true });
                    }
                }
                if (count >= 2) {
                    const v2 = (ov.storageNetwork2VlanId !== undefined && ov.storageNetwork2VlanId !== null)
                        ? ov.storageNetwork2VlanId
                        : ov.storageVlanNic2;
                    if (v2 !== undefined && v2 !== null) {
                        hostNetworkingRows += renderRow(`Storage Network 2 VLAN ID — ${g.label}`, escapeHtml(v2), { mono: true });
                    }
                }
            }
        }
    }

    // Step 09–11: Connectivity
    let connectivityRows = '';
    if (state.outbound) connectivityRows += renderRow('Outbound', escapeHtml(formatOutbound(state.outbound)));
    if (state.arc) connectivityRows += renderRow('Arc Gateway', state.arc === 'arc_gateway' ? 'Enabled' : 'Disabled');
    if (state.proxy) connectivityRows += renderRow('Proxy', state.proxy === 'no_proxy' ? 'Disabled' : 'Enabled');

    // Step 12–14: Infrastructure network
    let infraNetworkRows = '';
    if (state.ip) infraNetworkRows += renderRow('IP', escapeHtml(capitalize(state.ip)));
    if (state.nodeSettings && state.nodeSettings.length > 0) {
        const lines = state.nodeSettings
            .map((n, idx) => {
                const name = (n && n.name) ? String(n.name).trim() : '';
                const ipCidr = (n && n.ipCidr) ? String(n.ipCidr).trim() : '';
                if (!name && !ipCidr) return `Node ${idx + 1}: (not set)`;
                if (name && ipCidr) return `${name} — ${ipCidr}`;
                return `${name || `Node ${idx + 1}`} — ${ipCidr || '(IP not set)'}`;
            })
            .filter(Boolean);
        infraNetworkRows += `<div class="summary-row">
            <div class="summary-label">Nodes</div>
            ${renderMultilineValue(lines)}
        </div>`;
    }
    if (state.infraVlan) {
        const vlanLabel = state.infraVlan === 'custom' ? 'Custom VLAN' : 'Default VLAN';
        infraNetworkRows += renderRow('Infra VLAN', escapeHtml(vlanLabel));
        if (state.infraVlan === 'custom' && state.infraVlanId) {
            infraNetworkRows += renderRow('Infra VLAN ID', escapeHtml(state.infraVlanId), { mono: true });
        }
    }
    if (state.infraCidr) infraNetworkRows += renderRow('Infra Network', escapeHtml(state.infraCidr), { mono: true });
    if (state.infra) infraNetworkRows += renderRow('Infra Range', escapeHtml(`${state.infra.start} - ${state.infra.end}`), { mono: true });
    if (state.infraGateway) infraNetworkRows += renderRow('Default Gateway', escapeHtml(state.infraGateway), { mono: true });

    // Step 15: Active Directory
    let activeDirectoryRows = '';
    if (state.activeDirectory) {
        const adType = state.activeDirectory === 'azure_ad' ? 'Active Directory' : 'Local Identity';
        activeDirectoryRows += renderRow('Identity', escapeHtml(adType));
        if (state.activeDirectory === 'azure_ad' && state.adDomain) {
            activeDirectoryRows += renderRow('AD Domain', escapeHtml(state.adDomain), { mono: true });
        }
        if (state.dnsServers && state.dnsServers.length > 0) {
            activeDirectoryRows += renderRow('DNS Servers', escapeHtml(state.dnsServers.join(', ')), { mono: true });
        }
        if (state.localDnsZone) {
            activeDirectoryRows += renderRow('Local DNS Zone', escapeHtml(state.localDnsZone), { mono: true });
        }
    }

    // Security Configuration
    let securityRows = '';
    if (state.securityConfiguration) {
        const secType = state.securityConfiguration === 'recommended' ? 'Recommended (Secure by default)' : 'Customized';
        securityRows += renderRow('Security Level', escapeHtml(secType));
        if (state.securityConfiguration === 'customized' && state.securitySettings) {
            const settings = [];
            if (state.securitySettings.driftControlEnforced !== undefined) {
                settings.push(`Drift Control: ${state.securitySettings.driftControlEnforced ? 'On' : 'Off'}`);
            }
            if (state.securitySettings.bitlockerBootVolume !== undefined) {
                settings.push(`Bitlocker Boot: ${state.securitySettings.bitlockerBootVolume ? 'On' : 'Off'}`);
            }
            if (state.securitySettings.bitlockerDataVolumes !== undefined) {
                settings.push(`Bitlocker Data: ${state.securitySettings.bitlockerDataVolumes ? 'On' : 'Off'}`);
            }
            if (state.securitySettings.wdacEnforced !== undefined) {
                settings.push(`WDAC: ${state.securitySettings.wdacEnforced ? 'On' : 'Off'}`);
            }
            if (state.securitySettings.credentialGuardEnforced !== undefined) {
                settings.push(`Credential Guard: ${state.securitySettings.credentialGuardEnforced ? 'On' : 'Off'}`);
            }
            if (state.securitySettings.smbSigningEnforced !== undefined) {
                settings.push(`SMB Signing: ${state.securitySettings.smbSigningEnforced ? 'On' : 'Off'}`);
            }
            if (state.securitySettings.smbClusterEncryption !== undefined) {
                settings.push(`SMB Encryption: ${state.securitySettings.smbClusterEncryption ? 'On' : 'Off'}`);
            }
            if (settings.length > 0) {
                securityRows += `<div class="summary-row">
            <div class="summary-label">Security Controls</div>
            ${renderMultilineValue(settings)}
        </div>`;
            }
        }
    }

    // Step 16: Software Defined Networking
    let sdnRows = '';
    if (state.sdnFeatures && state.sdnFeatures.length > 0) {
        const featureNames = {
            'lnet': 'LNET',
            'nsg': 'NSG',
            'vnet': 'VNET',
            'slb': 'Load Balancers'
        };
        const features = state.sdnFeatures.map(f => featureNames[f] || f).join(', ');
        sdnRows += renderRow('SDN Features', escapeHtml(features));
        if (state.sdnManagement) {
            const mgmtType = state.sdnManagement === 'arc_managed' ? 'Arc Managed' : 'On-Premises Managed';
            sdnRows += renderRow('SDN Management', escapeHtml(mgmtType));
        }
    }

    const scenarioScaleHtml = renderSection('Scenario & Scale', 'summary-section-title--infra', scenarioScaleRows);
    const rackAwareHtml = renderSection('Rack Aware', 'summary-section-title--infra', rackAwareRows);
    const hostNetworkingHtml = renderSection('Host Networking', 'summary-section-title--net', hostNetworkingRows);
    const connectivityHtml = renderSection('Connectivity', 'summary-section-title--mgmt', connectivityRows);
    const infraNetworkHtml = renderSection('Infrastructure Network', 'summary-section-title--infra', infraNetworkRows);
    const activeDirectoryHtml = renderSection('Active Directory', 'summary-section-title--mgmt', activeDirectoryRows);
    const securityHtml = renderSection('Security Configuration', 'summary-section-title--mgmt', securityRows);
    const sdnHtml = renderSection('Software Defined Networking', 'summary-section-title--net', sdnRows);

    let html = scenarioScaleHtml + rackAwareHtml + hostNetworkingHtml + connectivityHtml + infraNetworkHtml + activeDirectoryHtml + securityHtml + sdnHtml;
    if (!html) {
        html = '<div class="summary-section"><div style="color:var(--text-secondary); font-style:italic">Select options to see summary...</div></div>';
    }

    content.innerHTML = html;

    renderDiagram();
    updateStepIndicators();
}

function renderDiagram() {
    const container = document.getElementById('summary-diagram-container');
    if (!container) return;
    if (!state.nodes) {
        container.innerHTML = '';
        return;
    }

    // Simple visual: Host Box -> NICs
    const n = parseInt(state.nodes === '16+' ? 16 : state.nodes) || 1;
    const isRackAware = state.scale === 'rack_aware';

    // In rack aware, n is 4, 6 or 8.
    const showN = isRackAware ? n : Math.min(n, 4);
    const p = parseInt(state.ports) || 0;
    const intent = state.intent;

    // Helper to determine traffic
    const getTraffic = (portIdx) => {
        // portIdx is 0-based
        if (!intent) return [];
        if (intent === 'all_traffic') return ['m', 'c', 's'];
        if (intent === 'mgmt_compute') {
            // Special case: with 2 ports, NIC1 is Mgmt+Compute and NIC2 is Storage.
            if (p === 2) {
                return portIdx === 0 ? ['m', 'c'] : ['s'];
            }
            const assignment = getMgmtComputeNicAssignment(p);
            const nic = portIdx + 1;
            return assignment.mgmtCompute.includes(nic) ? ['m', 'c'] : ['s'];
        }
        if (intent === 'compute_storage') {
            if (portIdx < 2) return ['m'];
            return ['c', 's'];
        }
        if (intent === 'custom') {
            const val = (state.customIntents && state.customIntents[portIdx + 1]) || 'unused';
            if (val === 'mgmt') return ['m'];
            if (val === 'compute') return ['c'];
            if (val === 'storage') return ['s'];
            if (val === 'mgmt_compute') return ['m', 'c'];
            if (val === 'compute_storage') return ['c', 's'];
            if (val === 'all') return ['m', 'c', 's'];
            return []; // unused
        }
        return [];
    };

    const renderNodeHtml = (i) => {
        let portsHtml = '';
        if (p > 0) {
            portsHtml = '<div style="display:flex; gap:4px; justify-content:center; margin-bottom:6px;">';
            for (let j = 0; j < p; j++) {
                const traffic = getTraffic(j);

                if (!intent) {
                    portsHtml += `<div style="width:6px; height:14px; background:rgba(255,255,255,0.1); border-radius:2px;"></div>`;
                } else {
                    const hasM = traffic.includes('m');
                    const hasC = traffic.includes('c');
                    const hasS = traffic.includes('s');
                    const isEmpty = traffic.length === 0;

                    if (isEmpty) {
                        portsHtml += `<div style="width:6px; height:14px; background:rgba(255,255,255,0.05); border-radius:2px; border:1px dashed rgba(255,255,255,0.2);" title="Unused"></div>`;
                    } else {
                        portsHtml += `<div style="display:flex; flex-direction:column; gap:1px;">
                            <div style="width:6px; height:4px; border-radius:1px; background:${hasM ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)'};" title="Management"></div>
                            <div style="width:6px; height:4px; border-radius:1px; background:${hasC ? 'var(--accent-purple)' : 'rgba(255,255,255,0.05)'};" title="Compute"></div>
                            <div style="width:6px; height:4px; border-radius:1px; background:${hasS ? 'var(--success)' : 'rgba(255,255,255,0.05)'};" title="Storage"></div>
                        </div>`;
                    }
                }
            }
            portsHtml += '</div>';
        } else {
            portsHtml = '<span style="font-size:10px; color:#555">-</span>';
        }

        return `
        <div style="background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); padding:0.5rem; border-radius:4px; text-align:center; min-width:60px;">
             ${portsHtml}
             <div style="font-size:0.7rem; color:var(--text-secondary);">Node ${i + 1}</div>
        </div>`;
    };

    let html = '';

    if (isRackAware) {
        const half = Math.ceil(showN / 2);

        html += '<div style="display:flex; flex-direction:column; gap:0.5rem; align-items:center; width:100%;">';

        // Room 1
        html += '<div style="border:1px dashed var(--glass-border); padding:0.5rem; border-radius:8px; text-align:center; width:100%; background:rgba(0,0,0,0.2);">';
        html += '<div style="font-size:0.6rem; margin-bottom:0.5rem; color:var(--text-secondary);">Room 1 (Rack A)</div>';
        html += '<div style="display:flex; gap:0.5rem; justify-content:center; align-items:flex-end; flex-wrap:wrap;">';
        for (let i = 0; i < half; i++) html += renderNodeHtml(i);
        html += '</div></div>';

        // Room 2
        html += '<div style="border:1px dashed var(--glass-border); padding:0.5rem; border-radius:8px; text-align:center; width:100%; background:rgba(0,0,0,0.2);">';
        html += '<div style="font-size:0.6rem; margin-bottom:0.5rem; color:var(--text-secondary);">Room 2 (Rack B)</div>';
        html += '<div style="display:flex; gap:0.5rem; justify-content:center; align-items:flex-end; flex-wrap:wrap;">';
        for (let i = half; i < showN; i++) html += renderNodeHtml(i);
        html += '</div></div>';

        html += '</div>';

    } else {
        html += '<div style="display:flex; justify-content:center; gap:0.5rem; align-items:flex-end; flex-wrap:wrap;">';
        for (let i = 0; i < showN; i++) {
            html += renderNodeHtml(i);
        }
        html += '</div>';
    }

    // Legend
    if (intent) {
        html += `
        <div style="display:flex; justify-content:center; gap:0.5rem; margin-top:0.75rem; padding-top:0.5rem; border-top:1px solid rgba(255,255,255,0.05); font-size:0.6rem; color:var(--text-secondary);">
            <div style="display:flex; align-items:center; gap:3px;"><div style="width:6px; height:6px; background:var(--accent-blue); border-radius:50%;"></div>Mgmt</div>
            <div style="display:flex; align-items:center; gap:3px;"><div style="width:6px; height:6px; background:var(--accent-purple); border-radius:50%;"></div>Comp</div>
            <div style="display:flex; align-items:center; gap:3px;"><div style="width:6px; height:6px; background:var(--success); border-radius:50%;"></div>Stor</div>
        </div>
        `;
    }
    if (!isRackAware && n > 4) html += '<div style="text-align:center; font-size:0.7rem; color:var(--text-secondary); margin-top:0.5rem;">+ ' + (n - 4) + ' more nodes</div>';

    container.innerHTML = html;
}

function getProxyLabel() {
    if (!state.proxy) return '-';
    if (state.proxy === 'no_proxy') return 'Disabled';
    if (state.outbound === 'private') return 'Azure Firewall Explicit Proxy';
    return 'Enabled';
}

function formatScenario(val) {
    if (val === 'disconnected') return 'Disconnected (Air Gapped)';
    if (val === 'm365local') return 'M365 Local';
    return val;
}

function formatScale(val) {
    if (val === 'low_capacity') return 'Low Capacity';
    if (val === 'medium') return 'Hyperconverged (1-16 Nodes)';
    if (val === 'rack_aware') return 'Rack Aware (Multi-Room)';
    if (val === 'rack_scale') return 'Rack Scale';
    return capitalize(val);
}

function formatOutbound(val) {
    if (val === 'public') return 'Public Internet';
    if (val === 'private') return 'ExpressRoute / VPN';
    if (val === 'air_gapped') return 'Air Gapped';
    if (val === 'limited') return 'Limited Connectivity';
    return capitalize(val);
}

function formatIntent(val) {
    if (val === 'all_traffic') return 'Group All Traffic';
    if (val === 'mgmt_compute') return 'Mgmt + Compute';
    if (val === 'compute_storage') return 'Compute + Storage';
    return capitalize(val);
}

function formatScenario(s) {
    if (!s) return '';
    if (s === 'hyperconverged') return 'Hyperconverged';
    if (s === 'multirack') return 'Multi-Rack';
    if (s === 'disconnected') return 'Disconnected';
    if (s === 'm365local') return 'M365 Local';
    return capitalize(s);
}

function formatRegion(r) {
    if (!r) return '';
    if (r === 'azure_commercial') return 'Azure Commercial';
    if (r === 'azure_government') return 'Azure Government';
    if (r === 'azure_china') return 'Azure China';
    return capitalize(r);
}

function formatLocalInstanceRegion(r) {
    if (!r) return '';
    const map = {
        'east_us': 'East US',
        'west_europe': 'West Europe',
        'australia_east': 'Australia East',
        'southeast_asia': 'Southeast Asia',
        'india_central': 'India Central',
        'canada_central': 'Canada Central',
        'japan_east': 'Japan East',
        'south_central_us': 'South Central US',
        'us_gov_virginia': 'US Gov Virginia'
    };
    return map[r] || capitalize(r);
}

function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function getRequiredRdmaPortCount() {
    // Low Capacity is exempt from minimum RDMA port requirements in this wizard.
    if (state.scale === 'low_capacity') return 0;

    const n = parseInt(state.nodes, 10);

    // Standard (Hyperconverged) + Switchless topologies require more RDMA ports.
    if (state.scale === 'medium' && state.storage === 'switchless') {
        if (n === 3) return 4;
        if (n === 4) return 6;
    }

    // Default rule: require at least two RDMA-capable ports.
    return 2;
}

function renderPortConfiguration(count) {
    const container = document.getElementById('port-config-grid');
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const config = state.portConfig[i];

        const card = document.createElement('div');
        card.className = `port-config-card ${config.rdma ? 'rdma-active' : ''}`;
        card.innerHTML = `
            <h5>Port ${i + 1} 
                ${config.rdma ? '<span style="color:var(--accent-purple); font-size:16px;">⚡</span>' : ''}
            </h5>
            <div class="config-row">
                <span class="config-label">Speed</span>
                <select class="speed-select" onchange="updatePortConfig(${i}, 'speed', this.value)">
                    <option value="1GbE" ${config.speed === '1GbE' ? 'selected' : ''}>1 GbE</option>
                    <option value="10GbE" ${config.speed === '10GbE' ? 'selected' : ''}>10 GbE</option>
                    <option value="25GbE" ${config.speed === '25GbE' ? 'selected' : ''}>25 GbE</option>
                    <option value="100GbE" ${config.speed === '100GbE' ? 'selected' : ''}>100 GbE</option>
                </select>
            </div>
            <div class="config-row">
                <label class="rdma-check-container">
                    <input type="checkbox" class="rdma-checkbox" 
                        ${config.rdma ? 'checked' : ''} 
                        onchange="updatePortConfig(${i}, 'rdma', this.checked)">
                    <span class="rdma-label">RDMA Capable</span>
                </label>
            </div>
        `;
        container.appendChild(card);
    }
}

function updatePortConfig(index, key, value) {
    if (state.portConfig && state.portConfig[index]) {
        // Guardrail: enforce minimum RDMA-enabled ports (unless Low Capacity).
        // If the user attempts to disable RDMA and it would drop below the minimum, block the change.
        try {
            const requiredRdma = getRequiredRdmaPortCount();
            if (requiredRdma > 0 && (key === 'rdma' || key === 'rdmaMode')) {
                const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];
                const currentRdmaEnabled = cfg.filter(p => p && p.rdma === true).length;

                const isDisablingRdma =
                    (key === 'rdma' && value === false && state.portConfig[index].rdma === true) ||
                    (key === 'rdmaMode' && String(value) === 'Disabled' && state.portConfig[index].rdma === true);

                if (isDisablingRdma && (currentRdmaEnabled - 1) < requiredRdma) {
                    state.rdmaGuardMessage = '⚠ Not supported: At least ' + String(requiredRdma) + ' port(s) must remain RDMA capable unless you selected Low Capacity.';
                    updateUI();
                    return;
                }
            }
        } catch (e) {
            // ignore
        }

        state.portConfig[index][key] = value;

        // Keep RDMA fields coherent and treat Step 07 actions as authoritative.
        if (key === 'rdma') {
            state.portConfig[index].rdmaManual = true;
            if (value === false) {
                state.portConfig[index].rdmaMode = 'Disabled';
            } else {
                if (!state.portConfig[index].rdmaMode || state.portConfig[index].rdmaMode === 'Disabled') {
                    state.portConfig[index].rdmaMode = (state.scale === 'low_capacity') ? 'RoCEv2' : 'RoCEv2';
                }
            }
        }

        if (key === 'rdmaMode') {
            state.portConfig[index].rdmaManual = true;
            state.portConfig[index].rdma = (String(value) !== 'Disabled');
        }
        updateUI();
    }
}

updateUI();

function updateInfraNetwork() {
    const cidrInput = document.getElementById('infra-cidr');
    const startInput = document.getElementById('infra-ip-start');
    const endInput = document.getElementById('infra-ip-end');
    const gatewayInput = document.getElementById('infra-default-gateway');
    const err = document.getElementById('infra-ip-error');
    const succ = document.getElementById('infra-ip-success');
    const gwErr = document.getElementById('infra-gateway-error');
    const gwSucc = document.getElementById('infra-gateway-success');

    // Hide messages
    if (err) err.classList.add('hidden');
    if (succ) succ.classList.add('hidden');
    if (gwErr) gwErr.classList.add('hidden');
    if (gwSucc) gwSucc.classList.add('hidden');

    if (!startInput || !endInput) return;

    const cidr = cidrInput ? cidrInput.value.trim() : '';
    state.infraCidr = cidr || null;

    // If the field is cleared, allow auto-fill to resume.
    if (!cidr) {
        state.infraCidrAuto = true;
    }

    // DHCP: gateway isn't required/used for hosts/cluster IPs in this flow.
    if (gatewayInput && state.ip === 'dhcp') {
        gatewayInput.value = '';
        gatewayInput.disabled = true;
        state.infraGateway = null;
    } else if (gatewayInput) {
        gatewayInput.disabled = false;
    }

    const start = startInput.value.trim();
    const end = endInput.value.trim();

    const ipToLong = (ip) => {
        return ip.split('.').reduce((acc, octet) => {
            return (acc << 8) + parseInt(octet, 10);
        }, 0) >>> 0;
    };
    const longToIp = (n) => {
        return [
            (n >>> 24) & 0xFF,
            (n >>> 16) & 0xFF,
            (n >>> 8) & 0xFF,
            n & 0xFF
        ].join('.');
    };
    const reservedRanges = [
        { name: '10.96.0.0/12', min: ipToLong('10.96.0.0'), max: ipToLong('10.111.255.255') },
        { name: '10.244.0.0/16', min: ipToLong('10.244.0.0'), max: ipToLong('10.244.255.255') }
    ];

    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const hasRange = Boolean(start && end);
    let startL = null;
    let endL = null;
    let networkL = null;
    let broadcastL = null;

    // CIDR validation (if provided)
    if (cidr) {
        const cidrParts = cidr.split('/');
        const cidrIp = cidrParts[0];
        const prefixStr = cidrParts[1];

        const prefix = prefixStr !== undefined ? parseInt(prefixStr, 10) : NaN;
        if (cidrParts.length !== 2 || !ipv4Regex.test(cidrIp) || Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
            if (err) {
                err.innerText = 'Invalid CIDR format. Example: 192.168.1.0/24';
                err.classList.remove('hidden');
            }
            state.infra = null;
            return;
        }

        const reservedPattern = /^10\.(?:9[6-9]|10[0-9]|11[0-1])\./;
        const aksReservedPattern = /^10\.244\./;
        if (reservedPattern.test(cidrIp) || aksReservedPattern.test(cidrIp)) {
            if (err) {
                err.innerText = 'Infrastructure Network CIDR cannot overlap with reserved subnets 10.96.0.0/12 or 10.244.0.0/16.';
                err.classList.remove('hidden');
            }
            state.infra = null;
            return;
        }

        const cidrIpL = ipToLong(cidrIp);
        const mask = prefix === 0 ? 0 : ((0xFFFFFFFF << (32 - prefix)) >>> 0);
        networkL = (cidrIpL & mask) >>> 0;
        broadcastL = (networkL | ((~mask) >>> 0)) >>> 0;

        for (const r of reservedRanges) {
            if (networkL <= r.max && broadcastL >= r.min) {
                if (err) {
                    err.innerText = `Infrastructure Network CIDR overlaps with reserved subnet ${r.name}.`;
                    err.classList.remove('hidden');
                }
                state.infra = null;
                return;
            }
        }

        // Node IP containment validation
        // Requirement: Infrastructure network must include the node IPs configured in Step 12.
        // Only enforce when node settings are complete/valid to avoid double-reporting errors.
        try {
            ensureNodeSettingsInitialized();
        } catch (e) {
            // ignore
        }
        try {
            const nodeReadiness = (typeof getNodeSettingsReadiness === 'function') ? getNodeSettingsReadiness() : { ready: false };
            if (nodeReadiness && nodeReadiness.ready && Array.isArray(state.nodeSettings) && state.nodeSettings.length > 0) {
                const outside = [];
                for (let i = 0; i < state.nodeSettings.length; i++) {
                    const node = state.nodeSettings[i] || {};
                    const ipCidr = String(node.ipCidr || '').trim();
                    if (!isValidIpv4Cidr(ipCidr)) continue;
                    const nodeIp = extractIpFromCidr(ipCidr);
                    if (!ipv4Regex.test(nodeIp)) continue;
                    const nodeL = ipToLong(nodeIp);
                    const inHostRange = (nodeL > networkL && nodeL < broadcastL);
                    if (!inHostRange) {
                        const nodeLabel = String(node.name || '').trim() || `Node ${i + 1}`;
                        outside.push(`${nodeLabel} (${nodeIp})`);
                    }
                }

                if (outside.length) {
                    if (err) {
                        err.innerText = `Infrastructure network must include the nodes IPs. Outside ${cidr}: ${outside.join('; ')}`;
                        err.classList.remove('hidden');
                    }
                    state.infra = null;
                    return;
                }
            }
        } catch (e) {
            // ignore
        }

        // Auto-suggest Default Gateway as the first usable host IP in the CIDR.
        // - Only when Static IP is selected
        // - Only when user hasn't manually edited the gateway
        // - Prefer a gateway outside the reserved infra IP pool if the pool is already defined
        if (gatewayInput && !gatewayInput.disabled && state.ip === 'static' && !state.infraGatewayManual) {
            const usableCount = broadcastL - networkL - 1;
            if (usableCount >= 1) {
                let candidate = (networkL + 1) >>> 0;

                // If infra pool is already known, avoid placing the gateway inside the reserved pool range.
                // We intentionally scan up from the first usable host address.
                const hasPool = Boolean(start && end && ipv4Regex.test(start) && ipv4Regex.test(end));
                if (hasPool) {
                    const poolStart = ipToLong(start);
                    const poolEnd = ipToLong(end);
                    const firstHost = (networkL + 1) >>> 0;
                    const lastHost = (broadcastL - 1) >>> 0;

                    // If the preferred gateway is inside the pool, move to the first host outside the pool.
                    if (candidate >= poolStart && candidate <= poolEnd) {
                        let found = null;
                        for (let ipL = firstHost; ipL <= lastHost; ipL++) {
                            if (ipL < poolStart || ipL > poolEnd) {
                                found = ipL;
                                break;
                            }
                        }
                        if (found !== null) candidate = found;
                    }
                }

                gatewayInput.value = longToIp(candidate);
            }
        }

        if (hasRange) {
            if (!ipv4Regex.test(start) || !ipv4Regex.test(end)) {
                if (err) {
                    err.innerText = "Invalid IPv4 address format.";
                    err.classList.remove('hidden');
                }
                state.infra = null;
                return;
            }

            startL = ipToLong(start);
            endL = ipToLong(end);

            if (startL < networkL || endL > broadcastL) {
                if (err) {
                    err.innerText = `Starting/Ending IP must be within Infrastructure Network CIDR ${cidr}.`;
                    err.classList.remove('hidden');
                }
                state.infra = null;
                return;
            }
        }
    }

    // Read gateway after potential auto-fill
    const gateway = (gatewayInput && !gatewayInput.disabled) ? gatewayInput.value.trim() : '';

    if (!hasRange) {
        state.infra = null;
        updateSummary();
        return;
    }

    if (startL === null || endL === null) {
        if (!ipv4Regex.test(start) || !ipv4Regex.test(end)) {
            if (err) {
                err.innerText = "Invalid IPv4 address format.";
                err.classList.remove('hidden');
            }
            state.infra = null;
            return;
        }
        startL = ipToLong(start);
        endL = ipToLong(end);
    }

    if (endL < startL) {
        if (err) {
            err.innerText = "Ending IP must be greater than or equal to Starting IP.";
            err.classList.remove('hidden');
        }
        state.infra = null;
        return;
    }

    // Check Count >= 6
    const count = endL - startL + 1;
    if (count < 6) {
        if (err) {
            err.innerText = `Range too small. Minimum 6 IPs required (Current: ${count}).`;
            err.classList.remove('hidden');
        }
        state.infra = null;
        return;
    }

    // Infrastructure IP Pool must not include any node IPs (Step 12).
    // Only enforce when node settings are complete/valid to avoid noisy double-errors.
    try {
        const nodeReadiness = (typeof getNodeSettingsReadiness === 'function') ? getNodeSettingsReadiness() : { ready: false };
        if (nodeReadiness && nodeReadiness.ready && Array.isArray(state.nodeSettings) && state.nodeSettings.length > 0) {
            const offenders = [];
            for (let i = 0; i < state.nodeSettings.length; i++) {
                const node = state.nodeSettings[i] || {};
                const ipCidr = String(node.ipCidr || '').trim();
                if (!isValidIpv4Cidr(ipCidr)) continue;
                const nodeIp = extractIpFromCidr(ipCidr);
                if (!ipv4Regex.test(nodeIp)) continue;
                const nodeL = ipToLong(nodeIp);
                if (nodeL >= startL && nodeL <= endL) {
                    const nodeLabel = String(node.name || '').trim() || `Node ${i + 1}`;
                    offenders.push(`${nodeLabel} (${nodeIp})`);
                }
            }

            if (offenders.length) {
                if (err) {
                    err.innerText = `Infrastructure IP Pool range (${start} - ${end}) must not include any node IPs. Offenders: ${offenders.join('; ')}`;
                    err.classList.remove('hidden');
                }
                state.infra = null;
                return;
            }
        }
    } catch (e) {
        // ignore
    }

    // Check Overlaps
    for (let r of reservedRanges) {
        if (startL <= r.max && endL >= r.min) {
            if (err) {
                err.innerText = `Range overlaps with reserved subnet ${r.name}.`;
                err.classList.remove('hidden');
            }
            state.infra = null;
            return;
        }
    }

    // Valid
    state.infra = { start, end };
    if (succ) {
        succ.innerText = `✓ Valid Range (${count} IPs)`;
        succ.classList.remove('hidden');
    }

    // Default Gateway validation
    // - valid IPv4
    // - within Infra CIDR (requires CIDR)
    // - outside the reserved infra IP pool (start-end)
    if (state.ip === 'static') {
        if (!gateway) {
            state.infraGateway = null;
            if (gwErr) {
                gwErr.innerText = 'Default Gateway is required for Static IP.';
                gwErr.classList.remove('hidden');
            }
        } else if (!ipv4Regex.test(gateway)) {
            state.infraGateway = null;
            if (gwErr) {
                gwErr.innerText = 'Invalid Default Gateway format. Example: 192.168.1.1';
                gwErr.classList.remove('hidden');
            }
        } else if (!cidr || networkL === null || broadcastL === null) {
            state.infraGateway = null;
            if (gwErr) {
                gwErr.innerText = 'Provide a valid Infrastructure Network (CIDR) to validate Default Gateway.';
                gwErr.classList.remove('hidden');
            }
        } else {
            const gwL = ipToLong(gateway);
            if (gwL < networkL || gwL > broadcastL) {
                state.infraGateway = null;
                if (gwErr) {
                    gwErr.innerText = `Default Gateway must be within Infrastructure Network CIDR ${cidr}.`;
                    gwErr.classList.remove('hidden');
                }
            } else if (gwL === networkL || gwL === broadcastL) {
                state.infraGateway = null;
                if (gwErr) {
                    gwErr.innerText = `Default Gateway cannot be the network or broadcast address for ${cidr} (for example .0 or .255 in a /24).`;
                    gwErr.classList.remove('hidden');
                }
            } else {
                const infraStartL = ipToLong(start);
                const infraEndL = ipToLong(end);
                if (gwL >= infraStartL && gwL <= infraEndL) {
                    state.infraGateway = null;
                    if (gwErr) {
                        gwErr.innerText = `Default Gateway must be outside the Infrastructure IP Pool range (${start} - ${end}).`;
                        gwErr.classList.remove('hidden');
                    }
                } else {
                    // Must not overlap with any node IPs.
                    try {
                        const nodeReadiness = (typeof getNodeSettingsReadiness === 'function') ? getNodeSettingsReadiness() : { ready: false };
                        if (nodeReadiness && nodeReadiness.ready && Array.isArray(state.nodeSettings) && state.nodeSettings.length > 0) {
                            const nodeIps = new Set();
                            for (let i = 0; i < state.nodeSettings.length; i++) {
                                const ipCidr = String((state.nodeSettings[i] || {}).ipCidr || '').trim();
                                if (!isValidIpv4Cidr(ipCidr)) continue;
                                const nodeIp = extractIpFromCidr(ipCidr);
                                if (nodeIp) nodeIps.add(nodeIp);
                            }
                            if (nodeIps.has(gateway)) {
                                state.infraGateway = null;
                                if (gwErr) {
                                    gwErr.innerText = 'Default Gateway must not be one of the node IP addresses.';
                                    gwErr.classList.remove('hidden');
                                }
                                updateSummary();
                                updateUI();
                                return;
                            }
                        }
                    } catch (e) {
                        // ignore
                    }

                    state.infraGateway = gateway;
                    if (gwSucc) {
                        gwSucc.classList.remove('hidden');
                    }
                }
            }
        }
    } else {
        // DHCP or not selected
        state.infraGateway = null;
    }

    updateSummary();
    updateUI();
}

function markInfraCidrManual(value) {
    const v = String(value || '').trim();
    // If cleared, allow auto-fill to resume.
    state.infraCidrAuto = v.length === 0;
}

function markInfraGatewayManual(value) {
    // If the user clears the field, allow auto-fill again.
    const v = (value || '').trim();
    state.infraGatewayManual = v.length > 0;
}

function updateInfraVlanId() {
    const input = document.getElementById('infra-vlan-id');
    if (!input) return;

    const raw = input.value.trim();
    if (!raw) {
        state.infraVlanId = null;
        input.setCustomValidity('');
        updateSummary();
        return;
    }

    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 4096) {
        state.infraVlanId = null;
        input.setCustomValidity('Enter a VLAN ID between 1 and 4096.');
    } else {
        state.infraVlanId = value;
        input.setCustomValidity('');
    }
    input.reportValidity();
    updateSummary();
}

function applyInfraVlanVisibility() {
    const vlanInfo = document.getElementById('infra-vlan-info');
    const vlanCustom = document.getElementById('infra-vlan-custom');
    const vlanInput = document.getElementById('infra-vlan-id');

    if (!state.ip || !state.infraVlan) {
        if (vlanInfo) {
            vlanInfo.classList.add('hidden');
            vlanInfo.classList.remove('visible');
        }
        if (vlanCustom) {
            vlanCustom.classList.add('hidden');
            vlanCustom.classList.remove('visible');
        }
        if (vlanInput) {
            vlanInput.value = '';
            vlanInput.setCustomValidity('');
        }
        state.infraVlanId = null;
        return;
    }

    if (state.infraVlan === 'custom') {
        if (vlanInfo) {
            vlanInfo.classList.remove('hidden');
            vlanInfo.classList.add('visible');
        }
        if (vlanCustom) {
            vlanCustom.classList.remove('hidden');
            vlanCustom.classList.add('visible');
        }
    } else {
        if (vlanInfo) {
            vlanInfo.classList.add('hidden');
            vlanInfo.classList.remove('visible');
        }
        if (vlanCustom) {
            vlanCustom.classList.add('hidden');
            vlanCustom.classList.remove('visible');
        }
        if (vlanInput) {
            vlanInput.value = '';
            vlanInput.setCustomValidity('');
        }
        state.infraVlanId = null;
    }
}

function resetAll() {
    state.scenario = null;
    state.region = null;
    state.localInstanceRegion = null;
    state.scale = null;
    state.nodes = null;
    state.ports = null;
    state.storage = null;
    state.intent = null;
    state.outbound = null;
    state.arc = null;
    state.proxy = null;
    state.ip = null;
    state.infra = null;
    state.infraCidr = null;
    state.infraCidrAuto = true;
    state.infraGateway = null;
    state.infraGatewayManual = false;
    state.infraVlan = null;
    state.infraVlanId = null;
    state.storageAutoIp = null;
    state.activeDirectory = null;
    state.adDomain = null;
    state.adOuPath = null;
    state.adfsServerName = null;
    state.dnsServers = [];
    state.localDnsZone = null;
    state.dnsServiceExisting = null;
    state.sdnFeatures = [];
    state.sdnManagement = null;
    state.customIntents = {};

    const cidrInput = document.getElementById('infra-cidr');
    const startInput = document.getElementById('infra-ip-start');
    const endInput = document.getElementById('infra-ip-end');
    const gwInput = document.getElementById('infra-default-gateway');
    if (cidrInput) cidrInput.value = '';
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    if (gwInput) { gwInput.value = ''; gwInput.disabled = false; }

    const localDnsZoneInput = document.getElementById('local-dns-zone-input');
    if (localDnsZoneInput) localDnsZoneInput.value = '';

    try {
        const yes = document.querySelector('input[name="dns-service-existing"][value="yes"]');
        const no = document.querySelector('input[name="dns-service-existing"][value="no"]');
        if (yes) yes.checked = true;
        if (no) no.checked = false;
    } catch (e) {
        // ignore
    }

    const adDomainInput = document.getElementById('ad-domain');
    const adOuPathInput = document.getElementById('ad-ou-path');
    const adfsServerInput = document.getElementById('adfs-server-name');
    const adDomainSection = document.getElementById('ad-domain-section');
    if (adDomainInput) adDomainInput.value = '';
    if (adOuPathInput) adOuPathInput.value = '';
    if (adfsServerInput) adfsServerInput.value = '';
    if (adDomainSection) adDomainSection.classList.add('hidden');

    const infraVlanIdInput = document.getElementById('infra-vlan-id');
    if (infraVlanIdInput) infraVlanIdInput.value = '';

    const dnsSection = document.getElementById('dns-config-section');
    if (dnsSection) dnsSection.classList.add('hidden');

    const dnsTitle = document.getElementById('dns-config-title');
    if (dnsTitle) dnsTitle.classList.remove('hidden');

    const sdnSection = document.getElementById('sdn-management-section');
    if (sdnSection) sdnSection.classList.add('hidden');

    document.querySelectorAll('.sdn-feature-card input[type="checkbox"]').forEach(cb => cb.checked = false);

    renderDnsServers();

    const ids = ['infra-ip-error', 'infra-ip-success', 'infra-gateway-error', 'infra-gateway-success', 'china-warning', 'proxy-warning', 'dhcp-warning', 'ip-subnet-warning', 'multirack-message'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.classList.remove('visible');
        }
    });

    updateUI();
}

function addDnsServer() {
    state.dnsServers.push('');
    renderDnsServers();
}

function removeDnsServer(index) {
    state.dnsServers.splice(index, 1);
    renderDnsServers();
    validateAllDnsServers();
}

function updateDnsServer(index, value) {
    state.dnsServers[index] = value.trim();
    validateAllDnsServers();
}

function renderDnsServers() {
    const container = document.getElementById('dns-servers-container');
    if (!container) return;

    container.innerHTML = '';

    state.dnsServers.forEach((server, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; gap:0.5rem; align-items:center; margin-bottom:0.75rem;';

        const isLocalIdentity = state.activeDirectory === 'local_identity';
        const labelText = isLocalIdentity
            ? ('DNS server' + (index === 0 ? ' <span style="color:#ef4444;">*</span>' : ''))
            : (`DNS Server ${index + 1}`);

        div.innerHTML = `
            <div style="flex:1;">
                <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">${labelText}</label>
                <input type="text" 
                    value="${server}" 
                    placeholder="e.g. 192.168.1.1"
                    pattern="^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
                    title="Enter a valid IPv4 address"
                    style="width:100%; padding:0.75rem; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); color:white; border-radius:4px;"
                    onchange="updateDnsServer(${index}, this.value)">
            </div>
            ${state.dnsServers.length > 1 ? `
                <button onclick="removeDnsServer(${index})" 
                    style="padding:0.75rem; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.5); color:#ef4444; border-radius:4px; cursor:pointer; margin-top:1.5rem;">
                    ✕
                </button>
            ` : ''}
        `;

        container.appendChild(div);
    });
}

function updateDnsServiceExistingNote() {
    try {
        const note = document.getElementById('dns-service-existing-note');
        if (!note) return;

        // Only relevant for Local Identity.
        if (state.activeDirectory !== 'local_identity') {
            note.textContent = '';
            return;
        }

        if (state.dnsServiceExisting === false) {
            note.textContent = 'If No is selected, a Local DNS Server will be installed on the nodes and configured to use the DNS server as a forwarder to resolve external names.';
            return;
        }

        // Default to the "Yes" explanation.
        note.textContent = 'If Yes is selected, an external DNS server is already configured and there is no need to deploy a Local DNS server on Azure Local nodes.';
    } catch (e) {
        // ignore
    }
}

function updateDnsServiceExisting(value) {
    // This selection is currently informational for the wizard UX.
    // Keep state for reporting/future logic without changing required-field rules.
    state.dnsServiceExisting = (String(value) === 'yes');
    updateDnsServiceExistingNote();
    updateSummary();
}

function validateAllDnsServers() {
    const err = document.getElementById('dns-error');
    const succ = document.getElementById('dns-success');

    if (err) err.classList.add('hidden');
    if (succ) succ.classList.add('hidden');

    // Filter out empty servers
    const validServers = state.dnsServers.filter(s => s && s.trim());

    if (validServers.length === 0) {
        updateSummary();
        return;
    }

    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    // Validate format
    for (let server of validServers) {
        if (!ipv4Regex.test(server)) {
            if (err) {
                err.innerText = `Invalid DNS server format: ${server}`;
                err.classList.remove('hidden');
            }
            return;
        }
    }

    // Helper: IP to Long
    const ipToLong = (ip) => {
        return ip.split('.').reduce((acc, octet) => {
            return (acc << 8) + parseInt(octet, 10);
        }, 0) >>> 0;
    };

    // Check AKS reserved subnets overlap
    const ranges = [
        { name: '10.96.0.0/12', min: 174063616, max: 175112191 },
        { name: '10.244.0.0/16', min: 183762944, max: 183828479 }
    ];

    for (let server of validServers) {
        const serverL = ipToLong(server);

        for (let r of ranges) {
            if (serverL >= r.min && serverL <= r.max) {
                if (err) {
                    err.innerText = `DNS server ${server} overlaps with reserved AKS subnet ${r.name}.`;
                    err.classList.remove('hidden');
                }
                return;
            }
        }
    }

    // Check Infrastructure Network overlap (Step 12)
    if (state.infra && state.infra.start && state.infra.end) {
        const infraStartL = ipToLong(state.infra.start);
        const infraEndL = ipToLong(state.infra.end);

        for (let server of validServers) {
            const serverL = ipToLong(server);

            if (serverL >= infraStartL && serverL <= infraEndL) {
                if (err) {
                    err.innerText = `DNS server ${server} cannot be within the Infrastructure Network range (${state.infra.start} - ${state.infra.end}).`;
                    err.classList.remove('hidden');
                }
                return;
            }
        }
    }

    // Valid
    if (succ) {
        succ.innerText = `✓ ${validServers.length} DNS server(s) configured`;
        succ.classList.remove('hidden');
    }

    updateSummary();
}

function updateLocalDnsZone() {
    const input = document.getElementById('local-dns-zone-input');
    if (input) {
        state.localDnsZone = input.value.trim() || null;
        updateSummary();
    }
}

function updateAdDomain() {
    const input = document.getElementById('ad-domain');
    if (!input) return;

    const value = input.value.trim();
    state.adDomain = value || null;
    
    // Revalidate OU path when domain changes
    const ouPathInput = document.getElementById('ad-ou-path');
    if (ouPathInput && ouPathInput.value.trim() !== '') {
        updateAdOuPath();
    }
    
    updateSummary();
}

function validateAdOuPath(ouPath, domainName) {
    if (!ouPath || ouPath.trim() === '') {
        return { valid: true, error: '' }; // Empty is valid (optional field)
    }
    
    // Basic OU path validation: must contain OU= and DC= components
    const ouPathPattern = /^(OU=[^,]+,)*(CN=[^,]+,)*(OU=[^,]+,)*DC=[^,]+(,DC=[^,]+)*$/i;
    
    if (!ouPathPattern.test(ouPath.trim())) {
        return { 
            valid: false, 
            error: 'Invalid OU path format. Must follow pattern: OU=...,DC=...,DC=... (e.g., OU=Cluster1,OU=AzureLocal,DC=contoso,DC=com)' 
        };
    }
    
    // Validate that OU path matches the domain name
    if (domainName && domainName.trim() !== '') {
        // Convert domain name to DC components (e.g., "contoso.com" -> "DC=contoso,DC=com")
        const domainParts = domainName.trim().split('.');
        const expectedDcSuffix = domainParts.map(part => `DC=${part}`).join(',');
        
        // Extract DC components from OU path (everything after the last OU= or CN=)
        const ouPathUpper = ouPath.trim().toUpperCase();
        const dcMatch = ouPathUpper.match(/DC=[^,]+(,DC=[^,]+)*$/i);
        
        if (dcMatch) {
            const actualDcSuffix = dcMatch[0];
            if (actualDcSuffix.toUpperCase() !== expectedDcSuffix.toUpperCase()) {
                return {
                    valid: false,
                    error: `OU path does not match the domain name. Expected to end with: ${expectedDcSuffix}`
                };
            }
        }
    }
    
    return { valid: true, error: '' };
}

function updateAdOuPath() {
    const input = document.getElementById('ad-ou-path');
    const errorDiv = document.getElementById('ad-ou-path-error');
    if (!input) return;

    const value = input.value.trim();
    const domainName = state.adDomain || '';
    const validation = validateAdOuPath(value, domainName);
    
    if (validation.valid) {
        state.adOuPath = value || null;
        if (errorDiv) {
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
        }
    } else {
        state.adOuPath = null;
        if (errorDiv) {
            errorDiv.classList.remove('hidden');
            errorDiv.textContent = validation.error;
        }
    }
    
    updateSummary();
}

function updateAdfsServerName() {
    const input = document.getElementById('adfs-server-name');
    if (!input) return;

    const value = input.value.trim();
    state.adfsServerName = value || null;
    updateSummary();
}

function updateSecuritySetting(settingName, value) {
    if (state.securitySettings && settingName in state.securitySettings) {
        state.securitySettings[settingName] = value;
        updateSummary();
        saveStateToLocalStorage();
    }
}

function isWitnessTypeLocked() {
    // Rack Aware clusters must use Cloud witness
    if (state.scale === 'rack_aware') {
        return true;
    }
    
    // 2-node clusters (Standard/Medium or Low Capacity) must use Cloud witness
    if (state.nodes === '2' && (state.scale === 'medium' || state.scale === 'low_capacity')) {
        return true;
    }
    
    return false;
}

function updateWitnessType() {
    const locked = isWitnessTypeLocked();
    
    if (locked) {
        // For locked scenarios, always set to Cloud
        state.witnessType = 'Cloud';
    } else if (state.nodes) {
        // For all other node counts, default to NoWitness
        state.witnessType = 'NoWitness';
    } else {
        state.witnessType = null;
    }
    
    updateUI();
}

function toggleSdnFeature(feature, checked) {
    if (checked) {
        if (!state.sdnFeatures.includes(feature)) {
            state.sdnFeatures.push(feature);
        }
    } else {
        state.sdnFeatures = state.sdnFeatures.filter(f => f !== feature);
    }

    updateSdnManagementOptions();
    updateSummary();
    
    // Auto-save state after any update
    saveStateToLocalStorage();
}

function updateSdnManagementOptions() {
    const managementSection = document.getElementById('sdn-management-section');
    const arcCard = document.getElementById('sdn-arc-card');
    const onpremCard = document.getElementById('sdn-onprem-card');
    const infoText = document.getElementById('sdn-info-text');

    if (!managementSection || !arcCard || !onpremCard || !infoText) return;

    // Show management section if any features are selected
    if (state.sdnFeatures.length > 0) {
        managementSection.classList.remove('hidden');

        const hasVnet = state.sdnFeatures.includes('vnet');
        const hasSlb = state.sdnFeatures.includes('slb');
        const hasLnet = state.sdnFeatures.includes('lnet');
        const hasNsg = state.sdnFeatures.includes('nsg');

        // Logic: LNET and/or NSG only -> Arc management enabled
        // VNET and/or SLB -> On-premises management only
        const onlyLnetNsg = (hasLnet || hasNsg) && !hasVnet && !hasSlb;
        const hasVnetOrSlb = hasVnet || hasSlb;

        if (onlyLnetNsg) {
            // Enable Arc, disable On-premises
            arcCard.classList.remove('disabled');
            onpremCard.classList.add('disabled');
            infoText.innerHTML = '<strong>SDN Managed by Arc</strong><br>' +
                'With SDN enabled by Azure Arc, the Network Controller runs as a Failover Cluster service and integrates with the Azure Arc control plane. ' +
                'This allows you to centrally configure and manage logical networks (LNET) and network security groups (NSG) via the Azure portal and Azure CLI. ' +
                'Currently, only LNET and NSG are supported with Arc management as this is a newer approach available with Azure Local 2506 or later. ' +
                'Virtual Networks (VNET) and Software Load Balancers (SLB) require the full SDN infrastructure components.';

            // Reset if on-prem was selected
            if (state.sdnManagement === 'onprem_managed') {
                state.sdnManagement = null;
                onpremCard.classList.remove('selected');
            }
        } else if (hasVnetOrSlb) {
            // Enable On-premises, disable Arc
            arcCard.classList.add('disabled');
            onpremCard.classList.remove('disabled');
            infoText.innerHTML = '<strong>SDN Managed by On-Premises Tools</strong><br>' +
                'Virtual Networks (VNET) and Software Load Balancers (SLB) require the full SDN infrastructure with Network Controller, SLB, and Gateway components running on VMs. ' +
                'These advanced features must be deployed and managed using on-premises tools like Windows Admin Center or SDN Express scripts. ' +
                'This approach provides complete SDN functionality including switching, routing, and load balancing capabilities, ' +
                'but requires additional infrastructure components beyond what Arc-managed SDN currently supports.';

            // Reset if Arc was selected
            if (state.sdnManagement === 'arc_managed') {
                state.sdnManagement = null;
                arcCard.classList.remove('selected');
            }
        } else {
            // No features selected or invalid combination
            arcCard.classList.add('disabled');
            onpremCard.classList.add('disabled');
            infoText.textContent = 'Select SDN features above to see available management options.';
        }
    } else {
        // No features selected, hide management section
        managementSection.classList.add('hidden');
        state.sdnManagement = null;
        arcCard.classList.remove('selected');
        onpremCard.classList.remove('selected');
    }
}

// ============================================================================
// ENHANCED FEATURES - Export/Import, Validation, Help, etc.
// ============================================================================

// Export configuration as JSON
function exportConfiguration() {
    try {
        const defaultFilename = `azure-local-config-${new Date().toISOString().split('T')[0]}.json`;
        
        // Show prompt for filename
        const filename = prompt('Enter filename for the exported configuration:', defaultFilename);
        
        // User cancelled
        if (filename === null) return;
        
        // Use default if empty, then sanitize for safe filename
        const rawFilename = filename.trim() || defaultFilename;
        const sanitizedFilename = sanitizeInput(rawFilename, 'filename');
        // Ensure .json extension
        const safeFilename = sanitizedFilename.endsWith('.json') ? sanitizedFilename : sanitizedFilename + '.json';
        
        // Inform user if filename was changed during sanitization
        const intendedFilename = rawFilename.endsWith('.json') ? rawFilename : rawFilename + '.json';
        if (safeFilename !== intendedFilename) {
            const proceed = confirm(
                'Some characters in the filename were adjusted for safety.\n\n' +
                'The configuration will be saved as:\n' +
                safeFilename +
                '\n\nDo you want to continue?'
            );
            if (!proceed) {
                showToast('Export cancelled', 'info');
                return;
            }
        }
        
        const config = {
            version: WIZARD_VERSION,
            exportedAt: new Date().toISOString(),
            state: state
        };
        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Configuration exported successfully!', 'success');
    } catch (e) {
        showToast('Failed to export configuration', 'error');
        console.error('Export error:', e);
    }
}

// Import configuration from JSON
function importConfiguration() {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (!imported.state) {
                        showToast('Invalid configuration file', 'error');
                        return;
                    }
                    
                    // Track changes if there was previous state
                    const hadPreviousState = Object.keys(state).some(k => state[k] != null);
                    const changes = [];
                    
                    if (hadPreviousState) {
                        Object.keys(imported.state).forEach(key => {
                            if (JSON.stringify(state[key]) !== JSON.stringify(imported.state[key])) {
                                changes.push(key);
                            }
                        });
                    }
                    
                    // Apply imported state
                    Object.assign(state, imported.state);
                    updateUI();
                    saveStateToLocalStorage();
                    
                    if (changes.length > 0) {
                        showToast(`Configuration imported! Changed: ${changes.length} fields`, 'success', 5000);
                    } else {
                        showToast('Configuration imported successfully!', 'success');
                    }
                } catch (err) {
                    showToast('Failed to parse configuration file', 'error');
                    console.error('Import error:', err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    } catch (e) {
        showToast('Failed to import configuration', 'error');
        console.error('Import error:', e);
    }
}

// Show resume prompt on page load if saved state exists
function checkForSavedState() {
    const saved = loadStateFromLocalStorage();
    if (!saved || !saved.data) return;
    
    const timestamp = saved.timestamp ? new Date(saved.timestamp).toLocaleString() : 'Unknown time';
    const banner = document.createElement('div');
    banner.id = 'resume-banner';
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
    `;
    
    banner.innerHTML = `
        <div style="flex: 1;">
            <div style="font-weight: 700; margin-bottom: 4px;">Previous Session Found</div>
            <div style="font-size: 12px; opacity: 0.9;">Last saved: ${escapeHtml(timestamp)}</div>
        </div>
        <button onclick="resumeSavedState()" style="padding: 8px 16px; background: white; color: #2563eb; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Resume</button>
        <button onclick="dismissResumeBanner()" style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Start Fresh</button>
    `;
    
    document.body.appendChild(banner);
}

function resumeSavedState() {
    const saved = loadStateFromLocalStorage();
    if (saved && saved.data) {
        Object.assign(state, saved.data);
        
        // Restore SDN feature checkboxes
        if (state.sdnFeatures && state.sdnFeatures.length > 0) {
            state.sdnFeatures.forEach(feature => {
                const checkbox = document.querySelector(`.sdn-feature-card[data-feature="${feature}"] input[type="checkbox"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        // Restore SDN management selection
        if (state.sdnManagement) {
            const card = document.getElementById(state.sdnManagement === 'arc_managed' ? 'sdn-arc-card' : 'sdn-onprem-card');
            if (card) card.classList.add('selected');
        }
        
        // Update SDN management options visibility
        updateSdnManagementOptions();
        
        updateUI();
        showToast('Session resumed successfully!', 'success');
    }
    dismissResumeBanner();
}

function dismissResumeBanner() {
    const banner = document.getElementById('resume-banner');
    if (banner) {
        banner.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => banner.remove(), 300);
    }
}

// Enhanced validation with real-time feedback
function validateFieldRealtime(field, value, type) {
    let isValid = false;
    let message = '';
    
    switch (type) {
        case 'netbios':
            isValid = isValidNetbiosName(value);
            message = isValid ? '' : 'Must be 1-15 chars, alphanumeric and hyphens only';
            break;
        case 'ipv4cidr':
            isValid = isValidIpv4Cidr(value);
            message = isValid ? '' : 'Must be valid IPv4 CIDR (e.g., 192.168.1.0/24)';
            break;
        case 'ipv4':
            const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            isValid = ipv4Regex.test(value);
            message = isValid ? '' : 'Must be valid IPv4 address';
            break;
        case 'domain':
            isValid = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(value);
            message = isValid ? '' : 'Must be valid domain name';
            break;
        case 'vlan':
            const vlanNum = parseInt(value, 10);
            isValid = Number.isFinite(vlanNum) && vlanNum >= 1 && vlanNum <= 4094;
            message = isValid ? '' : 'Must be between 1 and 4094';
            break;
    }
    
    // Show inline feedback
    const feedback = field.nextElementSibling;
    if (feedback && feedback.classList.contains('validation-feedback')) {
        feedback.textContent = message;
        feedback.style.color = isValid ? '#10b981' : '#ef4444';
        feedback.style.display = message ? 'block' : 'none';
    }
    
    return isValid;
}

// Add inline validation feedback elements
function addValidationFeedback(inputElement, type) {
    if (!inputElement) return;
    
    const existing = inputElement.nextElementSibling;
    if (existing && existing.classList.contains('validation-feedback')) return;
    
    const feedback = document.createElement('div');
    feedback.className = 'validation-feedback';
    feedback.style.cssText = 'font-size: 12px; margin-top: 4px; min-height: 16px;';
    inputElement.parentNode.insertBefore(feedback, inputElement.nextSibling);
    
    inputElement.addEventListener('input', () => {
        validateFieldRealtime(inputElement, inputElement.value.trim(), type);
    });
    
    inputElement.addEventListener('blur', () => {
        validateFieldRealtime(inputElement, inputElement.value.trim(), type);
    });
}

// IP conversion utilities for CIDR calculator
function ipToLong(ip) {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function longToIp(long) {
    return [
        (long >>> 24) & 0xFF,
        (long >>> 16) & 0xFF,
        (long >>> 8) & 0xFF,
        long & 0xFF
    ].join('.');
}

// CIDR Calculator Helper
function showCidrCalculator() {
    const overlay = document.createElement('div');
    overlay.id = 'cidr-calculator-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
    `;
    
    const calculator = document.createElement('div');
    calculator.style.cssText = `
        background: var(--card-bg);
        border: 1px solid var(--glass-border);
        border-radius: 16px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    calculator.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; color: var(--accent-blue);">CIDR Calculator</h3>
            <button onclick="document.getElementById('cidr-calculator-overlay').remove()" style="background: transparent; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-weight: 600;">IP Address / CIDR</label>
            <input type="text" id="cidr-input" placeholder="e.g., 192.168.1.0/24" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 8px; color: var(--text-primary); font-family: 'Courier New', monospace;">
        </div>
        
        <div id="cidr-results" style="padding: 16px; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 8px; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.6;"></div>
    `;
    
    overlay.appendChild(calculator);
    document.body.appendChild(overlay);
    
    const input = document.getElementById('cidr-input');
    const results = document.getElementById('cidr-results');
    
    input.addEventListener('input', () => {
        const value = input.value.trim();
        if (!isValidIpv4Cidr(value)) {
            results.innerHTML = '<div style="color: var(--text-secondary);">Enter a valid CIDR notation</div>';
            return;
        }
        
        const [ip, prefixStr] = value.split('/');
        const prefix = parseInt(prefixStr, 10);
        const ipLong = ipToLong(ip);
        const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
        const network = (ipLong & mask) >>> 0;
        const broadcast = (network | (~mask & 0xFFFFFFFF)) >>> 0;
        const firstHost = (network + 1) >>> 0;
        const lastHost = (broadcast - 1) >>> 0;
        const hostCount = broadcast - network - 1;
        
        results.innerHTML = `
            <div style="margin-bottom: 8px;"><strong style="color: var(--accent-blue);">Network:</strong> ${longToIp(network)}</div>
            <div style="margin-bottom: 8px;"><strong style="color: var(--accent-blue);">Netmask:</strong> ${longToIp(mask)}</div>
            <div style="margin-bottom: 8px;"><strong style="color: var(--accent-blue);">Broadcast:</strong> ${longToIp(broadcast)}</div>
            <div style="margin-bottom: 8px;"><strong style="color: var(--accent-blue);">First Host:</strong> ${longToIp(firstHost)}</div>
            <div style="margin-bottom: 8px;"><strong style="color: var(--accent-blue);">Last Host:</strong> ${longToIp(lastHost)}</div>
            <div><strong style="color: var(--accent-blue);">Usable Hosts:</strong> ${hostCount.toLocaleString()}</div>
        `;
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// Help tooltip system
function showHelp(topic) {
    const helpContent = {
        'netbios': {
            title: 'NetBIOS Computer Name',
            content: 'A NetBIOS name is used to identify computers on a local network. It must be 1-15 characters long and can contain letters, numbers, and hyphens (but cannot start or end with a hyphen).'
        },
        'rdma': {
            title: 'RDMA (Remote Direct Memory Access)',
            content: 'RDMA allows direct memory access from one computer to another without involving the CPU or operating system, enabling high-throughput, low-latency networking. Essential for storage traffic in Azure Local.'
        },
        'tor': {
            title: 'ToR Switches (Top-of-Rack)',
            content: 'Physical network switches typically located at the top of a server rack. They provide network connectivity for all devices in that rack and connect to the core network infrastructure.'
        },
        'vlan': {
            title: 'VLAN (Virtual Local Area Network)',
            content: 'VLANs segment network traffic at Layer 2. VLAN IDs range from 1-4094, with some reserved ranges. Azure Local uses VLANs to separate management, storage, and compute traffic.'
        },
        'cidr': {
            title: 'CIDR Notation',
            content: 'Classless Inter-Domain Routing notation represents IP addresses and their routing prefix. Format: xxx.xxx.xxx.xxx/yy where /yy is the prefix length (1-32). Example: 192.168.1.0/24'
        },
        'sdn': {
            title: 'SDN (Software-Defined Networking)',
            content: 'SDN separates the network control plane from the data plane, enabling centralized network management through software. Azure Local SDN provides features like virtual networks, load balancing, and network security groups.'
        }
    };
    
    const info = helpContent[topic];
    if (!info) return;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
    `;
    
    overlay.innerHTML = `
        <div style="background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; max-width: 500px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; color: var(--accent-blue);">${escapeHtml(info.title)}</h3>
                <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" style="background: transparent; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <p style="color: var(--text-primary); line-height: 1.6; margin: 0;">${escapeHtml(info.content)}</p>
        </div>
    `;
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    
    document.body.appendChild(overlay);
}

// Cost estimator (basic framework)
// Show changelog/what's new
function showChangelog() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
    `;
    
    overlay.innerHTML = `
        <div style="background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--accent-blue);">What's New</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: transparent; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            
            <div style="color: var(--text-primary); line-height: 1.8;">
                <div style="margin-bottom: 24px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-left: 4px solid var(--accent-blue); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-blue);">Version 0.4.2 - Latest Release</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 17, 2025</div>
                </div>
                
                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📋 Example Configuration Templates</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Renamed Button & Modal:</strong> "Load Configuration Template" → "Load Example Configuration Template" for clarity.</li>
                        <li><strong>Complete Templates:</strong> All 5 templates now include ALL required wizard settings (witnessType, proxy, securityConfiguration, activeDirectory).</li>
                        <li><strong>Fixed Disconnected Template:</strong> Now correctly uses local_identity and NoWitness for air-gapped scenarios.</li>
                        <li><strong>Improved Descriptions:</strong> Updated template descriptions to be more informative about use cases.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.4.1</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 17, 2025</div>
                </div>
                
                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📋 Updates & Fixes</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Disclaimer Notice:</strong> Added disclaimer informing users this tool is provided as-is without Microsoft support.</li>
                        <li><strong>Updated Description:</strong> Streamlined the main description text.</li>
                        <li><strong>Report Page Title:</strong> Fixed title to use "Odin for Azure Local" branding.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.4.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 16, 2025</div>
                </div>
                
                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🚀 ARM Parameters - Deployment Automation</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Deployment Script Generation:</strong> Generate PowerShell and Azure CLI deployment scripts with one click.</li>
                        <li><strong>Parameter Input Fields:</strong> Editable fields for Subscription ID, Resource Group, and Deployment Name.</li>
                        <li><strong>Auto-Update Parameters:</strong> Parameters JSON updates in real-time as you fill in the fields.</li>
                        <li><strong>Bicep/Terraform Guidance:</strong> Modal showing IaC alternatives with conversion instructions.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.3.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 16, 2025</div>
                </div>
                
                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🎨 User Experience Enhancements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Font Size Controls:</strong> Adjust text size with A+ and A- buttons (4 size options: small, medium, large, x-large).</li>
                        <li><strong>Dark/Light Theme Toggle:</strong> Switch between dark and light themes instantly.</li>
                        <li><strong>Step Progress Indicators:</strong> Green checkmarks (✓) show completed configuration steps.</li>
                        <li><strong>Configuration Templates:</strong> 5 pre-built templates for common deployment scenarios.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">📚 Documentation & Branding</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Tool Rebranding:</strong> Now called "Odin for Azure Local" (Optimal Deployment and Infrastructure Navigator).</li>
                        <li><strong>Firewall Requirements Link:</strong> Direct access to firewall and endpoint documentation in Outbound Connectivity step.</li>
                        <li><strong>M365 Local Guidance:</strong> Selecting M365 Local deployment type shows documentation link.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--success); margin: 0 0 12px 0;">🔧 Fixes & Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Rack Aware Restriction:</strong> Local Identity option is now properly disabled for Rack Aware deployments.</li>
                    </ul>
                </div>
                
                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-blue); margin: 0 0 12px 0;">📋 Configuration Templates Included</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li>2-Node Standard Cluster (small production with cloud witness)</li>
                        <li>4-Node High Performance (medium cluster with dedicated storage)</li>
                        <li>8-Node Rack Aware (large rack-aware production cluster)</li>
                        <li>Disconnected 2-Node (air-gapped with Active Directory)</li>
                        <li>Edge 2-Node Switchless (cost-optimized edge deployment)</li>
                    </ul>
                </div>
                        <li><strong>Documentation Links:</strong> Direct links to Microsoft Learn for security features and best practices.</li>
                        <li><strong>Enhanced Validation:</strong> All new configuration options included in readiness checks.</li>
                    </ul>
                </div>

                <div style="margin-bottom: 24px; padding: 16px; background: rgba(139, 92, 246, 0.1); border-left: 4px solid var(--accent-purple); border-radius: 4px;">
                    <h4 style="margin: 0 0 8px 0; color: var(--accent-purple);">Version 0.1.0</h4>
                    <div style="font-size: 13px; color: var(--text-secondary);">December 2025</div>
                </div>

                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🎉 Major Enhancements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Auto-Save & Resume:</strong> Your progress is automatically saved. Return anytime and pick up where you left off.</li>
                        <li><strong>Export/Import Configuration:</strong> Save your configuration as JSON and share it with your team or restore it later.</li>
                        <li><strong>CIDR Calculator:</strong> Built-in subnet calculator to help with IP address planning.</li>
                    </ul>
                </div>
                
                <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--glass-border);">
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">✨ User Experience</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Real-time Validation:</strong> Instant feedback on input fields with helpful error messages.</li>
                        <li><strong>Contextual Help:</strong> Click help icons throughout for detailed explanations.</li>
                        <li><strong>Toast Notifications:</strong> Clear feedback for actions like copy, export, and import.</li>
                        <li><strong>Improved Accessibility:</strong> Enhanced keyboard navigation and screen reader support.</li>
                    </ul>
                </div>
                
                <div>
                    <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">🔧 Technical Improvements</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>Enhanced Input Sanitization:</strong> Improved security for all user inputs.</li>
                        <li><strong>Version Tracking:</strong> All exports and saves include version information.</li>
                        <li><strong>Change Detection:</strong> See what changed when importing configurations.</li>
                        <li><strong>Better Error Handling:</strong> More informative error messages throughout.</li>
                    </ul>
                </div>
            </div>
            
            <div style="margin-top: 24px; padding: 16px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; text-align: center;">
                <div style="font-size: 14px; color: var(--accent-blue); margin-bottom: 8px;">Need Help?</div>
                <a href="https://github.com/Azure/AzureLocal-Supportability" target="_blank" style="color: var(--accent-blue); text-decoration: none; font-weight: 600;">View Documentation →</a>
            </div>
        </div>
    `;
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    
    document.body.appendChild(overlay);
}

// Show comparison view for different options
function showComparison(category) {
    const comparisons = {
        'storage': {
            title: 'Storage Connectivity Comparison',
            options: [
                {
                    name: 'Switched Storage',
                    pros: ['Scalable to 16+ nodes', 'Standard ToR switch infrastructure', 'Flexible network topology', 'Easier to troubleshoot'],
                    cons: ['Requires ToR switches', 'Higher initial cost', 'More complex cabling'],
                    useCases: ['Large clusters (5+ nodes)', 'Production environments', 'Growth planned'],
                    recommended: 'For most deployments'
                },
                {
                    name: 'Switchless Storage',
                    pros: ['Lower cost (no storage switches)', 'Simpler cabling', 'Direct node-to-node connections', 'Reduced latency'],
                    cons: ['Limited to 2-4 nodes', 'Point-to-point cabling complexity', 'Less flexible for expansion'],
                    useCases: ['Small clusters (2-4 nodes)', 'Edge deployments', 'Cost-sensitive projects'],
                    recommended: 'For small, stable deployments'
                }
            ]
        },
        'intent': {
            title: 'Network Intent Comparison',
            options: [
                {
                    name: 'Compute + Management',
                    pros: ['Simplest configuration', 'Minimal adapters (2)', 'Lower cost', 'Easy to manage'],
                    cons: ['Shared bandwidth', 'No storage isolation', 'Limited performance'],
                    useCases: ['Small workloads', 'Non-production', 'Budget-constrained'],
                    recommended: 'For testing and development'
                },
                {
                    name: 'Compute + Storage',
                    pros: ['Balanced approach', 'Dedicated storage', 'Good performance', '4+ adapters'],
                    cons: ['More complex than Compute+Mgmt', 'More adapters required', 'Higher cost than basic'],
                    useCases: ['Production workloads', 'Most deployments', 'Performance-sensitive apps'],
                    recommended: 'For most production environments'
                },
                {
                    name: 'All Traffic (Converged)',
                    pros: ['All traffic types', 'Single intent', 'Simplified config'],
                    cons: ['Shared bandwidth', 'Contention possible', 'Less isolation'],
                    useCases: ['Small clusters', 'Simple deployments', 'Testing'],
                    recommended: 'For simple, small deployments'
                }
            ]
        },
        'outbound': {
            title: 'Outbound Connectivity Comparison',
            options: [
                {
                    name: 'Direct Internet',
                    pros: ['Simple configuration', 'No proxy needed', 'Best performance', 'Easiest troubleshooting'],
                    cons: ['Requires firewall rules', 'Direct exposure', 'Less control'],
                    useCases: ['Standard deployments', 'No proxy infrastructure', 'Cloud-native environments'],
                    recommended: 'When no proxy required'
                },
                {
                    name: 'Corporate Proxy',
                    pros: ['Centralized control', 'Traffic inspection', 'Compliance friendly', 'Existing infrastructure'],
                    cons: ['Proxy configuration needed', 'Bypass lists required', 'Potential latency', 'More complex troubleshooting'],
                    useCases: ['Enterprise environments', 'Regulated industries', 'Existing proxy infrastructure'],
                    recommended: 'For corporate deployments'
                }
            ]
        },
        'arc': {
            title: 'Azure Arc Gateway Comparison',
            options: [
                {
                    name: 'Arc Gateway Enabled',
                    pros: ['Reduced public endpoints', 'Enhanced security', 'Centralized management', 'Simplified firewall rules'],
                    cons: ['Additional component', 'Slightly more complex', 'Requires Arc Gateway resource'],
                    useCases: ['Security-focused', 'Limited internet egress', 'Multiple clusters'],
                    recommended: 'For enhanced security'
                },
                {
                    name: 'Arc Gateway Disabled',
                    pros: ['Simpler configuration', 'Direct Azure connection', 'One less component', 'Lower complexity'],
                    cons: ['More public endpoints', 'More firewall rules needed', 'Less centralized'],
                    useCases: ['Simple deployments', 'Unrestricted internet', 'Single clusters'],
                    recommended: 'For standard deployments'
                }
            ]
        }
    };
    
    const comparison = comparisons[category];
    if (!comparison) return;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
        overflow-y: auto;
        padding: 20px;
    `;
    
    let optionsHtml = '';
    comparison.options.forEach(option => {
        optionsHtml += `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                <h4 style="color: var(--accent-purple); margin: 0 0 12px 0;">${escapeHtml(option.name)}</h4>
                
                <div style="margin-bottom: 12px;">
                    <strong style="color: #10b981;">✓ Pros:</strong>
                    <ul style="margin: 6px 0 0 20px; padding: 0;">
                        ${option.pros.map(pro => `<li style="margin: 4px 0; color: var(--text-primary);">${escapeHtml(pro)}</li>`).join('')}
                    </ul>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <strong style="color: #ef4444;">✗ Cons:</strong>
                    <ul style="margin: 6px 0 0 20px; padding: 0;">
                        ${option.cons.map(con => `<li style="margin: 4px 0; color: var(--text-primary);">${escapeHtml(con)}</li>`).join('')}
                    </ul>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <strong style="color: var(--accent-blue);">📌 Use Cases:</strong>
                    <ul style="margin: 6px 0 0 20px; padding: 0;">
                        ${option.useCases.map(uc => `<li style="margin: 4px 0; color: var(--text-primary);">${escapeHtml(uc)}</li>`).join('')}
                    </ul>
                </div>
                
                <div style="padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; color: var(--accent-blue); font-size: 13px;">
                    <strong>💡 Recommended:</strong> ${escapeHtml(option.recommended)}
                </div>
            </div>
        `;
    });
    
    overlay.innerHTML = `
        <div style="background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; max-width: 900px; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--accent-blue);">${escapeHtml(comparison.title)}</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: transparent; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            
            <div style="color: var(--text-primary); line-height: 1.6;">
                ${optionsHtml}
            </div>
        </div>
    `;
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    
    document.body.appendChild(overlay);
}

function showTemplates() {
    const templates = [
        {
            name: '2-Node Standard Cluster',
            description: 'Small production cluster with cloud witness, ideal for branch offices',
            config: {
                scenario: 'hyperconverged',
                region: 'azure_commercial',
                localInstanceRegion: 'east_us',
                scale: 'standard',
                nodes: 2,
                witnessType: 'Cloud',
                ports: 4,
                storage: 'switched',
                storagePoolConfiguration: 'Express',
                intent: 'storage_compute',
                outbound: 'public',
                arc: 'yes',
                proxy: 'no_proxy',
                ip: 'dhcp',
                infraVlan: 'default',
                activeDirectory: 'azure_ad',
                securityConfiguration: 'recommended'
            }
        },
        {
            name: '4-Node High Performance',
            description: 'Medium cluster with dedicated storage network for production workloads',
            config: {
                scenario: 'hyperconverged',
                region: 'azure_commercial',
                localInstanceRegion: 'east_us',
                scale: 'standard',
                nodes: 4,
                witnessType: 'Cloud',
                ports: 4,
                storage: 'switched',
                storagePoolConfiguration: 'Express',
                intent: 'storage_compute',
                outbound: 'public',
                arc: 'yes',
                proxy: 'no_proxy',
                ip: 'static',
                infraVlan: 'default',
                activeDirectory: 'azure_ad',
                securityConfiguration: 'recommended'
            }
        },
        {
            name: '8-Node Rack Aware',
            description: 'Large rack-aware cluster for production with high availability',
            config: {
                scenario: 'hyperconverged',
                region: 'azure_commercial',
                localInstanceRegion: 'east_us',
                scale: 'rack_aware',
                nodes: 8,
                rackAwareZones: 2,
                witnessType: 'Cloud',
                ports: 4,
                storage: 'switched',
                storagePoolConfiguration: 'Express',
                intent: 'storage_compute',
                outbound: 'public',
                arc: 'yes',
                proxy: 'no_proxy',
                ip: 'static',
                infraVlan: 'default',
                activeDirectory: 'azure_ad',
                securityConfiguration: 'recommended'
            }
        },
        {
            name: 'Disconnected 2-Node',
            description: 'Air-gapped deployment with local identity for secure environments',
            config: {
                scenario: 'disconnected',
                region: 'azure_commercial',
                localInstanceRegion: 'east_us',
                scale: 'standard',
                nodes: 2,
                witnessType: 'NoWitness',
                ports: 4,
                storage: 'switched',
                storagePoolConfiguration: 'Express',
                intent: 'storage_compute',
                outbound: 'air_gapped',
                arc: 'no_arc',
                proxy: 'no_proxy',
                ip: 'static',
                infraVlan: 'default',
                activeDirectory: 'local_identity',
                securityConfiguration: 'recommended'
            }
        },
        {
            name: 'Edge 2-Node Switchless',
            description: 'Cost-optimized edge deployment without storage switches',
            config: {
                scenario: 'hyperconverged',
                region: 'azure_commercial',
                localInstanceRegion: 'east_us',
                scale: 'low_capacity',
                nodes: 2,
                witnessType: 'Cloud',
                ports: 2,
                storage: 'switchless',
                switchlessLinkMode: 'full_mesh',
                storagePoolConfiguration: 'Express',
                intent: 'compute_management',
                outbound: 'public',
                arc: 'yes',
                proxy: 'no_proxy',
                ip: 'dhcp',
                infraVlan: 'default',
                activeDirectory: 'azure_ad',
                securityConfiguration: 'recommended'
            }
        }
    ];

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; backdrop-filter: blur(4px);';

    const templatesHtml = templates.map((template, index) => `
        <div onclick="loadTemplate(${index})" style="padding: 16px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(59, 130, 246, 0.1)'; this.style.borderColor='rgba(59, 130, 246, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.03)'; this.style.borderColor='var(--glass-border)'">
            <h4 style="margin: 0 0 8px 0; color: var(--accent-blue);">${escapeHtml(template.name)}</h4>
            <p style="margin: 0; color: var(--text-secondary); font-size: 13px;">${escapeHtml(template.description)}</p>
            <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px;">
                <span style="padding: 2px 8px; background: rgba(59, 130, 246, 0.2); border-radius: 4px; color: var(--accent-blue);">${template.config.nodes} nodes</span>
                <span style="padding: 2px 8px; background: rgba(139, 92, 246, 0.2); border-radius: 4px; color: var(--accent-purple);">${template.config.scale}</span>
                <span style="padding: 2px 8px; background: rgba(16, 185, 129, 0.2); border-radius: 4px; color: var(--success);">${template.config.storage}</span>
            </div>
        </div>
    `).join('');

    overlay.innerHTML = `
        <div style="background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; max-width: 700px; width: 100%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: var(--accent-blue);">📋 Example Configuration Templates</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: transparent; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            
            <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px;">
                Select a pre-configured example template to quickly set up common deployment scenarios. These templates include all required settings.
            </p>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${templatesHtml}
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);

    // Store templates globally for loadTemplate function
    window.configTemplates = templates;
}

function loadTemplate(templateIndex) {
    if (!window.configTemplates || !window.configTemplates[templateIndex]) return;
    
    const template = window.configTemplates[templateIndex];
    const config = template.config;

    // Apply configuration
    Object.keys(config).forEach(key => {
        if (state.hasOwnProperty(key)) {
            state[key] = config[key];
        }
    });

    // Trigger UI updates for each selection in logical step order
    if (config.scenario) selectOption('scenario', config.scenario);
    if (config.region) selectOption('region', config.region);
    if (config.localInstanceRegion) selectOption('localInstanceRegion', config.localInstanceRegion);
    if (config.scale) selectOption('scale', config.scale);
    if (config.nodes) selectOption('nodes', config.nodes);
    if (config.witnessType) selectOption('witnessType', config.witnessType);
    if (config.ports) selectOption('ports', config.ports);
    if (config.storage) selectOption('storage', config.storage);
    if (config.switchlessLinkMode) selectOption('switchlessLinkMode', config.switchlessLinkMode);
    if (config.storagePoolConfiguration) selectOption('storagePoolConfiguration', config.storagePoolConfiguration);
    if (config.intent) selectOption('intent', config.intent);
    if (config.outbound) selectOption('outbound', config.outbound);
    if (config.arc) selectOption('arc', config.arc);
    if (config.proxy) selectOption('proxy', config.proxy);
    if (config.ip) selectOption('ip', config.ip);
    if (config.infraVlan) selectOption('infraVlan', config.infraVlan);
    if (config.activeDirectory) selectOption('activeDirectory', config.activeDirectory);
    if (config.securityConfiguration) selectOption('securityConfiguration', config.securityConfiguration);

    // Close the modal
    document.querySelectorAll('div').forEach(el => {
        if (el.style.position === 'fixed' && el.style.zIndex === '10000') {
            el.remove();
        }
    });

    // Show success message
    showNotification('✅ Template loaded successfully!', 'success');
    
    // Save state
    saveStateToLocalStorage();
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(59, 130, 246, 0.9)'};
        color: white;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10001;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showM365LocalInfo() {
    const m365Msg = document.getElementById('m365local-message');
    const steps = Array.from(document.querySelectorAll('.step')).filter(s => s.id !== 'step-1');
    const summaryPanel = document.getElementById('summary-panel');
    
    // Hide all steps except step-1
    steps.forEach(s => s && s.classList.add('hidden'));
    
    // Show M365 Local message
    if (m365Msg) {
        m365Msg.classList.remove('hidden');
        m365Msg.classList.add('visible');
    }
    
    // Hide summary panel
    if (summaryPanel) summaryPanel.classList.add('hidden');
    
    // Keep M365 Local option visually selected
    document.querySelectorAll('.option-card').forEach(card => {
        const clickFn = card.getAttribute('onclick') || '';
        if (!clickFn.includes("selectOption('scenario'")) return;
        const value = card.getAttribute('data-value');
        if (value === 'm365local') card.classList.add('selected');
        else card.classList.remove('selected');
    });
}

// Initialize enhanced features on page load
document.addEventListener('DOMContentLoaded', function() {
    // Apply saved theme and font size
    applyTheme();
    applyFontSize();
    
    // Check for saved state
    setTimeout(checkForSavedState, 500);
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideDown {
            from { transform: translate(-50%, -100%); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideUp {
            from { transform: translate(-50%, 0); opacity: 1; }
            to { transform: translate(-50%, -100%); opacity: 0; }
        }
        
        .help-icon {
            display: inline-block;
            width: 16px;
            height: 16px;
            background: var(--accent-blue);
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 16px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            margin-left: 6px;
            transition: all 0.2s ease;
        }
        
        .help-icon:hover {
            background: var(--accent-purple);
            transform: scale(1.1);
        }
        
        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
        }
        
        .comparison-table th,
        .comparison-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--glass-border);
        }
        
        .comparison-table th {
            background: rgba(59, 130, 246, 0.1);
            color: var(--accent-blue);
            font-weight: 600;
        }
        
        .comparison-table td {
            color: var(--text-primary);
        }
        
        .validation-feedback {
            font-size: 12px;
            margin-top: 4px;
            min-height: 16px;
        }
    `;
    document.head.appendChild(style);
});
