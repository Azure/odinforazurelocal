/**
 * Shared utilities for draw.io SVG export scripts.
 * Used by export-switchless-svgs.js, export-1wl-svgs.js, export-intent-svgs.js,
 * export-4storage-svgs.js, and export-single-node-wl-svgs.js.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOCS_DIR = path.join(__dirname, '..', 'docs', 'disconnected-operations');

/**
 * Resolve the draw.io executable path.
 * Checks DRAWIO_EXE env var first, then the default Windows install location.
 */
function getDrawIoPath() {
    if (process.env.DRAWIO_EXE) return process.env.DRAWIO_EXE;
    const defaultPath = 'C:\\Program Files\\draw.io\\draw.io.exe';
    if (!fs.existsSync(defaultPath)) {
        console.error('draw.io not found at: ' + defaultPath);
        console.error('Set DRAWIO_EXE environment variable to the draw.io executable path.');
        process.exit(1);
    }
    return defaultPath;
}

/**
 * Resolve CSS light-dark() functions to their dark-mode value.
 * draw.io exports use light-dark() for theme support; we want the dark value.
 */
function fixLightDark(str) {
    let result = '';
    let i = 0;
    while (i < str.length) {
        const ldIdx = str.indexOf('light-dark(', i);
        if (ldIdx === -1) { result += str.slice(i); break; }
        result += str.slice(i, ldIdx);
        let depth = 0, start = ldIdx + 'light-dark'.length, commaPos = -1, j = start;
        for (; j < str.length; j++) {
            if (str[j] === '(') depth++;
            else if (str[j] === ')') { depth--; if (depth === 0) break; }
            else if (str[j] === ',' && depth === 1 && commaPos === -1) commaPos = j;
        }
        const lightVal = str.slice(start + 1, commaPos).trim();
        const darkVal = str.slice(commaPos + 1, j).trim();
        const isBlackToWhite = (
            (lightVal === 'rgb(0, 0, 0)' && darkVal === 'rgb(255, 255, 255)') ||
            (lightVal === '#000000' && darkVal === '#ffffff') ||
            (lightVal === '#000' && darkVal === '#fff')
        );
        const isDefaultFill = darkVal.includes('var(--ge-dark-color');
        if (isBlackToWhite || isDefaultFill) {
            result += darkVal;
        } else {
            result += lightVal;
        }
        i = j + 1;
    }
    return result;
}

/**
 * Export .drawio files matching a filter to SVG with dark-mode post-processing.
 * @param {function(string): boolean} fileFilter - Filter predicate for .drawio filenames
 * @param {string} [label] - Label for console output (e.g. 'switchless')
 */
function exportDiagrams(fileFilter, label) {
    const exePath = getDrawIoPath();
    const drawioFiles = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.drawio') && fileFilter(f));

    if (drawioFiles.length === 0) {
        console.warn('No .drawio files matched the filter' + (label ? ' for ' + label : '') + '.');
        return;
    }

    for (const drawioFile of drawioFiles) {
        const svgName = drawioFile.replace('.drawio', '.svg').toLowerCase();
        const drawioPath = path.join(DOCS_DIR, drawioFile);
        const svgPath = path.join(DOCS_DIR, svgName);

        console.log('Exporting: ' + drawioFile);
        try {
            execSync(`"${exePath}" --export --format svg --svg-theme dark --embed-diagram --embed-svg-images --crop --border 0 --output "${svgPath}" "${drawioPath}"`, { stdio: 'pipe', timeout: 60000 });
        } catch (e) {
            // draw.io CLI sometimes crashes but still writes the file; retry once
            console.log('  Retry...');
            execSync(`"${exePath}" --export --format svg --svg-theme dark --embed-diagram --embed-svg-images --crop --border 0 --output "${svgPath}" "${drawioPath}"`, { stdio: 'pipe', timeout: 60000 });
        }

        let content = fs.readFileSync(svgPath, 'utf-8');

        // Fix background
        content = content.replace(
            'background: transparent; background-color: transparent; color-scheme: dark;',
            'background: #ffffff; background-color: var(--ge-dark-color, #121212); color-scheme: dark;'
        );

        // Resolve all light-dark()
        content = fixLightDark(content);

        // Fix any remaining white fills that should be dark
        content = content.replace(
            /fill="#ffffff"([^>]*?)style="fill: #ffffff;"/g,
            'fill="#ffffff"$1style="fill: var(--ge-dark-color, #121212);"'
        );

        fs.writeFileSync(svgPath, content, 'utf-8');

        const ld = (content.match(/light-dark\(/g) || []).length;
        const wf = (content.match(/style="fill: #ffffff/g) || []).length;
        console.log('  -> ' + svgName + ' | light-dark: ' + ld + ' | whiteFill: ' + wf);
    }

    console.log('\nAll ' + (label || '') + ' SVGs exported and post-processed! (' + drawioFiles.length + ' files)');
}

module.exports = { fixLightDark, getDrawIoPath, exportDiagrams, DOCS_DIR };
