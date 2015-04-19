/*!
 * cube: lib/csscombine.js
 * Authors  : Fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var path = require('path');
var fs = require('fs');

function HtmlProcessor(cube) {
  this.cube = cube;
}

HtmlProcessor.type = 'template';
HtmlProcessor.ext = '.html';

HtmlProcessor.prototype = {
  process: function (file, options, callback) {
    var root = options.root;
    var error = null, res, code;
    try {
      var fpath = path.join(root, file);
      code = fs.readFileSync(fpath, 'utf8').toString();
    } catch (e) {
      return callback(e);
    }
    res = {
      source: code,
      code: code
    };
    if (options.moduleWrap) {
      res.wraped = this.cube.wrapTemplate(options.qpath, code, [], 'string');
    }
    callback(error, res);
  }
};

module.exports = HtmlProcessor;