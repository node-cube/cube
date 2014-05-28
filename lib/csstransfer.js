/*!
 * cube: lib/csscombine.js
 * Authors  : Fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var path = require('path');
var css = require('css');
var less = require('less');
var sass = require('./sass');
var lessParser = new(less.Parser);

exports.transferFile = function(path, compress) {

};

exports.transferCss = function (code, compress) {
  if (!compress) {
    return code;
  }
  var ast = css.parse(code);
  return css.stringify(ast, {compress: true});
};

exports.transferLess = function (code, compress) {
  var res;
  lessParser.parse(code, function (err, tree) {
    if (err) {
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