'use strict';
// router api see https://www.npmjs.com/package/koa-router
//
module.exports = function(router, app) {
    router.get('/index', async (ctx, next) => {
        await ctx.render('index', {title: 'hello'});
        await next();
    });
};
