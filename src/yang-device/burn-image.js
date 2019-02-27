const crc16 = require('crc').crc16xmodem;
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let outputTimer;
const SIG_ENUM = {
    SOH: Buffer.from([0x01]),
    STX: Buffer.from([0x02]),
    EOT: Buffer.from([0x04]),
    ACK: Buffer.from([0x06]),
    NAK: Buffer.from([0x15]),
    CA: Buffer.from([0x18]),
    C: Buffer.from([0x43]),
}
function create_pack(head, number, body) {
    if (head === "EOT") {
        //console.log('send', SIG_ENUM.EOT.toString('hex'));
        return SIG_ENUM.EOT;
    } else {
        let res = Buffer.concat([SIG_ENUM[head], Buffer.from([number, 0xFF - number]), body, create_crc(body)]);
        //console.log('send', res.toString('hex'));
        return res;
    }
}

function create_crc(body) {
    const crc = crc16(body);
    //console.log('crc clac', body.toString('ascii'), crc & 0xffff);
    return Buffer.from([crc >> 8, crc & 0xff]);
}

function fillBody(buf, size, fill) {
    if (buf.length >= size) {
        return buf;
    }
    return Buffer.concat([buf, Buffer.alloc(size - buf.length, fill)]);
}

async function wait(time) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, time);
    });
}

async function waitOutput(stream, size, timeout = 2000) {
    return new Promise((resolve, reject) => {
        let buf = stream.read(size);
        if (buf) {
            return resolve(buf);
        }
        stream.on('readable', () => {
            let buf = stream.read(size);
            if (buf) {
                stream.removeAllListeners('readable');
                resolve(buf);
            }
        });
        setTimeout(() => {
            //resolve([]);
            reject(`time out after ${timeout} ms`);
        }, timeout);
    });
}

async function sendFile(filePath, inputstream, outputstream, progress, address) {
    const stats = fs.statSync(filePath);
    const filename = path.basename(filePath);
    let fsContent = fs.readFileSync(filePath);
    const fullLength = fsContent.length;
    progress(`Load Image File ${filePath} size ${fullLength} bytes.`);
    let no = 1;
    //console.log('abort previous ymodem transfer');
    outputstream.write('a\r');
    //console.log('test boot mode');
    // TODO: Makesure is bootloader mode
    //console.log('into ymodem mode');
    outputstream.write(`write ${address}\r`);
    await wait(500);
    inputstream.read();
    let res;
    let tryTime = 0;
    do {
        if (tryTime > 30) {
            progress("Fail waiting device ask for transition.");
            throw "Fail waiting device ask for transition. Please make sure your board is in bootloader mode";
        }
        tryTime += 1;
        res = await waitOutput(inputstream, 1, 5000).catch(() => {
            progress("Timeout waiting device ask for transition.");
            throw "Timeout waiting device ask for transition. Please make sure your board is in bootloader mode"
        });
    } while(res[0] !== SIG_ENUM.C[0]);
    //console.log('receive c, start transform');
    const startTime = process.hrtime();
    outputstream.write(create_pack('SOH', 0, fillBody(Buffer.concat([Buffer.from(filename), Buffer.from([0x00]), Buffer.from(stats.size.toString())]), 128)));
    progress(`Establishing Connection...`);
    res = await waitOutput(inputstream, 1, 200000);
    //console.log(res[0]);
    assert.equal(res[0], SIG_ENUM.ACK[0]);
    res = await waitOutput(inputstream, 1, 200000);
    assert.equal(res[0], SIG_ENUM.C[0]);
    let pack;
    let counter = 0;
    await wait(100);
    outputTimer = setInterval(() => {
        progress(`Transmit ${fullLength - fsContent.length} / ${fullLength} bytes - ${((fullLength - fsContent.length) / fullLength * 100).toFixed(2)} %`);
    }, 1000);
    try {
        while (fsContent.length > 0) {
            //console.log("progress: ", ((fullLength - fsContent.length) / fullLength * 100).toFixed(2), '%');
            if (counter > 20) {
                progress(`Fail to transmit a pack after ${counter} trys. Abort Transmition`);
                break;
            }
            if (fsContent.length > 128) {
                pack = fsContent.slice(0, 1024);
                outputstream.write(create_pack('STX', no, fillBody(pack, 1024, 0x1a)));
                res = await waitOutput(inputstream, 1);
                if (res[0] !== SIG_ENUM.ACK[0]) {
                    counter++;
                    continue;
                } else {
                    counter = 0;
                }
                no = (no + 1) % 0x100;
                fsContent = fsContent.slice(1024);
            } else {
                pack = fsContent;
                outputstream.write(create_pack('SOH', no, fillBody(pack, 128, 0x1a)));
                res = await waitOutput(inputstream, 1);
                if (res[0] !== SIG_ENUM.ACK[0]) {
                    counter++;
                    continue;
                } else {
                    counter = 0;
                }
                no = (no + 1) % 0x100;
                fsContent = Buffer.alloc(0);
            }
        }
    } catch(err) {
        console.log(err);
        clearInterval(outputTimer);
        throw err;
    } finally {
        clearInterval(outputTimer);
    }
    counter = 0;
    do {
        if (counter === 10) {
            progress('Fail to abort transmition.');
            break;
        }
        counter++;
        outputstream.write(create_pack("EOT"));
        let res = await waitOutput(inputstream, 1);
        if (res[0] !== SIG_ENUM.ACK[0]) {
            continue;
        }
        res = await waitOutput(inputstream, 1);
        if (res[0] === SIG_ENUM.C[0]) {
            progress('Transmition finished.');
            break;
        }
    } while(true);
    outputstream.write(create_pack("SOH", 0, fillBody(Buffer.alloc(0), 128)));
    progress(`Total time to burn image ${timeDelta(process.hrtime(), startTime)}`);
}

function timeDelta(time1, time2) {
    return `${(time1[0] - time2[0] + (time1[1] - time2[1])/1e9).toFixed(2)}s`;
}

module.exports = sendFile;
