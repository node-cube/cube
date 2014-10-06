var fs = require('fs');
var path = require('path');
var css = require('clean-css');

function CssProcessor(cube) {
  this.cube = cube;
}

CssProcessor.info = {
  type: 'style',
  ext: '.css'
};

CssProcessor.prototype = {
  process: function (file, options, callback) {
    var root = options.root;
    var code;
    code = fs.readFileSync(path.join(root, file)).toString();
    var result = {
      source: code,
      code: code
    };

    if (options.compress) {
      try {
        result.code = new css({
          compatibility: true,
          noAdvanced: true,
          keepSpecialComments: 0
        }).minify(code);
      } catch (e) {
        e.message = '[CUBE] processor-css minify css error' + e.message + ' ' + file;
        return callback(e);
      }
    }
    if (options.moduleWrap) {
      result.wraped = this.cube.wrapStyle(options.qpath, result.code);
    }
    callback(null, result);
  }
};

module.exports = CssProcessor;