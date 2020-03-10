const npmRunScript = require('npm-run-script');
const dpwfHelper = require('./DpWfHelper');

var versionTypeToIncrement = 'build';
if (process.argv[2]) versionTypeToIncrement = process.argv[2];
dpwfHelper.incrementVersionAndAdjustWpInfoHeader(versionTypeToIncrement);
npmRunScript('wpackio-scripts build');