const assert = require('assert');
const TBframe = require('../infrastructure/tbframe-converter');
class LoginManager {

    constructor() {
    }

    setTestbedConnection(connection) {
        this.testbedServerConnection = connection;
    }

    setAccessConnection(connection) {
        this.accessServerConnection = connection;
    }

    async loginTestbedServer(accessKey, token) {
        return new Promise((resolve, reject) => {
            assert(this.testbedServerConnection, 'Fail to login without socket');
            //assert(this.testbedServerConnection.connected, 'Fail to login before socket connected');
            const pack = TBframe.build_pack(TBframe.MSG_TYPE.TERMINAL_LOGIN, `${accessKey},${token}`);
            this.testbedServerConnection.write(pack);
            this.pendingLoginTestbedServer = {resolve, reject};
        });
    }

    async loginAccessServer(accessInfo) {
        return new Promise((resolve, reject) => {
            console.log('login access', this.accessServerConnection);
            assert(this.accessServerConnection, 'Fail to login without socket');
            assert(this.accessServerConnection.connected, 'Fail to login before socket connected');
            const pack = TBframe.build_pack(TBframe.MSG_TYPE.ACCESS_LOGIN, `terminal,${accessInfo}`);
            this.accessServerConnection.write(pack);
            this.pendingLoginAccessServer = {resolve, reject};
        });
    }

    testbedLoginCB(value) {
        assert(this.pendingLoginTestbedServer, 'No testbed connecting');
        if (value === 'success') {
            console.log('testbed login success');
            this.pendingLoginTestbedServer.resolve();
        } else {
            console.log('testbed login fail');
            this.pendingLoginTestbedServer.reject(value);
        }
        this.pendingLoginTestbedServer = null;
    }

    accessLoginCB(value) {
        assert(this.pendingLoginAccessServer, 'No access connecting');
        if (value[0] === 'success') {
            console.log('login access success');
            this.pendingLoginAccessServer.resolve({
                ip: value[1],
                port: value[2],
                token: value[3],
                cert: value[4]
            });
        } else {
            console.log('login access fail');
            this.pendingLoginAccessServer.reject(value[0]);
        }
        this.pendingLoginAccessServer = null;
    }
}

module.exports = LoginManager;