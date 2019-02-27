const cliTable = require('cli-table');
const vscode = require('vscode');
const childProcess = require('child_process');
const OptionsProvider = require('../../lib/options-provider');
const EventEmitter = require('events');
const burn = require('./burn-image');
const Log = require('../../lib/log');
const utils = require('../../lib/utils');
const stream = require('stream');
const iconv = require('iconv-lite');
const os = require('os');
const path = require('path');
const fs = require('fs');
const statusbar = require('../yang-statusbar/main');
const AOSTasksProvider = require('../yang-task/main').getInstance(vscode.workspace.rootPath);
let connectedDeviceList = [];

module.exports = class SerialManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this._config = OptionsProvider.getInstance(options);
        this.server = require('../../server/index').getInstance();
        this.burning = false;
    }

    get config() {
        return this._config;
    }

    static get channel() {
        if (!SerialManager._channel) {
            SerialManager._channel = new Log({module: 'Device', logLevel: Log.LogLevel['INFO'], outputChannel: 'ALIOS-STUDIO'});
        }
        return SerialManager._channel;
    }

    get channel() {
        if (!this._channel) {
            this._channel = new Log({module: this.config.comPort, logLevel: Log.LogLevel['INFO'], outputChannel: `ALIOS-STUDIO-${this.config.comPort}`});
        }
        return this._channel;
    }

    get cliChannel() {
        if (!this._cliChannel) {
            this._cliChannel = new Log({module: this.config.comPort, logLevel: Log.LogLevel['INFO'], outputChannel: `ALIOS-STUDIO-${this.config.comPort}-SHELL`});
        }
        return this._cliChannel;
    }

    static async _doListDevice() {
        return new Promise((resolve, reject) => {
            SerialPort.list((err, ports) => {
                ports = ports.filter(port => {
                    return process.platform === "win32" ? port.comName.startsWith('COM') : port.comName.startsWith('/dev');
                });
                if (err) {
                    reject(err);
                } else {
                    resolve(ports);
                }
            });
        });
    }

    static listConnectedDevice() {
        return connectedDeviceList;
    }

    static async listDevice() {
        return new Promise((resolve, reject) => {
            utils.execCommand('aos', ['devices']).then((res) => {
                try {
                    //console.log(res);
                    let r = JSON.parse(res.stdout)
                    resolve(r)
                } catch (err) {
                    console.log(err)
                    reject(err)
                }
            }).catch((err) => {
                console.log(err)
                reject(err)
            })
        })
    }
    async close() {
        return new Promise((resolve, reject) => {
            connectedDeviceList = connectedDeviceList.filter(device => device !== this);
            this.StatusBarItem && this.StatusBarItem.dispose();
            this.commandDisposable && this.commandDisposable.dispose();
            this.channel && this.channel.dispose();
            this.emit('device:close');
            this.server.getSocketServer('/shell').emit('device:close');
            statusbar.showConnect();
            this._serialPort && this._serialPort.close(err => {
                this._serialPort = null;
                if (err) {
                    reject(`Fail to close connection ${err.message || err}`);
                } else {
                    resolve(true);
                }
            });
        });
    }

    static async switchDevice() {
        const deviceList = await SerialManager._doListDevice();
        if (deviceList.length < 2) return;
        let nextDevice = await vscode.window.showQuickPick(
            deviceList
            .filter(device => device.comName !== SerialManager.listConnectedDevice()[0].config.comPort)
            .map(device => `${device.comName}`)
        );
        if (nextDevice) {
            await SerialManager.listConnectedDevice()[0].close();
            const device = new SerialManager();
            await device.config.setComPort(nextDevice);
            vscode.commands.executeCommand("alios-studio.connectDevice");
        }
    }

    async burn(imagePath = this.config.imagePath, address = this.config.flashAddress) {
        console.log('image:', imagePath, ', addr:', address);
        if (imagePath.constructor !== Array) imagePath = [imagePath];
        if (address.constructor !== Array) address = [address];
        if (imagePath.length !== address.length) {
            console.log(imagePath, address);
            throw 'Wrong parameters on burn. Check imagePath and flashAddress';
        }
        try {
            console.log('target:', this.config.name, ', board:', this.config.board, ', baudrate:', this.config.baudrate);
            if (this.config.board === 'mk3060') {
                for (let i = 0; i < imagePath.length; i++) {
                    if (i != 0) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                    fs.accessSync(imagePath[i]);
                    SerialManager.channel.appendLineX("INFO", `Burn image ${imagePath[i]} on ${this.config.board}`);
                    SerialManager.channel.show();
                    this.burning = true;
                    await burn(imagePath[i], this._serialPort.readableStream, this._serialPort, SerialManager.channel.appendLineX.bind(SerialManager.channel, "INFO"), address[i]);
                    this.burning = false;
                    this.channel.show();
                }
            } else if (this.config.board === 'esp32devkitc') {
                // ESP download strategy
                await this.close();
                await new Promise(resolve => setTimeout(resolve, 2000));
                const args = [
                    this.config.esptoolPath,
                    '--chip',
                    'esp32',
                    '--port',
                    this.config.comPort,
                    '--baud',
                    '921600',
                    '--before',
                    'default_reset',
                    '--after',
                    'hard_reset',
                    'write_flash',
                    '-z',
                    '--flash_mode',
                    'dio',
                    '--flash_freq',
                    '40m',
                    '--flash_size',
                    '4MB',
                    address[0],
                    imagePath[0]
                ];
                SerialManager.channel.show();
                SerialManager.channel.appendLineX("INFO", `Running... "Python ${args.join(" ")}"`);
                const child = childProcess.spawn('python', args, {stdio: 'pipe'});
                this.burning = true;
                child.on('close', () => {
                    this.burning = false;
                    vscode.commands.executeCommand('alios-studio.connectDevice');
                });
                child.stderr.on('data', data => {
                    SerialManager.channel.show();
                    SerialManager.channel.appendLineX('ERROR', data.toString());
                });
                child.stdout.on('data', data => {
                    SerialManager.channel.show();
                    SerialManager.channel.appendLineX('INFO', data.toString());
                });
            } else {
                // all other boards except esp32devkitc & mk3060
                console.log('upload', imagePath[0]);
                SerialManager.channel.show();
                let uploadArgs = ['upload', this.config.name + '@' + this.config.board];
                SerialManager.channel.appendLineX("INFO", `Run "${this.config.yosBin} ${uploadArgs.join(' ')}" on ${this.config.sdkPath}`);
                let child = childProcess.spawn(this.config.yosBin, uploadArgs, {cwd: this.config.sdkPath, stdio: 'pipe',env: process.env});
                child.stdout.on('data', data => convStream(data).split('\r').forEach(line => {
                    SerialManager.channel.appendLineX("INFO", line);
                }));
                child.stderr.on('data', data => convStream(data).split('\r').forEach(line => {
                    SerialManager.channel.show();
                    SerialManager.channel.appendLine(line);
                }));
            }
        } catch(err) {
            this.burning = false;
            SerialManager.channel.show();
            SerialManager.channel.appendLineX("ERROR",`Fail to burn image ${imagePath} due to ${err.message || err}`)
            throw `Fail to burn image ${imagePath} due to ${err.message || err}`;
        }
    }

    write(buf, noCliWrap = false) {
        if (!this._serialPort) throw `Not write ${buf.toString()} due to no connected device`;
        this._serialPort.write((noCliWrap ? "" : this.config.getCliStringTag(this.config.cliTagString)) + buf);
    }

    async operation() {
        if (!this._serialPort) {
            return;
        }
        let supportOptions = ['Disconnect', 'Burn', 'Shell', 'Change Baudrate', 'Trace'];
        if ((await SerialManager._doListDevice()).length > 1) {
            supportOptions.push('Change Serial Port');
        }
        let res = await vscode.window.showQuickPick(supportOptions);
        if (!res) {
            return;
        }
        switch(res) {
            case 'Change Serial Port':
                SerialManager.switchDevice();
                break;
            case 'Disconnect':
                this.close();
                break;
            case 'Burn':
                let imagePath = await vscode.window.showInputBox({placeHolder: 'Enter image path', prompt: 'Burn image', value: this.config.multiBin ? this.config.imagePath[1] : this.config.imagePath[0]});
                if (imagePath) {
                    let address = await vscode.window.showInputBox({placeHolder: 'Enter address like 0x13200', prompt: 'write address', value: this.config.multiBin ? this.config.flashAddress[1] : this.config.flashAddress[0]});
                    if (address) {
                        this.burn(imagePath, address);
                    } else {
                        throw 'Not Burn image because address not provided';
                    }
                } else {
                    throw 'Not Burn image because image path not provided';
                }
                break;
            case 'Shell':
                vscode.commands.executeCommand('alios-studio.shell');
                break;
            case 'Change Baudrate':
                let baudrate = await vscode.window.showInputBox({
                    prompt: `Enter Baudrate: such as 921600`
                });
                if (baudrate) {
                    //console.log(baudrate)
                    this._serialPort.update({
                        baudRate: baudrate
                    }, err => {
                        if (err) {
                            throw err;
                        } else {
                            this.config.setBaudrate(parseInt(baudrate));
                        }
                    });
                }
                break;
            case 'Trace':
-                vscode.commands.executeCommand('vscode.previewHtml', 'aliosstudio://trace/index', vscode.ViewColumn.Two, 'Trace');
                 break;
            default:
        }
    }

    async detectCli() {
        if (this.burning) return;
        let dt = "";
        const cb = function(data) {
            dt += data;
        };
        this.on('log', cb);
        this.write(this.config.getCliStringTag(this.config.detectTagString) + "help\r\n", true);
        await new Promise(resolve => {setTimeout(() => {resolve()}, 1000)});
        this.removeListener('log', cb);
        this.supportCommand = {};
        try {
            dt = dt.replace(this.config.getDetectRegexpTag(this.config.detectTagString, 'mg'), "$1");
        } catch(err) {
            console.log(err);
        }
        let foundHelpFlag = false;
        dt.split("\r\n").filter(line => line.includes(":")).map(line => {
            const res = line.indexOf(':');
            this.supportCommand[line.slice(0, res)] = line.slice(res+1);
            if (line.slice(0, res).includes('help')) {
                foundHelpFlag = true;
            }
        });
        if (!foundHelpFlag) return;
        this.config.supportCommand = this.supportCommand;
        this.server.getSocketServer('/shell').emit('updateCli', this.config.comPort);
    }

    async configSerialMonitor() {
        const deviceList = await SerialManager.listDevice();
        if (deviceList.length > 0) {
            let res = await vscode.window.showQuickPick(deviceList.map(device => `${device.device}`));
            if (res) {
                await this.config.setComPort(res);
            }
        }
        if (!this.config.comPort) {
            throw 'Not provide comPort.You must specify a comport to connect device';
        }
        let res = await vscode.window.showInputBox({placeHolder: 'Enter baudrate such as 921600', value: OptionsProvider.defaultBaudrate[this.config.board] || "115200", validateInput: function(input) {
            return parseInt(input.trim()) != input.trim() ? 'Please Enter a valid number' : null;
        }});
        if (res) {
            await this.config.setBaudrate(parseInt(res));
        }
        if (!this.config.baudrate) {
            throw 'Not provide baudrate.You must specify a baudrate to connect device';
        }
    }

    async connect() {
        if (this._serialPort) {
            this.channel.show();
            return;
        }
        const deviceList = await SerialManager._doListDevice();
        if (!this.config.comPort || deviceList.filter(device => device.comName === this.config.comPort).length === 0) {
            if (deviceList.length > 0) {
                let res = await vscode.window.showQuickPick(deviceList.map(device => `${device.comName}`));
                if (res) {
                    await this.config.setComPort(res);
                }
            }
        }
        if (!this.config.comPort) {
            throw 'Not provide comPort.You must specify a comport to connect device';
        }
        if (!this.config.baudrate) {
            let res = await vscode.window.showInputBox({placeHolder: 'Enter baudrate such as 921600', value: OptionsProvider.defaultBaudrate[this.config.board] || "", validateInput: function(input) {
                return parseInt(input.trim()) != input.trim() ? 'Please Enter a valid number' : null;
            }});
            if (res) {
                await this.config.setBaudrate(parseInt(res));
            }
        }
        if (!this.config.baudrate) {
            throw 'Not provide baudrate.You must specify a baudrate to connect device';
        }
        this._serialPort = new SerialPort(this.config.comPort, {baudRate: this.config.baudrate});
        this.channel.show();
        return new Promise((resolve, reject) => {
            statusbar.hideConnect();
            this._serialPort.on("open", () => {
                connectedDeviceList.push(this);
                this._serialPort.write("Testing Write\r", async err => {
                    if (err && !(err.message.indexOf("Writing to COM port (GetOverlappedResult): Unknown error code 121") >= 0)) {
                        this.channel.appendLineX("ERROR", `Failed to open the serial port - ${this.config.comPort}`);
                        statusbar.showConnect();
                        await this.config.setComPort(undefined);
                        await this.config.setBaudrate(undefined);
                        reject(err.message || err);
                    } else {
                        this.server.getSocketServer('/shell').emit('device:connect', this.config.comPort);
                        this.channel.appendLineX("INFO", `Opened the serial port - ${this.config.comPort}`);
                        resolve();
                        setTimeout(() => {this.detectCli()}, 1000);
                    }
                });
            });

            this._serialPort.readableStream = new SerialPortReadableStream({
                serialPort: this._serialPort
            });
            let op = false;
            let left = "";
            let recentLog = "";
            this._serialPort.on("data", data => {
                const util = require('util');
                let dataString = data.toString();
                let st = left + dataString;
                recentLog = recentLog + dataString;
                if (recentLog.includes(this.config.deviceResetFlag)) {
                    this.channel.show();
                    setTimeout(() => {this.detectCli()}, 1000);
                }
                if (recentLog.length > 40) {
                    recentLog = recentLog.slice(recentLog.length - 20);
                }
                left = "";
                let outputData = '', cliData = '', dataWithoutTag = '';
                //let startTime = process.hrtime();

                // New style log parser. which is around 2~3 times faster than old one.

                st = st.replace(/\n/g, '');
                let lines = st.split("\r");
                for (let index = 0; index < lines.length - 1; index ++) {
                    let line = lines[index];
                    if (line.startsWith(this.config.getCliStringTag(this.config.cliTagString)) || (op && index === 0)) {
                        let filteredData = line.replace(this.config.getCliRegexpTag(this.config.cliTagString, 'g'), "");
                        cliData += filteredData + "\r\n";
                        dataWithoutTag += filteredData + "\r\n";
                    } else {
                        outputData += line + "\r\n";
                        dataWithoutTag += line + "\r\n";
                        op = false;
                    }
                }
                let lastLine = lines[lines.length -1];
                if (lastLine.startsWith(this.config.getCliStringTag(this.config.cliTagString)) || (op && lines.length === 1)) {
                    let filteredData = lastLine.replace(this.config.getCliRegexpTag(this.config.cliTagString, 'g'), "");
                    cliData += filteredData.replace(this.config.getDetectRegexpTag(this.config.detectTagString, 'g'), "");
                    dataWithoutTag += filteredData;
                    op = true;
                } else if (this.config.getCliStringTag(this.config.cliTagString).startsWith(lastLine)) {
                    left = lastLine;
                } else {
                    outputData += lastLine;
                    dataWithoutTag += lastLine;
                    op = false;
                }

                // Old style log parser.check log character by character.

                // while (st) {
                //     if (st.slice(0,5) === "\u001b[63m") {
                //         op = true;
                //         st = st.slice(5);
                //     } else {
                //         if ("\u001b[63m".startsWith(st)) {
                //             left = st;
                //             break;
                //         }
                //         if (st[0] == "\r") {
                //             if (op) {
                //                 cliData += "\r\n";
                //             } else {
                //                 outputData += "\r\n";
                //             }
                //             op = false;
                //             st = st.slice(1);
                //             if (st[0] === "\n") st = st.slice(1);

                //         } else {
                //             if (op) {
                //                 cliData += st[0];
                //             } else {
                //                 outputData += st[0];
                //             }
                //             st = st.slice(1);
                //         }
                //     }
                // }
                // const util = require('util');
                // console.log(util.inspect(cliData));
                dataWithoutTag = dataWithoutTag.replace(this.config.getCliRegexpTag(this.config.detectTagString, 'g'), "");
                this.channel.append(dataWithoutTag);
                cliData && this.emit('cli', cliData);
                cliData && this.server.getSocketServer('/shell').emit('shell-output', cliData, this.config.comPort);
                outputData && this.emit('log', outputData);
                data && this.emit('output', data);
            });

            this._serialPort.on("error", async err => {
                this.channel.appendLine(err);
                statusbar.showConnect();
                await this.config.setComPort(undefined);
                await this.config.setBaudrate(undefined);
            });

            this._serialPort.on("disconnect", async err => {
                console.log('disconnect', err);
                SerialManager.channel.show();
                SerialManager.channel.appendLineX("WARN", `${this.config.comPort} Disconnected: ${err ? err.toString() : ""}`);
                if (err && err.message && err.message.includes('Error bad file descriptor on polling')) {
                    await this.config.setComPort(undefined);
                    await this.config.setBaudrate(undefined);
                }
                this.close();
            });
        });
    }
}

class SerialPortReadableStream extends stream.Readable {
    constructor(options) {
        super(options);
        this.buf = Buffer.alloc(0);
        options.serialPort.on('data', data => {
            //console.log('incoming message', data.toString('hex'));
            this.push(data);
        });
    }

    cleanBuffer() {
        this.buf = Buffer.alloc(0);
    }

    _read() {
    }
}

function convStream(data) {
    return process.platform === "win32" ?
        iconv.decode(data, 'gbk') :
        iconv.decode(data, 'utf8');
}