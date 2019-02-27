'use strict';
const trace = require('../../src/yang-trace/main');
module.exports = async function(socket, io) {
    socket.on('disconnect', () => {
        trace.disconnect();
    });
    //
    let id = await new Promise((resolve, reject) => {
        socket.once('trace:id', id => resolve(id));
    });
    await trace.connect(id, function(data) {
        data.length && socket.emit('trace:task', data);
    });
};
