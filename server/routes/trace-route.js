'use strict';
const trace = require('../../src/yang-trace/main'),
    device = require('../../src/yang-device/main');
//
module.exports = function(router, app) {
    router.prefix('/trace')
        .get('/index', async function(ctx, next) {
            await trace.createServer();
            await ctx.render('trace/index');
            await next();
        })
        .get('/tasks', async function(ctx, next) {
            ctx.body = {tasks: await trace.getTasks()};
            // ctx.body = {
            //     tasks: [{
            //         name: 'take me home tonight',
            //         state: 'YYY',
            //         prio: 'NNN',
            //         stackSize: '100',
            //         freeSize: '100',
            //         runtime: '1000',
            //         candidate: '20'
            //     }]
            // }
            await next();
        })
};
