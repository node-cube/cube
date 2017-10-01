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

function Pedding(num, cb) {
  var count = 0;
  return function done() {
    count ++;
    if (count === num) {
      cb();
    }
  };
}
/**
 * 动态合并请求，加速开发模式下的访问速度
 *   开发模式下影响访问效率的主要原因是：并发下载的模块太多导致浏览器下载队列排队现象严重
 *   需要合理的merge模块
 */
function mergeRequire(cube, result, arr, parents, done) {
  let qpath = result.queryPath;
  if (!/^\/node_modules/.test(qpath)) {
    return done();
  }
  debug('hint merge');
  let requires = result.requires || [];
  let basePath = path.dirname(qpath);
  // find node_modules request
  let list = [];
  requires.forEach(function (reqfile) {
    if (reqfile.indexOf(basePath) !== 0) {
      return;
    }
    // cut off the cycle requires
    if (parents.indexOf(reqfile) >= 0) {
      return;
    }

    list.push(reqfile);
  });

  if (!list.length) {
    return done();
  }

  done = Pedding(list.length, done);

  list.forEach(function (reqfile) {
    let data = {
      queryPath: reqfile,
      realPath: reqfile,
      type: null,
      code: null,
      codeWraped: null,
      source: null,
      sourceMap: null,
      processors: null,
      modifyTime: null,
      mime: null,
      compress: result.compress,
      wrap: result.wrap
    };
    async.waterfall([
      function (done) {
        done(null, data);
      },
      cube.seekFile.bind(cube),
      cube.readFile.bind(cube),
      cube.transferCode.bind(cube),
      function (data, done) {
        data.genCode(done);
      }
    ], function (err, result) {
      arr.unshift(result);
      let p = parents.slice(0);
      p.push(result.queryPath);
      mergeRequire(cube, result, arr, p, done);
    });
  });
}

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
    if (checkSkip(req.url)) {
      res.setHeader('x-cube-skip', 'true');
      return serveStatic(req, res, next);
    }
    /**
     * for cube loader
     */
    if (qpath === cubeLoaderPath) {
      res.setHeader('content-type', 'text/javascript');
      xfs.readFile(path.join(__dirname, './runtime/cube.min.js'), (err, data) => {
        res.write(data);
        res.write('\n');
        cube.caches.getNodeModules(function (code) {
          res.write(code);
        }, function () {
          res.end('');
        });

      });
      return;
    }

    flagWrap = req.query.m === undefined ? false : true;
    flagCompress = req.query.c === undefined ? false : true;

    let cachePath = qpath + ':' + flagWrap + ':' + flagCompress + ':' + config.remote;
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
          compress: flagCompress
        };
        done(null, data);
      },
      /** 检查cache，以便下次快速返回 */
      function checkCache(data, callback) {
        let cache = cube.caches.get(cachePath);
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
          if (config.devCache) {
            debug('cache processed file: %s, %s', data.queryPath, data.modifyTime);
            delete data.ast;
            cube.caches.set(cachePath, data);
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

      /*
      if (flagWrap && !result.merged && !/\/node_modules\//.test(result.queryPath)) {
        // 级联合并, 目前只合并 node_modules中的文件
        let depsMods = [];
        let parent = [result.queryPath];
        mergeRequire(cube, result, depsMods, parent, function () {
          let map = {};
          let codesDeps = [];
          depsMods.forEach(function (data) {
            if (map[data.queryPath]) {
              return;
            }
            map[data.queryPath] = true;
            codesDeps.push(flagWrap ? data.codeWraped : data.code);
          });
          code = (codesDeps.length ? codesDeps.join('\n') + '\n' : '') + code;
          output();
        });
      } else {
        output();
      }
      */
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
          (e.code ? '"'+ e.code.replace(/"/g, '\\"') + ': ' + e.message.replace(/"/g, '\\"') +  '",' : e.message.replace(/"/g, '\\"')) +
          (e.file ? '"[File]: ' + e.file + '",' : '') +
          (e.line ? '"[Line]: ' + e.line + '",' : '') +
          (e.column ? '"[Column]: ' + e.column + '"' : '') +
          ');' :
        '[CUBE]\n' +
          (e.code ? e.code + ': ' + e.message + '\n' : e.message) +
          (e.file ? 'File: ' + e.file + '\n' : '') +
          (e.line ? 'Line: ' + e.line + '\n' : '') +
          (e.column ? 'Column: ' + e.column + '\n' : '');
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
    cube.middleware = config.cached ? serveStatic : cubeMiddleware;
    cube.middleware.getCube = function () {
      return cube;
    };
  } else {
    app = connect();
    app.use(config.router, config.cached ? serveStatic : cubeMiddleware);
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
