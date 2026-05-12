/**
 * Catalog Gap Check — Sizer hardware options vs. live Azure Local catalog
 * ========================================================================
 *
 * Compares the option lists exposed by the ODIN Sizer (CPU generations, cores
 * per socket, memory, storage, GPUs) against the published hardware catalog at
 * https://azurelocalsolutions.azure.microsoft.com/#/catalog so PR reviewers
 * can see when the Sizer falls behind on something a real OEM SKU exposes.
 *
 * Intentionally INFORMATIONAL — does not fail the build by default. The Sizer
 * is OEM-agnostic and lists generic generations/sizes; not every catalog SKU
 * needs a matching Sizer dropdown. Use `--strict` for a non-zero exit on gaps.
 *
 * Modes
 * -----
 *   node scripts/catalog-gap-check.js
 *     Offline — loads the committed snapshot (tests/fixtures/catalog-snapshot.json)
 *     and runs the gap analysis. This is what scripts/run-tests.js invokes.
 *
 *   node scripts/catalog-gap-check.js --live
 *     Fetches the live catalog API and runs the analysis against current data.
 *     Useful for spot-checks; not used by CI.
 *
 *   node scripts/catalog-gap-check.js --live --update-snapshot
 *     Fetches live data, writes a refreshed snapshot, then runs analysis.
 *     Run this locally to refresh the committed snapshot before a PR.
 *
 *   node scripts/catalog-gap-check.js --strict
 *     Exit code 1 if any gap is detected. Combine with --live for CI guards.
 *
 *   node scripts/catalog-gap-check.js --json
 *     Emit machine-readable JSON instead of the human-readable report.
 *
 * Catalog API reference
 * ---------------------
 *   Endpoint:    POST https://azurelocalsolutions.azure.microsoft.com/api/catalog/default/search?
 *   Auth:        none (public, anonymous — no cookies or tokens required)
 *   Headers:     Content-Type: application/json
 *                Origin/Referer: https://azurelocalsolutions.azure.microsoft.com (set to be polite;
 *                                the server also returns 200 without them)
 *   Body:        {
 *                  "resourceType": "Platforms",
 *                  "searchText": "",
 *                  "filters": [
 *                    { "name": "lifecycleStage", "values": ["1","2"] },
 *                    { "name": "qualificationGeneration", "values": ["Current (2026 or later)"] }
 *                  ],
 *                  "sortOptions": null,
 *                  "page": 1,
 *                  "pageSize": 100
 *                }
 *   Response:    { data: { platforms: [...], totalResults, currentPage, totalPages,
 *                          platformFilters, resourceType }, message, status }
 *   See tests/fixtures/CATALOG_API.md for the full schema.
 *
 * Privacy note
 * ------------
 *   The live API is public, anonymous, marketing content owned by Microsoft. No
 *   credentials, cookies, or PII are sent. The committed snapshot contains only
 *   public OEM hardware specs that already appear on the catalog website.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_ROOT = path.resolve(__dirname, '..');
const SIZER_JS_PATH = path.join(REPO_ROOT, 'sizer', 'sizer.js');
const SIZER_HTML_PATH = path.join(REPO_ROOT, 'sizer', 'index.html');
const SNAPSHOT_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'catalog-snapshot.json');

const CATALOG_HOST = 'azurelocalsolutions.azure.microsoft.com';
const CATALOG_PATH = '/api/catalog/default/search?';
const CATALOG_REQUEST_BODY = {
    resourceType: 'Platforms',
    searchText: '',
    filters: [
        { name: 'lifecycleStage', values: ['1', '2'] },
        { name: 'qualificationGeneration', values: ['Current (2026 or later)'] },
    ],
    sortOptions: null,
    page: 1,
    pageSize: 100,
};

// ----------------------------------------------------------------------------
// Known design exceptions — Sizer-vs-catalog deviations that are DELIBERATE
// ----------------------------------------------------------------------------
//
// Some catalog options are intentionally not exposed in the Sizer dropdowns.
// Listing them here turns the gap-check into a real signal: the "gaps" list
// only contains things a reviewer should look at, and the "design exceptions"
// section documents the rationale for the ones we've already considered and
// chosen to leave out.
//
// Each entry has a `match(gap)` predicate; if it returns true, the gap is
// moved out of `result.gaps` and into `result.designExceptions` (and so
// `--strict-catalog-gap` will no longer fail the build on these).
//
// The predicates are intentionally NARROW: if the catalog ever publishes a
// *new* small drive size, or pushes memory past the documented ceiling, the
// predicate will not match the enlarged list and the new deviation will show
// up as a regular gap for review.
// ----------------------------------------------------------------------------

const LEGACY_CAPACITY_DRIVE_SIZES_TB = new Set([
    0.8, 1.2, 1.5, 1.6, 1.8, 2.4, 3.2, 6, 6.4, 10, 12.8, 14,
]);
const LEGACY_CACHE_DRIVE_SIZES_TB = new Set([0.8, 1.6, 3.2, 6.4]);

const KNOWN_DESIGN_EXCEPTIONS = [
    {
        id: 'memory-cap-4tb',
        category: 'memory-max',
        match: (g) => g.category === 'memory-max' &&
            typeof g.catalogMaxGB === 'number' && g.catalogMaxGB <= 8192 &&
            typeof g.sizerMaxGB === 'number' && g.sizerMaxGB === 4096,
        reason:
            'Sizer intentionally caps per-node memory at 4 TB (4096 GB). Some OEM ' +
            'catalog SKUs advertise up to 8 TB but the Sizer\'s standard sizing ' +
            'envelope stops at 4 TB; adding 6 TB / 8 TB options would imply support ' +
            'beyond the documented Azure Local guidance. Revisit if Microsoft ' +
            'publishes guidance to extend the supported memory ceiling.',
    },
    {
        id: 'capacity-drive-legacy-and-enterprise-skus',
        category: 'storage-capacity-sizes',
        match: (g) => g.category === 'storage-capacity-sizes' &&
            Array.isArray(g.missingSizesTB) && g.missingSizesTB.length > 0 &&
            g.missingSizesTB.every((tb) => LEGACY_CAPACITY_DRIVE_SIZES_TB.has(tb)),
        reason:
            'Small (<3.84 TB) and odd enterprise capacity SKUs in the OEM catalog ' +
            'are deliberately not surfaced in the Sizer. The Sizer offers a curated ' +
            'set (0.96, 1.92, 3.84, 5.68, 7.68, 8, 12, 15.36, 16, 20 TB) covering ' +
            'common Azure Local deployment shapes; full OEM SKU breadth lives in ' +
            'the catalog itself. A NEW size outside this allowlist will surface as ' +
            'a regular gap.',
    },
    {
        id: 'cache-drive-legacy-skus',
        category: 'storage-cache-sizes',
        match: (g) => g.category === 'storage-cache-sizes' &&
            Array.isArray(g.missingSizesTB) && g.missingSizesTB.length > 0 &&
            g.missingSizesTB.every((tb) => LEGACY_CACHE_DRIVE_SIZES_TB.has(tb)),
        reason:
            'Legacy small cache SKUs (<7.68 TB) in the OEM catalog are deliberately ' +
            'not surfaced in the Sizer. Sizer offers 0.96–15.36 TB cache choices ' +
            'aligned with current AI / VM / AKS deployment guidance. A NEW small ' +
            'cache size outside this allowlist will surface as a regular gap.',
    },
];

function partitionDesignExceptions(gaps) {
    const remaining = [];
    const designExceptions = [];
    gaps.forEach((g) => {
        const hit = KNOWN_DESIGN_EXCEPTIONS.find((d) => d.match(g));
        if (hit) {
            designExceptions.push({
                id: hit.id,
                category: g.category,
                severity: g.severity,
                detail: g.detail,
                reason: hit.reason,
            });
        } else {
            remaining.push(g);
        }
    });
    return { gaps: remaining, designExceptions };
}

// ----------------------------------------------------------------------------
// Sizer constant extraction
// ----------------------------------------------------------------------------

function extractObjectLiteral(source, declRegex) {
    const m = declRegex.exec(source);
    if (!m) return null;
    const start = m.index + m[0].length - 1; // position of opening '{'
    let depth = 0;
    for (let i = start; i < source.length; i++) {
        const c = source[i];
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) {
                const literal = source.slice(start, i + 1);
                // eslint-disable-next-line no-new-func
                return new Function('return ' + literal)();
            }
        }
    }
    return null;
}

function extractSelectOptions(html, selectId) {
    const re = new RegExp('<select\\s+id="' + selectId + '"[\\s\\S]*?</select>', 'i');
    const m = re.exec(html);
    if (!m) return [];
    const block = m[0];
    const values = [];
    const optRe = /<option\s+value="([^"]+)"/gi;
    let om;
    while ((om = optRe.exec(block)) !== null) {
        const v = om[1];
        if (v && !isNaN(parseFloat(v))) values.push(parseFloat(v));
    }
    return values;
}

function loadSizerOptions() {
    const src = fs.readFileSync(SIZER_JS_PATH, 'utf8');
    const html = fs.readFileSync(SIZER_HTML_PATH, 'utf8');

    const CPU_GENERATIONS = extractObjectLiteral(src, /const\s+CPU_GENERATIONS\s*=\s*\{/);
    const GPU_MODELS = extractObjectLiteral(src, /const\s+GPU_MODELS\s*=\s*\{/);
    if (!CPU_GENERATIONS) throw new Error('Failed to extract CPU_GENERATIONS from sizer.js');
    if (!GPU_MODELS) throw new Error('Failed to extract GPU_MODELS from sizer.js');

    const memoryOptions = extractSelectOptions(html, 'node-memory');           // GB
    const capacityDiskCounts = extractSelectOptions(html, 'capacity-disk-count');
    const capacityDiskSizes = extractSelectOptions(html, 'capacity-disk-size'); // TB
    const tieredCapacityDiskCounts = extractSelectOptions(html, 'tiered-capacity-disk-count');
    const cacheDiskCounts = extractSelectOptions(html, 'cache-disk-count');
    const cacheDiskSizes = extractSelectOptions(html, 'cache-disk-size');       // TB

    return {
        cpuGenerations: CPU_GENERATIONS,
        gpuModels: GPU_MODELS,
        memoryOptions,
        capacityDiskCounts,
        capacityDiskSizes,
        tieredCapacityDiskCounts,
        cacheDiskCounts,
        cacheDiskSizes,
    };
}

// ----------------------------------------------------------------------------
// Catalog data load (live or snapshot)
// ----------------------------------------------------------------------------

function fetchLiveCatalog() {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(CATALOG_REQUEST_BODY);
        const req = https.request({
            host: CATALOG_HOST,
            path: CATALOG_PATH,
            method: 'POST',
            headers: {
                'Accept': '*/*',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'Origin': 'https://' + CATALOG_HOST,
                'Referer': 'https://' + CATALOG_HOST + '/',
                'User-Agent': 'odin-sizer-catalog-gap-check (+https://github.com/Azure/odinforazurelocal)',
            },
            timeout: 30000,
        }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error('Catalog HTTP ' + res.statusCode));
                return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                try {
                    const responseBody = Buffer.concat(chunks).toString('utf8');
                    const parsed = JSON.parse(responseBody);
                    resolve(parsed);
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(new Error('timeout')); });
        req.write(body);
        req.end();
    });
}

/**
 * Reduce the full API payload to the fields we actually consume. Keeps the
 * committed snapshot small and easy to diff in PRs.
 */
function slimSnapshot(rawApiResponse) {
    const platforms = ((rawApiResponse && rawApiResponse.data && rawApiResponse.data.platforms) || []).map((p) => {
        const props = p.properties || {};
        const configs = (props.configurations || []).map((c) => ({
            configurationName: c.configurationName,
            architecture: c.architecture,
            isSingleNodeConfiguration: c.isSingleNodeConfiguration,
            clusterSize: c.clusterSize || null,
            cpuDetails: c.cpuDetails || null,
            memoryDetails: c.memoryDetails ? {
                minimumMemoryBytes: c.memoryDetails.minimumMemoryBytes,
                maximumMemoryBytes: c.memoryDetails.maximumMemoryBytes,
                numberOfDimmSlots: c.memoryDetails.numberOfDimmSlots,
                isHalfDimmSlotsSupported: c.memoryDetails.isHalfDimmSlotsSupported,
                dimmSlotSizes: c.memoryDetails.dimmSlotSizes,
            } : null,
            storageDetails: c.storageDetails ? {
                minimumStorageBytes: c.storageDetails.minimumStorageBytes,
                storageMaxBytes: c.storageDetails.storageMaxBytes,
                storageDrives: c.storageDetails.storageDrives,
                cacheDriveDetails: c.storageDetails.cacheDriveDetails || null,
                capacityDriveDetails: c.storageDetails.capacityDriveDetails || null,
            } : null,
            gpuDetails: c.gpuDetails || null,
            networkingDetails: c.networkingDetails || null,
            solutionCapabilities: c.solutionCapabilities || [],
        }));
        return {
            platformName: props.platformName,
            vendorName: props.vendorName,
            systemType: props.systemType,
            formFactor: props.formFactor,
            rackUnits: props.rackUnits,
            minimumScale: props.minimumScale,
            maximumScale: props.maximumScale,
            lastTestedVersion: props.lastTestedVersion,
            qualificationGeneration: props.qualificationGeneration,
            cpuFamily: props.cpuFamily,
            cpuModel: props.cpuModel,
            isGpuSupported: props.isGpuSupported,
            storageDrives: props.storageDrives || [],
            featuresSupported: props.featuresSupported || [],
            sdnNicDetails: props.sdnNicDetails || null,
            configurations: configs,
        };
    });
    return {
        capturedAt: new Date().toISOString(),
        source: 'https://' + CATALOG_HOST + CATALOG_PATH,
        totalResults: (rawApiResponse && rawApiResponse.data && rawApiResponse.data.totalResults) || platforms.length,
        platforms,
    };
}

function loadSnapshot() {
    if (!fs.existsSync(SNAPSHOT_PATH)) {
        throw new Error('Catalog snapshot not found at ' + SNAPSHOT_PATH +
            '\nRun: node scripts/catalog-gap-check.js --live --update-snapshot');
    }
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
}

// ----------------------------------------------------------------------------
// Mapping helpers
// ----------------------------------------------------------------------------

/**
 * Map catalog CPU family + model strings to a set of Sizer CPU generation IDs.
 * Some catalog labels collapse multiple Sizer generations into one (e.g. "AMD
 * 4th Gen EPYC" covers Sizer's epyc-4th AND epyc-4th-c) — those return arrays.
 *
 * The catalog encodes the catalog response in latin1-as-utf8, so the strings
 * contain mojibake (Â®, â„¢). Match loosely on alphanumeric tokens.
 */
function mapCatalogCpuToSizerGenIds(cpuFamily, cpuModel) {
    const f = (cpuFamily || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const m = (cpuModel || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const combined = f + ' ' + m;
    if (combined.includes('xeon') && combined.includes('d') && /27/.test(combined)) return ['xeon-d-27xx'];
    if (combined.includes('xeon')) {
        if (/4 ?th/.test(combined) || /\b4th\b/.test(combined)) return ['xeon-4th'];
        if (/5 ?th/.test(combined) || /\b5th\b/.test(combined)) return ['xeon-5th'];
        if (/6 ?th/.test(combined) || /\b6th\b/.test(combined)) return ['xeon-6'];
    }
    if (combined.includes('epyc')) {
        if (/4 ?th/.test(combined) || /\b4th\b/.test(combined)) return ['epyc-4th', 'epyc-4th-c'];
        if (/5 ?th/.test(combined) || /\b5th\b/.test(combined)) return ['epyc-5th', 'epyc-5th-c'];
    }
    return [];
}

function parseGpuModelsFromString(s) {
    // gpuDda / gpuP may arrive as a string ("NVIDIA (L4,L40S)") or as an array
    // of such strings (["NVIDIA (L4,L40S)", "NVIDIA (T4)"]) — the POST endpoint
    // returns arrays, the older GET endpoint returns strings. Normalize both.
    //
    // Model names can contain spaces (e.g. "RTX Pro 6000"), so split ONLY on
    // commas or pipes, never on whitespace. Internal whitespace is preserved
    // and normalized downstream by sizerGpuKeyFromCatalogName().
    if (!s) return [];
    if (Array.isArray(s)) {
        const out = [];
        s.forEach((item) => parseGpuModelsFromString(item).forEach((m) => out.push(m)));
        return out;
    }
    if (typeof s !== 'string') return [];
    const inside = /\(([^)]+)\)/.exec(s);
    if (!inside) return [];
    return inside[1].split(/[,|]+/).map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

function sizerGpuKeyFromCatalogName(name) {
    const n = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const map = {
        t4: 't4',
        a2: 'a2',
        a16: 'a16',
        l4: 'l4',
        l40: 'l40',
        l40s: 'l40s',
        rtxpro6000: 'rtxpro6000',
        rtx6000pro: 'rtxpro6000',
        h100: 'h100',
        h200: 'h200',     // not in Sizer today
        b200: 'b200',     // not in Sizer today
        mi300x: 'mi300x', // not in Sizer today
    };
    return map[n] || n;
}

function parseSpaceList(s) {
    // Accepts a space-separated string ("8 16 32") OR an already-parsed
    // number/string array. The POST endpoint returns arrays; the legacy GET
    // returns strings. Normalize both into number[].
    if (s === null || s === undefined) return [];
    if (Array.isArray(s)) {
        return s.map(Number).filter((n) => !isNaN(n));
    }
    if (typeof s !== 'string') return [];
    return s.split(/\s+/).map((t) => t.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n));
}

/**
 * The catalog API double-encodes its UTF-8 strings (e.g. `Intel®` arrives as
 * `Intel\u00c2\u00ae`, which renders as `IntelÂ®`). When that mojibake pattern
 * is detected, decode by reinterpreting the latin1 bytes as UTF-8. Pure ASCII
 * strings are left untouched.
 */
function cleanLabel(s) {
    if (typeof s !== 'string') return s;
    // Only re-decode if the string contains the canonical mojibake markers.
    // \u00C2 precedes Latin-1 Supplement chars; \u00E2\u0080 starts most U+20xx
    // (em-dash, smart quotes, trademark, etc.) in double-encoded UTF-8.
    if (/\u00c2[\u0080-\u00bf]|\u00e2\u0080/.test(s)) {
        try { return Buffer.from(s, 'latin1').toString('utf8'); } catch { return s; }
    }
    return s;
}

// ----------------------------------------------------------------------------
// Gap analysis
// ----------------------------------------------------------------------------

function runGapAnalysis(snapshot, sizer) {
    const gaps = [];
    const findings = [];

    // ---- CPU generation coverage --------------------------------------------
    const sizerGenIds = new Set();
    Object.values(sizer.cpuGenerations).forEach((arr) => arr.forEach((g) => sizerGenIds.add(g.id)));

    const sizerGenById = {};
    Object.values(sizer.cpuGenerations).forEach((arr) => arr.forEach((g) => { sizerGenById[g.id] = g; }));

    const catalogCpuByGen = {}; // genId -> { coresPerSocket: Set, sockets: Set, maxCoresSeen, sampleLabel }
    const unmappedCpuLabels = new Set();

    for (const platform of snapshot.platforms) {
        const ids = mapCatalogCpuToSizerGenIds(platform.cpuFamily, platform.cpuModel);
        if (!ids.length) {
            unmappedCpuLabels.add((cleanLabel(platform.cpuFamily) || '') + ' / ' + (cleanLabel(platform.cpuModel) || ''));
            continue;
        }
        for (const c of platform.configurations) {
            if (!c.cpuDetails) continue;
            const cps = parseSpaceList(c.cpuDetails.coresPerSocket);
            const socketsList = [];
            if (c.cpuDetails.totalSocketsSupported) {
                // can be 1, 2, or 0 (catalog quirk for some platforms — treat 0 as unknown)
                if (c.cpuDetails.totalSocketsSupported > 0) socketsList.push(c.cpuDetails.totalSocketsSupported);
            }
            for (const id of ids) {
                if (!catalogCpuByGen[id]) {
                    catalogCpuByGen[id] = {
                        coresPerSocket: new Set(),
                        sockets: new Set(),
                        maxCoresSeen: 0,
                        minCoresSeen: Number.POSITIVE_INFINITY,
                        catalogLabel: (cleanLabel(platform.cpuFamily) || '') + ' / ' + (cleanLabel(platform.cpuModel) || ''),
                    };
                }
                cps.forEach((n) => catalogCpuByGen[id].coresPerSocket.add(n));
                socketsList.forEach((n) => catalogCpuByGen[id].sockets.add(n));
                if (c.cpuDetails.maximumCores) {
                    catalogCpuByGen[id].maxCoresSeen = Math.max(catalogCpuByGen[id].maxCoresSeen, c.cpuDetails.maximumCores);
                }
                if (c.cpuDetails.minimumCores) {
                    catalogCpuByGen[id].minCoresSeen = Math.min(catalogCpuByGen[id].minCoresSeen, c.cpuDetails.minimumCores);
                }
            }
        }
    }

    if (unmappedCpuLabels.size > 0) {
        gaps.push({
            category: 'cpu-generation-missing',
            severity: 'high',
            detail: 'Catalog CPU family/model not recognized by the Sizer mapping (likely a new generation):\n  - ' +
                [...unmappedCpuLabels].join('\n  - '),
        });
    }

    findings.push({ category: 'cpu-generation-coverage', catalogGenIds: Object.keys(catalogCpuByGen), sizerGenIds: [...sizerGenIds] });

    // Per-generation cores-per-socket gaps. For families that map to multiple
    // Sizer generation IDs (e.g. 4th Gen EPYC -> Genoa + Bergamo), a value is
    // covered if ANY mapped Sizer generation lists it.
    const familyToIds = {
        xeon4: ['xeon-4th'], xeon5: ['xeon-5th'], xeon6: ['xeon-6'],
        xeond: ['xeon-d-27xx'], epyc4: ['epyc-4th', 'epyc-4th-c'], epyc5: ['epyc-5th', 'epyc-5th-c'],
    };
    function familyKeyForGen(id) {
        if (id === 'xeon-4th') return 'xeon4';
        if (id === 'xeon-5th') return 'xeon5';
        if (id === 'xeon-6') return 'xeon6';
        if (id === 'xeon-d-27xx') return 'xeond';
        if (id === 'epyc-4th' || id === 'epyc-4th-c') return 'epyc4';
        if (id === 'epyc-5th' || id === 'epyc-5th-c') return 'epyc5';
        return null;
    }

    const cpuGapsByFamily = {};
    const seenFamilies = new Set();
    for (const genId of Object.keys(catalogCpuByGen)) {
        const fam = familyKeyForGen(genId);
        if (!fam || seenFamilies.has(fam)) continue;
        seenFamilies.add(fam);

        const sizerIds = familyToIds[fam];
        const sizerCoreUnion = new Set();
        let sizerMaxCoresMax = 0;
        sizerIds.forEach((id) => {
            const g = sizerGenById[id];
            if (g && Array.isArray(g.coreOptions)) {
                g.coreOptions.forEach((n) => sizerCoreUnion.add(n));
                if (g.maxCores > sizerMaxCoresMax) sizerMaxCoresMax = g.maxCores;
            }
        });

        // Aggregate catalog across all mapped genIds for this family.
        const catalogCoreUnion = new Set();
        let catalogMaxSeen = 0;
        let catalogLabel = '';
        sizerIds.forEach((id) => {
            const c = catalogCpuByGen[id];
            if (c) {
                c.coresPerSocket.forEach((n) => catalogCoreUnion.add(n));
                if (c.maxCoresSeen > catalogMaxSeen) catalogMaxSeen = c.maxCoresSeen;
                if (c.catalogLabel) catalogLabel = c.catalogLabel;
            }
        });

        const missingInSizer = [...catalogCoreUnion].filter((n) => !sizerCoreUnion.has(n)).sort((a, b) => a - b);
        const supersetInSizer = [...sizerCoreUnion].filter((n) => !catalogCoreUnion.has(n)).sort((a, b) => a - b);

        cpuGapsByFamily[fam] = {
            family: fam,
            catalogLabel,
            sizerGenerations: sizerIds,
            catalogCoresPerSocket: [...catalogCoreUnion].sort((a, b) => a - b),
            sizerCoreOptions: [...sizerCoreUnion].sort((a, b) => a - b),
            missingInSizer,
            supersetInSizer,
            catalogMaxSeen,
            sizerMaxCores: sizerMaxCoresMax,
        };

        if (missingInSizer.length) {
            gaps.push({
                category: 'cpu-cores-per-socket',
                severity: 'medium',
                detail: catalogLabel + ' (' + sizerIds.join('+') + '): Sizer is missing core counts [' +
                    missingInSizer.join(', ') + '] (catalog: ' + [...catalogCoreUnion].sort((a, b) => a - b).join(', ') + ')',
            });
        }
        if (catalogMaxSeen > sizerMaxCoresMax) {
            gaps.push({
                category: 'cpu-max-cores',
                severity: 'high',
                detail: catalogLabel + ': catalog max ' + catalogMaxSeen + ' cores/socket vs. Sizer max ' + sizerMaxCoresMax,
            });
        }
    }

    // ---- Memory -------------------------------------------------------------
    let catalogMaxMemBytes = 0;
    let catalogMinMemBytes = Number.POSITIVE_INFINITY;
    for (const p of snapshot.platforms) {
        for (const c of p.configurations) {
            if (!c.memoryDetails) continue;
            if (c.memoryDetails.maximumMemoryBytes) catalogMaxMemBytes = Math.max(catalogMaxMemBytes, c.memoryDetails.maximumMemoryBytes);
            if (c.memoryDetails.minimumMemoryBytes) catalogMinMemBytes = Math.min(catalogMinMemBytes, c.memoryDetails.minimumMemoryBytes);
        }
    }
    const catalogMaxMemGB = catalogMaxMemBytes / (1024 * 1024 * 1024);
    const sizerMaxMemGB = sizer.memoryOptions.length ? Math.max.apply(null, sizer.memoryOptions) : 0;
    const sizerMinMemGB = sizer.memoryOptions.length ? Math.min.apply(null, sizer.memoryOptions) : 0;

    const memoryFinding = {
        category: 'memory',
        catalogMaxGB: Math.round(catalogMaxMemGB),
        catalogMinGB: Math.round(catalogMinMemBytes / (1024 * 1024 * 1024)),
        sizerMaxGB: sizerMaxMemGB,
        sizerMinGB: sizerMinMemGB,
    };
    findings.push(memoryFinding);

    if (catalogMaxMemGB > sizerMaxMemGB) {
        gaps.push({
            category: 'memory-max',
            severity: 'medium',
            detail: 'Catalog max memory per node ' + memoryFinding.catalogMaxGB + ' GB exceeds Sizer max ' + sizerMaxMemGB + ' GB',
            catalogMaxGB: memoryFinding.catalogMaxGB,
            sizerMaxGB: sizerMaxMemGB,
        });
    }

    // ---- Storage: max capacity drives + drive sizes -------------------------
    let catalogMaxCapDrives = 0;
    let catalogMaxCacheDrives = 0;
    const catalogCapacitySizesTB = new Set();
    const catalogCacheSizesTB = new Set();
    for (const p of snapshot.platforms) {
        for (const c of p.configurations) {
            const s = c.storageDetails;
            if (!s) continue;
            const cap = s.capacityDriveDetails;
            const cache = s.cacheDriveDetails;
            if (cap && cap.maximumNumberOfCapacityDrives) {
                catalogMaxCapDrives = Math.max(catalogMaxCapDrives, cap.maximumNumberOfCapacityDrives);
            }
            if (cache && cache.maximumNumberOfCacheDrives) {
                catalogMaxCacheDrives = Math.max(catalogMaxCacheDrives, cache.maximumNumberOfCacheDrives);
            }
            if (cap && Array.isArray(cap.capacityDriveSizesBytes)) {
                cap.capacityDriveSizesBytes.forEach((b) => catalogCapacitySizesTB.add(+(b / 1e12).toFixed(2)));
            }
            if (cache && Array.isArray(cache.cacheDriveSizesBytes)) {
                cache.cacheDriveSizesBytes.forEach((b) => catalogCacheSizesTB.add(+(b / 1e12).toFixed(2)));
            }
        }
    }

    const sizerCapDiskMax = sizer.capacityDiskCounts.length ? Math.max.apply(null, sizer.capacityDiskCounts) : 0;
    const sizerCacheDiskMax = sizer.cacheDiskCounts.length ? Math.max.apply(null, sizer.cacheDiskCounts) : 0;
    const sizerTieredCapMax = sizer.tieredCapacityDiskCounts.length ? Math.max.apply(null, sizer.tieredCapacityDiskCounts) : 0;

    findings.push({
        category: 'storage-counts',
        catalogMaxCapDrives,
        catalogMaxCacheDrives,
        sizerCapDiskMax,
        sizerTieredCapMax,
        sizerCacheDiskMax,
    });

    if (catalogMaxCapDrives > sizerCapDiskMax) {
        gaps.push({
            category: 'storage-disk-count',
            severity: 'medium',
            detail: 'Catalog max capacity disks per node ' + catalogMaxCapDrives +
                ' exceeds Sizer single-tier max ' + sizerCapDiskMax,
        });
    }
    if (catalogMaxCapDrives > sizerTieredCapMax) {
        gaps.push({
            category: 'storage-disk-count-tiered',
            severity: 'low',
            detail: 'Catalog max capacity disks per node ' + catalogMaxCapDrives +
                ' exceeds Sizer two-tier max ' + sizerTieredCapMax,
        });
    }
    if (catalogMaxCacheDrives > sizerCacheDiskMax) {
        gaps.push({
            category: 'storage-cache-count',
            severity: 'low',
            detail: 'Catalog max cache disks per node ' + catalogMaxCacheDrives +
                ' exceeds Sizer cache max ' + sizerCacheDiskMax,
        });
    }

    const sizerCapSizes = new Set(sizer.capacityDiskSizes); // already TB
    const sizerCacheSizes = new Set(sizer.cacheDiskSizes);
    const capSizesMissing = [...catalogCapacitySizesTB].filter((tb) => {
        // Treat near-matches within 5% tolerance as the same size (e.g. 15.35 TB ≈ 15.36 TB).
        return ![...sizerCapSizes].some((s) => Math.abs(s - tb) / Math.max(s, tb) < 0.05);
    }).sort((a, b) => a - b);
    const cacheSizesMissing = [...catalogCacheSizesTB].filter((tb) => {
        return ![...sizerCacheSizes].some((s) => Math.abs(s - tb) / Math.max(s, tb) < 0.05);
    }).sort((a, b) => a - b);

    findings.push({
        category: 'storage-sizes',
        catalogCapacityTB: [...catalogCapacitySizesTB].sort((a, b) => a - b),
        sizerCapacityTB: [...sizerCapSizes].sort((a, b) => a - b),
        catalogCacheTB: [...catalogCacheSizesTB].sort((a, b) => a - b),
        sizerCacheTB: [...sizerCacheSizes].sort((a, b) => a - b),
    });

    if (capSizesMissing.length) {
        gaps.push({
            category: 'storage-capacity-sizes',
            severity: 'low',
            detail: 'Capacity drive sizes in catalog not in Sizer: [' + capSizesMissing.join(', ') + '] TB',
            missingSizesTB: capSizesMissing.slice(),
        });
    }
    if (cacheSizesMissing.length) {
        gaps.push({
            category: 'storage-cache-sizes',
            severity: 'low',
            detail: 'Cache drive sizes in catalog not in Sizer: [' + cacheSizesMissing.join(', ') + '] TB',
            missingSizesTB: cacheSizesMissing.slice(),
        });
    }

    // ---- GPUs --------------------------------------------------------------
    const catalogGpus = new Map(); // sizerKey -> count of configurations mentioning it
    const unmappedGpuTokens = new Set();
    for (const p of snapshot.platforms) {
        for (const c of p.configurations) {
            const g = c.gpuDetails;
            if (!g || !g.isGpuSupported) continue;
            const models = []
                .concat(parseGpuModelsFromString(g.gpuDda))
                .concat(parseGpuModelsFromString(g.gpuP));
            const uniq = new Set(models);
            uniq.forEach((model) => {
                const key = sizerGpuKeyFromCatalogName(model);
                if (!sizer.gpuModels[key]) unmappedGpuTokens.add(model);
                catalogGpus.set(key, (catalogGpus.get(key) || 0) + 1);
            });
        }
    }

    const sizerGpuKeys = Object.keys(sizer.gpuModels);
    const catalogOnlyGpus = [...catalogGpus.keys()].filter((k) => !sizer.gpuModels[k]);
    const sizerOnlyGpus = sizerGpuKeys.filter((k) => !catalogGpus.has(k));

    // The "unmapped GPU tokens" list is meant to surface raw catalog strings that
    // don't tokenize cleanly into any known model (e.g. partial fragments like
    // "RTX" / "6000" if the parser misbehaved). When the normalized key for a raw
    // token is already reported in catalogOnly, it's just a missing GPU — not a
    // mapping-rule problem — so suppress the duplicate. Comparison is case-
    // insensitive to avoid the same model appearing twice as "a100" and "A100".
    const catalogOnlyKeysLower = new Set(catalogOnlyGpus.map((k) => k.toLowerCase()));
    const trulyUnmappedTokens = [...unmappedGpuTokens].filter((tok) => {
        const k = sizerGpuKeyFromCatalogName(tok).toLowerCase();
        return !catalogOnlyKeysLower.has(k);
    });

    findings.push({
        category: 'gpu-coverage',
        catalogGpus: [...catalogGpus.entries()].map(([k, n]) => ({ key: k, configurations: n })),
        sizerGpus: sizerGpuKeys,
        sizerOnly: sizerOnlyGpus,
        catalogOnly: catalogOnlyGpus,
        unmappedRawTokens: trulyUnmappedTokens,
    });

    if (catalogOnlyGpus.length) {
        gaps.push({
            category: 'gpu-missing-in-sizer',
            severity: 'medium',
            detail: 'GPUs mentioned in catalog but absent from Sizer GPU_MODELS: ' + catalogOnlyGpus.join(', '),
        });
    }
    // Sizer-only GPUs are not a "gap"; Sizer is allowed to list any GPU sanctioned by the Azure Local supported-GPU docs.

    // ---- Networking --------------------------------------------------------
    const catalogNicSpeeds = new Set();
    const catalogRdmaTypes = new Set();
    for (const p of snapshot.platforms) {
        for (const c of p.configurations) {
            const n = c.networkingDetails;
            if (!n) continue;
            if (n.networkingSpeed) catalogNicSpeeds.add(n.networkingSpeed);
            if (n.rdmaType) {
                String(n.rdmaType).split(/[,\s/|]+/).map((x) => x.trim()).filter(Boolean).forEach((x) => catalogRdmaTypes.add(x));
            }
        }
    }
    findings.push({
        category: 'networking',
        catalogNicSpeedsGbps: [...catalogNicSpeeds].sort((a, b) => a - b),
        catalogRdmaTypes: [...catalogRdmaTypes],
        sizerNicSpeedSelector: 'NOT_EXPOSED', // Sizer does not currently surface a NIC-speed dimension
    });

    // ---- Solution capabilities & form factors -------------------------------
    const catalogCapabilities = new Set();
    const catalogFormFactors = new Set();
    const catalogArchitectures = new Set();
    for (const p of snapshot.platforms) {
        if (p.formFactor) catalogFormFactors.add(p.formFactor);
        for (const c of p.configurations) {
            (c.solutionCapabilities || []).forEach((x) => catalogCapabilities.add(x));
            if (c.architecture) catalogArchitectures.add(c.architecture);
        }
    }
    findings.push({
        category: 'capabilities',
        capabilities: [...catalogCapabilities],
        formFactors: [...catalogFormFactors],
        architectures: [...catalogArchitectures],
    });

    return {
        snapshotCapturedAt: snapshot.capturedAt,
        snapshotSource: snapshot.source,
        platformCount: snapshot.platforms.length,
        configurationCount: snapshot.platforms.reduce((s, p) => s + p.configurations.length, 0),
        cpuGapsByFamily,
        // Filter out gaps that match a documented design exception. Both lists
        // are exposed on the result so reports can show "real" gaps separately
        // from "things we've already considered and chosen to leave out".
        ...(function partitionGaps() {
            const { gaps: remainingGaps, designExceptions } = partitionDesignExceptions(gaps);
            return { gaps: remainingGaps, designExceptions };
        }()),
        findings,
    };
}

// ----------------------------------------------------------------------------
// Reporting
// ----------------------------------------------------------------------------

function formatReport(result) {
    const out = [];
    const sep = '════════════════════════════════════════════════════════════════════';
    out.push(sep);
    out.push(' Catalog Gap Analysis — Sizer vs. Azure Local Solutions Catalog');
    out.push(sep);
    out.push(' Snapshot captured: ' + result.snapshotCapturedAt);
    out.push(' Snapshot source:   ' + result.snapshotSource);
    out.push(' Platforms:         ' + result.platformCount);
    out.push(' Configurations:    ' + result.configurationCount);
    out.push('');

    // CPU table
    out.push('  CPU generation coverage');
    out.push('  -----------------------');
    Object.values(result.cpuGapsByFamily).forEach((row) => {
        const label = (row.catalogLabel || row.family).trim();
        out.push('    Catalog: ' + label);
        out.push('      Sizer generations:    ' + row.sizerGenerations.join(', '));
        out.push('      Catalog cores/socket: [' + row.catalogCoresPerSocket.join(', ') + ']');
        out.push('      Sizer cores/socket:   [' + row.sizerCoreOptions.join(', ') + ']');
        if (row.missingInSizer.length) {
            out.push('      MISSING in Sizer:     [' + row.missingInSizer.join(', ') + ']');
        }
        if (row.catalogMaxSeen > row.sizerMaxCores) {
            out.push('      CAT max ' + row.catalogMaxSeen + ' > Sizer max ' + row.sizerMaxCores);
        }
        out.push('');
    });

    // Memory
    const mem = result.findings.find((f) => f.category === 'memory');
    if (mem) {
        out.push('  Memory');
        out.push('  ------');
        out.push('    Catalog range: ' + mem.catalogMinGB + '–' + mem.catalogMaxGB + ' GB per node');
        out.push('    Sizer range:   ' + mem.sizerMinGB + '–' + mem.sizerMaxGB + ' GB per node');
        out.push('');
    }

    // Storage
    const sc = result.findings.find((f) => f.category === 'storage-counts');
    const ss = result.findings.find((f) => f.category === 'storage-sizes');
    if (sc && ss) {
        out.push('  Storage');
        out.push('  -------');
        out.push('    Catalog max capacity disks/node: ' + sc.catalogMaxCapDrives);
        out.push('    Catalog max cache disks/node:    ' + sc.catalogMaxCacheDrives);
        out.push('    Sizer single-tier cap max:        ' + sc.sizerCapDiskMax);
        out.push('    Sizer two-tier cap max:           ' + sc.sizerTieredCapMax);
        out.push('    Sizer cache max:                  ' + sc.sizerCacheDiskMax);
        out.push('    Catalog capacity drive sizes TB: [' + ss.catalogCapacityTB.join(', ') + ']');
        out.push('    Sizer capacity drive sizes TB:   [' + ss.sizerCapacityTB.join(', ') + ']');
        out.push('    Catalog cache drive sizes TB:    [' + ss.catalogCacheTB.join(', ') + ']');
        out.push('    Sizer cache drive sizes TB:      [' + ss.sizerCacheTB.join(', ') + ']');
        out.push('');
    }

    // GPU
    const gpu = result.findings.find((f) => f.category === 'gpu-coverage');
    if (gpu) {
        out.push('  GPUs');
        out.push('  ----');
        out.push('    Catalog GPUs (configs mentioning each):');
        gpu.catalogGpus.sort((a, b) => b.configurations - a.configurations).forEach((g) => {
            const inSizer = gpu.sizerGpus.includes(g.key) ? '✓' : '⚠';
            out.push('      ' + inSizer + ' ' + g.key + '  (' + g.configurations + ' config(s))');
        });
        if (gpu.sizerOnly.length) {
            out.push('    Sizer-only GPUs (not in catalog):  ' + gpu.sizerOnly.join(', '));
        }
        if (gpu.catalogOnly.length) {
            out.push('    Catalog-only GPUs (gap):           ' + gpu.catalogOnly.join(', '));
        }
        if (gpu.unmappedRawTokens.length) {
            out.push('    Unmapped GPU tokens (review map):  ' + gpu.unmappedRawTokens.join(', '));
        }
        out.push('');
    }

    // Network
    const net = result.findings.find((f) => f.category === 'networking');
    if (net) {
        out.push('  Networking');
        out.push('  ----------');
        out.push('    Catalog NIC speeds (Gbps): [' + net.catalogNicSpeedsGbps.join(', ') + ']');
        out.push('    Catalog RDMA types:        ' + net.catalogRdmaTypes.join(', '));
        out.push('    Sizer NIC speed dimension: ' + net.sizerNicSpeedSelector);
        out.push('');
    }

    // Capabilities
    const cap = result.findings.find((f) => f.category === 'capabilities');
    if (cap) {
        out.push('  Capabilities seen in catalog');
        out.push('  ----------------------------');
        out.push('    Solution capabilities: ' + cap.capabilities.join(', '));
        out.push('    Architectures:         ' + cap.architectures.join(', '));
        out.push('    Form factors:          ' + cap.formFactors.join(', '));
        out.push('');
    }

    // Gap summary
    const designExceptions = result.designExceptions || [];
    out.push('  ────────────────────────────────────────────────────────────────');
    if (result.gaps.length === 0) {
        if (designExceptions.length === 0) {
            out.push('  RESULT: No gaps detected — Sizer options cover the catalog surface.');
        } else {
            out.push('  RESULT: No new gaps detected — ' + designExceptions.length +
                ' known design exception(s) (see below, all by design).');
        }
    } else {
        out.push('  RESULT: ' + result.gaps.length + ' gap(s) detected' +
            (designExceptions.length ? ' (plus ' + designExceptions.length + ' known design exception(s) below).' : '.'));
        out.push('  ────────────────────────────────────────────────────────────────');
        result.gaps.forEach((g, i) => {
            out.push('    [' + (i + 1) + '] (' + g.severity + ') [' + g.category + ']');
            g.detail.split('\n').forEach((l) => out.push('        ' + l));
        });
    }

    // Known design exceptions — intentional Sizer-vs-catalog deviations
    if (designExceptions.length) {
        out.push('  ────────────────────────────────────────────────────────────────');
        out.push('  Known design exceptions (BY DESIGN — not counted as gaps)');
        out.push('  ────────────────────────────────────────────────────────────────');
        designExceptions.forEach((d, i) => {
            out.push('    [' + (i + 1) + '] [' + d.category + ']  id=' + d.id);
            d.detail.split('\n').forEach((l) => out.push('        ' + l));
            out.push('        reason: ' + d.reason);
        });
    }
    out.push(sep);
    return out.join('\n');
}

// ----------------------------------------------------------------------------
// Entry points
// ----------------------------------------------------------------------------

async function main(argv) {
    const live = argv.includes('--live');
    const updateSnapshot = argv.includes('--update-snapshot');
    const strict = argv.includes('--strict');
    const json = argv.includes('--json');

    const sizer = loadSizerOptions();

    let snapshot;
    if (live) {
        const raw = await fetchLiveCatalog();
        snapshot = slimSnapshot(raw);
        if (updateSnapshot) {
            // Snapshot refresh is an explicit, developer-initiated build action
            // (only runs with --update-snapshot). The destination is a fixed
            // repo path (SNAPSHOT_PATH constant), never user-controlled, so the
            // network response can never influence WHERE we write. The content
            // is round-tripped through JSON.stringify/parse so what hits disk
            // is a freshly serialized plain-JSON object literal — no prototype
            // pollution, no executable payload. (Satisfies CodeQL alert #34.)
            const safeBody = JSON.stringify(JSON.parse(JSON.stringify(snapshot)), null, 2) + '\n';
            fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
            fs.writeFileSync(SNAPSHOT_PATH, safeBody, 'utf8');
            process.stdout.write('Catalog snapshot refreshed: ' + path.relative(REPO_ROOT, SNAPSHOT_PATH) + '\n');
        }
    } else {
        snapshot = loadSnapshot();
    }

    const result = runGapAnalysis(snapshot, sizer);

    if (json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
        process.stdout.write(formatReport(result) + '\n');
    }

    if (strict && result.gaps.length) {
        process.exitCode = 1;
    }
    return result;
}

module.exports = {
    loadSizerOptions,
    loadSnapshot,
    fetchLiveCatalog,
    slimSnapshot,
    runGapAnalysis,
    formatReport,
    main,
};

if (require.main === module) {
    main(process.argv.slice(2)).catch((err) => {
        process.stderr.write('catalog-gap-check failed: ' + (err && err.message ? err.message : err) + '\n');
        process.exit(2);
    });
}
