'use strict';
const path = require('path'),
    vscode = require('vscode'),
    fsPlus = require('fs-plus'),
    fsExtra = require('fs-extra'),
    optProvider = require('../../lib/options-provider').getInstance(),
    Build = require('../yang-build/main'),
    gulp = require('gulp'),
    nunjucks = require('gulp-nunjucks');
    // yeoman = require('yeoman-environment');
    //
module.exports = {
    bootstrap() {
        vscode.commands.executeCommand("vscode.previewHtml", "aliosstudio://project/create", vscode.ViewColumn.One, 'Create Project');
    },
    /**
     * [checkAosProject description]
     * @return {Promise} [description]
     */
    async checkAosProject() {
        if (optProvider.isAosSource) {
            let settingToolChain = vscode.workspace.getConfiguration('aliosStudio.build').get('toolchain');
            if (!settingToolChain) {
                let toolChains = vscode.workspace.getConfiguration('aliosStudio').get('sdkPaths').map(item => item.toolChain).filter(item => item),
                    globalToolChains = Build.findGlobalToolchain(),
                    isWin = process.platform === 'win32',
                    handler = {
                        setToolChain(dir) {
                            vscode.workspace.getConfiguration('aliosStudio.build').update('toolchain', dir, false);
                            let launchPath = path.join(vscode.workspace.rootPath, '.vscode', 'launch.json');
                            if (fsExtra.pathExistsSync(launchPath)) {
                                let launch = fsExtra.readJsonSync(launchPath);
                                //
                                launch.configurations.forEach(item => {
                                    item.windows.miDebuggerPath = isWin ? path.join(dir, 'arm-none-eabi-gdb.exe') : 'arm-none-eabi-gdb.exe';
                                    item.osx.miDebuggerPath =
                                    item.linux.miDebuggerPath = isWin ? 'arm-none-eabi-gdb' : path.join(dir, 'arm-none-eabi-gdb');
                                });
                                fsExtra.writeJsonSync(launchPath, launch, {spaces: 4});
                                vscode.window.showInformationMessage('Tool chain setting have completed!');
                            }
                        },
                        //
                        async showQuickPick(toolChains) {
                            let dir = await vscode.window.showQuickPick(toolChains, {
                                placeHolder: 'The project have not set tool chain, please selet one below the options:'
                            });
                            if (!dir) {
                                await vscode.window.showErrorMessage('Plese select a tool chain path!');
                                return this.showQuickPick(toolChains);
                            }
                            this.setToolChain(dir);
                        },
                        //
                        async showInput() {
                            let dir = await vscode.window.showInputBox({
                                placeHolder: process.platform === 'win32' ? 'C:\\Program Files\\GNU Tools ARM Embedded\\5.4 2016q34\\bin'
                                    : '/usr/local/GNU Tools ARM Embedded/5.4 2016q34/bin',
                                prompt: 'Please input tool chain path.'
                            });
                            if (!dir) {
                                await vscode.window.showErrorMessage('The path is required!');
                                return this.showInput();
                            }
                            if (!fsPlus.existsSync(dir)) {
                                await vscode.window.showErrorMessage('The path is not existed!');
                                return this.showInput();
                            }
                            if (!fsPlus.isDirectorySync(dir)) {
                                await vscode.window.showErrorMessage('The path is not a directory!');
                                return this.showInput();
                            }
                            if (!fsPlus.existsSync(path.join(dir, `arm-none-eabi-gcc${process.platform === 'win32' ? '.exe' : ''}`))) {
                                await vscode.window.showErrorMessage('It is not a tool chain path!');
                                return this.showInput();
                            }
                            this.setToolChain(dir);
                        }
                    };
                //
                globalToolChains && toolChains.unshift(globalToolChains);
                if (toolChains.length === 1) {
                    handler.setToolChain(toolChains[0]);
                } else if (toolChains.length) {
                    await vscode.window.showWarningMessage('The project have not set tool chain, click close button then go to select one.');
                    handler.showQuickPick(toolChains);
                } else {
                    // go to set the sdk and tool-chain
                    await vscode.window.showWarningMessage('The project have not set tool chain, click close button then go to setting.');
                    handler.showInput();
                }
            }
        }
    },
    /**
     * [validate description]
     * @param  {[type]} options [description]
     * @return {[type]}         [description]
     */
    validate(options) {
        // location path
        let parse = path.parse(options.location);
        if (!fsPlus.existsSync(parse.root)) {
            return {error: 1, msg: 'The location path is not existed!'};
        }
        if (!fsPlus.existsSync(options.location)) {return {error: 0};}
        if (!fsPlus.isDirectorySync(options.location)) {
            return {error: 1, msg: 'The location path is not a directory!'};
        }
        if (fsPlus.listSync(options.location).length) {
            return {error: 2, msg: 'The location path is not empty! do you want to continue and to override it?'};
        }
        return {error: 0};
    },
    /**
     * [scaffold description]
     * @param  {[type]}  options [description]
     * @return {Promise}         [description]
     */
    async scaffold(options) {
        let ret = await new Promise((resolve, reject) => {
            // console.log(options);
            let sep = /\\/g,
                name = path.basename(options.templateId);
                //toolChain = (options.toolChain || '').replace(sep, '\\\\');
                // toolChainPlatformMapping = {darwin: 'OSX', win32: 'Win32', linux: 'Linux64'};
            //
            gulp.task('vscode', () => {
                return gulp.src(path.join(__dirname, 'vscode', '**'))
                    .pipe(nunjucks.compile({
                        // public
                        location: options.location.replace(sep, '/'),
                        // settings
                        name: name,
                        hardwareBoard: options.hardwareBoard,
                        // c_cpp_properties
                        platform: process.platform,
                        sdkPath: options.sdkPath.replace(sep, '\\\\')
                    }, {autoescape: false}))
                    .pipe(gulp.dest(path.join(options.location, '.vscode')));
            });
            //
            gulp.task('sdk', ['vscode'], () => {
                let prefix_0 = '!(.git|.gitignore|.DS_Store|doc|example|test|tools|kernel|out)',
                    prefix_1 = '!(benchmarks|host|perf|studio|testbed|trace|wifimonitor)';
                //
                return gulp.src([
                    path.join(options.sdkPath, prefix_0),
                    path.join(options.sdkPath, prefix_0, '**'),
                    path.join(options.sdkPath, '+(tools)', prefix_1),
                    path.join(options.sdkPath, '+(tools)', prefix_1, '**'),
                    // path.join(options.sdkPath, '+(build)', '!(compiler)'),
                    // path.join(options.sdkPath, '+(build)', '!(compiler)', '**'),
                    path.join(options.sdkPath, '+(kernel)', '*'),
                    path.join(options.sdkPath, '+(kernel)', '*', '!(test)'),
                    path.join(options.sdkPath, '+(kernel)', '*', '!(test)', '**')
                ], {dot: true})
                .pipe(gulp.dest(path.join(options.location, 'aos')));
            });
            //
            gulp.task('default', ['sdk'], () => {
                //
                gulp.src(path.join(options.templateId, '**'), {dot: true})
                .pipe(gulp.dest(path.join(options.location, name)))
                .on('end', err => {
                    if (err) {return reject(err);}
                    resolve();
                })
                .resume();
            })
            gulp.start();
        });
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(options.location));
        vscode.commands.executeCommand("workbench.view.explorer");
        return {error: 0};
    }
};
