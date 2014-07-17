/*!
 * cube: lib/csscombine.js
 * Authors  : Fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var path = require('path');
var ejs = require('ejs');
var jade = require('jade');
var fs = require('fs');
var ug = require('uglify-js');
var utils = require('./utils');

function transferEjs(fileName, fpath, code, options) {
  var resFun = ejs.compile(code, {filename: fpath, client: true, compileDebug: !options.compress});
  return 'Cube("' + utils.moduleName(fileName, options.release) + '", ["ejs_runtime"], function (module, exports, require, async) {\n' +
    'var ejs = require("ejs_runtime");' +
    resFun.toString() + '\nmodule.exports = function (obj, filters) {\
      if (filters) {\
        for(var i in ejs) {\
          if (!filters[i]) {\
            filters[i] = ejs[i];\
          }\
        }\
      } else {filters = ejs;}\
      return anonymous(obj, filters)\
    }; return module.exports;})';
}

function transferJade(fileName, fpath, code, options) {
  var resFun = jade.compileClient(code, {filename: fpath});
  return 'Cube("' + utils.moduleName(fileName, options.release) + '", ["jade_runtime"], function (module, exports, require, async) {\n' +
    'var jade = require("jade_runtime");' +
      resFun + '\n module.exports = template; return module.exports;})';
}

function transferFile(root, file, options) {
  var code;
  var res = {};
  var fpath = path.join(root, file);
  try {
    code = fs.readFileSync(fpath, 'utf8').toString();
  } catch (e) {
    e.message +=  'module not found "' + file + '"';
    throw e;
  }
  var ext = path.extname(file);
  res.source = code;
  try {
    switch (ext) {
      case '.ejs':
        code = transferEjs(file, fpath, code, options);
        break;
      case '.jade':
        code = transferJade(file, fpath, code, options);
        break;
    }
  } catch (e) {
    e.message += '\n file:' + file;
    throw e;
  }
  res.wrap = code;

  return res;
}

module.exports = function (base, file, options, callback) {
  var error = null, res;
  try {
    res = transferFile(base, file, options);
  } catch (err) {
    error = err;
  }
  if (options.compress) {
    res.min = ug.minify(res.wrap, {fromString: true}).code;
  }
  callback(error, res);
};

exports.transferFile = transferFile;
exports.transferEjs = transferEjs;
exports.transferJade = transferJade;