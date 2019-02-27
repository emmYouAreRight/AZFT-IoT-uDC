const UDeviceCenter = require('./udevice-center-model');
const LogManager = require('./log-manager');
const CmdManager = require('./cmd-manager');
const LoginManager = require('./login-manager');
const DeviceRepo = require('./device-repo');

class UDeviceCenterFactory {
    static createUDeviceCenterInstance() {
        const aUDeviceCenter = new UDeviceCenter();
        aUDeviceCenter.deviceRepo = new DeviceRepo();
        aUDeviceCenter.logManager = new LogManager(aUDeviceCenter);
        aUDeviceCenter.cmdManager = new CmdManager();
        aUDeviceCenter.loginManager = new LoginManager(aUDeviceCenter);

        return aUDeviceCenter;
    }
}

module.exports = UDeviceCenterFactory;