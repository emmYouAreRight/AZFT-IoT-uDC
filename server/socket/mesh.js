'use strict';
const vscode = require('vscode');
const uDeviceCenter = require("../../src/yang-udevice-center/application/udevice-center").getInstance();

module.exports = function(socket, io) {
    socket.on('mesh-status', () => {
        uDeviceCenter.update();
    });
    socket.on('open-link', link => {
        vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(link));
    });
    socket.on('heartbeat', () => {
        //TODO
        uDeviceCenter.updateHeartbeat();
    });
    socket.on('subscribe', (status, chip) => {
        if (status) {
            uDeviceCenter.bindLog(chip);
        } else {
            uDeviceCenter.unbindLog(chip);
        }
    });
    socket.on('shell', (chip, label) => {
        uDeviceCenter.openShell(chip, label);
    });
    socket.on('program', (chip, name, pg, address = '0x13200') => {
        uDeviceCenter.program(chip, address, name, pg);
    });
    socket.on('reset-device', chip => {
        uDeviceCenter.resetDevice(chip);
    });
    socket.on('start-debug', chip => {
        uDeviceCenter.startDebug(chip);
    });
    socket.on('stop-debug', chip => {
        uDeviceCenter.stopDebug(chip);
    });
};
