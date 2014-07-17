/*!
 * cube: lib/csscombine.js
 * Authors  : Fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var path = require('path');
var fs = require('fs');
var utils = require('./utils');

function moduleName(file) {
  return file + '.js';
}

function transferHtml(root, file, options) {
  var code;
  var fpath = path.join(root, file);
  try {
    code = fs.readFileSync(fpath, 'utf8').toString();
  } catch (e) {
    e.message +=  'module not found "' + file + '"';
    throw e;
  }
  return code;
}

module.exports = function (base, file, options, callback) {
  var error = null, res, code;
  try {
    code = transferHtml(base, file, options);
  } catch (err) {
    error = err;
  }
  res = {
    source: code,
    wrap: 'Cube("' + utils.moduleName(file, options.release) + '", [], function (){ return ' + JSON.stringify(code) + '});'
  };
  if (options.compress) {
    res.min = code;
  }
  callback(error, res);
};