'use strict';
const net = require('net'),
    ip = require('ip'),
    detect = require('detect-port'),
    Device = require('../yang-device/main'),
    DataHelper = require('./data-helper');
//
// let buffer = Buffer.alloc(0);
module.exports = {
    server: null,
    async createServer() {
        if (this.server) {return;}
        let self = this,
            host = ip.address(),
            port = null,
            server = self.server = new net.createServer(socket => {
                socket.on('data', data => {
                    self.socketHandler && self.socketHandler(data);
                });
            });
        //
        try {
            await new Promise((resolve, reject) => {
                detect(20000, (err, port) => {
                    if (err) {return reject(err);}
                    server.listen({
                        host: host,
                        port: port
                    }, () => {
                        console.log('socket server created:', server.address());
                        resolve();
                    });
                });
            });
        } catch(e) {
            return console.error('Fail to start websocket server');
        }
    },

    async destroy() {
        if (!this.server) {return;}
        await new Promise((resolve, reject) => {
            this.server.close(function() {
                resolve();
            });
            this.server = null;
        });
    },

    async getTasks() {
        let device = Device.listConnectedDevice()[0],
            tag = `<${Date.now()}>`,
            pattern = new RegExp(tag, 'g');
        //
        device.write(`${tag}dumpsys task\r\n`);
        let content = await new Promise((resolve, reject) => {
            let output = [];
            function handler(data) {
                output.push(data);
                let content = output.join(''),
                    matcher = content.match(pattern);
                if (matcher && matcher.length > 1) {
                    device.removeListener('cli', handler);
                    return resolve(content.replace(pattern, ''));
                }
            }
            device.on('cli', handler);
        });
        let array = content.split(/[\r\n]{1,2}/).filter(item => item.match(/\d+/)),
            props = 'name,state,prio,stackSize,freeSize,runtime,candidate'.split(',');
        return array.map(item => {
            let line = item.split(/\s+/).filter(cell => cell),
                ret = {};
            props.forEach((prop, index) => ret[prop] = line[index]);
            return ret;
        });
    },

    async disconnect() {
        if (!this.server) {return;}
        let self = this,
            device = Device.listConnectedDevice()[0],
            tag = `<${Date.now()}>`,
            pattern = new RegExp(tag, 'g');
        // disconnect
        await new Promise((resolve, reject) => {
            let output = [];
            function handler(data) {
                output.push(data);
                let content = output.join(''),
                    matcher = content.match(pattern);
                if (matcher && matcher.length > 1) {
                    device.removeListener('cli', handler);
                    // if (buffer.length) {
                    //     let fs = require('fs');
                    //     fs.writeFileSync('/Users/rain/WebServer/workspace/test/log.txt', buffer);
                    // }
                    return resolve();
                }
            }
            device.on('cli', handler);
            device.write(`${tag}trace stop\r\n`);
            // console.log(Date.now(), 'socket disconnect');
        });
    },

    async connect(id, callback) {
        await this.disconnect();
        if (!this.server) {return;}
        let self = this,
            device = Device.listConnectedDevice()[0];
        // connect
        let host = this.server.address();
        self.socketHandler = function(output) {
            let ret = DataHelper.analyse(output);
            // buffer = Buffer.concat([buffer, output]);
            callback && callback(ret.map(buf => {
                if (!buf.length || buf.length < 4) {return;}
                let key = buf.readInt32LE();
                return DataHelper.unique(DataHelper.factory[key] && DataHelper.factory[key](buf));
            }).filter(item => item));


        }
        DataHelper.clean();
        device.write(`trace ${id}\r\n`); // trace task taskId || task event 0x200
        device.write(`trace start ${host.address} ${host.port}\r\n`);
    }
};
