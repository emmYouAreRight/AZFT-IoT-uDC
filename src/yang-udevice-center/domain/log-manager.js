const config = require('../../../lib/options-provider').getInstance();
const path = require('path');
const fs = require('fs-extra');
const Log = require('../../../lib/log');

class LogManager {
    constructor(udCenter) {
        this.udCenter = udCenter;
        this.channel = {};
        this.enablePreserveLog = {};
        this.server = require('../../../server/index').getInstance();
    }

    addLog(device, logtime, log) {
        this.preserveLog(device, logtime, log);
        //this.udCenter.send('log', device, log);
        if (log.trim().length === 0) return;
        if (log === '\u001b[63m\r\n') {
            return;
        }
        if (this.channel[device]) {
            this.channel[device].appendLine(log);
        }
        log = log.replace(/\[63m/mg, '').replace(/\[65m/mg, '').replace(/\u001b/mg, '');
        this.server.getSocketServer('/shell').emit('shell-output', log, device);
    }

    preserveLogHeartbeat(device) {
        this.enablePreserveLog[device] = new Date();
    }

    preserveLog(device, logtime, log) {
        if (!this.enablePreserveLog[device] || (new Date() - this.enablePreserveLog[device] > 2000)) return;
        const logFolder = this.getLogFolder(device);
        fs.ensureDir(logFolder);
        const logDates = new Date(parseInt(logtime * 1000, 10));
        fs.appendFileSync(path.join(logFolder, 'log'), '[' + logDates.toLocaleString() + '.' + logDates.getMilliseconds().toString().padStart(3, '0') + ']' + log.replace(/\[63m/mg, '').replace(/\[65m/mg, '').replace(/\u001b/mg, ''));
    }

    getLogFolder(device) {
        const folderName = device.match(/\/dev\/(.*)/)[1] || device;
        if (folderName.includes('..')) {
            console.error('possible path hijack detected! do nothing here', folderName);
            return false;
        }
        return path.join(config.logFolder, folderName);
    }

    bindLog(chip) {
        if (!this.channel[chip]) {
            this.unbindLog(chip);
        }
        this.channel[chip] = new Log({module: `Testbed-${chip}`, logLevel: Log.LogLevel['INFO'], outputChannel: `Testbed-${chip}`});
        this.channel[chip].show();
    }

    unbindLog(chip) {
        if (!this.channel[chip]) return;
        this.channel[chip].dispose();
        this.channel[chip] = null;
    }
}

module.exports = LogManager;
