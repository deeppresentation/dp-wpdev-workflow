const dpwf = require('../dp-wpdev-workflow.json');
const fs = require('fs-extra');
const term = require( 'terminal-kit' ).terminal;

term.green( `√ Deep Presentation workflow engine loaded. Build type: ${dpwf.buildType}\n` ) ;

module.exports.getPackageFiles = function () {

    if ( dpwf.package[`files${dpwf.buildType}`] ) {
        return [
            ...dpwf.package.files,
            ...(dpwf.package[`files${dpwf.buildType}`]),
        ];
    }
    else return dpwf.package.files;
}

module.exports.getPackageFilesAllBuilds = function () {

    var files = [];
    Object.keys(dpwf.package).forEach((key) => {
        if (key.startsWith('files'))
        {
            files = files.concat(dpwf.package[key]);
        }   
    });
    return files;
}

module.exports.getEntryAssetFiles = function () {

    if (dpwf.package[`files${dpwf.buildType}`]) {
        return {
            ...dpwf.assets.files,
            ...(dpwf.assets[`files${dpwf.buildType}`] && dpwf.assets[`files${dpwf.buildType}`])
        }
    }
    else return dpwf.assets.files;
}

module.exports.writeBuildTypePhp = function () {
    fs.outputFileSync('./dp-build-type.php', `<?php define('BUILD_TYPE', '${dpwf.buildType}'); ?>`);
}