const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { startTestServer, collectBrowserTests } = require('./browser-test-harness.js');

let browser;
let server;
let directory;
let fixtureIndex = 0;

before(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'odin-harness-'));
    server = await startTestServer(directory);
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
});

after(async () => {
    if (browser) await browser.close();
    if (server) await server.close();
    if (directory) await fs.rm(directory, { recursive: true, force: true });
});

async function runFixture(script, timeout = 3000) {
    const filename = 'fixture-' + fixtureIndex++ + '.html';
    await fs.writeFile(path.join(directory, filename), `<!doctype html>
        <title>Runner fixture</title>
        <span id="pass-count">1</span><span id="fail-count">0</span><span id="total-count">1</span>
        <script>
        window.__odinTestRun = {complete:false,http:'pending',errors:[]};
        window.testResults = [{name:'first',passed:true}];
        window.addEventListener('unhandledrejection', event => window.__odinTestRun.errors.push(String(event.reason)));
        function finish() { window.__odinTestRun.http='passed'; window.__odinTestRun.complete=true; }
        ${script}
        </script>`);
    const page = await browser.newPage();
    try {
        return await collectBrowserTests(page, server.url + '/' + filename, timeout);
    } finally {
        await page.close();
    }
}

test('waits for asynchronous completion, not the first passing count', async () => {
    const result = await runFixture(`setTimeout(() => {
        document.getElementById('pass-count').textContent='2';
        document.getElementById('total-count').textContent='2';
        window.testResults.push({name:'late',passed:true});
        finish();
    }, 100);`);
    assert.equal(result.total, 2);
});

test('retains failed assertions for the runner exit gate', async () => {
    const result = await runFixture(`
        document.getElementById('pass-count').textContent='0';
        document.getElementById('fail-count').textContent='1';
        window.testResults[0].passed=false; finish();`);
    assert.equal(result.failed, 1);
});

test('rejects unhandled promise rejections', async () => {
    await assert.rejects(runFixture(`
        setTimeout(finish, 50); Promise.reject(new Error('fixture rejection'));`), /fixture rejection/);
});

test('rejects uncaught browser exceptions', async () => {
    await assert.rejects(runFixture(`
        setTimeout(finish, 50); throw new Error('fixture exception');`), /fixture exception/);
});

test('times out a harness that never finishes', async () => {
    await assert.rejects(runFixture('', 500), /timeout/i);
});

test('rejects inconsistent result counts', async () => {
    await assert.rejects(runFixture(`
        document.getElementById('total-count').textContent='2'; finish();`), /inconsistent/);
});

test('rejects skipped HTTP tests in HTTP mode', async () => {
    await assert.rejects(runFixture(`
        finish(); window.__odinTestRun.http='skipped';`), /HTTP integration/);
});

test('server binds loopback, does not cache, and confines decoded paths', async () => {
    const response = await fetch(server.url + '/fixture-0.html');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:/);
    const traversal = await fetch(server.url + '/..%2foutside.html');
    assert.equal(traversal.status, 403);
    const missing = await fetch(server.url + '/missing.html');
    assert.equal(missing.status, 404);
});
