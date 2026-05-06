/* global JSZip */
/* Reference Architectures picker, SVG preview, and PPT export.
 * Plain global-scope JS, no module system. */

(function() {
    'use strict';

    // ------------------------------------------------------------------
    // Data
    // ------------------------------------------------------------------

    const PURPOSES = [
        {
            id: 'azure-local',
            iconFile: 'icons/sovereign-azure-local-cluster.svg',
            chipIconFile: 'icons/sovereign-vm.svg',
            title: 'General Purpose Workloads',
            subtitle: 'on Azure Local',
            desc: 'Enable data residency, regulatory compliance, and low-latency performance in on-premises and disconnected environments.',
            recommendedConnectivity: 'connected',
            recommendedScale: 'cluster-16'
        },
        {
            id: 'm365-local',
            iconFiles: ['icons/sovereign-m365-exchange.png', 'icons/sovereign-m365-sharepoint.png', 'icons/sovereign-m365-skype.png'],
            title: 'Microsoft 365 Local',
            subtitle: 'on Azure Local',
            desc: 'Run Microsoft productivity server workloads on secure, on-premises infrastructure that meets local regulatory requirements. Deploy and operate with confidence through a partner-led deployment based on validated reference architecture.',
            recommendedConnectivity: 'disconnected',
            recommendedScale: 'm365-large',
            // M365 Local has its own scale options (see SPC L300 deck slides 66-68).
            scaleOptionsOverride: [
                { id: 'm365-small', iconFiles: ['icons/sovereign-m365-exchange.png', 'icons/sovereign-m365-sharepoint.png', 'icons/sovereign-m365-skype.png'], sizeBadge: 'S', title: 'M365 Local — Small-Scale', desc: 'Single 3-node Azure Local cluster hosting Active Directory, Firewall, Load Balancer, and the M365 Local workload servers.' },
                { id: 'm365-large', iconFiles: ['icons/sovereign-m365-exchange.png', 'icons/sovereign-m365-sharepoint.png', 'icons/sovereign-m365-skype.png'], sizeBadge: 'L', title: 'M365 Local — Large-Scale', desc: 'Multi-cluster M365 Local deployment with dedicated clusters for Exchange mailbox, Exchange Edge Transport, SharePoint/Skype/SQL, AD, Firewall, and Load Balancer.' }
            ],
            // M365 Local supports strict isolation only — no logical isolation option.
            tenancyOptionsOverride: ['strict']
        },
        {
            id: 'github-enterprise-local',
            iconFile: 'icons/sovereign-github.png',
            title: 'GitHub Enterprise Local',
            subtitle: 'on Azure Local',
            desc: 'Enable modern DevSecOps for regulated and disconnected environments using GitHub Enterprise Server on Azure Local with built-in security, compliance, and Azure management.',
            badge: { text: 'Private Preview', kind: 'preview' },
            recommendedConnectivity: 'connected',
            recommendedScale: 'cluster-16'
        },
        {
            id: 'avd',
            iconFile: 'icons/sovereign-avd.svg',
            title: 'Azure Virtual Desktop',
            subtitle: 'on Azure Local',
            desc: 'Run a fully cloud-managed VDI experience on-premises, keeping desktops and data local while using the familiar Azure control plane. Benefit from cloud consistency with on-prem performance, sovereignty, and low latency.',
            recommendedConnectivity: 'connected',
            recommendedScale: 'cluster-16'
        },
        {
            id: 'foundry-local',
            iconFile: 'icons/sovereign-foundry.png',
            title: 'Foundry Local',
            subtitle: 'on Azure Local',
            desc: 'Models and inferencing on premises. Run AI models, agents, and agentic RAG to enable advanced, secure AI capabilities on local GPUs.',
            badge: { text: 'New', kind: 'new' },
            recommendedConnectivity: 'connected',
            recommendedScale: 'single-node'
        }
    ];

    const CONNECTIVITY = [
        { id: 'connected', icon: '🌐', title: 'Connected', desc: 'Public or private path to Azure with Arc Gateway.' },
        { id: 'disconnected', icon: '🔌', title: 'Disconnected / Air-gapped', desc: 'Local control plane appliance, optional limited connectivity.' }
    ];

    const TENANCY = [
        {
            id: 'strict',
            title: 'Strict isolation',
            sub: '(dedicated hardware)',
            desc: 'Dedicated cluster per tenant for the highest level of security and separation.'
        },
        {
            id: 'logical',
            title: 'Logical isolation',
            sub: '(shared infrastructure)',
            desc: 'Logical isolation on shared infrastructure with consumption limits and segregated operations.',
            comingSoon: true
        }
    ];

    const SCALE = [
        { id: 'single-node', iconFile: 'icons/sovereign-azure-local-cluster.svg', sizeBadge: '1', title: 'Azure Local Single Node', desc: 'A single-server Azure Local deployment for the smallest edge footprints.' },
        { id: 'cluster-16', iconFile: 'icons/sovereign-azure-local-cluster.svg', sizeBadge: '16', title: 'Azure Local Cluster up to 16 nodes', desc: 'Standard Azure Local cluster — 2 to 16 nodes in a single rack.' },
        { id: 'cluster-64', iconFile: 'icons/sovereign-azure-local-cluster.svg', sizeBadge: '64', title: 'Azure Local Cluster up to 64 nodes', desc: 'Multi-rack Azure Local cluster scaled up to 64 nodes.' },
        { id: 'cluster-128', iconFile: 'icons/sovereign-azure-local-cluster.svg', sizeBadge: '128', title: 'Azure Local Cluster up to 128 nodes', desc: 'Largest Azure Local footprint — up to 128 nodes across multiple racks.', comingSoon: true }
    ];

    // Each template defines clusters (rendered as cards in the "Distributed location" band)
    // and the cloud-side services. workloadIcons are PNG file names in ./icons/ used in
    // both the SVG preview and the generated PPT.
    const TEMPLATES = {
        'azure-local': {
            title: 'Azure Local — Sovereign Private Cloud',
            summary: 'A general-purpose Azure Local deployment for line-of-business VMs and AKS Arc — the foundation for data residency, regulatory compliance, and low-latency on-premises workloads.',
            cloud: {
                title: 'Azure (control plane)',
                disconnectedTitle: 'Azure (limited connectivity)',
                services: ['Azure Arc', 'Azure Monitor', 'Update Manager', 'Backup']
            },
            location: { title: 'Distributed location' },
            clusters: [
                { name: 'Control Plane Appliance', nodes: 1, workloads: ['Control plane VM'], disconnectedOnly: true },
                {
                    name: 'Azure Local Cluster',
                    nodes: 4,
                    workloads: ['azure-local', 'Line-of-business VMs', 'AKS Arc', 'Arc Data Services']
                }
            ],
            notes: [
                'Recommended footprint: connected + single-rack (typically 2–4 nodes).',
                'Default starting point — pair with the ODIN Sizer tool for hardware sizing.',
                'Switch the connectivity picker to disconnected to add a control-plane appliance.'
            ]
        },
        'm365-local': {
            title: 'Microsoft 365 Local on Azure Local',
            summary: 'Sovereign deployment of Exchange Server, SharePoint Server and Skype for Business productivity workloads on Azure Local, with a dedicated control-plane appliance for disconnected operations.',
            cloud: {
                title: 'Azure (control plane)',
                disconnectedTitle: 'Azure (limited connectivity)',
                services: ['Azure Arc', 'Update Manager', 'Backup']
            },
            location: { title: 'Distributed location' },
            // M365 Local clusters depend entirely on the chosen scale (small vs large)
            // — see SPC L300 deck slides 66-68. The standard `clusters` array is unused.
            clusters: [],
            scaleVariants: {
                'm365-small': {
                    // Slide 68 — Connected Small-Scale: a single 3-node Azure Local cluster
                    // collapsing all M365 productivity workload servers (Exchange mailbox,
                    // Exchange Edge Transport, SharePoint, Skype for Business, SQL).
                    // Active Directory, Firewall and Load Balancer are infrastructure
                    // components on the management/compute networks — NOT cluster workloads.
                    clusters: [
                        {
                            name: 'Azure Local Cluster (3 nodes)',
                            nodes: 3,
                            workloads: ['Exchange mailbox servers', 'Exchange Edge Transport', 'SharePoint Server', 'Skype for Business', 'SQL Server'],
                            servers: ['Server 1', 'Server 2', 'Server 3'],
                            serversLabel: 'Servers'
                        }
                    ]
                },
                'm365-large': {
                    // Slides 66 & 67 — Large-Scale: 7 Azure Local clusters total.
                    // Clusters 1-4: single-node, Exchange mailbox servers (one per cluster).
                    // Clusters 5-6: single-node, Exchange Edge Transport servers.
                    // Cluster 7:    3-node, SharePoint, Skype for Business and SQL.
                    // Active Directory, Firewall, Load Balancer and the internal mgmt
                    // network router are infrastructure components on the management /
                    // compute networks — they are NOT separate Azure Local clusters.
                    clusters: [
                        { name: 'Azure Local Single Node', nodes: 1, workloads: ['Exchange mailbox servers'], servers: ['Server 1'], serversLabel: 'Server' },
                        { name: 'Azure Local Single Node', nodes: 1, workloads: ['Exchange mailbox servers'], servers: ['Server 2'], serversLabel: 'Server' },
                        { name: 'Azure Local Single Node', nodes: 1, workloads: ['Exchange mailbox servers'], servers: ['Server 3'], serversLabel: 'Server' },
                        { name: 'Azure Local Single Node', nodes: 1, workloads: ['Exchange mailbox servers'], servers: ['Server 4'], serversLabel: 'Server' },
                        { name: 'Azure Local Single Node', nodes: 1, workloads: ['Exchange Edge Transport'], servers: ['Server 5'], serversLabel: 'Server' },
                        { name: 'Azure Local Single Node', nodes: 1, workloads: ['Exchange Edge Transport'], servers: ['Server 6'], serversLabel: 'Server' },
                        { name: 'Azure Local Cluster (3 nodes)', nodes: 3, workloads: ['SharePoint Server', 'Skype for Business', 'SQL Server'], servers: ['Server 7', 'Server 8', 'Server 9'], serversLabel: 'Servers' }
                    ]
                }
            },
            notes: [
                'M365 Local runs on Azure Local Premier SKU hardware (see SPC L300 deck slide 69).',
                'Small-Scale: a single 3-node Azure Local cluster hosts all M365 productivity workload servers (Exchange mailbox, Exchange Edge Transport, SharePoint, Skype for Business, SQL).',
                'Large-Scale: 4 single-node Exchange mailbox clusters, 2 single-node Exchange Edge Transport clusters, and 1 three-node SharePoint/Skype/SQL cluster (7 Azure Local clusters total).',
                'Active Directory, Firewall, Load Balancer and the internal management network router are infrastructure components on the management/compute networks — not separate Azure Local clusters.',
                'Strict tenant isolation only — each productivity workload runs on dedicated hardware.',
                'Disconnected mode adds a Control Plane Appliance (3-node Disconnected Ops Cluster) regardless of scale.'
            ]
        },
        'github-enterprise-local': {
            title: 'GitHub Enterprise Local on Azure Local',
            summary: 'On-prem DevSecOps platform with GitHub Enterprise Server, container registry, build agents, and observability — keeping code, identity, and operations fully on-premises (Private Preview).',
            cloud: {
                title: 'Azure (control plane)',
                services: ['Azure Arc', 'Azure Monitor', 'Defender for Cloud']
            },
            location: { title: 'Distributed location' },
            clusters: [
                {
                    name: 'GitHub Enterprise Local Cluster',
                    nodes: 4,
                    workloads: ['GitHub Enterprise Server', 'Container Registry', 'AKS Build Agents', 'Observability Stack']
                }
            ],
            notes: [
                'Recommended footprint: connected + single-rack.',
                'AKS Arc hosts ephemeral build agents and the registry replica.',
                'GitHub Enterprise Local is in Private Preview at the time of writing.'
            ]
        },
        'foundry-local': {
            title: 'Foundry Local on Azure Local',
            summary: 'AI platform for models, agents, and agentic RAG running on GPU-equipped Azure Local nodes — Foundry Local, Edge RAG, and Video Indexer managed through Azure Arc.',
            cloud: {
                title: 'Azure (control plane)',
                services: ['Azure Arc', 'Azure AI Foundry', 'Azure Monitor', 'Container Registry']
            },
            location: { title: 'Distributed location' },
            clusters: [
                {
                    name: 'AI HCI Cluster',
                    nodes: 4,
                    workloads: ['foundry', 'AKS Arc', 'Edge RAG', 'Video Indexer', 'GPUs (VI + RAG)'],
                    // Slide 56 — model families available on Foundry Local. Logos are
                    // extracted from the L300 deck (slide 56) so the diagram matches
                    // the official marketing visual.
                    models: [
                        { name: 'DeepSeek', icon: 'icons/model-deepseek.png' },
                        { name: 'Microsoft', icon: 'icons/model-microsoft.png' },
                        { name: 'OpenAI', icon: 'icons/model-openai.png' },
                        { name: 'Qwen', icon: 'icons/model-qwen.png' },
                        { name: 'Mistral', icon: 'icons/model-mistral.png' },
                        { name: 'BYO', mono: '+', color: '#5c6b7a' }
                    ]
                }
            ],
            notes: [
                'Recommended footprint: connected + single-rack (4 GPU-equipped nodes).',
                'GPUs partitioned between Video Indexer and Edge RAG workloads.',
                'AKS Arc hosts the Foundry Local runtime and inference endpoints.'
            ]
        },
        'avd': {
            title: 'Azure Virtual Desktop on Azure Local',
            summary: 'On-premises VDI experience using Azure Virtual Desktop, keeping desktops and data local while leveraging the Azure control plane for management, identity, and monitoring.',
            cloud: {
                title: 'Azure (control plane)',
                disconnectedTitle: 'Azure (limited connectivity)',
                services: ['Azure Arc', 'AVD control plane', 'Microsoft Entra ID', 'Azure Monitor']
            },
            location: { title: 'Distributed location' },
            clusters: [
                { name: 'Control Plane Appliance', nodes: 1, workloads: ['Control plane VM'], disconnectedOnly: true },
                {
                    name: 'AVD Session Host Cluster',
                    nodes: 4,
                    workloads: ['AVD session hosts', 'FSLogix profiles', 'Domain controllers', 'AKS Arc']
                }
            ],
            notes: [
                'Recommended footprint: connected + single-rack.',
                'Session hosts run as Azure Local VMs; AVD control plane stays in Azure.',
                'FSLogix profiles stored on local SMB shares for low-latency sign-in.'
            ]
        }
    };

    // Workload tokens that should render as PNG icons in the preview/PPT.
    // Anything else renders as a labelled rounded rectangle.
    const WORKLOAD_ICON_FILES = {
        'azure-local': 'icons/workloads-gear.svg',
        'm365-exchange': 'icons/sovereign-m365-exchange.png',
        'm365-sharepoint': 'icons/sovereign-m365-sharepoint.png',
        'github': 'icons/sovereign-github.png',
        'foundry': 'icons/sovereign-foundry.png',
        'Line-of-business VMs': 'icons/sovereign-vm.svg',
        'AKS Arc': 'icons/sovereign-aks-arc.svg',
        'Arc Data Services': 'icons/sovereign-arc.svg',
        // GitHub Enterprise Local components — official Azure architecture icons
        // (Container Registry, AKS for build agents, Azure Monitor for observability).
        'GitHub Enterprise Server': 'icons/sovereign-github.png',
        'Container Registry': 'icons/azure-container-registry.svg',
        'AKS Build Agents': 'icons/azure-kubernetes-service.svg',
        'Observability Stack': 'icons/azure-monitor.svg',
        // AVD scenario components — Azure Virtual Desktop, Azure Files for FSLogix
        // profile containers, Entra Domain Services for the on-prem domain controllers.
        'AVD session hosts': 'icons/azure-virtual-desktop.svg',
        'FSLogix profiles': 'icons/azure-files.svg',
        'Domain controllers': 'icons/entra-domain-services.svg',
        // Foundry Local AI scenario components — Azure AI Search as the closest
        // stand-in for the Edge RAG retrieval layer (no dedicated Edge RAG icon
        // exists in the official Azure icon set). GPU is a hand-drawn glyph since
        // the official Azure icon set has no GPU mark.
        'Edge RAG': 'icons/azure-ai-search.svg',
        'Video Indexer': 'icons/azure-video-indexer.svg',
        'GPUs (VI + RAG)': 'icons/gpu.svg',
        // M365 Local — additional workload tokens used in the small/large scale
        // variants. No icons exist for AD/Firewall/Load Balancer in the local set,
        // so they fall back to text rounded rectangles.
        'Exchange mailbox servers': 'icons/sovereign-m365-exchange.png',
        'Exchange Edge Transport': 'icons/sovereign-m365-exchange.png',
        'SharePoint, Skype for Business and SQL': 'icons/sovereign-m365-sharepoint.png',
        'SharePoint Server': 'icons/m365-sharepoint-server.png',
        'Skype for Business': 'icons/m365-skype-server.png',
        'SQL Server': 'icons/sovereign-m365-skype.png',
        'M365 Local Workload Servers': 'icons/sovereign-m365-exchange.png'
    };

    const WORKLOAD_ICON_LABELS = {
        'azure-local': 'General purpose workloads',
        'm365-exchange': 'Exchange',
        'm365-sharepoint': 'SharePoint',
        'github': 'GitHub Enterprise',
        'foundry': 'Foundry Local'
    };

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    const state = {
        // Multi-select: list of selected purpose ids in click order.
        purposes: [],
        connectivity: null,
        // Per-purpose tenancy: { [purposeId]: 'strict' | 'logical' }.
        tenancyByPurpose: {},
        // Per-purpose scale (multi-select per purpose): { [purposeId]: ['cluster-16', ...] }.
        scaleByPurpose: {},
        // Per-purpose storage choice for cluster-16 scale: 'local' (S2D) | 'san' | 'both'.
        // Defaults to 'local' when unset. Only meaningful when cluster-16 is selected.
        storageByPurpose: {}
    };

    // Convenience: tenancy id to use for a given purpose. No global default any
    // more — each purpose owns its own tenancy in state.tenancyByPurpose.
    function getTenancyFor(purposeId) {
        return state.tenancyByPurpose[purposeId] || null;
    }

    // Convenience: scale ids selected for a given purpose. Empty array when the
    // user hasn't picked any yet (no defaults).
    function getScalesFor(purposeId) {
        const arr = state.scaleByPurpose[purposeId];
        return Array.isArray(arr) ? arr.slice() : [];
    }

    // Storage choice for a purpose when cluster-16 is in play. Defaults to 'local'.
    function getStorageFor(purposeId) {
        return state.storageByPurpose[purposeId] || 'local';
    }

    // Scale options available for a purpose. Returns the purpose's override list
    // when present, otherwise the global SCALE list.
    function getScaleOptionsFor(purpose) {
        if (purpose && Array.isArray(purpose.scaleOptionsOverride) && purpose.scaleOptionsOverride.length) {
            return purpose.scaleOptionsOverride.slice();
        }
        return SCALE.slice();
    }

    // Tenancy options available for a purpose. Returns TENANCY filtered by the
    // purpose's `tenancyOptionsOverride` ids when present.
    function getTenancyOptionsFor(purpose) {
        if (purpose && Array.isArray(purpose.tenancyOptionsOverride) && purpose.tenancyOptionsOverride.length) {
            const allowed = purpose.tenancyOptionsOverride;
            return TENANCY.filter(function(t) { return allowed.indexOf(t.id) >= 0; });
        }
        return TENANCY.slice();
    }

    // Look up a scale item by id, considering both global SCALE and any
    // purpose-specific override scales (so the SVG renderer/notes builder can
    // resolve M365 ids like 'm365-small' to their human-readable title).
    function findScaleItem(scaleId) {
        let found = SCALE.find(function(x) { return x.id === scaleId; });
        if (found) { return found; }
        for (let i = 0; i < PURPOSES.length; i++) {
            const p = PURPOSES[i];
            if (Array.isArray(p.scaleOptionsOverride)) {
                found = p.scaleOptionsOverride.find(function(x) { return x.id === scaleId; });
                if (found) { return found; }
            }
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Picker rendering
    // ------------------------------------------------------------------

    // Custom renderer for the business-purpose grid — each card is styled like the
    // marketing cards on slides 52 (Foundry Local) and 61 (M365 / GitHub / AVD) of the
    // Sovereign Private Cloud L300 deck: stacked logo(s) on top, large title (with
    // optional subtitle), descriptive paragraph, and an optional badge or feature chip.
    function renderPurposeGrid() {
        const container = document.getElementById('purpose-grid');
        if (!container) { return; }
        container.classList.add('purpose-cards');
        container.innerHTML = '';

        PURPOSES.forEach(function(item) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'purpose-card';
            if (item.id === 'foundry-local') { btn.classList.add('purpose-card-feature'); }
            btn.setAttribute('role', 'checkbox');
            btn.setAttribute('aria-checked', 'false');
            btn.dataset.value = item.id;
            btn.setAttribute('aria-label', item.title + ' — ' + item.desc);

            // Top badge (NEW / Private Preview).
            const badgeHtml = item.badge
                ? '<span class="purpose-badge purpose-badge-' + item.badge.kind + '">' + escapeHtml(item.badge.text) + '</span>'
                : '';

            // Icon block — single PNG/SVG, or stacked PNGs for M365.
            let iconHtml = '';
            if (item.iconFiles && item.iconFiles.length) {
                iconHtml = '<div class="purpose-icon-row">' +
                    item.iconFiles.map(function(f) {
                        return '<img class="purpose-icon-stack" src="' + f + '" alt="" aria-hidden="true">';
                    }).join('') +
                    '</div>';
            } else if (item.iconFile) {
                iconHtml = '<div class="purpose-icon-row"><img class="purpose-icon-img" src="' + item.iconFile + '" alt="" aria-hidden="true"></div>';
            }

            // Title (with optional subtitle line).
            const titleHtml =
                '<div class="purpose-title">' + escapeHtml(item.title) + '</div>' +
                (item.subtitle ? '<div class="purpose-subtitle">' + escapeHtml(item.subtitle) + '</div>' : '');

            // Optional caption + feature chip (Foundry: "Edge, hybrid, disconnected").
            let chipHtml = '';
            if (item.featureChip) {
                const icons = (item.featureChip.icons || []).map(function(g) {
                    return '<span class="purpose-feature-glyph" aria-hidden="true">' + g + '</span>';
                }).join('');
                chipHtml =
                    '<div class="purpose-feature-chip">' +
                        '<div class="purpose-feature-icons">' + icons + '</div>' +
                        '<div class="purpose-feature-label">' + escapeHtml(item.featureChip.label) + '</div>' +
                    '</div>';
            }

            btn.innerHTML =
                badgeHtml +
                iconHtml +
                titleHtml +
                '<div class="purpose-desc">' + escapeHtml(item.desc) + '</div>' +
                chipHtml;

            btn.addEventListener('click', function() {
                togglePurpose(item.id);
                refreshSelections();
                renderTenancyPerPurpose();
                renderScalePerPurpose();
                updatePreview();
            });
            container.appendChild(btn);
        });
    }

    // Toggle a purpose in/out of state.purposes (multi-select). Tenancy and scale
    // are left unset so the user explicitly picks them in sections 3 and 4.
    function togglePurpose(purposeId) {
        const idx = state.purposes.indexOf(purposeId);
        if (idx >= 0) {
            state.purposes.splice(idx, 1);
            delete state.tenancyByPurpose[purposeId];
            delete state.scaleByPurpose[purposeId];
            delete state.storageByPurpose[purposeId];
        } else {
            state.purposes.push(purposeId);
            // M365 Local supports strict isolation only — auto-pick it so step 4
            // doesn't require a redundant click for the only valid option.
            if (purposeId === 'm365-local') {
                state.tenancyByPurpose[purposeId] = 'strict';
            }
        }
    }

    // Custom renderer for the connectivity grid — reproduces the visual style of the
    // "Azure Local (connected)" / "Azure Local (disconnected)" cards on slide 23 of the
    // Sovereign Private Cloud L300 deck.
    function renderConnectivityGrid() {
        const container = document.getElementById('connectivity-grid');
        if (!container) { return; }
        container.classList.add('connectivity-cards');
        container.innerHTML = '';

        CONNECTIVITY.forEach(function(item) {
            const isDisc = item.id === 'disconnected';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'spc-card';
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', 'false');
            btn.dataset.value = item.id;
            btn.setAttribute('aria-label', item.title + ' — ' + item.desc);

            // Build the stack visual.
            const cpTop = isDisc
                ? '<div class="spc-pill spc-pill-empty" aria-hidden="true">/</div>'
                : '<div class="spc-pill spc-pill-control" aria-hidden="true">Control plane</div>';
            const cpAppliance = isDisc
                ? '<div class="spc-pill spc-pill-control" aria-hidden="true"><span class="spc-pill-main">Control plane</span><span class="spc-pill-sub">(appliance VM)</span></div>'
                : '';

            btn.innerHTML =
                '<img class="spc-card-cloud" src="icons/sovereign-cloud.png" alt="" aria-hidden="true">' +
                '<div class="spc-card-title">Azure Local <span class="spc-card-sub">(' + (isDisc ? 'disconnected' : 'connected') + ')</span></div>' +
                '<div class="spc-stack">' +
                    cpTop +
                    '<div class="spc-region">' +
                        '<div class="spc-region-row">' +
                            '<svg class="spc-region-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18.5 9.05 4.5 4.5 0 0 1 17.5 18z"/></svg>' +
                            '<span>Cloud region</span>' +
                        '</div>' +
                        '<div class="spc-region-divider" aria-hidden="true"></div>' +
                        '<div class="spc-region-row">' +
                            '<svg class="spc-region-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 3 7v2h18V7zm-7 9v8h2v-8zm4 0v8h2v-8zm4 0v8h2v-8zm4 0v8h2v-8zM3 20v2h18v-2z"/></svg>' +
                            '<span>Distributed location</span>' +
                        '</div>' +
                    '</div>' +
                    cpAppliance +
                    '<div class="spc-pill" aria-hidden="true">Workloads</div>' +
                    '<div class="spc-pill" aria-hidden="true">Infrastructure</div>' +
                '</div>' +
                '<div class="spc-card-desc">' + escapeHtml(item.desc) + '</div>';

            btn.addEventListener('click', function() {
                state.connectivity = item.id;
                refreshSelections();
                updatePreview();
            });
            container.appendChild(btn);
        });
    }

    // Build a single Strict / Logical tenancy "spc-card" matching slides 29/30. Used
    // by renderTenancyPerPurpose for each selected purpose row.
    function buildTenancyCard(item, isSelected, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'spc-card';
        if (isSelected) { btn.classList.add('selected'); }
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        btn.dataset.value = item.id;
        btn.setAttribute('aria-label', item.title + ' — ' + item.desc);

        let visual = '';
        if (item.id === 'strict') {
            visual =
                '<div class="tenancy-visual tenancy-strict" aria-hidden="true">' +
                    '<div class="tenancy-tenant-box">' +
                        '<div class="tenancy-tenant-label">Tenant-1</div>' +
                        '<div class="tenancy-cluster-box">' +
                            '<div class="tenancy-server"></div>' +
                            '<div class="tenancy-server"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tenancy-tenant-box">' +
                        '<div class="tenancy-tenant-label">Tenant-2</div>' +
                        '<div class="tenancy-cluster-box">' +
                            '<div class="tenancy-server"></div>' +
                            '<div class="tenancy-server"></div>' +
                            '<div class="tenancy-server"></div>' +
                            '<div class="tenancy-server"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        } else {
            visual =
                '<div class="tenancy-visual tenancy-logical" aria-hidden="true">' +
                    '<div class="tenancy-dept-chips">' +
                        '<span class="tenancy-dept-chip tenancy-dept-eng">Dept-1</span>' +
                        '<span class="tenancy-dept-chip tenancy-dept-fin">Dept-2</span>' +
                        '<span class="tenancy-dept-chip tenancy-dept-qa">Dept-3</span>' +
                    '</div>' +
                    '<div class="tenancy-shared-tenant">' +
                        '<div class="tenancy-tile-grid">' +
                            '<span class="tenancy-tile tenancy-t-vm-p">VM</span>' +
                            '<span class="tenancy-tile tenancy-t-aks">AKS</span>' +
                            '<span class="tenancy-tile tenancy-t-vm-o">VM</span>' +
                            '<span class="tenancy-tile tenancy-t-vm-g">VM</span>' +
                            '<span class="tenancy-tile tenancy-t-vm-p">VM</span>' +
                            '<span class="tenancy-tile tenancy-t-aks">AKS</span>' +
                            '<span class="tenancy-tile tenancy-t-vm-o">VM</span>' +
                            '<span class="tenancy-tile tenancy-t-vm-g">VM</span>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }

        btn.innerHTML =
            (item.comingSoon ? '<span class="spc-coming-soon">Coming soon</span>' : '') +
            '<div class="spc-card-title">' + escapeHtml(item.title) +
                ' <span class="spc-card-sub">' + escapeHtml(item.sub) + '</span></div>' +
            visual +
            '<div class="spc-card-desc">' + escapeHtml(item.desc) + '</div>';

        btn.addEventListener('click', onClick);
        return btn;
    }

    // Render the tenancy picker. Cards are never directly clickable: per-purpose
    // toggle chips inside each card act as radios across the two cards (a purpose
    // can be assigned to Strict, Logical, or neither). No defaults.
    function renderTenancyPerPurpose() {
        const host = document.getElementById('tenancy-per-purpose');
        if (!host) { return; }
        host.innerHTML = '';

        if (state.purposes.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'scale-empty-hint';
            hint.textContent = 'Select one or more business purposes above to choose a tenancy model per purpose.';
            host.appendChild(hint);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'footprint-grid connectivity-cards scale-purpose-grid';
        grid.setAttribute('role', 'group');
        grid.setAttribute('aria-label', 'Tenancy per purpose');

        const purposes = state.purposes
            .map(function(pid) { return PURPOSES.find(function(p) { return p.id === pid; }); })
            .filter(Boolean);

        TENANCY.forEach(function(t) {
            // Skip rendering this tenancy card entirely if no selected purpose allows it.
            const purposesAllowingT = purposes.filter(function(p) {
                return getTenancyOptionsFor(p).some(function(x) { return x.id === t.id; });
            });
            if (!purposesAllowingT.length) { return; }

            const anySel = purposesAllowingT.some(function(p) {
                return state.tenancyByPurpose[p.id] === t.id;
            });
            const card = buildTenancyCard(t, anySel, function() { /* no-op */ });
            card.classList.add('pick-card--multi');
            card.setAttribute('aria-checked', anySel ? 'true' : 'false');
            card.removeAttribute('role');

            const toggles = document.createElement('div');
            toggles.className = 'scale-purpose-toggles';
            toggles.setAttribute('role', 'group');
            toggles.setAttribute('aria-label', 'Apply ' + t.title + ' to purposes');

            purposesAllowingT.forEach(function(p) {
                const isSel = state.tenancyByPurpose[p.id] === t.id;
                const tBtn = document.createElement('button');
                tBtn.type = 'button';
                tBtn.className = 'scale-purpose-toggle';
                tBtn.classList.toggle('selected', isSel);
                tBtn.setAttribute('role', 'radio');
                tBtn.setAttribute('aria-checked', isSel ? 'true' : 'false');
                tBtn.dataset.purpose = p.id;
                tBtn.dataset.tenancy = t.id;
                tBtn.innerHTML =
                    '<span class="scale-purpose-toggle-check" aria-hidden="true"></span>' +
                    buildPurposeChipIconHtml(p) +
                    '<span class="scale-purpose-toggle-label">' + escapeHtml(p.title) + '</span>';
                tBtn.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    if (isSel) {
                        delete state.tenancyByPurpose[p.id];
                    } else {
                        state.tenancyByPurpose[p.id] = t.id;
                    }
                    renderTenancyPerPurpose();
                    renderSelectionSummary();
                    updatePreview();
                });
                toggles.appendChild(tBtn);
            });

            card.appendChild(toggles);
            grid.appendChild(card);
        });

        host.appendChild(grid);
    }

    // Build the inner HTML (icon + title + desc) for a SCALE pick-card.
    function buildScaleCardInnerHtml(item) {
        let iconHtml;
        if (item.iconFile && item.sizeBadge) {
            iconHtml = '<div class="pick-icon-stack" aria-hidden="true">'
                + '<img class="pick-icon-img" src="' + item.iconFile + '" alt="">'
                + '<span class="pick-size-badge">' + escapeHtml(item.sizeBadge) + '</span>'
                + '</div>';
        } else if (item.iconFile) {
            iconHtml = '<img class="pick-icon-img" src="' + item.iconFile + '" alt="" aria-hidden="true">';
        } else {
            iconHtml = '<div class="pick-icon" aria-hidden="true">' + (item.icon || '') + '</div>';
        }
        const comingSoonHtml = item.comingSoon ? '<div class="pick-meta">Coming soon</div>' : '';
        return iconHtml +
            '<div class="pick-title">' + escapeHtml(item.title) + '</div>' +
            '<div class="pick-desc">' + escapeHtml(item.desc) + '</div>' +
            comingSoonHtml;
    }

    // Build the small "purpose chip" icon HTML used inside per-purpose toggles.
    function buildPurposeChipIconHtml(p) {
        if (!p) { return ''; }
        if (p.chipIconFile) {
            return '<img class="scale-purpose-toggle-icon" src="' + p.chipIconFile + '" alt="" aria-hidden="true">';
        }
        if (p.iconFiles && p.iconFiles.length) {
            return '<span class="scale-purpose-toggle-icon scale-purpose-toggle-icon--stack" aria-hidden="true">' +
                p.iconFiles.map(function(f) {
                    return '<img src="' + f + '" alt="">';
                }).join('') + '</span>';
        }
        if (p.iconFile) {
            return '<img class="scale-purpose-toggle-icon" src="' + p.iconFile + '" alt="" aria-hidden="true">';
        }
        return '';
    }

    // Render the scale picker. Cards are never directly clickable: the user picks
    // which purposes use each footprint via per-purpose toggle chips inside the
    // card. No defaults — every purpose starts unselected.
    function renderScalePerPurpose() {
        const host = document.getElementById('scale-per-purpose');
        if (!host) { return; }
        host.innerHTML = '';

        if (state.purposes.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'scale-empty-hint';
            hint.textContent = 'Select one or more business purposes above to choose a scale per purpose.';
            host.appendChild(hint);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'footprint-grid scale-purpose-grid';
        grid.setAttribute('role', 'group');
        grid.setAttribute('aria-label', 'Scale and topology');

        const purposes = state.purposes
            .map(function(pid) { return PURPOSES.find(function(p) { return p.id === pid; }); })
            .filter(Boolean);

        // Build the union of scale items across all selected purposes (preserving
        // global SCALE order, then appending purpose-specific override scales).
        const seen = {};
        const mergedScales = [];
        SCALE.forEach(function(item) {
            // Include this global scale if at least one selected purpose allows it.
            const allowed = purposes.some(function(p) {
                return getScaleOptionsFor(p).some(function(x) { return x.id === item.id; });
            });
            if (allowed) {
                mergedScales.push(item);
                seen[item.id] = true;
            }
        });
        purposes.forEach(function(p) {
            getScaleOptionsFor(p).forEach(function(item) {
                if (!seen[item.id]) {
                    mergedScales.push(item);
                    seen[item.id] = true;
                }
            });
        });

        mergedScales.forEach(function(item) {
            // Only show toggle chips for purposes that allow this scale.
            const purposesAllowing = purposes.filter(function(p) {
                return getScaleOptionsFor(p).some(function(x) { return x.id === item.id; });
            });
            if (!purposesAllowing.length) { return; }

            const card = document.createElement('div');
            card.className = 'pick-card pick-card--multi';
            card.dataset.value = item.id;
            const anySel = purposesAllowing.some(function(p) {
                return getScalesFor(p.id).indexOf(item.id) >= 0;
            });
            card.classList.toggle('selected', anySel);
            card.innerHTML = buildScaleCardInnerHtml(item);

            const toggles = document.createElement('div');
            toggles.className = 'scale-purpose-toggles';
            toggles.setAttribute('role', 'group');
            toggles.setAttribute('aria-label', 'Apply ' + item.title + ' to purposes');

            purposesAllowing.forEach(function(p) {
                const isSel = getScalesFor(p.id).indexOf(item.id) >= 0;
                const tBtn = document.createElement('button');
                tBtn.type = 'button';
                tBtn.className = 'scale-purpose-toggle';
                tBtn.classList.toggle('selected', isSel);
                tBtn.setAttribute('role', 'checkbox');
                tBtn.setAttribute('aria-checked', isSel ? 'true' : 'false');
                tBtn.dataset.purpose = p.id;
                tBtn.dataset.scale = item.id;
                tBtn.innerHTML =
                    '<span class="scale-purpose-toggle-check" aria-hidden="true"></span>' +
                    buildPurposeChipIconHtml(p) +
                    '<span class="scale-purpose-toggle-label">' + escapeHtml(p.title) + '</span>';
                tBtn.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    // Toggle without the "must keep at least one" guard — no defaults.
                    const arr = (state.scaleByPurpose[p.id] || []).slice();
                    const idx = arr.indexOf(item.id);
                    if (idx >= 0) { arr.splice(idx, 1); } else { arr.push(item.id); }
                    state.scaleByPurpose[p.id] = arr;
                    renderScalePerPurpose();
                    renderSelectionSummary();
                    updatePreview();
                });
                toggles.appendChild(tBtn);
            });

            card.appendChild(toggles);

            // Storage selector — shown on every Azure Local scale card so the
            // diagram makes the storage choice explicit. Single-node and cluster-16
            // allow S2D / SAN / Both. Cluster-64 and cluster-128 only support SAN
            // (Storage Spaces Direct does not scale beyond 16 nodes), so the SAN
            // option is shown selected and the others are disabled. M365 Local
            // small/large scales are S2D-only (validated reference architectures).
            if (item.id === 'cluster-16' || item.id === 'single-node'
                || item.id === 'cluster-64' || item.id === 'cluster-128'
                || item.id === 'm365-small' || item.id === 'm365-large') {
                const sanOnly = (item.id === 'cluster-64' || item.id === 'cluster-128');
                const s2dOnly = (item.id === 'm365-small' || item.id === 'm365-large');
                const purposesUsingThis = purposesAllowing.filter(function(p) {
                    return getScalesFor(p.id).indexOf(item.id) >= 0;
                });
                if (purposesUsingThis.length) {
                    const storageWrap = document.createElement('div');
                    storageWrap.className = 'scale-storage-wrap';
                    const heading = document.createElement('div');
                    heading.className = 'scale-storage-heading';
                    heading.textContent = sanOnly
                        ? 'Storage (SAN required)'
                        : (s2dOnly ? 'Storage (S2D required)' : 'Storage');
                    storageWrap.appendChild(heading);
                    purposesUsingThis.forEach(function(p) {
                        const row = document.createElement('div');
                        row.className = 'scale-storage-row';
                        const lbl = document.createElement('span');
                        lbl.className = 'scale-storage-purpose-label';
                        lbl.innerHTML = buildPurposeChipIconHtml(p) +
                            '<span>' + escapeHtml(p.title) + '</span>';
                        row.appendChild(lbl);
                        // Force the displayed selection to the only allowed value
                        // when the scale constrains storage.
                        let cur;
                        if (sanOnly) {
                            cur = 'san';
                        } else if (s2dOnly) {
                            cur = 'local';
                        } else {
                            cur = getStorageFor(p.id);
                        }
                        [
                            { id: 'local', label: 'S2D (local)' },
                            { id: 'san', label: 'SAN' },
                            { id: 'both', label: 'Both' }
                        ].forEach(function(opt) {
                            const chip = document.createElement('button');
                            chip.type = 'button';
                            const isDisabled = (sanOnly && opt.id !== 'san')
                                || (s2dOnly && opt.id !== 'local');
                            chip.className = 'scale-storage-chip'
                                + (cur === opt.id ? ' selected' : '')
                                + (isDisabled ? ' disabled' : '');
                            chip.setAttribute('role', 'radio');
                            chip.setAttribute('aria-checked', cur === opt.id ? 'true' : 'false');
                            if (isDisabled) {
                                chip.setAttribute('aria-disabled', 'true');
                                chip.disabled = true;
                            }
                            chip.textContent = opt.label;
                            chip.addEventListener('click', function(ev) {
                                ev.stopPropagation();
                                if (isDisabled) { return; }
                                state.storageByPurpose[p.id] = opt.id;
                                renderScalePerPurpose();
                                updatePreview();
                            });
                            row.appendChild(chip);
                        });
                        storageWrap.appendChild(row);
                    });
                    card.appendChild(storageWrap);
                }
            }

            grid.appendChild(card);
        });

        host.appendChild(grid);
    }

    function refreshSelections() {
        // mark selected
        document.querySelectorAll('#purpose-grid .pick-card, #purpose-grid .purpose-card').forEach(function(el) {
            const sel = state.purposes.indexOf(el.dataset.value) >= 0;
            el.classList.toggle('selected', sel);
            el.setAttribute('aria-checked', sel ? 'true' : 'false');
        });
        document.querySelectorAll('#connectivity-grid .pick-card, #connectivity-grid .spc-card').forEach(function(el) {
            const sel = el.dataset.value === state.connectivity;
            el.classList.toggle('selected', sel);
            el.setAttribute('aria-checked', sel ? 'true' : 'false');
        });

        // mark recommended footprint based on the first selected purpose (if any)
        const firstPurposeId = state.purposes[0];
        const purpose = firstPurposeId ? PURPOSES.find(function(p) { return p.id === firstPurposeId; }) : null;
        document.querySelectorAll('#connectivity-grid .pick-card, #connectivity-grid .spc-card').forEach(function(el) {
            el.classList.toggle('recommended', !!purpose && el.dataset.value === purpose.recommendedConnectivity && el.dataset.value !== state.connectivity);
        });

        renderSelectionSummary();
    }

    function renderSelectionSummary() {
        const summary = document.getElementById('selection-summary');
        if (!summary) { return; }
        const c = CONNECTIVITY.find(function(x) { return x.id === state.connectivity; });

        if (state.purposes.length === 0) {
            summary.textContent = 'Select one or more business purposes above to see a starter architecture.';
            return;
        }

        const purposeBits = state.purposes.map(function(pid) {
            const p = PURPOSES.find(function(x) { return x.id === pid; });
            if (!p) { return ''; }
            const t = TENANCY.find(function(x) { return x.id === getTenancyFor(pid); });
            const scales = getScalesFor(pid).map(function(id) {
                return findScaleItem(id);
            }).filter(Boolean);
            const tBit = t ? ' <span class="summary-tenancy">(' + escapeHtml(t.title) + ')</span>' : '';
            const sBit = scales.length ? ' <span class="summary-tenancy">[' + escapeHtml(scales.map(function(s) { return s.title; }).join(' + ')) + ']</span>' : '';
            return '<strong>' + escapeHtml(p.title) + '</strong>' + tBit + sBit;
        }).filter(Boolean);

        const parts = [purposeBits.join(' + ')];
        if (c) { parts.push(escapeHtml(c.title)); }
        summary.innerHTML = 'Selected: ' + parts.join(' &middot; ');
    }

    // ------------------------------------------------------------------
    // SVG preview
    // ------------------------------------------------------------------

    // Resolve a raw template against the current footprint state:
    //  - Filters out clusters marked `disconnectedOnly` when connectivity !== 'disconnected'.
    //  - Swaps the cloud title to `disconnectedTitle` when connectivity === 'disconnected'.
    function resolveTemplate(tpl) {
        if (!tpl) { return tpl; }
        const isDisconnected = state.connectivity === 'disconnected';
        const cloud = Object.assign({}, tpl.cloud);
        if (isDisconnected && cloud.disconnectedTitle) {
            cloud.title = cloud.disconnectedTitle;
        }
        const clusters = tpl.clusters.filter(function(c) {
            return !c.disconnectedOnly || isDisconnected;
        });
        return Object.assign({}, tpl, { cloud: cloud, clusters: clusters });
    }

    function updatePreview() {
        const canvas = document.getElementById('preview-canvas');
        const titleEl = document.getElementById('preview-title');
        const notesEl = document.getElementById('preview-notes');
        const downloadBtn = document.getElementById('download-pptx');
        if (!canvas || !titleEl || !notesEl || !downloadBtn) { return; }

        if (state.purposes.length === 0) {
            canvas.innerHTML = '<div class="preview-empty">Pick a business purpose to see a preview.</div>';
            titleEl.textContent = 'Your reference architecture';
            notesEl.innerHTML = '';
            downloadBtn.disabled = true;
            return;
        }

        const purposeEntries = state.purposes.map(function(pid) {
            const tpl = TEMPLATES[pid];
            if (!tpl) { return null; }
            return {
                id: pid,
                purpose: PURPOSES.find(function(p) { return p.id === pid; }),
                tpl: resolveTemplate(tpl)
            };
        }).filter(Boolean);
        if (purposeEntries.length === 0) { return; }

        if (purposeEntries.length === 1) {
            titleEl.textContent = purposeEntries[0].tpl.title;
        } else {
            titleEl.textContent = 'Combined reference architecture — ' + purposeEntries.map(function(e) {
                return e.purpose ? e.purpose.title : e.tpl.title;
            }).join(' + ');
        }
        canvas.innerHTML = '';
        canvas.appendChild(buildSvg(purposeEntries));
        autoFitZoom();

        // About this architecture: render a narrative description of the
        // selected footprint and per-purpose design instead of a flat bullet list.
        notesEl.innerHTML = buildArchitectureNarrativeHtml(purposeEntries);

        downloadBtn.disabled = false;
    }

    function buildArchitectureNarrativeHtml(purposeEntries) {
        const parts = ['<strong>About this architecture</strong>'];
        const overview = buildOverviewParagraph(purposeEntries);
        if (overview) { parts.push('<p>' + overview + '</p>'); }
        const controlPlane = buildControlPlaneParagraph(purposeEntries);
        if (controlPlane) { parts.push('<p>' + controlPlane + '</p>'); }
        purposeEntries.forEach(function(e) {
            parts.push(buildPurposeNarrativeBlock(e, purposeEntries.length > 1));
        });
        return parts.join('');
    }

    function buildOverviewParagraph(purposeEntries) {
        const c = CONNECTIVITY.find(function(x) { return x.id === state.connectivity; });
        const connectivityPhrase = c
            ? (c.id === 'disconnected'
                ? 'a <strong>disconnected / air-gapped</strong> Azure Local footprint'
                : 'a <strong>connected</strong> Azure Local footprint with a path to the Azure control plane')
            : 'an Azure Local footprint';

        if (purposeEntries.length === 1) {
            const e = purposeEntries[0];
            const title = (e.purpose && e.purpose.title) || e.tpl.title;
            const t = TENANCY.find(function(x) { return x.id === getTenancyFor(e.id); });
            const scales = getScalesFor(e.id).map(function(id) { return findScaleItem(id); }).filter(Boolean);
            let sentence = 'This reference architecture deploys <strong>' + escapeHtml(title)
                + '</strong> on ' + connectivityPhrase + '.';
            if (scales.length) {
                sentence += ' The platform is sized as <strong>' + escapeHtml(scales.map(function(s) { return s.title; }).join(' + ')) + '</strong>';
                if (t) {
                    sentence += ' using <strong>' + escapeHtml(t.title.toLowerCase()) + '</strong> '
                        + escapeHtml(t.sub || '') + '.';
                } else {
                    sentence += '.';
                }
            } else if (t) {
                sentence += ' Tenancy is configured for <strong>' + escapeHtml(t.title.toLowerCase()) + '</strong>.';
            }
            return sentence;
        }

        const titles = purposeEntries.map(function(e) {
            return '<strong>' + escapeHtml((e.purpose && e.purpose.title) || e.tpl.title) + '</strong>';
        });
        let intro = 'This reference architecture combines ' + purposeEntries.length
            + ' workload purposes — ' + titles.slice(0, -1).join(', ') + ' and ' + titles[titles.length - 1]
            + ' — on ' + connectivityPhrase + '.';
        const perPurpose = purposeEntries.map(function(e) {
            const t = TENANCY.find(function(x) { return x.id === getTenancyFor(e.id); });
            const scales = getScalesFor(e.id).map(function(id) { return findScaleItem(id); }).filter(Boolean);
            const bits = [];
            if (scales.length) { bits.push(scales.map(function(s) { return s.title; }).join(' + ')); }
            if (t) { bits.push(t.title.toLowerCase()); }
            const title = (e.purpose && e.purpose.title) || e.tpl.title;
            return escapeHtml(title) + ' runs as ' + escapeHtml(bits.join(', '));
        }).join('; ');
        if (perPurpose) {
            intro += ' Each purpose has its own sizing and tenancy: ' + perPurpose + '.';
        }
        return intro;
    }

    function buildControlPlaneParagraph(purposeEntries) {
        if (state.connectivity === 'disconnected') {
            const sharedAppliance = purposeEntries.length > 1
                ? ' A single shared Control Plane Appliance (3-node Disconnected Ops Cluster) is co-located with the workload clusters and provides ARM, Portal, Key Vault, Defender, Monitor and Update Manager equivalents on-premises.'
                : ' A Control Plane Appliance (3-node Disconnected Ops Cluster) is co-located with the workload clusters and provides ARM, Portal, Key Vault, Defender, Monitor and Update Manager equivalents on-premises.';
            return 'Because the deployment runs in air-gapped mode, all management capabilities must live on-premises.'
                + sharedAppliance
                + ' Limited outbound connectivity (if any) is used only for licensing, telemetry and update bundles.';
        }
        if (state.connectivity === 'connected') {
            return 'All clusters are projected into Azure through <strong>Azure Arc</strong>, so day-2 operations — RBAC,'
                + ' policy, monitoring, update management and Defender for Cloud — are driven from the Azure portal'
                + ' and ARM. Workload data and identity stay on-premises while management plane traffic flows out'
                + ' through the Arc Gateway.';
        }
        return '';
    }

    function buildPurposeNarrativeBlock(entry, multi) {
        const title = (entry.purpose && entry.purpose.title) || entry.tpl.title;
        const summary = entry.tpl.summary || '';
        const notes = (entry.tpl.notes || []).map(function(n) {
            // Ensure each note ends with a period so they read as sentences when joined.
            const trimmed = n.trim();
            return /[.!?]$/.test(trimmed) ? trimmed : trimmed + '.';
        });
        const headingTag = multi ? '<strong>' + escapeHtml(title) + '</strong>' : '<strong>Design details</strong>';
        const paragraphs = [headingTag];
        if (summary) { paragraphs.push('<p>' + escapeHtml(summary) + '</p>'); }
        if (notes.length) { paragraphs.push('<p>' + notes.map(escapeHtml).join(' ') + '</p>'); }
        return paragraphs.join('');
    }

    function buildFootprintNote() {
        const c = CONNECTIVITY.find(function(x) { return x.id === state.connectivity; });
        const bits = [];
        if (c) { bits.push('Connectivity: ' + c.title); }
        if (state.purposes.length === 1) {
            const pid = state.purposes[0];
            const t = TENANCY.find(function(x) { return x.id === getTenancyFor(pid); });
            if (t) { bits.push('Tenancy: ' + t.title); }
            const scales = getScalesFor(pid).map(function(id) {
                return findScaleItem(id);
            }).filter(Boolean);
            if (scales.length) {
                bits.push('Topology: ' + scales.map(function(s) { return s.title; }).join(' + '));
            }
        } else if (state.purposes.length > 1) {
            const perPurposeBits = state.purposes.map(function(pid) {
                const p = PURPOSES.find(function(x) { return x.id === pid; });
                const t = TENANCY.find(function(x) { return x.id === getTenancyFor(pid); });
                const scales = getScalesFor(pid).map(function(id) {
                    return findScaleItem(id);
                }).filter(Boolean);
                if (!p) { return null; }
                const parts = [];
                if (t) { parts.push(t.title); }
                if (scales.length) { parts.push(scales.map(function(s) { return s.title; }).join(' + ')); }
                return p.title + ' → ' + parts.join(', ');
            }).filter(Boolean);
            if (perPurposeBits.length) { bits.push('Per purpose: ' + perPurposeBits.join('; ')); }
        }
        return 'Selected footprint — ' + bits.join('; ') + '.';
    }

    function buildSvg(purposeEntries) {
        const SVG_NS = 'http://www.w3.org/2000/svg';

        // Build per-purpose bands. Each band is a horizontal row of workload cards
        // for a single business purpose, computed against that purpose's tenancy
        // override. All bands share the cloud bubble at the top.
        const bands = purposeEntries.map(function(entry) {
            const cards = buildCardList(entry.tpl, getTenancyFor(entry.id), getScalesFor(entry.id), entry.id);
            return {
                id: entry.id,
                purpose: entry.purpose,
                tpl: entry.tpl,
                cards: cards
            };
        });

        // Disconnected + multiple purposes: collapse the per-purpose Control Plane
        // Appliance cards into a single shared appliance band on the left.
        if (state.connectivity === 'disconnected' && bands.length > 1) {
            let sharedAppliance = null;
            bands.forEach(function(b) {
                if (b.cards.length && b.cards[0].kind === 'control-plane-appliance') {
                    if (!sharedAppliance) { sharedAppliance = b.cards[0]; }
                    b.cards = b.cards.slice(1);
                }
            });
            if (sharedAppliance) {
                bands.unshift({
                    id: '__shared-appliance__',
                    purpose: null,
                    tpl: null,
                    cards: [sharedAppliance],
                    shared: true
                });
            }
        }

        // Layout constants
        const padding = 16;
        const labelColW = 170;
        const cloudY = 28;
        const cloudH = 72;
        const cloudBubbleW = 240;
        const cloudBubbleH = 72;
        const sepY = cloudY + cloudH + 22;
        const baseCardW = 280;
        const baseCardGap = 18;          // gap between cards inside a band
        const baseInterBandGap = 56;     // visual gap between purpose groups on the row
        const minCardW = 200;
        const minCardGap = 10;
        const minInterBandGap = 28;
        const maxRowW = 1900;            // soft cap before the canvas grows wider
        const bandLabelH = 22;

        // Per-band card count + tallest card.
        bands.forEach(function(b) {
            b.cardCount = b.cards.length;
            b.cardH = b.cards.length ? Math.max.apply(null, b.cards.map(measureCardHeight)) : 0;
        });
        const totalCards = bands.reduce(function(s, b) { return s + b.cardCount; }, 0);
        const numBandGaps = Math.max(0, bands.length - 1);

        // Adaptive squeeze: shrink cardW, cardGap and interBandGap proportionally
        // when the natural width would exceed maxRowW.
        function rowWidthFor(cardW, cardGap, interBandGap) {
            // Sum of (cards in band * cardW + gaps within band) across bands, plus
            // inter-band gaps between groups.
            let cardsTotalW = 0;
            bands.forEach(function(b) {
                cardsTotalW += b.cardCount * cardW + Math.max(0, b.cardCount - 1) * cardGap;
            });
            return cardsTotalW + numBandGaps * interBandGap;
        }
        let cardW = baseCardW;
        let cardGap = baseCardGap;
        let interBandGap = baseInterBandGap;
        if (totalCards > 0) {
            // Iteratively shrink in one pass: scale all three dims by the same ratio.
            const naturalW = rowWidthFor(cardW, cardGap, interBandGap);
            if (naturalW > maxRowW) {
                const ratio = maxRowW / naturalW;
                cardW = Math.max(minCardW, Math.floor(cardW * ratio));
                cardGap = Math.max(minCardGap, Math.floor(cardGap * ratio));
                interBandGap = Math.max(minInterBandGap, Math.floor(interBandGap * ratio));
            }
        }

        // Final widths.
        bands.forEach(function(b) {
            b.cardsTotalW = b.cardCount * cardW + Math.max(0, b.cardCount - 1) * cardGap;
        });
        const rowTotalW = rowWidthFor(cardW, cardGap, interBandGap);
        const rowCardH = bands.length ? Math.max.apply(null, bands.map(function(b) { return b.cardH; })) : 0;

        // Canvas width.
        const W = Math.max(1200, rowTotalW + labelColW + 80);

        // Single horizontal row Y positions — all bands share these.
        const sharedSepY = sepY;
        const sharedLabelY = sharedSepY + 4;
        const sharedBusY = sharedSepY + 18;
        const cardsY = sharedLabelY + bandLabelH + 24;
        // Below-cards purpose pill (only rendered when 2+ bands).
        const pillGap = 16;
        const pillH = 30;
        const showBandPills = bands.length > 1 && bands.some(function(b) { return b.purpose; });

        // Per-band SAN requirement: clusters of 64+ nodes must use disaggregated
        // SAN-based storage. Single-node and cluster-16 may also use SAN (or local + SAN)
        // when the user picks 'san' or 'both' in the storage selector.
        bands.forEach(function(b) {
            const scales = b.id ? getScalesFor(b.id) : [];
            const storage = b.id ? getStorageFor(b.id) : 'local';
            const has64Plus = scales.indexOf('cluster-64') >= 0 || scales.indexOf('cluster-128') >= 0;
            const hasSmallWithSan = (scales.indexOf('cluster-16') >= 0 || scales.indexOf('single-node') >= 0)
                && (storage === 'san' || storage === 'both');
            b.needsSan = has64Plus || hasSmallWithSan;
        });
        const anySan = bands.some(function(b) { return b.needsSan; });
        const sanGap = 14;
        const sanH = 56;
        const sanBlockH = anySan ? sanGap + sanH : 0;

        const H = cardsY + rowCardH + sanBlockH + (showBandPills ? pillGap + pillH : 0) + 32;

        // Lay out bands left-to-right starting from the row's left edge.
        const rowStartX = Math.max(labelColW + 20, (W - rowTotalW) / 2);
        let cursorX = rowStartX;
        bands.forEach(function(b) {
            b.startX = cursorX;
            cursorX += b.cardsTotalW + interBandGap;
        });

        // Cloud is centered above the entire row so the trunk lands in the middle.
        const cloudCx = rowStartX + rowTotalW / 2;

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('width', String(W));
        svg.setAttribute('height', String(H));
        svg.setAttribute('xmlns', SVG_NS);
        svg.setAttribute('role', 'img');

        // Cloud region label (left).
        appendRowLabel(svg, SVG_NS, padding, cloudY + cloudH / 2, 'Cloud region', 'cloud');

        // Cloud bubble (single, shared across all bands).
        const isDisconnected = state.connectivity === 'disconnected';
        let cloudLabel;
        if (isDisconnected) {
            cloudLabel = 'Air-Gapped';
        } else if (bands.length === 1) {
            cloudLabel = bands[0].tpl.cloud.title || 'Azure';
        } else {
            cloudLabel = 'Azure (control plane)';
        }
        appendCloudBubble(svg, SVG_NS, cloudCx - cloudBubbleW / 2, cloudY, cloudBubbleW, cloudBubbleH, cloudLabel, isDisconnected);

        // Single dashed separator across the canvas.
        appendDashed(svg, SVG_NS, padding, sharedSepY, W - padding, sharedSepY);

        // Distributed location label (left, single row).
        appendRowLabel(svg, SVG_NS, padding, sharedLabelY + 18, 'Distributed location', 'location');

        // Trunk + shared busbar + per-band drops.
        const lineColor = 'var(--text-secondary, #5c6b7a)';
        appendLine(svg, SVG_NS, cloudCx, cloudY + cloudBubbleH, cloudCx, sharedBusY, lineColor);
        if (totalCards > 0) {
            const busLeft = Math.min(rowStartX + cardW / 2, cloudCx);
            const busRight = Math.max(rowStartX + rowTotalW - cardW / 2, cloudCx);
            if (busRight > busLeft) {
                appendLine(svg, SVG_NS, busLeft, sharedBusY, busRight, sharedBusY, lineColor);
            }
        }

        bands.forEach(function(b) {
            // Drops + cards for this band.
            b.cards.forEach(function(card, j) {
                const cardX = b.startX + j * (cardW + cardGap);
                const cx = cardX + cardW / 2;
                appendLine(svg, SVG_NS, cx, sharedBusY, cx, cardsY - 4, lineColor);
                renderArchCard(svg, SVG_NS, cardX, cardsY, cardW, rowCardH, card);
            });

            // Disaggregated SAN block (clusters of 64+ nodes require SAN-based storage).
            // One centered cylinder per band, with connector lines from each card to the SAN top.
            const sanTop = cardsY + rowCardH + sanGap;
            if (b.needsSan) {
                const sanW = 80;
                const sanCx = b.startX + b.cardsTotalW / 2;
                const sanX = sanCx - sanW / 2;
                renderSanCylinder(svg, SVG_NS, sanX, sanTop, sanW, sanH);
                // Connectors: from each card's bottom-center down to the SAN top.
                b.cards.forEach(function(_card, j) {
                    const cardX = b.startX + j * (cardW + cardGap);
                    const cx = cardX + cardW / 2;
                    appendLine(svg, SVG_NS, cx, cardsY + rowCardH, cx, sanTop + 6, lineColor);
                    if (Math.abs(cx - sanCx) > 1) {
                        appendLine(svg, SVG_NS, cx, sanTop + 6, sanCx, sanTop + 6, lineColor);
                    }
                });
            }

            // Per-band purpose pill (icon + text) centered BELOW the card group (only when 2+ bands).
            if (showBandPills && b.purpose) {
                const groupCx = b.startX + b.cardsTotalW / 2;
                const pillY = cardsY + rowCardH + sanBlockH + pillGap;
                const iconSize = 16;
                const iconGap = 6;
                const padX = 14;
                const text = b.purpose.title;
                const approxTextW = Math.round(text.length * 7.2);
                const hasIcon = !!(b.purpose.chipIconFile || b.purpose.iconFile || (b.purpose.iconFiles && b.purpose.iconFiles.length));
                const innerW = (hasIcon ? iconSize + iconGap : 0) + approxTextW;
                const pillW = innerW + padX * 2;
                const pillX = Math.round(groupCx - pillW / 2);

                const pill = document.createElementNS(SVG_NS, 'rect');
                pill.setAttribute('x', String(pillX));
                pill.setAttribute('y', String(pillY));
                pill.setAttribute('width', String(pillW));
                pill.setAttribute('height', String(pillH));
                pill.setAttribute('rx', String(pillH / 2));
                pill.setAttribute('ry', String(pillH / 2));
                pill.setAttribute('fill', '#e5e7eb');
                pill.setAttribute('stroke', '#cbd5e1');
                pill.setAttribute('stroke-width', '1');
                svg.appendChild(pill);

                let cursorX = pillX + padX;
                const centerY = pillY + pillH / 2;
                if (hasIcon) {
                    const iconHref = b.purpose.chipIconFile || b.purpose.iconFile || b.purpose.iconFiles[0];
                    const img = document.createElementNS(SVG_NS, 'image');
                    img.setAttribute('x', String(cursorX));
                    img.setAttribute('y', String(centerY - iconSize / 2));
                    img.setAttribute('width', String(iconSize));
                    img.setAttribute('height', String(iconSize));
                    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', iconHref);
                    img.setAttribute('href', iconHref);
                    svg.appendChild(img);
                    cursorX += iconSize + iconGap;
                }

                const pl = document.createElementNS(SVG_NS, 'text');
                pl.setAttribute('x', String(cursorX));
                pl.setAttribute('y', String(centerY + 4));
                pl.setAttribute('font-family', 'Segoe UI, sans-serif');
                pl.setAttribute('font-size', '13');
                pl.setAttribute('font-weight', '600');
                pl.setAttribute('text-anchor', 'start');
                pl.setAttribute('fill', '#1a2733');
                pl.textContent = text;
                svg.appendChild(pl);
            }
        });

        return svg;
    }

    // Decide which cards to render based on the current state.
    function buildCardList(tpl, tenancyId, scaleIds, purposeId) {
        const isDisc = state.connectivity === 'disconnected';
        const isStrict = tenancyId === 'strict';
        const isLogical = tenancyId === 'logical';
        const scales = (scaleIds && scaleIds.length) ? scaleIds.slice() : ['cluster-16'];
        const storage = purposeId ? getStorageFor(purposeId) : 'local';

        // For a given scale id, decide whether the cluster's servers should display
        // local S2D disk glyphs. Single-node and cluster-16 honor the per-purpose
        // storage choice ('local' or 'both' = show disks); cluster-64/128 use SAN
        // only (no local disks).
        function showDisksForScale(scaleId) {
            if (scaleId === 'single-node' || scaleId === 'cluster-16') {
                return storage === 'local' || storage === 'both';
            }
            return false;
        }

        const cards = [];

        // Workload clusters from the template (control-plane appliance is filtered out and
        // rendered separately because it has a distinct visual treatment).
        const workloadClusters = tpl.clusters.filter(function(c) { return !c.disconnectedOnly; });

        // Disconnected → always lead with the Control Plane Appliance card on the left.
        if (isDisc) {
            cards.push({
                kind: 'control-plane-appliance',
                title: 'Control Plane Appliance',
                appliancePill: 'Control plane appliance VM',
                clusterTitle: 'Disconnected Ops Cluster',
                servers: ['Server 1', 'Server 2', 'Server 3']
            });
        }

        // Templates with `scaleVariants` (M365 Local) define an explicit list of
        // distinct clusters per scale id. Render each cluster directly as one card
        // and skip the global scaleToVariants + per-tenant duplication logic — these
        // architectures already represent dedicated-hardware tenancy by design.
        if (tpl.scaleVariants) {
            scales.forEach(function(scaleId) {
                const variant = tpl.scaleVariants[scaleId];
                if (!variant || !variant.clusters) { return; }
                variant.clusters.forEach(function(wc) {
                    const baseCard = {
                        kind: 'workload',
                        title: wc.name,
                        workloads: wc.workloads,
                        models: wc.models || null,
                        servers: wc.servers || ['Server 1'],
                        serversLabel: wc.serversLabel || 'Servers',
                        multiRack: !!wc.multiRack,
                        comingSoon: !!wc.comingSoon,
                        stack: wc.stack || 1,
                        // M365 scaleVariants are all small clusters using local disks.
                        showLocalDisks: true,
                        departmentChips: null
                    };
                    if (isStrict) {
                        cards.push(Object.assign({}, baseCard, {
                            tenantBadge: { label: 'Tenant 1', color: '#6d3fe0' }
                        }));
                    } else {
                        cards.push(baseCard);
                    }
                });
            });
            return cards;
        }

        // For each workload cluster, materialise scale + tenancy.
        workloadClusters.forEach(function(wc) {
            const variants = [];
            scales.forEach(function(scaleId) {
                scaleToVariants(scaleId).forEach(function(v) {
                    variants.push(Object.assign({}, v, { scaleId: scaleId }));
                });
            });
            variants.forEach(function(v) {
                const baseCard = {
                    kind: 'workload',
                    title: v.title,
                    workloads: wc.workloads,
                    models: wc.models || null,
                    servers: v.servers,
                    serversLabel: v.serversLabel || 'Servers',
                    multiRack: !!v.multiRack,
                    comingSoon: !!v.comingSoon,
                    stack: v.stack || 1,
                    showLocalDisks: showDisksForScale(v.scaleId),
                    departmentChips: null
                };

                if (isStrict) {
                    cards.push(Object.assign({}, baseCard, {
                        tenantBadge: { label: 'Tenant 1', color: '#6d3fe0' }
                    }));
                    cards.push(Object.assign({}, baseCard, {
                        tenantBadge: { label: 'Tenant 2', color: '#e0612a' }
                    }));
                } else if (isLogical) {
                    cards.push(Object.assign({}, baseCard, {
                        chipsLabel: 'Tenants — logical isolation',
                        departmentChips: [
                            { label: 'Tenant 1', color: '#6d3fe0' },
                            { label: 'Tenant 2', color: '#e0612a' },
                            { label: 'Tenant 3', color: '#2faa4a' }
                        ]
                    }));
                } else {
                    cards.push(baseCard);
                }
            });
        });

        return cards;
    }

    // Map a scale id to one or more cluster card "variants" (matching deck slides 2/3).
    function scaleToVariants(scale) {
        if (scale === 'single-node') {
            return [
                { title: 'Azure Local Single Node', stack: 1, servers: ['Server 1'], serversLabel: 'Server' }
            ];
        }
        if (scale === 'cluster-16') {
            return [
                { title: 'Azure Local Cluster (up to 16 nodes)', stack: 2, servers: ['Server 1', 'Server 2', 'Server 3', 'Servers 4-16'], serversLabel: 'Servers' }
            ];
        }
        if (scale === 'cluster-64') {
            return [
                { title: 'Azure Local Cluster (up to 64 nodes)', stack: 3, multiRack: true, servers: ['Rack 1', 'Rack 2', 'Rack 3', 'Rack 4'], serversLabel: 'Up to 8 racks (e.g. 4 × 16 or 8 × 8 servers)' }
            ];
        }
        if (scale === 'cluster-128') {
            return [
                { title: 'Azure Local Cluster (up to 128 nodes)', stack: 3, multiRack: true, comingSoon: true, servers: ['Rack 1', 'Rack 2', 'Rack 3', 'Rack 4'], serversLabel: 'Up to 8 racks × 16 servers' }
            ];
        }
        // default fallback
        return [
            { title: 'Azure Local Cluster', stack: 1, servers: ['Server 1'], serversLabel: 'Server' }
        ];
    }

    // Compute how tall a card needs to be so its content fits without overlap.
    function measureCardHeight(card) {
        if (card.kind === 'control-plane-appliance') {
            const titleH = 50;
            const vmH = 40;
            const subTitleBlock = 44;
            const pillH = 26, pillGap = 8;
            const pillsBlock = card.servers.length * pillH + (card.servers.length - 1) * pillGap;
            return titleH + 12 + vmH + 16 + subTitleBlock + pillsBlock + 14 + APPLIANCE_PAAS_BLOCK_H + 24;
        }
        // workload card — assume the worst-case (smallest) cardW from the adaptive
        // squeeze so chips and labels wrap correctly even when the row gets crowded.
        const cardW = 200;
        let titleText = card.title;
        if (card.tenantLabel) { titleText = card.tenantLabel + ' — ' + card.title; }
        if (card.comingSoon) { titleText += ' *'; }
        const badgeSize = 28;
        const titleLines = wrapTitle(titleText, cardW - 24 - badgeSize - 8, 15);
        const titleBlock = Math.max(22 + titleLines.length * 18, 8 + badgeSize + 4) + 8;
        const ribbonBlock = card.tenantBadge ? 28 : 0;
        const chipsLabelBlock = (card.departmentChips && card.chipsLabel) ? 16 : 0;
        const chipsBlock = card.departmentChips ? (22 + 12 + 8) : 0;
        const tileH = 36, tileGap = 8, wlBandPad = 12;
        const workloads = (card.workloads || []).slice(0, 6);
        const wlBandH = workloads.length > 0
            ? wlBandPad * 2 + workloads.length * tileH + (workloads.length - 1) * tileGap
            : 60;
        let modelsBlock = 0;
        if (card.models && card.models.length) {
            const modelRows = packModelsRows(card.models, cardW - 16);
            const chipH = 22, rowGap = 6;
            modelsBlock = 16 + modelRows.length * chipH + Math.max(0, modelRows.length - 1) * rowGap + 8;
        }
        const sectionLabelH = 22;
        const labelText = card.serversLabel || (card.multiRack ? 'Racks' : 'Servers');
        const labelLines = wrapServersLabel(labelText.toUpperCase(), cardW - 24);
        const labelBlock = sectionLabelH + Math.max(0, labelLines.length - 1) * 13;
        const pillH = 30, pillGap = 8;
        const pillsBlock = card.servers.length * pillH + (card.servers.length - 1) * pillGap;
        return titleBlock + ribbonBlock + chipsLabelBlock + chipsBlock + wlBandH + modelsBlock + 14 + labelBlock + pillsBlock + 18;
    }

    // Greedy-pack the models strip into N rows so each row fits within `availW`.
    // Returns an array of arrays of models. Always at least 1 row when input is non-empty.
    function packModelsRows(models, availW) {
        const chipGap = 6;
        const chipPadL = 22;
        const chipPadR = 8;
        const chipFont = 11;
        const chipCharW = chipFont * 0.55;
        function chipWidth(m) {
            return Math.max(48, Math.round(m.name.length * chipCharW + chipPadL + chipPadR));
        }
        const rows = [];
        let row = [];
        let rowW = 0;
        models.forEach(function(m) {
            const cw = chipWidth(m);
            const needed = rowW === 0 ? cw : rowW + chipGap + cw;
            if (row.length && needed > availW) {
                rows.push(row);
                row = [m];
                rowW = cw;
            } else {
                row.push(m);
                rowW = needed;
            }
        });
        if (row.length) { rows.push(row); }
        return rows;
    }

    // Word-wrap a short uppercase label across up to 2 lines so it fits the card width.
    function wrapServersLabel(text, maxWidth) {
        const fontSize = 11;
        const charW = fontSize * 0.62;     // uppercase + letter-spacing tracks wider
        const maxChars = Math.max(8, Math.floor(maxWidth / charW));
        if (text.length <= maxChars) { return [text]; }
        const words = text.split(' ');
        const lines = [''];
        words.forEach(function(w) {
            const candidate = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w;
            if (candidate.length <= maxChars) {
                lines[lines.length - 1] = candidate;
            } else {
                lines.push(w);
            }
        });
        return lines;
    }

    // Greedy word-wrap by approximate pixel width. Caps at 3 lines and adds an ellipsis
    // on the last line if the title still doesn't fit.
    function wrapTitle(text, maxWidth, fontSize) {
        const charW = fontSize * 0.58;     // rough Segoe UI proportional width
        const maxChars = Math.max(8, Math.floor(maxWidth / charW));
        if (text.length <= maxChars) { return [text]; }
        const maxLines = 3;
        const words = text.split(' ');
        const lines = [''];
        words.forEach(function(w) {
            const candidate = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w;
            if (candidate.length <= maxChars) {
                lines[lines.length - 1] = candidate;
            } else if (lines.length < maxLines) {
                lines.push(w);
            } else {
                // append to last line, truncate later if needed
                lines[maxLines - 1] = lines[maxLines - 1] + ' ' + w;
            }
        });
        const last = lines.length - 1;
        if (lines[last] && lines[last].length > maxChars) {
            lines[last] = lines[last].slice(0, Math.max(1, maxChars - 1)) + '…';
        }
        return lines;
    }

    // ----- low-level SVG helpers --------------------------------------

    function appendRowLabel(svg, SVG_NS, x, y, text, glyph) {
        const g = document.createElementNS(SVG_NS, 'g');
        // small icon
        const icon = document.createElementNS(SVG_NS, 'path');
        icon.setAttribute('fill', 'currentColor');
        if (glyph === 'cloud') {
            icon.setAttribute('d', 'M' + (x + 4) + ',' + (y + 2) + ' a8 8 0 0 1 -.6 -15 9 9 0 0 1 16.5 1.6 6 6 0 0 1 -1.5 12z');
        } else {
            // building/government glyph for distributed location
            icon.setAttribute('d', 'M' + (x + 1) + ',' + (y - 6) + ' L' + (x + 9) + ',' + (y - 11) + ' L' + (x + 17) + ',' + (y - 6) + ' L' + (x + 17) + ',' + (y - 4) + ' L' + (x + 1) + ',' + (y - 4) + ' Z M' + (x + 2) + ',' + (y - 2) + ' h2 v6 h-2z M' + (x + 6) + ',' + (y - 2) + ' h2 v6 h-2z M' + (x + 10) + ',' + (y - 2) + ' h2 v6 h-2z M' + (x + 14) + ',' + (y - 2) + ' h2 v6 h-2z M' + x + ',' + (y + 5) + ' h18 v2 h-18z');
        }
        g.appendChild(icon);

        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('x', String(x + 26));
        t.setAttribute('y', String(y + 5));
        t.setAttribute('fill', 'currentColor');
        t.setAttribute('font-family', 'Segoe UI, sans-serif');
        t.setAttribute('font-size', '13');
        t.setAttribute('font-weight', '500');
        t.textContent = text;
        g.appendChild(t);

        g.setAttribute('color', 'var(--text-secondary, #5c6b7a)');
        svg.appendChild(g);
    }

    function appendCloudBubble(svg, SVG_NS, x, y, w, h, label, isDisconnected) {
        // Ensure the teal→blue control-plane gradient (matching the connectivity
        // cards' .spc-pill-control style) is defined once on the SVG.
        const ownerSvg = svg.ownerSVGElement || svg;
        if (!ownerSvg.querySelector('#odin-ra-cp-gradient')) {
            let defs = ownerSvg.querySelector('defs');
            if (!defs) {
                defs = document.createElementNS(SVG_NS, 'defs');
                ownerSvg.insertBefore(defs, ownerSvg.firstChild);
            }
            const grad = document.createElementNS(SVG_NS, 'linearGradient');
            grad.setAttribute('id', 'odin-ra-cp-gradient');
            grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
            grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '100%');
            const s1 = document.createElementNS(SVG_NS, 'stop');
            s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', '#2bc4a6');
            const s2 = document.createElementNS(SVG_NS, 'stop');
            s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', '#29a3d8');
            grad.appendChild(s1); grad.appendChild(s2);
            defs.appendChild(grad);
        }

        // soft rounded "cloud" rectangle
        const r = document.createElementNS(SVG_NS, 'rect');
        r.setAttribute('x', String(x));
        r.setAttribute('y', String(y));
        r.setAttribute('width', String(w));
        r.setAttribute('height', String(h));
        r.setAttribute('rx', String(h / 2));
        if (isDisconnected) {
            r.setAttribute('fill', '#7a8590');
        } else {
            r.setAttribute('fill', 'url(#odin-ra-cp-gradient)');
        }
        svg.appendChild(r);

        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('x', String(x + w / 2));
        t.setAttribute('y', String(y + h / 2 + 5));
        t.setAttribute('fill', '#fff');
        t.setAttribute('font-family', 'Segoe UI, sans-serif');
        t.setAttribute('font-size', '17');
        t.setAttribute('font-weight', '600');
        t.setAttribute('text-anchor', 'middle');
        t.textContent = label || 'Azure';
        svg.appendChild(t);
    }

    function appendDashed(svg, SVG_NS, x1, y1, x2, y2) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        line.setAttribute('stroke', 'var(--text-secondary, #5c6b7a)');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '4 4');
        line.setAttribute('opacity', '0.6');
        svg.appendChild(line);
    }

    function appendLine(svg, SVG_NS, x1, y1, x2, y2, color) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        line.setAttribute('stroke', color || 'currentColor');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('opacity', '0.6');
        svg.appendChild(line);
    }

    // Disaggregated SAN cylinder — drawn as a stacked cylinder (top ellipse + body
    // + bottom ellipse) with a "SAN" label. Used to indicate that 64+ node clusters
    // require disaggregated SAN-based storage.
    function renderSanCylinder(svg, SVG_NS, x, y, w, h) {
        const rx = w / 2;
        const ry = 7;
        const cx = x + rx;
        // Body
        const body = document.createElementNS(SVG_NS, 'path');
        body.setAttribute('d',
            'M ' + x + ' ' + (y + ry) +
            ' L ' + x + ' ' + (y + h - ry) +
            ' A ' + rx + ' ' + ry + ' 0 0 0 ' + (x + w) + ' ' + (y + h - ry) +
            ' L ' + (x + w) + ' ' + (y + ry) + ' Z');
        body.setAttribute('fill', '#cbd5e1');
        body.setAttribute('stroke', '#64748b');
        body.setAttribute('stroke-width', '1');
        svg.appendChild(body);
        // Top ellipse
        const top = document.createElementNS(SVG_NS, 'ellipse');
        top.setAttribute('cx', String(cx));
        top.setAttribute('cy', String(y + ry));
        top.setAttribute('rx', String(rx));
        top.setAttribute('ry', String(ry));
        top.setAttribute('fill', '#e2e8f0');
        top.setAttribute('stroke', '#64748b');
        top.setAttribute('stroke-width', '1');
        svg.appendChild(top);
        // Inner stripe (suggests disks)
        const stripe = document.createElementNS(SVG_NS, 'ellipse');
        stripe.setAttribute('cx', String(cx));
        stripe.setAttribute('cy', String(y + h / 2));
        stripe.setAttribute('rx', String(rx));
        stripe.setAttribute('ry', String(ry));
        stripe.setAttribute('fill', 'none');
        stripe.setAttribute('stroke', '#94a3b8');
        stripe.setAttribute('stroke-width', '1');
        svg.appendChild(stripe);
        // Label
        const lbl = document.createElementNS(SVG_NS, 'text');
        lbl.setAttribute('x', String(cx));
        lbl.setAttribute('y', String(y + h / 2 + 4));
        lbl.setAttribute('font-family', 'Segoe UI, sans-serif');
        lbl.setAttribute('font-size', '11');
        lbl.setAttribute('font-weight', '700');
        lbl.setAttribute('text-anchor', 'middle');
        lbl.setAttribute('fill', '#334155');
        lbl.textContent = 'SAN';
        svg.appendChild(lbl);
    }

    function renderArchCard(svg, SVG_NS, x, y, w, h, card) {
        if (card.kind === 'control-plane-appliance') {
            renderControlPlaneApplianceCard(svg, SVG_NS, x, y, w, h, card);
        } else {
            renderWorkloadCard(svg, SVG_NS, x, y, w, h, card);
        }
    }

    // Card matching slides 2/3 — left "Control Plane Appliance" with a teal title pill,
    // a blue "Control plane appliance VM" pill and a "Disconnected Ops Cluster" sub-card.
    // PaaS services available in the local appliance cluster (slide 23 — "Run fully
    // disconnected" / Subset of services available). Order + icons match the deck.
    // `available: false` greys the tile out (Copilot, Defender, AVD are not available
    // in fully disconnected mode).
    const APPLIANCE_PAAS_SERVICES = [
        { name: 'Portal',        icon: 'icons/paas-portal.svg',        available: true },
        { name: 'ARM',           icon: 'icons/paas-arm.svg',           available: true },
        { name: 'Copilot',       icon: 'icons/paas-copilot.svg',       available: false },
        { name: 'Key Vaults',    icon: 'icons/paas-keyvault.svg',      available: true,  footnote: '1' },
        { name: 'Policy',        icon: 'icons/paas-policy.svg',        available: true,  footnote: '1' },
        { name: 'Defender',      icon: 'icons/paas-defender.svg',      available: false },
        { name: 'Local',         icon: 'icons/paas-local.png',         available: true },
        { name: 'Machines',      icon: 'icons/paas-machines.png',      available: true },
        { name: 'Kubernetes',    icon: 'icons/paas-kubernetes.svg',    available: true },
        { name: 'Registries',    icon: 'icons/paas-registries.svg',    available: true },
        { name: 'AVD',           icon: 'icons/paas-avd.svg',           available: false },
        { name: 'Foundry Local', icon: 'icons/paas-foundry-local.png', available: true }
    ];
    const APPLIANCE_PAAS_ROWS = 3;
    const APPLIANCE_PAAS_COLS = 4;
    const APPLIANCE_PAAS_TILE_H = 70;     // boxed tile (icon + label)
    const APPLIANCE_PAAS_TILE_GAP = 6;
    const APPLIANCE_PAAS_HEAD_H = 24;
    const APPLIANCE_PAAS_BLOCK_H = APPLIANCE_PAAS_HEAD_H
        + APPLIANCE_PAAS_ROWS * APPLIANCE_PAAS_TILE_H
        + (APPLIANCE_PAAS_ROWS - 1) * APPLIANCE_PAAS_TILE_GAP
        + 8;

    function renderControlPlaneApplianceCard(svg, SVG_NS, x, y, w, h, card) {
        // Teal title pill
        const titleH = 50;
        const tr = document.createElementNS(SVG_NS, 'rect');
        tr.setAttribute('x', String(x));
        tr.setAttribute('y', String(y));
        tr.setAttribute('width', String(w));
        tr.setAttribute('height', String(titleH));
        tr.setAttribute('rx', '8');
        tr.setAttribute('fill', '#2bc4a6');
        svg.appendChild(tr);
        const tt = document.createElementNS(SVG_NS, 'text');
        tt.setAttribute('x', String(x + w / 2));
        tt.setAttribute('y', String(y + titleH / 2 + 5));
        tt.setAttribute('fill', '#fff');
        tt.setAttribute('font-family', 'Segoe UI, sans-serif');
        tt.setAttribute('font-size', '14');
        tt.setAttribute('font-weight', '700');
        tt.setAttribute('text-anchor', 'middle');
        tt.textContent = card.title;
        svg.appendChild(tt);

        // Blue VM pill
        const vmY = y + titleH + 12;
        const vmH = 40;
        const vmR = document.createElementNS(SVG_NS, 'rect');
        vmR.setAttribute('x', String(x + 14));
        vmR.setAttribute('y', String(vmY));
        vmR.setAttribute('width', String(w - 28));
        vmR.setAttribute('height', String(vmH));
        vmR.setAttribute('rx', '6');
        vmR.setAttribute('fill', '#0078D4');
        svg.appendChild(vmR);
        const vmT = document.createElementNS(SVG_NS, 'text');
        vmT.setAttribute('x', String(x + w / 2));
        vmT.setAttribute('y', String(vmY + vmH / 2 + 4));
        vmT.setAttribute('fill', '#fff');
        vmT.setAttribute('font-family', 'Segoe UI, sans-serif');
        vmT.setAttribute('font-size', '12');
        vmT.setAttribute('text-anchor', 'middle');
        vmT.textContent = card.appliancePill;
        svg.appendChild(vmT);

        // Sub-card with cluster name + servers
        const subY = vmY + vmH + 16;
        const subH = h - (subY - y);
        const sub = document.createElementNS(SVG_NS, 'rect');
        sub.setAttribute('x', String(x));
        sub.setAttribute('y', String(subY));
        sub.setAttribute('width', String(w));
        sub.setAttribute('height', String(subH));
        sub.setAttribute('rx', '8');
        sub.setAttribute('fill', 'transparent');
        sub.setAttribute('stroke', '#2bc4a6');
        sub.setAttribute('stroke-width', '1.2');
        svg.appendChild(sub);

        const subTitle = document.createElementNS(SVG_NS, 'text');
        subTitle.setAttribute('x', String(x + w / 2));
        subTitle.setAttribute('y', String(subY + 24));
        subTitle.setAttribute('fill', 'var(--text-primary, #222)');
        subTitle.setAttribute('font-family', 'Segoe UI, sans-serif');
        subTitle.setAttribute('font-size', '12');
        subTitle.setAttribute('font-weight', '500');
        subTitle.setAttribute('text-anchor', 'middle');
        subTitle.textContent = card.clusterTitle;
        svg.appendChild(subTitle);

        // Server pills
        const startY = subY + 44;
        const pillH = 26;
        const pillGap = 8;
        card.servers.forEach(function(s, i) {
            const py = startY + i * (pillH + pillGap);
            appendServerPill(svg, SVG_NS, x + 16, py, w - 32, pillH, s, false, true);
        });

        // PaaS services strip — "Subset of services available" — boxed tiles in 2 rows of 6.
        // Greys out services that are not available in fully disconnected mode
        // (Copilot, Defender, AVD).
        const pillsBottom = startY + card.servers.length * (pillH + pillGap) - pillGap;
        const stripY = pillsBottom + 14;
        const headT = document.createElementNS(SVG_NS, 'text');
        headT.setAttribute('x', String(x + 12));
        headT.setAttribute('y', String(stripY + 12));
        headT.setAttribute('fill', '#2bc4a6');
        headT.setAttribute('font-family', 'Segoe UI, sans-serif');
        headT.setAttribute('font-size', '11');
        headT.setAttribute('font-weight', '600');
        headT.textContent = 'Subset of services available:';
        svg.appendChild(headT);

        const gridLeft = x + 10;
        const gridRight = x + w - 10;
        const colSpan = (gridRight - gridLeft) / APPLIANCE_PAAS_COLS;
        const tileW = Math.max(50, colSpan - APPLIANCE_PAAS_TILE_GAP);
        const iconSize = Math.min(32, tileW - 12);
        const tileH = APPLIANCE_PAAS_TILE_H;
        APPLIANCE_PAAS_SERVICES.forEach(function(svc, i) {
            const r = Math.floor(i / APPLIANCE_PAAS_COLS);
            const c = i % APPLIANCE_PAAS_COLS;
            const tileX = gridLeft + c * colSpan + (colSpan - tileW) / 2;
            const tileY = stripY + APPLIANCE_PAAS_HEAD_H + r * (tileH + APPLIANCE_PAAS_TILE_GAP);
            const isOff = !svc.available;

            // Tile box
            const box = document.createElementNS(SVG_NS, 'rect');
            box.setAttribute('x', String(tileX));
            box.setAttribute('y', String(tileY));
            box.setAttribute('width', String(tileW));
            box.setAttribute('height', String(tileH));
            box.setAttribute('rx', '4');
            box.setAttribute('fill', isOff ? '#f1f3f5' : '#ffffff');
            box.setAttribute('stroke', isOff ? '#c8ccd1' : '#9bbedf');
            box.setAttribute('stroke-width', '1');
            svg.appendChild(box);

            // Icon — wrapped in a <g> so we can dim it when unavailable.
            const g = document.createElementNS(SVG_NS, 'g');
            if (isOff) {
                g.setAttribute('opacity', '0.35');
                g.setAttribute('filter', 'grayscale(100%)');
            }
            const img = document.createElementNS(SVG_NS, 'image');
            const iconX = tileX + (tileW - iconSize) / 2;
            const iconY = tileY + 8;
            img.setAttribute('x', String(iconX));
            img.setAttribute('y', String(iconY));
            img.setAttribute('width', String(iconSize));
            img.setAttribute('height', String(iconSize));
            img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', svc.icon);
            img.setAttribute('href', svc.icon);
            g.appendChild(img);
            svg.appendChild(g);

            // Slash sized for the bigger icon
            if (isOff) {
                const slash = document.createElementNS(SVG_NS, 'line');
                slash.setAttribute('x1', String(iconX + 2));
                slash.setAttribute('y1', String(iconY + iconSize - 2));
                slash.setAttribute('x2', String(iconX + iconSize - 2));
                slash.setAttribute('y2', String(iconY + 2));
                slash.setAttribute('stroke', '#c0392b');
                slash.setAttribute('stroke-width', '2');
                slash.setAttribute('stroke-linecap', 'round');
                svg.appendChild(slash);
            }

            // Label — wraps to 2 lines if it doesn't fit on one (e.g. "Foundry Local",
            // "Key Vaults"). Footnote stays attached to the last word.
            const labelText = svc.name + (svc.footnote ? svc.footnote : '');
            const labelFont = 11;
            const labelCharW = labelFont * 0.55;
            const labelMaxChars = Math.max(6, Math.floor((tileW - 6) / labelCharW));
            let labelLines = [labelText];
            if (labelText.length > labelMaxChars && labelText.indexOf(' ') >= 0) {
                const parts = labelText.split(' ');
                labelLines = [parts[0], parts.slice(1).join(' ')];
            }
            const labelLineH = 12;
            const labelBlockTop = tileY + tileH - 9 - (labelLines.length - 1) * labelLineH;
            labelLines.forEach(function(line, li) {
                const lbl = document.createElementNS(SVG_NS, 'text');
                lbl.setAttribute('x', String(tileX + tileW / 2));
                lbl.setAttribute('y', String(labelBlockTop + li * labelLineH));
                lbl.setAttribute('fill', isOff ? '#8a929b' : '#0f6cbd');
                lbl.setAttribute('font-family', 'Segoe UI, sans-serif');
                lbl.setAttribute('font-size', String(labelFont));
                lbl.setAttribute('font-weight', '600');
                lbl.setAttribute('text-anchor', 'middle');
                lbl.textContent = line;
                svg.appendChild(lbl);
            });
        });
    }

    // Workload cluster card — outer rounded rectangle with optional stack effect, blue
    // workload band on top, light-teal server pills at the bottom. Matches slides 2-5.
    function renderWorkloadCard(svg, SVG_NS, x, y, w, h, card) {
        // Main card outline
        const main = document.createElementNS(SVG_NS, 'rect');
        main.setAttribute('x', String(x));
        main.setAttribute('y', String(y));
        main.setAttribute('width', String(w));
        main.setAttribute('height', String(h));
        main.setAttribute('rx', '12');
        main.setAttribute('fill', 'transparent');
        main.setAttribute('stroke', '#9DC3E6');
        main.setAttribute('stroke-width', '1.2');
        svg.appendChild(main);

        // Top-left Azure Local Cluster badge.
        const badgeSize = 28;
        const badgeImg = document.createElementNS(SVG_NS, 'image');
        badgeImg.setAttribute('x', String(x + 10));
        badgeImg.setAttribute('y', String(y + 8));
        badgeImg.setAttribute('width', String(badgeSize));
        badgeImg.setAttribute('height', String(badgeSize));
        badgeImg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', 'icons/sovereign-azure-local-cluster.svg');
        badgeImg.setAttribute('href', 'icons/sovereign-azure-local-cluster.svg');
        svg.appendChild(badgeImg);

        // Title — leaves room for the badge by reducing the available width.
        let titleText = card.title;
        if (card.tenantLabel) { titleText = card.tenantLabel + ' — ' + card.title; }
        if (card.comingSoon) { titleText += ' *'; }

        const titleAvailW = w - 24 - badgeSize - 8;
        const titleLines = wrapTitle(titleText, titleAvailW, 15);
        const titleLineH = 18;
        const titleStartX = x + (badgeSize + 18) + (w - (badgeSize + 18) - 12) / 2;
        titleLines.forEach(function(line, i) {
            const t = document.createElementNS(SVG_NS, 'text');
            t.setAttribute('x', String(titleStartX));
            t.setAttribute('y', String(y + 22 + i * titleLineH));
            t.setAttribute('fill', 'var(--text-primary, #222)');
            t.setAttribute('font-family', 'Segoe UI, sans-serif');
            t.setAttribute('font-size', '15');
            t.setAttribute('font-weight', '600');
            t.setAttribute('text-anchor', 'middle');
            t.textContent = line;
            svg.appendChild(t);
        });
        const titleBlockH = Math.max(22 + titleLines.length * titleLineH, 8 + badgeSize + 4);

        // Strict-isolation tenant ribbon — colored band across the top of the card,
        // sitting above the title row. Indicates which tenant this dedicated cluster serves.
        let tenantRibbonH = 0;
        if (card.tenantBadge) {
            tenantRibbonH = 22;
            const ribbonY = y + titleBlockH + 4;
            const ribbon = document.createElementNS(SVG_NS, 'rect');
            ribbon.setAttribute('x', String(x + 8));
            ribbon.setAttribute('y', String(ribbonY));
            ribbon.setAttribute('width', String(w - 16));
            ribbon.setAttribute('height', String(tenantRibbonH));
            ribbon.setAttribute('rx', '4');
            ribbon.setAttribute('fill', card.tenantBadge.color);
            svg.appendChild(ribbon);
            const ribbonText = document.createElementNS(SVG_NS, 'text');
            ribbonText.setAttribute('x', String(x + w / 2));
            ribbonText.setAttribute('y', String(ribbonY + 16));
            ribbonText.setAttribute('fill', '#fff');
            ribbonText.setAttribute('font-family', 'Segoe UI, sans-serif');
            ribbonText.setAttribute('font-size', '11');
            ribbonText.setAttribute('font-weight', '700');
            ribbonText.setAttribute('text-anchor', 'middle');
            ribbonText.setAttribute('letter-spacing', '0.08em');
            ribbonText.textContent = (card.tenantBadge.label + ' — STRICT ISOLATION').toUpperCase();
            svg.appendChild(ribbonText);
            tenantRibbonH += 6;
        }

        // Department / tenant chips (logical isolation) with a small label header above.
        let workloadY = y + titleBlockH + tenantRibbonH + 8;
        if (card.departmentChips) {
            if (card.chipsLabel) {
                const lbl = document.createElementNS(SVG_NS, 'text');
                lbl.setAttribute('x', String(x + w / 2));
                lbl.setAttribute('y', String(workloadY + 10));
                lbl.setAttribute('fill', 'var(--text-secondary, #5c6b7a)');
                lbl.setAttribute('font-family', 'Segoe UI, sans-serif');
                lbl.setAttribute('font-size', '10');
                lbl.setAttribute('font-weight', '600');
                lbl.setAttribute('text-anchor', 'middle');
                lbl.setAttribute('letter-spacing', '0.06em');
                lbl.textContent = card.chipsLabel.toUpperCase();
                svg.appendChild(lbl);
                workloadY += 16;
            }

            // Group container behind the chips so they read as one logical unit.
            const groupPad = 6;
            const groupY = workloadY - groupPad;
            const groupH = 22 + groupPad * 2;
            const group = document.createElementNS(SVG_NS, 'rect');
            group.setAttribute('x', String(x + 8));
            group.setAttribute('y', String(groupY));
            group.setAttribute('width', String(w - 16));
            group.setAttribute('height', String(groupH));
            group.setAttribute('rx', '6');
            group.setAttribute('fill', 'rgba(255,255,255,0.04)');
            group.setAttribute('stroke', 'var(--text-secondary, #5c6b7a)');
            group.setAttribute('stroke-width', '0.6');
            group.setAttribute('stroke-dasharray', '3 3');
            group.setAttribute('opacity', '0.6');
            svg.appendChild(group);

            const chipW = (w - 24 - (card.departmentChips.length - 1) * 8) / card.departmentChips.length;
            card.departmentChips.forEach(function(chip, i) {
                const cx = x + 12 + i * (chipW + 8);
                const c = document.createElementNS(SVG_NS, 'rect');
                c.setAttribute('x', String(cx));
                c.setAttribute('y', String(workloadY));
                c.setAttribute('width', String(chipW));
                c.setAttribute('height', '22');
                c.setAttribute('rx', '3');
                c.setAttribute('fill', chip.color);
                svg.appendChild(c);
                const ct = document.createElementNS(SVG_NS, 'text');
                ct.setAttribute('x', String(cx + chipW / 2));
                ct.setAttribute('y', String(workloadY + 16));
                ct.setAttribute('fill', '#fff');
                ct.setAttribute('font-family', 'Segoe UI, sans-serif');
                ct.setAttribute('font-size', '11');
                ct.setAttribute('font-weight', '700');
                ct.setAttribute('text-anchor', 'middle');
                ct.textContent = chip.label;
                svg.appendChild(ct);
            });
            workloadY += 22 + groupPad + 8;
        }

        // Workload band — blue rounded rect housing workload icon tiles (1 per row).
        const workloads = (card.workloads || []).slice(0, 6);
        const tileH = 36;
        const tileGap = 8;
        const wlBandPad = 12;
        const wlBandH = workloads.length > 0
            ? wlBandPad * 2 + workloads.length * tileH + (workloads.length - 1) * tileGap
            : 60;
        const wlBand = document.createElementNS(SVG_NS, 'rect');
        wlBand.setAttribute('x', String(x + 12));
        wlBand.setAttribute('y', String(workloadY));
        wlBand.setAttribute('width', String(w - 24));
        wlBand.setAttribute('height', String(wlBandH));
        wlBand.setAttribute('rx', '8');
        wlBand.setAttribute('fill', '#cfe4f7');
        wlBand.setAttribute('opacity', '0.9');
        svg.appendChild(wlBand);

        // Workload tiles inside the band — one per row, full width, label has plenty of room.
        const tileX = x + 12 + wlBandPad;
        const tileW = w - 24 - wlBandPad * 2;

        workloads.forEach(function(wl, i) {
            const ty = workloadY + wlBandPad + i * (tileH + tileGap);

            const tile = document.createElementNS(SVG_NS, 'rect');
            tile.setAttribute('x', String(tileX));
            tile.setAttribute('y', String(ty));
            tile.setAttribute('width', String(tileW));
            tile.setAttribute('height', String(tileH));
            tile.setAttribute('rx', '4');
            // Lighter blue tile + dark text so the official Azure service icons
            // (which use saturated blue/teal/red glyphs) keep good contrast.
            tile.setAttribute('fill', '#dbe9f7');
            tile.setAttribute('stroke', '#9bbedf');
            tile.setAttribute('stroke-width', '1');
            svg.appendChild(tile);

            const hasIcon = !!WORKLOAD_ICON_FILES[wl];
            const labelText = hasIcon ? (WORKLOAD_ICON_LABELS[wl] || wl) : wl;
            if (hasIcon) {
                const img = document.createElementNS(SVG_NS, 'image');
                img.setAttribute('x', String(tileX + 8));
                img.setAttribute('y', String(ty + (tileH - 24) / 2));
                img.setAttribute('width', '24');
                img.setAttribute('height', '24');
                img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', WORKLOAD_ICON_FILES[wl]);
                img.setAttribute('href', WORKLOAD_ICON_FILES[wl]);
                svg.appendChild(img);
            }
            const lbl = document.createElementNS(SVG_NS, 'text');
            const labelX = hasIcon ? tileX + 40 : tileX + tileW / 2;
            lbl.setAttribute('x', String(labelX));
            lbl.setAttribute('fill', '#1a2733');
            lbl.setAttribute('font-family', 'Segoe UI, sans-serif');
            lbl.setAttribute('font-size', '12');
            lbl.setAttribute('font-weight', '600');
            if (!hasIcon) { lbl.setAttribute('text-anchor', 'middle'); }

            // Wrap to 2 lines when the label is too long for the tile width.
            const charW = 6.5; // approx px per char @ 12px Segoe UI 600
            const availW = tileW - (hasIcon ? 48 : 16);
            const maxChars = Math.max(8, Math.floor(availW / charW));
            if (labelText.length > maxChars && labelText.indexOf(' ') >= 0) {
                // Find the best split point: the last space at or before maxChars.
                let splitAt = labelText.lastIndexOf(' ', maxChars);
                if (splitAt < 4) { splitAt = labelText.indexOf(' ', maxChars); }
                if (splitAt > 0) {
                    const line1 = labelText.slice(0, splitAt);
                    const line2 = labelText.slice(splitAt + 1);
                    lbl.setAttribute('y', String(ty + tileH / 2 - 3));
                    const t1 = document.createElementNS(SVG_NS, 'tspan');
                    t1.setAttribute('x', String(labelX));
                    t1.textContent = line1;
                    lbl.appendChild(t1);
                    const t2 = document.createElementNS(SVG_NS, 'tspan');
                    t2.setAttribute('x', String(labelX));
                    t2.setAttribute('dy', '13');
                    t2.textContent = line2;
                    lbl.appendChild(t2);
                } else {
                    lbl.setAttribute('y', String(ty + tileH / 2 + 4));
                    lbl.textContent = labelText;
                }
            } else {
                lbl.setAttribute('y', String(ty + tileH / 2 + 4));
                lbl.textContent = labelText;
            }
            svg.appendChild(lbl);
        });

        // Server pills at the bottom — preceded by a section label ("Servers" or "Racks").
        const pillH = 30;
        const pillGap = 8;
        const sectionLabelH = 22;
        // Optional "AVAILABLE MODELS" strip (Foundry Local scenario, slide 56).
        // Renders 2 rows of chips, each chip = colored monogram circle + name.
        let modelsStripH = 0;
        if (card.models && card.models.length) {
            const stripY = workloadY + wlBandH + 10;
            const stripLabel = document.createElementNS(SVG_NS, 'text');
            stripLabel.setAttribute('x', String(x + w / 2));
            stripLabel.setAttribute('y', String(stripY + 11));
            stripLabel.setAttribute('fill', 'var(--text-secondary, #5c6b7a)');
            stripLabel.setAttribute('font-family', 'Segoe UI, sans-serif');
            stripLabel.setAttribute('font-size', '11');
            stripLabel.setAttribute('font-weight', '600');
            stripLabel.setAttribute('text-anchor', 'middle');
            stripLabel.setAttribute('letter-spacing', '0.06em');
            stripLabel.textContent = 'AVAILABLE AI MODELS';
            svg.appendChild(stripLabel);

            const chipH = 22;
            const chipGap = 6;
            const rowGap = 6;
            const chipPadL = 22;     // monogram + space
            const chipPadR = 8;
            const chipFont = 11;
            const chipCharW = chipFont * 0.55;
            const monoR = 8;

            // Greedy-pack into N rows that each fit within the card width.
            const rows = packModelsRows(card.models, w - 16);
            const firstRowY = stripY + 18;

            rows.forEach(function(rowModels, rowIdx) {
                if (!rowModels.length) { return; }
                const widths = rowModels.map(function(m) {
                    return Math.max(48, Math.round(m.name.length * chipCharW + chipPadL + chipPadR));
                });
                const totalW = widths.reduce(function(a, b) { return a + b; }, 0)
                    + (rowModels.length - 1) * chipGap;
                const rowY = firstRowY + rowIdx * (chipH + rowGap);
                let cx = x + (w - totalW) / 2;
                rowModels.forEach(function(m, i) {
                    const cw = widths[i];
                    const chip = document.createElementNS(SVG_NS, 'rect');
                    chip.setAttribute('x', String(cx));
                    chip.setAttribute('y', String(rowY));
                    chip.setAttribute('width', String(cw));
                    chip.setAttribute('height', String(chipH));
                    chip.setAttribute('rx', '11');
                    chip.setAttribute('fill', '#eef3fa');
                    chip.setAttribute('stroke', '#9bbedf');
                    chip.setAttribute('stroke-width', '1');
                    svg.appendChild(chip);

                    // Logo (or monogram fallback for BYO) on the left.
                    if (m.icon) {
                        const logoSize = 16;
                        const img = document.createElementNS(SVG_NS, 'image');
                        img.setAttribute('x', String(cx + 4));
                        img.setAttribute('y', String(rowY + (chipH - logoSize) / 2));
                        img.setAttribute('width', String(logoSize));
                        img.setAttribute('height', String(logoSize));
                        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', m.icon);
                        img.setAttribute('href', m.icon);
                        svg.appendChild(img);
                    } else {
                        const circ = document.createElementNS(SVG_NS, 'circle');
                        circ.setAttribute('cx', String(cx + 3 + monoR));
                        circ.setAttribute('cy', String(rowY + chipH / 2));
                        circ.setAttribute('r', String(monoR));
                        circ.setAttribute('fill', m.color || '#5c6b7a');
                        svg.appendChild(circ);
                        const monoT = document.createElementNS(SVG_NS, 'text');
                        monoT.setAttribute('x', String(cx + 3 + monoR));
                        monoT.setAttribute('y', String(rowY + chipH / 2 + 4));
                        monoT.setAttribute('fill', '#fff');
                        monoT.setAttribute('font-family', 'Segoe UI, sans-serif');
                        monoT.setAttribute('font-size', '11');
                        monoT.setAttribute('font-weight', '700');
                        monoT.setAttribute('text-anchor', 'middle');
                        monoT.textContent = m.mono || (m.name ? m.name.charAt(0) : '?');
                        svg.appendChild(monoT);
                    }

                    // Model name.
                    const t = document.createElementNS(SVG_NS, 'text');
                    t.setAttribute('x', String(cx + chipPadL));
                    t.setAttribute('y', String(rowY + chipH / 2 + 4));
                    t.setAttribute('fill', '#1a2733');
                    t.setAttribute('font-family', 'Segoe UI, sans-serif');
                    t.setAttribute('font-size', String(chipFont));
                    t.setAttribute('font-weight', '600');
                    t.textContent = m.name;
                    svg.appendChild(t);

                    cx += cw + chipGap;
                });
            });
            modelsStripH = 16 + rows.length * chipH + Math.max(0, rows.length - 1) * rowGap + 8;
        }
        const sectionY = workloadY + wlBandH + modelsStripH + 14;
        const labelText = card.serversLabel || (card.multiRack ? 'Racks' : 'Servers');
        const labelLines = wrapServersLabel(labelText.toUpperCase(), w - 24);
        const labelLineH = 13;

        labelLines.forEach(function(line, i) {
            const lblText = document.createElementNS(SVG_NS, 'text');
            lblText.setAttribute('x', String(x + w / 2));
            lblText.setAttribute('y', String(sectionY + 13 + i * labelLineH));
            lblText.setAttribute('fill', 'var(--text-secondary, #5c6b7a)');
            lblText.setAttribute('font-family', 'Segoe UI, sans-serif');
            lblText.setAttribute('font-size', '11');
            lblText.setAttribute('font-weight', '600');
            lblText.setAttribute('text-anchor', 'middle');
            lblText.setAttribute('letter-spacing', '0.06em');
            lblText.textContent = line;
            svg.appendChild(lblText);
        });

        const serverY = sectionY + sectionLabelH + Math.max(0, labelLines.length - 1) * labelLineH;
        card.servers.forEach(function(s, i) {
            appendServerPill(svg, SVG_NS, x + 16, serverY + i * (pillH + pillGap), w - 32, pillH, s, !!card.multiRack, !!card.showLocalDisks);
        });
    }

    function appendServerPill(svg, SVG_NS, x, y, w, h, label, isRack, showDisks) {
        const r = document.createElementNS(SVG_NS, 'rect');
        r.setAttribute('x', String(x));
        r.setAttribute('y', String(y));
        r.setAttribute('width', String(w));
        r.setAttribute('height', String(h));
        r.setAttribute('rx', '4');
        r.setAttribute('fill', isRack ? '#dbeafe' : '#e6f5ee');
        r.setAttribute('stroke', isRack ? '#7aa6d6' : '#9bd6b8');
        r.setAttribute('stroke-width', '1');
        svg.appendChild(r);

        // Glyph on the left — server (single bar) vs rack (multiple bars).
        const glyphX = x + 10;
        const glyphY = y + h / 2 - 8;
        if (isRack) {
            // 3 stacked horizontal bars to evoke a server rack.
            for (let i = 0; i < 3; i++) {
                const bar = document.createElementNS(SVG_NS, 'rect');
                bar.setAttribute('x', String(glyphX));
                bar.setAttribute('y', String(glyphY + i * 6));
                bar.setAttribute('width', '14');
                bar.setAttribute('height', '4');
                bar.setAttribute('rx', '1');
                bar.setAttribute('fill', '#1f3d6e');
                svg.appendChild(bar);
            }
        } else {
            const bar = document.createElementNS(SVG_NS, 'rect');
            bar.setAttribute('x', String(glyphX));
            bar.setAttribute('y', String(glyphY + 4));
            bar.setAttribute('width', '14');
            bar.setAttribute('height', '8');
            bar.setAttribute('rx', '1');
            bar.setAttribute('fill', '#1f4e3a');
            svg.appendChild(bar);
        }

        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('x', String(x + w / 2 + 8));
        t.setAttribute('y', String(y + h / 2 + 4));
        t.setAttribute('fill', isRack ? '#1f3d6e' : '#1f4e3a');
        t.setAttribute('font-family', 'Segoe UI, sans-serif');
        t.setAttribute('font-size', '12');
        t.setAttribute('text-anchor', 'middle');
        t.textContent = label;
        svg.appendChild(t);

        // Local S2D disks — a small stack of disk platters (mini cylinders) plus an
        // "S2D" label, on the right side of the pill, to clearly indicate Storage
        // Spaces Direct local storage.
        if (showDisks && !isRack) {
            const diskFill = '#1f4e3a';
            const diskStroke = '#0f3a28';
            const diskW = 12;          // platter width
            const diskH = 3;           // platter thickness
            const diskGap = 1;         // gap between platters
            const platters = 3;
            const stackH = platters * diskH + (platters - 1) * diskGap;
            // Reserve room on the right: stack + small gap + "S2D" label (~22px).
            const labelW = 22;
            const stackX = x + w - labelW - diskW - 6;
            const stackY = y + h / 2 - stackH / 2;
            for (let i = 0; i < platters; i++) {
                const platter = document.createElementNS(SVG_NS, 'rect');
                platter.setAttribute('x', String(stackX));
                platter.setAttribute('y', String(stackY + i * (diskH + diskGap)));
                platter.setAttribute('width', String(diskW));
                platter.setAttribute('height', String(diskH));
                platter.setAttribute('rx', '1.5');
                platter.setAttribute('ry', '1.5');
                platter.setAttribute('fill', diskFill);
                platter.setAttribute('stroke', diskStroke);
                platter.setAttribute('stroke-width', '0.5');
                svg.appendChild(platter);
            }
            const lbl = document.createElementNS(SVG_NS, 'text');
            lbl.setAttribute('x', String(stackX + diskW + 3));
            lbl.setAttribute('y', String(y + h / 2 + 3));
            lbl.setAttribute('fill', '#1f4e3a');
            lbl.setAttribute('font-family', 'Segoe UI, sans-serif');
            lbl.setAttribute('font-size', '9');
            lbl.setAttribute('font-weight', '600');
            lbl.textContent = 'S2D';
            svg.appendChild(lbl);
        }
    }

    // ------------------------------------------------------------------
    // PPT export
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // PPT export — explanation slides illustrated with assets harvested
    // from the SPC L300 deck, plus a final slide containing the ODIN-built
    // reference architecture diagram. Honors the diagram light/dark theme
    // (slide background flips to match).
    // ------------------------------------------------------------------

    // Capture the SVG diagram by serialising it and rendering it through an
    // <img> element. This preserves vector crispness and avoids html2canvas's
    // SVG quirks. All <image> href icons are first inlined as data URLs so the
    // standalone SVG (loaded from a Blob URL) can paint them — relative paths
    // would otherwise fail to resolve.
    function captureSvgPng(svgEl, bgColor) {
        if (!svgEl) { return Promise.resolve(null); }
        const widthAttr = parseFloat(svgEl.getAttribute('width')) || svgEl.viewBox.baseVal.width;
        const heightAttr = parseFloat(svgEl.getAttribute('height')) || svgEl.viewBox.baseVal.height;
        if (!widthAttr || !heightAttr) { return Promise.resolve(null); }

        // Clone so we can inline computed text colors (var(--text-primary) won't
        // resolve when the SVG is loaded standalone in an <img>).
        const clone = svgEl.cloneNode(true);
        const themeColors = getThemeSvgColors();
        const textNodes = clone.querySelectorAll('text');
        textNodes.forEach(function(t) {
            const fill = t.getAttribute('fill') || '';
            if (fill.indexOf('--text-primary') >= 0) {
                t.setAttribute('fill', themeColors.textPrimary);
            } else if (fill.indexOf('--text-secondary') >= 0) {
                t.setAttribute('fill', themeColors.textSecondary);
            }
        });
        const linelike = clone.querySelectorAll('line, path, rect');
        linelike.forEach(function(n) {
            const stroke = n.getAttribute('stroke') || '';
            if (stroke.indexOf('--text-secondary') >= 0) { n.setAttribute('stroke', themeColors.textSecondary); }
            const color = n.getAttribute('color') || '';
            if (color.indexOf('--text-secondary') >= 0) { n.setAttribute('color', themeColors.textSecondary); }
        });
        const groups = clone.querySelectorAll('g');
        groups.forEach(function(g) {
            const color = g.getAttribute('color') || '';
            if (color.indexOf('--text-secondary') >= 0) { g.setAttribute('color', themeColors.textSecondary); }
        });
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // Inline every <image> href as a data URL so the rendered SVG paints
        // workload icons, PaaS service tiles, and the cluster badge.
        const imageEls = Array.prototype.slice.call(clone.querySelectorAll('image'));
        const xlinkNs = 'http://www.w3.org/1999/xlink';
        const inlinePromises = imageEls.map(function(img) {
            const href = img.getAttribute('href') || img.getAttributeNS(xlinkNs, 'href');
            if (!href || href.indexOf('data:') === 0) { return Promise.resolve(); }
            return loadAsDataUrl(href).then(function(dataUrl) {
                if (!dataUrl) { return; }
                img.setAttribute('href', dataUrl);
                img.setAttributeNS(xlinkNs, 'href', dataUrl);
            }).catch(function() { /* ignore single icon failure */ });
        });

        return Promise.all(inlinePromises).then(function() {
            const xml = new XMLSerializer().serializeToString(clone);
            const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            return new Promise(function(resolve) {
                const img = new Image();
                img.onload = function() {
                    const scale = 2;
                    const c = document.createElement('canvas');
                    c.width = Math.round(widthAttr * scale);
                    c.height = Math.round(heightAttr * scale);
                    const ctx = c.getContext('2d');
                    if (bgColor) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, c.width, c.height); }
                    ctx.drawImage(img, 0, 0, c.width, c.height);
                    URL.revokeObjectURL(url);
                    resolve({ dataUrl: c.toDataURL('image/png'), width: c.width, height: c.height });
                };
                img.onerror = function(e) {
                    console.warn('SVG capture failed', e);
                    URL.revokeObjectURL(url);
                    resolve(null);
                };
                img.src = url;
            });
        });
    }

    // Cache + fetch a same-origin asset and return a data URL.
    const dataUrlCache = {};
    function loadAsDataUrl(url) {
        if (dataUrlCache[url]) { return Promise.resolve(dataUrlCache[url]); }
        return fetch(url).then(function(r) {
            if (!r.ok) { return null; }
            return r.blob();
        }).then(function(blob) {
            if (!blob) { return null; }
            return new Promise(function(resolve) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    dataUrlCache[url] = reader.result;
                    resolve(reader.result);
                };
                reader.onerror = function() { resolve(null); };
                reader.readAsDataURL(blob);
            });
        }).catch(function() { return null; });
    }

    function getThemeSvgColors() {
        const isLight = getDiagramTheme() === 'light';
        return isLight
            ? { textPrimary: '#1a2733', textSecondary: '#5c6b7a' }
            : { textPrimary: '#ffffff', textSecondary: '#a1a1aa' };
    }

    // ------------------------------------------------------------------
    // PPT export — generates a standalone PPTX from scratch (no external
    // template dependency). The deck contains:
    //   1. Cover slide (title + subtitle + footer + ODIN logo)
    //   2. Diagram slide (the live ODIN diagram captured as a PNG)
    //   3. Summary slide (connectivity + per-purpose cluster breakdown)
    //   4..N. One detail slide per selected business purpose, with the
    //         user's choices and a short description sourced from the
    //         public Microsoft Learn documentation.
    //
    // Built with JSZip — every part of the OOXML package is generated as a
    // string and zipped at runtime. No bundled .pptx template is shipped.
    // ------------------------------------------------------------------

    // PPTX uses English Metric Units (EMU): 914,400 EMU per inch.
    const EMU_PER_INCH = 914400;
    function emu(inches) { return Math.round(inches * EMU_PER_INCH); }

    // Per-purpose copy used on the detail slides. Sourced from the public
    // Microsoft Learn pages — paraphrased to fit the slide format. Each
    // entry includes a short description and a "Learn more" link that's
    // safe to publish (all Microsoft Learn URLs).
    const PURPOSE_EXPORT_INFO = {
        'azure-local': {
            tagline: 'Core infrastructure for Sovereign Private Cloud',
            paragraphs: [
                'Azure Local provides the compute, storage, networking and lifecycle management layer that all Sovereign Private Cloud workloads run on. Workloads can run as VMs or on Azure Kubernetes Service (AKS) Arc-enabled clusters.',
                'Azure Local can run connected to Azure or in fully disconnected mode, giving you control over data residency, operations and compliance while preserving an Azure-consistent management experience.'
            ],
            learnLabel: 'Learn more: Azure Local for Sovereign Private Cloud',
            learnUrl: 'https://learn.microsoft.com/en-us/azure/azure-local/overview'
        },
        'm365-local': {
            tagline: 'Productivity workloads, on your infrastructure',
            paragraphs: [
                'Microsoft 365 Local lets you run Exchange Server, SharePoint Server and Skype for Business Server on Azure Local infrastructure that you own and manage.',
                'You gain enhanced control over data residency, access and compliance, with an Azure-consistent management experience and a unified control plane. M365 Local supports both hybrid and fully disconnected deployments.'
            ],
            learnLabel: 'Learn more: Microsoft 365 Local on Azure Local',
            learnUrl: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/m365-local/microsoft-365-local-overview'
        },
        'github-enterprise-local': {
            tagline: 'Modern DevSecOps for sovereign environments',
            paragraphs: [
                'GitHub Enterprise Server runs on Azure Local to bring source control, Actions and compliance tooling to regulated and disconnected environments.',
                'Operations stay consistent with the rest of your Azure footprint while keeping code, build outputs and developer activity entirely on-premises.'
            ],
            learnLabel: 'Learn more: Sovereign Private Cloud overview',
            learnUrl: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/overview/sovereign-private-cloud'
        },
        'avd': {
            tagline: 'Cloud-managed VDI, on-premises',
            paragraphs: [
                'Azure Virtual Desktop on Azure Local delivers a fully cloud-managed VDI experience while keeping desktops, applications and user data on infrastructure you operate.',
                'Combine the familiar Azure control plane with on-premises performance, sovereignty and low latency for users in regulated locations.'
            ],
            learnLabel: 'Learn more: Azure Local overview',
            learnUrl: 'https://learn.microsoft.com/en-us/azure/azure-local/overview'
        },
        'foundry-local': {
            tagline: 'AI sovereignty with low-latency inferencing',
            paragraphs: [
                'Foundry Local on Azure Local lets you deploy and run AI models entirely within your Azure Local environment — supporting AI sovereignty, low-latency inference and full control over where data is processed.',
                'Foundry Local integrates with Arc-enabled Kubernetes for familiar Kubernetes-native workflows and supports a Model-as-a-Service (MaaS) approach so you can deploy, manage and consume AI models locally.'
            ],
            learnLabel: 'Learn more: Foundry Local on Azure Local',
            learnUrl: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/foundry-local/what-is-foundry-local-on-azure-local'
        }
    };

    function downloadPptx() {
        if (state.purposes.length === 0) { return; }
        if (typeof JSZip !== 'function') {
            alert('PowerPoint export requires JSZip but it is not loaded.');
            return;
        }

        const btn = document.getElementById('download-pptx');
        const originalLabel = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<span aria-hidden="true">⏳</span> Generating PowerPoint…'; }

        const isLight = getDiagramTheme() === 'light';
        const diagramShotBg = isLight ? '#ffffff' : '#000000';

        const diagramSvg = document.querySelector('#preview-canvas svg');
        const diagramPromise = captureSvgPng(diagramSvg, diagramShotBg);
        const logoPromise = loadAsArrayBuffer('../../images/odin-logo.png');

        // Collect every icon URL referenced anywhere in the deck and load
        // them as PNG ArrayBuffers up front (rasterizing SVGs via canvas).
        const iconUrlsSet = {};
        state.purposes.forEach(function(pid) { iconUrlsSet[getPurposeIcon(pid)] = true; });
        const cpServices = state.connectivity === 'disconnected'
            ? CONTROL_PLANE_DISCONNECTED_SERVICES
            : CONTROL_PLANE_CONNECTED_SERVICES;
        cpServices.forEach(function(s) { iconUrlsSet[s.icon] = true; });
        const heroIconUrl = state.connectivity === 'disconnected'
            ? CONTROL_PLANE_HERO_DISCONNECTED
            : CONTROL_PLANE_HERO_CONNECTED;
        iconUrlsSet[heroIconUrl] = true;
        const iconUrls = Object.keys(iconUrlsSet);
        const iconPromises = iconUrls.map(function(u) {
            return loadIconAsPng(u).then(function(buf) { return { url: u, buf: buf }; })
                .catch(function() { return { url: u, buf: null }; });
        });

        Promise.all([diagramPromise, logoPromise, Promise.all(iconPromises)]).then(function(all) {
            const diagShot = all[0];
            const logoBuf = all[1];
            const iconResults = all[2];
            const iconPngs = {};
            iconResults.forEach(function(r) { if (r.buf) { iconPngs[r.url] = r.buf; } });
            const zip = buildPptxFromScratch({
                isLight: isLight,
                coverTitle: buildCoverTitle(),
                coverSubtitle: buildCoverSubtitle(),
                coverFooter: 'Generated by ODIN  ·  ' + buildFootprintNote(),
                diagramTitle: 'Your reference architecture',
                diagramPngBase64: diagShot ? dataUrlToBase64(diagShot.dataUrl) : null,
                diagramWidth: diagShot ? diagShot.width : 0,
                diagramHeight: diagShot ? diagShot.height : 0,
                logoArrayBuffer: logoBuf,
                iconPngs: iconPngs,
                heroIconUrl: heroIconUrl,
                cpServices: cpServices
            });
            return zip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                compression: 'DEFLATE'
            });
        }).then(function(blob) {
            const filename = 'Reference-Architecture-' + state.purposes.join('-') + '-' + dateStamp() + '.pptx';
            triggerDownload(blob, filename);
            if (btn) { btn.disabled = false; btn.innerHTML = originalLabel; }
        }).catch(function(err) {
            console.error('PPTX export failed:', err);
            alert('Sorry, the PowerPoint export failed: ' + (err && err.message ? err.message : err));
            if (btn) { btn.disabled = false; btn.innerHTML = originalLabel; }
        });
    }

    function buildCoverTitle() {
        const titles = state.purposes.map(function(pid) {
            const p = PURPOSES.find(function(x) { return x.id === pid; });
            return p ? p.title : pid;
        });
        return titles.length === 1 ? titles[0] : 'Combined reference architecture';
    }

    function buildCoverSubtitle() {
        const titles = state.purposes.map(function(pid) {
            const p = PURPOSES.find(function(x) { return x.id === pid; });
            return p ? p.title : pid;
        });
        if (titles.length > 1) { return titles.join('  ·  '); }
        const tpl = TEMPLATES[state.purposes[0]];
        return (tpl && tpl.summary) || '';
    }

    // ---- PPTX assembly -----------------------------------------------

    function buildPptxFromScratch(opts) {
        const zip = new JSZip();

        // Map every unique icon URL to a numbered media filename.
        const iconUrls = Object.keys(opts.iconPngs || {});
        const iconUrlToFile = {};
        iconUrls.forEach(function(url, i) {
            iconUrlToFile[url] = 'icon' + (i + 1) + '.png';
        });

        // Per-slide rel-id allocator. rId1 = layout, rId2 = ODIN logo,
        // remaining rIds are assigned in the order each picture is first
        // referenced by that slide's shapes.
        function makeBuilder() {
            const used = []; // [{ url, rid }]
            let nextRid = 3;
            return {
                iconRid: function(url) {
                    let entry = null;
                    for (let i = 0; i < used.length; i++) {
                        if (used[i].url === url) { entry = used[i]; break; }
                    }
                    if (!entry) {
                        entry = { url: url, rid: 'rId' + nextRid++ };
                        used.push(entry);
                    }
                    return entry.rid;
                },
                getUsed: function() { return used; }
            };
        }

        function buildSlideRels(used, includeDiagram) {
            const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
            let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="' + NS_REL + 'slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
                + '<Relationship Id="rId2" Type="' + NS_REL + 'image" Target="../media/odin-logo.png"/>';
            used.forEach(function(u) {
                xml += '<Relationship Id="' + u.rid + '" Type="' + NS_REL + 'image" '
                    + 'Target="../media/' + iconUrlToFile[u.url] + '"/>';
            });
            if (includeDiagram) {
                // Diagram slide does not currently use icons, so rId3 is free.
                xml += '<Relationship Id="rId3" Type="' + NS_REL + 'image" Target="../media/odin-diagram.png"/>';
            }
            xml += '</Relationships>';
            return xml;
        }

        // Build the ordered list of slides:
        //   1. Cover
        //   2. Diagram
        //   3. Control plane (Connected vs Disconnected)
        //   4. Summary (Your selections)
        //   5..N. One per business purpose
        const slideXmlList = [];

        // Cover (no pictures except the logo).
        slideXmlList.push({
            xml: buildCoverSlideXml(opts),
            rels: buildSlideRels([], false)
        });

        // Diagram (no icons; diagram pic uses rId3 directly).
        slideXmlList.push({
            xml: buildDiagramSlideXml(opts),
            rels: buildSlideRels([], !!opts.diagramPngBase64)
        });

        // Control plane.
        {
            const b = makeBuilder();
            const xml = buildControlPlaneSlideXml(opts, b);
            slideXmlList.push({ xml: xml, rels: buildSlideRels(b.getUsed(), false) });
        }

        // Summary.
        {
            const b = makeBuilder();
            const xml = buildSummarySlideXml(opts, b);
            slideXmlList.push({ xml: xml, rels: buildSlideRels(b.getUsed(), false) });
        }

        // Per-purpose detail slides.
        state.purposes.forEach(function(pid) {
            const b = makeBuilder();
            const xml = buildPurposeSlideXml(opts, pid, b);
            slideXmlList.push({ xml: xml, rels: buildSlideRels(b.getUsed(), false) });
        });

        // ---- Static scaffold parts -----------------------------------
        zip.file('[Content_Types].xml', buildContentTypesXml(slideXmlList.length));
        zip.file('_rels/.rels', RELS_ROOT_XML);
        zip.file('ppt/presProps.xml', PRES_PROPS_XML);
        zip.file('ppt/viewProps.xml', VIEW_PROPS_XML);
        zip.file('ppt/theme/theme1.xml', THEME1_XML);
        zip.file('ppt/slideMasters/slideMaster1.xml', SLIDE_MASTER1_XML);
        zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', SLIDE_MASTER1_RELS_XML);
        zip.file('ppt/slideLayouts/slideLayout1.xml', SLIDE_LAYOUT1_XML);
        zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', SLIDE_LAYOUT1_RELS_XML);

        // presentation.xml + its rels
        zip.file('ppt/presentation.xml', buildPresentationXml(slideXmlList.length));
        zip.file('ppt/_rels/presentation.xml.rels', buildPresentationRelsXml(slideXmlList.length));

        // Per-slide files
        slideXmlList.forEach(function(s, i) {
            const n = i + 1;
            zip.file('ppt/slides/slide' + n + '.xml', s.xml);
            zip.file('ppt/slides/_rels/slide' + n + '.xml.rels', s.rels);
        });

        // Embedded media
        zip.file('ppt/media/odin-logo.png', opts.logoArrayBuffer);
        if (opts.diagramPngBase64) {
            zip.file('ppt/media/odin-diagram.png', opts.diagramPngBase64, { base64: true });
        }
        iconUrls.forEach(function(url) {
            zip.file('ppt/media/' + iconUrlToFile[url], opts.iconPngs[url]);
        });

        return zip;
    }

    function buildContentTypesXml(slideCount) {
        let overrides = ''
            + '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
            + '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
            + '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
            + '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
            + '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>'
            + '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>';
        for (let i = 1; i <= slideCount; i++) {
            overrides += '<Override PartName="/ppt/slides/slide' + i + '.xml" '
                + 'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            + '<Default Extension="xml" ContentType="application/xml"/>'
            + '<Default Extension="png" ContentType="image/png"/>'
            + overrides
            + '</Types>';
    }

    function buildPresentationXml(slideCount) {
        let sldIds = '';
        for (let i = 0; i < slideCount; i++) {
            // r:id rId2..rId(N+1) — rId1 is the slide master.
            sldIds += '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 2) + '"/>';
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">'
            + '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
            + '<p:sldIdLst>' + sldIds + '</p:sldIdLst>'
            + '<p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>'
            + '<p:notesSz cx="6858000" cy="9144000"/>'
            + '<p:defaultTextStyle/>'
            + '</p:presentation>';
    }

    function buildPresentationRelsXml(slideCount) {
        let rels = '<Relationship Id="rId1" '
            + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" '
            + 'Target="slideMasters/slideMaster1.xml"/>';
        for (let i = 1; i <= slideCount; i++) {
            rels += '<Relationship Id="rId' + (i + 1) + '" '
                + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" '
                + 'Target="slides/slide' + i + '.xml"/>';
        }
        const themeRid = slideCount + 2;
        const presPropsRid = slideCount + 3;
        const viewPropsRid = slideCount + 4;
        rels += '<Relationship Id="rId' + themeRid + '" '
            + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" '
            + 'Target="theme/theme1.xml"/>';
        rels += '<Relationship Id="rId' + presPropsRid + '" '
            + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" '
            + 'Target="presProps.xml"/>';
        rels += '<Relationship Id="rId' + viewPropsRid + '" '
            + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" '
            + 'Target="viewProps.xml"/>';
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + rels
            + '</Relationships>';
    }

    // ---- Static scaffold parts (theme / master / layout / props) -----

    const RELS_ROOT_XML =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" '
        + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        + 'Target="ppt/presentation.xml"/>'
        + '</Relationships>';

    const PRES_PROPS_XML =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>';

    const VIEW_PROPS_XML =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>';

    // Minimal valid Office theme — required by the OOXML spec. Uses the
    // standard Office 2013+ color/font scheme.
    const THEME1_XML =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">'
        + '<a:themeElements>'
        + '<a:clrScheme name="Office">'
        + '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>'
        + '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
        + '<a:dk2><a:srgbClr val="44546A"/></a:dk2>'
        + '<a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>'
        + '<a:accent1><a:srgbClr val="5B9BD5"/></a:accent1>'
        + '<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>'
        + '<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>'
        + '<a:accent4><a:srgbClr val="FFC000"/></a:accent4>'
        + '<a:accent5><a:srgbClr val="4472C4"/></a:accent5>'
        + '<a:accent6><a:srgbClr val="70AD47"/></a:accent6>'
        + '<a:hlink><a:srgbClr val="0563C1"/></a:hlink>'
        + '<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>'
        + '</a:clrScheme>'
        + '<a:fontScheme name="Office">'
        + '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'
        + '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>'
        + '</a:fontScheme>'
        + '<a:fmtScheme name="Office">'
        + '<a:fillStyleLst>'
        + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
        + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
        + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
        + '</a:fillStyleLst>'
        + '<a:lnStyleLst>'
        + '<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
        + '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
        + '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
        + '</a:lnStyleLst>'
        + '<a:effectStyleLst>'
        + '<a:effectStyle><a:effectLst/></a:effectStyle>'
        + '<a:effectStyle><a:effectLst/></a:effectStyle>'
        + '<a:effectStyle><a:effectLst/></a:effectStyle>'
        + '</a:effectStyleLst>'
        + '<a:bgFillStyleLst>'
        + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
        + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
        + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
        + '</a:bgFillStyleLst>'
        + '</a:fmtScheme>'
        + '</a:themeElements>'
        + '</a:theme>';

    // Minimal slide master — just an empty group + the required clrMap and
    // a single slideLayoutId reference.
    const SLIDE_MASTER1_XML =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        + '<p:cSld>'
        + '<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>'
        + '<p:spTree>'
        + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
        + '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
        + '</p:spTree>'
        + '</p:cSld>'
        + '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" '
        + 'accent1="accent1" accent2="accent2" accent3="accent3" '
        + 'accent4="accent4" accent5="accent5" accent6="accent6" '
        + 'hlink="hlink" folHlink="folHlink"/>'
        + '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
        + '<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>'
        + '</p:sldMaster>';

    const SLIDE_MASTER1_RELS_XML =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" '
        + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" '
        + 'Target="../slideLayouts/slideLayout1.xml"/>'
        + '<Relationship Id="rId2" '
        + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" '
        + 'Target="../theme/theme1.xml"/>'
        + '</Relationships>';

    // Minimal blank slide layout.
    const SLIDE_LAYOUT1_XML =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        + 'type="blank" preserve="1">'
        + '<p:cSld name="Blank">'
        + '<p:spTree>'
        + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
        + '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
        + '</p:spTree>'
        + '</p:cSld>'
        + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'
        + '</p:sldLayout>';

    const SLIDE_LAYOUT1_RELS_XML =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" '
        + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" '
        + 'Target="../slideMasters/slideMaster1.xml"/>'
        + '</Relationships>';

    // ---- Small helpers used by the slide builders --------------------

    function xmlEscape(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function dataUrlToBase64(dataUrl) {
        const i = dataUrl.indexOf(',');
        return i >= 0 ? dataUrl.substring(i + 1) : dataUrl;
    }

    function loadAsArrayBuffer(url) {
        return fetch(url).then(function(r) {
            if (!r.ok) { throw new Error('Failed to load ' + url); }
            return r.arrayBuffer();
        });
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
    }

    // ---- Slide XML builders ------------------------------------------

    // Loads an image (PNG or SVG) by URL, rasterizes it into a 256x256 PNG
    // canvas (preserving aspect ratio with letterboxing) and returns the
    // result as an ArrayBuffer suitable for embedding in the PPTX zip.
    function loadIconAsPng(url) {
        return fetch(url).then(function(r) {
            if (!r.ok) { throw new Error('Failed to fetch ' + url); }
            return r.blob();
        }).then(function(blob) {
            return new Promise(function(resolve, reject) {
                const objUrl = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = function() {
                    // Rasterize at 1024px so the icons stay sharp when scaled
                    // up to fill the hero card on the per-purpose slides.
                    // SVG sources scale cleanly to any size; tiny PNG sources
                    // (e.g. M365 icons at 58x47) are upscaled with smoothing.
                    const size = 1024;
                    const naturalW = img.naturalWidth || size;
                    const naturalH = img.naturalHeight || size;
                    const c = document.createElement('canvas');
                    c.width = size; c.height = size;
                    const ctx = c.getContext('2d');
                    const r = Math.min(size / naturalW, size / naturalH);
                    const w = naturalW * r, h = naturalH * r;
                    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
                    URL.revokeObjectURL(objUrl);
                    c.toBlob(function(out) {
                        if (!out) { reject(new Error('toBlob failed for ' + url)); return; }
                        out.arrayBuffer().then(resolve, reject);
                    }, 'image/png');
                };
                img.onerror = function() {
                    URL.revokeObjectURL(objUrl);
                    reject(new Error('Failed to render icon ' + url));
                };
                img.src = objUrl;
            });
        });
    }

    function buildCoverSlideXml(opts) {
        const bg = opts.isLight ? 'FFFFFF' : '0A0A0F';
        const titleColor = opts.isLight ? '0078D4' : 'FFFFFF';
        const subtitleColor = opts.isLight ? '333333' : 'A1A1AA';
        const footerColor = '7B68EE';
        // Big centered ODIN logo above the title (2.2" square, slide is 13.33" wide).
        const logoSize = 2.2;
        const logoX = (13.33 - logoSize) / 2;
        const shapes = []
            .concat(makePic(2, 'OdinLogo', 'rId2',
                emu(logoX), emu(0.55), emu(logoSize), emu(logoSize)))
            .concat(makeTextBoxSp(3, 'Title', emu(0.6), emu(3.05), emu(12.1), emu(1.0),
                opts.coverTitle, { sz: 4000, bold: true, color: titleColor }))
            .concat(makeTextBoxSp(4, 'Subtitle', emu(0.6), emu(4.2), emu(12.1), emu(1.8),
                opts.coverSubtitle, { sz: 1800, color: subtitleColor }))
            .concat(makeTextBoxSp(5, 'Footer', emu(0.6), emu(6.85), emu(12.1), emu(0.4),
                opts.coverFooter, { sz: 1100, italic: true, color: footerColor }));
        return wrapSlide(shapes, bg);
    }

    function buildDiagramSlideXml(opts) {
        const bg = opts.isLight ? 'FFFFFF' : '0A0A0F';
        const titleColor = opts.isLight ? '0078D4' : 'FFFFFF';
        const shapes = []
            .concat(makeTextBoxSp(2, 'Title', emu(0.4), emu(0.25), emu(11.9), emu(0.55),
                opts.diagramTitle, { sz: 2200, bold: true, color: titleColor }))
            .concat(makeLogoPic(3, 'OdinLogo', 'rId2'));
        if (opts.diagramPngBase64) {
            // Fit-contain the diagram inside a 12.5" x 6.3" box below the title,
            // preserving the captured PNG's aspect ratio so wide multi-cluster
            // diagrams aren't squashed vertically.
            const boxX = 0.4, boxY = 0.95, boxW = 12.5, boxH = 6.3;
            const imgW = opts.diagramWidth || boxW;
            const imgH = opts.diagramHeight || boxH;
            const r = Math.min(boxW / imgW, boxH / imgH);
            const w = imgW * r;
            const h = imgH * r;
            const x = boxX + (boxW - w) / 2;
            const y = boxY + (boxH - h) / 2;
            shapes.push(makePic(4, 'Diagram', 'rId3', emu(x), emu(y), emu(w), emu(h)));
        }
        return wrapSlide(shapes, bg);
    }

    // Visual identity per purpose — accent color used for underlines and
    // accent strips on the per-purpose detail slides. The icon image used
    // on the slide is taken from PURPOSE_ICON_FILE below.
    const PURPOSE_COLOR = {
        'azure-local':              '0078D4',
        'm365-local':               'D83B01',
        'github-enterprise-local':  '24292E',
        'avd':                      '8661C5',
        'foundry-local':            '00BCF2'
    };

    // Icon image used on the cluster row cards and per-purpose hero card.
    // For M365 the docs page uses three icons (Exchange / SharePoint / Skype);
    // we pick Exchange as the single representative icon for the slide.
    const PURPOSE_ICON_FILE = {
        'azure-local':              'icons/sovereign-azure-local-cluster.svg',
        'm365-local':               'icons/sovereign-m365-exchange.png',
        'github-enterprise-local':  'icons/sovereign-github.svg',
        'avd':                      'icons/sovereign-avd.svg',
        'foundry-local':            'icons/azure-ai-foundry.svg'
    };

    function getPurposeColor(purposeId) {
        return PURPOSE_COLOR[purposeId] || '0078D4';
    }
    function getPurposeIcon(purposeId) {
        return PURPOSE_ICON_FILE[purposeId] || 'icons/sovereign-azure-local-cluster.svg';
    }

    // Services rendered as tiles on the Control Plane slide. Each entry has
    // a label and the icon URL used in the tile.
    const CONTROL_PLANE_CONNECTED_SERVICES = [
        { label: 'Azure Arc',                icon: 'icons/sovereign-arc.svg' },
        { label: 'Azure Resource Manager',   icon: 'icons/paas-arm.svg' },
        { label: 'Azure Portal',             icon: 'icons/paas-portal.svg' },
        { label: 'Microsoft Defender',       icon: 'icons/paas-defender.svg' },
        { label: 'Azure Monitor',            icon: 'icons/azure-monitor.svg' },
        { label: 'Azure Policy',             icon: 'icons/paas-policy.svg' }
    ];
    const CONTROL_PLANE_DISCONNECTED_SERVICES = [
        { label: 'ARM (Local)',              icon: 'icons/paas-arm.svg' },
        { label: 'Portal (Local)',           icon: 'icons/paas-portal.svg' },
        { label: 'Key Vault (Local)',        icon: 'icons/paas-keyvault.svg' },
        { label: 'Defender (Local)',         icon: 'icons/paas-defender.svg' },
        { label: 'Monitor (Local)',          icon: 'icons/azure-monitor.svg' },
        { label: 'Update Manager (Local)',   icon: 'icons/paas-policy.svg' }
    ];
    const CONTROL_PLANE_HERO_CONNECTED    = 'icons/sovereign-cloud.png';
    const CONTROL_PLANE_HERO_DISCONNECTED = 'icons/cluster-card-disconnected.png';

    // Summary slide: one row-card per cluster with the actual purpose icon
    // on the left and pill chips for tenancy, scale, storage on the right.
    // (The full Connected vs Disconnected story lives on its own slide now.)
    function buildSummarySlideXml(opts, builder) {
        const isLight = opts.isLight;
        const bg = isLight ? 'FFFFFF' : '0A0A0F';
        const titleColor = isLight ? '0078D4' : 'FFFFFF';
        const headingColor = isLight ? '1F2937' : 'E5E7EB';
        const cardFill = isLight ? 'F4F6FB' : '1A1A24';
        const cardLine = isLight ? 'E5E7EB' : '2D2D3A';
        const accentPurple = '7B68EE';

        const shapes = [];
        let id = 2;

        // ---- Title + accent underline + logo --------------------------
        shapes.push(makeTextBoxSp(id++, 'Title', emu(0.4), emu(0.25), emu(10), emu(0.6),
            'Your selections', { sz: 2800, bold: true, color: titleColor })[0]);
        shapes.push(makeShape({
            id: id++, name: 'TitleAccent', prst: 'rect',
            x: emu(0.4), y: emu(0.92), cx: emu(1.4), cy: emu(0.06),
            fillHex: '0078D4'
        }));
        shapes.push(makeLogoPic(id++, 'OdinLogo', 'rId2'));

        // ---- Subtitle line summarising the selection ------------------
        const isDisc = state.connectivity === 'disconnected';
        const subtitle = (isDisc ? 'Disconnected (air-gapped) operations' : 'Connected to Azure')
            + '  ·  ' + state.purposes.length + ' cluster'
            + (state.purposes.length === 1 ? '' : 's')
            + ' in this reference architecture';
        shapes.push(makeTextBoxSp(id++, 'Subtitle', emu(0.4), emu(1.1),
            emu(12), emu(0.4),
            subtitle,
            { sz: 1300, italic: true, color: accentPurple })[0]);

        // ---- Cluster row cards ---------------------------------------
        const purposes = state.purposes;
        const rowH = 0.85;
        const rowGap = 0.18;
        const rowStartY = 1.85;
        const iconBoxFill = isLight ? 'FFFFFF' : '0F0F18';
        purposes.forEach(function(pid, i) {
            const p = PURPOSES.find(function(x) { return x.id === pid; });
            const accent = getPurposeColor(pid);
            const tenancy = getTenancyFor(pid);
            const scales = getScalesFor(pid);
            const scaleOpts = getScaleOptionsFor(p);
            const scaleLabels = scales.map(function(sid) {
                const it = scaleOpts.find(function(o) { return o.id === sid; });
                return it ? it.title : sid;
            }).join(' + ');
            const storage = formatStorageForSummary(pid, scales);
            const ry = rowStartY + i * (rowH + rowGap);

            // Card background
            shapes.push(makeShape({
                id: id++, name: 'Row' + i + 'Bg', prst: 'roundRect', adj: 12000,
                x: emu(0.4), y: emu(ry), cx: emu(12.55), cy: emu(rowH),
                fillHex: cardFill, lineHex: cardLine, lineW: 6350, shadow: true
            }));
            // Left accent strip in the purpose color
            shapes.push(makeShape({
                id: id++, name: 'Row' + i + 'Strip', prst: 'rect',
                x: emu(0.4), y: emu(ry), cx: emu(0.12), cy: emu(rowH),
                fillHex: accent
            }));
            // Icon — soft rounded backdrop + actual icon picture
            const iconBoxX = 0.65, iconBoxSize = 0.65;
            shapes.push(makeShape({
                id: id++, name: 'Row' + i + 'IconBg', prst: 'roundRect', adj: 25000,
                x: emu(iconBoxX), y: emu(ry + (rowH - iconBoxSize) / 2),
                cx: emu(iconBoxSize), cy: emu(iconBoxSize),
                fillHex: iconBoxFill, lineHex: cardLine, lineW: 3175
            }));
            shapes.push(makePic(id++, 'Row' + i + 'Icon', builder.iconRid(getPurposeIcon(pid)),
                emu(iconBoxX + 0.07), emu(ry + (rowH - iconBoxSize) / 2 + 0.07),
                emu(iconBoxSize - 0.14), emu(iconBoxSize - 0.14)));
            // Cluster title
            shapes.push(makeTextBoxSp(id++, 'Row' + i + 'Title',
                emu(1.5), emu(ry + 0.22), emu(3.4), emu(0.45),
                p ? p.title : pid,
                { sz: 1400, bold: true, color: headingColor })[0]);
            // Pills — tenancy / scale / storage
            shapes.push(makePill(id++, 'Row' + i + 'TenancyPill',
                emu(4.95), emu(ry + 0.25), emu(1.5), emu(0.36),
                (tenancy ? capitalizeWord(tenancy) : 'not set'),
                accentPurple, 'FFFFFF'));
            shapes.push(makePill(id++, 'Row' + i + 'ScalePill',
                emu(6.6), emu(ry + 0.25), emu(3.5), emu(0.36),
                (scaleLabels || 'not selected'),
                '0078D4', 'FFFFFF'));
            shapes.push(makePill(id++, 'Row' + i + 'StoragePill',
                emu(10.25), emu(ry + 0.25), emu(2.65), emu(0.36),
                storage,
                '16A085', 'FFFFFF'));
        });

        // ---- Footer ---------------------------------------------------
        shapes.push(makeTextBoxSp(id++, 'Footer', emu(0.4), emu(7.15),
            emu(12.5), emu(0.3),
            'Source: learn.microsoft.com — Microsoft Sovereign Private Cloud',
            { sz: 1000, italic: true, color: accentPurple })[0]);

        return wrapSlide(shapes, bg);
    }

    // Per-purpose detail slide: hero card with the actual icon + About copy,
    // a row of three stat cards for the user's configuration,
    // and a learn-more pill at the foot of the slide.
    function buildPurposeSlideXml(opts, purposeId, builder) {
        const isLight = opts.isLight;
        const bg = isLight ? 'FFFFFF' : '0A0A0F';
        const titleColor = isLight ? '0078D4' : 'FFFFFF';
        const subtitleColor = '7B68EE';
        const headingColor = isLight ? '1F2937' : 'E5E7EB';
        const bodyColor = isLight ? '4B5563' : 'A1A1AA';
        const cardFill = isLight ? 'F4F6FB' : '1A1A24';
        const cardLine = isLight ? 'E5E7EB' : '2D2D3A';
        const iconBoxFill = isLight ? 'FFFFFF' : '0F0F18';

        const p = PURPOSES.find(function(x) { return x.id === purposeId; });
        const accent = getPurposeColor(purposeId);
        const info = PURPOSE_EXPORT_INFO[purposeId] || {
            tagline: '', paragraphs: [],
            learnLabel: 'Learn more: Sovereign Private Cloud overview',
            learnUrl: 'https://learn.microsoft.com/en-us/azure/azure-sovereign-clouds/private/overview/sovereign-private-cloud'
        };

        const tenancy = getTenancyFor(purposeId);
        const scales = getScalesFor(purposeId);
        const scaleOpts = getScaleOptionsFor(p);
        const scaleLabel = scales.length === 0
            ? 'not selected'
            : scales.map(function(sid) {
                const it = scaleOpts.find(function(o) { return o.id === sid; });
                return it ? it.title : sid;
            }).join('  +  ');
        const storage = formatStorageForSummary(purposeId, scales);

        const shapes = [];
        let id = 2;

        // ---- Title + accent underline (purpose color) + tagline + logo
        shapes.push(makeTextBoxSp(id++, 'Title', emu(0.4), emu(0.25), emu(11.9), emu(0.6),
            p ? p.title : purposeId,
            { sz: 2800, bold: true, color: titleColor })[0]);
        shapes.push(makeShape({
            id: id++, name: 'TitleAccent', prst: 'rect',
            x: emu(0.4), y: emu(0.92), cx: emu(1.4), cy: emu(0.06),
            fillHex: accent
        }));
        shapes.push(makeTextBoxSp(id++, 'Tagline', emu(0.4), emu(1.0), emu(12), emu(0.4),
            info.tagline,
            { sz: 1300, italic: true, color: subtitleColor })[0]);
        shapes.push(makeLogoPic(id++, 'OdinLogo', 'rId2'));

        // ---- Hero card with icon + About copy ------------------------
        const heroX = 0.4, heroY = 1.55, heroW = 12.55, heroH = 2.95;
        shapes.push(makeShape({
            id: id++, name: 'HeroCard', prst: 'roundRect', adj: 10000,
            x: emu(heroX), y: emu(heroY), cx: emu(heroW), cy: emu(heroH),
            fillHex: cardFill, lineHex: cardLine, lineW: 6350, shadow: true
        }));
        // Icon backdrop (rounded square in the purpose accent color)
        // with the actual icon image centered inside it.
        const iconBoxSize = 1.95;
        const iconBoxX = heroX + 0.4;
        const iconBoxY = heroY + (heroH - iconBoxSize) / 2;
        shapes.push(makeShape({
            id: id++, name: 'HeroIconBg', prst: 'roundRect', adj: 18000,
            x: emu(iconBoxX), y: emu(iconBoxY),
            cx: emu(iconBoxSize), cy: emu(iconBoxSize),
            fillHex: iconBoxFill, lineHex: accent, lineW: 12700, shadow: true
        }));
        shapes.push(makePic(id++, 'HeroIcon', builder.iconRid(getPurposeIcon(purposeId)),
            emu(iconBoxX + 0.18), emu(iconBoxY + 0.18),
            emu(iconBoxSize - 0.36), emu(iconBoxSize - 0.36)));
        // About heading + accent underline + body
        const aboutX = heroX + iconBoxSize + 0.85;
        const aboutW = heroW - (iconBoxSize + 1.25);
        shapes.push(makeTextBoxSp(id++, 'AboutHeading', emu(aboutX), emu(heroY + 0.2),
            emu(aboutW), emu(0.4),
            'About', { sz: 1500, bold: true, color: headingColor })[0]);
        shapes.push(makeShape({
            id: id++, name: 'AboutAccent', prst: 'rect',
            x: emu(aboutX), y: emu(heroY + 0.62), cx: emu(0.5), cy: emu(0.04),
            fillHex: accent
        }));
        shapes.push(makeTextBoxSp(id++, 'AboutBody', emu(aboutX), emu(heroY + 0.78),
            emu(aboutW), emu(heroH - 0.95),
            info.paragraphs.join('\n\n'),
            { sz: 1150, color: bodyColor })[0]);

        // ---- Configuration heading + accent --------------------------
        shapes.push(makeTextBoxSp(id++, 'ConfigHeading', emu(0.4), emu(4.75),
            emu(12), emu(0.4),
            'Your configuration', { sz: 1500, bold: true, color: headingColor })[0]);
        shapes.push(makeShape({
            id: id++, name: 'ConfigAccent', prst: 'rect',
            x: emu(0.4), y: emu(5.17), cx: emu(0.5), cy: emu(0.04),
            fillHex: accent
        }));

        // ---- Three stat cards: Tenancy / Scale / Storage -------------
        const statY = 5.35;
        const statH = 1.45;
        const statW = 4.05;
        const statGap = 0.20;
        const statX0 = 0.4;
        const statColors = ['7B68EE', '0078D4', '16A085'];
        const statLabels = ['TENANCY', 'SCALE', 'STORAGE'];
        const statValues = [
            tenancy ? capitalizeWord(tenancy) : 'not set',
            scaleLabel,
            storage
        ];
        for (let s = 0; s < 3; s++) {
            const sx = statX0 + s * (statW + statGap);
            shapes.push(makeShape({
                id: id++, name: 'Stat' + s + 'Bg', prst: 'roundRect', adj: 12000,
                x: emu(sx), y: emu(statY), cx: emu(statW), cy: emu(statH),
                fillHex: cardFill, lineHex: cardLine, lineW: 6350, shadow: true
            }));
            shapes.push(makeShape({
                id: id++, name: 'Stat' + s + 'Band', prst: 'rect',
                x: emu(sx + 0.01), y: emu(statY + 0.01),
                cx: emu(statW - 0.02), cy: emu(0.12),
                fillHex: statColors[s]
            }));
            shapes.push(makeTextBoxSp(id++, 'Stat' + s + 'Label',
                emu(sx + 0.25), emu(statY + 0.25), emu(statW - 0.5), emu(0.3),
                statLabels[s],
                { sz: 1000, bold: true, color: statColors[s] })[0]);
            shapes.push(makeShape({
                id: id++, name: 'Stat' + s + 'Value', prst: 'rect',
                x: emu(sx + 0.2), y: emu(statY + 0.55),
                cx: emu(statW - 0.4), cy: emu(statH - 0.7),
                fillHex: null,
                text: statValues[s],
                textProps: { sz: 1500, bold: true, color: headingColor },
                textAnchor: 'ctr', textAlign: 'l'
            }));
        }

        // ---- Learn-more footer pill ----------------------------------
        const learnText = info.learnLabel + '  →  ' + info.learnUrl;
        shapes.push(makeShape({
            id: id++, name: 'LearnPill', prst: 'roundRect', adj: 50000,
            x: emu(0.4), y: emu(7.05), cx: emu(12.55), cy: emu(0.36),
            fillHex: isLight ? 'EEF2FF' : '1F1A33', lineHex: subtitleColor, lineW: 6350,
            text: learnText,
            textProps: { sz: 1000, italic: true, color: subtitleColor },
            textAnchor: 'ctr', textAlign: 'ctr'
        }));

        return wrapSlide(shapes, bg);
    }

    // Control plane slide: visualises whether the deployment runs against
    // the public Azure control plane (Connected) or against a local
    // disconnected control-plane appliance (Disconnected). Shows a hero
    // image plus a 3x2 grid of service tiles using real icons.
    function buildControlPlaneSlideXml(opts, builder) {
        const isLight = opts.isLight;
        const bg = isLight ? 'FFFFFF' : '0A0A0F';
        const titleColor = isLight ? '0078D4' : 'FFFFFF';
        const subtitleColor = '7B68EE';
        const headingColor = isLight ? '1F2937' : 'E5E7EB';
        const bodyColor = isLight ? '4B5563' : 'A1A1AA';
        const cardFill = isLight ? 'F4F6FB' : '1A1A24';
        const cardLine = isLight ? 'E5E7EB' : '2D2D3A';
        const iconBoxFill = isLight ? 'FFFFFF' : '0F0F18';

        const isDisc = state.connectivity === 'disconnected';
        const accent = isDisc ? 'F59E0B' : '00BCF2';
        const title = isDisc
            ? 'Control plane: Disconnected (air-gapped)'
            : 'Control plane: Connected to Azure';
        const tagline = isDisc
            ? 'A 3-node Disconnected Control Plane Appliance hosts a subset of Azure services on-premises'
            : 'Cluster lifecycle and operations managed via the public Azure control plane';
        const heroBody = isDisc
            ? 'Compute, storage, networking and the control plane itself all run entirely on-premises with no requirement to ever connect to Azure. Operators use the local Portal, ARM and supporting services hosted on the appliance — keeping data, identity and management traffic inside the sovereign environment.'
            : 'Your Azure Local clusters report to the public Azure control plane via Arc. Operations like updates, backup, security and monitoring are driven from Azure while the workloads run on your hardware. Clusters stay operational for up to 30 days during connectivity outages and resync automatically.';
        const services = isDisc
            ? CONTROL_PLANE_DISCONNECTED_SERVICES
            : CONTROL_PLANE_CONNECTED_SERVICES;
        const heroIconUrl = isDisc
            ? CONTROL_PLANE_HERO_DISCONNECTED
            : CONTROL_PLANE_HERO_CONNECTED;

        const shapes = [];
        let id = 2;

        // ---- Title + accent + tagline + logo --------------------------
        shapes.push(makeTextBoxSp(id++, 'Title', emu(0.4), emu(0.25), emu(11.9), emu(0.6),
            title, { sz: 2800, bold: true, color: titleColor })[0]);
        shapes.push(makeShape({
            id: id++, name: 'TitleAccent', prst: 'rect',
            x: emu(0.4), y: emu(0.92), cx: emu(1.4), cy: emu(0.06),
            fillHex: accent
        }));
        shapes.push(makeTextBoxSp(id++, 'Tagline', emu(0.4), emu(1.0), emu(12), emu(0.4),
            tagline, { sz: 1300, italic: true, color: subtitleColor })[0]);
        shapes.push(makeLogoPic(id++, 'OdinLogo', 'rId2'));

        // ---- Hero card -----------------------------------------------
        const heroX = 0.4, heroY = 1.55, heroW = 12.55, heroH = 2.05;
        shapes.push(makeShape({
            id: id++, name: 'HeroCard', prst: 'roundRect', adj: 10000,
            x: emu(heroX), y: emu(heroY), cx: emu(heroW), cy: emu(heroH),
            fillHex: cardFill, lineHex: cardLine, lineW: 6350, shadow: true
        }));
        // Hero icon backdrop + image
        const heroIconSize = 1.45;
        const heroIconX = heroX + 0.3;
        const heroIconY = heroY + (heroH - heroIconSize) / 2;
        shapes.push(makeShape({
            id: id++, name: 'HeroIconBg', prst: 'roundRect', adj: 18000,
            x: emu(heroIconX), y: emu(heroIconY),
            cx: emu(heroIconSize), cy: emu(heroIconSize),
            fillHex: iconBoxFill, lineHex: accent, lineW: 12700, shadow: true
        }));
        shapes.push(makePic(id++, 'HeroIcon', builder.iconRid(heroIconUrl),
            emu(heroIconX + 0.15), emu(heroIconY + 0.15),
            emu(heroIconSize - 0.30), emu(heroIconSize - 0.30)));
        // Hero body text
        shapes.push(makeTextBoxSp(id++, 'HeroBody',
            emu(heroX + heroIconSize + 0.7), emu(heroY + 0.2),
            emu(heroW - heroIconSize - 1.1), emu(heroH - 0.4),
            heroBody, { sz: 1200, color: bodyColor })[0]);

        // ---- Services section heading --------------------------------
        shapes.push(makeTextBoxSp(id++, 'ServicesHeading',
            emu(0.4), emu(3.85), emu(12), emu(0.4),
            isDisc ? 'Services hosted on the local control plane' : 'Services consumed from Azure',
            { sz: 1500, bold: true, color: headingColor })[0]);
        shapes.push(makeShape({
            id: id++, name: 'ServicesAccent', prst: 'rect',
            x: emu(0.4), y: emu(4.27), cx: emu(0.5), cy: emu(0.04),
            fillHex: accent
        }));

        // ---- 3x2 grid of service tiles -------------------------------
        const tileW = 3.95;
        const tileH = 1.30;
        const tileGapX = 0.20;
        const tileGapY = 0.18;
        const gridX0 = 0.4;
        const gridY0 = 4.45;
        services.slice(0, 6).forEach(function(svc, idx) {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            const tx = gridX0 + col * (tileW + tileGapX);
            const ty = gridY0 + row * (tileH + tileGapY);
            // Tile background
            shapes.push(makeShape({
                id: id++, name: 'Tile' + idx + 'Bg', prst: 'roundRect', adj: 12000,
                x: emu(tx), y: emu(ty), cx: emu(tileW), cy: emu(tileH),
                fillHex: cardFill, lineHex: cardLine, lineW: 6350, shadow: true
            }));
            // Left accent strip
            shapes.push(makeShape({
                id: id++, name: 'Tile' + idx + 'Strip', prst: 'rect',
                x: emu(tx), y: emu(ty), cx: emu(0.10), cy: emu(tileH),
                fillHex: accent
            }));
            // Icon backdrop + picture
            const iconSize = 0.85;
            const ix = tx + 0.30;
            const iy = ty + (tileH - iconSize) / 2;
            shapes.push(makeShape({
                id: id++, name: 'Tile' + idx + 'IconBg', prst: 'roundRect', adj: 25000,
                x: emu(ix), y: emu(iy), cx: emu(iconSize), cy: emu(iconSize),
                fillHex: iconBoxFill, lineHex: cardLine, lineW: 3175
            }));
            shapes.push(makePic(id++, 'Tile' + idx + 'Icon', builder.iconRid(svc.icon),
                emu(ix + 0.10), emu(iy + 0.10),
                emu(iconSize - 0.20), emu(iconSize - 0.20)));
            // Service label
            shapes.push(makeShape({
                id: id++, name: 'Tile' + idx + 'Label', prst: 'rect',
                x: emu(tx + 0.30 + iconSize + 0.20),
                y: emu(ty + 0.10),
                cx: emu(tileW - (0.30 + iconSize + 0.30)),
                cy: emu(tileH - 0.20),
                fillHex: null,
                text: svc.label,
                textProps: { sz: 1300, bold: true, color: headingColor },
                textAnchor: 'ctr', textAlign: 'l'
            }));
        });

        // ---- Footer ---------------------------------------------------
        shapes.push(makeTextBoxSp(id++, 'Footer', emu(0.4), emu(7.15),
            emu(12.5), emu(0.3),
            'Source: learn.microsoft.com — Microsoft Sovereign Private Cloud',
            { sz: 1000, italic: true, color: subtitleColor })[0]);

        return wrapSlide(shapes, bg);
    }

    // ------------------------------------------------------------------
    // Generic shape helpers used by the visual slide builders
    // ------------------------------------------------------------------

    // Build an arbitrary preset-geometry shape with optional fill, outline,
    // shadow and inline text. `text` may contain '\n' for paragraph breaks.
    function makeShape(o) {
        const adj = (o.prst === 'roundRect' && o.adj != null)
            ? '<a:avLst><a:gd name="adj" fmla="val ' + o.adj + '"/></a:avLst>'
            : '<a:avLst/>';
        const fill = o.fillHex
            ? '<a:solidFill><a:srgbClr val="' + o.fillHex + '"/></a:solidFill>'
            : '<a:noFill/>';
        const ln = o.lineHex
            ? '<a:ln w="' + (o.lineW || 6350) + '"><a:solidFill><a:srgbClr val="' + o.lineHex + '"/></a:solidFill></a:ln>'
            : '<a:ln><a:noFill/></a:ln>';
        const effects = o.shadow
            ? '<a:effectLst><a:outerShdw blurRad="50000" dist="20000" dir="5400000" algn="t" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw></a:effectLst>'
            : '<a:effectLst/>';

        let txBody;
        if (o.text != null) {
            const tp = o.textProps || {};
            const anchor = o.textAnchor || 'ctr';
            const algn = o.textAlign || 'ctr';
            const rPrAttrs = ['lang="en-US"', 'sz="' + (tp.sz || 1200) + '"',
                tp.bold ? 'b="1"' : '', tp.italic ? 'i="1"' : '']
                .filter(Boolean).join(' ');
            const tfill = '<a:solidFill><a:srgbClr val="' + (tp.color || '000000') + '"/></a:solidFill>';
            const latin = '<a:latin typeface="Segoe UI"/>';
            const paras = String(o.text).split('\n').map(function(line) {
                return '<a:p><a:pPr algn="' + algn + '"/><a:r><a:rPr ' + rPrAttrs + '>'
                    + tfill + latin + '</a:rPr><a:t>' + xmlEscape(line) + '</a:t></a:r></a:p>';
            }).join('');
            txBody = '<p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="' + anchor
                + '" lIns="45720" rIns="45720" tIns="22860" bIns="22860"/>'
                + '<a:lstStyle/>' + paras + '</p:txBody>';
        } else {
            txBody = '<p:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="ctr"/>'
                + '<a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>';
        }

        return '<p:sp>'
            + '<p:nvSpPr>'
            + '<p:cNvPr id="' + o.id + '" name="' + xmlEscape(o.name) + '"/>'
            + '<p:cNvSpPr/>'
            + '<p:nvPr/>'
            + '</p:nvSpPr>'
            + '<p:spPr>'
            + '<a:xfrm><a:off x="' + o.x + '" y="' + o.y + '"/><a:ext cx="' + o.cx + '" cy="' + o.cy + '"/></a:xfrm>'
            + '<a:prstGeom prst="' + (o.prst || 'rect') + '">' + adj + '</a:prstGeom>'
            + fill + ln + effects
            + '</p:spPr>'
            + txBody
            + '</p:sp>';
    }

    // Small fully-rounded "pill" badge used for tenancy / scale / storage chips.
    function makePill(id, name, x, y, cx, cy, label, fillHex, textHex) {
        return makeShape({
            id: id, name: name, prst: 'roundRect', adj: 50000,
            x: x, y: y, cx: cx, cy: cy,
            fillHex: fillHex,
            text: label,
            textProps: { sz: 1000, bold: true, color: textHex },
            textAnchor: 'ctr', textAlign: 'ctr'
        });
    }

    function formatStorageForSummary(purposeId, scales) {
        if (!scales || !scales.length) { return 'not set'; }
        // Cluster-64/128 is SAN-only; M365 small/large is S2D-only.
        const has64Plus = scales.indexOf('cluster-64') >= 0 || scales.indexOf('cluster-128') >= 0;
        const isM365 = scales.indexOf('m365-small') >= 0 || scales.indexOf('m365-large') >= 0;
        if (has64Plus && !isM365) { return 'SAN (required at this scale)'; }
        if (isM365) { return 'S2D (local)'; }
        return storageLabelFor(scales[0], getStorageFor(purposeId));
    }

    function storageLabelFor(scaleId, storedChoice) {
        if (scaleId === 'cluster-64' || scaleId === 'cluster-128') { return 'SAN (required)'; }
        if (scaleId === 'm365-small' || scaleId === 'm365-large') { return 'S2D (local)'; }
        if (storedChoice === 'san') { return 'SAN'; }
        if (storedChoice === 'both') { return 'S2D + SAN'; }
        return 'S2D (local)';
    }

    function capitalizeWord(s) {
        if (!s) { return ''; }
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function wrapSlide(shapeXmlList, bgHex) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            + '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
            + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            + '<p:cSld>'
            + '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="' + bgHex + '"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'
            + '<p:spTree>'
            + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
            + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'
            + '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
            + shapeXmlList.join('')
            + '</p:spTree>'
            + '</p:cSld>'
            + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'
            + '</p:sld>';
    }

    // Returns a single-shape XML string for a text box. `text` may contain
    // newlines which become separate <a:p> paragraphs.
    function makeTextBoxSp(id, name, x, y, cx, cy, text, runProps) {
        const rp = runProps || {};
        const rPrAttrs = ['lang="en-US"', 'sz="' + (rp.sz || 1800) + '"',
            rp.bold ? 'b="1"' : '', rp.italic ? 'i="1"' : '']
            .filter(Boolean).join(' ');
        const fill = '<a:solidFill><a:srgbClr val="' + (rp.color || '000000') + '"/></a:solidFill>';
        const latin = '<a:latin typeface="Segoe UI"/>';
        const paragraphs = String(text || ' ').split('\n').map(function(line) {
            return '<a:p><a:pPr algn="l"/><a:r><a:rPr ' + rPrAttrs + '>'
                + fill + latin + '</a:rPr>'
                + '<a:t>' + xmlEscape(line) + '</a:t></a:r></a:p>';
        }).join('');
        return [
            '<p:sp>'
            + '<p:nvSpPr>'
            + '<p:cNvPr id="' + id + '" name="' + xmlEscape(name) + '"/>'
            + '<p:cNvSpPr txBox="1"/>'
            + '<p:nvPr/>'
            + '</p:nvSpPr>'
            + '<p:spPr>'
            + '<a:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>'
            + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
            + '<a:noFill/>'
            + '</p:spPr>'
            + '<p:txBody>'
            + '<a:bodyPr wrap="square" rtlCol="0" anchor="t"/>'
            + '<a:lstStyle/>'
            + paragraphs
            + '</p:txBody>'
            + '</p:sp>'
        ];
    }

    // ODIN logo top-right, 0.6" x 0.6".
    function makeLogoPic(id, name, rid) {
        return makePic(id, name, rid, emu(12.55), emu(0.18), emu(0.6), emu(0.6));
    }

    function makePic(id, name, rid, x, y, cx, cy) {
        return '<p:pic>'
            + '<p:nvPicPr>'
            + '<p:cNvPr id="' + id + '" name="' + xmlEscape(name) + '"/>'
            + '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>'
            + '<p:nvPr/>'
            + '</p:nvPicPr>'
            + '<p:blipFill>'
            + '<a:blip r:embed="' + rid + '"/>'
            + '<a:stretch><a:fillRect/></a:stretch>'
            + '</p:blipFill>'
            + '<p:spPr>'
            + '<a:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>'
            + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
            + '</p:spPr>'
            + '</p:pic>';
    }


    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function dateStamp() {
        const d = new Date();
        const pad = function(n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    }

    // ------------------------------------------------------------------
    // Init
    // ------------------------------------------------------------------

    function init() {
        renderPurposeGrid();
        renderConnectivityGrid();
        renderTenancyPerPurpose();
        renderScalePerPurpose();
        renderSelectionSummary();
        updatePreview();

        const btn = document.getElementById('download-pptx');
        if (btn) { btn.addEventListener('click', downloadPptx); }
        wireZoomControls();
        wireThemeToggle();
    }

    // ------------------------------------------------------------------
    // Diagram theme (dark / light) — toggles a class on the preview canvas
    // which overrides --text-primary / --text-secondary so SVG text contrasts
    // on the white background. Persisted via localStorage.
    // ------------------------------------------------------------------

    const THEME_KEY = 'odin.refarch.diagramTheme';

    function getDiagramTheme() {
        try {
            const v = localStorage.getItem(THEME_KEY);
            return v === 'light' ? 'light' : 'dark';
        } catch (_e) { return 'dark'; }
    }
    function setDiagramTheme(theme) {
        try { localStorage.setItem(THEME_KEY, theme); } catch (_e) { /* ignore */ }
        applyDiagramTheme();
    }
    function applyDiagramTheme() {
        const canvas = document.getElementById('preview-canvas');
        const btn = document.getElementById('preview-theme-toggle');
        const theme = getDiagramTheme();
        if (canvas) { canvas.classList.toggle('diagram-light', theme === 'light'); }
        if (btn) {
            const isLight = theme === 'light';
            btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
            btn.innerHTML = isLight
                ? '<span aria-hidden="true">🌙</span> Dark theme'
                : '<span aria-hidden="true">☀</span> Light theme';
        }
    }
    function wireThemeToggle() {
        const btn = document.getElementById('preview-theme-toggle');
        if (!btn) { return; }
        btn.addEventListener('click', function() {
            setDiagramTheme(getDiagramTheme() === 'light' ? 'dark' : 'light');
        });
        applyDiagramTheme();
    }

    // ------------------------------------------------------------------
    // Preview zoom
    // ------------------------------------------------------------------

    let zoomLevel = 1;
    const ZOOM_MIN = 0.4;
    const ZOOM_MAX = 2.5;
    const ZOOM_STEP = 0.15;

    function setZoom(next) {
        zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
        applyZoom();
    }

    function applyZoom() {
        const canvas = document.getElementById('preview-canvas');
        const levelEl = document.getElementById('preview-zoom-level');
        if (!canvas) { return; }
        const svg = canvas.querySelector('svg');
        if (svg) {
            const baseW = parseFloat(svg.dataset.baseWidth || svg.getAttribute('width') || '0');
            const baseH = parseFloat(svg.dataset.baseHeight || svg.getAttribute('height') || '0');
            if (!svg.dataset.baseWidth) {
                svg.dataset.baseWidth = String(baseW);
                svg.dataset.baseHeight = String(baseH);
            }
            const w = Math.round(baseW * zoomLevel);
            const h = Math.round(baseH * zoomLevel);
            svg.setAttribute('width', String(w));
            svg.setAttribute('height', String(h));
            // Inline styles are required because the SVG sits in a flex container that
            // would otherwise shrink it to the container width.
            svg.style.width = w + 'px';
            svg.style.height = h + 'px';
            svg.style.minWidth = w + 'px';
            svg.style.flex = '0 0 auto';
        }
        if (levelEl) { levelEl.textContent = Math.round(zoomLevel * 100) + '%'; }
    }

    function fitToWidth() {
        const wrapper = document.querySelector('.preview-canvas-wrapper');
        const canvas = document.getElementById('preview-canvas');
        if (!wrapper || !canvas) { return; }
        const svg = canvas.querySelector('svg');
        if (!svg) { return; }
        const baseW = parseFloat(svg.dataset.baseWidth || svg.getAttribute('width') || '0');
        if (!baseW) { return; }
        // Account for wrapper padding (24px each side) and the toolbar margin already in flow.
        const available = wrapper.clientWidth - 48;
        if (available <= 0) { return; }
        setZoom(available / baseW);
    }

    // Auto-fit on render: scale the diagram so it fits the visible width without
    // upscaling beyond 100%. Deferred via rAF so the wrapper has a settled layout
    // width (otherwise reading clientWidth right after innerHTML='' can return a
    // stale value influenced by the previous SVG's natural size).
    function autoFitZoom() {
        const run = function() {
            const wrapper = document.querySelector('.preview-canvas-wrapper');
            const canvas = document.getElementById('preview-canvas');
            if (!wrapper || !canvas) { applyZoom(); return; }
            const svg = canvas.querySelector('svg');
            if (!svg) { applyZoom(); return; }
            const baseW = parseFloat(svg.dataset.baseWidth || svg.getAttribute('width') || '0');
            if (!baseW) { applyZoom(); return; }
            // Use the parent .preview-card's inner width as the authoritative visible
            // width — wrapper.clientWidth can be inflated by its own scroll content
            // before reflow settles.
            const card = wrapper.parentElement;
            const containerW = card ? card.clientWidth : wrapper.clientWidth;
            const available = containerW - 48; // 24px wrapper padding each side
            if (available <= 0) { applyZoom(); return; }
            const fit = available / baseW;
            // Cap at 1.0 so small diagrams don't render larger than designed.
            setZoom(Math.min(1, fit));
        };
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(run);
        } else {
            run();
        }
    }

    function wireZoomControls() {
        const inBtn = document.getElementById('preview-zoom-in');
        const outBtn = document.getElementById('preview-zoom-out');
        const resetBtn = document.getElementById('preview-zoom-reset');
        const fitBtn = document.getElementById('preview-zoom-fit');
        if (inBtn) { inBtn.addEventListener('click', function() { setZoom(zoomLevel + ZOOM_STEP); }); }
        if (outBtn) { outBtn.addEventListener('click', function() { setZoom(zoomLevel - ZOOM_STEP); }); }
        if (resetBtn) { resetBtn.addEventListener('click', function() { setZoom(1); }); }
        if (fitBtn) { fitBtn.addEventListener('click', fitToWidth); }
        const wrapper = document.querySelector('.preview-canvas-wrapper');
        if (wrapper) {
            wrapper.addEventListener('wheel', function(e) {
                if (!e.ctrlKey) { return; }
                e.preventDefault();
                setZoom(zoomLevel + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
            }, { passive: false });
        }
        // Re-auto-fit on window resize so the diagram tracks viewport changes.
        let resizeTimer = null;
        window.addEventListener('resize', function() {
            if (resizeTimer) { clearTimeout(resizeTimer); }
            resizeTimer = setTimeout(autoFitZoom, 120);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for tests / debugging
    window.OdinReferenceArchitectures = {
        PURPOSES: PURPOSES,
        TEMPLATES: TEMPLATES,
        CONNECTIVITY: CONNECTIVITY,
        TENANCY: TENANCY,
        SCALE: SCALE,
        getState: function() { return Object.assign({}, state); },
        setState: function(next) {
            if (next.purposes !== undefined) {
                state.purposes = Array.isArray(next.purposes) ? next.purposes.slice() : [];
            } else if (next.purpose !== undefined) {
                state.purposes = next.purpose ? [next.purpose] : [];
            }
            if (next.connectivity !== undefined) { state.connectivity = next.connectivity; }
            if (next.tenancyByPurpose !== undefined) {
                state.tenancyByPurpose = Object.assign({}, next.tenancyByPurpose);
            } else if (next.tenancy !== undefined) {
                // Back-compat: a single global tenancy now gets applied to every selected purpose.
                state.purposes.forEach(function(pid) { state.tenancyByPurpose[pid] = next.tenancy; });
            }
            if (next.scaleByPurpose !== undefined) {
                state.scaleByPurpose = {};
                Object.keys(next.scaleByPurpose).forEach(function(k) {
                    const v = next.scaleByPurpose[k];
                    state.scaleByPurpose[k] = Array.isArray(v) ? v.slice() : (v ? [v] : []);
                });
            } else if (next.scale !== undefined) {
                // Back-compat: a single global scale list now gets applied to every selected purpose.
                const arr = Array.isArray(next.scale) ? next.scale.slice() : (next.scale ? [next.scale] : []);
                state.purposes.forEach(function(pid) { state.scaleByPurpose[pid] = arr.slice(); });
            }
            refreshSelections();
            renderTenancyPerPurpose();
            renderScalePerPurpose();
            updatePreview();
        },
        downloadPptx: downloadPptx
    };
})();
