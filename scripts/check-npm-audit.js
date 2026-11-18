'use strict';

const { spawnSync } = require('child_process');
const { readFileSync } = require('fs');
const path = require('path');

const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm audit --json']
    : ['audit', '--json'];
const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
});

if (result.error) {
    console.error(`Unable to run npm audit: ${result.error.message}`);
    process.exit(1);
}

let audit;
try {
    audit = JSON.parse(result.stdout);
} catch (error) {
    console.error('npm audit did not return valid JSON.');
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(1);
}

if (!audit || audit.error || !audit.vulnerabilities
    || typeof audit.vulnerabilities !== 'object' || Array.isArray(audit.vulnerabilities)
    || ![0, 1].includes(result.status)) {
    console.error('npm audit did not return a valid vulnerability report.');
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(1);
}

const lockfile = JSON.parse(readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
const blockingAdvisories = [];
let acceptedAdvisories = 0;

for (const [packageName, vulnerability] of Object.entries(audit.vulnerabilities)) {
    for (const finding of vulnerability.via || []) {
        if (typeof finding === 'string' || !['high', 'critical'].includes(finding.severity)) continue;

        // No published fix; accepted only for repository-controlled lint globs until expiry.
        if (packageName === 'picomatch'
            && finding.url === 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf'
            && finding.severity === 'high'
            && vulnerability.isDirect === false
            && Array.isArray(vulnerability.nodes) && vulnerability.nodes.length > 0
            && vulnerability.nodes.every(node => lockfile.packages?.[node]?.dev === true)
            && Date.now() < Date.parse('2026-12-18T00:00:00Z')) {
            console.warn(`Temporarily accepted dev-only advisory: ${finding.url}; expires 2026-12-18 00:00 UTC. Remove this exception when a patched dependency path is available.`);
            acceptedAdvisories++;
            continue;
        }

        const advisory = {
            packageName,
            title: finding.title,
            url: finding.url
        };
        blockingAdvisories.push(advisory);
    }
}

if (blockingAdvisories.length > 0) {
    console.error('Blocking npm audit advisories:');
    for (const advisory of blockingAdvisories) {
        console.error(`- ${advisory.packageName}: ${advisory.title} (${advisory.url})`);
    }
    process.exit(1);
}

console.log(acceptedAdvisories > 0
    ? `Dependency audit passed with ${acceptedAdvisories} explicitly accepted temporary advisory; no other high or critical advisories found.`
    : 'No high or critical npm audit advisories found.');