#!/usr/bin/env node
/** Exports mgmt-compute-1wl .drawio files to SVG with dark mode fix. */
const { exportDiagrams } = require('./svg-export-common');
exportDiagrams(f => f.includes('mgmt-compute-1wl'), 'mgmt-compute-1wl');
