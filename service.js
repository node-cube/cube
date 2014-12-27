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
/**
 * init cube
 *
 * @param  {Object} config
 *         - port       listen port [optional]
 *         - connect    the connect object
 *         - root       static root
 *         - router     http path
 *         - middleware  boolean, default false
 */
exports.init = function(cube, config) {
  if (config.middleware === undefined) {
    config.middleware = false;
  }
  var root = cube.config.root;
  var serveStatic;
  var app;

  config.maxAge = config.maxAge ? config.maxAge : 0;
  config.cached = config.cached ? config.cached : root + '.release';

  if (!xfs.existsSync(config.cached)) {
     config.cached = false;
  }
  serveStatic = connectStatic(config.cached ? config.cached : config.root,{ maxAge: config.maxAge });

  function processQuery(req, res, next) {
    var q = url.parse(req.url, true);
    var qpath = q.pathname;
    var ext = path.extname(qpath);
    if (qpath === '/') {
      req.url = '/index.html';
    }
    // parse query object
    if (!req.query) {
      var originalUrl = req.originalUrl;
      originalUrl = originalUrl ? originalUrl : req.url;
      var queryString = url.parse(originalUrl).query;
      req.query = qs.parse(queryString);
      debug('parse request query object', req.query);
    }
    debug('query file', qpath);

    var type =  cube.processors.map[ext];
    if (type === undefined) {
      debug('unknow file type, query will passed to connect.static handler');
      return serveStatic(req, res, next);
    }
    var ps = cube.processors.types[type];
    var options = {
      root: root,
      moduleWrap: req.query.m === undefined ? false : true,
      sourceMap: false,
      compress: req.query.c === undefined ? false : true,
    };
    debug('recognize file type: %s', type);
    // seek for realpath
    utils.seekFile(cube, root, qpath, ps, function (err, realPath, ext, processor) {
      if (err) {
        debug('seek file error', err, options);
        if (type === 'script' && options.moduleWrap) {
          res.statusCode = 200;
          res.end('console.error("[CUBE]",' + JSON.stringify(err.stack) + ');');
          return ;
        }
        res.statusCode = 404;
        return res.end('file not found:' + qpath);
      }

      debug('query: %s target: %s type: %s %s', qpath, realPath, type, cube.mimeType[type]);
      options.qpath = qpath;
      processor.process(realPath, options, function (err, result) {
        if (err) {
          debug('[ERROR]: %s %s %s', err.code, err.message, err.stack);
          if (options.moduleWrap) {
            res.statusCode = 200;
            res.end('console.error("[CUBE]",' + JSON.stringify(err.message) + ');');
          } else {
            res.statusCode = 500;
            res.end(err.message);
          }
          return;
        }
        // resule {source, code, wraped}
        var code;
        var mime;
        if (options.moduleWrap) {
          code = result.wraped !== undefined ? result.wraped : result.code;
          mime = cube.getMIMEType('script');
        } else {
          if (options.compress) {
            code = result.code;
          } else if (realPath === qpath) {
            code = result.source;
          } else {
            code = result.code;
          }
          mime = cube.getMIMEType(type);
        }
        res.statusCode = 200;
        res.setHeader('content-type', mime); // fix #10
        res.end(code);
      });
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
        console.log('[Cube] visit: http://localhost:' + config.port + path.join(config.router, '/index.html').replace(/\\/g, '/'));
      }
    });
  }
};
