const fs  = require('fs-extra');
const { readdirSync} = require('fs-extra');
const path = require('upath');
const notifier = require('node-notifier');
const gulp = require('gulp');
const clean = require('gulp-clean');
const ftp = require('vinyl-ftp');
const composer = require('gulp-composer');
const dpWfHelper = require('./DpWfHelper');
const simpleGit = require('simple-git');
const dpLogo = 'DP-logo.png';
const term = require('terminal-kit').terminal;


class DpWf {

    constructor(config) {
        this.config = config;
        this.initTasks();
    }

    initTasks() {

        gulp.task('CLEAR:FTP', this.clearFTP.bind(this));

        gulp.task('PROCESS:DIST_2_GIT', gulp.series(this.processDistDeployGit.bind(this)));
        gulp.task('PROCESS:DIST_2_FTP', gulp.series(this.processDistDeployFtp.bind(this), this.notifyDist2Ftp.bind(this)));
        gulp.task('PROCESS:DIST_PACK_2_FTP', gulp.series(this.processDistDeployPackFtp.bind(this), this.notifyDistPack2Ftp.bind(this)));

        gulp.task('UPDATE_DP_MODULES', this.updateComposerDPModules.bind(this));
        gulp.task('PUSH_DP_MODULES', this.pushComposerDPModules.bind(this));
        gulp.task('PUSH_SELF', this.pushSelf.bind(this));
        gulp.task('DEPLOY_2_WP_ORG', gulp.series(this.clearWordpressOrgTrunk.bind(this), this.deployPackFilesToWordpressOrg.bind(this)));

        
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

    processDistDeployPackFtp(done){
        if (this.config.ftp) {
            var conn = ftp.create(this.config.ftp);
            return gulp.src(path.joinSafe(this.config.package.dir, this.config.id + '.zip'), { base: path.joinSafe('.', this.config.package.dir), buffer: false })
                .pipe(conn.newerOrDifferentSize(this.config.ftp.baseDirZip)) // only upload newer files
                .pipe(conn.dest(this.config.ftp.baseDirZip));
        }
        else if (done) done();
    }
    

    processDistDeployFtp(done) {

        if (this.config.ftp) {
            var conn = ftp.create(this.config.ftp);
            return gulp.src(path.joinSafe(this.config.package.dir, this.config.id, '**'), { base: path.joinSafe('.', this.config.package.dir, this.config.id), buffer: false })
                .pipe(conn.newerOrDifferentSize(this.config.ftp.baseDir)) // only upload newer files
                .pipe(conn.dest(this.config.ftp.baseDir));
        }
        else if (done) done();
    }

    notifyDist2Ftp(done) {
        notifier.notify({
            title: '✅  DISTRIBUTION WAS DEPLOYED TO FTP',
            message: 'Distribution of ' + this.config.id + ' has been deployed into ftp: ' + path.joinSafe(this.config.ftp.host, this.config.ftp.baseDir),
            icon: path.joinSafe(__dirname, dpLogo)
        });
        if (done) done();
    }

    notifyDistPack2Ftp(done) {
        notifier.notify({
            title: '✅  DISTRIBUTION PACKAGE WAS DEPLOYED TO FTP',
            message: 'Distribution of ' + this.config.id + ' has been deployed into ftp: ' + path.joinSafe(this.config.ftp.host, this.config.ftp.baseDirZip),
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

    updateComposerDPModules(done) {
        composer('update deeppresentation/*');
        notifier.notify({
            title: '✅  UPDATED',
            message: 'Deep presentation PHP modules was updated trough composer.',
            icon: path.joinSafe(__dirname, dpLogo)
        });
        if (done) done();
    }

    getDirectories = source =>
    {
        return readdirSync(source, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => path.joinSafe(source, dirent.name))
    }

    pushComposerDPModules(done) {
        try
        {
            var dirBkp = process.cwd();
            var argv = require('yargs').argv;
            var commitMessage = argv.m ? argv.m : `Generic library commit ${Date.now()}`;
            var modules = this.getDirectories(path.joinSafe(dirBkp, 'vendor', 'deeppresentation'));
            this.pushGitModule( modules, 0, commitMessage, done);
        }
        catch (e){
            console.log(e);
            notifier.notify({
                title: '❌  UPDATE FAILED',
                message: `DP modules update finished with error. Details: ${e}`,
                icon: path.joinSafe(__dirname, dpLogo)
            });
            if (done) return done();
        }
    }

    pushSelf(done) {
        var argv = require('yargs').argv;
        var dirBkp = process.cwd();
        var commitMessage = argv.m ? argv.m : `Generic dp-wpdev-workflow commit ${Date.now()}`;
        this.pushGitModule( [path.joinSafe(dirBkp,'dp-wpdev-workflow')], 0, commitMessage, done);  
    }

    pushGitModule( modules, idx, commitMessage, done){

        if (idx < modules.length)
        {
            var moduleDir = modules[idx];
            var git = simpleGit(moduleDir);
            git.add('--all')
                .then(() => git.commit(commitMessage))
                .then(() => git.push('origin', 'master'))
                .then(() => {
                    term.green('DP module ' + moduleDir +' was sucessfully commited and pushed into master.\n');
                    idx++;
                    this.pushGitModule( modules, idx, commitMessage, done);
                })
        }
        else if (done) done();
    }

    pullDPModules( modules, idx, commitMessage, done)
    {
        if (idx < modules.length)
        {
            var moduleDir = modules[idx];
            composer('update deeppresentation/*'/*, {
                "working-dir": path.join(greengRoot, "..", "..")
            }*/);
            var git = simpleGit(moduleDir);
            git.add('--all')
                .then(() => git.commit(commitMessage))
                .then(() => git.push('origin', 'master'))
                .then(() => {
                    term.green('DP module ' + moduleDir +' was sucessfully commited and pushed into master.\n');
                    idx++;
                    this.pushGitModule( modules, idx, commitMessage, done);
                })
        }
        else {
            if (done) done();
        }
    }

    clearWordpressOrgTrunk(done){
        const wporgTrunkPath = path.joinSafe(this.config.wordpressOrgSvnBaseDir, this.config.id, 'trunk');
        if (fs.existsSync(wporgTrunkPath))
        {
            return gulp.src(wporgTrunkPath)
                .pipe(clean({force: true}));
        }
        else if (done) done();
    }

    deployPackFilesToWordpressOrg(){
        return gulp.src(path.joinSafe(this.config.package.dir, this.config.id, '**', '*'))
        .pipe(gulp.dest(path.joinSafe(this.config.wordpressOrgSvnBaseDir, this.config.id, 'trunk')));
    }
}

module.exports = DpWf;