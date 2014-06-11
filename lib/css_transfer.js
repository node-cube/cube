/*!
 * cube: lib/csscombine.js
 * Authors  : Fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var path = require('path');
var css = require('clean-css');
var less = require('less');
var sass = require('./sass');
var stylus = require('stylus');
var fs = require('fs');
var lessParser = new(less.Parser)({
  paths: [process.cwd()]
});

exports.transferFile = function(file, compress) {
  var code;
  try {
    code = fs.readFileSync(file, 'utf8').toString();
  } catch (e) {
    e.message +=  'module not found "' + file + '"';
    throw e;
  }
  var ext = path.extname(file);
  try {
    switch (ext) {
      case '.css':
        code = this.transferCss(code, compress);
        break;
      case '.less':
        code = this.transferLess(code, compress);
        break;
      case '.sass':
        code = this.transferSass(code, compress);
        break;
      case '.styl':
        code = this.transferStylus(code, compress);
        braek;
    }
  } catch (e) {
    e.message += '\n file:' + file;
    throw e;
  }
  return code;
};

exports.transferCss = function (code, compress) {
  if (!compress) {
    return code;
  }
  return new css({
    compatibility: true,
    noAdvanced: true,
    keepSpecialComments: 0
  }).minify(code);
};

exports.transferLess = function (code, compress) {
  var res;
  lessParser.parse(code, function (err, tree) {
    if (err) {
      console.log(err);
      throw err;
    }

    res = tree.toCSS({
      compress: compress
    });
  });
  return res;
};

exports.transferSass = function (code, compress) {
  var res;
  sass.options({
    // format output: nested, expanded, compact, compressed
    style: compress ? sass.style.compressed : sass.style.nested,
    // add line comments to output: none, default
    comments: sass.comments.none
  });
  return sass.compile(code);
};

exports.transferStylus = function (code, compress) {
  var res = stylus.render(code, {compress: compress});
  return res;
};