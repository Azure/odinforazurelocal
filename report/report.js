(function() {
    // Expose a minimal API for report.html buttons.
    window.downloadReportHtml = downloadReportHtml;
    window.downloadReportWord = downloadReportWord;
    window.downloadReportMarkdown = downloadReportMarkdown;
    window.downloadHostNetworkingDiagramSvg = downloadHostNetworkingDiagramSvg;
    window.downloadOutboundConnectivityDiagramSvg = downloadOutboundConnectivityDiagramSvg;
    window.downloadHostNetworkingDrawio = downloadHostNetworkingDrawio;
    window.downloadOutboundConnectivityDrawio = downloadOutboundConnectivityDrawio;
    window.openDiagramZoom = openDiagramZoom;
    window.togglePrintFriendly = togglePrintFriendly;

    // Internals exposed for pptx-export.js (kept under __odin* prefix to mark as internal).
    window.__odinGetReportState = function() { return CURRENT_REPORT_STATE; };
    window.__odinSvgElementToPng = function(svgEl, opts) { return svgElementToPngDataUrl(svgEl, opts); };
    // Expose the private-endpoint reference data and the proxy-bypass helpers
    // so external callers (e.g., the PPTX exporter) can mirror what the
    // rendered report shows without scraping the DOM. Bound at module init
    // below once these symbols are defined.
    window.__odinGetPrivateEndpointInfo = function() { return null; };
    window.__odinBuildProxyBypassList = function() { return []; };

    var CURRENT_REPORT_STATE = null;

    // Firewall allow-list endpoint URLs per region (consolidated lists from GitHub)
    const FIREWALL_ENDPOINT_URLS = {
        east_us: { label: 'East US', url: 'https://github.com/Azure/AzureStack-Tools/blob/master/HCI/EastUSendpoints/eastus-hci-endpoints.md' },
        south_central_us: { label: 'South Central US', url: 'https://github.com/Azure/AzureStack-Tools/blob/master/HCI/SouthCentralUSEndpoints/southcentralus-hci-endpoints.md' },
        west_europe: { label: 'West Europe', url: 'https://github.com/Azure/AzureStack-Tools/blob/master/HCI/WestEuropeendpoints/westeurope-hci-endpoints.md' },
        australia_east: { label: 'Australia East', url: 'https://github.com/Azure/AzureStack-Tools/blob/master/HCI/AustraliaEastendpoints/AustraliaEast-hci-endpoints.md' },
        southeast_asia: { label: 'Southeast Asia', url: 'https://github.com/Azure/AzureStack-Tools/blob/master/HCI/SouthEastAsiaEndpoints/southeastasia-hci-endpoints.md' },
        india_central: { label: 'Central India', url: 'https://github.com/Azure/AzureStack-Tools/blob/master/HCI/IndiaCentralEndpoints/IndiaCentral-hci-endpoints.md' },
        canada_central: { label: 'Canada Central', url: 'https://github.com/Azure/AzureStack-Tools/blob/master/HCI/CanadaCentralEndpoints/canadacentral-hci-endpoints.md' },
        japan_east: { label: 'Japan East', url: 'https://github.com/Azure/AzureStack-Tools/blob/master/HCI/JapanEastEndpoints/japaneast-hci-endpoints.md' },
        us_gov_virginia: { label: 'US Gov Virginia', url: 'https://github.com/CristianEdwards/AzureStack-Tools/blob/master/HCI/usgovvirginia-hci-endpoints/usgovvirginia-hci-endpoints.md' }
    };
    const ARC_GATEWAY_ENDPOINTS_URL = 'https://learn.microsoft.com/en-us/azure/azure-local/deploy/deployment-azure-arc-gateway-overview?tabs=portal#azure-local-endpoints-not-redirected';

    // Returns { label, url } for the firewall allow-list link based on Arc Gateway and region
    function getFirewallEndpointInfo(s) {
        if (s.arc === 'arc_gateway') {
            return {
                label: 'Azure Local endpoints not redirected via Arc Gateway',
                url: ARC_GATEWAY_ENDPOINTS_URL
            };
        }
        const regionInfo = FIREWALL_ENDPOINT_URLS[s.localInstanceRegion];
        if (regionInfo) {
            return {
                label: 'Consolidated endpoint list for ' + regionInfo.label + ' (Azure Local, Arc-enabled servers, ARB, AKS)',
                url: regionInfo.url
            };
        }
        // Fallback to the general firewall requirements page
        return {
            label: 'Azure Local firewall requirements',
            url: 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/firewall-requirements'
        };
    }
    let isPrintFriendly = false;

    // Outbound connectivity diagram URLs - use local files from docs folder
    const OUTBOUND_DIAGRAMS = {
        // Public Path diagrams
        'public_no_proxy_no_arc': '../docs/outbound-connectivity/images/public-path-no-proxy-no-arc-gateway.svg',
        'public_proxy_no_arc': '../docs/outbound-connectivity/images/public-path-proxy-no-arc-gateway.svg',
        'public_no_proxy_arc': '../docs/outbound-connectivity/images/public-path-no-proxy-with-arc-gateway.svg',
        'public_proxy_arc': '../docs/outbound-connectivity/images/public-path-with-proxy-and-arc-gateway.svg',
        // Private Path diagram
        'private': '../docs/outbound-connectivity/images/private-path-explicit-proxy-and-arc-gateway.svg',
        // Disconnected Operations diagrams
        'disconnected_fullyconverged_limited': '../docs/disconnected-operations/aldo-fullyconverged-limited-connectivity.svg',
        'disconnected_fullyconverged_airgapped': '../docs/disconnected-operations/aldo-fullyconverged-air-gapped.svg',
        'disconnected_disaggregated_limited': '../docs/disconnected-operations/aldo-disaggregated-limited-connectivity.svg',
        'disconnected_disaggregated_airgapped': '../docs/disconnected-operations/aldo-disaggregated-air-gapped.svg',
        'disconnected_compute_storage_limited': '../docs/disconnected-operations/aldo-compute-storage-limited-connectivity.svg',
        'disconnected_compute_storage_airgapped': '../docs/disconnected-operations/aldo-compute-storage-air-gapped.svg',
        'disconnected_4intent_limited': '../docs/disconnected-operations/aldo-4intent-limited-connectivity.svg',
        'disconnected_4intent_airgapped': '../docs/disconnected-operations/aldo-4intent-air-gapped.svg',
        'disconnected_mgmt_compute_limited': '../docs/disconnected-operations/aldo-mgmt-compute-limited-connectivity.svg',
        'disconnected_mgmt_compute_airgapped': '../docs/disconnected-operations/aldo-mgmt-compute-air-gapped.svg',
        // Mgmt+Compute with 1 workload cluster (default for config reports)
        'disconnected_mgmt_compute_1wl_limited': '../docs/disconnected-operations/aldo-mgmt-compute-1wl-limited-connectivity.svg',
        'disconnected_mgmt_compute_1wl_airgapped': '../docs/disconnected-operations/aldo-mgmt-compute-1wl-air-gapped.svg',
        // Mgmt+Compute with 4 storage ports (6+ port switched config)
        'disconnected_mgmt_compute_4storage_limited': '../docs/disconnected-operations/aldo-mgmt-compute-4storage-limited-connectivity.svg',
        'disconnected_mgmt_compute_4storage_airgapped': '../docs/disconnected-operations/aldo-mgmt-compute-4storage-air-gapped.svg',
        // Switchless variants (mgmt+compute intent, 2/3/4 node)
        'disconnected_mgmt_compute_2node_switchless_limited': '../docs/disconnected-operations/aldo-mgmt-compute-2node-switchless-limited-connectivity.svg',
        'disconnected_mgmt_compute_2node_switchless_airgapped': '../docs/disconnected-operations/aldo-mgmt-compute-2node-switchless-air-gapped.svg',
        'disconnected_mgmt_compute_3node_switchless_limited': '../docs/disconnected-operations/aldo-mgmt-compute-3node-switchless-limited-connectivity.svg',
        'disconnected_mgmt_compute_3node_switchless_airgapped': '../docs/disconnected-operations/aldo-mgmt-compute-3node-switchless-air-gapped.svg',
        'disconnected_mgmt_compute_4node_switchless_limited': '../docs/disconnected-operations/aldo-mgmt-compute-4node-switchless-limited-connectivity.svg',
        'disconnected_mgmt_compute_4node_switchless_airgapped': '../docs/disconnected-operations/aldo-mgmt-compute-4node-switchless-air-gapped.svg',
        // Single-node workload cluster
        'disconnected_single_node_wl_limited': '../docs/disconnected-operations/aldo-single-node-wl-limited-connectivity.svg',
        'disconnected_single_node_wl_airgapped': '../docs/disconnected-operations/aldo-single-node-wl-air-gapped.svg',
        // Single-node workload cluster: fully converged (1 intent)
        'disconnected_single_node_wl_fullyconverged_limited': '../docs/disconnected-operations/aldo-single-node-wl-fullyconverged-limited-connectivity.svg',
        'disconnected_single_node_wl_fullyconverged_airgapped': '../docs/disconnected-operations/aldo-single-node-wl-fullyconverged-air-gapped.svg',
        // Single-node workload cluster: disaggregated (3 intents)
        'disconnected_single_node_wl_disaggregated_limited': '../docs/disconnected-operations/aldo-single-node-wl-disaggregated-limited-connectivity.svg',
        'disconnected_single_node_wl_disaggregated_airgapped': '../docs/disconnected-operations/aldo-single-node-wl-disaggregated-air-gapped.svg'
    };

    // Disconnected Operations draw.io source files for editable diagram export
    const OUTBOUND_DRAWIO = {
        'disconnected_fullyconverged_limited': '../docs/disconnected-operations/ALDO-fullyconverged-Limited-Connectivity.drawio',
        'disconnected_fullyconverged_airgapped': '../docs/disconnected-operations/ALDO-fullyconverged-Air-Gapped.drawio',
        'disconnected_disaggregated_limited': '../docs/disconnected-operations/ALDO-disaggregated-Limited-Connectivity.drawio',
        'disconnected_disaggregated_airgapped': '../docs/disconnected-operations/ALDO-disaggregated-Air-Gapped.drawio',
        'disconnected_compute_storage_limited': '../docs/disconnected-operations/ALDO-compute-storage-Limited-Connectivity.drawio',
        'disconnected_compute_storage_airgapped': '../docs/disconnected-operations/ALDO-compute-storage-Air-Gapped.drawio',
        'disconnected_4intent_limited': '../docs/disconnected-operations/ALDO-4intent-Limited-Connectivity.drawio',
        'disconnected_4intent_airgapped': '../docs/disconnected-operations/ALDO-4intent-Air-Gapped.drawio',
        'disconnected_mgmt_compute_limited': '../docs/disconnected-operations/ALDO-mgmt-compute-Limited-Connectivity.drawio',
        'disconnected_mgmt_compute_airgapped': '../docs/disconnected-operations/ALDO-mgmt-compute-Air-Gapped.drawio',
        'disconnected_mgmt_compute_1wl_limited': '../docs/disconnected-operations/ALDO-mgmt-compute-1wl-Limited-Connectivity.drawio',
        'disconnected_mgmt_compute_1wl_airgapped': '../docs/disconnected-operations/ALDO-mgmt-compute-1wl-Air-Gapped.drawio',
        'disconnected_mgmt_compute_4storage_limited': '../docs/disconnected-operations/ALDO-mgmt-compute-4storage-Limited-Connectivity.drawio',
        'disconnected_mgmt_compute_4storage_airgapped': '../docs/disconnected-operations/ALDO-mgmt-compute-4storage-Air-Gapped.drawio',
        'disconnected_mgmt_compute_2node_switchless_limited': '../docs/disconnected-operations/ALDO-mgmt-compute-2node-switchless-Limited-Connectivity.drawio',
        'disconnected_mgmt_compute_2node_switchless_airgapped': '../docs/disconnected-operations/ALDO-mgmt-compute-2node-switchless-Air-Gapped.drawio',
        'disconnected_mgmt_compute_3node_switchless_limited': '../docs/disconnected-operations/ALDO-mgmt-compute-3node-switchless-Limited-Connectivity.drawio',
        'disconnected_mgmt_compute_3node_switchless_airgapped': '../docs/disconnected-operations/ALDO-mgmt-compute-3node-switchless-Air-Gapped.drawio',
        'disconnected_mgmt_compute_4node_switchless_limited': '../docs/disconnected-operations/ALDO-mgmt-compute-4node-switchless-Limited-Connectivity.drawio',
        'disconnected_mgmt_compute_4node_switchless_airgapped': '../docs/disconnected-operations/ALDO-mgmt-compute-4node-switchless-Air-Gapped.drawio',
        'disconnected_single_node_wl_limited': '../docs/disconnected-operations/ALDO-single-node-wl-Limited-Connectivity.drawio',
        'disconnected_single_node_wl_airgapped': '../docs/disconnected-operations/ALDO-single-node-wl-Air-Gapped.drawio',
        'disconnected_single_node_wl_fullyconverged_limited': '../docs/disconnected-operations/ALDO-single-node-wl-fullyconverged-Limited-Connectivity.drawio',
        'disconnected_single_node_wl_fullyconverged_airgapped': '../docs/disconnected-operations/ALDO-single-node-wl-fullyconverged-Air-Gapped.drawio',
        'disconnected_single_node_wl_disaggregated_limited': '../docs/disconnected-operations/ALDO-single-node-wl-disaggregated-Limited-Connectivity.drawio',
        'disconnected_single_node_wl_disaggregated_airgapped': '../docs/disconnected-operations/ALDO-single-node-wl-disaggregated-Air-Gapped.drawio'
    };

    // Get the appropriate outbound diagram based on state
    function getOutboundDiagramKey(s) {
        if (!s) return null;

        // Disconnected Operations - select diagram by intent, storage, node count, and cluster role
        if (s.scenario === 'disconnected') {
            const isAirGapped = s.outbound === 'air_gapped';
            const suffix = isAirGapped ? 'airgapped' : 'limited';
            const intent = s.intent;
            const nodeCount = parseInt(s.nodes === '16+' ? 16 : s.nodes, 10) || 1;
            const isSwitchless = s.storage === 'switchless';
            const portCount = parseInt(s.ports, 10) || 4;

            // Single-node workload cluster → dedicated diagram (check before intent type)
            if (nodeCount === 1 && s.clusterRole === 'workload') {
                if (intent === 'all_traffic') return 'disconnected_single_node_wl_fullyconverged_' + suffix;
                if (intent === 'compute_storage') return 'disconnected_single_node_wl_disaggregated_' + suffix;
                // Custom intent: analyse actual NIC assignments for single-node
                if (intent === 'custom') {
                    const ci_sn = s.customIntents || {};
                    const vals_sn = Object.values(ci_sn);
                    if (vals_sn.length > 0 && vals_sn.every(function(v) { return v === 'all'; })) {
                        return 'disconnected_single_node_wl_fullyconverged_' + suffix;
                    }
                    const hasCS_sn = vals_sn.some(function(v) { return v === 'compute_storage'; });
                    const hasCmp_sn = vals_sn.some(function(v) { return v === 'compute' || v === 'compute_1' || v === 'compute_2'; });
                    const hasStg_sn = vals_sn.some(function(v) { return v === 'storage'; });
                    if (hasCS_sn || (hasCmp_sn && hasStg_sn)) {
                        return 'disconnected_single_node_wl_disaggregated_' + suffix;
                    }
                }
                return 'disconnected_single_node_wl_' + suffix;
            }

            if (intent === 'all_traffic') return 'disconnected_fullyconverged_' + suffix;
            if (intent === 'compute_storage') return 'disconnected_disaggregated_' + suffix;

            // Switchless variants (mgmt+compute intent, 2/3/4 node)
            if (isSwitchless && nodeCount >= 2 && nodeCount <= 4) {
                return 'disconnected_mgmt_compute_' + nodeCount + 'node_switchless_' + suffix;
            }

            // Custom intent: analyse actual NIC assignments to pick best diagram
            if (intent === 'custom') {
                const ci = s.customIntents || {};
                const vals = Object.values(ci);
                // All NICs carry all traffic → fully converged
                if (vals.length > 0 && vals.every(function(v) { return v === 'all'; })) {
                    return 'disconnected_fullyconverged_' + suffix;
                }
                // compute_storage combined, or separate compute + storage NICs → disaggregated
                const hasComputeStorage = vals.some(function(v) { return v === 'compute_storage'; });
                const hasCompute = vals.some(function(v) { return v === 'compute' || v === 'compute_1' || v === 'compute_2'; });
                const hasStorage = vals.some(function(v) { return v === 'storage'; });
                if (hasComputeStorage || (hasCompute && hasStorage)) {
                    return 'disconnected_disaggregated_' + suffix;
                }
                // mgmt_compute-style custom: check storage NIC count for 4-storage variant
                const storageNics = vals.filter(function(v) { return v === 'storage'; }).length;
                if (storageNics >= 2) {
                    return 'disconnected_mgmt_compute_4storage_' + suffix;
                }
                return 'disconnected_mgmt_compute_1wl_' + suffix;
            }

            // Switched with 4+ storage ports (6+ total ports, mgmt+compute intent)
            if (!isSwitchless && portCount >= 6) return 'disconnected_mgmt_compute_4storage_' + suffix;

            // Default: mgmt+compute with 1 workload cluster
            return 'disconnected_mgmt_compute_1wl_' + suffix;
        }

        if (s.outbound === 'private') {
            return 'private';
        }
        // Public path - determine based on arc and proxy settings
        const hasArc = s.arc === 'arc_gateway';
        const hasProxy = s.proxy === 'proxy';
        if (hasArc && hasProxy) return 'public_proxy_arc';
        if (hasArc && !hasProxy) return 'public_no_proxy_arc';
        if (!hasArc && hasProxy) return 'public_proxy_no_arc';
        return 'public_no_proxy_no_arc';
    }

    // Get diagram title based on configuration
    function getOutboundDiagramTitle(s) {
        if (!s) return 'Outbound Connectivity Architecture';

        // Disconnected Operations diagram titles
        if (s.scenario === 'disconnected') {
            const connType = s.outbound === 'air_gapped' ? 'Air Gapped' : 'Limited Connectivity';
            const intent = s.intent;
            const nodeCount = parseInt(s.nodes === '16+' ? 16 : s.nodes, 10) || 1;
            const isSwitchless = s.storage === 'switchless';
            const portCount = parseInt(s.ports, 10) || 4;
            // Single-node workload cluster titles (check before intent type)
            if (nodeCount === 1 && s.clusterRole === 'workload') {
                if (intent === 'all_traffic') return 'Disconnected Operations: Single Node Fully Converged Workload (' + connType + ')';
                if (intent === 'compute_storage') return 'Disconnected Operations: Single Node Disaggregated Workload (' + connType + ')';
                if (intent === 'custom') {
                    const ci_snt = s.customIntents || {};
                    const vals_snt = Object.values(ci_snt);
                    if (vals_snt.length > 0 && vals_snt.every(function(v) { return v === 'all'; })) {
                        return 'Disconnected Operations: Single Node Fully Converged Workload (' + connType + ')';
                    }
                    const hasCS_snt = vals_snt.some(function(v) { return v === 'compute_storage'; });
                    const hasCmp_snt = vals_snt.some(function(v) { return v === 'compute' || v === 'compute_1' || v === 'compute_2'; });
                    const hasStg_snt = vals_snt.some(function(v) { return v === 'storage'; });
                    if (hasCS_snt || (hasCmp_snt && hasStg_snt)) {
                        return 'Disconnected Operations: Single Node Disaggregated Workload (' + connType + ')';
                    }
                }
                return 'Disconnected Operations: Single Node Workload (' + connType + ')';
            }
            if (intent === 'all_traffic') return 'Disconnected Operations: Fully Converged (' + connType + ')';
            if (intent === 'compute_storage') return 'Disconnected Operations: Disaggregated (' + connType + ')';
            if (isSwitchless && nodeCount >= 2 && nodeCount <= 4) return 'Disconnected Operations: Management & Compute ' + nodeCount + '-Node Switchless (' + connType + ')';
            // Custom intent: derive title from actual NIC assignments
            if (intent === 'custom') {
                const ci = s.customIntents || {};
                const vals = Object.values(ci);
                if (vals.length > 0 && vals.every(function(v) { return v === 'all'; })) {
                    return 'Disconnected Operations: Fully Converged (' + connType + ')';
                }
                const hasComputeStorage = vals.some(function(v) { return v === 'compute_storage'; });
                const hasCompute = vals.some(function(v) { return v === 'compute' || v === 'compute_1' || v === 'compute_2'; });
                const hasStorage = vals.some(function(v) { return v === 'storage'; });
                if (hasComputeStorage || (hasCompute && hasStorage)) {
                    return 'Disconnected Operations: Disaggregated (' + connType + ')';
                }
                const storageNics = vals.filter(function(v) { return v === 'storage'; }).length;
                if (storageNics >= 2) {
                    return 'Disconnected Operations: Management & Compute 4-Storage (' + connType + ')';
                }
                return 'Disconnected Operations: Management & Compute (' + connType + ')';
            }
            if (!isSwitchless && portCount >= 6) return 'Disconnected Operations: Management & Compute 4-Storage (' + connType + ')';
            return 'Disconnected Operations: Management & Compute (' + connType + ')';
        }

        if (s.outbound === 'private') {
            return 'Private Path: Azure Firewall Explicit Proxy + Arc Gateway';
        }
        const hasArc = s.arc === 'arc_gateway';
        const hasProxy = s.proxy === 'proxy';
        if (hasArc && hasProxy) return 'Public Path: Enterprise Proxy + Arc Gateway (Recommended)';
        if (hasArc && !hasProxy) return 'Public Path: Arc Gateway (No Proxy)';
        if (!hasArc && hasProxy) return 'Public Path: Enterprise Proxy (No Arc Gateway)';
        return 'Public Path: Direct Connection (No Proxy, No Arc Gateway)';
    }

    // Private Endpoints information with detailed configuration
    const PRIVATE_ENDPOINT_INFO = {
        'keyvault': {
            name: 'Azure Key Vault',
            fqdn: 'vault.azure.net',
            privateLink: 'privatelink.vaultcore.azure.net',
            proxyBypass: ['<your-keyvault-name>.vault.azure.net', '<your-keyvault-name>.privatelink.vaultcore.azure.net'],
            notes: 'Required for deployment. Keep public access enabled during initial deployment, then restrict.',
            considerations: [
                'Key Vault is used to store deployment secrets and certificates',
                'Public access is required during initial deployment for cloud deployment',
                'After deployment, you can restrict to private endpoint only',
                'Ensure DNS resolves privatelink.vaultcore.azure.net to your private endpoint IP',
                'Replace <your-keyvault-name> with your actual Key Vault name'
            ],
            docUrl: 'https://learn.microsoft.com/azure/key-vault/general/private-link-service',
            icon: '🔐'
        },
        'storage': {
            name: 'Azure Storage (Blob)',
            fqdn: 'blob.core.windows.net',
            privateLink: 'privatelink.blob.core.windows.net',
            proxyBypass: ['<your-storage-account>.blob.core.windows.net', '<your-storage-account>.privatelink.blob.core.windows.net'],
            notes: 'Required for 2-node deployments as cloud witness. Keep public access during deployment.',
            considerations: [
                'Required for 2-node clusters using cloud witness for quorum',
                'Used for diagnostic logs and update packages',
                'Replace <your-storage-account> with your actual storage account name',
                'Add table/queue endpoints if needed: <your-storage-account>.table.core.windows.net',
                'Public access may be required during initial deployment'
            ],
            docUrl: 'https://learn.microsoft.com/azure/storage/common/storage-private-endpoints',
            icon: '💾'
        },
        'acr': {
            name: 'Azure Container Registry',
            fqdn: 'azurecr.io',
            privateLink: 'privatelink.azurecr.io',
            proxyBypass: ['<your-acr-name>.azurecr.io', '<your-acr-name>.privatelink.azurecr.io'],
            notes: 'Important: Wildcards (*.azurecr.io) are NOT supported. Use specific ACR FQDNs.',
            considerations: [
                'CRITICAL: Wildcard entries (*.azurecr.io) are NOT supported for proxy bypass',
                'You must specify the exact FQDN of your Azure Container Registry',
                'Example: myregistry.azurecr.io (replace with your actual ACR name)',
                'Required for pulling container images for AKS and Arc services',
                'Data endpoint may also need bypass: <your-acr-name>.<region>.data.azurecr.io'
            ],
            docUrl: 'https://learn.microsoft.com/azure/container-registry/container-registry-private-link',
            icon: '📦'
        },
        'asr': {
            name: 'Azure Site Recovery',
            fqdn: 'siterecovery.windowsazure.com',
            privateLink: 'privatelink.siterecovery.windowsazure.com',
            proxyBypass: ['<your-vault-name>.<region>.siterecovery.windowsazure.com', '<your-vault-name>.privatelink.siterecovery.windowsazure.com'],
            notes: 'Not allowed via Arc Gateway. Traffic must go directly to private endpoint.',
            considerations: [
                'Azure Site Recovery traffic cannot route through Arc Gateway',
                'Must be added to proxy bypass list for direct connectivity',
                'Requires separate private endpoints for cache storage account',
                'Replace <your-vault-name> with your Recovery Services vault name',
                'Replace <region> with your Azure region (e.g., eastus, westeurope)'
            ],
            docUrl: 'https://learn.microsoft.com/azure/site-recovery/azure-to-azure-how-to-enable-replication-private-endpoints',
            icon: '🔄'
        },
        'backup': {
            name: 'Recovery Services Vault',
            fqdn: 'backup.windowsazure.com',
            privateLink: 'privatelink.backup.windowsazure.com',
            proxyBypass: ['<your-vault-name>.<region>.backup.windowsazure.com', '<your-vault-name>.privatelink.backup.windowsazure.com'],
            notes: 'Azure Backup private endpoints for VM backup and recovery.',
            considerations: [
                'Requires private endpoint for Recovery Services vault',
                'Backup data stored in Azure Storage also needs private endpoint',
                'Replace <your-vault-name> with your Recovery Services vault name',
                'Replace <region> with your Azure region',
                'Mars agent communication uses these endpoints'
            ],
            docUrl: 'https://learn.microsoft.com/azure/backup/private-endpoints',
            icon: '🗄️'
        },
        'sql': {
            name: 'SQL Managed Instance',
            fqdn: 'database.windows.net',
            privateLink: 'privatelink.database.windows.net',
            proxyBypass: ['<your-sql-server>.database.windows.net', '<your-sql-server>.privatelink.database.windows.net'],
            notes: 'Private connectivity for Azure SQL Managed Instance.',
            considerations: [
                'SQL MI requires specific private endpoint configuration',
                'Redirect connection policy may require additional ports (11000-11999)',
                'Consider using Proxy connection policy for simplified networking',
                'Replace <your-sql-server> with your SQL server or MI name',
                'DNS resolution must point to private endpoint IP'
            ],
            docUrl: 'https://learn.microsoft.com/azure/azure-sql/managed-instance/private-endpoint-overview',
            icon: '🗃️'
        },
        'defender': {
            name: 'Microsoft Defender for Cloud',
            fqdn: 'Various security endpoints',
            privateLink: 'Multiple Private Link endpoints',
            proxyBypass: ['<your-workspace-id>.ods.opinsights.azure.com', '<your-workspace-id>.oms.opinsights.azure.com'],
            notes: 'For advanced security monitoring scenarios.',
            considerations: [
                'Defender for Cloud uses Azure Monitor private link scope (AMPLS)',
                'Includes Log Analytics workspace endpoints',
                'Replace <your-workspace-id> with your Log Analytics workspace ID',
                'May require multiple private endpoints for full functionality',
                'Consider Azure Monitor Private Link Scope for consolidated management'
            ],
            docUrl: 'https://learn.microsoft.com/azure/azure-monitor/logs/private-link-security',
            icon: '🛡️'
        }
    };

    function togglePrintFriendly() {
        isPrintFriendly = !isPrintFriendly;
        const body = document.body;
        const btn = document.getElementById('print-friendly-btn');

        // Use CSS class toggle for robust style handling
        // This approach doesn't rely on inline styles and works with computed CSS
        if (isPrintFriendly) {
            body.classList.add('print-friendly-mode');
            if (btn) btn.textContent = 'Normal View';
        } else {
            body.classList.remove('print-friendly-mode');
            if (btn) btn.textContent = 'Print Friendly';
        }
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Escape pipe, backtick, and backslash characters for markdown table cells */
    function escapeMd(val) {
        return String(val || '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/`/g, '\\`');
    }

    /**
     * Get custom port display name from state.portConfig (v0.13.0+)
     * Returns custom name if set, otherwise falls back to default naming.
     * @param {object} state - The wizard state object
     * @param {number} idx1Based - 1-based port index (1, 2, 3, ...)
     * @param {string} type - 'nic' for NIC1/NIC2 style, 'smb' for SMB1/SMB2 style
     * @returns {string} The display name
     */
    function getPortCustomName(state, idx1Based, type) {
        try {
            // Check portConfig for custom names (v0.13.0+ feature)
            if (state && Array.isArray(state.portConfig) && state.portConfig[idx1Based - 1]) {
                const customName = state.portConfig[idx1Based - 1].customName;
                if (customName && String(customName).trim()) {
                    return String(customName).trim();
                }
            }
            // Legacy: check nicNames array
            if (state && Array.isArray(state.nicNames) && state.nicNames[idx1Based - 1]) {
                const n0 = String(state.nicNames[idx1Based - 1]).trim();
                if (n0) return n0;
            }
            // Legacy: check nicNames object
            if (state && state.nicNames && typeof state.nicNames === 'object' && state.nicNames[idx1Based]) {
                const n1 = String(state.nicNames[idx1Based]).trim();
                if (n1) return n1;
            }
        } catch (e) {
            // ignore
        }
        // Default naming: use "Port N" to match the wizard UI
        return 'Port ' + idx1Based;
    }

    // Convert CIDR notation to wildcard format for proxy bypass
    // e.g., 192.168.20.0/24 -> 192.168.20.*
    // e.g., 172.16.0.0/16 -> 172.16.*.*
    // e.g., 10.0.0.0/8 -> 10.*.*.*
    function convertCidrToWildcard(cidr) {
        if (!cidr) return null;
        const parts = cidr.split('/');
        if (parts.length !== 2) return null;

        const ip = parts[0];
        const prefix = parseInt(parts[1], 10);
        const octets = ip.split('.');
        if (octets.length !== 4) return null;

        // Validate prefix is a valid number between 0 and 32
        if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return null;

        // Determine how many octets to keep based on CIDR prefix
        if (prefix <= 8) {
            return octets[0] + '.*.*.*';
        } else if (prefix <= 16) {
            return octets[0] + '.' + octets[1] + '.*.*';
        } else if (prefix <= 24) {
            return octets[0] + '.' + octets[1] + '.' + octets[2] + '.*';
        } else {
            // /25 or larger - return full IP (documented limitation: not a valid wildcard pattern)
            // For proxy bypass, this will match only the exact network address
            return ip;
        }
    }

    // Bind exporter helpers now that PRIVATE_ENDPOINT_INFO and
    // convertCidrToWildcard are in scope. Mirrors the bypass-list logic in
    // the rendered Outbound section so the PPTX exporter can produce the
    // same content without scraping the DOM.
    window.__odinGetPrivateEndpointInfo = function() { return PRIVATE_ENDPOINT_INFO; };
    window.__odinBuildProxyBypassList = function(s) {
        if (!s || s.proxy !== 'proxy') return [];
        const items = [];
        items.push('localhost');
        items.push('127.0.0.1');
        if (s.nodeSettings && s.nodeSettings.length) {
            s.nodeSettings.forEach(function(node) {
                if (node && node.name) items.push(node.name);
            });
            s.nodeSettings.forEach(function(node) {
                if (node && node.ipCidr) {
                    const ip = node.ipCidr.split('/')[0];
                    if (ip) items.push(ip);
                }
            });
        }
        if (s.adDomain) items.push('*.' + s.adDomain);
        if (s.infraCidr) {
            const w = convertCidrToWildcard(s.infraCidr);
            if (w) items.push(w);
        }
        if (s.privateEndpoints === 'pe_enabled' && s.privateEndpointsList) {
            s.privateEndpointsList.forEach(function(key) {
                const info = PRIVATE_ENDPOINT_INFO[key];
                if (info && info.proxyBypass) {
                    info.proxyBypass.forEach(function(b) {
                        if (items.indexOf(b) === -1) items.push(b);
                    });
                }
            });
        }
        return items;
    };

    // Get storage subnet CIDR for diagram legends.
    // Uses custom subnets when Storage Auto IP is disabled, otherwise returns default examples.
    function getStorageSubnetCidr(state, subnetIndex, defaultCidr) {
        // subnetIndex is 1-based (Subnet 1, Subnet 2, etc.)
        if (state && state.storageAutoIp === 'disabled' &&
            Array.isArray(state.customStorageSubnets) &&
            state.customStorageSubnets[subnetIndex - 1]) {
            const customCidr = String(state.customStorageSubnets[subnetIndex - 1]).trim();
            if (customCidr) return customCidr;
        }
        // When Auto IP is enabled, use Network ATC default subnets (10.71.0.0/16 range)
        if (state && state.storageAutoIp !== 'disabled') {
            return '10.71.' + subnetIndex + '.0/24';
        }
        return defaultCidr;
    }

    // Check if custom storage subnets are being used (for legend title)
    function hasCustomStorageSubnets(state) {
        return state && state.storageAutoIp === 'disabled' &&
               Array.isArray(state.customStorageSubnets) &&
               state.customStorageSubnets.some(function(s) { return s && String(s).trim(); });
    }

    // Get legend note text based on whether custom subnets are used
    function getStorageSubnetNote(state, defaultNote) {
        if (hasCustomStorageSubnets(state)) {
            return 'CIDRs shown are your custom storage subnet configuration.';
        }
        return defaultNote;
    }

    function buildStandaloneReportWordHtml(opts) {
        opts = opts || {};
        const inlineCss = opts.inlineCss || '';
        const bodyHtml = opts.bodyHtml || '';
        const title = opts.title || (document.title || 'Azure Local Design Assistant (ALDA) Tool — Report');

        const headParts = [];
        headParts.push('<meta http-equiv="Content-Type" content="text/html; charset=utf-8">');
        headParts.push('<meta charset="UTF-8">');
        headParts.push('<title>' + escapeHtml(title) + '</title>');
        if (inlineCss) {
            headParts.push('<style>' + inlineCss + '</style>');
        }

        // Word-friendly namespaces.
        return '<!DOCTYPE html>'
            + '<html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
            + '<head>' + headParts.join('') + '</head>'
            + '<body>' + bodyHtml + '</body>'
            + '</html>';
    }

    function buildWordFriendlyCss() {
        // Keep CSS intentionally conservative for Word's HTML renderer.
        return [
            'html, body { margin: 0; padding: 0; }',
            'body { background: #ffffff; color: #111111; font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 11pt; line-height: 1.35; }',
            '.background-globes { display: none !important; }',
            '.container { max-width: none; margin: 0; padding: 0.75in; }',
            'header { margin: 0 0 18pt 0; }',
            'header h1 { font-size: 22pt; font-weight: 700; color: #111111; margin: 0 0 6pt 0; }',
            'header p { margin: 0; color: #444444; }',
            '.step { border: 1px solid #d1d5db; border-radius: 10px; padding: 14pt 16pt; margin: 0 0 14pt 0; background: #ffffff; }',
            '.step-header { display: block; margin: 0 0 12pt 0; padding-bottom: 6pt; border-bottom: 1px solid #e5e7eb; }',
            '.step-number { display: inline-block; font-weight: 700; font-size: 9pt; color: #0b5cab; border: 1px solid #bcd6f0; background: #eef6ff; padding: 2pt 8pt; border-radius: 12pt; margin-right: 8pt; vertical-align: middle; }',
            '.step-header h2 { display: inline; font-size: 14pt; font-weight: 700; margin: 0; color: #111111; }',
            '.info-box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10pt 12pt; background: #f9fafb; }',
            '.info-box.visible { display: block; }',
            '.info-box.hidden { display: none; }',
            '.info-box strong { color: #111111; }',
            '.info-box a { color: #0b5cab; text-decoration: underline; }',

            '.summary-section { margin: 0 0 12pt 0; }',
            '.summary-section-title { font-size: 12pt; font-weight: 700; color: #111111; padding: 6pt 8pt; background: #f3f4f6; border: 1px solid #e5e7eb; border-left: 4pt solid #0b5cab; border-radius: 8px; margin: 0 0 8pt 0; }',

            '.word-kv-table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; }',
            '.word-kv-table td { border: 1px solid #e5e7eb; padding: 6pt 8pt; vertical-align: top; }',
            '.word-kv-label { width: 34%; font-weight: 700; color: #111111; background: #f9fafb; }',
            '.word-kv-value { width: 66%; color: #111111; }',
            '.mono, .summary-value.mono { font-family: Consolas, "Courier New", monospace; font-size: 10.5pt; }',

            '.switchless-diagram { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10pt; background: #ffffff; }',
            '.switchless-diagram img { display: block; max-width: 100%; height: auto; }',
            '.switchless-diagram__legend { margin-top: 10pt; padding-top: 10pt; border-top: 1px solid #e5e7eb; }',
            '.switchless-diagram__legend-title { font-weight: 700; margin: 0 0 6pt 0; }',
            '.switchless-diagram__legend-grid { display: block; }',
            '.switchless-diagram__legend-item { margin: 0 0 4pt 0; }',
            '.switchless-diagram__legend-text { color: #444444; }',

            // Lists and paragraphs
            'p { margin: 0 0 8pt 0; }',
            'ul { margin: 6pt 0 8pt 18pt; }',
            'li { margin: 0 0 4pt 0; }',

            '.reset-button, .report-actions, .no-print { display: none !important; }',
            '@page { margin: 1in; }',
            '.step, img { page-break-inside: avoid; }'
        ].join('\n');
    }

    function convertSummarySectionsToWordTables(rootEl) {
        try {
            if (!rootEl) return;
            const sections = rootEl.querySelectorAll('.summary-section');
            for (let i = 0; i < sections.length; i++) {
                const sec = sections[i];
                if (!sec) continue;

                const rows = sec.querySelectorAll('.summary-row');
                if (!rows || !rows.length) continue;

                const table = document.createElement('table');
                table.className = 'word-kv-table';
                table.setAttribute('cellspacing', '0');
                table.setAttribute('cellpadding', '0');

                const tbody = document.createElement('tbody');
                table.appendChild(tbody);

                for (let r = 0; r < rows.length; r++) {
                    const row = rows[r];
                    const labelEl = row.querySelector('.summary-label');
                    const valueEl = row.querySelector('.summary-value');
                    if (!labelEl || !valueEl) continue;

                    const tr = document.createElement('tr');
                    const tdL = document.createElement('td');
                    tdL.className = 'word-kv-label';
                    tdL.textContent = (labelEl.textContent || '').trim();

                    const tdV = document.createElement('td');
                    tdV.className = 'word-kv-value';
                    // Preserve spans/links in value.
                    tdV.innerHTML = valueEl.innerHTML;

                    tr.appendChild(tdL);
                    tr.appendChild(tdV);
                    tbody.appendChild(tr);
                }

                // Remove the original div rows.
                for (let r2 = rows.length - 1; r2 >= 0; r2--) {
                    if (rows[r2] && rows[r2].parentNode) rows[r2].parentNode.removeChild(rows[r2]);
                }

                // Insert the table after the section title (if present).
                const title = sec.querySelector('.summary-section-title');
                if (title && title.parentNode === sec && title.nextSibling) {
                    sec.insertBefore(table, title.nextSibling);
                } else {
                    sec.appendChild(table);
                }
            }
        } catch (e) {
            // ignore
        }
    }

    function svgElementToPngDataUrl(svgEl, opts) {
        opts = opts || {};
        const scale = opts.scale || 2;
        const background = opts.background || '#ffffff';
        const theme = opts.theme || 'light';

        function ensureXlinkNamespace(svgNode) {
            try {
                if (!svgNode) return;
                // Some external SVGs rely on xlink:href for embedded images.
                // Ensure the namespace exists so <image xlink:href="..."> resolves when serialized.
                let hasXlinkHref = false;
                try {
                    hasXlinkHref = !!svgNode.querySelector('[xlink\\:href]');
                } catch (eSel) {
                    // ignore
                }
                if (hasXlinkHref && !svgNode.getAttribute('xmlns:xlink')) {
                    svgNode.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
                }
            } catch (e) {
                // ignore
            }
        }

        function stripAnimationStyles(svgNode) {
            try {
                if (!svgNode) return;
                const styled = svgNode.querySelectorAll('[style*="animation"], [style*="stroke-dashoffset"]');
                for (let i = 0; i < styled.length; i++) {
                    const el = styled[i];
                    if (!el) continue;
                    let s = el.getAttribute('style');
                    if (!s) continue;
                    // Remove animation declarations which can confuse some rasterizers.
                    s = s.replace(/(^|;)\s*animation\s*:[^;]+;?/gi, '$1');
                    s = s.replace(/(^|;)\s*animation-name\s*:[^;]+;?/gi, '$1');
                    s = s.replace(/(^|;)\s*animation-duration\s*:[^;]+;?/gi, '$1');
                    s = s.replace(/(^|;)\s*animation-timing-function\s*:[^;]+;?/gi, '$1');
                    s = s.replace(/(^|;)\s*animation-iteration-count\s*:[^;]+;?/gi, '$1');
                    s = s.replace(/(^|;)\s*animation-delay\s*:[^;]+;?/gi, '$1');
                    s = s.replace(/(^|;)\s*animation-direction\s*:[^;]+;?/gi, '$1');
                    s = s.replace(/(^|;)\s*animation-fill-mode\s*:[^;]+;?/gi, '$1');
                    s = s.replace(/(^|;)\s*animation-play-state\s*:[^;]+;?/gi, '$1');
                    s = s.replace(/;;+/g, ';');
                    s = s.replace(/^;+|;+$/g, '');
                    if (s) el.setAttribute('style', s);
                    else el.removeAttribute('style');
                }
            } catch (e) {
                // ignore
            }
        }

        function sanitizeSvgForCanvas(svgNode) {
            try {
                if (!svgNode) return;

                // Canvas SVG rasterization is unreliable with foreignObject.
                // The Arc Gateway SVG includes <switch><foreignObject>...<image> fallback.</switch>.
                // Remove foreignObject and flatten switches to the fallback <image>.
                const foreign = svgNode.querySelectorAll('foreignObject');
                for (let f = foreign.length - 1; f >= 0; f--) {
                    const fo = foreign[f];
                    if (fo && fo.parentNode) fo.parentNode.removeChild(fo);
                }

                // Strip scripts (defensive).
                const scripts = svgNode.querySelectorAll('script');
                for (let s = scripts.length - 1; s >= 0; s--) {
                    const sc = scripts[s];
                    if (sc && sc.parentNode) sc.parentNode.removeChild(sc);
                }

                // Flatten <switch> to a concrete drawable element.
                const switches = svgNode.querySelectorAll('switch');
                for (let i = switches.length - 1; i >= 0; i--) {
                    const sw = switches[i];
                    if (!sw || !sw.parentNode) continue;

                    let picked = null;
                    // Prefer a direct <image> fallback.
                    for (let c = 0; c < sw.childNodes.length; c++) {
                        const child = sw.childNodes[c];
                        if (!child || child.nodeType !== 1) continue;
                        if (String(child.nodeName).toLowerCase() === 'image') {
                            picked = child;
                            break;
                        }
                    }
                    if (!picked) {
                        // Otherwise pick the first element child.
                        picked = sw.firstElementChild;
                    }

                    if (picked) {
                        const repl = picked.cloneNode(true);
                        // Preserve common container attributes.
                        const tf = sw.getAttribute('transform');
                        if (tf && !repl.getAttribute('transform')) repl.setAttribute('transform', tf);
                        const st = sw.getAttribute('style');
                        if (st && !repl.getAttribute('style')) repl.setAttribute('style', st);
                        sw.parentNode.replaceChild(repl, sw);
                    } else {
                        // Nothing drawable inside; remove.
                        sw.parentNode.removeChild(sw);
                    }
                }

                stripAnimationStyles(svgNode);
            } catch (e) {
                // ignore
            }
        }

        function parseSvgLength(val) {
            if (!val) return null;
            const s = String(val).trim();
            // Strip common units (px/pt/em) and keep the leading number.
            const m = s.match(/^([0-9]+(\.[0-9]+)?)/);
            if (!m) return null;
            const n = parseFloat(m[1]);
            return Number.isFinite(n) ? n : null;
        }

        return new Promise(function(resolve) {
            try {
                const clone = svgEl.cloneNode(true);
                if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                ensureXlinkNamespace(clone);
                sanitizeSvgForCanvas(clone);

                // Inject theme vars so computed colors don't depend on external CSS.
                try {
                    const rootStyle = window.getComputedStyle(document.documentElement);
                    const themeVars = {
                        '--bg-dark': (rootStyle.getPropertyValue('--bg-dark') || '').trim(),
                        '--card-bg': (rootStyle.getPropertyValue('--card-bg') || '').trim(),
                        '--text-primary': (rootStyle.getPropertyValue('--text-primary') || '').trim(),
                        '--text-secondary': (rootStyle.getPropertyValue('--text-secondary') || '').trim(),
                        '--accent-blue': (rootStyle.getPropertyValue('--accent-blue') || '').trim(),
                        '--accent-purple': (rootStyle.getPropertyValue('--accent-purple') || '').trim(),
                        '--success': (rootStyle.getPropertyValue('--success') || '').trim(),
                        '--glass-border': (rootStyle.getPropertyValue('--glass-border') || '').trim(),
                        // Some external diagrams use this variable for fills.
                        '--ge-dark-color': (rootStyle.getPropertyValue('--ge-dark-color') || '').trim()
                    };

                    if (theme === 'light') {
                        themeVars['--bg-dark'] = '#ffffff';
                        themeVars['--card-bg'] = '#ffffff';
                        themeVars['--text-primary'] = '#0b0b0b';
                        themeVars['--text-secondary'] = '#404040';
                        themeVars['--glass-border'] = 'rgba(0, 0, 0, 0.14)';
                    }

                    const decls = Object.keys(themeVars)
                        .map(function(k) {
                            const v = (themeVars[k] || '').trim();
                            return v ? (k + ': ' + v + ';') : '';
                        })
                        .filter(Boolean)
                        .join(' ');

                    if (decls) {
                        let defs = clone.querySelector('defs');
                        if (!defs) {
                            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                            clone.insertBefore(defs, clone.firstChild);
                        }
                        const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
                        styleEl.textContent = ':root { ' + decls + ' }';
                        defs.appendChild(styleEl);
                    }
                } catch (eVars) {
                    // ignore
                }

                // Solid background rect so the resulting PNG isn't transparent.
                const vbStr = (clone.getAttribute('viewBox') || '').trim();
                let vb = null;
                if (vbStr) {
                    const parts = vbStr.split(/\s+/).map(function(p) { return parseFloat(p); });
                    if (parts.length === 4 && parts.every(function(n) { return Number.isFinite(n); })) {
                        vb = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
                    }
                }

                // Some SVGs omit viewBox and rely on width/height.
                let wh = null;
                if (!vb) {
                    const wAttr = parseSvgLength(clone.getAttribute('width'));
                    const hAttr = parseSvgLength(clone.getAttribute('height'));
                    if (wAttr && hAttr) {
                        wh = { w: wAttr, h: hAttr };
                    }
                }

                try {
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('fill', background);
                    if (vb) {
                        rect.setAttribute('x', String(vb.x));
                        rect.setAttribute('y', String(vb.y));
                        rect.setAttribute('width', String(vb.w));
                        rect.setAttribute('height', String(vb.h));
                    } else {
                        rect.setAttribute('x', '0');
                        rect.setAttribute('y', '0');
                        rect.setAttribute('width', '100%');
                        rect.setAttribute('height', '100%');
                    }

                    const defsNode = clone.querySelector('defs');
                    if (defsNode && defsNode.nextSibling) {
                        clone.insertBefore(rect, defsNode.nextSibling);
                    } else {
                        clone.insertBefore(rect, clone.firstChild);
                    }
                } catch (eBg) {
                    // ignore
                }

                const serializer = new XMLSerializer();
                let svgText = serializer.serializeToString(clone);
                if (svgText.indexOf('<?xml') !== 0) {
                    svgText = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgText;
                }

                const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                const svgUrl = URL.createObjectURL(svgBlob);

                const img = new Image();
                img.onload = function() {
                    try {
                        let w = 1200;
                        let h = 800;
                        if (vb) {
                            w = Math.max(1, Math.round(vb.w * scale));
                            h = Math.max(1, Math.round(vb.h * scale));
                        } else if (wh) {
                            w = Math.max(1, Math.round(wh.w * scale));
                            h = Math.max(1, Math.round(wh.h * scale));
                        } else {
                            // Fallback: use rendered size if available.
                            const box = svgEl.getBoundingClientRect();
                            if (box && box.width && box.height) {
                                w = Math.max(1, Math.round(box.width * scale));
                                h = Math.max(1, Math.round(box.height * scale));
                            }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        const pngUrl = canvas.toDataURL('image/png');
                        resolve(pngUrl);
                    } catch (eDraw) {
                        resolve(null);
                    } finally {
                        URL.revokeObjectURL(svgUrl);
                    }
                };
                img.onerror = function() {
                    try { URL.revokeObjectURL(svgUrl); } catch (eRevoke) { /* URL already revoked or never minted */ }
                    resolve(null);
                };

                img.src = svgUrl;
            } catch (e) {
                resolve(null);
            }
        });
    }

    function downloadReportHtml() {
        // Backward-compatible alias: HTML download was replaced by Word download.
        downloadReportWord();
    }

    function downloadReportWord() {
        try {
            const main = document.querySelector('main.container');
            if (!main) return;

            const clone = main.cloneNode(true);

            // Remove Validation Summary section from exports.
            try {
                const validationsHost = clone.querySelector('#report-validations');
                if (validationsHost) {
                    const validationsStep = validationsHost.closest('.step');
                    if (validationsStep && validationsStep.parentNode) {
                        validationsStep.parentNode.removeChild(validationsStep);
                    }
                }
            } catch (eValRemove) {
                // ignore
            }

            // Remove any action buttons and Close button.
            const noPrintEls = clone.querySelectorAll('.no-print');
            for (let i = 0; i < noPrintEls.length; i++) {
                if (noPrintEls[i] && noPrintEls[i].parentNode) {
                    noPrintEls[i].parentNode.removeChild(noPrintEls[i]);
                }
            }
            const resetBtn = clone.querySelector('.reset-button');
            if (resetBtn && resetBtn.parentNode) {
                resetBtn.parentNode.removeChild(resetBtn);
            }

            // Convert diagrams (SVG) to embedded PNG images for Word.
            let prefetch = Promise.resolve();
            // If outbound diagram hasn't loaded yet, fetch into the export clone so it appears in Word.
            const diagKey = getOutboundDiagramKey(CURRENT_REPORT_STATE);
            if (diagKey && OUTBOUND_DIAGRAMS[diagKey]) {
                const diagramHost = clone.querySelector('#outbound-connectivity-diagram');
                if (diagramHost && !diagramHost.querySelector('svg')) {
                    const diagramUrl = OUTBOUND_DIAGRAMS[diagKey];
                    prefetch = fetch(diagramUrl)
                        .then(function(resp) { return resp.text(); })
                        .then(function(svg) {
                            const containerEl = diagramHost.querySelector('#outbound-diagram-container');
                            if (containerEl) {
                                containerEl.innerHTML = svg;
                            } else {
                                diagramHost.innerHTML = svg;
                            }
                        });
                }
            }

            prefetch.then(function() {
                const svgs = clone.querySelectorAll('svg.switchless-diagram__svg');
                const conversions = [];
                for (let s = 0; s < svgs.length; s++) {
                    (function(svgNode) {
                        conversions.push(
                            svgElementToPngDataUrl(svgNode, { theme: 'dark', background: '#000000', scale: 2 })
                                .then(function(pngDataUrl) {
                                    if (!pngDataUrl) return;
                                    const img = document.createElement('img');
                                    img.alt = 'Network diagram';
                                    img.src = pngDataUrl;

                                    // Preserve approximate size: let Word scale to page width.
                                    img.style.width = '100%';
                                    img.style.height = 'auto';

                                    if (svgNode.parentNode) {
                                        svgNode.parentNode.replaceChild(img, svgNode);
                                    }
                                })
                        );
                    })(svgs[s]);
                }

                // Also convert the outbound connectivity diagram SVG to PNG for Word
                const outboundContainer = clone.querySelector('#outbound-diagram-container');
                if (outboundContainer) {
                    const outboundSvg = outboundContainer.querySelector('svg');
                    if (outboundSvg) {
                        conversions.push(
                            svgElementToPngDataUrl(outboundSvg, { theme: 'dark', background: '#000000', scale: 2 })
                                .then(function(pngDataUrl) {
                                    if (!pngDataUrl) return;
                                    const img = document.createElement('img');
                                    img.alt = 'Outbound connectivity diagram';
                                    img.src = pngDataUrl;
                                    img.style.width = '100%';
                                    img.style.height = 'auto';
                                    if (outboundSvg.parentNode) {
                                        outboundSvg.parentNode.replaceChild(img, outboundSvg);
                                    }
                                })
                        );
                    }
                }

                return Promise.all(conversions);
            }).then(function() {
                // Convert label/value summary grids to tables for clear Word formatting.
                convertSummarySectionsToWordTables(clone);

                const wordCss = buildWordFriendlyCss();

                // Include background-globes div to avoid relying on page structure; CSS hides it.
                const bodyHtml = '<div class="background-globes"></div>' + clone.outerHTML;
                const html = buildStandaloneReportWordHtml({ inlineCss: wordCss, bodyHtml: bodyHtml });

                const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                const ts = new Date();
                const pad2 = function(n) { return String(n).padStart(2, '0'); };
                const fileName = 'azure-local-report-'
                    + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate())
                    + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes())
                    + '.doc';

                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
            });
        } catch (e) {
            // ignore
        }
    }

    function buildMarkdownContent(s, diagrams) {
        const md = [];
        md.push('# Azure Local Configuration Report');
        md.push('');

        // Metadata section
        md.push('## Report Metadata');
        md.push('');
        md.push('| Field | Value |');
        md.push('|-------|-------|');
        md.push('| Generated | ' + (new Date().toLocaleString()) + ' |');
        md.push('| Scenario | ' + formatScenario(s.scenario, s) + ' |');
        md.push('');

        // Scenario & Scale
        md.push('## Scenario & Scale');
        md.push('');
        md.push('| Setting | Value |');
        md.push('|---------|-------|');
        if (s.scenario) md.push('| Scenario | ' + formatScenario(s.scenario, s) + ' |');
        if (s.scenario === 'disconnected') {
            if (s.clusterRole) {
                md.push('| Cluster Role | ' + (s.clusterRole === 'management' ? 'Management Cluster' : 'Workload Cluster') + ' |');
                md.push('| Autonomous Cloud FQDN | ' + escapeMd(s.autonomousCloudFqdn || 'Not configured') + ' |');
                if (s.clusterRole === 'management' && (s.applianceIp1 || s.applianceIp2)) {
                    const ipParts = [];
                    if (s.applianceIp1) ipParts.push('Ingress vNIC: ' + escapeMd(s.applianceIp1));
                    if (s.applianceIp2) ipParts.push('Mgmt vNIC: ' + escapeMd(s.applianceIp2));
                    md.push('| Appliance IPs | `' + ipParts.join(' \u00B7 ') + '` |');
                }
            }
        } else {
            if (s.region) md.push('| Azure Cloud | ' + formatCloud(s.region) + ' |');
            if (s.localInstanceRegion) md.push('| Azure Local Instance Region | ' + formatLocalInstanceRegion(s.localInstanceRegion) + ' |');
        }
        if (s.scale) md.push('| Scale | ' + formatScale(s.scale) + ' |');
        if (s.nodes) md.push('| Nodes | ' + s.nodes + ' |');
        if (s.witnessType) md.push('| Cloud Witness | ' + (s.witnessType === 'Cloud' ? 'Cloud' : 'No Witness') + ' |');
        md.push('');

        // Sizer Hardware Configuration (only present when imported from Sizer)
        if (s.sizerHardware) {
            const hw = s.sizerHardware;
            md.push('## Hardware Configuration (from Sizer)');
            md.push('');
            md.push('| Setting | Value |');
            md.push('|---------|-------|');
            if (hw.cpu) {
                md.push('| CPU | ' + (hw.cpu.generation || '-') + ' |');
                md.push('| Cores per Socket | ' + (hw.cpu.coresPerSocket || '-') + ' |');
                md.push('| CPU Sockets | ' + (hw.cpu.sockets || '-') + ' |');
                md.push('| Total Physical Cores per Node | ' + (hw.cpu.totalCores || '-') + ' |');
            }
            if (hw.memory) {
                md.push('| Memory per Node | ' + (hw.memory.perNodeGB || '-') + ' GB |');
            }
            if (hw.gpu && hw.gpu.countPerNode > 0) {
                md.push('| GPU per Node | ' + hw.gpu.countPerNode + ' × ' + (hw.gpu.type || '-') + ' |');
            }
            if (hw.vcpuRatio) {
                md.push('| vCPU Ratio (pCPU:vCPU) | ' + hw.vcpuRatio + ':1 |');
            }
            if (hw.storage) {
                const storageLabel = hw.storage.config === 'all-flash' ? 'All-Flash' :
                    hw.storage.config === 'mixed-flash' ? 'Mixed All-Flash (NVMe + SSD)' :
                        hw.storage.config === 'hybrid' ? 'Hybrid (SSD/NVMe + HDD)' : (hw.storage.config || '-');
                md.push('| Storage Configuration | ' + storageLabel + ' |');
                if (hw.storage.diskConfig) {
                    const dc = hw.storage.diskConfig;
                    if (dc.isTiered && dc.cache && dc.capacity) {
                        md.push('| Cache Disks | ' + dc.cache.count + 'x ' + (dc.cache.sizeGB >= 1024 ? (dc.cache.sizeGB / 1024).toFixed(1) + ' TB' : dc.cache.sizeGB + ' GB') + ' (' + (dc.cache.type || '') + ') |');
                        md.push('| Capacity Disks | ' + dc.capacity.count + 'x ' + (dc.capacity.sizeGB >= 1024 ? (dc.capacity.sizeGB / 1024).toFixed(1) + ' TB' : dc.capacity.sizeGB + ' GB') + ' (' + (dc.capacity.type || '') + ') |');
                    } else if (dc.capacity) {
                        md.push('| Capacity Disks | ' + dc.capacity.count + 'x ' + (dc.capacity.sizeGB >= 1024 ? (dc.capacity.sizeGB / 1024).toFixed(1) + ' TB' : dc.capacity.sizeGB + ' GB') + ' (' + (dc.capacity.type || '') + ') |');
                    }
                }
            }
            if (hw.resiliency) {
                const resLabel = hw.resiliency === '3way' ? 'Three-way Mirror' :
                    hw.resiliency === '2way' ? 'Two-way Mirror' :
                        hw.resiliency === 'simple' ? 'Simple' : (hw.resiliency || '-');
                md.push('| Storage Resiliency | ' + resLabel + ' |');
            }
            if (hw.futureGrowth && hw.futureGrowth !== '0') {
                md.push('| Future Growth | ' + hw.futureGrowth + '% |');
            }
            if (hw.clusterType) {
                const ctLabels = { 'single': 'Single Node', 'standard': 'Standard Cluster', 'rack-aware': 'Rack Aware Cluster' };
                md.push('| Cluster Type | ' + (ctLabels[hw.clusterType] || hw.clusterType) + ' |');
            }
            if (hw.workloadSummary) {
                const ws = hw.workloadSummary;
                md.push('| Workloads | ' + (ws.count || 0) + ' |');
                md.push('| Total vCPUs Required | ' + (ws.totalVcpus || 0) + ' |');
                md.push('| Total Memory Required | ' + (ws.totalMemoryGB || 0) + ' GB |');
                md.push('| Total Storage Required | ' + (ws.totalStorageTB || 0) + ' TB |');
            }
            md.push('');
        }

        // Sizer Workloads (individual workload details from Sizer)
        if (Array.isArray(s.sizerWorkloads) && s.sizerWorkloads.length > 0) {
            const typeLabels = { 'vm': 'Azure Local VMs', 'aks': 'AKS Arc Cluster', 'avd': 'Azure Virtual Desktop', 'foundry': 'Foundry Local', 'edgerag': 'Edge RAG', 'videoindexer': 'AI Video Indexer' };
            const avdProfileLabels = { 'light': 'Light', 'medium': 'Medium', 'heavy': 'Heavy', 'power': 'Power', 'custom': 'Custom' };
            const foundryClassLabels = { 'small': 'Small SLM', 'medium': 'Medium SLM', 'large': 'Large LLM', 'custom': 'Custom' };
            md.push('## Workloads (from Sizer)');
            md.push('');
            for (let wi = 0; wi < s.sizerWorkloads.length; wi++) {
                const wl = s.sizerWorkloads[wi];
                const wlLabel = wl.name || typeLabels[wl.type] || wl.type;
                md.push('### ' + wlLabel + ' (' + (typeLabels[wl.type] || wl.type) + ')');
                md.push('');
                md.push('| Setting | Value |');
                md.push('|---------|-------|');
                if (wl.type === 'vm') {
                    md.push('| VM Count | ' + (wl.count || 0) + ' |');
                    md.push('| vCPUs per VM | ' + (wl.vcpusPerVm || 0) + ' |');
                    md.push('| Memory per VM | ' + (wl.memoryPerVmGB || 0) + ' GB |');
                    md.push('| Storage per VM | ' + (wl.storagePerVmGB || 0) + ' GB |');
                } else if (wl.type === 'aks') {
                    md.push('| Clusters | ' + (wl.clusterCount || 0) + ' |');
                    md.push('| Control Plane | ' + (wl.controlPlaneNodes || 0) + ' nodes × ' + (wl.controlPlaneVcpus || 0) + ' vCPU / ' + (wl.controlPlaneMemory || 0) + ' GB |');
                    md.push('| Workers | ' + (wl.workerNodes || 0) + ' nodes × ' + (wl.workerVcpus || 0) + ' vCPU / ' + (wl.workerMemory || 0) + ' GB / ' + (wl.workerStorage || 0) + ' GB |');
                } else if (wl.type === 'avd') {
                    md.push('| Users | ' + (wl.userCount || 0) + ' |');
                    md.push('| Profile | ' + (avdProfileLabels[wl.profile] || wl.profile || '-') + ' |');
                    md.push('| Session Type | ' + (wl.sessionType === 'single' ? 'Single-session' : 'Multi-session') + ' |');
                    if (wl.sessionType !== 'single') {
                        md.push('| Concurrency | ' + (wl.concurrency || 100) + '% |');
                    }
                    if (wl.fslogix) {
                        md.push('| FSLogix | ' + (wl.fslogixSize || 30) + ' GB per user |');
                    }
                    if (wl.profile === 'custom') {
                        md.push('| Custom Spec | ' + (wl.customVcpus || 0) + ' vCPU / ' + (wl.customMemory || 0) + ' GB / ' + (wl.customStorage || 0) + ' GB per user |');
                    }
                } else if (wl.type === 'foundry') {
                    md.push('| Model Class | ' + (foundryClassLabels[wl.modelClass] || wl.modelClass || '-') + ' |');
                    md.push('| Replicas | ' + (wl.replicas || 1) + ' |');
                    md.push('| Inference Engine | ' + (wl.engine === 'vllm' ? 'vLLM (GPU only)' : 'ONNX-GenAI (CPU or GPU)') + ' |');
                    if (wl.modelClass === 'custom') {
                        md.push('| Custom Spec | ' + (wl.customVcpus || 0) + ' vCPU / ' + (wl.customMemory || 0) + ' GB / ' + (wl.customStorage || 0) + ' GB per replica |');
                    }
                } else if (wl.type === 'edgerag') {
                    md.push('| Compute Mode | ' + (wl.computeMode === 'cpu' ? 'CPU mode (≤ 5 MB per file)' : 'GPU mode (recommended, ≤ 30 MB per file)') + ' |');
                    md.push('| Worker VMs | 4 (' + (wl.computeMode === 'cpu' ? '8 vCPU / 32 GB / 200 GB OS each' : 'NC8_A2 / NC8_A16 — 8 vCPU / 32 GB / 1 GPU / 200 GB OS each') + ') |');
                    md.push('| Document Corpus | ' + (wl.corpusGB || 0) + ' GB |');
                } else if (wl.type === 'videoindexer') {
                    const viIsMin = wl.configuration === 'minimum';
                    md.push('| Configuration | ' + (viIsMin ? 'Minimum (1 worker)' : 'Recommended (2 workers, HA)') + ' |');
                    md.push('| Cluster-wide compute | ' + (viIsMin ? '32 vCPU / 64 GB' : '64 vCPU / 256 GB') + ' |');
                    md.push('| PV storage | ' + (viIsMin ? '50 GB (ReadWriteMany)' : '100 GB (ReadWriteMany)') + ' |');
                }
                md.push('| **Subtotal** | ' + (wl.totalVcpus || 0) + ' vCPUs · ' + (wl.totalMemoryGB || 0) + ' GB memory · ' + (wl.totalStorageGB >= 1024 ? (wl.totalStorageGB / 1024).toFixed(1) + ' TB' : (wl.totalStorageGB || 0) + ' GB') + ' storage |');
                md.push('');
            }
        }

        // Host Networking
        md.push('## Host Networking');
        md.push('');
        md.push('| Setting | Value |');
        md.push('|---------|-------|');
        if (s.storage) md.push('| Storage | ' + (s.storage.charAt(0).toUpperCase() + s.storage.slice(1)) + ' |');
        if (s.ports) md.push('| Ports | ' + s.ports + ' |');
        if (s.intent) md.push('| Intent | ' + formatIntent(s.intent) + ' |');
        if (s.storageAutoIp) md.push('| Storage Auto IP | ' + (s.storageAutoIp === 'enabled' ? 'Enabled' : 'Disabled') + ' |');
        // Storage Subnets
        if (s.storageAutoIp === 'enabled') {
            md.push('| Storage Subnets | Default Network ATC (10.71.0.0/16) - IPs assigned automatically |');
        } else if (s.storageAutoIp === 'disabled' && Array.isArray(s.customStorageSubnets) && s.customStorageSubnets.length > 0) {
            const validSubnets = s.customStorageSubnets.filter(function(sub) { return sub && String(sub).trim(); });
            if (validSubnets.length > 0) {
                md.push('| Storage Subnets | `' + validSubnets.join(', ') + '` |');
            }
        }
        if (s.storagePoolConfiguration) {
            const spConfig = s.storagePoolConfiguration === 'InfraOnly' ? 'Infrastructure Only' :
                s.storagePoolConfiguration === 'KeepStorage' ? 'Keep Existing Storage' : 'Express';
            md.push('| Storage Pool Configuration | ' + spConfig + ' |');
        }
        if (s.torSwitchCount) md.push('| ToR Switch Count | ' + (s.torSwitchCount === '1' ? 'Single' : 'Dual') + ' |');
        md.push('');

        // Port Configuration
        if (Array.isArray(s.portConfig) && s.portConfig.length > 0) {
            md.push('### Port Configuration');
            md.push('');
            md.push('| Port | Speed | RDMA |');
            md.push('|------|-------|------|');
            s.portConfig.forEach(function(pc, idx) {
                const name = (pc && pc.customName) ? pc.customName : ('Port ' + (idx + 1));
                const speed = (pc && pc.speed) ? pc.speed : '-';
                const rdma = (pc && pc.rdma) ? 'Yes' : 'No';
                md.push('| ' + name + ' | ' + speed + ' | ' + rdma + ' |');
            });
            md.push('');
        }

        // Host Networking Diagram
        if (diagrams && diagrams.host) {
            md.push('### Host Networking Diagram');
            md.push('');
            md.push('![Host Networking Diagram](' + diagrams.host + ')');
            md.push('');
        }

        // AKS Arc Network Requirements — always shown in the report.
        // Even Designer-only users (no Sizer workloads) may add AKS Arc to
        // their cluster later, so the port table + docs link is always
        // useful. The native AKS Arc workload, Foundry Local, Edge RAG, and
        // AI Video Indexer all run on AKS Arc and inherit these requirements.
        {
            md.push('## AKS Arc Network Requirements');
            md.push('');
            md.push('[AKS Arc network & port requirements documentation](https://learn.microsoft.com/en-us/azure/aks/aksarc/network-system-requirements#network-port-and-cross-vlan-requirements)');
            md.push('');
            md.push('| Source | Destination | Port | Description |');
            md.push('|--------|-------------|------|-------------|');
            md.push('| Management network IPs | AKS Arc VM logical network | 22 | Log collection for troubleshooting |');
            md.push('| Management network IPs | AKS Arc VM logical network | 6443 | Kubernetes API communication |');
            md.push('| AKS Arc VM logical network | Cluster IP address | 55000 | Cloud Agent gRPC server |');
            md.push('| AKS Arc VM logical network | Cluster IP address | 65000 | Cloud Agent gRPC authentication |');
            md.push('');
            md.push('> If using separate VLANs, bi-directional cross-VLAN connectivity is required between management network and AKS Arc VM logical network for all ports above.');
            md.push('');
        }

        // Infrastructure Network
        md.push('## Infrastructure Network');
        md.push('');
        md.push('| Setting | Value |');
        md.push('|---------|-------|');
        if (s.ip) md.push('| IP Assignment | ' + (s.ip.charAt(0).toUpperCase() + s.ip.slice(1)) + ' |');
        if (s.infraVlan) md.push('| VLAN | ' + (s.infraVlan === 'custom' ? 'Custom VLAN' : 'Default VLAN') + ' |');
        if (s.infraVlan === 'custom' && s.infraVlanId) md.push('| VLAN ID | ' + s.infraVlanId + ' |');
        if (s.infraCidr) md.push('| Infrastructure CIDR | `' + escapeMd(s.infraCidr) + '` |');
        if (s.infra && s.infra.start && s.infra.end) md.push('| IP Pool Range | `' + escapeMd(s.infra.start) + ' - ' + escapeMd(s.infra.end) + '` |');
        if (s.infraGateway) md.push('| Default Gateway | `' + escapeMd(s.infraGateway) + '` |');
        if (s.scenario === 'disconnected' && (s.applianceIp1 || s.applianceIp2)) {
            const ipPartsInfra = [];
            if (s.applianceIp1) ipPartsInfra.push('Ingress vNIC: ' + escapeMd(s.applianceIp1));
            if (s.applianceIp2) ipPartsInfra.push('Mgmt vNIC: ' + escapeMd(s.applianceIp2));
            md.push('| Appliance IPs | `' + ipPartsInfra.join(' \u00B7 ') + '` |');
        }
        md.push('');

        // Node Settings
        if (Array.isArray(s.nodeSettings) && s.nodeSettings.length > 0) {
            md.push('### Node Configuration');
            md.push('');
            md.push('| Node | Name | IP Address |');
            md.push('|------|------|------------|');
            s.nodeSettings.forEach(function(node, idx) {
                const name = (node && node.name) ? node.name : ('node' + (idx + 1));
                let ip = '-';
                if (node && node.ipCidr) {
                    ip = String(node.ipCidr).split('/')[0];
                } else if (node && node.ip) {
                    ip = node.ip;
                }
                md.push('| ' + (idx + 1) + ' | ' + name + ' | `' + ip + '` |');
            });
            md.push('');
        }

        // Active Directory / Identity
        md.push('## Identity');
        md.push('');
        md.push('| Setting | Value |');
        md.push('|---------|-------|');
        if (s.activeDirectory) md.push('| Identity Type | ' + (s.activeDirectory === 'azure_ad' ? 'Active Directory' : 'Local Identity') + ' |');
        if (s.adDomain) md.push('| AD Domain | `' + escapeMd(s.adDomain) + '` |');
        if (s.adOuPath) md.push('| OU Path | `' + escapeMd(s.adOuPath) + '` |');
        if (s.adfsServerName) md.push('| ADFS Server Name | `' + escapeMd(s.adfsServerName) + '` |');
        if (Array.isArray(s.dnsServers) && s.dnsServers.length > 0) {
            const dnsStr = s.dnsServers.filter(function(d) { return d && d.trim(); }).join(', ');
            if (dnsStr) md.push('| DNS Servers | `' + escapeMd(dnsStr) + '` |');
        }
        if (s.localDnsZone) md.push('| Local DNS Zone | `' + escapeMd(s.localDnsZone) + '` |');
        md.push('');

        // Security Configuration
        if (s.securityConfiguration) {
            md.push('## Security Configuration');
            md.push('');
            md.push('| Setting | Value |');
            md.push('|---------|-------|');
            md.push('| Configuration | ' + (s.securityConfiguration === 'recommended' ? 'Recommended' : 'Customized') + ' |');
            // Always list all 7 controls. Recommended mode = all enforced (matches wizard
            // defaults); Customized mode reflects the user's per-control selections.
            const sec = (s.securityConfiguration === 'customized' && s.securitySettings) ? s.securitySettings : null;
            const secOn = function(key) { return sec ? (sec[key] !== undefined ? sec[key] : true) : true; };
            md.push('| WDAC | ' + (secOn('wdacEnforced') ? 'Enabled' : 'Disabled') + ' |');
            md.push('| Credential Guard | ' + (secOn('credentialGuardEnforced') ? 'Enabled' : 'Disabled') + ' |');
            md.push('| Drift Control | ' + (secOn('driftControlEnforced') ? 'Enabled' : 'Disabled') + ' |');
            md.push('| SMB Signing | ' + (secOn('smbSigningEnforced') ? 'Enabled' : 'Disabled') + ' |');
            md.push('| SMB Cluster Encryption | ' + (secOn('smbClusterEncryption') ? 'Enabled' : 'Disabled') + ' |');
            md.push('| BitLocker Boot Volume | ' + (secOn('bitlockerBootVolume') ? 'Enabled' : 'Disabled') + ' |');
            md.push('| BitLocker Data Volumes | ' + (secOn('bitlockerDataVolumes') ? 'Enabled' : 'Disabled') + ' |');
            md.push('');
        }

        // Software Defined Networking
        if ((s.sdnFeatures && s.sdnFeatures.length > 0) || s.sdnManagement) {
            md.push('## Software Defined Networking');
            md.push('');
            md.push('| Setting | Value |');
            md.push('|---------|-------|');
            if (s.sdnFeatures && s.sdnFeatures.length > 0) md.push('| SDN Features | ' + s.sdnFeatures.join(', ') + ' |');
            if (s.sdnManagement) md.push('| SDN Management | ' + (s.sdnManagement === 'arc_managed' ? 'Arc Managed' : 'On-Premises Managed') + ' |');
            md.push('');
        }

        // ── Validation Summary ──
        const validations = computeValidations(s);
        const allChecks = validations.results || [];
        const passCount = allChecks.filter(function(x) { return x.passed; }).length;
        const failCount = allChecks.length - passCount;

        md.push('## Validation Summary');
        md.push('');
        md.push('**Passed:** ' + passCount + ' &nbsp; **Warnings/Failures:** ' + failCount);
        md.push('');

        if (allChecks.length > 0) {
            md.push('| Status | Check | Details |');
            md.push('|--------|-------|---------|');
            allChecks.forEach(function(v) {
                const mark = v.passed ? '✅' : '⚠️';
                const details = v.details ? v.details.replace(/\|/g, function() { return '\\|'; }) : '';
                const name = v.name ? v.name.replace(/\|/g, function() { return '\\|'; }) : '';
                md.push('| ' + mark + ' | ' + name + ' | ' + details + ' |');
            });
            md.push('');
        }

        // ── Decisions & Rationale ──
        md.push('## Decisions & Rationale');
        md.push('');

        // Deployment Scenario
        md.push('### Deployment Scenario');
        md.push('');
        md.push('**Selected:** ' + formatScenario(s.scenario, s));
        if (s.scenario === 'hyperconverged') {
            md.push('');
            md.push('**Why it matters:** Single-rack, consolidated compute/storage. Enables Low Capacity or Standard flows.');
        } else if (s.scenario === 'disconnected') {
            md.push('');
            md.push('**Why it matters:** Air-gapped deployments constrain outbound connectivity and management options.');
            md.push('');
            md.push('**Wizard logic:** Disconnected mode disables cloud-specific selections that require internet access.');
        } else if (s.scenario === 'm365local') {
            md.push('');
            md.push('**Why it matters:** Microsoft 365 Local deployments are optimized for Microsoft 365 workloads with high availability requirements.');
            md.push('');
            md.push('**Wizard logic:** Microsoft 365 Local requires a minimum of 9 physical nodes. Supports Standard scale configuration only.');
        }
        md.push('');

        // Azure Cloud & Region (or Autonomous Cloud for disconnected)
        if (s.scenario === 'disconnected' && s.clusterRole) {
            md.push('### Autonomous Cloud');
            md.push('');
            md.push('**Cluster Role:** ' + (s.clusterRole === 'management' ? 'Management Cluster' : 'Workload Cluster'));
            md.push('');
            md.push('**Autonomous Cloud FQDN:** ' + (s.autonomousCloudFqdn || 'Not configured'));
            md.push('');
            if (s.clusterRole === 'management' && (s.applianceIp1 || s.applianceIp2)) {
                const ipPartsRationale = [];
                if (s.applianceIp1) ipPartsRationale.push('Ingress vNIC: ' + s.applianceIp1);
                if (s.applianceIp2) ipPartsRationale.push('Mgmt vNIC: ' + s.applianceIp2);
                md.push('**Appliance IPs:** ' + ipPartsRationale.join(' · '));
                md.push('');
            }
            md.push('- Disconnected operations use an Autonomous Cloud FQDN instead of a public Azure cloud endpoint.');
            md.push('');
        } else {
            md.push('### Azure Cloud & Azure Local Region');
            md.push('');
            md.push('**Azure Cloud:** ' + formatCloud(s.region));
            md.push('');
            md.push('**Azure Local Instance Region:** ' + formatLocalInstanceRegion(s.localInstanceRegion));
            md.push('');
            const cloudNotes = [];
            cloudNotes.push('Your Azure cloud selection determines which endpoints, compliance boundaries, and region catalogs apply.');
            if (s.region === 'azure_commercial') {
                cloudNotes.push('Azure Local supported regions for Azure Public include: East US, South Central US, West Europe, Australia East, Southeast Asia, India Central, Canada Central, Japan East.');
            } else if (s.region === 'azure_government') {
                cloudNotes.push('Azure Local supported regions for Azure Government include: US Gov Virginia.');
            }
            cloudNotes.forEach(function(n) { md.push('- ' + n); });
            md.push('');
        }

        // Scale & Nodes
        md.push('### Scale & Nodes');
        md.push('');
        md.push('**Scale:** ' + formatScale(s.scale));
        md.push('');
        md.push('**Nodes:** ' + (s.nodes || '-'));
        md.push('');
        const scaleNotes = [];
        if (s.scale === 'low_capacity') scaleNotes.push('Low Capacity targets smaller deployments and limits certain network intent combinations.');
        if (s.scale === 'rack_aware') scaleNotes.push('Rack Aware is designed for multi-room / split-rack node placement.');
        if (s.scenario === 'disconnected') scaleNotes.push('Disconnected mode typically enforces Standard scale constraints.');
        if (scaleNotes.length) {
            scaleNotes.forEach(function(n) { md.push('- ' + n); });
            md.push('');
        }

        // Storage & Ports
        md.push('### Storage & Ports');
        md.push('');
        md.push('**Storage:** ' + (s.storage ? (s.storage.charAt(0).toUpperCase() + s.storage.slice(1)) : '-'));
        md.push('');
        md.push('**Ports per node:** ' + (s.ports || '-'));
        md.push('');
        const storageNotes = [];
        if (s.storage === 'switchless') {
            storageNotes.push('Switchless storage typically reduces the number of storage networks and impacts intent options.');
            storageNotes.push('Switchless storage is generally intended for smaller clusters; larger clusters require switched storage connectivity.');
        }
        if (String(s.ports) === '4') storageNotes.push('With 4 ports, the wizard disables Custom intent (insufficient ports for flexible mapping).');
        if (storageNotes.length) {
            storageNotes.forEach(function(n) { md.push('- ' + n); });
            md.push('');
        }

        // Traffic Intent & Adapter Mapping
        md.push('### Traffic Intent & Adapter Mapping');
        md.push('');
        md.push('**Intent:** ' + formatIntent(s.intent));
        md.push('');
        const intentNotes = [];
        if (s.intent === 'all_traffic') intentNotes.push('Fully converged simplifies adapter mapping but combines all traffic types into one SET team.');
        if (s.intent === 'mgmt_compute') intentNotes.push('Splits storage traffic away from mgmt/compute to reduce contention and isolate storage behavior.');
        if (s.intent === 'compute_storage') intentNotes.push('Keeps management isolated while converging compute+storage.');
        if (s.intent === 'custom') intentNotes.push('Custom intent allows manual adapter assignment.');
        if (intentNotes.length) {
            intentNotes.forEach(function(n) { md.push('- ' + n); });
            md.push('');
        }

        // Outbound, Arc, Proxy & Private Endpoints
        md.push('### Outbound, Arc, Proxy & Private Endpoints');
        md.push('');
        md.push('**Outbound:** ' + formatOutbound(s.outbound));
        md.push('');
        md.push('**Arc Gateway:** ' + (s.arc === 'arc_gateway' ? 'Enabled (Recommended)' : (s.arc === 'no_arc' ? 'Disabled' : '-')));
        md.push('');
        md.push('**Proxy:** ' + (s.proxy === 'no_proxy' ? 'Disabled' : (s.proxy ? 'Enabled' : '-')));
        md.push('');
        md.push('**Private Endpoints:** ' + (s.privateEndpoints === 'pe_enabled' ? 'Enabled (' + (s.privateEndpointsList ? s.privateEndpointsList.length : 0) + ' services)' : (s.privateEndpoints === 'pe_disabled' ? 'Disabled' : '-')));
        md.push('');
        if (s.scenario === 'disconnected') {
            md.push('**Network Requirements:** [Plan your network for disconnected operations](https://learn.microsoft.com/azure/azure-local/manage/disconnected-operations-network)');
            md.push('');
        } else if (s.arc || s.localInstanceRegion) {
            const fwInfoRat = getFirewallEndpointInfo(s);
            md.push('**Firewall Allow List Endpoint Requirements:** [' + fwInfoRat.label + '](' + fwInfoRat.url + ')');
            md.push('');
        }
        const outboundNotes = [];
        if (s.outbound === 'private') {
            outboundNotes.push('Private outbound assumes controlled egress via firewall/proxy; the wizard forces Arc Gateway + explicit proxy behavior.');
            outboundNotes.push('With Arc Gateway, the node-side Arc proxy establishes a secure HTTPS tunnel to an Azure-hosted Arc Gateway public endpoint.');
            outboundNotes.push('Proxy bypass lists need to include node IPs, cluster IP, and infrastructure IPs/subnet.');
        } else if (s.outbound === 'public') {
            outboundNotes.push('Public outbound allows direct access to required endpoints (subject to firewall allow-listing).');
        }
        if (outboundNotes.length) {
            outboundNotes.forEach(function(n) { md.push('- ' + n); });
            md.push('');
        }

        // Proxy Bypass String
        if (s.proxy === 'proxy') {
            const bypassItems = ['localhost', '127.0.0.1'];
            if (s.nodeSettings && s.nodeSettings.length) {
                s.nodeSettings.forEach(function(node) {
                    if (node && node.name) bypassItems.push(node.name);
                });
                s.nodeSettings.forEach(function(node) {
                    if (node && node.ipCidr) {
                        const ip = node.ipCidr.split('/')[0];
                        if (ip) bypassItems.push(ip);
                    }
                });
            }
            if (s.adDomain) bypassItems.push('*.' + s.adDomain);
            if (s.infraCidr) {
                const infraWild = convertCidrToWildcard(s.infraCidr);
                if (infraWild) bypassItems.push(infraWild);
            }
            if (s.privateEndpoints === 'pe_enabled' && s.privateEndpointsList && s.privateEndpointsList.length > 0) {
                s.privateEndpointsList.forEach(function(peKey) {
                    const info = PRIVATE_ENDPOINT_INFO[peKey];
                    if (info && info.proxyBypass) {
                        info.proxyBypass.forEach(function(bypass) {
                            if (bypassItems.indexOf(bypass) === -1) bypassItems.push(bypass);
                        });
                    }
                });
            }
            md.push('**Minimum Proxy Bypass String:**');
            md.push('');
            md.push('```');
            md.push(bypassItems.join(','));
            md.push('```');
            md.push('');
            md.push('> Add this bypass string to your Arc registration script. You may also need to add a cluster name and any additional internal resources.');
            md.push('');
        }

        // Private Endpoints details
        if (s.privateEndpoints === 'pe_enabled' && s.privateEndpointsList && s.privateEndpointsList.length > 0) {
            md.push('#### Private Endpoints Configuration');
            md.push('');
            md.push('| Service | FQDN | Private Link Zone |');
            md.push('|---------|------|-------------------|');
            s.privateEndpointsList.forEach(function(peKey) {
                const info = PRIVATE_ENDPOINT_INFO[peKey];
                if (info) {
                    md.push('| ' + info.icon + ' ' + info.name + ' | `' + info.fqdn + '` | `' + info.privateLink + '` |');
                }
            });
            md.push('');

            // Show individual PE considerations
            s.privateEndpointsList.forEach(function(peKey) {
                const info = PRIVATE_ENDPOINT_INFO[peKey];
                if (info && info.considerations && info.considerations.length > 0) {
                    md.push('**' + info.icon + ' ' + info.name + ' Considerations:**');
                    md.push('');
                    info.considerations.forEach(function(c) { md.push('- ' + c); });
                    md.push('');
                }
            });
        }

        // IP, Infrastructure Network & VLAN
        md.push('### IP, Infrastructure Network & VLAN');
        md.push('');
        md.push('**IP:** ' + (s.ip ? (s.ip.charAt(0).toUpperCase() + s.ip.slice(1)) : '-'));
        md.push('');
        md.push('**Infra VLAN:** ' + (s.infraVlan === 'custom' ? 'Custom VLAN' : (s.infraVlan === 'default' ? 'Default VLAN' : (s.infraVlan || '-'))));
        if (s.infraVlan === 'custom' && s.infraVlanId) {
            md.push('');
            md.push('**Infra VLAN ID:** `' + s.infraVlanId + '`');
        }
        if (s.infraCidr) {
            md.push('');
            md.push('**Infra Network:** `' + s.infraCidr + '`');
        }
        if (s.infra && s.infra.start && s.infra.end) {
            md.push('');
            md.push('**Infra Range:** `' + s.infra.start + ' - ' + s.infra.end + '`');
        }
        md.push('');
        const mgmtNotes = [
            'Management IP strategy affects provisioning workflow and long-term operations.',
            'Infrastructure VLAN selection ensures consistent reachability to Arc registration and management endpoints.',
            'Management VLAN tagging (when required) must be configured on the physical adapters before Azure Arc registration.',
            'The infrastructure IP pool is designed for cluster infrastructure services; size it with headroom if you expect additional services later.'
        ];
        mgmtNotes.forEach(function(n) { md.push('- ' + n); });
        md.push('');

        // Identity & DNS
        md.push('### Identity & DNS');
        md.push('');
        md.push('**Identity:** ' + (s.activeDirectory === 'azure_ad' ? 'Active Directory' : (s.activeDirectory === 'local_identity' ? 'Local Identity' : '-')));
        if (s.adDomain) { md.push(''); md.push('**AD Domain:** `' + s.adDomain + '`'); }
        if (s.dnsServers && s.dnsServers.length) { md.push(''); md.push('**DNS Servers:** `' + s.dnsServers.join(', ') + '`'); }
        if (s.localDnsZone) { md.push(''); md.push('**Local DNS Zone:** `' + s.localDnsZone + '`'); }
        md.push('');
        const idNotes = [];
        if (s.activeDirectory === 'azure_ad') idNotes.push('Domain-joined deployments require correct AD DNS resolution and domain membership planning.');
        if (s.activeDirectory === 'local_identity') idNotes.push('Local Identity mode typically requires a local DNS zone for name resolution within the environment.');
        if (s.dnsServers && s.dnsServers.length) {
            idNotes.push('DNS settings are a critical dependency for deployment and ongoing management; ensure your chosen DNS resolvers remain reachable.');
            idNotes.push('Azure Local guidance states DNS server IPs used by nodes are not supported to change after deployment.');
        }
        if (idNotes.length) {
            idNotes.forEach(function(n) { md.push('- ' + n); });
            md.push('');
        }

        // SDN Rationale
        md.push('### Software Defined Networking (SDN)');
        md.push('');
        md.push('**Features:** ' + ((s.sdnFeatures && s.sdnFeatures.length) ? s.sdnFeatures.join(', ') : 'None'));
        md.push('');
        md.push('**Management:** ' + (s.sdnManagement ? (s.sdnManagement === 'arc_managed' ? 'Arc Managed' : 'On-Premises Managed') : 'Not applicable'));
        md.push('');
        if (s.sdnFeatures && s.sdnFeatures.length) {
            md.push('- SDN features require a management model decision (Arc-managed vs on-prem tooling).');
        } else {
            md.push('- No SDN features selected; SDN management is not required.');
        }
        md.push('');

        // Footer
        md.push('---');
        md.push('');
        md.push('*Generated by ODIN for Azure Local - ' + new Date().toISOString() + '*');

        return md.join('\n');
    }

    function triggerMarkdownDownload(content) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const ts = new Date();
        const pad2 = function(n) { return n < 10 ? '0' + n : String(n); };
        const fileName = 'AzureLocal-Config-'
            + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate())
            + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes())
            + '.md';

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }

    function downloadReportMarkdown() {
        try {
            if (!CURRENT_REPORT_STATE) return;
            const s = CURRENT_REPORT_STATE;

            // Collect diagram PNG data URLs first (async), then build markdown
            const diagramPromises = [];

            // Host Networking diagram (SVG rendered in page)
            const hostSec = document.querySelector('#report-summary [data-summary-section="host-networking"]');
            const hostSvg = hostSec ? hostSec.querySelector('svg.switchless-diagram__svg') : null;
            if (hostSvg) {
                diagramPromises.push(
                    svgElementToPngDataUrl(hostSvg, { theme: 'dark', background: '#000000', scale: 2 })
                        .then(function(url) { return { key: 'host', url: url }; })
                        .catch(function() { return { key: 'host', url: null }; })
                );
            } else {
                diagramPromises.push(Promise.resolve({ key: 'host', url: null }));
            }

            // Outbound connectivity diagram
            // Draw.io SVGs contain <foreignObject> + <switch> patterns that taint the
            // canvas when drawn from an <img> element.  The proven fix is to parse the
            // SVG into a DOM element and run it through svgElementToPngDataUrl() which
            // sanitises the tree (removes foreignObject, flattens <switch> to <image>
            // fallbacks) before rasterising — the exact same path used for the host
            // networking diagram.
            const outboundDiagKey = getOutboundDiagramKey(s);
            if (outboundDiagKey && OUTBOUND_DIAGRAMS[outboundDiagKey]) {
                diagramPromises.push(new Promise(function(resolve) {
                    try {
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', OUTBOUND_DIAGRAMS[outboundDiagKey], true);
                        xhr.onload = function() {
                            if (xhr.status === 200 || xhr.status === 0) {
                                const svgText = xhr.responseText;
                                if (svgText && svgText.indexOf('<svg') !== -1) {
                                    try {
                                        const parser = new DOMParser();
                                        const doc = parser.parseFromString(svgText, 'image/svg+xml');
                                        const svgEl = doc.querySelector('svg');
                                        if (svgEl) {
                                            svgElementToPngDataUrl(svgEl, { theme: 'dark', background: '#000000', scale: 2 })
                                                .then(function(url) { resolve({ key: 'outbound', url: url }); })
                                                .catch(function() { resolve({ key: 'outbound', url: null }); });
                                        } else {
                                            console.warn('Outbound diagram: no <svg> element in parsed response');
                                            resolve({ key: 'outbound', url: null });
                                        }
                                    } catch (parseErr) {
                                        console.warn('Outbound diagram: parse error', parseErr.message);
                                        resolve({ key: 'outbound', url: null });
                                    }
                                } else {
                                    console.warn('Outbound diagram: XHR response is not SVG');
                                    resolve({ key: 'outbound', url: null });
                                }
                            } else {
                                console.warn('Outbound diagram: XHR status', xhr.status);
                                resolve({ key: 'outbound', url: null });
                            }
                        };
                        xhr.onerror = function() {
                            console.warn('Outbound diagram: XHR network error');
                            resolve({ key: 'outbound', url: null });
                        };
                        xhr.send();
                    } catch (e) {
                        console.warn('Outbound diagram XHR error:', e.message);
                        resolve({ key: 'outbound', url: null });
                    }
                }));
            } else {
                diagramPromises.push(Promise.resolve({ key: 'outbound', url: null }));
            }

            Promise.all(diagramPromises).then(function(diagramResults) {
                const diagrams = {};
                diagramResults.forEach(function(d) { diagrams[d.key] = d.url; });
                const content = buildMarkdownContent(s, diagrams);
                triggerMarkdownDownload(content);
            }).catch(function(err) {
                console.error('Markdown diagram error, exporting without diagrams:', err);
                const content = buildMarkdownContent(s, {});
                triggerMarkdownDownload(content);
            });
        } catch (e) {
            console.error('Markdown export error:', e);
        }
    }


    // Helper: get disaggregated port list for report rendering (top-level for drawio + diagram access)
    // Port IDs must match wizard format (ocp_p1, pcie1_p2, etc.) for config lookups
    function getDisaggPortListForReport(storageType, backupEnabled, portCount) {
        const ports = [
            { id: 'ocp_p1', defaultName: 'OCP-NIC1', slot: 'ocp' },
            { id: 'ocp_p2', defaultName: 'OCP-NIC2', slot: 'ocp' },
            { id: 'pcie1_p1', defaultName: 'PCIe1-NIC3', slot: 'pcie1' },
            { id: 'pcie1_p2', defaultName: 'PCIe1-NIC4', slot: 'pcie1' }
        ];
        if (storageType === 'iscsi_6nic') {
            ports.push({ id: 'pcie2_p1', defaultName: 'PCIe2-NIC5', slot: 'pcie2' });
            ports.push({ id: 'pcie2_p2', defaultName: 'PCIe2-NIC6', slot: 'pcie2' });
        }
        if (backupEnabled && storageType === 'fc_san') {
            ports.push({ id: 'backup_p1', defaultName: 'BK-NIC1', slot: 'backup' });
            ports.push({ id: 'backup_p2', defaultName: 'BK-NIC2', slot: 'backup' });
        }
        ports.push({ id: 'bmc_p1', defaultName: 'BMC', slot: 'bmc' });
        return ports;
    }

    /**
     * Generate a draw.io (mxGraph XML) diagram from the current report state.
     * Mirrors the SVG diagram layout: ToR switches, nodes with intent-grouped ports, uplinks.
     * Produces an XML string compatible with draw.io / diagrams.net / app.diagrams.net.
     * @param {Object} s - The report state object
     * @returns {string} draw.io XML string, or empty string if insufficient state
     */
    function generateHostNetworkingDrawio(s) {
        if (!s || !s.ports || !s.intent) return '';
        let ports = parseInt(s.ports, 10) || 0;
        if (ports <= 0) return '';

        const nAll = parseInt(s.nodes === '16+' ? 16 : s.nodes, 10) || 1;
        const isSingleNode = nAll === 1;
        const n = Math.min(nAll, 4);
        const isSwitchless = s.storage === 'switchless';
        const showTorSwitches = !isSwitchless;
        const torCount = isSingleNode ? 1 : ((s.torSwitchCount === 'single') ? 1 : 2);

        const intent = s.intent;

        // --- Port classification (mirrors SVG logic) ---
        const hasAdapterMapping = s.adapterMappingConfirmed && s.adapterMapping && Object.keys(s.adapterMapping).length > 0;

        function getTraffic(portIdx) {
            const nic = portIdx + 1;
            if (!intent) return [];
            if (hasAdapterMapping && s.adapterMapping[nic]) {
                const m = s.adapterMapping[nic];
                if (m === 'mgmt') return ['m', 'c'];
                if (m === 'compute' || m === 'compute_1' || m === 'compute_2') return ['c'];
                if (m === 'storage') return ['s'];
                if (m === 'mgmt_compute') return ['m', 'c'];
                if (m === 'compute_storage') return ['c', 's'];
                if (m === 'all') return ['m', 'c', 's'];
                if (m === 'pool') return ['m', 'c'];
                return [];
            }
            if (intent === 'all_traffic') return ['m', 'c', 's'];
            if (intent === 'mgmt_compute') {
                if (ports === 2) return portIdx === 0 ? ['m', 'c'] : ['s'];
                return portIdx < 2 ? ['m', 'c'] : ['s'];
            }
            if (intent === 'compute_storage') {
                return portIdx < 2 ? ['m'] : ['c', 's'];
            }
            if (intent === 'custom') {
                const val = (s.customIntents && s.customIntents[nic]) || 'unused';
                if (val === 'mgmt') return ['m'];
                if (val === 'compute' || val === 'compute_1' || val === 'compute_2') return ['c'];
                if (val === 'storage') return ['s'];
                if (val === 'mgmt_compute') return ['m', 'c'];
                if (val === 'compute_storage') return ['c', 's'];
                if (val === 'all') return ['m', 'c', 's'];
                return [];
            }
            return [];
        }

        // Classify ports
        let mgmtPorts = [];
        let storPorts = [];
        for (let pi = 0; pi < ports; pi++) {
            const t = getTraffic(pi);
            const hasS = t.indexOf('s') >= 0;
            const hasM = t.indexOf('m') >= 0;
            const hasC = t.indexOf('c') >= 0;
            if (hasS && !hasM && !hasC) {
                storPorts.push(pi + 1);
            } else if (hasS) {
                storPorts.push(pi + 1);
                mgmtPorts.push(pi + 1);
            } else { // all_traffic: both
                mgmtPorts.push(pi + 1);
            }
        }
        // For all_traffic, all ports go to mgmtPorts only (one group)
        if (intent === 'all_traffic') {
            mgmtPorts = [];
            storPorts = [];
            for (let ai = 0; ai < ports; ai++) { mgmtPorts.push(ai + 1); }
        }

        // For switchless topologies, override to canonical port layout matching ODIN SVG diagrams:
        // Always 2 mgmt+compute ports + (n-1)*2 storage ports per node, regardless of user config.
        // 2-node: 2 storage (4 total), 3-node: 4 storage (6 total), 4-node: 6 storage (8 total).
        if (isSwitchless && n >= 2) {
            const storCount = (n - 1) * 2;
            ports = 2 + storCount;
            mgmtPorts = [1, 2];
            storPorts = [];
            for (let sp = 3; sp <= ports; sp++) storPorts.push(sp);
        }

        function getPortName(idx1) {
            if (typeof getPortCustomName === 'function') return getPortCustomName(s, idx1, 'nic');
            return 'NIC ' + idx1;
        }

        function xmlEsc(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        // --- Layout constants ---
        const torW = 160, torH = 50;
        const mgmtVnicAreaHD = 48;
        let nodeW = 300;
        const nodeH = 200 + mgmtVnicAreaHD;
        const portW = 56, portH = 34;
        const portGap = 10;
        const nodeGap = 60;
        const torGap = 80;
        const torToNodeGap = 100;
        const marginX = 60, marginY = 40;
        const intentBoxPad = 10;

        // Calculate node width based on port count
        const totalPortsW = ports * portW + (ports - 1) * portGap;
        if (totalPortsW + 40 > nodeW) nodeW = totalPortsW + 60;

        // Overall layout
        const totalNodesW = n * nodeW + (n - 1) * nodeGap;
        const svgW = Math.max(totalNodesW + marginX * 2, (torCount === 2 ? (2 * torW + torGap) : torW) + marginX * 2);
        const torY = marginY;
        const nodesY = showTorSwitches ? (torY + torH + torToNodeGap) : marginY;
        const nodesStartX = (svgW - totalNodesW) / 2;

        // --- Build cells ---
        const cells = [];
        let cellId = 2; // 0 and 1 are reserved by draw.io
        const edges = [];

        function addCell(id, value, x, y, w, h, style, parent) {
            cells.push({
                id: id,
                value: xmlEsc(value),
                x: Math.round(x),
                y: Math.round(y),
                w: Math.round(w),
                h: Math.round(h),
                style: style,
                parent: parent || '1'
            });
        }

        function addEdge(id, source, target, style) {
            edges.push({ id: id, source: source, target: target, style: style });
        }

        function nextId() { return String(cellId++); }

        // --- ToR switches ---
        let tor1Id = null, tor2Id = null;
        if (showTorSwitches) {
            const torTotalW = torCount === 2 ? (2 * torW + torGap) : torW;
            const torStartX = (svgW - torTotalW) / 2;

            tor1Id = nextId();
            addCell(tor1Id, 'ToR Switch 1', torStartX, torY, torW, torH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#444444;strokeColor=#666666;fontColor=#FFFFFF;fontSize=13;fontStyle=1;arcSize=20;');

            if (torCount === 2) {
                tor2Id = nextId();
                addCell(tor2Id, 'ToR Switch 2', torStartX + torW + torGap, torY, torW, torH,
                    'rounded=1;whiteSpace=wrap;html=1;fillColor=#444444;strokeColor=#666666;fontColor=#FFFFFF;fontSize=13;fontStyle=1;arcSize=20;');

                // MLAG/LAG link between ToRs
                const lagId = nextId();
                addEdge(lagId, tor1Id, tor2Id,
                    'endArrow=none;html=1;strokeColor=#3B82F6;strokeWidth=3;fontColor=#999999;fontSize=10;labelBackgroundColor=none;');
                // Add label
                edges[edges.length - 1].label = 'MLAG';
            }
        }

        // --- Nodes ---
        // Track storage port cell IDs and absolute positions for switchless mesh connections
        const storagePortIds = [];
        const storagePortAbsPos = [];
        for (let ni = 0; ni < n; ni++) {
            storagePortIds.push([]);
            storagePortAbsPos.push([]);
            const nodeX = nodesStartX + ni * (nodeW + nodeGap);
            const nodeY2 = nodesY;

            // Node container (group)
            const nodeContainerId = nextId();
            let nodeName = 'Node ' + (ni + 1);
            if (s.nodeSettings && s.nodeSettings[ni] && s.nodeSettings[ni].name) {
                nodeName = String(s.nodeSettings[ni].name).trim() || nodeName;
            }
            addCell(nodeContainerId, nodeName, nodeX, nodeY2, nodeW, nodeH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#1E3A5F;strokeColor=#3B82F6;fontColor=#FFFFFF;fontSize=14;fontStyle=1;arcSize=10;verticalAlign=top;spacingTop=8;container=1;collapsible=0;');

            // Determine intent groups for this node
            const groups = [];
            if (isSwitchless) {
                // Switchless always shows canonical layout: Mgmt+Compute (blue) + Storage (purple)
                groups.push({ label: 'Management + Compute', ports: [1, 2], color: 'blue' });
                groups.push({ label: 'Storage', ports: storPorts.slice(), color: 'purple' });
            } else if (intent === 'all_traffic') {
                groups.push({ label: 'Mgmt + Compute + Storage', ports: mgmtPorts, color: 'blue' });
            } else if (intent === 'mgmt_compute') {
                groups.push({ label: 'Management + Compute', ports: mgmtPorts.filter(function(p) { return storPorts.indexOf(p) < 0; }), color: 'blue' });
                if (storPorts.length > 0) groups.push({ label: 'Storage', ports: storPorts, color: 'purple' });
            } else if (intent === 'compute_storage') {
                const mcOnly = [];
                const csOnly = [];
                for (let ci = 0; ci < ports; ci++) {
                    const tt = getTraffic(ci);
                    if (tt.indexOf('m') >= 0 && tt.indexOf('s') < 0) mcOnly.push(ci + 1);
                    else csOnly.push(ci + 1);
                }
                groups.push({ label: 'Management', ports: mcOnly, color: 'blue' });
                if (csOnly.length > 0) groups.push({ label: 'Compute + Storage', ports: csOnly, color: 'purple' });
            } else if (intent === 'custom') {
                const buckets = {};
                const order = [];
                for (let ci2 = 0; ci2 < ports; ci2++) {
                    const tt2 = getTraffic(ci2);
                    const key = tt2.sort().join(',') || 'unused';
                    if (!buckets[key]) { buckets[key] = []; order.push(key); }
                    buckets[key].push(ci2 + 1);
                }
                const nameMap = { 'm,c': 'Mgmt + Compute', 's': 'Storage', 'c': 'Compute', 'm': 'Management', 'c,s': 'Compute + Storage', 'c,m,s': 'All Traffic' };
                const colorMap = { 'm,c': 'blue', 's': 'purple', 'c': 'green', 'm': 'blue', 'c,s': 'purple', 'c,m,s': 'blue' };
                for (let oi = 0; oi < order.length; oi++) {
                    const k = order[oi];
                    if (k === 'unused') continue;
                    groups.push({ label: nameMap[k] || k, ports: buckets[k], color: colorMap[k] || 'blue' });
                }
            }
            if (groups.length === 0) {
                // Fallback: all ports in one group
                const allP = [];
                for (let fp = 1; fp <= ports; fp++) allP.push(fp);
                groups.push({ label: 'Network', ports: allP, color: 'blue' });
            }

            // Draw intent groups and ports inside node
            let totalGroupPorts = 0;
            for (let gi2 = 0; gi2 < groups.length; gi2++) totalGroupPorts += groups[gi2].ports.length;
            const intentGapBetween = 16;
            const totalIntentW = totalGroupPorts * portW + (totalGroupPorts - 1) * portGap + (groups.length - 1) * intentGapBetween;
            const intentStartX = (nodeW - totalIntentW) / 2;

            const mgmtVlanLabelD = (s.infraVlan === 'custom' && s.infraVlanId) ? ('VLAN ' + s.infraVlanId) : 'Default VLAN';

            let portXCursor = intentStartX;
            for (let gi = 0; gi < groups.length; gi++) {
                const grp = groups[gi];
                const isMgmtGrp = (grp.color === 'blue');
                const grpVnicH = isMgmtGrp ? mgmtVnicAreaHD : 0;
                const grpW = grp.ports.length * portW + (grp.ports.length - 1) * portGap;
                const grpBoxW = grpW + intentBoxPad * 2;
                const grpBoxH = portH + 30 + intentBoxPad * 2 + grpVnicH;
                const grpBoxX = portXCursor - intentBoxPad;
                const grpBoxY = nodeH - grpBoxH - 16;

                // Intent group box
                var grpFill, grpStroke, portFill, portStroke;
                if (grp.color === 'purple') {
                    grpFill = '#2D1B69'; grpStroke = '#8B5CF6';
                    portFill = '#5B3ABF'; portStroke = '#7C3AED';
                } else if (grp.color === 'green') {
                    grpFill = '#064E3B'; grpStroke = '#10B981';
                    portFill = '#047857'; portStroke = '#059669';
                } else {
                    grpFill = '#1E3A5F'; grpStroke = '#0078D4';
                    portFill = '#0055A4'; portStroke = '#005A9E';
                }

                const grpId = nextId();
                addCell(grpId, '', grpBoxX, grpBoxY, grpBoxW, grpBoxH,
                    'rounded=1;whiteSpace=wrap;html=1;fillColor=' + grpFill + ';strokeColor=' + grpStroke + ';strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;',
                    nodeContainerId);

                // Intent label inside group box
                const lblId = nextId();
                addCell(lblId, grp.label, 0, grpBoxH - 22, grpBoxW, 20,
                    'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=10;',
                    grpId);

                // Mgmt vNIC card inside management group
                if (isMgmtGrp) {
                    const vaCardW = 80;
                    const vaCardH = 30;
                    const vaX = (grpBoxW - vaCardW) / 2;
                    const vaY = intentBoxPad;
                    const vnicCellId = nextId();
                    addCell(vnicCellId, 'Mgmt vNIC\\n' + mgmtVlanLabelD, vaX, vaY, vaCardW, vaCardH,
                        'rounded=1;whiteSpace=wrap;html=1;fillColor=#1E3A5F;strokeColor=#0078D4;fontColor=#FFFFFF;fontSize=8;fontStyle=1;arcSize=15;dashed=1;dashPattern=4 2;',
                        grpId);
                }

                // Port blocks
                for (let ppi = 0; ppi < grp.ports.length; ppi++) {
                    const portNum = grp.ports[ppi];
                    const px = intentBoxPad + ppi * (portW + portGap);
                    const py = intentBoxPad + grpVnicH;

                    const portId = nextId();
                    const portLabel = getPortName(portNum);
                    addCell(portId, portLabel, px, py, portW, portH,
                        'rounded=1;whiteSpace=wrap;html=1;fillColor=' + portFill + ';strokeColor=' + portStroke + ';fontColor=#FFFFFF;fontSize=9;fontStyle=1;arcSize=15;',
                        grpId);

                    // Track storage port IDs and absolute positions for switchless mesh
                    if (grp.color === 'purple' || (intent === 'all_traffic' && storPorts.indexOf(portNum) >= 0)) {
                        storagePortIds[ni].push(portId);
                        // Absolute position: node origin + group offset + port offset + center-bottom
                        storagePortAbsPos[ni].push({
                            x: nodeX + grpBoxX + px + portW / 2,
                            y: nodeY2 + grpBoxY + py + portH
                        });
                    }

                    // Connect port to ToR
                    if (showTorSwitches) {
                        const isStoragePort = (grp.color === 'purple');
                        const edgeColor = isStoragePort ? '#8B5CF6' : '#0078D4';
                        var targetTor;
                        if (torCount === 2) {
                            targetTor = (ppi % 2 === 0) ? tor1Id : tor2Id;
                        } else {
                            targetTor = tor1Id;
                        }
                        const edgeId = nextId();
                        addEdge(edgeId, portId, targetTor,
                            'endArrow=none;html=1;strokeColor=' + edgeColor + ';strokeWidth=1.5;dashed=1;dashPattern=4 2;exitX=0.5;exitY=0;exitDx=0;exitDy=0;entryX=0.5;entryY=1;entryDx=0;entryDy=0;');
                    }
                }

                portXCursor += grpW + portGap + intentGapBetween;
            }
        }

        // --- Switchless storage mesh ---
        if (isSwitchless && n >= 2) {
            // Build switchless mesh edges with color-coded subnets, mirroring the ODIN SVG renderer.
            // Each node-pair gets 2 dedicated subnets (dual-link).
            let subnetHues;
            if (n === 2) {
                subnetHues = [210, 330];
            } else if (n === 3) {
                subnetHues = [210, 250, 290, 330, 30, 160];
            } else {
                subnetHues = [205, 235, 265, 295, 325, 355, 25, 55, 85, 115, 145, 175];
            }

            function hslToHex(h, s2, l) {
                s2 /= 100; l /= 100;
                const c2 = (1 - Math.abs(2 * l - 1)) * s2;
                const x2 = c2 * (1 - Math.abs((h / 60) % 2 - 1));
                const m2 = l - c2 / 2;
                let r, g, b;
                if (h < 60) { r = c2; g = x2; b = 0; } else if (h < 120) { r = x2; g = c2; b = 0; } else if (h < 180) { r = 0; g = c2; b = x2; } else if (h < 240) { r = 0; g = x2; b = c2; } else if (h < 300) { r = x2; g = 0; b = c2; } else { r = c2; g = 0; b = x2; }
                const toHex = function(v) { const hex = Math.round((v + m2) * 255).toString(16); return hex.length === 1 ? '0' + hex : hex; };
                return '#' + toHex(r) + toHex(g) + toHex(b);
            }

            // Build connection mapping mirroring the SVG renderer.
            // For each node-pair (i<j), 2 consecutive storage ports on each side.
            let subnetCounter = 0;
            for (let si = 0; si < n; si++) {
                for (let sj = si + 1; sj < n; sj++) {
                    // Peer order: how many peers of node si come before sj
                    let peerOrderI = 0;
                    for (let sm = 0; sm < n; sm++) {
                        if (sm === si) continue;
                        if (sm === sj) break;
                        peerOrderI++;
                    }
                    // Peer order: how many peers of node sj come before si
                    let peerOrderJ = 0;
                    for (let sn2 = 0; sn2 < n; sn2++) {
                        if (sn2 === sj) continue;
                        if (sn2 === si) break;
                        peerOrderJ++;
                    }

                    for (let link = 0; link < 2; link++) {
                        const portIdxI = peerOrderI * 2 + link;
                        const portIdxJ = peerOrderJ * 2 + link;
                        const subnetNum = subnetCounter + 1;
                        const hue = subnetHues[subnetCounter % subnetHues.length];
                        const color = hslToHex(hue, 78, 62);

                        const srcId = (storagePortIds[si] && storagePortIds[si][portIdxI]) ? storagePortIds[si][portIdxI] : null;
                        const tgtId = (storagePortIds[sj] && storagePortIds[sj][portIdxJ]) ? storagePortIds[sj][portIdxJ] : null;

                        if (srcId && tgtId) {
                            // Compute orthogonal waypoints: down to lane, horizontal, up to target
                            const srcPos = (storagePortAbsPos[si] && storagePortAbsPos[si][portIdxI]) ? storagePortAbsPos[si][portIdxI] : null;
                            const tgtPos = (storagePortAbsPos[sj] && storagePortAbsPos[sj][portIdxJ]) ? storagePortAbsPos[sj][portIdxJ] : null;
                            const laneY = nodesY + nodeH + 30 + subnetCounter * 22;
                            const meshEdgeId = nextId();
                            addEdge(meshEdgeId, srcId, tgtId,
                                'endArrow=none;html=1;strokeColor=' + color + ';strokeWidth=2.5;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=1;entryDx=0;entryDy=0;');
                            edges[edges.length - 1].label = 'Subnet ' + subnetNum;
                            if (srcPos && tgtPos) {
                                edges[edges.length - 1].points = [
                                    { x: srcPos.x, y: laneY },
                                    { x: tgtPos.x, y: laneY }
                                ];
                            }
                        }
                        subnetCounter++;
                    }
                }
            }
        }

        // Extend page height for switchless mesh routing area below nodes
        let pageH = nodesY + nodeH + 100;
        if (isSwitchless && n >= 2) {
            pageH = nodesY + nodeH + (n * (n - 1)) * 22 + 120;
        }

        // --- Build XML ---
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<mxfile host="app.diagrams.net" type="device">\n';
        xml += '  <diagram name="Host Networking" id="odin-host-networking">\n';
        xml += '    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="' + Math.round(svgW + 100) + '" pageHeight="' + Math.round(pageH) + '" math="0" shadow="0">\n';
        xml += '      <root>\n';
        xml += '        <mxCell id="0" />\n';
        xml += '        <mxCell id="1" parent="0" />\n';

        // Render vertex cells
        for (let vi = 0; vi < cells.length; vi++) {
            const c = cells[vi];
            xml += '        <mxCell id="' + c.id + '" value="' + c.value + '" style="' + c.style + '" vertex="1" parent="' + c.parent + '">\n';
            xml += '          <mxGeometry x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" as="geometry" />\n';
            xml += '        </mxCell>\n';
        }

        // Render edge cells
        for (let ei = 0; ei < edges.length; ei++) {
            const e = edges[ei];
            const lbl = e.label ? (' value="' + xmlEsc(e.label) + '"') : '';
            xml += '        <mxCell id="' + e.id + '"' + lbl + ' style="' + e.style + '" edge="1" source="' + e.source + '" target="' + e.target + '" parent="1">\n';
            if (e.points && e.points.length > 0) {
                xml += '          <mxGeometry relative="1" as="geometry">\n';
                xml += '            <Array as="points">\n';
                for (let pi2 = 0; pi2 < e.points.length; pi2++) {
                    xml += '              <mxPoint x="' + Math.round(e.points[pi2].x) + '" y="' + Math.round(e.points[pi2].y) + '" />\n';
                }
                xml += '            </Array>\n';
                xml += '          </mxGeometry>\n';
            } else {
                xml += '          <mxGeometry relative="1" as="geometry" />\n';
            }
            xml += '        </mxCell>\n';
        }

        xml += '      </root>\n';
        xml += '    </mxGraphModel>\n';
        xml += '  </diagram>\n';
        xml += '</mxfile>';

        return xml;
    }

    /**
     * Generate a draw.io XML file for disaggregated host networking diagrams.
     * Mirrors the SVG from renderDisaggregatedHostNetworkingDiagram.
     */
    function generateDisaggregatedHostNetworkingDrawio(s) {
        if (!s || s.architecture !== 'disaggregated') return '';

        const storageType = s.disaggStorageType || 'fc_san';
        const backupEnabled = !!s.disaggBackupEnabled;
        const portCount = parseInt(s.disaggPortCount, 10) || 4;
        const totalNodes = parseInt(s.nodes, 10) || ((parseInt(s.disaggRackCount, 10) || 1) * (parseInt(s.disaggNodesPerRack, 10) || 1));
        const n = Math.min(2, totalNodes);
        const hasFc = (storageType === 'fc_san');
        const hasIscsi = (storageType === 'iscsi_4nic' || storageType === 'iscsi_6nic');
        const hasDedicatedIscsi = (storageType === 'iscsi_6nic');
        const hasSharedIscsi = (storageType === 'iscsi_4nic');
        const adapterMapping = s.disaggAdapterMapping || {};

        function xmlEsc(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        // NIC name helper
        function getNicNameD(slotKey, idx) {
            if (s.disaggPortConfig) {
                const portList = getDisaggPortListForReport(storageType, backupEnabled, portCount);
                for (let pi = 0; pi < portList.length; pi++) {
                    if (portList[pi].id === slotKey + '_p' + idx) {
                        const cfg = s.disaggPortConfig[portList[pi].id];
                        return (cfg && (cfg.customName || cfg.name)) || portList[pi].defaultName;
                    }
                }
            }
            const defaults = { ocp: 'OCP-NIC', pcie1: 'PCIe1-NIC', pcie2: 'PCIe2-NIC', backup: 'BK-NIC', bmc: 'BMC', fc: 'FC-HBA' };
            return (defaults[slotKey] || slotKey) + idx;
        }

        function getPortSpeedD(slotKey, idx) {
            if (s.disaggPortConfig) {
                const key = slotKey + '_p' + idx;
                if (s.disaggPortConfig[key] && s.disaggPortConfig[key].speed) return s.disaggPortConfig[key].speed;
            }
            if (slotKey === 'bmc') return '1GbE';
            if (slotKey === 'fc') return '32G FC';
            return '25GbE';
        }

        // Build NIC groups dynamically from adapter mapping
        const nicGroups = [];
        const dClusterLabel1 = hasSharedIscsi ? 'NIC3 Path A' : 'Cluster 1';
        const dClusterLabel2 = hasSharedIscsi ? 'NIC4 Path B' : 'Cluster 2';
        const zoneMeta = {
            mgmt_compute: { label: 'Mgmt + Compute', color: 'blue', vnicAbove: { name: 'Mgmt vNIC', vlan: 'VLAN ' + ((s.disaggVlans && s.disaggVlans.mgmt) || '7') } },
            cluster_1: { label: dClusterLabel1, color: 'green', subLabel: hasSharedIscsi ? 'Cluster + iSCSI' : '', vlanBelow: 'VLAN ' + ((s.disaggVlans && s.disaggVlans.cluster1) || '711'), forcedLeaf: 'A' },
            cluster_2: { label: dClusterLabel2, color: 'green', subLabel: hasSharedIscsi ? 'Cluster + iSCSI' : '', vlanBelow: 'VLAN ' + ((s.disaggVlans && s.disaggVlans.cluster2) || '712'), forcedLeaf: 'B' },
            iscsi_a: { label: 'iSCSI Storage A', color: 'purple', vlanBelow: 'VLAN ' + ((s.disaggVlans && s.disaggVlans.iscsiA) || '300'), forcedLeaf: 'A' },
            iscsi_b: { label: 'iSCSI Storage B', color: 'purple', vlanBelow: 'VLAN ' + ((s.disaggVlans && s.disaggVlans.iscsiB) || '400'), forcedLeaf: 'B' },
            backup: { label: 'In-Guest Backup Compute Intent', color: 'orange' }
        };
        const zoneOrder = ['mgmt_compute', 'cluster_1', 'cluster_2', 'iscsi_a', 'iscsi_b', 'backup'];
        const portListD = getDisaggPortListForReport(storageType, backupEnabled, portCount);
        // CodeQL js/remote-property-injection (#19, #20, #21): use Maps so
        // user-derived zone keys are stored as explicit key/value pairs with
        // safe dictionary semantics.
        const groupsByZoneD = new Map();
        const zoneLeafCountersD = new Map();

        for (let dpi = 0; dpi < portListD.length; dpi++) {
            const dPort = portListD[dpi];
            const dZone = adapterMapping[dPort.id];
            if (!dZone || dZone === 'pool' || dPort.slot === 'bmc') continue;
            if (!groupsByZoneD.has(dZone)) groupsByZoneD.set(dZone, []);
            if (!zoneLeafCountersD.has(dZone)) zoneLeafCountersD.set(dZone, 0);
            const dzmeta = zoneMeta[dZone];
            const dLeaf = (dzmeta && dzmeta.forcedLeaf) ? dzmeta.forcedLeaf : ((zoneLeafCountersD.get(dZone) % 2 === 0) ? 'A' : 'B');
            zoneLeafCountersD.set(dZone, zoneLeafCountersD.get(dZone) + 1);
            const dSlotKey = dPort.id.replace(/_p\d+$/, '');
            const dIdx = parseInt(dPort.id.replace(/^.*_p/, ''), 10);
            groupsByZoneD.get(dZone).push({ name: getNicNameD(dSlotKey, dIdx), speed: getPortSpeedD(dSlotKey, dIdx), leaf: dLeaf });
        }

        for (let dzi = 0; dzi < zoneOrder.length; dzi++) {
            const dzk = zoneOrder[dzi];
            const dList = groupsByZoneD.get(dzk);
            if (!dList || dList.length === 0) continue;
            const dmeta = zoneMeta[dzk];
            if (!dmeta) continue;
            const dgrp = { key: dzk, label: dmeta.label, color: dmeta.color, nics: dList };
            if (dmeta.vnicAbove) dgrp.vnicAbove = dmeta.vnicAbove;
            if (dmeta.vlanBelow) dgrp.vlanBelow = dmeta.vlanBelow;
            if (dmeta.subLabel) dgrp.subLabel = dmeta.subLabel;
            nicGroups.push(dgrp);
        }

        // Fallback: if no adapter mapping, use hardcoded defaults
        if (nicGroups.length === 0) {
            nicGroups.push({
                key: 'mgmt_compute', label: 'Mgmt + Compute', color: 'blue',
                vnicAbove: { name: 'Mgmt vNIC', vlan: 'VLAN ' + ((s.disaggVlans && s.disaggVlans.mgmt) || '7') },
                nics: [
                    { name: getNicNameD('ocp', 1), speed: getPortSpeedD('ocp', 1), leaf: 'A' },
                    { name: getNicNameD('ocp', 2), speed: getPortSpeedD('ocp', 2), leaf: 'B' }
                ]
            });
            nicGroups.push({
                key: 'cluster_1', label: dClusterLabel1, color: 'green',
                vlanBelow: 'VLAN ' + ((s.disaggVlans && s.disaggVlans.cluster1) || '711'),
                nics: [{ name: getNicNameD('pcie1', 1), speed: getPortSpeedD('pcie1', 1), leaf: 'A' }]
            });
            nicGroups.push({
                key: 'cluster_2', label: dClusterLabel2, color: 'green',
                vlanBelow: 'VLAN ' + ((s.disaggVlans && s.disaggVlans.cluster2) || '712'),
                nics: [{ name: getNicNameD('pcie1', 2), speed: getPortSpeedD('pcie1', 2), leaf: 'B' }]
            });
            if (backupEnabled) {
                const bkSlot = (storageType === 'iscsi_6nic') ? 'pcie2' : 'backup';
                nicGroups.push({
                    key: 'backup', label: 'In-Guest Backup Compute Intent', color: 'orange',
                    nics: [
                        { name: getNicNameD(bkSlot, 1), speed: getPortSpeedD(bkSlot, 1), leaf: 'A' },
                        { name: getNicNameD(bkSlot, 2), speed: getPortSpeedD(bkSlot, 2), leaf: 'B' }
                    ]
                });
            }
        }

        // Storage adapters
        const storageAdapters = [];
        if (hasFc) {
            storageAdapters.push({ name: getNicNameD('fc', 1), speed: getPortSpeedD('fc', 1), target: 'A' });
            storageAdapters.push({ name: getNicNameD('fc', 2), speed: getPortSpeedD('fc', 2), target: 'B' });
        }
        // iSCSI scenarios: Storage Array shown at leaf level, no bottom storage adapters

        // Layout constants
        const portW = 62, portH = 38, portGap = 10, groupGap = 18, intentBoxPad = 12;
        const leafW = 160, leafH = 50, leafGap = 80;
        const sanW = 160, sanH = 40, sanGap = 60;
        const marginX = 60, marginY = 40;

        // Compute NIC row width
        function rowWidth(groups) {
            let w = 0;
            for (let i = 0; i < groups.length; i++) {
                w += groups[i].nics.length * portW + (groups[i].nics.length - 1) * portGap;
                if (i < groups.length - 1) w += groupGap;
            }
            return w;
        }

        const nicRowW = rowWidth(nicGroups);
        const storageW = storageAdapters.length * portW + Math.max(0, storageAdapters.length - 1) * portGap;
        const maxRowW = Math.max(nicRowW, storageW);
        const nodeW = Math.max(440, maxRowW + 80);
        const mgmtVnicAreaHD = 48;
        const nodeH = 220 + mgmtVnicAreaHD + (storageAdapters.length > 0 ? 80 : 0);
        const nodeGap = 60;

        const totalNodesW = n * nodeW + (n - 1) * nodeGap;
        const iscsiArrWD = 170, iscsiArrHD = 56, iscsiArrGapD = 50;
        const totalLeafW = 2 * leafW + leafGap;
        const topRowWD = totalLeafW + (hasIscsi ? (iscsiArrGapD + iscsiArrWD) : 0);
        const svgW = Math.max(totalNodesW + marginX * 2, topRowWD + marginX * 2);

        const leafY = marginY;
        const leafToNodeGap = 100;
        const nodesY = leafY + leafH + leafToNodeGap;
        const leafBlockStartXD = hasIscsi ? ((svgW - topRowWD) / 2) : ((svgW - totalLeafW) / 2);
        const nodesStartX = (svgW - totalNodesW) / 2;
        const leaf1X = leafBlockStartXD;
        const leaf2X = leaf1X + leafW + leafGap;

        const sanY = nodesY + nodeH + 60;
        const pageH = (hasIscsi ? (nodesY + nodeH + 80) : (sanY + sanH + 80));

        // Cell/edge builders
        const cells = [];
        const edgesList = [];
        let cellId = 2;
        function nextId() { return String(cellId++); }

        function addCell(id, value, x, y, w, h, style, parent) {
            cells.push({ id: id, value: xmlEsc(value), x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), style: style, parent: parent || '1' });
        }
        function addEdge(id, source, target, style, label) {
            edgesList.push({ id: id, source: source, target: target, style: style, label: label || '' });
        }

        // Color maps
        function fillStroke(color) {
            if (color === 'blue') return { fill: '#1E3A5F', stroke: '#3B82F6', portFill: '#0055A4', portStroke: '#005A9E' };
            if (color === 'green') return { fill: '#064E3B', stroke: '#10B981', portFill: '#047857', portStroke: '#059669' };
            if (color === 'orange') return { fill: '#7C2D12', stroke: '#F97316', portFill: '#C2410C', portStroke: '#EA580C' };
            if (color === 'purple') return { fill: '#2D1B69', stroke: '#8B5CF6', portFill: '#5B3ABF', portStroke: '#7C3AED' };
            return { fill: '#1E3A5F', stroke: '#0078D4', portFill: '#0055A4', portStroke: '#005A9E' };
        }

        // Leaf-A
        const leaf1Id = nextId();
        addCell(leaf1Id, 'Leaf-A', leaf1X, leafY, leafW, leafH,
            'rounded=1;whiteSpace=wrap;html=1;fillColor=#1E3A5F;strokeColor=#3B82F6;fontColor=#FFFFFF;fontSize=13;fontStyle=1;arcSize=20;strokeWidth=2;');

        // Leaf-B
        const leaf2Id = nextId();
        addCell(leaf2Id, 'Leaf-B', leaf2X, leafY, leafW, leafH,
            'rounded=1;whiteSpace=wrap;html=1;fillColor=#1E3A5F;strokeColor=#3B82F6;fontColor=#FFFFFF;fontSize=13;fontStyle=1;arcSize=20;strokeWidth=2;');

        // iBGP link between leaves
        const ibgpId = nextId();
        addEdge(ibgpId, leaf1Id, leaf2Id,
            'endArrow=none;html=1;strokeColor=#FACC15;strokeWidth=2;dashed=1;dashPattern=6 3;fontColor=#FACC15;fontSize=10;labelBackgroundColor=none;',
            'iBGP P49');

        // SAN / iSCSI targets — for shared iSCSI, show Storage Array at leaf level instead
        let sanAId, sanBId;
        if (hasIscsi) {
            const iscsiArrXD = leaf2X + leafW + iscsiArrGapD;
            const iscsiArrYD = leafY - 3;
            sanAId = nextId();
            addCell(sanAId, 'iSCSI Storage Array\nDual Controllers (A + B)\nMPIO Active/Active', iscsiArrXD, iscsiArrYD, iscsiArrWD, iscsiArrHD,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#2D1B69;strokeColor=#8B5CF6;fontColor=#C4B5FD;fontSize=9;fontStyle=1;arcSize=20;strokeWidth=2;');
            // Connect Leaf-A and Leaf-B to Storage Array
            const saEdgeA = nextId();
            addEdge(saEdgeA, leaf1Id, sanAId,
                'endArrow=none;html=1;strokeColor=#8B5CF6;strokeWidth=1.5;dashed=1;dashPattern=5 3;exitX=1;exitY=0.3;exitDx=0;exitDy=0;entryX=0;entryY=0.3;entryDx=0;entryDy=0;',
                'Ctrl-A');
            const saEdgeB = nextId();
            addEdge(saEdgeB, leaf2Id, sanAId,
                'endArrow=none;html=1;strokeColor=#8B5CF6;strokeWidth=1.5;dashed=1;dashPattern=5 3;exitX=1;exitY=0.7;exitDx=0;exitDy=0;entryX=0;entryY=0.7;entryDx=0;entryDy=0;',
                'Ctrl-B');
            sanBId = sanAId; // single target for shared
        } else {
            const targetLabelA = hasFc ? 'SAN Fabric A' : 'iSCSI Target A';
            const targetLabelB = hasFc ? 'SAN Fabric B' : 'iSCSI Target B';
            const totalSanW = 2 * sanW + sanGap;
            const sanStartX = (svgW - totalSanW) / 2;

            sanAId = nextId();
            addCell(sanAId, targetLabelA, sanStartX, sanY, sanW, sanH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#2D1B69;strokeColor=#8B5CF6;fontColor=#C4B5FD;fontSize=11;fontStyle=1;arcSize=20;strokeWidth=1.5;');
            sanBId = nextId();
            addCell(sanBId, targetLabelB, sanStartX + sanW + sanGap, sanY, sanW, sanH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#2D1B69;strokeColor=#8B5CF6;fontColor=#C4B5FD;fontSize=11;fontStyle=1;arcSize=20;strokeWidth=1.5;');
        }

        // Render nodes
        for (let ni = 0; ni < n; ni++) {
            const nodeX = nodesStartX + ni * (nodeW + nodeGap);

            // Node container
            const nodeContainerId = nextId();
            let nodeName = 'Node ' + (ni + 1);
            if (s.nodeSettings && s.nodeSettings[ni] && s.nodeSettings[ni].name) {
                nodeName = String(s.nodeSettings[ni].name).trim() || nodeName;
            }
            addCell(nodeContainerId, nodeName, nodeX, nodesY, nodeW, nodeH,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#1A1A2E;strokeColor=#334155;fontColor=#FFFFFF;fontSize=14;fontStyle=1;arcSize=8;verticalAlign=top;spacingTop=8;container=1;collapsible=0;');

            // BMC (top-right)
            const bmcId = nextId();
            addCell(bmcId, getNicNameD('bmc', 1), nodeW - 75, 8, 60, 24,
                'rounded=1;whiteSpace=wrap;html=1;fillColor=#333333;strokeColor=#666666;fontColor=#AAAAAA;fontSize=8;arcSize=15;',
                nodeContainerId);

            // NIC groups row
            const rw = rowWidth(nicGroups);
            let cursorX = (nodeW - rw) / 2;
            const nicRowY = 60 + mgmtVnicAreaHD;

            for (let gi = 0; gi < nicGroups.length; gi++) {
                const grp = nicGroups[gi];
                const cs = fillStroke(grp.color);
                const grpW = grp.nics.length * portW + (grp.nics.length - 1) * portGap;
                const grpBoxW = grpW + intentBoxPad * 2;
                const hasVnicAboveD = !!grp.vnicAbove;
                const vnicAboveAreaHD = hasVnicAboveD ? mgmtVnicAreaHD : 0;
                const grpBoxH = portH + 30 + intentBoxPad * 2 + vnicAboveAreaHD;
                const grpBoxX = cursorX - intentBoxPad;
                const grpBoxY = nicRowY - vnicAboveAreaHD;

                // Group box
                const grpId = nextId();
                addCell(grpId, '', grpBoxX, grpBoxY, grpBoxW, grpBoxH,
                    'rounded=1;whiteSpace=wrap;html=1;fillColor=' + cs.fill + ';strokeColor=' + cs.stroke + ';strokeWidth=1;dashed=1;dashPattern=5 3;arcSize=12;container=1;collapsible=0;verticalAlign=top;',
                    nodeContainerId);

                // Group label
                const lblId = nextId();
                const lblText = grp.subLabel ? (grp.label + '\\n' + grp.subLabel) : grp.label;
                const lblHeight = grp.subLabel ? 30 : 20;
                addCell(lblId, lblText, 0, grpBoxH - lblHeight, grpBoxW, lblHeight,
                    'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#BBBBBB;fontSize=9;',
                    grpId);

                // vNIC above physical NICs (e.g., Management vNIC)
                if (hasVnicAboveD) {
                    const vaCardW = 80;
                    const vaCardH = 30;
                    const vaX = (grpBoxW - vaCardW) / 2;
                    const vaY = intentBoxPad;
                    const vnicAboveId = nextId();
                    addCell(vnicAboveId, grp.vnicAbove.name + '\\n' + grp.vnicAbove.vlan, vaX, vaY, vaCardW, vaCardH,
                        'rounded=1;whiteSpace=wrap;html=1;fillColor=' + cs.fill + ';strokeColor=' + cs.stroke + ';fontColor=#FFFFFF;fontSize=8;fontStyle=1;arcSize=15;dashed=1;dashPattern=4 2;',
                        grpId);
                }

                // Port cards
                for (let pi = 0; pi < grp.nics.length; pi++) {
                    const nic = grp.nics[pi];
                    const px = intentBoxPad + pi * (portW + portGap);
                    const py = intentBoxPad + vnicAboveAreaHD;

                    const portId = nextId();
                    addCell(portId, nic.name + '\\n' + nic.speed, px, py, portW, portH,
                        'rounded=1;whiteSpace=wrap;html=1;fillColor=' + cs.portFill + ';strokeColor=' + cs.portStroke + ';fontColor=#FFFFFF;fontSize=8;fontStyle=1;arcSize=15;',
                        grpId);

                    // Connect to leaf
                    const targetLeaf = (nic.leaf === 'A') ? leaf1Id : leaf2Id;
                    const edgeColor = cs.stroke;
                    const eid = nextId();
                    addEdge(eid, portId, targetLeaf,
                        'endArrow=none;html=1;strokeColor=' + edgeColor + ';strokeWidth=1.5;dashed=1;dashPattern=4 2;exitX=0.5;exitY=0;exitDx=0;exitDy=0;entryX=0.5;entryY=1;entryDx=0;entryDy=0;');
                }

                cursorX += grpW + portGap + groupGap;
            }

            // Storage adapters at bottom of node
            if (storageAdapters.length > 0) {
                const saY = nodeH - portH - 30;
                const saStartX2 = (nodeW - storageW) / 2;
                const pcs = fillStroke('purple');

                // Storage label
                const storageLbl = hasFc ? 'FC HBA — SAN Fabric' : (hasDedicatedIscsi ? 'iSCSI Storage Adapters' : 'iSCSI — Shared with Cluster');
                const stLblId = nextId();
                addCell(stLblId, storageLbl, 20, saY - 22, nodeW - 40, 18,
                    'text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fillColor=none;strokeColor=none;fontColor=#A78BFA;fontSize=9;fontStyle=1;',
                    nodeContainerId);

                for (let si = 0; si < storageAdapters.length; si++) {
                    const sa = storageAdapters[si];
                    const sx = saStartX2 + si * (portW + portGap);

                    const saId = nextId();
                    addCell(saId, sa.name + '\\n' + sa.speed, sx, saY, portW, portH,
                        'rounded=1;whiteSpace=wrap;html=1;fillColor=' + pcs.fill + ';strokeColor=' + pcs.stroke + ';fontColor=#FFFFFF;fontSize=7;fontStyle=1;arcSize=15;dashed=1;dashPattern=4 2;',
                        nodeContainerId);

                    // Connect to SAN target
                    const targetSan = (sa.target === 'A') ? sanAId : sanBId;
                    const saEdgeId = nextId();
                    addEdge(saEdgeId, saId, targetSan,
                        'endArrow=none;html=1;strokeColor=#8B5CF6;strokeWidth=1.5;dashed=1;dashPattern=5 3;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;');
                }
            }
        }

        // Build XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<mxfile host="app.diagrams.net" type="device">\n';
        xml += '  <diagram name="Disaggregated Host Networking" id="odin-disagg-host-networking">\n';
        xml += '    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="' + Math.round(svgW + 100) + '" pageHeight="' + Math.round(pageH) + '" math="0" shadow="0">\n';
        xml += '      <root>\n';
        xml += '        <mxCell id="0" />\n';
        xml += '        <mxCell id="1" parent="0" />\n';

        for (let vi = 0; vi < cells.length; vi++) {
            const c = cells[vi];
            xml += '        <mxCell id="' + c.id + '" value="' + c.value + '" style="' + c.style + '" vertex="1" parent="' + c.parent + '">\n';
            xml += '          <mxGeometry x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" as="geometry" />\n';
            xml += '        </mxCell>\n';
        }

        for (let ei = 0; ei < edgesList.length; ei++) {
            const e = edgesList[ei];
            const lbl = e.label ? (' value="' + xmlEsc(e.label) + '"') : '';
            xml += '        <mxCell id="' + e.id + '"' + lbl + ' style="' + e.style + '" edge="1" source="' + e.source + '" target="' + e.target + '" parent="1">\n';
            xml += '          <mxGeometry relative="1" as="geometry" />\n';
            xml += '        </mxCell>\n';
        }

        xml += '      </root>\n';
        xml += '    </mxGraphModel>\n';
        xml += '  </diagram>\n';
        xml += '</mxfile>';

        return xml;
    }

    /**
     * Download the host networking diagram as a .drawio file.
     */
    function downloadHostNetworkingDrawio() {
        if (!CURRENT_REPORT_STATE) return;
        const s = CURRENT_REPORT_STATE;
        const drawioXml = (s.architecture === 'disaggregated')
            ? generateDisaggregatedHostNetworkingDrawio(s)
            : generateHostNetworkingDrawio(s);
        if (!drawioXml) return;

        const blob = new Blob([drawioXml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);

        const ts = new Date();
        const pad2 = function(n) { return String(n).padStart(2, '0'); };
        const fileName = 'azure-local-diagram-'
            + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate())
            + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes())
            + '.drawio';

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }

    function downloadHostNetworkingDiagramSvg(variant) {
        try {
            const hostSec = document.querySelector('#report-summary [data-summary-section="host-networking"]');
            if (!hostSec) return;
            const svg = hostSec.querySelector('svg.switchless-diagram__svg');
            if (!svg) return;

            const theme = (variant === 'light' || variant === 'dark') ? variant : 'dark';

            // Clone so we can inject theme variables + a solid background for standalone viewing.
            const clone = svg.cloneNode(true);
            if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            let exportBg = '#000000';

            try {
                const rootStyle = window.getComputedStyle(document.documentElement);
                // Default to the current (dark) site theme.
                const themeVars = {
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
                    // Light export palette: keep accent colors, flip neutrals for contrast.
                    // (Only affects the exported SVG, not the app UI.)
                    themeVars['--bg-dark'] = '#ffffff';
                    themeVars['--card-bg'] = '#ffffff';
                    themeVars['--text-primary'] = '#0b0b0b';
                    themeVars['--text-secondary'] = '#404040';
                    themeVars['--glass-border'] = 'rgba(0, 0, 0, 0.14)';
                }

                exportBg = (theme === 'light') ? '#ffffff' : (themeVars['--bg-dark'] || '#000000');

                const decls = Object.keys(themeVars)
                    .map(function(k) {
                        const v = (themeVars[k] || '').trim();
                        return v ? (k + ': ' + v + ';') : '';
                    })
                    .filter(Boolean)
                    .join(' ');

                if (decls) {
                    let defs = clone.querySelector('defs');
                    if (!defs) {
                        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                        clone.insertBefore(defs, clone.firstChild);
                    }
                    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
                    styleEl.textContent = ':root { ' + decls + ' }';
                    defs.appendChild(styleEl);
                }
            } catch (eVars) {
                // ignore
            }

            // Add a background rect so the downloaded SVG isn't transparent.
            try {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('fill', exportBg);

                const vb = (clone.getAttribute('viewBox') || '').trim();
                if (vb) {
                    const parts = vb.split(/\s+/).map(function(p) { return parseFloat(p); });
                    if (parts.length === 4 && parts.every(function(n) { return Number.isFinite(n); })) {
                        rect.setAttribute('x', String(parts[0]));
                        rect.setAttribute('y', String(parts[1]));
                        rect.setAttribute('width', String(parts[2]));
                        rect.setAttribute('height', String(parts[3]));
                    } else {
                        rect.setAttribute('x', '0');
                        rect.setAttribute('y', '0');
                        rect.setAttribute('width', '100%');
                        rect.setAttribute('height', '100%');
                    }
                } else {
                    rect.setAttribute('x', '0');
                    rect.setAttribute('y', '0');
                    rect.setAttribute('width', '100%');
                    rect.setAttribute('height', '100%');
                }

                const defsNode = clone.querySelector('defs');
                if (defsNode && defsNode.nextSibling) {
                    clone.insertBefore(rect, defsNode.nextSibling);
                } else {
                    clone.insertBefore(rect, clone.firstChild);
                }
            } catch (eBg) {
                // ignore
            }

            const serializer = new XMLSerializer();
            let svgText = serializer.serializeToString(clone);
            if (svgText.indexOf('<?xml') !== 0) {
                svgText = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgText;
            }

            const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const ts = new Date();
            const pad2 = function(n) { return String(n).padStart(2, '0'); };
            const fileName = 'azure-local-diagram-' + theme + '-'
                + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate())
                + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes())
                + '.svg';

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
        } catch (e) {
            // ignore
        }
    }

    function downloadOutboundConnectivityDiagramSvg(variant) {
        try {
            const theme = (variant === 'light' || variant === 'dark') ? variant : 'dark';
            const diagKey = getOutboundDiagramKey(CURRENT_REPORT_STATE);
            if (!diagKey || !OUTBOUND_DIAGRAMS[diagKey]) return;

            // Determine the correct SVG URL based on theme
            const basePath = OUTBOUND_DIAGRAMS[diagKey];
            // The SVGs are dark by default, for light we'd need to apply transformations
            const svgUrl = basePath;

            fetch(svgUrl)
                .then(function(resp) { return resp.text(); })
                .then(function(svgText) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svgText, 'image/svg+xml');
                    const svg = doc.querySelector('svg');
                    if (!svg) return;

                    const clone = svg.cloneNode(true);
                    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                    const exportBg = theme === 'light' ? '#ffffff' : '#000000';

                    // For light theme, we need to invert some colors
                    if (theme === 'light') {
                        // Add a style to invert dark backgrounds to light
                        let defs = clone.querySelector('defs');
                        if (!defs) {
                            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                            clone.insertBefore(defs, clone.firstChild);
                        }
                        const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
                        styleEl.textContent = 'svg { background-color: #ffffff; }';
                        defs.appendChild(styleEl);
                    }

                    // Add a background rect
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('fill', exportBg);
                    const vb = (clone.getAttribute('viewBox') || '').trim();
                    if (vb) {
                        const parts = vb.split(/\s+/).map(function(p) { return parseFloat(p); });
                        if (parts.length === 4 && parts.every(function(n) { return Number.isFinite(n); })) {
                            rect.setAttribute('x', String(parts[0]));
                            rect.setAttribute('y', String(parts[1]));
                            rect.setAttribute('width', String(parts[2]));
                            rect.setAttribute('height', String(parts[3]));
                        } else {
                            rect.setAttribute('x', '0');
                            rect.setAttribute('y', '0');
                            rect.setAttribute('width', '100%');
                            rect.setAttribute('height', '100%');
                        }
                    } else {
                        rect.setAttribute('x', '0');
                        rect.setAttribute('y', '0');
                        rect.setAttribute('width', '100%');
                        rect.setAttribute('height', '100%');
                    }
                    clone.insertBefore(rect, clone.firstChild);

                    const serializer = new XMLSerializer();
                    let finalSvgText = serializer.serializeToString(clone);
                    if (finalSvgText.indexOf('<?xml') !== 0) {
                        finalSvgText = '<?xml version="1.0" encoding="UTF-8"?>\n' + finalSvgText;
                    }

                    const blob = new Blob([finalSvgText], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);

                    const ts = new Date();
                    const pad2 = function(n) { return String(n).padStart(2, '0'); };
                    const fileName = 'outbound-connectivity-' + theme + '-'
                        + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate())
                        + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes())
                        + '.svg';

                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
                })
                .catch(function(err) {
                    console.warn('Failed to download outbound diagram:', err);
                });
        } catch (e) {
            console.warn('Error in downloadOutboundConnectivityDiagramSvg:', e);
        }
    }

    /**
     * Download the outbound connectivity diagram as a .drawio file (disconnected diagrams only).
     */
    function downloadOutboundConnectivityDrawio() {
        try {
            const diagKey = getOutboundDiagramKey(CURRENT_REPORT_STATE);
            if (!diagKey || !OUTBOUND_DRAWIO[diagKey]) return;

            const drawioUrl = OUTBOUND_DRAWIO[diagKey];
            fetch(drawioUrl)
                .then(function(resp) { return resp.text(); })
                .then(function(drawioXml) {
                    const blob = new Blob([drawioXml], { type: 'application/xml' });
                    const url = URL.createObjectURL(blob);

                    const ts = new Date();
                    const pad2 = function(n) { return String(n).padStart(2, '0'); };
                    const fileName = 'disconnected-operations-'
                        + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate())
                        + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes())
                        + '.drawio';

                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
                })
                .catch(function(err) {
                    console.warn('Failed to download drawio file:', err);
                });
        } catch (e) {
            console.warn('Error in downloadOutboundConnectivityDrawio:', e);
        }
    }

    /**
     * Highlight the relevant cluster area in an inline SVG for disconnected operations.
     * Uses data-cell-id attributes preserved from draw.io SVG export.
     * @param {SVGElement} svgEl - The inline SVG element
     * @param {string} clusterRole - 'management' or 'workload'
     */
    function highlightClusterInSvg(svgEl, clusterRole) {
        // Grey container cell IDs (consistent across all disconnected diagram variants).
        // The SVG structure is flat: each cell has its own <g data-cell-id="..."> as siblings
        // under <g data-cell-id="1">.  So we read geometry from the container rects and
        // append overlay rects at the end of the main group (drawn on top of everything).
        const MGMT_CONTAINER  = 'JwsQfcPdxONgqVIScywy-218';   // management cluster grey area (left)
        const WL_CONTAINER_1  = 'JwsQfcPdxONgqVIScywy-182';   // workload cluster 1 grey area (middle)
        const WL_CONTAINER_2  = 'JwsQfcPdxONgqVIScywy-186';   // workload cluster 2 grey area (right, only in non-switchless SVGs)

        // Determine which containers to dim and which to highlight
        let activeIds, dimIds;
        if (clusterRole === 'management') {
            activeIds = [MGMT_CONTAINER];
            // Dim both workload clusters (if the second one exists in this SVG)
            dimIds = [WL_CONTAINER_1];
            if (svgEl.querySelector('[data-cell-id="' + WL_CONTAINER_2 + '"]')) {
                dimIds.push(WL_CONTAINER_2);
            }
        } else {
            // Workload role: highlight both workload clusters, dim management
            activeIds = [WL_CONTAINER_1];
            if (svgEl.querySelector('[data-cell-id="' + WL_CONTAINER_2 + '"]')) {
                activeIds.push(WL_CONTAINER_2);
            }
            dimIds = [MGMT_CONTAINER];
        }

        // Find the main content group where all cells are rendered
        const mainGroup = svgEl.querySelector('[data-cell-id="1"]');
        if (!mainGroup) return;

        // Helper: read rect geometry from a container cell group (accounts for translate)
        function getRectGeometry(cellId) {
            const g = svgEl.querySelector('[data-cell-id="' + cellId + '"]');
            if (!g) return null;
            const rect = g.querySelector('rect');
            if (!rect) return null;
            let x = parseFloat(rect.getAttribute('x')) || 0;
            let y = parseFloat(rect.getAttribute('y')) || 0;
            const w = parseFloat(rect.getAttribute('width')) || 0;
            const h = parseFloat(rect.getAttribute('height')) || 0;
            const rx = parseFloat(rect.getAttribute('rx')) || 0;
            const ry = parseFloat(rect.getAttribute('ry')) || 0;
            // Account for any translate transform on parent <g>
            const transformG = rect.parentNode;
            if (transformG) {
                const tf = (transformG.getAttribute('transform') || '').match(/translate\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
                if (tf) { x += parseFloat(tf[1]); y += parseFloat(tf[2]); }
            }
            return { x: x, y: y, w: w, h: h, rx: rx, ry: ry };
        }

        // Helper: expand a geometry rect to include any switchless note labels below a cluster.
        // The switchless labels (data-cell-id starting with "switchless-") can sit just below the
        // cluster container rect.  We find those whose horizontal mid-point falls within the
        // container's x-range and extend the height to cover them.
        function expandGeoForSwitchlessLabels(geo) {
            if (!geo) return geo;
            const labels = svgEl.querySelectorAll('[data-cell-id^="switchless-"]');
            if (!labels.length) return geo;
            let bottom = geo.y + geo.h;
            for (let i = 0; i < labels.length; i++) {
                const r = labels[i].querySelector('rect');
                if (!r) continue;
                let lx = parseFloat(r.getAttribute('x')) || 0;
                let ly = parseFloat(r.getAttribute('y')) || 0;
                const lw = parseFloat(r.getAttribute('width')) || 0;
                const lh = parseFloat(r.getAttribute('height')) || 0;
                // Account for translate on parent <g>
                const tg = r.parentNode;
                if (tg) {
                    const tf2 = (tg.getAttribute('transform') || '').match(/translate\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
                    if (tf2) { lx += parseFloat(tf2[1]); ly += parseFloat(tf2[2]); }
                }
                const labelMidX = lx + lw / 2;
                // Check if the label's horizontal centre is within the container's x-range
                if (labelMidX >= geo.x && labelMidX <= geo.x + geo.w) {
                    const labelBottom = ly + lh;
                    if (labelBottom > bottom) bottom = labelBottom;
                }
            }
            if (bottom > geo.y + geo.h) {
                geo.h = bottom - geo.y + 6; // +6px padding below labels
            }
            return geo;
        }

        // ── Defs: glow filter + pulse animation ──
        let defs = svgEl.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svgEl.insertBefore(defs, svgEl.firstChild);
        }
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'cluster-highlight-glow');
        filter.setAttribute('x', '-20%');  filter.setAttribute('y', '-20%');
        filter.setAttribute('width', '140%'); filter.setAttribute('height', '140%');
        const feGaussian = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        feGaussian.setAttribute('stdDeviation', '4');
        feGaussian.setAttribute('result', 'glow');
        filter.appendChild(feGaussian);
        const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
        const fm1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        fm1.setAttribute('in', 'glow');  feMerge.appendChild(fm1);
        const fm2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
        fm2.setAttribute('in', 'SourceGraphic'); feMerge.appendChild(fm2);
        filter.appendChild(feMerge);
        defs.appendChild(filter);
        const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleEl.textContent = '@keyframes cluster-pulse { 0%, 100% { stroke-opacity: 1; } 50% { stroke-opacity: 0.4; } }';
        defs.appendChild(styleEl);

        // ── Dim overlays: semi-transparent dark rects over the non-active clusters ──
        dimIds.forEach(function(dimId) {
            const dimGeo = expandGeoForSwitchlessLabels(getRectGeometry(dimId));
            if (dimGeo) {
                const dimOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                dimOverlay.setAttribute('x', String(dimGeo.x));
                dimOverlay.setAttribute('y', String(dimGeo.y));
                dimOverlay.setAttribute('width', String(dimGeo.w));
                dimOverlay.setAttribute('height', String(dimGeo.h));
                dimOverlay.setAttribute('rx', String(dimGeo.rx));
                dimOverlay.setAttribute('ry', String(dimGeo.ry));
                dimOverlay.setAttribute('fill', '#000000');
                dimOverlay.setAttribute('opacity', '0.55');
                dimOverlay.setAttribute('pointer-events', 'none');
                mainGroup.appendChild(dimOverlay);
            }
        });

        // ── Highlight borders: glowing animated stroke around the active clusters ──
        const highlightColor = clusterRole === 'management' ? '#10b981' : '#3b82f6';
        activeIds.forEach(function(activeId) {
            const activeGeo = expandGeoForSwitchlessLabels(getRectGeometry(activeId));
            if (activeGeo) {
                const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                highlight.setAttribute('x', String(activeGeo.x - 2));
                highlight.setAttribute('y', String(activeGeo.y - 2));
                highlight.setAttribute('width', String(activeGeo.w + 4));
                highlight.setAttribute('height', String(activeGeo.h + 4));
                highlight.setAttribute('rx', String(activeGeo.rx));
                highlight.setAttribute('ry', String(activeGeo.ry));
                highlight.setAttribute('fill', 'none');
                highlight.setAttribute('stroke', highlightColor);
                highlight.setAttribute('stroke-width', '3');
                highlight.setAttribute('filter', 'url(#cluster-highlight-glow)');
                highlight.setAttribute('style', 'animation: cluster-pulse 2s ease-in-out infinite;');
                highlight.setAttribute('pointer-events', 'none');
                mainGroup.appendChild(highlight);
            }
        });
    }

    /**
     * Fetch the outbound connectivity diagram SVG, inline it, and apply cluster highlighting
     * for disconnected operations diagrams.
     */
    function loadAndHighlightOutboundDiagram() {
        const container = document.getElementById('outbound-diagram-container');
        if (!container) return;

        const diagramUrl = container.getAttribute('data-diagram-url');
        const clusterRole = container.getAttribute('data-cluster-role');
        if (!diagramUrl) return;

        fetch(diagramUrl)
            .then(function(resp) { return resp.text(); })
            .then(function(svgText) {
                if (!svgText || svgText.indexOf('<svg') === -1) {
                    container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">Diagram not available</div>';
                    return;
                }
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgText, 'image/svg+xml');
                const svgEl = doc.querySelector('svg');
                if (!svgEl) {
                    container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">Diagram not available</div>';
                    return;
                }

                // Make SVG responsive
                svgEl.setAttribute('width', '100%');
                svgEl.removeAttribute('height');
                svgEl.style.display = 'block';
                svgEl.style.margin = '0 auto';

                // Apply cluster highlighting for disconnected diagrams
                if (clusterRole) {
                    highlightClusterInSvg(svgEl, clusterRole);
                }

                // Replace loading placeholder with inline SVG
                container.innerHTML = '';
                container.appendChild(document.adoptNode(svgEl));
            })
            .catch(function(err) {
                console.warn('Failed to load outbound diagram:', err);
                container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">Diagram not available</div>';
            });
    }

    /**
     * Open the outbound connectivity diagram in a full-screen modal with pan & zoom.
     */
    function openDiagramZoom() {
        const container = document.getElementById('outbound-diagram-container');
        if (!container) return;
        const srcSvg = container.querySelector('svg');
        if (!srcSvg) return;

        // Clone the SVG so the original stays untouched
        const svgClone = srcSvg.cloneNode(true);
        // Restore intrinsic dimensions for the modal viewport
        const vb = (svgClone.getAttribute('viewBox') || '').trim();
        const vbParts = vb.split(/\s+/).map(Number);
        const intrinsicW = (vbParts.length === 4 && vbParts[2]) ? vbParts[2] : 1431;
        const intrinsicH = (vbParts.length === 4 && vbParts[3]) ? vbParts[3] : 480;
        svgClone.setAttribute('width', String(intrinsicW));
        svgClone.setAttribute('height', String(intrinsicH));
        svgClone.style.width = '';
        svgClone.style.margin = '';
        svgClone.style.display = 'block';

        // Build modal DOM
        const backdrop = document.createElement('div');
        backdrop.className = 'diagram-modal-backdrop';

        const toolbar = document.createElement('div');
        toolbar.className = 'diagram-modal-toolbar';

        const titleEl = document.createElement('span');
        titleEl.className = 'diagram-modal-title';
        let diagramTitle = '';
        const h4 = document.querySelector('#outbound-connectivity-diagram h4');
        if (h4) diagramTitle = h4.textContent || '';
        titleEl.textContent = diagramTitle || 'Disconnected Operations Diagram';

        const controls = document.createElement('span');
        controls.className = 'diagram-modal-controls';

        const btnZoomIn = document.createElement('button');
        btnZoomIn.className = 'diagram-modal-btn';
        btnZoomIn.textContent = '+';
        btnZoomIn.title = 'Zoom in';

        const btnZoomOut = document.createElement('button');
        btnZoomOut.className = 'diagram-modal-btn';
        btnZoomOut.textContent = '\u2013'; // en-dash
        btnZoomOut.title = 'Zoom out';

        const btnReset = document.createElement('button');
        btnReset.className = 'diagram-modal-btn';
        btnReset.textContent = 'Fit';
        btnReset.title = 'Reset zoom to fit';

        const zoomLabel = document.createElement('span');
        zoomLabel.className = 'diagram-modal-zoom-label';

        const btnClose = document.createElement('button');
        btnClose.className = 'diagram-modal-btn';
        btnClose.textContent = '\u2715'; // X
        btnClose.title = 'Close (Esc)';
        btnClose.style.marginLeft = '0.5rem';

        controls.appendChild(btnZoomOut);
        controls.appendChild(zoomLabel);
        controls.appendChild(btnZoomIn);
        controls.appendChild(btnReset);
        controls.appendChild(btnClose);
        toolbar.appendChild(titleEl);
        toolbar.appendChild(controls);

        const viewport = document.createElement('div');
        viewport.className = 'diagram-modal-viewport';
        viewport.appendChild(svgClone);

        const hint = document.createElement('div');
        hint.className = 'diagram-modal-hint';
        hint.textContent = 'Scroll to zoom \u00B7 Drag to pan \u00B7 Esc to close';

        backdrop.appendChild(toolbar);
        backdrop.appendChild(viewport);
        backdrop.appendChild(hint);
        document.body.appendChild(backdrop);

        // ── Zoom / pan state ──
        let scale = 1;
        let panX = 0;
        let panY = 0;
        const MIN_SCALE = 0.25;
        const MAX_SCALE = 5;

        function fitToViewport() {
            const vw = viewport.clientWidth * 0.92;
            const vh = viewport.clientHeight * 0.92;
            scale = Math.min(vw / intrinsicW, vh / intrinsicH, 2);
            panX = (viewport.clientWidth - intrinsicW * scale) / 2;
            panY = (viewport.clientHeight - intrinsicW * scale * (intrinsicH / intrinsicW)) / 2;
            applyTransform();
        }

        function applyTransform() {
            svgClone.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
            zoomLabel.textContent = Math.round(scale * 100) + '%';
        }

        function zoomBy(delta, cx, cy) {
            const prev = scale;
            scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * delta));
            // Adjust pan so the zoom centres on (cx, cy)
            panX = cx - (cx - panX) * (scale / prev);
            panY = cy - (cy - panY) * (scale / prev);
            applyTransform();
        }

        // Initial fit
        requestAnimationFrame(fitToViewport);

        // Button handlers
        btnZoomIn.addEventListener('click', function(e) { e.stopPropagation(); zoomBy(1.3, viewport.clientWidth / 2, viewport.clientHeight / 2); });
        btnZoomOut.addEventListener('click', function(e) { e.stopPropagation(); zoomBy(1 / 1.3, viewport.clientWidth / 2, viewport.clientHeight / 2); });
        btnReset.addEventListener('click', function(e) { e.stopPropagation(); fitToViewport(); });

        // Scroll-to-zoom
        viewport.addEventListener('wheel', function(e) {
            e.preventDefault();
            const rect = viewport.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            zoomBy(factor, cx, cy);
        }, { passive: false });

        // Drag-to-pan
        let dragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        viewport.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            dragging = true;
            dragStartX = e.clientX - panX;
            dragStartY = e.clientY - panY;
            e.preventDefault();
        });
        function onMove(e) {
            if (!dragging) return;
            panX = e.clientX - dragStartX;
            panY = e.clientY - dragStartY;
            applyTransform();
        }
        function onUp() {
            dragging = false;
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        // Close handlers
        function onKey(e) {
            if (e.key === 'Escape') closeModal();
        }
        function closeModal() {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            document.removeEventListener('keydown', onKey);
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }
        document.addEventListener('keydown', onKey);
        btnClose.addEventListener('click', function(e) { e.stopPropagation(); closeModal(); });
        backdrop.addEventListener('click', function(e) {
            if (e.target === backdrop) closeModal();
        });
    }

    function tryParsePayload() {
        // 1) URL hash payload (preferred for file:// reliability)
        try {
            const hash = window.location.hash || '';
            const idx = hash.indexOf('data=');
            if (idx >= 0) {
                let encoded = hash.substring(idx + 5);
                encoded = decodeURIComponent(encoded);
                const json = decodeURIComponent(escape(atob(encoded)));
                return JSON.parse(json);
            }
        } catch (e) {
            // ignore
        }

        // 2) localStorage fallback
        try {
            const raw = localStorage.getItem('azloc_report_payload');
            if (raw) return JSON.parse(raw);
        } catch (e2) {
            // ignore
        }

        return null;
    }

    function formatScenario(val, s) {
        if (!val) return '-';
        if (val === 'hyperconverged') return 'Hyperconverged';
        if (val === 'multirack') return 'Multi-Rack';
        if (val === 'disconnected') {
            if (s && s.outbound === 'limited') return 'Disconnected (Limited Connectivity)';
            if (s && s.outbound === 'air_gapped') return 'Disconnected (Air Gapped)';
            return 'Disconnected';
        }
        if (val === 'm365local') return 'Microsoft 365 Local';
        return val;
    }

    function formatCloud(val) {
        if (!val) return '-';
        if (val === 'azure_commercial') return 'Azure Commercial';
        if (val === 'azure_government') return 'Azure Government';
        if (val === 'azure_china') return 'Azure China';
        return val;
    }

    function formatLocalInstanceRegion(val) {
        if (!val) return '-';
        const map = {
            east_us: 'East US (Commercial)',
            south_central_us: 'South Central US (Commercial)',
            west_europe: 'West Europe (Commercial)',
            australia_east: 'Australia East (Commercial)',
            southeast_asia: 'Southeast Asia (Commercial)',
            india_central: 'Central India (Commercial)',
            canada_central: 'Canada Central (Commercial)',
            japan_east: 'Japan East (Commercial)',
            us_gov_virginia: 'US Gov Virginia (Government)'
        };
        return map[val] || val;
    }

    function formatScale(val) {
        if (!val) return '-';
        if (val === 'low_capacity') return 'Low Capacity';
        if (val === 'medium') return 'Standard';
        if (val === 'rack_aware') return 'Rack Aware (Multi-Room)';
        return val;
    }

    function formatOutbound(val) {
        if (!val) return '-';
        if (val === 'public') return 'Public Internet';
        if (val === 'private') return 'Private (Azure Firewall + Proxy)';
        return val;
    }

    function formatIntent(val) {
        if (!val) return '-';
        if (val === 'all_traffic') return 'Fully Converged Network';
        if (val === 'mgmt_compute') return 'Management + Compute (Storage Separate)';
        if (val === 'compute_storage') return 'Compute + Storage (Management Separate)';
        if (val === 'custom') return 'Custom';
        return val;
    }

    function block(title, bodyHtml) {
        return '<div class="summary-section">'
            + '<div class="summary-section-title summary-section-title--infra">' + escapeHtml(title) + '</div>'
            + '<div style="color:var(--text-primary); line-height:1.55;">' + bodyHtml + '</div>'
            + '</div>';
    }

    function list(items) {
        if (!items || items.length === 0) return '<div style="color:var(--text-secondary);">-</div>';
        return '<ul style="margin:0.25rem 0 0 1.25rem; color:var(--text-primary);">'
            + items.map(function(x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('')
            + '</ul>';
    }

    function rationaleForState(s) {
        const validations = computeValidations(s);
        const sections = [];

        function renderSwitchedIntentDiagram(state) {
            // Single-node clusters have no storage connectivity choice (state.storage is null)
            // but should still render a diagram showing the ToR switch and node
            const isSingleNode = state && state.nodes === '1';
            if (!state || (state.storage !== 'switched' && !isSingleNode)) return '';

            if (String(state.nodes) === '16+') {
                return '<div style="color:var(--text-secondary);">Diagram is not generated for 16+ nodes (the wizard does not collect per-node details for this case).</div>';
            }

            let nAll = parseInt(state.nodes, 10);
            if (isNaN(nAll) || nAll < 1) nAll = 1;
            // Show max 2 nodes for cleaner diagram with ToR switches
            const n = Math.min(2, nAll);

            let ports = parseInt(state.ports, 10);
            if (isNaN(ports) || ports < 0) ports = 0;

            // Determine ToR switch configuration (single or dual)
            const torCount = (state.torSwitchCount === 'single') ? 1 : 2;
            const showTorSwitches = (state.scale === 'medium' || state.scale === 'low_capacity') &&
                !!state.torSwitchCount;

            function getNodeLabel(idx) {
                if (state.nodeSettings && state.nodeSettings[idx] && state.nodeSettings[idx].name) {
                    return String(state.nodeSettings[idx].name).trim() || ('Node ' + (idx + 1));
                }
                return 'Node ' + (idx + 1);
            }

            function autoIpLabel(val) {
                if (val === 'disabled') return 'AutoIP: False';
                if (val === 'enabled') return 'AutoIP: True';
                return 'AutoIP: -';
            }

            function getNicLabel(idx1Based) {
                return getPortCustomName(state, idx1Based, 'nic');
            }

            const isCustom = state.intent === 'custom';

            // Check if adapter mapping is confirmed (used for mgmt_compute intent)
            const hasAdapterMapping = state.adapterMappingConfirmed && state.adapterMapping && Object.keys(state.adapterMapping).length > 0;

            function getCustomIntentGroups(customIntents, portCount) {
                const p = parseInt(portCount, 10) || 0;
                if (!customIntents || p <= 0) return [];

                const trafficNames = {
                    mgmt: 'Management',
                    compute: 'Compute',
                    compute_1: 'Compute 1',
                    compute_2: 'Compute 2',
                    storage: 'Storage',
                    mgmt_compute: 'Management + Compute',
                    compute_storage: 'Compute + Storage',
                    all: 'All Traffic',
                    unused: 'Unused'
                };

                // CodeQL js/remote-property-injection (#22): use a Map for
                // user-controlled intent keys.
                const buckets = new Map();
                for (let i = 1; i <= p; i++) {
                    const assignment = customIntents[i] ? String(customIntents[i]) : 'unused';
                    if (assignment === 'unused') continue;
                    if (!buckets.has(assignment)) buckets.set(assignment, []);
                    buckets.get(assignment).push(i);
                }

                // Always show Mgmt + Compute first when present.
                const order = ['mgmt_compute', 'mgmt', 'compute', 'compute_1', 'compute_2', 'compute_storage', 'storage', 'all'];
                const groups = [];
                for (let oi = 0; oi < order.length; oi++) {
                    const key = order[oi];
                    const nics = buckets.get(key);
                    if (!nics || nics.length === 0) continue;
                    const label = (trafficNames[key] || key);
                    const isStorageLike = (key === 'storage' || key === 'compute_storage' || key === 'all');
                    groups.push({ key: key, label: label, nics: nics, isStorageLike: isStorageLike });
                }

                // Include any unexpected keys at the end (stable).
                Array.from(buckets.keys()).sort().forEach(function(k) {
                    if (order.indexOf(k) >= 0) return;
                    const nics2 = buckets.get(k);
                    if (!nics2 || nics2.length === 0) return;
                    groups.push({ key: k, label: (trafficNames[k] || k), nics: nics2, isStorageLike: (String(k).indexOf('storage') >= 0) });
                });

                return groups;
            }

            // Get intent groups from adapter mapping (for mgmt_compute intent with confirmed mapping)
            function getAdapterMappingGroups(adapterMapping, portCount) {
                const p = parseInt(portCount, 10) || 0;
                if (!adapterMapping || p <= 0) return [];

                const trafficNames = {
                    mgmt: 'Management + Compute',
                    compute: 'Compute',
                    compute_1: 'Compute 1',
                    compute_2: 'Compute 2',
                    storage: 'Storage',
                    compute_storage: 'Compute + Storage',
                    all: 'All Traffic',
                    pool: 'Management + Compute'
                };

                // CodeQL js/remote-property-injection (#23): use a Map for
                // user-controlled intent keys.
                const buckets = new Map();
                for (let i = 1; i <= p; i++) {
                    let assignment = adapterMapping[i] || 'pool';
                    // Normalize 'mgmt' and 'pool' to 'mgmt' for grouping
                    if (assignment === 'pool') assignment = 'mgmt';
                    if (!buckets.has(assignment)) buckets.set(assignment, []);
                    buckets.get(assignment).push(i);
                }

                const order = ['mgmt', 'compute', 'compute_1', 'compute_2', 'storage', 'compute_storage', 'all'];
                const groups = [];
                for (let oi = 0; oi < order.length; oi++) {
                    const key = order[oi];
                    const nics = buckets.get(key);
                    if (!nics || nics.length === 0) continue;
                    const label = (trafficNames[key] || key);
                    const isStorageLike = (key === 'storage' || key === 'compute_storage' || key === 'all');
                    groups.push({ key: key, label: label, nics: nics, isStorageLike: isStorageLike });
                }

                return groups;
            }

            const showStorageGroup = !isCustom && state.intent !== 'all_traffic';
            const storagePortCount = (!isCustom && showStorageGroup) ? Math.max(0, ports - 2) : 0;

            // Get adapter mapping groups if applicable
            const adapterMappingGroups = hasAdapterMapping ? getAdapterMappingGroups(state.adapterMapping, ports) : [];
            const customGroups = isCustom ? getCustomIntentGroups(state.customIntents, ports) : [];

            // Layout constants
            let nodeW = 320;
            const mgmtVnicAreaH = 48;
            const nodeH = 180 + mgmtVnicAreaH;
            const gapX = 40;
            const marginX = 50;
            const torSwitchH = 50;
            const torSwitchW = 140;
            const torGap = 60;
            const torToNodeGap = 80;
            const marginTop = showTorSwitches ? 90 : 70;
            const marginBottom = 50;

            // Calculate adapter dimensions based on port count
            const adapterW = 54;
            const adapterH = 36;
            const adapterGap = 10;
            const totalAdapterW = (ports * adapterW) + (Math.max(0, ports - 1) * adapterGap);

            // Ensure node width accommodates all adapters
            nodeW = Math.max(nodeW, totalAdapterW + 40);

            // Calculate SVG dimensions
            const svgW = marginX * 2 + (n * nodeW) + ((n - 1) * gapX);
            const torAreaH = showTorSwitches ? (torSwitchH + torToNodeGap) : 0;
            const svgH = marginTop + torAreaH + nodeH + marginBottom + (nAll > 2 ? 40 : 0);

            // ToR switch positions
            const torY = marginTop + 10;
            let tor1X, tor2X;
            if (torCount === 2) {
                const totalTorW = (2 * torSwitchW) + torGap;
                tor1X = (svgW - totalTorW) / 2;
                tor2X = tor1X + torSwitchW + torGap;
            } else {
                tor1X = (svgW - torSwitchW) / 2;
                tor2X = tor1X; // Not used for single ToR
            }

            // Node positions (horizontally centered)
            const nodesStartX = (svgW - (n * nodeW) - ((n - 1) * gapX)) / 2;
            const nodeY = marginTop + torAreaH + 10;

            function nodePos(i) {
                return {
                    x: nodesStartX + (i * (nodeW + gapX)),
                    y: nodeY
                };
            }

            // Collect all adapter positions for drawing uplinks later
            const adapterPositions = [];

            const mgmtVlanLabel = (state.infraVlan === 'custom' && state.infraVlanId) ? ('VLAN ' + state.infraVlanId) : 'Default VLAN';

            function renderMgmtVnicCard(boxX, boxTotalW, boxTopY) {
                const vaCardW = 80;
                const vaCardH = 30;
                const vaX = boxX + (boxTotalW - vaCardW) / 2;
                const vaY = boxTopY + 6;
                let vo = '';
                vo += '<rect x="' + vaX + '" y="' + vaY + '" width="' + vaCardW + '" height="' + vaCardH + '" rx="6" fill="rgba(0,120,212,0.10)" stroke="rgba(0,120,212,0.55)" stroke-dasharray="4 2" />';
                vo += '<text x="' + (vaX + vaCardW / 2) + '" y="' + (vaY + 13) + '" text-anchor="middle" font-size="8" fill="var(--text-primary)" font-weight="600">Mgmt vNIC</text>';
                vo += '<text x="' + (vaX + vaCardW / 2) + '" y="' + (vaY + 24) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">' + escapeHtml(mgmtVlanLabel) + '</text>';
                vo += '<line x1="' + (boxX + 6) + '" y1="' + (boxTopY + mgmtVnicAreaH - 6) + '" x2="' + (boxX + boxTotalW - 6) + '" y2="' + (boxTopY + mgmtVnicAreaH - 6) + '" stroke="rgba(0,120,212,0.3)" stroke-dasharray="3 2" />';
                return vo;
            }

            function renderAdaptersHorizontal(nodeLeft, nodeTop, nodeIdx) {
                let out = '';
                const adaptersY = nodeTop + nodeH - adapterH - 20;
                const startX = nodeLeft + (nodeW - totalAdapterW) / 2;
                const setH = adapterH + 24;
                const setY = adaptersY - 12;

                // If adapter mapping is confirmed, use it to determine intent groups
                if (hasAdapterMapping && adapterMappingGroups.length > 0) {
                    // Build a map of port to intent for adapter mapping
                    const portToIntent = {};
                    for (let gi = 0; gi < adapterMappingGroups.length; gi++) {
                        var grp = adapterMappingGroups[gi];
                        for (let ni = 0; ni < grp.nics.length; ni++) {
                            portToIntent[grp.nics[ni]] = grp;
                        }
                    }

                    // Build ordered list of ports grouped by intent (Mgmt+Compute first, then Storage)
                    let orderedPorts = [];
                    const mgmtPorts = [];
                    const storagePorts = [];
                    for (let pi = 1; pi <= ports; pi++) {
                        var grp = portToIntent[pi];
                        if (grp && grp.isStorageLike) {
                            storagePorts.push(pi);
                        } else {
                            mgmtPorts.push(pi);
                        }
                    }
                    orderedPorts = mgmtPorts.concat(storagePorts);

                    // Calculate intent group box positions based on grouped layout
                    var intentGap = 8; // Gap between intent boxes

                    // Draw Mgmt + Compute box (first group)
                    if (mgmtPorts.length > 0) {
                        const mgmtBoxW = (mgmtPorts.length * adapterW) + ((mgmtPorts.length - 1) * adapterGap) + 12;
                        const mgmtBoxX = startX - 6;
                        const mgmtBoxFullY = setY - mgmtVnicAreaH;
                        const mgmtBoxFullH = setH + mgmtVnicAreaH;
                        out += '<rect x="' + mgmtBoxX + '" y="' + mgmtBoxFullY + '" width="' + mgmtBoxW + '" height="' + mgmtBoxFullH + '" rx="10" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="5 3" />';
                        out += '<text x="' + (mgmtBoxX + mgmtBoxW / 2) + '" y="' + (setY - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">Management + Compute</text>';
                        out += renderMgmtVnicCard(mgmtBoxX, mgmtBoxW, mgmtBoxFullY);
                    }

                    // Draw Storage box (second group)
                    if (storagePorts.length > 0) {
                        const storageStartX = startX + (mgmtPorts.length * (adapterW + adapterGap)) + intentGap;
                        const storageBoxW = (storagePorts.length * adapterW) + ((storagePorts.length - 1) * adapterGap) + 12;
                        const storageBoxX = storageStartX - 6;
                        out += '<rect x="' + storageBoxX + '" y="' + setY + '" width="' + storageBoxW + '" height="' + setH + '" rx="10" fill="rgba(139,92,246,0.07)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="5 3" />';
                        out += '<text x="' + (storageBoxX + storageBoxW / 2) + '" y="' + (setY - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">Storage</text>';
                    }

                    // Draw adapters in grouped order (Mgmt+Compute ports first, then Storage ports)
                    for (let oi = 0; oi < orderedPorts.length; oi++) {
                        var nicIdx = orderedPorts[oi];
                        const isMgmt = mgmtPorts.indexOf(nicIdx) >= 0;

                        // Calculate X position based on grouped layout
                        var x;
                        if (isMgmt) {
                            const mgmtIdx = mgmtPorts.indexOf(nicIdx);
                            x = startX + (mgmtIdx * (adapterW + adapterGap));
                        } else {
                            const storageIdx = storagePorts.indexOf(nicIdx);
                            x = startX + (mgmtPorts.length * (adapterW + adapterGap)) + intentGap + (storageIdx * (adapterW + adapterGap));
                        }
                        var y = adaptersY;

                        var grp = portToIntent[nicIdx];
                        var isStorage = grp && grp.isStorageLike;
                        var fill = isStorage ? 'rgba(139,92,246,0.25)' : 'rgba(0,120,212,0.20)';
                        var stroke = isStorage ? 'rgba(139,92,246,0.65)' : 'rgba(0,120,212,0.55)';
                        // Always use getNicLabel for physical port names (from portConfig)
                        var label = getNicLabel(nicIdx);
                        // Calculate position within intent group for staggering
                        var posInGroup = isMgmt ? mgmtPorts.indexOf(nicIdx) : storagePorts.indexOf(nicIdx);
                        // Center text vertically if label is 11 characters or less, otherwise stagger
                        var textY = (label.length <= 11) ? (y + 22) : ((posInGroup % 2 === 0) ? (y + 16) : (y + 28));

                        out += '<rect x="' + x + '" y="' + y + '" width="' + adapterW + '" height="' + adapterH + '" rx="6" fill="' + fill + '" stroke="' + stroke + '" />';
                        out += '<text x="' + (x + adapterW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="600">' + escapeHtml(label) + '</text>';

                        adapterPositions.push({
                            nodeIdx: nodeIdx,
                            nicIdx: nicIdx,
                            x: x + adapterW / 2,
                            y: y,
                            isStorage: isStorage,
                            posInGroup: posInGroup  // Position within intent group (0=first, 1=second, etc.)
                        });
                    }
                    return out;
                }

                // Default behavior (no adapter mapping) - NICs 1-2 are Mgmt+Compute, NICs 3+ are Storage
                if (!isCustom && ports >= 2) {
                    // Management + Compute box (first 2 NICs)
                    const setW = (2 * adapterW) + adapterGap + 12;
                    const setX = startX - 6;
                    const mgmtSetY = setY - mgmtVnicAreaH;
                    const mgmtSetH = setH + mgmtVnicAreaH;
                    out += '<rect x="' + setX + '" y="' + mgmtSetY + '" width="' + setW + '" height="' + mgmtSetH + '" rx="10" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="5 3" />';

                    // Label for Mgmt + Compute group
                    const mgmtLabel = (state.intent === 'all_traffic') ? 'Management + Compute + Storage' : 'Management + Compute';
                    out += '<text x="' + (setX + setW / 2) + '" y="' + (setY - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">' + escapeHtml(mgmtLabel) + '</text>';
                    out += renderMgmtVnicCard(setX, setW, mgmtSetY);

                    // Storage box (NICs 3+) if applicable - add gap between boxes
                    if (showStorageGroup && storagePortCount > 0) {
                        var intentGap = 8; // Gap between intent boxes
                        const storageW = (storagePortCount * adapterW) + ((storagePortCount - 1) * adapterGap) + 12;
                        const storageX = startX + (2 * (adapterW + adapterGap)) - 6 + intentGap;
                        out += '<rect x="' + storageX + '" y="' + setY + '" width="' + storageW + '" height="' + setH + '" rx="10" fill="rgba(139,92,246,0.07)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="5 3" />';
                        out += '<text x="' + (storageX + storageW / 2) + '" y="' + (setY - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">Storage</text>';
                    }
                }

                // Calculate intent gap for storage adapter positioning
                const storageIntentGap = (!isCustom && showStorageGroup && storagePortCount > 0) ? 8 : 0;

                // Draw all adapters horizontally
                for (let i = 0; i < ports; i++) {
                    // Storage adapters (index 2+) need to shift by the intent gap to center in purple box
                    const adapterOffset = (i >= 2 && storageIntentGap > 0) ? storageIntentGap : 0;
                    var x = startX + (i * (adapterW + adapterGap)) + adapterOffset;
                    var y = adaptersY;
                    var nicIdx = i + 1;

                    // Determine if this is a storage adapter (NIC 3+) or SET adapter (NIC 1-2)
                    var isStorage = !isCustom && showStorageGroup && i >= 2;
                    var fill = isStorage ? 'rgba(139,92,246,0.25)' : 'rgba(0,120,212,0.20)';
                    var stroke = isStorage ? 'rgba(139,92,246,0.65)' : 'rgba(0,120,212,0.55)';
                    // Always use getNicLabel for physical port names
                    var label = getNicLabel(nicIdx);
                    // Calculate position within intent group (for uplink routing)
                    var posInGroup = isStorage ? (i - 2) : i;
                    // Center text vertically if label is 11 characters or less, otherwise stagger
                    var textY = (label.length <= 11) ? (y + 22) : ((posInGroup % 2 === 0) ? (y + 16) : (y + 28));

                    out += '<rect x="' + x + '" y="' + y + '" width="' + adapterW + '" height="' + adapterH + '" rx="6" fill="' + fill + '" stroke="' + stroke + '" />';
                    out += '<text x="' + (x + adapterW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="600">' + escapeHtml(label) + '</text>';

                    // Store adapter center position for uplink drawing
                    adapterPositions.push({
                        nodeIdx: nodeIdx,
                        nicIdx: nicIdx,
                        x: x + adapterW / 2,
                        y: y,
                        isStorage: isStorage,
                        posInGroup: posInGroup  // Position within intent group (0=first, 1=second, etc.)
                    });
                }

                return out;
            }

            function renderCustomAdaptersHorizontal(nodeLeft, nodeTop, nodeIdx) {
                let out = '';
                const adaptersY = nodeTop + nodeH - adapterH - 20;

                // Build a map of port to intent
                const portIntent = {};
                for (let gi2 = 0; gi2 < customGroups.length; gi2++) {
                    var grp = customGroups[gi2];
                    for (var ni = 0; ni < grp.nics.length; ni++) {
                        portIntent[grp.nics[ni]] = grp;
                    }
                }

                // Build ordered list of ports grouped by intent (following customGroups order)
                // This ensures ports with the same intent are visually grouped together
                const orderedPorts = [];
                const intentGap = 8; // Gap between intent boxes

                for (var gi = 0; gi < customGroups.length; gi++) {
                    var grp = customGroups[gi];
                    for (var ni = 0; ni < grp.nics.length; ni++) {
                        orderedPorts.push(grp.nics[ni]);
                    }
                }

                // Include any ports not assigned to intents (unused)
                for (var pi = 1; pi <= ports; pi++) {
                    if (orderedPorts.indexOf(pi) < 0) {
                        orderedPorts.push(pi);
                    }
                }

                // Calculate total width including gaps between intent groups
                let totalGroupedW = (ports * adapterW) + (Math.max(0, ports - 1) * adapterGap);
                if (customGroups.length > 1) {
                    totalGroupedW += (customGroups.length - 1) * intentGap;
                }
                const groupedStartX = nodeLeft + (nodeW - totalGroupedW) / 2;

                // Build position map for each port based on grouped layout
                const portPositions = {};
                let currentX = groupedStartX;
                const boxY = adaptersY - 12;
                const boxH = adapterH + 24;

                for (var gi = 0; gi < customGroups.length; gi++) {
                    var grp = customGroups[gi];
                    const grpPorts = grp.nics;
                    const grpW = (grpPorts.length * adapterW) + ((grpPorts.length - 1) * adapterGap);

                    // Draw intent box
                    const boxX = currentX - 8;
                    const boxTotalW = grpW + 16;

                    // Color based on intent type
                    const isStorageLike = grp.isStorageLike;
                    var isCompute = (grp.key === 'compute' || grp.key === 'compute_1' || grp.key === 'compute_2');
                    var boxFill, boxStroke;
                    if (isStorageLike) {
                        boxFill = 'rgba(139,92,246,0.07)';
                        boxStroke = 'rgba(139,92,246,0.45)';
                    } else if (isCompute) {
                        boxFill = 'rgba(16,185,129,0.07)';
                        boxStroke = 'rgba(16,185,129,0.45)';
                    } else {
                        boxFill = 'rgba(0,120,212,0.07)';
                        boxStroke = 'rgba(0,120,212,0.45)';
                    }

                    const isMgmtCustom = (grp.key === 'mgmt_compute' || grp.key === 'mgmt' || grp.key === 'all');
                    const customVnicH = isMgmtCustom ? mgmtVnicAreaH : 0;
                    const customBoxY = boxY - customVnicH;
                    const customBoxH = boxH + customVnicH;
                    out += '<rect x="' + boxX + '" y="' + customBoxY + '" width="' + boxTotalW + '" height="' + customBoxH + '" rx="10" fill="' + boxFill + '" stroke="' + boxStroke + '" stroke-dasharray="5 3" />';
                    out += '<text x="' + (boxX + boxTotalW / 2) + '" y="' + (boxY - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">' + escapeHtml(grp.label) + '</text>';
                    if (isMgmtCustom) {
                        out += renderMgmtVnicCard(boxX, boxTotalW, customBoxY);
                    }

                    // Assign positions to ports in this group
                    for (var pi = 0; pi < grpPorts.length; pi++) {
                        var nicIdx = grpPorts[pi];
                        portPositions[nicIdx] = {
                            x: currentX + (pi * (adapterW + adapterGap)),
                            posInGroup: pi
                        };
                    }

                    // Move currentX for next group
                    currentX += grpW + adapterGap + intentGap;
                }

                // Draw adapters in grouped order
                for (let oi = 0; oi < orderedPorts.length; oi++) {
                    var nicIdx = orderedPorts[oi];
                    let posData = portPositions[nicIdx];

                    // For unassigned ports, calculate position at the end
                    if (!posData) {
                        posData = {
                            x: currentX + ((oi - (orderedPorts.length - (ports - Object.keys(portPositions).length))) * (adapterW + adapterGap)),
                            posInGroup: 0
                        };
                    }

                    const x = posData.x;
                    const y = adaptersY;

                    const grp2 = portIntent[nicIdx];
                    const isStorage = grp2 && grp2.isStorageLike;
                    var isCompute = grp2 && grp2.key === 'compute';
                    var fill, stroke;

                    if (isStorage) {
                        fill = 'rgba(139,92,246,0.25)';
                        stroke = 'rgba(139,92,246,0.65)';
                    } else if (isCompute) {
                        fill = 'rgba(16,185,129,0.22)';
                        stroke = 'rgba(16,185,129,0.7)';
                    } else {
                        fill = 'rgba(0,120,212,0.20)';
                        stroke = 'rgba(0,120,212,0.55)';
                    }

                    // Always use getNicLabel for physical port names
                    const label = getNicLabel(nicIdx);
                    // Get position within intent group
                    const posInGroup = posData.posInGroup || 0;
                    // Center text vertically if label is 11 characters or less, otherwise stagger
                    const textY = (label.length <= 11) ? (y + 22) : ((posInGroup % 2 === 0) ? (y + 16) : (y + 28));

                    out += '<rect x="' + x + '" y="' + y + '" width="' + adapterW + '" height="' + adapterH + '" rx="6" fill="' + fill + '" stroke="' + stroke + '" />';
                    out += '<text x="' + (x + adapterW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="600">' + escapeHtml(label) + '</text>';

                    // Store adapter center position for uplink drawing
                    adapterPositions.push({
                        nodeIdx: nodeIdx,
                        nicIdx: nicIdx,
                        x: x + adapterW / 2,
                        y: y,
                        isStorage: isStorage,
                        posInGroup: posInGroup  // Position within intent group (0=first, 1=second, etc.)
                    });
                }

                return out;
            }

            function renderUplinks() {
                if (!showTorSwitches) return '';
                let out = '';
                const torBottomY = torY + torSwitchH;

                for (let ai = 0; ai < adapterPositions.length; ai++) {
                    const ap = adapterPositions[ai];
                    const adapterTopY = ap.y;

                    // Determine which ToR switch to connect to
                    // For dual ToR: use position within intent group (first port → ToR 1, second port → ToR 2)
                    // For single ToR: all connect to the single switch
                    var targetTorX;
                    if (torCount === 2) {
                        // Use posInGroup if available (adapter mapping), otherwise fall back to NIC index
                        const posInGroup = (ap.posInGroup !== undefined) ? ap.posInGroup : (ap.nicIdx - 1);
                        // First port of each intent (posInGroup 0, 2, 4...) → ToR 1
                        // Second port of each intent (posInGroup 1, 3, 5...) → ToR 2
                        targetTorX = (posInGroup % 2 === 0) ? (tor1X + torSwitchW / 2) : (tor2X + torSwitchW / 2);
                    } else {
                        targetTorX = tor1X + torSwitchW / 2;
                    }

                    // Draw uplink line from adapter to ToR switch
                    const lineColor = ap.isStorage ? 'rgba(139,92,246,0.5)' : 'rgba(0,120,212,0.4)';
                    out += '<line x1="' + ap.x + '" y1="' + adapterTopY + '" x2="' + targetTorX + '" y2="' + torBottomY + '" stroke="' + lineColor + '" stroke-width="1.5" stroke-dasharray="4 2" />';
                }

                return out;
            }

            // Build intro text
            const torLabel = showTorSwitches ? (torCount === 1 ? 'Single ToR' : 'Dual ToR') : '';
            const scenarioLabel = isSingleNode ? 'Single-node' : 'Storage Switched';
            const intro = ''
                + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                + '<strong style="color:var(--text-primary);">' + scenarioLabel + '</strong> scenario diagram'
                + (showTorSwitches ? (' with ' + torLabel + ' switch' + (torCount === 1 ? '' : 'es')) : '') + '.'
                + (showTorSwitches
                    ? '<br>Shows per-node intent groupings and uplinks to ToR switch' + (torCount === 1 ? '' : 'es') + '.'
                    : '<br>Shows per-node intent groupings.')
                + (nAll > 2 ? ('<br><span style="color:var(--text-secondary);">Showing first 2 of ' + escapeHtml(String(nAll)) + ' nodes.</span>') : '')
                + '</div>';

            let svg = '';
            svg += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" role="img" aria-label="' + (isSingleNode ? 'Single-node network' : 'Switched intent') + ' diagram with ToR switch' + (torCount === 1 ? '' : 'es') + '">';

            // Outer container
            svg += '<rect x="30" y="55" width="' + (svgW - 60) + '" height="' + (svgH - 85) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(0,120,212,0.35)" stroke-dasharray="6 4" />';

            // Title text
            const titleText = isSingleNode
                ? 'Single-node network connectivity — ' + escapeHtml(autoIpLabel(state.storageAutoIp))
                : 'Storage Switched connectivity — Switchless=false, ' + escapeHtml(autoIpLabel(state.storageAutoIp)) + (nAll > 2 ? (' — Total nodes: ' + escapeHtml(String(nAll))) : '');
            svg += '<text x="' + (svgW / 2) + '" y="42" text-anchor="middle" font-size="13" fill="var(--text-secondary)">' + titleText + '</text>';

            // Render ToR switches
            if (showTorSwitches) {
                // ToR Switch 1
                svg += '<rect x="' + tor1X + '" y="' + torY + '" width="' + torSwitchW + '" height="' + torSwitchH + '" rx="10" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.6)" stroke-width="2" />';
                svg += '<text x="' + (tor1X + torSwitchW / 2) + '" y="' + (torY + 30) + '" text-anchor="middle" font-size="13" fill="var(--text-primary)" font-weight="600">ToR Switch 1</text>';

                // ToR Switch 2 (if dual)
                if (torCount === 2) {
                    svg += '<rect x="' + tor2X + '" y="' + torY + '" width="' + torSwitchW + '" height="' + torSwitchH + '" rx="10" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.6)" stroke-width="2" />';
                    svg += '<text x="' + (tor2X + torSwitchW / 2) + '" y="' + (torY + 30) + '" text-anchor="middle" font-size="13" fill="var(--text-primary)" font-weight="600">ToR Switch 2</text>';

                    // MLAG peer links between ToR switches
                    const mlagX1 = tor1X + torSwitchW; // Right edge of ToR 1
                    const mlagX2 = tor2X;              // Left edge of ToR 2
                    const mlagY1 = torY + torSwitchH / 2 - 6; // Upper link
                    const mlagY2 = torY + torSwitchH / 2 + 6; // Lower link
                    const mlagMidX = (mlagX1 + mlagX2) / 2;
                    const mlagLabelY = torY + torSwitchH / 2 - 14;
                    svg += '<line x1="' + mlagX1 + '" y1="' + mlagY1 + '" x2="' + mlagX2 + '" y2="' + mlagY1 + '" stroke="rgba(59,130,246,0.8)" stroke-width="2" />';
                    svg += '<line x1="' + mlagX1 + '" y1="' + mlagY2 + '" x2="' + mlagX2 + '" y2="' + mlagY2 + '" stroke="rgba(59,130,246,0.8)" stroke-width="2" />';
                    svg += '<text x="' + mlagMidX + '" y="' + mlagLabelY + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">MLAG</text>';
                }
            }

            // Render nodes
            for (let ni = 0; ni < n; ni++) {
                const pos = nodePos(ni);
                svg += '<rect x="' + pos.x + '" y="' + pos.y + '" width="' + nodeW + '" height="' + nodeH + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                svg += '<text x="' + (pos.x + nodeW / 2) + '" y="' + (pos.y + 30) + '" text-anchor="middle" font-size="15" fill="var(--text-primary)" font-weight="700">' + escapeHtml(getNodeLabel(ni)) + '</text>';

                if (!isCustom) {
                    svg += renderAdaptersHorizontal(pos.x, pos.y, ni);
                } else {
                    svg += renderCustomAdaptersHorizontal(pos.x, pos.y, ni);
                }
            }

            // Render uplinks after nodes so we have adapter positions
            svg += renderUplinks();

            // "+N more nodes" badge
            if (nAll > 2) {
                const more = nAll - 2;
                const badgeW = 180;
                const badgeH = 26;
                const badgeX = svgW - 50 - badgeW;
                const badgeY = svgH - 60;
                svg += '<rect x="' + badgeX + '" y="' + badgeY + '" width="' + badgeW + '" height="' + badgeH + '" rx="13" fill="rgba(255,255,255,0.05)" stroke="var(--glass-border)" />';
                svg += '<text x="' + (badgeX + badgeW / 2) + '" y="' + (badgeY + 17) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">+' + more + ' more node' + (more === 1 ? '' : 's') + '</text>';
            }

            svg += '</svg>';

            const note = isSingleNode
                ? '<div class="switchless-diagram__note">Note: Single-node deployments connect the node to the ToR switch for management and compute traffic. No storage connectivity is required as there is no cluster storage replication.</div>'
                : '<div class="switchless-diagram__note">Note: Storage Switched scenarios connect all nodes through ToR switches. The diagram shows uplink connectivity from each node\'s network adapters to the ToR switch fabric.</div>';

            return '<div class="switchless-diagram">' + intro + svg + note + '</div>';
        }

        /**
         * Render the Leaf & Spine Fabric Requirements section for disaggregated deployments.
         * Authoritative requirements per Microsoft Learn:
         * https://learn.microsoft.com/azure/azure-local/plan/network-reference-pattern-disaggregated-overview
         * Customers can hand this directly to their network team / switch vendor for validation.
         */
        function renderDisaggregatedFabricRequirements(state) {
            if (!state || state.architecture !== 'disaggregated') return '';
            const rackCount = parseInt(state.disaggRackCount, 10) || 1;
            const multiRack = rackCount > 1;
            const vrfMode = state.disaggVrfMode === 'single' ? 'single' : 'separate';
            const tenants = Array.isArray(state.disaggTenantNetworks) ? state.disaggTenantNetworks : [];
            const tenantCount = tenants.length;

            const intro = '<p style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 0.9rem;">'
                + 'Switch capabilities required for the Clos leaf-spine fabric with VXLAN EVPN overlay, multitenant VRF isolation, and service-leaf integration. '
                + 'These requirements are <strong>additive</strong> — all base Azure Local switch requirements still apply.'
                + (multiRack ? '' : ' <em>Single-rack disaggregated clusters that don\'t require SDN at scale may use a simpler 2-switch HSRP pair instead of the full leaf-spine fabric.</em>')
                + '</p>';

            // Topology + Service-leaf architecture diagrams (stacked full-width for readability)
            const diagrams = '<div style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 16px;">'
                + '<div style="text-align: center;">'
                + '<p style="margin: 0 0 6px 0; font-size: 0.82rem; font-weight: 600; color: var(--accent-purple);">Leaf-Spine Topology (' + rackCount + ' rack' + (rackCount === 1 ? '' : 's') + ')</p>'
                + '<img src="../images/disaggregated/leaf-spine-topology-four-racks.svg" alt="Leaf-spine topology for disaggregated Azure Local" style="width: 100%; max-width: 1130px; border-radius: 6px; border: 1px solid var(--glass-border);">'
                + '</div>'
                + '<div style="text-align: center;">'
                + '<p style="margin: 0 0 6px 0; font-size: 0.82rem; font-weight: 600; color: var(--accent-purple);">Service Leaf Integration</p>'
                + '<img src="../images/disaggregated/firewall-load-balancer-network-controller-service-leafs.svg" alt="Service leaf with firewall, load balancer and network controller integration" style="width: 100%; max-width: 1150px; border-radius: 6px; border: 1px solid var(--glass-border);">'
                + '</div>'
                + '</div>';

            function reqRow(category, req) {
                return '<tr>'
                    + '<td style="padding: 8px 12px; border-bottom: 1px solid var(--glass-border); color: var(--text-primary); font-weight: 600; vertical-align: top; white-space: nowrap;">' + category + '</td>'
                    + '<td style="padding: 8px 12px; border-bottom: 1px solid var(--glass-border); color: var(--text-secondary);">' + req + '</td>'
                    + '</tr>';
            }

            const rows = ''
                + reqRow('Underlay',
                    '&bull; eBGP <strong>unnumbered</strong> (RFC 5549) using IPv6 link-local transport for IPv4 NLRI <em>(or /31 point-to-point subnets)</em><br>'
                    + '&bull; Loopback-based peering (one loopback per switch)<br>'
                    + '&bull; Per-rack unique BGP ASN<br>'
                    + '&bull; ECMP &mdash; minimum 16-way, recommended 64-way<br>'
                    + '&bull; BFD for sub-second BGP failover')
                + reqRow('Overlay',
                    '&bull; VXLAN (RFC 7348) with MP-BGP EVPN (RFC 8365)<br>'
                    + '&bull; EVPN route types 2 and 5<br>'
                    + '&bull; Anycast gateway per VLAN<br>'
                    + '&bull; ARP/ND suppression<br>'
                    + '&bull; Consistent VLAN-to-VNI mapping across all racks<br>'
                    + '&bull; Symmetric IRB for inter-VLAN routing within a VRF')
                + reqRow('Segmentation',
                    '&bull; VRF support with L3 VXLAN Network Identifier (L3VNI)<br>'
                    + '&bull; Route-target import/export for controlled route leaking<br>'
                    + '&bull; VRF-aware default routing<br>'
                    + '&bull; Concurrent scale: compute/cluster, management, and multiple tenant VRFs'
                    + (vrfMode === 'separate' && tenantCount > 0
                        ? '<br><span style="color: var(--accent-purple);">&#9432; This deployment uses <strong>Separate VRFs</strong> with ' + tenantCount + ' tenant VRF' + (tenantCount === 1 ? '' : 's') + ' &mdash; route leaking on the service-leaf is required for AKS&harr;management traffic.</span>'
                        : (vrfMode === 'single'
                            ? '<br><span style="color: var(--accent-blue);">&#9432; This deployment uses a <strong>Single shared VRF</strong> &mdash; no inter-VRF route leaking required for AKS&harr;management.</span>'
                            : '')))
                + reqRow('Service Integration<br>(service leaf)',
                    '&bull; Dedicated service-leaf pair for data center core and service appliances<br>'
                    + '&bull; External BGP peering to data center core via service leaf <strong>(not spines)</strong><br>'
                    + '&bull; VRF route leaking to/from service VRF<br>'
                    + '&bull; Service chaining / traffic steering through firewall or load balancer')
                + reqRow('QoS',
                    '&bull; Minimum 4 hardware queues per port<br>'
                    + '&bull; 802.1p CoS classification/marking<br>'
                    + '&bull; Enhanced Transmission Selection (ETS, 802.1Qaz) bandwidth reservation via WRR<br>'
                    + '&bull; DCBX TLV advertisement via LLDP<br>'
                    + '&bull; PFC capability optional (not required &mdash; all cluster traffic runs over TCP)')
                + reqRow('High Availability',
                    '&bull; MLAG / vPC for dual-homed hosts<br>'
                    + '&bull; BGP graceful restart / non-stop routing<br>'
                    + '&bull; In-Service Software Upgrade (ISSU) recommended')
                + reqRow('Scale',
                    '&bull; MAC table &ge; 16,000<br>'
                    + '&bull; ARP/ND &ge; 8,000<br>'
                    + '&bull; VNI scale &ge; 1,000<br>'
                    + '&bull; VRF scale &ge; 16<br>'
                    + '&bull; Combined IPv4 + EVPN routes &ge; 10,000<br>'
                    + '&bull; TCAM/ACL capacity sufficient for QoS classification and security ACLs');

            const table = '<table style="width: 100%; border-collapse: collapse; background: var(--subtle-bg); border-radius: 6px; overflow: hidden; font-size: 0.88rem;">'
                + '<thead><tr style="background: var(--card-bg);">'
                + '<th style="padding: 8px 12px; text-align: left; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border); white-space: nowrap;">Category</th>'
                + '<th style="padding: 8px 12px; text-align: left; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">Requirements</th>'
                + '</tr></thead>'
                + '<tbody>' + rows + '</tbody>'
                + '</table>';

            const oversub = '<p style="margin: 12px 0 0 0; color: var(--text-secondary); font-size: 0.85rem;">'
                + '<strong style="color: var(--accent-purple);">Oversubscription target:</strong> design the leaf-to-spine layer for a <strong>minimum 2:1</strong> ratio under normal operations '
                + '(during a spine failure or maintenance, the effective ratio can rise to ~4:1). Scale the spine layer horizontally as the environment grows to add ECMP paths and reduce congestion risk.'
                + '</p>';

            const sdn = '<p style="margin: 8px 0 0 0; color: var(--text-secondary); font-size: 0.85rem;">'
                + '<strong style="color: #f97316;">SDN:</strong> Microsoft SDN (Network Controller) is <strong>not supported</strong> on disaggregated. As of Azure Local 2604, only <em>External SDN LNETs</em> are supported &mdash; logical network segmentation must be implemented on the leaf-spine fabric (VXLAN EVPN). Plan the VLAN-to-VNI mapping accordingly.'
                + '</p>';

            // AKS LNET reachability diagrams — show based on chosen VRF mode
            const aksVrfDiagrams = '<div style="margin-top: 16px;">'
                + '<h4 style="margin: 0 0 8px 0; color: #14b8a6; font-size: 0.88rem;">AKS Logical Network Reachability &amp; Routing Hops</h4>'
                + '<p style="margin: 0 0 10px 0; color: var(--text-secondary); font-size: 0.85rem;">'
                + 'When AKS is deployed, the AKS LNET must have Layer 3 reachability to the Management LNET. The chosen VRF design affects the path length:'
                + '</p>'
                + '<table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-bottom: 12px;">'
                + '<thead><tr style="background: var(--card-bg);">'
                + '<th style="padding: 6px 10px; text-align: left; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">Scenario</th>'
                + '<th style="padding: 6px 10px; text-align: left; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">Routing path</th>'
                + '<th style="padding: 6px 10px; text-align: center; color: var(--text-secondary); border-bottom: 1px solid var(--glass-border);">Hops</th>'
                + '</tr></thead><tbody>'
                + '<tr>'
                + '<td style="padding: 6px 10px; border-bottom: 1px solid var(--glass-border); color: var(--text-primary);">Same rack, same VRF</td>'
                + '<td style="padding: 6px 10px; border-bottom: 1px solid var(--glass-border); color: var(--text-secondary);">Local IRB on compute leaf</td>'
                + '<td style="padding: 6px 10px; border-bottom: 1px solid var(--glass-border); text-align: center; font-weight: 600; color: var(--accent-green);">1</td>'
                + '</tr><tr>'
                + '<td style="padding: 6px 10px; border-bottom: 1px solid var(--glass-border); color: var(--text-primary);">Cross-rack, <strong>Single VRF</strong></td>'
                + '<td style="padding: 6px 10px; border-bottom: 1px solid var(--glass-border); color: var(--text-secondary);">Compute Leaf &rarr; Spine &rarr; Compute Leaf</td>'
                + '<td style="padding: 6px 10px; border-bottom: 1px solid var(--glass-border); text-align: center; font-weight: 600; color: var(--accent-blue);">3</td>'
                + '</tr><tr>'
                + '<td style="padding: 6px 10px; color: var(--text-primary);">Cross-rack, <strong>Separate VRFs</strong> (route leaking)</td>'
                + '<td style="padding: 6px 10px; color: var(--text-secondary);">Compute Leaf &rarr; Spine &rarr; Service Leaf &rarr; Spine &rarr; Compute Leaf</td>'
                + '<td style="padding: 6px 10px; text-align: center; font-weight: 600; color: #f97316;">5</td>'
                + '</tr>'
                + '</tbody></table>'
                + '<div style="text-align: center;">'
                + (vrfMode === 'single'
                    ? '<p style="margin: 0 0 6px 0; font-size: 0.78rem; font-weight: 600; color: var(--accent-blue);">Single VRF &mdash; 3 hops (cross-rack)</p>'
                      + '<img src="../images/disaggregated/aks-logical-network-single-routing-domain.svg" alt="AKS single VRF routing path" style="width: 100%; max-width: 520px; border-radius: 6px; border: 1px solid var(--glass-border);">'
                    : '<p style="margin: 0 0 6px 0; font-size: 0.78rem; font-weight: 600; color: #f97316;">Separate VRFs &mdash; 5 hops (route leaking)</p>'
                      + '<img src="../images/disaggregated/aks-logical-network-separate-routing-domains-route-leaking.svg" alt="AKS separate VRF routing path with route leaking" style="width: 100%; max-width: 520px; border-radius: 6px; border: 1px solid var(--glass-border);">')
                + '</div>'
                + (vrfMode === 'separate'
                    ? '<p style="margin: 8px 0 0 0; color: #f97316; font-size: 0.82rem;"><strong>&#9432; This deployment uses Separate VRFs</strong> &mdash; route leaking on the service-leaf pair is required for AKS&harr;management reachability. Only leak the specific prefixes needed.</p>'
                    : '<p style="margin: 8px 0 0 0; color: var(--accent-blue); font-size: 0.82rem;"><strong>&#9432; This deployment uses a Single shared VRF</strong> &mdash; AKS&harr;management reachability is automatic. No route leaking required.</p>')
                + '</div>';

            return intro + diagrams + table + oversub + sdn + aksVrfDiagrams;
        }

        /**
         * Render disaggregated host networking diagram showing Leaf-A/B switches,
         * per-node intent groups (SET + standalone), and uplinks.
         * Follows the exact same SVG pattern as renderSwitchedIntentDiagram.
         */
        function renderDisaggregatedHostNetworkingDiagram(state) {
            if (!state || state.architecture !== 'disaggregated') return '';

            const storageType = state.disaggStorageType || 'fc_san';
            const backupEnabled = !!state.disaggBackupEnabled;
            const portCount = parseInt(state.disaggPortCount, 10) || 4;
            const totalNodes = parseInt(state.nodes, 10) || ((parseInt(state.disaggRackCount, 10) || 1) * (parseInt(state.disaggNodesPerRack, 10) || 1));
            const n = Math.min(2, totalNodes);
            const hasFc = (storageType === 'fc_san');
            const hasIscsi = (storageType === 'iscsi_4nic' || storageType === 'iscsi_6nic');
            const hasDedicatedIscsi = (storageType === 'iscsi_6nic');
            const hasSharedIscsi = (storageType === 'iscsi_4nic');
            const adapterMapping = state.disaggAdapterMapping || {};

            // NIC name helper — port IDs must match wizard format: ocp_p1, pcie1_p2, etc.
            function getNicName(slotKey, idx) {
                if (state.disaggPortConfig) {
                    const portList = getDisaggPortListForReport(storageType, backupEnabled, portCount);
                    for (let pi = 0; pi < portList.length; pi++) {
                        if (portList[pi].id === slotKey + '_p' + idx) {
                            const cfg = state.disaggPortConfig[portList[pi].id];
                            return (cfg && (cfg.customName || cfg.name)) || portList[pi].defaultName;
                        }
                    }
                }
                const defaults = { ocp: 'OCP-NIC', pcie1: 'PCIe1-NIC', pcie2: 'PCIe2-NIC', backup: 'BK-NIC', bmc: 'BMC', fc: 'FC-HBA' };
                return (defaults[slotKey] || slotKey) + idx;
            }

            function getPortSpeed(slotKey, idx) {
                if (state.disaggPortConfig) {
                    const key = slotKey + '_p' + idx;
                    if (state.disaggPortConfig[key] && state.disaggPortConfig[key].speed) return state.disaggPortConfig[key].speed;
                }
                if (slotKey === 'bmc') return '1GbE';
                if (slotKey === 'fc') return '32G FC';
                return '25GbE';
            }

            function colorRgb(hex) {
                return parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16);
            }

            // --- Build NIC groups dynamically from adapter mapping ---
            const nicGroups = [];

            // Cluster NIC SET wrapper mode (mirrors wizard preview):
            //   'clusterbackup' — iSCSI 6-NIC + backup: ClusterBackupSwitch SET (Cluster1/2 vNICs + Backup VLAN trunk)
            //   null            — standalone physical cluster NICs, including iSCSI 4-NIC shared paths
            const clusterSetMode = (storageType === 'iscsi_6nic' && backupEnabled) ? 'clusterbackup' : null;
            const clusterSetName = clusterSetMode === 'clusterbackup' ? 'ClusterBackupSwitch'
                : null;
            const vlansState = state.disaggVlans || {};
            const cluster1VnicsAbove = clusterSetMode === 'clusterbackup'
                ? [{ name: 'Cluster1 vNIC', vlan: 'VLAN ' + (vlansState.cluster1 || '711') }]
                : [];
            const cluster2VnicsAbove = clusterSetMode === 'clusterbackup'
                ? [{ name: 'Cluster2 vNIC', vlan: 'VLAN ' + (vlansState.cluster2 || '712') }]
                : [];

            // Define zone metadata — for 4-NIC, cluster groups are physical shared Cluster+iSCSI paths.
            const clusterLabel1 = hasSharedIscsi ? 'NIC3 Path A' : 'Cluster 1';
            const clusterLabel2 = hasSharedIscsi ? 'NIC4 Path B' : 'Cluster 2';
            const zoneMeta = {
                mgmt_compute: { label: 'Mgmt + Compute', color: '#3b82f6', vnicsAbove: [{ name: 'Mgmt vNIC', vlan: 'VLAN ' + (vlansState.mgmt || '7') }] },
                cluster_1: { label: clusterLabel1, color: '#22c55e', subLabel: hasSharedIscsi ? 'Cluster + iSCSI' : '', vnicsAbove: cluster1VnicsAbove, vlanBelow: 'VLAN ' + (vlansState.cluster1 || '711'), forcedLeaf: 'A' },
                cluster_2: { label: clusterLabel2, color: '#22c55e', subLabel: hasSharedIscsi ? 'Cluster + iSCSI' : '', vnicsAbove: cluster2VnicsAbove, vlanBelow: 'VLAN ' + (vlansState.cluster2 || '712'), forcedLeaf: 'B' },
                iscsi_a: { label: 'iSCSI Storage A', color: '#8b5cf6', vlanBelow: 'VLAN ' + (vlansState.iscsiA || '300'), forcedLeaf: 'A' },
                iscsi_b: { label: 'iSCSI Storage B', color: '#8b5cf6', vlanBelow: 'VLAN ' + (vlansState.iscsiB || '400'), forcedLeaf: 'B' },
                backup: { label: 'In-Guest Backup Compute Intent', color: '#f97316' }
            };

            // Leaf assignment rules: first adapter to Leaf-A, second to Leaf-B within each group
            // CodeQL js/remote-property-injection (#24, #25, #26): use Maps so
            // user-derived zone keys are stored as explicit key/value pairs with
            // safe dictionary semantics.
            const zoneLeafCounters = new Map();
            const zoneOrder = ['mgmt_compute', 'cluster_1', 'cluster_2', 'iscsi_a', 'iscsi_b', 'backup'];
            const groupsByZone = new Map();

            // Iterate adapter mapping and group ports by their assigned zone
            const portList = getDisaggPortListForReport(storageType, backupEnabled, portCount);
            for (let pi = 0; pi < portList.length; pi++) {
                const port = portList[pi];
                const zone = adapterMapping[port.id];
                if (!zone || zone === 'pool' || port.slot === 'bmc') continue;
                if (!groupsByZone.has(zone)) groupsByZone.set(zone, []);
                if (!zoneLeafCounters.has(zone)) zoneLeafCounters.set(zone, 0);
                const zmeta = zoneMeta[zone];
                const leafLabel = (zmeta && zmeta.forcedLeaf) ? zmeta.forcedLeaf : ((zoneLeafCounters.get(zone) % 2 === 0) ? 'A' : 'B');
                zoneLeafCounters.set(zone, zoneLeafCounters.get(zone) + 1);

                const slotKey = port.id.replace(/_p\d+$/, '');
                const idx = parseInt(port.id.replace(/^.*_p/, ''), 10);

                groupsByZone.get(zone).push({
                    id: port.id,
                    name: getNicName(slotKey, idx),
                    speed: getPortSpeed(slotKey, idx),
                    leaf: leafLabel
                });
            }

            // Build nicGroups in zone order
            for (let zi = 0; zi < zoneOrder.length; zi++) {
                const zk = zoneOrder[zi];
                const zList = groupsByZone.get(zk);
                if (!zList || zList.length === 0) continue;
                const meta = zoneMeta[zk];
                if (!meta) continue;
                const grp = {
                    key: zk,
                    label: meta.label,
                    color: meta.color,
                    nics: zList
                };
                if (meta.vnicsAbove && meta.vnicsAbove.length > 0) grp.vnicsAbove = meta.vnicsAbove;
                if (meta.vlanBelow) grp.vlanBelow = meta.vlanBelow;
                if (meta.subLabel) grp.subLabel = meta.subLabel;
                nicGroups.push(grp);
            }

            // When a SET wraps the cluster NICs, merge cluster_1 + cluster_2 into a single
            // "cluster_set" group so NIC3 and NIC4 share one dashed box (same UX as
            // Mgmt+Compute combining OCP-NIC1 + OCP-NIC2). The merged group's box is the
            // SET visual wrapper — no separate overlay rectangle is needed.
            if (clusterSetMode) {
                let c1Idx = -1, c2Idx = -1;
                for (let ci = 0; ci < nicGroups.length; ci++) {
                    if (nicGroups[ci].key === 'cluster_1') c1Idx = ci;
                    else if (nicGroups[ci].key === 'cluster_2') c2Idx = ci;
                }
                if (c1Idx !== -1 && c2Idx !== -1) {
                    const c1g = nicGroups[c1Idx], c2g = nicGroups[c2Idx];
                    const mergedGrp = {
                        key: 'cluster_set',
                        label: clusterSetName,
                        color: '#22c55e',
                        nics: c1g.nics.concat(c2g.nics),
                        vnicsAbove: (c1g.vnicsAbove || []).concat(c2g.vnicsAbove || []),
                        showBackupBadge: clusterSetMode === 'clusterbackup'
                    };
                    nicGroups.splice(Math.max(c1Idx, c2Idx), 1);
                    nicGroups.splice(Math.min(c1Idx, c2Idx), 1, mergedGrp);
                }
            }

            // Fallback: if no adapter mapping, use hardcoded defaults
            if (nicGroups.length === 0) {
                nicGroups.push({
                    key: 'mgmt_compute', label: 'Mgmt + Compute', color: '#3b82f6',
                    vnicsAbove: [{ name: 'Mgmt vNIC', vlan: 'VLAN ' + (vlansState.mgmt || '7') }],
                    nics: [
                        { id: 'ocp_1', name: getNicName('ocp', 1), speed: getPortSpeed('ocp', 1), leaf: 'A' },
                        { id: 'ocp_2', name: getNicName('ocp', 2), speed: getPortSpeed('ocp', 2), leaf: 'B' }
                    ]
                });
                nicGroups.push({
                    key: 'cluster_1', label: clusterLabel1, color: '#22c55e',
                    vlanBelow: 'VLAN ' + ((state.disaggVlans && state.disaggVlans.cluster1) || '711'),
                    nics: [{ id: 'pcie1_1', name: getNicName('pcie1', 1), speed: getPortSpeed('pcie1', 1), leaf: 'A' }]
                });
                nicGroups.push({
                    key: 'cluster_2', label: clusterLabel2, color: '#22c55e',
                    vlanBelow: 'VLAN ' + ((state.disaggVlans && state.disaggVlans.cluster2) || '712'),
                    nics: [{ id: 'pcie1_2', name: getNicName('pcie1', 2), speed: getPortSpeed('pcie1', 2), leaf: 'B' }]
                });
                if (backupEnabled) {
                    const bkSlot = (storageType === 'iscsi_6nic') ? 'pcie2' : 'backup';
                    nicGroups.push({
                        key: 'backup', label: 'In-Guest Backup Compute Intent', color: '#f97316',
                        nics: [
                            { id: bkSlot + '_1', name: getNicName(bkSlot, 1), speed: getPortSpeed(bkSlot, 1), leaf: 'A' },
                            { id: bkSlot + '_2', name: getNicName(bkSlot, 2), speed: getPortSpeed(bkSlot, 2), leaf: 'B' }
                        ]
                    });
                }
            }

            // --- Bottom storage adapters ---
            const storageAdapters = [];
            if (hasFc) {
                storageAdapters.push({ id: 'fc_1', name: getNicName('fc', 1), speed: getPortSpeed('fc', 1), target: 'A', color: '#8b5cf6' });
                storageAdapters.push({ id: 'fc_2', name: getNicName('fc', 2), speed: getPortSpeed('fc', 2), target: 'B', color: '#8b5cf6' });
            }
            // iSCSI scenarios: Storage Array shown at leaf level, no bottom adapters
            // For shared iSCSI: no separate storage adapters — iSCSI traffic flows
            // through the same cluster standalone NICs up to the leaf switches,
            // then through the fabric to the iSCSI Storage Array.

            // BMC name
            const bmcName = getNicName('bmc', 1);

            // --- Layout constants ---
            const adapterW = 62;
            const adapterH = 38;
            const adapterGap = 10;
            const groupGap = 32;
            const vnicH = 42;
            const vnicGap = 4;

            // Compute single row width
            function rowWidth(groups) {
                let w = 0;
                for (let i = 0; i < groups.length; i++) {
                    w += groups[i].nics.length * adapterW + (groups[i].nics.length - 1) * adapterGap;
                    if (i < groups.length - 1) w += groupGap;
                }
                return w;
            }

            const nicRowW = rowWidth(nicGroups);
            const storageW = storageAdapters.length * adapterW + Math.max(0, storageAdapters.length - 1) * adapterGap;
            const maxRowW = Math.max(nicRowW, storageW);

            const nodeW = Math.max(440, maxRowW + 60);
            // Single horizontal row of vNICs above NICs (per spec, all SET vNICs sit side-by-side).
            let anyVnicAbove = false;
            for (let ng = 0; ng < nicGroups.length; ng++) {
                if (nicGroups[ng].vnicsAbove && nicGroups[ng].vnicsAbove.length > 0) { anyVnicAbove = true; break; }
            }
            const mgmtVnicAreaH = anyVnicAbove ? (vnicH + 18) : 0;
            const nodeH = 225 + mgmtVnicAreaH + (storageAdapters.length > 0 ? 70 : 0);
            const gapX = 50;
            const marginX = 50;
            const leafH = 50;
            const leafW = 160;
            const leafGap = 70;
            const leafToNodeGap = 90;
            const marginTop = 90;
            const marginBottom = 80;
            const sanAreaH = 70;

            // iSCSI Storage Array dimensions (shown at leaf level for shared iSCSI)
            const iscsiArrayW = 170;
            const iscsiArrayH = 56;
            const iscsiArrayGap = 50;

            const nodesAreaW = marginX * 2 + (n * nodeW) + ((n - 1) * gapX);
            const leafAreaH = leafH + leafToNodeGap;
            const totalLeafW = (2 * leafW) + leafGap;
            // For iSCSI, widen SVG to fit the iSCSI Storage Array to the right of leaves
            const topRowW = totalLeafW + (hasIscsi ? (iscsiArrayGap + iscsiArrayW) : 0);
            const svgW = Math.max(nodesAreaW, topRowW + marginX * 2);
            // Build legend entry data (rendered inside the SVG below the diagram so it's
            // included in the downloaded image). Each entry: { title, color, lines: [str] }.
            function findGrp(key) { for (let fi = 0; fi < nicGroups.length; fi++) if (nicGroups[fi].key === key) return nicGroups[fi]; return null; }
            const legendEntries = [];
            if (clusterSetMode) {
                // After the merge step, cluster_1/cluster_2 are gone — use the merged cluster_set group.
                const setGrp = findGrp('cluster_set');
                const memberNames = setGrp ? setGrp.nics.map(function(nx){ return nx.name; }) : [];
                const vnicLabels = [].concat(cluster1VnicsAbove.map(function(v){ return v.name + ' (' + v.vlan + ')'; }))
                    .concat(cluster2VnicsAbove.map(function(v){ return v.name + ' (' + v.vlan + ')'; }));
                const setLines = [
                    'Members: ' + memberNames.join(', '),
                    'Host vNICs: ' + (vnicLabels.length ? vnicLabels.join(', ') : 'none')
                ];
                if (clusterSetMode === 'clusterbackup') {
                    setLines.push('Trunk: Backup VLAN ' + (vlansState.backup || '800') + ' (no host vNIC)');
                }
                legendEntries.push({ title: clusterSetName + ' (SET — customer-managed, outside ATC)', color: '#22c55e', lines: setLines });
            }
            const mgmtGrp = findGrp('mgmt_compute');
            if (mgmtGrp) {
                legendEntries.push({
                    title: 'Mgmt + Compute (ATC SET)',
                    color: mgmtGrp.color,
                    lines: [
                        'Members: ' + mgmtGrp.nics.map(function(nx){ return nx.name; }).join(', '),
                        'Host vNICs: Mgmt vNIC (VLAN ' + (vlansState.mgmt || '7') + ')'
                    ]
                });
            }
            if (!clusterSetMode) {
                const sc1 = findGrp('cluster_1'), sc2 = findGrp('cluster_2');
                if (sc1 || sc2) {
                    const allClusterNics = [].concat(sc1 ? sc1.nics.map(function(nx){ return nx.name; }) : [])
                        .concat(sc2 ? sc2.nics.map(function(nx){ return nx.name; }) : []);
                    const clusterLegendTitle = hasSharedIscsi ? 'Shared Cluster + iSCSI Physical Paths (standalone — no SET)' : 'Cluster Networks (standalone — no SET)';
                    const clusterLegendLines = hasSharedIscsi
                        ? [
                            'Members: ' + allClusterNics.join(', '),
                            'Path A/B VLANs: ' + (vlansState.cluster1 || '711') + ', ' + (vlansState.cluster2 || '712') + ' — iSCSI uses the same physical NIC source IPs',
                            'Host vNICs: none; target portal /32 routes are pinned to NIC3/NIC4'
                        ]
                        : [
                            'Members: ' + allClusterNics.join(', '),
                            'VLANs: ' + (vlansState.cluster1 || '711') + ', ' + (vlansState.cluster2 || '712') + ' (bare-metal, no host vNIC)'
                        ];
                    legendEntries.push({
                        title: clusterLegendTitle,
                        color: '#22c55e',
                        lines: clusterLegendLines
                    });
                }
            }
            const iA = findGrp('iscsi_a'), iB = findGrp('iscsi_b');
            if (iA || iB) {
                const allIscsi = [].concat(iA ? iA.nics.map(function(nx){ return nx.name; }) : [])
                    .concat(iB ? iB.nics.map(function(nx){ return nx.name; }) : []);
                legendEntries.push({
                    title: 'iSCSI Path A/B (standalone — no SET)',
                    color: '#8b5cf6',
                    lines: [
                        'Members: ' + allIscsi.join(', '),
                        'VLANs: ' + (vlansState.iscsiA || '300') + ' (Path A), ' + (vlansState.iscsiB || '400') + ' (Path B) — MPIO, bare-metal'
                    ]
                });
            }
            const bk = findGrp('backup');
            if (bk) {
                legendEntries.push({
                    title: 'In-Guest Backup (dedicated NICs)',
                    color: bk.color,
                    lines: [
                        'Members: ' + bk.nics.map(function(nx){ return nx.name; }).join(', '),
                        'VLAN: ' + (vlansState.backup || '800')
                    ]
                });
            }
            // Legend block height (in SVG coordinates)
            const legendTitleH = 18, legendEntryTitleH = 14, legendLineH = 12, legendEntryGap = 8, legendEntryPadY = 6;
            let legendBlockH = 0;
            if (legendEntries.length > 0) {
                legendBlockH = legendTitleH + 6;
                for (let le = 0; le < legendEntries.length; le++) {
                    legendBlockH += legendEntryTitleH + legendEntries[le].lines.length * legendLineH + legendEntryPadY * 2;
                    if (le < legendEntries.length - 1) legendBlockH += legendEntryGap;
                }
                legendBlockH += 16;
            }
            const baseSvgH = marginTop + leafAreaH + nodeH + (hasIscsi ? 0 : sanAreaH) + marginBottom + (totalNodes > 2 ? 40 : 0);
            const svgH = baseSvgH + legendBlockH;

            // Leaf switch positions — shift left if iSCSI Storage Array is shown
            const leafY = marginTop + 10;
            const leafBlockStartX = hasIscsi ? ((svgW - topRowW) / 2) : ((svgW - totalLeafW) / 2);
            const leaf1X = leafBlockStartX;
            const leaf2X = leaf1X + leafW + leafGap;

            // iSCSI Storage Array position (right of Leaf-B, same level)
            const iscsiArrayX = leaf2X + leafW + iscsiArrayGap;
            const iscsiArrayY = leafY - 3;

            // Node positions
            const nodesStartX = (svgW - (n * nodeW) - ((n - 1) * gapX)) / 2;
            const nodeY = marginTop + leafAreaH + 10;

            // Tracking for uplink lines (leaf-connected NICs) and storage downlinks
            let uplinkPositions = [];
            let storagePositions = [];

            function renderNicRow(groups, baseX, baseY, nodeLeft) {
                let out = '';
                const rw = rowWidth(groups);
                let currentX = nodeLeft + (nodeW - rw) / 2;
                // Track cluster bounding box for SET wrapper (drawn after the loop).
                let clusterSetBoxX = null, clusterSetBoxW = null, clusterSetBoxBottomY = null;

                for (let gi = 0; gi < groups.length; gi++) {
                    const grp = groups[gi];
                    const grpW = grp.nics.length * adapterW + (grp.nics.length - 1) * adapterGap;
                    const boxX = currentX - 8;
                    const boxTotalW = grpW + 16;
                    const grpVnics = grp.vnicsAbove || [];
                    const hasVnicsArr = grpVnics.length > 0;
                    const vnicAreaHGrp = hasVnicsArr ? (vnicH + 12) : 0;
                    const boxH = adapterH + 28 + vnicAreaHGrp;
                    const boxY = baseY - 14 - vnicAreaHGrp;
                    const rgb = colorRgb(grp.color);

                    // Track merged cluster_set box for the Backup VLAN badge anchor.
                    if (grp.key === 'cluster_set') {
                        clusterSetBoxX = boxX;
                        clusterSetBoxW = boxTotalW;
                        clusterSetBoxBottomY = boxY + boxH;
                    }

                    // Group box
                    out += '<rect x="' + boxX + '" y="' + boxY + '" width="' + boxTotalW + '" height="' + boxH + '" rx="10" fill="rgba(' + rgb + ',0.08)" stroke="rgba(' + rgb + ',0.45)" stroke-dasharray="5 3" />';

                    // Suppress per-NIC labels for cluster zones when wrapped in a SET.
                    const inSet = false; // merged cluster_set group renders its own label normally
                    if (!inSet) {
                        // Label: below the box for iSCSI scenarios, above otherwise
                        const labelY = hasIscsi ? (boxY + boxH + 12) : (boxY - 5);
                        out += '<text x="' + (boxX + boxTotalW / 2) + '" y="' + labelY + '" text-anchor="middle" font-size="9" fill="rgba(' + rgb + ',0.85)" font-weight="600">' + escapeHtml(grp.label) + '</text>';
                        if (grp.subLabel) {
                            out += '<text x="' + (boxX + boxTotalW / 2) + '" y="' + (labelY + 11) + '" text-anchor="middle" font-size="8" fill="rgba(' + rgb + ',0.70)">' + escapeHtml(grp.subLabel) + '</text>';
                        }
                    }

                    // vNICs above physical NICs — single horizontal row, splitting the box width.
                    if (hasVnicsArr) {
                        const innerPad = 4;
                        const slotW = (boxTotalW - innerPad * 2 - vnicGap * (grpVnics.length - 1)) / grpVnics.length;
                        const vaY = boxY + 6;
                        for (let vi = 0; vi < grpVnics.length; vi++) {
                            const vnic = grpVnics[vi];
                            const vaX = boxX + innerPad + vi * (slotW + vnicGap);
                            const vRgb = vnic.color ? colorRgb(vnic.color) : rgb;
                            out += '<rect x="' + vaX + '" y="' + vaY + '" width="' + slotW + '" height="' + vnicH + '" rx="6" fill="rgba(' + vRgb + ',0.10)" stroke="rgba(' + vRgb + ',0.55)" stroke-dasharray="4 2" />';
                            // Render name on two lines so neighbouring vNIC cards don't visually collide:
                            // primary identifier on row 1, the literal 'vNIC' on row 2, VLAN on row 3.
                            const vnicNameMatch = /^(.*?)(?:\s+vNIC)$/.exec(vnic.name);
                            const vnicPrimary = vnicNameMatch ? vnicNameMatch[1] : vnic.name;
                            const vnicSuffix = vnicNameMatch ? 'vNIC' : '';
                            out += '<text x="' + (vaX + slotW / 2) + '" y="' + (vaY + 12) + '" text-anchor="middle" font-size="8" fill="var(--text-primary)" font-weight="600">' + escapeHtml(vnicPrimary) + '</text>';
                            if (vnicSuffix) {
                                out += '<text x="' + (vaX + slotW / 2) + '" y="' + (vaY + 22) + '" text-anchor="middle" font-size="8" fill="var(--text-primary)" font-weight="600">' + escapeHtml(vnicSuffix) + '</text>';
                            }
                            out += '<text x="' + (vaX + slotW / 2) + '" y="' + (vaY + 35) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">' + escapeHtml(vnic.vlan) + '</text>';
                            // Anchor uplink at the vNIC's top-center; SET-bonded vNIC reaches every leaf its NICs touch.
                            const uniqueLeaves = {};
                            for (let nn = 0; nn < grp.nics.length; nn++) uniqueLeaves[grp.nics[nn].leaf] = true;
                            const leafKeys = Object.keys(uniqueLeaves);
                            for (let lk = 0; lk < leafKeys.length; lk++) {
                                uplinkPositions.push({ x: vaX + slotW / 2, y: vaY, leaf: leafKeys[lk], color: vnic.color || grp.color });
                            }
                        }
                        out += '<line x1="' + (boxX + 6) + '" y1="' + (baseY - 6) + '" x2="' + (boxX + boxTotalW - 6) + '" y2="' + (baseY - 6) + '" stroke="rgba(' + rgb + ',0.3)" stroke-dasharray="3 2" />';
                    }

                    // NIC adapter cards
                    for (let ni = 0; ni < grp.nics.length; ni++) {
                        const nic = grp.nics[ni];
                        const x = currentX + ni * (adapterW + adapterGap);
                        const y = baseY;

                        out += '<rect x="' + x + '" y="' + y + '" width="' + adapterW + '" height="' + adapterH + '" rx="6" fill="rgba(' + rgb + ',0.20)" stroke="rgba(' + rgb + ',0.60)" />';
                        out += '<text x="' + (x + adapterW / 2) + '" y="' + (y + 16) + '" text-anchor="middle" font-size="8" fill="var(--text-primary)" font-weight="600">' + escapeHtml(nic.name) + '</text>';
                        out += '<text x="' + (x + adapterW / 2) + '" y="' + (y + 28) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">' + escapeHtml(nic.speed) + '</text>';

                        // Only push NIC-origin uplinks when the group has no vNICs above (otherwise vNICs own the uplink).
                        if (!hasVnicsArr) {
                            uplinkPositions.push({ x: x + adapterW / 2, y: y, leaf: nic.leaf, color: grp.color });
                        }
                    }

                    // VLAN label below the port shape (for standalone cluster/iSCSI networks; suppressed inside SET)
                    if (grp.vlanBelow && !inSet) {
                        const vlanY = grp.subLabel ? (boxY + boxH + 34) : (hasIscsi ? (boxY + boxH + 24) : (boxY + boxH + 12));
                        out += '<text x="' + (boxX + boxTotalW / 2) + '" y="' + vlanY + '" text-anchor="middle" font-size="8" fill="rgba(' + rgb + ',0.75)" font-style="italic">' + escapeHtml(grp.vlanBelow) + '</text>';
                    }

                    currentX += grpW + groupGap;
                }

                // Backup VLAN trunk badge (clusterbackup mode only) — anchored under the merged
                // cluster_set group's dashed box (which is now the SET visual wrapper itself).
                if (clusterSetMode === 'clusterbackup' && clusterSetBoxX !== null) {
                    const bRgb = colorRgb('#f97316');
                    const badgeW = 220, badgeH = 22;
                    const badgeX = clusterSetBoxX + (clusterSetBoxW - badgeW) / 2;
                    const badgeY = clusterSetBoxBottomY + 26;
                    out += '<rect x="' + badgeX + '" y="' + badgeY + '" width="' + badgeW + '" height="' + badgeH + '" rx="5" fill="rgba(' + bRgb + ',0.12)" stroke="rgba(' + bRgb + ',0.6)" stroke-dasharray="3 2" />';
                    out += '<text x="' + (badgeX + badgeW / 2) + '" y="' + (badgeY + 14) + '" text-anchor="middle" font-size="8" fill="rgba(' + bRgb + ',0.95)" font-weight="600">Backup VLAN ' + escapeHtml(String(vlansState.backup || '800')) + ' — trunk, no host vNIC</text>';
                }
                return out;
            }

            function renderStorageAdapters(nodeLeft, nodeTop) {
                if (storageAdapters.length === 0) return '';
                let out = '';
                const saY = nodeTop + nodeH - adapterH - 20;
                const saStartX = nodeLeft + (nodeW - storageW) / 2;

                // Storage section label
                const storageLabel2 = hasFc ? 'FC HBA — SAN Fabric' : (hasDedicatedIscsi ? 'iSCSI Storage Adapters' : 'iSCSI — Shared with Cluster');
                const rgb = colorRgb('#8b5cf6');
                out += '<text x="' + (nodeLeft + nodeW / 2) + '" y="' + (saY - 18) + '" text-anchor="middle" font-size="9" fill="rgba(' + rgb + ',0.85)" font-weight="600">' + escapeHtml(storageLabel2) + '</text>';

                // Separator line
                out += '<line x1="' + (nodeLeft + 20) + '" y1="' + (saY - 24) + '" x2="' + (nodeLeft + nodeW - 20) + '" y2="' + (saY - 24) + '" stroke="rgba(' + rgb + ',0.2)" stroke-dasharray="4 3" />';

                for (let si = 0; si < storageAdapters.length; si++) {
                    const sa = storageAdapters[si];
                    const x = saStartX + si * (adapterW + adapterGap);
                    const y = saY;
                    const saRgb = colorRgb(sa.color);

                    out += '<rect x="' + x + '" y="' + y + '" width="' + adapterW + '" height="' + adapterH + '" rx="6" fill="rgba(' + saRgb + ',0.15)" stroke="rgba(' + saRgb + ',0.55)" stroke-dasharray="4 2" />';
                    out += '<text x="' + (x + adapterW / 2) + '" y="' + (y + 16) + '" text-anchor="middle" font-size="7.5" fill="var(--text-primary)" font-weight="600">' + escapeHtml(sa.name) + '</text>';
                    out += '<text x="' + (x + adapterW / 2) + '" y="' + (y + 28) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">' + escapeHtml(sa.speed) + '</text>';

                    // Track position for downlink lines to SAN/target
                    storagePositions.push({ x: x + adapterW / 2, y: y + adapterH, target: sa.target, color: sa.color });
                }

                return out;
            }

            function renderNode(posX, nodeTop, nodeIdx) {
                let out = '';
                // Node box
                out += '<rect x="' + posX + '" y="' + nodeTop + '" width="' + nodeW + '" height="' + nodeH + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';

                // Node name
                let nodeLabel = 'Node ' + (nodeIdx + 1);
                if (state.nodeSettings && state.nodeSettings[nodeIdx] && state.nodeSettings[nodeIdx].name) {
                    nodeLabel = String(state.nodeSettings[nodeIdx].name).trim() || nodeLabel;
                }
                out += '<text x="' + (posX + nodeW / 2) + '" y="' + (nodeTop + 28) + '" text-anchor="middle" font-size="14" fill="var(--text-primary)" font-weight="700">' + escapeHtml(nodeLabel) + '</text>';

                // BMC (top-right corner)
                const bmcX = posX + nodeW - 75;
                const bmcY = nodeTop + 12;
                out += '<rect x="' + bmcX + '" y="' + bmcY + '" width="' + 55 + '" height="' + 22 + '" rx="5" fill="rgba(160,160,160,0.12)" stroke="rgba(160,160,160,0.4)" />';
                out += '<text x="' + (bmcX + 27) + '" y="' + (bmcY + 14) + '" text-anchor="middle" font-size="7.5" fill="var(--text-secondary)">' + escapeHtml(bmcName) + '</text>';
                out += '<text x="' + (bmcX + 27) + '" y="' + (bmcY + 31) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">BMC Switch</text>';

                // Single NIC row: all intents (Mgmt+Compute, Cluster 1, Cluster 2, Backup)
                const nicRowY = nodeTop + 80 + mgmtVnicAreaH;
                out += renderNicRow(nicGroups, posX, nicRowY, posX);

                // Bottom: Storage adapters (FC HBA or iSCSI) — below NIC row
                out += renderStorageAdapters(posX, nodeTop);

                return out;
            }

            function renderUplinks() {
                let out = '';
                const leafBottomY = leafY + leafH;
                for (let ai = 0; ai < uplinkPositions.length; ai++) {
                    const ap = uplinkPositions[ai];
                    const targetX = (ap.leaf === 'A') ? (leaf1X + leafW / 2) : (leaf2X + leafW / 2);
                    const rgb = colorRgb(ap.color);
                    out += '<line x1="' + ap.x + '" y1="' + ap.y + '" x2="' + targetX + '" y2="' + leafBottomY + '" stroke="rgba(' + rgb + ',0.35)" stroke-width="1.5" stroke-dasharray="4 2" />';
                }
                return out;
            }

            function renderStorageDownlinks(sanY) {
                let out = '';
                // SAN / iSCSI target shapes
                const sanW = 160;
                const sanH = 36;
                const sanGap = 60;
                const totalSanW = 2 * sanW + sanGap;
                const sanStartX = (svgW - totalSanW) / 2;
                const targetLabelA = hasFc ? 'SAN Fabric A' : 'iSCSI Target A';
                const targetLabelB = hasFc ? 'SAN Fabric B' : 'iSCSI Target B';
                const sanColor = '#8b5cf6';
                const rgb = colorRgb(sanColor);

                // Target A
                out += '<rect x="' + sanStartX + '" y="' + sanY + '" width="' + sanW + '" height="' + sanH + '" rx="10" fill="rgba(' + rgb + ',0.12)" stroke="rgba(' + rgb + ',0.55)" stroke-width="1.5" />';
                out += '<text x="' + (sanStartX + sanW / 2) + '" y="' + (sanY + 22) + '" text-anchor="middle" font-size="11" fill="rgba(' + rgb + ',0.9)" font-weight="600">' + escapeHtml(targetLabelA) + '</text>';

                // Target B
                const sanBX = sanStartX + sanW + sanGap;
                out += '<rect x="' + sanBX + '" y="' + sanY + '" width="' + sanW + '" height="' + sanH + '" rx="10" fill="rgba(' + rgb + ',0.12)" stroke="rgba(' + rgb + ',0.55)" stroke-width="1.5" />';
                out += '<text x="' + (sanBX + sanW / 2) + '" y="' + (sanY + 22) + '" text-anchor="middle" font-size="11" fill="rgba(' + rgb + ',0.9)" font-weight="600">' + escapeHtml(targetLabelB) + '</text>';

                // Connection lines from storage adapter positions to targets
                const targetAcx = sanStartX + sanW / 2;
                const targetBcx = sanBX + sanW / 2;
                for (let si2 = 0; si2 < storagePositions.length; si2++) {
                    const sp = storagePositions[si2];
                    const targetCx = (sp.target === 'A') ? targetAcx : targetBcx;
                    const spRgb = colorRgb(sp.color);
                    out += '<line x1="' + sp.x + '" y1="' + sp.y + '" x2="' + targetCx + '" y2="' + sanY + '" stroke="rgba(' + spRgb + ',0.4)" stroke-width="1.5" stroke-dasharray="5 3" />';
                }

                return out;
            }

            function renderSharedIscsiStorageArray() {
                let out = '';
                const rgb = colorRgb('#8b5cf6');
                const aX = iscsiArrayX;
                const aY = iscsiArrayY;

                // Storage Array box
                out += '<rect x="' + aX + '" y="' + aY + '" width="' + iscsiArrayW + '" height="' + iscsiArrayH + '" rx="10" fill="rgba(' + rgb + ',0.12)" stroke="rgba(' + rgb + ',0.6)" stroke-width="2" />';
                out += '<text x="' + (aX + iscsiArrayW / 2) + '" y="' + (aY + 22) + '" text-anchor="middle" font-size="11" fill="rgba(' + rgb + ',0.95)" font-weight="700">iSCSI Storage Array</text>';
                out += '<text x="' + (aX + iscsiArrayW / 2) + '" y="' + (aY + 38) + '" text-anchor="middle" font-size="8" fill="var(--text-secondary)">Dual Controllers (A + B)</text>';
                out += '<text x="' + (aX + iscsiArrayW / 2) + '" y="' + (aY + 50) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">MPIO Active/Active</text>';

                // Connection lines from Leaf-A and Leaf-B to Storage Array
                const leafAcx = leaf1X + leafW;
                const leafBcx = leaf2X + leafW;
                const arrayLeftX = aX;

                // Leaf-A → Storage Array (routed above Leaf-B to stay visible)
                const routeY = leafY - 18;
                out += '<polyline points="' + leafAcx + ',' + leafY + ' ' + leafAcx + ',' + routeY + ' ' + arrayLeftX + ',' + routeY + ' ' + arrayLeftX + ',' + (aY + 16) + '" fill="none" stroke="rgba(' + rgb + ',0.4)" stroke-width="1.5" stroke-dasharray="5 3" />';
                // Leaf-B → Storage Array
                out += '<line x1="' + leafBcx + '" y1="' + (leafY + leafH - 12) + '" x2="' + arrayLeftX + '" y2="' + (aY + iscsiArrayH - 16) + '" stroke="rgba(' + rgb + ',0.4)" stroke-width="1.5" stroke-dasharray="5 3" />';

                return out;
            }

            // Build intro text
            const storageLabel = storageType === 'fc_san' ? 'FC SAN' : storageType === 'iscsi_4nic' ? 'iSCSI 4-NIC' : 'iSCSI 6-NIC';
            const intro = ''
                + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                + '<strong style="color:var(--text-primary);">Disaggregated (' + escapeHtml(storageLabel) + ')</strong> host networking diagram with Leaf-A / Leaf-B switches.'
                + '<br>Intents: Management + Compute (SET), ' + (hasSharedIscsi ? 'Cluster A/B + iSCSI Path A/B (Physical NIC3/NIC4, no SET)' : 'Cluster 1 &amp; 2 (Standalone)')
                + (hasDedicatedIscsi ? ', iSCSI A &amp; B (Standalone)' : '')
                + (backupEnabled ? ', In-Guest Backup (SET)' : '')
                + (hasDedicatedIscsi ? '. Dedicated iSCSI adapters connect through leaf switch fabric to storage array.' : (hasSharedIscsi ? '. iSCSI shares the standalone physical cluster NICs and uses per-target /32 routes through the leaf switch fabric.' : '. Storage adapters shown at bottom of each node.'))
                + (totalNodes > 2 ? '<br><span style="color:var(--text-secondary);">Showing first 2 of ' + escapeHtml(String(totalNodes)) + ' nodes.</span>' : '')
                + '</div>';

            let svg = '';
            svg += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" role="img" aria-label="Disaggregated host networking diagram">';

            // Outer container ends at the base diagram height — the legend sits below it.
            svg += '<rect x="30" y="55" width="' + (svgW - 60) + '" height="' + (baseSvgH - 85) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(0,120,212,0.35)" stroke-dasharray="6 4" />';

            // Title
            const titleText = 'Disaggregated ' + storageLabel + ' connectivity — ' + portCount + ' ports' + (backupEnabled ? ' + Backup' : '') + ' — Total nodes: ' + totalNodes;
            svg += '<text x="' + (svgW / 2) + '" y="42" text-anchor="middle" font-size="13" fill="var(--text-secondary)">' + escapeHtml(titleText) + '</text>';

            // Leaf-A
            svg += '<rect x="' + leaf1X + '" y="' + leafY + '" width="' + leafW + '" height="' + leafH + '" rx="10" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.6)" stroke-width="2" />';
            svg += '<text x="' + (leaf1X + leafW / 2) + '" y="' + (leafY + 30) + '" text-anchor="middle" font-size="13" fill="var(--text-primary)" font-weight="600">Leaf-A</text>';

            // Leaf-B
            svg += '<rect x="' + leaf2X + '" y="' + leafY + '" width="' + leafW + '" height="' + leafH + '" rx="10" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.6)" stroke-width="2" />';
            svg += '<text x="' + (leaf2X + leafW / 2) + '" y="' + (leafY + 30) + '" text-anchor="middle" font-size="13" fill="var(--text-primary)" font-weight="600">Leaf-B</text>';

            // iBGP link between leaves (Port 49)
            const ibgpX1 = leaf1X + leafW;
            const ibgpX2 = leaf2X;
            const ibgpY2 = leafY + leafH / 2;
            const ibgpMidX = (ibgpX1 + ibgpX2) / 2;
            svg += '<line x1="' + ibgpX1 + '" y1="' + ibgpY2 + '" x2="' + ibgpX2 + '" y2="' + ibgpY2 + '" stroke="rgba(250,204,21,0.7)" stroke-width="2" stroke-dasharray="6 3" />';
            svg += '<text x="' + ibgpMidX + '" y="' + (ibgpY2 - 8) + '" text-anchor="middle" font-size="9" fill="rgba(250,204,21,0.9)">iBGP P49</text>';

            // Render nodes — accumulate storagePositions across all nodes for downlinks
            storagePositions = [];
            for (let ni3 = 0; ni3 < n; ni3++) {
                const posX = nodesStartX + ni3 * (nodeW + gapX);
                uplinkPositions = [];
                svg += renderNode(posX, nodeY, ni3);
                svg += renderUplinks();
            }

            // Storage targets — render below nodes for FC, or
            // render iSCSI Storage Array at leaf level for all iSCSI
            if (hasIscsi) {
                svg += renderSharedIscsiStorageArray();
            } else {
                const sanY = nodeY + nodeH + 20;
                svg += renderStorageDownlinks(sanY);
            }

            // "+N more nodes" badge — inside the outer container
            if (totalNodes > 2) {
                const more = totalNodes - 2;
                const badgeW = 180;
                const badgeH = 26;
                const badgeX = svgW - 60 - badgeW;
                const badgeY = baseSvgH - 85 - badgeH + 15;
                svg += '<rect x="' + badgeX + '" y="' + badgeY + '" width="' + badgeW + '" height="' + badgeH + '" rx="13" fill="rgba(255,255,255,0.05)" stroke="var(--glass-border)" />';
                svg += '<text x="' + (badgeX + badgeW / 2) + '" y="' + (badgeY + 17) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">+' + more + ' more node' + (more === 1 ? '' : 's') + '</text>';
            }

            // ─── Legend rendered inside the SVG (so it's part of the downloaded image) ───
            if (legendEntries.length > 0) {
                const legX = 40;
                const legW = svgW - 80;
                let legY = baseSvgH - 30;
                svg += '<text x="' + legX + '" y="' + (legY + 12) + '" font-size="12" font-weight="700" fill="var(--text-primary)">Net Adapter Team Mapping</text>';
                legY += legendTitleH + 6;
                for (let li = 0; li < legendEntries.length; li++) {
                    const ent = legendEntries[li];
                    const eRgb = colorRgb(ent.color);
                    const entH = legendEntryTitleH + ent.lines.length * legendLineH + legendEntryPadY * 2;
                    svg += '<rect x="' + legX + '" y="' + legY + '" width="' + legW + '" height="' + entH + '" rx="4" fill="rgba(' + eRgb + ',0.06)" stroke="rgba(' + eRgb + ',0.4)" />';
                    svg += '<rect x="' + legX + '" y="' + legY + '" width="3" height="' + entH + '" fill="rgba(' + eRgb + ',0.85)" />';
                    svg += '<text x="' + (legX + 10) + '" y="' + (legY + legendEntryPadY + 10) + '" font-size="11" font-weight="700" fill="rgba(' + eRgb + ',0.95)">' + escapeHtml(ent.title) + '</text>';
                    for (let lj = 0; lj < ent.lines.length; lj++) {
                        const ly = legY + legendEntryPadY + legendEntryTitleH + lj * legendLineH + 8;
                        svg += '<text x="' + (legX + 10) + '" y="' + ly + '" font-size="10" fill="var(--text-secondary)">' + escapeHtml(ent.lines[lj]) + '</text>';
                    }
                    legY += entH + legendEntryGap;
                }
            }

            svg += '</svg>';

            const note = '<div class="switchless-diagram__note">Note: Disaggregated ' + escapeHtml(storageLabel) + ' — Management + Compute intent (blue). '
                + (hasSharedIscsi ? 'Standalone physical NIC3/NIC4 (green) carry Cluster A/B and iSCSI Path A/B on the same VLAN/subnet/source IP. iSCSI target portal /32 routes are pinned to those physical adapters through the leaf switch fabric. ' : 'Cluster networks are standalone NICs (green), one per leaf switch. ')
                + (hasDedicatedIscsi ? 'iSCSI uses dedicated standalone NICs (purple) connecting through leaf switches to the iSCSI storage array (MPIO Active/Active, dual controllers). ' : '')
                + (hasFc ? 'FC HBA connects to separate SAN fabric (dedicated FC network, not through leaf switches). ' : '')
                + (backupEnabled ? 'In-Guest Backup uses a Compute Intent (orange). ' : '')
                + '</div>';

            return '<div class="switchless-diagram">' + intro + svg + note + '</div>';
        }

        // getDisaggPortListForReport is defined at IIFE top level (shared with drawio generator)

        function renderRackAwareTorArchitectureDiagram(state) {
            if (!state || state.scale !== 'rack_aware') return '';

            const arch = state.rackAwareTorArchitecture ? String(state.rackAwareTorArchitecture) : '';
            const torsPerRoom = state.rackAwareTorsPerRoom ? String(state.rackAwareTorsPerRoom) : '';

            const z = state.rackAwareZones || {};
            const zone1Name = (z.zone1Name ? String(z.zone1Name).trim() : '') || 'Zone1';
            const zone2Name = (z.zone2Name ? String(z.zone2Name).trim() : '') || 'Zone2';
            const assignments = (z.assignments && typeof z.assignments === 'object') ? z.assignments : {};

            function getNodeName(idx0) {
                if (state.nodeSettings && state.nodeSettings[idx0] && state.nodeSettings[idx0].name) {
                    const nm = String(state.nodeSettings[idx0].name).trim();
                    if (nm) return nm;
                }
                return 'Node ' + (idx0 + 1);
            }

            function getNicLabel(idx1Based) {
                return getPortCustomName(state, idx1Based, 'nic');
            }

            function intentLabelForSet(intent) {
                if (intent === 'all_traffic') return 'Management + Compute + Storage intent';
                if (intent === 'mgmt_compute') return 'Management + Compute intent';
                if (intent === 'compute_storage') return 'Compute + Storage intent';
                if (intent === 'custom') return 'Custom intent(s)';
                return 'Network intent';
            }

            function intentShortLabel(intent) {
                // Keep Rack Aware diagram labels compact (avoid repeating the word "intent").
                const s = intentLabelForSet(intent);
                return String(s).replace(/\s+intent\(s\)\s*$/i, '').replace(/\s+intent\s*$/i, '');
            }

            let nodeCountAll = parseInt(state.nodes, 10);
            if (isNaN(nodeCountAll) || nodeCountAll < 2) nodeCountAll = 2;
            const shownPerZone = 2;

            const z1Nodes = [];
            const z2Nodes = [];
            for (let i = 0; i < nodeCountAll; i++) {
                const nodeId1 = String(i + 1);
                const zone = Number(assignments[nodeId1]);
                if (zone === 1) z1Nodes.push(getNodeName(i));
                else z2Nodes.push(getNodeName(i));
            }
            // Fallback if assignments are missing.
            if (z1Nodes.length === 0 && z2Nodes.length === 0) {
                for (let j = 0; j < nodeCountAll; j++) {
                    (j % 2 === 0 ? z1Nodes : z2Nodes).push(getNodeName(j));
                }
            }

            function titleForArch(a) {
                if (a === 'option_a') return 'Option A — Dedicated storage links';
                if (a === 'option_b') return 'Option B — Aggregated storage links';
                if (a === 'option_c') return 'Option C — Single TOR per room';
                if (a === 'option_d') return 'Option D — Cross-room node connectivity';
                return 'Rack Aware TOR architecture';
            }

            const learnRef = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/rack-aware-cluster-reference-architecture?view=azloc-2511#tor-switch-architecture';
            const intro = '<div style="margin-bottom:0.5rem;">'
                + '<div style="font-weight:700; color:var(--text-primary);">' + escapeHtml(titleForArch(arch)) + '</div>'
                + '<div style="color:var(--text-secondary);">Reference: <a href="' + learnRef + '" target="_blank" rel="noopener" style="color:var(--accent-blue); text-decoration:underline;">Microsoft Learn</a></div>'
                + '</div>';

            // Diagram layout is intentionally fixed-size for export stability.
            // This version renders intent groups + port tiles + explicit cabling lines.
            const svgW = 1080;
            const svgH = 680;
            const raMgmtVnicH = 30;
            const raMgmtVlanLabel = (state.infraVlan === 'custom' && state.infraVlanId) ? ('VLAN ' + state.infraVlanId) : 'Default VLAN';
            const pad = 40;
            const roomGap = 26;
            const roomW = Math.floor((svgW - (pad * 2) - roomGap) / 2);
            const roomH = 540;
            const roomY = 86;
            const room1X = pad;
            const room2X = pad + roomW + roomGap;

            // Push TORs (and therefore nodes) down to create more headroom for
            // inter-room trunks and upstream Switch/Router trunk connectors.
            const torY = roomY + 116;
            const torH = 56;
            const torW = 150;
            const torGap = 18;

            const nodesY = torY + torH + 42;
            // Two nodes must fit within one room (roomW ~ 487). Keep cards compact.
            const nodeW = 232;
            const nodeH = 240 + raMgmtVnicH;
            const nodeGap = 16;

            function torXsForRoom(roomX, torCount) {
                if (torCount === 2) {
                    const totalW = (2 * torW) + torGap;
                    const startX = roomX + Math.floor((roomW - totalW) / 2);
                    return [startX, startX + torW + torGap];
                }
                return [roomX + Math.floor((roomW - torW) / 2)];
            }

            function nodeXsForRoom(roomX, count) {
                const shown = Math.min(count, shownPerZone);
                const totalW = (shown * nodeW) + ((shown - 1) * nodeGap);
                const startX = roomX + Math.floor((roomW - totalW) / 2);
                const xs = [];
                for (let i2 = 0; i2 < shown; i2++) xs.push(startX + (i2 * (nodeW + nodeGap)));
                return xs;
            }

            // Precompute the node X positions per room so we can align TORs above them.
            // This helps create horizontal space for a clear in-room LAG drawing.
            const room1NodeXs = nodeXsForRoom(room1X, z1Nodes.length);
            const room2NodeXs = nodeXsForRoom(room2X, z2Nodes.length);

            function label(x, y, txt, color, size, weight) {
                return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' + (size || 12) + '" fill="' + (color || 'var(--text-secondary)') + '" font-weight="' + (weight || '400') + '">' + escapeHtml(txt) + '</text>';
            }

            const torCountPerRoom = (torsPerRoom === '2') ? 2 : (torsPerRoom === '1' ? 1 : (arch === 'option_a' || arch === 'option_b' ? 2 : 1));
            let room1TorXs = torXsForRoom(room1X, torCountPerRoom);
            let room2TorXs = torXsForRoom(room2X, torCountPerRoom);

            function alignTorPairToTwoNodes(roomX, torXs, nodeXs) {
                // Only align when we are actually showing two nodes in the room.
                if (!nodeXs || nodeXs.length !== 2) return torXs;
                if (!torXs || torXs.length !== 2) return torXs;

                const c1 = nodeXs[0] + Math.floor(nodeW / 2);
                const c2 = nodeXs[1] + Math.floor(nodeW / 2);
                let x1 = c1 - Math.floor(torW / 2);
                let x2 = c2 - Math.floor(torW / 2);

                // Clamp within room bounds.
                const minX = roomX + 12;
                const maxX = (roomX + roomW) - torW - 12;
                x1 = Math.max(minX, Math.min(maxX, x1));
                x2 = Math.max(minX, Math.min(maxX, x2));

                // Ensure ordering.
                if (x2 < x1) {
                    const t = x1; x1 = x2; x2 = t;
                }

                // If they overlap due to extreme clamping, fall back to default centered layout.
                if (x2 < (x1 + torW + 10)) return torXs;
                return [x1, x2];
            }

            if (torCountPerRoom === 2) {
                // Keep dual-TOR layout consistent across node counts.
                // For 2-node Rack Aware (one node shown per room), align TORs using a virtual 2-node layout
                // so TOR spacing matches 6/8-node diagrams (which also show two nodes per room).
                let room1AlignNodeXs = room1NodeXs;
                let room2AlignNodeXs = room2NodeXs;
                if (room1AlignNodeXs && room1AlignNodeXs.length === 1) room1AlignNodeXs = nodeXsForRoom(room1X, 2);
                if (room2AlignNodeXs && room2AlignNodeXs.length === 1) room2AlignNodeXs = nodeXsForRoom(room2X, 2);

                room1TorXs = alignTorPairToTwoNodes(room1X, room1TorXs, room1AlignNodeXs);
                room2TorXs = alignTorPairToTwoNodes(room2X, room2TorXs, room2AlignNodeXs);
            }

            let svg = '';
            svg += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" role="img" aria-label="Rack Aware TOR architecture diagram">';

            // Room containers
            svg += '<rect x="' + room1X + '" y="' + roomY + '" width="' + roomW + '" height="' + roomH + '" rx="14" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
            svg += '<rect x="' + room2X + '" y="' + roomY + '" width="' + roomW + '" height="' + roomH + '" rx="14" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
            svg += label(room1X + roomW / 2, roomY + 26, zone1Name + ' (Room 1)', 'var(--text-primary)', 14, '700');
            svg += label(room2X + roomW / 2, roomY + 26, zone2Name + ' (Room 2)', 'var(--text-primary)', 14, '700');

            // TORs
            function torBox(x, y, text) {
                const cx = x + torW / 2;
                svg += '<rect x="' + x + '" y="' + y + '" width="' + torW + '" height="' + torH + '" rx="12" fill="rgba(0,120,212,0.12)" stroke="rgba(0,120,212,0.35)" />';
                svg += label(cx, y + 24, text, 'var(--text-primary)', 13, '700');
                svg += label(cx, y + 44, 'TOR', 'var(--text-secondary)', 11, '400');
            }

            function lagLinkForRoom(roomTorXs, y) {
                // Render an explicit LAG box between the two TORs (Learn-style), using TWO parallel connectors.
                // Place it in the gap between TORs and align to the TOR vertical midpoint.
                const leftInner = roomTorXs[0] + torW;
                const rightInner = roomTorXs[1];
                const midX = Math.floor((leftInner + rightInner) / 2);

                const innerGap = Math.max(0, rightInner - leftInner);
                const boxW = Math.min(58, Math.max(34, innerGap - 14));
                const boxH = 22;
                const bx = midX - Math.floor(boxW / 2);
                const by = y - Math.floor(boxH / 2);

                // TOR-to-TOR (in-room) LAG links should be SOLID.
                const stroke = 'var(--accent-blue)';
                const strokeOpacity = 0.70;
                const gap = 8;

                // Two parallel runs (upper/lower) that meet the LAG box edges.
                svg += '<path d="M ' + leftInner + ' ' + (y - Math.floor(gap / 2)) + ' L ' + bx + ' ' + (y - Math.floor(gap / 2)) + '" stroke="' + stroke + '" stroke-opacity="' + strokeOpacity + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + (bx + boxW) + ' ' + (y - Math.floor(gap / 2)) + ' L ' + rightInner + ' ' + (y - Math.floor(gap / 2)) + '" stroke="' + stroke + '" stroke-opacity="' + strokeOpacity + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + leftInner + ' ' + (y + Math.floor(gap / 2)) + ' L ' + bx + ' ' + (y + Math.floor(gap / 2)) + '" stroke="' + stroke + '" stroke-opacity="' + strokeOpacity + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + (bx + boxW) + ' ' + (y + Math.floor(gap / 2)) + ' L ' + rightInner + ' ' + (y + Math.floor(gap / 2)) + '" stroke="' + stroke + '" stroke-opacity="' + strokeOpacity + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />';

                svg += '<rect x="' + bx + '" y="' + by + '" width="' + boxW + '" height="' + boxH + '" rx="8" fill="rgba(0,120,212,0.14)" stroke="rgba(0,120,212,0.45)" />';
                svg += label(midX, y + 7, 'LAG', 'var(--text-primary)', 11, '700');
            }

            if (torCountPerRoom === 2) {
                torBox(room1TorXs[0], torY, 'TOR-1');
                torBox(room1TorXs[1], torY, 'TOR-2');
                torBox(room2TorXs[0], torY, 'TOR-3');
                torBox(room2TorXs[1], torY, 'TOR-4');

                // In-room aggregation (Learn-style): explicit LAG boxes for Mgmt/Compute.
                lagLinkForRoom(room1TorXs, torY + Math.floor(torH / 2));
                lagLinkForRoom(room2TorXs, torY + Math.floor(torH / 2));
            } else {
                torBox(room1TorXs[0], torY, 'TOR-1');
                torBox(room2TorXs[0], torY, 'TOR-2');
            }

            // Nodes (show up to 2 per zone) with intent groups + per-port tiles.
            let ports = parseInt(state.ports, 10);
            if (isNaN(ports) || ports < 0) ports = 0;

            // Determine which ports belong to which intent based on adapter mapping
            const hasAdapterMapping = state.adapterMappingConfirmed && state.adapterMapping && Object.keys(state.adapterMapping).length > 0;
            const mgmtComputePorts = [];
            const storagePorts = [];

            if (hasAdapterMapping) {
                for (let pi = 1; pi <= ports; pi++) {
                    const assignment = state.adapterMapping[pi] || 'pool';
                    if (assignment === 'storage') {
                        storagePorts.push(pi);
                    } else {
                        // mgmt, pool, etc. go to Mgmt+Compute
                        mgmtComputePorts.push(pi);
                    }
                }
            } else {
                // Default assumption: ports 1-2 for Mgmt+Compute, ports 3+ for Storage
                for (let dpi = 1; dpi <= ports; dpi++) {
                    if (dpi <= 2) {
                        mgmtComputePorts.push(dpi);
                    } else {
                        storagePorts.push(dpi);
                    }
                }
            }

            const showStorageGroup = (state.intent !== 'all_traffic') && storagePorts.length > 0;
            const storagePortCount = showStorageGroup ? storagePorts.length : 0;

            function renderSetGroup(nodeLeft, nodeTop, placeOnLeft) {
                // Intent blocks are side-by-side (same vertical level) to match Learn diagrams.
                const padX = 12;
                const gapB = 10;
                const boxW = Math.floor((nodeW - (padX * 2) - gapB) / 2);
                const setW = boxW;
                const setH = 114 + raMgmtVnicH;
                const setX = placeOnLeft ? (nodeLeft + padX) : (nodeLeft + padX + boxW + gapB);
                const setY = nodeTop + 74;

                // Keep tiles compact so side-by-side groups fit within the node card.
                const nicW = 44;
                const nicH = 28;
                const gap = 8;
                const rowW = (2 * nicW) + gap;
                const nic1X = setX + Math.floor((setW - rowW) / 2);
                const nic2X = nic1X + nicW + gap;
                // Align NIC and SMB tiles to the same vertical level.
                const nicY = setY + 28 + raMgmtVnicH;

                const tilesBottomY = nicY + nicH;
                const setLabelY = tilesBottomY + 22;

                let setLabelText = intentShortLabel(state.intent);
                // When Storage uses RDMA, keep the SET label focused on Mgmt/Compute.
                if (showStorageGroup) setLabelText = 'Management + Compute';

                let out = '';
                out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="12" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="6 4" />';

                // Mgmt vNIC card at the top of the SET box
                const vaCardW = 72;
                const vaCardH = 24;
                const vaX = setX + Math.floor((setW - vaCardW) / 2);
                const vaY = setY + 6;
                out += '<rect x="' + vaX + '" y="' + vaY + '" width="' + vaCardW + '" height="' + vaCardH + '" rx="5" fill="rgba(0,120,212,0.10)" stroke="rgba(0,120,212,0.55)" stroke-dasharray="3 2" />';
                out += '<text x="' + (vaX + vaCardW / 2) + '" y="' + (vaY + 10) + '" text-anchor="middle" font-size="7" fill="var(--text-primary)" font-weight="600">Mgmt vNIC</text>';
                out += '<text x="' + (vaX + vaCardW / 2) + '" y="' + (vaY + 20) + '" text-anchor="middle" font-size="6" fill="var(--text-secondary)">' + escapeHtml(raMgmtVlanLabel) + '</text>';

                // Place intent text below the ports so cabling above stays readable.
                out += '<text x="' + (setX + setW / 2) + '" y="' + setLabelY + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">' + escapeHtml(setLabelText) + '</text>';

                function nicTile(x, y, labelText, idx) {
                    let t = '';
                    // Center text vertically if label is 11 characters or less, otherwise stagger
                    const textY = (labelText.length <= 11) ? (y + 18) : ((idx % 2 === 0) ? (y + 14) : (y + 22));
                    t += '<rect x="' + x + '" y="' + y + '" width="' + nicW + '" height="' + nicH + '" rx="8" fill="rgba(0,120,212,0.20)" stroke="rgba(0,120,212,0.55)" />';
                    t += '<text x="' + (x + nicW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(labelText) + '</text>';
                    return t;
                }

                out += nicTile(nic1X, nicY, getNicLabel(mgmtComputePorts[0] || 1), 0);
                out += nicTile(nic2X, nicY, getNicLabel(mgmtComputePorts[1] || 2), 1);

                return {
                    html: out,
                    // Port anchors on the outside/top edge of each NIC tile.
                    nic1: { x: nic1X + nicW / 2, y: nicY - 1 },
                    nic2: { x: nic2X + nicW / 2, y: nicY - 1 }
                };
            }

            function renderStorageGroup(nodeLeft, nodeTop, count, placeOnLeft) {
                if (!count || count <= 0) {
                    return {
                        html: '<text x="' + (nodeLeft + nodeW / 2) + '" y="' + (nodeTop + 214) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">Storage traffic runs on SET</text>',
                        ports: []
                    };
                }

                const padX = 12;
                const gapB = 10;
                const boxW = Math.floor((nodeW - (padX * 2) - gapB) / 2);
                const gW = boxW;
                const gX = placeOnLeft ? (nodeLeft + padX) : (nodeLeft + padX + boxW + gapB);
                const gY = nodeTop + 74;

                // Keep storage compact: show up to 4 SMB tiles (2x2). If more, show a "+N" badge.
                const maxShown = Math.min(count, 4);
                const tileW = 44;
                const tileH = 28;
                const gapX2 = 8;
                const gapY2 = 10;
                const cols2 = 2;
                const rows2 = Math.max(1, Math.ceil(maxShown / cols2));
                // Align SMB tiles with NIC tiles and place the Storage label below the tiles.
                const tilesTopPad = 28 + raMgmtVnicH;
                const tilesH = (rows2 * tileH) + ((rows2 - 1) * gapY2);
                const labelH = 22;
                const padBottom = 12;
                let gH = tilesTopPad + tilesH + labelH + padBottom;
                // Ensure the storage box is at least as tall as SET for visual alignment.
                gH = Math.max(gH, 114 + raMgmtVnicH);

                const totalRowW = (cols2 * tileW) + ((cols2 - 1) * gapX2);
                const startX = gX + Math.floor((gW - totalRowW) / 2);
                const startY = gY + tilesTopPad;

                let out = '';
                out += '<rect x="' + gX + '" y="' + gY + '" width="' + gW + '" height="' + gH + '" rx="12" fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';

                const portsOut = [];
                for (let iS = 0; iS < maxShown; iS++) {
                    const rS = Math.floor(iS / cols2);
                    const cS = iS % cols2;
                    const xS = startX + (cS * (tileW + gapX2));
                    const yS = startY + (rS * (tileH + gapY2));
                    // Use the actual storage port index from storagePorts array
                    const portIdx = storagePorts[iS] || (iS + 3);
                    const lbl = getNicLabel(portIdx);
                    // Center text vertically if label is 11 characters or less, otherwise stagger
                    const textY = (lbl.length <= 11) ? (yS + 18) : ((iS % 2 === 0) ? (yS + 14) : (yS + 22));
                    out += '<rect x="' + xS + '" y="' + yS + '" width="' + tileW + '" height="' + tileH + '" rx="8" fill="rgba(139,92,246,0.25)" stroke="rgba(139,92,246,0.65)" />';
                    out += '<text x="' + (xS + tileW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(lbl) + '</text>';
                    // Port anchors on the outside/top edge of each SMB tile (horizontally centered).
                    portsOut.push({ idx: portIdx, x: xS + Math.floor(tileW / 2), y: yS - 1 });
                }

                // Place the intent label below the SMB tiles so cabling stays clear.
                const labelY = startY + tilesH + 22;
                out += '<text x="' + (gX + gW / 2) + '" y="' + labelY + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">Storage (RDMA)</text>';

                if (count > maxShown) {
                    const badgeW = 54;
                    const badgeH = 20;
                    const bx = gX + gW - badgeW - 10;
                    const by = gY + gH - badgeH - 10;
                    out += '<rect x="' + bx + '" y="' + by + '" width="' + badgeW + '" height="' + badgeH + '" rx="10" fill="rgba(255,255,255,0.06)" stroke="var(--glass-border)" />';
                    out += '<text x="' + (bx + badgeW / 2) + '" y="' + (by + 14) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">+' + escapeHtml(String(count - maxShown)) + '</text>';
                }

                return { html: out, ports: portsOut };
            }

            function nodeFrame(nodeLeft, nodeTop, text) {
                const cx = nodeLeft + nodeW / 2;
                let out = '';
                // Slightly more opaque fill so cabling lines behind don't visually clash with text.
                out += '<rect x="' + nodeLeft + '" y="' + nodeTop + '" width="' + nodeW + '" height="' + nodeH + '" rx="16" fill="rgba(255,255,255,0.06)" stroke="var(--glass-border)" />';
                // Move the node name below the intent blocks for readability.
                out += '<text x="' + cx + '" y="' + (nodeTop + nodeH - 18) + '" text-anchor="middle" font-size="16" fill="var(--text-primary)" font-weight="700">' + escapeHtml(text) + '</text>';
                return out;
            }

            // Build a render list so we can draw cabling behind nodes.
            const nodeRenders = [];
            for (let a1 = 0; a1 < room1NodeXs.length; a1++) {
                nodeRenders.push({ room: 1, sideInRoom: (a1 === 0 ? 'L' : 'R'), x: room1NodeXs[a1], y: nodesY, name: z1Nodes[a1] });
            }
            for (let a2 = 0; a2 < room2NodeXs.length; a2++) {
                nodeRenders.push({ room: 2, sideInRoom: (a2 === 0 ? 'L' : 'R'), x: room2NodeXs[a2], y: nodesY, name: z2Nodes[a2] });
            }

            // Precompute node port anchors.
            for (let nr = 0; nr < nodeRenders.length; nr++) {
                const n0 = nodeRenders[nr];
                // Mirror layout per node side within the room:
                // - Left nodes: SET (Mgmt+Compute + NICs) on left, Storage on right
                // - Right nodes: Storage on left, SET (Mgmt+Compute + NICs) on right
                const isLeftNode = (n0.sideInRoom !== 'R');
                const set = renderSetGroup(n0.x, n0.y, isLeftNode);
                const stor = renderStorageGroup(n0.x, n0.y, storagePortCount, !isLeftNode);
                n0._set = set;
                n0._stor = stor;
            }

            // Cabling lines (draw first so nodes sit on top).
            // Key requirement: each connector must have its own path and land on a unique point
            // along the TOR bottom edge (so lines don't stack through labels).
            function torLeftX(room, which) {
                const xs = (room === 1) ? room1TorXs : room2TorXs;
                const idx = Math.max(0, Math.min(xs.length - 1, which));
                return xs[idx];
            }

            function torLandingPoint(room, which, side, band, slot, total) {
                // Spread landing points along the TOR bottom edge.
                // First split by node side (L/R), then split that side into outside vs inside bands.
                // Requested bundling:
                // - Left side: Storage OUTSIDE, SET INSIDE
                // - Right side: SET INSIDE, Storage OUTSIDE
                const left = torLeftX(room, which);
                const padIn = 14;
                const usable = Math.max(10, torW - (padIn * 2));

                // Special case: only one node per room (e.g., 2-node Rack Aware).
                // Keep anchors visually centered while preserving the 4-node style ordering:
                // left half = SET (NIC1 outer-left, NIC2 inner-left), right half = Storage
                // (SMB1 inner-right, SMB2 outer-right).
                if (side === 'C') {
                    const denomC = Math.max(1, total + 1);
                    const leftHalf = Math.max(10, Math.floor(usable / 2));
                    const rightHalf = Math.max(10, usable - leftHalf);

                    const segStartC = (band === 'storage') ? leftHalf : 0;
                    const segUsableC = (band === 'storage') ? rightHalf : leftHalf;
                    let xC = left + padIn + segStartC + Math.floor(((slot + 1) * segUsableC) / denomC);

                    // Clamp to stay within TOR bounds.
                    const minX = left + padIn + 2;
                    const maxX = left + padIn + usable - 2;
                    if (xC < minX) xC = minX;
                    if (xC > maxX) xC = maxX;
                    const yC = torY + torH;
                    return { x: xC, y: yC };
                }

                const half = Math.floor(usable / 2);
                const sideStart = (side === 'R') ? (padIn + half) : padIn;
                let sideUsable = (side === 'R') ? (usable - half) : half;
                sideUsable = Math.max(10, sideUsable);

                // Split the side segment into two bands.
                const bandHalf = Math.max(10, Math.floor(sideUsable / 2));
                let insideStart = sideStart;
                let insideUsable = bandHalf;
                let outsideStart = sideStart + bandHalf;
                let outsideUsable = Math.max(10, sideUsable - bandHalf);

                // For left side, outside should be the *outermost* portion (left), inside toward center (right).
                if (side === 'L') {
                    outsideStart = sideStart;
                    outsideUsable = bandHalf;
                    insideStart = sideStart + bandHalf;
                    insideUsable = Math.max(10, sideUsable - bandHalf);
                }

                // Landing rule: Mgmt+Compute (SET) lands OUTSIDE, Storage lands INSIDE.
                const useInside = (band === 'storage');
                const segStart = useInside ? insideStart : outsideStart;
                const segUsable = useInside ? insideUsable : outsideUsable;

                const denom = Math.max(1, total + 1);
                const x = left + segStart + Math.floor(((slot + 1) * segUsable) / denom);
                // Land on the TOR bottom edge (border).
                const y = torY + torH;
                return { x: x, y: y };
            }

            function cablePath(from, to, laneIdx, band, side) {
                // Option D (single TOR per room) preference: use direct diagonal connectors.
                // Keep other options orthogonal/vertical-first for readability.
                if (arch === 'option_d') {
                    return 'M ' + from.x + ' ' + from.y + ' L ' + to.x + ' ' + to.y;
                }

                // Options A/B in the Learn diagrams use straight, diagonal port-to-TOR links.
                // Keep Option C orthogonal for clarity.
                if (arch === 'option_a' || arch === 'option_b') {
                    return 'M ' + from.x + ' ' + from.y + ' L ' + to.x + ' ' + to.y;
                }

                // Multi-elbow route with a per-lane approachY (stacked levels) to avoid overlaps.
                // Ensure cables land straight into the TOR (final segment is vertical at the landing X).
                const torBottom = torY + torH + 1;
                const srcY = from.y;
                // Keep Storage (SMB) cabling in a lower band than Mgmt+Compute (SET)
                // so the horizontal runs under the TOR don't overlap.
                const bandOffset = (band === 'storage') ? 16 : 0;
                // Keep storage turn heights mirrored left/right.
                const upper = torBottom + 22 + bandOffset;
                const laneStep = 8;
                let approachY = upper + (laneIdx * laneStep);
                if (approachY > (srcY - 18)) approachY = srcY - 18;

                // Make the first segment always straight up from the port anchor.
                // Then route across at the lane height and land vertically into the TOR.
                return 'M ' + from.x + ' ' + srcY
                    + ' L ' + from.x + ' ' + approachY
                    + ' L ' + to.x + ' ' + approachY
                    + ' L ' + to.x + ' ' + to.y;
            }

            function drawCable(from, room, whichTor, side, band, stroke, dash, groupKey, laneIdx, slot, totalSlots) {
                const to = torLandingPoint(room, whichTor, side, band, slot, totalSlots);
                const d = cablePath(from, to, laneIdx, band, side);
                return '<path d="' + d + '" stroke="' + stroke + '" stroke-width="2" fill="none"' + (dash ? (' stroke-dasharray="' + dash + '"') : '') + ' />';
            }

            function roomCenterX(room) {
                return (room === 1) ? (room1X + (roomW / 2)) : (room2X + (roomW / 2));
            }

            function sideForCable(room, fromX) {
                return (fromX >= roomCenterX(room)) ? 'R' : 'L';
            }

            // Build a list of all cables first, then assign unique landing slots per TOR and per side.
            const cables = [];
            for (let nr2 = 0; nr2 < nodeRenders.length; nr2++) {
                const nn = nodeRenders[nr2];
                const room = nn.room;

                function sideForDestRoom(destRoom, fromX) {
                    // When there's only one node shown in the destination room (e.g., 2-node Rack Aware),
                    // treat cabling as centered on that TOR so landing points don't cluster on one half.
                    const nodesShownDestRoom = (destRoom === 1) ? room1NodeXs.length : room2NodeXs.length;
                    if (nodesShownDestRoom === 1) return 'C';
                    return sideForCable(destRoom, fromX);
                }

                // Option D (Cross-room node connectivity) per Microsoft Learn:
                // - TOR-1 (Room 1) carries Mgmt/Compute + SMB1
                // - TOR-2 (Room 2) carries Mgmt/Compute + SMB2
                // - Each node connects to both TORs (cross-room fiber required for the remote connections)
                if (arch === 'option_d' && torCountPerRoom === 1) {
                    // Mgmt/Compute (SET): NIC1 -> Room 1 TOR, NIC2 -> Room 2 TOR
                    cables.push({ room: 1, tor: 0, kind: 'set', port: 'nic1', from: nn._set.nic1, side: sideForDestRoom(1, nn._set.nic1.x), stroke: 'rgba(255,255,255,0.38)', dash: null });
                    cables.push({ room: 2, tor: 0, kind: 'set', port: 'nic2', from: nn._set.nic2, side: sideForDestRoom(2, nn._set.nic2.x), stroke: 'rgba(255,255,255,0.38)', dash: null });

                    // Storage (RDMA): odd SMB ports -> Room 1 TOR, even SMB ports -> Room 2 TOR
                    const spD = (nn._stor && nn._stor.ports) ? nn._stor.ports : [];
                    for (let siD = 0; siD < spD.length; siD++) {
                        const smbD = spD[siD];
                        const destRoomD = ((smbD.idx % 2) === 0) ? 2 : 1;
                        cables.push({ room: destRoomD, tor: 0, kind: 'storage', port: 'smb' + String(smbD.idx), from: { x: smbD.x, y: smbD.y }, side: sideForDestRoom(destRoomD, smbD.x), stroke: 'rgba(139,92,246,0.70)', dash: null });
                    }
                } else {
                    // Default behavior (Options A/B/C and generic scenarios)
                    // When there's only one node shown in a room, treat cabling as centered on the TOR
                    // so landing points don't all cluster on one half.
                    const nodesShownThisRoom = (room === 1) ? room1NodeXs.length : room2NodeXs.length;
                    const nodeSide = (nodesShownThisRoom === 1) ? 'C' : (nn.sideInRoom || 'L');

                    // Mgmt/Compute (SET): NIC1->left TOR, NIC2->right TOR (or both->single TOR).
                    if (torCountPerRoom === 2) {
                        cables.push({ room: room, tor: 0, kind: 'set', port: 'nic1', from: nn._set.nic1, side: nodeSide, stroke: 'rgba(255,255,255,0.38)', dash: null });
                        cables.push({ room: room, tor: 1, kind: 'set', port: 'nic2', from: nn._set.nic2, side: nodeSide, stroke: 'rgba(255,255,255,0.38)', dash: null });
                    } else {
                        cables.push({ room: room, tor: 0, kind: 'set', port: 'nic1', from: nn._set.nic1, side: nodeSide, stroke: 'rgba(255,255,255,0.38)', dash: null });
                        cables.push({ room: room, tor: 0, kind: 'set', port: 'nic2', from: nn._set.nic2, side: nodeSide, stroke: 'rgba(255,255,255,0.38)', dash: null });
                    }

                    // Storage (RDMA): alternate SMB ports across TORs when dual-TOR.
                    const sp = (nn._stor && nn._stor.ports) ? nn._stor.ports : [];
                    for (let si = 0; si < sp.length; si++) {
                        const smb = sp[si];
                        let whichTor = 0;
                        if (torCountPerRoom === 2) {
                            whichTor = ((smb.idx % 2) === 0) ? 1 : 0;
                        }
                        cables.push({ room: room, tor: whichTor, kind: 'storage', port: 'smb' + String(smb.idx), from: { x: smb.x, y: smb.y }, side: nodeSide, stroke: 'rgba(139,92,246,0.70)', dash: null });
                    }
                }
            }

            function sideXSort(side) {
                return function(a, b) {
                    const ax = (a.from.x || 0);
                    const bx = (b.from.x || 0);
                    return (side === 'R') ? (bx - ax) : (ax - bx);
                };
            }

            // Bundle by (room, tor, nodeSide) so lane levels are shared across intents.
            const bundles = {};
            for (let ci = 0; ci < cables.length; ci++) {
                const c = cables[ci];
                const k = String(c.room) + '-' + String(c.tor) + '-' + String(c.side || 'L');
                if (!bundles[k]) bundles[k] = [];
                bundles[k].push(c);
            }

            Object.keys(bundles).sort().forEach(function(k) {
                const listAll = bundles[k];
                const side = k.split('-')[2] || 'L';

                // Global lane ordering (controls the stacked approachY levels).
                // For centered single-node-per-room (2-node Rack Aware), enforce symmetry across rooms:
                // give each port a deterministic lane index so the first horizontal turn height matches
                // the corresponding port on the opposite room.
                const laneMap = {};
                if (side === 'C') {
                    for (let liC = 0; liC < listAll.length; liC++) {
                        const cC = listAll[liC];
                        const pC = String(cC.port || '');
                        let idxC = 0;
                        if (pC === 'nic1') idxC = 0;
                        else if (pC === 'nic2') idxC = 1;
                        else {
                            const m = pC.match(/^smb(\d+)$/i);
                            if (m) {
                                const nIdx = parseInt(m[1], 10);
                                // Use negative indices for SMB so Storage bandOffset (+16) is cancelled:
                                // SMB2 (idx 2) -> lane -2 aligns with NIC1 (lane 0)
                                // SMB1 (idx 1) -> lane -1 aligns with NIC2 (lane 1)
                                if (!isNaN(nIdx) && nIdx > 0) idxC = -nIdx;
                            }
                        }
                        laneMap[pC] = idxC;
                    }
                } else {
                    const laneSorted = listAll.slice().sort(sideXSort(side));
                    for (let li0 = 0; li0 < laneSorted.length; li0++) {
                        laneMap[laneSorted[li0].port] = li0;
                    }
                }

                // Landing slots remain per band (set vs storage) to keep inside/outside TOR spacing clean.
                // SET (Mgmt+Compute) landing order: keep left-to-right so NIC1 lands left of NIC2.
                // (Right-side nodes still keep their vertical lane ordering via laneSorted above.)
                const setList = listAll.filter(function(c) { return c.kind !== 'storage'; }).slice().sort(function(a, b) {
                    return (a.from.x || 0) - (b.from.x || 0);
                });
                // Storage landing order: keep left-to-right so SMB1 lands left of SMB2.
                // (Right-side nodes still keep their vertical lane ordering via laneSorted above.)
                const storList = listAll.filter(function(c) { return c.kind === 'storage'; }).slice().sort(function(a, b) {
                    return (a.from.x || 0) - (b.from.x || 0);
                });
                const setSlot = {};
                const storSlot = {};
                for (let si0 = 0; si0 < setList.length; si0++) setSlot[setList[si0].port] = si0;
                for (let ti0 = 0; ti0 < storList.length; ti0++) storSlot[storList[ti0].port] = ti0;

                for (let i0 = 0; i0 < listAll.length; i0++) {
                    const cc = listAll[i0];
                    const band = (cc.kind === 'storage') ? 'storage' : 'set';
                    const laneIdx = laneMap[cc.port] || 0;
                    const slot = (band === 'storage') ? (storSlot[cc.port] || 0) : (setSlot[cc.port] || 0);
                    const total = (band === 'storage') ? storList.length : setList.length;
                    svg += drawCable(cc.from, cc.room, cc.tor, (cc.side || 'L'), band, cc.stroke, cc.dash, k, laneIdx, slot, total);
                }
            });

            // Nodes on top of lines.
            for (let nr3 = 0; nr3 < nodeRenders.length; nr3++) {
                const nd = nodeRenders[nr3];
                svg += nodeFrame(nd.x, nd.y, nd.name);
                svg += nd._set.html;
                svg += nd._stor.html;
            }

            // Room-to-room link patterns (draw above TOR boxes, in the top band).
            // Keep them close enough to visually connect to TORs.
            const linkYBase = torY - 30;
            if (arch === 'option_a' && torCountPerRoom === 2) {
                // Add the upstream Switch/Router and Mgmt/Compute trunks (Learn-style components).
                const swW = 240;
                const swH = 54;
                const swX = Math.floor((svgW - swW) / 2);
                const swY = 18;
                svg += '<rect x="' + swX + '" y="' + swY + '" width="' + swW + '" height="' + swH + '" rx="12" fill="rgba(255,255,255,0.06)" stroke="var(--glass-border)" />';
                svg += label(swX + swW / 2, swY + 26, 'Switch / Router', 'var(--text-primary)', 12, '700');

                // TOR-to-Switch/Router trunks: dotted + slightly transparent (blue), similar style to dotted trunks.
                const trunkStroke = 'var(--accent-blue)';
                const trunkOpacity = 0.55;
                const trunkDash = '1 7';
                // One connector per TOR, anchored at the TOR (top-center) and landing on Switch/Router sides.
                // Use two distinct landing Y offsets per side to avoid overlap.
                const attachLeftX = swX;
                const attachRightX = swX + swW;
                const attachYTop = swY + Math.floor(swH * 0.35);
                const attachYBot = swY + Math.floor(swH * 0.65);
                // Label placement: keep close to the Switch/Router side landings (near the upper dotted run), just outside the box.
                const labelLeftX = swX - 86;
                const labelRightX = swX + swW + 86;
                const labelNearY = attachYTop + 14;

                function torTopCenter(x) {
                    return { x: x + Math.floor(torW / 2), y: torY };
                }

                // Room 1 TORs -> left side
                const r1t1 = torTopCenter(room1TorXs[0]);
                const r1t2 = torTopCenter(room1TorXs[1]);
                svg += '<path d="M ' + r1t1.x + ' ' + r1t1.y + ' L ' + r1t1.x + ' ' + attachYTop + ' L ' + attachLeftX + ' ' + attachYTop + '" stroke="' + trunkStroke + '" stroke-opacity="' + trunkOpacity + '" stroke-width="2" stroke-dasharray="' + trunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + r1t2.x + ' ' + r1t2.y + ' L ' + r1t2.x + ' ' + attachYBot + ' L ' + attachLeftX + ' ' + attachYBot + '" stroke="' + trunkStroke + '" stroke-opacity="' + trunkOpacity + '" stroke-width="2" stroke-dasharray="' + trunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label(labelLeftX, labelNearY, 'Management, Compute trunk', 'var(--text-secondary)', 11, '400');

                // Room 2 TORs -> right side
                const r2t3 = torTopCenter(room2TorXs[0]);
                const r2t4 = torTopCenter(room2TorXs[1]);
                // Mirror the left-side ordering: TOR-4 lands above TOR-3.
                svg += '<path d="M ' + r2t4.x + ' ' + r2t4.y + ' L ' + r2t4.x + ' ' + attachYTop + ' L ' + attachRightX + ' ' + attachYTop + '" stroke="' + trunkStroke + '" stroke-opacity="' + trunkOpacity + '" stroke-width="2" stroke-dasharray="' + trunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + r2t3.x + ' ' + r2t3.y + ' L ' + r2t3.x + ' ' + attachYBot + ' L ' + attachRightX + ' ' + attachYBot + '" stroke="' + trunkStroke + '" stroke-opacity="' + trunkOpacity + '" stroke-width="2" stroke-dasharray="' + trunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label(labelRightX, labelNearY, 'Management, Compute trunk', 'var(--text-secondary)', 11, '400');

                const y1 = linkYBase;
                const y2 = linkYBase - 18;
                // Inter-room SMB trunks (TOR↔TOR) should use the SMB accent (purple), while keeping dotted style.
                const smbTrunkStroke = 'var(--accent-purple)';
                const smbTrunkOpacity = 0.55;
                const smbTrunkDash = '1 7';

                function insideTorTopX(torX, dir) {
                    // Nudge toward the diagram interior to avoid overlapping the TOR→Switch/Router anchor at top-center.
                    // dir: +1 (nudge right), -1 (nudge left)
                    const nudge = 12;
                    let x = torX + Math.floor(torW / 2) + (dir * nudge);
                    const minX = torX + 8;
                    const maxX = torX + torW - 8;
                    if (x < minX) x = minX;
                    if (x > maxX) x = maxX;
                    return x;
                }

                // SMB1 trunk: TOR-1 ↔ TOR-3 (connect to TOR top edge)
                const a1x = insideTorTopX(room1TorXs[0], +1);
                const b1x = insideTorTopX(room2TorXs[0], -1);
                svg += '<path d="M ' + a1x + ' ' + torY + ' L ' + a1x + ' ' + y1 + ' L ' + b1x + ' ' + y1 + ' L ' + b1x + ' ' + torY + '" stroke="' + smbTrunkStroke + '" stroke-opacity="' + smbTrunkOpacity + '" stroke-width="2" stroke-dasharray="' + smbTrunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label((a1x + b1x) / 2, y1 - 6, 'SMB1 trunk (TOR-1 ↔ TOR-3) — VLAN 711', 'var(--text-secondary)', 11, '400');

                // SMB2 trunk: TOR-2 ↔ TOR-4 (connect to TOR top edge)
                const a2x = insideTorTopX(room1TorXs[1], +1);
                const b2x = insideTorTopX(room2TorXs[1], -1);
                svg += '<path d="M ' + a2x + ' ' + torY + ' L ' + a2x + ' ' + y2 + ' L ' + b2x + ' ' + y2 + ' L ' + b2x + ' ' + torY + '" stroke="' + smbTrunkStroke + '" stroke-opacity="' + smbTrunkOpacity + '" stroke-width="2" stroke-dasharray="' + smbTrunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label((a2x + b2x) / 2, y2 - 6, 'SMB2 trunk (TOR-2 ↔ TOR-4) — VLAN 712', 'var(--text-secondary)', 11, '400');
            } else if (arch === 'option_b' && torCountPerRoom === 2) {
                // Option B: Aggregated storage links.
                // Add the upstream Switch/Router and Mgmt/Compute trunks (same visual style as Option A).
                const swWb = 240;
                const swHb = 54;
                const swXb = Math.floor((svgW - swWb) / 2);
                const swYb = 18;
                svg += '<rect x="' + swXb + '" y="' + swYb + '" width="' + swWb + '" height="' + swHb + '" rx="12" fill="rgba(255,255,255,0.06)" stroke="var(--glass-border)" />';
                svg += label(swXb + swWb / 2, swYb + 26, 'Switch / Router', 'var(--text-primary)', 12, '700');

                const upStroke = 'var(--accent-blue)';
                const upOpacity = 0.55;
                const upDash = '1 7';
                const attachLeftXb = swXb;
                const attachRightXb = swXb + swWb;
                const attachYTopb = swYb + Math.floor(swHb * 0.35);
                const attachYBotb = swYb + Math.floor(swHb * 0.65);
                const labelLeftXb = swXb - 86;
                const labelRightXb = swXb + swWb + 86;
                const labelNearYb = attachYTopb + 14;

                function torTopCenterB(x) {
                    return { x: x + Math.floor(torW / 2), y: torY };
                }

                // Room 1 TORs -> left side (TOR-1 top, TOR-2 bottom)
                const b_r1t1 = torTopCenterB(room1TorXs[0]);
                const b_r1t2 = torTopCenterB(room1TorXs[1]);
                svg += '<path d="M ' + b_r1t1.x + ' ' + b_r1t1.y + ' L ' + b_r1t1.x + ' ' + attachYTopb + ' L ' + attachLeftXb + ' ' + attachYTopb + '" stroke="' + upStroke + '" stroke-opacity="' + upOpacity + '" stroke-width="2" stroke-dasharray="' + upDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + b_r1t2.x + ' ' + b_r1t2.y + ' L ' + b_r1t2.x + ' ' + attachYBotb + ' L ' + attachLeftXb + ' ' + attachYBotb + '" stroke="' + upStroke + '" stroke-opacity="' + upOpacity + '" stroke-width="2" stroke-dasharray="' + upDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label(labelLeftXb, labelNearYb, 'Management, Compute trunk', 'var(--text-secondary)', 11, '400');

                // Room 2 TORs -> right side (mirror: TOR-4 lands above TOR-3)
                const b_r2t3 = torTopCenterB(room2TorXs[0]);
                const b_r2t4 = torTopCenterB(room2TorXs[1]);
                svg += '<path d="M ' + b_r2t4.x + ' ' + b_r2t4.y + ' L ' + b_r2t4.x + ' ' + attachYTopb + ' L ' + attachRightXb + ' ' + attachYTopb + '" stroke="' + upStroke + '" stroke-opacity="' + upOpacity + '" stroke-width="2" stroke-dasharray="' + upDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + b_r2t3.x + ' ' + b_r2t3.y + ' L ' + b_r2t3.x + ' ' + attachYBotb + ' L ' + attachRightXb + ' ' + attachYBotb + '" stroke="' + upStroke + '" stroke-opacity="' + upOpacity + '" stroke-width="2" stroke-dasharray="' + upDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label(labelRightXb, labelNearYb, 'Management, Compute trunk', 'var(--text-secondary)', 11, '400');

                // TOR-to-TOR storage trunk (single shared trunk with one connector per TOR).
                // Style matches SMB trunks: dotted + slightly transparent purple.
                const smbStrokeB = 'var(--accent-purple)';
                const smbOpacityB = 0.55;
                const smbDashB = '1 7';

                function insideTorTopXb(torX, dir) {
                    // Nudge toward the diagram interior so anchors don't overlap TOR→Switch/Router (top-center).
                    const nudge = 12;
                    let x = torX + Math.floor(torW / 2) + (dir * nudge);
                    const minX = torX + 8;
                    const maxX = torX + torW - 8;
                    if (x < minX) x = minX;
                    if (x > maxX) x = maxX;
                    return x;
                }

                // Anchor points: one per TOR.
                const b_t1 = insideTorTopXb(room1TorXs[0], +1);
                const b_t2 = insideTorTopXb(room1TorXs[1], +1);
                const b_t3 = insideTorTopXb(room2TorXs[0], -1);
                const b_t4 = insideTorTopXb(room2TorXs[1], -1);

                // Shared trunk bus slightly above the TOR row.
                const trunkYB = linkYBase - 18;
                const xMinB = Math.min(Math.min(b_t1, b_t2), Math.min(b_t3, b_t4));
                const xMaxB = Math.max(Math.max(b_t1, b_t2), Math.max(b_t3, b_t4));

                // Horizontal trunk bus
                svg += '<path d="M ' + xMinB + ' ' + trunkYB + ' L ' + xMaxB + ' ' + trunkYB + '" stroke="' + smbStrokeB + '" stroke-opacity="' + smbOpacityB + '" stroke-width="2" stroke-dasharray="' + smbDashB + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';

                // One vertical connector per TOR
                svg += '<path d="M ' + b_t1 + ' ' + torY + ' L ' + b_t1 + ' ' + trunkYB + '" stroke="' + smbStrokeB + '" stroke-opacity="' + smbOpacityB + '" stroke-width="2" stroke-dasharray="' + smbDashB + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + b_t2 + ' ' + torY + ' L ' + b_t2 + ' ' + trunkYB + '" stroke="' + smbStrokeB + '" stroke-opacity="' + smbOpacityB + '" stroke-width="2" stroke-dasharray="' + smbDashB + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + b_t3 + ' ' + torY + ' L ' + b_t3 + ' ' + trunkYB + '" stroke="' + smbStrokeB + '" stroke-opacity="' + smbOpacityB + '" stroke-width="2" stroke-dasharray="' + smbDashB + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + b_t4 + ' ' + torY + ' L ' + b_t4 + ' ' + trunkYB + '" stroke="' + smbStrokeB + '" stroke-opacity="' + smbOpacityB + '" stroke-width="2" stroke-dasharray="' + smbDashB + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';

                // Single trunk label
                svg += label((xMinB + xMaxB) / 2, trunkYB - 6, 'SMB1, SMB2 trunk', 'var(--text-secondary)', 11, '400');
            } else if (arch === 'option_c' && torCountPerRoom === 1) {
                // Draw the bundled link as a direct TOR-to-TOR connector between the TOR boxes.
                // Place it at the vertical middle of the TOR boxes.
                const yC = torY + Math.floor(torH / 2);
                // TOR-to-TOR link styling: dotted + slightly transparent.
                svg += '<path d="M ' + (room1TorXs[0] + torW) + ' ' + yC + ' L ' + room2TorXs[0] + ' ' + yC + '" stroke="var(--accent-blue)" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label((room1TorXs[0] + torW + room2TorXs[0]) / 2, yC - 6, 'Bundled link (SMB1 + SMB2)', 'var(--text-secondary)', 11, '400');
            } else if (arch === 'option_d' && torCountPerRoom === 1) {
                // Option D: TOR-to-TOR links support management and compute intent traffic.
                // Storage RDMA does not rely on TOR-to-TOR links (nodes cross-connect to both TORs).
                const yD = torY + Math.floor(torH / 2);
                const trunkGap = 10;
                // TOR-to-TOR trunks: dotted + slightly transparent + non-SMB accent.
                svg += '<line x1="' + (room1TorXs[0] + torW) + '" y1="' + (yD - Math.floor(trunkGap / 2)) + '" x2="' + room2TorXs[0] + '" y2="' + (yD - Math.floor(trunkGap / 2)) + '" stroke="var(--accent-blue)" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" />';
                svg += '<line x1="' + (room1TorXs[0] + torW) + '" y1="' + (yD + Math.floor(trunkGap / 2)) + '" x2="' + room2TorXs[0] + '" y2="' + (yD + Math.floor(trunkGap / 2)) + '" stroke="var(--accent-blue)" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" />';
                svg += label((room1TorXs[0] + torW + room2TorXs[0]) / 2, yD - 12, 'Mgmt/Compute trunk', 'var(--text-secondary)', 11, '400');
            } else {
                svg += label(svgW / 2, torY + torH + 54, 'Select a TOR architecture in the wizard to render a specific option diagram.', 'var(--text-secondary)', 11, '400');
            }

            // Badge for additional nodes not shown (per room/zone).
            const shown1 = Math.min(z1Nodes.length, shownPerZone);
            const shown2 = Math.min(z2Nodes.length, shownPerZone);
            const remaining1 = Math.max(0, z1Nodes.length - shown1);
            const remaining2 = Math.max(0, z2Nodes.length - shown2);

            function moreBadge(roomX, remainingCount) {
                if (!remainingCount || remainingCount <= 0) return;
                const badgeW = 200;
                const badgeH = 26;
                const bx = roomX + Math.floor((roomW - badgeW) / 2);
                const by = roomY + roomH - 38;
                svg += '<rect x="' + bx + '" y="' + by + '" width="' + badgeW + '" height="' + badgeH + '" rx="13" fill="rgba(255,255,255,0.06)" stroke="var(--glass-border)" />';
                svg += label(roomX + roomW / 2, by + 18, '+' + remainingCount + ' more node(s) not shown', 'var(--text-secondary)', 11, '400');
            }

            moreBadge(room1X, remaining1);
            moreBadge(room2X, remaining2);

            svg += '</svg>';
            const foot = '<div class="switchless-diagram__note">This is a simplified, wizard-oriented diagram intended for planning; validate exact cabling/VLAN behavior against your switch vendor guidance and the Microsoft Learn reference architecture.</div>';

            return '<div class="switchless-diagram">' + intro + svg + foot + '</div>';
        }

        function renderSwitchlessStorageDiagram(state) {
            if (!state || state.storage !== 'switchless') return '';

            const n = parseInt(state.nodes, 10);
            if (isNaN(n) || n < 2 || n > 4) {
                return '<div style="color:var(--text-secondary);">Diagram is available for 2–4 node switchless scenarios only.</div>';
            }

            var ports = parseInt(state.ports, 10) || 0;

            const slMgmtVnicH = 38;
            const slMgmtVlanLabel = (state.infraVlan === 'custom' && state.infraVlanId) ? ('VLAN ' + state.infraVlanId) : 'Default VLAN';

            function renderMgmtVnicSl(centerX, topY) {
                const cardW = 80;
                const cardH = 28;
                const cx = centerX - cardW / 2;
                const cy = topY;
                let vo = '';
                vo += '<rect x="' + cx + '" y="' + cy + '" width="' + cardW + '" height="' + cardH + '" rx="6" fill="rgba(0,120,212,0.10)" stroke="rgba(0,120,212,0.55)" stroke-dasharray="4 2" />';
                vo += '<text x="' + centerX + '" y="' + (cy + 12) + '" text-anchor="middle" font-size="8" fill="var(--text-primary)" font-weight="600">Mgmt vNIC</text>';
                vo += '<text x="' + centerX + '" y="' + (cy + 22) + '" text-anchor="middle" font-size="7" fill="var(--text-secondary)">' + escapeHtml(slMgmtVlanLabel) + '</text>';
                return vo;
            }

            const REF_3NODE_SWITCHLESS = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/three-node-switchless-two-switches-two-links?view=azloc-2511';
            const REF_3NODE_SWITCHLESS_SINGLE = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/three-node-switchless-two-switches-one-link?view=azloc-2511';

            function getNodeLabel(idx) {
                if (state.nodeSettings && state.nodeSettings[idx] && state.nodeSettings[idx].name) {
                    return String(state.nodeSettings[idx].name).trim() || ('Node ' + (idx + 1));
                }
                return 'Node ' + (idx + 1);
            }

            function autoIpLabel(val) {
                if (val === 'disabled') return 'AutoIP: False';
                if (val === 'enabled') return 'AutoIP: True';
                return 'AutoIP: -';
            }

            // Special-case: detailed 3-node switchless storage connectivity (SMB1-4, 6 subnets)
            if (n === 2) {
                const REF_2NODE_SWITCHLESS = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/two-node-switchless-two-switches-two-links?view=azloc-2511';

                const svgW2 = 760;
                const svgH2 = 420 + slMgmtVnicH;

                // Node panels
                const nodeW2 = 300;
                const nodeH2 = 250 + slMgmtVnicH;
                const nodeY2 = 100;
                const nodeX2 = [70, 390];

                function getNicLabel2(idx1Based) {
                    return getPortCustomName(state, idx1Based, 'nic');
                }

                // Resolve actual port assignments from adapter mapping or defaults
                let mgmtComputePorts2 = [1, 2];
                let storagePorts2 = [3, 4];
                if (state.adapterMappingConfirmed && state.adapterMapping && Object.keys(state.adapterMapping).length > 0) {
                    mgmtComputePorts2 = [];
                    storagePorts2 = [];
                    for (let ami = 1; ami <= ports; ami++) {
                        const amAssign = state.adapterMapping[ami] || 'pool';
                        if (amAssign === 'storage') storagePorts2.push(ami);
                        else mgmtComputePorts2.push(ami);
                    }
                }

                function renderSetTeam2(nodeLeft, nodeTop) {
                    const setW = 220;
                    const setH = 62;
                    const setX = nodeLeft + (nodeW2 - setW) / 2;
                    const setY = nodeTop + 78 + slMgmtVnicH;

                    const nicW = 76;
                    const nicH = 34;
                    const gap = 14;
                    const nic1X = setX + 20;
                    const nic2X = nic1X + nicW + gap;
                    const nicY = setY + 18;

                    let out = '';
                    out += renderMgmtVnicSl(nodeLeft + nodeW2 / 2, nodeTop + 50);
                    out += '<text x="' + (nodeLeft + nodeW2 / 2) + '" y="' + (nodeTop + 62 + slMgmtVnicH) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">Mgmt + Compute intent</text>';
                    out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="12" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="6 4" />';
                    out += '<text x="' + (setX + setW / 2) + '" y="' + (setY + 14) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">SET (vSwitch)</text>';

                    function nicTile(x, y, label, idx) {
                        let t = '';
                        // Center text vertically if label is 11 characters or less, otherwise stagger
                        const textY = (label.length <= 11) ? (y + 21) : ((idx % 2 === 0) ? (y + 16) : (y + 26));
                        t += '<rect x="' + x + '" y="' + y + '" width="' + nicW + '" height="' + nicH + '" rx="8" fill="rgba(0,120,212,0.20)" stroke="rgba(0,120,212,0.55)" />';
                        t += '<text x="' + (x + nicW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(label) + '</text>';
                        return t;
                    }

                    out += nicTile(nic1X, nicY, getNicLabel2(mgmtComputePorts2[0] || 1), 0);
                    out += nicTile(nic2X, nicY, getNicLabel2(mgmtComputePorts2[1] || 2), 1);
                    return out;
                }

                // Storage intent group (2 RDMA ports per node)
                const storageGroupW2 = 260;
                const storageGroupH2 = 92;
                const storageTileW2 = 54;
                const storageTileH2 = 38;
                const storageTileGap2 = 18;

                function storageGroupRect2(nodeIdx) {
                    const nodeLeft = nodeX2[nodeIdx];
                    const x = nodeLeft + (nodeW2 - storageGroupW2) / 2;
                    const y = nodeY2 + 150 + slMgmtVnicH;
                    return { x: x, y: y, w: storageGroupW2, h: storageGroupH2 };
                }

                function storageTileRect2(nodeIdx, portIdx) {
                    const g = storageGroupRect2(nodeIdx);
                    const totalW = (storageTileW2 * 2) + storageTileGap2;
                    const startX = g.x + (g.w - totalW) / 2;
                    const x = startX + (portIdx * (storageTileW2 + storageTileGap2));
                    const y = g.y + 36;
                    return { x: x, y: y, w: storageTileW2, h: storageTileH2 };
                }

                function storagePortPos2(nodeIdx, portIdx) {
                    const r = storageTileRect2(nodeIdx, portIdx);
                    return { x: r.x + (r.w / 2), y: r.y + r.h };
                }

                function subnetColor2(subnetNumber) {
                    // Two distinct hues.
                    return subnetNumber === 1 ? 'hsla(215, 78%, 62%, 0.95)' : 'hsla(330, 78%, 62%, 0.95)';
                }

                const intro2 = ''
                    + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                    + '<strong style="color:var(--text-primary);">Storage Network ATC intent</strong> (switchless) — storage connectivity only.'
                    + '<br>'
                    + '2-node switchless uses <strong style="color:var(--text-primary);">2 RDMA storage ports per node</strong> (commonly named SMB1–SMB2), and uses <strong style="color:var(--text-primary);">two storage subnets</strong> between the pair.'
                    + '</div>';

                const edges2 = [
                    { subnet: 1, a: { n: 0, p: 0 }, b: { n: 1, p: 0 }, pair: 'Node1↔Node2', lane: 0 },
                    { subnet: 2, a: { n: 0, p: 1 }, b: { n: 1, p: 1 }, pair: 'Node1↔Node2', lane: 1 }
                ];

                function pathBetween2Clean(a, b, busY, midX) {
                    return 'M ' + a.x + ' ' + a.y
                        + ' L ' + a.x + ' ' + busY
                        + ' L ' + midX + ' ' + busY
                        + ' L ' + b.x + ' ' + busY
                        + ' L ' + b.x + ' ' + b.y;
                }

                let svg2 = '';
                svg2 += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW2 + ' ' + svgH2 + '" role="img" aria-label="2-node switchless storage connectivity diagram">';

                svg2 += '<rect x="35" y="55" width="' + (svgW2 - 70) + '" height="' + (svgH2 - 90) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                svg2 += '<text x="' + (svgW2 / 2) + '" y="42" text-anchor="middle" font-size="13" fill="var(--text-secondary)">Storage Network ATC intent — Switchless=true, ' + escapeHtml(autoIpLabel(state.storageAutoIp)) + '</text>';

                for (let i2 = 0; i2 < 2; i2++) {
                    const x2 = nodeX2[i2];
                    svg2 += '<rect x="' + x2 + '" y="' + nodeY2 + '" width="' + nodeW2 + '" height="' + nodeH2 + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                    svg2 += '<text x="' + (x2 + nodeW2 / 2) + '" y="' + (nodeY2 + 34) + '" text-anchor="middle" font-size="16" fill="var(--text-primary)" font-weight="700">' + escapeHtml(getNodeLabel(i2)) + '</text>';
                    svg2 += renderSetTeam2(x2, nodeY2);

                    const sg2 = storageGroupRect2(i2);
                    svg2 += '<rect x="' + sg2.x + '" y="' + sg2.y + '" width="' + sg2.w + '" height="' + sg2.h + '" rx="12" fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                    svg2 += '<text x="' + (sg2.x + sg2.w / 2) + '" y="' + (sg2.y + 16) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Storage intent (RDMA)</text>';

                    for (let p2 = 0; p2 < 2; p2++) {
                        const tr2 = storageTileRect2(i2, p2);
                        // Use actual storage port indices from adapter mapping
                        const lbl2 = getNicLabel2(storagePorts2[p2] || (p2 + 3));
                        // Center text vertically if label is 11 characters or less, otherwise stagger
                        const textY2 = (lbl2.length <= 11) ? (tr2.y + 23) : ((p2 % 2 === 0) ? (tr2.y + 18) : (tr2.y + 28));
                        svg2 += '<rect x="' + tr2.x + '" y="' + tr2.y + '" width="' + tr2.w + '" height="' + tr2.h + '" rx="8" fill="rgba(139,92,246,0.25)" stroke="rgba(139,92,246,0.65)" />';
                        svg2 += '<text x="' + (tr2.x + tr2.w / 2) + '" y="' + textY2 + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(lbl2) + '</text>';
                    }
                }

                const laneBaseY2 = nodeY2 + nodeH2 + 22;
                const laneGap2 = 20;
                const midXOffsets2 = [0, 18];

                for (let e2 = 0; e2 < edges2.length; e2++) {
                    const ed2 = edges2[e2];
                    var a2 = storagePortPos2(ed2.a.n, ed2.a.p);
                    var b2 = storagePortPos2(ed2.b.n, ed2.b.p);
                    const busY2 = laneBaseY2 + (ed2.lane * laneGap2);
                    const midX2 = ((a2.x + b2.x) / 2) + (midXOffsets2[ed2.lane] || 0);
                    const d2 = pathBetween2Clean(a2, b2, busY2, midX2);
                    const stroke2 = subnetColor2(ed2.subnet);
                    svg2 += '<path d="' + d2 + '" fill="none" stroke="' + stroke2 + '" stroke-width="2.6" opacity="0.95" />';
                    svg2 += '<text x="' + midX2 + '" y="' + (busY2 - 6) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Subnet ' + ed2.subnet + '</text>';
                }

                svg2 += '</svg>';

                const subnetExamples2 = {
                    1: getStorageSubnetCidr(state, 1, '10.0.1.0/24'),
                    2: getStorageSubnetCidr(state, 2, '10.0.2.0/24')
                };
                const legendTitle2 = hasCustomStorageSubnets(state) ? 'Storage subnets (custom)' : 'Storage subnets (conceptual)';
                const legendNote2 = getStorageSubnetNote(state, 'CIDRs shown are the default Network ATC values for 2-node switchless storage connectivity; these are automatically assigned.');

                const legend2 = '<div class="switchless-diagram__legend">'
                    + '<div class="switchless-diagram__legend-title">' + legendTitle2 + '</div>'
                    + '<div class="switchless-diagram__legend-grid">'
                    + [1, 2].map(function(num) {
                        const edge = edges2.filter(function(e) { return e.subnet === num; })[0];
                        const pair = edge ? edge.pair : '';
                        const ex = subnetExamples2[num] ? (' — ' + subnetExamples2[num]) : '';
                        const preview = ''
                            + '<svg width="56" height="10" viewBox="0 0 56 10" aria-hidden="true">'
                            + '<line x1="0" y1="5" x2="56" y2="5" stroke="' + subnetColor2(num) + '" stroke-width="2" opacity="0.95" />'
                            + '</svg>';
                        return '<div class="switchless-diagram__legend-item">'
                            + preview
                            + '<span class="switchless-diagram__legend-text">Subnet ' + num + (pair ? (' — ' + escapeHtml(pair)) : '') + (ex ? (' <span style="color:var(--text-secondary)">' + escapeHtml(ex.trim()) + '</span>') : '') + '</span>'
                            + '</div>';
                    }).join('')
                    + '</div>'
                    + '<div class="switchless-diagram__note">Note: This diagram shows storage connectivity only (RDMA). ' + legendNote2 + '</div>'
                    + '</div>';

                const foot2 = '<div style="margin-top:0.5rem; color:var(--text-secondary);">'
                    + 'Reference pattern (2-node switchless dual-TOR dual-link): '
                    + '<a href="' + REF_2NODE_SWITCHLESS + '" target="_blank" rel="noopener">Microsoft Learn</a>'
                    + '</div>';

                return '<div class="switchless-diagram">' + intro2 + svg2 + legend2 + foot2 + '</div>';
            }

            // Special-case: detailed 3-node switchless storage connectivity (SMB1-4, 6 subnets)
            if (n === 3) {
                const linkMode = state && state.switchlessLinkMode ? String(state.switchlessLinkMode) : 'dual_link';

                // Single-link (one storage link per node-pair; 2 RDMA ports per node)
                if (linkMode === 'single_link') {
                    const svgWS = 980;
                    const svgHS = 490 + slMgmtVnicH;

                    const nodeWS = 280;
                    const nodeHS = 240 + slMgmtVnicH;
                    const nodeYS = 110;
                    const nodeXS = [60, 350, 640];

                    const storageGroupWS = 210;
                    const storageGroupHS = 86;
                    const storageTileWS = 54;
                    const storageTileHS = 38;
                    const storageTileGapS = 18;

                    function getNicLabelS(idx1Based) {
                        return getPortCustomName(state, idx1Based, 'nic');
                    }

                    function renderSetTeamS(nodeLeft, nodeTop) {
                        const setW = 210;
                        const setH = 62;
                        const setX = nodeLeft + (nodeWS - setW) / 2;
                        const setY = nodeTop + 78 + slMgmtVnicH;

                        const nicW = 70;
                        const nicH = 34;
                        const gap = 14;
                        const nic1X = setX + 18;
                        const nic2X = nic1X + nicW + gap;
                        const nicY = setY + 18;

                        let out = '';
                        out += renderMgmtVnicSl(nodeLeft + nodeWS / 2, nodeTop + 50);
                        out += '<text x="' + (nodeLeft + nodeWS / 2) + '" y="' + (nodeTop + 62 + slMgmtVnicH) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">Mgmt + Compute intent</text>';
                        out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="12" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="6 4" />';
                        out += '<text x="' + (setX + setW / 2) + '" y="' + (setY + 14) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">SET (vSwitch)</text>';

                        function nicTile(x, y, label, idx) {
                            let t = '';
                            // Center text vertically if label is 11 characters or less, otherwise stagger
                            const textY = (label.length <= 11) ? (y + 21) : ((idx % 2 === 0) ? (y + 16) : (y + 26));
                            t += '<rect x="' + x + '" y="' + y + '" width="' + nicW + '" height="' + nicH + '" rx="8" fill="rgba(0,120,212,0.20)" stroke="rgba(0,120,212,0.55)" />';
                            t += '<text x="' + (x + nicW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(label) + '</text>';
                            return t;
                        }

                        out += nicTile(nic1X, nicY, getNicLabelS(1), 0);
                        out += nicTile(nic2X, nicY, getNicLabelS(2), 1);
                        return out;
                    }

                    function storageGroupRectS(nodeIdx) {
                        const nodeLeft = nodeXS[nodeIdx];
                        const x = nodeLeft + (nodeWS - storageGroupWS) / 2;
                        const y = nodeYS + 150 + slMgmtVnicH;
                        return { x: x, y: y, w: storageGroupWS, h: storageGroupHS };
                    }

                    function storageTileRectS(nodeIdx, portIdx) {
                        const g = storageGroupRectS(nodeIdx);
                        const totalW = (storageTileWS * 2) + storageTileGapS;
                        const startX = g.x + (g.w - totalW) / 2;
                        const x = startX + (portIdx * (storageTileWS + storageTileGapS));
                        const y = g.y + 36;
                        return { x: x, y: y, w: storageTileWS, h: storageTileHS };
                    }

                    function storagePortPosS(nodeIdx, portIdx) {
                        const r = storageTileRectS(nodeIdx, portIdx);
                        return { x: r.x + (r.w / 2), y: r.y + r.h };
                    }

                    function subnetColorS(subnetNumber) {
                        const idx = Math.max(1, Math.min(3, subnetNumber)) - 1;
                        const hues = [210, 290, 30];
                        const h = hues[idx % hues.length];
                        return 'hsla(' + h + ', 78%, 62%, 0.95)';
                    }

                    const introS = ''
                        + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                        + '<strong style="color:var(--text-primary);">Storage Network ATC intent</strong> (switchless) — storage connectivity only.'
                        + '<br>'
                        + '3-node switchless (single-link) uses <strong style="color:var(--text-primary);">2 RDMA storage ports per node</strong> (commonly named SMB1–SMB2), and uses <strong style="color:var(--text-primary);">three storage subnets</strong> (one per node-pair).'
                        + '</div>';

                    // Full-mesh single-link mapping:
                    // - Each node connects to both peers with a single link.
                    // - With 2 ports per node, each node dedicates one port per peer.
                    const edgesS = [
                        { subnet: 1, a: { n: 0, p: 0 }, b: { n: 1, p: 0 }, pair: 'Node1↔Node2', lane: 0 },
                        { subnet: 2, a: { n: 0, p: 1 }, b: { n: 2, p: 0 }, pair: 'Node1↔Node3', lane: 1 },
                        { subnet: 3, a: { n: 1, p: 1 }, b: { n: 2, p: 1 }, pair: 'Node2↔Node3', lane: 2 }
                    ];

                    function pathBetweenS(a, b, busY, midX) {
                        return 'M ' + a.x + ' ' + a.y
                            + ' L ' + a.x + ' ' + busY
                            + ' L ' + midX + ' ' + busY
                            + ' L ' + b.x + ' ' + busY
                            + ' L ' + b.x + ' ' + b.y;
                    }

                    let svgS = '';
                    svgS += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgWS + ' ' + svgHS + '" role="img" aria-label="3-node switchless (single-link) storage connectivity diagram">';

                    svgS += '<rect x="35" y="55" width="' + (svgWS - 70) + '" height="' + (svgHS - 90) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                    svgS += '<text x="' + (svgWS / 2) + '" y="42" text-anchor="middle" font-size="13" fill="var(--text-secondary)">Storage Network ATC intent — Switchless=true, Link=Single-Link, ' + escapeHtml(autoIpLabel(state.storageAutoIp)) + '</text>';

                    for (let iS = 0; iS < 3; iS++) {
                        const xS = nodeXS[iS];
                        svgS += '<rect x="' + xS + '" y="' + nodeYS + '" width="' + nodeWS + '" height="' + nodeHS + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                        svgS += '<text x="' + (xS + nodeWS / 2) + '" y="' + (nodeYS + 34) + '" text-anchor="middle" font-size="16" fill="var(--text-primary)" font-weight="700">' + escapeHtml(getNodeLabel(iS)) + '</text>';
                        svgS += renderSetTeamS(xS, nodeYS);

                        const sgS = storageGroupRectS(iS);
                        svgS += '<rect x="' + sgS.x + '" y="' + sgS.y + '" width="' + sgS.w + '" height="' + sgS.h + '" rx="12" fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                        svgS += '<text x="' + (sgS.x + sgS.w / 2) + '" y="' + (sgS.y + 16) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Storage intent (RDMA)</text>';

                        for (let pS = 0; pS < 2; pS++) {
                            const trS = storageTileRectS(iS, pS);
                            // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                            const labelS = getNicLabelS(pS + 3);
                            // Center text vertically if label is 11 characters or less, otherwise stagger
                            const textYS = (labelS.length <= 11) ? (trS.y + 23) : ((pS % 2 === 0) ? (trS.y + 18) : (trS.y + 28));
                            svgS += '<rect x="' + trS.x + '" y="' + trS.y + '" width="' + trS.w + '" height="' + trS.h + '" rx="8" fill="rgba(139,92,246,0.25)" stroke="rgba(139,92,246,0.65)" />';
                            svgS += '<text x="' + (trS.x + trS.w / 2) + '" y="' + textYS + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(labelS) + '</text>';
                        }
                    }

                    const laneBaseYS = nodeYS + nodeHS + 26;
                    const laneGapS = 22;
                    const midXOffsetsS = [0, 10, -10];

                    for (let eS = 0; eS < edgesS.length; eS++) {
                        const edS = edgesS[eS];
                        const aS = storagePortPosS(edS.a.n, edS.a.p);
                        const bS = storagePortPosS(edS.b.n, edS.b.p);
                        const busYS = laneBaseYS + (edS.lane * laneGapS);
                        const midXS = ((aS.x + bS.x) / 2) + (midXOffsetsS[edS.lane] || 0);
                        const dS = pathBetweenS(aS, bS, busYS, midXS);
                        svgS += '<path d="' + dS + '" fill="none" stroke="' + subnetColorS(edS.subnet) + '" stroke-width="2.6" opacity="0.95" />';
                        svgS += '<text x="' + midXS + '" y="' + (busYS - 6) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Subnet ' + edS.subnet + '</text>';
                    }

                    svgS += '</svg>';

                    const subnetExamplesS = {
                        1: getStorageSubnetCidr(state, 1, '10.0.1.0/24'),
                        2: getStorageSubnetCidr(state, 2, '10.0.2.0/24'),
                        3: getStorageSubnetCidr(state, 3, '10.0.3.0/24')
                    };
                    const legendTitleS = hasCustomStorageSubnets(state) ? 'Storage subnets (custom)' : 'Storage subnets (conceptual)';
                    const legendNoteS = getStorageSubnetNote(state, 'CIDRs shown are an extrapolated example; use your own addressing plan.');

                    const legendS = '<div class="switchless-diagram__legend">'
                        + '<div class="switchless-diagram__legend-title">' + legendTitleS + '</div>'
                        + '<div class="switchless-diagram__legend-grid">'
                        + [1, 2, 3].map(function(num) {
                            const edge = edgesS.filter(function(e) { return e.subnet === num; })[0];
                            const pair = edge ? edge.pair : '';
                            const ex = subnetExamplesS[num] ? (' — ' + subnetExamplesS[num]) : '';
                            const preview = ''
                                + '<svg width="56" height="10" viewBox="0 0 56 10" aria-hidden="true">'
                                + '<line x1="0" y1="5" x2="56" y2="5" stroke="' + subnetColorS(num) + '" stroke-width="2" opacity="0.95" />'
                                + '</svg>';
                            return '<div class="switchless-diagram__legend-item">'
                                + preview
                                + '<span class="switchless-diagram__legend-text">Subnet ' + num + (pair ? (' — ' + escapeHtml(pair)) : '') + (ex ? (' <span style="color:var(--text-secondary)">' + escapeHtml(ex.trim()) + '</span>') : '') + '</span>'
                                + '</div>';
                        }).join('')
                        + '</div>'
                        + '<div class="switchless-diagram__note">Note: This diagram shows storage connectivity only (RDMA). ' + legendNoteS + '</div>'
                        + '</div>';

                    const footS = '<div style="margin-top:0.5rem; color:var(--text-secondary);">'
                        + 'Reference pattern (3-node switchless dual-TOR single-link): '
                        + '<a href="' + REF_3NODE_SWITCHLESS_SINGLE + '" target="_blank" rel="noopener">Microsoft Learn</a>'
                        + '</div>';

                    return '<div class="switchless-diagram">' + introS + svgS + legendS + footS + '</div>';
                }

                const svgW3 = 980;
                // Increase height so all subnet lanes remain visible.
                const svgH3 = 520 + slMgmtVnicH;

                // Node panels
                const nodeW = 280;
                const nodeH = 240 + slMgmtVnicH;
                const nodeY = 110;
                const nodeX = [60, 350, 640];

                // Port layout
                // Mgmt+Compute SET team shown above; storage ports below it.
                const storageGroupW = 240;
                const storageGroupH = 86;

                const storageTileW = 46;
                const storageTileH = 38;
                const storageTileGap = 12;

                function getNicLabel(idx1Based) {
                    return getPortCustomName(state, idx1Based, 'nic');
                }

                function storageGroupRect(nodeIdx) {
                    const nodeLeft = nodeX[nodeIdx];
                    const x = nodeLeft + (nodeW - storageGroupW) / 2;
                    const y = nodeY + 150 + slMgmtVnicH;
                    return { x: x, y: y, w: storageGroupW, h: storageGroupH };
                }

                function storageTileRect(nodeIdx, portIdx) {
                    // 4 storage RDMA ports per node, shown as tiles.
                    const g = storageGroupRect(nodeIdx);
                    const totalW = (storageTileW * 4) + (storageTileGap * 3);
                    const startX = g.x + (g.w - totalW) / 2;
                    const x = startX + (portIdx * (storageTileW + storageTileGap));
                    const y = g.y + 36;
                    return { x: x, y: y, w: storageTileW, h: storageTileH };
                }

                function storagePortPos(nodeIdx, portIdx) {
                    // Connection anchor at the bottom-center of the tile.
                    const r = storageTileRect(nodeIdx, portIdx);
                    return { x: r.x + (r.w / 2), y: r.y + r.h };
                }

                function renderSetTeam(nodeLeft, nodeTop) {
                    // Render a small SET group with two NIC tiles.
                    const setW = 210;
                    const setH = 62;
                    const setX = nodeLeft + (nodeW - setW) / 2;
                    const setY = nodeTop + 78 + slMgmtVnicH;

                    const nicW = 70;
                    const nicH = 34;
                    const gap = 14;
                    const nic1X = setX + 18;
                    const nic2X = nic1X + nicW + gap;
                    const nicY = setY + 18;

                    let out = '';
                    out += renderMgmtVnicSl(nodeLeft + nodeW / 2, nodeTop + 50);
                    out += '<text x="' + (nodeLeft + nodeW / 2) + '" y="' + (nodeTop + 62 + slMgmtVnicH) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">Mgmt + Compute intent</text>';
                    out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="12" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="6 4" />';
                    out += '<text x="' + (setX + setW / 2) + '" y="' + (setY + 14) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">SET (vSwitch)</text>';

                    // NIC tiles
                    function nicTile(x, y, label, idx) {
                        let t = '';
                        // Center text vertically if label is 11 characters or less, otherwise stagger
                        const textY = (label.length <= 11) ? (y + 21) : ((idx % 2 === 0) ? (y + 16) : (y + 26));
                        t += '<rect x="' + x + '" y="' + y + '" width="' + nicW + '" height="' + nicH + '" rx="8" fill="rgba(0,120,212,0.20)" stroke="rgba(0,120,212,0.55)" />';
                        t += '<text x="' + (x + nicW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(label) + '</text>';
                        return t;
                    }
                    out += nicTile(nic1X, nicY, getNicLabel(1), 0);
                    out += nicTile(nic2X, nicY, getNicLabel(2), 1);
                    return out;
                }

                const intro3 = ''
                    + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                    + '<strong style="color:var(--text-primary);">Storage Network ATC intent</strong> (switchless) — storage connectivity only.'
                    + '<br>'
                    + '3-node switchless (dual-link) uses <strong style="color:var(--text-primary);">4 RDMA storage ports per node</strong> (commonly named SMB1–SMB4), and uses <strong style="color:var(--text-primary);">six storage subnets</strong> (two per node-pair).'
                    + '</div>';

                // Subnet line styles (no new colors; differentiate via dash patterns and opacity)
                const subnetStyles = [
                    { id: 'S1', dash: '', opacity: 0.95 },
                    { id: 'S2', dash: '', opacity: 0.95 },
                    { id: 'S3', dash: '', opacity: 0.95 },
                    { id: 'S4', dash: '', opacity: 0.85 },
                    { id: 'S5', dash: '', opacity: 0.85 },
                    { id: 'S6', dash: '', opacity: 0.85 }
                ];

                function subnetColor3(subnetNumber) {
                    // Distinct 6-color palette (same approach as 4-node but fewer entries).
                    // Chosen to be visually distinct on a dark background.
                    const idx = Math.max(1, Math.min(6, subnetNumber)) - 1;
                    const hues = [210, 250, 290, 330, 30, 160];
                    const h = hues[idx % hues.length];
                    return 'hsla(' + h + ', 78%, 62%, 0.95)';
                }

                // A clear, consistent mapping (conceptual) between ports and the 6 storage subnets.
                // - Two subnets per node-pair.
                // - Numbering aligns to the 4-node reference pattern numbering style:
                //   1-2: Node1↔Node2, 3-4: Node1↔Node3, 5-6: Node2↔Node3.
                const edges = [
                    // Node1 <-> Node2 (two lanes)
                    { subnet: 1, a: { n: 0, p: 0 }, b: { n: 1, p: 0 }, pair: 'Node1↔Node2', lane: 0 },
                    { subnet: 2, a: { n: 0, p: 1 }, b: { n: 1, p: 1 }, pair: 'Node1↔Node2', lane: 1 },
                    // Node1 <-> Node3 (two lanes)
                    { subnet: 3, a: { n: 0, p: 2 }, b: { n: 2, p: 0 }, pair: 'Node1↔Node3', lane: 2 },
                    { subnet: 4, a: { n: 0, p: 3 }, b: { n: 2, p: 1 }, pair: 'Node1↔Node3', lane: 3 },
                    // Node2 <-> Node3 (two lanes)
                    { subnet: 5, a: { n: 1, p: 2 }, b: { n: 2, p: 2 }, pair: 'Node2↔Node3', lane: 4 },
                    { subnet: 6, a: { n: 1, p: 3 }, b: { n: 2, p: 3 }, pair: 'Node2↔Node3', lane: 5 }
                ];

                function pathBetween(a, b, busY, midX) {
                    // Route via a dedicated lane (busY) so each subnet is readable at first sight.
                    // Use a slight horizontal offset at the midpoint to reduce stacking.
                    return 'M ' + a.x + ' ' + a.y
                        + ' L ' + a.x + ' ' + busY
                        + ' L ' + midX + ' ' + busY
                        + ' L ' + b.x + ' ' + busY
                        + ' L ' + b.x + ' ' + b.y;
                }

                let svg3 = '';
                svg3 += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW3 + ' ' + svgH3 + '" role="img" aria-label="3-node switchless storage connectivity diagram">';
                svg3 += '<defs>'
                    + '<linearGradient id="swg" x1="0" y1="0" x2="1" y2="1">'
                    + '<stop offset="0%" stop-color="rgba(0,120,212,0.85)" />'
                    + '<stop offset="100%" stop-color="rgba(139,92,246,0.85)" />'
                    + '</linearGradient>'
                    + '</defs>';

                // Intent container
                svg3 += '<rect x="35" y="55" width="' + (svgW3 - 70) + '" height="' + (svgH3 - 90) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                svg3 += '<text x="' + (svgW3 / 2) + '" y="42" text-anchor="middle" font-size="13" fill="var(--text-secondary)">Storage Network ATC intent — Switchless=true, Link=Dual-Link, ' + escapeHtml(autoIpLabel(state.storageAutoIp)) + '</text>';

                // Node cards + ports
                for (let i3 = 0; i3 < 3; i3++) {
                    const x0 = nodeX[i3];
                    svg3 += '<rect x="' + x0 + '" y="' + nodeY + '" width="' + nodeW + '" height="' + nodeH + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                    svg3 += '<text x="' + (x0 + nodeW / 2) + '" y="' + (nodeY + 34) + '" text-anchor="middle" font-size="16" fill="var(--text-primary)" font-weight="700">' + escapeHtml(getNodeLabel(i3)) + '</text>';
                    svg3 += renderSetTeam(x0, nodeY);

                    // Storage intent group (RDMA ports)
                    const sg = storageGroupRect(i3);
                    svg3 += '<rect x="' + sg.x + '" y="' + sg.y + '" width="' + sg.w + '" height="' + sg.h + '" rx="12" fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                    svg3 += '<text x="' + (sg.x + sg.w / 2) + '" y="' + (sg.y + 16) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Storage intent (RDMA)</text>';

                    for (let p3 = 0; p3 < 4; p3++) {
                        const tr = storageTileRect(i3, p3);
                        // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                        const label = getNicLabel(p3 + 3);
                        // Center text vertically if label is 11 characters or less, otherwise stagger
                        const textY3 = (label.length <= 11) ? (tr.y + 23) : ((p3 % 2 === 0) ? (tr.y + 18) : (tr.y + 28));
                        svg3 += '<rect x="' + tr.x + '" y="' + tr.y + '" width="' + tr.w + '" height="' + tr.h + '" rx="8" fill="rgba(139,92,246,0.25)" stroke="rgba(139,92,246,0.65)" />';
                        svg3 += '<text x="' + (tr.x + tr.w / 2) + '" y="' + textY3 + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(label) + '</text>';
                    }
                }

                // Edges
                const laneBaseY = nodeY + nodeH + 26;
                const laneGap = 18;
                const midXOffsets = [0, 10, -6, 6, -18, 18];
                for (let e3 = 0; e3 < edges.length; e3++) {
                    const ed = edges[e3];
                    const st = subnetStyles[ed.subnet - 1];
                    const a = storagePortPos(ed.a.n, ed.a.p);
                    var b = storagePortPos(ed.b.n, ed.b.p);

                    // Assign each subnet a dedicated lane to avoid overlap.
                    const busY = laneBaseY + (ed.lane * laneGap);
                    const midX = ((a.x + b.x) / 2) + (midXOffsets[ed.lane] || 0);
                    const d = pathBetween(a, b, busY, midX);

                    const stroke3 = subnetColor3(ed.subnet);
                    svg3 += '<path d="' + d + '" fill="none" stroke="' + stroke3 + '" stroke-width="2.6" opacity="' + st.opacity + '"' + (st.dash ? (' stroke-dasharray="' + st.dash + '"') : '') + ' />';

                    // Subnet label on its own lane for readability
                    svg3 += '<text x="' + midX + '" y="' + (busY - 6) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Subnet ' + ed.subnet + '</text>';
                }

                svg3 += '</svg>';

                // Legend
                const subnetExamples3 = {
                    1: getStorageSubnetCidr(state, 1, '10.0.1.0/24'),
                    2: getStorageSubnetCidr(state, 2, '10.0.2.0/24'),
                    3: getStorageSubnetCidr(state, 3, '10.0.3.0/24'),
                    4: getStorageSubnetCidr(state, 4, '10.0.4.0/24'),
                    5: getStorageSubnetCidr(state, 5, '10.0.5.0/24'),
                    6: getStorageSubnetCidr(state, 6, '10.0.6.0/24')
                };
                const legendTitle3 = hasCustomStorageSubnets(state) ? 'Storage subnets (custom)' : 'Storage subnets (conceptual)';
                const legendNote3 = getStorageSubnetNote(state, "CIDRs shown are an extrapolated example based on Microsoft Learn's 4-node switchless storage intent pattern (same logic, fewer node pairs). Use your own addressing plan.");

                const legend = '<div class="switchless-diagram__legend">'
                    + '<div class="switchless-diagram__legend-title">' + legendTitle3 + '</div>'
                    + '<div class="switchless-diagram__legend-grid">'
                    + subnetStyles.map(function(st, idx) {
                        const num = idx + 1;
                        const edge = edges.filter(function(e) { return e.subnet === num; })[0];
                        const pair = edge ? edge.pair : '';
                        const ex = subnetExamples3[num] ? (' — ' + subnetExamples3[num]) : '';
                        // Use inline SVG line preview with the same per-subnet color.
                        const preview = ''
                            + '<svg width="56" height="10" viewBox="0 0 56 10" aria-hidden="true">'
                            + '<line x1="0" y1="5" x2="56" y2="5" stroke="' + subnetColor3(num) + '" stroke-width="2" ' + (st.dash ? ('stroke-dasharray="' + st.dash + '"') : '') + ' opacity="' + st.opacity + '" />'
                            + '</svg>';
                        return '<div class="switchless-diagram__legend-item">'
                            + preview
                            + '<span class="switchless-diagram__legend-text">Subnet ' + num + (pair ? (' — ' + escapeHtml(pair)) : '') + (ex ? (' <span style="color:var(--text-secondary)">' + escapeHtml(ex.trim()) + '</span>') : '') + '</span>'
                            + '</div>';
                    }).join('')
                    + '</div>'
                    + '<div class="switchless-diagram__note">Note: This diagram shows storage connectivity only (RDMA). ' + legendNote3 + '</div>'
                    + '</div>';

                const foot3 = '<div style="margin-top:0.5rem; color:var(--text-secondary);">'
                    + 'Reference pattern (3-node switchless dual-TOR dual-link): '
                    + '<a href="' + REF_3NODE_SWITCHLESS + '" target="_blank" rel="noopener">Microsoft Learn</a>'
                    + '</div>';

                return '<div class="switchless-diagram">' + intro3 + svg3 + legend + foot3 + '</div>';
            }

            // Special-case: detailed 4-node switchless storage connectivity (SMB1-6, 12 subnets)
            if (n === 4) {
                const REF_4NODE_SWITCHLESS = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/four-node-switchless-two-switches-two-links?view=azloc-2511';

                const svgW4 = 1220;
                const svgH4 = 700 + slMgmtVnicH;

                // Node panels (single row)
                const nodeW4 = 260;
                const nodeH4 = 270 + slMgmtVnicH;
                const nodeY4 = 110;
                const nodeX4 = [60, 340, 620, 900];

                // Shared helper: prefer wizard adapter names if available; else use NIC 1/NIC 2.
                function getNicLabel4(idx1Based) {
                    return getPortCustomName(state, idx1Based, 'nic');
                }

                function renderSetTeam4(nodeLeft, nodeTop) {
                    const setW = 210;
                    const setH = 62;
                    const setX = nodeLeft + (nodeW4 - setW) / 2;
                    const setY = nodeTop + 78 + slMgmtVnicH;

                    const nicW = 70;
                    const nicH = 34;
                    const gap = 14;
                    const nic1X = setX + 18;
                    const nic2X = nic1X + nicW + gap;
                    const nicY = setY + 18;

                    let out = '';
                    out += renderMgmtVnicSl(nodeLeft + nodeW4 / 2, nodeTop + 50);
                    out += '<text x="' + (nodeLeft + nodeW4 / 2) + '" y="' + (nodeTop + 62 + slMgmtVnicH) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">Mgmt + Compute intent</text>';
                    out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="12" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="6 4" />';
                    out += '<text x="' + (setX + setW / 2) + '" y="' + (setY + 14) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">SET (vSwitch)</text>';

                    function nicTile(x, y, label, idx) {
                        let t = '';
                        // Center text vertically if label is 11 characters or less, otherwise stagger
                        const textY = (label.length <= 11) ? (y + 21) : ((idx % 2 === 0) ? (y + 16) : (y + 26));
                        t += '<rect x="' + x + '" y="' + y + '" width="' + nicW + '" height="' + nicH + '" rx="8" fill="rgba(0,120,212,0.20)" stroke="rgba(0,120,212,0.55)" />';
                        t += '<text x="' + (x + nicW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(label) + '</text>';
                        return t;
                    }

                    out += nicTile(nic1X, nicY, getNicLabel4(1), 0);
                    out += nicTile(nic2X, nicY, getNicLabel4(2), 1);
                    return out;
                }

                // Storage intent group (6 RDMA ports per node)
                const storageGroupW4 = 240;
                const storageGroupH4 = 118;
                const storageTileW4 = 46;
                const storageTileH4 = 38;
                const storageTileGapX4 = 12;
                const storageTileGapY4 = 10;

                function storageGroupRect4(nodeIdx) {
                    const nodeLeft = nodeX4[nodeIdx];
                    const x = nodeLeft + (nodeW4 - storageGroupW4) / 2;
                    const y = nodeY4 + 150 + slMgmtVnicH;
                    return { x: x, y: y, w: storageGroupW4, h: storageGroupH4 };
                }

                function storageTileRect4(nodeIdx, portIdx) {
                    // 6 tiles: 3 columns x 2 rows (SMB1..SMB6)
                    const g = storageGroupRect4(nodeIdx);
                    const cols = 3;
                    const col = portIdx % cols;
                    const row = Math.floor(portIdx / cols);

                    const totalW = (storageTileW4 * cols) + (storageTileGapX4 * (cols - 1));
                    const startX = g.x + (g.w - totalW) / 2;
                    let x = startX + (col * (storageTileW4 + storageTileGapX4));
                    // Stagger the second row so SMB4-6 aren't perfectly vertically aligned
                    // with SMB1-3. This reduces stacked vertical routing segments.
                    if (row === 1) {
                        const stagger = (storageTileW4 + storageTileGapX4) / 2;
                        x += stagger;
                        // Keep within the group bounds.
                        const maxX = g.x + g.w - storageTileW4;
                        if (x > maxX) x -= stagger;
                    }
                    const y = g.y + 32 + (row * (storageTileH4 + storageTileGapY4));
                    return { x: x, y: y, w: storageTileW4, h: storageTileH4 };
                }

                function storagePortPos4(nodeIdx, portIdx) {
                    const r = storageTileRect4(nodeIdx, portIdx);
                    return { x: r.x + (r.w / 2), y: r.y + r.h };
                }

                const intro4 = ''
                    + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                    + '<strong style="color:var(--text-primary);">Storage Network ATC intent</strong> (switchless) — storage connectivity only.'
                    + '<br>'
                    + '4-node switchless commonly uses <strong style="color:var(--text-primary);">8 physical ports per node</strong>: two for <strong style="color:var(--text-primary);">Mgmt+Compute (SET team)</strong> plus <strong style="color:var(--text-primary);">6 RDMA storage ports</strong> (commonly named SMB1–SMB6).'
                    + '<br>'
                    + 'Storage uses <strong style="color:var(--text-primary);">12 storage networks</strong> (two per node-pair).'
                    + '</div>';

                // 12 subnet styles (no new colors; vary dash/opacity)
                const subnetStyles4 = [
                    { id: 'S1', dash: '', opacity: 0.95 },
                    { id: 'S2', dash: '', opacity: 0.95 },
                    { id: 'S3', dash: '', opacity: 0.95 },
                    { id: 'S4', dash: '', opacity: 0.95 },
                    { id: 'S5', dash: '', opacity: 0.92 },
                    { id: 'S6', dash: '', opacity: 0.92 },
                    { id: 'S7', dash: '', opacity: 0.85 },
                    { id: 'S8', dash: '', opacity: 0.85 },
                    { id: 'S9', dash: '', opacity: 0.85 },
                    { id: 'S10', dash: '', opacity: 0.85 },
                    { id: 'S11', dash: '', opacity: 0.85 },
                    { id: 'S12', dash: '', opacity: 0.85 }
                ];

                function subnetColor4(subnetNumber) {
                    // Use a clearly distinguishable palette (12 hues) so each subnet is easy to trace.
                    // Keep saturation/lightness slightly muted to fit the report's dark theme.
                    const idx = Math.max(1, Math.min(12, subnetNumber)) - 1;
                    const hues = [205, 235, 265, 295, 325, 355, 25, 55, 85, 115, 145, 175];
                    const h = hues[idx % hues.length];
                    return 'hsla(' + h + ', 78%, 62%, 0.95)';
                }

                // Port/subnet mapping: two subnets per node-pair.
                // Each node has 3 peers; dual-link means 6 RDMA ports and each SMB port maps to exactly one peer.
                const edges4 = [
                    // Node1 <-> Node2
                    { subnet: 1, a: { n: 0, p: 0 }, b: { n: 1, p: 0 }, pair: 'Node1↔Node2', lane: 0 },
                    { subnet: 2, a: { n: 0, p: 1 }, b: { n: 1, p: 1 }, pair: 'Node1↔Node2', lane: 1 },
                    // Node1 <-> Node3
                    { subnet: 3, a: { n: 0, p: 2 }, b: { n: 2, p: 0 }, pair: 'Node1↔Node3', lane: 2 },
                    { subnet: 4, a: { n: 0, p: 3 }, b: { n: 2, p: 1 }, pair: 'Node1↔Node3', lane: 3 },
                    // Node1 <-> Node4
                    { subnet: 5, a: { n: 0, p: 4 }, b: { n: 3, p: 0 }, pair: 'Node1↔Node4', lane: 4 },
                    { subnet: 6, a: { n: 0, p: 5 }, b: { n: 3, p: 1 }, pair: 'Node1↔Node4', lane: 5 },
                    // Node2 <-> Node3
                    { subnet: 7, a: { n: 1, p: 2 }, b: { n: 2, p: 2 }, pair: 'Node2↔Node3', lane: 6 },
                    { subnet: 8, a: { n: 1, p: 3 }, b: { n: 2, p: 3 }, pair: 'Node2↔Node3', lane: 7 },
                    // Node2 <-> Node4
                    { subnet: 9, a: { n: 1, p: 4 }, b: { n: 3, p: 2 }, pair: 'Node2↔Node4', lane: 8 },
                    { subnet: 10, a: { n: 1, p: 5 }, b: { n: 3, p: 3 }, pair: 'Node2↔Node4', lane: 9 },
                    // Node3 <-> Node4
                    { subnet: 11, a: { n: 2, p: 4 }, b: { n: 3, p: 4 }, pair: 'Node3↔Node4', lane: 10 },
                    { subnet: 12, a: { n: 2, p: 5 }, b: { n: 3, p: 5 }, pair: 'Node3↔Node4', lane: 11 }
                ];

                function pathBetween4Clean(a, b, busY, midX) {
                    // Clean orthogonal routing:
                    // 1) straight down from each SMB tile to its lane,
                    // 2) horizontal on the lane,
                    // 3) straight up to the other SMB tile.
                    return 'M ' + a.x + ' ' + a.y
                        + ' L ' + a.x + ' ' + busY
                        + ' L ' + midX + ' ' + busY
                        + ' L ' + b.x + ' ' + busY
                        + ' L ' + b.x + ' ' + b.y;
                }

                let svg4 = '';
                svg4 += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW4 + ' ' + svgH4 + '" role="img" aria-label="4-node switchless storage connectivity diagram">';
                svg4 += '<defs>'
                    + '<linearGradient id="swg4" x1="0" y1="0" x2="1" y2="1">'
                    + '<stop offset="0%" stop-color="rgba(0,120,212,0.85)" />'
                    + '<stop offset="100%" stop-color="rgba(139,92,246,0.85)" />'
                    + '</linearGradient>'
                    + '</defs>';

                // Intent container
                svg4 += '<rect x="35" y="55" width="' + (svgW4 - 70) + '" height="' + (svgH4 - 90) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                svg4 += '<text x="' + (svgW4 / 2) + '" y="42" text-anchor="middle" font-size="13" fill="var(--text-secondary)">Storage Network ATC intent — Switchless=true, ' + escapeHtml(autoIpLabel(state.storageAutoIp)) + '</text>';

                // Nodes
                for (let i4 = 0; i4 < 4; i4++) {
                    const x4 = nodeX4[i4];
                    svg4 += '<rect x="' + x4 + '" y="' + nodeY4 + '" width="' + nodeW4 + '" height="' + nodeH4 + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                    svg4 += '<text x="' + (x4 + nodeW4 / 2) + '" y="' + (nodeY4 + 34) + '" text-anchor="middle" font-size="16" fill="var(--text-primary)" font-weight="700">' + escapeHtml(getNodeLabel(i4)) + '</text>';
                    svg4 += renderSetTeam4(x4, nodeY4);

                    const sg4 = storageGroupRect4(i4);
                    svg4 += '<rect x="' + sg4.x + '" y="' + sg4.y + '" width="' + sg4.w + '" height="' + sg4.h + '" rx="12" fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                    svg4 += '<text x="' + (sg4.x + sg4.w / 2) + '" y="' + (sg4.y + 16) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Storage intent (RDMA)</text>';

                    for (let p4 = 0; p4 < 6; p4++) {
                        const tr4 = storageTileRect4(i4, p4);
                        // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                        const lbl4 = getNicLabel4(p4 + 3);
                        // Center text vertically if label is 11 characters or less, otherwise stagger
                        const textY4 = (lbl4.length <= 11) ? (tr4.y + 23) : ((p4 % 2 === 0) ? (tr4.y + 18) : (tr4.y + 28));
                        svg4 += '<rect x="' + tr4.x + '" y="' + tr4.y + '" width="' + tr4.w + '" height="' + tr4.h + '" rx="8" fill="rgba(139,92,246,0.25)" stroke="rgba(139,92,246,0.65)" />';
                        svg4 += '<text x="' + (tr4.x + tr4.w / 2) + '" y="' + textY4 + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(lbl4) + '</text>';
                    }
                }

                // Edges (12 dedicated lanes)
                const laneBaseY4 = nodeY4 + nodeH4 + 30;
                const laneGap4 = 20;
                const midXOffsets4 = [0, 14, -14, 18, -22, 24, -30, 32, -40, 42, -48, 50];
                for (let e4 = 0; e4 < edges4.length; e4++) {
                    const ed4 = edges4[e4];
                    const st4 = subnetStyles4[ed4.subnet - 1];
                    const a4 = storagePortPos4(ed4.a.n, ed4.a.p);
                    const b4 = storagePortPos4(ed4.b.n, ed4.b.p);
                    const busY4 = laneBaseY4 + (ed4.lane * laneGap4);
                    const midX4 = ((a4.x + b4.x) / 2) + (midXOffsets4[ed4.lane] || 0);

                    const d4 = pathBetween4Clean(a4, b4, busY4, midX4);

                    const stroke4 = subnetColor4(ed4.subnet);
                    svg4 += '<path d="' + d4 + '" fill="none" stroke="' + stroke4 + '" stroke-width="2.6" opacity="' + st4.opacity + '"' + (st4.dash ? (' stroke-dasharray="' + st4.dash + '"') : '') + ' />';
                    svg4 += '<text x="' + midX4 + '" y="' + (busY4 - 6) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Subnet ' + ed4.subnet + '</text>';
                }

                svg4 += '</svg>';

                // Legend
                const legendTitle4 = hasCustomStorageSubnets(state) ? 'Storage subnets (custom)' : 'Storage subnets (conceptual)';
                const legendNote4 = getStorageSubnetNote(state, "CIDRs shown are the example values from Microsoft Learn's 4-node switchless storage intent section; use your own addressing plan.");

                const legend4 = '<div class="switchless-diagram__legend">'
                    + '<div class="switchless-diagram__legend-title">' + legendTitle4 + '</div>'
                    + '<div class="switchless-diagram__legend-grid">'
                    + subnetStyles4.map(function(st, idx) {
                        const num = idx + 1;
                        const edge = edges4.filter(function(e) { return e.subnet === num; })[0];
                        const pair = edge ? edge.pair : '';
                        const ex4 = getStorageSubnetCidr(state, num, '10.0.' + num + '.0/24');
                        const preview = ''
                            + '<svg width="56" height="10" viewBox="0 0 56 10" aria-hidden="true">'
                            + '<line x1="0" y1="5" x2="56" y2="5" stroke="' + subnetColor4(num) + '" stroke-width="2" ' + (st.dash ? ('stroke-dasharray="' + st.dash + '"') : '') + ' opacity="' + st.opacity + '" />'
                            + '</svg>';
                        return '<div class="switchless-diagram__legend-item">'
                            + preview
                            + '<span class="switchless-diagram__legend-text">Subnet ' + num + (pair ? (' — ' + escapeHtml(pair)) : '') + ' <span style="color:var(--text-secondary)">— ' + escapeHtml(ex4) + '</span></span>'
                            + '</div>';
                    }).join('')
                    + '</div>'
                    + '<div class="switchless-diagram__note">Note: This diagram shows storage connectivity only (RDMA). ' + legendNote4 + '</div>'
                    + '</div>';

                const foot4 = '<div style="margin-top:0.5rem; color:var(--text-secondary);">'
                    + 'Reference pattern (4-node switchless dual-TOR dual-link): '
                    + '<a href="' + REF_4NODE_SWITCHLESS + '" target="_blank" rel="noopener">Microsoft Learn</a>'
                    + '</div>';

                return '<div class="switchless-diagram">' + intro4 + svg4 + legend4 + foot4 + '</div>';
            }

            // Generic (2-node): show storage-only full mesh concept with correct RDMA-port count.
            // RDMA ports per node for dual-link full mesh is 2*(n-1) (storage-only).
            // This is intentionally abstract because detailed subnet/port mapping is pattern-specific.
            const rdmaPerNode = 2 * (n - 1);
            const intro = '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                + '<strong style="color:var(--text-primary);">Storage Network ATC intent</strong> (switchless) — storage connectivity only (conceptual). '
                + 'Dual-link full mesh implies <strong style="color:var(--text-primary);">' + rdmaPerNode + ' RDMA storage ports per node</strong>.'
                + '</div>';

            // Layout presets (center points)
            let positions;
            if (n === 2) {
                positions = [
                    { x: 240, y: 170 },
                    { x: 560, y: 170 }
                ];
            } else {
                // 4 nodes
                positions = [
                    { x: 240, y: 120 },
                    { x: 560, y: 120 },
                    { x: 240, y: 270 },
                    { x: 560, y: 270 }
                ];
            }

            const boxW = 200;
            const boxH = 78;
            const portR2 = 4;
            const offsetPattern = [-14, 14, -28, 28, -42, 42, -56, 56];

            function boxFor(pos) {
                return {
                    left: pos.x - boxW / 2,
                    top: pos.y - boxH / 2,
                    right: pos.x + boxW / 2,
                    bottom: pos.y + boxH / 2,
                    cx: pos.x,
                    cy: pos.y
                };
            }

            const alloc = positions.map(function() { return { top: 0, right: 0, bottom: 0, left: 0 }; });
            function sideToward(i, j) {
                const dx = positions[j].x - positions[i].x;
                const dy = positions[j].y - positions[i].y;
                if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
                return dy >= 0 ? 'bottom' : 'top';
            }
            function opposite(side) {
                if (side === 'left') return 'right';
                if (side === 'right') return 'left';
                if (side === 'top') return 'bottom';
                return 'top';
            }
            function allocateAnchor(nodeIndex, side) {
                const b = boxFor(positions[nodeIndex]);
                const idx = alloc[nodeIndex][side] || 0;
                alloc[nodeIndex][side] = idx + 1;
                const off = offsetPattern[idx] !== undefined ? offsetPattern[idx] : (idx * 14);
                if (side === 'left') return { x: b.left, y: b.cy + off };
                if (side === 'right') return { x: b.right, y: b.cy + off };
                if (side === 'top') return { x: b.cx + off, y: b.top };
                return { x: b.cx + off, y: b.bottom };
            }

            const links = [];
            var ports = [];
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const s1 = sideToward(i, j);
                    const s2 = opposite(s1);
                    const a1 = allocateAnchor(i, s1);
                    var a2 = allocateAnchor(i, s1);
                    const b1 = allocateAnchor(j, s2);
                    var b2 = allocateAnchor(j, s2);
                    links.push({ x1: a1.x, y1: a1.y, x2: b1.x, y2: b1.y, dash: '' });
                    links.push({ x1: a2.x, y1: a2.y, x2: b2.x, y2: b2.y, dash: '6 4' });
                    ports.push(a1, a2, b1, b2);
                }
            }

            const svgW = 800;
            const svgH = (n === 4) ? 380 : 300;
            let svg = '';
            svg += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" role="img" aria-label="Switchless storage connectivity diagram">';
            svg += '<defs>'
                + '<linearGradient id="swg" x1="0" y1="0" x2="1" y2="1">'
                + '<stop offset="0%" stop-color="rgba(0,120,212,0.85)" />'
                + '<stop offset="100%" stop-color="rgba(139,92,246,0.85)" />'
                + '</linearGradient>'
                + '</defs>';

            svg += '<rect x="35" y="45" width="' + (svgW - 70) + '" height="' + (svgH - 80) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
            svg += '<text x="' + (svgW / 2) + '" y="32" text-anchor="middle" font-size="13" fill="var(--text-secondary)">Storage Network ATC intent — Switchless=true, ' + escapeHtml(autoIpLabel(state.storageAutoIp)) + '</text>';

            for (let l = 0; l < links.length; l++) {
                const ln = links[l];
                svg += '<line x1="' + ln.x1 + '" y1="' + ln.y1 + '" x2="' + ln.x2 + '" y2="' + ln.y2 + '" stroke="url(#swg)" stroke-width="2" opacity="0.9"' + (ln.dash ? (' stroke-dasharray="' + ln.dash + '"') : '') + ' />';
            }

            for (let k = 0; k < n; k++) {
                var b = boxFor(positions[k]);
                const name = getNodeLabel(k);
                svg += '<rect x="' + b.left + '" y="' + b.top + '" width="' + boxW + '" height="' + boxH + '" rx="12" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                svg += '<text x="' + b.cx + '" y="' + (b.top + 28) + '" text-anchor="middle" font-size="14" fill="var(--text-primary)" font-weight="700">' + escapeHtml(name) + '</text>';
                svg += '<text x="' + b.cx + '" y="' + (b.top + 50) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">RDMA storage ports: ' + rdmaPerNode + '</text>';
            }

            for (let p = 0; p < ports.length; p++) {
                const pt = ports[p];
                svg += '<circle cx="' + pt.x + '" cy="' + pt.y + '" r="' + portR2 + '" fill="rgba(139,92,246,0.95)" stroke="rgba(0,0,0,0.35)" stroke-width="1" />';
            }
            svg += '</svg>';

            const foot = '<div style="margin-top:0.5rem; color:var(--text-secondary);">'
                + (n === 3 ? ('Reference pattern: <a href="' + REF_3NODE_SWITCHLESS + '" target="_blank" rel="noopener">Microsoft Learn</a>') : 'Reference patterns vary by topology; use Microsoft Learn guidance for detailed subnet/adapter mapping.')
                + '</div>';

            return '<div class="switchless-diagram">' + intro + svg + foot + '</div>';
        }

        // Scenario
        if (s.scenario === 'hyperconverged') {
            sections.push(block('Deployment Scenario',
                '<strong>Selected:</strong> ' + escapeHtml(formatScenario(s.scenario, s))
                + '<br><strong>Why it matters:</strong> Single-rack, consolidated compute/storage. Enables Low Capacity or Standard flows in this wizard.'
                + renderValidationInline(validations.byArea.Scenario)
            ));
        } else if (s.scenario === 'disconnected') {
            sections.push(block('Deployment Scenario',
                '<strong>Selected:</strong> ' + escapeHtml(formatScenario(s.scenario, s))
                + '<br><strong>Why it matters:</strong> Air-gapped deployments constrain outbound connectivity and management options.'
                + '<br><strong>Wizard logic:</strong> Disconnected mode disables cloud-specific selections that require internet access and restricts some scale choices.'
                + renderValidationInline(validations.byArea.Scenario)
            ));
        } else if (s.scenario === 'm365local') {
            sections.push(block('Deployment Scenario',
                '<strong>Selected:</strong> ' + escapeHtml(formatScenario(s.scenario, s))
                + '<br><strong>Why it matters:</strong> Microsoft 365 Local deployments are optimized for Microsoft 365 workloads with high availability requirements.'
                + '<br><strong>Wizard logic:</strong> Microsoft 365 Local requires a minimum of 9 physical nodes. Supports Standard scale configuration only.'
                + renderValidationInline(validations.byArea.Scenario)
            ));
        } else if (s.scenario === 'multirack') {
            sections.push(block('Deployment Scenario',
                '<strong>Selected:</strong> ' + escapeHtml(formatScenario(s.scenario, s))
                + '<br><strong>Why it matters:</strong> Multi-rack architectures have additional design requirements.'
                + '<br><strong>Wizard logic:</strong> The wizard stops and directs you to contact Microsoft for multi-rack requirements.'
                + renderValidationInline(validations.byArea.Scenario)
            ));
        } else {
            sections.push(block('Deployment Scenario',
                '<strong>Selected:</strong> ' + escapeHtml(formatScenario(s.scenario, s))
                + renderValidationInline(validations.byArea.Scenario)
            ));
        }

        // Azure Cloud + Local Instance Region (or Autonomous Cloud FQDN for disconnected)
        if (s.scenario === 'disconnected' && s.clusterRole) {
            const disconnectedNotes = [];
            disconnectedNotes.push('Disconnected operations use an Autonomous Cloud FQDN instead of a public Azure cloud endpoint.');
            disconnectedNotes.push('Cluster Role: ' + (s.clusterRole === 'management' ? 'Management Cluster' : 'Workload Cluster'));
            if (s.autonomousCloudFqdn) {
                disconnectedNotes.push('Autonomous Cloud FQDN: ' + s.autonomousCloudFqdn);
            }
            sections.push(block('Autonomous Cloud',
                '<strong>Cluster Role:</strong> ' + escapeHtml(s.clusterRole === 'management' ? 'Management Cluster' : 'Workload Cluster')
                + '<br><strong>Autonomous Cloud FQDN:</strong> ' + escapeHtml(s.autonomousCloudFqdn || 'Not configured')
                + (s.clusterRole === 'management' && (s.applianceIp1 || s.applianceIp2)
                    ? '<br><strong>Appliance IPs:</strong> '
                      + (s.applianceIp1 ? 'Ingress vNIC: ' + escapeHtml(s.applianceIp1) : '')
                      + (s.applianceIp1 && s.applianceIp2 ? ' &middot; ' : '')
                      + (s.applianceIp2 ? 'Mgmt vNIC: ' + escapeHtml(s.applianceIp2) : '')
                    : '')
                + list(disconnectedNotes)
                + renderValidationInline(validations.byArea.Cloud)
            ));
        } else {
            const cloudNotes = [];
            cloudNotes.push('Your Azure cloud selection determines which endpoints, compliance boundaries, and region catalogs apply.');
            if (s.region === 'azure_commercial') {
                cloudNotes.push('Azure Local supported regions for Azure Public (per Microsoft) include: East US, South Central US, West Europe, Australia East, Southeast Asia, India Central, Canada Central, Japan East.');
                cloudNotes.push('The wizard limits Azure Local region choices to that supported catalog for your cloud selection.');
            } else if (s.region === 'azure_government') {
                cloudNotes.push('Azure Local supported regions for Azure Government (per Microsoft) include: US Gov Virginia.');
                cloudNotes.push('The wizard limits Azure Local region choices to that supported catalog for your cloud selection.');
            } else if (s.region === 'azure_china') {
                cloudNotes.push('Azure China support is not covered by the Azure Public/Government region lists referenced in this report; consult the latest Azure Local system requirements for your sovereign cloud guidance.');
            }
            sections.push(block('Azure Cloud & Azure Local Region',
                '<strong>Azure Cloud:</strong> ' + escapeHtml(formatCloud(s.region))
                + '<br><strong>Azure Local Instance Region:</strong> ' + escapeHtml(formatLocalInstanceRegion(s.localInstanceRegion))
                + list(cloudNotes)
                + renderValidationInline(validations.byArea.Cloud)
            ));
        }

        // Scale + Nodes
        const scaleNotes = [];
        if (s.scale === 'low_capacity') {
            scaleNotes.push('Low Capacity targets smaller deployments and limits certain network intent combinations.');
        }
        if (s.scale === 'rack_aware') {
            scaleNotes.push('Rack Aware is designed for multi-room / split-rack node placement; node counts are constrained to supported sets in the wizard.');
        }
        if (s.scenario === 'disconnected') {
            scaleNotes.push('Disconnected mode typically enforces Standard scale constraints for supportability and operational simplicity.');
        }
        sections.push(block('Scale & Nodes',
            '<strong>Scale:</strong> ' + escapeHtml(formatScale(s.scale))
            + '<br><strong>Nodes:</strong> <span class="summary-value mono">' + escapeHtml(s.nodes || '-') + '</span>'
            + (scaleNotes.length ? list(scaleNotes) : '')
            + renderValidationInline(validations.byArea.ScaleNodes)
        ));

        // Storage + Ports
        const storageNotes = [];
        if (s.storage === 'switchless') {
            storageNotes.push('Switchless storage typically reduces the number of storage networks and impacts intent options in the wizard.');
            storageNotes.push('Planning note: switchless storage is generally intended for smaller clusters; larger clusters require switched storage connectivity for supportability and scale-out workflows.');

            // For the conditional 3-node low-capacity switchless flow, call out the selected wiring pattern.
            const nodeCountForLinkMode = parseInt(s.nodes, 10);
            if (!isNaN(nodeCountForLinkMode) && nodeCountForLinkMode === 3 && s.scale === 'low_capacity' && s.switchlessLinkMode) {
                const lm = String(s.switchlessLinkMode);
                storageNotes.push('Switchless link mode selected in the wizard: ' + (lm === 'single_link' ? 'Single-Link (one link per node-pair, no redundancy).' : 'Dual-Link (two links per node-pair, redundant).'));
            }
        }
        if (String(s.ports) === '4') {
            storageNotes.push('With 4 ports, the wizard disables Custom intent (insufficient ports for flexible mapping in this design).');
        }
        sections.push(block('Storage & Ports',
            '<strong>Storage:</strong> ' + escapeHtml(s.storage ? (s.storage.charAt(0).toUpperCase() + s.storage.slice(1)) : '-')
            + ((s.storage === 'switchless' && parseInt(s.nodes, 10) === 3 && s.scale === 'low_capacity' && s.switchlessLinkMode)
                ? ('<br><strong>Switchless link mode:</strong> ' + escapeHtml(String(s.switchlessLinkMode) === 'single_link' ? 'Single-Link' : 'Dual-Link'))
                : '')
            + '<br><strong>Ports per node:</strong> <span class="summary-value mono">' + escapeHtml(s.ports || '-') + '</span>'
            + (storageNotes.length ? list(storageNotes) : '')
            + renderValidationInline(validations.byArea.StoragePorts)
        ));

        if (s.storage === 'switchless') {
            sections.push(block('Switchless Storage Connectivity (Diagram)',
                renderSwitchlessStorageDiagram(s)
            ));
        }

        if (s.scale === 'rack_aware') {
            sections.push(block('Rack Aware TOR Architecture (Diagram)',
                renderRackAwareTorArchitectureDiagram(s)
            ));
        } else if (s.storage === 'switched' || s.nodes === '1') {
            // Single-node clusters (s.nodes === '1') have no storage connectivity but should still show a network diagram
            sections.push(block(s.nodes === '1' ? 'Network Connectivity (Diagram)' : 'Switched Connectivity (Diagram)',
                renderSwitchedIntentDiagram(s)
            ));
        }

        // Disaggregated host networking diagram
        if (s.architecture === 'disaggregated') {
            sections.push(block('Disaggregated Host Networking (Diagram)',
                renderDisaggregatedHostNetworkingDiagram(s)
            ));
            sections.push(block('Leaf & Spine Fabric Requirements',
                renderDisaggregatedFabricRequirements(s)
            ));
        }

        // Intent + Mapping
        const intentNotes = [];
        if (s.intent === 'all_traffic') intentNotes.push('Fully converged simplifies adapter mapping but combines all traffic types into one SET team.');
        if (s.intent === 'mgmt_compute') intentNotes.push('Splits storage traffic away from mgmt/compute to reduce contention and isolate storage behavior.');
        if (s.intent === 'compute_storage') intentNotes.push('Keeps management isolated while converging compute+storage; useful when mgmt isolation is prioritized.');
        if (s.intent === 'custom') {
            intentNotes.push('Custom intent allows manual adapter assignment.');
            intentNotes.push('Planning note: custom intents are typically used when you need an additional compute intent (for example, backup, remote storage, or workload separation).');
            if (!s.customIntentConfirmed) intentNotes.push('Custom mapping was not confirmed in the wizard (report generation is normally gated on confirmation).');
        }
        sections.push(block('Traffic Intent & Adapter Mapping',
            '<strong>Intent:</strong> ' + escapeHtml(formatIntent(s.intent))
            + (intentNotes.length ? list(intentNotes) : '')
            + renderValidationInline(validations.byArea.Intent)
        ));

        // Outbound / Arc / Proxy
        const outboundNotes = [];
        if (s.outbound === 'private') {
            outboundNotes.push('Private outbound assumes controlled egress (for example, via your firewall/proxy) and the wizard forces Arc Gateway + explicit proxy behavior.');
            outboundNotes.push('With Arc Gateway, the node-side Arc proxy establishes a secure HTTPS tunnel to an Azure-hosted Arc Gateway public endpoint, which reduces the number of outbound destinations you typically need to allow compared to managing many individual Azure service endpoints.');
            outboundNotes.push('Not all traffic types are handled the same way: OS HTTPS traffic intended for Microsoft-managed endpoints can be routed via Arc proxy; OS HTTP and non-Microsoft HTTPS traffic typically must traverse your enterprise proxy/firewall based on your organization\'s allowlists.');
            outboundNotes.push('Implementation note: proxy bypass lists usually need to include at least the node IPs, cluster IP, and the infrastructure IPs/subnet so internal cluster traffic (and infrastructure services) do not get forced through the proxy path.');
            outboundNotes.push('Proxy planning note: Azure Local guidance emphasizes configuring proxy settings before registering nodes to Azure Arc, and keeping proxy configuration consistent across OS proxy components (WinINET, WinHTTP, and environment variables).');
        } else if (s.outbound === 'public') {
            outboundNotes.push('Public outbound allows direct access to required endpoints (subject to firewall allow-listing).');
            outboundNotes.push('Even with public outbound, Arc-related components still require outbound HTTPS to Microsoft endpoints; ensure your firewall policy allows the required destinations.');
        }

        // Generate proxy bypass string when proxy is enabled
        let proxyBypassHtml = '';
        if (s.proxy === 'proxy') {
            const bypassItems = [];

            // Always add localhost and loopback
            bypassItems.push('localhost');
            bypassItems.push('127.0.0.1');

            // Add node names if available
            if (s.nodeSettings && s.nodeSettings.length) {
                s.nodeSettings.forEach(function(node, idx) {
                    if (node && node.name) {
                        bypassItems.push(node.name);
                    }
                });
            }

            // Add node IPs if available
            if (s.nodeSettings && s.nodeSettings.length) {
                s.nodeSettings.forEach(function(node, idx) {
                    if (node && node.ipCidr) {
                        // Extract IP from CIDR notation
                        const ip = node.ipCidr.split('/')[0];
                        if (ip) bypassItems.push(ip);
                    }
                });
            }

            // Add domain name wildcard if AD domain is specified
            if (s.adDomain) {
                bypassItems.push('*.' + s.adDomain);
            }

            // Add infrastructure subnet as wildcard
            if (s.infraCidr) {
                const infraSubnetWildcard = convertCidrToWildcard(s.infraCidr);
                if (infraSubnetWildcard) {
                    bypassItems.push(infraSubnetWildcard);
                }
            }

            // Add Private Endpoint bypass entries if PE is enabled
            if (s.privateEndpoints === 'pe_enabled' && s.privateEndpointsList && s.privateEndpointsList.length > 0) {
                s.privateEndpointsList.forEach(function(peKey) {
                    const info = PRIVATE_ENDPOINT_INFO[peKey];
                    if (info && info.proxyBypass) {
                        info.proxyBypass.forEach(function(bypass) {
                            if (bypassItems.indexOf(bypass) === -1) {
                                bypassItems.push(bypass);
                            }
                        });
                    }
                });
            }

            proxyBypassHtml = '<div style="margin-top: 1rem; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-left: 4px solid var(--accent-blue); border-radius: 4px;">'
                + '<strong style="color: var(--accent-blue);">Minimum Proxy Bypass String:</strong>'
                + '<div style="margin-top: 0.5rem; font-family: monospace; background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 4px; word-break: break-all;">'
                + escapeHtml(bypassItems.join(','))
                + '</div>'
                + '<p style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">Add this bypass string to your Arc registration script. You may also need to add a cluster name and any additional internal resources.</p>'
                + '</div>';
        }

        // Generate Private Endpoints section HTML
        let privateEndpointsHtml = '';
        if (s.privateEndpoints === 'pe_enabled' && s.privateEndpointsList && s.privateEndpointsList.length > 0) {
            let peItems = '';
            s.privateEndpointsList.forEach(function(peKey) {
                const info = PRIVATE_ENDPOINT_INFO[peKey];
                if (info) {
                    peItems += '<div style="padding: 0.75rem; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 8px; margin-bottom: 0.5rem;">'
                        + '<div style="display: flex; align-items: flex-start; gap: 0.75rem;">'
                        + '<span style="font-size: 1.2rem;">' + info.icon + '</span>'
                        + '<div style="flex: 1;">'
                        + '<strong style="color: var(--text-primary);">' + escapeHtml(info.name) + '</strong>'
                        + '<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;"><code>' + escapeHtml(info.fqdn) + '</code></div>'
                        + '<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">Private Link: <code>' + escapeHtml(info.privateLink) + '</code></div>'
                        + '<div style="font-size: 0.8rem; color: var(--warning); margin-top: 4px;">' + escapeHtml(info.notes) + '</div>';

                    // Add considerations if available
                    if (info.considerations && info.considerations.length > 0) {
                        peItems += '<div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(0,0,0,0.15); border-radius: 4px;">'
                            + '<strong style="font-size: 0.8rem; color: var(--accent-blue);">Considerations:</strong>'
                            + '<ul style="margin: 0.25rem 0 0 1rem; padding: 0; font-size: 0.8rem; color: var(--text-secondary);">';
                        info.considerations.forEach(function(consideration) {
                            peItems += '<li>' + escapeHtml(consideration) + '</li>';
                        });
                        peItems += '</ul></div>';
                    }

                    // Add proxy bypass examples if available (when Arc Gateway is enabled OR proxy is enabled)
                    const showBypassInfo = s.arc === 'arc_gateway' || s.proxy === 'proxy';
                    if (showBypassInfo && info.proxyBypass && info.proxyBypass.length > 0) {
                        peItems += '<div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(59, 130, 246, 0.1); border-radius: 4px;">'
                            + '<strong style="font-size: 0.8rem; color: var(--accent-blue);">Proxy Bypass Examples:</strong>'
                            + '<div style="font-family: monospace; font-size: 0.8rem; margin-top: 0.25rem; word-break: break-all;">' + escapeHtml(info.proxyBypass.join(', ')) + '</div>'
                            + '</div>';
                    }

                    // Add documentation link if available
                    if (info.docUrl) {
                        peItems += '<div style="margin-top: 0.5rem;">'
                            + '<a href="' + escapeHtml(info.docUrl) + '" target="_blank" style="font-size: 0.8rem; color: var(--accent-blue); text-decoration: none;">📚 View documentation ↗</a>'
                            + '</div>';
                    }

                    peItems += '</div>'
                        + '</div>'
                        + '</div>';
                }
            });

            // Generate PE bypass additions with actual proxy bypass examples
            const peBypassItems = [];
            s.privateEndpointsList.forEach(function(peKey) {
                const info = PRIVATE_ENDPOINT_INFO[peKey];
                if (info && info.proxyBypass) {
                    info.proxyBypass.forEach(function(bypass) {
                        if (peBypassItems.indexOf(bypass) === -1) {
                            peBypassItems.push(bypass);
                        }
                    });
                } else if (info && info.privateLink) {
                    peBypassItems.push('*.' + info.privateLink);
                }
            });

            // Show bypass info when Arc Gateway is enabled OR proxy is enabled
            const showBypassSection = s.arc === 'arc_gateway' || s.proxy === 'proxy';
            const peDescription = showBypassSection
                ? 'The following Azure services will use Private Link endpoints. Add these FQDNs to your proxy bypass list and configure DNS to resolve them to private IPs.'
                : 'The following Azure services will use Private Link endpoints. Configure DNS to resolve them to private IPs.';

            privateEndpointsHtml = '<div style="margin-top: 1.5rem; padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px;">'
                + '<h4 style="margin: 0 0 1rem 0; color: var(--success);">🔒 Private Endpoints Configuration</h4>'
                + '<p style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.9rem;">' + peDescription + '</p>'
                + peItems
                + (showBypassSection && peBypassItems.length > 0 ? (
                    '<div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0,0,0,0.2); border-radius: 6px;">'
                    + '<strong style="color: var(--accent-blue); font-size: 0.9rem;">Add to Proxy Bypass List:</strong>'
                    + '<div style="font-family: monospace; font-size: 0.85rem; margin-top: 0.5rem; word-break: break-all;">' + escapeHtml(peBypassItems.join(',')) + '</div>'
                    + '</div>'
                ) : '')
                + '</div>';
        } else if (s.privateEndpoints === 'pe_disabled') {
            privateEndpointsHtml = '<div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 6px;">'
                + '<strong>Private Endpoints:</strong> <span style="color: var(--text-secondary);">Not configured</span>'
                + '</div>';
        }

        sections.push(block('Outbound, Arc, Proxy & Private Endpoints',
            '<strong>Outbound:</strong> ' + escapeHtml(formatOutbound(s.outbound))
            + '<br><strong>Arc Gateway:</strong> ' + escapeHtml(s.arc === 'arc_gateway' ? 'Enabled (Recommended)' : (s.arc === 'no_arc' ? 'Disabled' : '-'))
            + '<br><strong>Proxy:</strong> ' + escapeHtml(s.proxy === 'no_proxy' ? 'Disabled' : (s.proxy ? 'Enabled' : '-'))
            + '<br><strong>Private Endpoints:</strong> ' + escapeHtml(s.privateEndpoints === 'pe_enabled' ? 'Enabled (' + (s.privateEndpointsList ? s.privateEndpointsList.length : 0) + ' services)' : (s.privateEndpoints === 'pe_disabled' ? 'Disabled' : '-'))
            + (function() {
                if (s.scenario === 'disconnected') {
                    return '<br><strong>Network Requirements:</strong> <a href="https://learn.microsoft.com/azure/azure-local/manage/disconnected-operations-network" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary);">Plan your network for disconnected operations</a>';
                }
                if (!s.arc && !s.localInstanceRegion) return '';
                const fwInfoHtml = getFirewallEndpointInfo(s);
                return '<br><strong>Firewall Allow List Endpoint Requirements:</strong> <a href="' + escapeHtml(fwInfoHtml.url) + '" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary);">' + escapeHtml(fwInfoHtml.label) + '</a>';
            })()
            + (outboundNotes.length ? list(outboundNotes) : '')
            + proxyBypassHtml
            + privateEndpointsHtml
            + renderValidationInline(validations.byArea.Outbound)
        ));

        // IP + Infra VLAN
        const mgmtNotes = [];
        mgmtNotes.push('Management IP strategy affects provisioning workflow and long-term operations.');
        mgmtNotes.push('Infrastructure VLAN selection ensures consistent reachability to Arc registration and management endpoints.');
        mgmtNotes.push('Planning note: management VLAN tagging (when required) must be configured on the physical adapters before Azure Arc registration; the deployment orchestrator carries this VLAN configuration into infrastructure VMs.');
        mgmtNotes.push('Planning note: the infrastructure IP pool is designed for cluster infrastructure services; size it with headroom if you expect additional services later.');
        sections.push(block('IP, Infrastructure Network & VLAN',
            '<strong>IP:</strong> ' + escapeHtml(s.ip ? (s.ip.charAt(0).toUpperCase() + s.ip.slice(1)) : '-')
            + '<br><strong>Infra VLAN:</strong> ' + escapeHtml(s.infraVlan === 'custom' ? 'Custom VLAN' : (s.infraVlan === 'default' ? 'Default VLAN' : (s.infraVlan || '-')))
            + (s.infraVlan === 'custom' ? ('<br><strong>Infra VLAN ID:</strong> <span class="summary-value mono">' + escapeHtml(s.infraVlanId || '-') + '</span>') : '')
            + (s.infraCidr ? ('<br><strong>Infra Network:</strong> <span class="summary-value mono">' + escapeHtml(s.infraCidr) + '</span>') : '')
            + (s.infra && s.infra.start && s.infra.end ? ('<br><strong>Infra Range:</strong> <span class="summary-value mono">' + escapeHtml(s.infra.start + ' - ' + s.infra.end) + '</span>') : '')
            + list(mgmtNotes)
            + (function() {
                // Embed the same Infrastructure Subnet Utilisation bar that
                // ships in the PPT export, when we have a valid CIDR + the
                // shared SVG builder has been loaded.
                if (!s.infraCidr) return '';
                if (!window.OdinSubnetUtil || typeof window.OdinSubnetUtil.buildInfraSubnetBarSvg !== 'function') return '';
                const svg = window.OdinSubnetUtil.buildInfraSubnetBarSvg(s, { width: 1600, height: 320 });
                if (!svg) return '';
                return '<div style="margin-top:1rem; padding:0.75rem; background:rgba(11, 18, 32, 0.6); border:1px solid var(--glass-border); border-radius:8px;">' + svg + '</div>';
            })()
            + renderValidationInline(validations.byArea.Infrastructure)
        ));

        // Identity + DNS
        const idNotes = [];
        if (s.activeDirectory === 'azure_ad') {
            idNotes.push('Domain-joined deployments require correct AD DNS resolution and domain membership planning.');
        }
        if (s.activeDirectory === 'local_identity') {
            idNotes.push('Local Identity mode typically requires a local DNS zone for name resolution within the environment.');
        }
        if (s.dnsServers && s.dnsServers.length) {
            idNotes.push('Operational note: DNS settings are a critical dependency for deployment and ongoing management; ensure your chosen DNS resolvers remain reachable for the lifetime of the deployment.');
            idNotes.push('Operational note: Azure Local guidance states DNS server IPs used by nodes and infrastructure components are not supported to change after deployment, so treat DNS as a permanent design input.');
        }
        sections.push(block('Identity & DNS',
            '<strong>Identity:</strong> ' + escapeHtml(s.activeDirectory === 'azure_ad' ? 'Active Directory' : (s.activeDirectory === 'local_identity' ? 'Local Identity' : '-'))
            + (s.adDomain ? ('<br><strong>AD Domain:</strong> <span class="summary-value mono">' + escapeHtml(s.adDomain) + '</span>') : '')
            + (s.dnsServers && s.dnsServers.length ? ('<br><strong>DNS Servers:</strong> <span class="summary-value mono">' + escapeHtml(s.dnsServers.join(', ')) + '</span>') : '')
            + (s.localDnsZone ? ('<br><strong>Local DNS Zone:</strong> <span class="summary-value mono">' + escapeHtml(s.localDnsZone) + '</span>') : '')
            + (idNotes.length ? list(idNotes) : '')
            + renderValidationInline(validations.byArea.DNS)
        ));

        // SDN
        const sdnNotes = [];
        if (s.sdnFeatures && s.sdnFeatures.length) {
            sdnNotes.push('SDN features require a management model decision (Arc-managed vs on-prem tooling).');
        } else {
            sdnNotes.push('No SDN features selected; SDN management is not required.');
        }
        sections.push(block('Software Defined Networking (SDN)',
            '<strong>Features:</strong> ' + escapeHtml((s.sdnFeatures && s.sdnFeatures.length) ? s.sdnFeatures.join(', ') : 'None')
            + '<br><strong>Management:</strong> ' + escapeHtml(s.sdnManagement ? (s.sdnManagement === 'arc_managed' ? 'Arc Managed' : 'On-Premises Managed') : 'Not applicable')
            + list(sdnNotes)
            + renderValidationInline(validations.byArea.SDN)
        ));

        return sections.join('');
    }

    function computeValidations(s) {
        const results = [];
        const byArea = {
            Scenario: [],
            Cloud: [],
            ScaleNodes: [],
            StoragePorts: [],
            Intent: [],
            Outbound: [],
            Infrastructure: [],
            DNS: [],
            SDN: []
        };

        function add(area, name, passed, details, refs) {
            const item = { area: area, name: name, passed: !!passed, details: details || '', refs: refs || [] };
            results.push(item);
            if (byArea[area]) byArea[area].push(item);
        }

        // Helpers
        const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        function ipToLong(ip) {
            return String(ip).split('.').reduce(function(acc, octet) {
                return (acc << 8) + parseInt(octet, 10);
            }, 0) >>> 0;
        }

        function isValidIpv4Cidr(value) {
            if (!value) return false;
            const trimmed = String(value).trim();
            const parts = trimmed.split('/');
            if (parts.length !== 2) return false;
            const ip = parts[0];
            const prefix = parseInt(parts[1], 10);
            if (!ipv4Regex.test(ip)) return false;
            if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
            return true;
        }

        function extractIpFromCidr(value) {
            if (!value) return '';
            const trimmed = String(value).trim();
            const parts = trimmed.split('/');
            return parts[0] ? String(parts[0]).trim() : '';
        }

        // Microsoft Learn references used in explanations
        // Prefer the exact links already present in the wizard UI when available.
        const REF_PRIVATE_IP = 'https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/private-ip-addresses';

        // Wizard UI links
        const REF_AZLOC_MULTIRACK = 'https://learn.microsoft.com/en-us/azure/azure-local/multi-rack/multi-rack-overview?view=azloc-2511';
        const REF_ARB_IP_RANGES = 'https://learn.microsoft.com/en-us/azure/azure-arc/resource-bridge/network-requirements#designated-ip-ranges-for-arc-resource-bridge';
        const REF_AZLOC_FIREWALL = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/firewall-requirements?view=azloc-2511';
        const REF_AZLOC_VLAN = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/cloud-deployment-network-considerations?view=azloc-2511#management-vlan-id';
        const REF_AZLOC_NET_CONSIDERATIONS = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/cloud-deployment-network-considerations?view=azloc-2511';

        // Additional official references (not in wizard UI but still Microsoft Learn)
        const REF_AZLOC_PREREQS = 'https://learn.microsoft.com/en-us/azure/azure-local/deploy/deployment-prerequisites?view=azloc-2511';
        const REF_AZLOC_AD_PREP = 'https://learn.microsoft.com/en-us/azure/azure-local/deploy/deployment-prep-active-directory?view=azloc-2511';
        const REF_AZLOC_LOCAL_ID = 'https://learn.microsoft.com/en-us/azure/azure-local/deploy/deployment-local-identity-with-key-vault?view=azloc-2511';
        const REF_ARC_GATEWAY = 'https://learn.microsoft.com/en-us/azure/azure-arc/servers/arc-gateway';
        const REF_ARC_GATEWAY_DEEPDIVE = 'https://github.com/Azure/AzureLocal-Supportability/blob/main/TSG/Networking/Arc-Gateway-Outbound-Connectivity/DeepDive-ArcGateway-Outbound-Traffic.md';
        const REF_AZLOC_SDN_OVERVIEW = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/sdn-overview?view=azloc-2511';
        const REF_AZLOC_SDN = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/software-defined-networking?view=azloc-2511';
        const REF_AZLOC_SYSREQ_PUBLIC = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/system-requirements-23h2?view=azloc-2511&tabs=azure-public';
        const REF_AZLOC_SYSREQ_GOV = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/system-requirements-23h2?view=azloc-2511&tabs=azure-government';

        function supportedLocalRegionsForCloud(cloud) {
            // These are the region options this wizard exposes. The authoritative list of supported Azure regions is in the System requirements doc.
            if (cloud === 'azure_commercial') {
                return [
                    'east_us',
                    'south_central_us',
                    'west_europe',
                    'australia_east',
                    'southeast_asia',
                    'india_central',
                    'canada_central',
                    'japan_east'
                ];
            }
            if (cloud === 'azure_government') {
                return ['us_gov_virginia'];
            }
            return [];
        }

        function isRfc1918Long(l) {
            // 10.0.0.0/8
            if (l >= ipToLong('10.0.0.0') && l <= ipToLong('10.255.255.255')) return true;
            // 172.16.0.0/12
            if (l >= ipToLong('172.16.0.0') && l <= ipToLong('172.31.255.255')) return true;
            // 192.168.0.0/16
            if (l >= ipToLong('192.168.0.0') && l <= ipToLong('192.168.255.255')) return true;
            return false;
        }

        // Scenario
        add('Scenario', 'Scenario selected', !!s.scenario, s.scenario ? ('Selected: ' + formatScenario(s.scenario, s)) : '');
        add('Scenario', 'Multi-Rack is a stop-flow', s.scenario !== 'multirack', s.scenario === 'multirack' ? 'The wizard intentionally stops for Multi-Rack and routes to Microsoft for requirements.' : '', [REF_AZLOC_MULTIRACK]);

        // Cloud + local region
        add('Cloud', 'Azure Cloud selected', !!s.region, s.region ? ('Selected: ' + formatCloud(s.region)) : '');
        add('Cloud', 'Azure Local Instance Region selected', !!s.localInstanceRegion, s.localInstanceRegion ? ('Selected: ' + formatLocalInstanceRegion(s.localInstanceRegion)) : '');

        if (s.scenario === 'disconnected') {
            add('Cloud', 'Disconnected blocks Azure China', s.region !== 'azure_china', 'Disconnected mode disables Azure China selection in this wizard flow.', [REF_AZLOC_PREREQS]);
        }

        // Region support (aligns with wizard filtering + official supported region list)
        if (s.region === 'azure_commercial') {
            const allowedPub = supportedLocalRegionsForCloud('azure_commercial');
            const okPub = !!s.localInstanceRegion && allowedPub.indexOf(String(s.localInstanceRegion)) >= 0;
            add(
                'Cloud',
                'Azure Local region is supported for Azure Public cloud',
                okPub,
                'Microsoft lists supported Azure Public regions for Azure Local (for example: East US, South Central US, West Europe, Australia East, Southeast Asia, India Central, Canada Central, Japan East). The wizard limits choices to this supported catalog.',
                [REF_AZLOC_SYSREQ_PUBLIC]
            );
        } else if (s.region === 'azure_government') {
            const allowedGov = supportedLocalRegionsForCloud('azure_government');
            const okGov = !!s.localInstanceRegion && allowedGov.indexOf(String(s.localInstanceRegion)) >= 0;
            add(
                'Cloud',
                'Azure Local region is supported for Azure Government cloud',
                okGov,
                'Microsoft lists supported Azure Government regions for Azure Local (for example: US Gov Virginia). The wizard limits choices to this supported catalog.',
                [REF_AZLOC_SYSREQ_GOV]
            );
        }

        // Scale + nodes
        add('ScaleNodes', 'Scale selected', !!s.scale, s.scale ? ('Selected: ' + formatScale(s.scale)) : '');
        add('ScaleNodes', 'Nodes selected', !!s.nodes, s.nodes ? ('Selected: ' + s.nodes) : '');

        if (s.scenario === 'disconnected') {
            add('ScaleNodes', 'Disconnected only allows Standard scale', s.scale === 'medium' || !s.scale, 'Disconnected deployments restrict options for operational/supportability reasons in this wizard.', [REF_AZLOC_PREREQS]);
            if (s.clusterRole === 'management') {
                add('ScaleNodes', 'Management cluster requires exactly 3 nodes', s.nodes === '3', 'Management cluster is fixed at 3 nodes for disconnected operations.');
            }
        }

        if (s.scale === 'low_capacity') {
            const nLow = parseInt(s.nodes, 10);
            add('ScaleNodes', 'Low Capacity node limits', (String(s.nodes) !== '16+' && !isNaN(nLow) && nLow <= 3), 'Wizard disables >3 nodes for Low Capacity.');
        }
        if (s.scale === 'medium') {
            add('ScaleNodes', 'Standard disallows 16+ nodes option', String(s.nodes) !== '16+', 'Wizard disables 16+ for Standard.');
        }
        if (s.scale === 'rack_aware') {
            add('ScaleNodes', 'Rack Aware allowed node counts', ['2', '4', '6', '8'].indexOf(String(s.nodes)) >= 0, 'Wizard restricts Rack Aware to 2/4/6/8 nodes.');
        }

        // Storage + Ports
        add('StoragePorts', 'Storage selected', !!s.storage, s.storage ? ('Selected: ' + s.storage) : '');
        add('StoragePorts', 'Ports selected', !!s.ports, s.ports ? ('Selected: ' + s.ports) : '');

        // Nodes >= 5 -> switchless disabled
        const nodeVal = (s.nodes === '16+') ? 17 : parseInt(s.nodes, 10);
        if (!isNaN(nodeVal) && nodeVal >= 5) {
            add('StoragePorts', '>=5 nodes requires Switched storage', s.storage !== 'switchless', 'Wizard disables Switchless at 5+ nodes.');
        }

        // Switchless -> ports constraints
        if (s.storage === 'switchless' && s.nodes) {
            var n = parseInt(s.nodes, 10);
            if (n === 1 && s.scale === 'low_capacity') {
                add('StoragePorts', 'Switchless (1 node, Low Cap) blocks 1/6/8 ports', (s.ports !== '1' && s.ports !== '6' && s.ports !== '8'), 'Wizard disables 1,6,8 ports for this case.');
            }
            if (n === 2) {
                add('StoragePorts', 'Switchless (2 nodes) blocks 1 port', s.ports !== '1', 'Wizard disables 1 port for 2-node switchless.');
                if (s.scale !== 'low_capacity') {
                    add('StoragePorts', 'Switchless (2 nodes, Standard) blocks 2 ports', s.ports !== '2', 'Wizard disables 2 ports unless Low Capacity.');
                } else {
                    add('StoragePorts', 'Switchless (2 nodes, Low Cap) requires 4 ports', s.ports === '4', 'Wizard forces 4 ports for 2-node switchless in Low Capacity.');
                }
            }
            if (n === 3) {
                add('StoragePorts', 'Switchless (3 nodes) blocks 1 port', s.ports !== '1', 'Wizard disables 1 port for 3-node switchless.');
                add('StoragePorts', 'Switchless (3 nodes) requires 6+ ports', (s.ports === '6' || s.ports === '8'), '3-node switchless requires at least 6 physical ports per node (2 teamed for management/compute + 4 RDMA for storage).');
            }
            if (n === 4) {
                add('StoragePorts', 'Switchless (4 nodes) requires 8 ports', s.ports === '8', 'Wizard forces 8 ports for 4-node switchless.');
            }
        }

        // Intent validations
        add('Intent', 'Intent selected', !!s.intent, s.intent ? ('Selected: ' + formatIntent(s.intent)) : '');

        // Single node cluster intent rules (takes priority)
        if (s.nodes === '1') {
            const singleNodePorts = parseInt(s.ports, 10);

            // Single node: always disable All Traffic and Compute+Storage
            add('Intent', 'Single node disables All Traffic', s.intent !== 'all_traffic', 'Single node deployments cannot use Group All Traffic.');
            add('Intent', 'Single node disables Compute+Storage', s.intent !== 'compute_storage', 'Compute+Storage intent is not available for single node deployments.');

            if (!isNaN(singleNodePorts) && singleNodePorts >= 4) {
                add('Intent', 'Single node (4+ ports) allows Mgmt+Compute or Custom', (s.intent === 'mgmt_compute' || s.intent === 'custom'), 'Only Mgmt+Compute or Custom intents are available for single node with 4+ ports.');
            } else {
                add('Intent', 'Single node (<4 ports) disables Custom', s.intent !== 'custom', 'Custom intent requires at least 4 ports for single node deployments.');
                add('Intent', 'Single node (<4 ports) requires Mgmt+Compute', s.intent === 'mgmt_compute', 'Only Mgmt+Compute intent is available for single node with fewer than 4 ports.');
            }
        }

        // Ports -> intent rules (mirror updateUI) - only apply for multi-node scenarios
        if (s.nodes !== '1' && s.ports === '1') {
            add('Intent', '1 port disables Switchless storage', s.storage !== 'switchless', 'Wizard disables Switchless when only 1 port is available.');
            add('Intent', '1 port blocks Compute+Storage intent', s.intent !== 'compute_storage', 'Compute+Storage is disabled with 1 port.');
            add('Intent', '1 port disables Mgmt+Compute intent', s.intent !== 'mgmt_compute', 'Wizard disables Mgmt+Compute for multi-node with 1 port.');
            add('Intent', '1 port allows All Traffic or Custom', (s.intent === 'all_traffic' || s.intent === 'custom'), '');
        }

        if (s.nodes !== '1' && s.ports === '2') {
            if (s.scale !== 'low_capacity') {
                add('StoragePorts', '2 ports (Standard) disables Switchless storage', s.storage !== 'switchless', 'Wizard disables Switchless for 2 ports unless Low Capacity.');
            }
            add('Intent', '2 ports disables Compute+Storage intent', s.intent !== 'compute_storage', '');
            add('Intent', '2 ports disables Custom intent', s.intent !== 'custom', '');

            if (s.scale === 'low_capacity') {
                add('Intent', '2 ports (Low Cap) only allows Mgmt+Compute', s.intent === 'mgmt_compute', 'Wizard disables All Traffic for this case.');
            } else {
                add('Intent', '2 ports (Standard) only allows All Traffic', s.intent === 'all_traffic', 'Wizard disables Mgmt+Compute for this case.');
            }
        }

        if (s.nodes !== '1' && s.ports === '4') {
            add('Intent', '4 ports disables Custom intent', s.intent !== 'custom', 'Wizard disables Custom with 4 ports.');
            if (s.scale === 'low_capacity') {
                add('Intent', '4 ports (Low Cap) only allows Mgmt+Compute', s.intent === 'mgmt_compute', 'Wizard disables All Traffic and Compute+Storage for this case.');
            }
        }

        // Storage -> intent rule
        if (s.storage === 'switchless') {
            if (s.scale !== 'low_capacity') {
                add('Intent', 'Switchless (Standard) disables All Traffic intent', s.intent !== 'all_traffic', 'Wizard disables fully converged in this case.');
            }
            add('Intent', 'Switchless disables Compute+Storage intent', s.intent !== 'compute_storage', 'Wizard disables Compute+Storage with switchless.');
        }

        // Custom intent confirm
        if (s.intent === 'custom') {
            add('Intent', 'Custom intent mapping confirmed', !!s.customIntentConfirmed, 'Wizard requires confirmation before showing Overrides and before generating the report.');
        }

        // Outbound -> arc + proxy
        add('Outbound', 'Outbound selected', !!s.outbound, s.outbound ? ('Selected: ' + formatOutbound(s.outbound)) : '');
        if (s.outbound === 'private') {
            add('Outbound', 'Private outbound forces Arc Gateway', s.arc === 'arc_gateway', 'Private outbound assumes controlled egress; the wizard forces Arc Gateway so outbound Arc traffic is routed through a secured tunnel to the Arc Gateway public endpoint, reducing the number of outbound destinations you typically need to allow.', [REF_ARC_GATEWAY, REF_ARC_GATEWAY_DEEPDIVE, REF_AZLOC_FIREWALL]);
            add('Outbound', 'Private outbound forces Proxy enabled', s.proxy === 'proxy', 'Private outbound requires explicit proxy behavior in the wizard. OS HTTP traffic and non-approved HTTPS destinations generally need to be handled by your enterprise proxy/firewall policy, while Arc proxy routes approved Microsoft-managed HTTPS endpoints through the Arc Gateway tunnel.', [REF_ARC_GATEWAY_DEEPDIVE, REF_AZLOC_FIREWALL, REF_AZLOC_PREREQS]);
        }

        // Azure Gov constraint
        if (s.region === 'azure_government') {
            add('Outbound', 'Azure Government disables Arc Gateway', s.arc !== 'arc_gateway', 'Wizard disables Arc Gateway for Azure Government cloud selection.', [REF_ARC_GATEWAY]);
        }

        // Infrastructure network + VLAN
        add('Infrastructure', 'IP assignment selected', !!s.ip, '');
        add('Infrastructure', 'Infrastructure VLAN selected', !!s.infraVlan, '');

        if (s.infraVlan === 'custom') {
            const v = parseInt(s.infraVlanId, 10);
            add('Infrastructure', 'Infra VLAN ID is valid (1-4096)', (!isNaN(v) && String(v) === String(s.infraVlanId) && v >= 1 && v <= 4096), 'Valid VLAN IDs are integers 1–4096. Azure Local guidance emphasizes that management VLAN tagging must be configured on the physical adapters before Azure Arc registration so connectivity is preserved through deployment.', [REF_AZLOC_VLAN, REF_AZLOC_NET_CONSIDERATIONS]);
        }

        // Infra network validation (mirrors updateInfraNetwork)
        if (s.infraCidr) {
            const parts = String(s.infraCidr).split('/');
            const cidrIp = parts[0];
            const prefix = parts.length === 2 ? parseInt(parts[1], 10) : NaN;
            add('Infrastructure', 'Infra CIDR format is valid', (parts.length === 2 && ipv4Regex.test(cidrIp) && !isNaN(prefix) && prefix >= 0 && prefix <= 32), 'Example: 192.168.1.0/24');
        }

        if (s.infra && s.infra.start && s.infra.end) {
            const startOk = ipv4Regex.test(s.infra.start);
            const endOk = ipv4Regex.test(s.infra.end);
            add('Infrastructure', 'Infra IP range has valid IPv4 start/end', startOk && endOk, '');

            if (startOk && endOk) {
                const startL = ipToLong(s.infra.start);
                const endL = ipToLong(s.infra.end);
                add('Infrastructure', 'Infra range end >= start', endL >= startL, '');
                const count = endL - startL + 1;
                add('Infrastructure', 'Infra range has at least 6 IPs', count >= 6, 'Azure Local guidance requires a management/infrastructure IP pool of at least six consecutive available IPs for infrastructure services (cluster IP, Arc Resource Bridge VM and components, and other platform services).', [REF_AZLOC_PREREQS, REF_AZLOC_NET_CONSIDERATIONS]);

                // Node IPs must not be inside the reserved Infrastructure IP Pool
                if (Array.isArray(s.nodeSettings) && s.nodeSettings.length > 0) {
                    const offendersPool = [];
                    for (let nn = 0; nn < s.nodeSettings.length; nn++) {
                        const nodeP = s.nodeSettings[nn] || {};
                        const nodeIpCidrP = String(nodeP.ipCidr || '').trim();
                        if (!isValidIpv4Cidr(nodeIpCidrP)) continue;
                        const nodeIpP = extractIpFromCidr(nodeIpCidrP);
                        if (!ipv4Regex.test(nodeIpP)) continue;
                        const nodeLP = ipToLong(nodeIpP);
                        if (nodeLP >= startL && nodeLP <= endL) {
                            const nodeLabelP = String(nodeP.name || '').trim() || ('Node ' + (nn + 1));
                            offendersPool.push(nodeLabelP + ' (' + nodeIpP + ')');
                        }
                    }

                    add(
                        'Infrastructure',
                        'Infra IP pool excludes node IPs',
                        offendersPool.length === 0,
                        offendersPool.length === 0
                            ? 'No node IPs are inside the reserved Infrastructure IP Pool range.'
                            : ('Infrastructure IP Pool range (' + String(s.infra.start) + ' - ' + String(s.infra.end) + ') must not include any node IPs. Offenders: ' + offendersPool.join('; ')),
                        [REF_AZLOC_NET_CONSIDERATIONS, REF_AZLOC_PREREQS]
                    );
                }

                // RFC1918 private IP guidance
                const startPrivate = isRfc1918Long(startL);
                const endPrivate = isRfc1918Long(endL);
                add(
                    'Infrastructure',
                    'Infra range uses private IPv4 space (RFC1918)',
                    (startPrivate && endPrivate),
                    (startPrivate && endPrivate)
                        ? 'The Infrastructure IP pool is within private address space, which is the standard practice for internal management networks.'
                        : 'The Infrastructure IP pool is not fully within RFC1918 private ranges (10/8, 172.16/12, 192.168/16). The wizard may still accept it, but it is typically not recommended.',
                    [REF_PRIVATE_IP]
                );

                // Reserved subnet overlap
                const reservedRanges = [
                    { name: '10.96.0.0/12', min: ipToLong('10.96.0.0'), max: ipToLong('10.111.255.255') },
                    { name: '10.244.0.0/16', min: ipToLong('10.244.0.0'), max: ipToLong('10.244.255.255') }
                ];
                let overlapsReserved = false;
                for (let i = 0; i < reservedRanges.length; i++) {
                    const r = reservedRanges[i];
                    if (startL <= r.max && endL >= r.min) overlapsReserved = true;
                }
                add(
                    'Infrastructure',
                    'Infra range does not overlap AKS reserved networks (10.96.0.0/12, 10.244.0.0/16)',
                    !overlapsReserved,
                    'These ranges are reserved to avoid collisions with Kubernetes networking used by Arc Resource Bridge and cluster infrastructure services.',
                    [REF_ARB_IP_RANGES, REF_AZLOC_PREREQS]
                );

                // If CIDR exists, range must be within CIDR and CIDR must not overlap reserved ranges
                if (s.infraCidr) {
                    const cidrParts = String(s.infraCidr).split('/');
                    const ip = cidrParts[0];
                    const pfx = cidrParts.length === 2 ? parseInt(cidrParts[1], 10) : NaN;
                    if (ipv4Regex.test(ip) && !isNaN(pfx) && pfx >= 0 && pfx <= 32) {
                        const cidrIpL = ipToLong(ip);
                        const mask = pfx === 0 ? 0 : ((0xFFFFFFFF << (32 - pfx)) >>> 0);
                        const networkL = (cidrIpL & mask) >>> 0;
                        const broadcastL = (networkL | ((~mask) >>> 0)) >>> 0;

                        add('Infrastructure', 'Infra range is within Infra CIDR', (startL >= networkL && endL <= broadcastL), 'Wizard requires range to be within the provided CIDR.');

                        let overlapsCidrReserved = false;
                        for (let j = 0; j < reservedRanges.length; j++) {
                            const rr = reservedRanges[j];
                            if (networkL <= rr.max && broadcastL >= rr.min) overlapsCidrReserved = true;
                        }
                        add(
                            'Infrastructure',
                            'Infra CIDR does not overlap AKS reserved networks (10.96.0.0/12, 10.244.0.0/16)',
                            !overlapsCidrReserved,
                            'Avoiding overlap prevents routing conflicts between the Infrastructure network and Kubernetes/AKS network ranges used by Azure Local infrastructure.',
                            [REF_ARB_IP_RANGES, REF_AZLOC_PREREQS]
                        );

                        // Node IP containment (mirrors wizard Step 14 validation)
                        if (Array.isArray(s.nodeSettings) && s.nodeSettings.length > 0) {
                            const outside = [];
                            for (var n = 0; n < s.nodeSettings.length; n++) {
                                const node = s.nodeSettings[n] || {};
                                const nodeIpCidr = String(node.ipCidr || '').trim();
                                if (!isValidIpv4Cidr(nodeIpCidr)) continue;
                                const nodeIp = extractIpFromCidr(nodeIpCidr);
                                if (!ipv4Regex.test(nodeIp)) continue;
                                const nodeL = ipToLong(nodeIp);
                                const inHostRange = (nodeL > networkL && nodeL < broadcastL);
                                if (!inHostRange) {
                                    const nodeLabel = String(node.name || '').trim() || ('Node ' + (n + 1));
                                    outside.push(nodeLabel + ' (' + nodeIp + ')');
                                }
                            }

                            add(
                                'Infrastructure',
                                'Infra CIDR includes all node IPs',
                                outside.length === 0,
                                outside.length === 0
                                    ? 'All node IPs are within the Infrastructure network CIDR.'
                                    : ('Infrastructure network must include the nodes IPs. Outside ' + String(s.infraCidr) + ': ' + outside.join('; ')),
                                [REF_AZLOC_NET_CONSIDERATIONS, REF_AZLOC_PREREQS]
                            );
                        }
                    }
                }
            }
        } else {
            add('Infrastructure', 'Infra range provided (start/end)', false, 'Wizard requires a valid Infrastructure IP range before enabling Identity selection.');
        }

        // DNS validations (mirrors validateAllDnsServers)
        const dnsServers = (s.dnsServers || []).filter(function(x) { return x && String(x).trim(); }).map(function(x) { return String(x).trim(); });
        add('DNS', 'At least 1 DNS server configured', dnsServers.length > 0, 'DNS is required so the nodes and infrastructure components can resolve required names (domain controllers, Arc endpoints, etc). Azure Local guidance also states DNS server IPs used by nodes/infrastructure are not supported to change after deployment, so plan this input carefully.', [REF_AZLOC_PREREQS, REF_AZLOC_NET_CONSIDERATIONS]);
        let dnsAllIpv4 = true;
        for (let d = 0; d < dnsServers.length; d++) {
            if (!ipv4Regex.test(dnsServers[d])) dnsAllIpv4 = false;
        }
        add('DNS', 'All DNS servers are valid IPv4', dnsAllIpv4, 'Each DNS server must be a valid IPv4 address to ensure correct resolver configuration.', [REF_AZLOC_PREREQS]);

        if (dnsServers.length > 0 && dnsAllIpv4) {
            const reservedDnsRanges = [
                { name: '10.96.0.0/12', min: ipToLong('10.96.0.0'), max: ipToLong('10.111.255.255') },
                { name: '10.244.0.0/16', min: ipToLong('10.244.0.0'), max: ipToLong('10.244.255.255') }
            ];
            let dnsOverlapsReserved = false;
            for (let k = 0; k < dnsServers.length; k++) {
                const dl = ipToLong(dnsServers[k]);
                for (let m = 0; m < reservedDnsRanges.length; m++) {
                    const rr2 = reservedDnsRanges[m];
                    if (dl >= rr2.min && dl <= rr2.max) dnsOverlapsReserved = true;
                }
            }
            add('DNS', 'DNS servers do not overlap AKS reserved networks (10.96.0.0/12, 10.244.0.0/16)', !dnsOverlapsReserved, 'Ensures the DNS servers are not placed inside the reserved Kubernetes ranges used by Arc Resource Bridge and Azure Local infrastructure.', [REF_ARB_IP_RANGES, REF_AZLOC_PREREQS]);

            if (s.infra && s.infra.start && s.infra.end && ipv4Regex.test(s.infra.start) && ipv4Regex.test(s.infra.end)) {
                const infraStartL = ipToLong(s.infra.start);
                const infraEndL = ipToLong(s.infra.end);
                let dnsInsideInfra = false;
                for (let q = 0; q < dnsServers.length; q++) {
                    const dl2 = ipToLong(dnsServers[q]);
                    if (dl2 >= infraStartL && dl2 <= infraEndL) dnsInsideInfra = true;
                }
                add('DNS', 'DNS servers are outside Infra range', !dnsInsideInfra, 'Wizard blocks DNS servers from being inside the Infra IP pool.');
            }
        }

        // Identity fields
        if (s.activeDirectory === 'azure_ad') {
            add('DNS', 'AD Domain is provided for Active Directory', !!s.adDomain, 'Active Directory deployments require a valid AD DS domain FQDN so nodes can join the domain and resolve directory services.', [REF_AZLOC_AD_PREP, REF_AZLOC_PREREQS]);
        }
        if (s.activeDirectory === 'local_identity') {
            add('DNS', 'Local DNS Zone is provided for Local Identity', !!s.localDnsZone, 'Local Identity deployments require a local DNS zone for name resolution in the environment.', [REF_AZLOC_LOCAL_ID, REF_AZLOC_PREREQS]);
        }

        // SDN management rules
        const f = s.sdnFeatures || [];
        const hasVnet = f.indexOf('vnet') >= 0;
        const hasSlb = f.indexOf('slb') >= 0;
        const hasLnet = f.indexOf('lnet') >= 0;
        const hasNsg = f.indexOf('nsg') >= 0;
        const onlyLnetNsg = (hasLnet || hasNsg) && !hasVnet && !hasSlb;
        const hasVnetOrSlb = hasVnet || hasSlb;

        if (f.length === 0) {
            add('SDN', 'No SDN features selected (management not required)', true, 'Wizard hides SDN management section when no features are selected.');
        } else {
            add('SDN', 'SDN management selected when features are enabled', !!s.sdnManagement, 'When SDN features are enabled, you must choose the SDN management model so control-plane responsibilities are clear.', [REF_AZLOC_SDN_OVERVIEW, REF_AZLOC_SDN]);
            if (onlyLnetNsg) {
                add('SDN', 'LNET/NSG-only supports Arc management', s.sdnManagement === 'arc_managed', 'Wizard disables On-Prem management when only LNET/NSG are selected; this combination is supported via Arc-managed SDN in this flow.', [REF_AZLOC_SDN_OVERVIEW, REF_AZLOC_SDN]);
            }
            if (hasVnetOrSlb) {
                add('SDN', 'VNET/SLB requires On-Prem management', s.sdnManagement === 'onprem_managed', 'Wizard disables Arc management when VNET or SLB is selected; these features require the on-prem SDN management model in this wizard.', [REF_AZLOC_SDN_OVERVIEW, REF_AZLOC_SDN]);
            }
        }

        return { results: results, byArea: byArea };
    }

    function renderRefs(refs) {
        if (!refs || !refs.length) return '';
        // De-dup while preserving order
        const seen = {};
        const uniq = [];
        for (let i = 0; i < refs.length; i++) {
            const u = refs[i];
            if (!u || seen[u]) continue;
            seen[u] = true;
            uniq.push(u);
        }

        function labelFor(url) {
            if (!url) return 'Microsoft Learn';
            if (url.indexOf('github.com/Azure/AzureLocal-Supportability') >= 0) return 'AzureLocal Supportability TSG';
            if (url.indexOf('/azure/azure-local/plan/cloud-deployment-network-considerations') >= 0) return 'Azure Local network considerations';
            if (url.indexOf('/azure/azure-local/concepts/system-requirements-23h2') >= 0) return 'Azure Local supported regions';
            if (url.indexOf('/azure/azure-local/') >= 0) return 'Azure Local guidance';
            if (url.indexOf('/azure/aks/') >= 0) return 'AKS networking guidance';
            if (url.indexOf('/azure/virtual-network/') >= 0) return 'Private IP guidance';
            if (url.indexOf('/azure/azure-arc/resource-bridge/') >= 0) return 'Arc Resource Bridge networking';
            if (url.indexOf('/azure/azure-arc/servers/arc-gateway') >= 0) return 'Arc Gateway guidance';
            return 'Microsoft Learn';
        }

        return '<div style="margin-top:0.25rem;">'
            + '<span style="color:var(--text-secondary);">Learn more:</span> '
            + uniq.map(function(u) {
                return '<a href="' + escapeHtml(u) + '" target="_blank" rel="noreferrer" style="color:var(--accent-blue); text-decoration:underline;">' + escapeHtml(labelFor(u)) + '</a>';
            }).join(' &nbsp; ')
            + '</div>';
    }

    function renderValidationInline(items) {
        if (!items || items.length === 0) return '';
        const failed = items.filter(function(x) { return !x.passed; });

        let html = '<div style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid var(--glass-border);">'
            + '<strong>Validation checks</strong>';

        if (failed.length) {
            html += '<div style="margin-top:0.4rem; color:var(--accent-purple);">Some checks did not pass in this snapshot:</div>';
        }

        html += '<ul style="margin:0.4rem 0 0 1.25rem; color:var(--text-primary);">'
            + items.slice(0, 6).map(function(v) {
                const mark = v.passed ? '<span style="color:var(--success);">✓</span>' : '<span style="color:var(--accent-purple);">⚠</span>';
                return '<li>'
                    + mark + ' ' + escapeHtml(v.name)
                    + (v.details ? (' — <span style="color:var(--text-secondary);">' + escapeHtml(v.details) + '</span>') : '')
                    + (v.refs && v.refs.length ? renderRefs(v.refs) : '')
                    + '</li>';
            }).join('')
            + '</ul>'
            + '</div>';
        return html;
    }

    function renderValidationSummary(validations) {
        const all = validations.results || [];
        const passCount = all.filter(function(x) { return x.passed; }).length;
        const failCount = all.length - passCount;

        const header = '<div class="summary-section">'
            + '<div class="summary-section-title summary-section-title--mgmt">Validation Results</div>'
            + '<div style="color:var(--text-primary);">'
            + '<strong>Passed:</strong> <span style="color:var(--success);">' + passCount + '</span>'
            + ' &nbsp; <strong>Warnings/Failures:</strong> <span style="color:var(--accent-purple);">' + failCount + '</span>'
            + '</div>';

        const rows = all.map(function(v) {
            const mark = v.passed ? '<span style="color:var(--success); font-weight:700;">✓</span>' : '<span style="color:var(--accent-purple); font-weight:700;">⚠</span>';
            const detail = v.details ? ('<div style="color:var(--text-secondary); margin-top:0.15rem;">' + escapeHtml(v.details) + '</div>') : '';
            const refs = (v.refs && v.refs.length) ? renderRefs(v.refs) : '';
            return '<div style="padding:0.55rem 0; border-top:1px solid var(--glass-border);">'
                + '<div style="display:flex; gap:0.5rem; align-items:flex-start;">'
                + '<div style="width:18px;">' + mark + '</div>'
                + '<div style="flex:1;">'
                + '<div style="color:var(--text-primary);">' + escapeHtml(v.name) + '</div>'
                + detail
                + refs
                + '</div>'
                + '</div>'
                + '</div>';
        }).join('');

        return header + rows + '</div>';
    }

    function renderSummaryCards(s) {
        // Reuse summary styles: build grouped sections (match wizard categories)
        function row(label, value, mono) {
            return '<div class="summary-row">'
                + '<div class="summary-label">' + escapeHtml(label) + '</div>'
                + '<div class="summary-value' + (mono ? ' mono' : '') + '">' + escapeHtml(value) + '</div>'
                + '</div>';
        }

        // Step 01–05: Scenario & Scale
        let scenarioScaleRows = '';
        if (s.scenario) scenarioScaleRows += row('Scenario', formatScenario(s.scenario, s));
        scenarioScaleRows += row('Architecture', s.architecture === 'disaggregated' ? 'Disaggregated' : 'Hyperconverged (HCI)');
        if (s.scenario === 'disconnected' && s.clusterRole) {
            scenarioScaleRows += row('Cluster Role', s.clusterRole === 'management' ? 'Management Cluster' : 'Workload Cluster');
            scenarioScaleRows += row('Autonomous Cloud FQDN', s.autonomousCloudFqdn || 'Not configured');
        } else {
            if (s.region) scenarioScaleRows += row('Azure Cloud', formatCloud(s.region));
            if (s.localInstanceRegion) scenarioScaleRows += row('Azure Local Instance Region', formatLocalInstanceRegion(s.localInstanceRegion));
        }
        if (s.scale) scenarioScaleRows += row('Scale', formatScale(s.scale));
        if (s.nodes) scenarioScaleRows += row('Nodes', s.nodes, true);
        if (s.witnessType) scenarioScaleRows += row('Cloud Witness', s.witnessType === 'Cloud' ? 'Cloud' : 'No Witness');

        // Step 06–08: Host Networking
        let hostNetworkingRows = '';
        if (s.storage) hostNetworkingRows += row('Storage', s.storage.charAt(0).toUpperCase() + s.storage.slice(1));
        if (s.ports) hostNetworkingRows += row('Ports', s.ports, true);
        if (s.intent) hostNetworkingRows += row('Intent', formatIntent(s.intent));
        if (s.storageAutoIp) hostNetworkingRows += row('Storage Auto IP', s.storageAutoIp === 'enabled' ? 'Enabled' : 'Disabled');
        // Display storage subnet information based on Auto IP setting
        if (s.storageAutoIp === 'enabled') {
            // Show default Network ATC subnets when Auto IP is enabled
            // Note: We don't show specific IPs because Network ATC assigns them automatically
            hostNetworkingRows += row('Storage Subnets', 'Default Network ATC (10.71.0.0/16) - IPs assigned automatically');
        } else if (s.storageAutoIp === 'disabled' && Array.isArray(s.customStorageSubnets) && s.customStorageSubnets.length > 0) {
            // Show custom storage subnets when Auto IP is disabled
            const validSubnets = s.customStorageSubnets.filter(function(subnet) { return subnet && String(subnet).trim(); });
            if (validSubnets.length > 0) {
                hostNetworkingRows += row('Storage Subnets', validSubnets.join(', '), true);
                // Calculate and display storage adapter IPs for each node
                const nodeCount = parseInt(s.nodes, 10) || 0;
                if (nodeCount > 0) {
                    const storageIpDetails = [];

                    // Helper function to get subnet prefix from CIDR
                    const getSubnetPrefix = function(cidr) {
                        const cidrParts = String(cidr).trim().split('/');
                        if (cidrParts.length >= 1) {
                            const ipParts = cidrParts[0].split('.');
                            if (ipParts.length === 4) {
                                return ipParts[0] + '.' + ipParts[1] + '.' + ipParts[2];
                            }
                        }
                        return null;
                    };

                    // Helper to get node name
                    const getNodeName = function(nodeIdx) {
                        return (Array.isArray(s.nodeSettings) && s.nodeSettings[nodeIdx] && s.nodeSettings[nodeIdx].name)
                            ? s.nodeSettings[nodeIdx].name : ('node' + (nodeIdx + 1));
                    };

                    if (s.storage === 'switched') {
                        // For switched storage, show IPs from the first two subnets
                        // All nodes share the same two subnets
                        // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                        for (let subnetIdx = 0; subnetIdx < Math.min(validSubnets.length, 2); subnetIdx++) {
                            var prefix = getSubnetPrefix(validSubnets[subnetIdx]);
                            if (prefix) {
                                const adapterName = getPortCustomName(s, subnetIdx + 3, 'nic');
                                var nodeIps = [];
                                for (let nodeIdx = 0; nodeIdx < nodeCount; nodeIdx++) {
                                    nodeIps.push(getNodeName(nodeIdx) + ': ' + prefix + '.' + (nodeIdx + 2));
                                }
                                storageIpDetails.push(adapterName + ': ' + nodeIps.join(', '));
                            }
                        }
                    } else if (s.storage === 'switchless') {
                        // For switchless storage, organize by SMB adapter like the ARM template
                        // Each SMB adapter shows which node gets which IP from which subnet

                        if (nodeCount === 2) {
                            // 2-node switchless: 2 SMB adapters, 2 subnets
                            // SMB1: both nodes use Subnet1, SMB2: both nodes use Subnet2
                            for (var smbIdx = 0; smbIdx < 2 && smbIdx < validSubnets.length; smbIdx++) {
                                var prefix = getSubnetPrefix(validSubnets[smbIdx]);
                                if (prefix) {
                                    var nodeIps = [];
                                    nodeIps.push(getNodeName(0) + ': ' + prefix + '.2');
                                    nodeIps.push(getNodeName(1) + ': ' + prefix + '.3');
                                    // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                                    var smbName = getPortCustomName(s, smbIdx + 3, 'nic');
                                    storageIpDetails.push(smbName + ': ' + nodeIps.join(', '));
                                }
                            }
                        } else if (nodeCount === 3) {
                            // 3-node switchless dual-link: 4 SMB adapters, 6 subnets
                            // Subnet pairs: 1-2 (Node1↔Node2), 3-4 (Node1↔Node3), 5-6 (Node2↔Node3)
                            const subnetPairs3 = { 1: [1, 2], 2: [1, 2], 3: [1, 3], 4: [1, 3], 5: [2, 3], 6: [2, 3] };
                            const nodeToSubnetBySmb3 = { 1: [1, 2, 3, 4], 2: [1, 2, 5, 6], 3: [3, 4, 5, 6] };

                            for (var smbIdx = 1; smbIdx <= 4; smbIdx++) {
                                var nodeIps = [];
                                for (var nodeNum = 1; nodeNum <= 3; nodeNum++) {
                                    var subnets = nodeToSubnetBySmb3[nodeNum];
                                    var subnetNum = subnets[smbIdx - 1];
                                    var pair = subnetPairs3[subnetNum];
                                    var hostOctet = (nodeNum === pair[0]) ? 2 : 3;
                                    var prefix = getSubnetPrefix(validSubnets[subnetNum - 1]);
                                    if (prefix) {
                                        nodeIps.push(getNodeName(nodeNum - 1) + ': ' + prefix + '.' + hostOctet);
                                    }
                                }
                                if (nodeIps.length > 0) {
                                    // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                                    var smbName = getPortCustomName(s, smbIdx + 2, 'nic');
                                    storageIpDetails.push(smbName + ': ' + nodeIps.join(', '));
                                }
                            }
                        } else if (nodeCount === 4) {
                            // 4-node switchless dual-link: 6 SMB adapters, 12 subnets
                            const subnetPairs4 = { 1: [1, 2], 2: [1, 2], 3: [1, 3], 4: [1, 3], 5: [1, 4], 6: [1, 4],
                                7: [2, 3], 8: [2, 3], 9: [2, 4], 10: [2, 4], 11: [3, 4], 12: [3, 4] };
                            const nodeToSubnetBySmb4 = { 1: [1, 2, 3, 4, 5, 6], 2: [1, 2, 7, 8, 9, 10],
                                3: [3, 4, 7, 8, 11, 12], 4: [5, 6, 9, 10, 11, 12] };

                            for (var smbIdx = 1; smbIdx <= 6; smbIdx++) {
                                var nodeIps = [];
                                for (var nodeNum = 1; nodeNum <= 4; nodeNum++) {
                                    var subnets = nodeToSubnetBySmb4[nodeNum];
                                    var subnetNum = subnets[smbIdx - 1];
                                    var pair = subnetPairs4[subnetNum];
                                    var hostOctet = (nodeNum === pair[0]) ? 2 : 3;
                                    var prefix = getSubnetPrefix(validSubnets[subnetNum - 1]);
                                    if (prefix) {
                                        nodeIps.push(getNodeName(nodeNum - 1) + ': ' + prefix + '.' + hostOctet);
                                    }
                                }
                                if (nodeIps.length > 0) {
                                    // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                                    var smbName = getPortCustomName(s, smbIdx + 2, 'nic');
                                    storageIpDetails.push(smbName + ': ' + nodeIps.join(', '));
                                }
                            }
                        }
                    }
                    if (storageIpDetails.length > 0) {
                        hostNetworkingRows += row('Storage Adapter IPs', storageIpDetails.join('; '), true);
                    }
                }
            }
        }
        if (s.storagePoolConfiguration) {
            const spConfig = s.storagePoolConfiguration === 'InfraOnly' ? 'Infrastructure Only' :
                s.storagePoolConfiguration === 'KeepStorage' ? 'Keep Existing Storage' : 'Express';
            hostNetworkingRows += row('Storage Pool Configuration', spConfig);
        }

        // Disaggregated host networking summary
        if (s.architecture === 'disaggregated') {
            const stLabel = s.disaggStorageType === 'fc_san' ? 'FC SAN' : s.disaggStorageType === 'iscsi_4nic' ? 'iSCSI 4-NIC' : s.disaggStorageType === 'iscsi_6nic' ? 'iSCSI 6-NIC' : '';
            if (stLabel) hostNetworkingRows += row('Storage Type', stLabel);
            if (s.disaggPortCount) hostNetworkingRows += row('Ports per Node', s.disaggPortCount, true);
            if (s.disaggBackupEnabled) hostNetworkingRows += row('Backup Network', 'Enabled');
            if (s.disaggRackCount) hostNetworkingRows += row('Racks', String(s.disaggRackCount), true);
            if (s.disaggNodesPerRack) hostNetworkingRows += row('Nodes per Rack', String(s.disaggNodesPerRack), true);
            if (s.disaggSpineCount) hostNetworkingRows += row('Spine Switches', String(s.disaggSpineCount), true);

            // Intent mapping — read from adapter mapping when available
            const adapterMap = s.disaggAdapterMapping || {};
            const hasMappingData = Object.keys(adapterMap).length > 0;

            // Determine which ports are in mgmt_compute
            const mgmtPorts = [];
            const cluster1Ports = [];
            const cluster2Ports = [];
            if (hasMappingData) {
                for (const mk in adapterMap) {
                    if (adapterMap[mk] === 'mgmt_compute') mgmtPorts.push(mk.replace(/_p\d+$/, '').toUpperCase());
                    else if (adapterMap[mk] === 'cluster_1') cluster1Ports.push(mk.replace(/_p\d+$/, '').toUpperCase());
                    else if (adapterMap[mk] === 'cluster_2') cluster2Ports.push(mk.replace(/_p\d+$/, '').toUpperCase());
                }
            }
            const mgmtDesc = mgmtPorts.length > 0 ? 'SET Team (' + mgmtPorts.filter(function(v, i, a) { return a.indexOf(v) === i; }).join(' + ') + ' ports)' : 'SET Team (OCP ports)';
            hostNetworkingRows += row('Mgmt + Compute Intent', mgmtDesc);
            const clVlan1 = (s.disaggVlans && s.disaggVlans.cluster1) || '711';
            const clVlan2 = (s.disaggVlans && s.disaggVlans.cluster2) || '712';
            hostNetworkingRows += row('Cluster Network 1', 'Standalone, VLAN ' + clVlan1 + ' → Leaf-A');
            hostNetworkingRows += row('Cluster Network 2', 'Standalone, VLAN ' + clVlan2 + ' → Leaf-B');

            if (s.disaggStorageType === 'iscsi_4nic') {
                hostNetworkingRows += row('iSCSI', 'Shared with physical NIC3/NIC4 Cluster paths (same VLAN/subnet/source IP)');
            } else if (s.disaggStorageType === 'iscsi_6nic') {
                const iscsiA = (s.disaggVlans && s.disaggVlans.iscsiA) || '300';
                const iscsiB = (s.disaggVlans && s.disaggVlans.iscsiB) || '400';
                hostNetworkingRows += row('iSCSI Storage A', 'Standalone, VLAN ' + iscsiA + ' → Leaf-A');
                hostNetworkingRows += row('iSCSI Storage B', 'Standalone, VLAN ' + iscsiB + ' → Leaf-B');
            } else if (s.disaggStorageType === 'fc_san') {
                hostNetworkingRows += row('FC SAN', 'FC HBA → Separate SAN Fabric (MPIO)');
            }

            if (s.disaggBackupEnabled) {
                const bkVlan = (s.disaggVlans && s.disaggVlans.backup) || '800';
                hostNetworkingRows += row('Backup Intent', 'Compute Intent (SET), VLAN ' + bkVlan);
            }

            // Standalone NIC subnets
            if (s.disaggSubnets) {
                if (s.disaggSubnets.cluster1) hostNetworkingRows += row('Cluster 1 Subnet', s.disaggSubnets.cluster1, true);
                if (s.disaggSubnets.cluster2) hostNetworkingRows += row('Cluster 2 Subnet', s.disaggSubnets.cluster2, true);
                if (s.disaggSubnets.iscsiA) hostNetworkingRows += row('iSCSI A Subnet', s.disaggSubnets.iscsiA, true);
                if (s.disaggSubnets.iscsiB) hostNetworkingRows += row('iSCSI B Subnet', s.disaggSubnets.iscsiB, true);
                if (s.disaggSubnets.backup) hostNetworkingRows += row('Backup Subnet', s.disaggSubnets.backup, true);
            }
        }


        // Step 12–14: Infrastructure Network
        let infraNetworkRows = '';
        if (s.ip) infraNetworkRows += row('IP', s.ip.charAt(0).toUpperCase() + s.ip.slice(1));
        if (s.infraVlan) infraNetworkRows += row('Infra VLAN', s.infraVlan === 'custom' ? 'Custom VLAN' : 'Default VLAN');
        if (s.infraVlan === 'custom' && s.infraVlanId) infraNetworkRows += row('Infra VLAN ID', s.infraVlanId, true);
        if (s.infraCidr) infraNetworkRows += row('Infra Network', s.infraCidr, true);
        if (s.infra && s.infra.start && s.infra.end) infraNetworkRows += row('Infra Range', s.infra.start + ' - ' + s.infra.end, true);
        if (s.infraGateway) infraNetworkRows += row('Default Gateway', s.infraGateway, true);
        // Display appliance IPs for disconnected management cluster
        if (s.scenario === 'disconnected' && (s.applianceIp1 || s.applianceIp2)) {
            let ipLabel = '';
            if (s.applianceIp1) ipLabel += 'Ingress vNIC: ' + s.applianceIp1;
            if (s.applianceIp1 && s.applianceIp2) ipLabel += ' · ';
            if (s.applianceIp2) ipLabel += 'Mgmt vNIC: ' + s.applianceIp2;
            infraNetworkRows += row('Appliance IPs', ipLabel, true);
        }
        // Display node IP addresses for ARM template (always shown when nodeSettings is populated)
        if (Array.isArray(s.nodeSettings) && s.nodeSettings.length > 0) {
            const nodeIpList = s.nodeSettings
                .map(function(n, idx) {
                    if (!n) return null;
                    const nodeName = n.name ? String(n.name).trim() : ('Node' + (idx + 1));
                    const ip = n.ipCidr ? String(n.ipCidr).split('/')[0] : null;
                    if (ip) {
                        return nodeName + ': ' + ip;
                    }
                    return null;
                })
                .filter(function(item) { return item !== null; });
            if (nodeIpList.length > 0) {
                infraNetworkRows += row('Node IPs', nodeIpList.join(', '), true);
            }
        }

        // Step 15: Active Directory
        let activeDirectoryRows = '';
        if (s.activeDirectory) activeDirectoryRows += row('Identity', s.activeDirectory === 'azure_ad' ? 'Active Directory' : 'Local Identity');
        if (s.adDomain) activeDirectoryRows += row('AD Domain', s.adDomain, true);
        if (s.adOuPath) activeDirectoryRows += row('AD OU Path', s.adOuPath, true);
        if (s.adfsServerName) activeDirectoryRows += row('ADFS Server Name', s.adfsServerName, true);
        if (s.dnsServers && s.dnsServers.length) activeDirectoryRows += row('DNS Servers', s.dnsServers.join(', '), true);
        if (s.localDnsZone) activeDirectoryRows += row('Local DNS Zone', s.localDnsZone, true);

        // Step 16: Security Configuration
        let securityRows = '';
        if (s.securityConfiguration) {
            securityRows += row('Configuration', s.securityConfiguration === 'recommended' ? 'Recommended' : 'Customized');
            // Always list all 7 controls. Recommended mode = all enforced (matches wizard
            // defaults); Customized mode reflects the user's per-control selections.
            const secSettings = (s.securityConfiguration === 'customized' && s.securitySettings) ? s.securitySettings : null;
            const secOn = function(key) { return secSettings ? (secSettings[key] !== undefined ? secSettings[key] : true) : true; };
            securityRows += row('WDAC', secOn('wdacEnforced') ? 'Enabled' : 'Disabled');
            securityRows += row('Credential Guard', secOn('credentialGuardEnforced') ? 'Enabled' : 'Disabled');
            securityRows += row('Drift Control', secOn('driftControlEnforced') ? 'Enabled' : 'Disabled');
            securityRows += row('SMB Signing', secOn('smbSigningEnforced') ? 'Enabled' : 'Disabled');
            securityRows += row('SMB Cluster Encryption', secOn('smbClusterEncryption') ? 'Enabled' : 'Disabled');
            securityRows += row('BitLocker Boot Volume', secOn('bitlockerBootVolume') ? 'Enabled' : 'Disabled');
            securityRows += row('BitLocker Data Volumes', secOn('bitlockerDataVolumes') ? 'Enabled' : 'Disabled');
        }

        // Step 17: Software Defined Networking
        let sdnRows = '';
        if (s.sdnFeatures && s.sdnFeatures.length) sdnRows += row('SDN Features', s.sdnFeatures.join(', '));
        if (s.sdnManagement) sdnRows += row('SDN Management', s.sdnManagement === 'arc_managed' ? 'Arc Managed' : 'On-Premises Managed');

        function section(title, cls, rowsHtml, dataKey) {
            if (!rowsHtml) return '';
            const dataAttr = dataKey ? (' data-summary-section="' + escapeHtml(dataKey) + '"') : '';
            return '<div class="summary-section"' + dataAttr + '>'
                + '<div class="summary-section-title ' + cls + '">' + escapeHtml(title) + '</div>'
                + rowsHtml
                + '</div>';
        }

        function sectionWithExtra(title, cls, rowsHtml, extraHtml, dataKey) {
            if (!rowsHtml && !extraHtml) return '';
            const dataAttr = dataKey ? (' data-summary-section="' + escapeHtml(dataKey) + '"') : '';
            return '<div class="summary-section"' + dataAttr + '>'
                + '<div class="summary-section-title ' + cls + '">' + escapeHtml(title) + '</div>'
                + (rowsHtml || '')
                + (extraHtml || '')
                + '</div>';
        }

        // Sizer Hardware Configuration (only present when imported from Sizer)
        let sizerHardwareRows = '';
        if (s.sizerHardware) {
            const hw = s.sizerHardware;
            if (hw.cpu) {
                sizerHardwareRows += row('CPU', hw.cpu.generation || '-');
                sizerHardwareRows += row('Cores per Socket', String(hw.cpu.coresPerSocket || '-'));
                sizerHardwareRows += row('CPU Sockets', String(hw.cpu.sockets || '-'));
                sizerHardwareRows += row('Total Physical Cores per Node', String(hw.cpu.totalCores || '-'));
            }
            if (hw.memory) {
                sizerHardwareRows += row('Memory per Node', (hw.memory.perNodeGB || '-') + ' GB');
            }
            if (hw.gpu && hw.gpu.countPerNode > 0) {
                sizerHardwareRows += row('GPU per Node', hw.gpu.countPerNode + ' × ' + (hw.gpu.type || '-'));
            }
            if (hw.vcpuRatio) {
                sizerHardwareRows += row('vCPU Ratio (pCPU:vCPU)', hw.vcpuRatio + ':1');
            }
            if (hw.storage) {
                const storageLabel = hw.storage.config === 'all-flash' ? 'All-Flash' :
                    hw.storage.config === 'mixed-flash' ? 'Mixed All-Flash (NVMe + SSD)' :
                        hw.storage.config === 'hybrid' ? 'Hybrid (SSD/NVMe + HDD)' : (hw.storage.config || '-');
                sizerHardwareRows += row('Storage Configuration', storageLabel);
                if (hw.storage.diskConfig) {
                    const dc = hw.storage.diskConfig;
                    if (dc.isTiered && dc.cache && dc.capacity) {
                        sizerHardwareRows += row('Cache Disks', dc.cache.count + '× ' + (dc.cache.sizeGB >= 1024 ? (dc.cache.sizeGB / 1024).toFixed(1) + ' TB' : dc.cache.sizeGB + ' GB') + ' (' + (dc.cache.type || '') + ')');
                        sizerHardwareRows += row('Capacity Disks', dc.capacity.count + '× ' + (dc.capacity.sizeGB >= 1024 ? (dc.capacity.sizeGB / 1024).toFixed(1) + ' TB' : dc.capacity.sizeGB + ' GB') + ' (' + (dc.capacity.type || '') + ')');
                    } else if (dc.capacity) {
                        sizerHardwareRows += row('Capacity Disks', dc.capacity.count + '× ' + (dc.capacity.sizeGB >= 1024 ? (dc.capacity.sizeGB / 1024).toFixed(1) + ' TB' : dc.capacity.sizeGB + ' GB') + ' (' + (dc.capacity.type || '') + ')');
                    }
                }
            }
            if (hw.resiliency) {
                const resLabel = hw.resiliency === '3way' ? 'Three-way Mirror' :
                    hw.resiliency === '2way' ? 'Two-way Mirror' :
                        hw.resiliency === 'simple' ? 'Simple' : (hw.resiliency || '-');
                sizerHardwareRows += row('Storage Resiliency', resLabel);
            }
            if (hw.futureGrowth && hw.futureGrowth !== '0') {
                sizerHardwareRows += row('Future Growth', hw.futureGrowth + '%');
            }
            if (hw.clusterType) {
                const ctLabels = { 'single': 'Single Node', 'standard': 'Standard Cluster', 'rack-aware': 'Rack Aware Cluster' };
                sizerHardwareRows += row('Cluster Type', ctLabels[hw.clusterType] || hw.clusterType);
            }
            if (hw.workloadSummary) {
                const ws = hw.workloadSummary;
                sizerHardwareRows += row('Workloads', String(ws.count || 0));
                sizerHardwareRows += row('Total vCPUs Required', String(ws.totalVcpus || 0));
                sizerHardwareRows += row('Total Memory Required', (ws.totalMemoryGB || 0) + ' GB');
                sizerHardwareRows += row('Total Storage Required', (ws.totalStorageTB || 0) + ' TB');
            }
        }

        // Power, Heat & Rack Space (from Sizer) — only present when imported
        // from the Sizer with a populated power estimate.
        let sizerPowerRows = '';
        if (s.sizerHardware && s.sizerHardware.power) {
            const pw = s.sizerHardware.power;
            sizerPowerRows += row('Per-Node Power (est.)', (pw.perNodeW || 0).toLocaleString() + ' Watts');
            sizerPowerRows += row('Total Instance Power (est.)', (pw.totalW || 0).toLocaleString() + ' Watts');
            sizerPowerRows += row('Heat Output (est.)', (pw.totalBtu || 0).toLocaleString() + ' BTU/hr');
            if (pw.annualKwh != null && isFinite(pw.annualKwh)) {
                const kwh = pw.annualKwh;
                const energyText = (kwh >= 1000000)
                    ? (kwh / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' MWh/yr'
                    : Math.round(kwh).toLocaleString() + ' kWh/yr';
                sizerPowerRows += row('Total Annual Energy (est.)', energyText);
            }
            if (pw.rackUnits) {
                sizerPowerRows += row('Rack Units (est.)', pw.rackUnits + 'U');
            }
            if (pw.infraPowerW) {
                sizerPowerRows += row('Network Infrastructure Power', (pw.infraPowerW || 0).toLocaleString() + ' W'
                    + (pw.infraPowerNote ? ' <span style="font-size: 0.85em; opacity: 0.75;">(' + escapeHtml(pw.infraPowerNote) + ')</span>' : ''));
            }
            if (pw.components) {
                const c = pw.components;
                const perNodeBreakdown = 'CPU ' + (c.cpuW || 0) + 'W'
                    + ' + Memory ' + (c.memoryW || 0) + 'W'
                    + ' + Disks ' + ((c.dataDisksW || 0) + (c.bootDisksW || 0)) + 'W'
                    + (c.gpuW > 0 ? ' + GPU ' + c.gpuW + 'W' : '')
                    + ' + Base ' + (c.baseOverheadW || 0) + 'W'
                    + (c.psuEfficiency ? ' (PSU ' + Math.round(c.psuEfficiency * 100) + '% eff.)' : '');
                sizerPowerRows += row('Per-Node Breakdown', perNodeBreakdown);
            }
        }

        // Sizer Workloads (individual workload details from Sizer)
        let sizerWorkloadsRows = '';
        if (Array.isArray(s.sizerWorkloads) && s.sizerWorkloads.length > 0) {
            const typeLabels = { 'vm': 'Azure Local VMs', 'aks': 'AKS Arc Cluster', 'avd': 'Azure Virtual Desktop', 'foundry': 'Foundry Local', 'edgerag': 'Edge RAG', 'videoindexer': 'AI Video Indexer' };
            const avdProfileLabels = { 'light': 'Light', 'medium': 'Medium', 'heavy': 'Heavy', 'power': 'Power', 'custom': 'Custom' };
            const foundryClassLabels = { 'small': 'Small SLM', 'medium': 'Medium SLM', 'large': 'Large LLM', 'custom': 'Custom' };
            for (let wi = 0; wi < s.sizerWorkloads.length; wi++) {
                const wl = s.sizerWorkloads[wi];
                const wlLabel = wl.name || typeLabels[wl.type] || wl.type;
                // Workload summary row
                sizerWorkloadsRows += '<div class="summary-row" style="border-top: 1px solid var(--glass-border); margin-top: 0.5rem; padding-top: 0.5rem;">'
                    + '<div class="summary-label" style="font-weight: 600;">' + escapeHtml(wlLabel) + '</div>'
                    + '<div class="summary-value" style="font-weight: 600;">' + escapeHtml(typeLabels[wl.type] || wl.type) + '</div>'
                    + '</div>';
                // Type-specific details
                if (wl.type === 'vm') {
                    sizerWorkloadsRows += row('VM Count', String(wl.count || 0));
                    sizerWorkloadsRows += row('vCPUs per VM', String(wl.vcpusPerVm || 0));
                    sizerWorkloadsRows += row('Memory per VM', (wl.memoryPerVmGB || 0) + ' GB');
                    sizerWorkloadsRows += row('Storage per VM', (wl.storagePerVmGB || 0) + ' GB');
                } else if (wl.type === 'aks') {
                    sizerWorkloadsRows += row('Clusters', String(wl.clusterCount || 0));
                    sizerWorkloadsRows += row('Control Plane', (wl.controlPlaneNodes || 0) + ' nodes × ' + (wl.controlPlaneVcpus || 0) + ' vCPU / ' + (wl.controlPlaneMemory || 0) + ' GB');
                    sizerWorkloadsRows += row('Workers', (wl.workerNodes || 0) + ' nodes × ' + (wl.workerVcpus || 0) + ' vCPU / ' + (wl.workerMemory || 0) + ' GB / ' + (wl.workerStorage || 0) + ' GB');
                } else if (wl.type === 'avd') {
                    sizerWorkloadsRows += row('Users', String(wl.userCount || 0));
                    sizerWorkloadsRows += row('Profile', avdProfileLabels[wl.profile] || wl.profile || '-');
                    sizerWorkloadsRows += row('Session Type', (wl.sessionType === 'single' ? 'Single-session' : 'Multi-session'));
                    if (wl.sessionType !== 'single') {
                        sizerWorkloadsRows += row('Concurrency', (wl.concurrency || 100) + '%');
                    }
                    if (wl.fslogix) {
                        sizerWorkloadsRows += row('FSLogix', (wl.fslogixSize || 30) + ' GB per user');
                    }
                    if (wl.profile === 'custom') {
                        sizerWorkloadsRows += row('Custom Spec', (wl.customVcpus || 0) + ' vCPU / ' + (wl.customMemory || 0) + ' GB / ' + (wl.customStorage || 0) + ' GB per user');
                    }
                } else if (wl.type === 'foundry') {
                    sizerWorkloadsRows += row('Model Class', foundryClassLabels[wl.modelClass] || wl.modelClass || '-');
                    sizerWorkloadsRows += row('Replicas', String(wl.replicas || 1));
                    sizerWorkloadsRows += row('Inference Engine', (wl.engine === 'vllm' ? 'vLLM (GPU only)' : 'ONNX-GenAI (CPU or GPU)'));
                    if (wl.modelClass === 'custom') {
                        sizerWorkloadsRows += row('Custom Spec', (wl.customVcpus || 0) + ' vCPU / ' + (wl.customMemory || 0) + ' GB / ' + (wl.customStorage || 0) + ' GB per replica');
                    }
                } else if (wl.type === 'edgerag') {
                    sizerWorkloadsRows += row('Compute Mode', (wl.computeMode === 'cpu' ? 'CPU mode (≤ 5 MB per file)' : 'GPU mode (recommended, ≤ 30 MB per file)'));
                    sizerWorkloadsRows += row('Worker VMs', '4 (' + (wl.computeMode === 'cpu' ? '8 vCPU / 32 GB / 200 GB OS each' : 'NC8_A2 / NC8_A16 — 8 vCPU / 32 GB / 1 GPU / 200 GB OS each') + ')');
                    sizerWorkloadsRows += row('Document Corpus', (wl.corpusGB || 0) + ' GB');
                } else if (wl.type === 'videoindexer') {
                    const viIsMinH = wl.configuration === 'minimum';
                    sizerWorkloadsRows += row('Configuration', viIsMinH ? 'Minimum (1 worker)' : 'Recommended (2 workers, HA)');
                    sizerWorkloadsRows += row('Cluster-wide compute', viIsMinH ? '32 vCPU / 64 GB' : '64 vCPU / 256 GB');
                    sizerWorkloadsRows += row('PV storage', viIsMinH ? '50 GB (ReadWriteMany)' : '100 GB (ReadWriteMany)');
                }
                // Totals for this workload
                sizerWorkloadsRows += row('Subtotal', wl.totalVcpus + ' vCPUs • ' + wl.totalMemoryGB + ' GB memory • ' + (wl.totalStorageGB >= 1024 ? (wl.totalStorageGB / 1024).toFixed(1) + ' TB' : wl.totalStorageGB + ' GB') + ' storage');
            }
        }

        // AKS Arc Network Requirements — always shown in the report.
        // Even Designer-only users (no Sizer workloads) may add AKS Arc to
        // their cluster later, so the port table + docs link is always
        // useful. The native AKS Arc workload, Foundry Local, Edge RAG, and
        // AI Video Indexer all run on AKS Arc and inherit these requirements.
        let aksNetworkRows = '';
        {
            aksNetworkRows += '<div style="margin-bottom: 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">'
                + '<a href="https://learn.microsoft.com/en-us/azure/aks/aksarc/network-system-requirements#network-port-and-cross-vlan-requirements" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary); text-decoration: underline;">AKS Arc network &amp; port requirements documentation</a>'
                + '</div>'
                + '<table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 0.5rem;">'
                + '<thead><tr style="border-bottom: 2px solid var(--glass-border); text-align: left;">'
                + '<th style="padding: 6px 8px;">Source</th>'
                + '<th style="padding: 6px 8px;">Destination</th>'
                + '<th style="padding: 6px 8px;">Port</th>'
                + '<th style="padding: 6px 8px;">Description</th>'
                + '</tr></thead><tbody>'
                + '<tr style="border-bottom: 1px solid var(--glass-border);"><td style="padding: 6px 8px;">Management network IPs</td><td style="padding: 6px 8px;">AKS Arc VM logical network</td><td style="padding: 6px 8px; font-family: monospace;">22</td><td style="padding: 6px 8px;">Log collection for troubleshooting</td></tr>'
                + '<tr style="border-bottom: 1px solid var(--glass-border);"><td style="padding: 6px 8px;">Management network IPs</td><td style="padding: 6px 8px;">AKS Arc VM logical network</td><td style="padding: 6px 8px; font-family: monospace;">6443</td><td style="padding: 6px 8px;">Kubernetes API communication</td></tr>'
                + '<tr style="border-bottom: 1px solid var(--glass-border);"><td style="padding: 6px 8px;">AKS Arc VM logical network</td><td style="padding: 6px 8px;">Cluster IP address</td><td style="padding: 6px 8px; font-family: monospace;">55000</td><td style="padding: 6px 8px;">Cloud Agent gRPC server</td></tr>'
                + '<tr style="border-bottom: 1px solid var(--glass-border);"><td style="padding: 6px 8px;">AKS Arc VM logical network</td><td style="padding: 6px 8px;">Cluster IP address</td><td style="padding: 6px 8px; font-family: monospace;">65000</td><td style="padding: 6px 8px;">Cloud Agent gRPC authentication</td></tr>'
                + '</tbody></table>'
                + '<div style="font-size: 0.8rem; color: var(--text-secondary); font-style: italic;">If using separate VLANs, bi-directional cross-VLAN connectivity is required between management network and AKS Arc VM logical network for all ports above.</div>';
        }

        // vNIC Configuration section removed — no longer applicable
        const vnicConfigSection = '';

        // Outbound, Arc, Proxy & Private Endpoints (connectivity summary)
        let connectivityRows = '';
        if (s.outbound) connectivityRows += row('Outbound', formatOutbound(s.outbound));
        if (s.arc) {
            const arcText = s.arc === 'arc_gateway' ? (s.outbound === 'private' ? 'Required' : 'Enabled') : 'Disabled';
            connectivityRows += row('Arc Gateway', arcText);
        }
        if (s.proxy) {
            const proxyText = s.proxy === 'no_proxy' ? 'Disabled' : (s.outbound === 'private' ? 'Required (Azure Firewall Explicit Proxy)' : 'Enabled');
            connectivityRows += row('Proxy', proxyText);
        }
        if (s.privateEndpoints) connectivityRows += row('Private Endpoints', s.privateEndpoints === 'pe_enabled' ? 'Enabled (' + (s.privateEndpointsList ? s.privateEndpointsList.length : 0) + ' services)' : 'Disabled');
        if (s.scenario === 'disconnected') {
            connectivityRows += '<div class="summary-row">'
                + '<div class="summary-label">' + escapeHtml('Network Requirements') + '</div>'
                + '<div class="summary-value"><a href="https://learn.microsoft.com/azure/azure-local/manage/disconnected-operations-network" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary); text-decoration: underline;">Plan your network for disconnected operations</a></div>'
                + '</div>';
        } else if (s.arc || s.localInstanceRegion) {
            const fwInfo = getFirewallEndpointInfo(s);
            connectivityRows += '<div class="summary-row">'
                + '<div class="summary-label">' + escapeHtml('Firewall Allow List Endpoint Requirements') + '</div>'
                + '<div class="summary-value"><a href="' + escapeHtml(fwInfo.url) + '" target="_blank" rel="noopener noreferrer" style="color: var(--accent-primary); text-decoration: underline;">' + escapeHtml(fwInfo.label) + '</a></div>'
                + '</div>';
        }

        let connectivityExtra = '';
        const connDiagramKey = getOutboundDiagramKey(s);
        if (connDiagramKey && OUTBOUND_DIAGRAMS[connDiagramKey]) {
            const connDiagramUrl = OUTBOUND_DIAGRAMS[connDiagramKey];
            const connDiagramTitle = getOutboundDiagramTitle(s);
            const connIsDisconnected = s.scenario === 'disconnected';
            const connHasDrawio = connIsDisconnected && OUTBOUND_DRAWIO[connDiagramKey];
            const connClusterRoleAttr = (connIsDisconnected && s.clusterRole) ? ' data-cluster-role="' + escapeHtml(s.clusterRole) + '"' : '';
            connectivityExtra = '<div id="outbound-connectivity-diagram" style="margin-top:1.5rem;">'
                + '<h4 style="margin-bottom: 0.75rem; color: var(--text-primary); font-size: 1.1rem; font-weight: 600;">' + escapeHtml(connDiagramTitle) + '</h4>'
                + '<div style="border: 1px solid var(--glass-border); border-radius: 8px; padding: 1rem; background: rgba(0,0,0,0.15);">'
                + '<div id="outbound-diagram-container" data-diagram-url="' + escapeHtml(connDiagramUrl) + '"' + connClusterRoleAttr + '>'
                + '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Loading diagram...</div>'
                + '</div>'
                + '</div>'
                + '<div class="no-print" style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">'
                + '<button type="button" class="report-action-button" onclick="window.downloadOutboundConnectivityDiagramSvg(\'light\')">Download SVG (Light)</button>'
                + '<button type="button" class="report-action-button" onclick="window.downloadOutboundConnectivityDiagramSvg(\'dark\')">Download SVG (Dark)</button>'
                + (connHasDrawio ? '<button type="button" class="report-action-button" onclick="window.downloadOutboundConnectivityDrawio()">Download .drawio</button>' : '')
                + (connIsDisconnected ? '<button type="button" class="report-action-button" onclick="window.openDiagramZoom()" title="View diagram in full-screen zoom window">&#x1F50D; Expand</button>' : '')
                + '</div>'
                + (connIsDisconnected && s.clusterRole
                    ? '<p style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); text-align: center;">'
                    + '<span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ' + (s.clusterRole === 'management' ? '#10b981' : '#3b82f6') + '; margin-right: 4px; vertical-align: middle;"></span>'
                    + 'Highlighted: <strong>' + (s.clusterRole === 'management' ? 'Management' : 'Workload') + ' Cluster</strong> (your configured cluster role)'
                    + '</p>'
                    : '')
                + (connIsDisconnected ? '' : '<p style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); text-align: center;">'
                + '<a href="../docs/outbound-connectivity/" target="_blank" style="color: var(--accent-blue); text-decoration: none;">\ud83d\udcd8 View complete Outbound Connectivity Guide</a>'
                + ' \u00b7 <a href="https://cristianedwards.github.io/AzLoFlows/" target="_blank" rel="noopener noreferrer" style="color: var(--accent-blue); text-decoration: none;">\ud83d\udd00 Interactive Diagram Builder</a>'
                + '</p>')
                + '</div>';
        }

        return section('Scenario & Scale', 'summary-section-title--infra', scenarioScaleRows, 'scenario-scale')
            + section('Hardware Configuration (from Sizer)', 'summary-section-title--infra', sizerHardwareRows, 'sizer-hardware')
            + section('Workloads (from Sizer)', 'summary-section-title--infra', sizerWorkloadsRows, 'sizer-workloads')
            + section('Power, Heat & Rack Space (from Sizer)', 'summary-section-title--infra', sizerPowerRows, 'sizer-power')
            + section('Host Networking', 'summary-section-title--net', hostNetworkingRows, 'host-networking')
            + vnicConfigSection
            + sectionWithExtra('AKS Arc Network Requirements', 'summary-section-title--net', aksNetworkRows, '', 'aks-network')
            + section('Infrastructure Network', 'summary-section-title--infra', infraNetworkRows, 'infrastructure-network')
            + sectionWithExtra('Outbound, Arc, Proxy & Private Endpoints', 'summary-section-title--mgmt', connectivityRows, connectivityExtra, 'connectivity')
            + section('Active Directory', 'summary-section-title--mgmt', activeDirectoryRows, 'active-directory')
            + section('Security Configuration', 'summary-section-title--mgmt', securityRows, 'security')
            + section('Software Defined Networking', 'summary-section-title--net', sdnRows, 'sdn');
    }

    function init() {
        const payload = tryParsePayload();
        const metaEl = document.getElementById('report-meta');
        const sumEl = document.getElementById('report-summary');
        const valEl = document.getElementById('report-validations');
        const ratEl = document.getElementById('report-rationale');

        if (!payload || !payload.state) {
            if (metaEl) {
                metaEl.innerHTML = '<strong style="color:#ffc107;">No configuration found</strong><br>Open this report using the "Generate configuration report" button from the wizard.';
            }
            return;
        }

        const s = payload.state;
        CURRENT_REPORT_STATE = s;

        if (metaEl) {
            metaEl.innerHTML = '<strong>Generated</strong><br>'
                + escapeHtml(payload.generatedAt || '-')
                + '<br><strong>Scenario</strong><br>'
                + escapeHtml(formatScenario(s.scenario, s));
        }

        // Rack diagram (SVG) — shown when we know the topology
        if (typeof generateRackSvg === 'function') {
            const rackSection = document.getElementById('rack-diagram-section');
            const rackContainer = document.getElementById('rack-diagram-container');
            const rackActions = document.getElementById('rack-diagram-actions');
            if (rackSection && rackContainer) {
                let svgStr;

                // Resolve real node display names (#233) from the saved config's
                // nodeSettings, indexed by global node order. Falls back to
                // 'Node N' inside the generators when a name is blank/unset.
                const rackNodeNames = (Array.isArray(s.nodeSettings) ? s.nodeSettings : []).map(function(node) {
                    return node && node.name ? String(node.name).trim() : '';
                });

                if (s.architecture === 'disaggregated' && typeof generateDisaggregatedRackSvg === 'function') {
                    // Disaggregated: use dynamic Clos topology diagram
                    svgStr = generateDisaggregatedRackSvg({
                        storageType: s.disaggStorageType || 'fc_san',
                        backupEnabled: s.disaggBackupEnabled || false,
                        rackCount: parseInt(s.disaggRackCount, 10) || 4,
                        nodesPerRack: parseInt(s.disaggNodesPerRack, 10) || 16,
                        spineCount: parseInt(s.disaggSpineCount, 10) || 2,
                        nodeNames: rackNodeNames
                    });
                } else {
                    // HCI: existing rack diagram
                    const hw = s.sizerHardware || {};
                    const rackNodeCount = parseInt(s.nodes === '16+' ? 16 : s.nodes, 10) || 2;
                    const rackHasGpu = (hw.gpu && hw.gpu.countPerNode > 0) || false;

                    let rackClusterType = 'standard';
                    if (hw.clusterType) {
                        rackClusterType = hw.clusterType;
                    } else if (s.scale === 'rack_aware') {
                        rackClusterType = 'rack-aware';
                    } else if (s.scale === 'low_capacity' && rackNodeCount === 1) {
                        rackClusterType = 'single';
                    }

                    svgStr = generateRackSvg({
                        clusterType: rackClusterType,
                        nodeCount: rackNodeCount,
                        hasGpu: rackHasGpu,
                        nodeNames: rackNodeNames
                    });
                }

                rackContainer.innerHTML = svgStr;
                rackSection.style.display = '';

                // Download SVG button
                if (rackActions) {
                    rackActions.style.display = '';
                    const dlBtn = document.createElement('button');
                    dlBtn.type = 'button';
                    dlBtn.className = 'report-action-button';
                    dlBtn.textContent = 'Download Rack Diagram SVG';
                    dlBtn.addEventListener('click', function() {
                        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = s.architecture === 'disaggregated' ? 'disaggregated-rack-layout.svg' : 'rack-layout.svg';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    });
                    rackActions.appendChild(dlBtn);

                    // Download Draw.io button
                    const drawioBtn = document.createElement('button');
                    drawioBtn.type = 'button';
                    drawioBtn.className = 'report-action-button';
                    drawioBtn.textContent = 'Download Rack Diagram Draw.io';
                    drawioBtn.addEventListener('click', function() {
                        let drawioXml;
                        if (s.architecture === 'disaggregated' && typeof generateDisaggregatedRackDrawio === 'function') {
                            drawioXml = generateDisaggregatedRackDrawio({
                                storageType: s.disaggStorageType || 'fc_san',
                                backupEnabled: s.disaggBackupEnabled || false,
                                rackCount: parseInt(s.disaggRackCount, 10) || 4,
                                nodesPerRack: parseInt(s.disaggNodesPerRack, 10) || 16,
                                spineCount: parseInt(s.disaggSpineCount, 10) || 2,
                                nodeNames: rackNodeNames
                            });
                        } else if (typeof generateRackDrawio === 'function') {
                            const hw2 = s.sizerHardware || {};
                            const rn2 = parseInt(s.nodes === '16+' ? 16 : s.nodes, 10) || 2;
                            const gpu2 = (hw2.gpu && hw2.gpu.countPerNode > 0) || false;
                            let ct2 = 'standard';
                            if (hw2.clusterType) { ct2 = hw2.clusterType; } else if (s.scale === 'rack_aware') { ct2 = 'rack-aware'; } else if (s.scale === 'low_capacity' && rn2 === 1) { ct2 = 'single'; }
                            drawioXml = generateRackDrawio({ clusterType: ct2, nodeCount: rn2, hasGpu: gpu2, nodeNames: rackNodeNames });
                        }
                        if (!drawioXml) return;
                        const blob2 = new Blob([drawioXml], { type: 'application/xml' });
                        const url2 = URL.createObjectURL(blob2);
                        const a2 = document.createElement('a');
                        a2.href = url2;
                        a2.download = s.architecture === 'disaggregated' ? 'disaggregated-rack-layout.drawio' : 'rack-layout.drawio';
                        document.body.appendChild(a2);
                        a2.click();
                        document.body.removeChild(a2);
                        URL.revokeObjectURL(url2);
                    });
                    rackActions.appendChild(drawioBtn);
                }
            }
        }

        if (sumEl) {
            sumEl.innerHTML = renderSummaryCards(s);
            // Fetch the outbound diagram SVG inline and apply cluster highlighting
            loadAndHighlightOutboundDiagram();
        }

        if (valEl) {
            const validations = computeValidations(s);
            valEl.innerHTML = renderValidationSummary(validations);
        }

        if (ratEl) {
            // User request: show the diagram under Host Networking summary, not in Decisions & Rationale.
            // We generate the rationale HTML, extract any diagram blocks, and inject them into the summary.
            const rationaleHtml = rationaleForState(s);
            let movedDiagramInnerHtml = '';

            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString('<div id="__wrap">' + rationaleHtml + '</div>', 'text/html');
                const wrap = doc.getElementById('__wrap');

                function extractDiagramBodyByTitle(titleText) {
                    if (!wrap) return '';
                    const titles = wrap.querySelectorAll('.summary-section-title');
                    for (let i = 0; i < titles.length; i++) {
                        const t = titles[i];
                        if (!t || !t.textContent) continue;
                        if (t.textContent.trim() !== titleText) continue;
                        const sectionEl = t.closest('.summary-section');
                        if (!sectionEl) continue;

                        // body is the block() wrapper inner div
                        let bodyEl = null;
                        const divs = sectionEl.getElementsByTagName('div');
                        for (let j = 0; j < divs.length; j++) {
                            const d = divs[j];
                            if (d && d.getAttribute && (d.getAttribute('style') || '').indexOf('line-height') >= 0) {
                                bodyEl = d;
                                break;
                            }
                        }

                        const inner = bodyEl ? bodyEl.innerHTML : sectionEl.innerHTML;
                        sectionEl.parentNode.removeChild(sectionEl);
                        return inner || '';
                    }
                    return '';
                }

                // Pull either diagram (only one should apply for a given storage selection).
                const swl = extractDiagramBodyByTitle('Switchless Storage Connectivity (Diagram)');
                const swd = extractDiagramBodyByTitle('Switched Connectivity (Diagram)');
                const snc = extractDiagramBodyByTitle('Network Connectivity (Diagram)');  // Single-node clusters
                const rac = extractDiagramBodyByTitle('Rack Aware TOR Architecture (Diagram)');
                const dag = extractDiagramBodyByTitle('Disaggregated Host Networking (Diagram)');
                movedDiagramInnerHtml = (swl || rac || swd || snc || dag || '');

                ratEl.innerHTML = wrap ? wrap.innerHTML : rationaleHtml;
            } catch (e) {
                // Fallback: keep existing rationale if extraction fails.
                ratEl.innerHTML = rationaleHtml;
                movedDiagramInnerHtml = '';
            }

            // Inject diagram under Host Networking section in the summary.
            try {
                if (movedDiagramInnerHtml && sumEl) {
                    const hostSec = sumEl.querySelector('[data-summary-section="host-networking"]');
                    if (hostSec) {
                        const container = document.createElement('div');
                        container.style.marginTop = '0.75rem';
                        container.style.paddingTop = '0.75rem';
                        container.style.borderTop = '1px solid var(--glass-border)';
                        container.innerHTML = movedDiagramInnerHtml;
                        hostSec.appendChild(container);

                        // Add a button below the diagram for SVG export.
                        const svg = hostSec.querySelector('svg.switchless-diagram__svg');
                        if (svg) {
                            const btnWrap = document.createElement('div');
                            btnWrap.className = 'no-print';
                            btnWrap.style.marginTop = '0.75rem';
                            btnWrap.style.display = 'flex';
                            btnWrap.style.gap = '0.5rem';

                            const btnLight = document.createElement('button');
                            btnLight.type = 'button';
                            btnLight.className = 'report-action-button';
                            btnLight.textContent = 'Download SVG (Light)';
                            btnLight.addEventListener('click', function() {
                                window.downloadHostNetworkingDiagramSvg('light');
                            });

                            const btnDark = document.createElement('button');
                            btnDark.type = 'button';
                            btnDark.className = 'report-action-button';
                            btnDark.textContent = 'Download SVG (Dark)';
                            btnDark.addEventListener('click', function() {
                                window.downloadHostNetworkingDiagramSvg('dark');
                            });

                            btnWrap.appendChild(btnLight);
                            btnWrap.appendChild(btnDark);

                            const btnDrawio = document.createElement('button');
                            btnDrawio.type = 'button';
                            btnDrawio.className = 'report-action-button';
                            btnDrawio.textContent = 'Download .drawio';
                            btnDrawio.title = 'Download diagram as a draw.io file (editable in draw.io / diagrams.net)';
                            btnDrawio.addEventListener('click', function() {
                                window.downloadHostNetworkingDrawio();
                            });
                            btnWrap.appendChild(btnDrawio);

                            hostSec.appendChild(btnWrap);
                        }
                    }
                }
            } catch (e2) {
                // ignore
            }
        }
    }

    init();
})();

// Export report as PDF using html2canvas + jsPDF
function exportReportPDF() { // eslint-disable-line no-unused-vars
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    // Hide action buttons during capture
    const buttons = mainEl.querySelectorAll('.header-action-btn, .scroll-to-top');
    buttons.forEach(function(b) { b.style.display = 'none'; });

    html2canvas(mainEl, {
        backgroundColor: '#0a0e27',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 900
    }).then(function(canvas) {
        buttons.forEach(function(b) { b.style.display = ''; });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const usableWidth = pageWidth - margin * 2;
        const scaledHeight = (canvas.height * usableWidth) / canvas.width;

        pdf.setFontSize(12);
        pdf.setTextColor(0, 120, 212);
        pdf.text('ODIN — Configuration Report', margin, 10);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text('Generated: ' + new Date().toLocaleString(), margin, 15);

        const startY = 20;
        let remainingHeight = scaledHeight;
        let sourceY = 0;

        while (remainingHeight > 0) {
            const sliceHeight = Math.min(remainingHeight, pageHeight - (sourceY === 0 ? startY : margin) - margin);
            const sliceRatio = sliceHeight / scaledHeight;
            const sourceSliceH = canvas.height * sliceRatio;

            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sourceSliceH;
            const ctx = sliceCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceSliceH, 0, 0, canvas.width, sourceSliceH);

            pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, sourceY === 0 ? startY : margin, usableWidth, sliceHeight);

            remainingHeight -= sliceHeight;
            sourceY += sourceSliceH;
            if (remainingHeight > 0) pdf.addPage();
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        pdf.save('odin-report_' + dateStr + '.pdf');
    }).catch(function(err) {
        buttons.forEach(function(b) { b.style.display = ''; });
        console.error('PDF export failed:', err);
        alert('PDF export failed. See console for details.');
    });
}

