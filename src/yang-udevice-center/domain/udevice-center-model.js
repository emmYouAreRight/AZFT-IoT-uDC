const assert = require('assert');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const events = require('events');
const config = require('../../../lib/options-provider').getInstance();
const ConnectionEventHandler = require('./connection-event-handler');
const TBframe = require('../infrastructure/tbframe-converter');
let autoUpdate = null;
class UDeviceCenter extends events.EventEmitter {

    constructor() {
        super();
        this.accessServerConnection = null;
        this.testbedServerConnection = null;
    }

    async ensureConnect(ip = this.ip, port = this.port, cert = this.cert) {
        if (this.testbedServerConnection && this.testbedServerConnection.connectionStatus !== CONNECTION_STATUS.DISCONNECTED) return;
        if (this.accessServerConnection && this.accessServerConnection.connectionStatus !== CONNECTION_STATUS.DISCONNECTED) return;
        return this.connect(ip, port, cert).then(() => {
            this.ip = ip; this.port = port; this.cert = cert;
            // this.daemon = setInterval(async () => {
            //     if (!this.testbedServerConnection || !this.testbedServerConnection.connected) {
            //         this.autoUpdate && clearInterval(this.autoUpdate);
            //         this.connect(ip, port, cert);
            //     }
            // }, 1000);
        });
    }

    updateHeartbeat() {
        this.lastHeartbeat = new Date();
        this.ensureConnect();
    }

    async connect(ip, port, cert) {
        let testbedToken = null;
        return this.connectAccessServer(ip, port, cert, true)
            .then(() => {
                console.log('logining to access server');
                this.connectionEventHandler = new ConnectionEventHandler(this.accessServerConnection, this);
                this.loginManager.setAccessConnection(this.accessServerConnection);
                let adhocInfo = config.adhocInfo
                if (adhocInfo.type === 'fixed') {
                    return this.loginManager.loginAccessServer(`${config.accessKey},fixed,any`);
                } else {
                    return this.loginManager.loginAccessServer(`${config.accessKey},adhoc,${adhocInfo.model}`);
                }
            })
            .then(({ip, port, token, cert}) => {
                console.log(ip, port);
                this.accessServerConnection.disconnect();
                testbedToken = token;
                console.log('connection to testbed server');
                return this.connectTestbedServer(ip, port, cert, true);
            })
            .then(() => {
                console.log('logining to testbed server');
                this.connectionEventHandler = new ConnectionEventHandler(this.testbedServerConnection, this);
                this.loginManager.setTestbedConnection(this.testbedServerConnection);
                return this.loginManager.loginTestbedServer(config.accessKey, testbedToken);
            })
            .then(() => {
                console.log('intialize first wait');
                this.lastHeartbeat = new Date();
                this.cmdManager.initialize(this.testbedServerConnection);
                this.loopUpdateInfo();
                this.testbedServerConnection.on('error', err => {
                    console.log(err);
                    this.destroy();
                });
            }).catch(err => {
                console.log(err);
                this.destroy();
                throw err;
            });
    }

    stop() {
        console.log('stop');
    }

    destroy() {
        console.log('destroy');
        if (autoUpdate) {
            clearInterval(autoUpdate);
            autoUpdate = null;
        }
        this.cmdManager && this.cmdManager.destroy();
        this.connectionEventHandler && delete this.connectionEventHandler;
        try {
            this.accessServerConnection.disconnect();
        } catch(err) {}
        try {
            this.testbedServerConnection.disconnect();
        } catch(err) {}
        this.accessServerConnection = null;
        this.testbedServerConnection = null;
    }

    async connectAccessServer(ip, port, cert, isSecure) {
        this.accessServerConnection = new ServerConnection(ip, port, cert, false);
        return this.accessServerConnection.connect(isSecure);
    }

    async connectTestbedServer(ip, port, cert, isSecure) {
        this.testbedServerConnection = new ServerConnection(ip, port, cert, true);
        const ret = await this.testbedServerConnection.connect(isSecure);
        this.testbedServerConnection.connection.setKeepAlive(true, 1000);
        return ret;
    }

    updateInfo() {
        const server = require('../../../server/index').getInstance();
        // if (new Date() - this.lastHeartbeat > 2000) {
        //     server.getSocketServer('/mesh').emit('status', new MeshMap());
        //     this.stop();
        //     this.destroy();
        //     return;
        // }
        let res = this.getChipStatus();
        if (res) {
            server.getSocketServer('/mesh').emit('status', res);
        } else {
            server.getSocketServer('/mesh').emit('status', new MeshMap());
        }
    }

    loopUpdateInfo() {
        console.log('install loopcheck hook');
        autoUpdate && clearInterval(autoUpdate);
        autoUpdate = setInterval(() => {
            this.updateInfo();
        }, 1000);
    }

    getChipStatus() {
        const data = new MeshMap();
        const deviceMap = this.deviceRepo.getAll();
        try {
            for (let chip in deviceMap) {
                let chipShort;
                try {
                    chipShort = "/dev" + chip.match(/(.*)\/dev(.*)/)[2];
                } catch(err) {
                    chipShort = chip;
                }
                data.addNode({
                    id: data.nodes.length + 1,
                    label: (deviceMap[chip].props.macaddr || "").slice(-8, -4),
                    chip: chip,
                    macAddress: deviceMap[chip].props.macaddr || "",
                    children: [],
                    parent: null,
                    edges: [],
                    chipShort: chipShort,
                    info: deviceMap[chip].props,
                    labelPrev: (deviceMap[chip].props.macaddr || "").slice(-8, -4)
                });
            }
            for (let dev in deviceMap) {
                const chip = deviceMap[dev].props;
                if (chip && (typeof chip.nbrs !== 'object' || Object.keys(chip.nbrs).length <=0)) continue;
                if (!chip) continue;
                for (let nb of Object.keys(chip.nbrs)) {
                    try {
                        let {channel, child_num, forward_rssi, last_heard, link_cost, netid, relation, reverse_rssi, sid} = chip.nbrs[nb];
                        const nodeParent = data.getNodeByMacAddress(nb);
                        const nodeChild = data.getNodeByMacAddress(chip.macaddr);
                        if (!nodeParent) {
                            //console.log('An outer chip?')
                            continue;
                        }
                        if (relation === 'parent'
                            && (netid === chip.netid)
                            && (!this.deviceRepo.get(nodeParent.chip).props || !this._isProblemNode(nodeParent.chip))
                            && (!this.deviceRepo.get(nodeChild.chip).props || !this._isProblemNode(nodeChild.chip))) {
                            data.addEdge(nodeParent, nodeChild, {
                                label: reverse_rssi
                                //,value: parseInt(reverseRSSI) + 100
                            });
                        }
                    } catch(err) {
                        console.log('parse data fail:', nb);
                        console.log(err);
                    }
                }
            }
            return data;
        } catch(err) {
            console.log(err);
        }
    }

    _isProblemNode(chip) {
        return this.deviceRepo.get(chip).props.status !== 'active' || !['leader', 'router', 'leaf', 'super_router'].includes(this.deviceRepo.get(chip).props.state);
    }
}

class MeshMap {
    constructor() {
        this.nodes = [];
    }


    addEdge(parentNode, childNode, prop) {
        if (!parentNode || !childNode) return;
        parentNode.edges.push(Object.assign({
            to: parentNode.id,
            from: childNode.id,
            toLabel: parentNode.labelPrev,
            fromLabel: childNode.labelPrev,
            font: {
                align: 'middle'
            },
            id: parentNode.id * (this.nodes.length + 1) + childNode.id
        }, prop));
        childNode.parent = true;
    }

    addNode(node) {
        this.nodes.push(node);
    }

    getNodeByMacAddress(macAddress) {
        let ret = this.nodes.filter(node => node.macAddress === macAddress);
        return ret[0] || null
    }

    getNodeByChip(chip) {
        let ret = this.nodes.filter(node => node.chip === chip);
        return ret[0] || null
    }

}

class ServerConnection extends events.EventEmitter {

    constructor(ip, port, cert, needHeartbeat) {
        super();
        this.ip = ip;
        this.port = port;
        this.cert = cert;
        this.connection = null;
        this.connectionStatus = CONNECTION_STATUS.DISCONNECTED;
        this.secure = null;
        this.needHeartbeat = needHeartbeat;
    }

    get connectionStatus() {
        //console.log('get', this._connectionStatus);
        //console.trace(this);
        return this._connectionStatus;
    }

    set connectionStatus(status) {
        // console.log('set', status);
        // console.trace(this);
        this._connectionStatus = status;
    }

    async connect(isSecure) {
        const _this = this;
        return new Promise((resolve, reject) => {
            this.secure = isSecure;
            _this.connectionStatus = CONNECTION_STATUS.CONNECTING;
            console.log('connect to ', this.ip, ':', this.port);
            this.connection = isSecure ?
                tls.connect(this.port, this.ip, {
                    cert: [this.cert],
                    rejectUnauthorized: false
                }, resolve) :
                net.connect(this.port, this.ip, resolve);
            this.wrapConnection();
            this.connection.on('error', err => {
                _this.connectionStatus = CONNECTION_STATUS.DISCONNECTED;
                reject(err);
            });
            this.connection.on('close', err => {
                _this.connectionStatus = CONNECTION_STATUS.DISCONNECTED;
                reject(err);
            });
            this.connection.setTimeout(20000);
            this.connection.setNoDelay(true);
            this.connection.on('timeout', () => {
                console.log('socket timeout', this);
                this.disconnect();
            });
        });
    }

    write(args) {
        assert(this.connected, 'Fail to send message while not connected');
        this.connection && this.connection.write(args);
    }

    wrapConnection() {
        for (let event of ['secureConnect', 'OCSPResponse', 'close', 'connect', 'data', 'drain', 'end', 'error', 'lookup', 'timeout']) {
            this.connection.on(event, (...args) => {
                // if (event === 'data') {
                //     console.log(args[0].toString());
                // }
                if (event !== 'data') console.log(event, args);
                if (event === (this.secure ? 'secureConnect' : 'connect')) {
                    console.log(this, 'connected');
                    this.connectionStatus = CONNECTION_STATUS.CONNECTED;
                    this.needHeartbeat && this.startHeartbeat();
                }
                this.emit(event, ...args);
            });
        }
    }

    async startHeartbeat() {
        let heartbeat_timeout = new Date();
        while(this.connected) {
            await new Promise((resolve, reject) => setTimeout(resolve, 500));
            if (new Date() - heartbeat_timeout > 10000) {
                this.write(TBframe.build_pack(TBframe.MSG_TYPE.HEARTBEAT, ''));
                heartbeat_timeout = new Date();
            }
        }
    }

    disconnect() {
        this.connectionStatus = CONNECTION_STATUS.DISCONNECTED;
        this.connection.end();
    }

    get connected() {
        return this.connectionStatus === CONNECTION_STATUS.CONNECTED;
    }
}

const CONNECTION_STATUS = {
    CONNECTING: 0,
    CONNECTED: 1,
    DISCONNECTED: 2
};

module.exports = UDeviceCenter;