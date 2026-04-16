#!/usr/bin/env node
/** Exports compute-storage and 4-intent .drawio files to SVG with dark mode fix. */
const { exportDiagrams } = require('./svg-export-common');
exportDiagrams(f => f.includes('compute-storage') || f.includes('4intent'), 'intent');
