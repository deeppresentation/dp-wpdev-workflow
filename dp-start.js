const npmRunScript = require('npm-run-script');
const dpwfHelper = require('./DpWfHelper');
const dpwf = require('../dp-wpdev-workflow');
const term = require('terminal-kit').terminal;

var buildTypeModifier = null;
if (process.argv[2]) buildTypeModifier = process.argv[2].toUpperCase();

dpwfHelper.setActualScriptType('start');

/*

	global.dpwfEngineBeforeReload = () => {
		term.red('√ File changed DPWF HOOK');
	};

global.dpwfEngine = {
	beforeReload: function () {
		term.red('√ File changed DPWF HOOK');
	}
};*/



if (buildTypeModifier) {
	if (dpwf.product && Object.keys(dpwf.product).findIndex(val => val == buildTypeModifier) >= 0) {
		dpwfHelper.incrementVersionAndAdjustWpInfoHeader(null, buildTypeModifier);
		dpwfHelper.writeBuildTypePhp(true);// add PRO or FREE define to dp-build-type.php
		npmRunScript('wpackio-scripts start');
	}
	else {
		term.red(`√ Selected build type modifier "${buildTypeModifier}" was not recognized in configuration of DP Workflow (dp-wpdev-workflow.json)\n`);
	}
}
else {
	//dpwfHelper.incrementVersionAndAdjustWpInfoHeader(null, null);
	dpwfHelper.writeBuildTypePhp(true);// add PRO or FREE define to dp-build-type.php
	npmRunScript('wpackio-scripts start');
}




