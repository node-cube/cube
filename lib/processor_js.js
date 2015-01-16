/*!
 * cube: lib/js_processor.js
 * support buth js and coffee
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */

'use strict';
var debug = require('debug')('cube:processor:js');
var fs = require('fs');
var ug = require('uglify-js');
var path = require('path');
var utils = require('./utils');

function getFileName(filepath, ext) {
  var filename = path.basename(filepath);
  if (ext) {
    filename = filename.replace(/\.(\w+)$/, ext);
  }
  return filename;
}

/** test path  .js .coffee */
function tryFiles(cube, root, modPath) {
  var origExt = path.extname(modPath);
  var fName = path.basename(modPath, origExt);
  origExt = origExt || '.js';
  debug('tryFiles, ext: %s', origExt);
  if (!cube.processors.map[origExt]) {
    fName = path.basename(modPath);
    origExt = '.js';
  }

  var dir = path.dirname(modPath);
  var arr = fs.readdirSync(dir);
  var type = cube.processors.map[origExt];
  var possibleExts = Object.keys(cube.processors.types[type]);
  var targetExt = utils.traverseFList(arr, fName, possibleExts);
  if (targetExt instanceof Error) {
    targetExt.message = 'required module not found: `' + modPath.substr(root.length) + '`';
    throw targetExt;
  }
  debug('finally ', fName + targetExt);
  return path.join(dir, fName + targetExt);
}
/**
 * testModPath and return the relative real path
 * @param  {Path} modPath abs root, may be file, may be module dir
 * @return {Path}  relative path based on root
 */
function testModPath(cube, root, modPath) {
  try {
    // test if dir
    var stat = fs.statSync(modPath);
    if (stat.isDirectory()) {
      // get module default enter
      try {
        debug('testModPath:folder, try to loading package.json->main script');
        var pkg = require(path.join(modPath, './package.json'));
        /**
         * search for browserify config in package.json
         * "browserify": "d3.js"
         */
        if (pkg.browserify) {
          modPath = path.join(modPath, pkg.browserify);
        }
        /**
         * search for spm config in package.json
         * "spm": {"main": "d3.js"}
         */
        else if (pkg.spm && pkg.spm.main) {
          modPath = path.join(modPath, pkg.spm.main);
        }
        /**
         * search for pkg.main
         */
        else {
          modPath = path.join(modPath, pkg.main);
        }
        modPath = tryFiles(cube, root, modPath);
      } catch (e) {
        debug('testModPath:folder, try to loading folder/index script');
        // can not find module main enter, use index.js as default
        modPath = path.join(modPath, 'index');
        modPath = tryFiles(cube, root, modPath);
      }
    }
  } catch (e) {
    debug('testModPath, try itself: %s', modPath);
    modPath = tryFiles(cube, root, modPath);
  }
  return modPath.substr(root.length);
}

function testModPathArray(cube, root, parr) {
  var matched = [];
  parr.forEach(function (modp) {
    try {
      var p = testModPath(cube, root, modp);
      matched.push(p);
    } catch (e) {
      // do nothing
    }
  });
  return matched;
}

function tryNodeModules(cube, root, dir, module) {
  var node_modules_path = path.join(dir, '/node_modules/');
  var modp;
  // search node_modules, if match return
  try {
    modp = testModPath(cube, root, path.join(root, node_modules_path, module));
    return modp;
  } catch (e) {
    // ignore, go on search
  }
  // search node_modules with namespace
  var flist = fs.readdirSync(path.join(root,node_modules_path));
  var parr = [];

  flist.forEach(function (v) {
    if (v.indexOf('@') === 0) {
      parr.push(path.join(root, node_modules_path, v, module));
    }
  });

  parr = testModPathArray(cube, root, parr);
  if (!parr.length) {
    // --throw new Error('required module not found');--
    // fix #11
    // ignore `build-in-module not found error`
    // and just return the literal moduleName
    return module;
  }
  return parr[0];
}
/**
 * 路径转化
 * @param {Object} cube    cube instance
 * @param {ath} [varname] [description]
 * @param  {[type]} base   [description]
 * @param  {[type]} module [description]
 * @return {[type]}        [description]
 */
function resolvePath(cube, root, base, module, ifRelease) {
  debug('start resolverPath', module);
  var dir = path.dirname(base);
  var origModule = module;
  var count = 0;
  var p;
  // require a common module in node_modules, like "jquery", or "jquery/ajax"
  if (/^@?\w+/.test(module)) {
    while (dir) {
      count ++;
      try {
        p = tryNodeModules(cube, root, dir, module);
        debug('find module in node_modules', p);
        break;
      } catch (e) {
        if (dir === '/') {
          e.message = 'required module not found: `' + origModule + '`';
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
    debug('abspath module', module);
    //abs path
    p = testModPath(cube, root, path.join(root, module));
  } else {
    p = testModPath(cube, root, path.join(root, dir, module));
  }
  var ext = path.extname(p);
  var type = cube.processors.map[ext];
  return utils.moduleName(p, type, ifRelease);
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
    outOption.sourceMap = ug.SourceMap({
      file: getFileName(filepath),
      orig: sourceMap !== true ? sourceMap : undefined,
      root: ''
    });
  }
  var stream = ug.OutputStream(outOption);
  wraper.print(stream);

  var res = [stream.toString() + (sourceMap ? '//@ sourceMappingURL=' + getFileName(filepath, '.map') : '')];
  if (outOption.source_map) {
    res.push(outOption.sourceMap.toString());
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
      res.push(line.substring(offset, item.col + 1));
      res.push(item.name);
      offset = item.col + item.offset + 1;
    });
    res.push(line.substring(offset));
    arr[i] = res.join('');
  }
  return arr.join('\n');
}

/**
 * get the most left node in binary expression
 * @param  {AST_Node} node
 * @return {AST_Node}
 */
function getTheLeftNode(node) {
  while (node.left) {
    node = node.left;
  }
  return node;
}
function fillMap(node, tarv, map) {
  var v = node.start.value;
  var col = node.start.col;
  var line = node.start.line - 1;
  if (!map[line]) {
    map[line] = [{col: col, offset: v.length, name: tarv}];
  } else {
    map[line].push({col: col, offset: v.length, name: tarv});
  }
}
/**
 * fix the left part, from relpath to abspath
 * @param  {String} str
 * @return {String}
 */
function fixLeftPart(cube, root, filepath, node, release, map) {
  var v = node.value;
  var abspath = path.join(root, filepath);
  var err, tmp;
  if (v.indexOf('/') === 0) { // abs path
    return ;
  } else if (/^\w/.test(v)) { // the node_module
    tmp = path.dirname(abspath);
    while (true) {
      tmp = path.join(tmp, 'node_modules');
      if (fs.existsSync(tmp)) {
        break;
      }
      tmp = path.dirname(tmp);
      if (tmp.length <= root.length) {
        err = new Error('node_modules not found when loading dynamic module');
        err.name = 'CUBE_EXCEPTION';
        throw err;
      }
    }
    tmp = tmp.substr(root.length);
    node.value = tmp;
  } else if (v.indexOf('.') === 0) { // the relative path
    tmp = path.dirname(filepath, v);
    if (/\/$/.test(v) && !/\/$/.test(tmp)) {
      tmp += '/';
    }
    node.value = tmp;
  } else {
    err = new Error('unknow error when loading dynamic module');
    err.name = 'CUBE_EXCEPTION';
    throw err;
  }
  fillMap(node, tmp, map);
}
/**
 * fix the right part, change the suffix
 * @return {String}
 */
function fixRightPart(cube, root, filepath, node, release, map) {
  var sufix = node.value.match(/\.\w+$/);
  var tmp, type;
  if (!sufix) {
    tmp = node.value + '.js';
  } else {
    sufix = sufix[0];
    type = cube.processors.map[sufix];
    if (!type) {
      tmp = node.value + '.js';
    } else {
      tmp = utils.moduleName(node.value, type, release);
    }
  }
  node.value = tmp;
  fillMap(node, tmp, map);
}

/**
 * Class JsProcessor
 * @param {Object}   cube     the cube instance
 */
function JsProcessor(cube) {
  this.cube = cube;
}

JsProcessor.requires = {};

JsProcessor.saveRequire = function (file, require) {
  if (!this.requires[file]) {
    this.requires[file] = [];
  }
  this.requires[file].push(require);
};

JsProcessor.prototype = {
  /**
   * process js file
   * @param {Path}     file     the module file relative path, based on cube base
   * @param {Object}   options  {root: path, compress:boolean, sourceMap:boolean, moduleWrap}
   * @param  {Function} callback({err, data:{source, code, sourceMap}})
   */
  process: function (file, options, callback) {
    var code;
    var root = options.root;
    try {
      code = fs.readFileSync(path.join(root, file), 'utf8');
    } catch (e) {
      // e.message = 'file not found "' + filepath + '"';
      // e.name = 'FILE_NOT_FOUND';
      return callback(e);
    }
    // return origin code if no need to transfer
    if (!options.moduleWrap) {
      return callback(null, {source: code, code: code});
    }
    this.processCode(file, code, options, callback);
  },
  processCode: function (filepath, code, options, callback) {
    options = options || {};
    if (!filepath) {
      callback(new Error('filepath needed!'));
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
      return callback(e);
    }
    debug('parse ast ok', filepath);
    var cube = this.cube;
    var root = options.root;
    var requires = [];
    var requiresMap = {};
    var header = 'Cube("$$filepath$$", $$requires$$, function (module, exports, require, async, __dirname, __filename) {';
    var footer = '\nreturn module.exports;});';
    var flagMerge = false;
    var merges = [];
    //////////////////// walker start //////////////////////
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
        // check if Binary express, like `async('./abc' + vars + '.js');`
        if (node.args[0].TYPE === 'Binary') {
          if (node.expression === 'require') {
            var err = new Error('require not support variable');
            err.name = 'CUBE_EXCEPTION';
            throw err;
          }
          var args0 = node.args[0];
          // get the right and the
          var theRight = args0.right;
          var theLeft = getTheLeftNode(args0);
          if (theLeft.TYPE === 'String') {
            // 处理left前缀
            fixLeftPart(cube, root, filepath, theLeft, options.release, requiresMap);
          }
          if (theRight.TYPE === 'String') {
            // 处理right后缀，
            fixRightPart(cube, root, filepath, theRight, options.release, requiresMap);
          }

        }

        var v = node.args[0].value;
        if (!v || typeof v !== 'string') {
          return;
        }
        if (!v.trim()) {
          return;
        }
        // node.args[0].vaule -> module
        var abspath;
        var line = node.args[0].start.line - 1;
        try {
          abspath = resolvePath(cube, root, filepath, v, options.release);
        } catch (err) {
          err.file = filepath;
          err.line = line;
          err.message += ' at:' + filepath + ' line: ' + line;
          throw err;
        }
        if (node.expression.name === 'require') {
          requires.push(abspath);
        }
        JsProcessor.saveRequire(filepath, abspath);

        if (!requiresMap[line]) {
          requiresMap[line] = [{col: node.args[0].start.col, offset: v.length, name: abspath}];
        } else {
          requiresMap[line].push({col: node.args[0].start.col, offset: v.length, name: abspath});
        }
        node.args[0].value = abspath;
      }
    });
    ///////////////////// walker end //////////////////////
    ast.figure_out_scope();
    ast.walk(walker);
    debug('analyse requires ok');
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
          var ext = path.extname(filepath);
          var type = cube.processors.map[ext];
          var p = utils.moduleName(filepath, type, options.relese);
          if (!options.relese && options.qpath) {
            p = options.qpath;
          }
          return p;
        case 'requires':
          return JSON.stringify(requires);
        default:
          return m1;
      }
    });

    var returnObj = {
      source: code,
      requires: requires
    };
    if (options.compress) {
      var compressRes = genCode(filepath, ast, header + footer, true, options.sourceMap);
      returnObj.code = compressRes[0];
      returnObj.sourceMap = compressRes[1];
    } else {
      returnObj.code = header + transferRequire(code, requiresMap) + footer;
    }
    callback(null, returnObj);
  }
};

JsProcessor.info = {
  type: 'script',
  ext: '.js'
};

module.exports = JsProcessor;