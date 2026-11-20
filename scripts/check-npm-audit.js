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
const severities = ['info', 'low', 'moderate', 'high', 'critical'];

function isObjectRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

for (const [packageName, vulnerability] of Object.entries(audit.vulnerabilities)) {
    if (!isObjectRecord(vulnerability) || !severities.includes(vulnerability.severity)
        || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
        console.error(`npm audit returned a malformed vulnerability entry for package "${packageName}".`);
        process.exit(1);
    }

    for (const finding of vulnerability.via) {
        if (typeof finding === 'string') {
            if (!Object.hasOwn(audit.vulnerabilities, finding)) {
                console.error(`npm audit returned a malformed advisory reference for package "${packageName}".`);
                process.exit(1);
            }
        } else if (!isObjectRecord(finding) || !severities.includes(finding.severity)
            || typeof finding.title !== 'string' || !finding.title.trim()
            || typeof finding.url !== 'string' || !finding.url.trim()) {
            console.error(`npm audit returned a malformed advisory entry for package "${packageName}".`);
            process.exit(1);
        }
    }
}

for (const [packageName, vulnerability] of Object.entries(audit.vulnerabilities)) {
    if (['high', 'critical'].includes(vulnerability.severity)) {
        const pending = [packageName];
        const visited = new Set();
        let explained = false;
        while (pending.length > 0 && !explained) {
            const name = pending.pop();
            if (visited.has(name)) continue;
            visited.add(name);
            for (const finding of audit.vulnerabilities[name].via) {
                if (typeof finding === 'string') pending.push(finding);
                else if (severities.indexOf(finding.severity) >= severities.indexOf(vulnerability.severity)) {
                    explained = true;
                    break;
                }
            }
        }
        if (!explained) {
            console.error(`npm audit returned an unexplained ${vulnerability.severity} vulnerability for package "${packageName}".`);
            process.exit(1);
        }
    }

    for (const finding of vulnerability.via) {
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