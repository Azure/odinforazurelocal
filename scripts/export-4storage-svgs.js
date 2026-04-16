#!/usr/bin/env node
/** Exports mgmt-compute-4storage .drawio files to SVG with dark mode fix. */
const { exportDiagrams } = require('./svg-export-common');
exportDiagrams(f => f.includes('4storage'), '4storage');
