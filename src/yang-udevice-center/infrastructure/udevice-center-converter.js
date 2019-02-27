const TBframe = require('./tbframe-converter');
const events = require('events');

class UDeviceCenterConverter extends events.EventEmitter {
    constructor(connection) {
        super();
        this.msg = "";
        this.bindHandlerToSocket(connection);
    }

    bindHandlerToSocket(connection) {
        connection.on('data', data => {
            try {
                this.msg += data.toString('ascii');
                let type, value, nmsg;
                while (this.msg) {
                    try {
                        const ret = TBframe.parse(this.msg);
                        type = ret.type;
                        value = ret.value;
                        nmsg = ret.nmsg;
                    } catch(err) {
                        console.log(err);
                    } finally {
                        this.msg = nmsg;
                    }
                }
                try {
                    this.handlePacket(type, value);
                } catch(err) {
                    console.log(err);
                }
            } catch(err) {
                console.log(err);
            }
        });
    }

    handlePacket(type, value) {
        switch(type) {
            case TBframe.MSG_TYPE.DEVICE_STATUS:
                this.deviceStatusHandler(value);
                break;
            case TBframe.MSG_TYPE.ALL_DEV:
                this.allDevHandler(value);
                break;
            case TBframe.MSG_TYPE.DEVICE_LOG:
                this.deviceLogHandler(value);
                break;
            case TBframe.MSG_TYPE.DEVICE_DEBUG_DATA:
                this.debugDataHandler(value);
                break;
            case TBframe.MSG_TYPE.DEVICE_DEBUG_START:
            case TBframe.MSG_TYPE.DEVICE_DEBUG_REINIT:
            case TBframe.MSG_TYPE.DEVICE_DEBUG_STOP:
                this.debugCmdHandler(type, value);
                break;
            case TBframe.MSG_TYPE.CMD_DONE:
                this.cmdDoneHandler(value);
                break;
            case TBframe.MSG_TYPE.CMD_ERROR:
                this.cmdErrorHandler(value);
                break;
            case TBframe.MSG_TYPE.TERMINAL_LOGIN:
                this.terminalLoginHandler(value);
                break;
            case TBframe.MSG_TYPE.ACCESS_LOGIN:
                this.accessLoginHandler(value);
                break;
            case TBframe.MSG_TYPE.TYPE_NONE:
            default:
                this.typeNoneHandler(value);

        }
    }

    deviceStatusHandler(value) {
        let commaIndex = value.indexOf(':');
        let dev = value.slice(0, commaIndex);
        let info = JSON.parse(value.slice(commaIndex + 1));
        this.emit('device-status', dev, info);
    }

    allDevHandler(value) {
        let newDeviceList = {};
        let clients = value.split(':');
        for (let aClient of clients) {
            if (aClient === '') continue;
            let devices = aClient.split(',');
            let uuid = devices[0];
            devices = devices.slice(1);
            for (let aDevice of devices) {
                if (aDevice === '') continue;
                let [dev, using] = aDevice.split('|');
                newDeviceList[`${uuid},${dev}`] = {using};
            }
        }
        this.emit('all-dev', newDeviceList);
    }

    deviceLogHandler(value) {
        let dev = value.split(':')[0];
        if (!dev) return;
        let logtime = value.split(':')[1];
        let log = value.slice(dev.length + logtime.length + 2);
        this.emit('device-log', dev, logtime, log);
    }
    
    debugDataHandler(value) {
        let dev = value.split(':')[0];
        if (!dev) return;
        let data = value.slice(dev.length + 1);
        this.emit('debug-data', dev, data);
    }
    
    debugCmdHandler(type, value) {
        let dev = value.split(':')[0];
        if (!dev) return;
        let result = value.split(':')[1];
        this.emit('debug-cmd', dev, type, result);
    }

    cmdDoneHandler(value) {
        this.emit('cmd-done', value);
    }

    cmdErrorHandler(value) {
        this.emit('cmd-error', value);
    }

    terminalLoginHandler(value) {
        this.emit('testbed-login', value);
    }

    accessLoginHandler(value) {
        let rets = value.split(',');
        this.emit('access-login', rets);
    }

    typeNoneHandler(value) {
        //pass
    }
}

module.exports = UDeviceCenterConverter;