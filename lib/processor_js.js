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
var path = require('path');
var esprima = require('esprima');
var escope = require('escope');
var estraverse = require('estraverse');
var esmangle = require('esmangle');
var codegen = require('escodegen');
var syntax = esprima.Syntax;
var utils = require('./utils');

function getFileName(filepath, ext) {
  var filename = path.basename(filepath);
  if (ext) {
    filename = filename.replace(/\.(\w+)$/, ext);
  }
  return filename;
}

function unique(arr) {
  let map = {};
  arr.forEach(function (v) {
    map[v] = true;
  });
  return Object.keys(map);
}

/** test path  .js .coffee */
function tryFiles(cube, root, modPath) {
  var origExt = path.extname(modPath);
  var fName = path.basename(modPath, origExt);
  debug('tryFiles: %s, ext: %s', modPath, origExt);
  var dir = path.dirname(modPath);
  var arr;
  var err;
  try {
    arr = fs.readdirSync(dir);
  } catch (e) {
    err = new Error('[ERROR] required module not found: `' + modPath.substr(root.length) + '`');
    err.possiblePath = modPath.substr(root.length);
    throw err;
  }
  var type = cube.processors.map[origExt || '.js'];
  if (!type) {
    // may be filename like `require('./abc.dot')`
    // if unknow type, switch to script type
    type = 'script';
    fName = path.basename(modPath);
  }
  var possibleExts = Object.keys(cube.processors.types[type]);
  var targetExt = utils.getPossibleExt(arr, fName, origExt, possibleExts);
  if (targetExt === null) {
    err = new Error('[ERROR] required module not found: `' + modPath.substr(root.length) + '`');
    err.possiblePath = modPath.substr(root.length);
    throw err;
  }
  var finalPath = path.join(dir, fName + targetExt);
  debug('finally ', finalPath);
  return finalPath;
}
/**
 * testModPath and return the relative real path
 * @param  {Path} modPath abs root, may be file, may be module dir
 * @return {Path}  relative path based on root
 */
function testModPath(cube, root, modPath, modName) {
  try {
    // test if dir
    var stat = fs.statSync(modPath);
    if (stat.isDirectory()) {
      // get module default enter
      try {
        var pkg = require(path.join(modPath, './package.json'));
        /**
         * search module/dist dir
         * @type {[type]}
         */
        var modDist = path.join(modPath, 'dist', modName + '.js');
        if (cube.config.withDist && fs.existsSync(modDist)) {
          modPath = modDist;
        }
        /**
         * search for browserify config in package.json
         * "browserify": "d3.js"
         */
        else if (pkg.browserify && typeof pkg.browserify === 'string') {
          modPath = path.join(modPath, pkg.browserify);
        }
        /**
         * search for pkg.main
         */
        else {
          modPath = path.join(modPath, pkg.main);
        }
        debug('testModPath:folder, try to loading package.json->main script', modPath);
        modPath = tryFiles(cube, root, modPath);
      } catch (e) {
        debug('testModPath:folder, package.json->main not found', e);
        // can not find module main enter, use index.js as default
        modPath = path.join(modPath, 'index');
        debug('testModPath:folder, try to loading folder/index script', modPath);
        try {
          modPath = tryFiles(cube, root, modPath);
        } catch (e) {
          debug('testModPath folder/index not found, try itself: %s', modPath);
          modPath = tryFiles(cube, root, modPath);
        }
      }
    } else {
      throw new Error('illegal module path, ' + modPath);
    }
  } catch (e) {
    debug('path not found', modPath);
    modPath = tryFiles(cube, root, modPath);
  }
  return modPath.substr(root.length);
}

/*
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
*/

/*
function tryNodeModules(cube, root, dir, module) {
  var nodeModulesPath = path.join(dir, '/node_modules/');
  var modp;
  // search node_modules, if match return

  modp = testModPath(cube, root, path.join(root, nodeModulesPath, module));
  return modp;

  /* deprecated
  // search node_modules with namespace
  var flist = fs.readdirSync(path.join(root, nodeModulesPath));
  var parr = [];

  flist.forEach(function (v) {
    if (v.indexOf('@') === 0) {
      parr.push(path.join(root, nodeModulesPath, v, module));
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
*/
function ifRootPath(path) {
  /*
  if (process.platform.indexOf('win') === 0) {
      return path === '\\';
  } else {
      return path === '/';
  }
  */
  return path === '/' || path === '\\';
}
/**
 * 路径转化
 * @param {Object} cube    cube instance
 * @param {ath} [varname] [description]
 * @param  {[type]} base   [description]
 * @param  {[type]} module [description]
 * @return {[type]}        [description]
 */
function resolvePath(cube, root, base, module) {
  debug('start resolver path', root, base, module);
  var dir = path.dirname(base);
  var origModule = module;
  var count = 0;
  var nodeModulePath;
  var p;
  // console.log('>>-- original path:', dir, base);
  // require a common module in node_modules, like "jquery", or "jquery/ajax"
  if (/^@?\w+/.test(module)) {
    debug('module type: node_modules');
    while (dir) {
      count++;
      nodeModulePath = path.join(root, dir, '/node_modules/', module);
      if (cube.checkIgnore(nodeModulePath)) {
        console.error('[CUBE_WARN] required node_module ignored by .cubeignore config', module);
        p = module;
        // if not the root dir, find the parent node_modules
        if (!ifRootPath(dir)) {
          dir = path.dirname(dir);
          continue;
        }
      }
      try {
        p = testModPath(cube, root, nodeModulePath, module);
        debug('find node_modules:', path.join(dir, '/node_modules/', module));
        break;
      } catch (e) {
        debug('node_module not found:', path.join(dir, '/node_modules/'));
        // console.log('>>--- resolved path:', dir, ifRootPath(dir));
        if (ifRootPath(dir)) {
          console.error('[CUBE_WARN] required node_module not found: `' + origModule + '`');
          p = module;
          break;
        }
        dir = path.dirname(dir);
      }
      if (count > 50) {
        debug('seek node_modules 30 times, max retry, exit');
        var err = new Error('resolvePath error, may be cycle required');
        err.code = 'CubeResolvePathException';
        throw err;
      }
    }
  } else if (/^\//.test(module)) { // if abs path: like "/jquery"
    debug('module type: abs_module', module);
    //abs path
    p = testModPath(cube, root, path.join(root, module), module);
  } else {
    debug('module type: relative_module', module);
    p = testModPath(cube, root, path.join(root, dir, module), module);
  }
  // var ext = path.extname(p);
  // var type = cube.processors.map[ext];
  // var finalP = utils.moduleName(p, type, ifRelease);
  return fixWinPath(p);
}

function fixWinPath(fpath) {
  return fpath.replace(/\\/g, '/');
}
/**
 * generate compressed code and sourcemap
 * @param  {AST} ast    [description]
 * @param  {String} wraper [description]
 * @return {String}        code
 */
function genCode(filepath, ast, wraper, compress, sourceMap) {
  var code, body, res;
  //merge wraper
  wraper = esprima.parse(wraper, {filename: getFileName(filepath, '.source.$1')});
  body = wraper.body[0].expression.arguments[2].body.body;
  wraper.body[0].expression.arguments[2].body.body = ast.body;
  ast.body.push(body[0]);

  // optimized the AST
  wraper = esmangle.optimize(wraper, null);
  // mangled the AST
  wraper = esmangle.mangle(wraper);
  // finally gen the code
  code = codegen.generate(wraper, {
    comment: false,
    format: {
      renumber: true,
      hexadecimal: true,
      escapeless: true,
      compact: true,
      semicolons: false,
      parentheses: false
    }
  });
  /*
  if (sourceMap) {
    outOption.sourceMap = ug.SourceMap({
      file: getFileName(filepath),
      orig: sourceMap !== true ? sourceMap : undefined,
      root: ''
    });
  }
  /*
  var stream = ug.OutputStream(outOption);
  wraper.print(stream);
  */
  res = [code + (sourceMap ? '//@ sourceMappingURL=' + getFileName(filepath, '.map') : '')];
  /*
  if (outOption.source_map) {
    res.push(outOption.sourceMap.toString());
  }
  */
  return res;
}

function genUncompressCode(head, code, foot, release) {
  if (release) {
    return head + '\n' + code + '\n' + foot;
  } else {
    return head + code + foot;
  }
}
/**
 * update require path for dev model
 * @param  {String} code        [description]
 * @param  {Object} requiresMap [description]
 * @return {String}             [description]
 */
function transferRequire(code, requiresMap) {
  var arr = code.split(/\r?\n/);
  var tmp, line, res, offset, i;
  for (i in requiresMap) {
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
/**
 * [fillMap description]
 *
 * node: {
 *   range: [ 0, 15 ],
 *   loc: { start: { line: 1, column: 8 }, end: { line: 1, column: 26 } },
 * }
 */
function fillMap(node, tarv, map) {
  var col = node.loc.start.column;
  var offset = node.range[1] - node.range[0] - 2; // 前后引号
  var line = node.loc.start.line - 1;
  if (!map[line]) {
    map[line] = [{col: col, offset: offset, name: tarv}];
  } else {
    map[line].push({col: col, offset: offset, name: tarv});
  }
}
/**
 * fix the left part, from relpath to abspath
 * @param  {String} str
 * @return {String}
 */
function fixLeftPart(cube, root, filepath, node, release, map, remote) {
  var v = node.value;
  var abspath = path.join(root, filepath);
  var err, tmp;
  var count = 10000;
  if (v.indexOf('/') === 0) { // abs path
    return;
  } else if (/^\w/.test(v)) { // the node_module
    tmp = path.dirname(abspath);
    while (count >= 0) {
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
      count--;
      if (count === 0) {
        throw new Error('max try in fixLeftPart()');
      }
    }
    tmp = tmp.substr(root.length);
  } else if (v.indexOf('.') === 0) { // the relative path
    tmp = path.join(path.dirname(filepath), v);
    if (/\/$/.test(v) && !/(\/|\\)$/.test(tmp)) {
      tmp += '/';
    }
  } else {
    err = new Error('unknow error when loading dynamic module');
    err.name = 'CUBE_EXCEPTION';
    throw err;
  }
  tmp = fixWinPath(tmp);
  if (remote) {
    tmp = remote + ':' + tmp;
  }
  node.value = tmp;

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
  tmp = fixWinPath(tmp);
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

JsProcessor.type = 'script';
JsProcessor.ext = '.js';
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
  /**
   * processCode
   * @param  {String}   filepath [description]
   * @param  {Object}   code     code can be codestr or  ast object
   * @param  {Object}   options  [description]
   * @param  {Function} callback [description]
   */
  processCode: function (filepath, code, options, callback) {
    options = options || {};
    if (!filepath) {
      callback(new Error('filepath needed!'));
    }
    if (!code) {
      code = '';
    }
    var ast;
    var scope;
    var comments = [];
    try {
      ast = esprima.parse(code, {
        loc: true,
        range: true,
        comment: comments
      });
    } catch (e) {
      e.code = 'Js_Parse_Error';
      e.message = 'File:' + filepath + ', index: ' + e.index + ', ' + e.message;
      return callback(e);
    }

    scope = escope.analyze(ast);

    debug('parse ast ok', filepath);
    var cube = this.cube;
    var root = options.root;
    var requires = [];
    var requiresMap = {};
    var originalRequires = [];
    var header = 'Cube("$$filepath$$", $$requires$$, function (module, exports, require, load, __dirname, __filename) {';
    var footer = '\nreturn module.exports;});';
    var remote = cube.config.remote;

    var currentScope = scope.acquire(ast);
    //////////////////// walker start //////////////////////
    estraverse.traverse(ast, {
      enter: function (node) {
        if (/Function/.test(node.type)) {
          currentScope = scope.acquire(node);
        }
        /**
        node = {
          range: [ 0, 15 ],
          loc: {
            start: { line: 1, column: 0 },
            end: { line: 1, column: 15 }
          },
          type: 'CallExpression',
          callee:{
            range: [ 0, 7 ],
            loc: { start: [Object], end: [Object] },
            type: 'Identifier', // can be 'MemberExpression' code like: `obj[name]();`
            name: 'require' },
          arguments:[
            { range: [Object],
              loc: [Object],
              type: 'Literal',
              value: 'test',
              raw: '"test"' }
          ]
        }
        */
        if (node.type === syntax.CallExpression) {
          // filter other property calls, like `require[test]();`, `require.resolve()`
          if (node.callee.type !== syntax.Identifier) {
            return;
          }
          // filter other calls
          if (node.callee.name !== 'require' && node.callee.name !== 'load') {
            return;
          }
          //


          // check if require() or load() is redefined in current scope
          var flagRedefined = false;
          var tmpScope = currentScope;
          var v;
          do {
            for (var i = 0; i < tmpScope.variables.length; ++i) {
              v = tmpScope.variables[i];
              if ((v.name === 'require' || v.name === 'load') && v.defs.length) {
                flagRedefined = true;
                break;
              }
            }
            tmpScope = tmpScope.upper;
          } while (tmpScope);
          if (flagRedefined) {
            return;
          }

          // ignore empty require and async load or
          // arguments.length > 3
          // `load('module')` `load('css', namespace)`
          // `load('css', namespace, function (css) {})`
          if (!node.arguments.length || node.arguments.length > 3) {
            return;
          }
          var args0 = node.arguments[0];
          // check if Binary express, like `load('./abc' + vars + '.js');`
          if (args0.type === syntax.BinaryExpression) {
            /**
             arguments[0] = {
                range: [ 8, 26 ],
                loc: { start: { line: 1, column: 8 }, end: { line: 1, column: 26 } },
                type: 'BinaryExpression',
                operator: '+',
                left:{
                  range: [ 8, 18 ],
                  loc: { start: [Object], end: [Object] },
                  type: 'BinaryExpression',
                  operator: '+',
                  left:{
                    range: [Object],loc: [Object],
                    type: 'Literal',
                    value: 'test',raw: '"test"'
                  },
                  right: {
                    range: [Object],
                    loc: [Object],
                    type: 'Identifier', name: 'a' }
                  },
                right:{
                  range: [ 21, 26 ],
                  loc: { start: [Object], end: [Object] },
                  type: 'Literal',
                  value: '.js',
                  raw: '".js"'
                }
              }
             */
            /** TODO, should check this unknow rule
            if (node.expression === 'require') {
              err = new Error('require not support variable');
              err.name = 'CUBE_EXCEPTION';
              throw err;
            }
            **/
            // get the right and the
            var theRight = args0.right;
            var theLeft = getTheLeftNode(args0);

            if (theLeft.type === syntax.Literal) {
              // 处理left前缀
              fixLeftPart(cube, root, filepath, theLeft, options.release, requiresMap, remote);
            }
            if (theRight.type === syntax.Literal) {
              // 处理right后缀，
              fixRightPart(cube, root, filepath, theRight, options.release, requiresMap);
            }
            // if binary, should return, because the require with var must be a async loading
            // so just return
            return;
          }

          v = args0.value;
          if (!v || typeof v !== 'string') {
            return;
          }
          if (!v.trim()) {
            return;
          }
          // node.args[0].vaule -> module
          var abspath;
          var abspathOrigin;
          var line = args0.loc.start.line - 1;
          var column = args0.loc.start.column;
          var offset = args0.range[1] - args0.range[0] - 2;
          try {
            // 物理文件地址
            abspathOrigin = resolvePath(cube, root, filepath, v);
            let ext = path.extname(abspathOrigin);
            let type = cube.processors.map[ext];
            abspath = utils.moduleName(abspathOrigin, type, options.release);
            debug('resolved path:', abspath, abspathOrigin);
          } catch (err) {
            err.message += ' at:' + filepath + ' line: ' + line;
            if (err.possiblePath) {
              console.log('the possible path is :', err.possiblePath);
              abspath = abspathOrigin = err.possiblePath;
            } else {
              console.log('the possible path is :', err.possiblePath);
              abspath = abspathOrigin = v;
            }
          }
          if (remote) {
            abspath = remote + ':' + abspath;
          }
          // if callee.name === load, ignore
          // only cache require path
          if (node.callee.name === 'require') {
            requires.push(abspath);
          }
          originalRequires.push(abspathOrigin);
          JsProcessor.saveRequire(filepath, abspathOrigin);

          if (!requiresMap[line]) {
            requiresMap[line] = [{col: column, offset: offset, name: abspath}];
          } else {
            requiresMap[line].push({col: column, offset: offset, name: abspath});
          }
          args0.value = abspath;
          // auto
          if (cube.getType(abspathOrigin) === 'style' && node.arguments.length === 1) {
            node.arguments[1] = {
              type: 'Literal',
              value: ''
            };
            requiresMap[line].push({col: column + offset + 1, offset: 0, name: ',""'});
          }
        }
      },
      leave: function (node) {
        if (/Function/.test(node.type)) {
          currentScope = currentScope.upper;  // set to parent scope
        }
      }
    });

    requires = unique(requires);

    debug('analyse requires ok');

    header = header.replace(/\$\$(\w+)\$\$/g, function (m0, m1) {
      switch (m1) {
        case 'filepath':
          var ext = path.extname(filepath);
          var type = cube.processors.map[ext];
          var p = utils.moduleName(filepath, type, options.relese);
          if (!options.relese && options.qpath) {
            p = options.qpath;
          }
          if (remote) {
            p = remote + ':' + p;
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
      requires: requires,
      originalRequires: originalRequires
    };
    if (options.compress) {
      var compressRes = genCode(filepath, ast, header + footer, true, options.sourceMap);
      returnObj.code = compressRes[0];
      returnObj.sourceMap = compressRes[1];
    } else {
      returnObj.code = genUncompressCode(
        header,
        transferRequire(code, requiresMap),
        footer,
        options.release
      );
    }
    returnObj.wraped = returnObj.code;
    callback(null, returnObj);
  }
};

module.exports = JsProcessor;
