/**
 * Shared ODIN privacy footer.
 *
 * Usage:
 *   <footer data-odin-footer></footer>
 *   <script src="js/footer.js"></script>
 */
(function() {
    'use strict';

    const hosts = document.querySelectorAll('footer[data-odin-footer]');
    if (hosts.length === 0) return;

    const footerHtml = '🔒 Privacy: Your inputs, configurations and template data stay in your browser &mdash; nothing you type or import is transmitted externally.<br>'
        + 'Anonymous usage counters (page views and feature use, integer-only, no IP or identifier) are incremented to display the aggregate stats in the header.<br>'
        + 'You can opt out via the toggle in the navigation bar (or by enabling browser Do Not Track / Global Privacy Control). '
        + '<a href="https://github.com/Azure/odinforazurelocal/blob/main/js/analytics.js" target="_blank" rel="noopener noreferrer" style="color:#88c0ff;">See analytics source</a>.';

    hosts.forEach(host => {
        host.innerHTML = footerHtml;
    });
})();