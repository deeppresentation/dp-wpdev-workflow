const del = require('del');
const npmRunScript = require('npm-run-script');
const dpwf = require('../dp-wpdev-workflow.json');
const path = require('upath');
const term = require( 'terminal-kit' ).terminal;
const dpwfHelper = require('./DpWfHelper');

dpwfHelper.setActualScriptType('pack');

del.sync( path.joinSafe(dpwf.package.dir, '**/*'), {force: true});
term.green( `√ Pack directory ${dpwf.package.dir} was cleared. \n` );



dpwfHelper.actualizeReadmePerBuildTypeBeforePack();


npmRunScript('wpackio-scripts pack');