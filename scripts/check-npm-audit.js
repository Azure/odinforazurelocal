'use strict';

const { spawnSync } = require('child_process');

// Temporary dev-only exceptions where the configured npm feed has no patched
// release. Keep these package-scoped and remove them when fixes are available.
const allowedAdvisories = new Map([
    ['https://github.com/advisories/GHSA-mh99-v99m-4gvg', new Set(['brace-expansion'])],
    ['https://github.com/advisories/GHSA-rgw5-rvv9-x895', new Set(['brace-expansion'])],
    ['https://github.com/advisories/GHSA-7p8r-x3mc-p8w7', new Set(['fast-uri'])]
]);
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

const blockingAdvisories = [];
const allowedFindings = [];

for (const [packageName, vulnerability] of Object.entries(audit.vulnerabilities || {})) {
    for (const finding of vulnerability.via || []) {
        if (typeof finding === 'string' || !['high', 'critical'].includes(finding.severity)) continue;

        const advisory = {
            packageName,
            title: finding.title,
            url: finding.url
        };
        const allowedPackages = allowedAdvisories.get(finding.url);
        if (allowedPackages && allowedPackages.has(packageName)) {
            allowedFindings.push(advisory);
        } else {
            blockingAdvisories.push(advisory);
        }
    }
}

if (blockingAdvisories.length > 0) {
    console.error('Blocking npm audit advisories:');
    for (const advisory of blockingAdvisories) {
        console.error(`- ${advisory.packageName}: ${advisory.title} (${advisory.url})`);
    }
    process.exit(1);
}

for (const finding of allowedFindings) {
    console.warn(`Temporarily allowed: ${finding.packageName}: ${finding.title} (${finding.url})`);
}

console.log('No unapproved high or critical npm audit advisories found.');