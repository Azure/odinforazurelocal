// @ts-check
/**
 * ODIN full walkthrough - Sizer → 3D viz → Designer → Switch Config Generator/Validator.
 * Target runtime: ~40 seconds.  Viewport 1600x900 (convert to portrait via ffmpeg for mobile).
 *
 * Storyline:
 *   1. Sizer: add 10x AKS Arc clusters + 1000 Azure Local VMs.
 *   2. Pick disaggregated storage, FC SAN, 4 racks of 16 nodes.
 *   3. Add 2x NVIDIA RTX Pro 6000 GPUs per node.
 *   4. Scroll to 3D visualisation and orbit the camera to show front + back of racks.
 *   5. Jump to Designer, load the 64-Node Disaggregated template.
 *   6. Scroll to bottom, click "Generate / Validate ToR Switch Configuration".
 *   7. Scroll through the generated switch config, then show the QoS Validator section.
 *
 * Run with:  npm run demo:full
 * Convert:   npm run demo:full:mobile   (produces 1080x1920 portrait MP4 for LinkedIn mobile)
 *
 * Requires:  tests/serve.ps1 running on http://localhost:5500
 */
const { test } = require('@playwright/test');

// Keep slowMo light so we fit inside ~40 seconds.
test.use({ launchOptions: { slowMo: 80 } });

/** Show an on-screen annotation box in the top-right of the page. */
async function annotate(page, text) {
    await page.evaluate((label) => {
        let el = document.getElementById('__odin_demo_annotation');
        if (!el) {
            el = document.createElement('div');
            el.id = '__odin_demo_annotation';
            el.style.cssText = [
                'position:fixed',
                'top:18px',
                'right:18px',
                'z-index:2147483647',
                'max-width:460px',
                'padding:14px 18px',
                'background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                'color:#ffffff',
                'border:2px solid #60a5fa',
                'border-radius:12px',
                'box-shadow:0 10px 30px rgba(37,99,235,0.45), 0 0 0 1px rgba(255,255,255,0.1) inset',
                'font-family:"Segoe UI",system-ui,-apple-system,sans-serif',
                'font-size:18px',
                'font-weight:600',
                'letter-spacing:0.2px',
                'line-height:1.35',
                'pointer-events:none',
                'transition:opacity 200ms ease',
                'opacity:0',
            ].join(';');
            document.body.appendChild(el);
        }
        const badge = '<div style="font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#bfdbfe;margin-bottom:4px;">New Feature</div>';
        el.innerHTML = badge + '<div>' + String(label) + '</div>';
        requestAnimationFrame(() => { if (el) el.style.opacity = '1'; });
    }, text);
    // Hold so viewers can actually read each label before the next action.
    await page.waitForTimeout(700);
}

/** Hide the annotation overlay. */
async function clearAnnotation(page) {
    await page.evaluate(() => {
        const el = document.getElementById('__odin_demo_annotation');
        if (el) el.style.opacity = '0';
    });
}

test('ODIN full walkthrough - Sizer to Switch Config', async ({ page, context }) => {
    // Auto-dismiss any alert()/confirm()/prompt() so a validation alert in the
    // Switch Config generator doesn't freeze the recording.  Log the message so
    // we can diagnose which validation failed if Generate silently no-ops.
    page.on('dialog', (d) => {
        // eslint-disable-next-line no-console
        console.log(`[dialog ${d.type()}] ${d.message()}`);
        d.accept().catch(() => {});
    });
    page.on('pageerror', (err) => {
        // eslint-disable-next-line no-console
        console.log(`[pageerror] ${err.message}`);
    });

    // Same-tab redirect for window.open - so the "Generate ToR Switch Configuration"
    // handoff stays in the recorded page instead of opening a second tab.
    await context.addInitScript(() => {
        // @ts-ignore
        window.open = (url) => { if (url) { window.location.href = String(url); } return null; };
        // Dismiss first-run welcome overlays on both Sizer and Designer so they don't
        // block clicks during the recording.
        try {
            localStorage.setItem('odin_sizer_onboarding_v0_20_06', 'true');
            localStorage.setItem('odin_onboarding_v0_20_06', 'true');
        } catch (e) { /* ignore */ }
    });

    // -- 1. Open the Sizer ------------------------------------
    await page.goto('/sizer/index.html');
    await page.waitForTimeout(400);
    await annotate(page, 'ODIN Sizer - plan Azure Local hardware from workloads');
    await page.waitForTimeout(300);

    // -- 2. Add 10x AKS Arc clusters ----------------------
    await annotate(page, 'Add AKS Arc workloads (10 clusters)');
    await page.locator('button.workload-type-btn').filter({ hasText: /AKS Arc Clusters/i }).first().click();
    await page.waitForTimeout(200);
    await page.locator('#aks-cluster-count').fill('10');
    await page.waitForTimeout(150);
    await page.locator('#modal-submit-btn').click();
    await page.waitForTimeout(900);

    // -- 3. Add 1000 Azure Local VMs ----------------------
    await annotate(page, 'Add 1,000 Azure Local VMs');
    await page.locator('button.workload-type-btn').filter({ hasText: /Azure Local VMs/i }).first().click();
    await page.waitForTimeout(200);
    await page.locator('#vm-count').fill('1000');
    await page.waitForTimeout(150);
    await page.locator('#modal-submit-btn').click();
    await page.waitForTimeout(1100);

    // -- 4. Disaggregated deployment: 4 racks of 16 nodes, FC SAN -
    await annotate(page, 'Disaggregated storage - 4 racks x 16 nodes over Fibre Channel SAN');
    await page.locator('#cluster-type').scrollIntoViewIfNeeded();
    await page.locator('#cluster-type').selectOption('disaggregated');
    await page.waitForTimeout(150);
    await page.locator('#disagg-rack-count').selectOption('4');
    await page.waitForTimeout(200);
    await page.locator('#disagg-storage-type').selectOption('fc_san');
    await page.waitForTimeout(150);
    await page.locator('#node-count').selectOption('64');
    await page.waitForTimeout(900);

    // -- 5. CPU: bump to the highest available cores per socket ---------
    await annotate(page, 'High-core-count CPUs - maximise workload density per node');
    await page.locator('#cpu-cores').scrollIntoViewIfNeeded();
    // The #cpu-cores dropdown is populated dynamically based on generation.
    // Pick the last (highest) option so the demo showcases the top-SKU choice.
    await page.evaluate(() => {
        const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('cpu-cores'));
        if (sel && sel.options.length > 0) {
            sel.selectedIndex = sel.options.length - 1;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
    await page.waitForTimeout(900);

    // -- 6. GPUs: 2x NVIDIA RTX Pro 6000 per node -------------
    await annotate(page, 'GPU acceleration - 2x NVIDIA RTX Pro 6000 per node');
    await page.locator('#gpu-count').scrollIntoViewIfNeeded();
    await page.locator('#gpu-count').selectOption('2');
    await page.waitForTimeout(150);
    await page.locator('#gpu-type').selectOption('rtxpro6000');
    await page.waitForTimeout(900);

    // -- 6. Scroll to 3D rack visualisation ---------------------
    await annotate(page, '3D hardware visualisation - see what your racks look like');
    const rackViz = page.locator('#rack-viz-section');
    await rackViz.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Orbit the camera around the racks to show front + back (3 s full circle).
    await page.evaluate(async () => {
        /** @type {any} */
        // @ts-ignore
        const r = window._rack3d;
        if (!r || !r.controls || !r.camera) return;
        const cam = r.camera;
        const target = r.controls.target.clone();
        const dx = cam.position.x - target.x;
        const dz = cam.position.z - target.z;
        const radius = Math.hypot(dx, dz);
        const startAngle = Math.atan2(dz, dx);
        const steps = 60;
        const totalMs = 3000;
        const stepMs = totalMs / steps;
        for (let i = 0; i <= steps; i++) {
            const a = startAngle + (i / steps) * Math.PI * 2;
            cam.position.x = target.x + Math.cos(a) * radius;
            cam.position.z = target.z + Math.sin(a) * radius;
            cam.lookAt(target);
            r.controls.update();
            await new Promise((res) => setTimeout(res, stepMs));
        }
    });
    await page.waitForTimeout(150);

    // -- 7. Jump to the Designer --------------------------
    await clearAnnotation(page);
    await page.goto('/');
    await page.waitForTimeout(500);
    await annotate(page, 'ODIN Designer - deployment wizard & validated architectures');
    await page.waitForTimeout(250);

    // -- 8. Open the template picker and load 8-Node Rack Aware (index 3) --
    await annotate(page, 'Load example template - 8-Node Rack Aware');
    await page.getByRole('button', { name: /Load Example Configuration Template/i }).first().click();
    await page.waitForTimeout(350);
    await page.evaluate(() => {
        const card = Array.from(document.querySelectorAll('div[onclick^="loadTemplate"]'))
            .find((el) => /8-Node Rack Aware/i.test(el.textContent || ''));
        if (card && card.scrollIntoView) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    await page.waitForTimeout(500);
    // @ts-ignore - loadTemplate is a global defined in js/script.js
    await page.evaluate(() => { window.loadTemplate(3); });
    await page.waitForTimeout(600);

    // -- 9. Scroll to the bottom to showcase the Generate / Validate button --
    await annotate(page, 'Generate ToR switch configuration straight from the design');
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await page.waitForTimeout(600);

    const torBtn = page.locator('#transfer-to-switch-config-btn');
    await torBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await torBtn.click();
    await page.waitForTimeout(800);

    // -- 10. On the Switch Config page: pick a ToR model + fill identity fields, then Generate --
    await annotate(page, 'ToR Switch Generator - pick model, fill hostnames, Generate');
    await page.evaluate(() => {
        const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('sc-tor-model'));
        if (sel && sel.options.length > 1) {
            sel.selectedIndex = 1;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
    await page.waitForTimeout(250);
    await page.locator('#sc-hostname-tor1').fill('tor-1a').catch(() => {});
    await page.locator('#sc-hostname-tor2').fill('tor-1b').catch(() => {});
    await page.locator('#sc-hostname-bmc').fill('bmc-1').catch(() => {});
    await page.locator('#sc-site').fill('Demo Datacenter').catch(() => {});
    await page.waitForTimeout(200);

    await page.locator('#sc-generate-btn').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await page.locator('#sc-generate-btn').click();
    await page.waitForTimeout(700);

    try {
        await page.waitForSelector('#sc-output-section:visible', { timeout: 5000 });
    } catch (e) { /* ignore */ }
    const outputVisible = await page.locator('#sc-output-section').isVisible().catch(() => false);
    // eslint-disable-next-line no-console
    console.log(`[demo] #sc-output-section visible after Generate: ${outputVisible}`);
    if (outputVisible) {
        await page.locator('#sc-output-section').scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
    }

    // -- 11. Reveal the generated output ------------------------
    await annotate(page, 'Generated Cisco NX-OS + Dell OS10 configs, ready to deploy');
    await page.evaluate(() => window.scrollBy({ top: 500, behavior: 'smooth' }));
    await page.waitForTimeout(700);

    // -- 12. Showcase the QoS Validator ---------------------
    await annotate(page, 'ToR Switch Validator - audit an existing config against QoS rules');
    await page.locator('#sc-qos-audit-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
});
