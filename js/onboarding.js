/* exported showOdinOnboarding */

async function showOdinOnboarding(steps, prefix, showBack = false) {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'onboarding-card odin-onboarding no-print';
    dialog.innerHTML = '<div class="onboarding-icon onboarding-icon-image"><img src="../images/odin-logo.png" alt="ODIN Logo" width="100" height="100"></div>' +
        '<h2 class="onboarding-title" tabindex="-1"></h2>' +
        '<p class="onboarding-description"></p>' +
        '<div class="onboarding-features"></div>' +
        '<div class="onboarding-progress" role="img"></div>' +
        '<div class="onboarding-buttons">' +
        '<button type="button" class="onboarding-btn onboarding-btn-secondary">Skip</button>' +
        '<button type="button" class="onboarding-btn onboarding-btn-secondary" data-action="back" hidden>Back</button>' +
        '<button type="button" class="onboarding-btn onboarding-btn-primary">Next</button></div>';
    const title = dialog.querySelector('.onboarding-title');
    const description = dialog.querySelector('.onboarding-description');
    const progress = dialog.querySelector('.onboarding-progress');
    title.id = prefix + '-title';
    description.id = prefix + '-description';
    progress.id = prefix + '-progress';
    dialog.setAttribute('aria-labelledby', title.id);
    dialog.setAttribute('aria-describedby', description.id + ' ' + progress.id);
    document.body.appendChild(dialog);
    try {
        let index = 0;
        const skip = dialog.querySelector('.onboarding-btn-secondary');
        const back = dialog.querySelector('[data-action="back"]');
        const next = dialog.querySelector('.onboarding-btn-primary');
        const render = () => {
            const step = steps[index];
            title.textContent = step.title;
            description.textContent = step.description;
            const features = dialog.querySelector('.onboarding-features');
            features.replaceChildren();
            step.features.forEach(feature => {
                const tile = document.createElement('div');
                tile.className = 'onboarding-feature';
                const icon = document.createElement('span');
                icon.className = 'onboarding-feature-icon';
                icon.setAttribute('aria-hidden', 'true');
                icon.textContent = feature.icon;
                const text = document.createElement('div');
                text.className = 'onboarding-feature-text';
                const heading = document.createElement('strong');
                heading.textContent = feature.title;
                text.append(heading, document.createTextNode(feature.text));
                if (feature.link) {
                    const link = document.createElement('a');
                    link.className = 'onboarding-feature-link';
                    link.href = feature.link.url;
                    link.textContent = feature.link.label;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    text.appendChild(link);
                }
                tile.append(icon, text);
                features.appendChild(tile);
            });
            progress.setAttribute('aria-label', 'Step ' + (index + 1) + ' of ' + steps.length);
            progress.replaceChildren();
            steps.forEach((_, stepIndex) => {
                const dot = document.createElement('span');
                dot.className = 'onboarding-dot' + (index === stepIndex ? ' active' : '');
                dot.setAttribute('aria-hidden', 'true');
                progress.appendChild(dot);
            });
            next.textContent = index === steps.length - 1 ? 'Get Started' : 'Next';
            back.hidden = !showBack || index === 0;
            dialog.scrollTop = 0;
        };
        await new Promise(resolve => {
            const finish = () => { dialog.close(); resolve(); };
            skip.addEventListener('click', finish);
            back.addEventListener('click', () => {
                if (index > 0) {
                    index--;
                    render();
                    title.focus();
                }
            });
            next.addEventListener('click', () => {
                if (++index === steps.length) {
                    finish();
                } else {
                    render();
                    title.focus();
                }
            });
            dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
            dialog.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    finish();
                } else if (event.key === 'Tab') {
                    event.stopPropagation();
                    const first = dialog.querySelector('a[href], button:not([hidden]):not([disabled])');
                    if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) {
                        event.preventDefault();
                        next.focus();
                    } else if (!event.shiftKey && document.activeElement === next) {
                        event.preventDefault();
                        first.focus();
                    }
                }
            });
            render();
            dialog.showModal();
            title.focus({ preventScroll: true });
            dialog.scrollTop = 0;
        });
    } finally {
        dialog.remove();
        if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    }
}
