/*!
 * cube: controller/less_processor.js
 * Authors  : fish <zhengxinlin@gmail.com> (https://github.com/fishbar)
 * Create   : 2014-05-05 00:26:23
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var less = require('less');
var fs = require('fs');
var parser = new(less.Parser);
var path = require('path');
var url = require('url');
var CssTransfer = require('../lib/css_transfer');
var root;

module.exports = function (req, res, next) {
  var qs = req.query;
  //console.log(req);
  var q = url.parse(req.url, true);
  var compress = qs.c !== undefined ? true : false;
  var qpath = q.pathname;
  var extName = path.extname(qpath);
  var filePath = path.join(root, qpath);
  var code;

  res.setHeader('content-type', 'text/css');
  try {
    code = fs.readFileSync(path.join(root, qpath)).toString();
  } catch (e) {
    console.error('[CUBE] path not found', e);
    res.statusCode = 404;
    res.end('path not found:' + qpath);
    return;
  }
  try {
    switch (extName) {
      case '.less':
        code = CssTransfer.transferLess(code, compress);
        break;
      case '.sass':
        code = CssTransfer.transferSass(code, compress);
        break;
      case '.styl':
        code = CssTransfer.transferStylus(code, compress);
        break;
      default:
        code = CssTransfer.transferCss(code, compress);
    }
  } catch (e) {
    console.error('[CUBE] process css file error', e);
    res.statusCode = 500;
    res.end(e.message);
    return;
  }
  res.end(code);
};

module.exports.init = function (config) {
  root = config.root;
}