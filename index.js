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
var app;
/**
 * [init description]
 * @param  {Object} config
 *         - port       listen port [optional]
 *         - app        the connect object
 *         - root       static root
 *         - router      http path
 */
exports.init = function (config) {
  JsProcessor.init(config);
  LessProcessor.init(config);
  if (config.connect) {
    app = config.app;
  } else {
    app = connect();
  }

  app.use(connect.query());
  app.use(config.router, function (req, res, next) {
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
  });
  // other static files
  app.use(config.router, connect.static(config.root));

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

exports.buildJs = function (file, base, compress) {
  JsTransfer.init(base);
  return JsTransfer.transferFile(file, compress);
};
exports.buildTpl = function (file, base, compress) {

};
exports.buildLess = function (file, base, compress) {

};
exports.buildCss = function (file, compress) {
  return ;
};
