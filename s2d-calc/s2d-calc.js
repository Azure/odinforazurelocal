/*
 * S2D Calc calculation logic adapted from:
 * https://github.com/troettinger/TomTools/blob/master/S2D/calculator.html
 *
 * MIT License
 *
 * Copyright (c) 2018 Thomas Roettinger
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function() {
    'use strict';

    const CONSTANTS = Object.freeze({
        usableRecords: 32768,
        nodeFailureSupportedPercent: 0.5,
        maxVolumeTB: 64,
        maxVolumesPerCluster: 64,
        reservationDrivesCap: 4,
        maxPoolTB: 4000,
        volumeOverheadTB: 0.5,
        minimumDrivesPerNode: 2,
        maximumDrivesPerNode: 24,
        minimumCustomDiskSizeTB: 0.1,
        maximumCustomDiskSizeTB: 100,
        azureLocalInfrastructureVolumeGB: 256,
        azureLocalClusterPerformanceHistoryGB: 20,
        minimumNodes: Object.freeze({
            2: 1,
            3: 3,
            4: 4
        }),
        defaultPlatform: 'azureLocal',
        platforms: Object.freeze({
            azureLocal: Object.freeze({
                label: 'Azure Local',
                extentMiB: Object.freeze({ thin: 1024, fixed: 1024 }),
                maximumNodes: Object.freeze({ 4: 8 }),
                fourCopyDoc: Object.freeze({
                    href: 'https://learn.microsoft.com/en-us/azure/azure-local/concepts/rack-aware-cluster-requirements',
                    text: 'Learn more about rack-aware cluster requirements'
                })
            }),
            windowsServer: Object.freeze({
                label: 'Windows Server',
                extentMiB: Object.freeze({ thin: 256, fixed: 1024 }),
                maximumNodes: Object.freeze({ 4: 10 }),
                fourCopyDoc: Object.freeze({
                    href: 'https://learn.microsoft.com/en-us/windows-server/failover-clustering/topologies',
                    text: 'Learn more about failover cluster topologies'
                })
            })
        })
    });

    function formatNodeList(values) {
        if (values.length === 0) return '';
        if (values.length === 1) return String(values[0]);
        return `${values.slice(0, -1).join(', ')}, or ${values[values.length - 1]}`;
    }

    function validateConfiguration(configuration) {
        const normalized = configuration && typeof configuration === 'object' ? configuration : {};
        const nodes = normalized.nodes;
        const copies = normalized.copies;
        const provisioning = normalized.provisioning;
        const thinExtentMiB = normalized.thinExtentMiB === undefined ? 1024 : normalized.thinExtentMiB;
        const platform = normalized.platform || CONSTANTS.defaultPlatform;
        const platformConfig = CONSTANTS.platforms[platform];
        const errors = [];
        const validNodeRange = Number.isInteger(nodes) && nodes >= 1 && nodes <= 16;

        if (!validNodeRange) {
            errors.push('Machine count must be a whole number from 1 through 16.');
        }
        if (copies !== 2 && copies !== 3 && copies !== 4) {
            errors.push('Data copies must be 2, 3, or 4.');
        }
        if (provisioning !== 'thin' && provisioning !== 'fixed') {
            errors.push('Provisioning must be Thin or Fixed.');
        }
        if (platform === 'azureLocal' && provisioning === 'thin' && thinExtentMiB !== 256 && thinExtentMiB !== 1024) {
            errors.push('Thin extent size must be 256 MiB or 1 GiB.');
        }
        if (!platformConfig) {
            errors.push('Platform must be Azure Local or Windows Server.');
        }

        const minimum = CONSTANTS.minimumNodes[copies];
        if (minimum && validNodeRange && nodes < minimum) {
            errors.push(`${copies} copies of data require at least ${minimum} machines (increase the machine count).`);
        }

        const maximum = platformConfig ? platformConfig.maximumNodes[copies] : undefined;
        if (maximum && validNodeRange && nodes > maximum) {
            errors.push(`${copies} copies support at most ${maximum} machines.`);
        }

        if (copies === 4 && validNodeRange && minimum && maximum && nodes >= minimum && nodes <= maximum && nodes % 2 !== 0) {
            const evenNodeCounts = [];
            for (let candidate = minimum; candidate <= maximum; candidate += 2) {
                evenNodeCounts.push(candidate);
            }
            errors.push(`4 copies require an even machine count (${formatNodeList(evenNodeCounts)}).`);
        }

        return { valid: errors.length === 0, errors };
    }

    function calculateLimit(configuration) {
        const validation = validateConfiguration(configuration);
        if (!validation.valid) return { valid: false, errors: validation.errors };

        const nodes = configuration.nodes;
        const copies = configuration.copies;
        const provisioning = configuration.provisioning;
        const thinExtentMiB = configuration.thinExtentMiB === undefined ? 1024 : configuration.thinExtentMiB;
        const platform = configuration.platform || CONSTANTS.defaultPlatform;
        const platformConfig = CONSTANTS.platforms[platform];
        const extentMiB = platform === 'azureLocal' && provisioning === 'thin'
            ? thinExtentMiB
            : platformConfig.extentMiB[provisioning];
        const effectiveNodes = nodes === 1 && copies === 2 ? 2 : nodes;
        const baseExactTB = copies === 4
            ? (CONSTANTS.usableRecords * extentMiB) /
                (CONSTANTS.nodeFailureSupportedPercent * copies * 1024 * 1024)
            : (CONSTANTS.usableRecords * effectiveNodes * extentMiB) /
                (2 * copies * 1024 * 1024);
        const cappedTB = Math.min(baseExactTB, CONSTANTS.maxVolumeTB);
        const exactTB = Math.max(cappedTB - CONSTANTS.volumeOverheadTB, 0);
        const baseSpaceMiB = baseExactTB * 1024 * 1024;
        const numberOfExtents = (copies * baseSpaceMiB) / extentMiB;
        const records = copies === 4
            ? CONSTANTS.nodeFailureSupportedPercent * numberOfExtents
            : (2 / effectiveNodes) * numberOfExtents;

        return {
            valid: true,
            baseExactTB,
            exactTB,
            capped: baseExactTB > CONSTANTS.maxVolumeTB,
            maxVolumeTB: CONSTANTS.maxVolumeTB,
            volumeOverheadTB: CONSTANTS.volumeOverheadTB,
            extentMiB,
            extentGiB: extentMiB / 1024,
            numberOfExtents,
            selectedNodes: nodes,
            effectiveNodes,
            records,
            usableRecords: CONSTANTS.usableRecords
        };
    }

    function formatLimit(value) {
        const floored = Math.floor(value * 10) / 10;
        return Number.isInteger(floored) ? String(floored) : floored.toFixed(1);
    }

    function formatThinVolumeLimit(maxVolumeTB) {
        return `but cannot exceed ${formatLimit(maxVolumeTB)} TB each`;
    }

    function calculatePoolConsumption(input) {
        const normalized = input && typeof input === 'object' ? input : {};
        const servers = normalized.servers;
        const maxVolumeTB = normalized.maxVolumeTB;
        const copies = normalized.copies;
        const tiering = normalized.tiering === true;
        const errors = [];
        const isDriveCountInRange = value => Number.isInteger(value) &&
            value >= CONSTANTS.minimumDrivesPerNode && value <= CONSTANTS.maximumDrivesPerNode;
        const isDiskSizeInRange = value => typeof value === 'number' && Number.isFinite(value) &&
            value >= CONSTANTS.minimumCustomDiskSizeTB && value <= CONSTANTS.maximumCustomDiskSizeTB;

        if (!Number.isInteger(servers) || servers < 1) {
            errors.push('Server count must be a whole number of at least 1.');
        }
        if (typeof maxVolumeTB !== 'number' || !Number.isFinite(maxVolumeTB) || maxVolumeTB <= 0) {
            errors.push('Maximum volume size must be greater than 0 TB.');
        }
        if (copies !== 2 && copies !== 3 && copies !== 4) {
            errors.push('Data copies must be 2, 3, or 4.');
        }

        if (tiering) {
            if (!isDriveCountInRange(normalized.cacheDrivesPerNode)) {
                errors.push('Cache drives per machine must be a whole number from 2 through 24.');
            }
            if (!isDriveCountInRange(normalized.capacityDrivesPerNode)) {
                errors.push('Capacity drives per machine must be a whole number from 2 through 24.');
            }
            if (isDriveCountInRange(normalized.cacheDrivesPerNode) &&
                isDriveCountInRange(normalized.capacityDrivesPerNode) &&
                normalized.cacheDrivesPerNode > normalized.capacityDrivesPerNode) {
                errors.push('Cache drives per machine cannot exceed capacity drives per machine.');
            }
            if (!isDiskSizeInRange(normalized.cacheDiskSizeTB)) {
                errors.push('Cache disk size must be a number from 0.1 to 100 TB.');
            }
            if (!isDiskSizeInRange(normalized.capacityDiskSizeTB)) {
                errors.push('Capacity disk size must be a number from 0.1 to 100 TB.');
            }
        } else {
            if (!isDriveCountInRange(normalized.drivesPerNode)) {
                errors.push('Drives per machine must be a whole number from 2 through 24.');
            }
            if (!isDiskSizeInRange(normalized.driveSizeTB)) {
                errors.push('Custom disk size must be a number from 0.1 to 100 TB.');
            }
        }

        if (errors.length > 0) return { valid: false, errors };

        const cacheTB = tiering ? servers * normalized.cacheDrivesPerNode * normalized.cacheDiskSizeTB : 0;
        const rawPoolTB = tiering
            ? servers * normalized.capacityDrivesPerNode * normalized.capacityDiskSizeTB
            : servers * normalized.drivesPerNode * normalized.driveSizeTB;

        if (rawPoolTB > CONSTANTS.maxPoolTB) {
            return {
                valid: true,
                poolCapped: true,
                rawPoolTB,
                cacheTB,
                maxPoolTB: CONSTANTS.maxPoolTB,
                servers,
                tiering
            };
        }

        const reservedDrives = Math.min(servers, CONSTANTS.reservationDrivesCap);
        const reservationDiskSizeTB = tiering ? normalized.capacityDiskSizeTB : normalized.driveSizeTB;
        const reservedTB = reservedDrives * reservationDiskSizeTB;
        const availableTB = Math.max(rawPoolTB - reservedTB, 0);
        const platform = normalized.platform || CONSTANTS.defaultPlatform;
        const infrastructureReservedTB = platform === 'azureLocal'
            ? (CONSTANTS.azureLocalInfrastructureVolumeGB + CONSTANTS.azureLocalClusterPerformanceHistoryGB) / 1000
            : 0;
        const usableBeforeInfrastructureTB = availableTB / copies;
        const usableTB = Math.max(usableBeforeInfrastructureTB - infrastructureReservedTB, 0);
        const exactVolumes = usableTB / maxVolumeTB;
        const capacityRequiredVolumes = usableTB > 0 ? Math.ceil(exactVolumes - 1e-9) : 0;
        const requiredVolumes = usableTB > 0 ? Math.max(capacityRequiredVolumes, servers) : 0;
        const volumesNeeded = Math.min(requiredVolumes, CONSTANTS.maxVolumesPerCluster);
        const equalVolumeTB = requiredVolumes > CONSTANTS.maxVolumesPerCluster || volumesNeeded === 0
            ? null
            : usableTB / volumesNeeded;

        return {
            valid: true,
            tiering,
            rawPoolTB,
            cacheTB,
            poolCapped: false,
            maxPoolTB: CONSTANTS.maxPoolTB,
            reservedDrives,
            reservationDiskSizeTB,
            reservedTB,
            availableTB,
            platform,
            infrastructureReservedTB,
            usableBeforeInfrastructureTB,
            usableTB,
            copies,
            exactVolumes,
            capacityRequiredVolumes,
            volumesNeeded,
            equalVolumeTB,
            cappedAtLimit: requiredVolumes > CONSTANTS.maxVolumesPerCluster,
            maxVolumes: CONSTANTS.maxVolumesPerCluster,
            servers,
            maxVolumeTB
        };
    }

    function buildExportReport(snapshot) {
        const config = snapshot.config;
        const results = snapshot.results;
        const pool = snapshot.pool;
        const lines = [
            'Storage Spaces Direct - Storage Planning Report',
            `Generated: ${snapshot.generatedAt}`,
            '',
            'CONFIGURATION',
            `  Platform:            ${config.platformLabel}`,
            `  Machine count:       ${config.nodes}`,
            `  Data copies:         ${config.copies}`,
            `  Provisioning:        ${config.provisioningLabel}`
        ];

        if (config.thinExtentLabel) lines.push(`  Thin extent size:    ${config.thinExtentLabel}`);
        if (config.tiering) {
            lines.push('  Disk configuration:  Storage tiering');
            lines.push(`    Cache:             ${config.tiered.cacheDrives} drives x ${config.tiered.cacheSizeTB} TB`);
            lines.push(`    Capacity:          ${config.tiered.capacityDrives} drives x ${config.tiered.capacitySizeTB} TB`);
        } else {
            lines.push('  Disk configuration:  Single disk type');
            lines.push(`    Drives per machine: ${config.single.drives}`);
            lines.push(`    Disk size:         ${config.single.sizeTB} TB`);
        }

        lines.push('', 'RESULTS');
        if (results.valid) {
            lines.push(`  Maximum volume size: ${results.headline}`);
            lines.push(`  ${results.summary}`);
            lines.push('  Derivation:');
            results.derivation.forEach(line => lines.push(`    ${line}`));
        } else {
            lines.push(`  Results unavailable: ${results.validationMessage}`);
        }

        lines.push('', 'POOL CONSUMPTION');
        if (pool.state === 'ok') {
            lines.push(`  Total pool capacity: ${pool.capacity}`);
            lines.push(`  ${pool.reservedLabel}: ${pool.reserved}`);
            lines.push(`  Available pool capacity: ${pool.available}`);
            lines.push(`  Usable capacity (${config.copies} copies): ${pool.usable}`);
            if (pool.infrastructureNote) lines.push(`  ${pool.infrastructureNote}`);
            lines.push(`  Volumes to create:   ${pool.volumes}`);
            lines.push(`  ${pool.volumeSizing}`);
        } else {
            lines.push(`  ${pool.message}`);
        }

        return lines.join('\n');
    }

    const S2D_ONBOARDING_KEY = 'odin_s2d_onboarding_v0_23_01';
    const S2D_STATE_KEY = 'odin_s2d_calc_state';
    const S2D_STATE_VERSION = 1;
    const MAX_SHARED_CONFIG_CHARS = 12000;

    function isValidSharedState(payload) {
        if (!payload || payload.version !== S2D_STATE_VERSION || !payload.data || typeof payload.data !== 'object') return false;
        if (payload.name !== undefined && (typeof payload.name !== 'string' || payload.name.length > 100)) return false;
        const requiredFields = [
            'platform', 'nodes', 'copies', 'provisioning', 'thinExtentMiB', 'tiering',
            'drivesPerNode', 'diskSize', 'customDiskSize', 'cacheDrives', 'cacheDiskSize',
            'cacheCustomDiskSize', 'capacityDrives', 'capacityDiskSize', 'capacityCustomDiskSize'
        ];
        if (!requiredFields.every(field => typeof payload.data[field] === 'string')) return false;
        if (!['azureLocal', 'windowsServer'].includes(payload.data.platform)) return false;
        if (!['2', '3', '4'].includes(payload.data.copies)) return false;
        if (!['thin', 'fixed'].includes(payload.data.provisioning)) return false;
        if (!['256', '1024'].includes(payload.data.thinExtentMiB)) return false;
        if (!['single', 'tiered'].includes(payload.data.tiering)) return false;
        const nodes = Number(payload.data.nodes);
        if (!Number.isInteger(nodes) || nodes < 1 || nodes > 16) return false;

        const driveFields = ['drivesPerNode', 'cacheDrives', 'capacityDrives'];
        if (!driveFields.every(field => {
            const value = Number(payload.data[field]);
            return Number.isInteger(value) && value >= 2 && value <= 24;
        })) return false;

        const sizeFields = [
            ['diskSize', 'customDiskSize'],
            ['cacheDiskSize', 'cacheCustomDiskSize'],
            ['capacityDiskSize', 'capacityCustomDiskSize']
        ];
        return sizeFields.every(([sizeField, customField]) => {
            const selectedSize = payload.data[sizeField];
            const customValue = payload.data[customField];
            if (!['3.2', '6.4', '12.4', 'custom'].includes(selectedSize)) return false;
            if (customValue === '') return selectedSize !== 'custom';
            const customSize = Number(customValue);
            return Number.isFinite(customSize) && customSize >= 0.1 && customSize <= 100;
        });
    }

    function encodeSharedConfiguration(payload) {
        if (!isValidSharedState(payload)) throw new TypeError('Invalid S2D Calc share payload.');
        return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    }

    function decodeSharedConfiguration(configParam) {
        if (typeof configParam !== 'string' || !configParam || configParam.length > MAX_SHARED_CONFIG_CHARS) return null;
        try {
            const payload = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(configParam)))));
            return isValidSharedState(payload) ? payload : null;
        } catch (_) {
            return null;
        }
    }

    function createCalculationTelemetryGate() {
        let hasTrackedCalculation = false;
        return function(valid) {
            if (hasTrackedCalculation || !valid) return false;
            hasTrackedCalculation = true;
            return true;
        };
    }

    globalThis.volumeCalculator = Object.freeze({
        CONSTANTS,
        validateConfiguration,
        calculateLimit,
        formatLimit,
        formatThinVolumeLimit,
        calculatePoolConsumption,
        buildExportReport,
        createCalculationTelemetryGate,
        encodeSharedConfiguration,
        decodeSharedConfiguration
    });
    const s2dOnboardingSteps = [
        {
            icon: '<img src="../images/odin-logo.png" alt="ODIN Logo" style="width: 100px; height: 100px; object-fit: contain;">',
            isImage: true,
            title: 'Welcome to the S2D Calculator',
            description: 'Plan maximum supported individual volume sizes and storage-pool consumption for Azure Local or Windows Server.',
            features: [
                { icon: '1', title: 'Choose a Platform', text: 'Select Azure Local or Windows Server so the calculator applies the matching extent and topology rules' },
                { icon: '2', title: 'Set Resiliency', text: 'Choose the physical machine count, data copies, and thin or fixed provisioning model' },
                { icon: '3', title: 'Review the Limit', text: 'The blue result shows the maximum supported usable volume size for the selected configuration' }
            ]
        },
        {
            icon: 'S2D 💽',
            title: 'Estimate Pool Consumption',
            description: 'Model the physical disks in each machine to estimate usable pool capacity and volume count.',
            features: [
                { icon: '1', title: 'Choose Disk Layout', text: 'Use a single disk type or separate cache and capacity tiers' },
                { icon: '2', title: 'Enter Disk Details', text: 'Set drives per machine and select a standard or custom disk size' },
                { icon: '3', title: 'Read the Estimate', text: 'Review raw capacity, rebuild reservation, available capacity, and usable capacity' },
                { icon: '4', title: 'Plan Volumes', text: 'See how many volumes to create and compare equal-size Fixed volumes with dynamic Thin provisioning' }
            ]
        },
        {
            icon: '<span class="s2d-report-help-icon" aria-hidden="true"><span>📄</span><span>?</span></span>',
            title: 'Understand and Share the Result',
            description: 'Use the derivation and export tools to validate or share your planning assumptions.',
            features: [
                { icon: '1', title: 'Follow the Formula', text: 'The derivation explains record capacity, effective machine count, the base limit, and usable size' },
                { icon: '2', title: 'Compare Examples', text: 'Reference configurations highlight the row that matches your current valid selection' },
                { icon: '3', title: 'Export or Share', text: 'Download a text report or copy a named configuration URL that keeps your settings in the link' },
                { icon: 'i', title: 'Open Help Again', text: 'Use the Help button in the navigation bar whenever you want to replay this guide' }
            ]
        }
    ];
    let currentS2dOnboardingStep = 0;

    function closeS2dOnboarding() {
        try { localStorage.setItem(S2D_ONBOARDING_KEY, 'true'); } catch (_) { /* localStorage blocked */ }
        document.querySelectorAll('.onboarding-overlay').forEach(overlay => overlay.remove());
    }

    function renderS2dOnboardingStep() {
        const step = s2dOnboardingSteps[currentS2dOnboardingStep];
        document.querySelectorAll('.onboarding-overlay').forEach(overlay => overlay.remove());

        const overlay = document.createElement('div');
        overlay.className = 'onboarding-overlay';
        overlay.innerHTML = `
            <div class="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="s2d-onboarding-title">
                <div class="onboarding-icon${step.isImage ? ' onboarding-icon-image' : ''}">${step.icon}</div>
                <h2 class="onboarding-title" id="s2d-onboarding-title">${step.title}</h2>
                <p class="onboarding-description">${step.description}</p>
                <div class="onboarding-features">
                    ${step.features.map(feature => `
                        <div class="onboarding-feature">
                            <span class="onboarding-feature-icon">${feature.icon}</span>
                            <div class="onboarding-feature-text"><strong>${feature.title}</strong>${feature.text}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="onboarding-progress" aria-label="Step ${currentS2dOnboardingStep + 1} of ${s2dOnboardingSteps.length}">
                    ${s2dOnboardingSteps.map((_, index) => `<div class="onboarding-dot${index === currentS2dOnboardingStep ? ' active' : ''}"></div>`).join('')}
                </div>
                <div class="onboarding-buttons">
                    <button class="onboarding-btn onboarding-btn-secondary" data-action="skip">Skip</button>
                    <button class="onboarding-btn onboarding-btn-primary" data-action="next">${currentS2dOnboardingStep === s2dOnboardingSteps.length - 1 ? 'Get Started' : 'Next'}</button>
                </div>
            </div>`;

        overlay.querySelector('[data-action="skip"]').addEventListener('click', closeS2dOnboarding);
        overlay.querySelector('[data-action="next"]').addEventListener('click', () => {
            if (currentS2dOnboardingStep === s2dOnboardingSteps.length - 1) {
                closeS2dOnboarding();
                return;
            }
            currentS2dOnboardingStep += 1;
            renderS2dOnboardingStep();
        });
        document.body.appendChild(overlay);
        overlay.querySelector('[data-action="next"]').focus();
    }

    globalThis.showS2dOnboarding = function() {
        currentS2dOnboardingStep = 0;
        renderS2dOnboardingStep();
    };

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.querySelector('.onboarding-overlay')) closeS2dOnboarding();
    });

    function initializeCalculatorPage() {
        const form = document.getElementById('calculator-form');
        if (!form) return;

        const nodeRange = document.getElementById('node-range');
        const nodeNumber = document.getElementById('node-number');
        const resultCard = document.getElementById('result-card');
        const result = document.getElementById('result');
        const resultAnnouncement = document.getElementById('result-announcement');
        const resultSummary = document.getElementById('result-summary');
        const effectiveNodeNote = document.getElementById('effective-node-note');
        const validationMessage = document.getElementById('validation-message');
        const effectiveNodeFormula = document.getElementById('effective-node-formula');
        const substitution = document.getElementById('substitution');
        const logicalSubstitution = document.getElementById('logical-substitution');
        const thinExtentLabel = document.getElementById('thin-extent-label');
        const thinExtentFieldset = document.getElementById('thin-extent-fieldset');
        const thinExtentControls = form.querySelectorAll('input[name="thinExtentMiB"]');
        const fourCopyNote = document.getElementById('four-copy-note');
        const fourCopyNoteLink = document.getElementById('four-copy-note-link');
        const threeCopyRecommendation = document.getElementById('three-copy-recommendation');
        const threeCopyRecommendationBreak = document.getElementById('three-copy-recommendation-break');
        const exampleRows = document.querySelectorAll('[data-example]');
        const drivesPerNode = document.getElementById('drives-per-node');
        const diskSize = document.getElementById('disk-size');
        const customDiskSize = document.getElementById('custom-disk-size');
        const customDiskSizeField = document.getElementById('custom-disk-size-field');
        const tieringControls = document.getElementById('tiering-controls');
        const singleControls = document.getElementById('single-controls');
        const cacheDrives = document.getElementById('cache-drives-per-node');
        const cacheDiskSize = document.getElementById('cache-disk-size');
        const cacheCustomDiskSize = document.getElementById('cache-custom-disk-size');
        const cacheCustomDiskSizeField = document.getElementById('cache-custom-disk-size-field');
        const capacityDrives = document.getElementById('capacity-drives-per-node');
        const capacityDiskSize = document.getElementById('capacity-disk-size');
        const capacityCustomDiskSize = document.getElementById('capacity-custom-disk-size');
        const capacityCustomDiskSizeField = document.getElementById('capacity-custom-disk-size-field');
        const poolResults = document.getElementById('pool-results');
        const poolCapacity = document.getElementById('pool-capacity');
        const poolReserved = document.getElementById('pool-reserved');
        const poolReservedLabel = document.getElementById('pool-reserved-label');
        const poolAvailable = document.getElementById('pool-available');
        const poolUsable = document.getElementById('pool-usable');
        const poolUsableLabel = document.getElementById('pool-usable-label');
        const poolInfrastructureNote = document.getElementById('pool-infrastructure-note');
        const poolFormula = document.getElementById('pool-formula');
        const poolVolumes = document.getElementById('pool-volumes');
        const poolVolumesBlock = document.getElementById('pool-volumes-block');
        const poolVolumeSizing = document.getElementById('pool-volume-sizing');
        const poolVolumeSizingLabel = document.getElementById('pool-volume-sizing-label');
        const poolVolumeSizingValue = document.getElementById('pool-volume-sizing-value');
        const poolReservedLine = document.getElementById('pool-reserved-line');
        const poolAvailableLine = document.getElementById('pool-available-line');
        const poolUsableLine = document.getElementById('pool-usable-line');
        const poolCappedNote = document.getElementById('pool-capped-note');
        const poolCapNote = document.getElementById('pool-cap-note');
        const poolCapNoteLink = document.getElementById('pool-cap-note-link');
        const poolPlaceholder = document.getElementById('pool-placeholder');
        const poolValidationMessage = document.getElementById('pool-validation-message');
        const exportButton = document.getElementById('export-report');
        const resetButton = document.getElementById('reset-config');
        const shareButton = document.getElementById('share-url');
        let telemetryTimer = null;
        const claimCalculationTelemetry = createCalculationTelemetryGate();

        function selectedValue(name) {
            const selected = document.querySelector(`input[name="${name}"]:checked`);
            return selected ? selected.value : '';
        }

        function getConfiguration() {
            return {
                nodes: Number(nodeNumber.value),
                copies: Number(selectedValue('copies')),
                provisioning: selectedValue('provisioning'),
                thinExtentMiB: Number(selectedValue('thinExtentMiB')),
                platform: selectedValue('platform')
            };
        }

        function formatExtent(extentMiB) {
            return extentMiB >= 1024 ? `${extentMiB / 1024} GiB` : `${extentMiB} MiB`;
        }

        function formatExact(value) {
            return value.toFixed(2);
        }

        function synchronizeExtentControls() {
            const showExtent = selectedValue('platform') === 'azureLocal' && selectedValue('provisioning') === 'thin';
            thinExtentFieldset.hidden = !showExtent;
            if (!showExtent) {
                thinExtentControls.forEach(control => {
                    control.checked = control.value === '1024';
                });
            }
        }

        function clearSelectedExamples() {
            exampleRows.forEach(row => {
                row.removeAttribute('data-selected');
                const badge = row.querySelector('.s2d-selected');
                if (badge) badge.hidden = true;
            });
        }

        function renderVolume() {
            const configuration = getConfiguration();
            const calculation = calculateLimit(configuration);
            clearSelectedExamples();

            const platformConfig = CONSTANTS.platforms[configuration.platform] || CONSTANTS.platforms.azureLocal;
            const thinExtentForLabel = configuration.platform === 'azureLocal'
                ? configuration.thinExtentMiB
                : platformConfig.extentMiB.thin;
            thinExtentLabel.textContent = `${formatExtent(thinExtentForLabel)} extents`;

            if (configuration.copies === 4) {
                fourCopyNote.hidden = false;
                fourCopyNoteLink.href = platformConfig.fourCopyDoc.href;
                fourCopyNoteLink.textContent = platformConfig.fourCopyDoc.text;
            } else {
                fourCopyNote.hidden = true;
            }
            threeCopyRecommendation.hidden = !(configuration.nodes >= 3 && configuration.copies === 2);
            threeCopyRecommendationBreak.hidden = threeCopyRecommendation.hidden;

            if (!calculation.valid) {
                resultCard.setAttribute('data-state', 'invalid');
                result.hidden = true;
                resultSummary.hidden = true;
                effectiveNodeNote.hidden = true;
                validationMessage.hidden = false;
                validationMessage.textContent = calculation.errors.join(' ');
                nodeNumber.setAttribute('aria-invalid', 'true');
                resultAnnouncement.textContent = `Results unavailable. ${validationMessage.textContent}`;
                effectiveNodeFormula.textContent = 'Unavailable for the selected configuration';
                substitution.textContent = 'Correct the configuration to calculate the base limit.';
                logicalSubstitution.textContent = 'Correct the configuration to calculate usable volume size.';
                return calculation;
            }

            const extentLabel = formatExtent(calculation.extentMiB);
            const provisioningLabel = configuration.provisioning === 'thin' ? 'Thin' : 'Fixed';
            const nodeLabel = configuration.nodes === 1 ? '1 machine' : `${configuration.nodes} machines`;
            const selectedNodeLabel = calculation.selectedNodes === 1 ? 'selected machine' : 'selected machines';
            const effectiveNodeLabel = calculation.effectiveNodes === 1 ? 'effective machine' : 'effective machines';
            const showEffectiveNodeNote = calculation.selectedNodes === 1 && calculation.effectiveNodes === 2;

            resultCard.setAttribute('data-state', 'valid');
            result.hidden = false;
            result.textContent = `< ${formatLimit(calculation.exactTB)} TB`;
            resultSummary.hidden = false;
            resultSummary.textContent = `${configuration.copies} copies | ${provisioningLabel} provisioned | ${nodeLabel} | ${extentLabel} extents`;
            effectiveNodeNote.hidden = !showEffectiveNodeNote;
            effectiveNodeNote.textContent = showEffectiveNodeNote
                ? 'One selected machine is calculated as two effective machines for two-way mirror.'
                : '';
            validationMessage.hidden = true;
            validationMessage.textContent = '';
            nodeNumber.setAttribute('aria-invalid', 'false');
            effectiveNodeFormula.textContent = configuration.copies === 4
                ? 'Machine count does not affect four-copy volume size'
                : `${calculation.selectedNodes} ${selectedNodeLabel} = ${calculation.effectiveNodes} ${effectiveNodeLabel}`;
            substitution.textContent = configuration.copies === 4
                ? `32,768 x ${extentLabel} / 0.5 / 4 = ${formatExact(calculation.baseExactTB)} TB`
                : `32,768 x ${calculation.effectiveNodes} x ${extentLabel} / ${2 * configuration.copies} = ${formatExact(calculation.baseExactTB)} TB`;
            logicalSubstitution.textContent = calculation.capped
                ? `${formatExact(calculation.baseExactTB)} TB capped at ${calculation.maxVolumeTB} TB - ${calculation.volumeOverheadTB} TB overhead = ${formatExact(calculation.exactTB)} TB`
                : `${formatExact(calculation.baseExactTB)} TB - ${calculation.volumeOverheadTB} TB overhead = ${formatExact(calculation.exactTB)} TB`;

            const announcement = [result.textContent, resultSummary.textContent];
            if (!effectiveNodeNote.hidden) announcement.push(effectiveNodeNote.textContent);
            if (!threeCopyRecommendation.hidden) announcement.push(threeCopyRecommendation.textContent);
            resultAnnouncement.textContent = `${announcement.join('. ')}.`;

            const exampleKey = `${configuration.provisioning}-${configuration.nodes}-${configuration.copies}`;
            const matchingRow = calculation.extentMiB === 1024
                ? document.querySelector(`[data-example="${exampleKey}"]`)
                : null;
            if (matchingRow) {
                matchingRow.setAttribute('data-selected', 'true');
                const badge = matchingRow.querySelector('.s2d-selected');
                if (badge) badge.hidden = false;
            }

            return calculation;
        }

        function readSize(select, customInput) {
            return Number(select.value === 'custom' ? customInput.value : select.value);
        }

        function showPoolMessage(target, message) {
            poolResults.querySelectorAll('.s2d-alert').forEach(alert => {
                alert.hidden = true;
                alert.textContent = '';
            });
            poolCapNoteLink.hidden = true;
            poolPlaceholder.hidden = true;
            target.hidden = false;
            target.textContent = message;
        }

        function renderPool() {
            const tiering = selectedValue('tiering') === 'tiered';
            singleControls.hidden = tiering;
            tieringControls.hidden = !tiering;
            customDiskSizeField.hidden = diskSize.value !== 'custom';
            cacheCustomDiskSizeField.hidden = cacheDiskSize.value !== 'custom';
            capacityCustomDiskSizeField.hidden = capacityDiskSize.value !== 'custom';

            const volumeCalculation = calculateLimit(getConfiguration());
            if (!volumeCalculation.valid) {
                poolReservedLine.hidden = true;
                poolAvailableLine.hidden = true;
                poolUsableLine.hidden = true;
                poolInfrastructureNote.hidden = true;
                poolVolumesBlock.hidden = true;
                poolVolumeSizing.hidden = true;
                showPoolMessage(poolPlaceholder, 'Enter a valid volume configuration to calculate pool consumption.');
                return;
            }

            const input = tiering
                ? {
                    servers: volumeCalculation.selectedNodes,
                    maxVolumeTB: volumeCalculation.exactTB,
                    copies: getConfiguration().copies,
                    platform: getConfiguration().platform,
                    tiering: true,
                    cacheDrivesPerNode: Number(cacheDrives.value),
                    cacheDiskSizeTB: readSize(cacheDiskSize, cacheCustomDiskSize),
                    capacityDrivesPerNode: Number(capacityDrives.value),
                    capacityDiskSizeTB: readSize(capacityDiskSize, capacityCustomDiskSize)
                }
                : {
                    servers: volumeCalculation.selectedNodes,
                    maxVolumeTB: volumeCalculation.exactTB,
                    copies: getConfiguration().copies,
                    platform: getConfiguration().platform,
                    drivesPerNode: Number(drivesPerNode.value),
                    driveSizeTB: readSize(diskSize, customDiskSize)
                };
            const pool = calculatePoolConsumption(input);

            if (!pool.valid) {
                poolReservedLine.hidden = true;
                poolAvailableLine.hidden = true;
                poolUsableLine.hidden = true;
                poolInfrastructureNote.hidden = true;
                poolVolumesBlock.hidden = true;
                poolVolumeSizing.hidden = true;
                showPoolMessage(poolValidationMessage, pool.errors.join(' '));
                return;
            }

            const capacityLabel = `${formatLimit(pool.rawPoolTB)} TB`;
            const serverLabel = input.servers === 1 ? '1 server' : `${input.servers} servers`;
            poolCapacity.textContent = capacityLabel;
            poolFormula.textContent = tiering
                ? `${serverLabel} x ${input.capacityDrivesPerNode} capacity drives (each) x ${input.capacityDiskSizeTB} TB = ${capacityLabel}; cache drives do not add usable capacity`
                : `${serverLabel} x ${input.drivesPerNode} drives (each) x ${input.driveSizeTB} TB = ${capacityLabel}`;

            poolValidationMessage.hidden = true;
            poolPlaceholder.hidden = true;
            if (pool.poolCapped) {
                poolReservedLine.hidden = true;
                poolAvailableLine.hidden = true;
                poolUsableLine.hidden = true;
                poolInfrastructureNote.hidden = true;
                poolVolumesBlock.hidden = true;
                poolVolumeSizing.hidden = true;
                poolCappedNote.hidden = true;
                showPoolMessage(poolCapNote, 'A storage pool cannot exceed 4 PB (4,000 TB). Reduce the machine count, drives per machine, or disk size.');
                poolCapNoteLink.hidden = false;
                return;
            }

            poolCapNote.hidden = true;
            poolCapNoteLink.hidden = true;
            poolReservedLine.hidden = false;
            poolAvailableLine.hidden = false;
            poolUsableLine.hidden = false;
            poolVolumesBlock.hidden = false;
            poolVolumeSizing.hidden = pool.cappedAtLimit;
            poolReservedLabel.textContent = `Reserved for rebuild (${pool.reservedDrives} x drives)`;
            poolReserved.textContent = `${formatLimit(pool.reservedTB)} TB`;
            poolAvailable.textContent = `${formatLimit(pool.availableTB)} TB`;
            poolUsableLabel.textContent = `Usable capacity (with ${pool.copies} copies)`;
            poolUsable.textContent = `${formatLimit(pool.usableTB)} TB`;
            poolInfrastructureNote.hidden = pool.infrastructureReservedTB === 0;
            poolVolumes.textContent = pool.cappedAtLimit ? '64 max' : String(pool.volumesNeeded);
            if (!pool.cappedAtLimit && selectedValue('provisioning') === 'fixed') {
                poolVolumeSizingLabel.textContent = 'Equal volume size';
                poolVolumeSizingValue.textContent = `${formatLimit(pool.equalVolumeTB)} TB each`;
            } else if (!pool.cappedAtLimit) {
                poolVolumeSizingLabel.textContent = 'Thin provisioning';
                poolVolumeSizingValue.replaceChildren(
                    'Thin volumes use pool capacity',
                    document.createElement('br'),
                    'dynamically, as data is written,',
                    document.createElement('br'),
                    formatThinVolumeLimit(pool.maxVolumeTB)
                );
            }
            poolCappedNote.hidden = !pool.cappedAtLimit;
            poolCappedNote.textContent = pool.cappedAtLimit
                ? '64 maximum-size volumes cannot cover the whole pool.'
                : '';
        }

        function renderAll() {
            synchronizeExtentControls();
            renderVolume();
            renderPool();
        }

        function getSavedState() {
            try {
                const saved = JSON.parse(localStorage.getItem(S2D_STATE_KEY));
                return saved && saved.version === S2D_STATE_VERSION && saved.data ? saved : null;
            } catch (_) {
                return null;
            }
        }

        function clearSavedState() {
            try { localStorage.removeItem(S2D_STATE_KEY); } catch (_) { /* localStorage blocked */ }
        }

        function getStateData() {
            return {
                platform: selectedValue('platform'),
                nodes: nodeNumber.value,
                copies: selectedValue('copies'),
                provisioning: selectedValue('provisioning'),
                thinExtentMiB: selectedValue('thinExtentMiB'),
                tiering: selectedValue('tiering'),
                drivesPerNode: drivesPerNode.value,
                diskSize: diskSize.value,
                customDiskSize: customDiskSize.value,
                cacheDrives: cacheDrives.value,
                cacheDiskSize: cacheDiskSize.value,
                cacheCustomDiskSize: cacheCustomDiskSize.value,
                capacityDrives: capacityDrives.value,
                capacityDiskSize: capacityDiskSize.value,
                capacityCustomDiskSize: capacityCustomDiskSize.value
            };
        }

        function saveState() {
            const data = getStateData();
            try {
                localStorage.setItem(S2D_STATE_KEY, JSON.stringify({
                    version: S2D_STATE_VERSION,
                    timestamp: new Date().toISOString(),
                    data
                }));
            } catch (_) { /* localStorage blocked */ }
        }

        function applySavedState(saved) {
            const data = saved.data;
            setRadio('platform', data.platform);
            nodeNumber.value = data.nodes;
            setRadio('copies', data.copies);
            setRadio('provisioning', data.provisioning);
            setRadio('thinExtentMiB', data.thinExtentMiB);
            setRadio('tiering', data.tiering);
            drivesPerNode.value = data.drivesPerNode;
            diskSize.value = data.diskSize;
            customDiskSize.value = data.customDiskSize;
            cacheDrives.value = data.cacheDrives;
            cacheDiskSize.value = data.cacheDiskSize;
            cacheCustomDiskSize.value = data.cacheCustomDiskSize;
            capacityDrives.value = data.capacityDrives;
            capacityDiskSize.value = data.capacityDiskSize;
            capacityCustomDiskSize.value = data.capacityCustomDiskSize;
            nodeRange.value = nodeNumber.value;
            renderAll();
        }

        async function shareConfiguration() {
            const shareName = await globalThis.showTextInputDialog({
                title: 'Share S2D Calc configuration',
                message: 'Add an optional name to help recipients identify this configuration. The generated URL will be copied to your clipboard.',
                confirmLabel: 'Copy share URL',
                cancelLabel: 'Cancel',
                input: {
                    label: 'Configuration name (optional)',
                    maxLength: 100,
                    hint: 'The configuration remains in the URL and is not uploaded to a server.'
                }
            });
            if (shareName === null) return;

            const payload = { version: S2D_STATE_VERSION, data: getStateData() };
            if (shareName.trim()) payload.name = shareName.trim().substring(0, 100);
            const encoded = encodeSharedConfiguration(payload);
            const url = `${globalThis.location.origin}${globalThis.location.pathname}?config=${encodeURIComponent(encoded)}`;
            if (url.length > 8000) {
                showToast('Configuration is too large to share via URL.', 'error', 6000);
                return;
            }
            try {
                await navigator.clipboard.writeText(url);
                showToast('Shareable S2D Calc URL copied to clipboard!', 'success');
            } catch (_) {
                await globalThis.showCopyDialog({
                    title: 'Copy share URL',
                    message: 'Clipboard access was unavailable. Copy the selected URL below.',
                    label: 'Share URL',
                    value: url
                });
            }
        }

        function showSharedConfigurationBanner(name) {
            dismissResumeBanner();
            const banner = document.createElement('div');
            banner.id = 's2d-resume-banner';
            banner.className = 's2d-resume-banner';
            banner.setAttribute('role', 'status');
            const copy = document.createElement('div');
            copy.className = 's2d-resume-copy';
            const heading = document.createElement('strong');
            heading.textContent = name ? `Shared S2D Calc loaded: “${name}”` : 'Shared S2D Calc configuration loaded';
            const detail = document.createElement('span');
            detail.textContent = 'Review the loaded settings before using or sharing the results.';
            const actions = document.createElement('div');
            actions.className = 's2d-resume-actions';
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 's2d-resume-button s2d-resume-secondary';
            close.textContent = 'OK';
            close.addEventListener('click', dismissResumeBanner);
            copy.append(heading, detail);
            actions.appendChild(close);
            banner.append(copy, actions);
            document.body.appendChild(banner);
        }

        function loadConfigurationFromUrl() {
            const configParam = new URLSearchParams(globalThis.location.search).get('config');
            const payload = decodeSharedConfiguration(configParam);
            if (!payload) return false;
            try {
                applySavedState(payload);
                globalThis.history.replaceState(null, '', globalThis.location.pathname);
                const name = typeof payload.name === 'string' ? payload.name.trim().substring(0, 100) : '';
                showSharedConfigurationBanner(name);
                return true;
            } catch (error) {
                console.warn('Failed to load S2D Calc configuration from URL:', error);
                return false;
            }
        }

        function dismissResumeBanner() {
            const banner = document.getElementById('s2d-resume-banner');
            if (banner) banner.remove();
        }

        function showResumeBanner(saved) {
            const banner = document.createElement('div');
            const timestamp = saved.timestamp ? new Date(saved.timestamp).toLocaleString() : 'Unknown time';
            banner.id = 's2d-resume-banner';
            banner.className = 's2d-resume-banner';
            banner.setAttribute('role', 'status');
            banner.innerHTML = `
                <div class="s2d-resume-copy">
                    <strong>Previous S2D Calc Session Found</strong>
                    <span>Last saved: ${timestamp}</span>
                </div>
                <div class="s2d-resume-actions">
                    <button type="button" class="s2d-resume-button s2d-resume-primary" data-action="resume">Resume</button>
                    <button type="button" class="s2d-resume-button s2d-resume-secondary" data-action="fresh">Start Fresh</button>
                </div>`;
            banner.querySelector('[data-action="resume"]').addEventListener('click', () => {
                applySavedState(saved);
                dismissResumeBanner();
            });
            banner.querySelector('[data-action="fresh"]').addEventListener('click', () => {
                clearSavedState();
                resetConfiguration();
                dismissResumeBanner();
            });
            document.body.appendChild(banner);
        }

        function scheduleCalculationTelemetry() {
            if (telemetryTimer !== null) clearTimeout(telemetryTimer);
            telemetryTimer = setTimeout(() => {
                telemetryTimer = null;
                if (typeof trackFormCompletion === 'function'
                    && claimCalculationTelemetry(calculateLimit(getConfiguration()).valid)) {
                    trackFormCompletion('s2dCalculation');
                }
            }, 600);
        }

        function renderUserChange() {
            renderAll();
            saveState();
            scheduleCalculationTelemetry();
        }

        function setRadio(name, value) {
            document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
                radio.checked = radio.value === value;
            });
        }

        function resetConfiguration() {
            nodeNumber.value = '4';
            nodeRange.value = '4';
            setRadio('platform', 'azureLocal');
            setRadio('copies', '3');
            setRadio('provisioning', 'thin');
            setRadio('thinExtentMiB', '1024');
            setRadio('tiering', 'single');
            drivesPerNode.value = '8';
            diskSize.value = '6.4';
            customDiskSize.value = '';
            cacheDrives.value = '2';
            cacheDiskSize.value = '3.2';
            cacheCustomDiskSize.value = '';
            capacityDrives.value = '4';
            capacityDiskSize.value = '6.4';
            capacityCustomDiskSize.value = '';
            clearSavedState();
            renderAll();
        }

        function twoDigits(value) {
            return String(value).padStart(2, '0');
        }

        function collectExportSnapshot(date) {
            const configuration = getConfiguration();
            const tiering = selectedValue('tiering') === 'tiered';
            const showExtent = configuration.platform === 'azureLocal' && configuration.provisioning === 'thin';
            const config = {
                platformLabel: CONSTANTS.platforms[configuration.platform].label,
                nodes: configuration.nodes,
                copies: configuration.copies,
                provisioningLabel: configuration.provisioning === 'thin' ? 'Thin' : 'Fixed',
                thinExtentLabel: showExtent ? formatExtent(configuration.thinExtentMiB) : null,
                tiering
            };
            if (tiering) {
                config.tiered = {
                    cacheDrives: cacheDrives.value,
                    cacheSizeTB: readSize(cacheDiskSize, cacheCustomDiskSize),
                    capacityDrives: capacityDrives.value,
                    capacitySizeTB: readSize(capacityDiskSize, capacityCustomDiskSize)
                };
            } else {
                config.single = {
                    drives: drivesPerNode.value,
                    sizeTB: readSize(diskSize, customDiskSize)
                };
            }

            let pool;
            if (!poolPlaceholder.hidden) {
                pool = { state: 'invalid', message: poolPlaceholder.textContent };
            } else if (!poolValidationMessage.hidden) {
                pool = { state: 'invalid', message: poolValidationMessage.textContent };
            } else if (!poolCapNote.hidden) {
                pool = { state: 'capped', message: poolCapNote.textContent };
            } else {
                pool = {
                    state: 'ok',
                    capacity: poolCapacity.textContent,
                    reservedLabel: poolReservedLabel.textContent,
                    reserved: poolReserved.textContent,
                    available: poolAvailable.textContent,
                    usable: poolUsable.textContent,
                    infrastructureNote: poolInfrastructureNote.hidden ? '' : poolInfrastructureNote.textContent,
                    volumes: poolVolumes.textContent,
                    volumeSizing: `${poolVolumeSizingLabel.textContent}: ${poolVolumeSizingValue.innerText.replace(/\s+/g, ' ')}`
                };
            }

            return {
                generatedAt: `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`,
                config,
                results: {
                    valid: resultCard.getAttribute('data-state') === 'valid',
                    headline: result.textContent,
                    summary: resultSummary.textContent,
                    derivation: [
                        '4 MiB / 64 bytes / 2 = 32,768 records',
                        effectiveNodeFormula.textContent,
                        substitution.textContent,
                        logicalSubstitution.textContent
                    ],
                    validationMessage: validationMessage.textContent
                },
                pool
            };
        }

        function downloadReport() {
            const now = new Date();
            const report = buildExportReport(collectExportSnapshot(now));
            const blob = new Blob([report], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `s2d-planning-${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}-${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}.txt`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        }

        nodeRange.addEventListener('input', () => {
            nodeNumber.value = nodeRange.value;
            renderUserChange();
        });
        nodeNumber.addEventListener('input', () => {
            const numericValue = Number(nodeNumber.value);
            if (Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 16) {
                nodeRange.value = nodeNumber.value;
            }
            renderUserChange();
        });
        form.addEventListener('change', renderUserChange);
        form.addEventListener('submit', event => {
            event.preventDefault();
            renderUserChange();
        });
        document.querySelectorAll('input[name="tiering"]').forEach(radio => radio.addEventListener('change', () => {
            renderPool();
            saveState();
            scheduleCalculationTelemetry();
        }));
        [drivesPerNode, diskSize, customDiskSize, cacheDrives, cacheDiskSize, cacheCustomDiskSize,
            capacityDrives, capacityDiskSize, capacityCustomDiskSize].forEach(control => {
            control.addEventListener('input', () => {
                renderPool();
                saveState();
                scheduleCalculationTelemetry();
            });
            control.addEventListener('change', () => {
                renderPool();
                saveState();
                scheduleCalculationTelemetry();
            });
        });
        exportButton.addEventListener('click', downloadReport);
        resetButton.addEventListener('click', resetConfiguration);
        shareButton.addEventListener('click', shareConfiguration);
        renderAll();
        if (!loadConfigurationFromUrl()) {
            const saved = getSavedState();
            if (saved) showResumeBanner(saved);
        }
    }

    let currentTheme = 'dark';
    try {
        currentTheme = localStorage.getItem('odin-theme') || 'dark';
    } catch (_) {
        currentTheme = 'dark';
    }

    function applyPageTheme() {
        const root = document.documentElement;
        const themeButton = document.getElementById('theme-toggle');
        const logo = document.getElementById('odin-logo') || document.querySelector('.odin-tab-logo img');
        const light = currentTheme === 'light';
        root.style.setProperty('--bg-dark', light ? '#f5f5f5' : '#000000');
        root.style.setProperty('--card-bg', light ? '#ffffff' : '#111111');
        root.style.setProperty('--card-bg-transparent', light ? 'rgba(255, 255, 255, 0.95)' : 'rgba(17, 17, 17, 0.95)');
        root.style.setProperty('--text-primary', light ? '#000000' : '#ffffff');
        root.style.setProperty('--text-secondary', light ? '#6b7280' : '#a1a1aa');
        root.style.setProperty('--glass-border', light ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)');
        root.style.setProperty('--subtle-bg', light ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)');
        root.style.setProperty('--subtle-bg-hover', light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)');
        root.style.setProperty('--select-bg', light ? '#ffffff' : '#1a1a1a');
        root.style.setProperty('--nav-bg', light
            ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 245, 245, 0.95) 100%)'
            : 'linear-gradient(180deg, rgba(17, 17, 17, 0.98) 0%, rgba(17, 17, 17, 0.95) 100%)');
        root.style.setProperty('--nav-hover-bg', light ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)');
        root.style.setProperty('--nav-active-bg', light ? 'rgba(0, 120, 212, 0.12)' : 'rgba(0, 120, 212, 0.15)');
        root.style.setProperty('--disclaimer-bg', light ? 'rgba(255, 193, 7, 0.25)' : 'rgba(255, 193, 7, 0.15)');
        root.style.setProperty('--disclaimer-border', light ? 'rgba(255, 193, 7, 0.5)' : 'rgba(255, 193, 7, 0.4)');
        document.body.style.background = light ? '#f5f5f5' : '#000000';
        if (themeButton) themeButton.textContent = light ? '☀️' : '🌙';
        if (logo) logo.src = light ? '../images/odin-logo-white-background.png' : '../images/odin-logo.png';
    }

    globalThis.toggleTheme = function() {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyPageTheme();
        try {
            localStorage.setItem('odin-theme', currentTheme);
        } catch (_) {
            // Theme still applies for this page when browser storage is unavailable.
        }
    };

    if (!globalThis.__S2D_CALCULATIONS_ONLY__) {
        initializeCalculatorPage();
        applyPageTheme();
        if (document.getElementById('calculator-form')) {
            try {
                if (!localStorage.getItem(S2D_ONBOARDING_KEY)) globalThis.showS2dOnboarding();
            } catch (_) {
                globalThis.showS2dOnboarding();
            }
        }
        if (typeof initializeAnalytics === 'function' && initializeAnalytics()) {
            trackPageView();
            fetchAndDisplayStats();
        }
    }
})();