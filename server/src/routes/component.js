'use strict';
const vscode = require('vscode');
const OptionsProvider = require('../../lib/options-provider');
const config = OptionsProvider.getInstance();
const UCube = require('../../src/yang-ucube/main');
const path = require('path');
// router api see https://www.npmjs.com/package/koa-router
//
module.exports = function(router, app) {
/*
    router.prefix('/component')
    .get('/index', async (ctx, next) => {
        await ctx.render('component/index', {title: 'Component Manager'});
        await next();
    })
    .get('/list', async(ctx, next) => {
        const location = ctx.request.query.location.replace(/\//g, path.sep);
        let res = await UCube.listComponents(location);
        ctx.body = JSON.stringify(res.componentListVO);
        ctx.status = 200;
        await next();
    })
    .post('/add', async(ctx, next) => {
        try {
            const location = ctx.request.body.location.replace(/\//g, path.sep);
            const component = ctx.request.body.component;
            await UCube.addComponent(location, component);
            ctx.body = JSON.stringify({error: false});
            ctx.status = 200;
        } catch(err) {
            ctx.body = JSON.stringify({
                error: err
            });
            ctx.status = 200;
            vscode.window.showErrorMessage(err.message || err);
        }
        await next();
    })
    .post('/addRemote', async(ctx, next) => {
        try {
            const location = ctx.request.body.location.replace(/\//g, path.sep);
            const url = ctx.request.body.url;
            await UCube.addRemoteComponent(location, url);
            ctx.body = JSON.stringify({error: false});
            ctx.status = 200;
        } catch(err) {
            ctx.body = JSON.stringify({
                error: err
            });
            ctx.status = 200;
            vscode.window.showErrorMessage(err.message || err);
        }
        await next();
    })
    .post('/remove', async(ctx, next) => {
        try {
            const location = ctx.request.body.location.replace(/\//g, path.sep);
            const component = ctx.request.body.component;
            await UCube.removeComponent(location, component);
            ctx.body = JSON.stringify({error: false});
            ctx.status = 200;
        } catch(err) {
            ctx.body = JSON.stringify({
                error: err
            });
            ctx.status = 200;
            vscode.window.showErrorMessage(err.message || err);
        }
        await next();
    });
*/
};