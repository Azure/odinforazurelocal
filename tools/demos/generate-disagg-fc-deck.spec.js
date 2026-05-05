// @ts-check
/**
 * Generates a real PPTX deck for the Connected Disaggregated 64-node FC SAN
 * West Europe scenario, so a human can open it and review the layout.
 *
 * Output: tools/output/odin-disagg-fc-64node-westeurope.pptx
 *
 * Run with:  npx playwright test tools/demos/generate-disagg-fc-deck.spec.js
 * Requires:  tests/serve.ps1 running on http://localhost:5500
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.use({ launchOptions: { slowMo: 0 } });

test('generate disaggregated FC SAN 64-node West Europe deck', async ({ page, context }) => {
    page.on('dialog', (d) => {
        // Best-effort auto-accept: dialog may already be gone during teardown/navigation.
        d.accept().catch((err) => {
            // eslint-disable-next-line no-console
            console.warn('[PPTX generation] dialog auto-accept failed (likely already dismissed):',
                err && err.message ? err.message : err);
        });
    });

    await page.goto('http://localhost:5500/');
    await page.waitForFunction(() => typeof window.showTemplates === 'function' && typeof window.loadTemplate === 'function');

    // Load the built-in 64-node disaggregated FC SAN template, then override
    // the region to West Europe to match the requested scenario.
    await page.evaluate(() => {
        // Populate window.configTemplates without showing the modal UI.
        window.showTemplates();
        // The modal overlay is appended to body; remove it immediately.
        // Scope to fixed-position elements with a z-index containing the template name,
        // so we don't iterate every <div> in the document.
        const overlays = document.querySelectorAll('div[style*="position: fixed"][style*="z-index"]');
        overlays.forEach((el) => {
            if (el.innerHTML.indexOf('64-Node Disaggregated') !== -1) {
                el.remove();
            }
        });

        // Find the 64-node template index.
        const templates = window.configTemplates || [];
        const idx = templates.findIndex((t) => /64-Node Disaggregated/i.test(t.name));
        if (idx < 0) throw new Error('64-node template not found');
        window.loadTemplate(idx);

        // Override region to West Europe.
        window.selectOption('localInstanceRegion', 'west_europe');

        // Enable proxy + Arc Gateway + Private Endpoints so the deck exercises
        // the proxy bypass and PE detail slides.
        // eslint-disable-next-line no-undef
        const s = (typeof state !== 'undefined') ? state : (window.state || {});
        s.outbound = 'private';
        s.arc = 'arc_gateway';
        s.proxy = 'proxy';
        s.privateEndpoints = 'pe_enabled';
        s.privateEndpointsList = ['keyvault', 'storage', 'acr', 'asr', 'backup'];
        s.adDomain = 'contoso.local';
        s.infraCidr = s.infraCidr || '10.71.0.0/24';
    });

    // Build a report payload directly from the seeded state, bypassing the
    // wizard's readiness check (the template covers the disaggregated path but
    // doesn't fill every wizard step the readiness gate requires).
    // `state` is a top-level const in js/script.js; not on window. Read it via
    // a debug-eval in the page (it is in scope at script-global level).
    const payload = await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        const s = (typeof state !== 'undefined') ? state : (window.state || {});
        return {
            generatedAt: new Date().toISOString(),
            version: '1.0',
            state: JSON.parse(JSON.stringify(s))
        };
    });

    const reportPage = await context.newPage();
    await reportPage.addInitScript((p) => {
        try {
            localStorage.setItem('azloc_report_payload', JSON.stringify(p));
        } catch (e) {
            // localStorage may be unavailable (quota / security restrictions); demo can still continue.
            // eslint-disable-next-line no-console
            console.warn('Failed to persist azloc_report_payload to localStorage:', e);
        }
    }, payload);
    await reportPage.goto('http://localhost:5500/report/report.html');
    await reportPage.waitForLoadState('domcontentloaded');
    await reportPage.waitForSelector('#pptx-export-btn', { timeout: 30000 });
    // Let the report finish rendering its sections + diagrams.
    await reportPage.waitForTimeout(5000);

    const downloadPromise = reportPage.waitForEvent('download', { timeout: 60000 });
    await reportPage.locator('#pptx-export-btn').click();
    const dl = await downloadPromise;

    const outDir = path.join(__dirname, '..', 'output');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'odin-disagg-fc-64node-westeurope.pptx');
    await dl.saveAs(outPath);

    const stat = fs.statSync(outPath);
    console.log('[PPTX generation]', 'Saved', outPath, stat.size, 'bytes');
    expect(stat.size).toBeGreaterThan(50000);
});
