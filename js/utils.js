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
        .replace(/\"/g, '&quot;')
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
            return str.replace(/[^a-z0-9_\-\.]/gi, '_');
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

/**
 * Increment the 3rd octet of a CIDR and return the new CIDR
 * @param {string} cidr - Original CIDR
 * @param {number} increment - Amount to increment
 * @returns {string|null} New CIDR or null if would exceed valid range
 */
function incrementCidrThirdOctet(cidr, increment) {
    if (!isValidCidrFormat(cidr)) return null;
    
    const trimmed = cidr.trim();
    const parts = trimmed.split('/');
    const ip = parts[0];
    const prefix = parts[1];
    const octets = ip.split('.');
    
    const thirdOctet = parseInt(octets[2], 10);
    const newThirdOctet = thirdOctet + increment;
    
    // Check if new octet would exceed valid range
    if (newThirdOctet > 255 || newThirdOctet < 0) return null;
    
    return `${octets[0]}.${octets[1]}.${newThirdOctet}.${octets[3]}/${prefix}`;
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

// ============================================================================
// END UTILITIES MODULE
// ============================================================================
