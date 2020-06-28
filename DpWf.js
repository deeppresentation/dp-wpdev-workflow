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
const simpleGit = require('simple-git');
const dpLogo = 'DP-logo.png';
const term = require('terminal-kit').terminal;
const cleanDest = require('gulp-clean-dest');
const merge = require('merge-stream');
const replace = require('gulp-batch-replace');
const npm = require('npm');

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
        gulp.task('PUSH_SELF', gulp.series(this.updateDpWfFromProj.bind(this), this.pushSelf.bind(this)));
        gulp.task('PULL_SELF', gulp.series(this.pullSelf.bind(this), this.updateProjGulpfileFromDpWf.bind(this), this.updateProjPackageJsonFromDpWf.bind(this)));
        gulp.task('DEPLOY_2_WP_ORG', gulp.series(this.clearWordpressOrgTrunk.bind(this), this.deployPackFilesToWordpressOrg.bind(this)));
        gulp.task('BUILD_DP_MODULES', gulp.series(this.buildDPModules.bind(this), this.dumpAutoload.bind(this)));
        gulp.task('PUSH_DP_MODULES', this.pushComposerDPModules.bind(this));
        gulp.task('UPDATE_DP_MODULES', gulp.series(this.updateComposerDPModules.bind(this), 'BUILD_DP_MODULES'));
        gulp.task('DUMPAUTOLOAD', this.dumpAutoload.bind(this));
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
            return gulp.src(path.joinSafe(this.config.package.dir, dpWfHelper.getPackageId() + '.zip'), { base: path.joinSafe('.', this.config.package.dir), buffer: false })
                .pipe(conn.newerOrDifferentSize(this.config.ftp.baseDirZip)) // only upload newer files
                .pipe(conn.dest(this.config.ftp.baseDirZip));
        }
        else if (done) done();
    }
    

    processDistDeployFtp(done) {

        if (this.config.ftp) {
            var conn = ftp.create(this.config.ftp);
            return gulp.src(path.joinSafe(this.config.package.dir, dpWfHelper.getPackageId(), '**'), { base: path.joinSafe('.', this.config.package.dir, dpWfHelper.getPackageId()), buffer: false })
                .pipe(conn.newerOrDifferentSize(this.config.ftp.baseDir)) // only upload newer files
                .pipe(conn.dest(this.config.ftp.baseDir));
        }
        else if (done) done();
    }

    notifyDist2Ftp(done) {
        notifier.notify({
            title: '✅  DISTRIBUTION WAS DEPLOYED TO FTP',
            message: 'Distribution of ' + dpWfHelper.getPackageId() + ' has been deployed into ftp: ' + path.joinSafe(this.config.ftp.host, this.config.ftp.baseDir),
            icon: path.joinSafe(__dirname, dpLogo)
        });
        if (done) done();
    }

    notifyDistPack2Ftp(done) {
        notifier.notify({
            title: '✅  DISTRIBUTION PACKAGE WAS DEPLOYED TO FTP',
            message: 'Distribution of ' + dpWfHelper.getPackageId() + ' has been deployed into ftp: ' + path.joinSafe(this.config.ftp.host, this.config.ftp.baseDirZip),
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

    buildDPModules(done){
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

    updateDpWfFromProj(done){
        const cDir = process.cwd(); 
        const packageJsonProj = require(path.joinSafe(cDir, 'package.json'));
        const copyToRootPath = path.joinSafe(cDir, 'dp-wpdev-workflow', 'to-copy-to-proj-root');
        const packageJsonDpWfPath = path.joinSafe(copyToRootPath, 'package.json');
        const packageJsonDpWf = require(packageJsonDpWfPath);
        if (packageJsonProj && packageJsonDpWf)
        {
            packageJsonDpWf.devDependencies = packageJsonProj.devDependencies;
            packageJsonDpWf.scripts = packageJsonProj.scripts;
            fs.outputJSONSync(packageJsonDpWfPath, packageJsonDpWf, { spaces: 4 });
        }
        term.yellow('Pushing SELF: consider to adjust dp-wpdev-workflow.json file in tp-copy-to-proj-root-and-edit folder, if you made a config system change.\n');
        return gulp.src(path.joinSafe(cDir, 'gulpfile.js'))
            .pipe(gulp.dest(copyToRootPath));
    }

    pushSelf(done) {
        var argv = require('yargs').argv;
        var dirBkp = process.cwd();
        var commitMessage = argv.m ? argv.m : `Generic dp-wpdev-workflow commit ${Date.now()}`;
        this.pushGitModule( [path.joinSafe(dirBkp,'dp-wpdev-workflow')], 0, commitMessage, done);  
    }

    updateProjGulpfileFromDpWf(done){
        const cDir = process.cwd(); 
        const copyToRootPath = path.joinSafe(cDir, 'dp-wpdev-workflow', 'to-copy-to-proj-root');
        return gulp.src(path.joinSafe(copyToRootPath, 'gulpfile.js'))
            .pipe(gulp.dest(cDir)); 
    }

    updateProjPackageJsonFromDpWf(done){
        const cDir = process.cwd(); 
        const packageJsonProj = require(path.joinSafe(cDir, 'package.json'));
        const copyToRootPath = path.joinSafe(cDir, 'dp-wpdev-workflow', 'to-copy-to-proj-root');
        const packageJsonDpWfPath = path.joinSafe(copyToRootPath, 'package.json');
        const packageJsonDpWf = require(packageJsonDpWfPath);
        if (packageJsonDpWf && packageJsonProj)
        {
            var shouldWritePackageJson = false;
            var shouldInstallNpm = false;
            if (JSON.stringify(packageJsonDpWf.devDependencies) !== JSON.stringify(packageJsonProj.devDependencies))
            {
                term.yellow('Pulling SELF: Dev dependencies in project\'s package.json are not up-to-date.\n');
                packageJsonProj.devDependencies = packageJsonDpWf.devDependencies;
                shouldWritePackageJson = true;
                shouldInstallNpm = true;
            }
            if (JSON.stringify(packageJsonDpWf.scripts) !== JSON.stringify(packageJsonProj.scripts))
            {
                term.yellow('Pulling SELF: Scripts in project\'s package.json are not up-to-date.\n');
                packageJsonProj.scripts = packageJsonDpWf.scripts;
                shouldWritePackageJson = true;
            }
            if (shouldWritePackageJson)
            {
                if (shouldInstallNpm) term.yellow("Your package.json is not up-to-date. Should I update it and install missing dev dependencies? (Y/[n])\n");
                else term.yellow("Your package.json is not up-to-date. Should I update it? (Y/[n])\n");
                term.yesOrNo( { yes: [ 'y' , 'ENTER' ] , no: [ 'n' ] } , ( error , result ) => {
                    var result = true;
                    if ( result ) {
                        term.brightGreen('Updating package.json ... \n');
                        fs.outputJSONSync(path.joinSafe(cDir, 'package.json'), packageJsonProj, { spaces: 4 });

                        if (shouldInstallNpm)
                        {
                            function printNpmLog(message){
                                term(message + '\n');
                            }
                            if (done) done();
                            npm.load( (err) => {
                                term.brightGreen('Pulling SELF: Installing new dev dependencies ...\n');
                                npm.on('log', printNpmLog);
                                 npm.commands.install([], function (er, data){
                                    if (er) term.red(er + '\n');
                                    npm.off('log', printNpmLog);
                                    if (done) done();
                                    process.exit() ;
                                });
                            
                            }); 
                        } else if (done) done();
                    } else if (done) done();
                });
            } else if (done) done();
        } else if (done) done();
    }

    pullSelf(done) {
        var dirBkp = process.cwd();
        this.pullGitModule( [path.joinSafe(dirBkp,'dp-wpdev-workflow')], 0, done);  
    }



    pullGitModule( modules, idx, done){

        if (idx < modules.length)
        {
            var moduleDir = modules[idx];
            var git = simpleGit(moduleDir);
            git.pull('origin', 'master')
                .then(() => {
                    term.green('Module ' + moduleDir +' was sucessfully pulled from master.\n');
                    idx++;
                    this.pullGitModule( modules, idx, done);
                })
        }
        else if (done) done();
    }

    pushGitModule( modules, idx, commitMessage, done){

        if (idx < modules.length)
        {
            var moduleDir = modules[idx];
            var git = simpleGit(moduleDir);
            git.add('--all')
                .then(() => git.commit(commitMessage), (reason) => term.green('Commit of module ' + moduleDir +' failed: '+ reason + '\n'))
                .then(() => git.push('origin', 'master'), (reason) => term.green('Push of module ' + moduleDir +' failed: '+ reason + '\n'))
                .then(() => {
                    term.green('Module ' + moduleDir +' was sucessfully commited and pushed into master.\n');
                    idx++;
                    this.pushGitModule( modules, idx, commitMessage, done);
                })
        }
        else if (done) done();
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