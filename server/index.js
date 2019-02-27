'use strict';
const childProcess = require('child_process');
const path = require('path');
const http = require('http');
const Koa = require('koa');
const koaStatic = require('koa-static');
const Router = require('koa-router');
const koaNunjucks = require('koa-nunjucks-2');
const bodyParser = require('koa-bodyparser');
const fsPlus = require('fs-plus');
const detect = require('detect-port');
const socketIO = require('socket.io');
const OptionsProvider = require('../lib/options-provider');
const config = OptionsProvider.getInstance();
var selfCall = Symbol('server');
var server;
//
function getRecuresion(callback) {
    return function recursion(dir) {
        if (!fsPlus.existsSync(dir) || !fsPlus.isDirectorySync(dir)) { return; }
        fsPlus.listSync(dir).forEach(item => {
            if (fsPlus.isDirectorySync(item)) {
                return recursion(item);
            } else if (fsPlus.isFileSync(item)) {
                callback(item);
            }
        });
    };
}

class ServerAliOS {
    constructor(sb) {
        if (typeof sb === 'undefined' || sb !== selfCall) {
            throw "Call Server.getInstance instead";
        }
        let app = this.app = new Koa(),
            server = http.createServer(app.callback()),
            io = this.io = socketIO(server);
        //
        app.use(bodyParser()); //
        app.use(koaStatic(path.join(__dirname, 'public'))); // add static path
        app.use(koaNunjucks({ // add view path
            ext: 'html',
            path: path.join(__dirname, 'views'),
            nunjucksConfig: {
                trimBlocks: true
             }
        }));
        // add router path
        getRecuresion(filePath => {
            let router = new Router(),
                modulePath = path.relative(__dirname, filePath);
                try{
                    require('./' + modulePath.replace(path.win32.sep, path.posix.sep))(router, app);
                } catch(err) {
                    console.log(err);
                }
            app.use(router.routes()).use(router.allowedMethods());
        })(path.join(__dirname, 'routes'));
        //
        // socket server
        getRecuresion(filePath => {
            let modulePath = path.relative(__dirname, filePath).replace(path.win32.sep, path.posix.sep),
                prefix = `/${path.posix.relative('socket', modulePath)}`.replace(/\.js$/gi, '');
            io.of(prefix).on('connection', socket => require('./' + modulePath)(socket, io));
        })(path.join(__dirname, 'socket'));
        // listen port
        detect(10000, (err, port) => {
            err && console.log('fail to start server', err);
            // app.listen(port);
            server.listen(port, 'localhost');
            config.serverPort = port;
            console.log(`http://127.0.0.1:${port}`);
        });
    }

    getSocketServer(prefix) {
        if (prefix) {return this.io.of(prefix);}
        return this.io;
    }

    static getInstance() {
        return server || (server = new ServerAliOS(selfCall));
    }
};

module.exports = ServerAliOS

if(require.main === module){
    ServerAliOS.getInstance()
}