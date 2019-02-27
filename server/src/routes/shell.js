'use strict';
const OptionsProvider = require('../../lib/options-provider');
const config = OptionsProvider.getInstance();
// router api see https://www.npmjs.com/package/koa-router
//
module.exports = function(router, app) {

    router.prefix('/shell')
    .get('/index', async (ctx, next) => {
        await ctx.render('shell/index', {title: 'Shell'});
        await next();
    })
    .get("/supportcmd", async(ctx, next) => {
        let supportCmd = config.supportCommand;
        //console.log(supportCmd);
        ctx.body = JSON.stringify(supportCmd);
        ctx.status = 200;
        await next();
    });
};
