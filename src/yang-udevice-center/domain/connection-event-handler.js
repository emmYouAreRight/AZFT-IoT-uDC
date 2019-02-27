const assert = require('assert');

const UdeviceCenterConverter = require('../infrastructure/udevice-center-converter');

module.exports = class ConnectionEventHandler {
    constructor(connection, uDCenter) {
        assert(connection, 'No connection');
        this.uDCenter = uDCenter;
        this.events = new UdeviceCenterConverter(connection);
        this.installEventHandler(this.events);
    }

    installEventHandler(connection) {
        connection.on('device-status', this.onDeviceStatus.bind(this));
        connection.on('all-dev', this.onAllDev.bind(this));
        connection.on('device-log', this.onDeviceLog.bind(this));
        connection.on('debug-data', this.onDebugData.bind(this));
        connection.on('debug-cmd', this.onDebugCmd.bind(this));
        connection.on('cmd-done', this.onCmdDone.bind(this));
        connection.on('cmd-error', this.onCmdError.bind(this));
        connection.on('testbed-login', this.onTestbedLogin.bind(this));
        connection.on('access-login', this.onAccessLogin.bind(this));
    }

    onDeviceStatus(device, info) {
        this.uDCenter.deviceRepo.update(device, info);
    }


    onAllDev(deviceMap) {
        this.uDCenter.deviceRepo.updateAll(deviceMap);
    }

    onDeviceLog(device, logtime, log) {
        this.uDCenter.cmdManager.filterResponse(device, log);
        this.uDCenter.logManager.addLog(device, logtime, log);
    }

    onDebugData(device, data) {
        this.uDCenter.cmdManager.debugDataHandler(device, data);
    }

    onDebugCmd(device, cmd, value) {
        this.uDCenter.cmdManager.debugCmdHandler(device, cmd, value);
    }

    onCmdDone(value) {
        this.uDCenter.cmdManager.cmdDone(value);
    }

    onCmdError(value) {
        this.uDCenter.cmdManager.cmdError(value);
    }

    onTestbedLogin(value) {
        this.uDCenter.loginManager.testbedLoginCB(value);
    }

    onAccessLogin(value) {
        this.uDCenter.loginManager.accessLoginCB(value);
    }
}