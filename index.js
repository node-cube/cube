/*!
 * cube: index.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var url = require('url');
var path = require('path');
var connect = require('connect');
var JsProcessor = require('./controller/js_processor');
var LessProcessor = require('./controller/less_processor');
var JsTransfer = require('./lib/jstransfer');
var CssTransfer = require('./lib/csscombine');
var ug = require('uglify-js');
var xfs = require('xfs');
var app;
/**
 * [init description]
 * @param  {Object} config
 *         - port       listen port [optional]
 *         - connect    the connect object
 *         - root       static root
 *         - router     http path
 *         - honeyComb  for honeyComb
 */
exports.init = function (config) {
  JsProcessor.init(config);
  LessProcessor.init(config);
  function processQuery(req, res, next) {
    var q = url.parse(req.url, true);
    var qpath = q.pathname;
    var ext = path.extname(qpath);
    if (qpath === '/') {
      req.url = '/index.html'
    }
    switch(ext) {
      case '.css':
        next();
        break;
      case '.js':
        JsProcessor(req, res, next);
        break;
      case '.less':
        LessProcessor(req, res, next);
        break;
      default:
        next();
    }
  }
  // for weird honeycomb
  if (config.honeyComb) {
    return processQuery;
  } else {
    if (config.connect) {
      app = config.app;
    } else {
      app = connect();
      app.use(connect.query());
    }
    app.use(config.router, processQuery);
    app.use(config.router, connect.static(config.root));
  }

  // other static files

  if (config.port) {
    app.listen(config.port, function (err) {
      if (err) {
        console.error('[Cube] server fail to start,', err.message);
      } else {
        console.log('[Cube] server started, listen:', config.port);
        console.log('[Cube] visit: http://localhost:' + config.port + path.join( config.router, '/index.html').replace(/\\/g, '/'));
      }
    });
  }
};

exports.getApp = function () {
  return app;
};

exports.processDir = function (source, dest, reserveList, compress, merge) {
  compress = compress === undefined ? true : compress;
  if (!source) {
    dest = source + '-min';
  }
  xfs.walk(source, function (sourceFile) {
    var relFile = sourceFile.substr(source.length);
    if (/^(\\|\/)/.test(relFile)) {
      relFile.substr(1);
    }
    var destFile = path.join(dest, relFile);
    return;
    // TODO copy file or build file
    var code = JsTransfer.transferFile(sourceFile, source, compress, merge);
    xfs.sync().save(destFile, code);
  });
};
/**
 * transfer js module to browserify node
 * @param  {[type]} file     [description]
 * @param  {[type]} base     [description]
 * @param  {[type]} compress [description]
 * @param  {[type]} merge    [description]
 * @return {[type]}          [description]
 */
exports.buildJs = function (file, base, compress, merge) {
  JsTransfer.init(base);
  return JsTransfer.transferFile(file, compress, merge);
};
exports.minifyJs = function (file, outfile) {
  var destCode = ug.minify();
};
exports.buildTpl = function (file, base, compress) {

};
exports.buildLess = function (file, base, compress) {

};
exports.buildCss = function (file, compress) {
  return ;
};
