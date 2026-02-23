// ============================================================================
// DISCONNECTED OPERATIONS — Cluster Role Flow
// ============================================================================
// When user selects "Disconnected" in Step 1, a new D1 step appears asking
// the cluster role:
//
//   • Management Cluster — full wizard flow (regions, appliance IPs, all steps)
//   • Workload Cluster   — simplified flow: skip region selection, enter the
//                           Autonomous Cloud FQDN of the management cluster,
//                           then configure the remaining network steps.
//
// State additions to the global `state` object:
//   state.clusterRole         – 'management' | 'workload' | null
//   state.autonomousCloudFqdn – string | null   (both cluster roles)
//   state.applianceIp1        – string | null   (mgmt cluster only)
//   state.applianceIp2        – string | null   (mgmt cluster only)
// ============================================================================

(function () {
    'use strict';

    // ========================================================================
    // STATE INITIALISATION
    // ========================================================================

    function initDisconnectedState() {
        if (typeof state === 'undefined') return;
        if (!('clusterRole' in state)) state.clusterRole = null;
        if (!('autonomousCloudFqdn' in state)) state.autonomousCloudFqdn = null;
        if (!('fqdnConfirmed' in state)) state.fqdnConfirmed = false;
        if (!('applianceIp1' in state)) state.applianceIp1 = null;
        if (!('applianceIp2' in state)) state.applianceIp2 = null;
    }

    // ========================================================================
    // SELECTION HANDLER  (called from D1 onclick)
    // ========================================================================

    window.selectDisconnectedOption = function (category, value) {
        initDisconnectedState();

        if (category === 'clusterRole') {
            state.clusterRole = value;
            state.fqdnConfirmed = false;
            state.autonomousCloudFqdn = null;
            // Clear FQDN input when switching cluster role
            var fqdnInput = document.getElementById('autonomous-cloud-fqdn');
            if (fqdnInput) fqdnInput.value = '';

            // Management cluster: force 3 nodes, standard scale
            if (value === 'management') {
                state.scale = 'medium';
                state.nodes = '3';
            }

            // Workload cluster: clear region-related state (not needed)
            if (value === 'workload') {
                state.applianceIp1 = null;
                state.applianceIp2 = null;
            }
        }

        if (typeof updateUI === 'function') updateUI();
        if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();

        // Auto-scroll to next step (skip during template/import loading)
        if (!window.__loadingTemplate) {
            setTimeout(function () {
                if (category === 'clusterRole') {
                    var fqdnStep = document.getElementById('step-fqdn');
                    if (fqdnStep) fqdnStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 200);
        }
    };

    // ========================================================================
    // FQDN INPUT HANDLER  (management & workload clusters)
    // ========================================================================

    // Helper: check if the current FQDN value is a valid format
    function isValidFqdn(fqdn) {
        if (!fqdn) return false;
        var fqdnRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)+$/;
        if (!fqdnRegex.test(fqdn)) return false;

        var labels = fqdn.toLowerCase().split('.');

        // Reject apex/root domains like contoso.com (must be a host FQDN)
        if (labels.length < 3) return false;

        // Azure Local disconnected operations endpoint must not use .local
        if (labels[labels.length - 1] === 'local') return false;

        return true;
    }

    // Helper: update the confirm button enabled/disabled state
    function updateFqdnConfirmButton() {
        var btn = document.getElementById('fqdn-confirm-btn');
        if (!btn) return;
        var fqdn = (state.autonomousCloudFqdn || '').trim();
        btn.disabled = !isValidFqdn(fqdn);
    }

    // Helper: sync the confirm / confirmed UI state
    function updateFqdnConfirmUI() {
        var confirmContainer = document.getElementById('fqdn-confirm-container');
        var confirmedMsg = document.getElementById('fqdn-confirmed-msg');
        var fqdnInput = document.getElementById('autonomous-cloud-fqdn');
        if (!confirmContainer || !confirmedMsg) return;

        if (state.fqdnConfirmed) {
            confirmContainer.classList.add('hidden');
            confirmedMsg.classList.remove('hidden');
            if (fqdnInput) { fqdnInput.disabled = true; fqdnInput.style.opacity = '0.6'; }
        } else {
            confirmContainer.classList.remove('hidden');
            confirmedMsg.classList.add('hidden');
            if (fqdnInput) { fqdnInput.disabled = false; fqdnInput.style.opacity = '1'; }
            updateFqdnConfirmButton();
        }
    }

    window.updateAutonomousCloudFqdn = function (value) {
        initDisconnectedState();
        var fqdn = (value || '').trim();
        state.autonomousCloudFqdn = fqdn || null;

        // If user edits the FQDN, un-confirm
        state.fqdnConfirmed = false;

        var errEl = document.getElementById('fqdn-error');
        var succEl = document.getElementById('fqdn-success');
        if (errEl) { errEl.classList.add('hidden'); errEl.classList.remove('visible'); }
        if (succEl) { succEl.classList.add('hidden'); succEl.classList.remove('visible'); }

        if (!fqdn) {
            updateFqdnConfirmUI();
            return;
        }

        // Basic FQDN validation: at least one dot, no spaces, valid chars
        if (!isValidFqdn(fqdn)) {
            if (errEl) {
                errEl.textContent = '\u26A0 Invalid endpoint FQDN. Use a host FQDN (for example: mgmt.contoso.com). Root domains (contoso.com) and .local domains are not supported.';
                errEl.classList.remove('hidden');
                errEl.classList.add('visible');
            }
        } else {
            if (succEl) {
                succEl.classList.remove('hidden');
                succEl.classList.add('visible');
            }
        }

        updateFqdnConfirmUI();
        if (typeof updateUI === 'function') updateUI();
        if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
    };

    // Confirm FQDN (called from button click)
    window.confirmFqdn = function () {
        initDisconnectedState();
        var fqdn = (state.autonomousCloudFqdn || '').trim();
        if (!isValidFqdn(fqdn)) return;
        state.fqdnConfirmed = true;
        updateFqdnConfirmUI();
        if (typeof updateUI === 'function') updateUI();
        if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();

        // Scroll to the next visible step so the user sees the wizard progress (skip during template/import loading)
        if (!window.__loadingTemplate) {
            setTimeout(function () {
                // Management sees cloud step next; workload skips to step-2 (scale)
                var nextStepId = state.clusterRole === 'workload' ? 'step-2' : 'step-cloud';
                var nextStep = document.getElementById(nextStepId);
                if (nextStep && !nextStep.classList.contains('hidden')) {
                    nextStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 250);
        }
    };

    // Edit FQDN (unlock for editing)
    window.editFqdn = function () {
        initDisconnectedState();
        state.fqdnConfirmed = false;
        updateFqdnConfirmUI();
        // Focus the input
        var fqdnInput = document.getElementById('autonomous-cloud-fqdn');
        if (fqdnInput) fqdnInput.focus();
        if (typeof updateUI === 'function') updateUI();
        if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
    };

    // ========================================================================
    // APPLIANCE IP VALIDATION  (management cluster)
    // ========================================================================

    window.updateApplianceIps = function () {
        var ip1Input = document.getElementById('appliance-ip-1');
        var ip2Input = document.getElementById('appliance-ip-2');
        var errEl = document.getElementById('appliance-ip-error');
        var succEl = document.getElementById('appliance-ip-success');
        if (!ip1Input || !ip2Input) return;

        var ip1 = ip1Input.value.trim();
        var ip2 = ip2Input.value.trim();

        if (errEl) { errEl.classList.add('hidden'); errEl.classList.remove('visible'); }
        if (succEl) { succEl.classList.add('hidden'); succEl.classList.remove('visible'); }

        state.applianceIp1 = ip1 || null;
        state.applianceIp2 = ip2 || null;

        if (!ip1 && !ip2) return;

        var errors = validateApplianceIps(ip1, ip2);
        if (errors.length > 0) {
            if (errEl) {
                errEl.innerHTML = errors.map(function (e) { return '\u26A0 ' + e; }).join('<br>');
                errEl.classList.remove('hidden');
                errEl.classList.add('visible');
            }
        } else if (ip1 && ip2) {
            if (succEl) {
                succEl.classList.remove('hidden');
                succEl.classList.add('visible');
            }
        }

        if (typeof saveStateToLocalStorage === 'function') saveStateToLocalStorage();
    };

    function validateApplianceIps(ip1, ip2) {
        var errors = [];
        var ipRegex = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

        if (ip1 && !ipRegex.test(ip1)) errors.push('Appliance IP 1 is not a valid IPv4 address.');
        if (ip2 && !ipRegex.test(ip2)) errors.push('Appliance IP 2 is not a valid IPv4 address.');
        if (errors.length > 0) return errors;

        if (ip1 && ip2 && ip1 === ip2) errors.push('Appliance IP 1 and IP 2 must be different.');

        // Check within infra CIDR
        if (state.infraCidr) {
            var cidrParts = state.infraCidr.split('/');
            if (cidrParts.length === 2) {
                var networkIp = cidrParts[0];
                var prefix = parseInt(cidrParts[1]);
                var networkLong = ipToLong(networkIp);
                var mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
                var netStart = (networkLong & mask) >>> 0;
                var netEnd = (netStart | (~mask >>> 0)) >>> 0;

                if (ip1) {
                    var ip1Long = ipToLong(ip1);
                    if (ip1Long <= netStart || ip1Long >= netEnd) {
                        errors.push('Appliance IP 1 (' + ip1 + ') is outside the infrastructure CIDR ' + state.infraCidr + '.');
                    }
                }
                if (ip2) {
                    var ip2Long = ipToLong(ip2);
                    if (ip2Long <= netStart || ip2Long >= netEnd) {
                        errors.push('Appliance IP 2 (' + ip2 + ') is outside the infrastructure CIDR ' + state.infraCidr + '.');
                    }
                }
            }
        }

        // Check not a node IP
        if (state.nodeSettings && state.nodeSettings.length > 0) {
            state.nodeSettings.forEach(function (node, idx) {
                if (node && node.ipCidr) {
                    var nodeIp = node.ipCidr.split('/')[0];
                    if (ip1 && ip1 === nodeIp) errors.push('Appliance IP 1 conflicts with Node ' + (idx + 1) + ' IP (' + nodeIp + ').');
                    if (ip2 && ip2 === nodeIp) errors.push('Appliance IP 2 conflicts with Node ' + (idx + 1) + ' IP (' + nodeIp + ').');
                }
            });
        }

        // Check not the gateway
        if (state.infraGateway) {
            if (ip1 && ip1 === state.infraGateway) errors.push('Appliance IP 1 conflicts with the default gateway (' + state.infraGateway + ').');
            if (ip2 && ip2 === state.infraGateway) errors.push('Appliance IP 2 conflicts with the default gateway (' + state.infraGateway + ').');
        }

        return errors;
    }

    function ipToLong(ip) {
        var parts = ip.split('.').map(Number);
        return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    }

    // ========================================================================
    // UI RENDERING — hooked into updateUI
    // ========================================================================

    function updateDisconnectedUI() {
        var stepD1 = document.getElementById('step-d1');
        var stepFqdn = document.getElementById('step-fqdn');
        var applianceSection = document.getElementById('appliance-ip-section');

        // Hide D-steps by default
        if (stepD1) stepD1.classList.add('hidden');
        if (stepFqdn) stepFqdn.classList.add('hidden');

        if (state.scenario !== 'disconnected') {
            // Clean up disconnected state when leaving
            if (state.clusterRole !== null) {
                state.clusterRole = null;
                state.autonomousCloudFqdn = null;
                state.fqdnConfirmed = false;
                state.applianceIp1 = null;
                state.applianceIp2 = null;
            }
            if (applianceSection) applianceSection.classList.add('hidden');
            hideWorkloadTwoNodeBanner();
            var ctxBanner = document.getElementById('disconnected-cloud-context');
            if (ctxBanner) { ctxBanner.classList.add('hidden'); ctxBanner.classList.remove('visible'); }
            return;
        }

        // === D1 always visible for disconnected ===
        if (stepD1) stepD1.classList.remove('hidden');
        updateD1Selection();
        updateD1Explanation();

        // === No cluster role selected → hide all regular steps ===
        if (!state.clusterRole) {
            hideRegularSteps();
            if (applianceSection) applianceSection.classList.add('hidden');
            hideWorkloadTwoNodeBanner();
            var ctxBanner2 = document.getElementById('disconnected-cloud-context');
            if (ctxBanner2) { ctxBanner2.classList.add('hidden'); ctxBanner2.classList.remove('visible'); }
            return;
        }

        // === BOTH FLOWS: Show FQDN step ===
        if (state.clusterRole === 'workload' || state.clusterRole === 'management') {
            // Show FQDN step for both management and workload clusters
            if (stepFqdn) stepFqdn.classList.remove('hidden');
            // Restore FQDN value
            var fqdnInput = document.getElementById('autonomous-cloud-fqdn');
            if (fqdnInput && state.autonomousCloudFqdn && !fqdnInput.value) {
                fqdnInput.value = state.autonomousCloudFqdn;
            }
            // Sync the confirm/confirmed UI
            updateFqdnConfirmUI();
        }

        // === Show context banner early for management cluster (visible alongside FQDN step) ===
        var cloudContextBannerEarly = document.getElementById('disconnected-cloud-context');
        if (state.clusterRole === 'management') {
            if (cloudContextBannerEarly) { cloudContextBannerEarly.classList.remove('hidden'); cloudContextBannerEarly.classList.add('visible'); }
        } else {
            if (cloudContextBannerEarly) { cloudContextBannerEarly.classList.add('hidden'); cloudContextBannerEarly.classList.remove('visible'); }
        }

        // === GATE: FQDN must be confirmed before any further steps ===
        if (!state.fqdnConfirmed) {
            hideRegularSteps();
            if (applianceSection) applianceSection.classList.add('hidden');
            return;
        }

        // === Context banner for management cluster cloud/region steps ===
        var cloudContextBanner = document.getElementById('disconnected-cloud-context');

        // === WORKLOAD CLUSTER FLOW ===
        if (state.clusterRole === 'workload') {

            // Hide region steps (cloud + local-region) — workload clusters don't need them
            var stepCloud = document.getElementById('step-cloud');
            var stepLocalRegion = document.getElementById('step-local-region');
            if (stepCloud) stepCloud.classList.add('hidden');
            if (stepLocalRegion) stepLocalRegion.classList.add('hidden');

            // Hide context banner (not relevant for workload clusters)
            if (cloudContextBanner) { cloudContextBanner.classList.add('hidden'); cloudContextBanner.classList.remove('visible'); }

            // Hide appliance IP section (workload clusters don't have an appliance)
            if (applianceSection) applianceSection.classList.add('hidden');

            // Show node constraint note for disconnected workload clusters
            showWorkloadTwoNodeBanner();
        }

        // === MANAGEMENT CLUSTER FLOW ===
        if (state.clusterRole === 'management') {
            // Show context banner explaining why Azure Cloud & Region are still needed
            if (cloudContextBanner) { cloudContextBanner.classList.remove('hidden'); cloudContextBanner.classList.add('visible'); }

            // Show normal flow (regions etc) — updateUI() already un-hides them

            // Show appliance IP section in step-12 when infra is configured
            if (applianceSection) {
                if (state.infra && state.infra.start && state.infra.end) {
                    applianceSection.classList.remove('hidden');
                    // Restore input values
                    var ip1 = document.getElementById('appliance-ip-1');
                    var ip2 = document.getElementById('appliance-ip-2');
                    if (ip1 && state.applianceIp1 && !ip1.value) ip1.value = state.applianceIp1;
                    if (ip2 && state.applianceIp2 && !ip2.value) ip2.value = state.applianceIp2;
                } else {
                    applianceSection.classList.add('hidden');
                }
            }

            // Lock node count to 3 for management cluster
            applyMgmtClusterConstraints();
            hideWorkloadTwoNodeBanner();
        }

        // === BOTH FLOWS: Disable Private Endpoints (not supported for disconnected) ===
        disablePrivateEndpoints();

        // === WORKLOAD FLOW: Hide ADFS server name (mgmt cluster config only) ===
        if (state.clusterRole === 'workload') {
            var adfsSection = document.getElementById('adfs-server-section');
            if (adfsSection) adfsSection.classList.add('hidden');
            state.adfsServerName = null;
        }
    }

    function hideRegularSteps() {
        var ids = [
            'step-cloud', 'step-local-region', 'step-2', 'step-3', 'step-3-5',
            'step-4', 'step-5', 'step-6', 'step-7', 'step-8', 'step-9',
            'step-9b', 'step-10', 'step-11', 'step-12', 'step-5-5',
            'step-13', 'step-13-5', 'step-14'
        ];
        ids.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
    }

    function updateD1Selection() {
        document.querySelectorAll('#step-d1 .option-card').forEach(function (card) {
            var val = card.getAttribute('data-value');
            card.classList.toggle('selected', val === state.clusterRole);
        });
    }

    function updateD1Explanation() {
        var box = document.getElementById('d1-explanation');
        if (!box) return;
        if (state.clusterRole === 'management') {
            box.innerHTML = '<strong style="color: #ef4444;">Management Cluster</strong>' +
                '<p style="margin:0.5rem 0 0 0;">This cluster hosts the disconnected operations appliance VM that provides the local Azure Portal and CLI control plane. ' +
                'The management cluster is fixed at 3 nodes.</p>';
            box.classList.remove('hidden');
            box.classList.add('visible');
        } else if (state.clusterRole === 'workload') {
            box.innerHTML = '<strong style="color: var(--accent-blue);">Workload Cluster</strong>' +
                '<p style="margin:0.5rem 0 0 0;">This cluster runs tenant workloads and connects to the management cluster via the ' +
                'Autonomous Cloud FQDN. No region selection is needed \u2014 the workload cluster inherits its configuration ' +
                'from the management cluster\'s disconnected operations appliance.</p>';
            box.classList.remove('hidden');
            box.classList.add('visible');
        } else {
            box.classList.add('hidden');
            box.classList.remove('visible');
        }
    }

    // ========================================================================
    // PRIVATE ENDPOINTS — disabled for disconnected operations
    // ========================================================================

    function disablePrivateEndpoints() {
        // Force state to disabled
        state.privateEndpoints = 'pe_disabled';
        state.privateEndpointsList = [];

        // Show step-9b but disable cards and add explanation
        var step9b = document.getElementById('step-9b');
        if (step9b) {
            step9b.classList.remove('hidden');

            // Disable all PE option cards
            document.querySelectorAll('#step-9b .option-card').forEach(function (card) {
                card.classList.add('disabled');
                card.style.opacity = '0.5';
                card.style.pointerEvents = 'none';
            });

            // Force pe_disabled card to show as selected
            var peDisabledCard = step9b.querySelector('[data-value="pe_disabled"]');
            if (peDisabledCard) peDisabledCard.classList.add('selected');

            // Add/update info banner
            var banner = document.getElementById('pe-disconnected-info');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'pe-disconnected-info';
                banner.className = 'info-box warning visible';
                banner.style.marginTop = '1rem';
                banner.innerHTML = '<strong style="color: #ef4444;">Not Available</strong>' +
                    '<p style="margin:0.25rem 0 0;">Azure Local disconnected operations does not support Private Endpoints. ' +
                    'This option is automatically set to Disabled.</p>';
                var grid = step9b.querySelector('.options-grid');
                if (grid) grid.parentNode.insertBefore(banner, grid.nextSibling);
            }
            banner.classList.remove('hidden');

            // Hide PE selection section (checkboxes)
            var peSelection = document.getElementById('private-endpoints-selection');
            if (peSelection) peSelection.classList.add('hidden');
        }
    }

    // ========================================================================
    // MANAGEMENT CLUSTER CONSTRAINTS
    // ========================================================================

    function applyMgmtClusterConstraints() {
        if (state.scenario !== 'disconnected' || state.clusterRole !== 'management') return;

        // Force 3 nodes
        state.nodes = '3';
        state.scale = 'medium';

        // Disable node chips that are not 3
        document.querySelectorAll('#step-3 .node-chip').forEach(function (chip) {
            var onclick = chip.getAttribute('onclick') || '';
            var match = onclick.match(/'([^']+)'\)$/);
            if (match) {
                var val = match[1];
                if (val !== '3') {
                    chip.classList.add('disabled');
                }
            }
        });

        // Add/show management cluster info banner
        showMgmtBanner();
    }

    function showMgmtBanner() {
        var nodesStep = document.getElementById('step-3');
        if (!nodesStep) return;
        var banner = document.getElementById('mgmt-cluster-info');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'mgmt-cluster-info';
            banner.className = 'info-box visible';
            banner.style.marginBottom = '1rem';
            banner.innerHTML = '<strong style="color: #ef4444;">\uD83D\uDEE1\uFE0F Management Cluster</strong>' +
                '<p style="margin:0.25rem 0 0;">The management cluster is fixed at 3 nodes. ' +
                'It hosts the disconnected operations appliance VM, DNS, PKI, Active Directory, and ADFS services.</p>';
            var header = nodesStep.querySelector('.step-header');
            if (header && header.nextElementSibling) {
                header.parentNode.insertBefore(banner, header.nextElementSibling);
            } else if (header) {
                nodesStep.appendChild(banner);
            }
        }
        banner.classList.remove('hidden');
    }

    function hideMgmtBanner() {
        var banner = document.getElementById('mgmt-cluster-info');
        if (banner) banner.classList.add('hidden');
    }

    function showWorkloadTwoNodeBanner() {
        if (state.scenario !== 'disconnected' || state.clusterRole !== 'workload') {
            hideWorkloadTwoNodeBanner();
            return;
        }

        var nodesStep = document.getElementById('step-3');
        if (!nodesStep) return;

        var banner = document.getElementById('workload-two-node-info');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'workload-two-node-info';
            banner.className = 'info-box warning visible';
            banner.style.marginBottom = '1rem';
            banner.innerHTML = '<strong style="color: #ef4444;">⚠️ Disconnected Workload Cluster Constraint</strong>' +
                '<p style="margin:0.25rem 0 0;">Azure Local disconnected operations does not support cloud witness and 2 nodes deployment is not supported.</p>';
            var header = nodesStep.querySelector('.step-header');
            if (header && header.nextElementSibling) {
                header.parentNode.insertBefore(banner, header.nextElementSibling);
            } else if (header) {
                nodesStep.appendChild(banner);
            }
        }

        banner.classList.remove('hidden');
    }

    function hideWorkloadTwoNodeBanner() {
        var banner = document.getElementById('workload-two-node-info');
        if (banner) banner.classList.add('hidden');
    }

    // ========================================================================
    // WORKLOAD CLUSTER — auto-set defaults when FQDN provided
    // ========================================================================

    function applyWorkloadDefaults() {
        if (state.scenario !== 'disconnected' || state.clusterRole !== 'workload') return;

        // Workload cluster: set region defaults so downstream steps aren't blocked.
        // No cloud/region step is shown — these are silent defaults.
        if (!state.region) state.region = 'azure_commercial';
        if (!state.localInstanceRegion) state.localInstanceRegion = 'eastus';
        if (!state.scale) state.scale = 'medium';
    }

    // ========================================================================
    // HOOKS INTO MAIN WIZARD
    // ========================================================================

    var _originalUpdateUI = window.updateUI;
    if (typeof _originalUpdateUI === 'function') {
        window.updateUI = function () {
            initDisconnectedState();

            // For workload clusters, auto-set region defaults before updateUI runs
            // so that step visibility logic works correctly
            if (state.scenario === 'disconnected' && state.clusterRole === 'workload') {
                applyWorkloadDefaults();
            }

            // Force private endpoints disabled before updateUI so downstream
            // steps (Management Connectivity) don't get blocked
            if (state.scenario === 'disconnected' && state.clusterRole) {
                state.privateEndpoints = 'pe_disabled';
                state.privateEndpointsList = [];
            }

            _originalUpdateUI.apply(this, arguments);

            // Run disconnected-specific UI logic after base updateUI
            updateDisconnectedUI();
        };
    }

    // Hook into resetAll
    var _originalResetAll = window.resetAll;
    if (typeof _originalResetAll === 'function') {
        window.resetAll = function () {
            state.clusterRole = null;
            state.autonomousCloudFqdn = null;
            state.fqdnConfirmed = false;
            state.applianceIp1 = null;
            state.applianceIp2 = null;

            // Clear FQDN input
            var fqdnInput = document.getElementById('autonomous-cloud-fqdn');
            if (fqdnInput) fqdnInput.value = '';

            // Clear appliance inputs
            var ip1 = document.getElementById('appliance-ip-1');
            var ip2 = document.getElementById('appliance-ip-2');
            if (ip1) ip1.value = '';
            if (ip2) ip2.value = '';

            // Hide banners
            hideMgmtBanner();
            hideWorkloadTwoNodeBanner();

            _originalResetAll.apply(this, arguments);
        };
    }

    // Hook into selectOption — reset disconnected state when scenario changes
    var _originalSelectOption = window.selectOption;
    if (typeof _originalSelectOption === 'function') {
        window.selectOption = function (category, value) {
            if (category === 'scenario' && value !== 'disconnected') {
                state.clusterRole = null;
                state.autonomousCloudFqdn = null;
                state.fqdnConfirmed = false;
                state.applianceIp1 = null;
                state.applianceIp2 = null;
                hideMgmtBanner();
                hideWorkloadTwoNodeBanner();
            }

            // When scenario changes to disconnected, reset the sub-state
            if (category === 'scenario' && value === 'disconnected') {
                state.clusterRole = null;
                state.autonomousCloudFqdn = null;
                state.fqdnConfirmed = false;
                state.applianceIp1 = null;
                state.applianceIp2 = null;
                hideWorkloadTwoNodeBanner();
            }

            _originalSelectOption.apply(this, arguments);
        };
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { initDisconnectedState(); });
    } else {
        initDisconnectedState();
    }

})();
