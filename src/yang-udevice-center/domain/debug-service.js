const vscode = require('vscode');
module.exports = class DebugService {
    static startDebug({port, binPath, gdbPath, gdbinitPath}) {
        let workspaceRoot = vscode.workspace.rootPath;
        return vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0], {
            "name": "AOS DEBUG",
            "type": "cppdbg",
            "request": "launch",
            "program": binPath,
            "args": [],
            "stopAtEntry": true,
            "cwd": workspaceRoot,
            "environment": [],
            "externalConsole": true,
            "miDebuggerServerAddress": `localhost:${port}`,
            "serverLaunchTimeout": 2000,
            "targetArchitecture": "ARM",
            "setupCommands": [
                {
                    "text": `cd ${workspaceRoot}`
                },
                {
                    "text": `source ${gdbinitPath}`
                },
                {
                    "text": `target remote localhost:${port}`
                },
                {
                    "text": `file ${binPath}`
                }
            ],
            "customLaunchSetupCommands": [],
            "launchCompleteCommand": "exec-run",
            "osx": {
                "MIMode": "gdb",
                "miDebuggerPath": gdbPath
            },
            "linux": {
                "MIMode": "gdb",
                "miDebuggerPath": gdbPath
            },
            "windows": {
                "MIMode": "gdb",
                "miDebuggerPath": gdbPath
            },
            "logging": {
                "trace": true,
                "engineLogging": true,
                "traceResponse": true
            }
        });
    }
}