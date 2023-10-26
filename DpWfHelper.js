const dpwf = require('../dp-wpdev-workflow.json');
const pkgjs = require('../package.json');
const fs = require('fs-extra');
const term = require('terminal-kit').terminal;
const replaceString = require('replace-string');
const path = require('upath');
const snakeCase = require('snake-case').snakeCase;



module.exports.getPackageFiles = function () {

	var res = dpwf.package.files;
	if (dpwf.package[`files${dpwf.buildType}`]) {
		res = [
			...dpwf.package.files,
			...(dpwf.package[`files${dpwf.buildType}`]),
		];
	}
	if (dpwf.forceDebug) res = [
		...res,
		'dbg/**/*'
	];
	return res;
};

module.exports.getPackageFilesAllBuilds = function () {

	var files = [];
	Object.keys(dpwf.package).forEach((key) => {
		if (key.startsWith('files')) {
			files = files.concat(dpwf.package[key]);
		}
	});
	if (dpwf.forceAdminDebug) files = [
		...files,
		'dbg/**/*'
	];
	return files;
};

function adjustAsDefaultAsset(name, entry, webpackConfig = null) {

	return {
		name: name,
		entry: entry,
		webpackConfig: webpackConfig ? webpackConfig : module.exports.getCustomizeWebPackCfgFce,
	};
}

module.exports.setActualScriptType = function (scriptType) {
	fs.outputJSONSync('./dp-wpdev-workflow/actual-script-type.json', { scriptType: scriptType }, { spaces: 4 });
};

module.exports.getActualScriptType = function () {
	const actualScriptType = require('./actual-script-type.json');
	return actualScriptType ? actualScriptType.scriptType : null;
};



module.exports.getEntryAssetFiles = function () {
	const res = [];
	if (dpwf.assets.bundles) {
		Object.keys(dpwf.assets.bundles).forEach((bundleKey) => {
			if (dpwf.assets.bundles[bundleKey][`files${dpwf.buildType}`]) {
				res.push(adjustAsDefaultAsset(
					bundleKey, {
					...dpwf.assets.bundles[bundleKey].files,
					...(dpwf.assets.bundles[bundleKey][`files${dpwf.buildType}`] && dpwf.assets.bundles[bundleKey][`files${dpwf.buildType}`])
				})
				);
			}
			else res.push(adjustAsDefaultAsset(bundleKey, dpwf.assets.bundles[bundleKey].files));
		});
	}
	else {
		if (dpwf.assets[`files${dpwf.buildType}`]) {
			res.push(adjustAsDefaultAsset(
				'scriptsandstyles', {
				...dpwf.assets.files,
				...(dpwf.assets[`files${dpwf.buildType}`] && dpwf.assets[`files${dpwf.buildType}`])
			}));
		}
		else res.push(adjustAsDefaultAsset('scriptsandstyles', dpwf.assets.files));
	}
	return res;
};


module.exports.getComposerAutoloadData = (moduleDir) => {
	const composerJson = require(path.joinSafe(moduleDir, 'composer.json'));
	if (composerJson) {
		const data = composerJson.autoload['psr-4'];
		var namespace = Object.keys(data)[0];
		const path = data[namespace];
		if (namespace.endsWith('\\')) {
			namespace = namespace.substr(0, namespace.length - 1);
		}

		return {
			namespace: namespace,
			path: path,
			namespacePrefixed: dpwf.phpScoper.scopePrefix + namespace
		};
	}
	return null;
};

module.exports.setComposerAutoloadData = (vendorPath, moduleName, oldNamespace, newNamespace, newPath) => {
	const composerJsonPath = path.joinSafe(vendorPath, 'composer', 'installed.json');
	const composerJson = require(composerJsonPath);
	if (composerJson && composerJson.packages) {
		fs.outputJSONSync(composerJsonPath + '.bkp', composerJson, { spaces: 4 });
		for (const moduleCfg of composerJson.packages) {
			if (moduleCfg.name === moduleName) {
				if (!moduleCfg.autoload) moduleCfg.autoload = {};
				if (!moduleCfg.autoload['psr-4']) moduleCfg.autoload['psr-4'] = {};
				if (moduleCfg.autoload['psr-4'][oldNamespace + '\\']) delete moduleCfg.autoload['psr-4'][oldNamespace + '\\'];
				moduleCfg.autoload['psr-4'][newNamespace + '\\'] = newPath;
			}
		}
		fs.outputJSONSync(composerJsonPath, composerJson, { spaces: 4 });
	}
};


module.exports.getCustomizeWebPackCfgFce = (config, merge, appDir, isDev) => {
	const {
		getFileLoaderOptions,
		getBabelPresets,
		getDefaultBabelPresetOptions,
		issuerForJsTsFiles,
		issuerForNonJsTsFiles,
		babelLoader,
		fileLoader,
		// eslint-disable-next-line import/no-extraneous-dependencies
	} = require('@wpackio/scripts');
	isDev = isDev || dpwf.forceDebug;
	var disableSourceMaps = false;
	if (!isDev) {
		disableSourceMaps = !dpwf.forceDebug && module.exports.getSubItemPerBuild('product', 'sourceMapsDisable', false);
	}
	const customRules = {
		devtool: disableSourceMaps ? false : 'source-map',

		module: {

			rules: [
				// Config for SVGR in javascript/typescript files
				{
					test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
					issuer: issuerForJsTsFiles,
					use: [
						{
							loader: babelLoader,
							options: {
								presets: getBabelPresets(
									getDefaultBabelPresetOptions(
										true,
										isDev
									),
									undefined
								),
							},
						},
						{
							loader: '@svgr/webpack',
							options: {
								babel: false
							},
						},
						{
							loader: fileLoader,
							options: getFileLoaderOptions(
								appDir,
								isDev,
								false
							),
						},
					],
				},
				// For everything else, we use file-loader only
				{
					test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
					issuer: issuerForNonJsTsFiles,
					use: [
						{
							loader: fileLoader,
							options: getFileLoaderOptions(
								appDir,
								isDev,
								true
							),
						},
					],
				},
			],
		},
		devServer: {
			hot: false,
		},
		//plugins: ['@babel/plugin-syntax-dynamic-import'],
		optimization: {
			splitChunks: {
				chunks: 'all',
				automaticNameDelimiter: '-',
				/*name: (_, chunks) => {
					const allChunksNames = chunks.map((chunk) => (dpwf.prefixId + '-' + chunk.name)).join('-');
					return allChunksNames;
				},*/
			},
		},

	};
	// merge and return
	return merge(config, customRules);

};

module.exports.writeBuildTypePhp = function (debugEn = false) {
	const definePrefix = replaceString(dpwf.id, '-', '_').toUpperCase();

	var res = `<?php
define( '${definePrefix}_DP_BUILD_TYPE', '${dpwf.buildType}' );
define( '${definePrefix}_ADMINATOR', '${module.exports.getSubItemPerBuild('product', 'adminator')}' );
define( '${definePrefix}_DP_DEBUG_EN', ${Boolean(debugEn || dpwf.forceDebug)} );
define( '${definePrefix}_DP_ADMIN_DEBUG_EN', ${Boolean(debugEn || dpwf.forceAdminDebug)} );
define( '${definePrefix}_VERSION', '${module.exports.getSubItemPerBuild('product', 'version')}' );
define( '${definePrefix}_NAME', '${module.exports.getTitle()}' );
define( '${definePrefix}_PREFIX', '${definePrefix.toLocaleLowerCase()}' );
`;



	res += getDefineInBuildType(definePrefix, 'product', 'updateKey', false);
	res += getDefineInBuildType(definePrefix, 'product', 'adminatorEndPoint', false);

	res += getDefineInBuildType(definePrefix, 'tracking', 'enabled', false, false, null, null, true, false);
	res += getDefineInBuildType(definePrefix, 'tracking', 'clientId', false);
	res += getDefineInBuildType(definePrefix, 'tracking', 'clientSecret', false);


	Object.keys(dpwf.product).forEach(buildType => {
		var overrideValAsEmpty = dpwf.buildType === 'PRO' && buildType === 'FREE';
		res += getDefineInBuildType(definePrefix, 'product', 'link', true, overrideValAsEmpty, buildType);
		res += getDefineInBuildType(definePrefix, 'product', 'featuresLink', true, overrideValAsEmpty, buildType);
		res += getDefineInBuildType(definePrefix, 'product', 'demoLink', true, overrideValAsEmpty, buildType);
		res += getDefineInBuildType(definePrefix, 'product', 'keyBuyLink', true, overrideValAsEmpty, buildType);
		res += getDefineInBuildType(definePrefix, 'product', 'askForRatingLink', true, overrideValAsEmpty, buildType);
		res += getDefineInBuildType(definePrefix, 'product', 'ratingFeedbackLink', true, overrideValAsEmpty, buildType);
		res += getDefineInBuildType(definePrefix, 'product', 'title', true, overrideValAsEmpty, buildType);
	}
	);
	//res += '?>\n';


	fs.outputFileSync('./dp-build-type.php', res);
};

function getDefineInBuildType(definePrefix, itemName, subItemName, addBuildTypePostfix = true, overrideValAsEmpty = false, buildTypeOverride = null, defineNameOverride = null, disableQuotes = false, defVal = '') {
	var val = module.exports.getSubItemPerBuild(itemName, subItemName, defVal, buildTypeOverride);
	if (overrideValAsEmpty) val = '';
	var finalVal = disableQuotes ? val : `'${val}'`;
	var defineName = defineNameOverride ? defineNameOverride.toUpperCase() : snakeCase(itemName + '_' + subItemName).toUpperCase();
	if (addBuildTypePostfix) {
		var buildType = buildTypeOverride ? buildTypeOverride.toUpperCase() : dpwf.buildType.toUpperCase();

		return `define( '${definePrefix}_${defineName}_${buildType}', ${finalVal} );\n`;
	}
	else {
		return `define( '${definePrefix}_${defineName}', ${finalVal} );\n`;
	}
}

module.exports.incrementVersion = function (currentVersion, versionTypeToIncrement = 'build') {
	var res = currentVersion ? currentVersion : 'UNDEFINED';
	if (currentVersion && versionTypeToIncrement) {
		var splitted = currentVersion.split('.');
		if (splitted.length >= 2) {
			var build = 0;
			if (splitted.length >= 3) {
				build = parseInt(splitted[2]);
			}
			var minor = parseInt(splitted[1]);
			var major = parseInt(splitted[0]);
			if (!isNaN(build) && !isNaN(minor) && !isNaN(major)) {
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
};


module.exports.setSubItemPerBuild = function (itemName, subItemName, val) {
	var item = dpwf[itemName];
	if (item) {

		if (item[dpwf.buildType]) {
			item[dpwf.buildType][subItemName] = val;
			return true;
		}
	}
	return false;
};

module.exports.getSubItemPerBuild = function (itemName, subItemName, def = '', buildTypeOverride = null) {
	var subItem = def;
	var item = dpwf[itemName];
	var buildType = buildTypeOverride ? buildTypeOverride : dpwf.buildType;
	if (item) {
		if (item[buildType]) {
			subItem = item[buildType][subItemName];
			var adminator = dpwf.product[buildType].adminator;
			if (adminator && item[buildType][adminator] && item[buildType][adminator][subItemName] != undefined) {
				subItem = item[buildType][adminator][subItemName];
			}
		}
	}
	if (subItem == undefined) subItem = def;
	return subItem;
};

module.exports.getTitle = function () {
	return module.exports.getSubItemPerBuild('product', 'title');
};

module.exports.getPackageId = function () {
	if (module.exports.getActualScriptType() === 'start') return dpwf.id;
	var packageId = module.exports.getSubItemPerBuild('product', 'packageId');
	return packageId ? packageId : dpwf.id;
};

module.exports.getTextDomain = function () {
	return dpwf.id;
};

module.exports.actualizeReadmePerBuildTypeBeforePack = function () {
	const buildSpecReadMeNamePath = `./readme-${dpwf.buildType}.txt`;
	if (fs.existsSync(buildSpecReadMeNamePath)) {
		fs.copyFileSync(buildSpecReadMeNamePath, './readme.txt');
		term.green(`√ Readme file was actualized by data from  ${buildSpecReadMeNamePath}. \n`);
	}
};



function updatePackageJson(id, version, buildType) {
	// save package json version

	var packageJsonShouldBeWritten = false;
	if (pkgjs.name !== id) {
		packageJsonShouldBeWritten = true;
		pkgjs.name = id;
	}

	if (buildType === 'PRO' && version != pkgjs.version) {
		pkgjs.version = version;
		packageJsonShouldBeWritten = true;
	}

	if (packageJsonShouldBeWritten) {
		fs.outputJSONSync('./package.json', pkgjs, { spaces: 4 });
	}

}


function generateWpPluginInfoHeadrData(version) {
	var pluginName = module.exports.getTitle();


	var res = `/*
*
* @link              ${dpwf.author.uri}
* @since             1.0.0
* @package           ${replaceString(pluginName, ' ', '_')}
*
* @wordpress-plugin
* Plugin Name:       ${pluginName}
* Plugin URI:        ${module.exports.getSubItemPerBuild('product', 'link')}
* Description:       ${module.exports.getSubItemPerBuild('product', 'desc')}
* Version:           ${version}
* Requires at least: ${module.exports.getSubItemPerBuild('product', 'requiresVersionWP')}
* Requires PHP:      ${module.exports.getSubItemPerBuild('product', 'requiresVersionPHP')}
* Author:            ${dpwf.author.name}
* Author URI:        ${dpwf.author.uri}
* License:           ${module.exports.getSubItemPerBuild('license', 'type')}
* License URI:       ${module.exports.getSubItemPerBuild('license', 'link')}
* Text Domain:       ${module.exports.getTextDomain()}
* Domain Path:       /languages
*/`;
	return res;
}

function generateWpThemeInfoHeadrData(version) {
	var name = module.exports.getTitle();

	var res = `/*

Theme Name:       ${name}
Theme URI:        ${module.exports.getSubItemPerBuild('product', 'link')}
Description:       ${module.exports.getSubItemPerBuild('product', 'desc')}
Author:            ${dpwf.author.name}
Author URI:        ${dpwf.author.uri}
Template: 		   ${dpwf.childTheme ? dpwf.childTheme : dpwf.id}	
Version:           ${version}
Requires at least: ${module.exports.getSubItemPerBuild('product', 'requiresVersionWP')}
Requires PHP:      ${module.exports.getSubItemPerBuild('product', 'requiresVersionPHP')}
License:           ${module.exports.getSubItemPerBuild('license', 'type')}
License URI:       ${module.exports.getSubItemPerBuild('license', 'link')}
Text Domain:       ${module.exports.getTextDomain()}
*/`;
	return res;
}

module.exports.printWpInfoHeadr = function (srcPhpIndexFile, dstPhpIndexFile, versionTypeToIncrement = 'build', buildTypeModified = false) {
	const isTheme = dpwf.type === 'theme';
	if (srcPhpIndexFile && dstPhpIndexFile && fs.existsSync(srcPhpIndexFile)) {
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
					if (isTheme || startIdx > 5) //<?php
					{
						if (char == '*' && dataStr[idx + 1] === '/') {
							stopIdx = idx + 1;
							break;
						}
					}
				}
				if (startIdx >= 0 && stopIdx > startIdx + 10) {
					//We localized header
					var oldInfoHeader = dataStr.substr(startIdx, stopIdx - startIdx + 1);
					if (oldInfoHeader) {
						const oldVersion = module.exports.getSubItemPerBuild('product', 'version');
						const newVersion = module.exports.incrementVersion(oldVersion, versionTypeToIncrement);
						var newInfoHeader = isTheme
							? generateWpThemeInfoHeadrData(newVersion)
							: generateWpPluginInfoHeadrData(newVersion);
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
};

module.exports.incrementVersionAndAdjustWpInfoHeader = function (versionTypeToIncrement = 'build', buildTypeModifier = null) {


	var indexPhpFile = dpwf.indexPhpFile;
	if (!indexPhpFile) indexPhpFile = './index.php';

	var buildTypeModified = false;
	if (buildTypeModifier) {
		buildTypeModified = buildTypeModifier !== dpwf.buildType;
		dpwf.buildType = buildTypeModifier;
	}

	var adminator = module.exports.getSubItemPerBuild('product', 'adminator');
	if (dpwf.forceDebug) term.yellow('DEBUG BUILD IS FORCED\n');
	if (dpwf.forceAdminDebug) term.magenta('ADMIN DEBUG BUILD IS FORCED\n');

	term.green(`√ Deep Presentation workflow engine loaded. Build type: ${dpwf.buildType}${adminator ? ' License type: ' + adminator : ''}\n`);

	const oldVersion = module.exports.getSubItemPerBuild('product', 'version');
	const newVersion = module.exports.printWpInfoHeadr(indexPhpFile, indexPhpFile, versionTypeToIncrement, buildTypeModified);

	if (newVersion) {

		updatePackageJson(dpwf.id, newVersion, dpwf.buildType);
		term.green(`√ Wordpress header in ${indexPhpFile} was adjusted to current build configuration (${dpwf.buildType}). \n`);
		if (newVersion !== oldVersion) {
			term.green(`√ Version was incremented from ${oldVersion} to ${newVersion} \n`);

		}
		else {
			term.green(`√ Version wast kept on ${oldVersion} \n`);
		}
	}
	else {
		term.red(`√ Adjusting of wordpress header in ${indexPhpFile} FAILED!! (Build configuration: ${dpwf.buildType}). \n`);
	}


};

module.exports.replaceAndSaveFileSync = function (srcPath, dstPath, searchString, replaceString) {
	const data = fs.readFileSync(srcPath, 'utf8');
	const updatedData = data.replace(new RegExp(searchString, 'g'), replaceString);
	fs.writeFileSync(dstPath, updatedData, 'utf8');
};

module.exports.updateBuilderCoreStickyJs = function () {
	var modulesCoreJsPath = './public/assets/js/modules/core/';
	var builderCoreJsPath = modulesCoreJsPath + 'DpitBuilderCore.js';
	var builderCoreStickyJsPath = modulesCoreJsPath + 'DpitBuilderCoreSticky.js';
	term.yellow('Updating DpitBuilderCoreSticky.js ... ');
	try {
		module.exports.replaceAndSaveFileSync(builderCoreJsPath, builderCoreStickyJsPath, 'DpitCore', 'DpitCoreSticky');
		term.green('DONE \n');
	}
	catch (err) {
		term.error(`ERROR: ${err}\n`);
	}
};






