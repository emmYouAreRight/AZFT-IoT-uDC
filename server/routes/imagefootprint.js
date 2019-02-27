'use strict';
const OptionsProvider = require('../../lib/options-provider');
const config = OptionsProvider.getInstance();
// router api see https://www.npmjs.com/package/koa-router
//
module.exports = function(router) {

    router.prefix('/imagefootprint')
    .get('/index', async (ctx, next) => {
        await ctx.render('imagefootprint/index', {title: 'Image Footprint'});
        await next();
    })
    .get('/reports', async (ctx, next) => {
        let imageFootprints = config.extension.workspaceState.get("imageFootprintReport", []);
        ctx.body = JSON.stringify(imageFootprints);
        ctx.status = 200;
        await next();
    })
};
