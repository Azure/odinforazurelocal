#!/usr/bin/env node
/**
 * Convert the latest Playwright WebM recording to an MP4 suitable for LinkedIn.
 * Requires ffmpeg on PATH.  Install: winget install --id=Gyan.FFmpeg -e
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'output');
const targetName = process.argv[2] || 'sizer-walkthrough.mp4';

function fail(msg) {
  console.error(`\x1b[31m${msg}\x1b[0m`);
  process.exit(1);
}

// Reject path traversal / directory separators in the target filename
if (targetName.includes('/') || targetName.includes('\\') || targetName.includes('..')) {
  fail(`Invalid target filename "${targetName}". Must be a plain filename with no path separators.`);
}

const targetPath = path.join(outputDir, targetName);

// Verify ffmpeg is available
const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  fail('ffmpeg not found on PATH. Install with: winget install --id=Gyan.FFmpeg -e');
}

if (!fs.existsSync(outputDir)) {
  fail(`No output directory at ${outputDir}. Run "npm run demo:sizer" first.`);
}

// Walk output/ for .webm files, pick the most recently modified
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
  fail(`No .webm files found under ${outputDir}. Run "npm run demo:sizer" first.`);
}

webms.sort((a, b) => b.mtime - a.mtime);
const source = webms[0].path;

console.log(`Source:  ${source}`);
console.log(`Target:  ${targetPath}`);

// H.264 + yuv420p is the most compatible profile for social platforms.
// -movflags +faststart puts the moov atom at the start for web streaming.
// -an strips audio (Playwright recordings have none).
const args = [
  '-y',
  '-i', source,
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
  targetPath,
];

const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (result.status !== 0) fail('ffmpeg conversion failed.');

console.log(`\n\x1b[32mDone:\x1b[0m ${targetPath}`);
