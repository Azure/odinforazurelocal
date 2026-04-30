/**
 * Shared page-statistics bar component for all ODIN pages.
 *
 * Usage:
 *   <div id="page-statistics" data-stats-bar></div>
 *   <script src="js/stats-bar.js"></script>
 *
 * Renders a six-tile counter strip (Visitors / Designs Generated / Sizes Calculated /
 * ARM Deployments / ToR Switch Configs / ToR Switch QoS Audits). The counters are
 * populated by analytics.js -> fetchAndDisplayStats() reading from Firebase Realtime
 * Database. Layout / responsive behaviour comes from .stats-container in css/style.css
 * (and the duplicate copy in sizer/sizer.css for the Sizer page).
 *
 * Single source of truth — change tile labels, icons, or order here only.
 */
(function() {
    'use strict';

    const host = document.querySelector('#page-statistics[data-stats-bar]');
    if (!host) return;

    const tiles = [
        {
            id: 'stat-page-views',
            label: 'Visitors:',
            svg: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
        },
        {
            id: 'stat-design-docs',
            label: 'Designs Generated:',
            svg: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
        },
        {
            id: 'stat-sizer-calcs',
            label: 'Sizes Calculated:',
            svg: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
        },
        {
            id: 'stat-arm-deployments',
            label: 'ARM Deployments:',
            svg: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>'
        },
        {
            id: 'stat-switch-configs',
            label: 'ToR Switch Configs:',
            svg: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>'
        },
        {
            id: 'stat-qos-audits',
            label: 'ToR Switch QoS Audits:',
            svg: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>'
        }
    ];

    let html = '<div class="stats-container">';
    for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        html += '<div class="stat-item">'
            + t.svg
            + '<span class="stat-label">' + t.label + '</span>'
            + '<span id="' + t.id + '" class="stat-value">\u2014</span>'
            + '</div>';
    }
    html += '</div>';

    host.innerHTML = html;
})();
