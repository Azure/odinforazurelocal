const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, 'check-npm-audit.js'), 'utf8');

function runAudit(options = {}) {
    const finding = {
        title: 'Unpatched development glob advisory',
        url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
        severity: 'high',
        ...options.finding
    };
    const vulnerability = {
        severity: finding.severity,
        isDirect: false,
        nodes: ['node_modules/picomatch'],
        via: [finding],
        ...options.vulnerability
    };
    const report = options.report || {
        vulnerabilities: { [options.packageName || 'picomatch']: vulnerability }
    };
    const output = [];
    const exit = {};
    let status = 0;
    try {
        vm.runInNewContext(source, {
            __dirname,
            Date: class extends Date {
                static now() { return Date.parse(options.now || '2026-11-18T12:00:00Z'); }
            },
            console: {
                log: message => output.push(message),
                warn: message => output.push(message),
                error: message => output.push(message)
            },
            process: {
                platform: process.platform,
                exit: code => { status = code; throw exit; }
            },
            require: name => {
                if (name === 'child_process') {
                    return { spawnSync: () => ({
                        status: options.commandStatus === undefined ? 1 : options.commandStatus,
                        stdout: options.stdout ?? JSON.stringify(report),
                        stderr: ''
                    }) };
                }
                if (name === 'fs') {
                    return { readFileSync: () => JSON.stringify({
                        packages: options.packages || { 'node_modules/picomatch': { dev: true } }
                    }) };
                }
                if (name === 'path') return path;
                throw new Error('Unexpected dependency: ' + name);
            }
        });
    } catch (error) {
        if (error !== exit) throw error;
    }
    return { status, output: output.join('\n') };
}

test('reports the explicitly accepted development advisory without claiming a clean audit', () => {
    const result = runAudit();
    assert.equal(result.status, 0);
    assert.match(result.output, /Temporarily accepted dev-only advisory/);
    assert.match(result.output, /expires 2026-12-18 00:00 UTC/);
    assert.doesNotMatch(result.output, /No high or critical npm audit advisories found/);
});

test('expires the exception at the exact UTC boundary', () => {
    assert.equal(runAudit({ now: '2026-12-17T23:59:59.999Z' }).status, 0);
    assert.equal(runAudit({ now: '2026-12-18T00:00:00Z' }).status, 1);
    assert.equal(runAudit({ now: '2026-12-19T00:00:00Z' }).status, 1);
});

test('does not exempt another advisory, another package, or critical severity', () => {
    for (const options of [
        { finding: { url: 'https://github.com/advisories/GHSA-other-advisory' } },
        { packageName: 'another-package' },
        { finding: { severity: 'critical' } }
    ]) {
        assert.equal(runAudit(options).status, 1);
    }
});

test('requires a transitive dependency and every affected lockfile entry to be development-only', () => {
    for (const options of [
        { vulnerability: { isDirect: true } },
        { vulnerability: { nodes: [] } },
        { packages: {} },
        { packages: { 'node_modules/picomatch': { dev: false } } },
        { vulnerability: { nodes: ['node_modules/picomatch', 'node_modules/other/node_modules/picomatch'] } }
    ]) {
        assert.equal(runAudit(options).status, 1);
    }
});

test('keeps other high and critical advisories blocking alongside the accepted advisory', () => {
    for (const severity of ['high', 'critical']) {
        const result = runAudit({
            vulnerability: {
                via: [
                    { title: 'Accepted advisory', url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf', severity: 'high' },
                    { title: 'Another advisory', url: 'https://github.com/advisories/GHSA-other-advisory', severity }
                ]
            }
        });
        assert.equal(result.status, 1);
        assert.match(result.output, /Blocking npm audit advisories/);
    }
});

test('accepts a successful npm command with an empty vulnerability report', () => {
    const result = runAudit({ commandStatus: 0, report: { vulnerabilities: {} } });
    assert.equal(result.status, 0);
    assert.match(result.output, /No high or critical npm audit advisories found/);
});

test('accepts reports containing only low or moderate advisories', () => {
    for (const severity of ['low', 'moderate']) {
        for (const commandStatus of [0, 1]) {
            const result = runAudit({
                commandStatus,
                finding: { severity, url: 'https://github.com/advisories/GHSA-nonblocking' }
            });
            assert.equal(result.status, 0);
            assert.match(result.output, /No high or critical npm audit advisories found/);
        }
    }
});

test('rejects malformed vulnerability records and advisory entries without claiming a clean audit', () => {
    const advisory = { title: 'An advisory', severity: 'high', url: 'https://github.com/advisories/GHSA-other-advisory' };
    for (const vulnerability of [
        null, [], 'invalid', { severity: 'high' },
        { severity: 'high', via: null }, { severity: 'high', via: [] },
        { severity: 'high', via: 'picomatch' },
        { severity: 'unknown', via: [advisory] },
        ...[null, [], 1, {}, 'missing-package',
            { ...advisory, severity: undefined }, { ...advisory, severity: 'unknown' },
            { ...advisory, title: undefined }, { ...advisory, title: ' ' },
            { ...advisory, url: undefined }, { ...advisory, url: ' ' }
        ].map(finding => ({ severity: 'high', via: [finding] }))
    ]) {
        const result = runAudit({ report: { vulnerabilities: { picomatch: vulnerability } } });
        assert.equal(result.status, 1);
        assert.match(result.output, /malformed/);
        assert.doesNotMatch(result.output, /No high or critical npm audit advisories found/);
    }
});

test('retains accepted and blocking advisories reached through valid transitive references', () => {
    for (const accepted of [true, false]) {
        const result = runAudit({
            report: {
                vulnerabilities: {
                    parent: { severity: 'high', via: ['picomatch'] },
                    picomatch: {
                        severity: 'high', isDirect: false, nodes: ['node_modules/picomatch'],
                        via: [{
                            title: 'Transitive advisory', severity: 'high',
                            url: 'https://github.com/advisories/' + (accepted ? 'GHSA-fc5q-39xc-vjpf' : 'GHSA-other-advisory')
                        }]
                    }
                }
            }
        });
        assert.equal(result.status, accepted ? 0 : 1);
        assert.match(result.output, accepted ? /explicitly accepted temporary advisory/ : /Blocking npm audit advisories/);
        assert.doesNotMatch(result.output, /No high or critical npm audit advisories found/);
    }
});

test('rejects high-severity reports without an explaining advisory, including reference cycles', () => {
    for (const report of [
        { vulnerabilities: { parent: { severity: 'high', via: [{ title: 'Low advisory', severity: 'low', url: 'https://github.com/advisories/GHSA-low-only' }] } } },
        { vulnerabilities: { a: { severity: 'high', via: ['b'] }, b: { severity: 'high', via: ['a'] } } }
    ]) {
        const result = runAudit({ report });
        assert.equal(result.status, 1);
        assert.match(result.output, /unexplained high vulnerability/);
        assert.doesNotMatch(result.output, /No high or critical npm audit advisories found/);
    }
});

test('rejects audit endpoint errors, malformed reports, and failed commands', () => {
    for (const options of [
        { report: { error: { summary: 'HTTP 429' } } },
        { report: {} },
        { report: { vulnerabilities: [] } },
        { stdout: 'not JSON' },
        { commandStatus: null },
        { commandStatus: 2 }
    ]) {
        assert.equal(runAudit(options).status, 1);
    }
});
