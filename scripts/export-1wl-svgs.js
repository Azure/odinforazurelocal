#!/usr/bin/env node
/**
 * Exports mgmt-compute-1wl .drawio files to SVG with dark mode fix.
 * Same post-processing as export-single-node-wl-svgs.js.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dir = path.join(__dirname, '..', 'docs', 'disconnected-operations');
const exePath = 'C:\\Program Files\\draw.io\\draw.io.exe';

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

const drawioFiles = fs.readdirSync(dir).filter(f =>
    f.includes('mgmt-compute-1wl') && f.endsWith('.drawio'));

for (const drawioFile of drawioFiles) {
    const svgName = drawioFile.replace('.drawio', '.svg').toLowerCase();
    const drawioPath = path.join(dir, drawioFile);
    const svgPath = path.join(dir, svgName);

    console.log('Exporting: ' + drawioFile);
    try {
        execSync(`"${exePath}" --export --format svg --svg-theme dark --embed-diagram --embed-svg-images --crop --border 0 --output "${svgPath}" "${drawioPath}"`, { stdio: 'pipe', timeout: 60000 });
    } catch (e) {
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

console.log('\nAll mgmt-compute-1wl diagram SVGs exported and post-processed!');
