const npmRunScript = require('npm-run-script');
const dpwfHelper = require('./DpWfHelper');
const dpwf = require('../dp-wpdev-workflow');

var buildTypeModifier = null;
if (process.argv[2]) buildTypeModifier = process.argv[2].toUpperCase();
if (buildTypeModifier)
{
    if (dpwf.product && Object.keys(dpwf.product).findIndex(val => val == buildTypeModifier) >= 0)
    {
        dpwfHelper.incrementVersionAndAdjustWpInfoHeader(null, buildTypeModifier);
        npmRunScript('wpackio-scripts start');
    }
    else
    {
        term.red(`√ Selected build type modifier "${buildTypeModifier}" was not recognized in configuration of DP Workflow (dp-wpdev-workflow.json)\n`);
    }
}
else
{
    dpwfHelper.incrementVersionAndAdjustWpInfoHeader(null, null);
    npmRunScript('wpackio-scripts start'); 
}




