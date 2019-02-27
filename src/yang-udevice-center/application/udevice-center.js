const uDeviceCenterFactory = require('../domain/udevice-center-factory');
const DebugService = require('../domain/debug-service');
const config = require('../../../lib/options-provider').getInstance();
const fs = require('fs-extra');
const opn = require('opn');
const vscode = require('vscode');
const path = require('path');

let uDeviceCenterApp = null;

class UDeviceCenterApp {
    constructor() {
        this.uDeviceCenter = uDeviceCenterFactory.createUDeviceCenterInstance();
    }

    static getInstance() {
        if (!uDeviceCenterApp) {
            uDeviceCenterApp = new UDeviceCenterApp();
        }
        return uDeviceCenterApp;
    }

    updateHeartbeat() {
        this.uDeviceCenter.updateHeartbeat();
    }

    destroy() {
        this.uDeviceCenter.stop();
        this.uDeviceCenter.destroy();
    }

    async connect() {
        const cert = fs.readFileSync(config.SSLcertFile);
        return await this.uDeviceCenter.ensureConnect(config.accessServer, config.accessPort, cert);
    }

    runCmd(chip, args) {
        this.uDeviceCenter.cmdManager.updateRunCmdQueue(chip, args);
    }

    program(chip, address, filename, file) {
        this.uDeviceCenter.cmdManager.updateProgramQueue(chip, address, filename, file);
    }

    openLogFolder(devname) {
        opn(this.uDeviceCenter.logManager.getLogFolder(devname));
    }

    openShell(chip, label) {
        vscode.commands.executeCommand('alios-studio.shell', chip, config.accessServer, config.accessPort, label);
    }

    preserveLogHeartbeat(device) {
        this.uDeviceCenter.logManager.preserveLogHeartbeat(device);
    }

    update() {
        this.uDeviceCenter.updateInfo();
    }

    bindLog(chip) {
        this.uDeviceCenter.logManager.bindLog(chip);
    }

    unbindLog(chip) {
        this.uDeviceCenter.logManager.unbindLog(chip);
    }

    resetDevice(chip) {
        this.uDeviceCenter.cmdManager.resetDevice(chip);
    }

    get currentDebuggingChip() {
        return this._currentDebuggingChip;
    }

    async startDebug(chip) {
        const fs = require('fs');
        let gdb_program_path = '';
        let elf_path = config.elfPath;
        let gdb_initfile_path = path.join(config.sdkPath, '.gdbinit');
        try {
            const gdbinitContent = fs.readFileSync(gdb_initfile_path).toString();
            gdb_program_path = gdbinitContent.match(/#GDB_PATH="([^"]*)"/)[1];
        } catch(err) {
            console.log(`start debug ${chip} failed, unable to get gdb PATH, error=${err}`);
            return;
        }
        if (fs.existsSync(gdb_program_path) === false) {
            console.log(`start debug ${chip} failed, gdb program ${gdb_program_path} none exist`);
            return;
        }
        if (fs.existsSync(elf_path) === false) {
            console.log(`start debug ${chip} failed, elf file ${elf_path} none exist, try compile first`);
            return;
        }
        if (fs.existsSync(gdb_initfile_path) === false) {
            console.log(`start debug ${chip} failed, .gdbinit file ${elf_path} none exist, try compile first`);
            return;
        }

        let gdb_port = await this.uDeviceCenter.cmdManager.startDebug(chip);

        //modify .gdbinit file
        try {
            const gdbinitContent = fs.readFileSync(gdb_initfile_path).toString();
            let lines = gdbinitContent.split(/\r?\n/);
            let gdb_init_content = ''
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                if (line.includes('shell')) {continue}
                if (line != '') {gdb_init_content = gdb_init_content + line + '\n';}
            }
            //console.log(gdb_init_content);
            fs.writeFileSync(gdb_initfile_path, gdb_init_content);
        } catch(err) {
            console.log(`start debug ${chip} failed, unable to modify .gdbinit file, error=${err}`);
        }

        if (gdb_port > 0) {
            console.log(`start debug ${chip} succeed, port=${gdb_port}`);
            DebugService.startDebug({
                port: gdb_port,
                gdbPath: gdb_program_path,
                binPath: elf_path,
                gdbinitPath: gdb_initfile_path
            });
            const server = require('../../../server/index').getInstance();
            server.getSocketServer('/mesh').emit('start-debug', chip);
            this._currentDebuggingChip = chip;
        } else {
            console.log(`start debug ${chip} failed, port=${port}`);
        }
    }

    async stopDebug(chip) {
        let ret;
        try {
            ret = await this.uDeviceCenter.cmdManager.stopDebug(chip);
        }
        finally {
            const server = require('../../../server/index').getInstance();
            server.getSocketServer('/mesh').emit('stop-debug', chip);
            this._currentDebuggingChip = null;
        }
        if (ret) {
            console.log(`stop debug ${chip} succeed`);
        } else {
            console.log(`stop debug ${chip} failed`);
        }
    }
}

module.exports = UDeviceCenterApp;
