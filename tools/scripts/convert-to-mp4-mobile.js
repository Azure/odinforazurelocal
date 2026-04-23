#!/usr/bin/env node
/**
 * Convert the latest Playwright WebM recording to a 1080x1920 (9:16) portrait MP4
 * suitable for LinkedIn mobile feed, Instagram Reels, TikTok, YouTube Shorts, etc.
 *
 * The source recording is typically captured at 1920x1080 landscape (desktop layout),
 * so we scale it to fit the width of a 1080x1920 frame and pad with a blurred copy
 * of the same frame as a background — the standard "blurred letterbox" treatment
 * that social platforms expect.
 *
 * Requires ffmpeg on PATH.  Install: winget install --id=Gyan.FFmpeg -e
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'output');
const targetName = process.argv[2] || 'odin-full-walkthrough-mobile.mp4';

function fail(msg) {
    console.error(`\x1b[31m${msg}\x1b[0m`);
    process.exit(1);
}

if (targetName.includes('/') || targetName.includes('\\') || targetName.includes('..')) {
    fail(`Invalid target filename "${targetName}". Must be a plain filename with no path separators.`);
}

const targetPath = path.join(outputDir, targetName);

const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
    fail('ffmpeg not found on PATH. Install with: winget install --id=Gyan.FFmpeg -e');
}

if (!fs.existsSync(outputDir)) {
    fail(`No output directory at ${outputDir}. Run the demo first.`);
}

/** @type {{path: string, mtime: number}[]} */
const webms = [];
(function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && p.toLowerCase().endsWith('.webm')) {
            webms.push({ path: p, mtime: fs.statSync(p).mtimeMs });
        }
    }
})(outputDir);

if (webms.length === 0) {
    fail(`No .webm files found under ${outputDir}. Run the demo first.`);
}

webms.sort((a, b) => b.mtime - a.mtime);
const source = webms[0].path;

console.log(`Source:  ${source}`);
console.log(`Target:  ${targetPath}`);
console.log('Layout:  1080x1920 portrait, native (recording already captured in portrait)');

// The Playwright recording is already captured at 1080x1920, so no scaling /
// cropping / letterboxing is needed — just re-encode webm to H.264 MP4 with
// yuv420p + faststart so LinkedIn / Instagram / TikTok accept it.
const filter = 'format=yuv420p';

const args = [
    '-y',
    '-i', source,
    '-vf', filter,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '20',
    '-movflags', '+faststart',
    '-an',
    targetPath,
];

const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (result.status !== 0) fail('ffmpeg conversion failed.');

console.log(`\n\x1b[32mDone:\x1b[0m ${targetPath}`);
