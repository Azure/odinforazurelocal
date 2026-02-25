// Odin for Azure Local - version for tracking changes
const WIZARD_VERSION = '0.17.10';
const WIZARD_STATE_KEY = 'azureLocalWizardState';
const WIZARD_TIMESTAMP_KEY = 'azureLocalWizardTimestamp';

// ============================================================================
// TAB NAVIGATION MODULE
// ============================================================================
// Handles switching between different ODIN tabs (Designer, Knowledge, Sizer)
// ============================================================================

/**
 * Switch between ODIN tabs
 * @param {string} tabId - The tab identifier ('designer', 'knowledge', 'sizer')
 */
function switchOdinTab(tabId) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.odin-tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    const tabContents = document.querySelectorAll('.odin-tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });

    const targetContent = document.getElementById(`tab-${tabId}`);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    // Save current tab to session storage for persistence during page session
    sessionStorage.setItem('odinActiveTab', tabId);
}

// Restore active tab on page load (if navigating back)
document.addEventListener('DOMContentLoaded', function() {
    const savedTab = sessionStorage.getItem('odinActiveTab');
    if (savedTab && savedTab !== 'knowledge') {
        // Knowledge tab navigates away, so don't try to switch to it
        switchOdinTab(savedTab);
    }

    // Make all option-cards keyboard accessible
    document.querySelectorAll('.option-card').forEach(card => {
        if (!card.hasAttribute('tabindex')) {
            card.setAttribute('tabindex', '0');
        }
        // Allow Enter/Space to select the card
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
    });
});

// ============================================================================
// NOTE: Firebase Analytics Module has been moved to js/analytics.js
// ============================================================================

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
    portConfig: null,
    portConfigConfirmed: false,
    storage: null,
    torSwitchCount: null, // 'single' or 'dual' - only for Storage Switched + Hyperconverged/Low Capacity
    switchlessLinkMode: null,
    storagePoolConfiguration: null,
    rackAwareZones: null,
    rackAwareZonesConfirmed: false,
    rackAwareZoneSwapSelection: null,
    rackAwareTorsPerRoom: null,
    rackAwareTorArchitecture: null,
    intent: null,
    customIntentConfirmed: false,
    fqdnConfirmed: false,
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
    customStorageSubnets: [], // User-defined storage subnets when Storage Auto IP is disabled
    customStorageSubnetsConfirmed: false, // Confirmation state for custom storage subnets
    activeDirectory: null,
    adDomain: null,
    adOuPath: null,
    adfsServerName: null,
    dnsServers: [],
    localDnsZone: null,
    dnsServiceExisting: null,
    sdnEnabled: null,
    sdnFeatures: [],
    sdnManagement: null,
    intentOverrides: {},
    customIntents: {},
    adapterMapping: {},
    adapterMappingConfirmed: false,
    adapterMappingSelection: null,
    overridesConfirmed: false,
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
    rdmaGuardMessage: null,
    privateEndpoints: null, // 'pe_enabled' or 'pe_disabled'
    privateEndpointsList: [], // Array of selected PE services: 'keyvault', 'storage', 'acr', 'asr', 'backup', 'sql', 'defender'
    sizerHardware: null // Hidden: hardware config imported from Sizer (CPU, memory, disks, workload summary)
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

// ============================================================================
// NOTE: The following functions have been moved to modular files:
// - escapeHtml, sanitizeInput, formatNumber, capitalize → js/utils.js
// - isValidNetbiosName, isValidIpv4Cidr, isValidCidrFormat → js/utils.js
// - extractIpFromCidr, extractPrefixFromCidr → js/utils.js
// - ipv4ToInt, intToIpv4, prefixToMask, ipToLong, longToIp → js/utils.js
// - incrementCidrThirdOctet → js/utils.js
// - showToast, reportUiError, showNotification → js/notifications.js
// - copyToClipboard, fallbackCopyToClipboard → js/notifications.js
// - FIREBASE_CONFIG, analytics, initializeAnalytics → js/analytics.js
// - trackPageView, trackFormCompletion, fetchAndDisplayStats → js/analytics.js
// - increaseFontSize, decreaseFontSize, applyFontSize → js/theme.js
// - toggleTheme, applyTheme → js/theme.js
// ============================================================================

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
    add('Private Endpoints', Boolean(state.privateEndpoints));
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

    // Update missing sections display
    updateMissingSectionsDisplay();
}

// NOTE: getPortDisplayName() moved to js/formatting.js

// Mapping of missing item labels to step IDs for navigation
const missingSectionToStep = {
    'Deployment Type': 'step-1',
    'Scenario must not be Multi-Rack (report is not available for Multi-Rack flow)': 'step-1',
    'Azure Cloud': 'step-cloud',
    'Azure Local Instance Region': 'step-local-region',
    'Scale': 'step-2',
    'Cluster Scale': 'step-2',
    'Nodes': 'step-3',
    'Cloud Witness Type': 'step-3-5',
    'Local availability zones': 'step-3-5',
    'ToR switches per room': 'step-3-5',
    'ToR switch architecture': 'step-3-5',
    'TOR switch architecture': 'step-3-5',
    'Storage Connectivity': 'step-4',
    'Ports': 'step-5',
    'Storage Pool Configuration': 'step-5-5',
    'Traffic Intent': 'step-6',
    'Outbound Connectivity': 'step-7',
    'Azure Arc Gateway': 'step-8',
    'Arc Gateway': 'step-8',
    'Proxy': 'step-9',
    'Private Endpoints': 'step-9b',
    'IP Assignment': 'step-10',
    'Default Gateway': 'step-12',
    'Node Names/IPs': 'step-10',
    'Infrastructure VLAN': 'step-11',
    'Infrastructure VLAN ID': 'step-11',
    'Infrastructure CIDR': 'step-12',
    'Infrastructure IP Pool': 'step-12',
    'Identity (Active Directory / Local Identity)': 'step-13',
    'Identity Selection': 'step-13',
    'Active Directory Domain Name': 'step-13',
    'AD Domain': 'step-13',
    'DNS Servers': 'step-13',
    'DNS Servers must be private IPs (RFC 1918) for Active Directory': 'step-13',
    'Local DNS Zone': 'step-13',
    'Local DNS Zone Name': 'step-13',
    'Security Configuration': 'step-13-5',
    'SDN Enabled/Disabled': 'step-14',
    'SDN Features': 'step-14',
    'SDN Management': 'step-14',
    'Confirm Autonomous Cloud FQDN': 'step-fqdn',
    'Confirm adapter mapping for Custom intent': 'step-6',
    'RDMA: At least': 'step-5',
    'Duplicate adapter names': 'step-5',
    'RDMA mapping': 'step-6',
    'Custom mapping': 'step-6',
    'Mgmt + Compute mapping': 'step-6'
};

function updateMissingSectionsDisplay() {
    const container = document.getElementById('missing-sections-container');
    const list = document.getElementById('missing-sections-list');
    if (!container || !list) return;

    const readiness = getReportReadiness();

    if (readiness.ready) {
        container.style.display = 'none';
        return;
    }

    // Show container and populate list
    container.style.display = 'block';
    list.innerHTML = '';

    readiness.missing.forEach((item, index) => {
        const stepId = findStepForMissingItem(item);
        const link = document.createElement('a');
        link.href = '#' + stepId;
        link.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: rgba(255, 255, 255, 0.05); border-radius: 6px; color: var(--text-primary); text-decoration: none; font-size: 0.85rem; transition: all 0.2s;';
        link.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span>${escapeHtml(item)}</span>
        `;
        link.onclick = (e) => {
            e.preventDefault();
            scrollToStep(stepId);
        };
        link.onmouseover = () => {
            link.style.background = 'rgba(59, 130, 246, 0.2)';
            link.style.color = 'var(--accent-blue)';
        };
        link.onmouseout = () => {
            link.style.background = 'rgba(255, 255, 255, 0.05)';
            link.style.color = 'var(--text-primary)';
        };
        list.appendChild(link);
    });
}

function findStepForMissingItem(item) {
    // Exact match first
    if (missingSectionToStep[item]) {
        return missingSectionToStep[item];
    }
    // Pattern match for Node X Name and Node X IP (CIDR)
    if (/^Node \d+ Name$/i.test(item) || /^Node \d+ IP/i.test(item) || item === 'Node names must be unique' || item === 'Node IPs must be unique') {
        return 'step-10';
    }
    // Pattern match for DNS server validation messages
    if (/^DNS server/i.test(item)) {
        return 'step-13';
    }
    // Partial match for RDMA messages and others
    for (const key in missingSectionToStep) {
        if (item.includes(key) || key.includes(item)) {
            return missingSectionToStep[key];
        }
    }
    // Default to step-1 if no match found
    return 'step-1';
}

function scrollToStep(stepId) {
    const step = document.getElementById(stepId);
    if (step) {
        step.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Flash highlight the step
        step.style.transition = 'box-shadow 0.3s ease';
        step.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)';
        setTimeout(() => {
            step.style.boxShadow = '';
        }, 2000);
    }
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

    // Disconnected: require confirmed Autonomous Cloud FQDN
    if (state.scenario === 'disconnected' && state.clusterRole && !state.fqdnConfirmed) {
        missing.push('Confirm Autonomous Cloud FQDN');
    }

    if (!state.region) missing.push('Azure Cloud');
    if (!state.localInstanceRegion) missing.push('Azure Local Instance Region');
    if (!state.scale) missing.push('Scale');
    // Note: 'Nodes' check is handled by getNodeSettingsReadiness() to avoid duplication
    if (!state.witnessType) missing.push('Cloud Witness Type');

    if (state.scale === 'rack_aware') {
        const z = state.rackAwareZones;
        if (!(z && z.zone1Name && z.zone2Name && z.assignments && state.rackAwareZonesConfirmed)) {
            missing.push('Local availability zones');
        }
        if (!state.rackAwareTorsPerRoom) missing.push('ToR switches per room');
        if (!state.rackAwareTorArchitecture) missing.push('ToR switch architecture');
    }
    // Storage connectivity type selection (switched vs switchless) - single-node always uses switched (implicit)
    if (!state.storage && state.nodes !== '1') missing.push('Storage Connectivity');
    if (!state.ports) missing.push('Ports');
    if (!state.storagePoolConfiguration) missing.push('Storage Pool Configuration');
    if (!state.intent) missing.push('Traffic Intent');
    if (!state.outbound) missing.push('Outbound Connectivity');
    if (!state.arc) missing.push('Azure Arc Gateway');
    if (!state.proxy) missing.push('Proxy');
    if (!state.privateEndpoints) missing.push('Private Endpoints');
    if (!state.ip) missing.push('IP Assignment');

    // Static IP deployments require a default gateway.
    // If the DOM field is populated but state was not synced (e.g. after resume/load),
    // pull the value from the field to avoid a stale "missing" entry.
    if (state.ip === 'static') {
        if (!state.infraGateway) {
            try {
                const gwInput = document.getElementById('infra-default-gateway');
                const gwVal = gwInput ? gwInput.value.trim() : '';
                if (gwVal && /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(gwVal)) {
                    state.infraGateway = gwVal;
                    state.infraGatewayManual = true;
                }
            } catch (e) { /* ignore */ }
        }
        if (!state.infraGateway) missing.push('Default Gateway');
    }

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
        if (!state.dnsServers || state.dnsServers.length <= 0) {
            missing.push('DNS Servers');
        } else {
            const validDnsServers = state.dnsServers.filter(s => s && s.trim());
            // Reject network (.0) and broadcast (.255) DNS addresses
            for (const server of validDnsServers) {
                if (typeof isLastOctetNetworkOrBroadcast === 'function') {
                    const check = isLastOctetNetworkOrBroadcast(server);
                    if (check === 'network') {
                        missing.push(`DNS server ${server} cannot be a network address (.0)`);
                        break;
                    }
                    if (check === 'broadcast') {
                        missing.push(`DNS server ${server} cannot be a broadcast address (.255)`);
                        break;
                    }
                }
            }
            if (state.activeDirectory === 'azure_ad') {
                // RFC 1918 validation - AD mode requires private DNS servers
                for (const server of validDnsServers) {
                    if (!isRfc1918Ip(server)) {
                        missing.push('DNS Servers must be private IPs (RFC 1918) for Active Directory');
                        break;
                    }
                }
            }
        }
        if (state.activeDirectory === 'local_identity' && !state.localDnsZone) missing.push('Local DNS Zone Name');
    }

    // Security Configuration
    if (!state.securityConfiguration) {
        missing.push('Security Configuration');
    }

    // SDN: user must select enabled or disabled; if enabled, features and management required
    if (!state.sdnEnabled) {
        missing.push('SDN Enabled/Disabled');
    } else if (state.sdnEnabled === 'yes') {
        if (!state.sdnFeatures || state.sdnFeatures.length === 0) {
            missing.push('SDN Features');
        }
        if (!state.sdnManagement) {
            missing.push('SDN Management');
        }
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

    // Step 07: Validate no duplicate adapter names
    try {
        const duplicates = getDuplicateAdapterNameIndices();
        if (duplicates.size > 0) {
            missing.push('Duplicate adapter names: Each port must have a unique name (Step 07)');
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
            // For rack_aware scenarios with mgmt_compute intent, RDMA is allowed (but not required) on Mgmt & Compute ports.
            const isRackAware = state.scale === 'rack_aware';
            const allowMgmtComputeOnRdmaPorts =
                (isStandard && state.intent === 'mgmt_compute' && allRdma) ||
                (isRackAware && state.intent === 'mgmt_compute');
            // Custom intent: RDMA can be enabled on non-Storage adapters (e.g., Compute).
            const nonStorageRdma = (state.intent === 'custom')
                ? []
                : (allowMgmtComputeOnRdmaPorts ? [] : rdmaEnabledIndices.filter(i => !storageSet.has(i)));
            const requiredRdma = getRequiredRdmaPortCount();
            const rdmaOnStorage = rdmaEnabledIndices.filter(i => storageSet.has(i)).length;

            // Custom intent helper: do not allow assigning Storage traffic to non-RDMA adapters.
            // Exception: Low Capacity scenarios do not require RDMA for storage intent.
            if (state.intent === 'custom' && requiredRdma > 0) {
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

    // Prefer Mgmt+Compute on non-RDMA ports (applies to all scales including Low Capacity).
    // If there are at least 2 non-RDMA ports, assign them to Mgmt+Compute so RDMA
    // ports stay available for Storage traffic.
    if (nonRdma.length >= 2) {
        const mgmtCompute = nonRdma.slice(0, 2);
        const mgmtComputeSet = new Set(mgmtCompute);
        const storage = indices.filter(n => !mgmtComputeSet.has(n));
        return {
            mgmtCompute,
            storage,
            allRdma: false,
            valid: true,
            reason: ''
        };
    }

    // Fewer than 2 non-RDMA ports — fall back to fixed Pair 1 / Pair 2+ model.
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

    // If adapter mapping is confirmed, use it to determine storage NICs
    if (state.adapterMappingConfirmed && state.adapterMapping && Object.keys(state.adapterMapping).length > 0) {
        const out = [];
        for (let i = 1; i <= p; i++) {
            const assignment = state.adapterMapping[i] || 'pool';
            const carriesStorage = (assignment === 'storage' || assignment === 'compute_storage' || assignment === 'all');
            if (carriesStorage) out.push(i);
        }
        return out;
    }

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

// ============================================================================
// NOTE: IP/CIDR utility functions have been moved to js/utils.js
// - isValidNetbiosName, isValidIpv4Cidr, isValidCidrFormat
// - extractIpFromCidr, extractPrefixFromCidr
// - ipv4ToInt, intToIpv4, prefixToMask
// ============================================================================

// Maximum SAM Account name length for computer accounts in Active Directory is 15 characters.
const MAX_NODE_NAME_LENGTH = 15;

/**
 * Parse a node name into base prefix and numeric suffix.
 * E.g., "customname01" → { base: "customname", num: 1, padding: 2 }
 *       "node5"        → { base: "node", num: 5, padding: 1 }
 *       "myserver"     → { base: "myserver", num: null, padding: 0 }
 */
function parseNodeNamePattern(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { base: '', num: null, padding: 0 };

    // Match trailing digits.
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (!match) {
        return { base: trimmed, num: null, padding: 0 };
    }

    const base = match[1];
    const numStr = match[2];
    const num = parseInt(numStr, 10);
    const padding = numStr.length;

    return { base, num, padding };
}

/**
 * Generate a node name from base, number, and padding.
 * Respects the MAX_NODE_NAME_LENGTH limit.
 */
function generateNodeName(base, num, padding) {
    const numStr = String(num).padStart(padding, '0');
    let name = base + numStr;

    // Truncate if necessary to fit within MAX_NODE_NAME_LENGTH.
    if (name.length > MAX_NODE_NAME_LENGTH) {
        // Try to truncate the base to fit.
        const maxBaseLen = MAX_NODE_NAME_LENGTH - numStr.length;
        if (maxBaseLen > 0) {
            name = base.substring(0, maxBaseLen) + numStr;
        } else {
            // Number alone exceeds limit; just truncate the whole thing.
            name = name.substring(0, MAX_NODE_NAME_LENGTH);
        }
    }

    return name;
}

/**
 * Auto-fill Node 2..N names based on Node 1's naming pattern.
 * If Node 1 is "customname01", fills Node 2 as "customname02", Node 3 as "customname03", etc.
 * Only fills empty node name fields or default placeholder names; never overwrites user-provided values.
 */
function tryAutoFillSequentialNodeNamesFromFirst() {
    const count = getNumericNodeCount();
    if (!count || count < 2) return;
    if (!Array.isArray(state.nodeSettings) || state.nodeSettings.length < 2) return;

    const first = state.nodeSettings[0] || {};
    const firstName = String(first.name || '').trim();
    if (!firstName) return;

    const { base, num, padding } = parseNodeNamePattern(firstName);

    // Determine padding: use existing padding, or if no number was present, use minimal padding.
    const effectivePadding = num !== null ? padding : 1;

    for (let i = 1; i < count; i++) {
        const cur = state.nodeSettings[i] || {};
        const curVal = String(cur.name || '').trim();

        // Only fill empty fields or default placeholder names (e.g., "node2", "node3").
        const defaultName = `node${i + 1}`;
        const isDefault = !curVal || curVal === defaultName || curVal.toLowerCase() === defaultName.toLowerCase();
        if (!isDefault) continue;

        const newNum = (num !== null) ? (num + i) : (i + 1);
        const newName = generateNodeName(base, newNum, effectivePadding);

        // Validate the generated name.
        if (newName && newName.length <= MAX_NODE_NAME_LENGTH && isValidNetbiosName(newName)) {
            state.nodeSettings[i].name = newName;
        }
    }
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

    // Convenience: if the user sets Node 1 name, auto-fill remaining empty node names sequentially.
    if (index === 0) {
        tryAutoFillSequentialNodeNamesFromFirst();
    }

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
                    title="SAM Account name (max 15 chars). Enter Node 1 name with a number suffix (e.g. server01) to auto-fill other nodes."
                    style="width:100%; padding:0.75rem; background:var(--subtle-bg); border:1px solid var(--glass-border); color:var(--text-primary); border-radius:4px;"
                    onchange="updateNodeName(${i}, this.value)">
            </div>
            <div style="flex:1; min-width:220px;">
                <label style="display:block; margin-bottom:0.5rem; font-size:0.9rem;">Node ${i + 1} IP (CIDR)</label>
                <input type="text" value="${escapeHtml(node.ipCidr)}" placeholder="e.g. 192.168.1.${10 + i}/24"
                    title="IPv4 CIDR (e.g. 192.168.1.10/24). Must be unique across nodes."
                    style="width:100%; padding:0.75rem; background:var(--subtle-bg); border:1px solid var(--glass-border); color:var(--text-primary); border-radius:4px;"
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
            if (names.has(key)) missing.push('Node names must be unique');
            names.add(key);
        }

        if (!isValidIpv4Cidr(ipCidr)) {
            missing.push(`Node ${i + 1} IP (CIDR)`);
        } else {
            const ip = extractIpFromCidr(ipCidr);
            const prefix = extractPrefixFromCidr(ipCidr);
            const addrType = isNetworkOrBroadcastAddress(ip, prefix);
            if (addrType === 'network') {
                missing.push(`Node ${i + 1} IP is a network address (host portion cannot be all zeros)`);
            } else if (addrType === 'broadcast') {
                missing.push(`Node ${i + 1} IP is a broadcast address (host portion cannot be all ones)`);
            } else if (ips.has(ip)) {
                missing.push('Node IPs must be unique');
            }
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

        // Helper to get node name from wizard settings
        const getNodeNameForArm = (index0Based) => {
            const fromWizard = (Array.isArray(state.nodeSettings) && state.nodeSettings[index0Based]) ? state.nodeSettings[index0Based] : null;
            const name = fromWizard && fromWizard.name ? String(fromWizard.name).trim() : '';
            return name || `node${index0Based + 1}`;
        };

        // Generate arcNodeResourceIds - uses actual node names from wizard when available
        const generateArcNodeResourceIds = (count) => {
            return Array.from({ length: count }, (_, i) => {
                const nodeName = getNodeNameForArm(i);
                // Use placeholders for subscription/resource group but actual node names
                return `/subscriptions/<SubscriptionId>/resourceGroups/<ResourceGroup>/providers/Microsoft.HybridCompute/machines/${nodeName}`;
            });
        };
        const arcNodeResourceIds = generateArcNodeResourceIds(nodeCount);

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
            // Use custom port name if provided, otherwise use the wizard's default display name (Port 1, Port 2, ...)
            const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];
            const pc = cfg[nicIdx1Based - 1];
            if (pc && pc.customName && pc.customName.trim()) {
                return pc.customName.trim();
            }
            return (typeof getPortDisplayName === 'function') ? getPortDisplayName(nicIdx1Based) : `Port ${nicIdx1Based}`;
        };

        /**
         * Get custom storage adapter name for storageNetworkList.
         * For switchless: uses ports after mgmt/compute (ports 3, 4, 5, 6, ...)
         * For switched: uses the specified storage port number
         * @param {number} smbIdx1Based - 1-based SMB adapter index (1, 2, 3, ...)
         * @param {number} storagePortOffset - For switchless, the offset from port 3 (default 2 for ports 3+)
         * @returns {string} The adapter name for ARM template
         */
        const armAdapterNameForSmb = (smbIdx1Based, storagePortOffset = 2) => {
            const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];
            // For switchless storage, SMB adapters map to ports after mgmt/compute (ports 3, 4, ...)
            // For switched storage, the smbIdx directly corresponds to a port number
            const portIdx = storagePortOffset + smbIdx1Based - 1; // 0-based index in portConfig
            const pc = cfg[portIdx];
            if (pc && pc.customName && pc.customName.trim()) {
                return pc.customName.trim();
            }
            const portIdx1Based = portIdx + 1;
            return (typeof getPortDisplayName === 'function') ? getPortDisplayName(portIdx1Based) : `Port ${portIdx1Based}`;
        };

        const sanitizeIntentName = (raw) => {
            const s = String(raw || '').trim();
            if (!s) return 'Intent';
            // Keep ARM-friendly names: letters/numbers/underscore/hyphen.
            const cleaned = s.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '');
            return cleaned || 'Intent';
        };

        const baseKeyForGroupKey = (k) => {
            const key = String(k || '');
            return key.startsWith('custom_') ? key.substring('custom_'.length) : key;
        };

        const trafficTypeForGroupBaseKey = (baseKey) => {
            if (baseKey === 'mgmt') return ['Management'];
            if (baseKey === 'compute' || baseKey === 'compute_1' || baseKey === 'compute_2') return ['Compute'];
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
            // When adapter mapping is confirmed, getIntentNicGroups uses unprefixed
            // keys (e.g. 'storage') for all intent types including custom.
            if (state.adapterMappingConfirmed && state.adapterMapping && Object.keys(state.adapterMapping).length > 0) {
                // Check if there's an 'all' bucket (all traffic)
                for (const k of Object.values(state.adapterMapping)) {
                    if (k === 'all') return 'all';
                }
                return 'storage';
            }
            if (state.intent === 'custom') return 'custom_storage';
            if (state.intent === 'all_traffic') return 'all';
            return 'storage';
        };

        const getStorageVlans = () => {
            ensureIntentOverrideDefaults();
            const key = getStorageOverrideKey();
            let ov = (state.intentOverrides && state.intentOverrides[key]) ? state.intentOverrides[key] : null;

            // Fallback: for custom intents, VLANs may be stored under either
            // 'custom_storage' or 'storage' depending on whether adapter mapping
            // was confirmed before or after the overrides were edited.
            if (!ov && state.intent === 'custom') {
                const alt = (key === 'custom_storage') ? 'storage' : 'custom_storage';
                ov = (state.intentOverrides && state.intentOverrides[alt]) ? state.intentOverrides[alt] : null;
            }

            // Return an array of N VLAN values (one per storage network).
            // Back-compat: legacy keys storageVlanNic1/storageVlanNic2 for networks 1-2.
            const vlans = [];
            for (let n = 1; n <= storageNetworkCount; n++) {
                const legacyKey = n === 1 ? 'storageVlanNic1' : (n === 2 ? 'storageVlanNic2' : undefined);
                const raw = ov && (ov[`storageNetwork${n}VlanId`] ?? (legacyKey ? ov[legacyKey] : undefined));
                // Guard against empty strings: Number('') === 0 which is an invalid VLAN and would slip through
                const val = (raw !== '' && raw !== null && raw !== undefined && Number.isInteger(Number(raw)) && Number(raw) >= 1) ? Number(raw) : null;
                vlans.push(val);
            }
            return vlans;
        };

        const getStorageNicCandidates = () => {
            if (portCount <= 0) return [];

            // If adapter mapping is confirmed, use it to determine storage NICs
            if (state.adapterMappingConfirmed && state.adapterMapping && Object.keys(state.adapterMapping).length > 0) {
                const out = [];
                for (let i = 1; i <= portCount; i++) {
                    const assignment = state.adapterMapping[i] || 'pool';
                    if (assignment === 'storage' || assignment === 'compute_storage' || assignment === 'all') {
                        out.push(i);
                    }
                }
                return out;
            }

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

            // all_traffic (fully converged): all NICs carry storage traffic.
            return Array.from({ length: portCount }, (_, i) => i + 1);
        };

        const storageNetworkCount = getStorageVlanOverrideNetworkCount();
        const storageCandidates = getStorageNicCandidates();
        const storageNicsForNetworks = storageCandidates.slice(0, Math.max(0, storageNetworkCount));
        const storageVlans = getStorageVlans();

        // Helper to get custom subnet or fall back to default
        const getCustomSubnetOrDefault = (subnetIndex, defaultSubnet) => {
            if (Array.isArray(state.customStorageSubnets) && state.customStorageSubnets[subnetIndex]) {
                return state.customStorageSubnets[subnetIndex];
            }
            return defaultSubnet;
        };

        // Helper to extract network prefix and calculate IP from custom CIDR or default
        // defaultThirdOctet should be a number (e.g., 1, 2, 3) used to construct 10.0.{n}.0/24
        const getSubnetInfo = (subnetIndex, defaultThirdOctet) => {
            const defaultCidr = `10.0.${defaultThirdOctet}.0/24`;
            const rawCidr = getCustomSubnetOrDefault(subnetIndex, defaultCidr);
            // Ensure we are working with a string and trim whitespace
            let cidr = (typeof rawCidr === 'string' ? rawCidr : defaultCidr).trim();

            // Validate CIDR structure: "<ip>/<prefix>", where <ip> has 4 dot-separated numeric octets
            const parts = cidr.split('/');
            let ipParts = [];
            let useDefault = false;

            if (parts.length !== 2) {
                useDefault = true;
            } else {
                ipParts = parts[0].split('.');
                if (ipParts.length !== 4) {
                    useDefault = true;
                } else if (ipParts.some(p => p === '' || Number.isNaN(Number(p)))) {
                    useDefault = true;
                }
            }

            if (useDefault) {
                cidr = defaultCidr;
                const defaultParts = cidr.split('/');
                ipParts = defaultParts[0].split('.');
            }

            const prefix = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
            const mask = cidrToSubnetMask(cidr) || '255.255.255.0';
            return { prefix, mask, cidr };
        };

        const storageNetworkList = (() => {
            // Special-case: 3-node switchless requires explicit storage subnet/IP assignment.
            // Use the same example subnet numbering shown in the report:
            // 1-2: Node1↔Node2, 3-4: Node1↔Node3, 5-6: Node2↔Node3.
            if (state.storage === 'switchless' && nodeCount === 3) {
                const vlanId = (storageVlans[0] !== null && storageVlans[0] !== undefined) ? String(storageVlans[0]) : 'REPLACE_WITH_STORAGE_VLAN_1';

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

                // Get subnet info for each of the 6 subnets (custom or default)
                const subnetInfoMap = {};
                for (let i = 1; i <= 6; i++) {
                    subnetInfoMap[i] = getSubnetInfo(i - 1, i);
                }

                const makeIpv4 = (subnetNumber, hostOctet) => {
                    const info = subnetInfoMap[subnetNumber];
                    return info ? `${info.prefix}.${hostOctet}` : `10.0.${subnetNumber}.${hostOctet}`;
                };
                const getSubnetMask = (subnetNumber) => {
                    const info = subnetInfoMap[subnetNumber];
                    return info ? info.mask : '255.255.255.0';
                };
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
                            subnetMask: subnetNumber ? getSubnetMask(subnetNumber) : '255.255.255.0'
                        });
                    }

                    list.push({
                        name: `StorageNetwork${smbIdx}`,
                        networkAdapterName: armAdapterNameForSmb(smbIdx, 2),
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
                const vlanId = (storageVlans[0] !== null && storageVlans[0] !== undefined) ? String(storageVlans[0]) : 'REPLACE_WITH_STORAGE_VLAN_1';

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

                // Build subnet info map for all 12 subnets (custom or default)
                const subnetInfoMap = {};
                for (let i = 1; i <= 12; i++) {
                    subnetInfoMap[i] = getSubnetInfo(i - 1, i);
                }

                const makeIpv4 = (subnetNumber, hostOctet) => {
                    const subnetInfo = subnetInfoMap[subnetNumber];
                    if (!subnetInfo || !subnetInfo.prefix) {
                        // Missing or invalid subnet info; return fallback
                        return `10.0.${subnetNumber}.${hostOctet}`;
                    }
                    return `${subnetInfo.prefix}.${hostOctet}`;
                };
                const getSubnetMask = (subnetNumber) => {
                    const subnetInfo = subnetInfoMap[subnetNumber];
                    // Fall back to a default mask if subnet info is missing or malformed
                    return (subnetInfo && subnetInfo.mask) ? subnetInfo.mask : '255.255.255.0';
                };
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
                            subnetMask: subnetNumber ? getSubnetMask(subnetNumber) : '255.255.255.0'
                        });
                    }

                    list.push({
                        name: `StorageNetwork${smbIdx}`,
                        networkAdapterName: armAdapterNameForSmb(smbIdx, 2),
                        vlanId: vlanId,
                        storageAdapterIPInfo: storageAdapterIPInfo
                    });
                }

                return list;
            }

            const list = [];
            if (storageNetworkCount <= 0) return list;

            // For switched storage with Auto IP disabled, include storageAdapterIPInfo with custom or default subnets
            const includeStorageAdapterIPInfo = state.storage === 'switched' && state.storageAutoIp === 'disabled';

            const buildStorageAdapterIPInfo = (subnetIndex) => {
                if (!includeStorageAdapterIPInfo) return undefined;
                const subnetInfo = getSubnetInfo(subnetIndex, subnetIndex + 1);
                const adapterInfo = [];
                for (let i = 0; i < nodeCount; i++) {
                    adapterInfo.push({
                        physicalNode: getNodeNameForArm(i),
                        ipv4Address: `${subnetInfo.prefix}.${i + 2}`,
                        subnetMask: subnetInfo.mask
                    });
                }
                return adapterInfo;
            };

            // Build N storage networks dynamically (supports up to 8 per Network ATC)
            for (let idx = 0; idx < storageNetworkCount; idx++) {
                const nic = storageNicsForNetworks[idx];
                const vlan = storageVlans[idx];
                const network = {
                    name: `StorageNetwork${idx + 1}`,
                    networkAdapterName: nic ? armAdapterNameForSmb(idx + 1, nic - 1 - idx) : `REPLACE_WITH_STORAGE_ADAPTER_${idx + 1}`,
                    vlanId: (vlan !== null && vlan !== undefined) ? String(vlan) : `REPLACE_WITH_STORAGE_VLAN_${idx + 1}`
                };
                if (includeStorageAdapterIPInfo) {
                    network.storageAdapterIPInfo = buildStorageAdapterIPInfo(idx);
                }
                list.push(network);
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
                // Storage intent adapters in the ARM template.
                // - Switchless: virtual adapters mapped to ports after mgmt/compute (ports 3, 4, ...)
                // - Switched: use the port display names based on assigned NIC numbers.
                if (state.storage === 'switchless') {
                    const n = nodeCount;
                    const smbCount = (Number.isFinite(n) && n > 1) ? (2 * (n - 1)) : 2;
                    // Storage ports start after the management/compute ports (typically port 3+)
                    return Array.from({ length: smbCount }, (_, i) => {
                        const portIdx1Based = 2 + i + 1; // ports 3, 4, 5, ...
                        return armAdapterNameForSmb(i + 1, 2);
                    });
                }

                // Switched: use armAdapterNameForSmb with port number offset
                return (Array.isArray(groupNics) ? groupNics : []).map(nicNum => {
                    return armAdapterNameForSmb(1, nicNum - 1);
                });
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

            const buildQosPolicyOverrides = (groupKey) => {
                const ov = (state.intentOverrides && state.intentOverrides[groupKey]) ? state.intentOverrides[groupKey] : null;
                const touched = !!(ov && ov.__touchedQos === true);
                // DCB QoS values: priorityValue8021Action_SMB is Storage priority, priorityValue8021Action_Cluster is System priority
                const storagePriority = ov && ov.dcbStoragePriority ? String(ov.dcbStoragePriority) : '';
                const systemPriority = ov && ov.dcbSystemPriority ? String(ov.dcbSystemPriority) : '';
                const storageBandwidth = ov && ov.dcbStorageBandwidth ? String(ov.dcbStorageBandwidth) : '';
                return {
                    touched,
                    overrides: {
                        priorityValue8021Action_Cluster: systemPriority,
                        priorityValue8021Action_SMB: storagePriority,
                        bandwidthPercentage_SMB: storageBandwidth
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
                                    baseKey === 'compute_1' ? 'Compute' :
                                        baseKey === 'compute_2' ? 'Compute' :
                                            baseKey === 'all' ? 'AllTraffic' : String(baseKey || 'Intent');

                let name = sanitizeIntentName(niceName);
                if (usedNames.has(name)) name = name + '_' + (idx + 1);
                usedNames.add(name);

                const adapters = (baseKey === 'storage')
                    ? getStorageAdapterNamesForIntent(g.nics)
                    : (Array.isArray(g.nics) ? g.nics : []).map(n => armAdapterNameForNic(n));

                const adapterOverrides = buildAdapterPropertyOverrides(g.key);
                const vswitchOverrides = buildVirtualSwitchConfigurationOverrides(g.key);
                const qosOverrides = buildQosPolicyOverrides(g.key);

                out.push({
                    name,
                    trafficType: baseKey === 'storage' ? ['Storage'] : trafficTypeForGroupBaseKey(baseKey),
                    adapter: adapters.length ? adapters : ['REPLACE_WITH_ADAPTER_1', 'REPLACE_WITH_ADAPTER_2'],
                    overrideVirtualSwitchConfiguration: vswitchOverrides.touched,
                    virtualSwitchConfigurationOverrides: vswitchOverrides.overrides,
                    overrideQosPolicy: qosOverrides.touched,
                    qosPolicyOverrides: qosOverrides.overrides,
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
                    arcNodeResourceIds: { value: arcNodeResourceIds },

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
                arcNodeResourceIds: { value: arcNodeResourceIds },

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
            scenario: state.scenario || '',
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

        // Track form completion for ARM deployment files
        trackFormCompletion('armDeployment');

        window.open('arm/arm.html' + hash, '_blank');
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

        // Track form completion for design document
        trackFormCompletion('designDocument');

        window.open('report/report.html' + hash, '_blank');
    } catch (err) {
        reportUiError(err, 'generateReport');
    }
}

function selectOption(category, value) {
    // Special handling for M365 Local - stop workflow and show documentation
    if (category === 'scenario' && value === 'm365local') {
        // Hide Multi-Rack message when switching to M365 Local
        const multiRackMsg = document.getElementById('multirack-message');
        if (multiRackMsg) {
            multiRackMsg.classList.add('hidden');
            multiRackMsg.classList.remove('visible');
        }
        showM365LocalInfo();
        return;
    }

    // Hide M365 Local message when switching to another scenario option
    if (category === 'scenario' && value !== 'm365local') {
        const m365Msg = document.getElementById('m365local-message');
        if (m365Msg) {
            m365Msg.classList.add('hidden');
            m365Msg.classList.remove('visible');
        }
    }

    // Hide Multi-Rack message when switching to another scenario option
    if (category === 'scenario' && value !== 'multirack') {
        const multiRackMsg = document.getElementById('multirack-message');
        if (multiRackMsg) {
            multiRackMsg.classList.add('hidden');
            multiRackMsg.classList.remove('visible');
        }
    }

    if (category === 'nodes') {
        const chip = document.querySelector(`.node-chip[onclick*="'${value}'"]`);
        if (chip && chip.classList.contains('disabled')) return;
        state.nodes = value;
        state.ports = null; state.storage = null; state.intent = null; state.outbound = null; state.arc = null; state.proxy = null; state.ip = null; state.customIntents = {}; state.adapterMapping = {}; state.adapterMappingConfirmed = false; state.adapterMappingSelection = null;
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

        // Special override: Allow Custom intent for single-node clusters with 4+ ports
        const isSingleNodeCustomOverride = (
            category === 'intent' &&
            value === 'custom' &&
            state.nodes === '1' &&
            state.ports &&
            parseInt(state.ports, 10) >= 4
        );

        if (card && card.classList && card.classList.contains('disabled') && !isSingleNodeCustomOverride) {
            return;
        }
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
        state.customIntentConfirmed = false; state.adapterMapping = {}; state.adapterMappingConfirmed = false;
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
        state.customIntents = {}; state.adapterMapping = {}; state.adapterMappingConfirmed = false; state.adapterMappingSelection = null;
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
        state.customIntentConfirmed = false; state.adapterMapping = {}; state.adapterMappingConfirmed = false;
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
        state.customIntents = {}; state.adapterMapping = {}; state.adapterMappingConfirmed = false; state.adapterMappingSelection = null;
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
        state.customIntentConfirmed = false; state.adapterMapping = {}; state.adapterMappingConfirmed = false;
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
        state.customIntents = {}; state.adapterMapping = {}; state.adapterMappingConfirmed = false; state.adapterMappingSelection = null;
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
        state.customStorageSubnets = []; state.customStorageSubnetsConfirmed = false;
        state.switchlessLinkMode = null;
        state.torSwitchCount = null; // Reset ToR switch selection when changing storage type
        // Storage choice should not invalidate Rack Aware zone placement or ToR architecture.
        // (Rack Aware is a scale/topology decision; users expect ToR selections to persist
        // when moving to Step 06 and beyond.)
    } else if (category === 'torSwitchCount') {
        // ToR switch selection (single/dual) - only used for diagram generation
        state.torSwitchCount = value;
    } else if (category === 'switchlessLinkMode') {
        // Changing link mode changes the physical wiring requirements; force the user
        // to re-pick ports and downstream intent mappings.
        state.ports = null;
        state.intent = null;
        state.customIntentConfirmed = false;
        state.storageAutoIp = null;
        state.customStorageSubnets = []; state.customStorageSubnetsConfirmed = false;
        try { state.portConfig = null; state.portConfigConfirmed = false; } catch (e) { /* ignore */ }
    } else if (category === 'rackAwareTorsPerRoom') {
        state.rackAwareTorsPerRoom = value;
        state.rackAwareTorArchitecture = null;
    } else if (category === 'ports') {
        state.storagePoolConfiguration = null;
        state.intent = null;
        state.customIntentConfirmed = false;
        state.customIntents = {}; state.adapterMapping = {}; state.adapterMappingConfirmed = false; state.adapterMappingSelection = null;
        state.intentOverrides = {};
        state.storageAutoIp = null;
        state.customStorageSubnets = []; state.customStorageSubnetsConfirmed = false;
        state.infraVlan = null;
        state.infraVlanId = null;
    } else if (category === 'storagePoolConfiguration') {
        state.storagePoolConfiguration = value;
    } else if (category === 'intent') {
        state.intent = value;
        state.customIntentConfirmed = false;
        state.adapterMapping = {};
        state.adapterMappingConfirmed = false;
        state.adapterMappingSelection = null;
        state.overridesConfirmed = false;
        state.storageAutoIp = null;
    } else if (category === 'outbound') {
        state.arc = null; state.proxy = null; state.ip = null; state.storageAutoIp = null; state.infraVlan = null; state.infraVlanId = null;
        state.nodeSettings = [];

        // For disconnected scenarios, Arc Gateway must be disabled (no_arc)
        if (state.scenario === 'disconnected') {
            state.arc = 'no_arc';
        }

        // For private path (ExpressRoute), Arc Gateway and Proxy are REQUIRED
        if (value === 'private') {
            state.arc = 'arc_gateway';
            state.proxy = 'proxy';
        }

        // Update UI labels for Arc Gateway and Proxy based on outbound selection
        updateConnectivityLabels(value);
    } else if (category === 'arc') {
        state.proxy = null; state.privateEndpoints = null; state.privateEndpointsList = [];
    } else if (category === 'proxy') {
        state.privateEndpoints = null; state.privateEndpointsList = [];
        // Reset PE checkboxes UI
        document.querySelectorAll('input[name="pe-service"]').forEach(cb => cb.checked = false);
    } else if (category === 'ip') {
        state.infra = null; state.infraCidr = null; state.infraCidrAuto = true; state.infraGateway = null; state.infraGatewayManual = false; state.infraVlan = 'default'; state.infraVlanId = null;
        state.nodeSettings = [];
    } else if (category === 'infraVlan') {
        state.infraVlan = value;
        if (value !== 'custom') {
            state.infraVlanId = null;
        }

        applyInfraVlanVisibility();
    } else if (category === 'storageAutoIp') {
        state.storageAutoIp = value;
        // Reset custom storage subnets when changing auto IP setting
        state.customStorageSubnets = [];
        state.customStorageSubnetsConfirmed = false;
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
    } else if (category === 'sdnEnabled') {
        state.sdnEnabled = value;
        // If SDN is disabled, clear SDN features and management
        if (value === 'no') {
            state.sdnFeatures = [];
            state.sdnManagement = null;
            // Uncheck all SDN feature checkboxes
            document.querySelectorAll('.sdn-feature-card input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        // Show/hide SDN features section
        const sdnFeaturesSection = document.getElementById('sdn-features-section');
        if (sdnFeaturesSection) {
            if (value === 'yes') {
                sdnFeaturesSection.classList.remove('hidden');
            } else {
                sdnFeaturesSection.classList.add('hidden');
            }
        }
    } else if (category === 'sdnManagement') {
        state.sdnManagement = value;
    } else if (category === 'privateEndpoints') {
        state.privateEndpoints = value;
        // Reset the list when changing selection
        state.privateEndpointsList = [];
        // Show/hide the PE services selection
        const peSelection = document.getElementById('private-endpoints-selection');
        const peInfo = document.getElementById('private-endpoints-info');
        if (peSelection) {
            if (value === 'pe_enabled') {
                peSelection.classList.remove('hidden');
            } else {
                peSelection.classList.add('hidden');
                // Uncheck all PE checkboxes
                document.querySelectorAll('input[name="pe-service"]').forEach(cb => cb.checked = false);
            }
        }
        if (peInfo) {
            if (value === 'pe_enabled') {
                peInfo.classList.remove('hidden');
            } else {
                peInfo.classList.add('hidden');
            }
        }
        updatePrivateEndpointsSelectionSummary();
    }

    updateUI();

    // Auto-save state after every option selection to ensure Resume works reliably
    saveStateToLocalStorage();
}

// ============================================================================
// NOTE: Theme functions have been moved to js/theme.js
// - increaseFontSize, decreaseFontSize, applyFontSize
// - toggleTheme, applyTheme
// ============================================================================

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

// Toggle Private Endpoint checkbox and update styling
function togglePeCheckbox(checkboxId) {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updatePrivateEndpointsList();
        // Update visual styling
        const card = checkbox.closest('.pe-service-card');
        if (card) {
            if (checkbox.checked) {
                card.style.borderColor = 'var(--accent-blue)';
                card.style.background = 'rgba(59, 130, 246, 0.1)';
            } else {
                card.style.borderColor = 'var(--glass-border)';
                card.style.background = 'rgba(255, 255, 255, 0.03)';
            }
        }
    }
}

// Update Arc Gateway and Proxy labels based on outbound selection
function updateConnectivityLabels(outboundValue) {
    const isPrivatePath = outboundValue === 'private';

    // Update Arc Gateway card labels
    const arcGatewayCard = document.querySelector('.option-card[data-value="arc_gateway"]');
    if (arcGatewayCard) {
        const h3 = arcGatewayCard.querySelector('h3');
        const p = arcGatewayCard.querySelector('p');
        const badge = arcGatewayCard.querySelector('.badge-recommended');

        if (isPrivatePath) {
            if (h3) h3.textContent = 'Required';
            if (p) p.textContent = 'Required for Private Path (ExpressRoute).';
            // Change badge to Required
            if (badge) {
                badge.textContent = 'Required';
                badge.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            }
        } else {
            if (h3) h3.textContent = 'Enabled';
            if (p) p.textContent = 'Arc Gateway Service.';
            // Reset badge to Recommended
            if (badge) {
                badge.textContent = 'Recommended';
                badge.style.background = '';
            }
        }
    }

    // Update Arc Gateway Disabled card
    const arcDisabledCard = document.querySelector('.option-card[data-value="no_arc"]');
    if (arcDisabledCard) {
        if (isPrivatePath) {
            arcDisabledCard.classList.add('disabled');
            arcDisabledCard.style.opacity = '0.5';
            arcDisabledCard.style.pointerEvents = 'none';
        } else {
            arcDisabledCard.classList.remove('disabled');
            arcDisabledCard.style.opacity = '';
            arcDisabledCard.style.pointerEvents = '';
        }
    }

    // Update Proxy card labels
    const proxyEnabledCard = document.getElementById('proxy-enabled-card');
    if (proxyEnabledCard) {
        const h3 = proxyEnabledCard.querySelector('h3');
        const p = proxyEnabledCard.querySelector('p');

        if (isPrivatePath) {
            if (h3) h3.textContent = 'Required';
            if (p) p.textContent = 'Azure Firewall Explicit Proxy required for Private Path.';
            // Add Required badge if not exists
            let badge = proxyEnabledCard.querySelector('.badge-recommended');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'badge-recommended';
                proxyEnabledCard.insertBefore(badge, proxyEnabledCard.firstChild);
            }
            badge.textContent = 'Required';
            badge.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        } else {
            if (h3) h3.textContent = 'Enabled';
            if (p) p.textContent = 'Traffic routed through proxy.';
            // Remove badge if exists
            const badge = proxyEnabledCard.querySelector('.badge-recommended');
            if (badge) badge.remove();
        }
    }

    // Update Proxy Disabled card
    const proxyDisabledCard = document.querySelector('#step-9 .option-card[data-value="no_proxy"]');
    if (proxyDisabledCard) {
        if (isPrivatePath) {
            proxyDisabledCard.classList.add('disabled');
            proxyDisabledCard.style.opacity = '0.5';
            proxyDisabledCard.style.pointerEvents = 'none';
        } else {
            proxyDisabledCard.classList.remove('disabled');
            proxyDisabledCard.style.opacity = '';
            proxyDisabledCard.style.pointerEvents = '';
        }
    }
}

// Private Endpoints helper functions
function updatePrivateEndpointsList() {
    const checkboxes = document.querySelectorAll('input[name="pe-service"]:checked');
    state.privateEndpointsList = Array.from(checkboxes).map(cb => cb.value);
    updatePrivateEndpointsSelectionSummary();
    saveStateToLocalStorage();
    updateProgressUi();
}

function updatePrivateEndpointsSelectionSummary() {
    const summary = document.getElementById('pe-selection-summary');
    const countSpan = document.getElementById('pe-selection-count');
    if (summary && countSpan) {
        const count = state.privateEndpointsList ? state.privateEndpointsList.length : 0;
        countSpan.textContent = count;
        if (count > 0) {
            summary.classList.remove('hidden');
        } else {
            summary.classList.add('hidden');
        }
    }
}

// Get display info for private endpoint services
function getPrivateEndpointInfo(serviceKey) {
    const peInfo = {
        'keyvault': {
            name: 'Azure Key Vault',
            fqdn: 'vault.azure.net',
            privateLink: 'privatelink.vaultcore.azure.net',
            notes: 'Required for deployment. Keep public access enabled during initial deployment, then restrict.',
            icon: '🔐'
        },
        'storage': {
            name: 'Azure Storage (Blob)',
            fqdn: 'blob.core.windows.net',
            privateLink: 'privatelink.blob.core.windows.net',
            notes: 'Required for 2-node deployments as cloud witness. Keep public access during deployment.',
            icon: '💾'
        },
        'acr': {
            name: 'Azure Container Registry',
            fqdn: 'azurecr.io',
            privateLink: 'privatelink.azurecr.io',
            notes: 'Important: Wildcards (*.azurecr.io) are NOT supported. Use specific ACR FQDNs before deployment.',
            icon: '📦'
        },
        'asr': {
            name: 'Azure Site Recovery',
            fqdn: 'siterecovery.windowsazure.com',
            privateLink: 'privatelink.siterecovery.windowsazure.com',
            notes: 'Not allowed via Arc Gateway. Add to proxy bypass list for direct traffic to private endpoint.',
            icon: '🔄'
        },
        'backup': {
            name: 'Recovery Services Vault',
            fqdn: 'backup.windowsazure.com',
            privateLink: 'privatelink.backup.windowsazure.com',
            notes: 'Azure Backup private endpoints for VM backup and recovery.',
            icon: '🗄️'
        },
        'sql': {
            name: 'SQL Managed Instance',
            fqdn: 'database.windows.net',
            privateLink: 'privatelink.database.windows.net',
            notes: 'Private connectivity for Azure SQL Managed Instance.',
            icon: '🗃️'
        },
        'defender': {
            name: 'Microsoft Defender for Cloud',
            fqdn: 'Various security endpoints',
            privateLink: 'Multiple Private Link endpoints',
            notes: 'For advanced security monitoring scenarios.',
            icon: '🛡️'
        }
    };
    return peInfo[serviceKey] || null;
}

function updateUI() {
    // Skip UI updates on test page (no wizard DOM elements)
    // Also skip during template loading to prevent cascading auto-defaults
    // (each selectOption call triggers updateUI, which can auto-set intent/storageAutoIp
    // and recalculate disabled states between calls, breaking the template sequence)
    if (window.__loadingTemplate || window.location.pathname.includes('/tests/') || window.location.pathname.includes('/tests')) {
        return;
    }

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
        document.getElementById('step-9b'),
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
            if (scenarioExp) {
                scenarioExp.innerHTML = `<strong style="color: #ef4444;">Disconnected Mode</strong>
        No Internet connection required. Arc Gateway and private endpoint features are unavailable. Management clusters are fixed at 3 nodes; workload clusters support 1–16 nodes. Selection between Air-Gapped or limited connectivity options for Azure Local disconnected operations will be requested during the wizard.`;
            }
            if (scenarioExp) scenarioExp.classList.add('visible');
        } else if (state.scenario === 'm365local') {
            if (scenarioExp) {
                scenarioExp.innerHTML = `<strong style="color: var(--accent-blue);">M365 Local Deployment</strong>
        Optimized for Microsoft 365 workloads. Requires a minimum of 9 physical nodes for high availability and performance. Supports Standard scale configuration only.
        <br><a href="https://learn.microsoft.com/azure/azure-local/concepts/microsoft-365-local-overview" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: underline; font-weight: 500;">📘 More information on M365 Local</a>`;
            }
            if (scenarioExp) scenarioExp.classList.add('visible');
        } else if (state.scenario === 'hyperconverged') {
            if (scenarioExp) {
                scenarioExp.innerHTML = `<strong style="color: var(--accent-blue);">Hyperconverged Infrastructure</strong>
        Consolidated compute and storage in a single rack. Supports Low Capacity and Standard Scale configurations.`;
            }
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

        // Single-node clusters: Hide storage switched/switchless options but show ToR switch selection
        // Single-node uses implicit switched storage, user still configures storage intent in Step 08
        const storageOptionsGrid = document.getElementById('storage-options-grid');
        const storageCompareBtn = document.getElementById('storage-compare-btn');
        const stepTitle = document.getElementById('step-4-title');
        const torDescription = document.getElementById('tor-switch-description');

        if (state.nodes === '1') {
        // Hide storage switched/switchless options (single-node uses implicit switched storage)
            if (storageOptionsGrid) storageOptionsGrid.classList.add('hidden');
            if (storageCompareBtn) storageCompareBtn.classList.add('hidden');
            // Change title to reflect it's for network topology
            if (stepTitle) stepTitle.textContent = 'Network Connectivity';
            if (torDescription) torDescription.textContent = 'Select the number of Top-of-Rack switches for network traffic.';
            // Set implicit switched storage for single-node
            state.storage = 'switched';
        } else {
        // Show storage options for multi-node clusters
            if (storageOptionsGrid) storageOptionsGrid.classList.remove('hidden');
            if (storageCompareBtn) storageCompareBtn.classList.remove('hidden');
            if (stepTitle) stepTitle.textContent = 'Storage Connectivity';
            if (torDescription) torDescription.textContent = 'Select the number of Top-of-Rack switches for storage connectivity.';
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

        const isSelected = state[category] === value;
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
                // Management cluster: fixed at 3 nodes only
                // Workload cluster: allows 1-16 nodes (standard medium scale range)
                if (state.clusterRole === 'management') {
                    if (valueStr !== '3') isDisabled = true;
                } else if (state.clusterRole === 'workload') {
                    if (valueStr === '2') isDisabled = true;
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
            'all_traffic': document.querySelector('[data-value="all_traffic"][onclick*="intent"]'),
            'mgmt_compute': document.querySelector('[data-value="mgmt_compute"][onclick*="intent"]'),
            'compute_storage': document.querySelector('[data-value="compute_storage"][onclick*="intent"]'),
            'custom': document.querySelector('[data-value="custom"][onclick*="intent"]')
        },
        arc: {
            'arc_gateway': document.querySelector('[data-value="arc_gateway"]'),
            'no_arc': document.querySelector('[data-value="no_arc"]')
        },
        proxy: {
            'proxy': document.querySelector('[data-value="proxy"]'),
            'no_proxy': document.querySelector('[data-value="no_proxy"]')
        },
        privateEndpoints: {
            'pe_enabled': document.querySelector('[data-value="pe_enabled"]'),
            'pe_disabled': document.querySelector('[data-value="pe_disabled"]')
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
        if (state.nodes === '1') {
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

        // Management cluster: fixed at 3 nodes — rack_aware requires 2/4/6/8, so disable it
        if (state.clusterRole === 'management') {
            if (cards.scale.rack_aware) cards.scale.rack_aware.classList.add('disabled');
            if (state.scale === 'rack_aware') state.scale = null;
        }

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

    // Disconnected scenario info message for Azure Cloud step
    const disconnectedRegionInfo = document.getElementById('disconnected-region-info');
    if (disconnectedRegionInfo) {
        if (state.scenario === 'disconnected') {
            disconnectedRegionInfo.classList.remove('hidden');
            disconnectedRegionInfo.classList.add('visible');
        } else {
            disconnectedRegionInfo.classList.add('hidden');
            disconnectedRegionInfo.classList.remove('visible');
        }
    }

    // Scale -> Nodes handled in loop above
    // NOTE: Do not apply scale-only port limits here.
    // Port requirements depend on node count + storage topology (e.g., 3-node switchless requires >=6 ports).

    // Nodes -> Storage -> Ports
    if (!state.nodes) Object.values(cards.storage).forEach(c => c.classList.add('disabled'));
    // For 1-node clusters, storage is implicitly switched, so enable ports if ToR is selected
    if (!state.storage && state.nodes !== '1') {
        Object.values(cards.ports).forEach(c => c.classList.add('disabled'));
    } else if (state.nodes === '1' && !state.torSwitchCount) {
        Object.values(cards.ports).forEach(c => c.classList.add('disabled'));
    }

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
        // Add "Required" badge to Storage Switched card for Rack Aware
        if (cards.storage && cards.storage.switched) {
            if (!cards.storage.switched.querySelector('.badge-required')) {
                const badge = document.createElement('div');
                badge.className = 'badge-required';
                badge.textContent = 'Required';
                cards.storage.switched.appendChild(badge);
            }
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
    } else {
        // Remove "Required" badge from Storage Switched when not Rack Aware
        if (cards.storage && cards.storage.switched) {
            const badge = cards.storage.switched.querySelector('.badge-required');
            if (badge) badge.remove();
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

    // Custom Storage Subnets UI - show when Storage Auto IP is disabled
    const customStorageSubnetsSection = document.getElementById('custom-storage-subnets');
    if (customStorageSubnetsSection) {
        if (state.storageAutoIp === 'disabled') {
            customStorageSubnetsSection.classList.remove('hidden');
            updateCustomStorageSubnetsUI();
        } else {
            customStorageSubnetsSection.classList.add('hidden');
            state.customStorageSubnets = [];
        }
    }

    // Cloud Witness Type: Lock based on cluster configuration
    const witnessLocked = isWitnessTypeLocked();
    const witnessInfoBox = document.getElementById('witness-info');
    const cloudWitnessCard = cards.witnessType && cards.witnessType.Cloud;

    if (!state.nodes) {
        // No nodes selected yet - disable both cards
        Object.values(cards.witnessType).forEach(c => c && c.classList.add('disabled'));
        // Remove "Required" badge from Cloud card
        if (cloudWitnessCard) {
            const badge = cloudWitnessCard.querySelector('.badge-required');
            if (badge) badge.remove();
        }
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

        // Add "Required" badge to Cloud card when witness is locked
        if (cloudWitnessCard) {
            if (!cloudWitnessCard.querySelector('.badge-required')) {
                const badge = document.createElement('div');
                badge.className = 'badge-required';
                badge.textContent = 'Required';
                cloudWitnessCard.appendChild(badge);
            }
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

        // Remove "Required" badge from Cloud card when not locked
        if (cloudWitnessCard) {
            const badge = cloudWitnessCard.querySelector('.badge-required');
            if (badge) badge.remove();
        }

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

    // Step 9 -> 9b (Private Endpoints)
    if (!state.proxy) {
        Object.values(cards.privateEndpoints).forEach(c => c && c.classList.add('disabled'));
    } else {
        Object.values(cards.privateEndpoints).forEach(c => c && c.classList.remove('disabled'));
    }

    // Show/hide Private Endpoints service selection based on state
    const peSelection = document.getElementById('private-endpoints-selection');
    const peInfo = document.getElementById('private-endpoints-info');
    if (peSelection) {
        if (state.privateEndpoints === 'pe_enabled') {
            peSelection.classList.remove('hidden');
        } else {
            peSelection.classList.add('hidden');
        }
    }
    if (peInfo) {
        if (state.privateEndpoints === 'pe_enabled') {
            peInfo.classList.remove('hidden');
        } else {
            peInfo.classList.add('hidden');
        }
    }

    // Azure Gov Constraint
    if (state.region === 'azure_government') {
        cards.arc['arc_gateway'].classList.add('disabled');
        if (state.arc === 'arc_gateway') state.arc = null;
    }

    // Step 9b -> Step 10 (IP): Depends on privateEndpoints selection
    if (!state.privateEndpoints) Object.values(cards.ip).forEach(c => c.classList.add('disabled'));

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
    } else {
        // Enable Azure AD card when infra is properly set
        if (adCards.azure_ad) adCards.azure_ad.classList.remove('disabled');
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
        // Only enable local_identity if infra is properly set
        if (adCards.local_identity) {
            if (state.infra && state.infra.start && state.infra.end) {
                adCards.local_identity.classList.remove('disabled');
                adCards.local_identity.style.opacity = '';
                adCards.local_identity.style.pointerEvents = '';
            } else {
                adCards.local_identity.classList.add('disabled');
                adCards.local_identity.style.opacity = '0.5';
                adCards.local_identity.style.pointerEvents = 'none';
            }
        }
    }

    // ADFS Server section visibility
    const adfsSection = document.getElementById('adfs-server-section');
    if (adfsSection) {
        if (state.scenario === 'disconnected' && state.activeDirectory === 'azure_ad' && state.clusterRole === 'management') {
            adfsSection.classList.remove('hidden');
        } else {
            adfsSection.classList.add('hidden');
        }
    }

    // AD Domain section - restore visibility and input values for Resume/Import
    const adDomainSection = document.getElementById('ad-domain-section');
    const adDomainInput = document.getElementById('ad-domain');
    const adOuPathInput = document.getElementById('ad-ou-path');
    const adfsServerInput = document.getElementById('adfs-server-name');
    if (adDomainSection && state.activeDirectory === 'azure_ad') {
        adDomainSection.classList.remove('hidden');
        // Restore input values from state
        if (adDomainInput && state.adDomain && !adDomainInput.value) {
            adDomainInput.value = state.adDomain;
        }
        if (adOuPathInput && state.adOuPath && !adOuPathInput.value) {
            adOuPathInput.value = state.adOuPath;
        }
        if (adfsServerInput && state.adfsServerName && !adfsServerInput.value) {
            adfsServerInput.value = state.adfsServerName;
        }
    }

    // DNS Configuration section - restore visibility for Resume/Import
    const dnsConfigSection = document.getElementById('dns-config-section');
    const dnsConfigTitle = document.getElementById('dns-config-title');
    const localDnsZone = document.getElementById('local-dns-zone');
    if (dnsConfigSection && state.activeDirectory) {
        dnsConfigSection.classList.remove('hidden');
        // Show/hide Local DNS Zone based on identity type
        if (localDnsZone) {
            if (state.activeDirectory === 'local_identity') {
                localDnsZone.classList.remove('hidden');
                if (dnsConfigTitle) dnsConfigTitle.classList.add('hidden');
            } else {
                localDnsZone.classList.add('hidden');
                if (dnsConfigTitle) dnsConfigTitle.classList.remove('hidden');
            }
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
    const infraInputGateway = document.getElementById('infra-default-gateway');
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
            // Disable Default Gateway when no IP type is selected (#98).
            // Keeps compositing/opacity consistent with sibling inputs,
            // preventing Safari hit-testing quirks on the gateway field.
            if (infraInputGateway) {
                infraInputGateway.disabled = true;
                infraInputGateway.parentElement.style.opacity = '0.5';
            }
        } else {
            if (infraInputCidr) {
                infraInputCidr.disabled = false;
                infraInputCidr.parentElement.style.opacity = '1';
            }
            infraInputStart.disabled = false;
            infraInputEnd.disabled = false;
            infraInputStart.parentElement.style.opacity = '1';
            infraInputEnd.parentElement.style.opacity = '1';
            // Restore Default Gateway parent opacity; the DHCP/Static
            // enable/disable logic later in updateUI() controls .disabled.
            if (infraInputGateway) {
                infraInputGateway.parentElement.style.opacity = '1';
            }
        }

        // Restore input values from state (for Resume/Import functionality)
        // Always restore from state to ensure values are populated
        if (infraInputCidr && state.infraCidr) {
            infraInputCidr.value = state.infraCidr;
        }
        if (state.infra) {
            if (state.infra.start && infraInputStart) {
                infraInputStart.value = state.infra.start;
            }
            if (state.infra.end && infraInputEnd) {
                infraInputEnd.value = state.infra.end;
            }
        }
        if (infraInputGateway && state.infraGateway) {
            infraInputGateway.value = state.infraGateway;
        }
    }


    // RULE 1: Nodes -> Storage
    const contextDiv = document.getElementById('nodes-context');
    const countDisplay = document.getElementById('nodes-count-display');
    const implicationDisplay = document.getElementById('nodes-implication');

    if (state.nodes) {
        contextDiv.classList.add('visible');
        countDisplay.innerText = state.nodes;
        const nodeVal = state.nodes === '16+' ? 17 : parseInt(state.nodes);
        if (nodeVal >= 5) {
            cards.storage['switchless'].classList.add('disabled');
            if (state.storage === 'switchless') state.storage = null;
            implicationDisplay.innerText = 'Requires Switched Storage.';
            implicationDisplay.style.color = 'var(--accent-purple)';
        } else {
            implicationDisplay.innerText = 'Supports Switchless & Switched.';
            implicationDisplay.style.color = 'var(--success)';
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

    // Conditional UI: Storage Switched + Hyperconverged/Low Capacity -> ToR Switch Count (Single/Dual)
    // Also show for 1-node clusters (using implicit switched storage)
    (function updateTorSwitchCountUi() {
        const torBlock = document.getElementById('tor-switch-count');
        if (!torBlock) return;

        const n = state.nodes ? parseInt(state.nodes, 10) : NaN;
        const isStorageSwitched = state.storage === 'switched';
        const isHyperconvergedOrLowCap = state.scale === 'medium' || state.scale === 'low_capacity';
        const isSingleNode = n === 1;

        // Show ToR selection for: 1-node clusters OR (storage switched + hyperconverged/low cap)
        const shouldShow = (isSingleNode && isHyperconvergedOrLowCap) || (isStorageSwitched && isHyperconvergedOrLowCap && !isNaN(n) && n >= 1);

        const singleOption = document.getElementById('tor-single-option');
        const dualOption = document.getElementById('tor-dual-option');
        const singleDisabledInfo = document.getElementById('tor-single-disabled-info');

        if (shouldShow) {
            torBlock.classList.remove('hidden');

            // For 4+ nodes on Hyperconverged (medium scale), only Dual ToR is allowed
            const singleDisabled = (state.scale === 'medium' && n >= 4);

            if (singleOption) {
                if (singleDisabled) {
                    singleOption.classList.add('disabled');
                    singleOption.title = 'Single ToR Switch is not supported for 4+ node Hyperconverged clusters';
                } else {
                    singleOption.classList.remove('disabled');
                    singleOption.title = '';
                }
            }

            // Show/hide the info box explaining why Single ToR is disabled
            if (singleDisabledInfo) {
                if (singleDisabled) {
                    singleDisabledInfo.classList.remove('hidden');
                    singleDisabledInfo.classList.add('visible');
                } else {
                    singleDisabledInfo.classList.add('hidden');
                    singleDisabledInfo.classList.remove('visible');
                }
            }

            if (dualOption) {
                dualOption.classList.remove('disabled');
            }

            // Auto-select: Single for 1-node clusters, Dual for others (or if Single is disabled)
            if (!state.torSwitchCount) {
                state.torSwitchCount = isSingleNode ? 'single' : 'dual';
            } else if (singleDisabled && state.torSwitchCount === 'single') {
                state.torSwitchCount = 'dual';
            }

            // Update visual selection
            if (singleOption) singleOption.classList.toggle('selected', state.torSwitchCount === 'single');
            if (dualOption) dualOption.classList.toggle('selected', state.torSwitchCount === 'dual');
        } else {
            torBlock.classList.add('hidden');
            state.torSwitchCount = null;
            // Also hide the info box when ToR section is hidden
            if (singleDisabledInfo) {
                singleDisabledInfo.classList.add('hidden');
                singleDisabledInfo.classList.remove('visible');
            }
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
    // Also: 2+ nodes + Storage Switched -> Recommend 4 Ports
    const port4Card = cards.ports['4'];
    const badgeClass = 'badge-recommended';
    const portsBadgeSelector = `.${badgeClass}[data-source="ports"]`;
    const existingPortsBadge = port4Card ? port4Card.querySelector(portsBadgeSelector) : null;

    const nForPortsBadge = state.nodes ? parseInt(state.nodes, 10) : NaN;
    const isSwitchless2NodeLowCapacityPortsRequired =
        state.scale === 'low_capacity' &&
        state.storage === 'switchless' &&
        nForPortsBadge === 2;

    // Show "Recommended" for 2+ nodes with Storage Switched
    const isMultiNodeSwitched = !isNaN(nForPortsBadge) && nForPortsBadge >= 2 && state.storage === 'switched';

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
    } else if (isMultiNodeSwitched) {
        // 2+ nodes with Storage Switched: recommend 4 ports
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
            const rdmaSentence = 'For multi-node clusters, at least two network ports must be RDMA-capable (iWARP/RoCEv2) to support high-performance Storage traffic.';

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
            const isSingleNode = state.nodes === '1';

            const isSwitchless3NodeStandard =
                isStandard &&
                state.storage === 'switchless' &&
                parseInt(state.nodes, 10) === 3;

            // RDMA disabled only for Low Capacity; single-node non-low-capacity requires RDMA for storage intent
            const defaultRdmaEnabled = isLowCapacity ? false : true;
            const defaultRdmaMode = isLowCapacity ? 'Disabled' : 'RoCEv2';
            // Single-node defaults to 10GbE, Low Capacity to 1GbE, otherwise 25GbE
            const defaultPortSpeed = isSingleNode ? '10GbE' : (isLowCapacity ? '1GbE' : '25GbE');

            // Preserve existing port configs (including custom names) when count changes
            const existingConfig = Array.isArray(state.portConfig) ? state.portConfig : [];

            // Reset confirmation when port count changes
            state.portConfigConfirmed = false;

            state.portConfig = Array(pCount).fill().map((_, idx) => {
                // Special default: 3-node switchless standard uses non-RDMA teamed ports for Mgmt+Compute.
                // Keep Port 1-2 non-RDMA by default; enable RDMA on the remaining ports.
                const rdmaEnabled = (isSwitchless3NodeStandard && idx < 2) ? false : defaultRdmaEnabled;
                const defaults = {
                    speed: defaultPortSpeed,
                    rdma: rdmaEnabled,
                    rdmaMode: rdmaEnabled ? defaultRdmaMode : 'Disabled',
                    rdmaManual: false,
                    customName: null
                };

                // Merge existing config with defaults (preserves customName and other user settings)
                if (existingConfig[idx]) {
                    return {
                        ...defaults,
                        ...existingConfig[idx]
                    };
                }
                return defaults;
            });
        } else {
            // If the user changes earlier choices (scale/nodes/storage) after portConfig was created,
            // keep the defaults aligned for 3-node switchless standard unless the user manually changed a port.
            const isLowCapacity = state.scale === 'low_capacity';
            const isStandard = state.scale === 'medium';
            const isSingleNode = state.nodes === '1';
            const isSwitchless3NodeStandard =
                isStandard &&
                state.storage === 'switchless' &&
                parseInt(state.nodes, 10) === 3;
            // RDMA disabled only for Low Capacity; single-node non-low-capacity requires RDMA for storage intent
            const defaultRdmaEnabled = isLowCapacity ? false : true;
            const defaultRdmaMode = isLowCapacity ? 'Disabled' : 'RoCEv2';

            // Single-node default RDMA alignment (speed is NOT overridden — user may change it).
            if (isSingleNode && !isLowCapacity) {
                for (let idx = 0; idx < pCount; idx++) {
                    const pc = state.portConfig[idx];
                    if (!pc) continue;
                    if (!pc.rdmaManual) {
                        pc.rdma = true;
                        pc.rdmaMode = 'RoCEv2';
                    }
                }
            } else if (isSingleNode && isLowCapacity) {
                // Single-node Low Capacity: no RDMA (speed is NOT overridden).
                for (let idx = 0; idx < pCount; idx++) {
                    const pc = state.portConfig[idx];
                    if (!pc) continue;
                    if (!pc.rdmaManual) {
                        pc.rdma = false;
                        pc.rdmaMode = 'Disabled';
                    }
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

        // HARD BLOCK (Step 07): If port configuration is not confirmed, do not allow
        // the user to proceed to Step 08 (Intent) or beyond.
        if (state.portConfigConfirmed !== true) {
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
    } else {
        portsExp.classList.remove('visible');
        portConfigSec.classList.remove('visible');
        state.portConfig = null;
        state.portConfigConfirmed = false;

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
        // NOTE: Single-node clusters can use Custom intent with 4+ ports, so skip this for them
        if (state.nodes !== '1') {
            cards.intent['custom'].classList.add('disabled');
            if (state.intent === 'custom') state.intent = null;
        }

        // Low Capacity: only allow Mgmt + Compute
        if (state.scale === 'low_capacity') {
            cards.intent['all_traffic'].classList.add('disabled');
            cards.intent['compute_storage'].classList.add('disabled');

            if (state.intent === 'all_traffic' || state.intent === 'compute_storage') state.intent = null;
            // Single-node can use Custom, so don't reset it
            if (state.nodes !== '1' && state.intent !== 'mgmt_compute') state.intent = null;
        }
    }

    // RULE 4: Outbound -> Arc & Proxy
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

    // RULE: 1-node clusters follow the same intent rules as multi-node clusters.
    // Storage intent is now supported for single-node deployments.
    // Custom intent requires 4+ ports for proper adapter separation.
    if (state.nodes === '1') {
        const portCount = parseInt(state.ports, 10);

        // Allow Custom only with 4+ ports (for separate Mgmt and Compute adapters)
        if (isNaN(portCount) || portCount < 4) {
            cards.intent['custom'].classList.add('disabled');
            // If custom is selected but ports < 4, reset to mgmt_compute
            if (state.intent === 'custom') {
                state.intent = 'mgmt_compute';
                state.customIntentConfirmed = false;
            }
        } else {
            // Explicitly enable Custom for single node with 4+ ports (override earlier rules)
            cards.intent['custom'].classList.remove('disabled');
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

    if (state.intent) {
        intentExp.classList.add('visible');
        let text = '';
        const portCount = parseInt(state.ports);
        const isSwitchless = state.storage === 'switchless';

        if (state.intent === 'all_traffic') {
            text = '<strong>Fully Converged Network</strong><br>All traffic types (Management, Compute, Storage) are permanently grouped onto a single SET team.';
        } else if (state.intent === 'mgmt_compute') {
            const isStandard = state.scale === 'medium';
            const assignment = getMgmtComputeNicAssignment(portCount);
            if (isStandard && portCount > 2 && !assignment.allRdma) {
                text = '<strong>Converged Mgmt & Compute + Dedicated Storage</strong><br>Mgmt/Compute use the first two non-RDMA ports. Storage uses the remaining ports.';
            } else {
                text = `<strong>Converged Mgmt & Compute + Dedicated Storage</strong><br>Mgmt/Compute share Pair 1. Storage uses Pair 2${portCount > 4 ? '+' : ''}.`;
            }
        } else if (state.intent === 'compute_storage') {
            text = `<strong>Converged Compute & Storage + Dedicated Mgmt</strong><br>Mgmt on Pair 1. Compute/Storage share Pair 2${portCount > 4 ? '+' : ''}.`;
        } else if (state.intent === 'custom') {
            text = '<strong>Custom Configuration</strong><br>Use the drag & drop interface below to assign adapters to traffic intents.';
        }
        intentExp.innerHTML = text;

        // Intent overrides UI (per intent NIC set)
        if (intentOverrides && intentOverridesContainer) {
            const allowOverrides = (state.intent !== 'custom') || !!state.customIntentConfirmed || !!state.adapterMappingConfirmed;
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

        // Render adapter mapping UI (drag & drop)
        try {
            renderAdapterMappingUi();
        } catch (e) {
            reportUiError(e, 'renderAdapterMappingUi');
        }

        // Update overrides UI
        try {
            updateOverridesUI();
        } catch (e) {
            reportUiError(e, 'updateOverridesUI');
        }

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
            // For rack_aware scenarios with mgmt_compute intent, RDMA is allowed (but not required) on Mgmt & Compute ports.
            const isRackAware = state.scale === 'rack_aware';
            const allowMgmtComputeOnRdmaPorts =
                (isStandard && state.intent === 'mgmt_compute' && allRdma) ||
                (isRackAware && state.intent === 'mgmt_compute');
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

    // Update breadcrumb navigation
    if (typeof updateBreadcrumbs === 'function') {
        updateBreadcrumbs();
    }
}

// Legacy NIC visualizer removed - replaced by drag & drop adapter mapping UI

function getIntentNicGroups(intent, portCount) {
    const groups = [];
    const p = parseInt(portCount) || 0;
    if (!intent || p <= 0) return groups;

    const addGroup = (key, label, nics) => {
        if (!nics || !nics.length) return;
        groups.push({ key, label, nics });
    };

    // If adapter mapping is confirmed, use it to determine NIC groups for all intent types
    // This ensures the ARM output reflects the user's custom port assignments
    if (state.adapterMappingConfirmed && state.adapterMapping && Object.keys(state.adapterMapping).length > 0) {
        const trafficNames = {
            'mgmt': 'Management',
            'compute': 'Compute',
            'storage': 'Storage',
            'mgmt_compute': 'Management + Compute',
            'compute_storage': 'Compute + Storage',
            'all': 'All Traffic',
            'pool': 'Unassigned'
        };

        // Define consistent display order for override cards
        const displayOrder = ['mgmt_compute', 'mgmt', 'compute', 'compute_storage', 'storage', 'all'];

        const buckets = new Map();
        for (let i = 1; i <= p; i++) {
            const assignment = state.adapterMapping[i] || 'pool';
            if (assignment === 'pool') continue;
            if (!buckets.has(assignment)) buckets.set(assignment, []);
            buckets.get(assignment).push(i);
        }

        if (buckets.size > 0) {
            // Sort by predefined display order so cards don't move around
            const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
                const aIdx = displayOrder.indexOf(a);
                const bIdx = displayOrder.indexOf(b);
                return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
            });
            for (const key of sortedKeys) {
                const nics = buckets.get(key);
                addGroup(key, `${trafficNames[key] || key}`, nics);
            }
            return groups;
        }
        // Fall through to defaults if no assignments found
    }

    if (intent === 'all_traffic') {
        addGroup('all', 'Group All Traffic', Array.from({ length: p }, (_, i) => i + 1));
        return groups;
    }

    if (intent === 'mgmt_compute') {
        if (p === 2) {
            addGroup('mgmt_compute', 'Management + Compute', [1]);
            addGroup('storage', 'Storage', [2]);
        } else {
            const assignment = getMgmtComputeNicAssignment(p);
            addGroup('mgmt_compute', 'Management + Compute', assignment.mgmtCompute);
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
            'compute_1': 'Compute 1',
            'compute_2': 'Compute 2',
            'storage': 'Storage',
            'mgmt_compute': 'Management + Compute',
            'compute_storage': 'Compute + Storage',
            'all': 'All Traffic',
            'unused': 'Unused'
        };

        // Define consistent display order for override cards
        const displayOrder = ['mgmt_compute', 'mgmt', 'compute', 'compute_1', 'compute_2', 'compute_storage', 'storage', 'all'];

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

        // Sort by predefined display order so cards don't move around
        const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
            const aIdx = displayOrder.indexOf(a);
            const bIdx = displayOrder.indexOf(b);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });
        for (const key of sortedKeys) {
            const nics = buckets.get(key);
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
            // Back-compat (older key names)
            if ((ov.storageNetwork1VlanId === undefined || ov.storageNetwork1VlanId === null) && (ov.storageVlanNic1 !== undefined && ov.storageVlanNic1 !== null)) {
                ov.storageNetwork1VlanId = ov.storageVlanNic1;
            }
            if ((ov.storageNetwork2VlanId === undefined || ov.storageNetwork2VlanId === null) && (ov.storageVlanNic2 !== undefined && ov.storageVlanNic2 !== null)) {
                ov.storageNetwork2VlanId = ov.storageVlanNic2;
            }

            // Initialize default VLANs for N storage networks (711, 712, ... 710+N)
            const storageNetCount = getStorageVlanOverrideNetworkCount();
            for (let n = 1; n <= storageNetCount; n++) {
                const vlanKey = `storageNetwork${n}VlanId`;
                if (ov[vlanKey] === undefined || ov[vlanKey] === null || ov[vlanKey] === '' || ov[vlanKey] === 0) {
                    ov[vlanKey] = 710 + n; // 711, 712, 713, ... 718
                }
            }
        }
    }
}

// Calculate how many storage subnets are required based on configuration
function getRequiredStorageSubnetCount() {
    const nodeCount = parseInt(state.nodes, 10) || 0;

    if (state.storage === 'switchless') {
        // 2-node switchless: 2 subnets
        if (nodeCount === 2) return 2;
        // 3-node switchless: 6 subnets (one per node pair link)
        if (nodeCount === 3) return 6;
        // 4-node switchless: 12 subnets
        if (nodeCount === 4) return 12;
        return 0;
    }

    if (state.storage === 'switched') {
        // Dynamic: one subnet per storage network
        return getStorageVlanOverrideNetworkCount();
    }

    return 0;
}

// Update the custom storage subnets UI
function updateCustomStorageSubnetsUI() {
    const container = document.getElementById('custom-storage-subnet-inputs');
    if (!container) return;

    const requiredCount = getRequiredStorageSubnetCount();

    // Initialize customStorageSubnets array if needed
    if (!Array.isArray(state.customStorageSubnets)) {
        state.customStorageSubnets = [];
    }

    // Preserve existing values while ensuring the array is the right size
    while (state.customStorageSubnets.length < requiredCount) {
        state.customStorageSubnets.push('');
    }
    state.customStorageSubnets = state.customStorageSubnets.slice(0, requiredCount);

    // Generate default example subnets
    const defaultSubnets = [];
    for (let i = 0; i < requiredCount; i++) {
        defaultSubnets.push(`10.0.${i + 1}.0/24`);
    }

    container.innerHTML = '';

    if (requiredCount === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Storage subnet configuration is not available for the current settings.</p>';
        return;
    }

    let html = '';
    for (let i = 0; i < requiredCount; i++) {
        const value = state.customStorageSubnets[i] || '';
        const placeholder = defaultSubnets[i];
        const label = state.storage === 'switched'
            ? `Storage Network ${i + 1} Subnet`
            : `Storage Subnet ${i + 1}`;

        // For the first input (index 0), use onchange to prevent auto-fill from triggering
        // on partial input (e.g., when user types "172.16.1.0/2" before completing "/24").
        // For subsequent inputs, use oninput for immediate feedback.
        const eventHandler = i === 0
            ? `onchange="updateCustomStorageSubnet(${i}, this.value)" oninput="updateCustomStorageSubnetPreview(${i}, this.value)"`
            : `oninput="updateCustomStorageSubnet(${i}, this.value)"`;

        html += `
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <label style="font-weight: 600; color: var(--text-primary);">${label}</label>
                <input type="text"
                       class="custom-storage-subnet-input"
                       data-subnet-index="${i}"
                       value="${escapeHtml(value)}"
                       placeholder="${placeholder}"
                       style="padding: 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 4px; font-family: monospace;"
                       ${eventHandler} />
            </div>
        `;
    }

    container.innerHTML = html;

    // Update confirm button state
    updateCustomStorageSubnetsConfirmButton();
}

// Toggle confirmation state for custom storage subnets
function toggleCustomStorageSubnetsConfirmed() {
    state.customStorageSubnetsConfirmed = !state.customStorageSubnetsConfirmed;
    updateUI();
}

// Update the confirm button UI for custom storage subnets
function updateCustomStorageSubnetsConfirmButton() {
    const confirmBtn = document.getElementById('custom-storage-subnets-confirm-btn');
    const confirmStatus = document.getElementById('custom-storage-subnets-confirm-status');
    const confirmed = state.customStorageSubnetsConfirmed;
    const requiredCount = getRequiredStorageSubnetCount();

    // Check if all required subnets have values and are valid CIDR format
    const subnetsToCheck = Array.isArray(state.customStorageSubnets)
        ? state.customStorageSubnets.slice(0, requiredCount)
        : [];
    const allFilled = subnetsToCheck.length >= requiredCount &&
                      subnetsToCheck.every(s => s && s.trim().length > 0);
    const allValid = allFilled && subnetsToCheck.every(s => isValidCidrFormat(s));

    if (confirmBtn) {
        if (confirmBtn.dataset && confirmBtn.dataset.bound !== '1') {
            confirmBtn.dataset.bound = '1';
            confirmBtn.addEventListener('click', () => toggleCustomStorageSubnetsConfirmed());
        }
        // Only allow confirmation when all subnets are filled AND valid
        confirmBtn.disabled = !allValid && !confirmed;
        confirmBtn.classList.toggle('is-confirmed', confirmed);
        confirmBtn.innerHTML = confirmed
            ? CONFIRM_BTN_PENCIL + 'Edit Storage Subnets'
            : CONFIRM_BTN_CHECKMARK + 'Confirm Storage Subnets';
    }

    if (confirmStatus) {
        if (confirmed) {
            confirmStatus.textContent = '✓ Confirmed';
            confirmStatus.style.color = 'var(--accent-blue)';
        } else if (allFilled && !allValid) {
            confirmStatus.textContent = 'Fix invalid CIDR format';
            confirmStatus.style.color = 'var(--accent-red, #ef4444)';
        } else {
            confirmStatus.textContent = allFilled ? 'Click to confirm' : 'Enter all subnet values';
            confirmStatus.style.color = 'var(--text-secondary)';
        }
    }

    // Disable/enable inputs based on confirmation state
    const inputs = document.querySelectorAll('.custom-storage-subnet-input');
    inputs.forEach(input => {
        input.disabled = confirmed;
        input.style.opacity = confirmed ? '0.7' : '1';
    });
}

// NOTE: isValidCidrFormat and incrementCidrThirdOctet have been moved to js/utils.js

// Preview function for the first storage subnet input - provides visual feedback without triggering auto-fill
// This is used with oninput on the first field to show validation state while typing
function updateCustomStorageSubnetPreview(index, value) {
    const input = document.querySelector(`.custom-storage-subnet-input[data-subnet-index="${index}"]`);
    if (!input) return;

    const trimmed = value.trim();
    if (trimmed && !isValidCidrFormat(trimmed)) {
        input.style.borderColor = 'var(--accent-red, #ef4444)';
        input.title = 'Invalid CIDR format. Use format like 10.0.1.0/24';
    } else {
        input.style.borderColor = 'var(--glass-border)';
        input.title = '';
    }
}

// Update a specific custom storage subnet
function updateCustomStorageSubnet(index, value) {
    if (!Array.isArray(state.customStorageSubnets)) {
        state.customStorageSubnets = [];
    }
    const trimmed = value.trim();
    state.customStorageSubnets[index] = trimmed;

    // Provide visual feedback for invalid CIDR format
    const input = document.querySelector(`.custom-storage-subnet-input[data-subnet-index="${index}"]`);
    if (input) {
        if (trimmed && !isValidCidrFormat(trimmed)) {
            input.style.borderColor = 'var(--accent-red, #ef4444)';
            input.title = 'Invalid CIDR format. Use format like 10.0.1.0/24';
        } else {
            input.style.borderColor = 'var(--glass-border)';
            input.title = '';
        }
    }

    // Auto-populate remaining subnets when first subnet is entered (Issue #95)
    // Only auto-fill if: index is 0, value is valid CIDR, and subsequent fields are empty
    if (index === 0 && trimmed && isValidCidrFormat(trimmed)) {
        const requiredCount = getRequiredStorageSubnetCount();
        for (let i = 1; i < requiredCount; i++) {
            // Only auto-populate if the field is currently empty or has no real value
            const currentValue = state.customStorageSubnets[i];
            if (!currentValue || currentValue.trim() === '') {
                const incrementedCidr = incrementCidrThirdOctet(trimmed, i);
                if (incrementedCidr) {
                    state.customStorageSubnets[i] = incrementedCidr;
                    // Update the input field in the DOM
                    const subnetInput = document.querySelector(`.custom-storage-subnet-input[data-subnet-index="${i}"]`);
                    if (subnetInput) {
                        subnetInput.value = incrementedCidr;
                        subnetInput.style.borderColor = 'var(--glass-border)';
                        subnetInput.title = '';
                    }
                }
            }
        }
    }

    // Reset confirmation when values change
    state.customStorageSubnetsConfirmed = false;
    updateCustomStorageSubnetsConfirmButton();
    updateSummary();
}

function getStorageVlanOverrideNetworkCount() {
    // Step 05 Storage Connectivity controls how many storage networks exist.
    // - Switched: 2 storage networks
    // - Switchless 2-node: 2 storage networks (VLANs 711, 712)
    // - Switchless 3/4-node: 1 storage network (single VLAN across all subnets)
    if (state.storage === 'switchless') {
        var nodeCount = parseInt(state.nodes, 10) || 0;
        if (nodeCount === 2) return 2;
        return 1;
    }
    if (state.storage === 'switched') {
        // Dynamic count based on how many NICs carry storage traffic
        const portCount = parseInt(state.ports, 10) || 0;
        const count = getStorageNicIndicesForIntent(state.intent, portCount).length;
        return count > 0 ? count : 2; // fallback to 2 if indeterminate
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

        // Check if any NIC in this group has RDMA enabled (from Step 07 Port Configuration)
        const groupHasRdma = g.nics.some(nic => {
            const idx = nic - 1;
            return state.portConfig && state.portConfig[idx] && state.portConfig[idx].rdma === true;
        });

        // If no NICs in the group have RDMA enabled, auto-set rdmaMode to 'Disabled'
        if (!groupHasRdma && ov.rdmaMode !== 'Disabled') {
            ov.rdmaMode = 'Disabled';
        }

        const card = document.createElement('div');
        card.className = 'override-card';

        const nicHint = g.nics.length <= 4
            ? `NIC${g.nics.length > 1 ? 's' : ''}: ${g.nics.join(', ')}`
            : `NICs: ${Math.min(...g.nics)}-${Math.max(...g.nics)}`;

        // Determine if this group handles storage traffic (for DCB/QoS options)
        const isStorageGroup = (g.key === 'storage' || g.key === 'custom_storage' ||
                                g.key === 'all' || g.key === 'compute_storage' ||
                                g.key === 'custom_compute_storage' || g.key === 'custom_all');

        // DCB QoS Policy overrides for storage intents
        const dcbQosHtml = isStorageGroup ? `
            <div class="config-row" style="margin-top:1rem;border-top:1px solid var(--glass-border);padding-top:0.75rem;">
                <span class="config-label" style="font-weight:600;color:var(--accent-blue);">DCB QoS Overrides</span>
            </div>
            <div class="config-row" style="margin-top:0.5rem;">
                <span class="config-label">Storage Priority (SMB)</span>
                <select class="speed-select" data-override-group="${g.key}" data-override-key="dcbStoragePriority">
                    <option value="" ${!ov.dcbStoragePriority ? 'selected' : ''}>Default (3)</option>
                    <option value="3" ${ov.dcbStoragePriority === '3' ? 'selected' : ''}>3</option>
                    <option value="4" ${ov.dcbStoragePriority === '4' ? 'selected' : ''}>4</option>
                </select>
            </div>
            <div class="config-row" style="margin-top:0.5rem;">
                <span class="config-label">System/Cluster Priority</span>
                <select class="speed-select" data-override-group="${g.key}" data-override-key="dcbSystemPriority">
                    <option value="" ${!ov.dcbSystemPriority ? 'selected' : ''}>Default (7)</option>
                    <option value="5" ${ov.dcbSystemPriority === '5' ? 'selected' : ''}>5</option>
                    <option value="6" ${ov.dcbSystemPriority === '6' ? 'selected' : ''}>6</option>
                    <option value="7" ${ov.dcbSystemPriority === '7' ? 'selected' : ''}>7</option>
                </select>
            </div>
            <div class="config-row" style="margin-top:0.5rem;">
                <span class="config-label">Storage Bandwidth %</span>
                <select class="speed-select" data-override-group="${g.key}" data-override-key="dcbStorageBandwidth">
                    <option value="" ${!ov.dcbStorageBandwidth ? 'selected' : ''}>Default (50%)</option>
                    <option value="40" ${ov.dcbStorageBandwidth === '40' ? 'selected' : ''}>40%</option>
                    <option value="50" ${ov.dcbStorageBandwidth === '50' ? 'selected' : ''}>50%</option>
                    <option value="60" ${ov.dcbStorageBandwidth === '60' ? 'selected' : ''}>60%</option>
                    <option value="70" ${ov.dcbStorageBandwidth === '70' ? 'selected' : ''}>70%</option>
                </select>
            </div>
        ` : '';

        const storageVlanCount = getStorageVlanOverrideNetworkCount();
        const storageVlanHtml = (g.key === 'storage' || g.key === 'custom_storage' || g.key === 'all') ? (() => {
            if (storageVlanCount <= 0) return '';

            let html = '';
            for (let n = 1; n <= storageVlanCount; n++) {
                const vlanKey = `storageNetwork${n}VlanId`;
                html += `
                    <div class="config-row" style="margin-top:0.75rem;">
                        <span class="config-label">Storage Network ${n} VLAN ID</span>
                        <input type="number" min="1" max="4096" class="speed-select" value="${(ov[vlanKey] !== undefined && ov[vlanKey] !== null) ? ov[vlanKey] : ''}" data-override-group="${g.key}" data-override-key="${vlanKey}" />
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
                <select class="speed-select" data-override-group="${g.key}" data-override-key="rdmaMode" ${!groupHasRdma ? 'disabled title="No RDMA-capable NICs in this group"' : ''}>
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
            ${dcbQosHtml}
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
    } else if (key.startsWith('dcb')) {
        // DCB QoS policy overrides
        state.intentOverrides[groupKey].__touchedQos = true;
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

    const mapping = [];
    const pn = (i) => getPortDisplayName(i); // Use custom port names

    // If adapter mapping is confirmed, use the user's custom assignments
    if (state.adapterMappingConfirmed && state.adapterMapping && Object.keys(state.adapterMapping).length > 0) {
        const trafficNames = {
            'mgmt_compute': 'Management + Compute',
            'storage': 'Storage',
            'compute_storage': 'Compute + Storage',
            'mgmt': 'Management',
            'compute': 'Compute',
            'compute_1': 'Compute 1',
            'compute_2': 'Compute 2',
            'all': 'All Traffic'
        };
        for (let i = 1; i <= portCount; i++) {
            const assignment = state.adapterMapping[i];
            if (assignment && assignment !== 'pool') {
                mapping.push(`${pn(i)}: ${trafficNames[assignment] || assignment}`);
            }
        }
        return mapping.length > 0 ? mapping.join('<br>') : null;
    }

    if (intent === 'all_traffic') {
        for (let i = 1; i <= portCount; i++) {
            mapping.push(`${pn(i)}: Management + Compute + Storage`);
        }
    } else if (intent === 'mgmt_compute') {
        if (portCount === 2) {
            mapping.push(`${pn(1)}: Management + Compute`);
            mapping.push(`${pn(2)}: Storage`);
        } else {
            mapping.push(`${pn(1)}: Management + Compute`);
            mapping.push(`${pn(2)}: Management + Compute`);
            for (let i = 3; i <= portCount; i++) {
                mapping.push(`${pn(i)}: Storage`);
            }
        }
    } else if (intent === 'compute_storage') {
        mapping.push(`${pn(1)}: Management`);
        mapping.push(`${pn(2)}: Management`);
        for (let i = 3; i <= portCount; i++) {
            mapping.push(`${pn(i)}: Compute + Storage`);
        }
    }

    return mapping.length > 0 ? mapping.join('<br>') : null;
}

function getCustomNicMapping(customIntents, portCount) {
    if (!customIntents || !portCount) return null;

    const trafficNames = {
        'mgmt': 'Management',
        'compute': 'Compute',
        'compute_1': 'Compute 1',
        'compute_2': 'Compute 2',
        'storage': 'Storage',
        'mgmt_compute': 'Management + Compute',
        'compute_storage': 'Compute + Storage',
        'all': 'All Traffic',
        'unused': 'Unused'
    };

    const mapping = [];
    for (let i = 1; i <= portCount; i++) {
        const assignment = customIntents[i] || 'unused';
        if (assignment !== 'unused') {
            mapping.push(`${getPortDisplayName(i)}: ${trafficNames[assignment] || assignment}`);
        }
    }

    return mapping.length > 0 ? mapping.join('<br>') : 'No NICs assigned';
}

function updateStepIndicators() {
    const steps = [
        { id: 'step-1', validation: () => state.scenario !== null },
        { id: 'step-cloud', validation: () => state.region !== null },
        { id: 'step-local-region', validation: () => state.localInstanceRegion !== null },
        { id: 'step-2', validation: () => state.scale !== null },
        { id: 'step-3', validation: () => state.nodes !== null },
        { id: 'step-3-5', validation: () => state.witnessType !== null },
        { id: 'step-4', validation: () => {
            // 1-node clusters: require ToR switch selection (storage is implicit switched)
            if (state.nodes === '1') return state.torSwitchCount !== null;
            // Multi-node clusters: require storage selection
            return state.storage !== null;
        } },
        { id: 'step-5', validation: () => state.ports !== null },
        { id: 'step-6', validation: () => {
            // Intent must be selected
            if (!state.intent) return false;
            // For custom intent, adapter mapping must be confirmed
            if (state.intent === 'custom' && !state.customIntentConfirmed) return false;
            return true;
        } },
        { id: 'step-7', validation: () => state.outbound !== null },
        { id: 'step-8', validation: () => state.arc !== null },
        { id: 'step-9', validation: () => state.proxy !== null },
        { id: 'step-10', validation: () => {
            // IP assignment must be selected
            if (!state.ip) return false;
            // For static IP, all node IPs must be filled
            if (state.ip === 'static') {
                const nodeReadiness = getNodeSettingsReadiness();
                return nodeReadiness.ready;
            }
            // DHCP is complete immediately
            return true;
        } },
        { id: 'step-11', validation: () => state.infraVlan !== null },
        { id: 'step-12', validation: () => {
            // Infrastructure CIDR must be set
            if (!state.infraCidr) return false;
            // Infrastructure IP Pool (start and end) must be set
            if (!state.infra || !state.infra.start || !state.infra.end) return false;
            // Default Gateway is required for static IP
            if (state.ip === 'static' && !state.infraGateway) return false;
            return true;
        } },
        { id: 'step-5-5', validation: () => state.storagePoolConfiguration !== null },
        { id: 'step-13', validation: () => {
            // Identity option must be selected
            if (!state.activeDirectory) return false;
            // DNS servers required for both options
            if (!state.dnsServers || state.dnsServers.filter(s => s && String(s).trim()).length === 0) return false;
            // For Active Directory: domain name required
            if (state.activeDirectory === 'azure_ad' && !state.adDomain) return false;
            // For Local Identity (AD-Less): local DNS zone required
            if (state.activeDirectory === 'local_identity' && !state.localDnsZone) return false;
            return true;
        } },
        { id: 'step-13-5', validation: () => state.securityConfiguration !== null },
        { id: 'step-14', validation: () => {
            // SDN is complete if:
            // 1. User selected "No SDN" (sdnEnabled === 'no'), OR
            // 2. User selected "Enable SDN" AND selected features AND selected management type
            if (state.sdnEnabled === 'no') return true;
            if (state.sdnEnabled === 'yes') {
                // Must have features and management selected
                return state.sdnFeatures.length > 0 && state.sdnManagement !== null;
            }
            // sdnEnabled not yet selected
            return false;
        } }
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
        .replace(/"/g, '&quot;')
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
    if (state.scenario === 'disconnected' && state.clusterRole) {
        scenarioScaleRows += renderRow('Cluster Role', escapeHtml(state.clusterRole === 'management' ? 'Management Cluster' : 'Workload Cluster'));
        var _fqdn = state.autonomousCloudFqdn || '(not set)';
        scenarioScaleRows += renderRow('Autonomous Cloud FQDN', escapeHtml(_fqdn), { mono: true });
    } else {
        if (state.region) scenarioScaleRows += renderRow('Azure Cloud', escapeHtml(formatRegion(state.region)));
        if (state.localInstanceRegion) scenarioScaleRows += renderRow('Azure Local Instance Region', escapeHtml(formatLocalInstanceRegion(state.localInstanceRegion)));
    }
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
                for (let n = 1; n <= count; n++) {
                    const vlanKey = `storageNetwork${n}VlanId`;
                    const legacyKey = n === 1 ? 'storageVlanNic1' : (n === 2 ? 'storageVlanNic2' : undefined);
                    const vVal = (ov[vlanKey] !== undefined && ov[vlanKey] !== null)
                        ? ov[vlanKey]
                        : (legacyKey ? ov[legacyKey] : undefined);
                    if (vVal !== undefined && vVal !== null) {
                        hostNetworkingRows += renderRow(`Storage Network ${n} VLAN ID — ${g.label}`, escapeHtml(vVal), { mono: true });
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
    updateMissingSectionsDisplay();
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

    // Helper to determine traffic based on adapter mapping or defaults
    const getTraffic = (portIdx) => {
        // portIdx is 0-based, nic is 1-based
        const nic = portIdx + 1;
        if (!intent) return [];

        // If adapter mapping is confirmed, use it for all intent types
        if (state.adapterMappingConfirmed && state.adapterMapping && state.adapterMapping[nic]) {
            const mapping = state.adapterMapping[nic];
            if (mapping === 'mgmt') return ['m'];
            if (mapping === 'compute') return ['c'];
            if (mapping === 'storage') return ['s'];
            if (mapping === 'mgmt_compute') return ['m', 'c'];
            if (mapping === 'compute_storage') return ['c', 's'];
            if (mapping === 'all') return ['m', 'c', 's'];
            if (mapping === 'pool') return []; // unused
            return [];
        }

        // Fall back to default logic based on intent type
        if (intent === 'all_traffic') return ['m', 'c', 's'];
        if (intent === 'mgmt_compute') {
            // Special case: with 2 ports, NIC1 is Mgmt+Compute and NIC2 is Storage.
            if (p === 2) {
                return portIdx === 0 ? ['m', 'c'] : ['s'];
            }
            const assignment = getMgmtComputeNicAssignment(p);
            return assignment.mgmtCompute.includes(nic) ? ['m', 'c'] : ['s'];
        }
        if (intent === 'compute_storage') {
            if (portIdx < 2) return ['m'];
            return ['c', 's'];
        }
        if (intent === 'custom') {
            const val = (state.customIntents && state.customIntents[nic]) || 'unused';
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
                    portsHtml += '<div style="width:6px; height:14px; background:rgba(255,255,255,0.1); border-radius:2px;"></div>';
                } else {
                    const hasM = traffic.includes('m');
                    const hasC = traffic.includes('c');
                    const hasS = traffic.includes('s');
                    const isEmpty = traffic.length === 0;

                    if (isEmpty) {
                        portsHtml += '<div style="width:6px; height:14px; background:rgba(255,255,255,0.05); border-radius:2px; border:1px dashed rgba(255,255,255,0.2);" title="Unused"></div>';
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

// NOTE: Formatting functions moved to js/formatting.js:
// - getProxyLabel()
// - formatScenario()
// - formatScale()
// - formatOutbound()
// - formatIntent()
// - formatRegion()
// - formatLocalInstanceRegion()

// NOTE: capitalize() moved to js/utils.js

function getRequiredRdmaPortCount() {
    // Low Capacity is exempt from minimum RDMA port requirements in this wizard.
    if (state.scale === 'low_capacity') return 0;

    const n = parseInt(state.nodes, 10);

    // Standard (Hyperconverged) + Switchless topologies require more RDMA ports.
    if (state.scale === 'medium' && state.storage === 'switchless') {
        if (n === 3) return 4;
        if (n === 4) return 6;
    }

    // Default rule: require at least two RDMA-capable ports (including single-node).
    return 2;
}

/**
 * Get indices of ports that have duplicate adapter names.
 * Compares all port display names (custom or default) and returns indices of duplicates.
 * @returns {Set<number>} Set of 0-based port indices that have duplicate names
 */
function getDuplicateAdapterNameIndices() {
    const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];
    const portCount = cfg.length;
    const nameToIndices = new Map();

    // Build map of name -> indices
    for (let i = 0; i < portCount; i++) {
        const name = getPortDisplayName(i + 1).toLowerCase();
        if (!nameToIndices.has(name)) {
            nameToIndices.set(name, []);
        }
        nameToIndices.get(name).push(i);
    }

    // Collect indices of duplicates
    const duplicateIndices = new Set();
    for (const indices of nameToIndices.values()) {
        if (indices.length > 1) {
            indices.forEach(idx => duplicateIndices.add(idx));
        }
    }

    return duplicateIndices;
}

function renderPortConfiguration(count) {
    const container = document.getElementById('port-config-grid');
    container.innerHTML = '';

    const isConfirmed = state.portConfigConfirmed === true;
    const duplicateIndices = getDuplicateAdapterNameIndices();

    for (let i = 0; i < count; i++) {
        const config = state.portConfig[i];
        const displayName = getPortDisplayName(i + 1);
        const hasCustomName = config.customName && config.customName.trim();
        const isDuplicate = duplicateIndices.has(i);

        // Determine border color: red for duplicate, blue for custom, default otherwise
        const borderColor = isDuplicate ? '#ef4444' : (hasCustomName ? 'var(--accent-blue)' : 'rgba(255,255,255,0.15)');
        // Determine label: 'duplicate' warning or 'custom' indicator
        const labelHtml = isDuplicate
            ? '<span style="font-size:10px; color:#ef4444; font-weight:600;">⚠ duplicate</span>'
            : (hasCustomName ? '<span style="font-size:10px; color:var(--accent-blue); opacity:0.7;">custom</span>' : '');

        const card = document.createElement('div');
        card.className = `port-config-card ${config.rdma ? 'rdma-active' : ''} ${isConfirmed ? 'confirmed' : ''}`;
        card.innerHTML = `
            <div class="port-name-row" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                <div class="port-name-display" style="display:flex; align-items:center; gap:6px;">
                    <input type="text"
                        class="port-name-input"
                        value="${escapeHtml(displayName)}"
                        placeholder="Port ${i + 1}"
                        maxlength="30"
                        ${isConfirmed ? 'readonly' : ''}
                        data-port-index="${i}"
                        style="background:${isConfirmed ? 'transparent' : 'rgba(255,255,255,0.05)'}; border:1px solid ${borderColor}; color:var(--text-primary); font-size:1rem; font-weight:600; padding:4px 8px; border-radius:4px; width:140px; transition:all 0.2s; cursor:${isConfirmed ? 'default' : 'text'};"
                        onchange="updatePortConfig(${i}, 'customName', this.value);"
                        onkeydown="if(event.key==='Enter'){this.blur();}"
                        title="${isDuplicate ? 'Duplicate adapter name - each port must have a unique name' : (isConfirmed ? 'Edit configuration to rename' : 'Enter custom port name')}">
                    ${config.rdma ? '<span style="color:var(--accent-purple); font-size:16px;">⚡</span>' : ''}
                </div>
                ${labelHtml}
            </div>
            <div class="config-row">
                <span class="config-label">Speed</span>
                <select class="speed-select" onchange="updatePortConfig(${i}, 'speed', this.value)" ${isConfirmed ? 'disabled' : ''}>
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
                        ${isConfirmed ? 'disabled' : ''}
                        onchange="updatePortConfig(${i}, 'rdma', this.checked)">
                    <span class="rdma-label">RDMA Capable</span>
                </label>
            </div>
        `;
        container.appendChild(card);
    }

    // Show/hide confirm button and confirmed message
    const confirmContainer = document.getElementById('port-config-confirm-container');
    const confirmedMsg = document.getElementById('port-config-confirmed-msg');
    if (confirmContainer && confirmedMsg) {
        if (isConfirmed) {
            confirmContainer.classList.add('hidden');
            confirmedMsg.classList.remove('hidden');
        } else {
            confirmContainer.classList.remove('hidden');
            confirmedMsg.classList.add('hidden');
        }
    }
}

// Confirm port configuration
function confirmPortConfiguration() {
    state.portConfigConfirmed = true;
    updateUI();
    showToast('Port configuration confirmed', 'success');
}

// Edit port configuration (reset confirmed state)
function editPortConfiguration() {
    state.portConfigConfirmed = false;
    updateUI();
}

function updatePortConfig(index, key, value) {
    if (state.portConfig && state.portConfig[index]) {
        // Handle custom name update
        if (key === 'customName') {
            const trimmed = String(value || '').trim();
            // If user clears the field or sets it to default "Port N", remove custom name
            if (!trimmed || trimmed === `Port ${index + 1}`) {
                state.portConfig[index].customName = null;
            } else {
                state.portConfig[index].customName = trimmed;
            }
            updateUI();

            // Check for duplicates after UI update and show warning toast
            const duplicates = getDuplicateAdapterNameIndices();
            if (duplicates.size > 0) {
                showToast('Duplicate adapter names detected. Each port must have a unique name.', 'warning');
            }
            return;
        }

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
                    err.innerText = 'Invalid IPv4 address format.';
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
                err.innerText = 'Invalid IPv4 address format.';
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
            err.innerText = 'Ending IP must be greater than or equal to Starting IP.';
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
    for (const r of reservedRanges) {
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
    // Reset all state properties to initial values
    state.scenario = null;
    state.region = null;
    state.localInstanceRegion = null;
    state.scale = null;
    state.nodes = null;
    state.witnessType = null;
    state.ports = null;
    state.storage = null;
    state.torSwitchCount = null;
    state.switchlessLinkMode = null;
    state.storagePoolConfiguration = null;
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
    state.nodeSettings = [];
    state.infraVlan = null;
    state.infraVlanId = null;
    state.storageAutoIp = null;
    state.customStorageSubnets = [];
    state.customStorageSubnetsConfirmed = false;
    state.activeDirectory = null;
    state.adDomain = null;
    state.adOuPath = null;
    state.adfsServerName = null;
    state.dnsServers = [];
    state.localDnsZone = null;
    state.dnsServiceExisting = null;
    state.sdnEnabled = null;
    state.sdnFeatures = [];
    state.sdnManagement = null;
    state.intentOverrides = {};
    state.customIntents = {};
    state.adapterMapping = {};
    state.adapterMappingConfirmed = false;
    state.adapterMappingSelection = null;
    state.overridesConfirmed = false;
    state.securityConfiguration = null;
    state.securitySettings = {
        driftControlEnforced: true,
        bitlockerBootVolume: true,
        bitlockerDataVolumes: true,
        wdacEnforced: true,
        credentialGuardEnforced: true,
        smbSigningEnforced: true,
        smbClusterEncryption: true
    };
    state.rdmaGuardMessage = null;
    state.privateEndpoints = null;
    state.privateEndpointsList = [];
    state.portConfig = [];

    // Clear input fields
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

    const sdnFeaturesSection = document.getElementById('sdn-features-section');
    if (sdnFeaturesSection) sdnFeaturesSection.classList.add('hidden');

    document.querySelectorAll('.sdn-feature-card input[type="checkbox"]').forEach(cb => cb.checked = false);

    // Reset PE checkboxes
    document.querySelectorAll('#pe-options-grid input[type="checkbox"]').forEach(cb => cb.checked = false);

    renderDnsServers();

    const ids = ['infra-ip-error', 'infra-ip-success', 'infra-gateway-error', 'infra-gateway-success', 'china-warning', 'disconnected-region-info', 'disconnected-cloud-context', 'proxy-warning', 'dhcp-warning', 'ip-subnet-warning', 'multirack-message'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.classList.remove('visible');
        }
    });

    // Remove selected state from all option cards
    document.querySelectorAll('.option-card.selected').forEach(card => {
        card.classList.remove('selected');
    });

    // Clear localStorage
    clearSavedState();

    // Update UI to reflect clean state
    updateUI();

    // Scroll to top of page (to step 1)
    window.scrollTo({ top: 0, behavior: 'smooth' });

    showToast('Started fresh - all previous data cleared', 'info');
}

// NOTE: DNS management functions moved to js/dns.js
// - addDnsServer, removeDnsServer, updateDnsServer, renderDnsServers
// - updateDnsServiceExistingNote, updateDnsServiceExisting
// - validateAllDnsServers, updateLocalDnsZone

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

    const trimmedPath = ouPath.trim();

    // Must start with "OU="
    if (!trimmedPath.toUpperCase().startsWith('OU=')) {
        return {
            valid: false,
            error: 'OU path must start with "OU=" (e.g., OU=Cluster1,OU=AzureLocal,DC=contoso,DC=com)'
        };
    }

    // Basic OU path validation: must contain OU= and DC= components
    const ouPathPattern = /^(OU=[^,]+,)+(CN=[^,]+,)*(OU=[^,]+,)*DC=[^,]+(,DC=[^,]+)*$/i;

    if (!ouPathPattern.test(trimmedPath)) {
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

// Parse an Azure ARM template and convert it to Odin wizard state
function parseArmTemplateToState(armTemplate) {
    const result = {};

    // Check if this is an ARM template
    const isArmTemplate = armTemplate.$schema &&
        (armTemplate.$schema.includes('deploymentTemplate') || armTemplate.$schema.includes('deploymentParameters'));

    if (!isArmTemplate) {
        return null;
    }

    // Get parameters - could be in 'parameters' directly or in nested structure
    let params = armTemplate.parameters || {};

    // If this is a parameters file, extract values
    const isParametersFile = armTemplate.$schema && armTemplate.$schema.includes('deploymentParameters');
    if (isParametersFile) {
        // Parameters file format: { "paramName": { "value": actualValue } }
        const extractedParams = {};
        Object.keys(params).forEach(key => {
            if (params[key] && params[key].value !== undefined) {
                extractedParams[key] = params[key].value;
            } else if (params[key] && params[key].defaultValue !== undefined) {
                extractedParams[key] = params[key].defaultValue;
            }
        });
        params = extractedParams;
    } else {
        // Template file format: { "paramName": { "defaultValue": actualValue } }
        const extractedParams = {};
        Object.keys(params).forEach(key => {
            if (params[key] && params[key].defaultValue !== undefined) {
                extractedParams[key] = params[key].defaultValue;
            }
        });
        params = extractedParams;
    }

    // Map ARM parameters to Odin state

    // Scenario - detect from template structure
    result.scenario = 'hyperconverged'; // Default

    // Node count from arcNodeResourceIds or physicalNodesSettings
    if (params.arcNodeResourceIds && Array.isArray(params.arcNodeResourceIds)) {
        const nodeCount = params.arcNodeResourceIds.length;
        result.nodes = String(nodeCount);
    } else if (params.physicalNodesSettings && Array.isArray(params.physicalNodesSettings)) {
        const nodeCount = params.physicalNodesSettings.length;
        result.nodes = String(nodeCount);
    }

    // Node settings from physicalNodesSettings
    if (params.physicalNodesSettings && Array.isArray(params.physicalNodesSettings)) {
        result.nodeSettings = params.physicalNodesSettings.map(node => ({
            name: node.name || '',
            ipCidr: node.ipv4Address ? `${node.ipv4Address}/24` : ''
        }));
    }

    // Witness type
    if (params.witnessType) {
        result.witnessType = params.witnessType;
    }

    // Domain FQDN
    if (params.domainFqdn) {
        result.adDomain = params.domainFqdn;
        result.activeDirectory = 'azure_ad';
    }

    // DNS servers
    if (params.dnsServers && Array.isArray(params.dnsServers)) {
        result.dnsServers = params.dnsServers.filter(d => d && d.trim());
    }

    // Network settings
    if (params.subnetMask) {
        // Convert subnet mask to CIDR
        const maskToCidr = {
            '255.255.255.0': '/24',
            '255.255.254.0': '/23',
            '255.255.252.0': '/22',
            '255.255.248.0': '/21',
            '255.255.240.0': '/20',
            '255.255.0.0': '/16'
        };
        const cidrSuffix = maskToCidr[params.subnetMask] || '/24';
        if (params.startingIPAddress) {
            const ipParts = params.startingIPAddress.split('.');
            if (ipParts.length === 4) {
                ipParts[3] = '0';
                result.infraCidr = ipParts.join('.') + cidrSuffix;
            }
        }
    }

    // IP pool
    if (params.startingIPAddress && params.endingIPAddress) {
        result.infra = {
            start: params.startingIPAddress,
            end: params.endingIPAddress
        };
    }

    // Default gateway
    if (params.defaultGateway) {
        result.infraGateway = params.defaultGateway;
    }

    // DHCP or static
    if (params.useDhcp !== undefined) {
        result.ip = params.useDhcp ? 'dhcp' : 'static';
    }

    // Storage configuration
    if (params.configurationMode) {
        result.storagePoolConfiguration = params.configurationMode;
    }

    // Networking type - switchless or switched
    if (params.networkingType) {
        if (params.networkingType.toLowerCase().includes('switchless')) {
            result.storage = 'switchless';
        } else {
            result.storage = 'switched';
        }
    }

    if (params.storageConnectivitySwitchless !== undefined) {
        result.storage = params.storageConnectivitySwitchless ? 'switchless' : 'switched';
    }

    // Storage auto IP
    if (params.enableStorageAutoIp !== undefined) {
        result.storageAutoIp = params.enableStorageAutoIp ? 'enabled' : 'disabled';
    }

    // Networking pattern to intent - use as initial hint, then override from actual intentList
    if (params.networkingPattern) {
        const patternToIntent = {
            'hyperConverged': 'all_traffic',
            'convergedManagementCompute': 'mgmt_compute',
            'convergedComputeStorage': 'compute_storage',
            'custom': 'custom'
        };
        result.intent = patternToIntent[params.networkingPattern] || 'compute_storage';
    }

    // Override intent from actual intentList traffic types (more reliable than networkingPattern)
    if (params.intentList && Array.isArray(params.intentList) && params.intentList.length > 0) {
        const trafficSets = params.intentList.map(intent => {
            const types = (intent.trafficType || []).map(t => t.toLowerCase()).sort();
            return types.join('+');
        });
        const allTypes = new Set();
        params.intentList.forEach(intent => {
            (intent.trafficType || []).forEach(t => allTypes.add(t.toLowerCase()));
        });
        const hasManagement = allTypes.has('management');
        const hasCompute = allTypes.has('compute');
        const hasStorage = allTypes.has('storage');

        if (params.intentList.length === 1 && hasManagement && hasCompute && hasStorage) {
            result.intent = 'all_traffic';
        } else if (params.intentList.length === 2) {
            const hasMgmtComputeIntent = trafficSets.some(s => s === 'compute+management');
            const hasStorageOnlyIntent = trafficSets.some(s => s === 'storage');
            const hasComputeStorageIntent = trafficSets.some(s => s === 'compute+storage');
            const hasMgmtOnlyIntent = trafficSets.some(s => s === 'management');

            if (hasMgmtComputeIntent && hasStorageOnlyIntent) {
                result.intent = 'mgmt_compute';
            } else if (hasComputeStorageIntent && hasMgmtOnlyIntent) {
                result.intent = 'compute_storage';
            } else {
                result.intent = 'custom';
            }
        } else if (params.intentList.length >= 3) {
            result.intent = 'custom';
        }
    }

    // Port count and custom adapter names from intentList
    if (params.intentList && Array.isArray(params.intentList)) {
        const nicAdapters = [];  // Non-storage adapters (NIC1, NIC2, or custom names)
        const smbAdapters = [];  // Storage adapters (SMB1, SMB2, or custom names)

        params.intentList.forEach(intent => {
            if (intent.adapter && Array.isArray(intent.adapter)) {
                const isStorageIntent = intent.trafficType &&
                    Array.isArray(intent.trafficType) &&
                    intent.trafficType.length === 1 &&
                    intent.trafficType[0] === 'Storage';

                intent.adapter.forEach(a => {
                    if (isStorageIntent) {
                        // Storage-only intent uses SMB adapters
                        if (!smbAdapters.includes(a)) {
                            smbAdapters.push(a);
                        }
                    } else {
                        // Non-storage intents use NIC adapters
                        if (!nicAdapters.includes(a)) {
                            nicAdapters.push(a);
                        }
                    }
                });
            }
        });

        // Determine port count from NIC adapters (primary port count indicator)
        const portCount = nicAdapters.length || smbAdapters.length;
        result.ports = String(portCount);

        // Build portConfig with adapter names from imported template
        // Always preserve adapter names from the template - they are meaningful identifiers
        if (nicAdapters.length > 0 || smbAdapters.length > 0) {
            result.portConfig = [];

            // Map NIC adapters to ports - always preserve adapter names from template
            nicAdapters.forEach((name, idx) => {
                result.portConfig.push({
                    speed: '25GbE',  // Default speed, will be adjusted by updateUI based on scale
                    rdma: true,      // Default RDMA enabled
                    rdmaMode: 'RoCEv2',
                    rdmaManual: false,
                    customName: name  // Always use the adapter name from the template
                });
            });

            // Add SMB adapter names to storage ports (ports after NIC adapters)
            // For typical config: ports 1-2 are NIC, ports 3+ are SMB
            if (smbAdapters.length > 0 && nicAdapters.length > 0) {
                smbAdapters.forEach((name, idx) => {
                    result.portConfig.push({
                        speed: '25GbE',
                        rdma: true,
                        rdmaMode: 'RoCEv2',
                        rdmaManual: false,
                        customName: name  // Always use the adapter name from the template
                    });
                });
                // Update port count to include storage ports
                result.ports = String(nicAdapters.length + smbAdapters.length);

                // Build adapter mapping from intent list
                // NIC adapters (1-based indices) go to 'mgmt_compute' zone, SMB adapters go to 'storage'
                // Note: zone key must be 'mgmt_compute' (not 'mgmt') to match the intent zones for mgmt_compute intent
                result.adapterMapping = {};
                for (let i = 1; i <= nicAdapters.length; i++) {
                    result.adapterMapping[i] = 'mgmt_compute';
                }
                for (let i = 1; i <= smbAdapters.length; i++) {
                    result.adapterMapping[nicAdapters.length + i] = 'storage';
                }
            }

            // If no NIC adapters but we have SMB adapters, create ports from SMB count
            if (nicAdapters.length === 0 && smbAdapters.length > 0) {
                for (let i = 0; i < smbAdapters.length; i++) {
                    const name = smbAdapters[i];
                    result.portConfig.push({
                        speed: '25GbE',
                        rdma: true,
                        rdmaMode: 'RoCEv2',
                        rdmaManual: false,
                        customName: name  // Always use the adapter name from the template
                    });
                }
            }
        }
    }

    // Import storage VLANs and custom storage subnets from storageNetworkList
    if (params.storageNetworkList && Array.isArray(params.storageNetworkList) && params.storageNetworkList.length > 0) {
        // Determine the override key based on the detected intent
        const vlanOverrideKey = (() => {
            if (result.intent === 'all_traffic') return 'all';
            if (result.intent === 'custom') return 'custom_storage';
            if (result.intent === 'compute_storage') return 'compute_storage';
            return 'storage'; // mgmt_compute default
        })();

        if (!result.intentOverrides) result.intentOverrides = {};
        if (!result.intentOverrides[vlanOverrideKey]) result.intentOverrides[vlanOverrideKey] = {};

        // Import VLANs for all N storage networks
        for (let i = 0; i < params.storageNetworkList.length; i++) {
            const storageNet = params.storageNetworkList[i];
            if (storageNet && storageNet.vlanId) {
                result.intentOverrides[vlanOverrideKey][`storageNetwork${i + 1}VlanId`] = Number(storageNet.vlanId);
            }
        }

        // Import custom storage subnets from storageNetworkList IP/mask info
        if (result.storageAutoIp === 'disabled' || params.enableStorageAutoIp === false) {
            const maskToCidr = {
                '255.255.255.0': 24, '255.255.255.128': 25, '255.255.255.192': 26,
                '255.255.255.224': 27, '255.255.255.240': 28, '255.255.255.248': 29,
                '255.255.254.0': 23, '255.255.252.0': 22, '255.255.248.0': 21,
                '255.255.240.0': 20, '255.255.0.0': 16
            };
            result.customStorageSubnets = [];
            params.storageNetworkList.forEach(net => {
                if (net.storageAdapterIPInfo && Array.isArray(net.storageAdapterIPInfo) && net.storageAdapterIPInfo.length > 0) {
                    const firstNode = net.storageAdapterIPInfo[0];
                    const ip = firstNode.ipv4Address || '';
                    const mask = firstNode.subnetMask || '255.255.255.0';
                    const cidrBits = maskToCidr[mask] || 24;
                    // Calculate network address from IP and mask
                    if (ip) {
                        const ipParts = ip.split('.').map(Number);
                        const maskParts = mask.split('.').map(Number);
                        const networkParts = ipParts.map((p, i) => p & maskParts[i]);
                        result.customStorageSubnets.push(networkParts.join('.') + '/' + cidrBits);
                    }
                }
            });
            if (result.customStorageSubnets.length > 0) {
                result.customStorageSubnetsConfirmed = true;
            }
        }
    }

    // Import RDMA and adapter property overrides from intentList
    if (params.intentList && Array.isArray(params.intentList)) {
        params.intentList.forEach(intent => {
            if (intent.adapterPropertyOverrides) {
                const props = intent.adapterPropertyOverrides;
                // Detect RDMA mode from storage intent
                const isStorageIntent = intent.trafficType &&
                    Array.isArray(intent.trafficType) &&
                    intent.trafficType.length === 1 &&
                    intent.trafficType[0] === 'Storage';
                if (isStorageIntent || (intent.trafficType && intent.trafficType.includes('Storage'))) {
                    if (props.networkDirect === 'Enabled' && props.networkDirectTechnology) {
                        // Apply RDMA mode to portConfig for storage ports
                        if (result.portConfig) {
                            result.portConfig.forEach(pc => {
                                pc.rdma = true;
                                pc.rdmaMode = props.networkDirectTechnology;
                            });
                        }
                    } else if (props.networkDirect === 'Disabled') {
                        if (result.portConfig) {
                            result.portConfig.forEach(pc => {
                                pc.rdma = false;
                            });
                        }
                    }
                }
            }
        });
    }

    // Security settings
    if (params.securityLevel) {
        result.securityConfiguration = params.securityLevel.toLowerCase() === 'recommended' ? 'recommended' : 'customized';
    }

    result.securitySettings = {
        driftControlEnforced: params.driftControlEnforced !== undefined ? params.driftControlEnforced : true,
        credentialGuardEnforced: params.credentialGuardEnforced !== undefined ? params.credentialGuardEnforced : true,
        smbSigningEnforced: params.smbSigningEnforced !== undefined ? params.smbSigningEnforced : true,
        smbClusterEncryption: params.smbClusterEncryption !== undefined ? params.smbClusterEncryption : true,
        bitlockerBootVolume: params.bitlockerBootVolume !== undefined ? params.bitlockerBootVolume : true,
        bitlockerDataVolumes: params.bitlockerDataVolumes !== undefined ? params.bitlockerDataVolumes : true,
        wdacEnforced: params.wdacEnforced !== undefined ? params.wdacEnforced : true
    };

    // OU Path
    if (params.adouPath) {
        result.adOuPath = params.adouPath;
    }

    // Cluster pattern - Rack Aware and Local Availability Zones
    if (params.clusterPattern && params.clusterPattern === 'RackAware') {
        result.scale = 'rack_aware';

        // Parse localAvailabilityZones into rackAwareZones state
        if (params.localAvailabilityZones && Array.isArray(params.localAvailabilityZones) && params.localAvailabilityZones.length >= 2) {
            const zone1 = params.localAvailabilityZones[0];
            const zone2 = params.localAvailabilityZones[1];
            const assignments = {};

            // Build node name to index mapping from physicalNodesSettings
            const nodeNames = (params.physicalNodesSettings || []).map(n => n.name);

            // Assign nodes to zones based on their index in physicalNodesSettings
            if (zone1.nodes && Array.isArray(zone1.nodes)) {
                zone1.nodes.forEach(nodeName => {
                    const idx = nodeNames.indexOf(nodeName);
                    if (idx >= 0) assignments[idx + 1] = 1; // 1-based index, zone 1
                });
            }
            if (zone2.nodes && Array.isArray(zone2.nodes)) {
                zone2.nodes.forEach(nodeName => {
                    const idx = nodeNames.indexOf(nodeName);
                    if (idx >= 0) assignments[idx + 1] = 2; // 1-based index, zone 2
                });
            }

            result.rackAwareZones = {
                zone1Name: zone1.localAvailabilityZoneName || 'Zone1',
                zone2Name: zone2.localAvailabilityZoneName || 'Zone2',
                assignments: assignments,
                nodeCount: nodeNames.length
            };
            result.rackAwareZonesConfirmed = true;
        }
    }

    // Set defaults for fields not in ARM template
    if (!result.region) result.region = 'azure_commercial';
    if (!result.localInstanceRegion) result.localInstanceRegion = 'east_us';
    if (!result.scale) {
        // Always default to Hyperconverged (medium), not Low Capacity (Issue #74)
        // Users must explicitly select Low Capacity if that's what they want
        result.scale = 'medium';
    }
    if (!result.outbound) result.outbound = 'public';
    if (!result.arc) result.arc = 'yes';
    if (!result.proxy) result.proxy = 'no_proxy';
    if (!result.infraVlan) result.infraVlan = 'default';

    return result;
}

/**
 * Show dialog to ask about settings not present in ARM templates (Issue #90)
 * This includes Arc Gateway, Proxy, SDN, and Private Endpoints settings which are not part of the ARM template schema
 */
function showArmImportOptionsDialog(armState) {
    const overlay = document.createElement('div');
    overlay.id = 'arm-import-options-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;backdrop-filter:blur(8px);';

    overlay.innerHTML = `
        <div style="background:var(--card-bg);border:2px solid var(--accent-blue);border-radius:16px;padding:28px;max-width:650px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
            <div style="text-align:center;margin-bottom:24px;">
                <div style="font-size:48px;margin-bottom:12px;">📥</div>
                <h2 style="margin:0 0 8px 0;color:var(--accent-blue);font-size:22px;">ARM Template Import Options</h2>
                <p style="color:var(--text-secondary);font-size:14px;margin:0;">
                    The following settings are not included in ARM templates.<br>Please specify them for your imported deployment.
                </p>
            </div>

            <!-- Arc Gateway -->
            <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:8px;">
                <label style="display:block;margin-bottom:10px;font-weight:600;color:var(--text-primary);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px;">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Is this deployment using Arc Gateway?
                </label>
                <div style="display:flex;gap:12px;">
                    <label style="flex:1;padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;text-align:center;transition:all 0.2s;">
                        <input type="radio" name="import-arc-gateway" value="yes" style="margin-right:6px;">
                        <span style="color:var(--text-primary);">Yes, Arc Gateway enabled</span>
                    </label>
                    <label style="flex:1;padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;text-align:center;transition:all 0.2s;">
                        <input type="radio" name="import-arc-gateway" value="no" checked style="margin-right:6px;">
                        <span style="color:var(--text-primary);">No, not using Arc Gateway</span>
                    </label>
                </div>
            </div>

            <!-- Enterprise Proxy -->
            <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:8px;">
                <label style="display:block;margin-bottom:10px;font-weight:600;color:var(--text-primary);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px;">
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                        <line x1="6" y1="6" x2="6.01" y2="6"/>
                        <line x1="6" y1="18" x2="6.01" y2="18"/>
                    </svg>
                    Is this deployment using Enterprise Proxy?
                </label>
                <div style="display:flex;gap:12px;">
                    <label style="flex:1;padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;text-align:center;transition:all 0.2s;">
                        <input type="radio" name="import-proxy" value="yes" style="margin-right:6px;">
                        <span style="color:var(--text-primary);">Yes, Proxy enabled</span>
                    </label>
                    <label style="flex:1;padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;text-align:center;transition:all 0.2s;">
                        <input type="radio" name="import-proxy" value="no" checked style="margin-right:6px;">
                        <span style="color:var(--text-primary);">No, direct internet</span>
                    </label>
                </div>
            </div>

            <!-- Private Endpoints -->
            <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:8px;">
                <label style="display:block;margin-bottom:10px;font-weight:600;color:var(--text-primary);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px;">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Is this deployment using Private Endpoints (Private Link)?
                </label>
                <div style="display:flex;gap:12px;margin-bottom:12px;">
                    <label style="flex:1;padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;text-align:center;transition:all 0.2s;">
                        <input type="radio" name="import-private-endpoints" value="yes" style="margin-right:6px;">
                        <span style="color:var(--text-primary);">Yes, Private Endpoints enabled</span>
                    </label>
                    <label style="flex:1;padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;text-align:center;transition:all 0.2s;">
                        <input type="radio" name="import-private-endpoints" value="no" checked style="margin-right:6px;">
                        <span style="color:var(--text-primary);">No, public endpoints</span>
                    </label>
                </div>
                <!-- Private Endpoints Services List (hidden by default) -->
                <div id="import-pe-services" style="display:none;margin-top:12px;padding:12px;background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:6px;">
                    <p style="color:var(--text-secondary);font-size:13px;margin:0 0 12px 0;">Select the Azure services configured with Private Endpoints:</p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <label style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                            <input type="checkbox" name="import-pe-service" value="keyvault" style="margin-right:10px;">
                            <span style="color:var(--text-primary);font-size:13px;">🔐 Key Vault</span>
                        </label>
                        <label style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                            <input type="checkbox" name="import-pe-service" value="storage" style="margin-right:10px;">
                            <span style="color:var(--text-primary);font-size:13px;">📦 Storage Account</span>
                        </label>
                        <label style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                            <input type="checkbox" name="import-pe-service" value="acr" style="margin-right:10px;">
                            <span style="color:var(--text-primary);font-size:13px;">🐳 Container Registry</span>
                        </label>
                        <label style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                            <input type="checkbox" name="import-pe-service" value="asr" style="margin-right:10px;">
                            <span style="color:var(--text-primary);font-size:13px;">🔄 Site Recovery</span>
                        </label>
                        <label style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                            <input type="checkbox" name="import-pe-service" value="backup" style="margin-right:10px;">
                            <span style="color:var(--text-primary);font-size:13px;">💾 Azure Backup</span>
                        </label>
                        <label style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                            <input type="checkbox" name="import-pe-service" value="sql" style="margin-right:10px;">
                            <span style="color:var(--text-primary);font-size:13px;">🗄️ SQL Managed Instance</span>
                        </label>
                        <label style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                            <input type="checkbox" name="import-pe-service" value="defender" style="margin-right:10px;">
                            <span style="color:var(--text-primary);font-size:13px;">🛡️ Microsoft Defender</span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- SDN -->
            <div style="margin-bottom:24px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:8px;">
                <label style="display:block;margin-bottom:10px;font-weight:600;color:var(--text-primary);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px;">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                        <polyline points="2 17 12 22 22 17"/>
                        <polyline points="2 12 12 17 22 12"/>
                    </svg>
                    Is this deployment using SDN (Software Defined Networking)?
                </label>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <label style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                        <input type="radio" name="import-sdn" value="none" checked style="margin-right:8px;">
                        <span style="color:var(--text-primary);">No SDN</span>
                    </label>
                    <label style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                        <input type="radio" name="import-sdn" value="arc_lnet_nsg" style="margin-right:8px;">
                        <span style="color:var(--text-primary);">SDN Managed by Arc - Logical Networks & NSGs only</span>
                    </label>
                    <label style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                        <input type="radio" name="import-sdn" value="arc_full" style="margin-right:8px;">
                        <span style="color:var(--text-primary);">SDN Managed by Arc - Full (VNets, LNets, NSGs, SLBs)</span>
                    </label>
                    <label style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);border-radius:6px;cursor:pointer;transition:all 0.2s;">
                        <input type="radio" name="import-sdn" value="legacy" style="margin-right:8px;">
                        <span style="color:var(--text-primary);">SDN Legacy (Windows Admin Center managed)</span>
                    </label>
                </div>
            </div>

            <!-- Buttons -->
            <div style="display:flex;gap:12px;">
                <button id="arm-import-cancel-btn" type="button" style="flex:1;padding:14px;background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);color:var(--text-primary);border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;transition:all 0.2s;">
                    Cancel
                </button>
                <button id="arm-import-apply-btn" type="button" style="flex:2;padding:14px;background:linear-gradient(135deg,var(--accent-blue) 0%,var(--accent-purple) 100%);border:none;color:white;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;transition:all 0.2s;">
                    Import Template
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Add event listener for Private Endpoints toggle
    const peRadios = overlay.querySelectorAll('input[name="import-private-endpoints"]');
    const peServicesDiv = document.getElementById('import-pe-services');
    peRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const isYes = document.querySelector('input[name="import-private-endpoints"]:checked')?.value === 'yes';
            peServicesDiv.style.display = isYes ? 'block' : 'none';
        });
    });

    // Add event listeners
    document.getElementById('arm-import-cancel-btn').addEventListener('click', () => {
        overlay.remove();
        showToast('Import cancelled', 'info');
    });

    document.getElementById('arm-import-apply-btn').addEventListener('click', () => {
        // Get selected values
        const arcGateway = document.querySelector('input[name="import-arc-gateway"]:checked')?.value;
        const proxy = document.querySelector('input[name="import-proxy"]:checked')?.value;
        const privateEndpoints = document.querySelector('input[name="import-private-endpoints"]:checked')?.value;
        const sdn = document.querySelector('input[name="import-sdn"]:checked')?.value;

        // Apply selections to armState using correct state values
        // Arc: 'arc_gateway' or 'no_arc'
        // Proxy: 'proxy' or 'no_proxy'
        armState.arc = arcGateway === 'yes' ? 'arc_gateway' : 'no_arc';
        armState.proxy = proxy === 'yes' ? 'proxy' : 'no_proxy';

        // Private Endpoints: 'pe_enabled' or 'pe_disabled'
        if (privateEndpoints === 'yes') {
            armState.privateEndpoints = 'pe_enabled';
            // Get selected services
            const selectedServices = [];
            document.querySelectorAll('input[name="import-pe-service"]:checked').forEach(cb => {
                selectedServices.push(cb.value);
            });
            armState.privateEndpointsList = selectedServices;
        } else {
            armState.privateEndpoints = 'pe_disabled';
            armState.privateEndpointsList = [];
        }

        // Map SDN selection to state properties
        // Valid sdnManagement values: 'arc_managed' or 'onprem_managed'
        if (sdn === 'none') {
            armState.sdnEnabled = 'no';
            armState.sdnFeatures = [];
            armState.sdnManagement = null;
        } else if (sdn === 'arc_lnet_nsg') {
            armState.sdnEnabled = 'yes';
            armState.sdnFeatures = ['lnet', 'nsg'];
            armState.sdnManagement = 'arc_managed';
        } else if (sdn === 'arc_full') {
            armState.sdnEnabled = 'yes';
            armState.sdnFeatures = ['vnet', 'lnet', 'nsg', 'slb'];
            armState.sdnManagement = 'arc_managed';
        } else if (sdn === 'legacy') {
            armState.sdnEnabled = 'yes';
            armState.sdnFeatures = ['vnet', 'lnet', 'nsg', 'slb'];
            armState.sdnManagement = 'onprem_managed';
        }

        overlay.remove();

        // Now apply the ARM state with user selections
        applyArmImportState(armState);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
            showToast('Import cancelled', 'info');
        }
    });
}

/**
 * Apply ARM import state to the wizard (extracted from original inline code)
 */
function applyArmImportState(armState) {
    showToast('Importing ARM template...', 'info', 2000);

    setTimeout(() => {
        try {
            // Apply ARM state
            Object.keys(armState).forEach(key => {
                if (Object.prototype.hasOwnProperty.call(state, key) || key === 'nodeSettings' || key === 'infra') {
                    state[key] = armState[key];
                }
            });

            // Auto-confirm port configuration since this is from an existing deployment
            // The ARM template has complete port/adapter information
            if (state.ports && parseInt(state.ports, 10) > 0) {
                state.portConfigConfirmed = true;
            }

            // Auto-confirm adapter mapping for mgmt_compute intent
            // Build adapter mapping from intent list if not already present
            if (state.intent === 'mgmt_compute' && state.ports) {
                const portCount = parseInt(state.ports, 10) || 0;
                if (portCount >= 2) {
                    // Default mapping: first 2 ports for mgmt_compute zone, remaining for storage zone
                    // Note: zone key must be 'mgmt_compute' (not 'mgmt') to match intent zones
                    if (!state.adapterMapping || Object.keys(state.adapterMapping).length === 0) {
                        state.adapterMapping = {};
                        for (let i = 1; i <= portCount; i++) {
                            state.adapterMapping[i] = (i <= 2) ? 'mgmt_compute' : 'storage';
                        }
                    }
                    state.adapterMappingConfirmed = true;
                }
            }

            // Auto-confirm overrides since ARM template has complete configuration
            state.overridesConfirmed = true;

            // Auto-confirm custom storage subnets if present
            if (state.customStorageSubnets && state.customStorageSubnets.length > 0) {
                state.customStorageSubnetsConfirmed = true;
            }

            // Restore SDN UI elements based on imported state
            const sdnFeaturesSection = document.getElementById('sdn-features-section');
            if (sdnFeaturesSection) {
                if (state.sdnEnabled === 'yes') {
                    sdnFeaturesSection.classList.remove('hidden');
                } else {
                    sdnFeaturesSection.classList.add('hidden');
                }
            }

            // Restore SDN feature checkboxes
            if (state.sdnFeatures && state.sdnFeatures.length > 0) {
                state.sdnFeatures.forEach(feature => {
                    const checkbox = document.querySelector(`.sdn-feature-card[data-feature="${feature}"] input[type="checkbox"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }

            // Update SDN management options
            updateSdnManagementOptions();

            // Update UI
            try {
                updateUI();
                // Render DNS servers if imported (fixes Issue #64)
                if (state.dnsServers && state.dnsServers.length > 0) {
                    renderDnsServers();
                }
            } catch (uiErr) {
                console.error('UI update error during ARM import:', uiErr);
            }

            saveStateToLocalStorage();
            showToast('ARM template imported! Review and complete any missing fields.', 'success', 5000);
        } catch (applyErr) {
            showToast('Error applying ARM template', 'error');
            console.error('ARM import error:', applyErr);
        }
    }, 100);
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

                    // Check if this is an Azure ARM template
                    const armState = parseArmTemplateToState(imported);
                    if (armState) {
                        // This is an ARM template - show dialog to ask about settings not in ARM templates (Issue #90)
                        showArmImportOptionsDialog(armState);
                        return;
                    }

                    // Check if this is an Odin configuration export
                    if (!imported.state) {
                        showToast('Invalid configuration file. Expected Odin export or Azure ARM template.', 'error');
                        return;
                    }

                    // Show loading indicator
                    showToast('Importing configuration...', 'info', 2000);

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

                    // Use setTimeout to prevent blocking and allow UI to update
                    setTimeout(() => {
                        try {
                            // Apply imported state safely - only copy known properties
                            const safeKeys = Object.keys(state);
                            safeKeys.forEach(key => {
                                if (Object.prototype.hasOwnProperty.call(imported.state, key)) {
                                    state[key] = imported.state[key];
                                }
                            });

                            // Also copy any additional properties from import
                            Object.keys(imported.state).forEach(key => {
                                if (!safeKeys.includes(key)) {
                                    state[key] = imported.state[key];
                                }
                            });

                            // Update UI with error handling
                            try {
                                updateUI();
                                // Render DNS servers if imported (fixes Issue #64)
                                if (state.dnsServers && state.dnsServers.length > 0) {
                                    renderDnsServers();
                                }
                            } catch (uiErr) {
                                console.error('UI update error during import:', uiErr);
                            }

                            saveStateToLocalStorage();

                            if (changes.length > 0) {
                                showToast(`Configuration imported! Changed: ${changes.length} fields`, 'success', 5000);
                            } else {
                                showToast('Configuration imported successfully!', 'success');
                            }
                        } catch (applyErr) {
                            showToast('Error applying imported configuration', 'error');
                            console.error('Apply import error:', applyErr);
                        }
                    }, 100);

                } catch (err) {
                    showToast('Failed to parse configuration file', 'error');
                    console.error('Import error:', err);
                }
            };
            reader.onerror = () => {
                showToast('Failed to read configuration file', 'error');
            };
            reader.readAsText(file);
        };
        input.click();
    } catch (e) {
        showToast('Failed to import configuration', 'error');
        console.error('Import error:', e);
    }
}

// Check for and apply Sizer-to-Designer payload
function checkForSizerImport() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') !== 'sizer') return false;

    try {
        const raw = localStorage.getItem('odinSizerToDesigner');
        if (!raw) return false;

        const payload = JSON.parse(raw);
        if (!payload || payload.source !== 'sizer') return false;

        // Store hardware details as hidden state property
        if (payload.sizerHardware) {
            state.sizerHardware = payload.sizerHardware;
        }

        // Step 01: Always select Hyperconverged
        selectOption('scenario', 'hyperconverged');

        // Step 02: Always select Azure Commercial
        selectOption('region', 'azure_commercial');

        // Step 03: Default to East US
        selectOption('localInstanceRegion', 'east_us');

        // Step 04: Cluster Configuration based on sizer input
        if (payload.scale) {
            selectOption('scale', payload.scale);
        } else {
            selectOption('scale', 'medium');
        }

        // Step 05: Cluster Size from sizer
        if (payload.nodes) selectOption('nodes', String(payload.nodes));

        // Update UI to reflect imported values
        updateUI();
        saveStateToLocalStorage();

        // Clean up: remove the payload so it doesn't re-apply on next load
        localStorage.removeItem('odinSizerToDesigner');

        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Show confirmation banner
        const banner = document.createElement('div');
        banner.id = 'sizer-import-banner';
        banner.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            padding: 16px 24px;
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(59, 130, 246, 0.95));
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

        const hw = payload.sizerHardware || {};
        const details = `${hw.nodeCount || '?'} node(s) • ${hw.cpu ? hw.cpu.totalCores + ' cores' : ''} • ${hw.memory ? hw.memory.perNodeGB + ' GB RAM' : ''} per node`;

        banner.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 700; margin-bottom: 4px;">Sizer Configuration Imported</div>
                <div style="font-size: 12px; opacity: 0.9;">${details}</div>
                <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">⚠️ Azure region defaulted to East US, update above if needed</div>
            </div>
            <button onclick="this.parentElement.remove()" style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Dismiss</button>
        `;

        document.body.appendChild(banner);

        // Scroll to Step 05 (Cluster Size)
        setTimeout(() => {
            navigateToStep('step-3');
        }, 500);

        return true;
    } catch (e) {
        console.warn('Failed to import sizer configuration:', e);
        return false;
    }
}

// Show resume prompt on page load if saved state exists
function checkForSavedState() {
    // Skip on test page
    if (window.location.pathname.includes('/tests/') || window.location.pathname.includes('/tests')) {
        return;
    }

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
        <button onclick="startFresh()" style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Start Fresh</button>
    `;

    document.body.appendChild(banner);
}

function resumeSavedState() {
    const saved = loadStateFromLocalStorage();
    if (saved && saved.data) {
        Object.assign(state, saved.data);

        // Restore SDN enabled card selection
        if (state.sdnEnabled) {
            const sdnEnabledCard = document.getElementById(state.sdnEnabled === 'yes' ? 'sdn-enabled-yes' : 'sdn-enabled-no');
            if (sdnEnabledCard) {
                // Remove selected from both cards first
                const yesCard = document.getElementById('sdn-enabled-yes');
                const noCard = document.getElementById('sdn-enabled-no');
                if (yesCard) yesCard.classList.remove('selected');
                if (noCard) noCard.classList.remove('selected');
                sdnEnabledCard.classList.add('selected');
            }
        }

        // Restore SDN enabled state and features section visibility
        const sdnFeaturesSection = document.getElementById('sdn-features-section');
        if (sdnFeaturesSection) {
            if (state.sdnEnabled === 'yes') {
                sdnFeaturesSection.classList.remove('hidden');
            } else {
                sdnFeaturesSection.classList.add('hidden');
            }
        }

        // Restore SDN feature checkboxes
        if (state.sdnFeatures && state.sdnFeatures.length > 0) {
            state.sdnFeatures.forEach(feature => {
                const checkbox = document.querySelector(`.sdn-feature-card[data-feature="${feature}"] input[type="checkbox"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        // Update SDN management options visibility (must be BEFORE restoring selection)
        updateSdnManagementOptions();

        // Restore SDN management selection AFTER updateSdnManagementOptions
        // This ensures the management section is visible and cards are properly enabled
        if (state.sdnManagement) {
            const arcCard = document.getElementById('sdn-arc-card');
            const onpremCard = document.getElementById('sdn-onprem-card');
            // Clear any existing selection
            if (arcCard) arcCard.classList.remove('selected');
            if (onpremCard) onpremCard.classList.remove('selected');
            // Apply the saved selection
            const card = document.getElementById(state.sdnManagement === 'arc_managed' ? 'sdn-arc-card' : 'sdn-onprem-card');
            if (card && !card.classList.contains('disabled')) {
                card.classList.add('selected');
            }
        }

        updateUI();

        // Render DNS servers if present (fixes Issue #64)
        if (state.dnsServers && state.dnsServers.length > 0) {
            renderDnsServers();
        }

        // Preserve manual gateway flag so auto-suggest doesn't overwrite restored value
        if (state.infraGateway) {
            state.infraGatewayManual = true;
        }

        // Re-run infrastructure network validation after UI is restored
        // This ensures gateway and IP pool validations run with restored values
        if (state.infraCidr || state.infra || state.infraGateway) {
            setTimeout(() => {
                updateInfraNetwork();
            }, 100);
        }

        // Re-run DNS validation after restore
        if (state.dnsServers && state.dnsServers.length > 0) {
            validateAllDnsServers();
        }

        showToast('Session resumed successfully!', 'success');
    }
    dismissResumeBanner(false); // Don't scroll to top when resuming
}

function dismissResumeBanner(scrollToTop) {
    const banner = document.getElementById('resume-banner');
    if (banner) {
        banner.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => banner.remove(), 300);
    }
    // Scroll to top of page only when starting fresh
    if (scrollToTop !== false) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Start fresh - clear saved state and reset all inputs
function startFresh() {
    // Clear localStorage
    clearSavedState();

    // Reset the global state object to initial values
    Object.keys(state).forEach(key => {
        if (key === 'theme' || key === 'fontSize') return; // Keep theme/font preferences
        if (Array.isArray(state[key])) {
            state[key] = [];
        } else if (key === 'securitySettings') {
            state[key] = {
                driftControlEnforced: true,
                bitlockerBootVolume: true,
                bitlockerDataVolumes: true,
                wdacEnforced: true,
                credentialGuardEnforced: true,
                smbSigningEnforced: true,
                smbClusterEncryption: true
            };
        } else if (key === 'infra' || key === 'intentOverrides' || key === 'customIntents' || key === 'adapterMapping') {
            // These object properties should be null or empty object initially
            state[key] = (key === 'infra') ? null : {};
        } else if (typeof state[key] === 'boolean') {
            state[key] = key === 'infraCidrAuto' ? true : false;
        } else {
            state[key] = null;
        }
    });

    // Dismiss the banner and scroll to top
    dismissResumeBanner(true);

    // Update UI to reflect clean state
    updateUI();

    // Clear all input fields AFTER updateUI to ensure they stay cleared
    const infraCidrInput = document.getElementById('infra-cidr');
    const infraStartInput = document.getElementById('infra-ip-start');
    const infraEndInput = document.getElementById('infra-ip-end');
    const infraGatewayInput = document.getElementById('infra-default-gateway');
    const adDomainInput = document.getElementById('ad-domain');
    const adOuPathInput = document.getElementById('ad-ou-path');
    const adfsServerInput = document.getElementById('adfs-server-name');
    const infraVlanIdInput = document.getElementById('infra-vlan-id');
    const localDnsZoneInput = document.getElementById('local-dns-zone-input');

    if (infraCidrInput) infraCidrInput.value = '';
    if (infraStartInput) infraStartInput.value = '';
    if (infraEndInput) infraEndInput.value = '';
    if (infraGatewayInput) infraGatewayInput.value = '';
    if (adDomainInput) adDomainInput.value = '';
    if (adOuPathInput) adOuPathInput.value = '';
    if (adfsServerInput) adfsServerInput.value = '';
    if (infraVlanIdInput) infraVlanIdInput.value = '';
    if (localDnsZoneInput) localDnsZoneInput.value = '';

    // Hide sections that should only show after selections are made
    const adDomainSection = document.getElementById('ad-domain-section');
    const dnsConfigSection = document.getElementById('dns-config-section');
    const localDnsZone = document.getElementById('local-dns-zone');
    const adfsSection = document.getElementById('adfs-server-section');

    if (adDomainSection) adDomainSection.classList.add('hidden');
    if (dnsConfigSection) dnsConfigSection.classList.add('hidden');
    if (localDnsZone) localDnsZone.classList.add('hidden');
    if (adfsSection) adfsSection.classList.add('hidden');

    // Remove selected state from all option cards
    document.querySelectorAll('.option-card.selected').forEach(card => {
        card.classList.remove('selected');
    });

    showToast('Started fresh - all previous data cleared', 'info');
}

// NOTE: Validation functions moved to js/validation.js:
// - validateFieldRealtime()
// - addValidationFeedback()

// NOTE: IP conversion utilities (ipToLong, longToIp) have been moved to js/utils.js

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
                <button onclick="this.closest('div[style*=&quot;position: fixed&quot;]').remove()" style="background: transparent; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <p style="color: var(--text-primary); line-height: 1.6; margin: 0;">${escapeHtml(info.content)}</p>
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
        'outbound': state.scenario === 'disconnected' ? {
            title: 'Disconnected Outbound Connectivity Comparison',
            options: [
                {
                    name: '🚫 Air Gapped',
                    pros: ['Complete network isolation from the internet', 'Highest security posture for sensitive environments', 'No risk of external data exfiltration', 'Meets strictest regulatory and compliance requirements'],
                    useCases: ['Classified or top-secret environments', 'Critical infrastructure with strict isolation mandates', 'Regulatory requirements prohibiting any internet connectivity', 'Environments where zero external communication is required'],
                    recommended: 'For environments requiring complete network isolation'
                },
                {
                    name: 'ℹ️ Limited Connectivity',
                    pros: ['Restricted internet access with controlled endpoints', 'Enables log collection from disconnected operations appliance', 'Balances security with operational flexibility'],
                    useCases: ['Government and regulated industries with controlled egress', 'Environments allowing limited, approved internet access', 'Organizations needing remote management capabilities', 'Deployments requiring periodic cloud sync for updates'],
                    recommended: 'For disconnected environments that allow restricted internet access'
                }
            ]
        } : {
            title: 'Outbound Connectivity Comparison',
            options: [
                {
                    name: '🌐 Public Path',
                    pros: ['Simpler initial setup', 'Lower cost (no ExpressRoute/VPN required)', 'Uses existing on-premises proxy/firewall infrastructure', 'Multiple configuration options (4 scenarios)'],
                    cons: ['Requires public internet egress', 'Traffic routes through public endpoints', 'More firewall rules if not using Arc Gateway'],
                    useCases: ['Standard deployments with reliable internet', 'Existing on-premises proxy/firewall infrastructure', 'Cost-sensitive environments', 'Public internet egress acceptable per security policy'],
                    recommended: 'For most deployments with internet connectivity'
                },
                {
                    name: '🔐 Private Path (ExpressRoute)',
                    pros: ['Zero public internet exposure', 'Traffic stays on private network', 'Azure Firewall provides centralized security', 'Highest security posture', 'Compliance-friendly for regulated industries'],
                    cons: ['Higher cost (ExpressRoute + Azure Firewall)', 'More complex initial setup', 'Requires Arc Gateway + Azure Firewall Explicit Proxy', 'ExpressRoute or Site-to-Site VPN required'],
                    useCases: ['Zero public internet exposure required', 'Government, healthcare, financial industries', 'Existing ExpressRoute or Site-to-Site VPN', 'Regulatory/compliance requirements mandate private connectivity'],
                    recommended: 'For high-security environments requiring no public internet'
                }
            ]
        },
        'arc': {
            title: 'Azure Arc Gateway Comparison',
            options: [
                {
                    name: 'Arc Gateway Enabled',
                    pros: ['Reduces firewall rules from hundreds to fewer than 30 endpoints', 'Enhanced security posture', 'Simpler firewall management', 'Required for Private Path (ExpressRoute)'],
                    cons: ['Additional Arc Gateway resource required', 'Slightly more complex initial setup'],
                    useCases: ['Security-focused deployments', 'Limited internet egress policies', 'Private Path (ExpressRoute) deployments', 'Simplified firewall rule management'],
                    recommended: 'Recommended for all deployments'
                },
                {
                    name: 'Arc Gateway Disabled',
                    pros: ['Simpler initial configuration', 'One less Azure resource to manage'],
                    cons: ['Hundreds of firewall rules required', 'More endpoints to manage and troubleshoot', 'Not supported for Private Path (ExpressRoute)'],
                    useCases: ['Simple deployments with unrestricted internet', 'Testing and development environments'],
                    recommended: 'For simple deployments only'
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

                ${option.cons && option.cons.length ? `<div style="margin-bottom: 12px;">
                    <strong style="color: #ef4444;">✗ Cons:</strong>
                    <ul style="margin: 6px 0 0 20px; padding: 0;">
                        ${option.cons.map(con => `<li style="margin: 4px 0; color: var(--text-primary);">${escapeHtml(con)}</li>`).join('')}
                    </ul>
                </div>` : ''}

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
        <div style="background: var(--card-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; position: sticky; top: 0; background: var(--card-bg); padding-bottom: 12px; border-bottom: 1px solid var(--glass-border);">
                <h3 style="margin: 0; color: var(--accent-blue);">${escapeHtml(comparison.title)}</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: rgba(255,255,255,0.1); border: 1px solid var(--glass-border); color: var(--text-primary); font-size: 20px; cursor: pointer; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.2)'; this.style.borderColor='#ef4444'; this.style.color='#ef4444';" onmouseout="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='var(--glass-border)'; this.style.color='var(--text-primary)';">&times;</button>
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
                scale: 'medium',
                nodes: '2',
                witnessType: 'Cloud',
                ports: '4',
                portConfig: [
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '25GbE', rdma: true, rdmaMode: 'RoCEv2', rdmaManual: true },
                    { speed: '25GbE', rdma: true, rdmaMode: 'RoCEv2', rdmaManual: true }
                ],
                storage: 'switched',
                storagePoolConfiguration: 'Express',
                intent: 'compute_storage',
                storageAutoIp: 'enabled',
                outbound: 'public',
                arc: 'arc_gateway',
                proxy: 'no_proxy',
                ip: 'static',
                infraCidr: '192.168.1.0/24',
                infra: { start: '192.168.1.10', end: '192.168.1.20' },
                nodeSettings: [
                    { name: 'node1', ipCidr: '192.168.1.2/24' },
                    { name: 'node2', ipCidr: '192.168.1.3/24' }
                ],
                infraGateway: '192.168.1.1',
                infraVlan: 'default',
                activeDirectory: 'azure_ad',
                adDomain: 'contoso.local',
                adOuPath: 'OU=AzureLocal,DC=contoso,DC=local',
                dnsServers: ['192.168.1.1'],
                privateEndpoints: 'pe_disabled',
                securityConfiguration: 'recommended',
                sdnEnabled: 'no'
            }
        },
        {
            name: '4-Node High Performance',
            description: 'Medium cluster with dedicated storage network for production workloads',
            config: {
                scenario: 'hyperconverged',
                region: 'azure_commercial',
                localInstanceRegion: 'east_us',
                scale: 'medium',
                nodes: '4',
                witnessType: 'Cloud',
                ports: '4',
                portConfig: [
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '25GbE', rdma: true, rdmaMode: 'RoCEv2', rdmaManual: true },
                    { speed: '25GbE', rdma: true, rdmaMode: 'RoCEv2', rdmaManual: true }
                ],
                storage: 'switched',
                storagePoolConfiguration: 'Express',
                intent: 'compute_storage',
                storageAutoIp: 'enabled',
                outbound: 'public',
                arc: 'arc_gateway',
                proxy: 'no_proxy',
                ip: 'static',
                infraCidr: '10.0.1.0/24',
                infra: { start: '10.0.1.50', end: '10.0.1.60' },
                nodeSettings: [
                    { name: 'hcinode1', ipCidr: '10.0.1.11/24' },
                    { name: 'hcinode2', ipCidr: '10.0.1.12/24' },
                    { name: 'hcinode3', ipCidr: '10.0.1.13/24' },
                    { name: 'hcinode4', ipCidr: '10.0.1.14/24' }
                ],
                infraGateway: '10.0.1.1',
                infraVlan: 'default',
                activeDirectory: 'azure_ad',
                adDomain: 'corp.contoso.com',
                adOuPath: 'OU=AzureLocal,DC=corp,DC=contoso,DC=com',
                dnsServers: ['10.0.1.1', '10.0.1.2'],
                privateEndpoints: 'pe_disabled',
                securityConfiguration: 'recommended',
                sdnEnabled: 'yes',
                sdnFeatures: ['lnet', 'nsg'],
                sdnManagement: 'arc_managed'
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
                nodes: '8',
                rackAwareZones: {
                    zone1Name: 'RackA',
                    zone2Name: 'RackB',
                    assignments: { '1': 1, '2': 1, '3': 1, '4': 1, '5': 2, '6': 2, '7': 2, '8': 2 },
                    nodeCount: 8
                },
                rackAwareZonesConfirmed: true,
                rackAwareTorsPerRoom: '2',
                rackAwareTorArchitecture: 'option_a',
                witnessType: 'Cloud',
                ports: '4',
                portConfig: [
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '25GbE', rdma: true, rdmaMode: 'RoCEv2', rdmaManual: true },
                    { speed: '25GbE', rdma: true, rdmaMode: 'RoCEv2', rdmaManual: true }
                ],
                storage: 'switched',
                storagePoolConfiguration: 'Express',
                intent: 'mgmt_compute',
                storageAutoIp: 'enabled',
                outbound: 'public',
                arc: 'arc_gateway',
                proxy: 'no_proxy',
                privateEndpoints: 'pe_disabled',
                ip: 'static',
                infraCidr: '172.16.0.0/24',
                infra: { start: '172.16.0.100', end: '172.16.0.120' },
                nodeSettings: [
                    { name: 'rack1node1', ipCidr: '172.16.0.11/24' },
                    { name: 'rack1node2', ipCidr: '172.16.0.12/24' },
                    { name: 'rack1node3', ipCidr: '172.16.0.13/24' },
                    { name: 'rack1node4', ipCidr: '172.16.0.14/24' },
                    { name: 'rack2node1', ipCidr: '172.16.0.21/24' },
                    { name: 'rack2node2', ipCidr: '172.16.0.22/24' },
                    { name: 'rack2node3', ipCidr: '172.16.0.23/24' },
                    { name: 'rack2node4', ipCidr: '172.16.0.24/24' }
                ],
                infraGateway: '172.16.0.1',
                infraVlan: 'default',
                activeDirectory: 'azure_ad',
                adDomain: 'datacenter.local',
                adOuPath: 'OU=AzureLocal,DC=datacenter,DC=local',
                dnsServers: ['172.16.0.1', '172.16.0.2'],
                securityConfiguration: 'recommended',
                sdnEnabled: 'no'
            }
        },
        {
            name: 'Disconnected - Management Cluster 3-Node',
            description: 'Air-gapped management cluster (3 nodes) with Autonomous Cloud endpoint for disconnected operations',
            config: {
                scenario: 'disconnected',
                clusterRole: 'management',
                autonomousCloudFqdn: 'azurelocal.airgap.contoso.com',
                fqdnConfirmed: true,
                region: 'azure_commercial',
                localInstanceRegion: 'east_us',
                scale: 'medium',
                nodes: '3',
                witnessType: 'NoWitness',
                ports: '4',
                portConfig: [
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '25GbE', rdma: true, rdmaMode: 'RoCEv2', rdmaManual: true },
                    { speed: '25GbE', rdma: true, rdmaMode: 'RoCEv2', rdmaManual: true }
                ],
                storage: 'switched',
                storagePoolConfiguration: 'Express',
                intent: 'compute_storage',
                storageAutoIp: 'enabled',
                outbound: 'air_gapped',
                arc: 'no_arc',
                proxy: 'no_proxy',
                ip: 'static',
                infraCidr: '10.10.10.0/24',
                infra: { start: '10.10.10.50', end: '10.10.10.60' },
                nodeSettings: [
                    { name: 'secnode1', ipCidr: '10.10.10.11/24' },
                    { name: 'secnode2', ipCidr: '10.10.10.12/24' },
                    { name: 'secnode3', ipCidr: '10.10.10.13/24' }
                ],
                infraGateway: '10.10.10.1',
                infraVlan: 'default',
                activeDirectory: 'azure_ad',
                adDomain: 'airgap.contoso.com',
                adOuPath: 'OU=AzureLocal,DC=airgap,DC=contoso,DC=com',
                adfsServerName: 'adfs.airgap.contoso.com',
                localDnsZone: 'airgap.local',
                dnsServers: ['10.10.10.1'],
                privateEndpoints: 'pe_disabled',
                securityConfiguration: 'recommended',
                sdnEnabled: 'no'
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
                nodes: '2',
                witnessType: 'Cloud',
                ports: '4',
                portConfig: [
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true },
                    { speed: '10GbE', rdma: false, rdmaMode: 'Disabled', rdmaManual: true }
                ],
                storage: 'switchless',
                storagePoolConfiguration: 'Express',
                intent: 'mgmt_compute',
                storageAutoIp: 'enabled',
                outbound: 'public',
                arc: 'arc_gateway',
                proxy: 'no_proxy',
                ip: 'static',
                infraCidr: '192.168.100.0/24',
                infra: { start: '192.168.100.50', end: '192.168.100.60' },
                nodeSettings: [
                    { name: 'edge1', ipCidr: '192.168.100.11/24' },
                    { name: 'edge2', ipCidr: '192.168.100.12/24' }
                ],
                infraGateway: '192.168.100.1',
                infraVlan: 'default',
                activeDirectory: 'azure_ad',
                adDomain: 'edge.contoso.com',
                adOuPath: 'OU=AzureLocal,DC=edge,DC=contoso,DC=com',
                dnsServers: ['192.168.100.1'],
                privateEndpoints: 'pe_disabled',
                securityConfiguration: 'recommended',
                sdnEnabled: 'no'
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

    // Suppress updateUI() during template loading.
    // Without this, each selectOption() call triggers updateUI(), which:
    // 1. Auto-defaults intent to 'mgmt_compute' when ports are set but intent is null
    // 2. Auto-defaults storageAutoIp based on transient state
    // 3. Recalculates disabled card states between calls, potentially blocking later selections
    // By suppressing updateUI during loading and calling it once at the end, the template
    // loading sequence works identically to how the CI tests operate.
    window.__loadingTemplate = true;

    try {

        // Remove disabled from all option cards and node chips so selectOption calls
        // won't be blocked by disabled states from the initial page load or previous state
        document.querySelectorAll('.option-card').forEach(c => c.classList.remove('disabled'));
        document.querySelectorAll('.node-chip').forEach(c => c.classList.remove('disabled'));

        // Apply configuration
        Object.keys(config).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(state, key)) {
                state[key] = config[key];
            }
        });

        // Trigger UI updates for each selection in logical step order
        if (config.scenario) selectOption('scenario', config.scenario);

        // Disconnected operations: set cluster role and Autonomous Cloud FQDN
        if (config.scenario === 'disconnected' && config.clusterRole) {
            if (typeof selectDisconnectedOption === 'function') {
                selectDisconnectedOption('clusterRole', config.clusterRole);
            } else {
                state.clusterRole = config.clusterRole;
            }
            // Restore FQDN + confirmed state AFTER selectDisconnectedOption (which resets them)
            if (config.autonomousCloudFqdn) {
                state.autonomousCloudFqdn = config.autonomousCloudFqdn;
            }
            if (config.fqdnConfirmed !== undefined) {
                state.fqdnConfirmed = config.fqdnConfirmed;
            }
        }

        if (config.region) selectOption('region', config.region);
        if (config.localInstanceRegion) selectOption('localInstanceRegion', config.localInstanceRegion);
        if (config.scale) selectOption('scale', config.scale);
        if (config.nodes) selectOption('nodes', config.nodes);
        if (config.witnessType) selectOption('witnessType', config.witnessType);

        // Storage must be set BEFORE ports, because selectOption('storage') resets ports
        if (config.storage) selectOption('storage', config.storage);
        if (config.switchlessLinkMode) selectOption('switchlessLinkMode', config.switchlessLinkMode);

        // Now set ports (after storage, so it won't be reset)
        if (config.ports) selectOption('ports', config.ports);

        // Apply portConfig after ports selection (since selectOption may reset it)
        if (config.portConfig && Array.isArray(config.portConfig)) {
            state.portConfig = config.portConfig;
            state.portConfigConfirmed = true;
        }

        if (config.storagePoolConfiguration) selectOption('storagePoolConfiguration', config.storagePoolConfiguration);
        if (config.intent) selectOption('intent', config.intent);
        // storageAutoIp must come AFTER outbound (outbound handler resets storageAutoIp to null)
        if (config.outbound) selectOption('outbound', config.outbound);
        if (config.arc) selectOption('arc', config.arc);
        if (config.proxy) selectOption('proxy', config.proxy);
        if (config.privateEndpoints) selectOption('privateEndpoints', config.privateEndpoints);
        if (config.ip) selectOption('ip', config.ip);
        if (config.storageAutoIp) selectOption('storageAutoIp', config.storageAutoIp);

        // Apply infrastructure settings
        if (config.infraCidr) {
            state.infraCidr = config.infraCidr;
        }
        if (config.infra) {
            state.infra = config.infra;
        }

        // Apply nodeSettings and infraGateway after ip selection (since selectOption may reset them)
        if (config.nodeSettings && Array.isArray(config.nodeSettings)) {
            state.nodeSettings = config.nodeSettings;
        }
        if (config.infraGateway) {
            state.infraGateway = config.infraGateway;
            state.infraGatewayManual = true;
        }

        if (config.infraVlan) selectOption('infraVlan', config.infraVlan);
        if (config.activeDirectory) selectOption('activeDirectory', config.activeDirectory);

        // Apply AD-related settings
        // These must be re-applied after selectOption('activeDirectory') which resets them
        if (config.adDomain) {
            state.adDomain = config.adDomain;
        }
        if (config.adOuPath) {
            state.adOuPath = config.adOuPath;
        }
        if (config.adfsServerName) {
            state.adfsServerName = config.adfsServerName;
        }
        if (config.localDnsZone) {
            state.localDnsZone = config.localDnsZone;
        }
        if (config.dnsServers && Array.isArray(config.dnsServers)) {
            state.dnsServers = config.dnsServers;
        }

        // Render DNS server inputs from restored state (selectOption('activeDirectory') renders empty ones)
        if (state.dnsServers && state.dnsServers.length > 0) {
            renderDnsServers();
        }
        // Restore AD domain input value (selectOption('activeDirectory') clears it)
        const adDomainInputEl = document.getElementById('ad-domain');
        if (adDomainInputEl && state.adDomain) {
            adDomainInputEl.value = state.adDomain;
        }
        // Restore AD OU Path input value
        const adOuPathInputEl = document.getElementById('ad-ou-path');
        if (adOuPathInputEl && state.adOuPath) {
            adOuPathInputEl.value = state.adOuPath;
        }
        // Restore ADFS Server Name input value
        const adfsServerInputEl = document.getElementById('adfs-server-name');
        if (adfsServerInputEl && state.adfsServerName) {
            adfsServerInputEl.value = state.adfsServerName;
        }
        // Restore local DNS zone input value
        const localDnsZoneInputEl = document.getElementById('local-dns-zone-input');
        if (localDnsZoneInputEl && state.localDnsZone) {
            localDnsZoneInputEl.value = state.localDnsZone;
        }

        // Apply rack-aware settings
        if (config.rackAwareZones) {
            state.rackAwareZones = config.rackAwareZones;
        }
        if (config.rackAwareZonesConfirmed !== undefined) {
            state.rackAwareZonesConfirmed = config.rackAwareZonesConfirmed;
        }
        if (config.rackAwareTorsPerRoom) {
            state.rackAwareTorsPerRoom = config.rackAwareTorsPerRoom;
        }
        if (config.rackAwareTorArchitecture) {
            state.rackAwareTorArchitecture = config.rackAwareTorArchitecture;
        }

        if (config.securityConfiguration) selectOption('securityConfiguration', config.securityConfiguration);

        // Apply SDN settings
        if (config.sdnEnabled) selectOption('sdnEnabled', config.sdnEnabled);
        if (config.sdnFeatures && Array.isArray(config.sdnFeatures)) {
            state.sdnFeatures = config.sdnFeatures;
            // Check SDN feature checkboxes in the DOM
            state.sdnFeatures.forEach(function(feature) {
                const checkbox = document.querySelector('.sdn-feature-card[data-feature="' + feature + '"] input[type="checkbox"]');
                if (checkbox) checkbox.checked = true;
            });
            // Show management section and enable correct cards based on selected features
            updateSdnManagementOptions();
        }
        if (config.sdnManagement) {
            state.sdnManagement = config.sdnManagement;
            // Select the correct SDN management card in the DOM
            const arcCard = document.getElementById('sdn-arc-card');
            const onpremCard = document.getElementById('sdn-onprem-card');
            if (arcCard) arcCard.classList.remove('selected');
            if (onpremCard) onpremCard.classList.remove('selected');
            const sdnMgmtCard = document.getElementById(config.sdnManagement === 'arc_managed' ? 'sdn-arc-card' : 'sdn-onprem-card');
            if (sdnMgmtCard && !sdnMgmtCard.classList.contains('disabled')) {
                sdnMgmtCard.classList.add('selected');
            }
        }

        // Re-enable updateUI and run it once to apply all visual updates,
        // disabled states, and auto-defaults from the final state
    } finally {
        window.__loadingTemplate = false;
    }

    // Final UI update to reflect all state changes
    updateUI();

    // Close the modal
    document.querySelectorAll('div').forEach(el => {
        if (el.style.position === 'fixed' && el.style.zIndex === '10000') {
            el.remove();
        }
    });

    // Re-run infrastructure network validation with restored values
    if (state.infraCidr || state.infra || state.infraGateway) {
        setTimeout(() => {
            updateInfraNetwork();
        }, 100);
    }

    // Show success message
    showNotification('✅ Template loaded successfully!', 'success');

    // Save state
    saveStateToLocalStorage();
}

// NOTE: showNotification has been moved to js/notifications.js

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
    // Initialize Firebase Analytics
    initializeAnalytics();

    // Track page view
    trackPageView();

    // Sync theme from shared localStorage key (for cross-page consistency)
    const sharedTheme = localStorage.getItem('odin-theme');
    if (sharedTheme && (sharedTheme === 'light' || sharedTheme === 'dark')) {
        state.theme = sharedTheme;
    }

    // Apply saved theme and font size
    applyTheme();
    applyFontSize();

    // Initialize UI state (ensure AD cards are disabled until infra is set)
    updateUI();

    // Check for sizer import first, then check for saved state
    setTimeout(function() {
        if (!checkForSizerImport()) {
            checkForSavedState();
        }
    }, 500);

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

    // Initialize keyboard shortcuts
    initKeyboardShortcuts();

    // Initialize breadcrumb navigation
    updateBreadcrumbs();

    // Check if first time user for onboarding
    setTimeout(() => {
        if (!localStorage.getItem('odin_onboarding_complete')) {
            showOnboarding();
        }
    }, 2000);
});

// ============================================
// BREADCRUMB NAVIGATION
// ============================================

function navigateToStep(stepId) {
    const step = document.getElementById(stepId);
    if (step && !step.classList.contains('hidden')) {
        step.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Add highlight effect
        step.style.boxShadow = '0 0 0 2px var(--accent-blue)';
        setTimeout(() => {
            step.style.boxShadow = '';
        }, 2000);
    }
}

function updateBreadcrumbs() {
    const breadcrumbNav = document.getElementById('breadcrumb-nav');
    if (!breadcrumbNav) return;

    // Show breadcrumb when at least step 1 is complete
    if (state.scenario) {
        breadcrumbNav.classList.remove('hidden');
    }

    const breadcrumbItems = breadcrumbNav.querySelectorAll('.breadcrumb-item');
    breadcrumbItems.forEach(item => {
        const stepId = item.dataset.step;
        const stepEl = document.getElementById(stepId);

        // Check if step is complete
        let isComplete = false;
        switch (stepId) {
            case 'step-1': isComplete = Boolean(state.scenario); break;
            case 'step-cloud': isComplete = Boolean(state.region); break;
            case 'step-local-region': isComplete = Boolean(state.localInstanceRegion); break;
            case 'step-2': isComplete = Boolean(state.scale); break;
            case 'step-3': isComplete = Boolean(state.nodes); break;
            case 'step-11': isComplete = Boolean(state.infraCidr && state.infra); break;
            case 'step-13': isComplete = Boolean(state.activeDirectory); break;
            case 'step-14': isComplete = Boolean(state.securityConfiguration); break;
        }

        item.classList.toggle('completed', isComplete);
        item.classList.toggle('active', stepEl && isElementInViewport(stepEl));
    });
}

function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight / 2;
}

// Update breadcrumbs on scroll with cleanup support
let scrollTimeout;
let scrollHandler;

if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler);
}

const scrollHandlerFn = () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(updateBreadcrumbs, 100);
};

window.addEventListener('scroll', scrollHandlerFn);

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Skip shortcuts when user is typing in input fields (except Escape)
        const activeTag = document.activeElement?.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) && e.key !== 'Escape') {
            return;
        }

        // Escape to close modals - use specific classes for safety
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.preview-modal, .onboarding-overlay, [data-close-on-escape="true"]');
            modals.forEach(m => m.remove());
        }

        // Alt+R for generate report
        if (e.altKey && e.key === 'r') {
            e.preventDefault();
            const reportBtn = document.getElementById('generate-report-btn');
            if (reportBtn && !reportBtn.disabled) {
                generateReport();
            }
        }

        // Alt+E for export
        if (e.altKey && e.key === 'e') {
            e.preventDefault();
            exportConfiguration();
        }

        // Alt+I for import
        if (e.altKey && e.key === 'i') {
            e.preventDefault();
            importConfiguration();
        }

        // Alt+S for start over (with confirmation)
        if (e.altKey && e.key === 's') {
            e.preventDefault();
            if (confirm('Are you sure you want to start over? All current configuration will be lost.')) {
                resetAll();
            }
        }

        // Alt+? for shortcuts help
        if (e.altKey && e.key === '?') {
            e.preventDefault();
            showShortcutsHelp();
        }

        // Number keys 1-8 to navigate breadcrumbs (when Alt held)
        if (e.altKey && e.key >= '1' && e.key <= '8') {
            e.preventDefault();
            const stepMap = ['step-1', 'step-cloud', 'step-local-region', 'step-2', 'step-3', 'step-11', 'step-13', 'step-14'];
            const stepId = stepMap[parseInt(e.key) - 1];
            if (stepId) navigateToStep(stepId);
        }
    });
}

function showShortcutsHelp() {
    const overlay = document.createElement('div');
    overlay.className = 'preview-modal';
    overlay.innerHTML = `
        <div class="preview-content" style="max-width: 500px;">
            <div class="preview-header">
                <h2>⌨️ Keyboard Shortcuts</h2>
                <button class="preview-close" data-action="close-modal">&times;</button>
            </div>
            <div class="preview-body">
                <div style="display: grid; gap: 12px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--glass-border);">
                        <span>Generate Report</span>
                        <span><kbd class="kbd">Alt</kbd> + <kbd class="kbd">R</kbd></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--glass-border);">
                        <span>Export Configuration</span>
                        <span><kbd class="kbd">Alt</kbd> + <kbd class="kbd">E</kbd></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--glass-border);">
                        <span>Import Configuration</span>
                        <span><kbd class="kbd">Alt</kbd> + <kbd class="kbd">I</kbd></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--glass-border);">
                        <span>Start Over</span>
                        <span><kbd class="kbd">Alt</kbd> + <kbd class="kbd">S</kbd></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--glass-border);">
                        <span>Navigate to Step (1-8)</span>
                        <span><kbd class="kbd">Alt</kbd> + <kbd class="kbd">1-8</kbd></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                        <span>Close Modal / Cancel</span>
                        <span><kbd class="kbd">Esc</kbd></span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event delegation for close button
    overlay.querySelector('[data-action="close-modal"]').addEventListener('click', () => overlay.remove());

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
}

// ============================================
// PDF EXPORT
// ============================================

function exportToPDF() {
    const readiness = getReportReadiness();

    // Generate a printable HTML document
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Pop-up blocked. Please allow pop-ups for PDF export.', 'error');
        return;
    }

    const getDisplayName = (key, value) => {
        const displayNames = {
            scenario: { hyperconverged: 'Hyperconverged', disconnected: 'Disconnected', m365local: 'M365 Local', multirack: 'Multi-Rack' },
            region: { azure_commercial: 'Azure Commercial', azure_government: 'Azure Government', azure_china: 'Azure China' },
            scale: { low_capacity: 'Hyperconverged Low Capacity', medium: 'Hyperconverged', rack_aware: 'Hyperconverged Rack Aware' },
            storage: { switched: 'Switched Storage', switchless: 'Switchless Storage' },
            witnessType: { cloud: 'Cloud Witness', fileshare: 'File Share Witness', none: 'No Witness' },
            ip: { static: 'Static IP', dhcp: 'DHCP' },
            outbound: { direct: 'Direct Internet', proxy: 'Corporate Proxy' },
            arc: { enabled: 'Arc Gateway Enabled', disabled: 'Arc Gateway Disabled' },
            activeDirectory: { azure_ad: 'Active Directory', local_identity: 'Local Identity (AD-Less)' },
            securityConfiguration: { recommended: 'Recommended Security', customized: 'Customized Security' }
        };
        // For disconnected scenario, include the outbound connectivity type
        if (key === 'scenario' && value === 'disconnected') {
            if (state.outbound === 'limited') return 'Disconnected (Limited Connectivity)';
            if (state.outbound === 'air_gapped') return 'Disconnected (Air Gapped)';
            return 'Disconnected';
        }
        if (displayNames[key] && displayNames[key][value]) return displayNames[key][value];
        return value || 'Not configured';
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Odin for Azure Local - Configuration Summary</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #0078d4; }
        .header h1 { color: #0078d4; font-size: 28px; margin-bottom: 8px; }
        .header p { color: #666; font-size: 14px; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 16px; font-weight: 600; color: #0078d4; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .item { background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0; }
        .item-label { font-size: 12px; color: #666; margin-bottom: 4px; }
        .item-value { font-size: 14px; color: #333; font-weight: 500; }
        .missing { color: #dc3545; font-style: italic; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0; }
        th { background: #f0f7ff; color: #0078d4; font-weight: 600; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px; }
        .status { padding: 8px 16px; border-radius: 20px; display: inline-block; margin-top: 20px; }
        .status.ready { background: #d4edda; color: #155724; }
        .status.incomplete { background: #fff3cd; color: #856404; }
        @media print { body { padding: 20px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Odin for Azure Local</h1>
        <p>Configuration Summary - Generated ${new Date().toLocaleString()}</p>
        <div class="status ${readiness.ready ? 'ready' : 'incomplete'}">
            ${readiness.ready ? '✓ Configuration Complete' : `⚠ ${readiness.missing.length} items need attention`}
        </div>
    </div>

    <div class="section">
        <div class="section-title">🏢 Deployment Configuration</div>
        <div class="grid">
            <div class="item"><div class="item-label">Deployment Type</div><div class="item-value">${getDisplayName('scenario', state.scenario)}</div></div>
            ${state.scenario === 'disconnected' && state.clusterRole ? `
            <div class="item"><div class="item-label">Cluster Role</div><div class="item-value">${state.clusterRole === 'management' ? 'Management Cluster' : 'Workload Cluster'}</div></div>
            <div class="item"><div class="item-label">Autonomous Cloud FQDN</div><div class="item-value">${state.autonomousCloudFqdn || 'Not configured'}</div></div>
            ` : `
            <div class="item"><div class="item-label">Azure Cloud</div><div class="item-value">${getDisplayName('region', state.region)}</div></div>
            <div class="item"><div class="item-label">Azure Region</div><div class="item-value">${state.localInstanceRegion?.replace(/_/g, ' ') || 'Not configured'}</div></div>
            `}
            <div class="item"><div class="item-label">Scale</div><div class="item-value">${getDisplayName('scale', state.scale)}</div></div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">🖥️ Cluster Configuration</div>
        <div class="grid">
            <div class="item"><div class="item-label">Node Count</div><div class="item-value">${state.nodes || 'Not configured'}</div></div>
            <div class="item"><div class="item-label">Witness Type</div><div class="item-value">${getDisplayName('witnessType', state.witnessType)}</div></div>
            <div class="item"><div class="item-label">Ports per Node</div><div class="item-value">${state.ports || 'Not configured'}</div></div>
            <div class="item"><div class="item-label">Storage Connectivity</div><div class="item-value">${getDisplayName('storage', state.storage)}</div></div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">🌐 Network Configuration</div>
        <div class="grid">
            <div class="item"><div class="item-label">IP Assignment</div><div class="item-value">${getDisplayName('ip', state.ip)}</div></div>
            <div class="item"><div class="item-label">Infrastructure CIDR</div><div class="item-value">${state.infraCidr || 'Not configured'}</div></div>
            <div class="item"><div class="item-label">Default Gateway</div><div class="item-value">${state.infraGateway || 'Not configured'}</div></div>
            <div class="item"><div class="item-label">Infrastructure VLAN</div><div class="item-value">${state.infraVlan === 'custom' ? state.infraVlanId : (state.infraVlan || 'Not configured')}</div></div>
            <div class="item"><div class="item-label">Outbound Connectivity</div><div class="item-value">${getDisplayName('outbound', state.outbound)}</div></div>
            <div class="item"><div class="item-label">Arc Gateway</div><div class="item-value">${getDisplayName('arc', state.arc)}</div></div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">🔐 Identity & Security</div>
        <div class="grid">
            <div class="item"><div class="item-label">Identity Provider</div><div class="item-value">${getDisplayName('activeDirectory', state.activeDirectory)}</div></div>
            <div class="item"><div class="item-label">AD Domain</div><div class="item-value">${state.adDomain || 'Not configured'}</div></div>
            <div class="item"><div class="item-label">DNS Servers</div><div class="item-value">${state.dnsServers?.join(', ') || 'Not configured'}</div></div>
            <div class="item"><div class="item-label">Security Configuration</div><div class="item-value">${getDisplayName('securityConfiguration', state.securityConfiguration)}</div></div>
        </div>
    </div>

    ${state.nodeSettings && state.nodeSettings.length > 0 ? `
    <div class="section">
        <div class="section-title">📝 Node Settings</div>
        <table>
            <thead>
                <tr><th>Node</th><th>Name</th><th>IP Address</th></tr>
            </thead>
            <tbody>
                ${state.nodeSettings.map((node, i) => {
        const escName = (node.name || 'Not set').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const escIp = (node.ipCidr || 'Not set').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `<tr><td>${i + 1}</td><td>${escName}</td><td>${escIp}</td></tr>`;
    }).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${!readiness.ready ? `
    <div class="section">
        <div class="section-title" style="color: #dc3545;">⚠️ Missing Configuration</div>
        <ul style="padding-left: 20px;">
            ${readiness.missing.map(item => item.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).map(item => `<li>${item}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="footer">
        <p>Generated by Odin for Azure Local v${WIZARD_VERSION}</p>
        <p>This document is for planning purposes only.</p>
    </div>
</body>
</html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load then trigger print
    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    showToast('PDF export opened in new window. Use Print to save as PDF.', 'success');
}

// ============================================
// ONBOARDING TUTORIAL
// ============================================

const onboardingSteps = [
    {
        icon: '<img src="images/odin-logo.png" alt="Odin Logo" style="width: 100px; height: 100px; object-fit: contain;">',
        isImage: true,
        title: 'Welcome to Odin for Azure Local',
        description: 'Your intelligent guide for planning Azure Local deployments. This wizard helps you make informed decisions and generates deployment-ready configurations.',
        features: [
            { icon: '🧭', title: 'Guided Workflow', text: 'Step-by-step configuration with intelligent defaults' },
            { icon: '💾', title: 'Auto-Save', text: 'Progress is automatically saved to your browser' },
            { icon: '📊', title: 'Visual Reports', text: 'Generate detailed deployment reports and diagrams' },
            { icon: '⚡', title: 'ARM Templates', text: 'Export Azure Resource Manager parameters' }
        ]
    },
    {
        icon: '🔧',
        title: 'How It Works',
        description: 'Follow the numbered steps on the left to configure your Azure Local deployment. The summary panel on the right shows your progress.',
        features: [
            { icon: '1️⃣', title: 'Choose Deployment Type', text: 'Select Hyperconverged, Disconnected, or other options' },
            { icon: '2️⃣', title: 'Configure Cluster', text: 'Set up nodes, storage, and network settings' },
            { icon: '3️⃣', title: 'Set Identity & Security', text: 'Configure AD, DNS, and security policies' },
            { icon: '4️⃣', title: 'Generate Outputs', text: 'Create reports and ARM parameter files' }
        ]
    },
    {
        icon: '⌨️',
        title: 'Pro Tips',
        description: 'Make the most of Odin with these helpful features.',
        features: [
            { icon: '📋', title: 'Templates', text: 'Load pre-configured templates for common scenarios' },
            { icon: '🔄', title: 'Import/Export', text: 'Save and share configurations as JSON files' },
            { icon: '🎨', title: 'Customization', text: 'Adjust font size and toggle dark/light theme' },
            { icon: '⌨️', title: 'Shortcuts', text: 'Press Alt+? anytime to see keyboard shortcuts' }
        ]
    }
];

let currentOnboardingStep = 0;

function showOnboarding() {
    currentOnboardingStep = 0;
    renderOnboardingStep();
}

function renderOnboardingStep() {
    const step = onboardingSteps[currentOnboardingStep];

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
                ${onboardingSteps.map((_, i) => `<div class="onboarding-dot ${i === currentOnboardingStep ? 'active' : ''}"></div>`).join('')}
            </div>

            <div class="onboarding-buttons">
                <button class="onboarding-btn onboarding-btn-secondary" data-action="skip">Skip</button>
                <button class="onboarding-btn onboarding-btn-primary" data-action="next">
                    ${currentOnboardingStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
                </button>
            </div>
        </div>
    `;

    // Use event delegation instead of inline onclick handlers
    overlay.querySelector('[data-action="skip"]').addEventListener('click', skipOnboarding);
    overlay.querySelector('[data-action="next"]').addEventListener('click', () => {
        if (currentOnboardingStep === onboardingSteps.length - 1) {
            finishOnboarding();
        } else {
            nextOnboardingStep();
        }
    });

    document.body.appendChild(overlay);
}

function nextOnboardingStep() {
    currentOnboardingStep++;
    if (currentOnboardingStep < onboardingSteps.length) {
        renderOnboardingStep();
    } else {
        finishOnboarding();
    }
}

function skipOnboarding() {
    localStorage.setItem('odin_onboarding_complete', 'true');
    document.querySelectorAll('.onboarding-overlay').forEach(el => el.remove());
}

function finishOnboarding() {
    localStorage.setItem('odin_onboarding_complete', 'true');
    document.querySelectorAll('.onboarding-overlay').forEach(el => el.remove());
    showToast('Welcome! Start by selecting a Deployment Type.', 'success', 4000);
}

// ============================================
// COLLAPSIBLE SECTIONS
// ============================================

function toggleStepCollapse(stepId) {
    const step = document.getElementById(stepId);
    if (step && step.classList.contains('collapsible')) {
        step.classList.toggle('collapsed');
    }
}

// Note: Breadcrumbs are updated via scroll listener and updateUI() call in main code

// ============================================
// DRAG & DROP ADAPTER MAPPING
// ============================================

function initializeAdapterMapping() {
    if (!state.adapterMapping) {
        state.adapterMapping = {};
    }
    if (typeof state.adapterMappingConfirmed === 'undefined') {
        state.adapterMappingConfirmed = false;
    }
    if (!state.adapterMappingSelection) {
        state.adapterMappingSelection = null;
    }
}

function getIntentZonesForIntent(intent) {
    // Returns the available zones for a given intent type
    // Minimum adapters: 2 for standard scenarios, 1 for Low Capacity
    const zones = [];
    const isLowCapacity = state.scale === 'low_capacity';
    const isSingleNode = state.nodes === '1';
    const minStandard = 2;
    const minLowCap = 1;

    if (intent === 'all_traffic') {
        zones.push({
            key: 'all',
            title: 'Group All Traffic',
            titleClass: '',
            description: 'Management, Compute, and Storage traffic share these adapters.',
            badge: isLowCapacity ? 'Min 1 Adapter (RDMA)' : 'Min 2 Adapters (RDMA)',
            badgeClass: 'rdma-required',
            minAdapters: isLowCapacity ? minLowCap : minStandard,
            requiresRdma: true
        });
    } else if (intent === 'mgmt_compute') {
        zones.push({
            key: 'mgmt_compute',
            title: 'Management + Compute',
            titleClass: 'mgmt',
            description: 'Shared traffic for management and compute workloads.',
            badge: isLowCapacity ? 'Min 1 Adapter' : 'Min 2 Adapters',
            badgeClass: 'required',
            minAdapters: isLowCapacity ? minLowCap : minStandard,
            requiresRdma: false
        });
        // Storage zone is available for all node counts (including single-node)
        zones.push({
            key: 'storage',
            title: 'Storage',
            titleClass: 'storage',
            description: 'Dedicated storage traffic (SMB Direct).',
            badge: isLowCapacity ? 'Min 1 Adapter' : 'Min 2 Adapters (RDMA)',
            badgeClass: isLowCapacity ? 'required' : 'rdma-required',
            minAdapters: isLowCapacity ? minLowCap : minStandard,
            requiresRdma: !isLowCapacity
        });
    } else if (intent === 'compute_storage') {
        zones.push({
            key: 'mgmt',
            title: 'Management',
            titleClass: 'mgmt',
            description: 'Dedicated management traffic.',
            badge: isLowCapacity ? 'Min 1 Adapter' : 'Min 2 Adapters',
            badgeClass: 'required',
            minAdapters: isLowCapacity ? minLowCap : minStandard,
            requiresRdma: false
        });
        zones.push({
            key: 'compute_storage',
            title: 'Compute + Storage',
            titleClass: 'storage',
            description: 'Shared compute and storage traffic.',
            badge: isLowCapacity ? 'Min 1 Adapter (RDMA)' : 'Min 2 Adapters (RDMA)',
            badgeClass: 'rdma-required',
            minAdapters: isLowCapacity ? minLowCap : minStandard,
            requiresRdma: true
        });
    } else if (intent === 'custom') {
        const portCount = parseInt(state.ports) || 0;
        const has8Ports = portCount >= 8;
        if (has8Ports) {
            // 8+ ports: Fixed structure — Mgmt+Compute (required), Compute 1 & 2 (optional), Storage (required)
            // Management, Compute+Storage, and Group All Traffic are NOT available
            zones.push({
                key: 'mgmt_compute',
                title: 'Management + Compute',
                titleClass: 'mgmt',
                description: 'Shared management and compute.',
                badge: isLowCapacity ? 'Min 1 Adapter' : 'Min 2 Adapters',
                badgeClass: 'required',
                minAdapters: isLowCapacity ? minLowCap : minStandard,
                requiresRdma: false
            });
            zones.push({
                key: 'compute_1',
                title: 'Compute 1',
                titleClass: 'compute',
                description: 'First compute traffic intent.',
                badge: 'Optional',
                badgeClass: 'optional',
                minAdapters: 0,
                requiresRdma: false
            });
            zones.push({
                key: 'compute_2',
                title: 'Compute 2',
                titleClass: 'compute',
                description: 'Second compute traffic intent.',
                badge: 'Optional',
                badgeClass: 'optional',
                minAdapters: 0,
                requiresRdma: false
            });
            zones.push({
                key: 'storage',
                title: 'Storage',
                titleClass: 'storage',
                description: 'Storage traffic (SMB Direct).',
                badge: isLowCapacity ? 'Min 1 Adapter' : 'Min 2 Adapters (RDMA)',
                badgeClass: isLowCapacity ? 'required' : 'rdma-required',
                minAdapters: isLowCapacity ? minLowCap : minStandard,
                requiresRdma: !isLowCapacity
            });
        } else {
            // < 8 ports: All zones available, all optional
            zones.push({
                key: 'mgmt',
                title: 'Management',
                titleClass: 'mgmt',
                description: 'Management traffic only.',
                badge: 'Optional',
                badgeClass: 'optional',
                minAdapters: 0,
                requiresRdma: false
            });
            zones.push({
                key: 'compute',
                title: 'Compute',
                titleClass: 'compute',
                description: 'Compute traffic only.',
                badge: 'Optional',
                badgeClass: 'optional',
                minAdapters: 0,
                requiresRdma: false
            });
            // Storage zone is available for all node counts (including single-node)
            zones.push({
                key: 'storage',
                title: 'Storage',
                titleClass: 'storage',
                description: 'Storage traffic (SMB Direct).',
                badge: isLowCapacity ? 'Optional' : 'RDMA Required',
                badgeClass: isLowCapacity ? 'optional' : 'rdma-required',
                minAdapters: 0,
                requiresRdma: !isLowCapacity
            });
            zones.push({
                key: 'mgmt_compute',
                title: 'Management + Compute',
                titleClass: 'mgmt',
                description: 'Shared management and compute.',
                badge: 'Optional',
                badgeClass: 'optional',
                minAdapters: 0,
                requiresRdma: false
            });
            // Compute + Storage zone is available for all node counts (including single-node)
            zones.push({
                key: 'compute_storage',
                title: 'Compute + Storage',
                titleClass: 'storage',
                description: 'Shared compute and storage.',
                badge: isLowCapacity ? 'Optional' : 'RDMA Required',
                badgeClass: isLowCapacity ? 'optional' : 'rdma-required',
                minAdapters: 0,
                requiresRdma: !isLowCapacity
            });
            // Group All Traffic zone
            zones.push({
                key: 'all',
                title: 'Group All Traffic',
                titleClass: '',
                description: 'All traffic types combined.',
                badge: isLowCapacity ? 'Optional' : 'RDMA Required',
                badgeClass: isLowCapacity ? 'optional' : 'rdma-required',
                minAdapters: 0,
                requiresRdma: !isLowCapacity
            });
        }
    }

    return zones;
}

function getDefaultAdapterMapping(intent, portCount) {
    // Returns a default adapter mapping based on intent type
    const mapping = {};
    const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];
    const isSingleNode = state.nodes === '1';

    // Find RDMA-capable ports
    const rdmaPorts = [];
    const nonRdmaPorts = [];
    for (let i = 1; i <= portCount; i++) {
        const pc = cfg[i - 1];
        if (pc && pc.rdma === true) {
            rdmaPorts.push(i);
        } else {
            nonRdmaPorts.push(i);
        }
    }

    if (intent === 'all_traffic') {
        // All ports go to 'all' zone
        for (let i = 1; i <= portCount; i++) {
            mapping[i] = 'all';
        }
    } else if (intent === 'mgmt_compute') {
        // All node counts (including single-node): First 2 non-RDMA (or first 2 if all RDMA) go to mgmt_compute, rest to storage
        if (nonRdmaPorts.length >= 2) {
            mapping[nonRdmaPorts[0]] = 'mgmt_compute';
            mapping[nonRdmaPorts[1]] = 'mgmt_compute';
            for (let i = 1; i <= portCount; i++) {
                if (!mapping[i]) mapping[i] = 'storage';
            }
        } else {
            // All RDMA or insufficient non-RDMA
            if (portCount === 2) {
                mapping[1] = 'mgmt_compute';
                mapping[2] = 'storage';
            } else {
                mapping[1] = 'mgmt_compute';
                mapping[2] = 'mgmt_compute';
                for (let i = 3; i <= portCount; i++) {
                    mapping[i] = 'storage';
                }
            }
        }
    } else if (intent === 'compute_storage') {
        // First 2 ports to mgmt, rest to compute_storage
        mapping[1] = 'mgmt';
        if (portCount >= 2) mapping[2] = 'mgmt';
        for (let i = 3; i <= portCount; i++) {
            mapping[i] = 'compute_storage';
        }
    } else if (intent === 'custom') {
        const has8Ports = portCount >= 8;
        if (has8Ports) {
            // 8-port custom: Mgmt+Compute and Storage are mandatory
            // Default: first 2 non-RDMA (or first 2) → mgmt_compute, last 2 RDMA → storage, rest → pool
            if (nonRdmaPorts.length >= 2) {
                mapping[nonRdmaPorts[0]] = 'mgmt_compute';
                mapping[nonRdmaPorts[1]] = 'mgmt_compute';
            } else {
                mapping[1] = 'mgmt_compute';
                mapping[2] = 'mgmt_compute';
            }
            // Assign last 2 RDMA ports to storage (or last 2 ports if no RDMA distinction)
            const storageSource = rdmaPorts.length >= 2 ? rdmaPorts : [];
            if (storageSource.length >= 2) {
                mapping[storageSource[storageSource.length - 2]] = 'storage';
                mapping[storageSource[storageSource.length - 1]] = 'storage';
            } else {
                mapping[portCount - 1] = 'storage';
                mapping[portCount] = 'storage';
            }
            // Remaining ports go to pool
            for (let i = 1; i <= portCount; i++) {
                if (!mapping[i]) mapping[i] = 'pool';
            }
        } else {
            // All start in pool (unassigned)
            for (let i = 1; i <= portCount; i++) {
                mapping[i] = 'pool';
            }
        }
    }

    return mapping;
}

function renderAdapterMappingUi() {
    const container = document.getElementById('adapter-mapping-container');
    if (!container) return;

    const portCount = parseInt(state.ports) || 0;
    const intent = state.intent;

    if (!intent || portCount <= 0) {
        container.classList.add('hidden');
        container.classList.remove('visible');
        return;
    }

    initializeAdapterMapping();

    // Initialize default mapping if empty or intent changed
    if (!state.adapterMapping || Object.keys(state.adapterMapping).length === 0) {
        state.adapterMapping = getDefaultAdapterMapping(intent, portCount);
        state.adapterMappingConfirmed = false;
    }

    container.classList.remove('hidden');
    container.classList.add('visible');

    const confirmed = Boolean(state.adapterMappingConfirmed);
    container.classList.toggle('is-locked', confirmed);

    // Render pool (unassigned adapters)
    renderAdapterPool(portCount, confirmed);

    // Render intent zones
    renderIntentZones(intent, portCount, confirmed);

    // Update buttons and status
    updateAdapterMappingButtons(intent, portCount, confirmed);

    // Validate mapping
    validateAdapterMapping(intent, portCount);
}

function renderAdapterPool(portCount, confirmed) {
    const poolDrop = document.getElementById('adapter-pool-drop');
    if (!poolDrop) return;

    poolDrop.innerHTML = '';

    const poolAdapters = [];
    for (let i = 1; i <= portCount; i++) {
        if (state.adapterMapping[i] === 'pool' || !state.adapterMapping[i]) {
            poolAdapters.push(i);
        }
    }

    if (poolAdapters.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'adapter-empty';
        empty.textContent = 'All adapters assigned.';
        poolDrop.appendChild(empty);
    } else {
        poolAdapters.forEach(portId => {
            poolDrop.appendChild(buildAdapterPill(portId, confirmed));
        });
    }

    // Set drop handlers for pool
    setAdapterDropHandlers(poolDrop, 'pool', confirmed);
}

function renderIntentZones(intent, portCount, confirmed) {
    const zonesGrid = document.getElementById('intent-zones-grid');
    if (!zonesGrid) return;

    zonesGrid.innerHTML = '';

    const zones = getIntentZonesForIntent(intent);

    zones.forEach(zone => {
        const card = document.createElement('div');
        card.className = 'intent-zone-card';
        card.dataset.zone = zone.key;

        // Get adapters assigned to this zone
        const assignedAdapters = [];
        for (let i = 1; i <= portCount; i++) {
            if (state.adapterMapping[i] === zone.key) {
                assignedAdapters.push(i);
            }
        }

        // Check if zone requirements are met
        const meetsMin = assignedAdapters.length >= zone.minAdapters;
        const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];
        const hasRdmaIssue = zone.requiresRdma && assignedAdapters.some(portId => {
            const pc = cfg[portId - 1];
            return !pc || pc.rdma !== true;
        });

        if (assignedAdapters.length > 0) {
            card.classList.add('has-adapters');
        }
        if (meetsMin && !hasRdmaIssue && assignedAdapters.length > 0) {
            card.classList.add('is-complete');
        }
        if (hasRdmaIssue) {
            card.classList.add('has-error');
        }

        card.innerHTML = `
            <div class="intent-zone-header">
                <span class="intent-zone-title ${zone.titleClass}">${zone.title}</span>
                <span class="intent-zone-badge ${zone.badgeClass}">${zone.badge}</span>
            </div>
            <div class="intent-zone-desc">${zone.description}</div>
            <div id="zone-drop-${zone.key}" class="intent-zone-drop" data-zone="${zone.key}" aria-label="${zone.title} drop zone"></div>
            ${zone.minAdapters > 0 ? `<div class="intent-zone-min ${meetsMin ? 'met' : 'not-met'}">
                ${meetsMin ? '' : '!'} Minimum: ${zone.minAdapters} adapter(s)
            </div>` : ''}
        `;

        zonesGrid.appendChild(card);

        // Populate the drop zone with assigned adapters
        const dropZone = card.querySelector(`#zone-drop-${zone.key}`);
        if (dropZone) {
            if (assignedAdapters.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'adapter-empty';
                empty.textContent = 'Drop adapters here';
                dropZone.appendChild(empty);
            } else {
                assignedAdapters.forEach(portId => {
                    dropZone.appendChild(buildAdapterPill(portId, confirmed));
                });
            }

            setAdapterDropHandlers(dropZone, zone.key, confirmed);
        }
    });
}

// Module-level flag to suppress click events fired by Safari after a drag-and-drop.
let _adapterDragActive = false;

function buildAdapterPill(portId, locked) {
    const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];
    const pc = cfg[portId - 1];
    const isRdma = pc && pc.rdma === true;
    const rdmaMode = (pc && pc.rdmaMode) || 'Disabled';
    const displayName = getPortDisplayName(portId);

    const pill = document.createElement('div');
    pill.className = 'adapter-pill';
    pill.dataset.portId = String(portId);
    pill.draggable = !locked;
    pill.setAttribute('aria-grabbed', 'false');
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');

    if (isRdma) {
        pill.classList.add('is-rdma');
    }

    const selectedId = state.adapterMappingSelection ? parseInt(String(state.adapterMappingSelection), 10) : NaN;
    if (!isNaN(selectedId) && selectedId === portId) {
        pill.classList.add('is-selected');
    }

    pill.innerHTML = `
        <svg class="adapter-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <span class="adapter-pill__id">${escapeHtml(displayName)}</span>
        <span class="adapter-pill-rdma">${isRdma ? rdmaMode : 'No RDMA'}</span>
    `;

    // Drag events
    pill.addEventListener('dragstart', (e) => {
        if (locked) return;
        _adapterDragActive = true;
        pill.setAttribute('aria-grabbed', 'true');
        pill.classList.add('is-dragging');
        e.dataTransfer.setData('text/plain', String(portId));
        e.dataTransfer.effectAllowed = 'move';
    });

    pill.addEventListener('dragend', () => {
        pill.setAttribute('aria-grabbed', 'false');
        pill.classList.remove('is-dragging');
        // Delay clearing the flag so any spurious click event fired by Safari
        // after a drag-and-drop is suppressed.
        setTimeout(() => { _adapterDragActive = false; }, 100);
    });

    // Click-to-select fallback (suppressed during/after drag to avoid Safari swap bug)
    pill.addEventListener('click', (e) => {
        if (locked || _adapterDragActive) return;
        handleAdapterClick(portId);
    });

    // Touch-to-select fallback for mobile Safari and touch devices
    pill.addEventListener('touchend', (e) => {
        if (locked || _adapterDragActive) return;
        // Only handle single taps (not multi-touch or scroll gestures)
        if (e.changedTouches && e.changedTouches.length === 1) {
            e.preventDefault();
            handleAdapterClick(portId);
        }
    });

    pill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!locked) handleAdapterClick(portId);
        }
    });

    return pill;
}

function handleAdapterClick(portId) {
    const selectedRaw = state.adapterMappingSelection;
    const selected = selectedRaw ? parseInt(String(selectedRaw), 10) : NaN;

    if (isNaN(selected)) {
        // Select this adapter
        state.adapterMappingSelection = String(portId);
    } else if (selected === portId) {
        // Deselect
        state.adapterMappingSelection = null;
    } else {
        // Different adapter selected - swap them
        const currentZoneA = state.adapterMapping[selected] || 'pool';
        const currentZoneB = state.adapterMapping[portId] || 'pool';

        state.adapterMapping[selected] = currentZoneB;
        state.adapterMapping[portId] = currentZoneA;
        state.adapterMappingSelection = null;
        state.adapterMappingConfirmed = false;
    }

    renderAdapterMappingUi();
}

function setAdapterDropHandlers(dropZone, targetZone, locked) {
    if (!dropZone || (dropZone.dataset && dropZone.dataset.dndBound === '1')) return;
    if (dropZone.dataset) dropZone.dataset.dndBound = '1';

    dropZone.addEventListener('dragover', (e) => {
        if (locked) return;
        e.preventDefault();
        dropZone.classList.add('is-over');
        try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* ignore */ }
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('is-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('is-over');

        if (locked) return;

        try {
            const portId = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (isNaN(portId)) return;

            const currentZone = state.adapterMapping[portId] || 'pool';
            if (currentZone === targetZone) return;

            // Move adapter to target zone
            state.adapterMapping[portId] = targetZone;
            state.adapterMappingConfirmed = false;
            state.adapterMappingSelection = null;

            renderAdapterMappingUi();
        } catch (err) {
            console.error('Adapter drop error:', err);
        }
    });

    // Click handler for zone (for click-to-move fallback)
    dropZone.addEventListener('click', (e) => {
        if (locked) return;
        if (e.target.closest('.adapter-pill')) return; // Don't trigger if clicking on pill

        const selected = state.adapterMappingSelection;
        if (!selected) return;

        const portId = parseInt(selected, 10);
        const currentZone = state.adapterMapping[portId] || 'pool';

        if (currentZone !== targetZone) {
            state.adapterMapping[portId] = targetZone;
            state.adapterMappingConfirmed = false;
        }

        state.adapterMappingSelection = null;
        renderAdapterMappingUi();
    });
}

const CONFIRM_BTN_CHECKMARK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
const CONFIRM_BTN_PENCIL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';

function updateAdapterMappingButtons(intent, portCount, confirmed) {
    const confirmBtn = document.getElementById('adapter-mapping-confirm-btn');
    const resetBtn = document.getElementById('adapter-mapping-reset-btn');
    const statusEl = document.getElementById('adapter-mapping-status');

    if (confirmBtn) {
        if (confirmed) {
            confirmBtn.innerHTML = CONFIRM_BTN_PENCIL + 'Edit Adapter Mapping';
            confirmBtn.classList.add('is-confirmed');
        } else {
            confirmBtn.innerHTML = CONFIRM_BTN_CHECKMARK + 'Confirm Adapter Mapping';
            confirmBtn.classList.remove('is-confirmed');
        }

        // Enable/disable based on validation
        const validation = getAdapterMappingValidation(intent, portCount);
        confirmBtn.disabled = !validation.isValid && !confirmed;
    }

    if (resetBtn) {
        resetBtn.disabled = confirmed;
    }

    if (statusEl) {
        statusEl.textContent = confirmed ? 'Mapping confirmed.' : 'Drag adapters to assign them to intents.';
    }
}

function getAdapterMappingValidation(intent, portCount) {
    const errors = [];
    const zones = getIntentZonesForIntent(intent);
    const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];

    zones.forEach(zone => {
        const assignedAdapters = [];
        for (let i = 1; i <= portCount; i++) {
            if (state.adapterMapping[i] === zone.key) {
                assignedAdapters.push(i);
            }
        }

        // Check minimum adapters
        if (assignedAdapters.length < zone.minAdapters) {
            errors.push(`${zone.title} requires at least ${zone.minAdapters} adapter(s).`);
        }

        // Check RDMA requirement
        if (zone.requiresRdma && assignedAdapters.length > 0) {
            const nonRdmaAdapters = assignedAdapters.filter(portId => {
                const pc = cfg[portId - 1];
                return !pc || pc.rdma !== true;
            });

            if (nonRdmaAdapters.length > 0) {
                errors.push(`${zone.title}: Ports ${nonRdmaAdapters.join(', ')} are not RDMA-capable.`);
            }
        }
    });

    // Check for unassigned adapters (except for custom intent)
    if (intent !== 'custom') {
        const unassigned = [];
        for (let i = 1; i <= portCount; i++) {
            if (!state.adapterMapping[i] || state.adapterMapping[i] === 'pool') {
                unassigned.push(i);
            }
        }
        if (unassigned.length > 0) {
            errors.push(`Unassigned adapters: Ports ${unassigned.join(', ')}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

function validateAdapterMapping(intent, portCount) {
    const validationEl = document.getElementById('adapter-mapping-validation');
    if (!validationEl) return;

    const validation = getAdapterMappingValidation(intent, portCount);

    if (validation.isValid) {
        validationEl.classList.add('hidden');
        validationEl.classList.remove('visible');
    } else {
        validationEl.innerHTML = `<strong>Validation Issues:</strong><ul style="margin: 0.5rem 0 0 1rem; padding: 0;">
            ${validation.errors.map(e => `<li>${e}</li>`).join('')}
        </ul>`;
        validationEl.classList.remove('hidden');
        validationEl.classList.add('visible');
    }
}

function confirmAdapterMapping() {
    const portCount = parseInt(state.ports) || 0;
    const intent = state.intent;

    if (state.adapterMappingConfirmed) {
        // Toggle to edit mode
        state.adapterMappingConfirmed = false;
    } else {
        // Validate before confirming
        const validation = getAdapterMappingValidation(intent, portCount);
        if (!validation.isValid) {
            return;
        }

        state.adapterMappingConfirmed = true;

        // Sync with customIntents for backward compatibility
        syncAdapterMappingToCustomIntents();
    }

    renderAdapterMappingUi();
    updateUI();
}

function resetAdapterMapping() {
    const portCount = parseInt(state.ports) || 0;
    const intent = state.intent;

    state.adapterMapping = getDefaultAdapterMapping(intent, portCount);
    state.adapterMappingConfirmed = false;
    state.adapterMappingSelection = null;

    renderAdapterMappingUi();
}

function confirmOverrides() {
    if (state.overridesConfirmed) {
        // Toggle to edit mode
        state.overridesConfirmed = false;
    } else {
        state.overridesConfirmed = true;
    }
    updateOverridesUI();
    updateUI();
}

function updateOverridesUI() {
    const confirmBtn = document.getElementById('overrides-confirm-btn');
    const statusEl = document.getElementById('overrides-status');
    const container = document.getElementById('intent-overrides-container');

    if (confirmBtn) {
        if (state.overridesConfirmed) {
            confirmBtn.innerHTML = CONFIRM_BTN_PENCIL + 'Edit Overrides';
            confirmBtn.classList.add('is-confirmed');
        } else {
            confirmBtn.innerHTML = CONFIRM_BTN_CHECKMARK + 'Confirm Overrides';
            confirmBtn.classList.remove('is-confirmed');
        }
    }

    if (statusEl) {
        statusEl.textContent = state.overridesConfirmed ? 'Overrides confirmed.' : '';
    }

    // Disable inputs when confirmed
    if (container) {
        const inputs = container.querySelectorAll('select, input');
        inputs.forEach(input => {
            input.disabled = state.overridesConfirmed;
        });
    }
}

function syncAdapterMappingToCustomIntents() {
    // Sync adapter mapping to customIntents for backward compatibility with export/report
    if (!state.customIntents) state.customIntents = {};

    const portCount = parseInt(state.ports) || 0;
    for (let i = 1; i <= portCount; i++) {
        const zone = state.adapterMapping[i] || 'pool';
        if (zone === 'pool') {
            state.customIntents[i] = 'unused';
        } else {
            state.customIntents[i] = zone;
        }
    }

    // Mark as confirmed for legacy code
    state.customIntentConfirmed = state.adapterMappingConfirmed;
}
