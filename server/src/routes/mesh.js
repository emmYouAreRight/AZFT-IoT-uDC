'use strict';
const OptionsProvider = require('../../lib/options-provider');
const config = OptionsProvider.getInstance();
const Build = require('../../src/yang-build/main');

// router api see https://www.npmjs.com/package/koa-router
//
module.exports = function(router, app) {

    router.prefix('/mesh')
    .get('/index', async (ctx, next) => {
        await ctx.render('mesh/index', {title: 'uMesh'});
        await next();
    })
    .get('/flash-address', async(ctx, next) => {
        const build = new Build();
        const flashAddress = build.getFlashAddress();
        ctx.body = {
            address: (flashAddress && flashAddress.length && flashAddress.length > 0) ? flashAddress[0] : flashAddress
        };
        ctx.status = 200;
        await next();
    })
    .get('/current-debugging', async (ctx, next) => {
        const uDeviceCenter = require('../../src/yang-udevice-center/application/udevice-center').getInstance();
        const currentDebuggingChip = uDeviceCenter.currentDebuggingChip;
        ctx.body = {
            chip: currentDebuggingChip
        };
        ctx.status = 200;
        await next();
    });
};
