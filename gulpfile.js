'use strict';
const path = require('path'),
    gulp = require('gulp'),
    util = require('gulp-util'),
    livereload = require('gulp-livereload'),
    clean = require('gulp-rimraf'),
    cached = require('gulp-cached'),
    less = require('gulp-less'),
    rename = require('gulp-rename'),
    watchify = require('gulp-watchify-browserify'),
    envify = require('envify'),
    conf = {
        source: path.join(__dirname),
        output: path.join(__dirname, 'dest'),
        koa: {
            source: path.join(__dirname, 'server', 'src'),
            output: path.join(__dirname, 'server')
        }
        
    };
// 
const env = util.env.e || 'local';
console.log('current env:', env);
// 
gulp.task('clean', () => {
    return gulp.src([
        conf.output,
        path.join(conf.koa.output, '!(src|index.js)')
    ]).pipe(clean());
});
// 增量编译打包相关
gulp.task('inc-browserify', () => {
    let defaultNodeEnv = process.env.NODE_ENV,
        isLocal = env === 'local';
    process.env.NODE_ENV = 'production';
    watchify(path.join('public', 'js', '*.js'), {
        watch: isLocal,
        cwd: path.join(conf.koa.source),
        browserify: {
            debug: isLocal,
            transform: [
              [envify, {global: true}]
            ]
        }
    }, stream => {
        return stream
            // .pipe(gulpif(!isLocal, babel({
            //     presets: [es2015],
            //     compact: false
            // })))
            // .pipe(gulpif(!isLocal, uglify()))
            .pipe(gulp.dest(conf.koa.output))
            .pipe(livereload());
    }, () => {
        process.env.NODE_ENV = defaultNodeEnv;
    });
});
// 
gulp.task('inc-less', () => {
    return new Promise((resolve, reject) => {
        gulp.src(path.join(conf.koa.source, '+(public)', 'less', '*.less'))
        .pipe(less())
        .pipe(rename(filePath => {
            filePath.dirname = filePath.dirname.replace('less', 'css');
            filePath.basename = filePath.basename === 'less' ? 'css' : filePath.basename;
        }))
        // .pipe(cleanCSS()) //minify css
        .pipe(gulp.dest(conf.koa.output))
        .on('end', resolve)
    });
});
// 
gulp.task('inc-copy', gulp.series('inc-less', () => {
    return new Promise((resolve, reject) => {
        gulp.src([
            path.join(conf.koa.source, '!(public)', '**'),
            path.join(conf.koa.source, '+(public)', '!(less|js)'),
            path.join(conf.koa.source, '+(public)', '!(less|js)', '**'),
            path.join(conf.koa.source, '+(public)', 'js', 'libs', '**'),
        ]).pipe(cached('increment')) //不支持超过25m的文件
        .pipe(gulp.dest(conf.koa.output))
        .on('end', resolve)
        .pipe(livereload())
    });
}));
// 
gulp.task('watch', gulp.series(gulp.parallel('inc-copy', 'inc-browserify'), () => {
    livereload.listen();
    var watcher = gulp.watch(path.join(conf.koa.source, '**', '*.*'), ['inc-copy']);
    watcher.on('change', event => {
        console.log(`File: ${event.path} was ${event.type}, running tasks...`);
        if (event.type !== 'deleted') {return;}
        delete cached.caches.increment[event.path];
    });
}));

// ///////////////////////////////////////////////////////////////////////////////////
/**
 * about release
 */
gulp.task('release', gulp.series(gulp.parallel('inc-copy', 'inc-browserify'), () => {
    return new Promise((resolve, reject) => {
        gulp.src([
            path.join(conf.source, '!(server|node_modules)'),
            path.join(conf.source, '!(server|node_modules)', '**'),
            path.join(conf.source, '+(server)', '!(src)'),
            path.join(conf.source, '+(server)', '!(src)', '**'),
        ], {dot: true})
        .pipe(gulp.dest(conf.output))
        .on('end', resolve)
    });
}));
