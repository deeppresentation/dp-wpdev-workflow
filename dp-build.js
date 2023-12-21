const npmRunScript = require('npm-run-script');
const dpwfHelper = require('./DpWfHelper');
const dpwf = require('../dp-wpdev-workflow.json');

var versionTypeToIncrement = 'b';
//var a = dpwfHelper.writeBuildTypePhp();


dpwfHelper.setActualScriptType('build');
if (process.argv[2]) versionTypeToIncrement = process.argv[2];
dpwfHelper.incrementVersionAndAdjustWpInfoHeader(versionTypeToIncrement);
if (dpwf.id === 'dp-intro-tours'){
	dpwfHelper.updateBuilderCoreStickyJs();
}
dpwfHelper.writeBuildTypePhp(false);// add PRO or FREE define to dp-build-type.php


npmRunScript('wpackio-scripts build');