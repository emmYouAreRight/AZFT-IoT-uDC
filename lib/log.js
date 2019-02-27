// const vscode = require('vscode');

class Log {
    constructor(options) {
        this.logLevel = options.logLevel;
        this.outputChannel = Log.outputChannelList.filter(channel => channel.name === options.outputChannel)[0];
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel(options.outputChannel);
            Log.outputChannelList.push(this.outputChannel);
        }
        this.module = options.module || 'AliOS Studio';
    }

    appendLine(text) {
        if (typeof text !== 'string') text = text.toString();
        text = text.trim().replace('\b', ' ');
        //if (!text) return;
        this.outputChannel.appendLine(text);
    }

    appendLineX(Level, text) {
        if (Log.LogLevel[Level] < this.logLevel) {
            return;
        }
        if (typeof text !== 'string') text = text.toString();
        text = text.trim().replace('\b', ' ');
        //if (!text) return;
        this.outputChannel.appendLine(`[${Level}-${this.module}] ${text}`);
    }

    append(text) {
        if (typeof text !== 'string') text = text.toString();
        //text = text.trim();
        //if (!text) return;
        this.outputChannel.append(text);
    }

    appendX(Level, text) {
        if (Log.LogLevel[Level] < this.logLevel) {
            return;
        }
        if (typeof text !== 'string') text = text.toString();
        //text = text.trim();
        //if (!text) return;
        this.outputChannel.append(`[${Level}-${this.module}] ${text}`);
    }
    
    hide() {
        return this.outputChannel.hide();
    }

    static disposeAll() {
        Log.outputChannelList.forEach(channel => channel.dispose());
        Log.outputChannelList = [];
        return;
    }

    dispose() {
        Log.outputChannelList = Log.outputChannelList.filter(channel => channel != this.outputChannel);
        return this.outputChannel.dispose();
    }

    show(...args) {
        return this.outputChannel.show(...args);
    }

    clear() {
        return this.outputChannel.clear();
    }

    get name() {
        return this.outputChannel.name;
    }
}
Log.outputChannelList = [];
Log.LogLevel = {
    'ERROR': 4,
    'WARN': 3,
    'INFO': 2,
    'DEBUG': 1
}

module.exports = Log;


