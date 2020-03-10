const npmRunScript = require('npm-run-script');
const dpwf = require('../dp-wpdev-workflow.json');
const term = require( 'terminal-kit' ).terminal;
const dpWfHelper = require('./DpWfHelper');

var indexPhpFile = dpwf.indexPhpFile;
if (!indexPhpFile) indexPhpFile = './index.php';

var versionTypeToIncrement = 'build';
if (process.argv[2]) versionTypeToIncrement = process.argv[2];

const oldVersion = dpWfHelper.getSubItemPerBuild('info', 'version');
const newVersion = dpWfHelper.printWpPluginInfoHeadr(indexPhpFile, indexPhpFile, versionTypeToIncrement);


if (newVersion)
{
    term.green( `√ Wordpress header in ${indexPhpFile} was adjusted to currend build configuration (${dpwf.buildType}). \n` );
    if (newVersion !== oldVersion)
    {
        term.green( `√ Version was incremented from ${oldVersion} to ${newVersion} \n` );
    }
}
else
{
    term.red( `√ Adjusting of wordpress header in ${indexPhpFile} FAILED!! (Build configuration: ${dpwf.buildType}). \n` );
}

npmRunScript('wpackio-scripts build');