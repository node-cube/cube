var fs = require('fs');
var path = require('path');
var Css = require('clean-css');

function CssProcessor(cube) {
  this.cube = cube;
}

CssProcessor.type = 'style';
CssProcessor.ext = '.css';

CssProcessor.prototype = {
  process: function (file, options, callback) {
    var root = options.root;
    var code;
    code = fs.readFileSync(path.join(root, file)).toString();
    var result = {
      source: code,
      code: code
    };
    var self = this;

    if (options.compress) {
      new Css({
        compatibility: true,
        noAdvanced: true,
        keepSpecialComments: 0,
        processImport: false
      }).minify(code, function (err, minified) {
        if (err) {
          var error = new Error('[CUBE] processor-css minify css error ' + file);
          error.errors = err;
          return callback(error);
        }
        result.code = self.cube.fixupResPath(path.dirname(options.qpath), minified.styles);
        if (options.moduleWrap) {
          result.wraped = self.cube.wrapStyle(options.qpath, result.code);
        }
        callback(null, result);
      });
      return ;
    }
    result.code = this.cube.fixupResPath(path.dirname(options.qpath), result.code);
    if (options.moduleWrap) {
      result.wraped = this.cube.wrapStyle(options.qpath, result.code);
    }
    callback(null, result);
  }
};

module.exports = CssProcessor;
