const OptionsProvider = require('./lib/options-provider')
const config = OptionsProvider.getInstance()
const uDeviceCenter = require('./src/yang-udevice-center/application/udevice-center').getInstance();


// accessKey
let res = ''
// device model
let model = 'tinylink_platform_1'
let uuid = ''

let interfaces = require('os').networkInterfaces()

async function uDC() {
    for (let intf in interfaces) {
        for (let i in interfaces[intf]) {
            if (interfaces[intf][i].family === 'IPv6') {
                continue
            }
            if (interfaces[intf][i].address === '127.0.0.1') {
                break
            }
            uuid = interfaces[intf][i].mac.replace(/:/g, '') + '0000'
            break
        }
        if (uuid) {
            break
        }
    }
    if (!model) {
        model = 'any'
    }
    await config.setAdhocInfo(uuid, 'adhoc', model)

    try {
        await uDeviceCenter.connect();
        // vscode.commands.executeCommand("vscode.previewHtml", `aliosstudio://mesh/index?ip=${config.accessServer}&port=${config.accessPort}`, vscode.ViewColumn.One, "uDevice Center");
    } catch(err) {
        console.log(err);
        // if (err.includes('invalid access key')) {
        //     (async () => {
        //         let res = (await vscode.window.showInputBox({placeHolder: 'Correct accessKey', prompt: 'Your Access key is invalid'}));
        //         if (!res) {
        //             vscode.window.showWarningMessage("uDevice Center access key is required!");
        //             return;
        //         }
        //         await config.setUDeviceCenterAK(res);
        //         vscode.commands.executeCommand('alios-studio.uDeviceCenter');
        //     })();
        // } else {
        //     vscode.window.showErrorMessage("Fail to open uDeviceCenter:" + err);
        //     config.deleteAdhocInfo();
        // }
    }
}

uDC()
