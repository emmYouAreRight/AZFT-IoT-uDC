const vscode = require('vscode');
const path = require('path');
const os = require('os');
const fs = require('fs');
var optionsProvider;
class OptionsProvider {
    constructor() {
        this._isExternalMode = null;
        this._adhoc_info = {accessKey: '', type: 'fixed', model: 'any'};
    }

    static get config() {
        return vscode.workspace.getConfiguration('aliosStudio');
    }

    static parsePath(directory) {
        return directory ? directory.replace(/\$\{workspaceRoot\}/, vscode.workspace.rootPath) : directory;
    }

    async setUsername(username) {
        return OptionsProvider.config.update('account.username', username, false);
    }

    async setUDeviceCenterAK(ak) {
        return OptionsProvider.config.update('testbed.access.key', ak, true);
    }

    get username() {
        return OptionsProvider.config.get('account.username') || this._username;
    }

    get adhocInfo() {
        return this._adhoc_info;
    }

    async setAdhocInfo(adhoc_key, adhoc_type, adhoc_model) {
        this._adhoc_info.accessKey = adhoc_key;
        this._adhoc_info.type = adhoc_type;
        this._adhoc_info.model = adhoc_model;
    }

    async deleteAdhocInfo() {
        delete this._adhoc_info.accessKey;
        delete this._adhoc_info.type;
        delete this._adhoc_info.model;
    }

    async setAccessKey(ak) {
        return OptionsProvider.config.update('account.ak', ak, false);
    }

    get ak() {
        return OptionsProvider.config.get('account.ak') || this._ak;
    }

    async setProductKey(pk) {
        return OptionsProvider.config.update('iot.productKey', pk, false);
    }

    get productKey() {
        return OptionsProvider.config.get('iot.productKey') || this._productKey;
    }

    async setStudioDeviceName(name) {
        return OptionsProvider.config.update('iot.studio.deviceName', name, false);
    }

    get studioDeviceName() {
        return OptionsProvider.config.get('iot.studio.deviceName') || this._studioDeviceName;
    }

    async setStudioDeviceSecret(secret) {
        return OptionsProvider.config.update('iot.studio.deviceSecret', secret, false);
    }

    get studioDeviceSecret() {
        return OptionsProvider.config.get('iot.studio.deviceSecret') || this._studioDeviceSecret;
    }

    get yosBin() {
        return OptionsProvider.parsePath(OptionsProvider.config.get('inner.yosBin')) || this._yosBin || 'aos';
    }

    async setSdkPath() {
        OptionsProvider.config.update('sdkPath', path.join(os.homedir(), '.aos'), true);
        console.log('updated', this.config.sdkPath);
    }

    get sdkPath() {
        return this.isAosSource ? vscode.workspace.rootPath : OptionsProvider.parsePath(OptionsProvider.config.get('sdkPath')) || this._sdkPath || vscode.workspace.rootPath;
    }

    get runAosCwd() {
        if (!this._runAosCwd) {
            try {
                // We prefer to run aos command in project root for project created by aos new.
                fs.accessSync(path.join(vscode.workspace.rootPath, '.aos'));
                this._runAosCwd = vscode.workspace.rootPath;
            } catch(err) {
                // Backward compatible for old project we run aos in project/aos
                this._runAosCwd = this.sdkPath;
            }
        }
        return this._runAosCwd;
    }

    get isAosSource() {
        return OptionsProvider.config.get('isAosSource') || this._isAosSource || false;
    }

    get board() {
        return OptionsProvider.config.get('hardware.board') || this._board || 'mk3060';
    }

    async setBoard(board) {
        return OptionsProvider.config.update('hardware.board', board, false);
    }

    get name() {
        return OptionsProvider.config.get('name') || this._name || (this.sdkPath === vscode.workspace.rootPath ? 'alinkapp' : path.basename(vscode.workspace.rootPath));
    }

    async setName(name) {
        return OptionsProvider.config.update('name', name, false);
    }

    get targetPath() {
        return OptionsProvider.parsePath(OptionsProvider.config.get('inner.targetPath')) || this._targetPath || (this.appRoot ? path.join(this.appRoot, this.name) : path.join(this.sdkPath, 'example', this.name)) ;
    }

    get appRoot() {
        return OptionsProvider.parsePath(OptionsProvider.config.get('appRoot')) || "";
    }

    get cleanCmd() {
        return OptionsProvider.config.get('inner.cleanCmd') || this._cleanCmd || ['make', 'clean'];
    }

    get newProjectBaseDir() {
        return OptionsProvider.config.get('newProjectBaseDir') || path.join(os.homedir(), 'AliOS-Things-project');
    }

    get newProjectBaseName() {
        return OptionsProvider.config.get('newProjectBaseName') || 'myProject';
    }

    get makeAppRoot() {
        return process.platform === 'win32' ? (this.appRoot ? path.normalize(this.appRoot).replace(/\\/mg, "/") : "") : this.appRoot;
    }

    get buildCmd() {
        return OptionsProvider.config.get('inner.buildCmd') || this._buildCmd || (this.multiBin ? ['make', '-e', this.fullName, `${this.makeAppRoot ? "APPDIR=" + this.makeAppRoot : ""}`, `BINS=${this.multiBinTarget}`] : ['make', '-e', this.fullName, `${this.makeAppRoot ? "APPDIR=" + this.makeAppRoot : ""}`]);
    }

    get uploadCmd() {
        return OptionsProvider.config.get('inner.uploadCmd') || this._uploadCmd || (this.multiBin ? [this.fullName, `BINS=${this.multiBinTarget}`, 'JTAG=jlink', 'download'] : (this.board === 'mk3060' ? [this.fullName, 'JTAG=jlink', 'download'] : [this.fullName]));
    }

    get aosNewProjectTarget() {
        return OptionsProvider.config.get('inner.aosNewProjectTarget');
    }

    get esptoolPath() {
        return path.join(this.sdkPath, './platform/mcu/esp32/esptool_py/esptool/esptool.py');
    }

    get appPath() {
        return OptionsProvider.parsePath(OptionsProvider.config.get('inner.appPath')) || this._appPath;
    }

    get buildList() {
        return OptionsProvider.config.get('buildList') || this._buildList || [];
    }

    setBuildList(list) {
        return OptionsProvider.config.update('buildList', list, false);
    }

    get showImageFootprint() {
        return OptionsProvider.config.get('showImageFootprint');
    }

    get fullName() {
        return OptionsProvider.config.get('inner.fullName') || this._fullName || `${this.name}@${this.board}`;
    }

    get fullOutputName() {
        return this.multiBin ? `${this.fullName}${this.multiBinTarget}`: this.fullName;
    }

    get imageFolder() {
        return this.output ? path.join(this.output, this.fullOutputName, 'binary') : OptionsProvider.parsePath(OptionsProvider.config.get('inner.imageFolder')) || this._imageFolder || path.join(this.sdkPath, 'out', this.fullOutputName, 'binary');
    }

    get ldFolder() {
        return path.join(this.output, this.fullOutputName, 'ld');
    }

    get csvEsp32() {
        return path.join(this.sdkPath, 'platform', 'mcu', 'esp32', 'bsp', 'custom_partitions.csv');
    }

    get imageExtension() {
        let extension = '.bin';
        switch(this.board) {
            case 'mk3060':
                extension = '.ota.bin';
                break;
            case 'esp8266':
                extension = '-0x1000.bin';
                break;
            default:
                break;
        }
        return extension;
    }
    
    get imageKernelExtension() {
        return OptionsProvider.config.get('inner.imageKernelExtension') || this._imageKernelExtension || '.kernel';
    }

    get imageFrameworkExtension() {
        return OptionsProvider.config.get('inner.imageFrameworkExtension') || this._imageFrameworkExtension || '.framework';
    }

    get imageAppExtension() {
        return OptionsProvider.config.get('inner.imageAppExtension') || this._imageKernelExtension || '.app';
    }

    get imagePath() {
        let ret = OptionsProvider.parsePath(OptionsProvider.config.get('inner.imagePath', false)) || this._imagePath;
        if (!ret || ret.length == 0) {
            if (this.multiBin) {
                switch(this.multiBinTarget) {
                    case 'app':
                        ret = [path.join(this.imageFolder, `${this.fullName}${this.imageAppExtension}`)];
                        break;
                    case 'kernel':
                        ret = [path.join(this.imageFolder, `${this.fullName}${this.imageKernelExtension}`)];
                        break;
                    case 'framework':
                        ret = [path.join(this.imageFolder, `${this.fullName}${this.imageFrameworkExtension}`)];
                        break;
                    default:
                        throw 'Not support burn image target ' + this.multiBinTarget;
                }
            } else {
                ret = [path.join(this.imageFolder, `${this.fullName}`)];
            }
            if(fs.existsSync(`${ret}${this.imageExtension}`) == false) {
                ret = [path.join(this.imageFolder, `${this.fullName}.bin`)];
            } else {
                ret = `${ret}${this.imageExtension}`
            }
        }
        return ret;
    }

    get elfPath() {
        let ret = OptionsProvider.parsePath(OptionsProvider.config.get('inner.elfPath', false)) || this._elfPath;
        if (!ret || ret.length == 0) {
            if (this.multiBin) {
                ret = path.join(this.imageFolder, `${this.fullName}.${this.multiBinTarget}.elf`);
            } else {
                ret = path.join(this.imageFolder, `${this.fullName}.elf`);
            }
        }
        return ret;
    }

    get baudrate() {
        return OptionsProvider.config.get('hardware.baudrate') || this._baudrate;
    }

    async setBaudrate(baudrate) {
        return OptionsProvider.config.update('hardware.baudrate', baudrate, false);
    }

    get comPort() {
        return OptionsProvider.config.get('comPort') || this._comPort;
    }

    async setComPort(comPort) {
        return OptionsProvider.config.update('comPort', comPort, false);
    }

    get extension() {
        return this._extension;
    }

    get serverPort() {
        return this._serverPort;
    }

    get wsserverPort() {
        return this._wsserverPort;
    }

    set serverPort(port) {
        this._serverPort = port;
    }

    set wsserverPort(port) {
        this._wsserverPort = port;
    }

    get noImageFootprint() {
        return this._noImageFootprint;
    }

    set noImageFootprint(bool) {
        this._noImageFootprint = bool;
    }

    get deviceResetFlag() {
        return OptionsProvider.config.get("inner.deviceResetFlag") || this._deviceResetFlag || 'aos framework init.';
    }

    get isExternalMode() {
        if (this._isExternalMode === null) {
            try {
                fs.accessSync(path.join(this.sdkPath, 'example'));
                this._isExternalMode = false;
            } catch(err) {
                this._isExternalMode = true;
            }
        }
        return this._isExternalMode;
        // return process.platform === 'win32' ?
        // path.normalize(vscode.workspace.rootPath).toLowerCase() != path.normalize(this.sdkPath).toLowerCase() :
        // path.normalize(vscode.workspace.rootPath) != path.normalize(this.sdkPath)
    }

    get sources() {
        return OptionsProvider.config.get("build.sources") || this.name + ".c";
    }

    get cflags() {
        return OptionsProvider.config.get("build.cflags") || this._cflags || defaultCflags;
    }

    get components() {
        return OptionsProvider.config.get("build.components") || this._components || defaultComponents;
    }

    get includePath() {
        return OptionsProvider.config.get("build.includePath") || this._includePath;
    }

    get toolchain() {
        return OptionsProvider.parsePath(OptionsProvider.config.get("build.toolchain")) || this._toolchain || "";
    }

    set toolchain(toolchain) {
        this._toolchain = toolchain;
    }

    get output() {
        return OptionsProvider.parsePath(OptionsProvider.config.get("build.output")) || path.join(vscode.workspace.rootPath, 'out');
    }

    get makeOutput() {
        return process.platform === 'win32' ? path.normalize(this.output).replace(/\\/mg, "/") : this.output;
    }

    get multiBin() {
        return OptionsProvider.config.get("build.multiBin") || this._multiBin || false;
    }

    get multiBinTarget() {
        return OptionsProvider.config.get("build.multiBinTarget") || (this.isExternalMode ? 'app' : this._multiBinTarget); 
    }

    set multiBinTarget(target) {
        this._multiBinTarget = target;
    }

    get flashAllBin() {
        return OptionsProvider.config.get("flashAllBin") || this._flashAllBin || false;
    }

    get flashAddress() {
        let ret = OptionsProvider.config.get("flashAddress").length > 0 ? OptionsProvider.config.get("flashAddress") : this._flashAddress;
        if (!ret || ret.length == 0) {
            if (this.multiBin) {
                switch (this.multiBinTarget) {
                    case 'kernel':
                        ret = ["0x13200"];
                        break;
                    case 'app':
                        ret = ["0xAD300"];
                        break;
                    case 'framework':
                        ret = ["0x85140"];
                        break;
                    default:
                        throw 'Not support burn image target ' + this.multiBinTarget;
                }
            } else {
                ret = ["0x13200"];
            }
        }
        return ret;
    }

    get selfGenerateMakefile() {
        return this._selfGenerateMakefile;
    }

    set selfGenerateMakefile(bool) {
        this._selfGenerateMakefile = bool;
    }

    get supportCommand() {
        return this._supportCommand;
    }

    set supportCommand(array) {
        this._supportCommand = array;
    }
    async generateDefaultSettings() {
        !OptionsProvider.config.get('hardware.board') && await OptionsProvider.config.update('hardware.board', "mk3060", false);
        !OptionsProvider.config.get('comPort') && await OptionsProvider.config.update('comPort', "", false);
        !OptionsProvider.config.get('hardware.baudrate') && await OptionsProvider.config.update('hardware.baudrate', 921600, false);
        !OptionsProvider.config.get('build.multiBin') && await OptionsProvider.config.update('build.multiBin', false, false);
        !OptionsProvider.config.get('inner.imageExtension') && await OptionsProvider.config.update('inner.imageExtension', '.ota.bin', false),
        !OptionsProvider.config.get('flashAddress') && await OptionsProvider.config.update('flashAddress', ["0x13200"], false);
    }

    static getInstance(options) {
        if (!optionsProvider) {
            optionsProvider = new OptionsProvider;
        }
        for (let prop in options) {
            optionsProvider['_' + prop] = options[prop];
        }
        return optionsProvider;
    }

    get debug() {
        return vscode.workspace.getConfiguration('launch');
    }

    async updateDebug(value) {
        return vscode.workspace.getConfiguration('launch').update('configurations', value, false);
    }

    set testbedServer(server) {
        this._testbedServer = server;
    }

    get testbedServer() {
        return this._testbedServer || OptionsProvider.config.get('testbed.server');
    }

    set testbedPort(port) {
        this._testbedPort = port;
    }

    get testbedPort() {
        return this._testbedPort || OptionsProvider.config.get('testbed.port');
    }

    get accessServer() {
        return OptionsProvider.config.get('testbed.access.server');
    }

    get accessPort() {
        return OptionsProvider.config.get('testbed.access.port');
    }

    get accessKey() {
        let key = OptionsProvider.config.get('testbed.access.key');
        if (!key) {
            key = this._adhoc_info.accessKey;
        }
        return key;
    }

    get logFolder() {
        return OptionsProvider.config.get('logFolder') || path.join(os.tmpdir(), 'alios-studio', 'log');
    }

    get isDebugMode() {
        return typeof OptionsProvider.config.get('isDebugMode') === 'boolean' ? OptionsProvider.config.get('isDebugMode') : false;
    }

    get cliTagString() {
        return OptionsProvider.config.get('cliTagString') || "IDE-CMD";
    }

    get detectTagString() {
        return OptionsProvider.config.get('detectTagString') || "IDE-DETECT";
    }
    
    getCliStringTag(tag) {
        return `\u001b[t${tag}m`;
    }

    getCliRegexpTag(tag, additionalFlag = "") {
        return new RegExp("\\u{001b}\\[t" + tag + "m", "u" + additionalFlag);
    }

    getDetectRegexpTag(tag, additionalFlag = "") {
        return new RegExp("\\u{001b}\\[t" + tag + "m([\\s\\S]*?$)", "u" + additionalFlag);
    }

    get SSLcertFile() {
        const tryPath = OptionsProvider.config.get('testbed.customCert');
        try {
            fs.accessSync(tryPath, fs.CONSTANTS.R_OK);
            return tryPath;
        } catch(err) {
            return path.join(__dirname, 'server_cert.pem');
        }
    }

    get autoSearchGDBPath() {
        return OptionsProvider.config.get("autoSearchGDBPath");
    }
}

const defaultCflags = ['-Wall', '-Werror', '-Wno-unused-variable', '-Wno-unused-parameter', 
'-Wno-implicit-function-declaration', '-Wno-type-limits', '-Wno-sign-compare', '-Wno-pointer-sign', 
'-Wno-uninitialized', '-Wno-return-type', '-Wno-unused-function' ,'-Wno-unused-but-set-variable',
'-Wno-unused-value', '-Wno-strict-aliasing'];

const defaultComponents = [];

OptionsProvider.defaultBaudrate = {
    mk3060: 921600,
    b_l475e: 115200,
    xr871evb: 115200,
    esp32devkitc: 115200
};

module.exports = OptionsProvider;
