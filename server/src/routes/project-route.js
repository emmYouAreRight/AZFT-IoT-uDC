'use strict';
const path = require('path'),
    os = require('os'),
    fsPlus = require('fs-plus'),
    fsExtra = require('fs-extra'),
    md2json = require('md-2-json'),
    project = require('../../src/yang-project/main');
    // templateRootPath = path.join(__dirname, '..', '..', 'src', 'yang-project', 'templates');
function getFirstValue(json) {
    if (!json) {return json};
    let val;
    for(let i in json) {
        let item = json[i];
        val = item.raw;
        break;
    }
    return val;
}
//
module.exports = function(router, app) {
    router.prefix('/project')
        .get('/create', async function(ctx, next) {
            await ctx.render('project/create');
            await next();
        })
        .get('/homedir', (ctx, next) => {
            ctx.body = {
                homedir: path.join(os.homedir(), 'hello')
            };
        })
        .post('/templates', function(ctx, next) {
            let sdkPath = ctx.request.body.sdkPath,
                ret = {templates: [], sdkPath: sdkPath},
                templateRootPath = path.join(sdkPath, 'example');
            if (fsPlus.existsSync(templateRootPath)) {
                fsPlus.listSync(templateRootPath).forEach(tpl => {
                    if (!fsPlus.isDirectorySync(tpl)) {return;}
                    let descPath = path.join(tpl, 'README.md'),
                        desc = fsPlus.existsSync(descPath) && fsPlus.isFileSync(descPath) && md2json.parse(fsPlus.readFileSync(descPath, {encoding: 'utf-8'}));

                    ret.templates.push({
                        name: path.basename(tpl),
                        filePath: tpl,
                        desc: getFirstValue(desc) || 'no description'
                    });
                });
            }
            ctx.body = ret;
        })
        .post('/validate', async function(ctx, next) {
            let query = ctx.request.body;
            ctx.body = project.validate({
                location: query.location
            });
        })
        .post('/scaffold', async function(ctx, next) {
            let query = ctx.request.body;
            ctx.body = await project.scaffold({
                location: query.location,
                sdkPath: query.sdkPath,
                //toolChain: query.toolChain,
                templateId: query.templateId,
                hardwareBoard: query.hardwareBoard
            });
            await next();
        });
};
