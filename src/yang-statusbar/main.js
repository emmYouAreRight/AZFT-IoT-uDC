// const vscode = require('vscode');

module.exports = {
    initStatusBar(context) {
        const items = [
            ['$(check)', 'AliOS Studio: Build', 'alios-studio.build'],
            ['$(zap)', 'AliOS Studio: Upload', 'alios-studio.upload'],
            ['$(plug)', 'AliOS Studio: Connect Device', 'alios-studio.connectDevice'],
            ['$(diff-added)', 'AliOS Studio: Create Project', 'alios-studio.createProject'],
            ['$(trashcan)', 'AliOS Studio: Clean', 'alios-studio.clean']
            //['$(package)', 'AliOS Studio: Components', 'alios-studio.componentManager']
        ];
        items.reverse().forEach((item, index) => {
            this.addStatusBar(context, item, index + 100);
        });
    },

    hideConnect() {
        this.connectButton && this.connectButton.hide();
    },

    showConnect() {
        this.connectButton && this.connectButton.show();
    },
    
    addStatusBar(context, statusItem, index) {
        const [text, tooltip, command] = statusItem;
        const sbItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, index);
        sbItem.text = text;
        sbItem.tooltip = tooltip;
        sbItem.command = command;
        if (tooltip === 'AliOS Studio: Device Connection') {
            sbItem.color = 'yellow';
        }
        sbItem.show();
        if (command === 'alios-studio.connectDevice') {
            this.connectButton = sbItem;
        }
        context.subscriptions.push(sbItem);
        return sbItem;
    }
    
}
