const npmRunScript = require('npm-run-script');
const dpwfHelper = require('./DpWfHelper');

var versionTypeToIncrement = 'build';
if (process.argv[2]) versionTypeToIncrement = process.argv[2];
dpwfHelper.incrementVersionAndAdjustWpInfoHeader(versionTypeToIncrement);

dpwfHelper.writeBuildTypePhp(false);// add PRO or FREE define to dp-build-type.php


npmRunScript('wpackio-scripts build');