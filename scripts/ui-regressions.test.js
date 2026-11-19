const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const { chromium, expect } = require('@playwright/test');
const { startTestServer } = require('./browser-test-harness.js');

let browser;
let server;
const artifacts = path.resolve('test-results', 'ui');

before(async () => {
    server = await startTestServer(process.cwd());
    const puppeteer = await import('puppeteer');
    browser = await chromium.launch({
        executablePath: await puppeteer.executablePath(),
        headless: true,
        args: ['--no-sandbox']
    });
    await fs.mkdir(artifacts, { recursive: true });
});

after(async () => {
    if (browser) await browser.close();
    if (server) await server.close();
});

async function visit(t, route, run) {
    console.log('UI:', t.name);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const diagnostics = { pageErrors: [], failedRequests: [], failedResponses: [], consoleErrors: [] };
    context.on('response', response => {
        if (response.status() >= 400 && response.url().startsWith(server.url)) {
            diagnostics.failedResponses.push({ url: response.url(), status: response.status() });
        }
    });
    context.on('page', page => {
        page.setDefaultTimeout(10000);
        page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
        page.on('requestfailed', request => {
            if (request.url().startsWith(server.url)) diagnostics.failedRequests.push(request.url());
        });
        page.on('console', message => {
            if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
        });
    });
    const page = await context.newPage();
    try {
        await page.goto(server.url + route);
        await run(page, context);
        assert.deepEqual(diagnostics.pageErrors, [], 'No uncaught exceptions on the real page');
        assert.deepEqual(diagnostics.failedRequests, [], 'No failed same-origin requests');
        assert.deepEqual(diagnostics.failedResponses, [], 'No same-origin HTTP errors');
        assert.deepEqual(diagnostics.consoleErrors, [], 'No browser console errors');
    } catch (error) {
        const name = t.name.replace(/[^a-z0-9-]+/gi, '-');
        const evidence = await Promise.allSettled([
            page.screenshot({ path: path.join(artifacts, name + '.png'), fullPage: true, timeout: 5000 }),
            fs.writeFile(path.join(artifacts, name + '.json'), JSON.stringify(diagnostics, null, 2))
        ]);
        evidence.filter(result => result.status === 'rejected').forEach(result => t.diagnostic('Failure artifact: ' + result.reason));
        throw error;
    } finally {
        await context.close();
    }
}

async function loadTemplate(page, name) {
    await page.getByRole('button', { name: /Load Example Configuration Template/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: new RegExp('^' + name) }).click();
    await expect(page.locator('#wizard-progress-text')).toContainText('100%');
    await expect(page.locator('#generate-report-btn')).toBeEnabled();
}

async function edit(input, value) {
    await input.fill(value);
    await input.press('Tab');
}

async function openOutput(page, button) {
    const [output] = await Promise.all([page.waitForEvent('popup'), page.locator(button).click()]);
    await output.waitForLoadState();
    const skip = output.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.isVisible()) await skip.click();
    return output;
}

async function downloadText(page, button) {
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    return fs.readFile(await download.path(), 'utf8');
}

for (const dismissal of ['Skip', 'Get Started', 'Escape']) {
    test('Designer ' + dismissal + ' preserves Import without a reload', { timeout: 60000 }, async t => {
        await visit(t, '/index.html?ui=designer-first-use', async page => {
            await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible();
            if (dismissal === 'Get Started') {
                while (await page.getByRole('button', { name: 'Next', exact: true }).isVisible()) {
                    await page.getByRole('button', { name: 'Next', exact: true }).click();
                }
            }
            if (dismissal === 'Escape') await page.keyboard.press('Escape');
            else await page.getByRole('button', { name: dismissal, exact: true }).click();
            await loadTemplate(page, '2-Node Standard Cluster');
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('button', { name: '💾 Export', exact: true }).click();
            await page.getByRole('dialog').getByRole('button', { name: 'Export JSON', exact: true }).click();
            const download = await downloadPromise;
            const filename = await download.path();
            await page.getByRole('button', { name: 'Start Over', exact: true }).click();
            await page.getByRole('dialog').getByRole('button', { name: 'Start over', exact: true }).click();
            await page.getByRole('button', { name: '📁 Import', exact: true }).click();
            const [chooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                page.getByText('Import ODIN Designer Configuration', { exact: true }).click()
            ]);
            await chooser.setFiles(filename);
            await expect(page.locator('#wizard-progress-text')).toContainText('100%');
            await expect(page.locator('#generate-arm-btn')).toBeEnabled();
            await expect(page.getByRole('textbox', { name: /^SAM Account name/ })).toHaveCount(2);
        });
    });
}

test('Designer Help owns its keyboard focus without removing other dialogs', { timeout: 60000 }, async t => {
    await visit(t, '/index.html?ui=designer-help-keyboard', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await loadTemplate(page, '2-Node Standard Cluster');
        const help = page.getByTitle('Show Getting Started guide', { exact: true });
        await help.click();
        const guide = page.locator('#designer-onboarding-overlay');
        await guide.getByRole('button', { name: 'Skip', exact: true }).focus();
        await page.keyboard.press('Shift+Tab');
        await expect(guide.getByRole('button', { name: 'Next', exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(guide.getByRole('button', { name: 'Skip', exact: true })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(guide).not.toBeVisible();
        await expect(help).toBeFocused();
        await expect(page.locator('#designer-import-modal')).toHaveCount(1);
        await expect(page.locator('#generate-report-btn')).toBeEnabled();
    });
});

test('Disaggregated rendered edits survive node boundaries and their inverse', { timeout: 90000 }, async t => {
    await visit(t, '/index.html?ui=node-boundaries', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await loadTemplate(page, '64-Node Disaggregated Storage Cluster');
        let sequence = 0;
        const prefix = (await page.getByRole('textbox', { name: /^IPv4 CIDR/ }).first().inputValue())
            .split('.').slice(0, 3).join('.') + '.';
        for (const [racks, perRack] of [[1, 1], [1, 3], [2, 8], [2, 9], [2, 8]]) {
            await page.locator('#step-da3 .option-card[data-value="' + racks + '"]').click();
            await page.locator('#da-nodes-per-rack').press('Home');
            for (let index = 1; index < perRack; index++) await page.locator('#da-nodes-per-rack').press('ArrowRight');
            const names = page.getByRole('textbox', { name: /^SAM Account name/ });
            const ips = page.getByRole('textbox', { name: /^IPv4 CIDR/ });
            const firstIP = prefix + (100 + 20 * sequence++) + '/24';
            await edit(ips.first(), firstIP);
            await edit(names.first(), 'lab01');
            if (racks * perRack > 1) {
                await edit(names.nth(1), 'manual-node');
                await edit(ips.nth(1), prefix + '220/24');
            }
            await edit(names.first(), 'edge01');
            await expect(names).toHaveCount(racks * perRack);
            await expect(ips).toHaveCount(racks * perRack);
            await expect(names.first()).toHaveValue('edge01');
            await expect(ips.first()).toHaveValue(firstIP);
            if (racks * perRack > 1) {
                await expect(names.nth(1)).toHaveValue('manual-node');
                await expect(ips.nth(1)).toHaveValue(prefix + '220/24');
            }
            if (racks * perRack > 2) await expect(names.nth(2)).toHaveValue('edge03');
            await expect(page.locator('#step-2')).not.toBeVisible();
            await expect(page.locator('#node-config-section')).toContainText('Node settings valid');
            await expect(page.locator('#wizard-progress-text')).toContainText('100%');
            await expect(page.locator('#generate-arm-btn')).toBeEnabled();
        }
    });
});

test('Sizer Help traps both Tab directions and restores edited inputs and trigger focus', { timeout: 90000 }, async t => {
    await visit(t, '/sizer/?ui=help-focus', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await page.locator('[data-workload-type="vm"]').click();
        await edit(page.locator('#workload-name'), 'Demo edited workload');
        const help = page.getByTitle('Show Getting Started guide', { exact: true });
        await page.locator('#modal-submit-btn').click();
        for (const [width, height] of [[375, 667], [768, 1024], [1280, 900]]) {
            await page.setViewportSize({ width, height });
            for (let theme = 0; theme < 2; theme++) {
                await help.click();
                const guide = page.locator('#sizer-onboarding-overlay');
                await expect(guide).toBeVisible();
                for (let step = 0; step < 3; step++) {
                    const first = guide.getByRole('button', { name: 'Skip', exact: true });
                    const next = guide.getByRole('button', { name: step === 2 ? 'Get Started' : 'Next', exact: true });
                    await first.focus();
                    await page.keyboard.press('Shift+Tab');
                    await expect(next).toBeFocused();
                    await page.keyboard.press('Tab');
                    await expect(first).toBeFocused();
                    if (step < 2) await next.click();
                }
                await page.keyboard.press('Escape');
                await expect(guide).not.toBeVisible();
                await expect(help).toBeFocused();
                await expect(page.locator('#workloads-list')).toContainText('Demo edited workload');
                await page.locator('#theme-toggle').click();
            }
        }
    });
});

test('Infrastructure pool ownership and invalid addresses control real output readiness', { timeout: 90000 }, async t => {
    await visit(t, '/index.html?ui=infra-validation', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await loadTemplate(page, '2-Node Standard Cluster');
        const start = page.locator('#infra-ip-start');
        const end = page.locator('#infra-ip-end');
        const gateway = page.locator('#infra-default-gateway');
        const cidr = page.locator('#infra-cidr');
        const original = { start: await start.inputValue(), end: await end.inputValue(),
            gateway: await gateway.inputValue(), cidr: await cidr.inputValue() };
        const prefix = original.start.split('.').slice(0, 3).join('.') + '.';
        await edit(end, '');
        await edit(start, prefix + '100');
        await expect(end).toHaveValue(prefix + '105');
        await edit(end, prefix + '115');
        await edit(start, prefix + '101');
        await expect(end).toHaveValue(prefix + '115');
        await expect(page.locator('#generate-report-btn')).toBeEnabled();
        for (const [input, value, error] of [
            [gateway, 'not-an-ip', '#infra-gateway-error'],
            [gateway, prefix + '102', '#infra-gateway-error'],
            [cidr, '203.0.113.0/24', '#infra-ip-error'],
            [start, await page.getByRole('textbox', { name: /^IPv4 CIDR/ }).first().inputValue().then(ip => ip.split('/')[0]), '#infra-ip-error']
        ]) {
            await edit(input, value);
            await expect(page.locator(error)).toBeVisible();
            await expect(page.locator('#generate-report-btn')).toBeDisabled();
            await expect(page.locator('#generate-arm-btn')).toBeDisabled();
            await edit(cidr, original.cidr);
            await edit(start, prefix + '101');
            await edit(end, prefix + '115');
            await edit(gateway, original.gateway);
            await expect(page.locator('#generate-report-btn')).toBeEnabled();
        }
    });
});

test('Switchless three/four-node storage requires distinct custom subnets and survives switched inverse', { timeout: 90000 }, async t => {
    await visit(t, '/index.html?ui=switchless-subnets', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await loadTemplate(page, '4-Node High Performance');
        for (const nodes of [3, 4]) {
            await page.locator('#step-3 .node-chip').filter({ hasText: new RegExp('^' + nodes + '$') }).click();
            await page.locator('#step-4 .option-card[data-value="switchless"]').click();
            const dualLink = page.locator('#step-4 .option-card[data-value="dual_link"]');
            if (await dualLink.isVisible()) await dualLink.click();
            await page.locator('#step-5 .option-card[data-value="' + (nodes === 3 ? 6 : 8) + '"]').click();
            await page.locator('#port-config-confirm-btn').click();
            await page.locator('#step-6 .option-card[data-value="mgmt_compute"]').click();
            await expect(page.locator('#storage-auto-ip .option-card[data-value="enabled"]')).toHaveAttribute('aria-disabled', 'true');
            const subnets = page.locator('.custom-storage-subnet-input');
            const count = await subnets.count();
            assert.equal(count, nodes * (nodes - 1));
            for (let index = 0; index < count; index++) await edit(subnets.nth(index), '192.0.2.' + (16 * index) + '/28');
            const confirm = page.locator('#custom-storage-subnets-confirm-btn');
            await expect(confirm).toBeEnabled();
            await edit(subnets.nth(1), '192.0.2.0/28');
            await expect(confirm).toBeDisabled();
            await expect(page.locator('#generate-report-btn')).toBeDisabled();
            await expect(page.locator('#storage-subnet-error-1')).not.toBeEmpty();
            await edit(subnets.nth(1), 'invalid/24');
            await expect(confirm).toBeDisabled();
            await edit(subnets.nth(1), '192.0.2.16/28');
            await expect(confirm).toBeEnabled();
            await confirm.click();
        }
        await page.locator('#step-4 .option-card[data-value="switched"]').click();
        await page.locator('#step-5 .option-card[data-value="8"]').click();
        await page.locator('#port-config-confirm-btn').click();
        await page.locator('#step-6 .option-card[data-value="mgmt_compute"]').click();
        await page.locator('#storage-auto-ip .option-card[data-value="enabled"]').click();
        await expect(page.locator('#custom-storage-subnets')).not.toBeVisible();
        await expect(page.locator('#summary-content')).not.toContainText('192.0.2.0/28');
    });
});

test('Changing ports invalidates confirmations and the RDMA minimum cannot be removed', { timeout: 90000 }, async t => {
    await visit(t, '/index.html?ui=rdma-transitions', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await loadTemplate(page, '2-Node Standard Cluster');
        await page.locator('#port-config-confirmed-msg').getByRole('button', { name: 'Edit', exact: true }).click();
        const checked = page.locator('#port-config-grid .rdma-checkbox:checked');
        await expect(checked).toHaveCount(2);
        await checked.first().click();
        await expect(checked).toHaveCount(2);
        await expect(page.locator('#rdma-validation-warning')).toBeVisible();
        await expect(page.locator('#generate-arm-btn')).toBeDisabled();
        await page.locator('#port-config-grid .rdma-checkbox:not(:checked)').first().click();
        await expect(checked).toHaveCount(3);
        await checked.last().click();
        await expect(checked).toHaveCount(2);
        await expect(page.locator('#rdma-validation-warning')).not.toBeVisible();
        await page.locator('#port-config-confirm-btn').click();
        await expect(page.locator('#port-config-confirmed-msg')).toBeVisible();
        await page.locator('#step-5 .option-card[data-value="6"]').click();
        await expect(page.locator('#port-config-grid .port-config-card')).toHaveCount(6);
        await expect(page.locator('#port-config-confirm-btn')).toBeVisible();
        await expect(page.locator('#generate-report-btn')).toBeDisabled();
    });
});

test('Designer rejects Sizer files without changing the completed design', { timeout: 60000 }, async t => {
    await visit(t, '/index.html?ui=reciprocal-import', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await loadTemplate(page, '2-Node Standard Cluster');
        const summary = await page.locator('#summary-content').innerText();
        await page.getByRole('button', { name: '📁 Import', exact: true }).click();
        const [chooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            page.getByText('Import ODIN Designer Configuration', { exact: true }).click()
        ]);
        await chooser.setFiles({ name: 'demo-sizer.json', mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify({ version: 5, clusterType: 'standard', workloads: [] })) });
        const dialog = page.getByRole('dialog', { name: 'Sizer configuration detected' });
        await expect(dialog).toContainText('Open Sizer, then use its Import button');
        await dialog.getByRole('button', { name: 'Stay in Designer', exact: true }).click();
        assert.equal(await page.locator('#summary-content').innerText(), summary);
        await expect(page.locator('#generate-arm-btn')).toBeEnabled();
    });
});

test('Custom NIC mapping validates required zones and invalidates on port changes', { timeout: 60000 }, async t => {
    await visit(t, '/index.html?ui=custom-nics', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await loadTemplate(page, '2-Node Standard Cluster');
        await page.locator('#step-5 .option-card[data-value="8"]').click();
        await page.locator('#port-config-confirm-btn').click();
        await page.locator('#step-6 .option-card[data-value="custom"]').click();
        const confirm = page.locator('#adapter-mapping-confirm-btn');
        const pool = page.locator('#adapter-pool-drop .adapter-pill');
        const ports = await pool.evaluateAll(elements => elements.map(element => element.dataset.portId));
        assert.equal(ports.length, 4);
        for (const id of ports) {
            await page.locator('#adapter-pool-drop .adapter-pill[data-port-id="' + id + '"]').click();
            await page.locator('#zone-drop-compute_1').click({ position: { x: 4, y: 4 } });
        }
        await expect(page.locator('#zone-drop-compute_1 .adapter-pill')).toHaveCount(4);
        await expect(confirm).toBeEnabled();
        const storage = page.locator('#zone-drop-storage .adapter-pill').first();
        const port = await storage.getAttribute('data-port-id');
        await storage.click();
        await page.locator('#adapter-pool-drop').click({ position: { x: 4, y: 4 } });
        await expect(page.locator('#zone-drop-storage .adapter-pill')).toHaveCount(1);
        await expect(confirm).toBeDisabled();
        await expect(page.locator('#generate-report-btn')).toBeDisabled();
        await page.locator('#adapter-pool-drop .adapter-pill[data-port-id="' + port + '"]').click();
        await page.locator('#zone-drop-storage').click({ position: { x: 4, y: 4 } });
        await expect(page.locator('#zone-drop-storage .adapter-pill')).toHaveCount(2);
        await expect(confirm).toBeEnabled();
        await confirm.click();
        await expect(page.locator('#adapter-mapping-status')).toHaveText('Mapping confirmed.');
        await page.locator('#overrides-confirm-btn').click();
        await page.locator('#step-5 .option-card[data-value="4"]').click();
        await expect(page.locator('#port-config-confirm-btn')).toBeVisible();
        await expect(page.locator('#adapter-mapping-container')).not.toBeVisible();
        await expect(page.locator('#generate-report-btn')).toBeDisabled();
        await expect(page.locator('#summary-content')).not.toContainText('Compute 1');
    });
});

test('ARM region validation and phase-specific downloads use the rendered choices', { timeout: 90000 }, async t => {
    await visit(t, '/index.html?ui=arm-downloads', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await loadTemplate(page, '2-Node Standard Cluster');
        const arm = await openOutput(page, '#generate-arm-btn');
        const location = arm.locator('#input-location');
        await expect(location.locator('option[value="usgovvirginia"]')).toHaveCount(0);
        await location.selectOption('');
        await expect(arm.locator('#location-error')).toBeVisible();
        await location.selectOption('custom');
        await edit(arm.locator('#input-location-custom'), 'not a region');
        await expect(arm.locator('#location-error')).toBeVisible();
        await edit(arm.locator('#input-location-custom'), 'northeurope');
        await expect(arm.locator('#location-error')).not.toBeVisible();
        await arm.locator('#input-deployment-mode').selectOption('Deploy');
        for (const mode of ['Validate', 'Deploy']) {
            const text = await downloadText(arm, arm.locator('#download-' + mode.toLowerCase() + '-parameters-btn'));
            const payload = JSON.parse(text);
            assert.equal(payload.parameters.location.value, 'northeurope');
            assert.equal(payload.parameters.deploymentMode.value, mode);
        }
        await edit(arm.locator('#input-subscription-id'), '00000000-0000-0000-0000-000000000001');
        await edit(arm.locator('#input-resource-group'), 'demo-azurelocal');
        for (const button of ['#gen-powershell-btn', '#gen-azcli-btn', '#export-devops-btn', '#export-github-btn']) {
            const text = await downloadText(arm, arm.locator(button));
            assert.match(text, /northeurope/);
            assert.match(text, /Validate/);
            assert.match(text, /Deploy/);
        }
        await location.selectOption('westeurope');
        await expect(arm.locator('#custom-location-code-container')).not.toBeVisible();
        const payload = JSON.parse(await downloadText(arm, arm.locator('#download-validate-parameters-btn')));
        assert.equal(payload.parameters.location.value, 'westeurope');
    });
});

test('Government cloud transition filters ARM regions and selects the government template', { timeout: 90000 }, async t => {
    await visit(t, '/index.html?ui=government-arm', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await loadTemplate(page, '2-Node Standard Cluster');
        await page.locator('.option-card[data-value="azure_government"]').click();
        await page.locator('.option-card[data-value="us_gov_virginia"]').click();
        await page.locator('#step-2 .option-card[data-value="medium"]').click();
        await page.locator('#step-3 .node-chip').filter({ hasText: /^2$/ }).click();
        for (const selector of [
            '#step-4 .option-card[data-value="switched"]', '#step-5 .option-card[data-value="4"]',
            '#port-config-confirm-btn', '#step-6 .option-card[data-value="mgmt_compute"]',
            '#adapter-mapping-confirm-btn', '#overrides-confirm-btn',
            '#step-7 .option-card[data-value="public"]', '#step-8 .option-card[data-value="no_arc"]',
            '#step-9 .option-card[data-value="no_proxy"]', '#step-9b .option-card[data-value="pe_disabled"]',
            '#step-10 .option-card[data-value="static"]', '#step-11 .option-card[data-value="default"]'
        ]) await page.locator(selector).click();
        for (const [input, value] of [
            [page.getByRole('textbox', { name: /^SAM Account name/ }).first(), 'demo01'],
            [page.getByRole('textbox', { name: /^IPv4 CIDR/ }).first(), '192.0.2.10/24'],
            [page.locator('#infra-cidr'), '192.0.2.0/24'], [page.locator('#infra-ip-start'), '192.0.2.50'],
            [page.locator('#infra-ip-end'), '192.0.2.55'], [page.locator('#infra-default-gateway'), '192.0.2.1']
        ]) await edit(input, value);
        await page.locator('#step-5-5 .option-card[data-value="Express"]').click();
        await expect(page.locator('#generate-arm-btn')).toBeEnabled();
        const arm = await openOutput(page, '#generate-arm-btn');
        await expect(arm.locator('#input-location option[data-cloud="azure_commercial"]')).toHaveCount(0);
        await expect(arm.locator('#input-location option[data-cloud="azure_government"]')).toHaveCount(1);
        await expect(arm.locator('#deploy-template-name')).toContainText('US Gov');
        const payload = JSON.parse(await downloadText(arm, arm.locator('#download-validate-parameters-btn')));
        assert.equal(payload.parameters.location.value, 'usgovvirginia');
    });
});

test('Offline report diagram bundle matches the source SVG assets', async () => {
    const window = {};
    vm.runInNewContext(await fs.readFile(path.resolve('report', 'diagram-assets.js'), 'utf8'), { window });
    const source = path.resolve('images', 'disaggregated');
    const names = (await fs.readdir(source)).filter(name => name.endsWith('.svg')).sort();
    assert.deepEqual(Object.keys(window.ODIN_REPORT_DIAGRAM_ASSETS).sort(), names);
    for (const name of names) {
        assert.equal(window.ODIN_REPORT_DIAGRAM_ASSETS[name], await fs.readFile(path.join(source, name), 'utf8'),
            name + ': regenerate with node scripts/generate-report-diagram-assets.js');
    }
});

for (const [label, template] of [
    ['hci', '2-Node Standard Cluster'],
    ['disaggregated', '64-Node Disaggregated Storage Cluster']
]) {
    test('Report ' + label + ' exports retain actual design and guidance', { timeout: 180000 }, async t => {
        await visit(t, '/index.html?ui=report-' + label, async page => {
            await page.getByRole('button', { name: 'Skip', exact: true }).click();
            await loadTemplate(page, template);
            const firstName = await page.getByRole('textbox', { name: /^SAM Account name/ }).first().inputValue();
            const report = await openOutput(page, '#generate-report-btn');
            await expect(report.locator('#report-summary')).toContainText(firstName);
            for (const format of ['Word', 'Markdown']) {
                const text = await downloadText(report, report.getByRole('button', { name: 'Download ' + format, exact: false }));
                assert.ok(text.includes(firstName), format + ' includes configured machine names');
                assert.ok(/low.level design/i.test(text), format + ' includes the LLD scope guidance');
                assert.ok(/business or technical requirements/i.test(text), format + ' includes requirements guidance');
            }
            await report.locator('#print-friendly-btn').click();
            await expect(report.locator('body')).toHaveClass(/print-friendly-mode/);
            await report.locator('#print-friendly-btn').click();
            await expect(report.locator('body')).not.toHaveClass(/print-friendly-mode/);
            for (const [button, extension, signature] of [
                ['#pptx-export-btn', 'pptx', 'PK'],
                ['button[onclick="exportReportPDF()"]', 'pdf', '%PDF-']
            ]) {
                const [download] = await Promise.all([
                    report.waitForEvent('download', { timeout: 120000 }), report.locator(button).click({ timeout: 120000 })
                ]);
                const target = path.join(artifacts, label + '.' + extension);
                await download.saveAs(target);
                const bytes = await fs.readFile(target);
                assert.equal(bytes.subarray(0, signature.length).toString(), signature);
                assert.ok(bytes.length > 10000, extension + ' is not an empty package');
            }
        });
    });
}

for (const [label, template] of [
    ['hci', '2-Node Standard Cluster'],
    ['disaggregated', '64-Node Disaggregated Storage Cluster']
]) {
    for (const [protocol, theme] of [['http', 'light'], ['file', 'dark'], ['file', 'light'], ['http', 'print-friendly']]) {
        test('Report PDF ' + label + ' ' + protocol + ' ' + theme + ' preserves readable diagrams', { timeout: 120000 }, async t => {
            const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
            const page = await context.newPage();
            let report;
            const pageErrors = [];
            context.on('page', child => child.on('pageerror', error => pageErrors.push(error.message)));
            page.on('pageerror', error => pageErrors.push(error.message));
            try {
                await page.goto(protocol === 'file' ? pathToFileURL(path.resolve('index.html')).href :
                    server.url + '/index.html?ui=pdf-palette');
                await page.getByRole('button', { name: 'Skip', exact: true }).click();
                if (theme === 'light') await page.locator('#theme-toggle').click();
                await loadTemplate(page, template);
                report = await openOutput(page, '#generate-report-btn');
                if (theme === 'print-friendly') await report.locator('#print-friendly-btn').click();
                const sourceDiagram = report.locator('svg.switchless-diagram__svg').first();
                const diagramLabel = await sourceDiagram.getAttribute('aria-label');
                const foreground = theme === 'print-friendly' ?
                    await report.locator('body').evaluate(element => getComputedStyle(element).color) :
                    await sourceDiagram.locator('text[fill="var(--text-primary)"]').first().evaluate(element => getComputedStyle(element).fill);
                const exportErrors = [];
                report.on('console', message => {
                    if (message.type() === 'error') exportErrors.push(message.text());
                });
                const failure = new Promise((resolve, reject) => {
                    report.once('dialog', async dialog => {
                        const message = dialog.message();
                        await dialog.accept();
                        reject(new Error(message));
                    });
                });
                const download = report.waitForEvent('download', { timeout: 100000 });
                const capture = (async () => {
                    await report.getByRole('button', { name: /Save as PDF/ }).click();
                    const image = report.frameLocator('iframe.html2canvas-container').getByAltText(diagramLabel, { exact: true });
                    await image.waitFor({ state: 'attached', timeout: 30000 });
                    const png = await image.getAttribute('src');
                    return report.evaluate(async png => {
                        const element = new Image();
                        element.src = png;
                        await element.decode();
                        const canvas = document.createElement('canvas');
                        canvas.width = canvas.height = 1;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(element, 0, 0, 1, 1, 0, 0, 1, 1);
                        return { png, background: Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3) };
                    }, png);
                })();
                const [file, diagram] = await Promise.race([Promise.all([download, capture]), failure]);
                const target = path.join(artifacts, 'pdf-' + label + '-' + protocol + '-' + theme);
                await file.saveAs(target + '.pdf');
                await fs.writeFile(target + '.png', Buffer.from(diagram.png.split(',')[1], 'base64'));
                const bytes = await fs.readFile(target + '.pdf');
                assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
                assert.ok(bytes.length > 10000, 'A complete PDF was downloaded');
                const luminance = rgb => rgb.map(value => {
                    const channel = value / 255;
                    return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
                }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
                const textLuminance = luminance(foreground.match(/\d+/g).slice(0, 3).map(Number));
                assert.equal(textLuminance < 0.5, theme !== 'dark', 'The requested report palette is active');
                const backgroundLuminance = luminance(diagram.background);
                const contrast = (Math.max(textLuminance, backgroundLuminance) + 0.05) /
                    (Math.min(textLuminance, backgroundLuminance) + 0.05);
                t.diagnostic('Generated host-diagram contrast: ' + contrast.toFixed(2) + ':1');
                assert.ok(contrast >= 4.5, 'Rasterized diagram text/background contrast must meet WCAG AA: ' + contrast);
                assert.deepEqual(pageErrors, [], 'No uncaught exceptions');
                assert.deepEqual(exportErrors, [], 'No PDF export console errors');
            } catch (error) {
                await (report || page).screenshot({
                    path: path.join(artifacts, 'pdf-' + label + '-' + protocol + '-' + theme + '-failure.png'), timeout: 5000
                }).catch(captureError => t.diagnostic('Failure screenshot: ' + captureError.message));
                throw error;
            } finally {
                await context.close();
            }
        });
    }
}

test('Output Help is centered, keyboard-contained and independent across sizes and themes', { timeout: 180000 }, async t => {
    await visit(t, '/index.html?ui=output-help', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await loadTemplate(page, '2-Node Standard Cluster');
        for (const [button, helpButton] of [
            ['#generate-arm-btn', '#arm-help-btn'], ['#generate-report-btn', '#report-help-btn']
        ]) {
            const [output] = await Promise.all([page.waitForEvent('popup'), page.locator(button).click()]);
            const guide = output.locator('dialog.odin-onboarding');
            await expect(guide).toBeVisible();
            await guide.getByRole('button', { name: 'Skip', exact: true }).click();
            for (const [width, height] of [[375, 667], [768, 1024], [1280, 900]]) {
                await output.setViewportSize({ width, height });
                for (let theme = 0; theme < 2; theme++) {
                    await page.locator('#theme-toggle').click();
                    await output.reload();
                    await expect(guide).toHaveCount(0);
                    await output.locator(helpButton).click();
                    for (let step = 0; step < 3; step++) {
                        const next = guide.getByRole('button', { name: step === 2 ? 'Get Started' : 'Next', exact: true });
                        await next.scrollIntoViewIfNeeded();
                        await output.waitForTimeout(300);
                        const geometry = await guide.evaluate(element => {
                            const bounds = element.getBoundingClientRect();
                            return { x: Math.abs(bounds.x + bounds.width / 2 - document.documentElement.clientWidth / 2),
                                y: Math.abs(bounds.y + bounds.height / 2 - innerHeight / 2) };
                        });
                        assert.ok(geometry.x <= 2 && geometry.y <= 2, 'Help is centered within 2 CSS pixels');
                        const first = guide.locator('a[href], button:not([hidden]):not([disabled])').first();
                        await first.focus();
                        await output.keyboard.press('Shift+Tab');
                        await expect(next).toBeFocused();
                        await output.keyboard.press('Tab');
                        await expect(first).toBeFocused();
                        await next.click();
                    }
                    await expect(guide).toHaveCount(0);
                    await expect(output.locator(helpButton)).toBeFocused();
                    await output.locator(helpButton).click();
                    await output.keyboard.press('Escape');
                    await expect(guide).toHaveCount(0);
                    await expect(output.locator(helpButton)).toBeFocused();
                    const actions = output.locator('.page-header-actions button');
                    for (const action of await actions.all()) {
                        await action.scrollIntoViewIfNeeded();
                        const bounds = await action.boundingBox();
                        assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 &&
                            bounds.x + bounds.width <= width && bounds.y + bounds.height <= height, 'Header action is in the viewport');
                        await action.click({ trial: true });
                    }
                }
            }
            if (button === '#generate-report-btn') {
                await output.locator('#print-friendly-btn').click();
                await output.locator(helpButton).click();
                await expect(guide).toBeVisible();
                await output.keyboard.press('Escape');
                await expect(output.locator('body')).toHaveClass(/print-friendly-mode/);
            }
            await output.close();
        }
    });
});

test('Designer handoffs replace stale topology in Sizer and ToR configuration', { timeout: 120000 }, async t => {
    await visit(t, '/index.html?ui=handoffs', async page => {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        for (const [template, clusterType, nodes, profile] of [
            ['64-Node Disaggregated Storage Cluster', 'disaggregated', '64', 'disagg_fc'],
            ['2-Node Standard Cluster', 'standard', '2', 'hci_switched']
        ]) {
            await loadTemplate(page, template);
            const gateway = await page.locator('#infra-default-gateway').inputValue();
            const [sizer] = await Promise.all([page.waitForEvent('popup'), page.locator('#transfer-to-sizer-btn').click()]);
            await expect(sizer.locator('#designer-import-banner')).toBeVisible();
            const skip = sizer.getByRole('button', { name: 'Skip', exact: true });
            if (await skip.isVisible()) await skip.click();
            await expect(sizer.locator('#cluster-type')).toHaveValue(clusterType);
            await expect(sizer.locator('#node-count')).toHaveValue(nodes);
            await sizer.close();
            const [tor] = await Promise.all([page.waitForEvent('popup'),
                page.getByRole('button', { name: /Generate \/ Validate ToR Switch Configuration/ }).last().click()]);
            await expect(tor.locator('#sc-quick-start-mode-badge')).toHaveText('loaded from Designer');
            await expect(tor.locator('#sc-quick-start-profile')).toHaveValue(profile);
            await expect(tor.locator('#sc-infra-gateway')).toHaveValue(gateway);
            if (clusterType === 'disaggregated') await expect(tor.locator('#sc-quick-start-rack-count')).toHaveValue('4');
            await tor.close();
        }
    });
});

test('Published outbound SVG paths parse without malformed arc commands', { timeout: 60000 }, async t => {
    await visit(t, '/index.html?ui=svg-paths', async page => {
        for (const name of ['public-path-no-proxy-no-arc-gateway', 'public-path-no-proxy-with-arc-gateway',
            'public-path-proxy-no-arc-gateway', 'public-path-with-proxy-and-arc-gateway',
            'private-path-explicit-proxy-and-arc-gateway']) {
            const response = await page.request.get(server.url + '/docs/outbound-connectivity/images/' + name + '.svg');
            assert.equal(response.status(), 200, name + ': diagram asset is served');
            const result = await page.evaluate(text => {
                const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
                const paths = Array.from(svg.querySelectorAll('path[d]'));
                return { count: paths.length, invalid: paths
                    .filter(element => !CSS.supports('d', 'path("' + element.getAttribute('d') + '")'))
                    .map(element => element.getAttribute('d')) };
            }, await response.text());
            assert.ok(result.count > 0, name + ': actual SVG paths are present');
            assert.deepEqual(result.invalid, [], name + ': all path data must parse, not just form valid XML');
        }
    });
});
