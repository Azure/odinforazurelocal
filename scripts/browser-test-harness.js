const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

async function startTestServer(root) {
    const base = await fs.realpath(root);
    const types = {
        '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
        '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
        '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
    };
    const server = http.createServer(async (request, response) => {
        try {
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                response.writeHead(405).end();
                return;
            }
            const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            const relativePath = pathname.split('/').join(path.sep);
            let filename = path.resolve(base, '.' + relativePath);
            if (pathname.endsWith('/')) filename = path.join(filename, 'index.html');
            const withinRoot = candidate => {
                const relative = path.relative(base, candidate);
                return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
            };
            if (!withinRoot(filename)) {
                response.writeHead(403).end();
                return;
            }
            filename = await fs.realpath(filename);
            if (!withinRoot(filename)) {
                response.writeHead(403).end();
                return;
            }
            const content = await fs.readFile(filename);
            response.writeHead(200, {
                'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
                'Cache-Control': 'no-store'
            });
            response.end(request.method === 'HEAD' ? undefined : content);
        } catch (error) {
            const status = error instanceof URIError ? 400
                : ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code) ? 404 : 500;
            if (status === 500) console.error('Test server failure:', error);
            response.writeHead(status).end();
        }
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    return {
        url: 'http://127.0.0.1:' + server.address().port,
        close: () => new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
            server.closeAllConnections();
        })
    };
}

async function collectBrowserTests(page, url, timeout = 60000) {
    const errors = [];
    const onError = error => errors.push(error.message);
    page.on('pageerror', onError);
    try {
        await page.goto(url, { waitUntil: 'load', timeout });
        await page.waitForFunction(() => window.__odinTestRun &&
            (window.__odinTestRun.complete || window.__odinTestRun.errors.length > 0), { timeout });
        const result = await page.evaluate(() => ({
            passed: Number(document.getElementById('pass-count').textContent),
            failed: Number(document.getElementById('fail-count').textContent),
            total: Number(document.getElementById('total-count').textContent),
            details: window.testResults,
            completion: window.__odinTestRun
        }));
        errors.push(...result.completion.errors);
        if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
        if (!result.completion.complete) throw new Error('Browser tests did not complete');
        if (url.startsWith('http:') && result.completion.http !== 'passed') {
            throw new Error('HTTP integration tests did not complete successfully');
        }
        if (![result.total, result.passed, result.failed].every(Number.isInteger) ||
            result.total <= 0 || result.passed < 0 || result.failed < 0 ||
            result.total !== result.passed + result.failed ||
            !Array.isArray(result.details) || result.details.length !== result.total ||
            result.details.some(test => !test || typeof test.passed !== 'boolean') ||
            result.details.filter(test => test.passed === true).length !== result.passed) {
            throw new Error('Incomplete or inconsistent browser test results');
        }
        return result;
    } catch (error) {
        if (errors.length && !error.message.startsWith('Browser errors:')) {
            throw new Error('Browser errors: ' + errors.join('; '), { cause: error });
        }
        throw error;
    } finally {
        page.off('pageerror', onError);
    }
}

module.exports = { startTestServer, collectBrowserTests };
