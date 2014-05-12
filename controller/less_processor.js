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
var root;

module.exports = function (req, res, next) {
  var qs = req.query;
  //console.log(req);
  var q = url.parse(req.url, true);
  var qpath = q.pathname;
  var compress = qs.c !== undefined ? true : false;
  var code;
  try {
    code = fs.readFileSync(path.join(root, qpath));
  } catch (e) {
    console.error('[CUBE] path not found', e);
    res.end('path not found:' + qpath);
    return;
  }
  parser.parse(code.toString(), function (err, tree) {
    if (err) {
      res.statusCode = 500;
      res.end(err.message);
      return;
    }
    res.setHeader('content-type', 'text/css');
    res.end(tree.toCSS({
      compress: compress
    }));
  });
};

module.exports.init = function (config) {
  root = config.root;
}