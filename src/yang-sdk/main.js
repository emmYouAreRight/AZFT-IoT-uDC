'use strict';
let yangBuild = null;
const vscode = require('vscode'),
    path = require('path'),
    childProcess = require('child_process'),
    fs = require('fs'),
    fsPlus = require('fs-plus'),
    // yangBuild = require('../yang-build/main'),
    patternVersion = /CONFIG_SYSINFO_KERNEL_VERSION\s*\=\s*([^\r\n\s]+)/;
module.exports = {
    get() {
        // console.log('sdk paths:-----', vscode.workspace.getConfiguration('aliosStudio').get('sdkPaths'));
        return vscode.workspace.getConfiguration('aliosStudio').get('sdkPaths');
    },

    validate(dir, options) {
        options = options || {};
        if (!dir) {
            return {error: 1, msg: 'path is required!'};
        }
        if (!fsPlus.existsSync(dir)) {
            return {error: 1, msg: 'path is not existed!'};
        }
        if (!fsPlus.isDirectorySync(dir)) {
            return {error: 1, msg: 'path is not a directory!'};
        }
        // if (options.toolChain && !fsPlus.existsSync(path.join(dir, `arm-none-eabi-gcc${process.platform === 'win32' ? '.exe' : ''}`))) {
        //     return {error: 1, msg: 'path is not a tool chain directory!'};
        // }
        if (options.version) {
            let filePath = path.join(dir, 'kernel', 'rhino', 'rhino.mk'),
                pkg = fsPlus.existsSync(filePath) && fs.readFileSync(filePath, {encoding: 'utf-8'}),
                matcher = pkg && pkg.match(patternVersion);
            options.version = matcher ? matcher[1] : '';
        }
        return {error: 0, version: options.version || ''};
    },

    hasGcc() {
        !yangBuild && (yangBuild = require('../yang-build/main'));
        return !!yangBuild.findGlobalToolchain();
    },

    async update(paths) {
        await vscode.workspace.getConfiguration('aliosStudio').update('sdkPaths', paths, true);
        return {error: 0};
    }
};
