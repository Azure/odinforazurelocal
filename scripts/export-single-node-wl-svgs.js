#!/usr/bin/env node
/** Exports single-node-wl .drawio files to SVG with dark mode fix. */
const { exportDiagrams } = require('./svg-export-common');
exportDiagrams(f => f.includes('single-node-wl'), 'single-node-wl');
