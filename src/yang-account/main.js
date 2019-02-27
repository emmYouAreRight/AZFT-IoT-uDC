'use strict';
const path = require('path');
const vscode = require('vscode');
const nunjucks = require('gulp-nunjucks');
const OptionsProvider = require('../../lib/options-provider');

var account;

module.exports = class Account {
    constructor() {
        this._config = OptionsProvider.getInstance();
    }

    static getInstance() {
        if (!account) {
            account = new Account();
        }
        return account;
    }

    get config() {
        return this._config;
    }

    init() {
        //vscode.commands.executeCommand("vscode.previewHtml", "aliosstudio://project/create", vscode.ViewColumn.One, 'Create Project');
        console.log('account init');
        //vscode.window.showInformationMessage(JSON.stringify(vscode.workspace.getConfiguration('aliosStudio').get('sdkPaths')));
        //this.pickUsername('');
        let u = this.config.username;
        let ak = this.config.ak;
        if (!u || !ak) {
            this.associateAccount();
        } else {
            vscode.window.showInformationMessage('Account has already been set: ' + u);
            console.log('u:', u);
            console.log('ak:', ak);
        }
    }

    setAccessKey(ak) {
        console.log(ak);
        this.config.setAccessKey(ak);
    }

    setUsername(u) {
        console.log(u);
        this.config.setUsername(u);
    }

    async associateAccount() {
        let u = await vscode.window.showInputBox({
            prompt: 'Enter your username of Aliyun account'
        });
        if (u) {
            this.setUsername(u);
            let ak = await vscode.window.showInputBox({
                prompt: 'Enter your Access Key'
            });
            if (ak) {
                this.setAccessKey(ak);
                vscode.window.showInformationMessage('Account has been successfully associated: ' + u);
            } else {
                console.log('no ak! ', ak);
            }
        } else {
           console.log('no username! ', u);
        }
    }
};
