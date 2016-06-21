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
 * 识别请求文件的类型、ext、mime
 */
function prepareFile(cube, data, done) {
  let qpath = data.queryPath;
  let ext = path.extname(qpath);
  let type = cube.processors.map[ext];
  if (type === undefined) {
    console.log('[CUBE]`' + qpath + '` unmatch file type, query will passed to connect.static handler');
    return done({code: 'STATIC_FILE'});
  }
  let ps = cube.processors.types[type];
  let mime = cube.getMIMEType(type);

  debug('query file:' + qpath,
    'ext:' + ext,
    'type:' + type,
    'wrap:' + data.wrap,
    'compress:' + data.compress
  );

  data.type = type;
  data.ext = ext;
  data.mime = mime;
  done(null, cube, data, ps);
}

function seekFile(cube, data, ps, done) {
  let qpath = data.queryPath;
  let root = cube.config.root;
  utils.seekFile(cube, root, qpath, ps, function (err, realPath, ext, processors) {
    if (err) {
      debug('seek file error', err.code, err.message, 'filetype:', data.type);
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
    debug('query: %s realpath: %s type: %s %s', qpath, realPath, data.type, data.mime);
    data.realPath = realPath;
    data.processors = processors;
    done(null, data);
  });
}

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
        done(null, cube, data);
      },
      prepareFile,
      seekFile,
      function (data, callback) {
        processor.process(cube, data, callback);
      }
    ], function (err, result) {
      arr.unshift(result);
      let p = parents.slice(0);
      p.push(result.queryPath);
      mergeRequire(cube, result, arr, p, done);
    });
  });
}

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

  var staticMiddleware = connectStatic(
    config.cached ? config.cached : config.root,
    {
      maxAge: config.maxAge
    }
  );
  var skip = cube.config.skip;
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

  serveStatic = function (req, res, next) {
    if (checkSkip(req.url)) {
      return next();
    }
    staticMiddleware(req, res, next);
  };

  function processQuery(req, res, next) {
    var q = url.parse(req.url, true);
    var qpath = q.pathname;
    var queryString;
    var flagModuleWrap;
    var flagCompress;
    if (qpath === '/') {
      req.url = '/index.html';
    }
    // check if skip
    if (checkSkip(req.url)) {
      res.setHeader('x-cube-skip', 'true');
      return next();
    }
    // parse query object
    if (!req.query) {
      queryString = url.parse(req.originalUrl || req.url).query;
      req.query = qs.parse(queryString);
    }

    flagModuleWrap = req.query.m === undefined ? false : true;
    flagCompress = req.query.c === undefined ? false : true;
    /*
    let remote = config.remote;

    let cache = cube.caches.get(flagModuleWrap + ':' + flagCompress + ':' + remote);

    if (cache[qpath]) {
      done(null, cache[qpath]);
    }
    */

    var data = {
      queryPath: qpath,
      realPath: null,
      type: null,
      code: null,
      codeWraped: null,
      source: null,
      sourceMap: null,
      processors: null,
      modifyTime: null,
      mime: null,
      compress: flagCompress,
      wrap: flagModuleWrap
    };

    async.waterfall([
      function (done) {
        done(null, cube, data);
      },
      prepareFile,
      seekFile,
      function (data, callback) {
        processor.process(cube, data, callback);
      }
    ], done);

    function done(err, result) {
      if (err) {
        if (err.code === 'STATIC_FILE') {
          return serveStatic(req, res, next);
        }
        if (err.code !== 'CACHED') {
          return errorMsg(err, result);
        }
      }
      var code = flagModuleWrap ? result.codeWraped : result.code;
      var parent = [result.queryPath];

      if (flagModuleWrap && !result.merged) {
        // 级联合并
        let depsMods = [];
        mergeRequire(cube, result, depsMods, parent, function () {
          let map = {};
          let codesDeps = [];
          depsMods.forEach(function (data) {
            if (map[data.queryPath]) {
              return;
            }
            map[data.queryPath] = true;
            codesDeps.push(flagModuleWrap ? data.codeWraped : data.code);
          });
          code = (codesDeps.length ? codesDeps.join('\n') + '\n' : '') + code;
          output();
        });

      } else {
        output();
      }

      function output() {
        if (result.ext === '.html' && !flagModuleWrap) {
          code = result.source;
        }
        res.statusCode = 200;
        res.setHeader('content-type', result.mime);
        res.end(code);
      }
    }
    function errorMsg(e, result) {
      let mime = result ? result.mime : 'text/html';
      res.statusCode = e.statusCode || 200;
      res.setHeader('content-type', flagModuleWrap ? 'text/javascript' : mime);
      var msg = flagModuleWrap ?
        'console.error("[CUBE]",' +
          (e.code ? '"'+ e.code.replace(/"/g, '\\"') + ': ' + e.message.replace(/"/g, '\\"') +  '",' : '') +
          (e.file ? '"[File]: ' + e.file + '",' : '') +
          (e.line ? '"[Line]: ' + e.line + '",' : '') +
          (e.column ? '"[Column]: ' + e.column + '"' : '') +
          ');' :
        '[CUBE]\n' +
          (e.code ? e.code + ': ' + e.message + '\n' : '') +
          (e.file ? 'File: ' + e.file + '\n' : '') +
          (e.line ? 'Line: ' + e.line + '\n' : '') +
          (e.column ? 'Column: ' + e.column + '\n' : '');
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
