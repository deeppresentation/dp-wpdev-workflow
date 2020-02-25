const DpWf = require('./dp-wpdev-workflow/DpWf');
const dpwfconfig = require('./dp-wpdev-workflow.json');
const gulp = require( 'gulp' ); 

new DpWf(dpwfconfig);

exports.default = gulp.series('CLEAR:FTP');
exports.updategm = gulp.series('UPDATE_G_MODULES');
exports.pushgm = gulp.series('PUSH_G_MODULES');
//exports.deploy2git = gulp.series('PROCESS:DIST_2_GIT'); //will be covered in following releases
exports.deploy2ftp = gulp.series('PROCESS:DIST_2_FTP');
exports.clearftp = gulp.series('CLEAR:FTP');