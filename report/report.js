(function () {
    // Expose a minimal API for report.html buttons.
    window.downloadReportHtml = downloadReportHtml;
    window.downloadReportWord = downloadReportWord;
    window.downloadHostNetworkingDiagramSvg = downloadHostNetworkingDiagramSvg;
    window.downloadOutboundConnectivityDiagramSvg = downloadOutboundConnectivityDiagramSvg;
    window.togglePrintFriendly = togglePrintFriendly;

    var CURRENT_REPORT_STATE = null;
    var ARC_GATEWAY_VM_DIAGRAM_URL = 'https://raw.githubusercontent.com/Azure/AzureLocal-Supportability/main/TSG/Networking/Arc-Gateway-Outbound-Connectivity/images/AzureLocalPublicPathFlowsFinal-1Node-Step6-VMFlows.dark.svg';
    var isPrintFriendly = false;

    // Outbound connectivity diagram URLs - use local files from docs folder
    var OUTBOUND_DIAGRAMS = {
        // Public Path diagrams
        'public_no_proxy_no_arc': '../docs/outbound-connectivity/images/public-path-no-proxy-no-arc-gateway.svg',
        'public_proxy_no_arc': '../docs/outbound-connectivity/images/public-path-proxy-no-arc-gateway.svg',
        'public_no_proxy_arc': '../docs/outbound-connectivity/images/public-path-no-proxy-with-arc-gateway.svg',
        'public_proxy_arc': '../docs/outbound-connectivity/images/public-path-with-proxy-and-arc-gateway.svg',
        // Private Path diagram
        'private': '../docs/outbound-connectivity/images/private-path-explicit-proxy-and-arc-gateway.svg'
    };

    // Get the appropriate outbound diagram based on state
    function getOutboundDiagramKey(s) {
        if (!s) return null;
        if (s.outbound === 'private') {
            return 'private';
        }
        // Public path - determine based on arc and proxy settings
        var hasArc = s.arc === 'arc_gateway';
        var hasProxy = s.proxy === 'proxy';
        if (hasArc && hasProxy) return 'public_proxy_arc';
        if (hasArc && !hasProxy) return 'public_no_proxy_arc';
        if (!hasArc && hasProxy) return 'public_proxy_no_arc';
        return 'public_no_proxy_no_arc';
    }

    // Get diagram title based on configuration
    function getOutboundDiagramTitle(s) {
        if (!s) return 'Outbound Connectivity Architecture';
        if (s.outbound === 'private') {
            return 'Private Path: Azure Firewall Explicit Proxy + Arc Gateway';
        }
        var hasArc = s.arc === 'arc_gateway';
        var hasProxy = s.proxy === 'proxy';
        if (hasArc && hasProxy) return 'Public Path: Enterprise Proxy + Arc Gateway (Recommended)';
        if (hasArc && !hasProxy) return 'Public Path: Arc Gateway (No Proxy)';
        if (!hasArc && hasProxy) return 'Public Path: Enterprise Proxy (No Arc Gateway)';
        return 'Public Path: Direct Connection (No Proxy, No Arc Gateway)';
    }

    // Private Endpoints information with detailed configuration
    var PRIVATE_ENDPOINT_INFO = {
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
        var body = document.body;
        var btn = document.getElementById('print-friendly-btn');
        
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
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
        type = type || 'nic';
        try {
            // Check portConfig for custom names (v0.13.0+ feature)
            if (state && Array.isArray(state.portConfig) && state.portConfig[idx1Based - 1]) {
                var customName = state.portConfig[idx1Based - 1].customName;
                if (customName && String(customName).trim()) {
                    return String(customName).trim();
                }
            }
            // Legacy: check nicNames array
            if (state && Array.isArray(state.nicNames) && state.nicNames[idx1Based - 1]) {
                var n0 = String(state.nicNames[idx1Based - 1]).trim();
                if (n0) return n0;
            }
            // Legacy: check nicNames object
            if (state && state.nicNames && typeof state.nicNames === 'object' && state.nicNames[idx1Based]) {
                var n1 = String(state.nicNames[idx1Based]).trim();
                if (n1) return n1;
            }
        } catch (e) {
            // ignore
        }
        // Default naming based on type
        if (type === 'smb') {
            return 'SMB' + idx1Based;
        }
        return 'NIC ' + idx1Based;
    }

    // Convert CIDR notation to wildcard format for proxy bypass
    // e.g., 192.168.20.0/24 -> 192.168.20.*
    // e.g., 172.16.0.0/16 -> 172.16.*.*
    // e.g., 10.0.0.0/8 -> 10.*.*.*
    function convertCidrToWildcard(cidr) {
        if (!cidr) return null;
        var parts = cidr.split('/');
        if (parts.length !== 2) return null;
        
        var ip = parts[0];
        var prefix = parseInt(parts[1], 10);
        var octets = ip.split('.');
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

    // Get storage subnet CIDR for diagram legends.
    // Uses custom subnets when Storage Auto IP is disabled, otherwise returns default examples.
    function getStorageSubnetCidr(state, subnetIndex, defaultCidr) {
        // subnetIndex is 1-based (Subnet 1, Subnet 2, etc.)
        if (state && state.storageAutoIp === 'disabled' &&
            Array.isArray(state.customStorageSubnets) &&
            state.customStorageSubnets[subnetIndex - 1]) {
            var customCidr = String(state.customStorageSubnets[subnetIndex - 1]).trim();
            if (customCidr) return customCidr;
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

    function buildStandaloneReportHtml(opts) {
        opts = opts || {};
        var inlineCss = opts.inlineCss || '';

        var title = document.title || 'Azure Local Design Assistant (ALDA) Tool — Report';
        var headParts = [];
        headParts.push('<meta charset="UTF-8">');
        headParts.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
        headParts.push('<title>' + escapeHtml(title) + '</title>');
        headParts.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
        headParts.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
        headParts.push('<link href="https://fonts.googleapis.com/css2?family=Segoe+UI:wght@300;400;600;700&display=swap" rel="stylesheet">');

        if (inlineCss) {
            headParts.push('<style>' + inlineCss + '</style>');
        } else {
            headParts.push('<link rel="stylesheet" href="../css/style.css">');
        }

        // Clone main report content (avoid including script tags).
        var main = document.querySelector('main.container');
        var bodyHtml = '';
        if (main) {
            var clone = main.cloneNode(true);

            // Remove any action buttons from the exported file.
            var noPrintEls = clone.querySelectorAll('.no-print');
            for (var i = 0; i < noPrintEls.length; i++) {
                if (noPrintEls[i] && noPrintEls[i].parentNode) {
                    noPrintEls[i].parentNode.removeChild(noPrintEls[i]);
                }
            }

            bodyHtml = '<div class="background-globes"></div>' + clone.outerHTML;
        }

        return '<!DOCTYPE html>'
            + '<html lang="en">'
            + '<head>' + headParts.join('') + '</head>'
            + '<body>' + bodyHtml + '</body>'
            + '</html>';
    }

    function buildStandaloneReportWordHtml(opts) {
        opts = opts || {};
        var inlineCss = opts.inlineCss || '';
        var bodyHtml = opts.bodyHtml || '';
        var title = opts.title || (document.title || 'Azure Local Design Assistant (ALDA) Tool — Report');

        var headParts = [];
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
            var sections = rootEl.querySelectorAll('.summary-section');
            for (var i = 0; i < sections.length; i++) {
                var sec = sections[i];
                if (!sec) continue;

                var rows = sec.querySelectorAll('.summary-row');
                if (!rows || !rows.length) continue;

                var table = document.createElement('table');
                table.className = 'word-kv-table';
                table.setAttribute('cellspacing', '0');
                table.setAttribute('cellpadding', '0');

                var tbody = document.createElement('tbody');
                table.appendChild(tbody);

                for (var r = 0; r < rows.length; r++) {
                    var row = rows[r];
                    var labelEl = row.querySelector('.summary-label');
                    var valueEl = row.querySelector('.summary-value');
                    if (!labelEl || !valueEl) continue;

                    var tr = document.createElement('tr');
                    var tdL = document.createElement('td');
                    tdL.className = 'word-kv-label';
                    tdL.textContent = (labelEl.textContent || '').trim();

                    var tdV = document.createElement('td');
                    tdV.className = 'word-kv-value';
                    // Preserve spans/links in value.
                    tdV.innerHTML = valueEl.innerHTML;

                    tr.appendChild(tdL);
                    tr.appendChild(tdV);
                    tbody.appendChild(tr);
                }

                // Remove the original div rows.
                for (var r2 = rows.length - 1; r2 >= 0; r2--) {
                    if (rows[r2] && rows[r2].parentNode) rows[r2].parentNode.removeChild(rows[r2]);
                }

                // Insert the table after the section title (if present).
                var title = sec.querySelector('.summary-section-title');
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
        var scale = opts.scale || 2;
        var background = opts.background || '#ffffff';
        var theme = opts.theme || 'light';

        function ensureXlinkNamespace(svgNode) {
            try {
                if (!svgNode) return;
                // Some external SVGs rely on xlink:href for embedded images.
                // Ensure the namespace exists so <image xlink:href="..."> resolves when serialized.
                var hasXlinkHref = false;
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
                var styled = svgNode.querySelectorAll('[style*="animation"], [style*="stroke-dashoffset"]');
                for (var i = 0; i < styled.length; i++) {
                    var el = styled[i];
                    if (!el) continue;
                    var s = el.getAttribute('style');
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
                var foreign = svgNode.querySelectorAll('foreignObject');
                for (var f = foreign.length - 1; f >= 0; f--) {
                    var fo = foreign[f];
                    if (fo && fo.parentNode) fo.parentNode.removeChild(fo);
                }

                // Strip scripts (defensive).
                var scripts = svgNode.querySelectorAll('script');
                for (var s = scripts.length - 1; s >= 0; s--) {
                    var sc = scripts[s];
                    if (sc && sc.parentNode) sc.parentNode.removeChild(sc);
                }

                // Flatten <switch> to a concrete drawable element.
                var switches = svgNode.querySelectorAll('switch');
                for (var i = switches.length - 1; i >= 0; i--) {
                    var sw = switches[i];
                    if (!sw || !sw.parentNode) continue;

                    var picked = null;
                    // Prefer a direct <image> fallback.
                    for (var c = 0; c < sw.childNodes.length; c++) {
                        var child = sw.childNodes[c];
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
                        var repl = picked.cloneNode(true);
                        // Preserve common container attributes.
                        var tf = sw.getAttribute('transform');
                        if (tf && !repl.getAttribute('transform')) repl.setAttribute('transform', tf);
                        var st = sw.getAttribute('style');
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
            var s = String(val).trim();
            // Strip common units (px/pt/em) and keep the leading number.
            var m = s.match(/^([0-9]+(\.[0-9]+)?)/);
            if (!m) return null;
            var n = parseFloat(m[1]);
            return Number.isFinite(n) ? n : null;
        }

        return new Promise(function (resolve) {
            try {
                var clone = svgEl.cloneNode(true);
                if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                ensureXlinkNamespace(clone);
                sanitizeSvgForCanvas(clone);

                // Inject theme vars so computed colors don't depend on external CSS.
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

                    var decls = Object.keys(themeVars)
                        .map(function (k) {
                            var v = (themeVars[k] || '').trim();
                            return v ? (k + ': ' + v + ';') : '';
                        })
                        .filter(Boolean)
                        .join(' ');

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
                } catch (eVars) {
                    // ignore
                }

                // Solid background rect so the resulting PNG isn't transparent.
                var vbStr = (clone.getAttribute('viewBox') || '').trim();
                var vb = null;
                if (vbStr) {
                    var parts = vbStr.split(/\s+/).map(function (p) { return parseFloat(p); });
                    if (parts.length === 4 && parts.every(function (n) { return Number.isFinite(n); })) {
                        vb = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
                    }
                }

                // Some SVGs omit viewBox and rely on width/height.
                var wh = null;
                if (!vb) {
                    var wAttr = parseSvgLength(clone.getAttribute('width'));
                    var hAttr = parseSvgLength(clone.getAttribute('height'));
                    if (wAttr && hAttr) {
                        wh = { w: wAttr, h: hAttr };
                    }
                }

                try {
                    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
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

                    var defsNode = clone.querySelector('defs');
                    if (defsNode && defsNode.nextSibling) {
                        clone.insertBefore(rect, defsNode.nextSibling);
                    } else {
                        clone.insertBefore(rect, clone.firstChild);
                    }
                } catch (eBg) {
                    // ignore
                }

                var serializer = new XMLSerializer();
                var svgText = serializer.serializeToString(clone);
                if (svgText.indexOf('<?xml') !== 0) {
                    svgText = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgText;
                }

                var svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
                var svgUrl = URL.createObjectURL(svgBlob);

                var img = new Image();
                img.onload = function () {
                    try {
                        var w = 1200;
                        var h = 800;
                        if (vb) {
                            w = Math.max(1, Math.round(vb.w * scale));
                            h = Math.max(1, Math.round(vb.h * scale));
                        } else if (wh) {
                            w = Math.max(1, Math.round(wh.w * scale));
                            h = Math.max(1, Math.round(wh.h * scale));
                        } else {
                            // Fallback: use rendered size if available.
                            var box = svgEl.getBoundingClientRect();
                            if (box && box.width && box.height) {
                                w = Math.max(1, Math.round(box.width * scale));
                                h = Math.max(1, Math.round(box.height * scale));
                            }
                        }

                        var canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        var pngUrl = canvas.toDataURL('image/png');
                        resolve(pngUrl);
                    } catch (eDraw) {
                        resolve(null);
                    } finally {
                        URL.revokeObjectURL(svgUrl);
                    }
                };
                img.onerror = function () {
                    try { URL.revokeObjectURL(svgUrl); } catch (eRevoke) { }
                    resolve(null);
                };

                img.src = svgUrl;
            } catch (e) {
                resolve(null);
            }
        });
    }

    function parseSvgText(svgText) {
        try {
            var parser = new DOMParser();
            var doc = parser.parseFromString(String(svgText || ''), 'image/svg+xml');
            var svg = doc && doc.documentElement;
            if (!svg || String(svg.nodeName).toLowerCase() !== 'svg') return null;
            return svg;
        } catch (e) {
            return null;
        }
    }

    function normalizeExternalDiagramSvg(svgEl) {
        try {
            if (!svgEl) return;
            svgEl.classList.add('switchless-diagram__svg');
            // Make responsive in the report/print.
            // Keep intrinsic width/height if present; some SVGs omit viewBox and depend on them.
            if (!svgEl.getAttribute('preserveAspectRatio')) {
                svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }
            var style = svgEl.getAttribute('style') || '';
            if (style.indexOf('max-width') < 0) style += (style ? ';' : '') + 'max-width:100%';
            if (style.indexOf('height') < 0) style += ';height:auto';
            svgEl.setAttribute('style', style);
        } catch (e) {
            // ignore
        }
    }

    function ensureArcGatewayVmDiagramInContainer(containerEl) {
        if (!containerEl) return Promise.resolve(false);
        if (containerEl.querySelector('svg')) return Promise.resolve(true);

        // Show a tiny loading message for the on-screen report.
        if (!containerEl.__loadingSet) {
            containerEl.__loadingSet = true;
            containerEl.innerHTML = '<div class="switchless-diagram__note">Loading Arc Gateway diagram…</div>';
        }

        try {
            return fetch(ARC_GATEWAY_VM_DIAGRAM_URL, { cache: 'no-store' })
                .then(function (r) {
                    if (!r.ok) throw new Error('Failed to fetch diagram');
                    return r.text();
                })
                .then(function (svgText) {
                    var svg = parseSvgText(svgText);
                    if (!svg) throw new Error('Invalid SVG');
                    normalizeExternalDiagramSvg(svg);
                    var imported = document.importNode(svg, true);

                    var wrap = document.createElement('div');
                    wrap.className = 'switchless-diagram';
                    wrap.appendChild(imported);
                    var foot = document.createElement('div');
                    foot.className = 'switchless-diagram__note';
                    foot.innerHTML = 'Source: <a href="https://github.com/Azure/AzureLocal-Supportability/blob/main/TSG/Networking/Arc-Gateway-Outbound-Connectivity/DeepDive-ArcGateway-Outbound-Traffic.md" target="_blank" rel="noreferrer" style="color:var(--accent-blue); text-decoration:underline;">Arc Gateway outbound connectivity deep dive</a> (Scenario 6)';
                    wrap.appendChild(foot);

                    containerEl.innerHTML = '';
                    containerEl.appendChild(wrap);
                    return true;
                })
                .catch(function () {
                    containerEl.innerHTML = '<div class="switchless-diagram__note">Unable to load Arc Gateway diagram (network blocked).<br><a href="' + ARC_GATEWAY_VM_DIAGRAM_URL + '" target="_blank" rel="noreferrer" style="color:var(--accent-blue); text-decoration:underline;">Open SVG</a></div>';
                    return false;
                });
        } catch (e) {
            containerEl.innerHTML = '<div class="switchless-diagram__note">Unable to load Arc Gateway diagram.</div>';
            return Promise.resolve(false);
        }
    }

    function downloadReportHtml() {
        // Backward-compatible alias: HTML download was replaced by Word download.
        downloadReportWord();
    }

    function downloadReportWord() {
        try {
            var main = document.querySelector('main.container');
            if (!main) return;

            var clone = main.cloneNode(true);

            // Remove Validation Summary section from exports.
            try {
                var validationsHost = clone.querySelector('#report-validations');
                if (validationsHost) {
                    var validationsStep = validationsHost.closest('.step');
                    if (validationsStep && validationsStep.parentNode) {
                        validationsStep.parentNode.removeChild(validationsStep);
                    }
                }
            } catch (eValRemove) {
                // ignore
            }

            // Remove any action buttons and Close button.
            var noPrintEls = clone.querySelectorAll('.no-print');
            for (var i = 0; i < noPrintEls.length; i++) {
                if (noPrintEls[i] && noPrintEls[i].parentNode) {
                    noPrintEls[i].parentNode.removeChild(noPrintEls[i]);
                }
            }
            var resetBtn = clone.querySelector('.reset-button');
            if (resetBtn && resetBtn.parentNode) {
                resetBtn.parentNode.removeChild(resetBtn);
            }

            // Convert diagrams (SVG) to embedded PNG images for Word.
            var prefetch = Promise.resolve();
            // If outbound diagram hasn't loaded yet, fetch into the export clone so it appears in Word.
            var diagKey = getOutboundDiagramKey(CURRENT_REPORT_STATE);
            if (diagKey && OUTBOUND_DIAGRAMS[diagKey]) {
                var diagramHost = clone.querySelector('#outbound-connectivity-diagram');
                if (diagramHost && !diagramHost.querySelector('svg')) {
                    var diagramUrl = OUTBOUND_DIAGRAMS[diagKey];
                    prefetch = fetch(diagramUrl)
                        .then(function(resp) { return resp.text(); })
                        .then(function(svg) {
                            diagramHost.innerHTML = svg;
                        });
                }
            }

            prefetch.then(function () {
                var svgs = clone.querySelectorAll('svg.switchless-diagram__svg');
                var conversions = [];
                for (var s = 0; s < svgs.length; s++) {
                    (function (svgNode) {
                        conversions.push(
                            svgElementToPngDataUrl(svgNode, { theme: 'dark', background: '#000000', scale: 2 })
                                .then(function (pngDataUrl) {
                                    if (!pngDataUrl) return;
                                    var img = document.createElement('img');
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

                return Promise.all(conversions);
            }).then(function () {
                // Convert label/value summary grids to tables for clear Word formatting.
                convertSummarySectionsToWordTables(clone);

                var wordCss = buildWordFriendlyCss();

                // Include background-globes div to avoid relying on page structure; CSS hides it.
                var bodyHtml = '<div class="background-globes"></div>' + clone.outerHTML;
                var html = buildStandaloneReportWordHtml({ inlineCss: wordCss, bodyHtml: bodyHtml });

                var blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
                var url = URL.createObjectURL(blob);

                var ts = new Date();
                var pad2 = function (n) { return String(n).padStart(2, '0'); };
                var fileName = 'azure-local-report-'
                    + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate())
                    + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes())
                    + '.doc';

                var a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            });
        } catch (e) {
            // ignore
        }
    }

    function downloadHostNetworkingDiagramSvg(variant) {
        try {
            var hostSec = document.querySelector('#report-summary [data-summary-section="host-networking"]');
            if (!hostSec) return;
            var svg = hostSec.querySelector('svg.switchless-diagram__svg');
            if (!svg) return;

            var theme = (variant === 'light' || variant === 'dark') ? variant : 'dark';

            // Clone so we can inject theme variables + a solid background for standalone viewing.
            var clone = svg.cloneNode(true);
            if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            var exportBg = '#000000';

            try {
                var rootStyle = window.getComputedStyle(document.documentElement);
                // Default to the current (dark) site theme.
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
                    // Light export palette: keep accent colors, flip neutrals for contrast.
                    // (Only affects the exported SVG, not the app UI.)
                    themeVars['--bg-dark'] = '#ffffff';
                    themeVars['--card-bg'] = '#ffffff';
                    themeVars['--text-primary'] = '#0b0b0b';
                    themeVars['--text-secondary'] = '#404040';
                    themeVars['--glass-border'] = 'rgba(0, 0, 0, 0.14)';
                }

                exportBg = (theme === 'light') ? '#ffffff' : (themeVars['--bg-dark'] || '#000000');

                var decls = Object.keys(themeVars)
                    .map(function (k) {
                        var v = (themeVars[k] || '').trim();
                        return v ? (k + ': ' + v + ';') : '';
                    })
                    .filter(Boolean)
                    .join(' ');

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
            } catch (eVars) {
                // ignore
            }

            // Add a background rect so the downloaded SVG isn't transparent.
            try {
                var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('fill', exportBg);

                var vb = (clone.getAttribute('viewBox') || '').trim();
                if (vb) {
                    var parts = vb.split(/\s+/).map(function (p) { return parseFloat(p); });
                    if (parts.length === 4 && parts.every(function (n) { return Number.isFinite(n); })) {
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

                var defsNode = clone.querySelector('defs');
                if (defsNode && defsNode.nextSibling) {
                    clone.insertBefore(rect, defsNode.nextSibling);
                } else {
                    clone.insertBefore(rect, clone.firstChild);
                }
            } catch (eBg) {
                // ignore
            }

            var serializer = new XMLSerializer();
            var svgText = serializer.serializeToString(clone);
            if (svgText.indexOf('<?xml') !== 0) {
                svgText = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgText;
            }

            var blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
            var url = URL.createObjectURL(blob);

            var ts = new Date();
            var pad2 = function (n) { return String(n).padStart(2, '0'); };
            var fileName = 'azure-local-diagram-' + theme + '-'
                + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate())
                + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes())
                + '.svg';

            var a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        } catch (e) {
            // ignore
        }
    }

    function downloadOutboundConnectivityDiagramSvg(variant) {
        try {
            var theme = (variant === 'light' || variant === 'dark') ? variant : 'dark';
            var diagKey = getOutboundDiagramKey(CURRENT_REPORT_STATE);
            if (!diagKey || !OUTBOUND_DIAGRAMS[diagKey]) return;

            // Determine the correct SVG URL based on theme
            var basePath = OUTBOUND_DIAGRAMS[diagKey];
            // The SVGs are dark by default, for light we'd need to apply transformations
            var svgUrl = basePath;

            fetch(svgUrl)
                .then(function(resp) { return resp.text(); })
                .then(function(svgText) {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(svgText, 'image/svg+xml');
                    var svg = doc.querySelector('svg');
                    if (!svg) return;

                    var clone = svg.cloneNode(true);
                    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                    var exportBg = theme === 'light' ? '#ffffff' : '#000000';

                    // For light theme, we need to invert some colors
                    if (theme === 'light') {
                        // Add a style to invert dark backgrounds to light
                        var defs = clone.querySelector('defs');
                        if (!defs) {
                            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                            clone.insertBefore(defs, clone.firstChild);
                        }
                        var styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
                        styleEl.textContent = 'svg { background-color: #ffffff; }';
                        defs.appendChild(styleEl);
                    }

                    // Add a background rect
                    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('fill', exportBg);
                    var vb = (clone.getAttribute('viewBox') || '').trim();
                    if (vb) {
                        var parts = vb.split(/\s+/).map(function (p) { return parseFloat(p); });
                        if (parts.length === 4 && parts.every(function (n) { return Number.isFinite(n); })) {
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

                    var serializer = new XMLSerializer();
                    var finalSvgText = serializer.serializeToString(clone);
                    if (finalSvgText.indexOf('<?xml') !== 0) {
                        finalSvgText = '<?xml version="1.0" encoding="UTF-8"?>\n' + finalSvgText;
                    }

                    var blob = new Blob([finalSvgText], { type: 'image/svg+xml;charset=utf-8' });
                    var url = URL.createObjectURL(blob);

                    var ts = new Date();
                    var pad2 = function (n) { return String(n).padStart(2, '0'); };
                    var fileName = 'outbound-connectivity-' + theme + '-'
                        + ts.getFullYear() + pad2(ts.getMonth() + 1) + pad2(ts.getDate())
                        + '-' + pad2(ts.getHours()) + pad2(ts.getMinutes())
                        + '.svg';

                    var a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                })
                .catch(function(err) {
                    console.warn('Failed to download outbound diagram:', err);
                });
        } catch (e) {
            console.warn('Error in downloadOutboundConnectivityDiagramSvg:', e);
        }
    }

    function tryParsePayload() {
        // 1) URL hash payload (preferred for file:// reliability)
        try {
            var hash = window.location.hash || '';
            var idx = hash.indexOf('data=');
            if (idx >= 0) {
                var encoded = hash.substring(idx + 5);
                encoded = decodeURIComponent(encoded);
                var json = decodeURIComponent(escape(atob(encoded)));
                return JSON.parse(json);
            }
        } catch (e) {
            // ignore
        }

        // 2) localStorage fallback
        try {
            var raw = localStorage.getItem('azloc_report_payload');
            if (raw) return JSON.parse(raw);
        } catch (e2) {
            // ignore
        }

        return null;
    }

    function formatScenario(val) {
        if (!val) return '-';
        if (val === 'hyperconverged') return 'Hyperconverged';
        if (val === 'multirack') return 'Multi-Rack';
        if (val === 'disconnected') return 'Disconnected';
        if (val === 'm365local') return 'M365 Local';
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
        var map = {
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
            + items.map(function (x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('')
            + '</ul>';
    }

    function rationaleForState(s) {
        var validations = computeValidations(s);
        var sections = [];

        function renderSwitchedIntentDiagram(state) {
            // Single-node clusters have no storage connectivity choice (state.storage is null)
            // but should still render a diagram showing the ToR switch and node
            var isSingleNode = state && state.nodes === '1';
            if (!state || (state.storage !== 'switched' && !isSingleNode)) return '';

            if (String(state.nodes) === '16+') {
                return '<div style="color:var(--text-secondary);">Diagram is not generated for 16+ nodes (the wizard does not collect per-node details for this case).</div>';
            }

            var nAll = parseInt(state.nodes, 10);
            if (isNaN(nAll) || nAll < 1) nAll = 1;
            // Show max 2 nodes for cleaner diagram with ToR switches
            var n = Math.min(2, nAll);

            var ports = parseInt(state.ports, 10);
            if (isNaN(ports) || ports < 0) ports = 0;

            // Determine ToR switch configuration (single or dual)
            var torCount = (state.torSwitchCount === 'single') ? 1 : 2;
            var showTorSwitches = (state.scale === 'medium' || state.scale === 'low_capacity') &&
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

            function getSmbLabel(idx1Based) {
                return getPortCustomName(state, idx1Based, 'smb');
            }

            function intentLabelForSet(intent) {
                if (intent === 'all_traffic') return 'Management + Compute + Storage intent';
                if (intent === 'mgmt_compute') return 'Management + Compute intent';
                if (intent === 'compute_storage') return 'Compute + Storage intent';
                if (intent === 'custom') return 'Custom intent(s)';
                return 'Network intent';
            }
            function intentShortLabel(intent) {
                // In Rack Aware diagrams, keep the label compact (avoid repeating the word "intent").
                var s = intentLabelForSet(intent);
                return String(s).replace(/\s+intent\(s\)\s*$/i, '').replace(/\s+intent\s*$/i, '');
            }

            var isCustom = state.intent === 'custom';
            
            // Check if adapter mapping is confirmed (used for mgmt_compute intent)
            var hasAdapterMapping = state.adapterMappingConfirmed && state.adapterMapping && Object.keys(state.adapterMapping).length > 0;

            function getCustomIntentGroups(customIntents, portCount) {
                var p = parseInt(portCount, 10) || 0;
                if (!customIntents || p <= 0) return [];

                var trafficNames = {
                    mgmt: 'Management',
                    compute: 'Compute',
                    storage: 'Storage',
                    mgmt_compute: 'Management + Compute',
                    compute_storage: 'Compute + Storage',
                    all: 'All Traffic',
                    unused: 'Unused'
                };

                var buckets = {};
                for (var i = 1; i <= p; i++) {
                    var assignment = (customIntents && customIntents[i]) ? String(customIntents[i]) : 'unused';
                    if (!assignment) assignment = 'unused';
                    if (assignment === 'unused') continue;
                    if (!buckets[assignment]) buckets[assignment] = [];
                    buckets[assignment].push(i);
                }

                // Always show Mgmt + Compute first when present.
                var order = ['mgmt_compute', 'mgmt', 'compute', 'compute_storage', 'storage', 'all'];
                var groups = [];
                for (var oi = 0; oi < order.length; oi++) {
                    var key = order[oi];
                    if (!buckets[key] || buckets[key].length === 0) continue;
                    var nics = buckets[key];
                    var label = (trafficNames[key] || key);
                    var isStorageLike = (key === 'storage' || key === 'compute_storage' || key === 'all');
                    groups.push({ key: key, label: label, nics: nics, isStorageLike: isStorageLike });
                }

                // Include any unexpected keys at the end (stable).
                Object.keys(buckets).sort().forEach(function (k) {
                    if (order.indexOf(k) >= 0) return;
                    var nics2 = buckets[k];
                    if (!nics2 || nics2.length === 0) return;
                    groups.push({ key: k, label: (trafficNames[k] || k), nics: nics2, isStorageLike: (String(k).indexOf('storage') >= 0) });
                });

                return groups;
            }

            // Get intent groups from adapter mapping (for mgmt_compute intent with confirmed mapping)
            function getAdapterMappingGroups(adapterMapping, portCount) {
                var p = parseInt(portCount, 10) || 0;
                if (!adapterMapping || p <= 0) return [];

                var trafficNames = {
                    mgmt: 'Management + Compute',
                    storage: 'Storage',
                    compute_storage: 'Compute + Storage',
                    all: 'All Traffic',
                    pool: 'Management + Compute'
                };

                var buckets = {};
                for (var i = 1; i <= p; i++) {
                    var assignment = adapterMapping[i] || 'pool';
                    // Normalize 'mgmt' and 'pool' to 'mgmt' for grouping
                    if (assignment === 'pool') assignment = 'mgmt';
                    if (!buckets[assignment]) buckets[assignment] = [];
                    buckets[assignment].push(i);
                }

                var order = ['mgmt', 'storage', 'compute_storage', 'all'];
                var groups = [];
                for (var oi = 0; oi < order.length; oi++) {
                    var key = order[oi];
                    if (!buckets[key] || buckets[key].length === 0) continue;
                    var nics = buckets[key];
                    var label = (trafficNames[key] || key);
                    var isStorageLike = (key === 'storage' || key === 'compute_storage' || key === 'all');
                    groups.push({ key: key, label: label, nics: nics, isStorageLike: isStorageLike });
                }

                return groups;
            }

            var showStorageGroup = !isCustom && state.intent !== 'all_traffic';
            var storagePortCount = (!isCustom && showStorageGroup) ? Math.max(0, ports - 2) : 0;
            
            // Get adapter mapping groups if applicable
            var adapterMappingGroups = hasAdapterMapping ? getAdapterMappingGroups(state.adapterMapping, ports) : [];
            var customGroups = isCustom ? getCustomIntentGroups(state.customIntents, ports) : [];

            // Layout constants
            var nodeW = 320;
            var nodeH = 180;
            var gapX = 40;
            var marginX = 50;
            var torSwitchH = 50;
            var torSwitchW = 140;
            var torGap = 60;
            var torToNodeGap = 80;
            var marginTop = showTorSwitches ? 90 : 70;
            var marginBottom = 50;

            // Calculate adapter dimensions based on port count
            var adapterW = 54;
            var adapterH = 36;
            var adapterGap = 10;
            var totalAdapterW = (ports * adapterW) + (Math.max(0, ports - 1) * adapterGap);

            // Ensure node width accommodates all adapters
            nodeW = Math.max(nodeW, totalAdapterW + 40);

            // Calculate SVG dimensions
            var svgW = marginX * 2 + (n * nodeW) + ((n - 1) * gapX);
            var torAreaH = showTorSwitches ? (torSwitchH + torToNodeGap) : 0;
            var svgH = marginTop + torAreaH + nodeH + marginBottom + (nAll > 2 ? 40 : 0);

            // ToR switch positions
            var torY = marginTop + 10;
            var tor1X, tor2X;
            if (torCount === 2) {
                var totalTorW = (2 * torSwitchW) + torGap;
                tor1X = (svgW - totalTorW) / 2;
                tor2X = tor1X + torSwitchW + torGap;
            } else {
                tor1X = (svgW - torSwitchW) / 2;
                tor2X = tor1X; // Not used for single ToR
            }

            // Node positions (horizontally centered)
            var nodesStartX = (svgW - (n * nodeW) - ((n - 1) * gapX)) / 2;
            var nodeY = marginTop + torAreaH + 10;

            function nodePos(i) {
                return {
                    x: nodesStartX + (i * (nodeW + gapX)),
                    y: nodeY
                };
            }

            // Collect all adapter positions for drawing uplinks later
            var adapterPositions = [];

            function renderAdaptersHorizontal(nodeLeft, nodeTop, nodeIdx) {
                var out = '';
                var adaptersY = nodeTop + nodeH - adapterH - 20;
                var startX = nodeLeft + (nodeW - totalAdapterW) / 2;
                var setH = adapterH + 24;
                var setY = adaptersY - 12;

                // If adapter mapping is confirmed, use it to determine intent groups
                if (hasAdapterMapping && adapterMappingGroups.length > 0) {
                    // Build a map of port to intent for adapter mapping
                    var portToIntent = {};
                    for (var gi = 0; gi < adapterMappingGroups.length; gi++) {
                        var grp = adapterMappingGroups[gi];
                        for (var ni = 0; ni < grp.nics.length; ni++) {
                            portToIntent[grp.nics[ni]] = grp;
                        }
                    }

                    // Build ordered list of ports grouped by intent (Mgmt+Compute first, then Storage)
                    var orderedPorts = [];
                    var mgmtPorts = [];
                    var storagePorts = [];
                    for (var pi = 1; pi <= ports; pi++) {
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
                        var mgmtBoxW = (mgmtPorts.length * adapterW) + ((mgmtPorts.length - 1) * adapterGap) + 12;
                        var mgmtBoxX = startX - 6;
                        out += '<rect x="' + mgmtBoxX + '" y="' + setY + '" width="' + mgmtBoxW + '" height="' + setH + '" rx="10" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="5 3" />';
                        out += '<text x="' + (mgmtBoxX + mgmtBoxW / 2) + '" y="' + (setY - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">Management + Compute</text>';
                    }
                    
                    // Draw Storage box (second group)
                    if (storagePorts.length > 0) {
                        var storageStartX = startX + (mgmtPorts.length * (adapterW + adapterGap)) + intentGap;
                        var storageBoxW = (storagePorts.length * adapterW) + ((storagePorts.length - 1) * adapterGap) + 12;
                        var storageBoxX = storageStartX - 6;
                        out += '<rect x="' + storageBoxX + '" y="' + setY + '" width="' + storageBoxW + '" height="' + setH + '" rx="10" fill="rgba(139,92,246,0.07)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="5 3" />';
                        out += '<text x="' + (storageBoxX + storageBoxW / 2) + '" y="' + (setY - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">Storage</text>';
                    }

                    // Draw adapters in grouped order (Mgmt+Compute ports first, then Storage ports)
                    for (var oi = 0; oi < orderedPorts.length; oi++) {
                        var nicIdx = orderedPorts[oi];
                        var isMgmt = mgmtPorts.indexOf(nicIdx) >= 0;
                        
                        // Calculate X position based on grouped layout
                        var x;
                        if (isMgmt) {
                            var mgmtIdx = mgmtPorts.indexOf(nicIdx);
                            x = startX + (mgmtIdx * (adapterW + adapterGap));
                        } else {
                            var storageIdx = storagePorts.indexOf(nicIdx);
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
                        // Center text vertically if label is 9 characters or less, otherwise stagger
                        var textY = (label.length <= 9) ? (y + 22) : ((posInGroup % 2 === 0) ? (y + 16) : (y + 28));

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
                    var setW = (2 * adapterW) + adapterGap + 12;
                    var setX = startX - 6;
                    out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="10" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="5 3" />';
                    
                    // Label for Mgmt + Compute group
                    var mgmtLabel = (state.intent === 'all_traffic') ? 'Management + Compute + Storage' : 'Management + Compute';
                    out += '<text x="' + (setX + setW / 2) + '" y="' + (setY - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">' + escapeHtml(mgmtLabel) + '</text>';
                    
                    // Storage box (NICs 3+) if applicable - add gap between boxes
                    if (showStorageGroup && storagePortCount > 0) {
                        var intentGap = 8; // Gap between intent boxes
                        var storageW = (storagePortCount * adapterW) + ((storagePortCount - 1) * adapterGap) + 12;
                        var storageX = startX + (2 * (adapterW + adapterGap)) - 6 + intentGap;
                        out += '<rect x="' + storageX + '" y="' + setY + '" width="' + storageW + '" height="' + setH + '" rx="10" fill="rgba(139,92,246,0.07)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="5 3" />';
                        out += '<text x="' + (storageX + storageW / 2) + '" y="' + (setY - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">Storage</text>';
                    }
                }
                
                // Calculate intent gap for storage adapter positioning
                var storageIntentGap = (!isCustom && showStorageGroup && storagePortCount > 0) ? 8 : 0;

                // Draw all adapters horizontally
                for (var i = 0; i < ports; i++) {
                    // Storage adapters (index 2+) need to shift by the intent gap to center in purple box
                    var adapterOffset = (i >= 2 && storageIntentGap > 0) ? storageIntentGap : 0;
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
                    // Center text vertically if label is 9 characters or less, otherwise stagger
                    var textY = (label.length <= 9) ? (y + 22) : ((posInGroup % 2 === 0) ? (y + 16) : (y + 28));

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
                var out = '';
                var adaptersY = nodeTop + nodeH - adapterH - 20;
                var startX = nodeLeft + (nodeW - totalAdapterW) / 2;

                // Build a map of port to intent
                var portIntent = {};
                for (var gi2 = 0; gi2 < customGroups.length; gi2++) {
                    var grp = customGroups[gi2];
                    for (var ni = 0; ni < grp.nics.length; ni++) {
                        portIntent[grp.nics[ni]] = grp;
                    }
                }

                // Build ordered list of ports grouped by intent (following customGroups order)
                // This ensures ports with the same intent are visually grouped together
                var orderedPorts = [];
                var intentGap = 8; // Gap between intent boxes
                
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
                var totalGroupedW = (ports * adapterW) + (Math.max(0, ports - 1) * adapterGap);
                if (customGroups.length > 1) {
                    totalGroupedW += (customGroups.length - 1) * intentGap;
                }
                var groupedStartX = nodeLeft + (nodeW - totalGroupedW) / 2;

                // Build position map for each port based on grouped layout
                var portPositions = {};
                var currentX = groupedStartX;
                var boxY = adaptersY - 12;
                var boxH = adapterH + 24;
                
                for (var gi = 0; gi < customGroups.length; gi++) {
                    var grp = customGroups[gi];
                    var grpPorts = grp.nics;
                    var grpW = (grpPorts.length * adapterW) + ((grpPorts.length - 1) * adapterGap);
                    
                    // Draw intent box
                    var boxX = currentX - 8;
                    var boxTotalW = grpW + 16;
                    
                    // Color based on intent type
                    var isStorageLike = grp.isStorageLike;
                    var isCompute = (grp.key === 'compute');
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
                    
                    out += '<rect x="' + boxX + '" y="' + boxY + '" width="' + boxTotalW + '" height="' + boxH + '" rx="10" fill="' + boxFill + '" stroke="' + boxStroke + '" stroke-dasharray="5 3" />';
                    out += '<text x="' + (boxX + boxTotalW / 2) + '" y="' + (boxY - 4) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">' + escapeHtml(grp.label) + '</text>';
                    
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
                for (var oi = 0; oi < orderedPorts.length; oi++) {
                    var nicIdx = orderedPorts[oi];
                    var posData = portPositions[nicIdx];
                    
                    // For unassigned ports, calculate position at the end
                    if (!posData) {
                        posData = {
                            x: currentX + ((oi - (orderedPorts.length - (ports - Object.keys(portPositions).length))) * (adapterW + adapterGap)),
                            posInGroup: 0
                        };
                    }
                    
                    var x = posData.x;
                    var y = adaptersY;

                    var grp2 = portIntent[nicIdx];
                    var isStorage = grp2 && grp2.isStorageLike;
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
                    var label = getNicLabel(nicIdx);
                    // Get position within intent group
                    var posInGroup = posData.posInGroup || 0;
                    // Center text vertically if label is 9 characters or less, otherwise stagger
                    var textY = (label.length <= 9) ? (y + 22) : ((posInGroup % 2 === 0) ? (y + 16) : (y + 28));

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
                var out = '';
                var torBottomY = torY + torSwitchH;

                for (var ai = 0; ai < adapterPositions.length; ai++) {
                    var ap = adapterPositions[ai];
                    var adapterTopY = ap.y;

                    // Determine which ToR switch to connect to
                    // For dual ToR: use position within intent group (first port → ToR 1, second port → ToR 2)
                    // For single ToR: all connect to the single switch
                    var targetTorX;
                    if (torCount === 2) {
                        // Use posInGroup if available (adapter mapping), otherwise fall back to NIC index
                        var posInGroup = (ap.posInGroup !== undefined) ? ap.posInGroup : (ap.nicIdx - 1);
                        // First port of each intent (posInGroup 0, 2, 4...) → ToR 1
                        // Second port of each intent (posInGroup 1, 3, 5...) → ToR 2
                        targetTorX = (posInGroup % 2 === 0) ? (tor1X + torSwitchW / 2) : (tor2X + torSwitchW / 2);
                    } else {
                        targetTorX = tor1X + torSwitchW / 2;
                    }

                    // Draw uplink line from adapter to ToR switch
                    var lineColor = ap.isStorage ? 'rgba(139,92,246,0.5)' : 'rgba(0,120,212,0.4)';
                    out += '<line x1="' + ap.x + '" y1="' + adapterTopY + '" x2="' + targetTorX + '" y2="' + torBottomY + '" stroke="' + lineColor + '" stroke-width="1.5" stroke-dasharray="4 2" />';
                }

                return out;
            }

            // Build intro text
            var torLabel = showTorSwitches ? (torCount === 1 ? 'Single ToR' : 'Dual ToR') : '';
            var scenarioLabel = isSingleNode ? 'Single-node' : 'Storage Switched';
            var intro = ''
                + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                + '<strong style="color:var(--text-primary);">' + scenarioLabel + '</strong> scenario diagram'
                + (showTorSwitches ? (' with ' + torLabel + ' switch' + (torCount === 1 ? '' : 'es')) : '') + '.'
                + (showTorSwitches
                    ? '<br>Shows per-node intent groupings and uplinks to ToR switch' + (torCount === 1 ? '' : 'es') + '.'
                    : '<br>Shows per-node intent groupings.')
                + (nAll > 2 ? ('<br><span style="color:var(--text-secondary);">Showing first 2 of ' + escapeHtml(String(nAll)) + ' nodes.</span>') : '')
                + '</div>';

            var svg = '';
            svg += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" role="img" aria-label="' + (isSingleNode ? 'Single-node network' : 'Switched intent') + ' diagram with ToR switch' + (torCount === 1 ? '' : 'es') + '">';

            // Outer container
            svg += '<rect x="30" y="55" width="' + (svgW - 60) + '" height="' + (svgH - 85) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(0,120,212,0.35)" stroke-dasharray="6 4" />';

            // Title text
            var titleText = isSingleNode 
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
                    var mlagX1 = tor1X + torSwitchW; // Right edge of ToR 1
                    var mlagX2 = tor2X;              // Left edge of ToR 2
                    var mlagY1 = torY + torSwitchH / 2 - 6; // Upper link
                    var mlagY2 = torY + torSwitchH / 2 + 6; // Lower link
                    var mlagMidX = (mlagX1 + mlagX2) / 2;
                    var mlagLabelY = torY + torSwitchH / 2 - 14;
                    svg += '<line x1="' + mlagX1 + '" y1="' + mlagY1 + '" x2="' + mlagX2 + '" y2="' + mlagY1 + '" stroke="rgba(59,130,246,0.8)" stroke-width="2" />';
                    svg += '<line x1="' + mlagX1 + '" y1="' + mlagY2 + '" x2="' + mlagX2 + '" y2="' + mlagY2 + '" stroke="rgba(59,130,246,0.8)" stroke-width="2" />';
                    svg += '<text x="' + mlagMidX + '" y="' + mlagLabelY + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">MLAG</text>';
                }
            }

            // Render nodes
            for (var ni = 0; ni < n; ni++) {
                var pos = nodePos(ni);
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
                var more = nAll - 2;
                var badgeW = 180;
                var badgeH = 26;
                var badgeX = svgW - 50 - badgeW;
                var badgeY = svgH - 60;
                svg += '<rect x="' + badgeX + '" y="' + badgeY + '" width="' + badgeW + '" height="' + badgeH + '" rx="13" fill="rgba(255,255,255,0.05)" stroke="var(--glass-border)" />';
                svg += '<text x="' + (badgeX + badgeW / 2) + '" y="' + (badgeY + 17) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">+' + more + ' more node' + (more === 1 ? '' : 's') + '</text>';
            }

            svg += '</svg>';

            var note = isSingleNode
                ? '<div class="switchless-diagram__note">Note: Single-node deployments connect the node to the ToR switch for management and compute traffic. No storage connectivity is required as there is no cluster storage replication.</div>'
                : `<div class="switchless-diagram__note">Note: Storage Switched scenarios connect all nodes through ToR switches. The diagram shows uplink connectivity from each node's network adapters to the ToR switch fabric.</div>`;

            return '<div class="switchless-diagram">' + intro + svg + note + '</div>';
        }

        function renderRackAwareTorArchitectureDiagram(state) {
            if (!state || state.scale !== 'rack_aware') return '';

            var arch = state.rackAwareTorArchitecture ? String(state.rackAwareTorArchitecture) : '';
            var torsPerRoom = state.rackAwareTorsPerRoom ? String(state.rackAwareTorsPerRoom) : '';

            var z = state.rackAwareZones || {};
            var zone1Name = (z.zone1Name ? String(z.zone1Name).trim() : '') || 'Zone1';
            var zone2Name = (z.zone2Name ? String(z.zone2Name).trim() : '') || 'Zone2';
            var assignments = (z.assignments && typeof z.assignments === 'object') ? z.assignments : {};

            function getNodeName(idx0) {
                if (state.nodeSettings && state.nodeSettings[idx0] && state.nodeSettings[idx0].name) {
                    var nm = String(state.nodeSettings[idx0].name).trim();
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
                var s = intentLabelForSet(intent);
                return String(s).replace(/\s+intent\(s\)\s*$/i, '').replace(/\s+intent\s*$/i, '');
            }

            var nodeCountAll = parseInt(state.nodes, 10);
            if (isNaN(nodeCountAll) || nodeCountAll < 2) nodeCountAll = 2;
            var shownPerZone = 2;

            var z1Nodes = [];
            var z2Nodes = [];
            for (var i = 0; i < nodeCountAll; i++) {
                var nodeId1 = String(i + 1);
                var zone = Number(assignments[nodeId1]);
                if (zone === 1) z1Nodes.push(getNodeName(i));
                else z2Nodes.push(getNodeName(i));
            }
            // Fallback if assignments are missing.
            if (z1Nodes.length === 0 && z2Nodes.length === 0) {
                for (var j = 0; j < nodeCountAll; j++) {
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

            var learnRef = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/rack-aware-cluster-reference-architecture?view=azloc-2511#tor-switch-architecture';
            var intro = '<div style="margin-bottom:0.5rem;">'
                + '<div style="font-weight:700; color:var(--text-primary);">' + escapeHtml(titleForArch(arch)) + '</div>'
                + '<div style="color:var(--text-secondary);">Reference: <a href="' + learnRef + '" target="_blank" rel="noopener" style="color:var(--accent-blue); text-decoration:underline;">Microsoft Learn</a></div>'
                + '</div>';

            // Diagram layout is intentionally fixed-size for export stability.
            // This version renders intent groups + port tiles + explicit cabling lines.
            var svgW = 1080;
            var svgH = 680;
            var pad = 40;
            var roomGap = 26;
            var roomW = Math.floor((svgW - (pad * 2) - roomGap) / 2);
            var roomH = 540;
            var roomY = 86;
            var room1X = pad;
            var room2X = pad + roomW + roomGap;

            // Push TORs (and therefore nodes) down to create more headroom for
            // inter-room trunks and upstream Switch/Router trunk connectors.
            var torY = roomY + 116;
            var torH = 56;
            var torW = 150;
            var torGap = 18;

            var nodesY = torY + torH + 42;
            // Two nodes must fit within one room (roomW ~ 487). Keep cards compact.
            var nodeW = 232;
            var nodeH = 240;
            var nodeGap = 16;

            function torXsForRoom(roomX, torCount) {
                if (torCount === 2) {
                    var totalW = (2 * torW) + torGap;
                    var startX = roomX + Math.floor((roomW - totalW) / 2);
                    return [startX, startX + torW + torGap];
                }
                return [roomX + Math.floor((roomW - torW) / 2)];
            }

            function nodeXsForRoom(roomX, count) {
                var shown = Math.min(count, shownPerZone);
                var totalW = (shown * nodeW) + ((shown - 1) * nodeGap);
                var startX = roomX + Math.floor((roomW - totalW) / 2);
                var xs = [];
                for (var i2 = 0; i2 < shown; i2++) xs.push(startX + (i2 * (nodeW + nodeGap)));
                return xs;
            }

            // Precompute the node X positions per room so we can align TORs above them.
            // This helps create horizontal space for a clear in-room LAG drawing.
            var room1NodeXs = nodeXsForRoom(room1X, z1Nodes.length);
            var room2NodeXs = nodeXsForRoom(room2X, z2Nodes.length);

            function line(x1, y1, x2, y2, stroke, dash) {
                var d = dash ? ' stroke-dasharray="' + dash + '"' : '';
                return '<path d="M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2 + '" stroke="' + stroke + '" stroke-width="2" fill="none"' + d + ' />';
            }

            function label(x, y, txt, color, size, weight) {
                return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' + (size || 12) + '" fill="' + (color || 'var(--text-secondary)') + '" font-weight="' + (weight || '400') + '">' + escapeHtml(txt) + '</text>';
            }

            var torCountPerRoom = (torsPerRoom === '2') ? 2 : (torsPerRoom === '1' ? 1 : (arch === 'option_a' || arch === 'option_b' ? 2 : 1));
            var room1TorXs = torXsForRoom(room1X, torCountPerRoom);
            var room2TorXs = torXsForRoom(room2X, torCountPerRoom);

            function alignTorPairToTwoNodes(roomX, torXs, nodeXs) {
                // Only align when we are actually showing two nodes in the room.
                if (!nodeXs || nodeXs.length !== 2) return torXs;
                if (!torXs || torXs.length !== 2) return torXs;

                var c1 = nodeXs[0] + Math.floor(nodeW / 2);
                var c2 = nodeXs[1] + Math.floor(nodeW / 2);
                var x1 = c1 - Math.floor(torW / 2);
                var x2 = c2 - Math.floor(torW / 2);

                // Clamp within room bounds.
                var minX = roomX + 12;
                var maxX = (roomX + roomW) - torW - 12;
                x1 = Math.max(minX, Math.min(maxX, x1));
                x2 = Math.max(minX, Math.min(maxX, x2));

                // Ensure ordering.
                if (x2 < x1) {
                    var t = x1; x1 = x2; x2 = t;
                }

                // If they overlap due to extreme clamping, fall back to default centered layout.
                if (x2 < (x1 + torW + 10)) return torXs;
                return [x1, x2];
            }

            if (torCountPerRoom === 2) {
                // Keep dual-TOR layout consistent across node counts.
                // For 2-node Rack Aware (one node shown per room), align TORs using a virtual 2-node layout
                // so TOR spacing matches 6/8-node diagrams (which also show two nodes per room).
                var room1AlignNodeXs = room1NodeXs;
                var room2AlignNodeXs = room2NodeXs;
                if (room1AlignNodeXs && room1AlignNodeXs.length === 1) room1AlignNodeXs = nodeXsForRoom(room1X, 2);
                if (room2AlignNodeXs && room2AlignNodeXs.length === 1) room2AlignNodeXs = nodeXsForRoom(room2X, 2);

                room1TorXs = alignTorPairToTwoNodes(room1X, room1TorXs, room1AlignNodeXs);
                room2TorXs = alignTorPairToTwoNodes(room2X, room2TorXs, room2AlignNodeXs);
            }

            var svg = '';
            svg += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" role="img" aria-label="Rack Aware TOR architecture diagram">';

            // Room containers
            svg += '<rect x="' + room1X + '" y="' + roomY + '" width="' + roomW + '" height="' + roomH + '" rx="14" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
            svg += '<rect x="' + room2X + '" y="' + roomY + '" width="' + roomW + '" height="' + roomH + '" rx="14" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
            svg += label(room1X + roomW / 2, roomY + 26, zone1Name + ' (Room 1)', 'var(--text-primary)', 14, '700');
            svg += label(room2X + roomW / 2, roomY + 26, zone2Name + ' (Room 2)', 'var(--text-primary)', 14, '700');

            // TORs
            function torBox(x, y, text) {
                var cx = x + torW / 2;
                svg += '<rect x="' + x + '" y="' + y + '" width="' + torW + '" height="' + torH + '" rx="12" fill="rgba(0,120,212,0.12)" stroke="rgba(0,120,212,0.35)" />';
                svg += label(cx, y + 24, text, 'var(--text-primary)', 13, '700');
                svg += label(cx, y + 44, 'TOR', 'var(--text-secondary)', 11, '400');
            }

            function lagLinkForRoom(roomTorXs, y) {
                // Render an explicit LAG box between the two TORs (Learn-style), using TWO parallel connectors.
                // Place it in the gap between TORs and align to the TOR vertical midpoint.
                var leftInner = roomTorXs[0] + torW;
                var rightInner = roomTorXs[1];
                var midX = Math.floor((leftInner + rightInner) / 2);

                var innerGap = Math.max(0, rightInner - leftInner);
                var boxW = Math.min(58, Math.max(34, innerGap - 14));
                var boxH = 22;
                var bx = midX - Math.floor(boxW / 2);
                var by = y - Math.floor(boxH / 2);

                // TOR-to-TOR (in-room) LAG links should be SOLID.
                var stroke = 'var(--accent-blue)';
                var strokeOpacity = 0.70;
                var gap = 8;

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
            var ports = parseInt(state.ports, 10);
            if (isNaN(ports) || ports < 0) ports = 0;

            // Determine which ports belong to which intent based on adapter mapping
            var hasAdapterMapping = state.adapterMappingConfirmed && state.adapterMapping && Object.keys(state.adapterMapping).length > 0;
            var mgmtComputePorts = [];
            var storagePorts = [];

            if (hasAdapterMapping) {
                for (var pi = 1; pi <= ports; pi++) {
                    var assignment = state.adapterMapping[pi] || 'pool';
                    if (assignment === 'storage') {
                        storagePorts.push(pi);
                    } else {
                        // mgmt, pool, etc. go to Mgmt+Compute
                        mgmtComputePorts.push(pi);
                    }
                }
            } else {
                // Default assumption: ports 1-2 for Mgmt+Compute, ports 3+ for Storage
                for (var dpi = 1; dpi <= ports; dpi++) {
                    if (dpi <= 2) {
                        mgmtComputePorts.push(dpi);
                    } else {
                        storagePorts.push(dpi);
                    }
                }
            }

            var showStorageGroup = (state.intent !== 'all_traffic') && storagePorts.length > 0;
            var storagePortCount = showStorageGroup ? storagePorts.length : 0;

            function renderSetGroup(nodeLeft, nodeTop, placeOnLeft) {
                // Intent blocks are side-by-side (same vertical level) to match Learn diagrams.
                var padX = 12;
                var gapB = 10;
                var boxW = Math.floor((nodeW - (padX * 2) - gapB) / 2);
                var setW = boxW;
                var setH = 114;
                var setX = placeOnLeft ? (nodeLeft + padX) : (nodeLeft + padX + boxW + gapB);
                var setY = nodeTop + 74;

                // Keep tiles compact so side-by-side groups fit within the node card.
                var nicW = 44;
                var nicH = 28;
                var gap = 8;
                var rowW = (2 * nicW) + gap;
                var nic1X = setX + Math.floor((setW - rowW) / 2);
                var nic2X = nic1X + nicW + gap;
                // Align NIC and SMB tiles to the same vertical level.
                var nicY = setY + 28;

                var tilesBottomY = nicY + nicH;
                var setLabelY = tilesBottomY + 22;

                var setLabelText = intentShortLabel(state.intent);
                // When Storage uses RDMA, keep the SET label focused on Mgmt/Compute.
                if (showStorageGroup) setLabelText = 'Management + Compute';

                var out = '';
                out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="12" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="6 4" />';
                // Place intent text below the ports so cabling above stays readable.
                out += '<text x="' + (setX + setW / 2) + '" y="' + setLabelY + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">' + escapeHtml(setLabelText) + '</text>';

                function nicTile(x, y, labelText, idx) {
                    var t = '';
                    // Center text vertically if label is 9 characters or less, otherwise stagger
                    var textY = (labelText.length <= 9) ? (y + 18) : ((idx % 2 === 0) ? (y + 14) : (y + 22));
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

                var padX = 12;
                var gapB = 10;
                var boxW = Math.floor((nodeW - (padX * 2) - gapB) / 2);
                var gW = boxW;
                var gX = placeOnLeft ? (nodeLeft + padX) : (nodeLeft + padX + boxW + gapB);
                var gY = nodeTop + 74;

                // Keep storage compact: show up to 4 SMB tiles (2x2). If more, show a "+N" badge.
                var maxShown = Math.min(count, 4);
                var tileW = 44;
                var tileH = 28;
                var gapX2 = 8;
                var gapY2 = 10;
                var cols2 = 2;
                var rows2 = Math.max(1, Math.ceil(maxShown / cols2));
                // Align SMB tiles with NIC tiles and place the Storage label below the tiles.
                var tilesTopPad = 28;
                var tilesH = (rows2 * tileH) + ((rows2 - 1) * gapY2);
                var labelH = 22;
                var padBottom = 12;
                var gH = tilesTopPad + tilesH + labelH + padBottom;
                // Ensure the storage box is at least as tall as SET for visual alignment.
                gH = Math.max(gH, 114);

                var totalRowW = (cols2 * tileW) + ((cols2 - 1) * gapX2);
                var startX = gX + Math.floor((gW - totalRowW) / 2);
                var startY = gY + tilesTopPad;

                var out = '';
                out += '<rect x="' + gX + '" y="' + gY + '" width="' + gW + '" height="' + gH + '" rx="12" fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';

                var portsOut = [];
                for (var iS = 0; iS < maxShown; iS++) {
                    var rS = Math.floor(iS / cols2);
                    var cS = iS % cols2;
                    var xS = startX + (cS * (tileW + gapX2));
                    var yS = startY + (rS * (tileH + gapY2));
                    // Use the actual storage port index from storagePorts array
                    var portIdx = storagePorts[iS] || (iS + 3);
                    var lbl = getNicLabel(portIdx);
                    // Center text vertically if label is 9 characters or less, otherwise stagger
                    var textY = (lbl.length <= 9) ? (yS + 18) : ((iS % 2 === 0) ? (yS + 14) : (yS + 22));
                    out += '<rect x="' + xS + '" y="' + yS + '" width="' + tileW + '" height="' + tileH + '" rx="8" fill="rgba(139,92,246,0.25)" stroke="rgba(139,92,246,0.65)" />';
                    out += '<text x="' + (xS + tileW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(lbl) + '</text>';
                    // Port anchors on the outside/top edge of each SMB tile (horizontally centered).
                    portsOut.push({ idx: portIdx, x: xS + Math.floor(tileW / 2), y: yS - 1 });
                }

                // Place the intent label below the SMB tiles so cabling stays clear.
                var labelY = startY + tilesH + 22;
                out += '<text x="' + (gX + gW / 2) + '" y="' + labelY + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">Storage (RDMA)</text>';

                if (count > maxShown) {
                    var badgeW = 54;
                    var badgeH = 20;
                    var bx = gX + gW - badgeW - 10;
                    var by = gY + gH - badgeH - 10;
                    out += '<rect x="' + bx + '" y="' + by + '" width="' + badgeW + '" height="' + badgeH + '" rx="10" fill="rgba(255,255,255,0.06)" stroke="var(--glass-border)" />';
                    out += '<text x="' + (bx + badgeW / 2) + '" y="' + (by + 14) + '" text-anchor="middle" font-size="10" fill="var(--text-secondary)">+' + escapeHtml(String(count - maxShown)) + '</text>';
                }

                return { html: out, ports: portsOut };
            }

            function nodeFrame(nodeLeft, nodeTop, text) {
                var cx = nodeLeft + nodeW / 2;
                var out = '';
                // Slightly more opaque fill so cabling lines behind don't visually clash with text.
                out += '<rect x="' + nodeLeft + '" y="' + nodeTop + '" width="' + nodeW + '" height="' + nodeH + '" rx="16" fill="rgba(255,255,255,0.06)" stroke="var(--glass-border)" />';
                // Move the node name below the intent blocks for readability.
                out += '<text x="' + cx + '" y="' + (nodeTop + nodeH - 18) + '" text-anchor="middle" font-size="16" fill="var(--text-primary)" font-weight="700">' + escapeHtml(text) + '</text>';
                return out;
            }

            // Build a render list so we can draw cabling behind nodes.
            var nodeRenders = [];
            for (var a1 = 0; a1 < room1NodeXs.length; a1++) {
                nodeRenders.push({ room: 1, sideInRoom: (a1 === 0 ? 'L' : 'R'), x: room1NodeXs[a1], y: nodesY, name: z1Nodes[a1] });
            }
            for (var a2 = 0; a2 < room2NodeXs.length; a2++) {
                nodeRenders.push({ room: 2, sideInRoom: (a2 === 0 ? 'L' : 'R'), x: room2NodeXs[a2], y: nodesY, name: z2Nodes[a2] });
            }

            // Precompute node port anchors.
            for (var nr = 0; nr < nodeRenders.length; nr++) {
                var n0 = nodeRenders[nr];
                // Mirror layout per node side within the room:
                // - Left nodes: SET (Mgmt+Compute + NICs) on left, Storage on right
                // - Right nodes: Storage on left, SET (Mgmt+Compute + NICs) on right
                var isLeftNode = (n0.sideInRoom !== 'R');
                var set = renderSetGroup(n0.x, n0.y, isLeftNode);
                var stor = renderStorageGroup(n0.x, n0.y, storagePortCount, !isLeftNode);
                n0._set = set;
                n0._stor = stor;
            }

            // Cabling lines (draw first so nodes sit on top).
            // Key requirement: each connector must have its own path and land on a unique point
            // along the TOR bottom edge (so lines don't stack through labels).
            function torLeftX(room, which) {
                var xs = (room === 1) ? room1TorXs : room2TorXs;
                var idx = Math.max(0, Math.min(xs.length - 1, which));
                return xs[idx];
            }

            function torLandingPoint(room, which, side, band, slot, total) {
                // Spread landing points along the TOR bottom edge.
                // First split by node side (L/R), then split that side into outside vs inside bands.
                // Requested bundling:
                // - Left side: Storage OUTSIDE, SET INSIDE
                // - Right side: SET INSIDE, Storage OUTSIDE
                var left = torLeftX(room, which);
                var padIn = 14;
                var usable = Math.max(10, torW - (padIn * 2));

                // Special case: only one node per room (e.g., 2-node Rack Aware).
                // Keep anchors visually centered while preserving the 4-node style ordering:
                // left half = SET (NIC1 outer-left, NIC2 inner-left), right half = Storage
                // (SMB1 inner-right, SMB2 outer-right).
                if (side === 'C') {
                    var denomC = Math.max(1, total + 1);
                    var leftHalf = Math.max(10, Math.floor(usable / 2));
                    var rightHalf = Math.max(10, usable - leftHalf);

                    var segStartC = (band === 'storage') ? leftHalf : 0;
                    var segUsableC = (band === 'storage') ? rightHalf : leftHalf;
                    var xC = left + padIn + segStartC + Math.floor(((slot + 1) * segUsableC) / denomC);

                    // Clamp to stay within TOR bounds.
                    var minX = left + padIn + 2;
                    var maxX = left + padIn + usable - 2;
                    if (xC < minX) xC = minX;
                    if (xC > maxX) xC = maxX;
                    var yC = torY + torH;
                    return { x: xC, y: yC };
                }

                var half = Math.floor(usable / 2);
                var sideStart = (side === 'R') ? (padIn + half) : padIn;
                var sideUsable = (side === 'R') ? (usable - half) : half;
                sideUsable = Math.max(10, sideUsable);

                // Split the side segment into two bands.
                var bandHalf = Math.max(10, Math.floor(sideUsable / 2));
                var insideStart = sideStart;
                var insideUsable = bandHalf;
                var outsideStart = sideStart + bandHalf;
                var outsideUsable = Math.max(10, sideUsable - bandHalf);

                // For left side, outside should be the *outermost* portion (left), inside toward center (right).
                if (side === 'L') {
                    outsideStart = sideStart;
                    outsideUsable = bandHalf;
                    insideStart = sideStart + bandHalf;
                    insideUsable = Math.max(10, sideUsable - bandHalf);
                }

                // Landing rule: Mgmt+Compute (SET) lands OUTSIDE, Storage lands INSIDE.
                var useInside = (band === 'storage');
                var segStart = useInside ? insideStart : outsideStart;
                var segUsable = useInside ? insideUsable : outsideUsable;

                var denom = Math.max(1, total + 1);
                var x = left + segStart + Math.floor(((slot + 1) * segUsable) / denom);
                // Land on the TOR bottom edge (border).
                var y = torY + torH;
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
                var torBottom = torY + torH + 1;
                var srcY = from.y;
                // Keep Storage (SMB) cabling in a lower band than Mgmt+Compute (SET)
                // so the horizontal runs under the TOR don't overlap.
                var bandOffset = (band === 'storage') ? 16 : 0;
                // Keep storage turn heights mirrored left/right.
                var upper = torBottom + 22 + bandOffset;
                var laneStep = 8;
                var approachY = upper + (laneIdx * laneStep);
                if (approachY > (srcY - 18)) approachY = srcY - 18;

                // Make the first segment always straight up from the port anchor.
                // Then route across at the lane height and land vertically into the TOR.
                return 'M ' + from.x + ' ' + srcY
                    + ' L ' + from.x + ' ' + approachY
                    + ' L ' + to.x + ' ' + approachY
                    + ' L ' + to.x + ' ' + to.y;
            }

            function drawCable(from, room, whichTor, side, band, stroke, dash, groupKey, laneIdx, slot, totalSlots) {
                var to = torLandingPoint(room, whichTor, side, band, slot, totalSlots);
                var d = cablePath(from, to, laneIdx, band, side);
                return '<path d="' + d + '" stroke="' + stroke + '" stroke-width="2" fill="none"' + (dash ? (' stroke-dasharray="' + dash + '"') : '') + ' />';
            }

            function roomCenterX(room) {
                return (room === 1) ? (room1X + (roomW / 2)) : (room2X + (roomW / 2));
            }

            function sideForCable(room, fromX) {
                return (fromX >= roomCenterX(room)) ? 'R' : 'L';
            }

            // Build a list of all cables first, then assign unique landing slots per TOR and per side.
            var cables = [];
            for (var nr2 = 0; nr2 < nodeRenders.length; nr2++) {
                var nn = nodeRenders[nr2];
                var room = nn.room;

                function sideForDestRoom(destRoom, fromX) {
                    // When there's only one node shown in the destination room (e.g., 2-node Rack Aware),
                    // treat cabling as centered on that TOR so landing points don't cluster on one half.
                    var nodesShownDestRoom = (destRoom === 1) ? room1NodeXs.length : room2NodeXs.length;
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
                    var spD = (nn._stor && nn._stor.ports) ? nn._stor.ports : [];
                    for (var siD = 0; siD < spD.length; siD++) {
                        var smbD = spD[siD];
                        var destRoomD = ((smbD.idx % 2) === 0) ? 2 : 1;
                        cables.push({ room: destRoomD, tor: 0, kind: 'storage', port: 'smb' + String(smbD.idx), from: { x: smbD.x, y: smbD.y }, side: sideForDestRoom(destRoomD, smbD.x), stroke: 'rgba(139,92,246,0.70)', dash: null });
                    }
                } else {
                    // Default behavior (Options A/B/C and generic scenarios)
                    // When there's only one node shown in a room, treat cabling as centered on the TOR
                    // so landing points don't all cluster on one half.
                    var nodesShownThisRoom = (room === 1) ? room1NodeXs.length : room2NodeXs.length;
                    var nodeSide = (nodesShownThisRoom === 1) ? 'C' : (nn.sideInRoom || 'L');

                    // Mgmt/Compute (SET): NIC1->left TOR, NIC2->right TOR (or both->single TOR).
                    if (torCountPerRoom === 2) {
                        cables.push({ room: room, tor: 0, kind: 'set', port: 'nic1', from: nn._set.nic1, side: nodeSide, stroke: 'rgba(255,255,255,0.38)', dash: null });
                        cables.push({ room: room, tor: 1, kind: 'set', port: 'nic2', from: nn._set.nic2, side: nodeSide, stroke: 'rgba(255,255,255,0.38)', dash: null });
                    } else {
                        cables.push({ room: room, tor: 0, kind: 'set', port: 'nic1', from: nn._set.nic1, side: nodeSide, stroke: 'rgba(255,255,255,0.38)', dash: null });
                        cables.push({ room: room, tor: 0, kind: 'set', port: 'nic2', from: nn._set.nic2, side: nodeSide, stroke: 'rgba(255,255,255,0.38)', dash: null });
                    }

                    // Storage (RDMA): alternate SMB ports across TORs when dual-TOR.
                    var sp = (nn._stor && nn._stor.ports) ? nn._stor.ports : [];
                    for (var si = 0; si < sp.length; si++) {
                        var smb = sp[si];
                        var whichTor = 0;
                        if (torCountPerRoom === 2) {
                            whichTor = ((smb.idx % 2) === 0) ? 1 : 0;
                        }
                        cables.push({ room: room, tor: whichTor, kind: 'storage', port: 'smb' + String(smb.idx), from: { x: smb.x, y: smb.y }, side: nodeSide, stroke: 'rgba(139,92,246,0.70)', dash: null });
                    }
                }
            }

            function sideXSort(side) {
                return function (a, b) {
                    var ax = (a.from.x || 0);
                    var bx = (b.from.x || 0);
                    return (side === 'R') ? (bx - ax) : (ax - bx);
                };
            }

            // Bundle by (room, tor, nodeSide) so lane levels are shared across intents.
            var bundles = {};
            for (var ci = 0; ci < cables.length; ci++) {
                var c = cables[ci];
                var k = String(c.room) + '-' + String(c.tor) + '-' + String(c.side || 'L');
                if (!bundles[k]) bundles[k] = [];
                bundles[k].push(c);
            }

            Object.keys(bundles).sort().forEach(function (k) {
                var listAll = bundles[k];
                var side = k.split('-')[2] || 'L';

                // Global lane ordering (controls the stacked approachY levels).
                // For centered single-node-per-room (2-node Rack Aware), enforce symmetry across rooms:
                // give each port a deterministic lane index so the first horizontal turn height matches
                // the corresponding port on the opposite room.
                var laneMap = {};
                if (side === 'C') {
                    for (var liC = 0; liC < listAll.length; liC++) {
                        var cC = listAll[liC];
                        var pC = String(cC.port || '');
                        var idxC = 0;
                        if (pC === 'nic1') idxC = 0;
                        else if (pC === 'nic2') idxC = 1;
                        else {
                            var m = pC.match(/^smb(\d+)$/i);
                            if (m) {
                                var nIdx = parseInt(m[1], 10);
                                // Use negative indices for SMB so Storage bandOffset (+16) is cancelled:
                                // SMB2 (idx 2) -> lane -2 aligns with NIC1 (lane 0)
                                // SMB1 (idx 1) -> lane -1 aligns with NIC2 (lane 1)
                                if (!isNaN(nIdx) && nIdx > 0) idxC = -nIdx;
                            }
                        }
                        laneMap[pC] = idxC;
                    }
                } else {
                    var laneSorted = listAll.slice().sort(sideXSort(side));
                    for (var li0 = 0; li0 < laneSorted.length; li0++) {
                        laneMap[laneSorted[li0].port] = li0;
                    }
                }

                // Landing slots remain per band (set vs storage) to keep inside/outside TOR spacing clean.
                // SET (Mgmt+Compute) landing order: keep left-to-right so NIC1 lands left of NIC2.
                // (Right-side nodes still keep their vertical lane ordering via laneSorted above.)
                var setList = listAll.filter(function (c) { return c.kind !== 'storage'; }).slice().sort(function (a, b) {
                    return (a.from.x || 0) - (b.from.x || 0);
                });
                // Storage landing order: keep left-to-right so SMB1 lands left of SMB2.
                // (Right-side nodes still keep their vertical lane ordering via laneSorted above.)
                var storList = listAll.filter(function (c) { return c.kind === 'storage'; }).slice().sort(function (a, b) {
                    return (a.from.x || 0) - (b.from.x || 0);
                });
                var setSlot = {};
                var storSlot = {};
                for (var si0 = 0; si0 < setList.length; si0++) setSlot[setList[si0].port] = si0;
                for (var ti0 = 0; ti0 < storList.length; ti0++) storSlot[storList[ti0].port] = ti0;

                for (var i0 = 0; i0 < listAll.length; i0++) {
                    var cc = listAll[i0];
                    var band = (cc.kind === 'storage') ? 'storage' : 'set';
                    var laneIdx = laneMap[cc.port] || 0;
                    var slot = (band === 'storage') ? (storSlot[cc.port] || 0) : (setSlot[cc.port] || 0);
                    var total = (band === 'storage') ? storList.length : setList.length;
                    svg += drawCable(cc.from, cc.room, cc.tor, (cc.side || 'L'), band, cc.stroke, cc.dash, k, laneIdx, slot, total);
                }
            });

            // Nodes on top of lines.
            for (var nr3 = 0; nr3 < nodeRenders.length; nr3++) {
                var nd = nodeRenders[nr3];
                svg += nodeFrame(nd.x, nd.y, nd.name);
                svg += nd._set.html;
                svg += nd._stor.html;
            }

            // Room-to-room link patterns (draw above TOR boxes, in the top band).
            // Keep them close enough to visually connect to TORs.
            var linkYBase = torY - 30;
            if (arch === 'option_a' && torCountPerRoom === 2) {
                // Add the upstream Switch/Router and Mgmt/Compute trunks (Learn-style components).
                var swW = 240;
                var swH = 54;
                var swX = Math.floor((svgW - swW) / 2);
                var swY = 18;
                svg += '<rect x="' + swX + '" y="' + swY + '" width="' + swW + '" height="' + swH + '" rx="12" fill="rgba(255,255,255,0.06)" stroke="var(--glass-border)" />';
                svg += label(swX + swW / 2, swY + 26, 'Switch / Router', 'var(--text-primary)', 12, '700');

                // TOR-to-Switch/Router trunks: dotted + slightly transparent (blue), similar style to dotted trunks.
                var trunkStroke = 'var(--accent-blue)';
                var trunkOpacity = 0.55;
                var trunkDash = '1 7';
                var trunkY = swY + swH + 18;
                var room1Mid = Math.floor((room1TorXs[0] + room1TorXs[1] + torW) / 2);
                var room2Mid = Math.floor((room2TorXs[0] + room2TorXs[1] + torW) / 2);

                // One connector per TOR, anchored at the TOR (top-center) and landing on Switch/Router sides.
                // Use two distinct landing Y offsets per side to avoid overlap.
                var attachLeftX = swX;
                var attachRightX = swX + swW;
                var attachYTop = swY + Math.floor(swH * 0.35);
                var attachYBot = swY + Math.floor(swH * 0.65);
                // Label placement: keep close to the Switch/Router side landings (near the upper dotted run), just outside the box.
                var labelLeftX = swX - 86;
                var labelRightX = swX + swW + 86;
                var labelNearY = attachYTop + 14;

                function torTopCenter(x) {
                    return { x: x + Math.floor(torW / 2), y: torY };
                }

                // Room 1 TORs -> left side
                var r1t1 = torTopCenter(room1TorXs[0]);
                var r1t2 = torTopCenter(room1TorXs[1]);
                svg += '<path d="M ' + r1t1.x + ' ' + r1t1.y + ' L ' + r1t1.x + ' ' + attachYTop + ' L ' + attachLeftX + ' ' + attachYTop + '" stroke="' + trunkStroke + '" stroke-opacity="' + trunkOpacity + '" stroke-width="2" stroke-dasharray="' + trunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + r1t2.x + ' ' + r1t2.y + ' L ' + r1t2.x + ' ' + attachYBot + ' L ' + attachLeftX + ' ' + attachYBot + '" stroke="' + trunkStroke + '" stroke-opacity="' + trunkOpacity + '" stroke-width="2" stroke-dasharray="' + trunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label(labelLeftX, labelNearY, 'Management, Compute trunk', 'var(--text-secondary)', 11, '400');

                // Room 2 TORs -> right side
                var r2t3 = torTopCenter(room2TorXs[0]);
                var r2t4 = torTopCenter(room2TorXs[1]);
                // Mirror the left-side ordering: TOR-4 lands above TOR-3.
                svg += '<path d="M ' + r2t4.x + ' ' + r2t4.y + ' L ' + r2t4.x + ' ' + attachYTop + ' L ' + attachRightX + ' ' + attachYTop + '" stroke="' + trunkStroke + '" stroke-opacity="' + trunkOpacity + '" stroke-width="2" stroke-dasharray="' + trunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + r2t3.x + ' ' + r2t3.y + ' L ' + r2t3.x + ' ' + attachYBot + ' L ' + attachRightX + ' ' + attachYBot + '" stroke="' + trunkStroke + '" stroke-opacity="' + trunkOpacity + '" stroke-width="2" stroke-dasharray="' + trunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label(labelRightX, labelNearY, 'Management, Compute trunk', 'var(--text-secondary)', 11, '400');

                var y1 = linkYBase;
                var y2 = linkYBase - 18;
                // Inter-room SMB trunks (TOR↔TOR) should use the SMB accent (purple), while keeping dotted style.
                var smbTrunkStroke = 'var(--accent-purple)';
                var smbTrunkOpacity = 0.55;
                var smbTrunkDash = '1 7';

                function insideTorTopX(torX, dir) {
                    // Nudge toward the diagram interior to avoid overlapping the TOR→Switch/Router anchor at top-center.
                    // dir: +1 (nudge right), -1 (nudge left)
                    var nudge = 12;
                    var x = torX + Math.floor(torW / 2) + (dir * nudge);
                    var minX = torX + 8;
                    var maxX = torX + torW - 8;
                    if (x < minX) x = minX;
                    if (x > maxX) x = maxX;
                    return x;
                }

                // SMB1 trunk: TOR-1 ↔ TOR-3 (connect to TOR top edge)
                var a1x = insideTorTopX(room1TorXs[0], +1);
                var b1x = insideTorTopX(room2TorXs[0], -1);
                svg += '<path d="M ' + a1x + ' ' + torY + ' L ' + a1x + ' ' + y1 + ' L ' + b1x + ' ' + y1 + ' L ' + b1x + ' ' + torY + '" stroke="' + smbTrunkStroke + '" stroke-opacity="' + smbTrunkOpacity + '" stroke-width="2" stroke-dasharray="' + smbTrunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label((a1x + b1x) / 2, y1 - 6, 'SMB1 trunk (TOR-1 ↔ TOR-3) — VLAN 711', 'var(--text-secondary)', 11, '400');

                // SMB2 trunk: TOR-2 ↔ TOR-4 (connect to TOR top edge)
                var a2x = insideTorTopX(room1TorXs[1], +1);
                var b2x = insideTorTopX(room2TorXs[1], -1);
                svg += '<path d="M ' + a2x + ' ' + torY + ' L ' + a2x + ' ' + y2 + ' L ' + b2x + ' ' + y2 + ' L ' + b2x + ' ' + torY + '" stroke="' + smbTrunkStroke + '" stroke-opacity="' + smbTrunkOpacity + '" stroke-width="2" stroke-dasharray="' + smbTrunkDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label((a2x + b2x) / 2, y2 - 6, 'SMB2 trunk (TOR-2 ↔ TOR-4) — VLAN 712', 'var(--text-secondary)', 11, '400');
            } else if (arch === 'option_b' && torCountPerRoom === 2) {
                // Option B: Aggregated storage links.
                // Add the upstream Switch/Router and Mgmt/Compute trunks (same visual style as Option A).
                var swWb = 240;
                var swHb = 54;
                var swXb = Math.floor((svgW - swWb) / 2);
                var swYb = 18;
                svg += '<rect x="' + swXb + '" y="' + swYb + '" width="' + swWb + '" height="' + swHb + '" rx="12" fill="rgba(255,255,255,0.06)" stroke="var(--glass-border)" />';
                svg += label(swXb + swWb / 2, swYb + 26, 'Switch / Router', 'var(--text-primary)', 12, '700');

                var upStroke = 'var(--accent-blue)';
                var upOpacity = 0.55;
                var upDash = '1 7';
                var attachLeftXb = swXb;
                var attachRightXb = swXb + swWb;
                var attachYTopb = swYb + Math.floor(swHb * 0.35);
                var attachYBotb = swYb + Math.floor(swHb * 0.65);
                var labelLeftXb = swXb - 86;
                var labelRightXb = swXb + swWb + 86;
                var labelNearYb = attachYTopb + 14;

                function torTopCenterB(x) {
                    return { x: x + Math.floor(torW / 2), y: torY };
                }

                // Room 1 TORs -> left side (TOR-1 top, TOR-2 bottom)
                var b_r1t1 = torTopCenterB(room1TorXs[0]);
                var b_r1t2 = torTopCenterB(room1TorXs[1]);
                svg += '<path d="M ' + b_r1t1.x + ' ' + b_r1t1.y + ' L ' + b_r1t1.x + ' ' + attachYTopb + ' L ' + attachLeftXb + ' ' + attachYTopb + '" stroke="' + upStroke + '" stroke-opacity="' + upOpacity + '" stroke-width="2" stroke-dasharray="' + upDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + b_r1t2.x + ' ' + b_r1t2.y + ' L ' + b_r1t2.x + ' ' + attachYBotb + ' L ' + attachLeftXb + ' ' + attachYBotb + '" stroke="' + upStroke + '" stroke-opacity="' + upOpacity + '" stroke-width="2" stroke-dasharray="' + upDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label(labelLeftXb, labelNearYb, 'Management, Compute trunk', 'var(--text-secondary)', 11, '400');

                // Room 2 TORs -> right side (mirror: TOR-4 lands above TOR-3)
                var b_r2t3 = torTopCenterB(room2TorXs[0]);
                var b_r2t4 = torTopCenterB(room2TorXs[1]);
                svg += '<path d="M ' + b_r2t4.x + ' ' + b_r2t4.y + ' L ' + b_r2t4.x + ' ' + attachYTopb + ' L ' + attachRightXb + ' ' + attachYTopb + '" stroke="' + upStroke + '" stroke-opacity="' + upOpacity + '" stroke-width="2" stroke-dasharray="' + upDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += '<path d="M ' + b_r2t3.x + ' ' + b_r2t3.y + ' L ' + b_r2t3.x + ' ' + attachYBotb + ' L ' + attachRightXb + ' ' + attachYBotb + '" stroke="' + upStroke + '" stroke-opacity="' + upOpacity + '" stroke-width="2" stroke-dasharray="' + upDash + '" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label(labelRightXb, labelNearYb, 'Management, Compute trunk', 'var(--text-secondary)', 11, '400');

                // TOR-to-TOR storage trunk (single shared trunk with one connector per TOR).
                // Style matches SMB trunks: dotted + slightly transparent purple.
                var smbStrokeB = 'var(--accent-purple)';
                var smbOpacityB = 0.55;
                var smbDashB = '1 7';

                function insideTorTopXb(torX, dir) {
                    // Nudge toward the diagram interior so anchors don't overlap TOR→Switch/Router (top-center).
                    var nudge = 12;
                    var x = torX + Math.floor(torW / 2) + (dir * nudge);
                    var minX = torX + 8;
                    var maxX = torX + torW - 8;
                    if (x < minX) x = minX;
                    if (x > maxX) x = maxX;
                    return x;
                }

                // Anchor points: one per TOR.
                var b_t1 = insideTorTopXb(room1TorXs[0], +1);
                var b_t2 = insideTorTopXb(room1TorXs[1], +1);
                var b_t3 = insideTorTopXb(room2TorXs[0], -1);
                var b_t4 = insideTorTopXb(room2TorXs[1], -1);

                // Shared trunk bus slightly above the TOR row.
                var trunkYB = linkYBase - 18;
                var xMinB = Math.min(Math.min(b_t1, b_t2), Math.min(b_t3, b_t4));
                var xMaxB = Math.max(Math.max(b_t1, b_t2), Math.max(b_t3, b_t4));

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
                var yC = torY + Math.floor(torH / 2);
                // TOR-to-TOR link styling: dotted + slightly transparent.
                svg += '<path d="M ' + (room1TorXs[0] + torW) + ' ' + yC + ' L ' + room2TorXs[0] + ' ' + yC + '" stroke="var(--accent-blue)" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
                svg += label((room1TorXs[0] + torW + room2TorXs[0]) / 2, yC - 6, 'Bundled link (SMB1 + SMB2)', 'var(--text-secondary)', 11, '400');
            } else if (arch === 'option_d' && torCountPerRoom === 1) {
                // Option D: TOR-to-TOR links support management and compute intent traffic.
                // Storage RDMA does not rely on TOR-to-TOR links (nodes cross-connect to both TORs).
                var yD = torY + Math.floor(torH / 2);
                var trunkGap = 10;
                // TOR-to-TOR trunks: dotted + slightly transparent + non-SMB accent.
                svg += '<line x1="' + (room1TorXs[0] + torW) + '" y1="' + (yD - Math.floor(trunkGap / 2)) + '" x2="' + room2TorXs[0] + '" y2="' + (yD - Math.floor(trunkGap / 2)) + '" stroke="var(--accent-blue)" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" />';
                svg += '<line x1="' + (room1TorXs[0] + torW) + '" y1="' + (yD + Math.floor(trunkGap / 2)) + '" x2="' + room2TorXs[0] + '" y2="' + (yD + Math.floor(trunkGap / 2)) + '" stroke="var(--accent-blue)" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round" />';
                svg += label((room1TorXs[0] + torW + room2TorXs[0]) / 2, yD - 12, 'Mgmt/Compute trunk', 'var(--text-secondary)', 11, '400');
            } else {
                svg += label(svgW / 2, torY + torH + 54, 'Select a TOR architecture in the wizard to render a specific option diagram.', 'var(--text-secondary)', 11, '400');
            }

            // Badge for additional nodes not shown (per room/zone).
            var shown1 = Math.min(z1Nodes.length, shownPerZone);
            var shown2 = Math.min(z2Nodes.length, shownPerZone);
            var remaining1 = Math.max(0, z1Nodes.length - shown1);
            var remaining2 = Math.max(0, z2Nodes.length - shown2);

            function moreBadge(roomX, remainingCount) {
                if (!remainingCount || remainingCount <= 0) return;
                var badgeW = 200;
                var badgeH = 26;
                var bx = roomX + Math.floor((roomW - badgeW) / 2);
                var by = roomY + roomH - 38;
                svg += '<rect x="' + bx + '" y="' + by + '" width="' + badgeW + '" height="' + badgeH + '" rx="13" fill="rgba(255,255,255,0.06)" stroke="var(--glass-border)" />';
                svg += label(roomX + roomW / 2, by + 18, '+' + remainingCount + ' more node(s) not shown', 'var(--text-secondary)', 11, '400');
            }

            moreBadge(room1X, remaining1);
            moreBadge(room2X, remaining2);

            svg += '</svg>';
            var foot = '<div class="switchless-diagram__note">This is a simplified, wizard-oriented diagram intended for planning; validate exact cabling/VLAN behavior against your switch vendor guidance and the Microsoft Learn reference architecture.</div>';

            return '<div class="switchless-diagram">' + intro + svg + foot + '</div>';
        }

        function renderSwitchlessStorageDiagram(state) {
            if (!state || state.storage !== 'switchless') return '';

            var n = parseInt(state.nodes, 10);
            if (isNaN(n) || n < 2 || n > 4) {
                return '<div style="color:var(--text-secondary);">Diagram is available for 2–4 node switchless scenarios only.</div>';
            }

            var REF_3NODE_SWITCHLESS = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/three-node-switchless-two-switches-two-links?view=azloc-2511';
            var REF_3NODE_SWITCHLESS_SINGLE = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/three-node-switchless-two-switches-one-link?view=azloc-2511';

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
                var REF_2NODE_SWITCHLESS = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/two-node-switchless-two-switches-two-links?view=azloc-2511';

                var svgW2 = 760;
                var svgH2 = 420;

                // Node panels
                var nodeW2 = 300;
                var nodeH2 = 250;
                var nodeY2 = 100;
                var nodeX2 = [70, 390];

                function getNicLabel2(idx1Based) {
                    return getPortCustomName(state, idx1Based, 'nic');
                }

                function renderSetTeam2(nodeLeft, nodeTop) {
                    var setW = 220;
                    var setH = 62;
                    var setX = nodeLeft + (nodeW2 - setW) / 2;
                    var setY = nodeTop + 78;

                    var nicW = 76;
                    var nicH = 34;
                    var gap = 14;
                    var nic1X = setX + 20;
                    var nic2X = nic1X + nicW + gap;
                    var nicY = setY + 18;

                    var out = '';
                    out += '<text x="' + (nodeLeft + nodeW2 / 2) + '" y="' + (nodeTop + 62) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">Mgmt + Compute intent</text>';
                    out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="12" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="6 4" />';
                    out += '<text x="' + (setX + setW / 2) + '" y="' + (setY + 14) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">SET (vSwitch)</text>';

                    function nicTile(x, y, label, idx) {
                        var t = '';
                        // Center text vertically if label is 9 characters or less, otherwise stagger
                        var textY = (label.length <= 9) ? (y + 21) : ((idx % 2 === 0) ? (y + 16) : (y + 26));
                        t += '<rect x="' + x + '" y="' + y + '" width="' + nicW + '" height="' + nicH + '" rx="8" fill="rgba(0,120,212,0.20)" stroke="rgba(0,120,212,0.55)" />';
                        t += '<text x="' + (x + nicW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(label) + '</text>';
                        return t;
                    }

                    out += nicTile(nic1X, nicY, getNicLabel2(1), 0);
                    out += nicTile(nic2X, nicY, getNicLabel2(2), 1);
                    return out;
                }

                // Storage intent group (2 RDMA ports per node)
                var storageGroupW2 = 260;
                var storageGroupH2 = 92;
                var storageTileW2 = 54;
                var storageTileH2 = 38;
                var storageTileGap2 = 18;

                function storageGroupRect2(nodeIdx) {
                    var nodeLeft = nodeX2[nodeIdx];
                    var x = nodeLeft + (nodeW2 - storageGroupW2) / 2;
                    var y = nodeY2 + 150;
                    return { x: x, y: y, w: storageGroupW2, h: storageGroupH2 };
                }

                function storageTileRect2(nodeIdx, portIdx) {
                    var g = storageGroupRect2(nodeIdx);
                    var totalW = (storageTileW2 * 2) + storageTileGap2;
                    var startX = g.x + (g.w - totalW) / 2;
                    var x = startX + (portIdx * (storageTileW2 + storageTileGap2));
                    var y = g.y + 36;
                    return { x: x, y: y, w: storageTileW2, h: storageTileH2 };
                }

                function storagePortPos2(nodeIdx, portIdx) {
                    var r = storageTileRect2(nodeIdx, portIdx);
                    return { x: r.x + (r.w / 2), y: r.y + r.h };
                }

                function subnetColor2(subnetNumber) {
                    // Two distinct hues.
                    return subnetNumber === 1 ? 'hsla(215, 78%, 62%, 0.95)' : 'hsla(330, 78%, 62%, 0.95)';
                }

                var intro2 = ''
                    + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                    + '<strong style="color:var(--text-primary);">Storage Network ATC intent</strong> (switchless) — storage connectivity only.'
                    + '<br>'
                    + '2-node switchless uses <strong style="color:var(--text-primary);">2 RDMA storage ports per node</strong> (commonly named SMB1–SMB2), and uses <strong style="color:var(--text-primary);">two storage subnets</strong> between the pair.'
                    + '</div>';

                var edges2 = [
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

                var svg2 = '';
                svg2 += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW2 + ' ' + svgH2 + '" role="img" aria-label="2-node switchless storage connectivity diagram">';

                svg2 += '<rect x="35" y="55" width="' + (svgW2 - 70) + '" height="' + (svgH2 - 90) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                svg2 += '<text x="' + (svgW2 / 2) + '" y="42" text-anchor="middle" font-size="13" fill="var(--text-secondary)">Storage Network ATC intent — Switchless=true, ' + escapeHtml(autoIpLabel(state.storageAutoIp)) + '</text>';

                for (var i2 = 0; i2 < 2; i2++) {
                    var x2 = nodeX2[i2];
                    svg2 += '<rect x="' + x2 + '" y="' + nodeY2 + '" width="' + nodeW2 + '" height="' + nodeH2 + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                    svg2 += '<text x="' + (x2 + nodeW2 / 2) + '" y="' + (nodeY2 + 34) + '" text-anchor="middle" font-size="16" fill="var(--text-primary)" font-weight="700">' + escapeHtml(getNodeLabel(i2)) + '</text>';
                    svg2 += renderSetTeam2(x2, nodeY2);

                    var sg2 = storageGroupRect2(i2);
                    svg2 += '<rect x="' + sg2.x + '" y="' + sg2.y + '" width="' + sg2.w + '" height="' + sg2.h + '" rx="12" fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                    svg2 += '<text x="' + (sg2.x + sg2.w / 2) + '" y="' + (sg2.y + 16) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Storage intent (RDMA)</text>';

                    for (var p2 = 0; p2 < 2; p2++) {
                        var tr2 = storageTileRect2(i2, p2);
                        // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                        var lbl2 = getNicLabel2(p2 + 3);
                        // Center text vertically if label is 9 characters or less, otherwise stagger
                        var textY2 = (lbl2.length <= 9) ? (tr2.y + 23) : ((p2 % 2 === 0) ? (tr2.y + 18) : (tr2.y + 28));
                        svg2 += '<rect x="' + tr2.x + '" y="' + tr2.y + '" width="' + tr2.w + '" height="' + tr2.h + '" rx="8" fill="rgba(139,92,246,0.25)" stroke="rgba(139,92,246,0.65)" />';
                        svg2 += '<text x="' + (tr2.x + tr2.w / 2) + '" y="' + textY2 + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(lbl2) + '</text>';
                    }
                }

                var laneBaseY2 = nodeY2 + nodeH2 + 22;
                var laneGap2 = 20;
                var midXOffsets2 = [0, 18];

                for (var e2 = 0; e2 < edges2.length; e2++) {
                    var ed2 = edges2[e2];
                    var a2 = storagePortPos2(ed2.a.n, ed2.a.p);
                    var b2 = storagePortPos2(ed2.b.n, ed2.b.p);
                    var busY2 = laneBaseY2 + (ed2.lane * laneGap2);
                    var midX2 = ((a2.x + b2.x) / 2) + (midXOffsets2[ed2.lane] || 0);
                    var d2 = pathBetween2Clean(a2, b2, busY2, midX2);
                    var stroke2 = subnetColor2(ed2.subnet);
                    svg2 += '<path d="' + d2 + '" fill="none" stroke="' + stroke2 + '" stroke-width="2.6" opacity="0.95" />';
                    svg2 += '<text x="' + midX2 + '" y="' + (busY2 - 6) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Subnet ' + ed2.subnet + '</text>';
                }

                svg2 += '</svg>';

                var subnetExamples2 = {
                    1: getStorageSubnetCidr(state, 1, '10.0.1.0/24'),
                    2: getStorageSubnetCidr(state, 2, '10.0.2.0/24')
                };
                var legendTitle2 = hasCustomStorageSubnets(state) ? 'Storage subnets (custom)' : 'Storage subnets (conceptual)';
                var legendNote2 = getStorageSubnetNote(state, "CIDRs shown are an extrapolated example consistent with Microsoft Learn's 4-node switchless storage intent numbering; use your own addressing plan.");

                var legend2 = '<div class="switchless-diagram__legend">'
                    + '<div class="switchless-diagram__legend-title">' + legendTitle2 + '</div>'
                    + '<div class="switchless-diagram__legend-grid">'
                    + [1, 2].map(function (num) {
                        var edge = edges2.filter(function (e) { return e.subnet === num; })[0];
                        var pair = edge ? edge.pair : '';
                        var ex = subnetExamples2[num] ? (' — ' + subnetExamples2[num]) : '';
                        var preview = ''
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

                var foot2 = '<div style="margin-top:0.5rem; color:var(--text-secondary);">'
                    + 'Reference pattern (2-node switchless dual-TOR dual-link): '
                    + '<a href="' + REF_2NODE_SWITCHLESS + '" target="_blank" rel="noopener">Microsoft Learn</a>'
                    + '</div>';

                return '<div class="switchless-diagram">' + intro2 + svg2 + legend2 + foot2 + '</div>';
            }

            // Special-case: detailed 3-node switchless storage connectivity (SMB1-4, 6 subnets)
            if (n === 3) {
                var linkMode = state && state.switchlessLinkMode ? String(state.switchlessLinkMode) : 'dual_link';

                // Single-link (one storage link per node-pair; 2 RDMA ports per node)
                if (linkMode === 'single_link') {
                    var svgWS = 980;
                    var svgHS = 490;

                    var nodeWS = 280;
                    var nodeHS = 240;
                    var nodeYS = 110;
                    var nodeXS = [60, 350, 640];

                    var storageGroupWS = 210;
                    var storageGroupHS = 86;
                    var storageTileWS = 54;
                    var storageTileHS = 38;
                    var storageTileGapS = 18;

                    function getNicLabelS(idx1Based) {
                        return getPortCustomName(state, idx1Based, 'nic');
                    }

                    function renderSetTeamS(nodeLeft, nodeTop) {
                        var setW = 210;
                        var setH = 62;
                        var setX = nodeLeft + (nodeWS - setW) / 2;
                        var setY = nodeTop + 78;

                        var nicW = 70;
                        var nicH = 34;
                        var gap = 14;
                        var nic1X = setX + 18;
                        var nic2X = nic1X + nicW + gap;
                        var nicY = setY + 18;

                        var out = '';
                        out += '<text x="' + (nodeLeft + nodeWS / 2) + '" y="' + (nodeTop + 62) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">Mgmt + Compute intent</text>';
                        out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="12" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="6 4" />';
                        out += '<text x="' + (setX + setW / 2) + '" y="' + (setY + 14) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">SET (vSwitch)</text>';

                        function nicTile(x, y, label, idx) {
                            var t = '';
                            // Center text vertically if label is 9 characters or less, otherwise stagger
                            var textY = (label.length <= 9) ? (y + 21) : ((idx % 2 === 0) ? (y + 16) : (y + 26));
                            t += '<rect x="' + x + '" y="' + y + '" width="' + nicW + '" height="' + nicH + '" rx="8" fill="rgba(0,120,212,0.20)" stroke="rgba(0,120,212,0.55)" />';
                            t += '<text x="' + (x + nicW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(label) + '</text>';
                            return t;
                        }

                        out += nicTile(nic1X, nicY, getNicLabelS(1), 0);
                        out += nicTile(nic2X, nicY, getNicLabelS(2), 1);
                        return out;
                    }

                    function storageGroupRectS(nodeIdx) {
                        var nodeLeft = nodeXS[nodeIdx];
                        var x = nodeLeft + (nodeWS - storageGroupWS) / 2;
                        var y = nodeYS + 150;
                        return { x: x, y: y, w: storageGroupWS, h: storageGroupHS };
                    }

                    function storageTileRectS(nodeIdx, portIdx) {
                        var g = storageGroupRectS(nodeIdx);
                        var totalW = (storageTileWS * 2) + storageTileGapS;
                        var startX = g.x + (g.w - totalW) / 2;
                        var x = startX + (portIdx * (storageTileWS + storageTileGapS));
                        var y = g.y + 36;
                        return { x: x, y: y, w: storageTileWS, h: storageTileHS };
                    }

                    function storagePortPosS(nodeIdx, portIdx) {
                        var r = storageTileRectS(nodeIdx, portIdx);
                        return { x: r.x + (r.w / 2), y: r.y + r.h };
                    }

                    function subnetColorS(subnetNumber) {
                        var idx = Math.max(1, Math.min(3, subnetNumber)) - 1;
                        var hues = [210, 290, 30];
                        var h = hues[idx % hues.length];
                        return 'hsla(' + h + ', 78%, 62%, 0.95)';
                    }

                    var introS = ''
                        + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                        + '<strong style="color:var(--text-primary);">Storage Network ATC intent</strong> (switchless) — storage connectivity only.'
                        + '<br>'
                        + '3-node switchless (single-link) uses <strong style="color:var(--text-primary);">2 RDMA storage ports per node</strong> (commonly named SMB1–SMB2), and uses <strong style="color:var(--text-primary);">three storage subnets</strong> (one per node-pair).'
                        + '</div>';

                    // Full-mesh single-link mapping:
                    // - Each node connects to both peers with a single link.
                    // - With 2 ports per node, each node dedicates one port per peer.
                    var edgesS = [
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

                    var svgS = '';
                    svgS += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgWS + ' ' + svgHS + '" role="img" aria-label="3-node switchless (single-link) storage connectivity diagram">';

                    svgS += '<rect x="35" y="55" width="' + (svgWS - 70) + '" height="' + (svgHS - 90) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                    svgS += '<text x="' + (svgWS / 2) + '" y="42" text-anchor="middle" font-size="13" fill="var(--text-secondary)">Storage Network ATC intent — Switchless=true, Link=Single-Link, ' + escapeHtml(autoIpLabel(state.storageAutoIp)) + '</text>';

                    for (var iS = 0; iS < 3; iS++) {
                        var xS = nodeXS[iS];
                        svgS += '<rect x="' + xS + '" y="' + nodeYS + '" width="' + nodeWS + '" height="' + nodeHS + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                        svgS += '<text x="' + (xS + nodeWS / 2) + '" y="' + (nodeYS + 34) + '" text-anchor="middle" font-size="16" fill="var(--text-primary)" font-weight="700">' + escapeHtml(getNodeLabel(iS)) + '</text>';
                        svgS += renderSetTeamS(xS, nodeYS);

                        var sgS = storageGroupRectS(iS);
                        svgS += '<rect x="' + sgS.x + '" y="' + sgS.y + '" width="' + sgS.w + '" height="' + sgS.h + '" rx="12" fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                        svgS += '<text x="' + (sgS.x + sgS.w / 2) + '" y="' + (sgS.y + 16) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Storage intent (RDMA)</text>';

                        for (var pS = 0; pS < 2; pS++) {
                            var trS = storageTileRectS(iS, pS);
                            // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                            var labelS = getNicLabelS(pS + 3);
                            // Center text vertically if label is 9 characters or less, otherwise stagger
                            var textYS = (labelS.length <= 9) ? (trS.y + 23) : ((pS % 2 === 0) ? (trS.y + 18) : (trS.y + 28));
                            svgS += '<rect x="' + trS.x + '" y="' + trS.y + '" width="' + trS.w + '" height="' + trS.h + '" rx="8" fill="rgba(139,92,246,0.25)" stroke="rgba(139,92,246,0.65)" />';
                            svgS += '<text x="' + (trS.x + trS.w / 2) + '" y="' + textYS + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(labelS) + '</text>';
                        }
                    }

                    var laneBaseYS = nodeYS + nodeHS + 26;
                    var laneGapS = 22;
                    var midXOffsetsS = [0, 10, -10];

                    for (var eS = 0; eS < edgesS.length; eS++) {
                        var edS = edgesS[eS];
                        var aS = storagePortPosS(edS.a.n, edS.a.p);
                        var bS = storagePortPosS(edS.b.n, edS.b.p);
                        var busYS = laneBaseYS + (edS.lane * laneGapS);
                        var midXS = ((aS.x + bS.x) / 2) + (midXOffsetsS[edS.lane] || 0);
                        var dS = pathBetweenS(aS, bS, busYS, midXS);
                        svgS += '<path d="' + dS + '" fill="none" stroke="' + subnetColorS(edS.subnet) + '" stroke-width="2.6" opacity="0.95" />';
                        svgS += '<text x="' + midXS + '" y="' + (busYS - 6) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Subnet ' + edS.subnet + '</text>';
                    }

                    svgS += '</svg>';

                    var subnetExamplesS = {
                        1: getStorageSubnetCidr(state, 1, '10.0.1.0/24'),
                        2: getStorageSubnetCidr(state, 2, '10.0.2.0/24'),
                        3: getStorageSubnetCidr(state, 3, '10.0.3.0/24')
                    };
                    var legendTitleS = hasCustomStorageSubnets(state) ? 'Storage subnets (custom)' : 'Storage subnets (conceptual)';
                    var legendNoteS = getStorageSubnetNote(state, 'CIDRs shown are an extrapolated example; use your own addressing plan.');

                    var legendS = '<div class="switchless-diagram__legend">'
                        + '<div class="switchless-diagram__legend-title">' + legendTitleS + '</div>'
                        + '<div class="switchless-diagram__legend-grid">'
                        + [1, 2, 3].map(function (num) {
                            var edge = edgesS.filter(function (e) { return e.subnet === num; })[0];
                            var pair = edge ? edge.pair : '';
                            var ex = subnetExamplesS[num] ? (' — ' + subnetExamplesS[num]) : '';
                            var preview = ''
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

                    var footS = '<div style="margin-top:0.5rem; color:var(--text-secondary);">'
                        + 'Reference pattern (3-node switchless dual-TOR single-link): '
                        + '<a href="' + REF_3NODE_SWITCHLESS_SINGLE + '" target="_blank" rel="noopener">Microsoft Learn</a>'
                        + '</div>';

                    return '<div class="switchless-diagram">' + introS + svgS + legendS + footS + '</div>';
                }

                var svgW3 = 980;
                // Increase height so all subnet lanes remain visible.
                var svgH3 = 520;

                // Node panels
                var nodeW = 280;
                var nodeH = 240;
                var nodeY = 110;
                var nodeX = [60, 350, 640];

                // Port layout
                // Mgmt+Compute SET team shown above; storage ports below it.
                var storageGroupW = 240;
                var storageGroupH = 86;

                var storageTileW = 46;
                var storageTileH = 38;
                var storageTileGap = 12;

                function getNicLabel(idx1Based) {
                    return getPortCustomName(state, idx1Based, 'nic');
                }

                function storageGroupRect(nodeIdx) {
                    var nodeLeft = nodeX[nodeIdx];
                    var x = nodeLeft + (nodeW - storageGroupW) / 2;
                    var y = nodeY + 150;
                    return { x: x, y: y, w: storageGroupW, h: storageGroupH };
                }

                function storageTileRect(nodeIdx, portIdx) {
                    // 4 storage RDMA ports per node, shown as tiles.
                    var g = storageGroupRect(nodeIdx);
                    var totalW = (storageTileW * 4) + (storageTileGap * 3);
                    var startX = g.x + (g.w - totalW) / 2;
                    var x = startX + (portIdx * (storageTileW + storageTileGap));
                    var y = g.y + 36;
                    return { x: x, y: y, w: storageTileW, h: storageTileH };
                }

                function storagePortPos(nodeIdx, portIdx) {
                    // Connection anchor at the bottom-center of the tile.
                    var r = storageTileRect(nodeIdx, portIdx);
                    return { x: r.x + (r.w / 2), y: r.y + r.h };
                }

                function renderSetTeam(nodeLeft, nodeTop) {
                    // Render a small SET group with two NIC tiles.
                    var setW = 210;
                    var setH = 62;
                    var setX = nodeLeft + (nodeW - setW) / 2;
                    var setY = nodeTop + 78;

                    var nicW = 70;
                    var nicH = 34;
                    var gap = 14;
                    var nic1X = setX + 18;
                    var nic2X = nic1X + nicW + gap;
                    var nicY = setY + 18;

                    var out = '';
                    out += '<text x="' + (nodeLeft + nodeW / 2) + '" y="' + (nodeTop + 62) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">Mgmt + Compute intent</text>';
                    out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="12" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="6 4" />';
                    out += '<text x="' + (setX + setW / 2) + '" y="' + (setY + 14) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">SET (vSwitch)</text>';

                    // NIC tiles
                    function nicTile(x, y, label, idx) {
                        var t = '';
                        // Center text vertically if label is 9 characters or less, otherwise stagger
                        var textY = (label.length <= 9) ? (y + 21) : ((idx % 2 === 0) ? (y + 16) : (y + 26));
                        t += '<rect x="' + x + '" y="' + y + '" width="' + nicW + '" height="' + nicH + '" rx="8" fill="rgba(0,120,212,0.20)" stroke="rgba(0,120,212,0.55)" />';
                        t += '<text x="' + (x + nicW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(label) + '</text>';
                        return t;
                    }
                    out += nicTile(nic1X, nicY, getNicLabel(1), 0);
                    out += nicTile(nic2X, nicY, getNicLabel(2), 1);
                    return out;
                }

                var intro3 = ''
                    + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                    + '<strong style="color:var(--text-primary);">Storage Network ATC intent</strong> (switchless) — storage connectivity only.'
                    + '<br>'
                    + '3-node switchless (dual-link) uses <strong style="color:var(--text-primary);">4 RDMA storage ports per node</strong> (commonly named SMB1–SMB4), and uses <strong style="color:var(--text-primary);">six storage subnets</strong> (two per node-pair).'
                    + '</div>';

                // Subnet line styles (no new colors; differentiate via dash patterns and opacity)
                var subnetStyles = [
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
                    var idx = Math.max(1, Math.min(6, subnetNumber)) - 1;
                    var hues = [210, 250, 290, 330, 30, 160];
                    var h = hues[idx % hues.length];
                    return 'hsla(' + h + ', 78%, 62%, 0.95)';
                }

                // A clear, consistent mapping (conceptual) between ports and the 6 storage subnets.
                // - Two subnets per node-pair.
                // - Numbering aligns to the 4-node reference pattern numbering style:
                //   1-2: Node1↔Node2, 3-4: Node1↔Node3, 5-6: Node2↔Node3.
                var edges = [
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

                var svg3 = '';
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
                for (var i3 = 0; i3 < 3; i3++) {
                    var x0 = nodeX[i3];
                    svg3 += '<rect x="' + x0 + '" y="' + nodeY + '" width="' + nodeW + '" height="' + nodeH + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                    svg3 += '<text x="' + (x0 + nodeW / 2) + '" y="' + (nodeY + 34) + '" text-anchor="middle" font-size="16" fill="var(--text-primary)" font-weight="700">' + escapeHtml(getNodeLabel(i3)) + '</text>';
                    svg3 += renderSetTeam(x0, nodeY);

                    // Storage intent group (RDMA ports)
                    var sg = storageGroupRect(i3);
                    svg3 += '<rect x="' + sg.x + '" y="' + sg.y + '" width="' + sg.w + '" height="' + sg.h + '" rx="12" fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                    svg3 += '<text x="' + (sg.x + sg.w / 2) + '" y="' + (sg.y + 16) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Storage intent (RDMA)</text>';

                    for (var p3 = 0; p3 < 4; p3++) {
                        var tr = storageTileRect(i3, p3);
                        // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                        var label = getNicLabel(p3 + 3);
                        // Center text vertically if label is 9 characters or less, otherwise stagger
                        var textY3 = (label.length <= 9) ? (tr.y + 23) : ((p3 % 2 === 0) ? (tr.y + 18) : (tr.y + 28));
                        svg3 += '<rect x="' + tr.x + '" y="' + tr.y + '" width="' + tr.w + '" height="' + tr.h + '" rx="8" fill="rgba(139,92,246,0.25)" stroke="rgba(139,92,246,0.65)" />';
                        svg3 += '<text x="' + (tr.x + tr.w / 2) + '" y="' + textY3 + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(label) + '</text>';
                    }
                }

                // Edges
                var laneBaseY = nodeY + nodeH + 26;
                var laneGap = 18;
                var midXOffsets = [0, 10, -6, 6, -18, 18];
                for (var e3 = 0; e3 < edges.length; e3++) {
                    var ed = edges[e3];
                    var st = subnetStyles[ed.subnet - 1];
                    var a = storagePortPos(ed.a.n, ed.a.p);
                    var b = storagePortPos(ed.b.n, ed.b.p);

                    // Assign each subnet a dedicated lane to avoid overlap.
                    var busY = laneBaseY + (ed.lane * laneGap);
                    var midX = ((a.x + b.x) / 2) + (midXOffsets[ed.lane] || 0);
                    var d = pathBetween(a, b, busY, midX);

                    var stroke3 = subnetColor3(ed.subnet);
                    svg3 += '<path d="' + d + '" fill="none" stroke="' + stroke3 + '" stroke-width="2.6" opacity="' + st.opacity + '"' + (st.dash ? (' stroke-dasharray="' + st.dash + '"') : '') + ' />';

                    // Subnet label on its own lane for readability
                    svg3 += '<text x="' + midX + '" y="' + (busY - 6) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Subnet ' + ed.subnet + '</text>';
                }

                svg3 += '</svg>';

                // Legend
                var subnetExamples3 = {
                    1: getStorageSubnetCidr(state, 1, '10.0.1.0/24'),
                    2: getStorageSubnetCidr(state, 2, '10.0.2.0/24'),
                    3: getStorageSubnetCidr(state, 3, '10.0.3.0/24'),
                    4: getStorageSubnetCidr(state, 4, '10.0.4.0/24'),
                    5: getStorageSubnetCidr(state, 5, '10.0.5.0/24'),
                    6: getStorageSubnetCidr(state, 6, '10.0.6.0/24')
                };
                var legendTitle3 = hasCustomStorageSubnets(state) ? 'Storage subnets (custom)' : 'Storage subnets (conceptual)';
                var legendNote3 = getStorageSubnetNote(state, "CIDRs shown are an extrapolated example based on Microsoft Learn's 4-node switchless storage intent pattern (same logic, fewer node pairs). Use your own addressing plan.");

                var legend = '<div class="switchless-diagram__legend">'
                    + '<div class="switchless-diagram__legend-title">' + legendTitle3 + '</div>'
                    + '<div class="switchless-diagram__legend-grid">'
                    + subnetStyles.map(function (st, idx) {
                        var num = idx + 1;
                        var edge = edges.filter(function (e) { return e.subnet === num; })[0];
                        var pair = edge ? edge.pair : '';
                        var ex = subnetExamples3[num] ? (' — ' + subnetExamples3[num]) : '';
                        // Use inline SVG line preview with the same per-subnet color.
                        var preview = ''
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

                var foot3 = '<div style="margin-top:0.5rem; color:var(--text-secondary);">'
                    + 'Reference pattern (3-node switchless dual-TOR dual-link): '
                    + '<a href="' + REF_3NODE_SWITCHLESS + '" target="_blank" rel="noopener">Microsoft Learn</a>'
                    + '</div>';

                return '<div class="switchless-diagram">' + intro3 + svg3 + legend + foot3 + '</div>';
            }

            // Special-case: detailed 4-node switchless storage connectivity (SMB1-6, 12 subnets)
            if (n === 4) {
                var REF_4NODE_SWITCHLESS = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/four-node-switchless-two-switches-two-links?view=azloc-2511';

                var svgW4 = 1220;
                var svgH4 = 700;

                // Node panels (single row)
                var nodeW4 = 260;
                var nodeH4 = 270;
                var nodeY4 = 110;
                var nodeX4 = [60, 340, 620, 900];

                // Shared helper: prefer wizard adapter names if available; else use NIC 1/NIC 2.
                function getNicLabel4(idx1Based) {
                    return getPortCustomName(state, idx1Based, 'nic');
                }

                function renderSetTeam4(nodeLeft, nodeTop) {
                    var setW = 210;
                    var setH = 62;
                    var setX = nodeLeft + (nodeW4 - setW) / 2;
                    var setY = nodeTop + 78;

                    var nicW = 70;
                    var nicH = 34;
                    var gap = 14;
                    var nic1X = setX + 18;
                    var nic2X = nic1X + nicW + gap;
                    var nicY = setY + 18;

                    var out = '';
                    out += '<text x="' + (nodeLeft + nodeW4 / 2) + '" y="' + (nodeTop + 62) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">Mgmt + Compute intent</text>';
                    out += '<rect x="' + setX + '" y="' + setY + '" width="' + setW + '" height="' + setH + '" rx="12" fill="rgba(0,120,212,0.07)" stroke="rgba(0,120,212,0.45)" stroke-dasharray="6 4" />';
                    out += '<text x="' + (setX + setW / 2) + '" y="' + (setY + 14) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">SET (vSwitch)</text>';

                    function nicTile(x, y, label, idx) {
                        var t = '';
                        // Center text vertically if label is 9 characters or less, otherwise stagger
                        var textY = (label.length <= 9) ? (y + 21) : ((idx % 2 === 0) ? (y + 16) : (y + 26));
                        t += '<rect x="' + x + '" y="' + y + '" width="' + nicW + '" height="' + nicH + '" rx="8" fill="rgba(0,120,212,0.20)" stroke="rgba(0,120,212,0.55)" />';
                        t += '<text x="' + (x + nicW / 2) + '" y="' + textY + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(label) + '</text>';
                        return t;
                    }

                    out += nicTile(nic1X, nicY, getNicLabel4(1), 0);
                    out += nicTile(nic2X, nicY, getNicLabel4(2), 1);
                    return out;
                }

                // Storage intent group (6 RDMA ports per node)
                var storageGroupW4 = 240;
                var storageGroupH4 = 118;
                var storageTileW4 = 46;
                var storageTileH4 = 38;
                var storageTileGapX4 = 12;
                var storageTileGapY4 = 10;

                function storageGroupRect4(nodeIdx) {
                    var nodeLeft = nodeX4[nodeIdx];
                    var x = nodeLeft + (nodeW4 - storageGroupW4) / 2;
                    var y = nodeY4 + 150;
                    return { x: x, y: y, w: storageGroupW4, h: storageGroupH4 };
                }

                function storageTileRect4(nodeIdx, portIdx) {
                    // 6 tiles: 3 columns x 2 rows (SMB1..SMB6)
                    var g = storageGroupRect4(nodeIdx);
                    var cols = 3;
                    var col = portIdx % cols;
                    var row = Math.floor(portIdx / cols);

                    var totalW = (storageTileW4 * cols) + (storageTileGapX4 * (cols - 1));
                    var startX = g.x + (g.w - totalW) / 2;
                    var x = startX + (col * (storageTileW4 + storageTileGapX4));
                    // Stagger the second row so SMB4-6 aren't perfectly vertically aligned
                    // with SMB1-3. This reduces stacked vertical routing segments.
                    if (row === 1) {
                        var stagger = (storageTileW4 + storageTileGapX4) / 2;
                        x += stagger;
                        // Keep within the group bounds.
                        var maxX = g.x + g.w - storageTileW4;
                        if (x > maxX) x -= stagger;
                    }
                    var y = g.y + 32 + (row * (storageTileH4 + storageTileGapY4));
                    return { x: x, y: y, w: storageTileW4, h: storageTileH4 };
                }

                function storagePortPos4(nodeIdx, portIdx) {
                    var r = storageTileRect4(nodeIdx, portIdx);
                    return { x: r.x + (r.w / 2), y: r.y + r.h };
                }

                var intro4 = ''
                    + '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                    + '<strong style="color:var(--text-primary);">Storage Network ATC intent</strong> (switchless) — storage connectivity only.'
                    + '<br>'
                    + '4-node switchless commonly uses <strong style="color:var(--text-primary);">8 physical ports per node</strong>: two for <strong style="color:var(--text-primary);">Mgmt+Compute (SET team)</strong> plus <strong style="color:var(--text-primary);">6 RDMA storage ports</strong> (commonly named SMB1–SMB6).'
                    + '<br>'
                    + 'Storage uses <strong style="color:var(--text-primary);">12 storage networks</strong> (two per node-pair).'
                    + '</div>';

                // 12 subnet styles (no new colors; vary dash/opacity)
                var subnetStyles4 = [
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
                    var idx = Math.max(1, Math.min(12, subnetNumber)) - 1;
                    var hues = [205, 235, 265, 295, 325, 355, 25, 55, 85, 115, 145, 175];
                    var h = hues[idx % hues.length];
                    return 'hsla(' + h + ', 78%, 62%, 0.95)';
                }

                // Port/subnet mapping: two subnets per node-pair.
                // Each node has 3 peers; dual-link means 6 RDMA ports and each SMB port maps to exactly one peer.
                var edges4 = [
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

                function pathBetween4(a, b, busY, midX) {
                    return 'M ' + a.x + ' ' + a.y
                        + ' L ' + a.x + ' ' + busY
                        + ' L ' + midX + ' ' + busY
                        + ' L ' + b.x + ' ' + busY
                        + ' L ' + b.x + ' ' + b.y;
                }

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

                var svg4 = '';
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
                for (var i4 = 0; i4 < 4; i4++) {
                    var x4 = nodeX4[i4];
                    svg4 += '<rect x="' + x4 + '" y="' + nodeY4 + '" width="' + nodeW4 + '" height="' + nodeH4 + '" rx="16" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                    svg4 += '<text x="' + (x4 + nodeW4 / 2) + '" y="' + (nodeY4 + 34) + '" text-anchor="middle" font-size="16" fill="var(--text-primary)" font-weight="700">' + escapeHtml(getNodeLabel(i4)) + '</text>';
                    svg4 += renderSetTeam4(x4, nodeY4);

                    var sg4 = storageGroupRect4(i4);
                    svg4 += '<rect x="' + sg4.x + '" y="' + sg4.y + '" width="' + sg4.w + '" height="' + sg4.h + '" rx="12" fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
                    svg4 += '<text x="' + (sg4.x + sg4.w / 2) + '" y="' + (sg4.y + 16) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Storage intent (RDMA)</text>';

                    for (var p4 = 0; p4 < 6; p4++) {
                        var tr4 = storageTileRect4(i4, p4);
                        // Storage ports start at port 3 (after 2 Mgmt+Compute ports)
                        var lbl4 = getNicLabel4(p4 + 3);
                        // Center text vertically if label is 9 characters or less, otherwise stagger
                        var textY4 = (lbl4.length <= 9) ? (tr4.y + 23) : ((p4 % 2 === 0) ? (tr4.y + 18) : (tr4.y + 28));
                        svg4 += '<rect x="' + tr4.x + '" y="' + tr4.y + '" width="' + tr4.w + '" height="' + tr4.h + '" rx="8" fill="rgba(139,92,246,0.25)" stroke="rgba(139,92,246,0.65)" />';
                        svg4 += '<text x="' + (tr4.x + tr4.w / 2) + '" y="' + textY4 + '" text-anchor="middle" font-size="9" fill="var(--text-primary)" font-weight="700">' + escapeHtml(lbl4) + '</text>';
                    }
                }

                // Edges (12 dedicated lanes)
                var laneBaseY4 = nodeY4 + nodeH4 + 30;
                var laneGap4 = 20;
                var midXOffsets4 = [0, 14, -14, 18, -22, 24, -30, 32, -40, 42, -48, 50];
                for (var e4 = 0; e4 < edges4.length; e4++) {
                    var ed4 = edges4[e4];
                    var st4 = subnetStyles4[ed4.subnet - 1];
                    var a4 = storagePortPos4(ed4.a.n, ed4.a.p);
                    var b4 = storagePortPos4(ed4.b.n, ed4.b.p);
                    var busY4 = laneBaseY4 + (ed4.lane * laneGap4);
                    var midX4 = ((a4.x + b4.x) / 2) + (midXOffsets4[ed4.lane] || 0);

                    var d4 = pathBetween4Clean(a4, b4, busY4, midX4);

                    var stroke4 = subnetColor4(ed4.subnet);
                    svg4 += '<path d="' + d4 + '" fill="none" stroke="' + stroke4 + '" stroke-width="2.6" opacity="' + st4.opacity + '"' + (st4.dash ? (' stroke-dasharray="' + st4.dash + '"') : '') + ' />';
                    svg4 += '<text x="' + midX4 + '" y="' + (busY4 - 6) + '" text-anchor="middle" font-size="11" fill="var(--text-secondary)">Subnet ' + ed4.subnet + '</text>';
                }

                svg4 += '</svg>';

                // Legend
                var legendTitle4 = hasCustomStorageSubnets(state) ? 'Storage subnets (custom)' : 'Storage subnets (conceptual)';
                var legendNote4 = getStorageSubnetNote(state, "CIDRs shown are the example values from Microsoft Learn's 4-node switchless storage intent section; use your own addressing plan.");

                var legend4 = '<div class="switchless-diagram__legend">'
                    + '<div class="switchless-diagram__legend-title">' + legendTitle4 + '</div>'
                    + '<div class="switchless-diagram__legend-grid">'
                    + subnetStyles4.map(function (st, idx) {
                        var num = idx + 1;
                        var edge = edges4.filter(function (e) { return e.subnet === num; })[0];
                        var pair = edge ? edge.pair : '';
                        var ex4 = getStorageSubnetCidr(state, num, '10.0.' + num + '.0/24');
                        var preview = ''
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

                var foot4 = '<div style="margin-top:0.5rem; color:var(--text-secondary);">'
                    + 'Reference pattern (4-node switchless dual-TOR dual-link): '
                    + '<a href="' + REF_4NODE_SWITCHLESS + '" target="_blank" rel="noopener">Microsoft Learn</a>'
                    + '</div>';

                return '<div class="switchless-diagram">' + intro4 + svg4 + legend4 + foot4 + '</div>';
            }

            // Generic (2-node): show storage-only full mesh concept with correct RDMA-port count.
            // RDMA ports per node for dual-link full mesh is 2*(n-1) (storage-only).
            // This is intentionally abstract because detailed subnet/port mapping is pattern-specific.
            var rdmaPerNode = 2 * (n - 1);
            var intro = '<div style="color:var(--text-secondary); margin-bottom:0.6rem;">'
                + '<strong style="color:var(--text-primary);">Storage Network ATC intent</strong> (switchless) — storage connectivity only (conceptual). '
                + 'Dual-link full mesh implies <strong style="color:var(--text-primary);">' + rdmaPerNode + ' RDMA storage ports per node</strong>.'
                + '</div>';

            // Layout presets (center points)
            var positions;
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

            var boxW = 200;
            var boxH = 78;
            var portR2 = 4;
            var offsetPattern = [-14, 14, -28, 28, -42, 42, -56, 56];

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

            var alloc = positions.map(function () { return { top: 0, right: 0, bottom: 0, left: 0 }; });
            function sideToward(i, j) {
                var dx = positions[j].x - positions[i].x;
                var dy = positions[j].y - positions[i].y;
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
                var b = boxFor(positions[nodeIndex]);
                var idx = alloc[nodeIndex][side] || 0;
                alloc[nodeIndex][side] = idx + 1;
                var off = offsetPattern[idx] !== undefined ? offsetPattern[idx] : (idx * 14);
                if (side === 'left') return { x: b.left, y: b.cy + off };
                if (side === 'right') return { x: b.right, y: b.cy + off };
                if (side === 'top') return { x: b.cx + off, y: b.top };
                return { x: b.cx + off, y: b.bottom };
            }

            var links = [];
            var ports = [];
            for (var i = 0; i < n; i++) {
                for (var j = i + 1; j < n; j++) {
                    var s1 = sideToward(i, j);
                    var s2 = opposite(s1);
                    var a1 = allocateAnchor(i, s1);
                    var a2 = allocateAnchor(i, s1);
                    var b1 = allocateAnchor(j, s2);
                    var b2 = allocateAnchor(j, s2);
                    links.push({ x1: a1.x, y1: a1.y, x2: b1.x, y2: b1.y, dash: '' });
                    links.push({ x1: a2.x, y1: a2.y, x2: b2.x, y2: b2.y, dash: '6 4' });
                    ports.push(a1, a2, b1, b2);
                }
            }

            var svgW = 800;
            var svgH = (n === 4) ? 380 : 300;
            var svg = '';
            svg += '<svg class="switchless-diagram__svg" viewBox="0 0 ' + svgW + ' ' + svgH + '" role="img" aria-label="Switchless storage connectivity diagram">';
            svg += '<defs>'
                + '<linearGradient id="swg" x1="0" y1="0" x2="1" y2="1">'
                + '<stop offset="0%" stop-color="rgba(0,120,212,0.85)" />'
                + '<stop offset="100%" stop-color="rgba(139,92,246,0.85)" />'
                + '</linearGradient>'
                + '</defs>';

            svg += '<rect x="35" y="45" width="' + (svgW - 70) + '" height="' + (svgH - 80) + '" rx="18" fill="rgba(255,255,255,0.02)" stroke="rgba(139,92,246,0.45)" stroke-dasharray="6 4" />';
            svg += '<text x="' + (svgW / 2) + '" y="32" text-anchor="middle" font-size="13" fill="var(--text-secondary)">Storage Network ATC intent — Switchless=true, ' + escapeHtml(autoIpLabel(state.storageAutoIp)) + '</text>';

            for (var l = 0; l < links.length; l++) {
                var ln = links[l];
                svg += '<line x1="' + ln.x1 + '" y1="' + ln.y1 + '" x2="' + ln.x2 + '" y2="' + ln.y2 + '" stroke="url(#swg)" stroke-width="2" opacity="0.9"' + (ln.dash ? (' stroke-dasharray="' + ln.dash + '"') : '') + ' />';
            }

            for (var k = 0; k < n; k++) {
                var b = boxFor(positions[k]);
                var name = getNodeLabel(k);
                svg += '<rect x="' + b.left + '" y="' + b.top + '" width="' + boxW + '" height="' + boxH + '" rx="12" fill="rgba(255,255,255,0.03)" stroke="var(--glass-border)" />';
                svg += '<text x="' + b.cx + '" y="' + (b.top + 28) + '" text-anchor="middle" font-size="14" fill="var(--text-primary)" font-weight="700">' + escapeHtml(name) + '</text>';
                svg += '<text x="' + b.cx + '" y="' + (b.top + 50) + '" text-anchor="middle" font-size="12" fill="var(--text-secondary)">RDMA storage ports: ' + rdmaPerNode + '</text>';
            }

            for (var p = 0; p < ports.length; p++) {
                var pt = ports[p];
                svg += '<circle cx="' + pt.x + '" cy="' + pt.y + '" r="' + portR2 + '" fill="rgba(139,92,246,0.95)" stroke="rgba(0,0,0,0.35)" stroke-width="1" />';
            }
            svg += '</svg>';

            var foot = '<div style="margin-top:0.5rem; color:var(--text-secondary);">'
                + (n === 3 ? ('Reference pattern: <a href="' + REF_3NODE_SWITCHLESS + '" target="_blank" rel="noopener">Microsoft Learn</a>') : 'Reference patterns vary by topology; use Microsoft Learn guidance for detailed subnet/adapter mapping.')
                + '</div>';

            return '<div class="switchless-diagram">' + intro + svg + foot + '</div>';
        }

        // Scenario
        if (s.scenario === 'hyperconverged') {
            sections.push(block('Deployment Scenario',
                '<strong>Selected:</strong> ' + escapeHtml(formatScenario(s.scenario))
                + '<br><strong>Why it matters:</strong> Single-rack, consolidated compute/storage. Enables Low Capacity or Standard flows in this wizard.'
                + renderValidationInline(validations.byArea.Scenario)
            ));
        } else if (s.scenario === 'disconnected') {
            sections.push(block('Deployment Scenario',
                '<strong>Selected:</strong> ' + escapeHtml(formatScenario(s.scenario))
                + '<br><strong>Why it matters:</strong> Air-gapped deployments constrain outbound connectivity and management options.'
                + '<br><strong>Wizard logic:</strong> Disconnected mode disables cloud-specific selections that require internet access and restricts some scale choices.'
                + renderValidationInline(validations.byArea.Scenario)
            ));
        } else if (s.scenario === 'm365local') {
            sections.push(block('Deployment Scenario',
                '<strong>Selected:</strong> ' + escapeHtml(formatScenario(s.scenario))
                + '<br><strong>Why it matters:</strong> M365 Local deployments are optimized for Microsoft 365 workloads with high availability requirements.'
                + '<br><strong>Wizard logic:</strong> M365 Local requires a minimum of 9 physical nodes. Supports Standard scale configuration only.'
                + renderValidationInline(validations.byArea.Scenario)
            ));
        } else if (s.scenario === 'multirack') {
            sections.push(block('Deployment Scenario',
                '<strong>Selected:</strong> ' + escapeHtml(formatScenario(s.scenario))
                + '<br><strong>Why it matters:</strong> Multi-rack architectures have additional design requirements.'
                + '<br><strong>Wizard logic:</strong> The wizard stops and directs you to contact Microsoft for multi-rack requirements.'
                + renderValidationInline(validations.byArea.Scenario)
            ));
        } else {
            sections.push(block('Deployment Scenario',
                '<strong>Selected:</strong> ' + escapeHtml(formatScenario(s.scenario))
                + renderValidationInline(validations.byArea.Scenario)
            ));
        }

        // Azure Cloud + Local Instance Region
        var cloudNotes = [];
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
        if (s.scenario === 'disconnected' && s.region === 'azure_china') {
            cloudNotes.push('Disconnected mode typically requires manual update workflows; Azure China may be blocked by the wizard when disconnected.');
        }
        sections.push(block('Azure Cloud & Azure Local Region',
            '<strong>Azure Cloud:</strong> ' + escapeHtml(formatCloud(s.region))
            + '<br><strong>Azure Local Instance Region:</strong> ' + escapeHtml(formatLocalInstanceRegion(s.localInstanceRegion))
            + list(cloudNotes)
            + renderValidationInline(validations.byArea.Cloud)
        ));

        // Scale + Nodes
        var scaleNotes = [];
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
        var storageNotes = [];
        if (s.storage === 'switchless') {
            storageNotes.push('Switchless storage typically reduces the number of storage networks and impacts intent options in the wizard.');
            storageNotes.push('Planning note: switchless storage is generally intended for smaller clusters; larger clusters require switched storage connectivity for supportability and scale-out workflows.');

            // For the conditional 3-node low-capacity switchless flow, call out the selected wiring pattern.
            var nodeCountForLinkMode = parseInt(s.nodes, 10);
            if (!isNaN(nodeCountForLinkMode) && nodeCountForLinkMode === 3 && s.scale === 'low_capacity' && s.switchlessLinkMode) {
                var lm = String(s.switchlessLinkMode);
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

        // Intent + Mapping
        var intentNotes = [];
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
        var outboundNotes = [];
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
        var proxyBypassHtml = '';
        if (s.proxy === 'proxy') {
            var bypassItems = [];
            
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
                        var ip = node.ipCidr.split('/')[0];
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
                var infraSubnetWildcard = convertCidrToWildcard(s.infraCidr);
                if (infraSubnetWildcard) {
                    bypassItems.push(infraSubnetWildcard);
                }
            }
            
            // Add Private Endpoint bypass entries if PE is enabled
            if (s.privateEndpoints === 'pe_enabled' && s.privateEndpointsList && s.privateEndpointsList.length > 0) {
                s.privateEndpointsList.forEach(function(peKey) {
                    var info = PRIVATE_ENDPOINT_INFO[peKey];
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

        // Generate outbound connectivity diagram HTML
        var outboundDiagramHtml = '';
        var diagramKey = getOutboundDiagramKey(s);
        if (diagramKey && OUTBOUND_DIAGRAMS[diagramKey]) {
            var diagramUrl = OUTBOUND_DIAGRAMS[diagramKey];
            var diagramTitle = getOutboundDiagramTitle(s);
            outboundDiagramHtml = '<div style="margin-top: 1.5rem;">'
                + '<h4 style="margin-bottom: 0.75rem; color: var(--text-primary);">' + escapeHtml(diagramTitle) + '</h4>'
                + '<div class="switchless-diagram" style="border: 1px solid var(--glass-border); border-radius: 10px; padding: 1rem; background: rgba(0,0,0,0.2);">'
                + '<img src="' + escapeHtml(diagramUrl) + '" alt="' + escapeHtml(diagramTitle) + '" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\';">'
                + '<div style="display: none; padding: 1rem; text-align: center; color: var(--text-secondary);">Diagram not available. <a href="docs/outbound-connectivity/index.html" target="_blank" style="color: var(--accent-blue);">View Connectivity Guide</a></div>'
                + '</div>'
                + '<p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary); text-align: center;">'
                + '<a href="docs/outbound-connectivity/index.html" target="_blank" style="color: var(--accent-blue); text-decoration: none;">📘 View complete Outbound Connectivity Guide</a>'
                + '</p>'
                + '</div>';
        }

        // Generate Private Endpoints section HTML
        var privateEndpointsHtml = '';
        if (s.privateEndpoints === 'pe_enabled' && s.privateEndpointsList && s.privateEndpointsList.length > 0) {
            var peItems = '';
            s.privateEndpointsList.forEach(function(peKey) {
                var info = PRIVATE_ENDPOINT_INFO[peKey];
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
                    var showBypassInfo = s.arc === 'arc_gateway' || s.proxy === 'proxy';
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
            var peBypassItems = [];
            s.privateEndpointsList.forEach(function(peKey) {
                var info = PRIVATE_ENDPOINT_INFO[peKey];
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
            var showBypassSection = s.arc === 'arc_gateway' || s.proxy === 'proxy';
            var peDescription = showBypassSection 
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
            + (outboundNotes.length ? list(outboundNotes) : '')
            + proxyBypassHtml
            + outboundDiagramHtml
            + privateEndpointsHtml
            + renderValidationInline(validations.byArea.Outbound)
        ));

        // IP + Infra VLAN
        var mgmtNotes = [];
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
            + renderValidationInline(validations.byArea.Infrastructure)
        ));

        // Identity + DNS
        var idNotes = [];
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
        var sdnNotes = [];
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
        var results = [];
        var byArea = {
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
            var item = { area: area, name: name, passed: !!passed, details: details || '', refs: refs || [] };
            results.push(item);
            if (byArea[area]) byArea[area].push(item);
        }

        // Helpers
        var ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        function ipToLong(ip) {
            return String(ip).split('.').reduce(function (acc, octet) {
                return (acc << 8) + parseInt(octet, 10);
            }, 0) >>> 0;
        }

        function isValidIpv4Cidr(value) {
            if (!value) return false;
            var trimmed = String(value).trim();
            var parts = trimmed.split('/');
            if (parts.length !== 2) return false;
            var ip = parts[0];
            var prefix = parseInt(parts[1], 10);
            if (!ipv4Regex.test(ip)) return false;
            if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
            return true;
        }

        function extractIpFromCidr(value) {
            if (!value) return '';
            var trimmed = String(value).trim();
            var parts = trimmed.split('/');
            return parts[0] ? String(parts[0]).trim() : '';
        }

        // Microsoft Learn references used in explanations
        // Prefer the exact links already present in the wizard UI when available.
        var REF_PRIVATE_IP = 'https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/private-ip-addresses';

        // Wizard UI links
        var REF_AZLOC_MULTIRACK = 'https://learn.microsoft.com/en-us/azure/azure-local/multi-rack/multi-rack-overview?view=azloc-2511';
        var REF_ARB_IP_RANGES = 'https://learn.microsoft.com/en-us/azure/azure-arc/resource-bridge/network-requirements#designated-ip-ranges-for-arc-resource-bridge';
        var REF_AZLOC_FIREWALL = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/firewall-requirements?view=azloc-2511';
        var REF_AZLOC_VLAN = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/cloud-deployment-network-considerations?view=azloc-2511#management-vlan-id';
        var REF_AZLOC_NET_CONSIDERATIONS = 'https://learn.microsoft.com/en-us/azure/azure-local/plan/cloud-deployment-network-considerations?view=azloc-2511';

        // Additional official references (not in wizard UI but still Microsoft Learn)
        var REF_AZLOC_PREREQS = 'https://learn.microsoft.com/en-us/azure/azure-local/deploy/deployment-prerequisites?view=azloc-2511';
        var REF_AZLOC_AD_PREP = 'https://learn.microsoft.com/en-us/azure/azure-local/deploy/deployment-prep-active-directory?view=azloc-2511';
        var REF_AZLOC_LOCAL_ID = 'https://learn.microsoft.com/en-us/azure/azure-local/deploy/deployment-local-identity-with-key-vault?view=azloc-2511';
        var REF_ARC_GATEWAY = 'https://learn.microsoft.com/en-us/azure/azure-arc/servers/arc-gateway';
        var REF_ARC_GATEWAY_DEEPDIVE = 'https://github.com/Azure/AzureLocal-Supportability/blob/main/TSG/Networking/Arc-Gateway-Outbound-Connectivity/DeepDive-ArcGateway-Outbound-Traffic.md';
        var REF_AZLOC_SDN_OVERVIEW = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/sdn-overview?view=azloc-2511';
        var REF_AZLOC_SDN = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/software-defined-networking?view=azloc-2511';
        var REF_AZLOC_SYSREQ_PUBLIC = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/system-requirements-23h2?view=azloc-2511&tabs=azure-public';
        var REF_AZLOC_SYSREQ_GOV = 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/system-requirements-23h2?view=azloc-2511&tabs=azure-government';

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
        add('Scenario', 'Scenario selected', !!s.scenario, s.scenario ? ('Selected: ' + formatScenario(s.scenario)) : '');
        add('Scenario', 'Multi-Rack is a stop-flow', s.scenario !== 'multirack', s.scenario === 'multirack' ? 'The wizard intentionally stops for Multi-Rack and routes to Microsoft for requirements.' : '', [REF_AZLOC_MULTIRACK]);

        // Cloud + local region
        add('Cloud', 'Azure Cloud selected', !!s.region, s.region ? ('Selected: ' + formatCloud(s.region)) : '');
        add('Cloud', 'Azure Local Instance Region selected', !!s.localInstanceRegion, s.localInstanceRegion ? ('Selected: ' + formatLocalInstanceRegion(s.localInstanceRegion)) : '');

        if (s.scenario === 'disconnected') {
            add('Cloud', 'Disconnected blocks Azure China', s.region !== 'azure_china', 'Disconnected mode disables Azure China selection in this wizard flow.', [REF_AZLOC_PREREQS]);
        }

        // Region support (aligns with wizard filtering + official supported region list)
        if (s.region === 'azure_commercial') {
            var allowedPub = supportedLocalRegionsForCloud('azure_commercial');
            var okPub = !!s.localInstanceRegion && allowedPub.indexOf(String(s.localInstanceRegion)) >= 0;
            add(
                'Cloud',
                'Azure Local region is supported for Azure Public cloud',
                okPub,
                'Microsoft lists supported Azure Public regions for Azure Local (for example: East US, South Central US, West Europe, Australia East, Southeast Asia, India Central, Canada Central, Japan East). The wizard limits choices to this supported catalog.',
                [REF_AZLOC_SYSREQ_PUBLIC]
            );
        } else if (s.region === 'azure_government') {
            var allowedGov = supportedLocalRegionsForCloud('azure_government');
            var okGov = !!s.localInstanceRegion && allowedGov.indexOf(String(s.localInstanceRegion)) >= 0;
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
            if (s.scale === 'medium') {
                add('ScaleNodes', 'Disconnected + Standard requires >= 3 nodes', (s.nodes !== '1' && s.nodes !== '2'), 'Wizard disables 1–2 nodes for Disconnected Standard.');
            }
        }

        if (s.scale === 'low_capacity') {
            var nLow = parseInt(s.nodes, 10);
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
        var nodeVal = (s.nodes === '16+') ? 17 : parseInt(s.nodes, 10);
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
            var singleNodePorts = parseInt(s.ports, 10);
            
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
            var v = parseInt(s.infraVlanId, 10);
            add('Infrastructure', 'Infra VLAN ID is valid (1-4096)', (!isNaN(v) && String(v) === String(s.infraVlanId) && v >= 1 && v <= 4096), 'Valid VLAN IDs are integers 1–4096. Azure Local guidance emphasizes that management VLAN tagging must be configured on the physical adapters before Azure Arc registration so connectivity is preserved through deployment.', [REF_AZLOC_VLAN, REF_AZLOC_NET_CONSIDERATIONS]);
        }

        // Infra network validation (mirrors updateInfraNetwork)
        if (s.infraCidr) {
            var parts = String(s.infraCidr).split('/');
            var cidrIp = parts[0];
            var prefix = parts.length === 2 ? parseInt(parts[1], 10) : NaN;
            add('Infrastructure', 'Infra CIDR format is valid', (parts.length === 2 && ipv4Regex.test(cidrIp) && !isNaN(prefix) && prefix >= 0 && prefix <= 32), 'Example: 192.168.1.0/24');
        }

        if (s.infra && s.infra.start && s.infra.end) {
            var startOk = ipv4Regex.test(s.infra.start);
            var endOk = ipv4Regex.test(s.infra.end);
            add('Infrastructure', 'Infra IP range has valid IPv4 start/end', startOk && endOk, '');

            if (startOk && endOk) {
                var startL = ipToLong(s.infra.start);
                var endL = ipToLong(s.infra.end);
                add('Infrastructure', 'Infra range end >= start', endL >= startL, '');
                var count = endL - startL + 1;
                add('Infrastructure', 'Infra range has at least 6 IPs', count >= 6, 'Azure Local guidance requires a management/infrastructure IP pool of at least six consecutive available IPs for infrastructure services (cluster IP, Arc Resource Bridge VM and components, and other platform services).', [REF_AZLOC_PREREQS, REF_AZLOC_NET_CONSIDERATIONS]);

                // Node IPs must not be inside the reserved Infrastructure IP Pool
                if (Array.isArray(s.nodeSettings) && s.nodeSettings.length > 0) {
                    var offendersPool = [];
                    for (var nn = 0; nn < s.nodeSettings.length; nn++) {
                        var nodeP = s.nodeSettings[nn] || {};
                        var nodeIpCidrP = String(nodeP.ipCidr || '').trim();
                        if (!isValidIpv4Cidr(nodeIpCidrP)) continue;
                        var nodeIpP = extractIpFromCidr(nodeIpCidrP);
                        if (!ipv4Regex.test(nodeIpP)) continue;
                        var nodeLP = ipToLong(nodeIpP);
                        if (nodeLP >= startL && nodeLP <= endL) {
                            var nodeLabelP = String(nodeP.name || '').trim() || ('Node ' + (nn + 1));
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
                var startPrivate = isRfc1918Long(startL);
                var endPrivate = isRfc1918Long(endL);
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
                var reservedRanges = [
                    { name: '10.96.0.0/12', min: ipToLong('10.96.0.0'), max: ipToLong('10.111.255.255') },
                    { name: '10.244.0.0/16', min: ipToLong('10.244.0.0'), max: ipToLong('10.244.255.255') }
                ];
                var overlapsReserved = false;
                for (var i = 0; i < reservedRanges.length; i++) {
                    var r = reservedRanges[i];
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
                    var cidrParts = String(s.infraCidr).split('/');
                    var ip = cidrParts[0];
                    var pfx = cidrParts.length === 2 ? parseInt(cidrParts[1], 10) : NaN;
                    if (ipv4Regex.test(ip) && !isNaN(pfx) && pfx >= 0 && pfx <= 32) {
                        var cidrIpL = ipToLong(ip);
                        var mask = pfx === 0 ? 0 : ((0xFFFFFFFF << (32 - pfx)) >>> 0);
                        var networkL = (cidrIpL & mask) >>> 0;
                        var broadcastL = (networkL | ((~mask) >>> 0)) >>> 0;

                        add('Infrastructure', 'Infra range is within Infra CIDR', (startL >= networkL && endL <= broadcastL), 'Wizard requires range to be within the provided CIDR.');

                        var overlapsCidrReserved = false;
                        for (var j = 0; j < reservedRanges.length; j++) {
                            var rr = reservedRanges[j];
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
                            var outside = [];
                            for (var n = 0; n < s.nodeSettings.length; n++) {
                                var node = s.nodeSettings[n] || {};
                                var nodeIpCidr = String(node.ipCidr || '').trim();
                                if (!isValidIpv4Cidr(nodeIpCidr)) continue;
                                var nodeIp = extractIpFromCidr(nodeIpCidr);
                                if (!ipv4Regex.test(nodeIp)) continue;
                                var nodeL = ipToLong(nodeIp);
                                var inHostRange = (nodeL > networkL && nodeL < broadcastL);
                                if (!inHostRange) {
                                    var nodeLabel = String(node.name || '').trim() || ('Node ' + (n + 1));
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
        var dnsServers = (s.dnsServers || []).filter(function (x) { return x && String(x).trim(); }).map(function (x) { return String(x).trim(); });
        add('DNS', 'At least 1 DNS server configured', dnsServers.length > 0, 'DNS is required so the nodes and infrastructure components can resolve required names (domain controllers, Arc endpoints, etc). Azure Local guidance also states DNS server IPs used by nodes/infrastructure are not supported to change after deployment, so plan this input carefully.', [REF_AZLOC_PREREQS, REF_AZLOC_NET_CONSIDERATIONS]);
        var dnsAllIpv4 = true;
        for (var d = 0; d < dnsServers.length; d++) {
            if (!ipv4Regex.test(dnsServers[d])) dnsAllIpv4 = false;
        }
        add('DNS', 'All DNS servers are valid IPv4', dnsAllIpv4, 'Each DNS server must be a valid IPv4 address to ensure correct resolver configuration.', [REF_AZLOC_PREREQS]);

        if (dnsServers.length > 0 && dnsAllIpv4) {
            var reservedDnsRanges = [
                { name: '10.96.0.0/12', min: ipToLong('10.96.0.0'), max: ipToLong('10.111.255.255') },
                { name: '10.244.0.0/16', min: ipToLong('10.244.0.0'), max: ipToLong('10.244.255.255') }
            ];
            var dnsOverlapsReserved = false;
            for (var k = 0; k < dnsServers.length; k++) {
                var dl = ipToLong(dnsServers[k]);
                for (var m = 0; m < reservedDnsRanges.length; m++) {
                    var rr2 = reservedDnsRanges[m];
                    if (dl >= rr2.min && dl <= rr2.max) dnsOverlapsReserved = true;
                }
            }
            add('DNS', 'DNS servers do not overlap AKS reserved networks (10.96.0.0/12, 10.244.0.0/16)', !dnsOverlapsReserved, 'Ensures the DNS servers are not placed inside the reserved Kubernetes ranges used by Arc Resource Bridge and Azure Local infrastructure.', [REF_ARB_IP_RANGES, REF_AZLOC_PREREQS]);

            if (s.infra && s.infra.start && s.infra.end && ipv4Regex.test(s.infra.start) && ipv4Regex.test(s.infra.end)) {
                var infraStartL = ipToLong(s.infra.start);
                var infraEndL = ipToLong(s.infra.end);
                var dnsInsideInfra = false;
                for (var q = 0; q < dnsServers.length; q++) {
                    var dl2 = ipToLong(dnsServers[q]);
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
        var f = s.sdnFeatures || [];
        var hasVnet = f.indexOf('vnet') >= 0;
        var hasSlb = f.indexOf('slb') >= 0;
        var hasLnet = f.indexOf('lnet') >= 0;
        var hasNsg = f.indexOf('nsg') >= 0;
        var onlyLnetNsg = (hasLnet || hasNsg) && !hasVnet && !hasSlb;
        var hasVnetOrSlb = hasVnet || hasSlb;

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
        var seen = {};
        var uniq = [];
        for (var i = 0; i < refs.length; i++) {
            var u = refs[i];
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
            + uniq.map(function (u) {
                return '<a href="' + escapeHtml(u) + '" target="_blank" rel="noreferrer" style="color:var(--accent-blue); text-decoration:underline;">' + escapeHtml(labelFor(u)) + '</a>';
            }).join(' &nbsp; ')
            + '</div>';
    }

    function renderValidationInline(items) {
        if (!items || items.length === 0) return '';
        var passed = items.filter(function (x) { return x.passed; });
        var failed = items.filter(function (x) { return !x.passed; });

        var html = '<div style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid var(--glass-border);">'
            + '<strong>Validation checks</strong>';

        if (failed.length) {
            html += '<div style="margin-top:0.4rem; color:var(--accent-purple);">Some checks did not pass in this snapshot:</div>';
        }

        html += '<ul style="margin:0.4rem 0 0 1.25rem; color:var(--text-primary);">'
            + items.slice(0, 6).map(function (v) {
                var mark = v.passed ? '<span style="color:var(--success);">✓</span>' : '<span style="color:var(--accent-purple);">⚠</span>';
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
        var all = validations.results || [];
        var passCount = all.filter(function (x) { return x.passed; }).length;
        var failCount = all.length - passCount;

        var header = '<div class="summary-section">'
            + '<div class="summary-section-title summary-section-title--mgmt">Validation Results</div>'
            + '<div style="color:var(--text-primary);">'
            + '<strong>Passed:</strong> <span style="color:var(--success);">' + passCount + '</span>'
            + ' &nbsp; <strong>Warnings/Failures:</strong> <span style="color:var(--accent-purple);">' + failCount + '</span>'
            + '</div>';

        var rows = all.map(function (v) {
            var mark = v.passed ? '<span style="color:var(--success); font-weight:700;">✓</span>' : '<span style="color:var(--accent-purple); font-weight:700;">⚠</span>';
            var detail = v.details ? ('<div style="color:var(--text-secondary); margin-top:0.15rem;">' + escapeHtml(v.details) + '</div>') : '';
            var refs = (v.refs && v.refs.length) ? renderRefs(v.refs) : '';
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
        var scenarioScaleRows = '';
        if (s.scenario) scenarioScaleRows += row('Scenario', formatScenario(s.scenario));
        if (s.region) scenarioScaleRows += row('Azure Cloud', formatCloud(s.region));
        if (s.localInstanceRegion) scenarioScaleRows += row('Azure Local Instance Region', formatLocalInstanceRegion(s.localInstanceRegion));
        if (s.scale) scenarioScaleRows += row('Scale', formatScale(s.scale));
        if (s.nodes) scenarioScaleRows += row('Nodes', s.nodes, true);
        if (s.witnessType) scenarioScaleRows += row('Cloud Witness', s.witnessType === 'Cloud' ? 'Cloud' : 'No Witness');

        // Step 06–08: Host Networking
        var hostNetworkingRows = '';
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
            var validSubnets = s.customStorageSubnets.filter(function(subnet) { return subnet && String(subnet).trim(); });
            if (validSubnets.length > 0) {
                hostNetworkingRows += row('Storage Subnets', validSubnets.join(', '), true);
                // Calculate and display storage adapter IPs for each node
                var nodeCount = parseInt(s.nodes, 10) || 0;
                if (nodeCount > 0) {
                    var storageIpDetails = [];
                    
                    // Helper function to get subnet prefix from CIDR
                    var getSubnetPrefix = function(cidr) {
                        var cidrParts = String(cidr).trim().split('/');
                        if (cidrParts.length >= 1) {
                            var ipParts = cidrParts[0].split('.');
                            if (ipParts.length === 4) {
                                return ipParts[0] + '.' + ipParts[1] + '.' + ipParts[2];
                            }
                        }
                        return null;
                    };
                    
                    // Helper to get node name
                    var getNodeName = function(nodeIdx) {
                        return (Array.isArray(s.nodeSettings) && s.nodeSettings[nodeIdx] && s.nodeSettings[nodeIdx].name) 
                            ? s.nodeSettings[nodeIdx].name : ('node' + (nodeIdx + 1));
                    };
                    
                    if (s.storage === 'switched') {
                        // For switched storage, show IPs from the first two subnets (SMB1, SMB2)
                        // All nodes share the same two subnets
                        for (var subnetIdx = 0; subnetIdx < Math.min(validSubnets.length, 2); subnetIdx++) {
                            var prefix = getSubnetPrefix(validSubnets[subnetIdx]);
                            if (prefix) {
                                var adapterName = 'SMB' + (subnetIdx + 1);
                                var nodeIps = [];
                                for (var nodeIdx = 0; nodeIdx < nodeCount; nodeIdx++) {
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
                            var subnetPairs3 = { 1: [1, 2], 2: [1, 2], 3: [1, 3], 4: [1, 3], 5: [2, 3], 6: [2, 3] };
                            var nodeToSubnetBySmb3 = { 1: [1, 2, 3, 4], 2: [1, 2, 5, 6], 3: [3, 4, 5, 6] };
                            
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
                            var subnetPairs4 = { 1: [1, 2], 2: [1, 2], 3: [1, 3], 4: [1, 3], 5: [1, 4], 6: [1, 4],
                                                 7: [2, 3], 8: [2, 3], 9: [2, 4], 10: [2, 4], 11: [3, 4], 12: [3, 4] };
                            var nodeToSubnetBySmb4 = { 1: [1, 2, 3, 4, 5, 6], 2: [1, 2, 7, 8, 9, 10], 
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
            var spConfig = s.storagePoolConfiguration === 'InfraOnly' ? 'Infrastructure Only' : 
                          s.storagePoolConfiguration === 'KeepStorage' ? 'Keep Existing Storage' : 'Express';
            hostNetworkingRows += row('Storage Pool Configuration', spConfig);
        }

        // Step 09–11: Connectivity
        var connectivityRows = '';
        if (s.outbound) connectivityRows += row('Outbound', formatOutbound(s.outbound));
        if (s.arc) {
            var arcText = s.arc === 'arc_gateway' ? (s.outbound === 'private' ? 'Required' : 'Enabled') : 'Disabled';
            connectivityRows += row('Arc Gateway', arcText);
        }
        if (s.proxy) {
            var proxyText = s.proxy === 'no_proxy' ? 'Disabled' : (s.outbound === 'private' ? 'Required (Azure Firewall Explicit Proxy)' : 'Enabled');
            connectivityRows += row('Proxy', proxyText);
        }
        if (s.privateEndpoints) connectivityRows += row('Private Endpoints', s.privateEndpoints === 'pe_enabled' ? 'Enabled (' + (s.privateEndpointsList ? s.privateEndpointsList.length : 0) + ' services)' : 'Disabled');
        
        // Generate connectivity diagram based on outbound/arc/proxy selection
        var connectivityExtra = '';
        var diagramKey = getOutboundDiagramKey(s);
        if (diagramKey && OUTBOUND_DIAGRAMS[diagramKey]) {
            var diagramUrl = OUTBOUND_DIAGRAMS[diagramKey];
            var diagramTitle = getOutboundDiagramTitle(s);
            connectivityExtra = '<div id="outbound-connectivity-diagram" style="margin-top:1.5rem;">'
                + '<h4 style="margin-bottom: 0.75rem; color: var(--text-primary); font-size: 1.1rem; font-weight: 600;">' + escapeHtml(diagramTitle) + '</h4>'
                + '<div style="border: 1px solid var(--glass-border); border-radius: 8px; padding: 1rem; background: rgba(0,0,0,0.15);">'
                + '<img id="outbound-diagram-img" src="' + escapeHtml(diagramUrl) + '" alt="' + escapeHtml(diagramTitle) + '" style="width: 100%; height: auto; display: block; margin: 0 auto;" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\';">'
                + '<div style="display: none; padding: 1rem; text-align: center; color: var(--text-secondary);">Diagram not available</div>'
                + '</div>'
                + '<div class="no-print" style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">'
                + '<button type="button" class="report-action-button" onclick="window.downloadOutboundConnectivityDiagramSvg(\'light\')">Download SVG (Light)</button>'
                + '<button type="button" class="report-action-button" onclick="window.downloadOutboundConnectivityDiagramSvg(\'dark\')">Download SVG (Dark)</button>'
                + '</div>'
                + '<p style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); text-align: center;">'
                + '<a href="../docs/outbound-connectivity/index.html" target="_blank" style="color: var(--accent-blue); text-decoration: none;">📘 View complete Outbound Connectivity Guide</a>'
                + '</p>'
                + '</div>';
        }

        // Step 12–14: Infrastructure Network
        var infraNetworkRows = '';
        if (s.ip) infraNetworkRows += row('IP', s.ip.charAt(0).toUpperCase() + s.ip.slice(1));
        if (s.infraVlan) infraNetworkRows += row('Infra VLAN', s.infraVlan === 'custom' ? 'Custom VLAN' : 'Default VLAN');
        if (s.infraVlan === 'custom' && s.infraVlanId) infraNetworkRows += row('Infra VLAN ID', s.infraVlanId, true);
        if (s.infraCidr) infraNetworkRows += row('Infra Network', s.infraCidr, true);
        if (s.infra && s.infra.start && s.infra.end) infraNetworkRows += row('Infra Range', s.infra.start + ' - ' + s.infra.end, true);
        if (s.infraGateway) infraNetworkRows += row('Default Gateway', s.infraGateway, true);
        // Display node IP addresses for ARM template (always shown when nodeSettings is populated)
        if (Array.isArray(s.nodeSettings) && s.nodeSettings.length > 0) {
            var nodeIpList = s.nodeSettings
                .map(function(n, idx) { 
                    if (!n) return null;
                    var nodeName = n.name ? String(n.name).trim() : ('Node' + (idx + 1));
                    var ip = n.ipCidr ? String(n.ipCidr).split('/')[0] : null;
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
        var activeDirectoryRows = '';
        if (s.activeDirectory) activeDirectoryRows += row('Identity', s.activeDirectory === 'azure_ad' ? 'Active Directory' : 'Local Identity');
        if (s.adDomain) activeDirectoryRows += row('AD Domain', s.adDomain, true);
        if (s.adOuPath) activeDirectoryRows += row('AD OU Path', s.adOuPath, true);
        if (s.adfsServerName) activeDirectoryRows += row('ADFS Server Name', s.adfsServerName, true);
        if (s.dnsServers && s.dnsServers.length) activeDirectoryRows += row('DNS Servers', s.dnsServers.join(', '), true);
        if (s.localDnsZone) activeDirectoryRows += row('Local DNS Zone', s.localDnsZone, true);

        // Step 16: Security Configuration
        var securityRows = '';
        if (s.securityConfiguration) securityRows += row('Configuration', s.securityConfiguration === 'recommended' ? 'Recommended' : 'Customized');
        if (s.securityConfiguration === 'customized' && s.securitySettings) {
            var secSettings = s.securitySettings;
            if (secSettings.wdacEnforced !== undefined) securityRows += row('WDAC', secSettings.wdacEnforced ? 'Enabled' : 'Disabled');
            if (secSettings.credentialGuardEnforced !== undefined) securityRows += row('Credential Guard', secSettings.credentialGuardEnforced ? 'Enabled' : 'Disabled');
            if (secSettings.driftControlEnforced !== undefined) securityRows += row('Drift Control', secSettings.driftControlEnforced ? 'Enabled' : 'Disabled');
            if (secSettings.smbSigningEnforced !== undefined) securityRows += row('SMB Signing', secSettings.smbSigningEnforced ? 'Enabled' : 'Disabled');
            if (secSettings.smbClusterEncryption !== undefined) securityRows += row('SMB Cluster Encryption', secSettings.smbClusterEncryption ? 'Enabled' : 'Disabled');
            if (secSettings.bitlockerBootVolume !== undefined) securityRows += row('BitLocker Boot Volume', secSettings.bitlockerBootVolume ? 'Enabled' : 'Disabled');
            if (secSettings.bitlockerDataVolumes !== undefined) securityRows += row('BitLocker Data Volumes', secSettings.bitlockerDataVolumes ? 'Enabled' : 'Disabled');
        }

        // Step 17: Software Defined Networking
        var sdnRows = '';
        if (s.sdnFeatures && s.sdnFeatures.length) sdnRows += row('SDN Features', s.sdnFeatures.join(', '));
        if (s.sdnManagement) sdnRows += row('SDN Management', s.sdnManagement === 'arc_managed' ? 'Arc Managed' : 'On-Premises Managed');

        function section(title, cls, rowsHtml, dataKey) {
            if (!rowsHtml) return '';
            var dataAttr = dataKey ? (' data-summary-section="' + escapeHtml(dataKey) + '"') : '';
            return '<div class="summary-section"' + dataAttr + '>'
                + '<div class="summary-section-title ' + cls + '">' + escapeHtml(title) + '</div>'
                + rowsHtml
                + '</div>';
        }

        function sectionWithExtra(title, cls, rowsHtml, extraHtml, dataKey) {
            if (!rowsHtml && !extraHtml) return '';
            var dataAttr = dataKey ? (' data-summary-section="' + escapeHtml(dataKey) + '"') : '';
            return '<div class="summary-section"' + dataAttr + '>'
                + '<div class="summary-section-title ' + cls + '">' + escapeHtml(title) + '</div>'
                + (rowsHtml || '')
                + (extraHtml || '')
                + '</div>';
        }

        return section('Scenario & Scale', 'summary-section-title--infra', scenarioScaleRows, 'scenario-scale')
            + section('Host Networking', 'summary-section-title--net', hostNetworkingRows, 'host-networking')
            + sectionWithExtra('Connectivity', 'summary-section-title--mgmt', connectivityRows, connectivityExtra, 'connectivity')
            + section('Infrastructure Network', 'summary-section-title--infra', infraNetworkRows, 'infrastructure-network')
            + section('Active Directory', 'summary-section-title--mgmt', activeDirectoryRows, 'active-directory')
            + section('Security Configuration', 'summary-section-title--mgmt', securityRows, 'security')
            + section('Software Defined Networking', 'summary-section-title--net', sdnRows, 'sdn');
    }

    function init() {
        var payload = tryParsePayload();
        var metaEl = document.getElementById('report-meta');
        var sumEl = document.getElementById('report-summary');
        var valEl = document.getElementById('report-validations');
        var ratEl = document.getElementById('report-rationale');

        if (!payload || !payload.state) {
            if (metaEl) {
                metaEl.innerHTML = '<strong style="color:#ffc107;">No configuration found</strong><br>Open this report using the "Generate configuration report" button from the wizard.';
            }
            return;
        }

        var s = payload.state;
        CURRENT_REPORT_STATE = s;

        if (metaEl) {
            metaEl.innerHTML = '<strong>Generated</strong><br>'
                + escapeHtml(payload.generatedAt || '-')
                + '<br><strong>Scenario</strong><br>'
                + escapeHtml(formatScenario(s.scenario));
        }

        if (sumEl) {
            sumEl.innerHTML = renderSummaryCards(s);
        }

        // Note: The outbound connectivity diagram is loaded via <img> tag in renderSummaryCards,
        // so no additional fetch is needed here.

        if (valEl) {
            var validations = computeValidations(s);
            valEl.innerHTML = renderValidationSummary(validations);
        }

        if (ratEl) {
            // User request: show the diagram under Host Networking summary, not in Decisions & Rationale.
            // We generate the rationale HTML, extract any diagram blocks, and inject them into the summary.
            var rationaleHtml = rationaleForState(s);
            var movedDiagramInnerHtml = '';

            try {
                var parser = new DOMParser();
                var doc = parser.parseFromString('<div id="__wrap">' + rationaleHtml + '</div>', 'text/html');
                var wrap = doc.getElementById('__wrap');

                function extractDiagramBodyByTitle(titleText) {
                    if (!wrap) return '';
                    var titles = wrap.querySelectorAll('.summary-section-title');
                    for (var i = 0; i < titles.length; i++) {
                        var t = titles[i];
                        if (!t || !t.textContent) continue;
                        if (t.textContent.trim() !== titleText) continue;
                        var sectionEl = t.closest('.summary-section');
                        if (!sectionEl) continue;

                        // body is the block() wrapper inner div
                        var bodyEl = null;
                        var divs = sectionEl.getElementsByTagName('div');
                        for (var j = 0; j < divs.length; j++) {
                            var d = divs[j];
                            if (d && d.getAttribute && (d.getAttribute('style') || '').indexOf('line-height') >= 0) {
                                bodyEl = d;
                                break;
                            }
                        }

                        var inner = bodyEl ? bodyEl.innerHTML : sectionEl.innerHTML;
                        sectionEl.parentNode.removeChild(sectionEl);
                        return inner || '';
                    }
                    return '';
                }

                // Pull either diagram (only one should apply for a given storage selection).
                var swl = extractDiagramBodyByTitle('Switchless Storage Connectivity (Diagram)');
                var swd = extractDiagramBodyByTitle('Switched Connectivity (Diagram)');
                var snc = extractDiagramBodyByTitle('Network Connectivity (Diagram)');  // Single-node clusters
                var rac = extractDiagramBodyByTitle('Rack Aware TOR Architecture (Diagram)');
                movedDiagramInnerHtml = (swl || rac || swd || snc || '');

                ratEl.innerHTML = wrap ? wrap.innerHTML : rationaleHtml;
            } catch (e) {
                // Fallback: keep existing rationale if extraction fails.
                ratEl.innerHTML = rationaleHtml;
                movedDiagramInnerHtml = '';
            }

            // Inject diagram under Host Networking section in the summary.
            try {
                if (movedDiagramInnerHtml && sumEl) {
                    var hostSec = sumEl.querySelector('[data-summary-section="host-networking"]');
                    if (hostSec) {
                        var container = document.createElement('div');
                        container.style.marginTop = '0.75rem';
                        container.style.paddingTop = '0.75rem';
                        container.style.borderTop = '1px solid var(--glass-border)';
                        container.innerHTML = movedDiagramInnerHtml;
                        hostSec.appendChild(container);

                        // Add a button below the diagram for SVG export.
                        var svg = hostSec.querySelector('svg.switchless-diagram__svg');
                        if (svg) {
                            var btnWrap = document.createElement('div');
                            btnWrap.className = 'no-print';
                            btnWrap.style.marginTop = '0.75rem';
                            btnWrap.style.display = 'flex';
                            btnWrap.style.gap = '0.5rem';

                            var btnLight = document.createElement('button');
                            btnLight.type = 'button';
                            btnLight.className = 'report-action-button';
                            btnLight.textContent = 'Download SVG (Light)';
                            btnLight.addEventListener('click', function () {
                                window.downloadHostNetworkingDiagramSvg('light');
                            });

                            var btnDark = document.createElement('button');
                            btnDark.type = 'button';
                            btnDark.className = 'report-action-button';
                            btnDark.textContent = 'Download SVG (Dark)';
                            btnDark.addEventListener('click', function () {
                                window.downloadHostNetworkingDiagramSvg('dark');
                            });

                            btnWrap.appendChild(btnLight);
                            btnWrap.appendChild(btnDark);
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
