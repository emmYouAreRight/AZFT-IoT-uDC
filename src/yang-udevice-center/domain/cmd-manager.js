const events = require('events');
const path = require('path');
const TBframe = require('../infrastructure/tbframe-converter');
const config = require('../../../lib/options-provider').getInstance();
// const vscode = require('vscode');
const fs = require('fs');
const net = require('net');

class CmdManager {
    constructor() {
        this.filter = {};
        this.events = new events.EventEmitter();
        this.running_cmd = {};
        this.cmd_execute_return = '';
        this.cmd_execute_state = 'idle';
        this.programming = false;
        this.cmdQueue = [];
        this.debugSessions = {};
    }

    initialize(connection) {
        this.connection = connection;
        this.initialCmdHandler();
    }

    destroy() {
        this.cmdChecker && clearInterval(this.cmdChecker);
        try {
            this.connection && this.connection.removeAllListeners();
        } catch(err){}
    }

    updateRunCmdQueue(chip, args) {
        this.cmdQueue.push({
            type: 'runCmd',
            payload: {
                chip, args
            }
        });
    }

    initialCmdHandler() {
        this.cmdChecker = setInterval(() => {
            this.handleCmdQueue();
        }, 200);
    }

    async handleCmdQueue() {
        if (this.cmdQueue.length > 0) {
            const currentTask = this.cmdQueue.pop();
            switch (currentTask.type) {
                case 'program':
                    const server = require('../../../server/index').getInstance();
                    await this.program(currentTask.payload.chip, currentTask.payload.address, currentTask.payload.filename, currentTask.payload.file, server.getSocketServer('/mesh').emit.bind(server.getSocketServer('/mesh'), 'program-progress'));
                    break;
                case 'runCmd':
                    await this.runCmd(currentTask.payload.chip, currentTask.payload.args.split(' '), -1);
                    break;
                default:
                    console.warn('Ignore unknown request', currentTask);
            }
        }
    }

    updateProgramQueue(chip, address = null, filename = null, file = null) {
        if (!address) address = config.flashAddress[0];
        if (!filename) filename = path.basename(config.imagePath[0]);
        if (!file) file = fs.readFileSync(config.imagePath[0]);
        this.cmdQueue.push({
            type: 'program',
            payload: {
                chip, address, filename, file
            }
        });
    }

    filterResponse(device, logstr) {
        if (!this.filter[device]) return;
        if (this.filter[device].lines_exp === 0) {
            if (logstr.includes(this.filter[device].cmdstr)) {
                this.filter[device].lines_num += 1;
            }
            return true;
        } else {
            if (this.filter[device].lines_num === 0) {
                if (logstr.includes(this.filter[device].cmdstr)) {
                    this.filter[device].lines_num += 1;
                    return false;
                }
                return true;
            } else if (this.filter[device].lines_num <= this.filter[device].lines_exp) {
                let op = true;
                let log = logstr.replace(/\r/mg, "").replace(/\n/mg, "");
                if (log !== "") {
                    for (let filterStr of this.filter[device].filters) {
                        if (log.includes(filterStr)) {
                            this.filter[device].response = this.filter[device].response.concat(log);
                            this.filter[device].lines_num += 1;
                            op = false;
                            break;
                        }
                    }
                }
                if (this.filter[device].lines_num > this.filter[device].lines_exp) {
                    this.events.emit(`done-${device}`);
                }
                return op;
            }
            return true;
        }
    }

    localDebugServer(socket) {
        let clientName = `${socket.remoteAddress}:${socket.remotePort}`;
        let remoteDevice;
        let socket_port = socket.address().port;
        for (let dev in this.debugSessions) {
            if (socket_port != this.debugSessions[dev]['port']){
                continue;
            } else {
                this.debugSessions[dev]['socket'] = socket;
                socket.setNoDelay(true);
                remoteDevice = dev;
                break;
            }
        }
        console.log(`${clientName} connected to debug ${remoteDevice}`);

        socket.on('data', (data) => {
            let header = `${remoteDevice}:`;
            const pack = TBframe.build_pack(TBframe.MSG_TYPE.DEVICE_DEBUG_DATA, header, data);
            this.connection.write(pack);
        });

        socket.on('end', () => {
            console.log(`${clientName} disconnected.`);
            const pack = TBframe.build_pack(TBframe.MSG_TYPE.DEVICE_DEBUG_REINIT, remoteDevice);
            this.connection.write(pack);
        });
    }

    debugDataHandler(device, data) {
        if (!(device in this.debugSessions)) {return;}
        if (!('socket' in this.debugSessions[device])) {return;}
        try {
            this.debugSessions[device]['socket'].write(data);
        } catch(err) {
            console.log(err);
            console.log(`forwarding debug data for ${device} failed`);
            return;
        }
    }

    debugCmdHandler(device, type, result) {
        switch(type) {
            case TBframe.MSG_TYPE.DEVICE_DEBUG_START:
                if (result != 'success') {
                    //console.log(`error: start debug device ${device} failed, ret=${result}`);
                    this.cmd_execute_return = result;
                    this.cmd_execute_state = 'error';
                    this.events.emit('cmd');
                } else {
                    if (device in this.debugSessions) {
                        let port = this.debugSessions[device]['port'];
                        //console.log(`start debugging ${device} succeed, serve at port ${port}`);
                        this.cmd_execute_return = port;
                        this.cmd_execute_state = 'done';
                        this.events.emit('cmd');
                    } else {
                        let used_ports = [];
                        for (let dev in this.debugSessions) {
                            used_ports.push(this.debugSessions[dev]['port']);
                        }
                        let port = 4120 + Math.floor(Math.random() * 1024);
                        while (port in used_ports) {
                            port = 4120 + Math.floor(Math.random() * 1024);
                        }
                        let server = net.createServer(this.localDebugServer.bind(this));
                        server.maxConnections = 1;
                        server.listen(port, '127.0.0.1');
                        this.debugSessions[device] = {'port': port, 'server': server};
                        //console.log(`start debugging ${device} succeed, serve at port ${port}`);
                        this.cmd_execute_return = port;
                        this.cmd_execute_state = 'done';
                        this.events.emit('cmd');
                    }
                }
                break;
            case TBframe.MSG_TYPE.DEVICE_DEBUG_REINIT:
                if ( result === 'success' || !(device in this.debugSessions) ){
                    break;
                }
                console.log(`error: restart debugging device ${device} failed, ret=${result}`);
                console.log(`closing debug session for device ${device}`);
                this.debugSessions[device]['server'].close();
                this.debugSessions[device]['server'].unref();
                delete(this.debugSessions[device]);
                break;
            case TBframe.MSG_TYPE.DEVICE_DEBUG_STOP:
                this.cmd_execute_return = result;
                this.cmd_execute_state = (result === 'success') ? 'done' : 'error';
                if (device in this.debugSessions) {
                    console.log(`stop debugging ${device}: ${result}`);
                    this.debugSessions[device]['server'].close();
                    this.debugSessions[device]['server'].unref();
                    delete(this.debugSessions[device]);
                }
                this.events.emit('cmd');
                break;
            default:
                console.log(`error: wrong debug msg type '${type}'`);
                break;
        }
    }

    cmdError(value) {
        this.cmd_execute_return = value;
        this.cmd_execute_state = 'error';
        this.events.emit('cmd');
    }

    cmdDone(value) {
        this.cmd_execute_return = value;
        this.cmd_execute_state = 'done';
        this.events.emit('cmd');
    }

    async resetDevice(device) {
        const pack = TBframe.build_pack(TBframe.MSG_TYPE.DEVICE_RESET, device);
        this.connection.write(pack);
        return true;
    }

    async runCmd(device, args, expectLines = 0, timeout = 10000, filters = ['']) {
        if (args.length === 0) return false;
        let content = `${device}:${args.join('|')}`;
        let pack = TBframe.build_pack(TBframe.MSG_TYPE.DEVICE_CMD, content);
        this.filter[device] = {
            cmdstr: args.join(' '),
            lines_exp: expectLines,
            lines_num: 0,
            filters: filters,
            response: []
        };

        let retry = 3;
        while (retry > 0) {
            this.running_cmd[device] = args.join(' ');
            this.connection.write(pack);
            if (expectLines === -1) return;
            await new Promise((resolve) => {
                let cb = () => {
                    clearTimeout(to);
                    return resolve();
                };
                this.events.once(`done-${device}`, cb);
                let to = setTimeout(() => {
                    clearTimeout(to);
                    this.events.removeListener(`done-${device}`, cb);
                    return resolve();
                }, timeout);
            });
            if (this.filter[device].lines_num > 0) {
                break;
            }
            retry -= 1;
        }
        let response = this.filter[device].response;
        this.filter[device] = {};
        return response;

    }

    async wait_cmd_excute_done(timeout) {
        this.cmd_execute_state = 'wait_response';
        this.cmd_execute_return = "";
        if (this.events.listenerCount('cmd') > 0) {
            throw 'No support execute multiple cmd together.';
        }
        return new Promise((resolve, reject) => {
            let cmd_timeout = setTimeout(() => {
                this.cmd_execute_state = 'timeout';
                this.events.removeAllListeners('cmd');
                resolve();
            }, timeout);
            this.events.once('cmd', () => {
                clearTimeout(cmd_timeout);
                this.events.removeAllListeners('cmd');
                resolve();
            });
        });
    }

    async sendFileToClient(device, filename, fileContent, progress = console.log) {

        let filehash = TBframe.hashOfFile(fileContent);
        let content = `${device}:${filehash}:${path.basename(filename)}`;
        progress('progress', 'Send image hash');
        let frameToSend = TBframe.build_pack(TBframe.MSG_TYPE.FILE_BEGIN, content);
        let retry = 4;
        while (retry > 0) {
            //console.log(`send ${frameToSend}`);
            this.connection.write(frameToSend);
            await this.wait_cmd_excute_done(10000);
            if (this.cmd_execute_return === '') {
                retry -= 1;
                continue;
            }
            break;
        }
        if (retry === 0) {
            return false;
        }
        if (this.cmd_execute_return === 'exist') return true;

        let seq = 0;
        while (fileContent.length >= seq * 8092) {
            progress('progress', 'tansmitting package ' + seq + '/' + Math.round(fileContent.length / 8092));
            progress('transmit', seq / Math.round(fileContent.length / 8092) * 100);
            //console.log('tansmitting package ' + seq + '/' + Math.round(fileContent.length / 8092));
            let header = `${device}:${filehash}:${seq}:`;
            let content = fileContent.slice(seq * 8092, (seq + 1) * 8092);
            frameToSend = TBframe.build_pack(TBframe.MSG_TYPE.FILE_DATA, header, content);
            retry = 4;
            while (retry > 0) {
                //console.log(`send ${frameToSend}`);
                this.connection.write(frameToSend);
                await this.wait_cmd_excute_done(10000);
                if (this.cmd_execute_return === '') {
                    retry -= 1;
                    continue;
                } else if (this.cmd_execute_return !== 'ok') {
                    return false;
                }
                break;
            }

            if (retry === 0) {
                return false;
            }
            seq += 1;
        }
        progress('progress', 'Send image end');
        content = `${device}:${filehash}:${path.basename(filename)}`;
        frameToSend = TBframe.build_pack(TBframe.MSG_TYPE.FILE_END, content);

        retry = 4;
        while (retry > 0) {
            this.connection.write(frameToSend);
            await this.wait_cmd_excute_done(10000);
            if (this.cmd_execute_return === '') {
                retry -= 1;
                continue;
            } else if (this.cmd_execute_return !== 'ok') {
                return false;
            }
            break;
        }
        if (retry === 0) return false;
        progress('progress', 'Send image done');
        return true;
    }

    async program(device, address, filename, file, progress) {
        try {
            if (!await this.doProgram(device, address, filename, file, progress)) {
                progress('err', 'Programming Fail');
            }
        } catch (err) {
            console.log(err);
            progress('err', err);
        }
    }

    async doProgram(device, address, filename, file, progress = console.log) {
        if (!address.startsWith('0x')) {
            progress('err', 'Flash Address should starts with 0x');
            return false;
        }
        this.programming = true;
        if (!await this.sendFileToClient(device, filename, file, progress)) {
            this.programming = false;
            return false;
        }

        const filehash = TBframe.hashOfFile(file);
        const content = `${device},${address},${filehash}`;
        const frameToSend = TBframe.build_pack(TBframe.MSG_TYPE.DEVICE_PROGRAM, content);
        //console.log(`send ${frameToSend}`);
        progress('program', 'Start programming... It may take ~1 min.');
        this.connection.write(frameToSend);
        await this.wait_cmd_excute_done(270000);
        let ret = false;
        if (this.cmd_execute_state === 'done') {
            progress('success', 'programming finish');
            ret = true;
        } else {
            progress('err', 'Programming Fail');
        }
        this.cmd_execute_state = 'idle';
        this.programming = false;
        return ret;
    }

    async startDebug(device) {
        const pack = TBframe.build_pack(TBframe.MSG_TYPE.DEVICE_DEBUG_START, device);
        this.connection.write(pack);
        await this.wait_cmd_excute_done(3000);
        let ret = -1;
        if (this.cmd_execute_state === 'done') {
            ret = this.cmd_execute_return;
        } else {
            ret = -1;
        }
        return ret;
    }

    async stopDebug(device) {
        const pack = TBframe.build_pack(TBframe.MSG_TYPE.DEVICE_DEBUG_STOP, device);
        this.connection.write(pack);
        await this.wait_cmd_excute_done(3000);
        let ret;
        if (this.cmd_execute_state === 'done') {
            ret = true;
        } else {
            ret = false;
        }
        return ret;
    }
}

module.exports = CmdManager;