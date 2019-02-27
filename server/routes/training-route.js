'use static';
module.exports = function(router, app) {
    router.prefix('/training')
        .get('/index', async function(ctx, next) {
            await ctx.render('training/index');
            await next();
        });
}
