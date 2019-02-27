const Vue = require('vue/dist/vue.common');
const io = require('socket.io-client');
let outs = "";
let checkTimer;
const app = new Vue({
    el: '#shell',
    data: {
        log: [],
        sendInput: '',
        supportCmd: [],
        socket: null,
        active: true,
        device: "No Device",
        type: "local",
        autoscroll: true,
        tooManyLog: false,
        showLogWarning: true,
        formattedLog: [],
        commandHistory: [],
        commandCursor: null,
        savedInput: ''
    },
    mounted: function() {
        $(".shell-dimmer").dimmer({
            closable: false
        });
    },
    destroyed: function() {
        clearInterval(checkTimer);
        this.socket && this.socket.close && this.socket.close();
    },
    created: function() {
        let device = window.location.search.slice(1).split('&').filter(res => res.split('=')[0] === 'device')[0].split('=')[1];
        let ip = window.location.search.slice(1).split('&').filter(res => res.split('=')[0] === 'ip')[0].split('=')[1];
        let port = window.location.search.slice(1).split('&').filter(res => res.split('=')[0] === 'port')[0].split('=')[1];
        this.socket && this.socket.close && this.socket.close();
        this.socket = io(`/shell?ip=${ip}&port=${port}`);
        let last = new Date();
        this.socket.on("shell-output", (output, device) => {
            if (device !== this.device) return;
            if (new Date() - last < 100) {
                outs += output;
                checkTimer && clearTimeout(checkTimer);
                checkTimer = setTimeout(() => {
                    this.updateLog();
                }, 100);
                return;
            } else {
                last = new Date();
                outs += output;
            }
            this.updateLog();
            
        });
        if (device === "local") {
            this.type = "local";
            this.socket.on("device:close", () => {
                this.active = false;
                this.device = "No Device";
            });
            this.socket.on("device:connect", device => {
                this.active = true;
                this.device = device;
            });
            this.socket.on('device', devices => {
                this.active = devices.length > 0;
                this.device = devices[0];
            });
            this.socket.emit("device");
            this.socket.on('updateCli', () => {
                this.updateSupportCmd();
            })
            this.updateSupportCmd();
        } else {
            this.device = device;
            this.type = "remote";
            setInterval(() => {
                this.socket.emit('heartbeat-shell', device);
            }, 1000);
            this.socket.emit('heartbeat-shell', device);
            let prevLog = window.localStorage.getItem(`log-${this.device}`);
            if (prevLog) {
                outs = prevLog;
                this.updateLog(true);
            }
        }
    },
    watch: {
        active: function(val) {
            if (val) {
                $(".shell-dimmer").dimmer("hide");
            } else {
                $(".shell-dimmer").dimmer("show");
                $(".shell-dimmer").dimmer("set active");
            }
        }
    },
    methods: {
        changeScroll: function() {
            this.autoscroll = !this.autoscroll;
        },
        openLogFolder: function() {
            this.socket.emit("open-folder", this.device);
        },
        updateLog: function(noSave = false) {
            if (!noSave && this.type !== "local") {
                let prevLog = window.localStorage.getItem(`log-${this.device}`);
                window.localStorage.setItem(`log-${this.device}`, ((prevLog ? prevLog : '') + outs).slice(-200000));
            }
            if (this.log.length === 0) {
                this.log = outs.split('\r\n');
                outs = "";
            } else {
                let tempLog = (this.log[this.log.length - 1] + outs).split('\r\n');
                outs = "";
                this.log.pop();
                this.log.push.apply(this.log, tempLog);
            }
            if (this.log.length > 1000) {
                this.log = this.log.slice(this.log.length - 1000);
            }

            let op = false;
            let formattedLog = [];
            for (let i = 0; i < this.log.length; i++) {
                if (this.log[i].includes("<IDE-")) {
                    op = !op;
                } else {
                    if (!op) {
                        formattedLog.push(this.log[i]);
                    }
                }
            }
            this.formattedLog = formattedLog;
            if (this.autoscroll) {
                Vue.nextTick(() => {
                    let logContainer = this.$el.querySelector("#shell .container");
                    logContainer.scrollTop = logContainer.scrollHeight;
                });
            }
        },
        cleanOldOutput: function() {
            if (this.log.length > 1000) {
                this.log = this.log.slice(this.log.length - 1000);
                this.tooManyLog = true;
            }
        },
        hideWarning: function() {
            this.showLogWarning = false;
        },
        updateSupportCmd: function() {
            const _this = this;
            if (!this.active) return;
            $.get(`http://${location.host}/shell/supportcmd`, {}, data => {
                this.supportCmd = Object.entries(data);
                $('.cmdlist').dropdown({
                    values: this.supportCmd.map(val => {
                        return {
                            name: val[0] + ': ' + val[1],
                            value: val[0]
                        }
                    }).sort((a,b) => {
                        if (a.value === 'help') return -1;
                        if (b.value === 'help') return 1;
                        return a.value.localeCompare(b.value);
                    }),
                    direction: "upward",
                    action: "hide",
                    onChange(value) {
                        _this.sendInput = value;
                        $('#shell input').focus();
                    },
                    sortSelect: true,
                    context: $('#shell > .segment')
                });
                //console.log($('cmdlist'));
            }, "json").fail(err => {
                console.log(err);
            });
            return true;
        },
        sendMessage: function() {
            this.commandHistory.push({
                command: this.sendInput
            });
            //console.log(this.sendInput);
            this.socket.emit("shell-input", this.sendInput, this.device);
            this.sendInput = "";
            this.commandCursor = null;
            this.savedInput = "";
        },
        onInput: function(e) {
            if (e.key === 'ArrowUp') {
                if (this.commandCursor === null) {
                    if (this.commandHistory.length > 0) {
                        this.savedInput = this.sendInput;
                        this.commandCursor = this.commandHistory.length - 1;
                        this.sendInput = this.commandHistory[this.commandCursor].command;
                    }
                } else {
                    if (this.commandCursor - 1 >= 0) {
                        this.commandCursor--;
                        this.sendInput = this.commandHistory[this.commandCursor].command;
                    }
                }
            } else if (e.key === 'ArrowDown') {
                if (this.commandCursor !== null) {
                    if (this.commandCursor + 1 < this.commandHistory.length) {
                        this.commandCursor++;
                        this.sendInput = this.commandHistory[this.commandCursor].command;
                    } else {
                        this.commandCursor = null;
                        this.sendInput = this.savedInput;
                    }
                }
            } else return true;
        }
    }
});