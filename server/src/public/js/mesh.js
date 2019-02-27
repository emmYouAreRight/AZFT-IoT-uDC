const Vue = require('vue/dist/vue.common');
const vis = require('vis');
const io = require('socket.io-client');
const SVG = require('svg.js');
const parameters = require('./modules/parameters');
let network;
const resourceTheme = "simple";
const app = new Vue({
    el: '#mesh',
    data: {
        socket: null,
        nodes: [],
        edges: [],
        lastUpdate: null,
        edgeStatus: [],
        hideIsolatedNode: false,
        delta: {
            edges: [],
            nodes: []
        },
        nodeDataset: new vis.DataSet({}),
        edgeDataset: new vis.DataSet({}),
        subscribe: {},
        selectFile: '',
        uploadChip: '',
        progress: {
            type: "",
            data: ""
        },
        programming: false,
        showMenu: false,
        menuStyle: {
            left: "0px",
            top: "0px"
        },
        showInfo: false,
        infoStyle: {
            left: "0px",
            top: "0px"
        },
        currentNode: {},
        noData: true,
        programAddress: '',
        binName: '',
        readerResult: null,
        ip: '',
        port: '',
        chipStatus: {},
        currentDebuggingChip: null
    },
    methods: {
        external: function() {
            this.socket.emit("open-link", window.location.href);
        },
        resetDevice: function(node = this.currentNode) {
            this.socket.emit("reset-device", node.chip);
        },
        focus: function(node = {}) {
            network.fit({nodes: [node.id || node], animation: {
                duration: 300,
                easingFunction: 'easeInQuint'
            }});
            network.selectNodes([node.id || node]);
        },
        restore: function() {
            network.fit({ animation:{
                duration: 300,
                easingFunction: 'easeOutQuint'
            }});
        },
        toggleIsolatedNode: function() {
            this.hideIsolatedNode = !this.hideIsolatedNode;   
            this.updateNetwork();
        },
        updateNetwork: function() {
            if (network) return;
            try {
                const container = $("#mesh .graph").get(0);
                // this.nodeDataset = new vis.DataSet(this.nodes.map(node => {
                //     const outsImg = renderNode({state: null, device: null, usingNumber: "0", isActive: true, isHighlight:true});
                //     const outsImgNotActive = renderNode({state: null, device: null, usingNumber: "0", isActive: true, isHighlight:false});
                //     return Object.assign(node, {
                //         title: `Loading... ${node.chipShort}`,
                //         image: {
                //             selected: outsImg,
                //             unselected: outsImgNotActive
                //         },
                //         shape: "image"
                //         });
                //     }).filter(node => !this.hideIsolatedNode || node.edges.length > 0 || node.parent));

                // this.edgeDataset = new vis.DataSet(this.edges);
                const data = {
                    nodes: this.nodeDataset,
                    edges: this.edgeDataset
                };
                const paras = parameters.getParameters();
                const configObject = paras ?  {
                    layout: {randomSeed: 1},
                    nodes: { font: {color: paras.color || "white" }, chosen: {
                        label: function(value) {
                            value.size = 2 * value.size;
                            value.mod = "bold";
                            value.color = "red";
                        }
                    }},
                    edges: { font: {color: paras.color || "white" }, arrows: "middle"},
                    interaction: {
                        hover: true,
                        tooltipDelay: 100
                    }
                } : {
                    layout: {randomSeed: 1}
                };
                network = new vis.Network(container, data, configObject);
                network.on('doubleClick', e => {
                    let chip = this.nodes.filter(node => node.id === e.nodes[0])[0];
                    if (!chip) return;
                    this.updateSubscribe(chip);
                });
                // network.on("hoverNode", ({node}) => {
                //     // this.currentNode = this.nodeDataset.get(node);
                //     // const position = network.getPositions([node]);
                //     // this.infoStyle.left = position[node].x + "px";
                //     // this.infoStyle.top = position[node].y + "px";
                //     // this.showInfo = true;
                // });
                // network.on("blurNode", () => {
                //     // this.showInfo = false;
                // });
            } catch(err) {

            }
        },
        doDiff: function(list1, list2, compareFunc, equalFunc, diffFunc = () => {}, sameFunc = () => {}) {
            for (let x1 of list1) {
                let foundFlag = false;
                for (let x2 of list2) {
                    if (compareFunc(x1, x2)) {
                        foundFlag = true;
                        if (!equalFunc(x1, x2)) {
                            //console.log('update', x1);
                            sameFunc.bind(this)(x1);
                        }
                        break;
                    }
                }
                if (!foundFlag) {
                    //console.log('new/remove', x1);
                    diffFunc.bind(this)(x1);
                }
            }
        },
        hideMenu() {
            this.showMenu = false;
        },
        openShell(node = this.currentNode) {
            this.socket.emit('shell', node.chip, node.labelPrev);
        },
        updateSubscribe(node = this.currentNode) {
            this.$set(this.subscribe, node.labelPrev, !this.subscribe[node.labelPrev]);
            this.socket.emit('subscribe', this.subscribe[node.labelPrev], node.chip);
        },
        toggleFileSelect(chip = this.currentNode.chip) {
            if (this.programming) return;
            this.uploadChip = chip;
            $("#mesh .file-selector").click();
        },
        onUploadFile(e, chip = this.currentNode.chip) {
            const flashBin = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                $("#mesh .file-selector").val("");
                this.readerResult = reader.result;
                this.binName = flashBin.name;
                //this.programImage(this.uploadChip, flashBin.name, reader.result);
                this.showEnterAddress();
            }
            reader.readAsArrayBuffer(flashBin);
        },
        programImage(chip = this.currentNode.chip, fileName, fileContent, address = "0x13200") {
            if (this.programming) return;
            this.programming = true;
            $('.program-progress').progress("set percent", 0);
            $('.program-progress').progress("set active");
            setTimeout(() => {
                $('.program-progress').progress("set bar label", "Waiting other tasks...");
            }, 200);
            this.socket.emit('program', chip, fileName, fileContent, address);
        },
        toggleDimmer() {
            if (this.showDimmer) {
                $(".mesh-dimmer").dimmer("show");
                $(".mesh-dimmer").dimmer("set active");
            } else {
                $(".mesh-dimmer").dimmer("hide");
            }
        },
        async showEnterAddress(flag) {
            if (flag) {
                let flashAddress = await $.getJSON('/mesh/flash-address');
                if (flashAddress && flashAddress.address) {
                    this.programAddress = flashAddress.address;
                    this.enterAddress();
                    return;
                }
            }
            try {
                let model = (this.currentNode.info.model ?
                    this.currentNode.info.model.toLowerCase() :
                    this.currentNode.chipShort.match(/\/dev\/(.*)-/)[0]).toLowerCase();
                switch (model) {
                    case 'mk3060':
                        this.programAddress = '0x13200';
                        break;
                    case 'esp32':
                        this.programAddress = '0x10000';
                        break;
                    case 'esp8266':
                        this.programAddress = '0x1000';
                        break;
                    case 'b_l475e':
                    case 'starterkit':
                    case 'developerkit':
                    case 'lora':
                        this.programAddress = '0x8000000';
                        break;
                    default:
                        if (model.startsWith('stm32l')) {
                            this.programAddress = '0x8000000';
                        } else {
                            this.programAddress = '';
                        }
                }
            } catch(err) {
                this.programAddress = '';
            }
            $('.address.modal').modal('show');
            $('.address.modal .input').focus();
        },
        terminateEnterAddress() {
            this.programAddress = '';
            $('.address.modal').modal('hide');
            this.uploadChip = '';
        },
        enterAddress(chip = undefined, imageName = undefined, imageContent = undefined) {
            if (!chip) chip = undefined;
            if (!imageName) imageName = undefined;
            if (!imageContent) imageContent = undefined;
            $('.address.modal').modal('hide');
            this.programImage(chip, imageName, imageContent, this.programAddress);
            this.uploadChip = '';
        },
        startDebug() {
            if (!this.currentNode) return;
            this.socket.emit('start-debug', this.currentNode.chip);
        },
        stopDebug() {
            if (!this.currentNode) return;
            this.socket.emit('stop-debug', this.currentNode.chip);
        },
        async updateCurrentDebuggingChip() {
            let blob = await $.getJSON('/mesh/current-debugging');
            if (blob && blob.chip) {
                this.currentDebuggingChip = blob.chip
            }
        }
    },
    computed: {
        showDimmer: function() {
            return this.noData || this.programming;
        },
        currentChip: function() {
            return this.chipStatus[this.currentNode.chip] || {};
        },
        currentNodeIsDebugging: function() {
            return this.currentNode && this.currentChip && this.currentChip.info && this.currentChip.info.isDebugging;
        }
    },
    watch: {
        showDimmer: function() {
            setTimeout(() => {
                this.restore();
                this.toggleDimmer();
            }, 2000);
        },
        nodes: function(val, oldVal) {
            //console.log(oldVal, '->', val)
            if (val && val.length && val.length > 0) {
                this.noData = false;
            } else {
                this.noData = true;
            }
            
            this.doDiff(val, oldVal, (node, node2) => node.chip == node2.chip, (node, node2) => node.title === node2.title, node => {
                try {
                    this.nodeDataset.add(node);
                    window.localStorage.removeItem(`log-${node.chip}`);
                    this.$set(this.subscribe, node.labelPrev, false);
                } catch(err) {

                }
            }, node => {
                try {
                    //console.log('update', node);
                    this.nodeDataset.update(node);
                } catch(err) {
                    console.log(err);
                }
            });
            this.doDiff(oldVal, val, (node, node2) => node.chip == node2.chip, (node, node2) => node.title === node2.title, node => {
                try {
                    this.nodeDataset.remove(node);
                } catch(err) {

                }
            });
        },
        edges: function(val, oldVal) {
            this.delta.edges = [];
            this.doDiff(val, oldVal, (edge, edge2) => edge.fromLabel == edge2.fromLabel && edge.toLabel == edge2.toLabel, () => true, edge => {
                // this.edgeStatus.push({
                //     type: 'add',
                //     edge: edge
                // });
                try {
                    //console.log('add', edge.fromLabel, ' ', edge.toLabel);
                    const isExist = this.edgeDataset.get({
                        filter: item => item.fromLabel === edge.fromLabel && item.toLabel === edge.toLabel
                    }).length;
                    !isExist && this.edgeDataset.add(edge);
                } catch(err) {
                    console.log(err);
                }
            }, edge => {
                try {
                    //console.log('update', edge);
                    this.edgeDataset.update(edge);
                } catch(err) {
                    console.log(err);
                }
            });
            this.doDiff(oldVal, val, (edge, edge2) => edge.fromLabel == edge2.fromLabel && edge.toLabel == edge2.toLabel, () => true, edge => {
                // this.edgeStatus.push({
                //     type: 'remove',
                //     edge: edge
                // });
                try {
                    //console.log('remove', edge.fromLabel, ' ', edge.toLabel, ' ', edge.id);
                    this.edgeDataset.remove(edge);
                } catch(err) {
                    console.log(err);
                }
            });
        }
    },
    mounted: function() {
        window.localStorage.setItem("cool", "boy");
        const _this = this;
        this.nodes = [];
        this.socket && this.socket.close && this.socket.close();
        this.ip = window.location.search.slice(1).split('&').filter(res => res.split('=')[0] === 'ip')[0].split('=')[1];
        this.port = window.location.search.slice(1).split('&').filter(res => res.split('=')[0] === 'port')[0].split('=')[1];
        console.log(this.ip, this.port);
        this.socket = io(`/mesh?ip=${this.ip}&port=${this.port}`, {transports: ['websocket']});
        this.socket.on('connect', () => {
            this.socket.emit('mesh-status');
            setInterval(() => {
                this.socket.emit('heartbeat');
            }, 1000);
        });
        this.socket.on("status", meshData => {
            //console.log('update status ', meshData);
            this.lastUpdate = new Date();
            meshData.nodes = meshData.nodes.map(node => {
                if (node.info) {
                    let model = (node.info.model ? node.info.model : node.chipShort.match(/\/dev\/(.*)-/)[0]).toUpperCase();
                    const outsImg = renderNode({state: node.info.state, device: model, usingNumber: node.info.using, isActive: node.info.status === 'active', isHighlight:true});
                    const outsImgNotActive = renderNode({state: node.info.state, device: node.info.model, usingNumber: node.info.using, isActive: node.info.status === 'active', isHighlight:false});
                    const title = node.info.using === '-1' ? 
                    `
                    <div class="ui card info-card">
                        <div class="content">
                            <div class="header" style="color: #FF0000"> Board Disconnected </div>
                        </div>
                    </div>
                    `:
                    `
                    <div class="ui card info-card">
                        <div class="content">
                            <div class="header">${node.info.model || node.chipShort}</div>
                            <!--<div class="meta">${node.info.macaddr}</div>-->
                            <div class="ui small">
                                serial: ${node.chipShort || "N/A"}
                            </div>
                            <div class="ui small">
                                state: ${node.info.state || "N/A"} &nbsp; netid: ${node.info.netid || "N/A"} &nbsp; sid: ${node.info.sid || "N/A"}
                            </div>
                            <div class="ui small">
                                router: ${typeof node.info.router === 'string' ? node.info.router.toLowerCase() : "N/A"} &nbsp; channel: ${node.info.channel || "N/A"}
                            </div>
                            <div class="ui small">
                                uuid: ${node.info.uuid || "N/A"}
                            </div>
                            <div class="ui small">
                                macaddr: ${node.info.macaddr || "N/A"}
                            </div>
                            <div class="ui small">
                                extnetid: ${node.info.extnetid || "N/A"}
                            </div>
                        </div>
                    </div>
                    `;
                    return Object.assign(node,{
                        title: title,
                        image: {
                            selected: outsImg,
                            unselected: outsImgNotActive
                        },
                        shape: "image"
                    });
                } else {
                    let model = (node.chipShort.match(/\/dev\/(.*)-/)[0]).toUpperCase();
                    const outsImg = renderNode({state: null, device: model, usingNumber: 0, isActive: true, isHighlight:true});
                    const outsImgNotActive = renderNode({state: null, device: null, usingNumber: 0, isActive: true, isHighlight:false});
                    return Object.assign(node, {
                        image: {
                            selected: outsImg,
                            unselected: outsImgNotActive
                        },
                        shape: "image",
                        title: `Loading... ${node.chipShort}`
                    });
                }
            });
            this.updateNetwork();
            this.nodes = meshData.nodes;
            this.edges = meshData.nodes.reduce((prev, curr) => prev.concat(curr.edges), []);         
        });
        this.socket.on("chip", (dev, info) => {
            this.chipStatus[dev] = info;
        });
        $('.program-progress').progress({percent: 0, text: {
            percent: 'Uploading {percent}%',
        }});
        this.socket.on("program-progress", (type, info) => {
            //console.log(type, info);
            switch (type) {
                case 'success':
                    setTimeout(() => {
                        _this.programming = false;
                    }, 3000);
                    $('.program-progress').progress("set success");
                    setTimeout(() => {
                        $('.program-progress').progress("set bar label", info);
                    }, 300);
                    break;
                case 'err':
                    setTimeout(() => {
                        _this.programming = false;
                    }, 3000);
                    $('.program-progress').progress({
                        text: {
                            error: info
                        }
                    });
                    $('.program-progress').progress("set error");
                    setTimeout(() => {
                        $('.program-progress').progress("set bar label", info);
                    }, 300);
                    break;
                case 'program':
                    $('.program-progress').progress("set percent", 100);
                    setTimeout(() => {
                        $('.program-progress').progress("set bar label", info);
                    }, 300);
                    break;
                case 'transmit':
                    $('.program-progress').progress("set percent", info);
                    break;
            }
        });
        this.socket.on('start-debug', (chip) => {
            this.currentDebuggingChip = chip;
        });
        this.socket.on('stop-debug', (chip) => {
            this.currentDebuggingChip = null;
        });
        $(".mesh-dimmer").dimmer({
            closable: false
        });
        $(".program-dimmer").dimmer({
            closable: false
        });
        $("#mesh .graph").contextmenu(e => {
            let node = network.getNodeAt({x: e.offsetX, y: e.offsetY});
            if (!node) return;
            network.selectNodes([node]);
            this.currentNode = this.nodeDataset.get(node);
            if (this.currentNode && this.currentNode.info && this.currentNode.info.using === "-1") {
                return;
            }
            this.menuStyle.left = e.offsetX + "px";
            this.menuStyle.top = e.offsetY + "px";
            this.showMenu = true;
            e.preventDefault();
        });
        $("#mesh .graph").click(e => {
            if (e.which !== 1) return;
            this.hideMenu();
            e.preventDefault();
        });
        $('.address.modal').modal({
            closable: false
        });
        $('.address.modal').modal('hide');
        this.toggleDimmer();
        this.updateCurrentDebuggingChip();
    }
});
const supportedNodeStates = ['LEADER', 'ROUTER', 'SUPER', 'LEAF'];
const supportedNodeModels = ['MK3060', 'ESP32'];

function renderNode(options) {
    const {state, device, usingNumber, isHighlight, isActive} = options;
    const className = `${state}-${device}-${usingNumber}-${isHighlight}-${isActive}`;
    const querySelector = `.${className}`;
    let stateColor = '';
    switch (state) {
        case 'leader': 
            stateColor = "#fd8082";
            break;
        case 'router':
            stateColor = "#85FFFE";
            break;
        case 'super':
            stateColor = "#FEC1FE";
            break;
        case 'leaf':
            stateColor = "#29FD2F";
            break;
        default:
            stateColor = "#6269FB";
    }
    // DUE TO https://aone.alibaba-inc.com/req/13531094
    !isActive && (stateColor = "#6269FB");
    if (!usingNumber || parseInt(usingNumber, 10) < 0) {
        stateColor = "#c0c0c0";
    }
    if ($(querySelector).get(0)) {
        return "data:image/svg+xml,"+ encodeURIComponent($(querySelector).get(0).outerHTML);
    }
    $('.icon-place').append(`<svg class="${className}"></svg>`)
    var draw = SVG($(querySelector).get(0)).size(100,100);
    draw.circle(100).attr({fill: stateColor});
    draw.text((add) => {
        add.tspan(addPadding(device ? device : "?"));
    }).move(calculatePadding(device ? device : "?"), 60).font({ fill: '#000', family: 'Inconsolata', "font-size": "24px" }).attr('xml:space', "preserve");
    if (isHighlight) {
        draw.circle(96).move(2,2).attr({stroke: 'red', 'stroke-width': 4, fill: 'transparent'})
    }
    if (usingNumber && parseInt(usingNumber, 10) > 0) {
        draw.circle(16).move(62,2).attr({fill: '#f06'});
        draw.path('M 50 40 A 10 10 0 0 1 90 40').fill('#f06');

        // draw.text(usingNumber).move(30,-10).attr({fill: '#f06'}).font({size: 28});
        // nested.line(60, 70, 90, 70).stroke({ color: 'black', width: 3, linecap: 'round' })
        // nested.line(60, 80, 90, 80).stroke({ color: 'black', width: 3, linecap: 'round' })
        // nested.line(60, 90, 90, 90).stroke({ color: 'black', width: 3, linecap: 'round' })
    }
    // if (!isActive) {
    //     draw.rect(30, 30).radius(7).move(60,65).attr({fill: 'red'});
    //     draw.line(65, 80, 85, 80).attr({'stroke-width': 3, stroke: 'white'});
    // }
    return "data:image/svg+xml,"+ encodeURIComponent($(querySelector).get(0).outerHTML);
}
function addPadding(text) {
    while (text.length < 9) {
        text = ' ' + text + ' ';
    }
    return text;
}
function calculatePadding(font) {
    return 0;
    //return 50 - font.length * 7;
}