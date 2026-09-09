// ============================================================================
// ODIN UTILITIES MODULE
// ============================================================================
// Pure utility functions with no side effects or external dependencies.
// These functions can be safely used throughout the application.
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} s - Input string
 * @returns {string} Escaped string
 */
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Enhanced sanitization for various contexts
 * @param {string} input - Input string to sanitize
 * @param {string} type - Context type: 'text', 'html', 'json', 'url', 'filename'
 * @returns {string} Sanitized string
 */
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
            return str.replace(/[^a-z0-9_.-]/gi, '_');
        default:
            return escapeHtml(str);
    }
}

/**
 * Format number with commas for display
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Capitalize first letter of a string
 * @param {string} s - Input string
 * @returns {string} Capitalized string
 */
function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================================
// IP ADDRESS UTILITIES
// ============================================================================

/**
 * Validate NetBIOS computer name
 * NetBIOS: max 15 chars, A-Z, 0-9, hyphen; start/end alphanumeric
 * @param {string} name - Name to validate
 * @returns {boolean} True if valid
 */
function isValidNetbiosName(name) {
    if (!name) return false;
    const trimmed = String(name).trim();
    if (trimmed.length < 1 || trimmed.length > 15) return false;
    if (trimmed.length === 1) return /^[A-Za-z0-9]$/.test(trimmed);
    return /^[A-Za-z0-9][A-Za-z0-9-]{0,13}[A-Za-z0-9]$/.test(trimmed);
}

/**
 * Validate IPv4 CIDR notation
 * @param {string} value - CIDR value (e.g., "192.168.1.0/24")
 * @returns {boolean} True if valid
 */
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

/**
 * Validate CIDR format (e.g., 10.0.1.0/24)
 * @param {string} cidr - CIDR value to validate
 * @returns {boolean} True if valid format
 */
function isValidCidrFormat(cidr) {
    if (!cidr || typeof cidr !== 'string') return false;
    const trimmed = cidr.trim();
    const parts = trimmed.split('/');
    if (parts.length !== 2) return false;

    const ip = parts[0];
    const prefixStr = parts[1];
    const prefix = parseInt(prefixStr, 10);

    // Validate prefix is a number between 0 and 32
    if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;

    // Validate IP has 4 octets, each 0-255
    const octets = ip.split('.');
    if (octets.length !== 4) return false;

    for (const octet of octets) {
        if (octet === '' || Number.isNaN(Number(octet))) return false;
        const num = parseInt(octet, 10);
        if (num < 0 || num > 255) return false;
    }

    return true;
}

/**
 * Extract IP address from CIDR notation
 * @param {string} value - CIDR value
 * @returns {string} IP address portion
 */
function extractIpFromCidr(value) {
    if (!value) return '';
    const trimmed = String(value).trim();
    const parts = trimmed.split('/');
    return parts[0] ? parts[0].trim() : '';
}

/**
 * Extract prefix length from CIDR notation
 * @param {string} value - CIDR value
 * @returns {number|null} Prefix length or null if invalid
 */
function extractPrefixFromCidr(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    const parts = trimmed.split('/');
    if (parts.length !== 2) return null;
    const prefix = parseInt(parts[1], 10);
    return Number.isFinite(prefix) ? prefix : null;
}

/**
 * Convert IPv4 address to 32-bit integer
 * @param {string} ip - IPv4 address
 * @returns {number|null} Integer representation or null if invalid
 */
function ipv4ToInt(ip) {
    if (!ip) return null;
    const parts = String(ip).trim().split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4) return null;
    if (parts.some(n => !Number.isFinite(n) || n < 0 || n > 255)) return null;
    // Use unsigned shifts to keep within 32-bit.
    return (((parts[0] << 24) >>> 0) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Convert 32-bit integer to IPv4 address
 * @param {number} n - Integer value
 * @returns {string} IPv4 address
 */
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

/**
 * Convert prefix length to subnet mask as integer
 * @param {number} prefix - Prefix length (0-32)
 * @returns {number|null} Subnet mask as integer or null if invalid
 */
function prefixToMask(prefix) {
    const p = parseInt(prefix, 10);
    if (!Number.isFinite(p) || p < 0 || p > 32) return null;
    return p === 0 ? 0 : ((0xFFFFFFFF << (32 - p)) >>> 0);
}

/**
 * Convert IP address to long (for CIDR calculator)
 * @param {string} ip - IPv4 address
 * @returns {number} Long representation
 */
function ipToLong(ip) {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Convert long to IP address (for CIDR calculator)
 * @param {number} long - Long value
 * @returns {string} IPv4 address
 */
function longToIp(long) {
    return [
        (long >>> 24) & 0xFF,
        (long >>> 16) & 0xFF,
        (long >>> 8) & 0xFF,
        long & 0xFF
    ].join('.');
}

function getIpv4SubnetInfo(cidr) {
    if (typeof cidr !== 'string') return null;
    const match = cidr.trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
    if (!match) return null;
    const address = ipv4ToInt(match[1]);
    const prefix = Number(match[2]);
    if (address === null || prefix > 32) return null;
    const mask = prefixToMask(prefix);
    const network = (address & mask) >>> 0;
    const size = Math.pow(2, 32 - prefix);
    return {
        address,
        network,
        broadcast: network + size - 1,
        size,
        prefix,
        subnetMask: intToIpv4(mask),
        cidr: intToIpv4(network) + '/' + prefix
    };
}

function getStorageSubnetAddress(cidr, hostIndex, hostCount) {
    const subnet = getIpv4SubnetInfo(cidr);
    if (!subnet || subnet.address !== subnet.network ||
        !Number.isInteger(hostIndex) || !Number.isInteger(hostCount) ||
        hostIndex < 0 || hostCount < 1 || hostIndex >= hostCount ||
        hostCount > subnet.size - 2) return null;
    const firstOffset = hostCount + 1 <= subnet.size - 2 ? 2 : 1;
    return intToIpv4(subnet.network + firstOffset + hostIndex);
}

function getStorageSubnetErrors(cidrs, hostCount) {
    const subnets = cidrs.map(getIpv4SubnetInfo);
    const errors = subnets.map((subnet, index) => {
        if (!cidrs[index] || !String(cidrs[index]).trim()) return 'Enter a storage subnet';
        if (!subnet) return 'Invalid IPv4 CIDR format';
        if (subnet.address !== subnet.network) return 'Use the network address: ' + subnet.cidr;
        if (!Number.isInteger(hostCount) || hostCount < 1 || subnet.size - 2 < hostCount) {
            return 'Subnet needs at least ' + hostCount + ' usable host addresses';
        }
        return '';
    });
    for (let current = 0; current < subnets.length; current++) {
        if (!subnets[current]) continue;
        for (let previous = 0; previous < current; previous++) {
            if (!subnets[previous]) continue;
            if (subnets[current].network <= subnets[previous].broadcast &&
                subnets[previous].network <= subnets[current].broadcast) {
                if (!errors[current]) errors[current] = 'Overlaps Storage Subnet ' + (previous + 1);
                if (!errors[previous]) errors[previous] = 'Overlaps Storage Subnet ' + (current + 1);
            }
        }
    }
    return errors;
}

function getSwitchlessStorageTopology(config) {
    const nodeCount = parseInt(config && config.nodes, 10);
    if (!config || config.storage !== 'switchless' || !Number.isInteger(nodeCount) ||
        nodeCount < 2 || nodeCount > 4) return null;
    const portCount = parseInt(config.ports, 10) || 0;
    const managementPorts = [];
    const storagePorts = [];
    const hasMapping = config.adapterMappingConfirmed && config.adapterMapping &&
        Object.keys(config.adapterMapping).length > 0;
    for (let port = 1; port <= portCount; port++) {
        const assignment = hasMapping ? config.adapterMapping[port] : (port <= 2 ? 'mgmt_compute' : 'storage');
        if (assignment === 'storage') storagePorts.push(port);
        else if (assignment === 'mgmt_compute' || assignment === 'mgmt') managementPorts.push(port);
    }
    const linksPerPair = nodeCount === 3 && config.switchlessLinkMode === 'single_link' ? 1 : 2;
    const portCounters = Array(nodeCount).fill(0);
    const links = [];
    for (let firstNode = 0; firstNode < nodeCount; firstNode++) {
        for (let secondNode = firstNode + 1; secondNode < nodeCount; secondNode++) {
            for (let link = 0; link < linksPerPair; link++) {
                links.push({
                    subnet: links.length + 1,
                    a: { n: firstNode, p: portCounters[firstNode]++ },
                    b: { n: secondNode, p: portCounters[secondNode]++ }
                });
            }
        }
    }
    return { managementPorts, storagePorts, links };
}

/**
 * Advance a CIDR by subnet-sized blocks (retains the legacy helper name)
 * @param {string} cidr - Original CIDR
 * @param {number} increment - Number of subnets to advance
 * @returns {string|null} New CIDR or null if would exceed valid range
 */
function incrementCidrThirdOctet(cidr, increment) {
    const subnet = getIpv4SubnetInfo(cidr);
    if (!subnet || subnet.address !== subnet.network || !Number.isInteger(increment)) return null;
    const network = subnet.network + increment * subnet.size;
    if (network < 0 || network + subnet.size - 1 > 0xFFFFFFFF) return null;
    return intToIpv4(network) + '/' + subnet.prefix;
}

/**
 * Check if an IP address is RFC 1918 private address
 * RFC 1918 ranges:
 * - 10.0.0.0/8     (10.0.0.0 - 10.255.255.255)
 * - 172.16.0.0/12  (172.16.0.0 - 172.31.255.255)
 * - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
 * @param {string} ip - IPv4 address to check
 * @returns {boolean} True if the IP is a private RFC 1918 address
 */
function isRfc1918Ip(ip) {
    if (!ip) return false;
    const trimmed = String(ip).trim();
    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipv4Regex.test(trimmed)) return false;

    const octets = trimmed.split('.').map(Number);
    const first = octets[0];
    const second = octets[1];

    // 10.0.0.0/8 - Class A private
    if (first === 10) return true;

    // 172.16.0.0/12 - Class B private (172.16.x.x - 172.31.x.x)
    if (first === 172 && second >= 16 && second <= 31) return true;

    // 192.168.0.0/16 - Class C private
    if (first === 192 && second === 168) return true;

    return false;
}

/**
 * Check if an IPv4 address is a network address or broadcast address within its subnet.
 * Network address: host portion is all zeros (e.g., 192.168.1.0/24)
 * Broadcast address: host portion is all ones (e.g., 192.168.1.255/24)
 * These addresses cannot be assigned to hosts.
 * @param {string} ip - IPv4 address (without CIDR prefix)
 * @param {number} prefix - Subnet prefix length (0-32)
 * @returns {string|null} 'network' if network address, 'broadcast' if broadcast address, null if usable host address
 */
function isNetworkOrBroadcastAddress(ip, prefix) {
    if (!ip || prefix === null || prefix === undefined) return null;
    const p = parseInt(prefix, 10);
    if (!Number.isFinite(p) || p < 0 || p > 32) return null;
    // /32 is a host route — always valid. /31 is a point-to-point link — both addresses usable.
    if (p >= 31) return null;
    const ipInt = ipv4ToInt(ip);
    if (ipInt === null) return null;
    const mask = prefixToMask(p);
    if (mask === null) return null;
    const networkAddr = (ipInt & mask) >>> 0;
    const hostBits = 32 - p;
    const broadcastAddr = (networkAddr | ((1 << hostBits) - 1)) >>> 0;
    if (ipInt === networkAddr) return 'network';
    if (ipInt === broadcastAddr) return 'broadcast';
    return null;
}

/**
 * Check if a bare IPv4 address has a last octet of 0 or 255.
 * This is a simplified check for addresses without a known subnet prefix —
 * assumes standard /24-or-smaller subnets where .0 and .255 are typically
 * the network and broadcast addresses.
 * @param {string} ip - IPv4 address
 * @returns {string|null} 'network' if last octet is 0, 'broadcast' if 255, null otherwise
 */
function isLastOctetNetworkOrBroadcast(ip) {
    if (!ip) return null;
    const parts = String(ip).trim().split('.');
    if (parts.length !== 4) return null;
    const lastOctet = parseInt(parts[3], 10);
    if (lastOctet === 0) return 'network';
    if (lastOctet === 255) return 'broadcast';
    return null;
}

// ============================================================================
// END UTILITIES MODULE
// ============================================================================
