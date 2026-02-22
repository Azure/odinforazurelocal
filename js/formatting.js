/**
 * Odin for Azure Local - Formatting Module
 *
 * Pure formatting functions for displaying values in the UI.
 * These functions have no side effects and depend only on their input parameters.
 *
 * Dependencies: js/utils.js (for capitalize function)
 */

// ============================================================================
// PORT DISPLAY FUNCTIONS
// ============================================================================

/**
 * Get the display name for a port (1-based index).
 * Returns the custom name if set, otherwise the default "Port N" format.
 * @param {number} portIdx1Based - 1-based port index
 * @returns {string} - Display name for the port
 */
function getPortDisplayName(portIdx1Based) {
    const cfg = Array.isArray(state.portConfig) ? state.portConfig : [];
    const pc = cfg[portIdx1Based - 1];
    if (pc && pc.customName && pc.customName.trim()) {
        return pc.customName.trim();
    }
    return `Port ${portIdx1Based}`;
}

// ============================================================================
// PROXY FORMATTING
// ============================================================================

/**
 * Get a human-readable label for the current proxy configuration.
 * @returns {string} - Proxy status label
 */
function getProxyLabel() {
    if (!state.proxy) return '-';
    if (state.proxy === 'no_proxy') return 'Disabled';
    if (state.outbound === 'private') return 'Azure Firewall Explicit Proxy';
    return 'Enabled';
}

// ============================================================================
// SCENARIO AND SCALE FORMATTING
// ============================================================================

/**
 * Format a scenario value for display.
 * @param {string} val - Scenario value
 * @returns {string} - Formatted scenario name
 */
function formatScenario(val) {
    if (!val) return '';
    if (val === 'hyperconverged') return 'Hyperconverged';
    if (val === 'multirack') return 'Multi-Rack';
    if (val === 'disconnected') {
        if (typeof state !== 'undefined' && state.outbound === 'limited') return 'Disconnected (Limited Connectivity)';
        return 'Disconnected (Air Gapped)';
    }
    if (val === 'm365local') return 'M365 Local';
    return capitalize(val);
}

/**
 * Format a scale value for display.
 * @param {string} val - Scale value
 * @returns {string} - Formatted scale name
 */
function formatScale(val) {
    if (val === 'low_capacity') return 'Low Capacity';
    if (val === 'medium') return 'Hyperconverged (1-16 Nodes)';
    if (val === 'rack_aware') return 'Rack Aware (Multi-Room)';
    if (val === 'rack_scale') return 'Rack Scale';
    return capitalize(val);
}

// ============================================================================
// CONNECTIVITY FORMATTING
// ============================================================================

/**
 * Format an outbound connectivity value for display.
 * @param {string} val - Outbound connectivity value
 * @returns {string} - Formatted outbound name
 */
function formatOutbound(val) {
    if (val === 'public') return 'Public Internet';
    if (val === 'private') return 'ExpressRoute / VPN';
    if (val === 'air_gapped') return 'Air Gapped';
    if (val === 'limited') return 'Limited Connectivity';
    return capitalize(val);
}

// ============================================================================
// INTENT FORMATTING
// ============================================================================

/**
 * Format an intent value for display.
 * @param {string} val - Intent value
 * @returns {string} - Formatted intent name
 */
function formatIntent(val) {
    if (val === 'all_traffic') return 'Group All Traffic';
    if (val === 'mgmt_compute') return 'Management + Compute';
    if (val === 'compute_storage') return 'Compute + Storage';
    return capitalize(val);
}

// ============================================================================
// REGION FORMATTING
// ============================================================================

/**
 * Format an Azure region value for display.
 * @param {string} r - Region value
 * @returns {string} - Formatted region name
 */
function formatRegion(r) {
    if (!r) return '';
    if (r === 'azure_commercial') return 'Azure Commercial';
    if (r === 'azure_government') return 'Azure Government';
    if (r === 'azure_china') return 'Azure China';
    return capitalize(r);
}

/**
 * Format an Azure Local Instance Region value for display.
 * @param {string} r - Local instance region value
 * @returns {string} - Formatted region name
 */
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
