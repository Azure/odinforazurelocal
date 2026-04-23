const { exportDiagrams } = require('./svg-export-common');
exportDiagrams(f => f.includes('switchless'), 'switchless');
