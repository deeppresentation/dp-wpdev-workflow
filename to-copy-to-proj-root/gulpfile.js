const DpWf = require('./dp-wpdev-workflow/DpWf');
const dpwfconfig = require('./dp-wpdev-workflow.json');
const gulp = require( 'gulp' ); 

new DpWf(dpwfconfig);



exports.default = gulp.series('PULL_SELF');
exports.pulldpm = gulp.series('UPDATE_DP_MODULES');
exports.pushdpm = gulp.series('PUSH_DP_MODULES');
exports.pushself = gulp.series('PUSH_SELF');
exports.pullself = gulp.series('PULL_SELF');
exports.deploy2git = gulp.series('PROCESS:DIST_2_GIT');
exports.deploy2ftp = gulp.series('PROCESS:DIST_2_FTP');
exports.clearftp = gulp.series('CLEAR:FTP');
exports.deploypro = gulp.series('PROCESS:DIST_PACK_2_FTP');
exports.deployfree =  gulp.series('DEPLOY_2_WP_ORG');
exports.pulldp = gulp.series('PULL_SELF', 'UPDATE_DP_MODULES');
exports.pushdp = gulp.series('PUSH_SELF', 'PUSH_DP_MODULES');
exports.prefix = gulp.series('BUILD_DP_MODULES');