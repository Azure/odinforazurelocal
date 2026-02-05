/**
 * Odin for Azure Local - DNS Management Module
 * 
 * Functions for managing DNS server configuration in the wizard.
 * These functions manage the DNS server list and validate DNS settings.
 * 
 * Dependencies: 
 * - Global state object (from script.js)
 * - updateSummary() function (from script.js)
 * - js/utils.js (for ipToLong)
 */

// ============================================================================
// DNS SERVER LIST MANAGEMENT
// ============================================================================

/**
 * Add a new empty DNS server entry to the list.
 */
function addDnsServer() {
    state.dnsServers.push('');
    renderDnsServers();
}

/**
 * Remove a DNS server entry from the list.
 * @param {number} index - The index of the server to remove
 */
function removeDnsServer(index) {
    state.dnsServers.splice(index, 1);
    renderDnsServers();
    validateAllDnsServers();
}

/**
 * Update a DNS server entry value.
 * @param {number} index - The index of the server to update
 * @param {string} value - The new IP address value
 */
function updateDnsServer(index, value) {
    state.dnsServers[index] = value.trim();
    validateAllDnsServers();
}

// ============================================================================
// DNS SERVER RENDERING
// ============================================================================

/**
 * Render the DNS server input fields in the wizard.
 */
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

// ============================================================================
// DNS SERVICE CONFIGURATION
// ============================================================================

/**
 * Update the DNS service existing note text based on current state.
 */
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

/**
 * Update the DNS service existing state.
 * @param {string} value - 'yes' or 'no'
 */
function updateDnsServiceExisting(value) {
    // This selection is currently informational for the wizard UX.
    // Keep state for reporting/future logic without changing required-field rules.
    state.dnsServiceExisting = (String(value) === 'yes');
    updateDnsServiceExistingNote();
    updateSummary();
}

// ============================================================================
// DNS VALIDATION
// ============================================================================

/**
 * Validate all DNS server entries for format and subnet conflicts.
 */
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

/**
 * Update the local DNS zone state.
 */
function updateLocalDnsZone() {
    const input = document.getElementById('local-dns-zone-input');
    if (input) {
        state.localDnsZone = input.value.trim() || null;
        updateSummary();
    }
}
