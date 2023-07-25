const connectStatic = require('serve-static');
const connect = require('connect');
const async = require('async');
const url = require('url');
const path = require('path');
const xfs = require('xfs');
const debug = require('debug')('cube:service');

/**
 * run a http server to serve front end resources
 * @param {Cube} cube
 * @param {Object} servOpt
 *    - port  {number}
 *    - maxAge {number}
 *    - static {bool}
 */ 
exports.server = function (cube, servOpt) {
  let config = cube.config;
  let app;
  /**
   * cube middleware
   */
  let cubeMiddleware = exports.middleware(cube);
  app = connect();
  console.log(config.httpPath);
  app.use(config.httpPath, servOpt.static? connectStatic(config.root, {maxAge: 86400000}) : cubeMiddleware);
  app.use(function(err, req, res, next) {
    console.log(err, req.query);
    if (/favicon\.ico$/.test(req.url)) {
      res.statusCode = 200;
      res.end('');
      return;
    }
    next();
  });
  app.listen(servOpt.port, function (err) {
    if (err) {
      cube.log.error('[Cube] server fail to start,', err.message);
    } else {
      cube.log.info('[Cube] server started, listen:', servOpt.port);
      cube.log.info('[Cube] now you can visit: http://localhost:' + servOpt.port + config.httpPath);
    }
  });
};

/**
 * create a express style middleware
 * @param {Cube} cube
 * @param {Middleware} serveStatic(req, res, next)
 * @param {Function} checkSkip(url) return bool
 */
exports.middleware = function (cube) {
  let config = cube.config;
  let cubeLoaderPath = config.loaderPath || '/cube.js';
  let charset = config.charset || 'utf-8';
  let skip = cube.ignoreRules.skip;
  /**
   * fallback the 404 request
   */
  let serveStatic = connectStatic(config.root, {maxAge: 86400000});
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
     * for access cube loader: cube.js
     */
    if (qpath === cubeLoaderPath) {
      res.setHeader('content-type', 'text/javascript');
      xfs.readFile(path.join(__dirname, '../runtime/cube.js'), (err, data) => {
        res.write(data);
        res.write('\n');
        xfs.readFile(path.join(__dirname, '../runtime/cube_clean_cache.js'), (err, data) => {
          res.write(data);
          res.write('\n');
          if (cube.caches) {
            cube.caches.getNodeModules(function (code) {
              res.write(code);
              res.write('\n');
            }, function () {
              res.end('');
            });
          } else {
            res.end('');
          }
        });
      });
      return;
    } 
    /** for cube clean cache */
    if (qpath === '/__clean_cache__') {
      if (!cube.caches) {
        return res.end('');
      }
      // for cache clean call
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
    // skip cube transform
    if (checkSkip(req.url)) {
      res.setHeader('x-cube-skip', 'true');
      return serveStatic(req, res, next);
    }
    if (req.query.m === undefined) {
      res.setHeader('x-cube-process', 'false');
      return serveStatic(req, res, next);
    }
    // 转换文件
    cube.transform(qpath, done);
    function done(err, data) {
      if (err) {
        switch(err.code) {
          case 'CACHED':
            break;
          case 'PASS_UNKNOW_EXT':
          case 'STATIC_FILE':
            return serveStatic(req, res, next);
          case 'FILE_NOT_FOUND':
            err.statusCode = 404;
            return errorMsg(err, data);
          default:
            return errorMsg(err, data);
        }
      }
      res.statusCode = 200;
      res.setHeader('x-cube-process', 'true');
      res.setHeader('content-type', 'application/javascript;charset=' + charset);
      res.end(data.code);
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
};
