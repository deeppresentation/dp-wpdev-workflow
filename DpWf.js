const fs  = require('fs-extra');
const { readdirSync} = require('fs-extra');
const path = require('upath');
const notifier = require('node-notifier');
const gulp = require('gulp');
const clean = require('gulp-clean');
const ftp = require('vinyl-ftp');
const composer = require('gulp-composer');
const dpWfHelper = require('./DpWfHelper');
const dpwfCfg = require('../dp-wpdev-workflow.json');
const dpLogo = 'DP-logo.png';
const cleanDest = require('gulp-clean-dest');
const merge = require('merge-stream');
const replace = require('gulp-batch-replace');
const gulpif = require('gulp-if');


const SELF_ROOT_DIR = "dp-wpdev-workflow";

const SelfUpdater = require('./SelfUpdater');



class DpWf {

    constructor(config) {
        this.config = config;
        this.selfUpdater = new SelfUpdater(SELF_ROOT_DIR);
        this.initTasks();
    }
 


    initTasks() {
        // DEPLOY
        gulp.task('CLEAR_FTP', this.clearFTP.bind(this));
        gulp.task('DEPLOY_2_GIT', gulp.series(this.deploy2Git.bind(this)));
        gulp.task('DEPLOY_2_FTP', gulp.series(this.deploy2Ftp.bind(this), this.notifyDeploy2Ftp.bind(this)));
        gulp.task('DEPLOY_2_DP', gulp.series(
            this.deployPack2Dp.bind(this), 
            this.notifyDeployPack2Dp.bind(this),
            this.deployPack2DpBC.bind(this), 
            this.notifyDeployPack2DpBC.bind(this)
        ));
        gulp.task('DEPLOY_2_WP_ORG', gulp.series(this.clearWordpressOrgTrunk.bind(this), this.deploy2WordpressOrg.bind(this)));
        
        gulp.task('PREFIX_PHP_MODULES', gulp.series(this.prefixPhpModules.bind(this), this.dumpAutoload.bind(this)));
        
        gulp.task('PUSH_DP_MODULES', this.pushComposerDPModules.bind(this));
        gulp.task('PULL_DP_MODULES', gulp.series(this.updateComposerDPModules.bind(this), 'PREFIX_PHP_MODULES'));
       
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



    _deployPack2Dp(done, ftpDir){
        if (this.config.packageFtp && ftpDir) {
            var conn = ftp.create(this.config.packageFtp);
            return gulp.src(path.joinSafe(this.config.package.dir, dpWfHelper.getPackageId() + '.zip'), { base: path.joinSafe('.', this.config.package.dir), buffer: false })
                .pipe(conn.newerOrDifferentSize(ftpDir)) // only upload newer files
                .pipe(conn.dest(ftpDir))
        }
        else if (done) done();
    }

    deployPack2Dp(done){
        return this._deployPack2Dp(done, this.config.packageFtp.baseDir);  
    }

    // Backward compatibility
    deployPack2DpBC(done){
        return this._deployPack2Dp(done, this.config.packageFtp.baseDirBC);  
    }
    

    deploy2Ftp(done) {

        if (this.config.ftp) {
            var conn = ftp.create(this.config.ftp);
            return gulp.src(path.joinSafe(this.config.package.dir, dpWfHelper.getPackageId(), '**'), { base: path.joinSafe('.', this.config.package.dir, dpWfHelper.getPackageId()), buffer: false })
                .pipe(conn.newerOrDifferentSize(this.config.ftp.baseDir)) // only upload newer files
                .pipe(conn.dest(this.config.ftp.baseDir));
        }
        else if (done) done();
    }

    notifyDeployPack2Dp(done) {
        return this._notifyDeployPack2Dp(done, this.config.packageFtp.baseDir);  
    }

    notifyDeployPack2DpBC(done) {
        return this._notifyDeployPack2Dp(done, this.config.packageFtp.baseDirBC);  
    }

    _notifyDeployPack2Dp(done, ftpDir) {
        if (ftpDir){
            notifier.notify({
                title: '✅  DISTRIBUTION PACKAGE WAS DEPLOYED TO FTP',
                message: 'Distribution of ' + dpWfHelper.getPackageId() + ' has been deployed into ftp: ' + path.joinSafe(this.config.packageFtp.host, ftpDir),
                icon: path.joinSafe(__dirname, dpLogo)
            });
        }
        if (done) done();
    }

    notifyDeploy2Ftp(done) {
        notifier.notify({
            title: '✅  DISTRIBUTION WAS DEPLOYED TO FTP',
            message: 'Distribution of ' + dpWfHelper.getPackageId() + ' has been deployed into ftp: ' + path.joinSafe(this.config.ftp.host, this.config.ftp.baseDir),
            icon: path.joinSafe(__dirname, dpLogo)
        });
        if (done) done();
    }

    deploy2Git(done) {

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

    dumpAutoload(done) {
        composer('dumpautoload -o');
        notifier.notify({
            title: '✅  COMPOSER AUTOLOAD DUMPED',
            message: 'Autoload files was updated.',
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

    prefixPhpModules(done){
        if (dpwfCfg.phpScoper && dpwfCfg.phpScoper.modules)
        {   
            var cdir = process.cwd();
            const moduleReplacePreCfgs = {};
            for (const module of dpwfCfg.phpScoper.modules)
            {
                const modulePath = path.joinSafe(cdir, 'vendor', module);
                const composerData = dpWfHelper.getComposerAutoloadData(modulePath);
                dpWfHelper.setComposerAutoloadData(path.joinSafe(cdir, 'vendor'), module, composerData.namespace, composerData.namespacePrefixed, 'build');
                moduleReplacePreCfgs[module] = {
                    replaceThis: [composerData.namespace, composerData.namespacePrefixed],
                    src: path.joinSafe(modulePath, composerData.path, '**', '*'),
                    dst: path.joinSafe(modulePath, 'build')
                };
            }

            const moduleReplaceCfgs = [];
            for (const moduleKey of Object.keys(moduleReplacePreCfgs))
            {
                const finalModCfg = {
                    ...moduleReplacePreCfgs[moduleKey],
                    replaceThis: [ moduleReplacePreCfgs[moduleKey].replaceThis ]
                }
                if (dpwfCfg.phpScoper.dependencies)
                {
                    const dependencies = dpwfCfg.phpScoper.dependencies[moduleKey];
                    if (dependencies)
                    {
                        dependencies.forEach(dep => {
                            if (moduleReplacePreCfgs[dep])
                            {
                                finalModCfg.replaceThis.push(moduleReplacePreCfgs[dep].replaceThis); 
                            }      
                        });  
                    }
                }
                moduleReplaceCfgs.push(finalModCfg);
            }

            return merge(moduleReplaceCfgs.map((moduleCfg) => {
                return gulp.src(moduleCfg.src)
                    .pipe(replace(moduleCfg.replaceThis))
                    .pipe(cleanDest(moduleCfg.dst))
                    .pipe(gulp.dest(moduleCfg.dst))
            }));
        }
        if (done) return done();
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

    pushComposerDPModules(done) {
        try
        {
            var dirBkp = process.cwd();
            var argv = require('yargs').argv;
            var commitMessage = argv.m ? argv.m : `Generic library commit ${Date.now()}`;
            var modules = this.getDirectories(path.joinSafe(dirBkp, 'vendor', 'deeppresentation'));
            this.selfUpdater.pushGitModule(modules, 0, commitMessage, done);
            //this.pushGitModule( modules, 0, commitMessage, done);
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

    clearWordpressOrgTrunk(done){
        const wporgTrunkPath = path.joinSafe(this.config.wordpressOrgSvnBaseDir, this.config.id, 'trunk');
        if (fs.existsSync(wporgTrunkPath))
        {
            return gulp.src(wporgTrunkPath)
                .pipe(clean({force: true}));
        }
        else if (done) done();
    }

    deploy2WordpressOrg(){
        return gulp.src(path.joinSafe(this.config.package.dir, this.config.id, '**', '*'))
        .pipe(gulp.dest(path.joinSafe(this.config.wordpressOrgSvnBaseDir, this.config.id, 'trunk')));
    }
}

module.exports = DpWf;