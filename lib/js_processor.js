/*!
 * cube: lib/js_processor.js
 * support buth js and coffee
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */

'use strict';

var fs = require('fs');
var ug = require('uglify-js');
var path = require('path');
var coffee = require('coffee-script');
var G = require('../global');
var root = '';
var buildInModule = {};

function moduleName(file, ifRelease) {
  var ext = path.extname(file);
  var type = G.processors.map[ext];
  if (type === 'script') {
    file = file.replace(/\.\w+$/, '.js');
  } else if (type === 'style') {
    file = file.replace(/\.\w+$/, ifRelease ? '.css.js' : '.css');
  }
  return file;
}
/** test path  .js .coffee */
function tryFiles(modPath) {
  var origExt = path.extname(modPath);
  var fName = path.basename(modPath, origExt);
  var dir = path.dirname(modPath);
  var arr = fs.readdirSync(dir);

  var tmp = fName + '.';
  var matched = [];
  arr.forEach(function (v) {
    if (v.indexOf(tmp) === 0) {
      matched.push(v);
    }
  });
  if (matched.length > 1) {
    throw new Error('files with same name(ignore the ext name): ' + matched.join(' '));
  }
  return path.join(dir, matched[0]);
}
/**
 * testModPath and return the relative real path
 * @param  {Path} modPath abs root, may be file, may be module dir
 * @return {Path}  relative path based on root
 */
function testModPath(modPath) {
  try {
    // test if dir
    var stat = fs.statSync(modPath);
    if (stat.isDirectory()) {
      // get module default enter
      try {
        var pkg = require(path.join(modPath, './package.json'));
        modPath = path.join(modPath, pkg.main);
        modPath = tryFiles(modPath);
      } catch (e) {
        // can not find module main enter, use index.js as default
        modPath = path.join(modPath, 'index');
        modPath = tryFiles(modPath);
      }
    }
  } catch (e) {
    if (/\.(js|coffee)$/.test(modPath)) {
      // if already has ext, throw exception
      throw e;
    }
    modPath = tryFiles(modPath);
  }
  return modPath.substr(root.length);
}
/**
 * 路径转化
 * @param  {[type]} base   [description]
 * @param  {[type]} module [description]
 * @return {[type]}        [description]
 */
function resolvePath(base, module, ifRelease) {
  var dir = path.dirname(base);
  var origModule = module;
  var count = 0;
  var p;
  // require a common module in node_modules, like "jquery", or "jquery/ajax"
  if (/^\w+/.test(module)) {
    // if buildin module which is register in html page, return the origin name
    if (buildInModule[module]) {
      return module;
    }
    while (dir) {
      count ++;
      try {
        p = path.join(dir, '/node_modules/', module);
        p = testModPath(path.join(root, p));
        break;
      } catch (e) {
        if (dir === '/') {
          e.message = '[Cube]' + base + ' required module not found "' + origModule + '"';
          throw e;
        }
        dir = path.dirname(dir);
      }
      if (count > 30) {
        var err = new Error('resolvePath error, may be cycle required');
        err.code = 'CubeResolvePathException';
        throw err;
      }
    }
  }
  // if abs path: like "/jquery"
  else if (/^\//.test(module)) {
    //abs path
    p = testModPath(path.join(root, module));
  } else {
    p = testModPath(path.join(root, dir, module));
  }
  return moduleName(p, ifRelease);
}

function init(cfg) {
  root = cfg.root;
  if (cfg.buildInModule) {
    for (var i in cfg.buildInModule) {
      if (cfg.buildInModule.hasOwnProperty(i)) {
        buildInModule[i] = cfg.buildInModule[i];
      }
    }
  }
}

function transferFile(filepath, options) {
  var code;
  try {
    code = fs.readFileSync(path.join(root, filepath), 'utf8');
  } catch (e) {
    e.message = 'module not found "' + filepath + '"';
    throw e;
  }
  if (/\.coffee/i.test(filepath)) {
    return transferCoffee(filepath, code, options);
  } else {
    if (!options.moduleWrap) {
      return {source: code};
    }
    return transfer(filepath, code, options);
  }
}

function transferCoffee(filepath, code, options) {
  options = options || {};
  code = coffee.compile(code, {
    generatedFile: path.basename(filepath),
    header: true,
    shiftLine: true,
    sourceRoot: '',
    sourceFiles: [path.basename(filepath) + '?m'],
    sourceMap: options.sourceMap
  });
  if (typeof code === 'string') {
    code = {
      js: code
    };
  }
  if (options.sourceMap) {
    options.sourceMap = code.v3SourceMap;
  }
  if (!options.moduleWrap) {
    return {source: code.js};
  }
  return transfer(filepath, code.js, options);
}
/**
 * [transfer description]
 * @param  {Path}     filepath relative to the code base
 * @param  {String}   code     the source code
 * @param  {Boolean}  compress if compress, will output compressd
 * @param  {Object}   merges   {list:[], map: {}}
 * @return {String}   reslut code
 */
function transfer(filepath, code, options) {
  options = options || {};
  if (!filepath) {
    throw new Error('filepath needed!');
  }
  if (!code) {
    code = '';
  }
  var ast;
  try {
    ast = ug.parse(code, {filename: getFileName(filepath, '.source.$1')});
  } catch (e) {
    e.code = 'Js_Parser_Error';
    e.message = e.code + ' ' + e.message + ' line: ' + e.line + ', col: ' + e.col + ', pos: ' + e.pos + ' file:' + filepath;
    throw e;
  }
  var requires = [];
  var requiresMap = {};
  var header = 'Cube("$$filepath$$", $$requires$$, function (module, exports, require, async, __dirname, __filename) {';
  var footer = '\nreturn module.exports;});';
  var flagMerge = false;
  var merges = [];
  var walker = new ug.TreeWalker(function (node) {
    if (node instanceof ug.AST_Toplevel) {
      if (node.start && node.start.comments_before) {
        var cms = node.start.comments_before;
        cms.forEach(function (v) {
          if (/@merge/.test(v.value)) {
            flagMerge = true;
          }
        });
      }
    }
    if (node instanceof ug.AST_Call) {
      // filter other property calls
      if (node.expression.property) {
        return;
      }
      // filter other calls
      if (node.expression.name !== 'require' && node.expression.name !== 'async') {
        return;
      }
      if (!node.expression.thedef.undeclared) {
        return;
      }
      // ignore empty require and async require
      if (!node.args.length) {
        return;
      }
      var v = node.args[0].value;
      if (!v || typeof v !== 'string') {
        return;
      }
      if (!v.trim()) {
        return;
      }
      // node.args[0].vaule -> module
      var abspath = resolvePath(filepath, v, options.release);
      if (node.args.length === 1) {
        requires.push(abspath);
      }
      var line = node.args[0].start.line - 1;
      if (!requiresMap[line]) {
        requiresMap[line] = [{col: node.args[0].start.col, offset: v.length, name: abspath}];
      } else {
        requiresMap[line].push({col: node.args[0].start.col, offset: v.length, name: abspath});
      }
      node.args[0].value = abspath;
    }
  });
  ast.figure_out_scope();
  ast.walk(walker);
  // do merge
  if (flagMerge) {
    if (!merges) {
      merges = {
        list: [],
        map: {}
      };
    }
    requires.forEach(function (v) {
      if (merges[v]) {
        return;
      }
      // native module
      if (!/\//.test(v)) {
        return;
      }
      merges[v] = true;
    });
  }

  header = header.replace(/\$\$(\w+)\$\$/g, function (m0, m1) {
    switch (m1) {
      case 'filepath':
        return filepath.replace(/\.\w+$/, '.js');
      case 'requires':
        return JSON.stringify(requires);
      default:
        return m1;
    }
  });

  var returnObj = {
    source: header + transferRequire(code, requiresMap) + footer,
    requires: requires
  };

  if (options.compress) {
    var compressRes = genCode(filepath, ast, header + footer, true, options.sourceMap);
    returnObj.min = compressRes[0];
    returnObj.sourceMap = compressRes[1];
  }
  return returnObj;
}
/**
 * generate code and sourcemap for
 * @param  {AST} ast    [description]
 * @param  {String} wraper [description]
 * @return {String}        code
 */
function genCode(filepath, ast, wraper, compress, sourceMap) {
  //merge wraper
  wraper = ug.parse(wraper, {filename: getFileName(filepath, '.source.$1')});
  var body = wraper.body[0].body.args[2].body;
  wraper.body[0].body.args[2].body = ast.body;
  ast.body.push(body[0]);

  wraper.figure_out_scope();
  // compress
  if (compress) {
    var sq = ug.Compressor({warnings: false});
    wraper = wraper.transform(sq);

    wraper.compute_char_frequency();
    wraper.mangle_names(true);
  }
  var outOption = {};

  if (sourceMap) {
    outOption.source_map = ug.SourceMap({
      file: getFileName(filepath),
      orig: sourceMap !== true ? sourceMap : undefined,
      root: ''
    });
  }
  var stream = ug.OutputStream(outOption);
  wraper.print(stream);

  var res = [stream.toString() + (sourceMap ? '//@ sourceMappingURL=' + getFileName(filepath, '.map') : '')];
  if (outOption.source_map) {
    res.push(outOption.source_map.toString());
  }
  return res;
}
/**
 * update require path for dev model
 * @param  {String} code        [description]
 * @param  {Object} requiresMap [description]
 * @return {String}             [description]
 */
function transferRequire(code, requiresMap) {
  var arr = code.split(/\r?\n/);
  var tmp, line, res, offset;
  for (var i in requiresMap) {
    res = [];
    offset = 0;
    tmp = requiresMap[i];
    line = arr[i];
    tmp.forEach(function (item) {
      res.push(line.substr(offset, item.col + 1));
      res.push(item.name);
      offset = item.col + item.offset + 1;
    });
    res.push(line.substr(offset));
    arr[i] = res.join('');
  }
  return arr.join('\n');
}

function getFileName(filepath, ext) {
  var filename = path.basename(filepath);
  if (ext) {
    filename = filename.replace(/\.(\w+)$/, ext);
  }
  return filename;
}

function JsProcessor(base, file, options, callback) {
  root = base;
  try {
    var res = transferFile(file, options);
    callback(null, res);
  } catch (err) {
    callback(err);
  }
}

JsProcessor.init = init;
JsProcessor.transferFile = transferFile;
JsProcessor.transfer = transfer;
JsProcessor.transferCoffee = transferCoffee;
module.exports = JsProcessor;