/**
 * Odin for Azure Local - Validation Module
 *
 * Real-time input validation functions for the wizard.
 * These functions validate user input and provide visual feedback.
 *
 * Dependencies: js/utils.js (for isValidNetbiosName, isValidIpv4Cidr)
 */

// ============================================================================
// REAL-TIME FIELD VALIDATION
// ============================================================================

/**
 * Validate a field value in real-time and show inline feedback.
 * @param {HTMLInputElement} field - The input field element
 * @param {string} value - The value to validate
 * @param {string} type - The validation type ('netbios', 'ipv4cidr', 'ipv4', 'domain', 'vlan')
 * @returns {boolean} - True if valid, false otherwise
 */
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

// ============================================================================
// VALIDATION FEEDBACK ELEMENTS
// ============================================================================

/**
 * Add inline validation feedback element to an input and attach event listeners.
 * @param {HTMLInputElement} inputElement - The input element to add feedback to
 * @param {string} type - The validation type ('netbios', 'ipv4cidr', 'ipv4', 'domain', 'vlan')
 */
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
