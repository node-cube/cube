/*!
 * Cube services, start a http server, or return a middleware
 */
'use strict';
const xfs = require('xfs');
const debug = require('debug')('cube:service');
const url = require('url');
const path = require('path');
const connect = require('connect');
const connectStatic = require('serve-static');
const async = require('async');

function createMiddleware(cube, serveStatic, checkSkip) {
  let config = cube.config;
  let cubeLoaderPath = config.loaderPath || '/cube.js';
  let charset = config.charset || 'utf-8';
  return function (req, res, next) {
    debug('query path', req.url);
    let q = url.parse(req.url, true);
    let qpath = q.pathname;
    let flagWrap;
    let flagCompress;
    if (qpath === '/') {
      req.url = '/index.html';
    }
    // parse query object
    if (!req.query) {
      req.query = q.query;
    }
    /**
     * for cube loader
     */
    if (qpath === cubeLoaderPath) {
      res.setHeader('content-type', 'text/javascript');
      xfs.readFile(path.join(__dirname, './runtime/cube.js'), (err, data) => {
        res.write(data);
        res.write('\n');
        xfs.readFile(path.join(__dirname, './runtime/cube_clean_cache.js'), (err, data) => {
          res.write(data);
          res.write('\n');
          if (cube.config.optimize === false) {
            res.end('');
          } else {
            cube.caches.getNodeModules(function (code) {
              res.write(code);
              res.write('\n');
            }, function () {
              res.end('');
            });
          }
        });
      });
      return;
    } else if (qpath === '/__clean_cache__') {
      return cube.caches.clean((err) => {
        res.setHeader('content-type', 'image/png');
        if (err) {
          res.statusCode = 500;
          res.end(err.message);
        } else {
          res.statusCode = 200;

          res.end('');
        }
      });
    }

    if (checkSkip(req.url)) {
      res.setHeader('x-cube-skip', 'true');
      return serveStatic(req, res, next);
    }

    flagWrap = req.query.m === undefined ? false : true;
    flagCompress = req.query.c === undefined ? false : true;

    let useCache = flagWrap && !flagCompress;
    let cachePath = qpath + ':' + (config.remote || '-');
    async.waterfall([
      function prepareData(done) {
        /**
         * 贯穿转换过程的Data数据结构
         */
        let data = {
          queryPath: qpath,   // 查询path
          absPath: null,      // 绝对路径
          realPath: null,     // 真实path
          type: null,         // 文件类型
          source: null,       // 源码
          code: null,         // 文件代码
          codeWraped: null,   // wrap后的文件代码
          sourceMap: null,    // 源码的sourceMap
          modifyTime: null,   // 修改时间，检测缓存用
          mime: null,         // mime 类型
          wrap: flagWrap,      // 是否wrap代码
          skip: !flagWrap,    // 是否跳过解析
          compress: flagCompress
        };
        done(null, data);
      },
      /** 检查cache，以便下次快速返回 */
      function checkCache(data, callback) {
        if (!config.devCache) {
          return callback(null, data);
        }
        let cache;
        if (useCache) {
          cache = cube.caches.get(cachePath);
        } 
        if (!cache) {
          return callback(null, data);
        }
        xfs.lstat(cache.absPath, function (err, stats) {
          if (err) {
            return callback({
              code: 'CHECK_CACHE_FILE_ERROR',
              message: 'read file stats error:' + err.message
            });
          }
          var mtime = new Date(stats.mtime).getTime();
          if (cache.modifyTime === mtime) { // target the cache, just return
            debug('hint cache', cachePath, data.queryPath);
            return done(null, cache);
          }
          data.modifyTime = mtime;
          callback(null, data);
        });
      },
      cube.seekFile.bind(cube),
      cube.readFile.bind(cube),
      cube.transferCode.bind(cube),
      /** cache结果，以便下次快速返回 */
      function cacheData(data, callback) {
        data.genCode(function (err, data) {
          if (!err && config.devCache) {
            debug('cache processed file: %s, %s', data.queryPath, data.modifyTime);
            delete data.ast;
            if (useCache) {
              cube.caches.set(cachePath, data);
            }
          }
          callback(err, data);
        });
      }
    ], done);

    function done(err, result) {
      if (err) {
        switch(err.code) {
          case 'PASS_UNKNOW_EXT':
          case 'STATIC_FILE':
            return serveStatic(req, res, next);
          case 'FILE_NOT_FOUND':
            err.statusCode = 404;
            return errorMsg(err, result);
          default:
            return errorMsg(err, result);
        }
      }
      var code = flagWrap ? result.codeWraped : result.code;

      output();

      function output() {
        if (result.ext === '.html' && !flagWrap) {
          code = result.source;
        }
        res.statusCode = 200;
        res.setHeader('content-type', result.mime + ';charset=' + charset);
        res.end(code);
      }
    }

    function errorMsg(e, result) {
      let mime = result ? result.mime : 'text/html';
      res.statusCode = e.statusCode || 200;
      res.setHeader('content-type', flagWrap ? 'text/javascript' : mime);
      var msg = flagWrap ?
        'console.error("[CUBE]",' +

          JSON.stringify(
            (e.code || e.name || 'UNKNOW_ERROR') + ':' + e.message +
            ' [File]:' + e.file +
            ' [Line]:' + (e.loc ? e.loc.line : e.line) +
            ' [Column]: ' + (e.loc ? e.loc.column : e.column)
          ) +
          ');' :
        '[CUBE]\n' +
          (e.code || e.name || 'UNKNOW_ERROR') + e.message +
          ' [File]:' + e.file +
          ' [Line]:' + (e.loc ? e.loc.line : e.line) +
          ' [Column]: ' + (e.loc ? e.loc.column : e.column);
      res.end(msg);
    }
  };
}

/**
 * init service
 *
 * @param {Cube} cube instance
 */
exports.init = function (cube) {
  let config = cube.config;
  let root = config.root;
  let serveStatic;
  let cubeMiddleware;
  let app;

  if (!config.cached) {
    config.cached = config.built ? config.root : root + '.release';
  }

  if (!xfs.existsSync(config.cached)) {
    config.cached = false;
  }

  let skip = cube.ignoreRules.skip;
  function checkSkip(url) {
    if (!skip) {
      return false;
    }
    for (let i =0, len = skip.length; i < len; i++) {
      if (skip[i].test(url)) {
        return true;
      }
    }
    return false;
  }

  config.maxAge = config.maxAge && config.cached ? config.maxAge : 0;
  /**
   * fallback the 404 request
   */
  serveStatic = connectStatic(config.cached ? config.cached : config.root, {
    maxAge: config.maxAge
  });

  /**
   * cube middleware
   */
  cubeMiddleware = createMiddleware(cube, serveStatic, checkSkip);

  if (config.middleware) {
    cube.middleware = config.static || config.cached ? serveStatic : cubeMiddleware;
    cube.middleware.getCube = function () {
      return cube;
    };
  } else {
    app = connect();
    app.use(config.router, config.static || config.cached ? serveStatic : cubeMiddleware);
    app.use(function(err, req, res, next) {
      if (/favicon\.ico$/.test(req.url)) {
        res.statusCode = 200;
        res.end('ico not found');
        return;
      }
      next();
    });
    cube.connect = app;
    config.port && app.listen(config.port, function (err) {
      if (err) {
        cube.log.error('server fail to start,', err.message);
      } else {
        cube.log.info('server started, listen:', config.port);
        cube.log.info('[Cube] now you can visit: http://localhost:' + config.port + config.router);
      }
    });
  }
};
