/**
 * Shared navigation bar component for all ODIN pages.
 *
 * Usage:
 *   <nav id="odin-nav" data-active="designer" data-base=""></nav>
 *   <script src="js/nav.js"></script>
 *
 *   data-active : "designer" | "knowledge" | "sizer"  (which tab is highlighted)
 *   data-base   : relative path prefix to repo root, e.g. "" (root), "../" (sizer), "../../" (docs/outbound)
 */
(function() {
    'use strict';

    const nav = document.getElementById('odin-nav');
    if (!nav) return;

    const active = nav.getAttribute('data-active') || 'designer';
    let base = (nav.getAttribute('data-base') || '').replace(/[^a-zA-Z0-9\-._~/:]/g, '');

    // Ensure base ends with '/' if non-empty
    if (base && base.charAt(base.length - 1) !== '/') base += '/';

    const svgDesigner  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';
    const svgKnowledge = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
    const svgSizer     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>';

    const tabs = [
        {
            id: 'designer',
            label: 'Designer',
            svg: svgDesigner,
            href: (base || './') + '?tab=designer',
            badge: null
        },
        {
            id: 'knowledge',
            label: 'Knowledge',
            svg: svgKnowledge,
            href: (base || './') + '?tab=knowledge',
            badge: null
        },
        {
            id: 'sizer',
            label: 'Sizer',
            svg: svgSizer,
            href: base + 'sizer/',
            badge: null
        }
    ];

    // On the Designer page the Designer "tab" is a <button> that calls switchOdinTab,
    // everywhere else it's a plain <a> link.
    let html = '<div class="odin-tab-container">';

    // Logo
    if (active === 'designer') {
        html += '<div class="odin-tab-logo">';
    } else {
        html += '<a href="' + (base || './') + '?tab=designer" class="odin-tab-logo">';
    }
    html += '<img src="' + base + 'images/odin-logo.png" alt="Odin">';
    html += '<span>ODIN</span>';
    html += active === 'designer' ? '</div>' : '</a>';

    // Tab buttons
    for (let i = 0; i < tabs.length; i++) {
        const t = tabs[i];
        const isActive = t.id === active;
        const cls = 'odin-tab-btn' + (isActive ? ' active' : '');

        // On the main (designer) page, both Designer and Knowledge tabs are <button>s
        // that call switchOdinTab to swap content in-page.
        const isMainPage = (active === 'designer');

        if (isMainPage && (t.id === 'designer' || t.id === 'knowledge')) {
            html += '<button type="button" class="' + cls + '" data-tab="' + t.id + '" onclick="switchOdinTab(\'' + t.id + '\')">';
        } else if (isActive) {
            html += '<a href="#" class="' + cls + '" data-tab="' + t.id + '">';
        } else {
            html += '<a href="' + t.href + '" class="' + cls + '" data-tab="' + t.id + '">';
        }

        html += t.svg + ' ' + t.label;
        if (t.badge) {
            html += ' <span class="odin-tab-badge">' + t.badge + '</span>';
        }

        html += (isMainPage && (t.id === 'designer' || t.id === 'knowledge')) ? '</button>' : '</a>';
    }

    // Feedback link — open in a full new browser tab (no features string = tab, not popup)
    html += '<a href="https://github.com/Azure/odinforazurelocal/issues" onclick="event.preventDefault(); window.open(this.href, \'_blank\');" class="nav-theme-toggle" title="Raise feedback or issue" style="text-decoration: none; display: flex; align-items: center; gap: 6px;">\uD83D\uDCA1<span class="nav-feedback-text"> Feedback</span></a>';

    // Help button — re-launch onboarding walkthrough (Designer and Sizer only)
    if (active === 'designer' || active === 'sizer') {
        const helpFn = active === 'sizer' ? 'showSizerOnboarding()' : 'showOnboarding()';
        html += '<button type="button" onclick="' + helpFn + '" class="nav-theme-toggle nav-help-btn" title="Show Getting Started guide">';
        html += '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
        html += '<span class="nav-help-text"> Help</span></button>';
    }

    // Theme toggle
    html += '<button type="button" onclick="toggleTheme()" id="theme-toggle" class="nav-theme-toggle" style="margin-left: 0;" title="Toggle light/dark theme">\uD83C\uDF19</button>';

    html += '</div>';

    nav.innerHTML = html;
})();
