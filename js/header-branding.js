/**
 * Shared logo, release version, and What's New control for interactive pages.
 *
 * Usage:
 *   <div class="header-logo-wrapper" data-odin-branding data-base="../"></div>
 *   <script src="../js/version.js"></script>
 *   <script src="../js/header-branding.js"></script>
 */
(function() {
    'use strict';

    function renderOdinBranding(root) {
        const scope = root || document;
        const hosts = scope.querySelectorAll('[data-odin-branding]');
        const existingLogo = document.getElementById('odin-logo');
        let assignPrimaryLogo = !existingLogo || Array.from(hosts).some(host => host.contains(existingLogo));
        hosts.forEach(host => {
            let base = host.getAttribute('data-base') || '';
            if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(base) || base.startsWith('//')) base = '';
            base = base.replace(/[^a-zA-Z0-9\-._~/]/g, '');
            if (base && base.charAt(base.length - 1) !== '/') base += '/';

            const logo = document.createElement('img');
            if (assignPrimaryLogo) {
                logo.id = 'odin-logo';
                assignPrimaryLogo = false;
            }
            logo.src = base + 'images/odin-logo.png';
            logo.alt = 'ODIN for Azure Local logo';

            const version = document.createElement('div');
            version.className = 'header-version';
            version.appendChild(document.createTextNode('Version ' + globalThis.ODIN_VERSION + ' | '));

            const changelogButton = document.createElement('button');
            changelogButton.type = 'button';
            changelogButton.className = 'whats-new-link';
            changelogButton.textContent = "What's New";
            changelogButton.addEventListener('click', () => {
                if (typeof globalThis.showChangelog === 'function') globalThis.showChangelog();
            });

            version.appendChild(changelogButton);
            host.replaceChildren(logo, version);
        });
    }

    globalThis.renderOdinBranding = renderOdinBranding;
    renderOdinBranding(document);
})();