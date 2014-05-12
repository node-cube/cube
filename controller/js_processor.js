/*!
 * cube: controller/js_processor.js
 * Authors  : fish <zhengxinlin@gmail.com> (https://github.com/fishbar)
 * Create   : 2014-05-05 00:26:23
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var url = require('url');
var path = require('path');
var js = require('../lib/jstransfer');
var jspath;

module.exports = function (req, res, next) {
  var qs = req.query;
  //console.log(req);
  var q = url.parse(req.url, true);
  var qpath = q.pathname;
  if (qs.m === undefined) {
    return next();
  }
  var compress = qs.c !== undefined ? true : false;
  var module = qpath;
  var code;
  try {
    code = js.transferFile(module, compress);
  } catch (e) {
    switch (e.code) {
      case 'ENOENT':
        res.statusCode = 404;
        res.end(e.message);
        break;
      case 'JSPARSE_ERROR':
        res.statusCode = 500;
        res.end('Js Parse Error:' + e.message + '\n' + e.stack);
        break;
      default:
        res.statusCode = 500;
        res.end('Internal Error:' + e.message + '\n' + e.stack);
    }
    return;
  }
  res.setHeader('content-type', 'application/javascript');
  res.end(code);
};
module.exports.init = function (config) {
  jspath = config.jsdir;
  js.init(config);
};