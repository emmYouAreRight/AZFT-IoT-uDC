const semver = require('semver');
const vscode = require('vscode');
const UCubeService = require('./ucube');
const Component = require('./component/component');

let uCubeService = new UCubeService();

class UCube {
    constructor() {

    }

    static async findValidProjectPath() {
        return uCubeService.findValidProjectPath();
    }

    static async createProject(location) {
        try {
            let version = await uCubeService.getVersion();
            if (semver.gte(version, '0.2.15')) {
                vscode.window.showInformationMessage("Creating project... Please wait a moment.");
                await uCubeService.createProject(location);
                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(location));
                vscode.commands.executeCommand("workbench.view.explorer");
            } else {
                vscode.window.showErrorMessage('Your ucube version is outdated. Please execute "[sudo] pip install -U aos-cube to upgrade"');
            }
        } catch(err) {
            vscode.window.showErrorMessage('Create Project Fail.' + (err.message || err));
        }
    }

    static async addRemoteComponent(location, url) {
        return await uCubeService.addRemoteComponent(location, url);
    }

    static async listComponents(location) {
        return await uCubeService.listComponents(location);
    }

    static async addComponent(location, component) {
        return await uCubeService.addComponent(location, new Component(component));
    }
    
    static async removeComponent(location, component) {
        return await uCubeService.removeComponent(location, new Component(component));
    }
}

module.exports = UCube;