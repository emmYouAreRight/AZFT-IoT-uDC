// const vscode = require("vscode");
const childProcess = require("child_process");
const OptionsProvider = require("../../lib/options-provider");
// const Log = require("../../lib/log");
const findh = require("./findh");
const ldParser = require("./ld-parser");
const csvParser = require("./csv-parser");
const fs = require("fs-extra");
const iconv = require("iconv-lite");
const os = require("os");
const path = require("path");
let inProgress = false;
class Build {
    constructor(options = {}) {
        this._config = OptionsProvider.getInstance(options);
    }

    get config() {
        return this._config;
    }

    static get channel() {
        if (!Build._channel) {
            Build._channel = new Log({
                module: "Build",
                logLevel: Log.LogLevel["INFO"],
                outputChannel: "ALIOS-STUDIO"
            });
        }
        return Build._channel;
    }

    static parseBuildTarget(cmd) {
        // Parse build app and board from aos command.
        let ret = cmd.match(/(\S*)@(\S*)/);
        if (ret[1] && ret[2]) {
            return [ret[1], ret[2]];
        } else throw "fail";
    }

    async yos(cmd) {
        console.log("uploadCmd:", cmd);
        if (!(await this.checkUnsavedDocument())) return;
        if (inProgress) {
            vscode.window.showInformationMessage(
                "A build task is running. Please wait..."
            );
            return;
        }
        inProgress = true;
        try {
            let [target, board] = Build.parseBuildTarget(cmd);
            await this.config.setName(target);
            await this.config.setBoard(board);
        } catch (err) {}
        try {
            Build.channel.show();
            let env = this.configEnv();
            let buildArgs = ["make", "-e", cmd];
            let buildOutput = "";
            this.config.makeAppRoot &&
                buildArgs.push(`APPDIR=${this.config.makeAppRoot}`);
            Build.channel.appendLineX(
                "INFO",
                `Run "${this.config.yosBin} ${buildArgs.join(" ")}" on ${
                    this.config.runAosCwd
                }`
            );
            Build.channel.appendLineX(
                "INFO",
                "-------------OUTPUT START-------------"
            );
            let child = childProcess.spawn(this.config.yosBin, buildArgs, {
                cwd: this.config.runAosCwd,
                stdio: "pipe",
                env: env
            });
            child.stdout.on("data", data =>
                convStream(data)
                    .split("\r")
                    .forEach(line => {
                        Build.channel.appendLineX("INFO", line);
                        buildOutput += line.toString();
                    })
            );
            child.stderr.on("data", data =>
                convStream(data)
                    .split("\r")
                    .forEach(line => {
                        Build.channel.show();
                        Build.channel.appendLineX("ERROR", line);
                        buildOutput += line.toString();
                    })
            );
            this.startTime = process.hrtime();
            let buildStatus = true;
            this.detectFootprint(child.stdout);
            return new Promise((resolve, reject) => {
                child.on("close", err => {
                    inProgress = false;
                    this.buildFallDown();
                    if (err !== 0 || !buildStatus) {
                        this.buildErrorHandle();
                        return reject();
                    } else {
                        Build.channel.appendLineX("INFO", "Task Complete!");
                        Build.channel.appendLineX(
                            "INFO",
                            "-------------OUTPUT FINISHED-------------"
                        );
                        if (!cmd.includes("clean")) {
                            vscode.commands.executeCommand(
                                "alios-studio.imagefootprint"
                            );
                        }
                    }
                    resolve(buildOutput.includes("Download failed"));
                });
                child.on("error", err => {
                    Build.channel.appendLineX("ERROR", err.message || err);
                    if (err.message.includes("ENOENT")) {
                        Build.channel.appendLineX(
                            "ERROR",
                            `Fail to find cube! AliOS Studio needs ${
                                this.config.yosBin
                            } in $PATH`
                        );
                    }
                    buildStatus = false;
                    reject();
                });
            });
        } catch (err) {
            inProgress = false;
        }
    }

    async clean() {
        if (inProgress) {
            vscode.window.showInformationMessage(
                "A build task is running. Please wait..."
            );
            return;
        }
        inProgress = true;
        try {
            Build.channel.show();
            Build.channel.appendLineX(
                "INFO",
                `Run "${this.config.yosBin} ${this.config.cleanCmd.join(
                    " "
                )}" on ${this.config.runAosCwd}`
            );
            Build.channel.appendLineX(
                "INFO",
                "-------------CLEAN OUTPUT START-------------"
            );
            let env = this.configEnv();
            let child = childProcess.spawn(
                this.config.yosBin,
                this.config.cleanCmd,
                { env: env, cwd: this.config.runAosCwd, stdio: "pipe" }
            );
            child.stdout.on("data", data =>
                convStream(data)
                    .split("\r")
                    .forEach(line => Build.channel.appendLineX("INFO", line))
            );
            child.stderr.on("data", data =>
                convStream(data)
                    .split("\r")
                    .forEach(line => {
                        Build.channel.show();
                        Build.channel.appendLineX("ERROR", line);
                    })
            );
            let buildStatus = true;
            this.startTime = process.hrtime();
            return new Promise((resolve, reject) => {
                child.on("close", err => {
                    inProgress = false;
                    if (err !== 0 || !buildStatus) {
                        this.buildErrorHandle();
                        return reject();
                    } else {
                        Build.channel.appendLineX("INFO", "Clean Complete!");
                        Build.channel.appendLineX(
                            "INFO",
                            "-------------CLEAN OUTPUT FINISHED-------------"
                        );
                    }
                    resolve();
                });
                child.on("error", err => {
                    Build.channel.appendLineX("ERROR", err.message || err);
                    if (err.message.includes("ENOENT")) {
                        Build.channel.appendLineX(
                            "ERROR",
                            `Fail to find cube! AliOS Studio needs ${
                                this.config.yosBin
                            } in $PATH`
                        );
                    }
                    buildStatus = false;
                    reject();
                });
            });
        } catch (err) {
            inProgress = false;
        }
    }

    async checkUnsavedDocument() {
        let unsavedDocument = vscode.workspace.textDocuments.filter(
            textDocument => textDocument.isDirty
        );
        if (unsavedDocument.length > 0) {
            let res = await vscode.window.showWarningMessage(
                "Unsaved file(s) detected: \r\n " +
                    unsavedDocument
                        .map(textDocument => textDocument.fileName)
                        .join("\r\n"),
                { modal: true },
                "Save all before build",
                "Build"
            );
            if (res === "Save all before build") {
                await vscode.workspace.saveAll(false);
            }
            return res;
        } else return true;
    }

    detectFootprint(stream) {
        if (!this.config.showImageFootprint) return;
        this.config.noImageFootprint = false;
        let buffer = Buffer.alloc(0);
        stream.on("data", data => {
            buffer = Buffer.concat([buffer, data]);
        });
        stream.on("close", () => {
            try {
                let output = buffer.toString();
                let memoryMap2 = output
                    .split(os.EOL)
                    .join(" ")
                    .match(/AOS MEMORY MAP(.*?)TOTAL/g);
                let summaryMap = [];
                memoryMap2.forEach(memoryMap => {
                    memoryMap = memoryMap
                        .trim()
                        .split(
                            "|=================================================================|"
                        )
                        .filter(res => res);
                    if (memoryMap.length === 4) {
                        let memoryTable = memoryMap[2].split("| |").map(line =>
                            line
                                .split("|")
                                .map(ret => ret.trim())
                                .filter(ret => ret)
                        );
                        memoryTable = memoryTable
                            .filter(line => line.length === 3)
                            .map(line => [
                                line[0],
                                parseInt(line[1]),
                                parseInt(line[2])
                            ]);
                        summaryMap.push(memoryTable);
                    }
                });
                let prevReport = this.config.extension.workspaceState.get(
                    "imageFootprintReport",
                    []
                );
                prevReport.unshift(summaryMap);
                if (prevReport.length > 2) {
                    prevReport = prevReport.slice(0, 2);
                }
                this.config.extension.workspaceState.update(
                    "imageFootprintReport",
                    prevReport
                );
                const server = require("../../server/index").getInstance();
                server
                    .getSocketServer("/imagefootprint")
                    .emit("imageFootprint", prevReport);
            } catch (err) {
                this.config.noImageFootprint = true;
            }
        });
    }

    async addInclude(filename) {
        let makefileName =
            path.join(this.config.targetPath, this.config.name) + ".mk";
        return fs.appendFile(
            makefileName,
            os.EOL + `\${NAME}_INCLUDES += ${filename}` + os.EOL
        );
    }

    async addCflag(filename) {
        let makefileName =
            path.join(this.config.targetPath, this.config.name) + ".mk";
        return fs.appendFile(
            makefileName,
            os.EOL + `GLOBAL_CFLAGS += ${filename}` + os.EOL
        );
    }

    async addComponent(filename) {
        let makefileName =
            path.join(this.config.targetPath, this.config.name) + ".mk";
        return fs.appendFile(
            makefileName,
            os.EOL + `\${NAME}_COMPONENTS += ${filename}` + os.EOL
        );
    }

    async generateMakefile() {
        let includedPath = await findh.findDirectory(
            path.join(this.config.sdkPath, "utility")
        );
        includedPath = includedPath.concat(
            await findh.findDirectory(path.join(this.config.sdkPath, "include"))
        );

        if (this.config.isExternalMode) {
            includedPath = includedPath.concat(
                await findh.findDirectory(vscode.workspace.rootPath)
            );
        } else {
            includedPath = includedPath.concat(
                await findh.findDirectory(this.config.targetPath)
            );
        }
        includedPath = includedPath.concat(this.config.includePath);
        let components = this.config.components;
        let cflags = this.config.cflags;
        let sources = this.config.sources;
        return this.doGenerateMakefile({
            includedPath: includedPath,
            components: components,
            cflags: cflags,
            sources: sources,
            makefileName:
                path.join(this.config.targetPath, this.config.name) + ".mk",
            name: this.config.name
        });
    }

    doGenerateMakefile(options) {
        try {
            fs.accessSync(options.makefileName);
            this.config.selfGenerateMakefile = false;
            return;
        } catch (err) {}
        const makefileContent = `
NAME := ${options.name}

\${NAME}_SOURCES := ${options.sources}
${
    options.components.length > 0 ? "${NAME}_COMPONENTS += " : ""
} ${options.components.join(" ")}

${options.includedPath
    .map(folder => `\${NAME}_INCLUDES += ${folder}`)
    .join("\r\n")}

${options.cflags.map(cflag => `GLOBAL_CFLAGS += ${cflag}`).join("\r\n")}
        `;

        fs.writeFileSync(options.makefileName, makefileContent);
        this.config.selfGenerateMakefile = options.makefileName;
    }

    static findGlobalToolchain() {
        let toolchainPath;
        try {
            let ret;
            if (process.platform === "win32") {
                ret = childProcess.execSync("where.exe arm-none-eabi-gcc.exe");
            } else {
                ret = childProcess.execSync("which arm-none-eabi-gcc");
            }
            toolchainPath = path.dirname(ret.toString().trim());
            fs.accessSync(
                path.join(
                    toolchainPath,
                    process.platform === "win32"
                        ? "arm-none-eabi-gcc.exe"
                        : "arm-none-eabi-gcc"
                ),
                fs.constants.X_OK
            );
        } catch (err) {
            return "";
        }
        return toolchainPath + path.sep;
    }

    configEnv() {
        let env = process.env;
        // if (!this.config.toolchain) {
        //     this.config.toolchain = Build.findGlobalToolchain();
        // }
        this.config.toolchain &&
            Object.assign(env, {
                TOOLCHAIN_PATH:
                    path.format(path.parse(this.config.toolchain)) + path.sep
            });
        if (this.config.output !== path.join(this.config.sdkPath, "out")) {
            Object.assign(env, { BUILD_DIR: this.config.makeOutput });
        }
        console.log(
            "TOOLCHAIN_PATH = ",
            env.TOOLCHAIN_PATH,
            " BUILD_DIR = ",
            env.BUILD_DIR
        );
        return env;
    }

    async build() {
        if (!(await this.checkUnsavedDocument())) return;
        if (inProgress) {
            vscode.window.showInformationMessage(
                "A build task is running. Please wait..."
            );
            return;
        }
        inProgress = true;
        try {
            Build.channel.show();
            if (this.config.isExternalMode && !this.config.appRoot) {
                fs.removeSync(this.config.targetPath);
                fs.copySync(vscode.workspace.rootPath, this.config.targetPath);
                await this.generateMakefile();
            }
            Build.channel.appendLineX(
                "INFO",
                `Run "${this.config.yosBin} ${this.config.buildCmd.join(
                    " "
                )}" on ${this.config.runAosCwd}`
            );
            Build.channel.appendLineX("INFO", "Building...");
            Build.channel.appendLineX(
                "INFO",
                "-------------COMPILE OUTPUT START-------------"
            );
            this.startTime = process.hrtime();
            let env = this.configEnv();
            let child = childProcess.spawn(
                this.config.yosBin,
                this.config.buildCmd,
                { cwd: this.config.runAosCwd, stdio: "pipe", env: env }
            );
            child.stdout.on("data", data =>
                convStream(data)
                    .split("\r")
                    .forEach(line => Build.channel.appendLineX("INFO", line))
            );
            child.stderr.on("data", data =>
                convStream(data)
                    .split("\r")
                    .forEach(line => {
                        Build.channel.show();
                        Build.channel.appendLineX("ERROR", line);
                    })
            );
            let buildStatus = true;
            this.detectFootprint(child.stdout);
            return new Promise((resolve, reject) => {
                child.on("close", err => {
                    inProgress = false;
                    this.buildFallDown();
                    if (err !== 0 || !buildStatus) {
                        this.buildErrorHandle();
                        return reject();
                    } else {
                        Build.channel.appendLineX("INFO", "Build Complete!");
                        Build.channel.appendLineX(
                            "INFO",
                            "-------------COMPILE OUTPUT FINISHED-------------"
                        );
                        Build.channel.appendLineX(
                            "INFO",
                            "Compile time: " +
                                timeDelta(process.hrtime(), this.startTime)
                        );
                        vscode.commands.executeCommand(
                            "alios-studio.imagefootprint"
                        );
                    }
                    if (this.config.selfGenerateMakefile) {
                        fs.removeSync(this.config.selfGenerateMakefile);
                    }
                    resolve();
                });
                child.on("error", err => {
                    Build.channel.appendLineX("ERROR", err.message || err);
                    if (err.message.includes("ENOENT")) {
                        Build.channel.appendLineX(
                            "ERROR",
                            `Fail to find cube! AliOS Studio needs ${
                                this.config.yosBin
                            } in $PATH`
                        );
                    }
                    buildStatus = false;
                    reject();
                });
            });
        } catch (err) {
            inProgress = false;
        }
    }

    getFlashAddressForMK3060() {
        try {
            const targetFolder = this.config.ldFolder;
            const fdFileList = fs.readdirSync(targetFolder);
            let foundFlag = false;
            let flashAddress = null;
            fdFileList.forEach(filename => {
                const targetFile = path.join(targetFolder, filename);
                const fileContent = fs.readFileSync(targetFile).toString();
                const provideKV = ldParser(fileContent);
                if (this.config.multiBin) {
                    if (
                        provideKV[`${this.config.multiBinTarget}_download_addr`]
                    ) {
                        foundFlag = true;
                        flashAddress = [
                            provideKV[
                                `${this.config.multiBinTarget}_download_addr`
                            ]
                        ];
                    }
                } else {
                    if (provideKV[`kernel_download_addr`]) {
                        foundFlag = true;
                        flashAddress = [provideKV[`kernel_download_addr`]];
                    }
                }
            });
            if (!foundFlag) {
                flashAddress = null;
                console.log(
                    "Fail to find flash address in ld. Use default address instead."
                );
            }
            return flashAddress;
        } catch (err) {
            console.log(err);
        }
    }

    getFlashAddressForEsp32() {
        try {
            const targetFile = this.config.csvEsp32;
            const fileContent = fs.readFileSync(targetFile).toString();
            const flashAddress = csvParser(fileContent);
            return [
                flashAddress.filter(
                    line =>
                        line[0] === "factory" &&
                        line[1] === "app" &&
                        line[2] === "factory"
                )[0][3]
            ];
        } catch (err) {
            console.log(err);
        }
    }

    getFlashAddress() {
        switch (this.config.board) {
            case "b_475e":
            case "developerkit":
            case "eml3047":
            case "starterkit":
            case "stm32l073rz-nucleo":
            case "stm32l432kc-nucleo":
            case "stm32l432kc-nucleo":
            case "stm32l433rc-nucleo":
            case "stm32l476rg-nucleo":
            case "stm32l496g-discovery":
                return ["0x8000000"];
            case "esp8266":
                return ["0x1000"];
            case "esp32devkitc":
                return this.getFlashAddressForEsp32();
            default:
                return this.getFlashAddressForMK3060();
        }
    }

    async buildFallDown() {
        try {
            let debugConf = this.config.debug;
            let gdbPath = "";
            try {
                const gdbinitContent = fs
                    .readFileSync(path.join(this.config.sdkPath, ".gdbinit"))
                    .toString();
                gdbPath = gdbinitContent.match(/#GDB_PATH="([^"]*)"/)[1];
            } catch (err) {
                console.log(err);
            }
            debugConf.configurations.forEach(debugObj => {
                if (gdbPath && this.config.autoSearchGDBPath) {
                    switch (process.platform) {
                        case "win32":
                            debugObj.windows.miDebuggerPath = gdbPath;
                            break;
                        case "darwin":
                            debugObj.osx.miDebuggerPath = gdbPath;
                            break;
                        case "linux":
                            debugObj.linux.miDebuggerPath = gdbPath;
                            break;
                        default:
                            console.log("Fail to parse gdb path from .gdbinit");
                    }
                }
                if (this.config.multiBin) {
                    debugObj.program = debugObj.program.replace(
                        /(last|app|kernel|framework)_built.elf/,
                        `${this.config.multiBinTarget}_built.elf`
                    );
                    debugObj.setupCommands.forEach(cmd => {
                        cmd.text = cmd.text.replace(
                            /(last|app|kernel|framework)_built.elf/,
                            `${this.config.multiBinTarget}_built.elf`
                        );
                    });
                } else {
                    debugObj.program = debugObj.program.replace(
                        /(last|app|kernel|framework)_built.elf/,
                        "last_built.elf"
                    );
                    debugObj.setupCommands.forEach(cmd => {
                        cmd.text = cmd.text.replace(
                            /(last|app|kernel|framework)_built.elf/,
                            "last_built.elf"
                        );
                    });
                }
            });
            this.config.updateDebug(debugConf.configurations);
            this.config._flashAddress = this.getFlashAddress();
        } catch (err) {
            console.log(err);
        }
    }

    async buildErrorHandle() {
        Build.channel.appendLineX(
            "ERROR",
            "-------------COMPILE OUTPUT FINISHED-------------"
        );
        Build.channel.appendLineX("ERROR", "Build Fail!");
        Build.channel.appendLineX(
            "INFO",
            "Compile time: " + timeDelta(process.hrtime(), this.startTime)
        );
        Build.channel.show();
    }
}

function timeDelta(time1, time2) {
    if (!time1 || !time2 || !time1.length === 2 || !time1.length === 2) return;
    return `${(time1[0] - time2[0] + (time1[1] - time2[1]) / 1e9).toFixed(2)}s`;
}

function convStream(data) {
    return process.platform === "win32"
        ? iconv.decode(data, "gbk")
        : iconv.decode(data, "utf8");
}

module.exports = Build;
