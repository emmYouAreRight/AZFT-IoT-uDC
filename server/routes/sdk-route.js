'use strict';
const os = require('os'),
    path = require('path'),
    sdk = require('../../src/yang-sdk/main');
    //
module.exports = function(router, app) {
    router.prefix('/sdk')
        .get('/index', async function(ctx, next) {
            await ctx.render('sdk/index', {title: 'hello'});
            await next();
        })
        .get('/env', (ctx, next) => {
            ctx.body = {
                hasGcc: sdk.hasGcc(),
                homedir: os.homedir(),
                platform: os.platform(),
                sep: path.sep
            };
        })
        .post('/validate', (ctx, next) => {
            ctx.body = sdk.validate(ctx.request.body.dir, {
                version: ctx.request.body.version,
                //toolChain: ctx.request.body.toolChain
            });
        })
        .post('/update', async function(ctx, next) {
            ctx.body = await sdk.update(ctx.request.body.sdkPaths || []);
            await next();
        })
        .get('/load', (ctx, next) => {
            ctx.body = {
                sdkPaths: sdk.get()
            };
        });
};
