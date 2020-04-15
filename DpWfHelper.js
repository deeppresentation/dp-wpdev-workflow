const dpwf = require('../dp-wpdev-workflow.json');
const pkgjs = require('../package.json');
const fs = require('fs-extra');
const term = require('terminal-kit').terminal;
const replaceString = require('replace-string');


module.exports.getPackageFiles = function () {

    if (dpwf.package[`files${dpwf.buildType}`]) {
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
        if (key.startsWith('files')) {
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
    const definePrefix = replaceString(dpwf.title, ' ', '_').toUpperCase();

    var res = `<?php 
define('BUILD_TYPE', '${dpwf.buildType}');
define('${definePrefix}_VERSION', '${module.exports.getSubItemPerBuild('product', 'version')}');
define('${definePrefix}_NAME', '${module.exports.getTitle()}');
`;
    Object.keys(dpwf.product).forEach(key => {
        $keyUpperCase = key.toUpperCase();
        if (dpwf.product[key].link) res += `define('${definePrefix}_PRODUCT_LINK_${$keyUpperCase}', "${dpwf.product[key].link}");\n`;
        if (dpwf.product[key].keyBuyLink) res += `define('${definePrefix}_KEY_LINK_${$keyUpperCase}', "${dpwf.product[key].keyBuyLink}");\n`;

        if (dpwf.product[key].title) res += `define('${definePrefix}_NAME_${$keyUpperCase}', "${dpwf.product[key].title}");\n`;
        else if (dpwf.title) res += `define('${definePrefix}_NAME_${$keyUpperCase}', "${dpwf.title}");\n`;
    });
    res += '?>\n';


    fs.outputFileSync('./dp-build-type.php', res);
}

module.exports.incrementVersion = function (currentVersion, versionTypeToIncrement = 'build') {
    var res = currentVersion ? currentVersion : "UNDEFINED";
    if (currentVersion && versionTypeToIncrement) {
        var splited = currentVersion.split('.');
        if (splited.length >= 2) {
            var build = 0;
            if (splited.length >= 3) {
                build = parseInt(splited[2]);
            }
            var minor = parseInt(splited[1]);
            var major = parseInt(splited[0]);
            if (build != NaN && minor != NaN && major != NaN) {
                switch (versionTypeToIncrement) {
                    case 'B':
                    case 'b':
                    case 'build': build++; break;
                    case 'min':
                    case 'minor':
                    case 'm': 
                        minor++; 
                        build = 0;  
                        break;
                    case 'maj':
                    case 'major':
                    case 'M': 
                        major++; 
                        minor = 0;
                        build = 0;
                        break;
                    default: return res;

                }
                res = [major, minor, build].join('.');
            }
        }
    }
    return res;
}


module.exports.setSubItemPerBuild = function (itemName, subItemName, val) {
    var item = dpwf[itemName];
    if (item) {

        if (item[dpwf.buildType]) {
            item[dpwf.buildType][subItemName] = val;
            return true;
        }
    }
    return false;
}

module.exports.getSubItemPerBuild = function (itemName, subItemName, def = '') {
    var subItem = def;
    var item = dpwf[itemName];
    if (item) {
        if (item[dpwf.buildType]) {
            subItem = item[dpwf.buildType][subItemName];
        }
    }
    return subItem;
}

module.exports.getTitle = function () {
    var title = dpwf.title;
    var product = dpwf.product;
    if (dpwf.product && dpwf.product[dpwf.buildType]) {
        product = dpwf.product[dpwf.buildType];
    }
    if (product.title) title = product.title;
    return title;
}

module.exports.actualizeReadmePerBuildTypeBeforePack = function () {
    const buildSpecReadMeNamePath = `./readme-${dpwf.buildType}.txt`;
    if (fs.existsSync(buildSpecReadMeNamePath))
    {
        fs.copyFileSync(buildSpecReadMeNamePath, './readme.txt');
        term.green(`√ Readme file was actualized by data from  ${buildSpecReadMeNamePath}. \n`);
    }    
}



function updatePackageJson(id, version, buildType) {
    // save package json version

    var packageJsonShouldBeWritten = false;
    if (pkgjs.name !== id) {
        packageJsonShouldBeWritten = true;
        pkgjs.name = id;
    }

    if (buildType === 'PRO' && version != pkgjs.version)
    {
        pkgjs.version = version;
        packageJsonShouldBeWritten = true;
    }

    if (packageJsonShouldBeWritten)
    {
        fs.outputJSONSync('./package.json', pkgjs, { spaces: 4 });
    }

}


function generateWpPluginInfoHeadrData(version) {
    var pluginName = module.exports.getTitle();


    var res = `/*
*
* @link              ${dpwf.autorLink}
* @since             1.0.0
* @package           ${replaceString(dpwf.title, ' ', '_')}
*
* @wordpress-plugin
* Plugin Name:       ${pluginName}
* Plugin URI:        ${module.exports.getSubItemPerBuild('product', 'link')}
* Description:       ${module.exports.getSubItemPerBuild('product', 'desc')}
* Version:           ${version}
* Author:            ${dpwf.author}
* Author URI:        ${dpwf.autorLink}
* License:           ${module.exports.getSubItemPerBuild('license', 'type')}
* License URI:       ${module.exports.getSubItemPerBuild('license', 'link')}
* Text Domain:       ${dpwf.id}
* Domain Path:       /languages
*/`;
    return res;
}

module.exports.printWpPluginInfoHeadr = function (srcPhpIndexFile, dstPhpIndexFile, versionTypeToIncrement = 'build', buildTypeModified = false) {
    if (srcPhpIndexFile && dstPhpIndexFile) {
        var data = fs.readFileSync(srcPhpIndexFile);
        if (data) {
            var dataStr = data.toString();
            if (dataStr) {
                var startIdx = -1;
                var stopIdx = -1;
                var length = dataStr.length;
                for (var idx = 0; idx < length - 1; idx++) {
                    var char = dataStr[idx];
                    if (char === '/' && dataStr[idx + 1] === '*') {
                        startIdx = idx;
                    }
                    if (startIdx > 5) //<?php
                    {
                        if (char == '*' && dataStr[idx + 1] === '/') {
                            stopIdx = idx + 1;
                            break;
                        }
                    }
                };
                if (startIdx > 0 && stopIdx > startIdx + 10) {
                    //We localized header
                    var oldInfoHeader = dataStr.substr(startIdx, stopIdx - startIdx + 1);
                    if (oldInfoHeader) {
                        const oldVersion = module.exports.getSubItemPerBuild('product', 'version');
                        const newVersion = module.exports.incrementVersion(oldVersion, versionTypeToIncrement);
                        var newInfoHeader = generateWpPluginInfoHeadrData(newVersion);
                        if (newInfoHeader) {
                            var newDataStr = dataStr.replace(oldInfoHeader, newInfoHeader);
                            if (newDataStr) {
                                fs.outputFileSync(dstPhpIndexFile, newDataStr);
                                var wasWorkflowCfgSaved = false;
                                if (newVersion !== oldVersion) {
                                    // save adjusted version to dp-wp-dev-workflow.js json 
                                    if (module.exports.setSubItemPerBuild('product', 'version', newVersion)) {
                                        fs.outputJSONSync('./dp-wpdev-workflow.json', dpwf, { spaces: 4 });
                                        wasWorkflowCfgSaved = true;
                                    }
                                }
                                if (!wasWorkflowCfgSaved && buildTypeModified) {
                                    fs.outputJSONSync('./dp-wpdev-workflow.json', dpwf, { spaces: 4 });
                                }
                                return newVersion;
                            }
                        }
                    }

                }
            }
        }
    }
    return null;
}

module.exports.incrementVersionAndAdjustWpInfoHeader = function (versionTypeToIncrement = 'build', buildTypeModifier = null) {


    var indexPhpFile = dpwf.indexPhpFile;
    if (!indexPhpFile) indexPhpFile = './index.php';

    var buildTypeModified = false;
    if (buildTypeModifier) {
        buildTypeModified = buildTypeModifier !== dpwf.buildType;
        dpwf.buildType = buildTypeModifier;
    }

    term.green(`√ Deep Presentation workflow engine loaded. Build type: ${dpwf.buildType}\n`);

    const oldVersion = module.exports.getSubItemPerBuild('product', 'version');
    const newVersion = module.exports.printWpPluginInfoHeadr(indexPhpFile, indexPhpFile, versionTypeToIncrement, buildTypeModified);

    if (newVersion) {

        updatePackageJson(dpwf.id, newVersion, dpwf.buildType);
        term.green(`√ Wordpress header in ${indexPhpFile} was adjusted to current build configuration (${dpwf.buildType}). \n`);
        if (newVersion !== oldVersion) {
            term.green(`√ Version was incremented from ${oldVersion} to ${newVersion} \n`);
            
        }
    }
    else {
        term.red(`√ Adjusting of wordpress header in ${indexPhpFile} FAILED!! (Build configuration: ${dpwf.buildType}). \n`);
    }


}


