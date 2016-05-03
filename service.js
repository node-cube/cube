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
var wraper = require('./lib/wraper');
var async = require('async');
/**
 * Deprecated
 * see index.js this.CACHE
 * this.CACHE {
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

    var actions = [
      function seekFile(done) {
        utils.seekFile(cube, root, qpath, ps, function (err, realPath, ext, processor) {
          if (err) {
            debug('seek file error', err.code, err.message, 'filetype:', type, 'configs:', config);
            console.error('[CUBE_ERROR]', err.message);
            err.statusCode = 404;
            return done(err);
          }
          if (!processor) {
            return done({
              code: 500,
              message: 'unsupported file type, please register `' + ext + '` processor'
            });
          }
          debug('query: %s realpath: %s type: %s %s', qpath, realPath, type, mime);
          done(null, realPath, processor);
        });
      },
      function checkCache(rpath, processor, done) {
        var tmp = cube.CACHE[cachePath];
        xfs.lstat(path.join(config.root, rpath), function (err, stats) {
          if (err) {
            return done({
              code: 500,
              message: 'read file stats error:' + err.message
            });
          }

          var mtime = new Date(stats.mtime).getTime();
          if (tmp) { // if cached, check cache
            if (tmp.mtime === mtime) { // target the cache, just return
              debug('hint cache', rpath);
              return done({code: 'CACHED'}, {
                mime: tmp.mime,
                code: tmp.codeFinal,
                codeWraped: tmp.codeFinal,
                source: tmp.source
              });
            }
          }
          done(null, rpath, processor, mtime);
        });
      },
      function processCode(rpath, processors, modifyTime, done) {
        var data = {
          queryPath: qpath,
          realPath: rpath,
          type: type,
          code: null,
          codeWraped: null,
          source: null,
          sourceMap: null,
          processors: processors,
          modifyTime: modifyTime,
          mime: mime,
          compress: flagCompress,
          wrap: flagModuleWrap
        };
        try {
          data.source = data.code = xfs.readFileSync(path.join(root, rpath)).toString();
        } catch (e) {
          return done({
            code: 500,
            file: qpath,
            message: 'read file content error:' + e.message
          });
        }
        done(null, data);
      }
    ];

    function done(err, result) {
      var flagCache = false;
      if (err) {
        if (err.code === 'CACHED') {
          flagCache = true;
        } else {
          return error(err, result.mime);
        }
      }
      var code = flagModuleWrap ? result.codeWraped : result.code;

      if (ext === '.html' && !flagModuleWrap) {
        code = result.source;
      }
      res.statusCode = 200;
      res.setHeader('content-type', result.mime);
      res.end(code);
      if (flagCache) {
        // already cached
        return;
      }
      // cache result
      if (cube.config.devCache) {
        debug('cache processed file: %s, %s', result.realPath, result.mtime);
        cube.CACHE[cachePath] = {
          mtime: result.modifyTime,
          mime: result.mime,
          codeFinal: code,
          requires: result.requires
        };
        if (ext === '.html') {
          cube.CACHE[cachePath].source = result.source;
        }
      }
    }
    function error(e, mime) {
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

    function processResult(err, result) {
      if (err) {
        error(err, mime);
        return;
      }

      var wraperMethod;
      switch(type) {
        case 'script':
          try {
            result = wraper.processScript(cube, result);
          } catch (e) {
            return error(e, result.mime);
          }
          if (flagModuleWrap)
            wraperMethod = 'wrapScript';
          // utils.setRequires(result.queryPath, result.requires);
          end(null, result);
          break;
        case 'style':
          if (flagModuleWrap)
            wraperMethod = 'wrapStyle';
          wraper.processCssCode(cube, result, end);
          break;
        case 'template':
          if (flagModuleWrap) {
            try {
              result = wraper.processScript(cube, result);
            } catch (e) {
              return error(e, result.mime);
            }
            wraperMethod = 'wrapScript';
          }
          end(null, result);
          break;
      }
      function end(err, result) {
        if (err) {
          return error(err);
        }
        if (flagModuleWrap) {
          result.mime = cube.getMIMEType('script');
          wraper[wraperMethod](cube, result, done);
        } else {
          done(null, result);
        }
      }
    }
    async.waterfall(actions, function (err, data) {
      if (err) {
        if (err.code === 'CACHED') {
          done(err, data);
        } else {
          error(err, mime);
        }
        return;
      }
      var processActions = [
        function (done) {
          debug('start process');
          done(null, data);
        }
      ];
      data.processors.forEach(function (p) {
        var name = p.constructor.name;
        processActions.push(function (d, done) {
          debug('step into processor:' + name);
          p.process(d, done);
        });
      });
      async.waterfall(processActions, processResult);
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
