const vscode = require('vscode');
const config = require('../../lib/options-provider').getInstance();
const path = require('path');
const fs = require('fs');
module.exports = {
    initializeSDKView: function() {
        if (config.isExternalMode) {
            vscode.window.registerTreeDataProvider("aossdk", {
                getChildren(folder = false) {
                    if (!folder) {
                        return [config.sdkPath];
                    } else return fs.readdirSync(folder).map(basename => path.join(folder, basename));
                },
                getTreeItem(folder) {
                    let isDir = fs.statSync(folder).isDirectory();
                    return {
                        label: path.basename(folder),
                        collapsibleState: isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
                    }
                }
            })
        }
    },

    initializeYosView: function(context) {
        let treeDataProvider = {
            getChildren(folder = false) {
                if (!folder) {
                    return config.buildList.map(buildObj => buildObj.name);
                }
            },
            getTreeItem(folder) {
                let buildObj = config.buildList.filter(buildObj => buildObj.name === folder)[0];
                return {
                    label: buildObj.name,
                    command: {
                        command: 'alios-studio.yosDblClick',
                        arguments: [buildObj.name],
                        tooltip: buildObj.name,
                        title: buildObj.name
                    }
                }
            }
        }
        this._onDidChangeTreeData = new vscode.EventEmitter();
        treeDataProvider.onDidChangeTreeData = this._onDidChangeTreeData.event;

        vscode.window.registerTreeDataProvider("buildTarget", treeDataProvider);
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
            this.updateYosView();
        }));
    },

    updateYosView: function() {
        this._onDidChangeTreeData && this._onDidChangeTreeData.fire();
    }
}