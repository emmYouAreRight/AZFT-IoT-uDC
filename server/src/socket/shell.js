'use strict';
const Device = require('../../src/yang-device/main');
const uDeviceCenter = require("../../src/yang-udevice-center/application/udevice-center").getInstance();

module.exports = function(socket, io) {
    socket.on('shell-input', (inputs, device) => {
        let currentDevice = Device.listConnectedDevice()[0];
        if (currentDevice && currentDevice.config.comPort === device) {
            currentDevice.write(Buffer.from(inputs + "\r\n"));
        } else {
            uDeviceCenter.runCmd(device, inputs);
        }
    });
    socket.on('device', () => {
        socket.emit('device', Device.listConnectedDevice().map(device => device.config.comPort));
    });
    socket.on('open-folder', device => {
        uDeviceCenter.openLogFolder(device);
    });
    socket.on('heartbeat-shell', device => {
        uDeviceCenter.preserveLogHeartbeat(device);
    });
};