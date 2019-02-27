const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../../../lib/options-provider').getInstance();
const isDebugMode = config.isDebugMode;

class Tbframe {

    static is_valid_type(type) {
        return Object.values(MSG_TYPE).includes(type);
    }

    static build_pack(type, ...valueArr) {
        if (!Tbframe.is_valid_type(type)) return '';
        let value = new Buffer('');
        for (let val of valueArr) {
            if (val.constructor === Buffer) {
                value = Buffer.concat([value, val]);
            } else {
                value = Buffer.concat([value, Buffer.from(val)]);
            }
        }
        const frame = Buffer.concat([Buffer.from('{'), Buffer.from(type), Buffer.from(','), Buffer.from(value.length.toString().padStart(5, '0')), Buffer.from(','), value, Buffer.from('}')]);
        if (isDebugMode) {
            const frame = `{${type},${value.length.toString().padStart(5, '0')},${value}}`;
            //console.log('=>', frame);
            fs.appendFileSync(path.join(__dirname, 'log'), '=>' + frame + "\r\n");
        }
        return frame;
    }

    static parse(msg) {
        let sync = false;
        let type = MSG_TYPE.TYPE_NONE;
        let length = 0;
        let value = '';
        if (isDebugMode) {
            fs.appendFileSync(path.join(__dirname, 'log'), '<==' + msg + "\r\n");
            //console.log("<==", msg.toString());
        }
        while (msg != '') {
            if (msg.length < 13) {
                type = MSG_TYPE.TYPE_NONE;
                length = 0;
                value = '';
                break;
            }
            for (let i = 0; i < msg.length; i++) {
                if (msg[i] !== '{') continue;
                if (i + 12 > msg.length) break;
                if (!Tbframe.is_valid_type(msg.slice(i + 1, i + 5))) continue;
                if (msg[i + 5] !== ',') continue;
                if (!(/^\d{5}$/).test(msg.slice(6,11))) continue;
                if (msg[11] !== ',') continue;
                sync = true;
                msg = msg.slice(i);
                break;
            }
            if (!sync) break;
            type = msg.slice(1,5);
            length = parseInt(msg.slice(6,11), 10);
            if (msg.length < length + 13) {
                type = MSG_TYPE.TYPE_NONE;
                length = 0;
                value = '';
                break;
            }
            if (msg[length + 12] != '}') {
                sync = false;
                console.log(msg.slice(0,12), "Lose sync because of FOOTER error.");
                msg = msg.slice(1);
                continue;
            }
            value = msg.slice(12, length + 12);
            msg = msg.slice(length + 13);
            break;
        }
        if (isDebugMode) {
            fs.appendFileSync(path.join(__dirname, 'log'), '%%' + type + value + "\r\n");
        }
        return {type, length, value, nmsg: msg};
    }

    static hashOfFile(fileContent) {
        const hash = crypto.createHash('sha1');
        let i;
        for (i = 0; i + 1024 < fileContent.length; i = i + 1024) {
            hash.update(fileContent.slice(i, i+1024));
        }
        hash.update(fileContent.slice(i, fileContent.length));
        return hash.digest('hex');
    }
}

const MSG_TYPE = {
    CLIENT_DEV: 'CDEV',
    ALL_DEV: 'ADEV',
    DEVICE_LOG: 'DLOG',
    DEVICE_STATUS: 'DSTU',
    DEVICE_CMD: 'DCMD',
    DEVICE_ERASE: 'DERS',
    DEVICE_PROGRAM: 'DPRG',
    DEVICE_RESET: 'DRST',
    DEVICE_START: 'DSTR',
    DEVICE_STOP: 'DSTP',
    DEVICE_DEBUG_START: 'DDBS',
    DEVICE_DEBUG_DATA: 'DDBD',
    DEVICE_DEBUG_REINIT: 'DDBR',
    DEVICE_DEBUG_STOP: 'DDBE',
    DEVICE_ALLOC: 'DALC',
    LOG_SUB: 'LGSB',
    LOG_UNSUB: 'LGUS',
    LOG_DOWNLOAD: 'LGDL',
    STATUS_SUB: 'STSB',
    STATUS_UNSUB: 'STUS',
    FILE_BEGIN: 'FBGN',
    FILE_DATA: 'FDTA',
    FILE_END: 'FEND',
    CMD_DONE: 'CMDD',
    CMD_ERROR: 'CMDE',
    HEARTBEAT: 'HTBT',
    TYPE_NONE: 'NONE',
    ACCESS_LOGIN: 'ALGI',
    TERMINAL_LOGIN: 'TLGI'
}

Tbframe.MSG_TYPE = MSG_TYPE;

module.exports = Tbframe;