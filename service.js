/*!
 * Cube services, start a http server, or return a middleware
 */
'use strict';

var xfs = require('xfs');
var debug = require('debug')('cube');
var url = require('url');
var qs = require('querystring');
var path = require('path');
var connect = require('connect');
var connectStatic = require('serve-static');
var utils = require('./lib/utils');
var async = require('async');
var processor = require('./processor');
/**
 * Deprecated
 * see index.js cube.CACHE
 * cube.CACHE {
 *   realPath: {
 *     mtime:
 *     mime:
 *     code:
 *   }
 * }
 * @type {Object}
 */

/**
 * init cube
 *
 * the config is from cube.config
 *         - port       listen port [optional]
 *         - connect    the connect object
 *         - root       static root
 *         - middleware  boolean, default false
 *         - cached     the cached path
 *         - built    if code is built, set to true, working as a static server, default false
 */
exports.init = function (cube) {
  var config = cube.config;
  if (config.middleware === undefined) {
    config.middleware = false;
  }
  var root = cube.config.root;
  var serveStatic;
  var app;
  // 模块被引用列表
  var requiredMap = {};

  if (!config.cached) {
    config.cached = config.built ? config.root : root + '.release';
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
    var queryString;
    var type;
    var ps;
    var mime;
    var flagModuleWrap;
    var flagCompress;
    if (qpath === '/') {
      req.url = '/index.html';
    }
    // parse query object
    if (!req.query) {
      queryString = url.parse(req.originalUrl || req.url).query;
      req.query = qs.parse(queryString);
    }

    flagModuleWrap = req.query.m === undefined ? false : true;
    flagCompress = req.query.c === undefined ? false : true;

    type =  cube.processors.map[ext];
    debug('query file:' + qpath,
      'ext:' + ext,
      'type:' + type,
      'wrap:' + flagModuleWrap,
      'compress:' + flagCompress
    );
    if (type === undefined) {
      console.log('[CUBE]`' + qpath + '` unmatch file type, query will passed to connect.static handler');
      return serveStatic(req, res, next);
    }
    mime = cube.getMIMEType(type);
    ps = cube.processors.types[type];
    cachePath = qpath + ':' + flagModuleWrap + ':' + flagCompress + ':' + config.remote;
    debug('recognize file type: %s', type);

    var data = {
      queryPath: qpath,
      realPath: null,
      type: type,
      code: null,
      codeWraped: null,
      source: null,
      sourceMap: null,
      processors: null,
      modifyTime: null,
      mime: mime,
      compress: flagCompress,
      wrap: flagModuleWrap
    };

    function seekFile(done) {
      utils.seekFile(cube, root, qpath, ps, function (err, realPath, ext, processors) {
        if (err) {
          debug('seek file error', err.code, err.message, 'filetype:', type, 'configs:', config);
          console.error('[CUBE_ERROR]', err.message);
          err.statusCode = 404;
          return done(err);
        }
        if (!processors) {
          return done({
            code: 500,
            message: 'unsupported file type, please register `' + ext + '` processor'
          });
        }
        debug('query: %s realpath: %s type: %s %s', qpath, realPath, type, mime);
        data.realPath = realPath;
        data.processors = processors;
        done(null, data);
      });
    }

    async.waterfall([
      seekFile,
      function (data, callback) {
        processor.process(cube, data, callback);
      }
    ], done);

    function done(err, result) {
      if (err && err.code !== 'CACHED') {
        return errorMsg(err, result);
      }
      var code = flagModuleWrap ? result.codeWraped : result.code;

      if (flagModuleWrap) {
        // 级联合并
        result.requires;
      }

      if (ext === '.html' && !flagModuleWrap) {
        code = result.source;
      }
      res.statusCode = 200;
      res.setHeader('content-type', result.mime);
      res.end(code);
    }
    function errorMsg(e, result) {
      let mime = result ? result.mime : 'text/html';
      res.statusCode = e.statusCode || 200;
      res.setHeader('content-type', flagModuleWrap ? 'text/javascript' : mime);
      var msg = flagModuleWrap ?
        'console.error("[CUBE]",' +
          (e.code ? '"Code: "' + e.code + '",' : '') +
          (e.file ? '"File: ' + e.file + '",' : '') +
          (e.line ? '"Line: ' + e.line + '",' : '') +
          (e.column ? '"Column: ' + e.column + '",' : '') +
          '"Message:' + e.message.replace(/"/g, '\\"') + '")' :
        '[CUBE]\n' +
          (e.code ? 'Code: ' + e.code + '\n' : '') +
          (e.file ? 'File: ' + e.file + '\n' : '') +
          (e.line ? 'Line: ' + e.line + '\n' : '') +
          (e.column ? 'Column: ' + e.column + '\n' : '') +
        'Message:' + e.message;
      res.end(msg);
    }


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
    app.use(function(err, req, res, next) {
      if (/favicon\.ico$/.test(req.url)) {
        res.statusCode = 200;
        res.end('ico not found');
        return;
      }
      next();
    });
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
