/*!
 * Cube services, start a http server, or return a middleware
 */
var xfs = require('xfs');
var debug = require('debug')('cube');
var url = require('url');
var qs = require('querystring');
var path = require('path');
var connect = require('connect');
var utils = require('./lib/utils');
var G = require('./global');
var app;
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
exports.init = function(config) {
  config.cached = config.cached ? config.cached : config.root + '.release';
  if (config.middleware === undefined) {
    config.middleware = true;
  }
  if (config.buildInModule) {
    G.setBuildInModule(config.buildInModule);
  }
  var root = config.root = config.root.replace(/[\\\/]$/, '');
  var connectStatic;

  if (!xfs.existsSync(config.cached)) {
     config.cached = false;
  }

  connectStatic = connect.static(config.cached ? config.cached : config.root);

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

    var type =  G.processors.map[ext];
    if (type === undefined) {
      debug('unknow file type, query will passed to connect.static handler');
      return connectStatic(req, res, next);
    }
    var ps = G.processors.types[type];
    var options = {
      moduleWrap: req.query.m === undefined ? false : true,
      sourceMap: false,
      compress: req.query.c === undefined ? false : true,
      buildInModule: G.buildInModule
    };
    debug('recognize file type: %s', type);
    // seek for realpath
    utils.seekFile(root, qpath, ps, function (err, realPath, ext, processor) {
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
      // lazy loading processing
      if (typeof processor === 'string') {
        try {
          processor = require(processor);
          G.processors.types[type][ext] = processor;
        } catch (e) {
          e.message = 'loading transform error: type:`' + type + '` ext:`' + ext + '`';
          e.code = 'CUBE_LOADING_TRANSFORM_ERROR';
          throw e;
        }
      }
      debug('query: %s target: %s type: %s %s', qpath, realPath, type, G.mimeType[type]);
      options.qpath = qpath;
      processor(root, realPath, options, function (err, result) {
        if (err) {
          debug('[ERROR]: %s %s %s', err.code, err.message);
          if (options.moduleWrap) {
            res.statusCode = 200;
            res.end('console.error("[CUBE]",' + JSON.stringify(err.message) + ');');
          } else {
            res.statusCode = 500;
            res.end(err.message);
          }
          return;
        }
        // resule {source, min, sourceMap}
        var code = options.compress ? result.min : result.source;
        if (options.moduleWrap) {
          if(type === 'style') {
            code = 'Cube("' + qpath + '", [], function(){return ' + JSON.stringify(code) + '});';
          } else if (type === 'template') {
            code = result.wrap;
          }
        }
        res.statusCode = 200;
        res.setHeader('content-type', G.mimeType[type]);
        res.end(code);
      });
    });
  }
  // return middleware
  if (config.middleware) {
    return config.cached ? connectStatic : processQuery;
  } else {
    app = connect();
    app.use(config.router, config.cached ? connectStatic : processQuery);
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

/**
 * band ext to processor, you can custom the own processor
 * like   '.coffee', '.styl'
 *
 * @param {String} ext  file ext name, like `.js` `.coffee`
 * @param {Function|Path} processor(file, base, options) the transfer function
 * @param {Boolean} force force override
 */
exports.bind = G.bind;
exports.getApp = function () {
  return app;
};