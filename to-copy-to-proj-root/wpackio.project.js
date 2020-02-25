const pkg = require('./package.json');
const dpwf = require('./dp-wpdev-workflow.json');
const camelCase = require('camelcase');
const dpWfHelper = require('./dp-wpdev-workflow/DpWfHelper');

dpWfHelper.writeBuildTypePhp();// add PRO or FREE define to dp-build-type.php


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

module.exports = {
	// Project Identity
	appName: camelCase(dpwf.id),
	type: dpwf.type, // plugin or theme
	slug: dpwf.id, // Plugin or Theme slug, basically the directory name under `wp-content/<themes|plugins>`
	// Used to generate banners on top of compiled stuff
	bannerConfig: {
		name: dpwf.title,
		author: dpwf.author,
		license: dpwf.license[`type${dpwf.buildType}`],
		link: dpwf.license[`link${dpwf.buildType}`],
		version: pkg.version,
        copyrightText: dpwf.license[`copyrightText${dpwf.buildType}`],
		credit: true,
    },

	// Files we need to compile, and where to put
	files: [
        {
            name: 'scriptsAndStyles',
            entry: dpWfHelper.getEntryAssetFiles(),
            // Extra webpack config to be dynamically created
            webpackConfig: (config, merge, appDir, isDev) => {
                const customRules = {
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
                };

                // merge and return
                return merge(config, customRules);
            },
        }
    ],
    // Hook into babeloverride so that we can add react-hot-loader plugin
	jsBabelOverride: defaults => ({
		...defaults,
		plugins: dpwf.hasReact ? ['react-hot-loader/babel'] : [],
	}),
	// Output path relative to the context directory
	// We need relative path here, else, we can not map to publicPath
	outputPath: dpwf.assets.dir,
	// Project specific config
	// Needs react(jsx)?
	hasReact: dpwf.hasReact,
	// Needs sass?
	hasSass: dpwf.hasSass,
	// Needs less?
	hasLess: false,
	// Needs flowtype?
	hasFlow: false,
	// Externals
	// <https://webpack.js.org/configuration/externals/>
	externals: {
		jquery: 'jQuery',
	},
	// Webpack Aliases
	// <https://webpack.js.org/configuration/resolve/#resolve-alias>
	alias: undefined,
	// Show overlay on development
	errorOverlay: true,
	// Auto optimization by webpack
	// Split all common chunks with default config
	// <https://webpack.js.org/plugins/split-chunks-plugin/#optimization-splitchunks>
	// Won't hurt because we use PHP to automate loading
	optimizeSplitChunks: true,
	// Usually PHP and other files to watch and reload when changed
	watch: dpwf.watch,
	// Files that you want to copy to your ultimate theme/plugin package
	// Supports glob matching from minimatch
	// @link <https://github.com/isaacs/minimatch#usage>
	packageFiles: dpWfHelper.getPackageFiles(),
	// Path to package directory, relative to the root
	packageDirPath: dpwf.package.dir,
};
