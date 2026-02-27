// Smooth scroll and active navigation highlighting
const LOGO_LIGHT_PATH = 'images/odin-logo-white-background.png';
const LOGO_DARK_PATH = 'images/odin-logo.png';

document.addEventListener('DOMContentLoaded', function() {
    // Initialize and track page view for analytics
    if (typeof initializeAnalytics === 'function') {
        initializeAnalytics();
    }
    if (typeof trackPageView === 'function') {
        trackPageView();
    }

    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.section');

    // Update active nav link on scroll
    function updateActiveNav() {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            
            if (window.scrollY >= sectionTop - 100) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    }

    // Smooth scroll for nav links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
            
            // Update active class
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Listen for scroll events
    window.addEventListener('scroll', updateActiveNav);
    
    // Initial call
    updateActiveNav();

    // Image error handling - show fallback message
    document.querySelectorAll('.diagram').forEach(img => {
        img.addEventListener('error', function() {
            this.style.display = 'none';
            const fallback = this.nextElementSibling;
            if (fallback && fallback.classList.contains('diagram-fallback')) {
                fallback.style.display = 'block';
            }
        });
    });

    // Add copy functionality to code blocks
    document.querySelectorAll('.code-block').forEach(block => {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '📋 Copy';
        copyBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #3a3a3a;
            color: #fff;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        
        block.style.position = 'relative';
        block.appendChild(copyBtn);
        
        block.addEventListener('mouseenter', () => {
            copyBtn.style.opacity = '1';
        });
        
        block.addEventListener('mouseleave', () => {
            copyBtn.style.opacity = '0';
        });
        
        copyBtn.addEventListener('click', async () => {
            const code = block.querySelector('code');
            if (code) {
                try {
                    await navigator.clipboard.writeText(code.textContent);
                    copyBtn.innerHTML = '✓ Copied!';
                    setTimeout(() => {
                        copyBtn.innerHTML = '📋 Copy';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                }
            }
        });
    });

    // Add table of contents highlight animation
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1
    });

    sections.forEach(section => {
        observer.observe(section);
    });

    // Mobile menu toggle
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.innerHTML = '☰';
    menuToggle.style.cssText = `
        display: none;
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 200;
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1.2rem;
    `;
    document.body.appendChild(menuToggle);

    // Show/hide mobile menu toggle based on screen size
    function handleResize() {
        if (window.innerWidth <= 768) {
            menuToggle.style.display = 'block';
            sidebar.style.display = 'none';
        } else {
            menuToggle.style.display = 'none';
            sidebar.style.display = 'block';
        }
    }

    menuToggle.addEventListener('click', () => {
        if (sidebar.style.display === 'none') {
            sidebar.style.display = 'block';
            menuToggle.innerHTML = '✕';
        } else {
            sidebar.style.display = 'none';
            menuToggle.innerHTML = '☰';
        }
    });

    // Close mobile menu when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.style.display = 'none';
                menuToggle.innerHTML = '☰';
            }
        });
    });

    window.addEventListener('resize', handleResize);
    handleResize();

    console.log('Azure Local Connectivity Guide loaded successfully');

    // ============================================
    // Image Modal/Lightbox functionality
    // ============================================
    
    // Create the modal element
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.id = 'imageModal';
    modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 9999; justify-content: center; align-items: center; padding: 40px;';
    modal.innerHTML = `
        <div class="modal-content" style="position: relative; width: 90vw; height: 90vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <button class="modal-close" title="Close" style="position: absolute; top: 10px; right: 10px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; cursor: pointer; font-size: 1.5rem; z-index: 10;">&times;</button>
            <div class="modal-image-wrapper" style="width: 85vw; height: 70vh; display: flex; align-items: center; justify-content: center; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); background: #1a1a2e; overflow: hidden;"></div>
            <p class="modal-title" style="color: #a1a1aa; font-size: 0.9rem; margin-top: 12px;"></p>
            <div class="modal-actions" style="display: flex; gap: 16px; margin-top: 20px;">
                <button class="modal-btn download" style="padding: 12px 24px; border-radius: 10px; border: none; background: linear-gradient(135deg, #10b981, #059669); color: white; cursor: pointer; font-size: 0.95rem; font-weight: 500;">
                    ⬇ Download SVG
                </button>
                <button class="modal-btn close-btn" style="padding: 12px 24px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; cursor: pointer; font-size: 0.95rem; font-weight: 500;">
                    ✕ Close
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const modalImageWrapper = modal.querySelector('.modal-image-wrapper');
    const modalTitle = modal.querySelector('.modal-title');
    const modalClose = modal.querySelector('.modal-close');
    const modalCloseBtn = modal.querySelector('.close-btn');
    const modalDownload = modal.querySelector('.modal-btn.download');

    let currentImageSrc = '';

    // Simple URL validation to prevent loading unsafe protocols
    function isSafeImageSrc(src) {
        if (!src || typeof src !== 'string') return false;
        var trimmed = src.trim();
        // Explicitly block data: URIs to avoid SVG/XSS vectors
        if (/^data:/i.test(trimmed)) {
            return false;
        }
        // Allow common relative URL patterns
        if (
            trimmed.startsWith('/') ||
            trimmed.startsWith('./') ||
            trimmed.startsWith('../') ||
            !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
        ) {
            return true;
        }
        // For absolute URLs, only allow http and https
        try {
            var url = new URL(trimmed, window.location.origin);
            var protocol = url.protocol.toLowerCase();
            return protocol === 'http:' || protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    // Close modal function
    function closeModal() {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = '';
        modalImageWrapper.innerHTML = '';
    }

    // Open modal function
    function openModal(imgSrc, imgAlt) {
        if (!isSafeImageSrc(imgSrc)) {
            console.error('Blocked unsafe image source for modal:', imgSrc);
            return;
        }
        currentImageSrc = imgSrc;
        modalTitle.textContent = imgAlt || 'Diagram';
        
        // Clear previous content
        modalImageWrapper.innerHTML = '';
        
        // Use DOM APIs instead of innerHTML to prevent XSS from DOM-sourced values
        if (imgSrc.toLowerCase().endsWith('.svg') || imgSrc.toLowerCase().includes('.svg?')) {
            var obj = document.createElement('object');
            obj.type = 'image/svg+xml';
            obj.data = imgSrc;
            obj.style.cssText = 'width: 100%; height: 100%;';
            var fallbackImg = document.createElement('img');
            fallbackImg.src = imgSrc;
            fallbackImg.alt = imgAlt || 'Diagram';
            fallbackImg.style.cssText = 'max-width: 100%; max-height: 100%;';
            obj.appendChild(fallbackImg);
            modalImageWrapper.appendChild(obj);
        } else {
            var img = document.createElement('img');
            img.src = imgSrc;
            img.alt = imgAlt || 'Diagram';
            img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
            modalImageWrapper.appendChild(img);
        }
        
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        console.log('Modal opened for:', imgSrc);
    }

    // Download SVG function
    function downloadSVG(src, name) {
        fetch(src)
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.svg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            })
            .catch(err => {
                console.error('Failed to download diagram "' + name + '" from ' + src + ':', err);
                // Fallback: open in new tab
                window.open(src, '_blank');
            });
    }

    // Add action buttons to all diagram containers
    document.querySelectorAll('.diagram-container').forEach(container => {
        const img = container.querySelector('.diagram');
        if (!img) return;

        // Create action buttons container
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'image-actions';
        
        // Expand button
        const expandBtn = document.createElement('button');
        expandBtn.className = 'image-action-btn expand-btn';
        expandBtn.innerHTML = '+';
        expandBtn.title = 'View larger';
        
        // Download button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'image-action-btn download-btn';
        downloadBtn.innerHTML = '⬇';
        downloadBtn.title = 'Download SVG';
        
        actionsDiv.appendChild(expandBtn);
        actionsDiv.appendChild(downloadBtn);
        container.insertBefore(actionsDiv, container.firstChild);

        // Expand button click handler
        expandBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openModal(img.src, img.alt);
        });

        // Download button click handler
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            downloadSVG(img.src, img.alt || 'diagram');
        });

        // Also allow clicking the image to expand
        img.style.cursor = 'pointer';
        img.addEventListener('click', function(e) {
            e.preventDefault();
            openModal(img.src, img.alt);
        });
    });

    // Close modal handlers
    modalClose.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // ESC key to close
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });

    // Download from modal
    modalDownload.addEventListener('click', function() {
        const imageName = modalTitle.textContent || 'diagram';
        downloadSVG(currentImageSrc, imageName);
    });

    console.log('Image modal functionality initialized');
});

// Print styles enhancement
window.addEventListener('beforeprint', () => {
    document.querySelectorAll('.diagram-container').forEach(container => {
        container.style.background = '#ffffff';
        container.style.border = '1px solid #ccc';
    });
});

window.addEventListener('afterprint', () => {
    document.querySelectorAll('.diagram-container').forEach(container => {
        container.style.background = '#1b1b1f';
        container.style.border = 'none';
    });
});

// Theme toggle functionality
let currentTheme = localStorage.getItem('odin-theme') || 'dark';

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme();
    localStorage.setItem('odin-theme', currentTheme);
}

function applyTheme() {
    const root = document.documentElement;
    const themeButton = document.getElementById('theme-toggle');
    const logo = document.querySelector('.odin-tab-logo img');
    
    if (currentTheme === 'light') {
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
        root.style.setProperty('--banner-bg', 'linear-gradient(90deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)');
        root.style.setProperty('--banner-border', 'rgba(139, 92, 246, 0.4)');
        if (themeButton) themeButton.textContent = '☀️';
        if (logo) logo.src = LOGO_LIGHT_PATH;
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
        root.style.setProperty('--banner-bg', 'linear-gradient(90deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)');
        root.style.setProperty('--banner-border', 'rgba(139, 92, 246, 0.3)');
        if (themeButton) themeButton.textContent = '🌙';
        if (logo) logo.src = LOGO_DARK_PATH;
        document.body.style.background = '#000000';
    }
}

// Apply saved theme on page load
document.addEventListener('DOMContentLoaded', function() {
    applyTheme();
});
