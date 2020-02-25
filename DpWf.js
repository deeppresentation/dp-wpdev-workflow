const fs = require('fs-extra');
const path = require('upath');
const notifier = require('node-notifier');
const gulp = require('gulp');
const ftp = require('vinyl-ftp');
const ff = require('node-find-folder');
const composer = require('gulp-composer');
const dpWfHelper = require('./DpWfHelper');
const dpLogo = 'DP-logo.png';



class DpWf {

    constructor(config) {
        this.config = config;
        this.initTasks();
    }

    initTasks() {

        gulp.task('CLEAR:FTP', this.clearFTP.bind(this));

        gulp.task('PROCESS:DIST_2_GIT', gulp.series(this.processDistDeployGit.bind(this)));
        gulp.task('PROCESS:DIST_2_FTP', gulp.series(this.processDistDeployFtp.bind(this), this.notifyDist2Ftp.bind(this)));

        gulp.task('UPDATE_G_MODULES', this.updateComposerGModules.bind(this));
        gulp.task('PUSH_G_MODULES', this.pushComposerGModules.bind(this));
    }

   _getPackageFilesAllBuilds(root) {
        
        var packageFiles = [];
        for (var file of dpWfHelper.getPackageFilesAllBuilds()) {
            packageFiles.push(path.joinSafe(root, file));
        }
        return packageFiles;
    }

    clearFTP(done) {
        if (this.config.ftp) {
            var conn = ftp.create({...this.config.ftp, parallel: 1});
            conn.rmdir( this.config.ftp.baseDir, done );
        }
        if (done) done();
    }

    processDistDeployFtp(done) {

        if (this.config.ftp) {
            var conn = ftp.create(this.config.ftp);
            return gulp.src(path.joinSafe(this.config.package.dir, this.config.id, '**'), { base: path.joinSafe('.', this.config.package.dir, this.config.id), buffer: false })
                .pipe(conn.newerOrDifferentSize(this.config.ftp.baseDir)) // only upload newer files
                .pipe(conn.dest(this.config.ftp.baseDir));
        }
        if (done) done();
    }

    notifyDist2Ftp(done) {
        notifier.notify({
            title: '✅  DISTRIBUTION WAS DEPLOYED TO FTP',
            message: 'Distribution of ' + this.config.id + ' has been deployed into ftp: ' + path.joinSafe(this.config.ftp.host, this.config.ftp.baseDir),
            icon: path.joinSafe(__dirname, dpLogo)
        });
        if (done) done();
    }

    processDistDeployGit(done) {

        var simpleGit = require('simple-git')(path.resolve(this.config.package.dir));
        var argv = require('yargs').argv;
        var commitMessage = argv.m ? argv.m : '';

        simpleGit
            .silent(false)
            .add('./*')
            .commit(commitMessage)
            .push('origin', 'master')
            .then(status => {
                notifier.notify({
                    title: '✅  DEPLOYED',
                    message: 'Distribution has been deployed into remote git. ' + ((commitMessage) ? ' -m ' + commitMessage : '') + ' Status: ' + status,
                    icon: path.joinSafe(__dirname, dpLogo)
                });
            });
        if (done) done();
    }

    updateComposerGModules(done) {
        var dirBkp = process.cwd();

        var ff_result = new ff('vendor/greeng', {
            nottraversal: ['dist', 'package']
        });
        try
        {
            ff_result.forEach((_item, _index, _array) => {
                var greengRoot = path.join(dirBkp, _item);
                composer('update greeng/*', {
                    "working-dir": path.join(greengRoot, "..", "..")
                });
            });
        }
        catch (e){
            console.log(e);
            notifier.notify({
                title: '❌  UPDATE FAILED',
                message: `G modules update finished with error. Details: ${e}`,
                icon: path.joinSafe(__dirname, dpLogo)
            });
        }
        finally{
            if (done) return done();   
        }
        
    }

    pushComposerGModules(done) {
        var dirBkp = process.cwd();
        var argv = require('yargs').argv;
        var commitMessage = argv.m ? argv.m : `Generic library commit ${Date.now()}`;

        var ff_result = new ff('vendor/greeng', {
            nottraversal: ['dist', 'package']
        });
        try
        {
        
            ff_result.forEach((_item, _index, _array) => {
                var greengRoot = path.join(dirBkp, _item);

                var modules = fs.readdirSync(greengRoot, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                if (modules)
                {
                    modules.forEach((moduleName) => {
                        var moduleDir = path.join(greengRoot, moduleName);
                        console.log(moduleDir);

                        var simpleGit = require('simple-git')(moduleDir);
                        simpleGit
                            .silent(false)
                            .add('./*')
                            .commit(commitMessage)
                            .push('origin', 'master')
                            .then(status => {
                                notifier.notify({
                                    title: '✅  PUSHED',
                                    message: 'G module ' + moduleName +' was sucessfully commited and pushed into master. Details: ' + status,
                                    icon: path.joinSafe(__dirname, dpLogo)
                                });
                            });
                    });
                }
                return done();   

            });
        }
        catch (e){
            console.log(e);
            notifier.notify({
                title: '❌  UPDATE FAILED',
                message: `G modules update finished with error. Details: ${e}`,
                icon: path.joinSafe(__dirname, dpLogo)
            });
        }
        finally{
            if (done) return done();   
        }
        
    }
}

module.exports = DpWf;