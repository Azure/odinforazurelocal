// ============================================================================
// ODIN THEME MODULE
// ============================================================================
// Handles theme switching (light/dark) and font size adjustments.
// Depends on: state object (from script.js), saveStateToLocalStorage function
// ============================================================================

/**
 * Increase font size by one step
 * Available sizes: small, medium, large, x-large
 */
function increaseFontSize() {
    const sizes = ['small', 'medium', 'large', 'x-large'];
    const currentIndex = sizes.indexOf(state.fontSize || 'medium');
    if (currentIndex < sizes.length - 1) {
        state.fontSize = sizes[currentIndex + 1];
        applyFontSize();
        saveStateToLocalStorage();
    }
}

/**
 * Decrease font size by one step
 * Available sizes: small, medium, large, x-large
 */
function decreaseFontSize() {
    const sizes = ['small', 'medium', 'large', 'x-large'];
    const currentIndex = sizes.indexOf(state.fontSize || 'medium');
    if (currentIndex > 0) {
        state.fontSize = sizes[currentIndex - 1];
        applyFontSize();
        saveStateToLocalStorage();
    }
}

/**
 * Apply the current font size from state to the document
 */
function applyFontSize() {
    const sizes = {
        'small': '14px',
        'medium': '16px',
        'large': '18px',
        'x-large': '20px'
    };
    document.documentElement.style.fontSize = sizes[state.fontSize || 'medium'];
}

/**
 * Toggle between light and dark theme
 */
function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveStateToLocalStorage();
    // Also save to shared theme key for cross-page consistency
    localStorage.setItem('odin-theme', state.theme);
}

/**
 * Apply the current theme from state to the document
 * Sets CSS variables for colors and updates UI elements
 */
function applyTheme() {
    const root = document.documentElement;
    const themeButton = document.getElementById('theme-toggle');
    const logo = document.getElementById('odin-logo');
    
    if (state.theme === 'light') {
        root.style.setProperty('--bg-dark', '#f5f5f5');
        root.style.setProperty('--card-bg', '#ffffff');
        root.style.setProperty('--card-bg-transparent', 'rgba(255, 255, 255, 0.95)');
        root.style.setProperty('--text-primary', '#000000');
        root.style.setProperty('--text-secondary', '#6b7280');
        root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.1)');
        root.style.setProperty('--subtle-bg', 'rgba(0, 0, 0, 0.03)');
        root.style.setProperty('--subtle-bg-hover', 'rgba(0, 0, 0, 0.06)');
        // Navigation bar theme variables for light mode
        root.style.setProperty('--nav-bg', 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 245, 245, 0.95) 100%)');
        root.style.setProperty('--nav-hover-bg', 'rgba(0, 0, 0, 0.05)');
        root.style.setProperty('--nav-active-bg', 'rgba(0, 120, 212, 0.12)');
        // Banner theme variables for light mode
        root.style.setProperty('--banner-bg', 'linear-gradient(90deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)');
        root.style.setProperty('--banner-border', 'rgba(139, 92, 246, 0.4)');
        // Disclaimer banner for light mode
        root.style.setProperty('--disclaimer-bg', 'rgba(255, 193, 7, 0.25)');
        root.style.setProperty('--disclaimer-border', 'rgba(255, 193, 7, 0.5)');
        if (themeButton) themeButton.textContent = '☀️';
        if (logo) logo.src = 'images/odin-logo-white-background.png';
        document.body.style.background = '#f5f5f5';
    } else {
        root.style.setProperty('--bg-dark', '#000000');
        root.style.setProperty('--card-bg', '#111111');
        root.style.setProperty('--card-bg-transparent', 'rgba(17, 17, 17, 0.95)');
        root.style.setProperty('--text-primary', '#ffffff');
        root.style.setProperty('--text-secondary', '#a1a1aa');
        root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
        root.style.setProperty('--subtle-bg', 'rgba(255, 255, 255, 0.03)');
        root.style.setProperty('--subtle-bg-hover', 'rgba(255, 255, 255, 0.06)');
        // Navigation bar theme variables for dark mode
        root.style.setProperty('--nav-bg', 'linear-gradient(180deg, rgba(17, 17, 17, 0.98) 0%, rgba(17, 17, 17, 0.95) 100%)');
        root.style.setProperty('--nav-hover-bg', 'rgba(255, 255, 255, 0.05)');
        root.style.setProperty('--nav-active-bg', 'rgba(0, 120, 212, 0.15)');
        // Banner theme variables for dark mode
        root.style.setProperty('--banner-bg', 'linear-gradient(90deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)');
        root.style.setProperty('--banner-border', 'rgba(139, 92, 246, 0.3)');
        // Disclaimer banner for dark mode
        root.style.setProperty('--disclaimer-bg', 'rgba(255, 193, 7, 0.15)');
        root.style.setProperty('--disclaimer-border', 'rgba(255, 193, 7, 0.4)');
        if (themeButton) themeButton.textContent = '🌙';
        if (logo) logo.src = 'images/odin-logo.png';
        document.body.style.background = '#000000';
    }
}

// ============================================================================
// END THEME MODULE
// ============================================================================
