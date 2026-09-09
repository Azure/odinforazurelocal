const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const JSZip = require('../../vendor/jszip-3.10.1.min.js');

const baseUrl = 'http://localhost:5500';
const outputDir = path.resolve(__dirname, '../output/switchless-networking');

async function readDownload(page, button) {
    const pending = page.waitForEvent('download');
    await button.click();
    const download = await pending;
    return fs.readFile(await download.path());
}

async function run() {
    await fs.mkdir(outputDir, { recursive: true });
    const browser = await chromium.launch(process.env.PUPPETEER_EXECUTABLE_PATH
        ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
        : { channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    context.on('page', tab => {
        tab.on('pageerror', error => errors.push(error.message));
        tab.on('requestfailed', request => {
            if (request.url().startsWith(baseUrl) && !request.failure().errorText.includes('ERR_ABORTED')) {
                errors.push(request.url() + ': ' + request.failure().errorText);
            }
        });
        tab.on('response', response => {
            if (response.url().startsWith(baseUrl) && response.status() >= 400) {
                errors.push(response.url() + ': ' + response.status());
            }
        });
    });
    try {
        const page = await context.newPage();
        await page.goto(baseUrl + '/index.html?switchless-regression=' + Date.now());
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
        await page.reload();
        await page.getByText('Page views opt-out', { exact: true }).click();

        for (const scenario of [
            { nodes: 2, ports: 4, linkMode: 'dual_link', count: 2 },
            { nodes: 3, ports: 6, linkMode: 'dual_link', count: 6 },
            { nodes: 4, ports: 8, linkMode: 'dual_link', count: 12 }
        ]) {
            const label = scenario.nodes + '-node-' + scenario.linkMode;
            await page.getByRole('button', { name: 'Start Over', exact: true }).click();
            await page.getByRole('dialog', { name: 'Start over?' }).getByRole('button', { name: 'Start over', exact: true }).click();
            const config = {
                scenario: 'connected', architecture: 'hyperconverged', region: 'azure_commercial',
                localInstanceRegion: 'east_us', scale: 'medium',
                nodes: String(scenario.nodes), ports: String(scenario.ports), storage: 'switchless',
                storagePoolConfiguration: 'Express', intent: 'mgmt_compute', switchlessLinkMode: scenario.linkMode,
                storageAutoIp: 'disabled', customStorageSubnetsConfirmed: true,
                customStorageSubnets: Array.from({ length: scenario.count }, (_, index) => '198.51.100.' + index * 4 + '/30'),
                adapterMappingConfirmed: true, portConfigConfirmed: true, overridesConfirmed: true,
                adapterMapping: Object.fromEntries(Array.from({ length: scenario.ports }, (_, index) =>
                    [index + 1, index === 2 || index === 3 ? 'mgmt_compute' : 'storage'])),
                portConfig: Array.from({ length: scenario.ports }, (_, index) => ({
                    customName: 'Demo-NIC-' + (index + 1), speed: '25GbE', rdma: index !== 2 && index !== 3,
                    rdmaMode: index !== 2 && index !== 3 ? 'RoCEv2' : 'Disabled', rdmaManual: true
                })),
                nodeSettings: Array.from({ length: scenario.nodes }, (_, index) => ({
                    name: 'demo-node' + (index + 1), ipCidr: '192.0.2.' + (index + 10) + '/24'
                })),
                witnessType: 'Cloud', outbound: 'public', arc: 'no_arc', proxy: 'no_proxy',
                privateEndpoints: 'pe_disabled', ip: 'static', infraVlan: 'default',
                infraCidr: '192.0.2.0/24', infraGateway: '192.0.2.1', infra: { start: '192.0.2.100', end: '192.0.2.105' },
                activeDirectory: 'local_identity', localDnsZone: 'example.test', dnsServers: ['192.0.2.1'],
                securityConfiguration: 'recommended', sdnEnabled: 'no'
            };
            await page.getByRole('button', { name: /Import$/, exact: false }).click();
            const [chooser] = await Promise.all([
                page.waitForEvent('filechooser'),
                page.getByText('Import ODIN Designer Configuration', { exact: true }).click()
            ]);
            await chooser.setFiles({ name: label + '.json', mimeType: 'application/json',
                buffer: Buffer.from(JSON.stringify({ state: config })) });
            const reportButton = page.getByRole('button', { name: /Generate Cluster Design Document/ });
            await expect(reportButton).toBeEnabled();
            await expect(page.locator('.custom-storage-subnet-input')).toHaveCount(scenario.count);

            await page.getByRole('button', { name: 'Edit Storage Subnets', exact: true }).click();
            for (let index = 0; index < scenario.count; index++) {
                await page.getByLabel('Storage Subnet ' + (index + 1), { exact: true }).fill('');
            }
            await page.getByLabel('Storage Subnet 1', { exact: true }).fill('198.51.100.0/30');
            await page.getByLabel('Storage Subnet 1', { exact: true }).press('Tab');
            assert.deepEqual(await page.locator('.custom-storage-subnet-input').evaluateAll(inputs => inputs.map(input => input.value)),
                config.customStorageSubnets, label + ': CIDR-aware autofill');
            await page.getByLabel('Storage Subnet 2', { exact: true }).fill('198.51.100.0/30');
            await expect(page.getByRole('button', { name: 'Confirm Storage Subnets', exact: true })).toBeDisabled();
            await expect(reportButton).toBeDisabled();
            await expect(page.locator('#storage-subnet-error-1')).toContainText('Overlaps');
            await page.getByLabel('Storage Subnet 2', { exact: true }).fill('198.51.100.4/30');
            await page.getByRole('button', { name: 'Confirm Storage Subnets', exact: true }).click();
            await expect(reportButton).toBeEnabled();

            const storagePorts = Array.from({ length: scenario.ports }, (_, index) => index + 1).filter(port => port !== 3 && port !== 4);
            const nicOrder = [3, 4, ...storagePorts].map(port => 'Demo-NIC-' + port);
            const editOverrides = page.getByRole('button', { name: 'Edit Overrides', exact: true });
            if (await editOverrides.isVisible()) await editOverrides.click();
            await page.getByRole('button', { name: 'Confirm Overrides', exact: true }).click();
            const previewNics = await page.locator('#hci-nic-layout-diagram svg text').allTextContents();
            assert.deepEqual(previewNics.filter(text => text.startsWith('Demo-NIC-')), Array(scenario.nodes).fill(nicOrder).flat());

            const reportPromise = page.waitForEvent('popup');
            await reportButton.click();
            const report = await reportPromise;
            await report.waitForLoadState('load');
            const rows = report.locator('.summary-row').filter({ hasText: 'Storage Adapter IPs' });
            await expect(rows).toHaveCount(scenario.count);
            const expectedAddresses = config.customStorageSubnets.flatMap((_, index) =>
                ['198.51.100.' + (index * 4 + 1), '198.51.100.' + (index * 4 + 2)]);
            const reportRows = await rows.allTextContents();
            for (let index = 0; index < scenario.count; index++) {
                assert.ok(reportRows[index].includes(config.customStorageSubnets[index]));
                assert.ok(reportRows[index].includes(': ' + expectedAddresses[index * 2] + ';'));
                assert.ok(reportRows[index].endsWith(': ' + expectedAddresses[index * 2 + 1]));
            }
            const reportNics = await report.locator('svg.switchless-diagram__svg text').allTextContents();
            assert.deepEqual(reportNics.filter(text => text.startsWith('Demo-NIC-')), Array(scenario.nodes).fill(nicOrder).flat());
            const drawio = await readDownload(report, report.getByRole('button', { name: 'Download .drawio', exact: true }));
            const mesh = await report.evaluate(xml => {
                const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
                const cells = [...documentXml.querySelectorAll('mxCell')];
                return cells.filter(cell => cell.getAttribute('edge') === '1').map(edge => ({
                    label: edge.getAttribute('value'),
                    source: cells.find(cell => cell.getAttribute('id') === edge.getAttribute('source'))?.getAttribute('value'),
                    target: cells.find(cell => cell.getAttribute('id') === edge.getAttribute('target'))?.getAttribute('value')
                })).filter(edge => edge.label && edge.label.startsWith('Subnet '));
            }, drawio.toString('utf8'));
            assert.equal(mesh.length, scenario.count);
            mesh.forEach((edge, index) => {
                assert.ok(edge.label.includes(config.customStorageSubnets[index]));
                assert.ok(!/Demo-NIC-[34]\b/.test(edge.source + ' ' + edge.target));
                assert.ok(/Demo-NIC-/.test(edge.source) && /Demo-NIC-/.test(edge.target));
            });
            const svg = await readDownload(report, report.getByRole('button', { name: 'Download SVG (Light)', exact: true }).first());
            assert.ok(svg.toString('utf8').includes('Demo-NIC-3'));
            const markdown = await readDownload(report, report.getByRole('button', { name: /Download Markdown/ }));
            expectedAddresses.forEach(address => assert.ok(markdown.toString('utf8').includes(address)));

            const armPromise = page.waitForEvent('popup');
            await page.getByRole('button', { name: /Generate Cluster ARM Deployment Files/ }).click();
            const arm = await armPromise;
            await arm.waitForLoadState('load');
            const parametersText = await arm.locator('pre').first().innerText();
            const parameters = JSON.parse(parametersText).parameters;
            const networks = parameters.storageNetworkList.value;
            assert.deepEqual(networks.map(network => network.networkAdapterName), storagePorts.map(port => 'Demo-NIC-' + port));
            const armAddresses = networks.flatMap(network => network.storageAdapterIPInfo.map(info => info.ipv4Address));
            assert.deepEqual(armAddresses.sort(), [...expectedAddresses].sort());
            await arm.close();

            if (scenario.nodes === 4) {
                const pptx = await readDownload(report, report.getByRole('button', { name: /Download PowerPoint/ }));
                await fs.writeFile(path.join(outputDir, 'four-node-switchless.pptx'), pptx);
                const zip = await JSZip.loadAsync(pptx);
                const slideXml = (await Promise.all(zip.file(/^ppt\/slides\/slide\d+\.xml$/).map(file => file.async('string')))).join('\n');
                expectedAddresses.forEach(address => assert.ok(slideXml.includes(address), 'PowerPoint retains ' + address));
                await report.locator('svg.switchless-diagram__svg').screenshot({ path: path.join(outputDir, 'report-desktop.png') });
                await page.setViewportSize({ width: 375, height: 667 });
                await page.getByRole('button', { name: 'Edit Storage Subnets', exact: true }).click();
                await page.getByLabel('Storage Subnet 1', { exact: true }).focus();
                await page.keyboard.press('Tab');
                assert.equal(await page.locator(':focus').getAttribute('id'), 'storage-subnet-1');
                const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
                assert.equal(overflow, false, 'Designer phone viewport has no horizontal overflow');
                await page.locator('#custom-storage-subnets').screenshot({ path: path.join(outputDir, 'subnets-mobile.png') });
                await page.getByRole('button', { name: 'Confirm Storage Subnets', exact: true }).click();
                await page.setViewportSize({ width: 1600, height: 1000 });
                const sizerPromise = page.waitForEvent('popup');
                await page.getByRole('button', { name: /Sizer: Add Workloads to this Cluster/ }).click();
                const sizer = await sizerPromise;
                await sizer.waitForLoadState('load');
                await expect(sizer.locator('#cluster-type')).toHaveValue('standard');
                await expect(sizer.locator('#node-count')).toHaveValue('4');
                await sizer.getByRole('button', { name: 'Skip', exact: true }).click();
                await sizer.locator('button[data-workload-type="vm"]').click();
                await sizer.locator('#modal-submit-btn').click();
                await expect(sizer.locator('#node-count')).toHaveValue('4');
                await sizer.close();
                console.log('PASS: Designer-to-Sizer preserves four-node topology after adding a VM workload');
                await page.getByRole('button', { name: /^Storage Switched/ }).click();
                await expect(page.locator('#custom-storage-subnets')).toBeHidden();
                await expect(reportButton).toBeDisabled();
                await page.getByRole('button', { name: /^Storage Switchless/ }).click();
                await page.getByRole('button', { name: /^8 Ports/ }).click();
                const confirmPorts = page.getByRole('button', { name: 'Confirm Port Configuration', exact: true });
                if (await confirmPorts.isVisible()) await confirmPorts.click();
                await page.locator('#step-6 .option-card[data-value="mgmt_compute"]').click();
                await expect(page.locator('.custom-storage-subnet-input')).toHaveCount(12);
                assert.ok((await page.locator('.custom-storage-subnet-input').evaluateAll(inputs => inputs.map(input => input.value))).every(value => value === ''));
                await expect(page.getByRole('button', { name: 'Confirm Storage Subnets', exact: true })).toBeDisabled();
                console.log('PASS: switchless/switched/switchless clears stale subnet and confirmation state');
            }
            await report.close();
            console.log('PASS: ' + label + ' autofill, validation, preview, report, SVG, draw.io, Markdown, ARM');
        }
        assert.deepEqual(errors, [], 'No browser exceptions or failed same-origin resources');
    } finally {
        await browser.close();
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});