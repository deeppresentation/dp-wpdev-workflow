const DpWf = require('./dp-wpdev-workflow/DpWf');
const dpwfconfig = require('./dp-wpdev-workflow.json');
const gulp = require( 'gulp' ); 

new DpWf(dpwfconfig);

exports.default =  gulp.series('CLEAR:FTP');
exports.updatedpm = gulp.series('UPDATE_DP_MODULES');
exports.pushdpm = gulp.series('PUSH_DP_MODULES');
exports.pushself = gulp.series('PUSH_SELF');
exports.deployPack = gulp.series('PROCESS:DIST_PACK_2_FTP');
exports.deploy2git = gulp.series('PROCESS:DIST_2_GIT');
exports.deploy2ftp = gulp.series('PROCESS:DIST_2_FTP');
exports.clearftp = gulp.series('CLEAR:FTP');
exports.deploy2wporg =  gulp.series('DEPLOY_2_WP_ORG');