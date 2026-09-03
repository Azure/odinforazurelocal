/**
 * Run ODIN unit tests using Puppeteer and generate NUnit XML report
 * Usage: node scripts/run-tests.js [--nunit | --junit]
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const hasJunitFlag = process.argv.includes('--junit');
const hasNunitFlag = process.argv.includes('--nunit');
const releaseHistoryOnly = process.argv.includes('--check-release-history');
// When neither flag is passed, both reports are written by default. When a flag
// is passed, only that format is written.
const writeNunit = hasNunitFlag || (!hasJunitFlag && !hasNunitFlag);
const writeJunit = hasJunitFlag || (!hasJunitFlag && !hasNunitFlag);

// ---------------------------------------------------------------------------
// Release-history guard.
// The root README is the concise current-product guide: it must contain only
// the latest release's What's New summary. Exact historical release summaries
// live in docs/version-history/README.md, while CHANGELOG.md remains the full
// canonical change record (including early patch releases that the history
// document intentionally rolls up into series-level summaries).
// ---------------------------------------------------------------------------
function validateReleaseHistory(currentVersion, readme, history, changelog) {
    const readmeReleaseHeadings = [...readme.matchAll(/^#{3,6}\s+.*?\b(\d+\.\d+\.\d+)\b.*$/gm)]
        .map(match => match[1]);
    const historyReleaseHeadings = [...history.matchAll(/^####\s+(\d+\.\d+\.\d+)\b.*$/gm)]
        .map(match => match[1]);
    const changelogVersions = [...changelog.matchAll(/^##\s+\[(\d+\.\d+\.\d+)\]/gm)]
        .map(match => match[1]);
    const duplicateHistoryVersions = [...new Set(historyReleaseHeadings.filter((version, index, versions) => versions.indexOf(version) !== index))];
    const previousVersion = changelogVersions.find(version => version !== currentVersion);
    const errors = [];

    if (readmeReleaseHeadings.length !== 1 || readmeReleaseHeadings[0] !== currentVersion) {
        errors.push(`README.md must contain exactly one release-summary heading for ${currentVersion}; found ${readmeReleaseHeadings.length ? readmeReleaseHeadings.join(', ') : '(none)'}`);
    }
    if (historyReleaseHeadings.includes(currentVersion)) {
        errors.push(`current release ${currentVersion} must remain only in README.md until the next release`);
    }
    if (!previousVersion || !historyReleaseHeadings.includes(previousVersion)) {
        errors.push(`previous release ${previousVersion || '(not found)'} must be archived in docs/version-history/README.md`);
    }
    if (duplicateHistoryVersions.length > 0) {
        errors.push(`duplicate exact-version headings in history: ${duplicateHistoryVersions.join(', ')}`);
    }
    if (!readme.includes('(docs/version-history/README.md)')) {
        errors.push('README.md does not link to docs/version-history/README.md');
    }

    return { errors, previousVersion };
}

function testReleaseHistoryGuard() {
    const valid = {
        currentVersion: '1.2.0',
        readme: '## What\'s New\n\n### Version 1.2.0 - Latest Release\n\n[Version History](docs/version-history/README.md)\n',
        history: '# Version History\n\n#### 1.1.0 - Previous release\n',
        changelog: '# Changelog\n\n## [1.2.0] - 2026-08-06\n\n## [1.1.0] - 2026-07-01\n'
    };
    const cases = [
        { name: 'valid rollover', data: valid, expectedError: null },
        { name: 'older release left in README', data: { ...valid, readme: valid.readme + '\n#### 1.1.0 - Old release\n' }, expectedError: 'exactly one release-summary heading' },
        { name: 'current release archived too early', data: { ...valid, history: valid.history + '\n#### 1.2.0 - Current release\n' }, expectedError: 'must remain only in README.md' },
        { name: 'previous release not archived', data: { ...valid, history: '# Version History\n' }, expectedError: 'previous release 1.1.0 must be archived' },
        { name: 'duplicate historical release', data: { ...valid, history: valid.history + '\n#### 1.1.0 - Duplicate\n' }, expectedError: 'duplicate exact-version headings' },
        { name: 'history link missing', data: { ...valid, readme: valid.readme.replace('(docs/version-history/README.md)', '(CHANGELOG.md)') }, expectedError: 'does not link to docs/version-history/README.md' }
    ];
    const failures = cases.filter(testCase => {
        const result = validateReleaseHistory(testCase.data.currentVersion, testCase.data.readme, testCase.data.history, testCase.data.changelog);
        return testCase.expectedError === null
            ? result.errors.length !== 0
            : !result.errors.some(error => error.includes(testCase.expectedError));
    });
    failures.forEach(testCase => console.error(`❌ Release-history guard self-test failed: ${testCase.name}`));
    if (failures.length === 0) console.log(`✅ Release-history guard self-tests OK: ${cases.length}/${cases.length}`);
    return failures.length === 0;
}

function checkReleaseHistory() {
    const versionSource = fs.readFileSync(path.resolve(process.cwd(), 'js', 'version.js'), 'utf8');
    const readme = fs.readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf8');
    const history = fs.readFileSync(path.resolve(process.cwd(), 'docs', 'version-history', 'README.md'), 'utf8');
    const changelog = fs.readFileSync(path.resolve(process.cwd(), 'CHANGELOG.md'), 'utf8');
    const versionMatch = versionSource.match(/ODIN_VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/);
    if (!versionMatch) {
        console.error('❌ Release history: could not read ODIN_VERSION from js/version.js');
        return false;
    }
    const currentVersion = versionMatch[1];
    const result = validateReleaseHistory(currentVersion, readme, history, changelog);
    result.errors.forEach(error => console.error(`❌ Release history: ${error}`));
    if (result.errors.length === 0) {
        console.log(`✅ Release history OK: README has only ${currentVersion}; previous release ${result.previousVersion} is archived`);
    }
    return result.errors.length === 0;
}

function validateRepositoryMap(documentation, actualEntries) {
    const block = documentation.match(/<!-- repository-map:start -->([\s\S]*?)<!-- repository-map:end -->/);
    if (!block) return ['repository-map markers are missing'];
    const mappedEntries = [...block[1].matchAll(/^- `([^`]+)`/gm)].map(match => match[1].replace(/\/$/, ''));
    const duplicateEntries = [...new Set(mappedEntries.filter((entry, index, entries) => entries.indexOf(entry) !== index))];
    const missingEntries = actualEntries.filter(entry => !mappedEntries.includes(entry));
    const staleEntries = mappedEntries.filter(entry => !actualEntries.includes(entry));
    const errors = [];
    if (duplicateEntries.length > 0) errors.push(`duplicate repository-map entries: ${duplicateEntries.join(', ')}`);
    if (missingEntries.length > 0) errors.push(`top-level entries missing from repository map: ${missingEntries.join(', ')}`);
    if (staleEntries.length > 0) errors.push(`repository-map entries not found on disk: ${staleEntries.join(', ')}`);
    return errors;
}

function testRepositoryMapGuard() {
    const valid = '<!-- repository-map:start -->\n- `alpha/` - area\n- `README.md` - guide\n<!-- repository-map:end -->';
    const cases = [
        { name: 'valid map', documentation: valid, entries: ['alpha', 'README.md'], expectedError: null },
        { name: 'missing entry', documentation: valid, entries: ['alpha', 'beta', 'README.md'], expectedError: 'missing from repository map' },
        { name: 'stale entry', documentation: valid, entries: ['alpha'], expectedError: 'not found on disk' },
        { name: 'missing markers', documentation: '- `alpha/`', entries: ['alpha'], expectedError: 'markers are missing' }
    ];
    const failures = cases.filter(testCase => {
        const errors = validateRepositoryMap(testCase.documentation, testCase.entries);
        return testCase.expectedError === null
            ? errors.length !== 0
            : !errors.some(error => error.includes(testCase.expectedError));
    });
    failures.forEach(testCase => console.error(`❌ Repository-map guard self-test failed: ${testCase.name}`));
    if (failures.length === 0) console.log(`✅ Repository-map guard self-tests OK: ${cases.length}/${cases.length}`);
    return failures.length === 0;
}

function checkRepositoryMap() {
    const documentation = fs.readFileSync(path.resolve(process.cwd(), 'CONTRIBUTING.md'), 'utf8');
    const ignoredEntries = new Set(['.git', '.vscode', 'node_modules', 'test-results']);
    const actualEntries = fs.readdirSync(process.cwd(), { withFileTypes: true })
        .map(entry => entry.name)
        .filter(entry => !ignoredEntries.has(entry))
        .sort();
    const errors = validateRepositoryMap(documentation, actualEntries);
    errors.forEach(error => console.error(`❌ Repository map: ${error}`));
    if (errors.length === 0) console.log(`✅ Repository map OK: ${actualEntries.length} top-level entries documented`);
    return errors.length === 0;
}

// ---------------------------------------------------------------------------
// Vendored-blob integrity pins (inventory import parsers).
// The browser test harness runs over file://, which is not a secure context,
// so window.crypto.subtle is unavailable there. The SHA-256 pin for large
// vendored binaries is therefore enforced here, Node-side, as a fail-fast gate
// before the browser tests run. Catches accidental corruption or a tampered /
// swapped vendored blob. To upgrade a parser, update vendor/README.md and the
// expected hash below in the same commit. Hashes are lower-case hex.
// ---------------------------------------------------------------------------
const VENDOR_INTEGRITY_PINS = [
    {
        file: path.join('vendor', 'xlsx-0.20.3.min.js'),
        sha256: 'cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41',
        label: 'SheetJS Community 0.20.3 (RVTools import)'
    },
    {
        file: path.join('vendor', 'jszip-3.10.1.min.js'),
        sha256: 'acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e',
        label: 'JSZip 3.10.1 (Azure Migrate import)'
    },
    {
        file: path.join('report', 'vendor', 'pptxgen.bundle.js'),
        sha256: 'cd078ca9e91c6f9e061ee0a3c310d6ff157c3a71b1dea7f40fd53818017266ff',
        label: 'PptxGenJS 3.12.0 (PowerPoint export)'
    }
];

function checkVendorIntegrity() {
    let allOk = true;
    VENDOR_INTEGRITY_PINS.forEach(pin => {
        const absPath = path.resolve(process.cwd(), pin.file);
        if (!fs.existsSync(absPath)) {
            console.error(`❌ Vendored file missing: ${pin.file} (${pin.label})`);
            allOk = false;
            return;
        }
        const canonicalBytes = Buffer.from(fs.readFileSync(absPath, 'utf8').replace(/\r\n/g, '\n'), 'utf8');
        const actual = crypto.createHash('sha256').update(canonicalBytes).digest('hex');
        if (actual !== pin.sha256) {
            console.error(`❌ SHA-256 mismatch for ${pin.file} (${pin.label})`);
            console.error(`     Expected: ${pin.sha256}`);
            console.error(`     Actual:   ${actual}`);
            allOk = false;
        } else {
            console.log(`✅ Vendor integrity OK: ${pin.file} (${pin.label})`);
        }
    });
    return allOk;
}

// ---------------------------------------------------------------------------
// Schema drift guard (issue #237 — JSON Schemas for Designer + Sizer).
// The two published JSON Schemas in docs/json-schema/ must stay in lock-step
// with the in-app state objects they describe:
//   - getInitialWizardState() in js/script.js  ↔  odin-design.schema.json
//     (properties.state.properties.*)
//   - getSizerState()        in sizer/sizer.js  ↔  odin-sizer.schema.json
//     (definitions.sizerState.properties.*)
// This gate compares the TOP-LEVEL keys of each state object against the
// schema's documented property set in BOTH directions. The moment a state
// field is added, renamed, or removed without updating the matching schema
// (or vice-versa), this check fails — forcing the schema to be revved in the
// same PR. It guards STRUCTURE drift (key parity), not value-level enum
// exhaustiveness, and does not assert envelope versions against the app
// version. Runs Node-side, fail-fast, before the browser tests (the harness
// runs over file:// where the schema JSON cannot be fetched).
// ---------------------------------------------------------------------------

// Extract the top-level keys of the object literal returned by `function fnName`.
// Brace/bracket/string/comment aware so nested objects, arrays, and inline
// comments don't pollute the key set. Only bare-identifier keys are captured
// (neither state object uses quoted top-level keys); a quoted key would be
// missed and surface as a (loud, fail-safe) drift mismatch rather than silently
// passing.
function extractTopLevelObjectKeys(src, fnName) {
    const fnIdx = src.indexOf('function ' + fnName);
    if (fnIdx === -1) throw new Error(`Could not find function ${fnName} in source`);
    const retIdx = src.indexOf('return {', fnIdx);
    if (retIdx === -1) throw new Error(`Could not find 'return {' for ${fnName}`);
    return walkTopLevelObjectKeys(src, src.indexOf('{', retIdx));
}

// Same idea, but for `const <varName> = { ... }` / `let` / `var` top-level
// object literals. Used for source-of-truth maps like WORKLOAD_DEFAULTS that
// aren't wrapped in a function.
function extractTopLevelObjectKeysFromConst(src, varName) {
    const re = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*\\{`);
    const m = re.exec(src);
    if (!m) throw new Error(`Could not find 'const ${varName} = {' in source`);
    return walkTopLevelObjectKeys(src, m.index + m[0].length - 1);
}

// Walk an object literal starting at the index of its opening '{' and return
// the bare-identifier keys at depth 1. Shared by both extractors above.
function walkTopLevelObjectKeys(src, startBraceIdx) {
    const keys = [];
    let depth = 0;
    let inString = false, stringChar = '';
    let inLineComment = false, inBlockComment = false;
    let expectKey = false;

    for (let i = startBraceIdx; i < src.length; i++) {
        const c = src[i];
        const next = src[i + 1];

        if (inLineComment) { if (c === '\n') inLineComment = false; continue; }
        if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; i++; } continue; }
        if (inString) {
            if (c === '\\') { i++; continue; }      // skip escaped char
            if (c === stringChar) inString = false;
            continue;
        }

        if (c === '/' && next === '/') { inLineComment = true; i++; continue; }
        if (c === '/' && next === '*') { inBlockComment = true; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inString = true; stringChar = c; continue; }

        if (c === '{' || c === '[') {
            depth++;
            if (c === '{' && depth === 1) expectKey = true;   // entered the top-level object
            continue;
        }
        if (c === '}' || c === ']') {
            depth--;
            if (depth === 0) break;                            // closed the top-level object
            continue;
        }

        if (depth === 1) {
            if (c === ',') { expectKey = true; continue; }
            if (expectKey && !/\s/.test(c)) {
                let key = '', j = i;
                while (j < src.length && /[\w$]/.test(src[j])) { key += src[j]; j++; }
                while (j < src.length && /\s/.test(src[j])) j++;
                if (src[j] === ':' && key) {
                    keys.push(key);
                    i = j;                                     // resume after the colon
                }
                expectKey = false;
                continue;
            }
        }
    }
    return keys;
}

// Walk an object literal (depth-1 of `parentOpenBraceIdx`) and, on finding
// `targetKey:`, return the index of the next '{' that opens the value's own
// object literal (skipping strings/comments and tolerating ternary value
// forms like `power: cond ? { ... } : null`). Returns -1 if the key isn't
// found at the top level, or if its value isn't an object literal.
function findNestedObjectStart(src, parentOpenBraceIdx, targetKey) {
    let depth = 0;
    let inString = false, stringChar = '';
    let inLineComment = false, inBlockComment = false;
    let expectKey = false;

    for (let i = parentOpenBraceIdx; i < src.length; i++) {
        const c = src[i];
        const next = src[i + 1];

        if (inLineComment) { if (c === '\n') inLineComment = false; continue; }
        if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; i++; } continue; }
        if (inString) {
            if (c === '\\') { i++; continue; }
            if (c === stringChar) inString = false;
            continue;
        }

        if (c === '/' && next === '/') { inLineComment = true; i++; continue; }
        if (c === '/' && next === '*') { inBlockComment = true; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inString = true; stringChar = c; continue; }

        if (c === '{' || c === '[') {
            depth++;
            if (c === '{' && depth === 1) expectKey = true;
            continue;
        }
        if (c === '}' || c === ']') {
            depth--;
            if (depth === 0) return -1;
            continue;
        }

        if (depth === 1) {
            if (c === ',') { expectKey = true; continue; }
            if (expectKey && !/\s/.test(c)) {
                let key = '', j = i;
                while (j < src.length && /[\w$]/.test(src[j])) { key += src[j]; j++; }
                while (j < src.length && /\s/.test(src[j])) j++;
                if (src[j] === ':' && key) {
                    if (key === targetKey) {
                        // Found. Scan forward past the colon to the value's
                        // opening '{', skipping strings/comments. Bail if we
                        // hit a sibling/closing token before any '{'.
                        let k = j + 1;
                        let s = false, sc = '', lc = false, bc = false;
                        while (k < src.length) {
                            const cc = src[k];
                            const nn = src[k + 1];
                            if (lc) { if (cc === '\n') lc = false; k++; continue; }
                            if (bc) { if (cc === '*' && nn === '/') { bc = false; k += 2; continue; } k++; continue; }
                            if (s) {
                                if (cc === '\\') { k += 2; continue; }
                                if (cc === sc) s = false;
                                k++; continue;
                            }
                            if (cc === '/' && nn === '/') { lc = true; k += 2; continue; }
                            if (cc === '/' && nn === '*') { bc = true; k += 2; continue; }
                            if (cc === '"' || cc === "'" || cc === '`') { s = true; sc = cc; k++; continue; }
                            if (cc === '{') return k;
                            if (cc === ',' || cc === ';' || cc === '}' || cc === ']') return -1;
                            k++;
                        }
                        return -1;
                    }
                    i = j;
                }
                expectKey = false;
                continue;
            }
        }
    }
    return -1;
}

// Like extractTopLevelObjectKeysFromConst, but follows a chain of nested keys
// (e.g. ['sizerHardware', 'power']) into the literal and returns the keys of
// the innermost object. Used by the deep schema-drift check.
function extractNestedObjectKeysFromConst(src, varName, keyPath) {
    const re = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*\\{`);
    const m = re.exec(src);
    if (!m) throw new Error(`Could not find 'const ${varName} = {' in source`);
    let cursor = m.index + m[0].length - 1;  // index of the outer opening '{'
    for (const k of keyPath) {
        cursor = findNestedObjectStart(src, cursor, k);
        if (cursor === -1) throw new Error(`Could not navigate to '${keyPath.join('.')}' (failed at '${k}') in ${varName}`);
    }
    return walkTopLevelObjectKeys(src, cursor);
}

function checkSchemaDrift() {
    const cases = [
        {
            label: 'Designer (getInitialWizardState ↔ odin-design.schema.json)',
            sourceFile: path.join('js', 'script.js'),
            fnName: 'getInitialWizardState',
            schemaFile: path.join('docs', 'json-schema', 'odin-design.schema.json'),
            schemaProps: schema => schema.properties.state.properties
        },
        {
            label: 'Sizer (getSizerState ↔ odin-sizer.schema.json)',
            sourceFile: path.join('sizer', 'sizer.js'),
            fnName: 'getSizerState',
            schemaFile: path.join('docs', 'json-schema', 'odin-sizer.schema.json'),
            schemaProps: schema => schema.definitions.sizerState.properties
        }
    ];

    let allOk = true;

    cases.forEach(c => {
        try {
            const src = fs.readFileSync(path.resolve(process.cwd(), c.sourceFile), 'utf8');
            const stateKeys = extractTopLevelObjectKeys(src, c.fnName);

            const schema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), c.schemaFile), 'utf8'));
            const props = c.schemaProps(schema);
            if (!props || typeof props !== 'object') {
                throw new Error(`Schema property map not found in ${c.schemaFile}`);
            }
            const schemaKeys = Object.keys(props);

            const stateSet = new Set(stateKeys);
            const schemaSet = new Set(schemaKeys);

            // Direction 1: every state field must be documented in the schema.
            const missingFromSchema = stateKeys.filter(k => !schemaSet.has(k));
            // Direction 2: every schema property must still exist in the state.
            const missingFromState = schemaKeys.filter(k => !stateSet.has(k));

            if (missingFromSchema.length === 0 && missingFromState.length === 0) {
                console.log(`✅ Schema drift OK: ${c.label} (${stateKeys.length} fields in sync)`);
            } else {
                allOk = false;
                console.error(`❌ Schema drift detected: ${c.label}`);
                if (missingFromSchema.length) {
                    console.error(`     State fields missing from schema (add them to ${c.schemaFile}):`);
                    missingFromSchema.forEach(k => console.error(`       + ${k}`));
                }
                if (missingFromState.length) {
                    console.error(`     Schema properties no longer in state (remove from schema or restore in ${c.sourceFile}):`);
                    missingFromState.forEach(k => console.error(`       - ${k}`));
                }
            }
        } catch (err) {
            allOk = false;
            console.error(`❌ Schema drift check failed for ${c.label}: ${err.message}`);
        }
    });

    // Workload-type enum drift: the set of workload types the Sizer can
    // produce (keys of WORKLOAD_DEFAULTS in sizer/sizer.js) must equal the
    // `type` enum in the Sizer schema's workload definition. This is what
    // would have caught GHEL (v0.22.62) being added without the schema being
    // updated.
    try {
        const sizerSrc = fs.readFileSync(path.resolve(process.cwd(), 'sizer', 'sizer.js'), 'utf8');
        const workloadTypes = extractTopLevelObjectKeysFromConst(sizerSrc, 'WORKLOAD_DEFAULTS');

        const sizerSchemaPath = path.join('docs', 'json-schema', 'odin-sizer.schema.json');
        const sizerSchema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), sizerSchemaPath), 'utf8'));
        const enumTypes = sizerSchema.definitions.workload.properties.type.enum;
        if (!Array.isArray(enumTypes)) {
            throw new Error(`workload.properties.type.enum missing or not an array in ${sizerSchemaPath}`);
        }

        const inDefaults = new Set(workloadTypes);
        const inEnum = new Set(enumTypes);
        const missingFromEnum = workloadTypes.filter(t => !inEnum.has(t));
        const missingFromDefaults = enumTypes.filter(t => !inDefaults.has(t));

        if (missingFromEnum.length === 0 && missingFromDefaults.length === 0) {
            console.log(`✅ Schema drift OK: Sizer workload types (WORKLOAD_DEFAULTS ↔ odin-sizer.schema.json type enum) (${workloadTypes.length} types in sync)`);
        } else {
            allOk = false;
            console.error('❌ Schema drift detected: Sizer workload types');
            if (missingFromEnum.length) {
                console.error(`     Workload types missing from schema enum (add to definitions.workload.properties.type.enum AND add a oneOf branch in ${sizerSchemaPath}):`);
                missingFromEnum.forEach(t => console.error(`       + ${t}`));
            }
            if (missingFromDefaults.length) {
                console.error(`     Schema enum values no longer in WORKLOAD_DEFAULTS (remove from enum + oneOf in ${sizerSchemaPath} or restore in sizer/sizer.js):`);
                missingFromDefaults.forEach(t => console.error(`       - ${t}`));
            }
        }
    } catch (err) {
        allOk = false;
        console.error(`❌ Sizer workload type drift check failed: ${err.message}`);
    }

    // Deep (nested) sub-object drift. Walks into named sub-objects of the
    // Sizer→Designer payload (built inside selectRegionAndConfigure() as
    // `const sizerPayload = { ... }`) and compares depth-1 keys of the
    // nested literal against a matching schema property map. Catches the
    // class of bug where someone adds a new field to e.g. sizerHardware.power
    // and forgets to add it to the schema — or removes one without cleanup.
    // Today this guards `sizerHardware.power` only (the sub-object that
    // motivated this check); add another entry to extend coverage to other
    // sub-objects like sizerHardware.cpu / .memory / .gpu / .storage / etc.
    // when those start carrying fields downstream care about.
    const deepCases = [
        {
            label: 'Sizer→Designer payload (sizerPayload.sizerHardware.power ↔ odin-design.schema.json state.sizerHardware.power)',
            sourceFile: path.join('sizer', 'sizer.js'),
            varName: 'sizerPayload',
            keyPath: ['sizerHardware', 'power'],
            schemaFile: path.join('docs', 'json-schema', 'odin-design.schema.json'),
            schemaProps: schema => schema.properties.state.properties.sizerHardware.properties.power.properties
        }
    ];

    deepCases.forEach(c => {
        try {
            const src = fs.readFileSync(path.resolve(process.cwd(), c.sourceFile), 'utf8');
            const stateKeys = extractNestedObjectKeysFromConst(src, c.varName, c.keyPath);

            const schema = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), c.schemaFile), 'utf8'));
            const props = c.schemaProps(schema);
            if (!props || typeof props !== 'object') {
                throw new Error(`Nested schema property map not found in ${c.schemaFile} for ${c.keyPath.join('.')}`);
            }
            const schemaKeys = Object.keys(props);

            const stateSet = new Set(stateKeys);
            const schemaSet = new Set(schemaKeys);

            const missingFromSchema = stateKeys.filter(k => !schemaSet.has(k));
            const missingFromState = schemaKeys.filter(k => !stateSet.has(k));

            if (missingFromSchema.length === 0 && missingFromState.length === 0) {
                console.log(`✅ Deep schema drift OK: ${c.label} (${stateKeys.length} fields in sync)`);
            } else {
                allOk = false;
                console.error(`❌ Deep schema drift detected: ${c.label}`);
                if (missingFromSchema.length) {
                    console.error(`     Payload fields missing from schema (add them to ${c.schemaFile} under the matching properties block):`);
                    missingFromSchema.forEach(k => console.error(`       + ${k}`));
                }
                if (missingFromState.length) {
                    console.error(`     Schema properties no longer in payload (remove from schema or restore in ${c.sourceFile}):`);
                    missingFromState.forEach(k => console.error(`       - ${k}`));
                }
            }
        } catch (err) {
            allOk = false;
            console.error(`❌ Deep schema drift check failed for ${c.label}: ${err.message}`);
        }
    });

    return allOk;
}

// Renderer coverage. Every depth-1 field of select Sizer→Designer payload
// sub-objects should be referenced (by bare identifier) in every downstream
// renderer that's expected to surface it. This is a coarse text-grep — it
// catches "added field to payload, forgot to render in report.js / PPT" but
// not "rendered as the wrong label". Cheap belt-and-suspenders against
// silent drops. Pair with the deep schema-drift check above (one structural,
// one render-side) to close the typical Sizer→Designer-handoff gap class.
function checkRendererCoverage() {
    const cases = [
        {
            label: 'sizerPayload.sizerHardware.power',
            sourceFile: path.join('sizer', 'sizer.js'),
            varName: 'sizerPayload',
            keyPath: ['sizerHardware', 'power'],
            consumers: [
                { file: path.join('report', 'report.js'), label: 'report/report.js' },
                { file: path.join('report', 'pptx-export.js'), label: 'report/pptx-export.js' }
            ]
        },
        {
            label: 'sizerPayload.sizerHardware.sizingNotes',
            sourceFile: path.join('sizer', 'sizer.js'),
            varName: 'sizerPayload',
            keyPath: ['sizerHardware'],
            expectedFieldNames: ['sizingNotes'],
            consumers: [
                { file: path.join('report', 'report.js'), label: 'report/report.js' },
                { file: path.join('report', 'pptx-export.js'), label: 'report/pptx-export.js' }
            ]
        },
        {
            label: 'sizerPayload.sizerHardware.s2dCalculation',
            sourceFile: path.join('sizer', 'sizer.js'),
            varName: 'sizerPayload',
            keyPath: ['sizerHardware'],
            expectedFieldNames: ['s2dCalculation'],
            consumers: [
                { file: path.join('report', 'report.js'), label: 'report/report.js' },
                { file: path.join('report', 'pptx-export.js'), label: 'report/pptx-export.js' }
            ]
        },
        {
            label: 'sizerPayload.sizerWorkloads GPU metadata',
            sourceFile: path.join('sizer', 'sizer.js'),
            sourceAnchor: 'sizerWorkloads: workloads.map',
            varName: 'entry',
            keyPath: [],
            expectedFieldNames: ['gpuMode', 'gpuType', 'gpuLabel'],
            consumers: [
                { file: path.join('report', 'report.js'), label: 'report/report.js' },
                { file: path.join('report', 'pptx-export.js'), label: 'report/pptx-export.js' }
            ]
        }
    ];

    let allOk = true;
    cases.forEach(c => {
        try {
            const src = fs.readFileSync(path.resolve(process.cwd(), c.sourceFile), 'utf8');
            const anchorIndex = c.sourceAnchor ? src.indexOf(c.sourceAnchor) : 0;
            if (anchorIndex < 0) throw new Error(`Could not find source anchor '${c.sourceAnchor}' in ${c.sourceFile}`);
            const sourceScope = src.slice(anchorIndex);
            const extractedFields = extractNestedObjectKeysFromConst(sourceScope, c.varName, c.keyPath);
            const fieldNames = c.expectedFieldNames || extractedFields;
            if (c.expectedFieldNames) {
                const extractedSet = new Set(extractedFields);
                const missingFromSource = fieldNames.filter(f => !extractedSet.has(f));
                if (missingFromSource.length > 0) {
                    throw new Error(`Payload field(s) missing from ${c.sourceFile}: ${missingFromSource.join(', ')}`);
                }
            }
            c.consumers.forEach(consumer => {
                const consumerSrc = fs.readFileSync(path.resolve(process.cwd(), consumer.file), 'utf8');
                const missing = fieldNames.filter(f => !new RegExp('\\b' + f + '\\b').test(consumerSrc));
                if (missing.length === 0) {
                    console.log(`✅ Renderer coverage OK: ${c.label} → ${consumer.label} (${fieldNames.length} fields all referenced)`);
                } else {
                    allOk = false;
                    console.error(`❌ Renderer coverage gap: ${c.label} → ${consumer.label}`);
                    console.error(`     Field(s) present in the payload but not referenced in ${consumer.file}:`);
                    missing.forEach(f => console.error(`       ↳ ${f}`));
                    console.error(`     Either wire the field into the renderer, or document why it is intentionally omitted.`);
                }
            });
        } catch (err) {
            allOk = false;
            console.error(`❌ Renderer coverage check failed for ${c.label}: ${err.message}`);
        }
    });
    return allOk;
}

function checkReportPresentationContracts() {
    const reportHtml = fs.readFileSync(path.resolve(process.cwd(), 'report', 'report.html'), 'utf8');
    const reportJs = fs.readFileSync(path.resolve(process.cwd(), 'report', 'report.js'), 'utf8');
    const pptxJs = fs.readFileSync(path.resolve(process.cwd(), 'report', 'pptx-export.js'), 'utf8');
    const rackSvgJs = fs.readFileSync(path.resolve(process.cwd(), 'report', 'rack-svg.js'), 'utf8');
    const sizerJs = fs.readFileSync(path.resolve(process.cwd(), 'sizer', 'sizer.js'), 'utf8');
    const title = 'Azure Local Instance | Design Configuration Report';
    const required = [
        { label: 'HTML report title', source: reportHtml, value: title },
        { label: 'Markdown/PDF report title', source: reportJs, value: title },
        { label: 'PowerPoint report title', source: pptxJs, value: title },
        { label: 'Designer-only singular workflow subtitle', source: reportJs, value: 'Designer workflow' },
        { label: 'Sizer and Designer plural workflow subtitle', source: reportJs, value: 'Sizer and Designer workflows' },
        { label: 'Markdown workflow subtitle', source: reportJs, value: 'md.push(getReportSubtitle(s))' },
        { label: 'Markdown sizing notes section', source: reportJs, value: "md.push('## Sizing Notes & Recommendations (from Sizer)')" },
        { label: 'Azure connected report scenario label', source: reportJs, value: 'Azure connected control plane' },
        { label: 'Disconnected report scenario label', source: reportJs, value: 'Disconnected control plane' },
        { label: 'Generic Advisory heading parser', source: reportJs, value: 'function parseSizerAdvisory(note)' },
        { label: 'PowerPoint workflow subtitle', source: pptxJs, value: 'function getWorkflowSubtitle(state)' },
        { label: 'PowerPoint sizing note pagination', source: pptxJs, value: 'paginateBullets: true' },
        { label: 'Customer-facing GPU rack legend', source: rackSvgJs, value: "label: 'GPU Enabled'" },
        { label: 'Portable ToR tool report link', source: reportJs, value: 'https://azure.github.io/odinforazurelocal/switch-config/' },
        { label: 'Visible ToR tool report planning aid', source: reportJs, value: 'class="report-planning-aid"' },
        { label: 'Portable ToR tool PowerPoint link', source: pptxJs, value: 'https://azure.github.io/odinforazurelocal/switch-config/' },
        { label: 'Foundry Local model catalog link', source: sizerJs, value: 'https://learn.microsoft.com/azure/azure-sovereign-clouds/private/foundry-local/concept-model-catalog#example-models-in-the-curated-catalog' }
    ];
    const missing = required.filter(item => !item.source.includes(item.value));
    const oldLegendPresent = rackSvgJs.includes("label: 'GPU Accent'");
    if (missing.length === 0 && !oldLegendPresent) {
        console.log(`✅ Report presentation contracts OK: ${required.length} required strings present`);
        return true;
    }
    missing.forEach(item => console.error(`❌ Report presentation contract missing: ${item.label}`));
    if (oldLegendPresent) console.error('❌ Report presentation contract still contains the old GPU Accent legend');
    return false;
}

function checkDesignerResponsiveContracts() {
    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8').replace(/\r\n/g, '\n');
    const styleCss = fs.readFileSync(path.resolve(process.cwd(), 'css', 'style.css'), 'utf8').replace(/\r\n/g, '\n');
    const compactNavigation = `        @media (max-width: 480px) {
            .odin-tab-container {
                gap: 2px;
            }

            .odin-tab-btn {
                padding: 8px 6px;
            }

            .nav-theme-toggle {
                padding: 6px 4px;
            }
        }`;
    const alignedBreadcrumb = `    .breadcrumb-nav {
        margin-left: -0.5rem;
        margin-right: -0.5rem;
    }`;
    const wrappedInlineCode = `    .step code {
        overflow-wrap: anywhere;
    }`;

    if (indexHtml.includes(compactNavigation) && styleCss.includes(alignedBreadcrumb) && styleCss.includes(wrappedInlineCode)) {
        console.log('✅ Designer responsive contracts OK: compact navigation, aligned breadcrumb, and wrapped inline code present');
        return true;
    }

    if (!indexHtml.includes(compactNavigation)) console.error('❌ Designer responsive contract missing: compact navigation at 480px');
    if (!styleCss.includes(alignedBreadcrumb)) console.error('❌ Designer responsive contract missing: aligned mobile breadcrumb');
    if (!styleCss.includes(wrappedInlineCode)) console.error('❌ Designer responsive contract missing: wrapped mobile inline code');
    return false;
}

function checkSizerResponsiveContracts() {
    const sizerCss = fs.readFileSync(path.resolve(process.cwd(), 'sizer', 'sizer.css'), 'utf8').replace(/\r\n/g, '\n');
    const required = [
        { label: 'compact phone navigation', value: `.odin-tab-container {
        gap: 2px;
    }` },
        { label: 'single-column phone power grid', value: `.power-rack-grid {
        grid-template-columns: 1fr;
    }` },
        { label: 'shrinkable phone power items', value: `.power-rack-item {
        min-width: 0;
    }` }
    ];
    const missing = required.filter(item => !sizerCss.includes(item.value));
    if (missing.length === 0) {
        console.log(`✅ Sizer responsive contracts OK: ${required.length} phone layout rules present`);
        return true;
    }

    missing.forEach(item => console.error(`❌ Sizer responsive contract missing: ${item.label}`));
    return false;
}

function checkDesignerResetContracts() {
    const scriptJs = fs.readFileSync(path.resolve(process.cwd(), 'js', 'script.js'), 'utf8').replace(/\r\n/g, '\n');
    const resetMatch = scriptJs.match(/function resetAll\(\) \{[\s\S]*?\n\}\n\nasync function requestDesignerReset/);
    const dismissesResumeBanner = resetMatch && resetMatch[0].includes('dismissResumeBanner(true);');

    if (dismissesResumeBanner) {
        console.log('✅ Designer reset contracts OK: Start Over dismisses the saved-session banner');
        return true;
    }

    console.error('❌ Designer reset contract missing: Start Over must dismiss the saved-session banner');
    return false;
}

function checkDesignerAccessibilityContracts() {
    const scriptJs = fs.readFileSync(path.resolve(process.cwd(), 'js', 'script.js'), 'utf8');
    const disaggregatedJs = fs.readFileSync(path.resolve(process.cwd(), 'js', 'disaggregated.js'), 'utf8');
    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const required = [
        "const isNativeButton = card.tagName === 'BUTTON';",
        "if (!isNativeButton) card.setAttribute('role', 'button');",
        'if (isNativeButton) return;',
        "card.setAttribute('aria-pressed', card.classList.contains('selected') ? 'true' : 'false');",
        "card.setAttribute('aria-disabled', disabled ? 'true' : 'false');",
        "card.setAttribute('tabindex', disabled ? '-1' : '0');",
        'if (e.target !== card) return;',
        "if (card.classList.contains('disabled')) return;",
        "document.querySelectorAll('.option-card').forEach(initializeOptionCard);",
        "if (node.matches('.option-card')) initializeOptionCard(node);",
        'optionCardObserver.observe(document.body, {',
        "!c.closest('#da4-vrf-mode-grid') && !c.closest('#da8-port-count-grid')"
    ];
    const missing = required.filter(value => !scriptJs.includes(value));
    if (!disaggregatedJs.includes("card.classList.toggle('disabled', confirmed);")) {
        missing.push('confirmed VRF cards use shared disabled state');
    }
    if (!/<div class="option-card-with-link">[\s\S]*?<\/button>\s*<a [^>]*class="info-link"/.test(indexHtml)) {
        missing.push('Rack-Aware selector and documentation link are sibling controls');
    }
    if (missing.length === 0) {
        console.log(`✅ Designer accessibility contracts OK: ${required.length} option-card semantics present`);
        return true;
    }

    console.error('❌ Designer accessibility contract missing: option cards must expose role and selected state');
    return false;
}

function checkReportArchitectureSelections() {
    const reportJs = fs.readFileSync(path.resolve(process.cwd(), 'report', 'report.js'), 'utf8');
    const helperMatch = reportJs.match(/function getArchitectureSelections\(s\) \{[\s\S]*?\r?\n    \}\r?\n\r?\n    function computeValidations/);
    if (!helperMatch) {
        console.error('❌ Report architecture selections helper could not be loaded');
        return false;
    }

    const helperSource = helperMatch[0].replace(/\r?\n\r?\n    function computeValidations$/, '');
    const getArchitectureSelections = new Function(
        'formatScale',
        'formatIntent',
        'return (' + helperSource + ');'
    )(value => 'Scale: ' + value, value => 'Intent: ' + value);

    const disaggregated = getArchitectureSelections({
        architecture: 'disaggregated',
        disaggRackCount: 4,
        disaggNodesPerRack: 16,
        disaggStorageType: 'fc_san',
        disaggPortCount: '4',
        disaggNicConfigConfirmed: true
    });
    const hci = getArchitectureSelections({
        architecture: 'hci',
        scale: 'medium',
        storage: 'switched',
        ports: '4',
        intent: 'mgmt_compute'
    });
    const disaggregatedOk = disaggregated.scaleSelected
        && disaggregated.scale === '4 racks × 16 nodes per rack'
        && disaggregated.storageSelected && disaggregated.storage === 'FC SAN'
        && disaggregated.portsSelected && disaggregated.ports === '4'
        && disaggregated.intentSelected;
    const hciOk = hci.scaleSelected && hci.scale === 'Scale: medium'
        && hci.storageSelected && hci.storage === 'Switched'
        && hci.portsSelected && hci.ports === '4'
        && hci.intentSelected && hci.intent === 'Intent: mgmt_compute';

    if (disaggregatedOk && hciOk) {
        console.log('✅ Report architecture selections OK: disaggregated and HCI fields map correctly');
        return true;
    }
    console.error('❌ Report architecture selections do not map correctly');
    return false;
}

function generateNUnitXML(results, passed, failed, total) {
    const timestamp = new Date().toISOString();
    const result = failed > 0 ? 'Failed' : 'Passed';
    
    // Group results by suite
    const suites = {};
    results.forEach(r => {
        const suiteName = r.suite || 'Default';
        if (!suites[suiteName]) {
            suites[suiteName] = [];
        }
        suites[suiteName].push(r);
    });
    
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += `<test-run id="1" testcasecount="${total}" result="${result}" total="${total}" passed="${passed}" failed="${failed}" inconclusive="0" skipped="0" start-time="${timestamp}" end-time="${timestamp}" duration="0">\n`;
    xml += `  <test-suite type="Assembly" id="0-1" name="ODIN.Tests" fullname="ODIN.Tests" testcasecount="${total}" result="${result}" total="${total}" passed="${passed}" failed="${failed}" inconclusive="0" skipped="0">\n`;
    
    let suiteId = 1;
    Object.entries(suites).forEach(([suiteName, tests]) => {
        const suiteFailures = tests.filter(t => !t.passed).length;
        const suiteResult = suiteFailures > 0 ? 'Failed' : 'Passed';
        const safeSuiteName = suiteName.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
        
        xml += `    <test-suite type="TestFixture" id="0-${suiteId}" name="${safeSuiteName}" fullname="ODIN.Tests.${safeSuiteName}" testcasecount="${tests.length}" result="${suiteResult}" total="${tests.length}" passed="${tests.length - suiteFailures}" failed="${suiteFailures}" inconclusive="0" skipped="0">\n`;
        
        let testId = 1;
        tests.forEach(test => {
            const safeTestName = test.name.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
            const testResult = test.passed ? 'Passed' : 'Failed';
            
            xml += `      <test-case id="0-${suiteId}-${testId}" name="${safeTestName}" fullname="ODIN.Tests.${safeSuiteName}.${safeTestName}" result="${testResult}">\n`;
            
            if (!test.passed) {
                const safeExpected = String(test.expected).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
                const safeActual = String(test.actual).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
                xml += `        <failure>\n`;
                xml += `          <message><![CDATA[Expected: ${safeExpected}, Got: ${safeActual}]]></message>\n`;
                xml += `          <stack-trace><![CDATA[Expected: ${safeExpected}\nActual: ${safeActual}]]></stack-trace>\n`;
                xml += `        </failure>\n`;
            }
            
            xml += `      </test-case>\n`;
            testId++;
        });
        
        xml += `    </test-suite>\n`;
        suiteId++;
    });
    
    xml += `  </test-suite>\n`;
    xml += `</test-run>\n`;
    return xml;
}

function generateJUnitXML(results, passed, failed, total) {
    const timestamp = new Date().toISOString();
    
    // Group results by suite
    const suites = {};
    results.forEach(r => {
        const suiteName = r.suite || 'Default';
        if (!suites[suiteName]) {
            suites[suiteName] = [];
        }
        suites[suiteName].push(r);
    });
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites name="ODIN Unit Tests" tests="${total}" failures="${failed}" time="0" timestamp="${timestamp}">\n`;
    
    Object.entries(suites).forEach(([suiteName, tests]) => {
        const suiteFailures = tests.filter(t => !t.passed).length;
        const safeSuiteName = suiteName.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
        xml += `  <testsuite name="${safeSuiteName}" tests="${tests.length}" failures="${suiteFailures}" time="0">\n`;
        
        tests.forEach(test => {
            const safeTestName = test.name.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
            xml += `    <testcase name="${safeTestName}" classname="${safeSuiteName}" time="0">\n`;
            
            if (!test.passed) {
                const safeExpected = String(test.expected).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
                const safeActual = String(test.actual).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
                xml += `      <failure message="Expected: ${safeExpected}, Got: ${safeActual}" type="AssertionError">\n`;
                xml += `Expected: ${safeExpected}\nActual: ${safeActual}\n`;
                xml += `      </failure>\n`;
            }
            
            xml += `    </testcase>\n`;
        });
        
        xml += `  </testsuite>\n`;
    });
    
    xml += '</testsuites>\n';
    return xml;
}

(async () => {
    try {
        if (!testReleaseHistoryGuard() || !testRepositoryMapGuard()) {
            process.exit(1);
        }
        if (!checkReleaseHistory()) {
            console.error('\n❌ Release history check failed — keep only the current release summary in README.md and move the previous release to docs/version-history/README.md.');
            process.exit(1);
        }
        if (!checkRepositoryMap()) {
            console.error('\n❌ Repository map check failed — update the marked Repository Map in CONTRIBUTING.md to match the top-level structure.');
            process.exit(1);
        }
        if (releaseHistoryOnly) return;

        // Fail fast on any vendored-blob integrity mismatch before spending
        // time launching the browser (issue #230 — SheetJS SHA-256 pin).
        if (!checkVendorIntegrity()) {
            console.error('\n❌ Vendored library integrity check failed.');
            process.exit(1);
        }

        // Fail fast on schema drift before launching the browser (issue #237 —
        // keep docs/json-schema/ in lock-step with the in-app state objects).
        if (!checkSchemaDrift()) {
            console.error('\n❌ Schema drift check failed — update docs/json-schema/ to match the state object(s) in the same PR.');
            process.exit(1);
        }

        // Renderer coverage — every Sizer→Designer payload field of the
        // covered sub-objects must be referenced in the report + PPT
        // consumers. Catches "added a field, forgot to wire it into a
        // render site" (the bug that motivated this gate).
        if (!checkRendererCoverage()) {
            console.error('\n❌ Renderer coverage check failed — wire the missing field(s) into the report/PPT, or document why they are intentionally omitted.');
            process.exit(1);
        }
        if (!checkDesignerResponsiveContracts()) {
            console.error('\n❌ Designer responsive contract check failed.');
            process.exit(1);
        }
        if (!checkSizerResponsiveContracts()) {
            console.error('\n❌ Sizer responsive contract check failed.');
            process.exit(1);
        }
        if (!checkDesignerResetContracts()) {
            console.error('\n❌ Designer reset contract check failed.');
            process.exit(1);
        }
        if (!checkDesignerAccessibilityContracts()) {
            console.error('\n❌ Designer accessibility contract check failed.');
            process.exit(1);
        }
        if (!checkReportPresentationContracts()) {
            console.error('\n❌ Report presentation contract check failed.');
            process.exit(1);
        }
        if (!checkReportArchitectureSelections()) {
            console.error('\n❌ Report architecture selections check failed.');
            process.exit(1);
        }

        console.log('Launching browser...');
        const puppeteer = await import('puppeteer');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Capture console output
        page.on('console', msg => console.log('Browser:', msg.text()));
        page.on('pageerror', err => console.error('Page error:', err.message));
        
        // Load the test file
        const testPath = path.resolve(process.cwd(), 'tests', 'index.html');
        console.log('Loading tests from:', testPath);
        await page.goto(`file://${testPath}`, { waitUntil: 'networkidle0', timeout: 60000 });
        
        // Wait for tests to complete
        console.log('Waiting for tests to complete...');
        await page.waitForFunction(() => {
            const passEl = document.getElementById('pass-count');
            const failEl = document.getElementById('fail-count');
            return passEl && failEl && (parseInt(passEl.textContent) > 0 || parseInt(failEl.textContent) > 0);
        }, { timeout: 60000 });
        
        // Get test results
        const results = await page.evaluate(() => {
            return {
                passed: parseInt(document.getElementById('pass-count').textContent),
                failed: parseInt(document.getElementById('fail-count').textContent),
                total: parseInt(document.getElementById('total-count').textContent),
                details: window.testResults || []
            };
        });
        
        console.log(`\n========================================`);
        console.log(`Test Results: ${results.passed}/${results.total} passed, ${results.failed} failed`);
        console.log(`========================================\n`);
        
        // Ensure test-results directory exists
        const resultsDir = path.resolve(process.cwd(), 'test-results');
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        // Generate and write XML reports
        if (writeNunit) {
            const nunitXml = generateNUnitXML(results.details, results.passed, results.failed, results.total);
            const nunitPath = path.join(resultsDir, 'nunit.xml');
            fs.writeFileSync(nunitPath, nunitXml);
            console.log(`NUnit XML report written to: ${nunitPath}`);
        }
        
        if (writeJunit) {
            const junitXml = generateJUnitXML(results.details, results.passed, results.failed, results.total);
            const junitPath = path.join(resultsDir, 'junit.xml');
            fs.writeFileSync(junitPath, junitXml);
            console.log(`JUnit XML report written to: ${junitPath}`);
        }
        
        // Print failed tests
        if (results.failed > 0) {
            console.log('\nFailed tests:');
            results.details.filter(t => !t.passed).forEach(t => {
                console.log(`  ❌ ${t.name}`);
                console.log(`     Expected: ${t.expected}`);
                console.log(`     Actual: ${t.actual}`);
            });
        }
        
        await browser.close();
        
        // Exit with error code if tests failed
        if (results.failed > 0) {
            console.error(`\n❌ ${results.failed} test(s) failed`);
            process.exit(1);
        }
        
        console.log(`\n✅ All ${results.passed} tests passed!`);

        // ------------------------------------------------------------------
        // Catalog Gap Analysis — informational, runs after the browser tests.
        // Compares Sizer hardware options against the committed snapshot of
        // the Azure Local Solutions catalog API. Never fails the build unless
        // --strict-catalog-gap is passed. See scripts/catalog-gap-check.js.
        // ------------------------------------------------------------------
        try {
            const catalogCheck = require('./catalog-gap-check.js');
            const sizerOpts = catalogCheck.loadSizerOptions();
            const snapshot = catalogCheck.loadSnapshot();
            const gapResult = catalogCheck.runGapAnalysis(snapshot, sizerOpts);
            const reportText = catalogCheck.formatReport(gapResult);
            console.log('\n' + reportText);

            // Persist a human-readable text report and machine-readable JSON
            // alongside the NUnit/JUnit files so CI can publish them as build
            // artefacts and PR reviewers can open them from the run page.
            try {
                const gapTxtPath = path.join(resultsDir, 'catalog-gap-report.txt');
                const gapJsonPath = path.join(resultsDir, 'catalog-gap-report.json');
                fs.writeFileSync(gapTxtPath, reportText + '\n', 'utf8');
                fs.writeFileSync(gapJsonPath, JSON.stringify(gapResult, null, 2) + '\n', 'utf8');
                console.log(`Catalog gap report written to: ${gapTxtPath}`);
                console.log(`Catalog gap report (JSON) written to: ${gapJsonPath}`);
            } catch (writeErr) {
                console.warn('⚠️  Could not write catalog gap report file: ' + (writeErr && writeErr.message ? writeErr.message : writeErr));
            }

            if (process.argv.includes('--strict-catalog-gap') && gapResult.gaps.length > 0) {
                console.error(`\n❌ ${gapResult.gaps.length} catalog gap(s) detected (strict mode).`);
                process.exit(1);
            }
        } catch (gapErr) {
            // Catalog gap analysis is informational — log and continue.
            console.warn('\n⚠️  Catalog gap analysis skipped: ' + (gapErr && gapErr.message ? gapErr.message : gapErr));
        }

        process.exit(0);
    } catch (err) {
        console.error('Error running tests:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
})();
