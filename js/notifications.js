// ============================================================================
// ODIN NOTIFICATIONS MODULE
// ============================================================================
// Handles toast notifications and error reporting UI.
// No external dependencies - fully self-contained.
// ============================================================================

let interactionDialogCounter = 0;

function ensureToastRegion() {
    let region = document.getElementById('odin-toast-region');
    if (!region) {
        region = document.createElement('div');
        region.id = 'odin-toast-region';
        region.className = 'odin-toast-region';
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'false');
        document.body.appendChild(region);
    }
    return region;
}

/**
 * Show a shared toast notification.
 * @param {string} message - Message to display
 * @param {string} type - Type: 'info', 'success', 'warning', or 'error'
 * @param {number} duration - Duration in milliseconds (default 3000)
 * @returns {HTMLElement} The toast element
 */
function showToast(message, type = 'info', duration = 3000) {
    const supportedTypes = ['info', 'success', 'warning', 'error'];
    const safeType = supportedTypes.includes(type) ? type : 'info';
    const icons = { info: 'i', success: '\u2713', warning: '!', error: '!' };
    const toast = document.createElement('div');
    toast.className = `toast odin-toast odin-toast--${safeType}`;
    toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'odin-toast__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = icons[safeType];

    const text = document.createElement('span');
    text.className = 'odin-toast__message';
    text.textContent = String(message == null ? '' : message);

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'odin-toast__dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss notification');
    dismiss.textContent = '\u00d7';

    let timer = null;
    const removeToast = () => {
        if (!toast.isConnected || toast.classList.contains('odin-toast--leaving')) return;
        if (timer) clearTimeout(timer);
        toast.classList.add('odin-toast--leaving');
        setTimeout(() => toast.remove(), 180);
    };
    const startTimer = () => {
        if (timer) clearTimeout(timer);
        if (duration > 0) timer = setTimeout(removeToast, duration);
    };

    dismiss.addEventListener('click', removeToast);
    toast.addEventListener('mouseenter', () => timer && clearTimeout(timer));
    toast.addEventListener('mouseleave', startTimer);
    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(dismiss);
    ensureToastRegion().appendChild(toast);
    startTimer();
    return toast;
}

function openInteractionDialog(options) {
    const settings = options || {};
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    const supportsModalDialog = typeof dialog.showModal === 'function';
    const form = document.createElement('form');
    const header = document.createElement('div');
    const title = document.createElement('h2');
    const close = document.createElement('button');
    const body = document.createElement('div');
    const message = document.createElement('p');
    const footer = document.createElement('div');
    const cancel = document.createElement('button');
    const confirm = document.createElement('button');
    const titleId = `odin-dialog-title-${++interactionDialogCounter}`;

    dialog.className = 'odin-dialog';
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.setAttribute('aria-modal', 'true');
    form.className = 'odin-dialog__form';
    form.method = 'dialog';
    header.className = 'odin-dialog__header';
    title.id = titleId;
    title.className = 'odin-dialog__title';
    title.textContent = settings.title || 'Confirm action';
    close.type = 'button';
    close.className = 'odin-dialog__close';
    close.setAttribute('aria-label', 'Close dialog');
    close.textContent = '\u00d7';
    body.className = 'odin-dialog__body';
    message.className = 'odin-dialog__message';
    message.textContent = settings.message || '';
    footer.className = 'odin-dialog__footer';
    cancel.type = 'button';
    cancel.className = 'odin-dialog__button';
    cancel.textContent = settings.cancelLabel || 'Cancel';
    confirm.type = 'submit';
    confirm.className = 'odin-dialog__button odin-dialog__button--primary';
    if (settings.danger) confirm.classList.add('odin-dialog__button--danger');
    confirm.textContent = settings.confirmLabel || 'Confirm';

    header.appendChild(title);
    header.appendChild(close);
    body.appendChild(message);
    footer.appendChild(cancel);
    footer.appendChild(confirm);
    form.appendChild(header);
    form.appendChild(body);
    form.appendChild(footer);
    dialog.appendChild(form);
    document.body.appendChild(dialog);

    return new Promise(resolve => {
        let settled = false;
        let input = null;
        let fallbackBackdrop = null;
        if (settings.input) {
            const field = document.createElement('label');
            const label = document.createElement('span');
            const hint = document.createElement('span');
            field.className = 'odin-dialog__field';
            label.className = 'odin-dialog__label';
            label.textContent = settings.input.label || 'Value';
            input = document.createElement(settings.input.multiline ? 'textarea' : 'input');
            input.className = settings.input.readOnly ? 'odin-dialog__copy-value' : 'odin-dialog__input';
            input.value = settings.input.value == null ? '' : String(settings.input.value);
            input.readOnly = Boolean(settings.input.readOnly);
            if (!settings.input.multiline) input.type = settings.input.type || 'text';
            if (settings.input.placeholder) input.placeholder = settings.input.placeholder;
            if (settings.input.maxLength) input.maxLength = settings.input.maxLength;
            if (settings.input.required) input.required = true;
            field.appendChild(label);
            field.appendChild(input);
            if (settings.input.hint) {
                hint.className = 'odin-dialog__hint';
                hint.textContent = settings.input.hint;
                field.appendChild(hint);
            }
            body.appendChild(field);
        }

        const finish = value => {
            if (settled) return;
            settled = true;
            if (supportsModalDialog) dialog.close();
            if (fallbackBackdrop) fallbackBackdrop.remove();
            dialog.remove();
            if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
            resolve(value);
        };
        close.addEventListener('click', () => finish(settings.input ? null : false));
        cancel.addEventListener('click', () => finish(settings.input ? null : false));
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (input && !input.readOnly && !input.checkValidity()) {
                input.reportValidity();
                return;
            }
            finish(input ? input.value : true);
        });
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            finish(settings.input ? null : false);
        });
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const bounds = dialog.getBoundingClientRect();
            const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
                event.clientY < bounds.top || event.clientY > bounds.bottom;
            if (outside) finish(settings.input ? null : false);
        });
        dialog.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                finish(settings.input ? null : false);
                return;
            }
            if (event.key !== 'Tab' || supportsModalDialog) return;
            const focusable = Array.from(dialog.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])'))
                .filter(element => !element.disabled);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });

        if (supportsModalDialog) {
            dialog.showModal();
        } else {
            fallbackBackdrop = document.createElement('div');
            fallbackBackdrop.className = 'odin-dialog-backdrop';
            fallbackBackdrop.addEventListener('click', () => finish(settings.input ? null : false));
            dialog.classList.add('odin-dialog--fallback');
            dialog.setAttribute('open', '');
            document.body.insertBefore(fallbackBackdrop, dialog);
        }
        if (input) {
            input.focus();
            if (settings.input.select !== false) input.select();
        } else {
            confirm.focus();
        }
    });
}

function showConfirmDialog(options) {
    return openInteractionDialog(options);
}

function showTextInputDialog(options) {
    return openInteractionDialog(Object.assign({}, options, {
        input: Object.assign({ label: 'Value', type: 'text' }, options && options.input)
    }));
}

function showCopyDialog(options) {
    const settings = options || {};
    return openInteractionDialog({
        title: settings.title || 'Copy value',
        message: settings.message || 'Copy the value below.',
        confirmLabel: 'Close',
        cancelLabel: 'Cancel',
        input: {
            label: settings.label || 'Value',
            value: settings.value || '',
            multiline: true,
            readOnly: true,
            select: true,
            hint: settings.hint || 'Press Ctrl+C to copy the selected value.'
        }
    });
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
    return showToast(message, type, 3000);
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
        }).catch(() => {
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
