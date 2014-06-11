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

var root = null;

exports.init = function (config) {
  root = config.root;
};

exports.transferFile = function(file, compress) {
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
        code = this.transferEjs(file, fpath, code, compress);
        break;
      case '.jade':
        code = this.transferJade(file, fpath, code, compress);
        break;
    }
  } catch (e) {
    e.message += '\n file:' + file;
    throw e;
  }
  return code;
};

exports.transferEjs = function (fileName, fpath, code, compress) {
  var resFun = ejs.compile(code, {filename: fpath, client: true, compileDebug: !compress});
  return '_m_("' + fileName + '", ["/ejs_runtime.js"], function (module, exports, require) {\n'
    + 'var ejs = require("/ejs_runtime.js");'
    + resFun.toString() + '\nmodule.exports = function (obj, filters) {\
      if (filters) {\
        for(var i in ejs) {\
          if (!filters[i]) {\
            filters[i] = ejs[i];\
          }\
        }\
      } else {filters = ejs;}\
      return anonymous(obj, filters)\
    }; return module.exports;})';
};

exports.transferJade = function (fileName, fpath, code, compress) {
  var resFun = jade.compileClient(code, {filename: fpath});
  return '_m_("' + fileName + '", ["/jade_runtime.js"], function (module, exports, require) {\n' +
    'var jade = require("/jade_runtime.js");' +
      resFun + '\n module.exports = template; return module.exports;})';
};