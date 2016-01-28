/*!
 * Cube services, start a http server, or return a middleware
 */
var xfs = require('xfs');
var debug = require('debug')('cube');
var url = require('url');
var qs = require('querystring');
var path = require('path');
var connect = require('connect');
var connectStatic = require('serve-static');
var utils = require('./lib/utils');
var Event = require('events').EventEmitter;
/**
 * CACHE {
 *   realPath: {
 *     mtime:
 *     mime:
 *     code:
 *   }
 * }
 * @type {Object}
 */
var CACHE = {};
/**
 * init cube
 *
 * the config is from cube.config
 *         - port       listen port [optional]
 *         - connect    the connect object
 *         - root       static root
 *         - router     http path
 *         - middleware  boolean, default false
 *         - cached     the cached path
 *         - builded    if code is builded, boolean, default false
 */
exports.init = function (cube) {
  var config = cube.config;
  if (config.middleware === undefined) {
    config.middleware = false;
  }
  var root = cube.config.root;
  var serveStatic;
  var app;

  if (!config.cached) {
    config.cached = config.builded ? config.root : root + '.release';
  }

  if (!xfs.existsSync(config.cached)) {
    config.cached = false;
  }

  config.maxAge = config.maxAge && config.cached ? config.maxAge : 0;

  serveStatic = connectStatic(config.cached ? config.cached : config.root, {
    maxAge: config.maxAge
  });

  function processQuery(req, res, next) {
    var q = url.parse(req.url, true);
    var qpath = q.pathname;
    var ext = path.extname(qpath);
    var cachePath;
    if (qpath === '/') {
      req.url = '/index.html';
    }
    // parse query object
    if (!req.query) {
      var originalUrl = req.originalUrl;
      originalUrl = originalUrl ? originalUrl : req.url;
      var queryString = url.parse(originalUrl).query;
      req.query = qs.parse(queryString);
    }

    debug('query file', qpath);

    var type =  cube.processors.map[ext];
    if (type === undefined) {
      debug('unknow file type, query will passed to connect.static handler');
      return serveStatic(req, res, next);
    }
    var mime = cube.getMIMEType(type);
    var ps = cube.processors.types[type];
    var options = {
      root: root,
      moduleWrap: req.query.m === undefined ? false : true,
      sourceMap: false,
      compress: req.query.c === undefined ? false : true,
      qpath: qpath
    };
    cachePath = qpath + ':' + options.moduleWrap + ':' + options.compress + ':' + cube.config.remote;
    debug('recognize file type: %s', type);

    var evt = new Event();
    var realPath;

    evt.on('error', function (code, msg) {
      res.statusCode = code || 500;
      res.end(msg || 'server error');
    });

    evt.on('seekfile', function (rpath, processor) {
      var tmp = CACHE[cachePath];
      realPath = rpath;
      xfs.lstat(path.join(options.root, rpath), function (err, stats) {
        if (err) {
          return evt.emit('error', 500, 'read file stats error:' + err.message);
        }
        var mtime = new Date(stats.mtime).getTime();
        if (tmp) { // if cached, check cache
          if (tmp.mtime === mtime) { // target the cache, just return
            debug('hint cache', realPath);
            evt.emit('end', tmp.mime, tmp.code);
          } else {
            evt.emit('process', rpath, processor, mtime);
          }
        } else {
          evt.emit('process', rpath, processor, mtime);
        }
      });
    });
    evt.on('process', function (realPath, processor, mtime) {
      processor.process(realPath, options, function (err, result) {
        if (err) {
          console.log('[' + err.code + ']', err.message);
          if (options.moduleWrap) {
            evt.emit('error', 200, 'console.error("[CUBE]","[' + err.code + ']", ' + JSON.stringify(err.message) + ');');
          } else {
            evt.emit('error', 500, err.message);
          }
          return;
        }
        evt.emit('processEnd', result, mtime);
      });
    });
    evt.on('processEnd', function (result, mtime) {
      var code;
      if (options.moduleWrap) {
        code = result.wraped !== undefined ? result.wraped : result.code;
        mime = cube.getMIMEType('script');
      } else {
        if (options.compress) {
          code = result.code;
        } else if (realPath === qpath) { // for jade/ejs/less transfer
          code = result.source;
        } else {
          code = result.code;
        }
      }
      if (cube.config.devCache) {
        debug('cache processed file: %s, %s', realPath, mtime);
        CACHE[cachePath] = {
          mtime: mtime,
          mime: mime,
          code: code
        };
      }
      evt.emit('end', mime, code);
    });
    evt.on('end', function (mime, code) {
      res.statusCode = 200;
      res.setHeader('content-type', mime); // fix #10
      res.end(code);
    });
    // seek for realpath
    utils.seekFile(cube, root, qpath, ps, function (err, realPath, ext, processor) {
      if (err) {
        debug('seek file error', err, options);
        if (type === 'script' && options.moduleWrap) {
          res.setHeader('content-type', mime);
          evt.emit('error', 200, 'console.error("[CUBE]",' + JSON.stringify(err.stack) + ');');
        } else {
          evt.emit('error', 404, 'file not found:' + qpath);
        }
        return ;
      }
      if (!processor) {
        return evt.emit('error', 500, 'unsupported file type');
      }
      debug('query: %s target: %s type: %s %s', qpath, realPath, type, cube.mimeType[type]);
      evt.emit('seekfile', realPath, processor);
    });
  }
  // return middleware
  if (config.middleware) {
    cube.middleware = config.cached ? serveStatic : processQuery;
    cube.middleware.getCube = function () {
      return cube;
    };
  } else {
    app = connect();
    app.use(config.router, config.cached ? serveStatic : processQuery);
    cube.connect = app;
  }
  // other static files
  if (!config.middleware && config.port) {
    app.listen(config.port, function (err) {
      if (err) {
        console.error('[Cube] server fail to start,', err.message);
      } else {
        console.log('[Cube] server started, listen:', config.port);
        console.log('[Cube] now you can visit: http://localhost:' + config.port + config.router);
      }
    });
  }
};
