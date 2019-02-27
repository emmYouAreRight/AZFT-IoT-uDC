'use strict';

const vscode = require('vscode');
const Mqtt = require('aliyun-iot-mqtt');
const OptionsProvider = require('../../lib/options-provider');

var iot;

module.exports = class Iot {
    constructor() {
        this._config = OptionsProvider.getInstance();
    }

    static getInstance() {
        if (!iot) {
            iot = new Iot();
        }
        return iot;
    }

    get config() {
        return this._config;
    }

    init() {
        console.log('iot suite init');
    }

    async probeDevice() {
        let dev = {
            productKey: this.config.productKey,
            deviceName: this.config.studioDeviceName,
            deviceSecret: this.config.studioDeviceSecret
        }
        const TOPIC_GET = '/' + dev.productKey + '/' + dev.deviceName + '/get'
        const TOPIC_UPDATE = '/' + dev.productKey + '/' + dev.deviceName + '/update'
        const TOPIC_ERROR = '/' + dev.productKey + '/' + dev.deviceName + '/update/error'

        const client = Mqtt.getAliyunIotMqttClient(dev);
        client.on('connect', function () {
            console.log("connect");
            console.log("publish to:", TOPIC_UPDATE);
            let msg = {
                payload: 'probe from ' + dev.deviceName + ' ' + (new Date()).toTimeString()
            }
            client.publish(TOPIC_UPDATE, JSON.stringify(msg), function (err) {
                if (err) {
                    console.log(err);
                } else {
                    vscode.window.showInformationMessage('probe message has been sent to: ' + TOPIC_UPDATE);
                }
            });
            client.end(function () {
                console.log("end");
            })
        })
    }
};
