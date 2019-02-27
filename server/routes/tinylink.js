'use strict';

// router api see https://www.npmjs.com/package/koa-router
//
module.exports = function(router, app) {

    router.prefix('/tinylink')
    .get('/index', async (ctx, next) => {
        await ctx.render('tinylink/index', {title: 'uTinyLink'});
        await next();
    })
};
