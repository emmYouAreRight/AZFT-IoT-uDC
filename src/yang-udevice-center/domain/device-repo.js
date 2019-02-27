const Device = require('./device-model');
class DeviceRepo {
    get deviceMap() {
        return this._deviceMap;
    }

    set deviceMap(value) {
        this._deviceMap = value;
    }

    constructor() {
        this._deviceMap = {};
    }

    update(device, props, isMerge = false) {
        if (this.deviceMap[device]) {
            this.deviceMap[device] = new Device(device, isMerge ? Object.assign(this.deviceMap[device].props, props) : Object.assign({using: this.deviceMap[device].props.using}, props));
        } else {
            this.add(device, props);
        }
    }

    updateAll(deviceMap) {
        for (let device in this.deviceMap) {
            if (!deviceMap.hasOwnProperty(device)) {
                this.remove(device);
            }
        }
        for (let device in deviceMap) {
            this.update(device, deviceMap[device], true);
        }
    }

    add(device, props) {
        this.deviceMap[device] = new Device(device, props);
    }

    remove(device) {
        delete this.deviceMap[device];
    }

    removeAll() {
        this.deviceMap = {};
    }

    get(device) {
        return this.deviceMap[device];
    }

    getAll() {
        return this.deviceMap;
    }
}

module.exports = DeviceRepo;