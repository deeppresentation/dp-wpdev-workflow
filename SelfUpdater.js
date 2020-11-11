const gulp = require('gulp');
const path = require('upath');
const simpleGit = require('simple-git');
const fs  = require('fs-extra');
const term = require('terminal-kit').terminal;
const npm = require('npm');

class SelfUpdater {
    constructor(moduleId) {
        this.moduleId = moduleId;
        this.initTasks();
    }

    initTasks() {
        gulp.task('PUSH_SELF', gulp.series(this.updateSelfFromProj.bind(this), this.pushSelf.bind(this)));
        gulp.task('PULL_SELF', gulp.series(this.pullSelf.bind(this), this.updateProjGulpfileFromSelf.bind(this), this.updateProjPackageJsonFromSelf.bind(this)));
    }

    updateSelfFromProj(done) {
        const cDir = process.cwd();
        const packageJsonProj = require(path.joinSafe(cDir, 'package.json'));
        const copyToRootPath = path.joinSafe(cDir, this.moduleId, 'to-copy-to-proj-root');
        const packageJsonDpWfPath = path.joinSafe(copyToRootPath, 'package.json');
        const packageJsonDpWf = require(packageJsonDpWfPath);
        if (packageJsonProj && packageJsonDpWf) {
            packageJsonDpWf.devDependencies = packageJsonProj.devDependencies;
            packageJsonDpWf.scripts = packageJsonProj.scripts;
            fs.outputJSONSync(packageJsonDpWfPath, packageJsonDpWf, { spaces: 4 });
        }
        term.yellow(`Pushing SELF: consider to adjust ${this.moduleId}.json file in tp-copy-to-proj-root-and-edit folder, if you made a config system change.\n`);
        return gulp.src(path.joinSafe(cDir, 'gulpfile.js'))
            .pipe(gulp.dest(copyToRootPath));
    }

    pushSelf(done) {
        var argv = require('yargs').argv;
        var dirBkp = process.cwd();
        var commitMessage = argv.m ? argv.m : `Generic ${this.moduleId} commit ${Date.now()}`;
        this.pushGitModule([path.joinSafe(dirBkp, this.moduleId)], 0, commitMessage, done);
    }

    updateProjGulpfileFromSelf(done) {
        const cDir = process.cwd();
        const copyToRootPath = path.joinSafe(cDir, this.moduleId, 'to-copy-to-proj-root');
        return gulp.src(path.joinSafe(copyToRootPath, 'gulpfile.js'))
            .pipe(gulp.dest(cDir));
    }

    updateProjPackageJsonFromSelf(done) {
        const cDir = process.cwd();
        const packageJsonProj = require(path.joinSafe(cDir, 'package.json'));
        const copyToRootPath = path.joinSafe(cDir, this.moduleId, 'to-copy-to-proj-root');
        const packageJsonDpWfPath = path.joinSafe(copyToRootPath, 'package.json');
        const packageJsonDpWf = require(packageJsonDpWfPath);
        if (packageJsonDpWf && packageJsonProj) {
            var shouldWritePackageJson = false;
            var shouldInstallNpm = false;
            if (JSON.stringify(packageJsonDpWf.devDependencies) !== JSON.stringify(packageJsonProj.devDependencies)) {
                term.yellow('Pulling SELF: Dev dependencies in project\'s package.json are not up-to-date.\n');
                packageJsonProj.devDependencies = packageJsonDpWf.devDependencies;
                shouldWritePackageJson = true;
                shouldInstallNpm = true;
            }
            if (JSON.stringify(packageJsonDpWf.scripts) !== JSON.stringify(packageJsonProj.scripts)) {
                term.yellow('Pulling SELF: Scripts in project\'s package.json are not up-to-date.\n');
                packageJsonProj.scripts = packageJsonDpWf.scripts;
                shouldWritePackageJson = true;
            }
            if (shouldWritePackageJson) {
                if (shouldInstallNpm) term.yellow("Your package.json is not up-to-date. Should I update it and install missing dev dependencies? (Y/[n])\n");
                else term.yellow("Your package.json is not up-to-date. Should I update it? (Y/[n])\n");
                term.yesOrNo({ yes: ['y', 'ENTER'], no: ['n'] }, (error, result) => {
                    var result = true;
                    if (result) {
                        term.brightGreen('Updating package.json ... \n');
                        fs.outputJSONSync(path.joinSafe(cDir, 'package.json'), packageJsonProj, { spaces: 4 });

                        if (shouldInstallNpm) {
                            function printNpmLog(message) {
                                term(message + '\n');
                            }
                            if (done) done();
                            npm.load((err) => {
                                term.brightGreen('Pulling SELF: Installing new dev dependencies ...\n');
                                npm.on('log', printNpmLog);
                                npm.commands.install([], function (er, data) {
                                    if (er) term.red(er + '\n');
                                    npm.off('log', printNpmLog);
                                    if (done) done();
                                    process.exit();
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
        this.pullGitModule([path.joinSafe(dirBkp, this.moduleId)], 0, done);
    }


    pullGitModule(modules, idx, done) {

        if (idx < modules.length) {
            var moduleDir = modules[idx];
            var git = simpleGit(moduleDir);
            git.pull('origin', 'master')
                .then(() => {
                    term.green('Module ' + moduleDir + ' was sucessfully pulled from master.\n');
                    idx++;
                    this.pullGitModule(modules, idx, done);
                })
        }
        else if (done) done();
    }

    pushGitModule(modules, idx, commitMessage, done) {

        if (idx < modules.length) {
            var moduleDir = modules[idx];
            var git = simpleGit(moduleDir);
            git.add('--all')
                .then(() => git.commit(commitMessage), (reason) => term.green('Commit of module ' + moduleDir + ' failed: ' + reason + '\n'))
                .then(() => git.push('origin', 'master'), (reason) => term.green('Push of module ' + moduleDir + ' failed: ' + reason + '\n'))
                .then(() => {
                    term.green('Module ' + moduleDir + ' was sucessfully commited and pushed into master.\n');
                    idx++;
                    this.pushGitModule(modules, idx, commitMessage, done);
                })
        }
        else if (done) done();
    }


}
module.exports = SelfUpdater;