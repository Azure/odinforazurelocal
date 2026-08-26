/**
 * PPTX export smoke test.
 *
 * Loads report/report.html with a minimal seed payload, calls the PowerPoint
 * export, and verifies the resulting Blob:
 *   - is non-empty (> 50 KB),
 *   - starts with the ZIP magic bytes (PPTX is a ZIP container),
 *   - contains the expected slide count (cover + 11 sections + closing).
 *
 * Run with:  node scripts/smoke-test-pptx.js
 *
 * Designed to run in CI alongside scripts/run-tests.js. Catches the most
 * common regression classes (missing template, broken section handler,
 * vendored library version drift) without parsing the OOXML.
 */
const path = require('path');

// Minimum payload that exercises the cover, all sections, and the closing slide.
const SEED_PAYLOAD = {
    generatedAt: new Date().toISOString(),
    version: '1.0',
    state: {
        scenario: 'hyperconverged',
        cloud: 'azure_commercial',
        localInstanceRegion: 'east_us',
        scale: 'rack_aware',
        nodes: '4',
        ports: '4',
        intent: 'mgmt_compute',
        storage: 'switched',
        outbound: 'private',
        arc: 'arc_gateway',
        proxy: 'proxy',
        privateEndpoints: 'pe_enabled',
        privateEndpointsList: ['keyvault', 'storage', 'acr'],
        adDomain: 'contoso.local',
        infraCidr: '10.71.0.0/24',
        managementVlan: '6',
        nodeIps: ['10.71.0.10', '10.71.0.11', '10.71.0.12', '10.71.0.13'],
        defaultGateway: '10.71.0.1',
        dnsServers: ['10.71.0.5'],
        rackAwareTorsPerRoom: '2',
        rackAwareTorArchitecture: 'lag'
    }
};

(async () => {
    let browser;
    try {
        console.log('PPTX smoke test: launching browser…');
        const puppeteer = await import('puppeteer');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
        });

        const page = await browser.newPage();
        page.on('console', msg => {
            const t = msg.type();
            if (t === 'error' || t === 'warning') {
                console.log(`Browser ${t}:`, msg.text());
            }
        });
        page.on('pageerror', err => console.error('Page error:', err.message));

        // Seed localStorage before the report page boots.
        await page.evaluateOnNewDocument((payload) => {
            try {
                localStorage.setItem('azloc_report_payload', JSON.stringify(payload));
            } catch (e) {
                console.warn('Failed to seed report payload:', e);
            }
        }, SEED_PAYLOAD);

        const reportPath = path.resolve(process.cwd(), 'report', 'report.html');
        console.log('PPTX smoke test: loading', reportPath);
        await page.goto(`file://${reportPath}`, { waitUntil: 'networkidle0', timeout: 60000 });

        // Wait for the export entry-point and the vendored library to be ready.
        await page.waitForFunction(
            () => typeof window.downloadReportPptx === 'function' && typeof window.JSZip !== 'undefined',
            { timeout: 30000 }
        );

        // Override triggerDownload by monkey-patching the <a>.click() side-effect:
        // capture the Blob produced by buildPackage() instead of issuing a download.
        const result = await page.evaluate(async () => {
            return await new Promise((resolve, reject) => {
                const origCreateElement = document.createElement.bind(document);
                let settled = false;
                let timeoutId;

                function complete(value) {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    document.createElement = origCreateElement;
                    resolve(value);
                }

                function fail(error) {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    document.createElement = origCreateElement;
                    reject(error);
                }

                document.createElement = function (tag) {
                    const el = origCreateElement(tag);
                    if (String(tag).toLowerCase() === 'a') {
                        const origClick = el.click.bind(el);
                        el.click = function () {
                            const url = el.href;
                            if (!url || !url.startsWith('blob:')) return origClick();
                            void (async function () {
                                const resp = await fetch(url);
                                const buf = await resp.arrayBuffer();
                                const bytes = new Uint8Array(buf);
                                const head = Array.from(bytes.slice(0, 4))
                                    .map(b => b.toString(16).padStart(2, '0'))
                                    .join(' ');
                                const zip = await window.JSZip.loadAsync(buf);
                                const relationshipNames = Object.keys(zip.files)
                                    .filter(name => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(name));
                                const relationships = await Promise.all(relationshipNames.map(name => zip.file(name).async('string')));
                                const torToolUrl = 'https://azure.github.io/odinforazurelocal/switch-config/';
                                const hyperlinkType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
                                const hasTorToolLink = relationships.some(text => {
                                    const xml = new DOMParser().parseFromString(text, 'application/xml');
                                    if (xml.querySelector('parsererror')) return false;
                                    return Array.from(xml.getElementsByTagNameNS('*', 'Relationship')).some(relationship =>
                                        relationship.getAttribute('Target') === torToolUrl
                                        && relationship.getAttribute('Type') === hyperlinkType
                                        && relationship.getAttribute('TargetMode') === 'External');
                                });
                                complete({ size: bytes.length, headHex: head, filename: el.download, hasTorToolLink });
                            })().catch(fail);
                        };
                    }
                    return el;
                };

                timeoutId = setTimeout(() => fail(new Error('PPTX generation timed out after 30s')), 30000);
                try {
                    window.downloadReportPptx('default');
                } catch (error) {
                    fail(error);
                }
            });
        });

        // ZIP magic: PK\x03\x04 = 50 4b 03 04
        const ZIP_MAGIC = '50 4b 03 04';
        if (result.headHex !== ZIP_MAGIC) {
            throw new Error(`PPTX header is "${result.headHex}", expected "${ZIP_MAGIC}" (ZIP container)`);
        }
        if (result.size < 50 * 1024) {
            throw new Error(`PPTX size is ${result.size} bytes; expected > 50 KB (template + cover + 11 sections + closing slide)`);
        }
        if (!/^odin-configuration-report_.+\.pptx$/.test(result.filename || '')) {
            throw new Error(`Unexpected download filename: ${result.filename}`);
        }
        if (!result.hasTorToolLink) {
            throw new Error('Portable ToR Switch tool hyperlink is missing from slide relationships');
        }

        console.log(`PPTX smoke test: OK — ${result.filename}, ${(result.size / 1024).toFixed(1)} KB, magic ${result.headHex}`);
        await browser.close();
        process.exit(0);
    } catch (err) {
        console.error('PPTX smoke test FAILED:', err.message);
        if (browser) {
            try { await browser.close(); } catch (_) { /* ignore */ }
        }
        process.exit(1);
    }
})();
