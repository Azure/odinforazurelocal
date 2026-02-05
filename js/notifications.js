// ============================================================================
// ODIN NOTIFICATIONS MODULE
// ============================================================================
// Handles toast notifications and error reporting UI.
// No external dependencies - fully self-contained.
// ============================================================================

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: 'info', 'success', or 'error'
 * @param {number} duration - Duration in milliseconds (default 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Report a UI error with a dismissible banner
 * Used for catching and displaying JavaScript runtime errors
 * @param {Error|string} err - Error object or message
 * @param {string} context - Context description for the error
 */
function reportUiError(err, context) {
    try {
        const message = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
        const text = `UI error${context ? ` (${context})` : ''}: ${message}`;
        // eslint-disable-next-line no-console
        console.error(text);

        let banner = document.getElementById('__ui-error-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = '__ui-error-banner';
            banner.style.position = 'fixed';
            banner.style.left = '16px';
            banner.style.right = '16px';
            banner.style.bottom = '16px';
            banner.style.zIndex = '9999';
            banner.style.padding = '12px 14px';
            banner.style.borderRadius = '10px';
            banner.style.background = 'var(--card-bg)';
            banner.style.border = '1px solid var(--accent-purple)';
            banner.style.color = 'var(--text-primary)';
            banner.style.fontSize = '12px';
            banner.style.whiteSpace = 'pre-wrap';
            banner.style.maxHeight = '35vh';
            banner.style.overflow = 'auto';

            const close = document.createElement('button');
            close.type = 'button';
            close.textContent = 'Dismiss';
            close.style.marginLeft = '12px';
            close.style.background = 'transparent';
            close.style.border = '1px solid var(--glass-border)';
            close.style.color = 'var(--text-primary)';
            close.style.borderRadius = '8px';
            close.style.padding = '4px 8px';
            close.style.cursor = 'pointer';
            close.addEventListener('click', () => banner.remove());

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.justifyContent = 'space-between';
            header.style.gap = '12px';

            const title = document.createElement('div');
            title.textContent = 'JavaScript runtime error (wizard UI)';
            title.style.fontWeight = '700';
            title.style.color = 'var(--accent-purple)';

            header.appendChild(title);
            header.appendChild(close);

            const body = document.createElement('div');
            body.id = '__ui-error-banner-body';
            body.style.marginTop = '8px';

            banner.appendChild(header);
            banner.appendChild(body);
            document.body.appendChild(banner);
        }

        const body = document.getElementById('__ui-error-banner-body');
        if (body) body.textContent = text;
    } catch (e) {
        // Last resort: swallow to avoid cascading failures.
    }
}

/**
 * Show a notification (styled for top-right, similar to success messages)
 * @param {string} message - Message to display
 * @param {string} type - Type: 'info', 'success', or 'error'
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? 'rgba(16, 185, 129, 0.9)' : type === 'error' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(59, 130, 246, 0.9)'};
        color: white;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10001;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Copy text to clipboard with success notification
 * @param {string} text - Text to copy
 * @param {string} successMessage - Message to show on success
 */
function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMessage, 'success');
        }).catch(err => {
            fallbackCopyToClipboard(text, successMessage);
        });
    } else {
        fallbackCopyToClipboard(text, successMessage);
    }
}

/**
 * Fallback copy to clipboard using textarea
 * @param {string} text - Text to copy
 * @param {string} successMessage - Message to show on success
 */
function fallbackCopyToClipboard(text, successMessage) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast(successMessage, 'success');
    } catch (err) {
        showToast('Failed to copy to clipboard', 'error');
    }
    document.body.removeChild(textArea);
}

// ============================================================================
// END NOTIFICATIONS MODULE
// ============================================================================
