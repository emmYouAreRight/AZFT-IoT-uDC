const childProcess = require('child_process');
const config = require('../../lib/options-provider').getInstance();
const Log = require('../../lib/log');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const vscode = require('vscode');
const ComponentListFactory = require('./component/component-list-factory');

class UCube {
    constructor() {
        this._terminal = null;
        this.execStrategy = 'process';
    }

    static get channel() {
        if (!UCube._channel) {
            UCube._channel = new Log({module: 'Build', logLevel: Log.LogLevel['INFO'], outputChannel: 'ALIOS-STUDIO'});
        }
        return UCube._channel;
    }

    async getVersion() {
        let res =  await this._exec(['--version'], {
            isHideLog: true
        });
        return res;
    }

    async findValidProjectPath() {
        let baseDir = config.newProjectBaseDir, baseName = config.newProjectBaseName, counter = 0;
        let findValid = false;
        let candidateProjectPath;
        while (!findValid) {
            candidateProjectPath = path.join(baseDir, baseName + (counter === 0 ? '' : counter.toString()));
            try {
                fs.accessSync(candidateProjectPath);
                // file / dir already exist.
                counter ++;
                continue;
            } catch(err) {
                findValid = true;
            }
        }
        return candidateProjectPath;
    }

    async createProject(location) {
        let res = await this._exec(['new', location]);
        return res;
    }

    async addRemoteComponent(location, url) {
        let res = await this._exec(['add', url], {
            location, isHideLog: true
        });
        return res;
    }

    async addComponent(location, component) {
        let res = await this._exec(['add', component.name], {
            location, isHideLog: true
        });
        return res;
    }

    async removeComponent(location, component) {
        let res = await this._exec(['rm', component.name], {
            location, isHideLog: true
        });
        return res;
    }

    async listComponents(location) {
        // let res = await this.listComponentsMock();
        let res = await this._exec(['ls', '-c', '-f', 'json'], {
            location, isHideLog: true
        });
        return ComponentListFactory.generateComponentList(res);
    }

    async listComponentsMock() {
        return JSON.stringify({
            "aos/device/bluetooth/mk3239/ble_access": {
                "name": "Lib_ble_Access_Core_Framework",
                "used": true
            },
            "aos/device/lora": {
                "name": "lora"
            },
            "aos/example/helloworld": {
                "name": "helloworld",
                "used": true
            }
        });
    }

    async _exec(args, options = {}) {
        let env = options.env || process.env;
        let location = options.location || vscode.workspace.rootPath;
        let isHideLog = options.isHideLog || false;
        if (this.execStrategy === 'process') {
            return this._execProcess(args, env, location, isHideLog);
        } else {
            return this._execTerminalStrategy(args, env, location, isHideLog);
        }
    }

    async _execProcess(args, env, location, isHideLog) {
        this.ensureCube();
        if (!isHideLog) {
            UCube.channel.show();
            UCube.channel.appendLineX("INFO", `Execute ${config.yosBin} ${args.join(' ')} at ${location}`);
        }
        let outs = '';
        let errouts = '';
        return new Promise((resolve, reject) => {
            let child = childProcess.spawn(config.yosBin, args, {stdio: 'pipe', cwd: location, env, shell: false});
            child.stdout.on('data', data => {
                outs += data.toString();
                UCube.channel.appendX("INFO", data.toString());
            });
            child.stderr.on('data', data => {
                errouts += data.toString();
                UCube.channel.appendX("INFO", data.toString());
            });
            child.on('close', code => {
                if (code !== 0) {
                    console.log(errouts, code);
                    return reject(errouts);
                } else {
                    console.log(outs);
                    return resolve(outs);
                }
            });
        });
    }

    ensureCube() {
        let yosBin = config.yosBin;
        if (path.isAbsolute(yosBin)) {
            try {
                fs.accessSync(yosBin, fs.constants.X_OK);
                return true;
            } catch(err) {
                throw new Error(`Fail to find executable ${yosBin}. Please check your alios-studio.inner.yosBin setting`);
            }
        } else {
            try {
                let ret = childProcess.execSync(process.platform === 'win32' ? `where ${yosBin}` : `which ${yosBin}`);
            } catch(err) {
                throw new Error(`Please visit https://github.com/alibaba/AliOS-Things/wiki/AliOS-Things-uCube to install aos-cube`);
            }
        }
    }

    async _execTerminalStrategy(args, env) {
        console.log('execute aos ' + args.join(' '), env);
        if (!this.terminal) {
            this.terminal = vscode.window.createTerminal({
                env: Object.assign(process.env, env),
                name: "AliOS Things uCube"
            });
        }
        this.terminal.show();
        this.terminal.sendText(`${config.yosBin} ${args.join(' ')}`);
    }
}
module.exports = UCube;