const DpWf = require('./dp-wpdev-workflow/DpWf');
const dpwfconfig = require('./dp-wpdev-workflow.json');
const gulp = require('gulp');

new DpWf(dpwfconfig);

exports.default = gulp.series('PREFIX_PHP_MODULES');
//exports.default = gulp.series('DEPLOY_2_FTP'); //

// DEPLOY
exports.clearftp = gulp.series('CLEAR_FTP');
exports.deploy2git = gulp.series('DEPLOY_2_GIT');
exports.deploy2ftp = gulp.series('DEPLOY_2_FTP');
exports.deploy2dev = gulp.series('DEPLOY_2_FTP');
exports.deploy2prod = gulp.series('DEPLOY_2_FTP_PROD');

exports.deploy2dp = gulp.series('DEPLOY_2_DP');
exports.deploy2wp = gulp.series('DEPLOY_2_WP_ORG');

// DP DEV
exports.prefix = gulp.series('PREFIX_PHP_MODULES');
exports.pulldpm = gulp.series('PULL_DP_MODULES');
exports.pushdpm = gulp.series('PUSH_DP_MODULES');
exports.pushself = gulp.series('PUSH_SELF');
exports.pullself = gulp.series('PULL_SELF');
exports.pulldp = gulp.series('PULL_SELF', 'PULL_DP_MODULES');
exports.pushdp = gulp.series('PUSH_SELF', 'PUSH_DP_MODULES');
