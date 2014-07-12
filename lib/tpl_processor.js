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

function moduleName(file) {
  return file.replace(/\.\w+$/, '.js');
}

function transferEjs(fileName, fpath, code, compress) {
  var resFun = ejs.compile(code, {filename: fpath, client: true, compileDebug: !compress});
  return 'Cube("' + moduleName(fileName) + '", ["ejs_runtime"], function (module, exports, require, async) {\n' +
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

function transferJade(fileName, fpath, code, compress) {
  var resFun = jade.compileClient(code, {filename: fpath});
  return 'Cube("' + moduleName(fileName) + '", ["jade_runtime"], function (module, exports, require, async) {\n' +
    'var jade = require("jade_runtime");' +
      resFun + '\n module.exports = template; return module.exports;})';
}

function transferFile(root, file, compress) {
  var code;
  var fpath = path.join(root, file);
  try {
    code = fs.readFileSync(fpath, 'utf8').toString();
  } catch (e) {
    e.message +=  'module not found "' + file + '"';
    throw e;
  }
  var ext = path.extname(file);
  try {
    switch (ext) {
      case '.ejs':
        code = transferEjs(file, fpath, code, compress);
        break;
      case '.jade':
        code = transferJade(file, fpath, code, compress);
        break;
    }
  } catch (e) {
    e.message += '\n file:' + file;
    throw e;
  }
  return code;
}

module.exports = function (base, file, options, callback) {
  var error = null, res, code;
  try {
    code = transferFile(base, file, options.compress);
  } catch (err) {
    error = err;
  }
  res = {
    source: code
  };
  if (options.compress) {
    res.min = ug.minify(code, {fromString: true}).code;
  }
  callback(error, res);
};
exports.transferFile = transferFile;
exports.transferEjs = transferEjs;
exports.transferJade = transferJade;