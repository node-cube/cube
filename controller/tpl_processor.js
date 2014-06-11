/*!
 * cube: controller/tpl_processor.js
 * Authors  : 剪巽 <jianxun.zxl@taobao.com> (https://github.com/fishbar)
 * Create   : 2014-06-11 14:43:42
 * CopyRight 2014 (c) Alibaba Group
 */
var tpl = require('../lib/tpl_transfer.js');
var url = require('url');
var path = require('path');

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
    code = tpl.transferFile(module, compress);
  } catch (e) {
    switch (e.code) {
      case 'ENOENT':
        res.statusCode = 404;
        res.end(e.message);
        break;
      case 'TPLPARSE_ERROR':
        res.statusCode = 500;
        res.end('tpl Parse Error:' + e.message + '\n' + e.stack);
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
  tpl.init(config);
};