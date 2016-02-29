'use strict';

var utils = require('./utils');
var fs = require('fs');
var path = require('path');
var esprima = require('esprima');
var esmangle = require('esmangle2');
var escope = require('escope');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var debug = require('debug');
var Css = require('clean-css');
var syntax = esprima.Syntax;

/**
 * transfer filename: the ext part
 */
function getFileName(filepath, ext) {
  var filename = path.basename(filepath);
  if (ext) {
    filename = filename.replace(/\.(\w+)$/, ext);
  }
  return filename;
}

function unique(arr) {
  var map = {};
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
  var flag = false;
  if (v.raw) {
    v = v.raw;
    flag = true;
  }
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
  if (flag) {
    node.value.raw = tmp;
    node.value.cooked = tmp;
  } else {
    node.value = tmp;
  }

  fillMap(node, tmp, map);
}
/**
 * fix the right part, change the suffix
 * @return {String}
 */
function fixRightPart(cube, root, filepath, node, release, map) {
  var value = node.value;
  var flag = false;
  if (value.raw) {
    value = value.raw;
    flag = true;
  }
  var sufix = value.match(/\.\w+$/);
  var tmp, type;
  if (!sufix) {
    tmp = value + '.js';
  } else {
    sufix = sufix[0];
    type = cube.processors.map[sufix];
    if (!type) {
      tmp = value + '.js';
    } else {
      tmp = utils.moduleName(value, type, release);
    }
  }
  tmp = fixWinPath(tmp);
  if (flag) {
    node.value.raw = tmp;
    node.value.cooked = tmp;
  } else {
    node.value = tmp;
  }
  fillMap(node, tmp, map);
}

function genUncompressCode(head, code, foot, release) {
  if (release) {
    return head + '\n' + code + '\n' + foot;
  } else {
    return head + code + foot;
  }
}

function compressedCode(qpath, ast) {
  var code;
  //merge wraper
  if (typeof ast === 'string') {
    ast = esprima.parse(ast, {filename: qpath});
  }
  // optimized the AST
  ast = esmangle.optimize(ast, null);
  // mangled the AST
  ast = esmangle.mangle(ast);
  // finally gen the code
  code = escodegen.generate(ast, {
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
  return [code];
}

exports.processScript = function (cube, data) {
  var filepath = data.queryPath;
  var config = cube.config;
  var code = data.code || '';
  var err;
  var ast;
  var root = config.root;
  var requires = [];
  var requiresMap = {};
  var originalRequires = [];
  // 标记require的statement 是否出现在顶级作用域, 用来寻找断开循环依赖的根据
  // var requiresGlobalScopeMap = {};
  var remote = config.remote;
  var scope;
  var rootScope;
  var currentScope;

  if (!filepath) {
    err = new Error('filepath needed!');
    err.code = 'PARAM_ERROR';
    throw err;
  }

  try {
    ast = esprima.parse(code, {
      loc: true,
      range: true
    });
  } catch (e) {
    e.code = 'Js_Parse_Error';
    e.file = filepath;
    e.message = 'File:' + filepath + ', index: ' + e.index + ', ' + e.code + ' ' + e.message;
    throw e;
  }
  debug('parse ast ok', filepath);
  scope = escope.analyze(ast);
  rootScope = currentScope = scope.acquire(ast);
  //////////////////// walker start //////////////////////
  estraverse.traverse(ast, {
    enter: function (node) {
      if (
        node.type === syntax.FunctionExpression ||
        node.type === syntax.FunctionDeclaration ||
        node.type === syntax.WithStatement ||
        node.type === syntax.ArrowFunctionExpression
      ) {
        currentScope = scope.acquire(node) || currentScope;
      }
      if (node.type !== syntax.CallExpression) {
        return;
      }
      // filter other property calls, like `require[test]();`, `require.resolve()`
      if (node.callee.type !== syntax.Identifier) {
        return;
      }
      // filter other calls
      if (node.callee.name !== 'require' && node.callee.name !== 'load') {
        return;
      }

      // check if require() or load() is already defined in current scope
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
      var theRight;
      var theLeft;
      var flagRequireWithVar = false;
      // check if Binary express, like `load('./abc' + vars + '.js');`
      if (args0.type === syntax.BinaryExpression) {
        flagRequireWithVar = true;
        // get the right and the
        theRight = args0.right;
        theLeft = getTheLeftNode(args0);

        if (theLeft.type === syntax.Literal) {
          // 处理left前缀
          fixLeftPart(cube, root, filepath, theLeft, config.release, requiresMap, remote);
        }
        if (theRight.type === syntax.Literal) {
          // 处理right后缀，
          fixRightPart(cube, root, filepath, theRight, config.release, requiresMap);
        }
      } else if (args0.type === syntax.TemplateLiteral) {
        theLeft = args0.quasis[0];
        theRight = args0.quasis[args0.quasis.length - 1];
        if (theLeft.value.raw) {
          fixLeftPart(cube, root, filepath, theLeft, config.release, requiresMap, remote);
        }
        if (theRight.value.raw) {
          fixRightPart(cube, root, filepath, theRight, config.release, requiresMap);
        }
        flagRequireWithVar = true;
      }
      if (flagRequireWithVar && node.expression === 'require') {
        // if binary, should return, because the require with var must be a async loading
        err = new Error('require not support variable, please using load() instead');
        err.file = filepath;
        err.line = node.start.line;
        err.column = node.start.column;
        err.code = 'CUBE_EXCEPTION';
        throw err;
        // return estraverse.VisitorOption.BREAK;
      }

      if (args0.type === syntax.Literal) {
        v = args0.value;
      } else if (args0.type === syntax.TemplateLiteral) {
        v = args0.quasis[0].value.raw;
      }
      v = args0.value;
      if (!v || typeof v !== 'string') {
        return;
      }
      if (!v.trim()) {
        return;
      }
      var flagGlobalRequire = rootScope === currentScope;
      var abspath;
      var abspathOrigin;
      var line = args0.loc.start.line - 1;
      var column = args0.loc.start.column;
      var offset = args0.range[1] - args0.range[0] - 2;
      try {
        // 物理文件地址
        abspathOrigin = resolvePath(cube, root, filepath, v);
        var ext = path.extname(abspathOrigin);
        var type = cube.processors.map[ext];
        abspath = utils.moduleName(abspathOrigin, type, config.release);
        debug('resolved path:', abspath, abspathOrigin);
      } catch (err) {
        err.file = filepath;
        err.line = line;
        if (err.possiblePath) {
          console.log('the possible path is :', err.possiblePath);
          abspath = abspathOrigin = err.possiblePath;
        } else {
          console.log('the possible path is not found');
          throw err;
        }
      }
      if (remote) {
        abspath = remote + ':' + abspath;
      }
      if (config.mangleFileName) {
        abspath = cube.getFileShortName(abspath);
      }
      // if callee.name === load, ignore
      // only cache require path
      if (node.callee.name === 'require') {
        requires.push(abspath);
        // requiresGlobalScopeMap[abspath] = flagGlobalRequire;
      }
      originalRequires.push(abspathOrigin);
      // JsProcessor.saveRequire(filepath, abspathOrigin);

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
    },
    leave: function (node) {
      if (/Function/.test(node.type)) {
        currentScope = currentScope.upper;  // set to parent scope
      }
    }
  });
  requires = unique(requires);
  debug('file require list', requires);

  data.requires = requires;
  data.requiresOrigin = originalRequires;
  // data.requiresGlobalScopeMap = requiresGlobalScopeMap;
  data.code = transferRequire(code, requiresMap);
  data.ast = ast;
  return data;
};

exports.wrapScript = function (cube, result, callback) {
  var header = 'Cube("$$filepath$$", $$requires$$, function (module, exports, require, load, __dirname, __filename) {';
  var footer = '\nreturn module.exports;});';
  var config = cube.config;
  var qpath = result.queryPath;
  var requires = result.requires;
  var finalQpath = utils.moduleName(qpath, 'script', cube.config.relese, cube.config.relese);
  if (config.remote) {
    finalQpath = config.remote + ':' + finalQpath;
  }
  if (config.mangleFileName) {
    finalQpath = cube.getFileShortName(finalQpath);
  }
  header = header.replace(/\$\$(\w+)\$\$/g, function (m0, m1) {
    switch (m1) {
      case 'filepath':
        return finalQpath;
      case 'requires':
        return JSON.stringify(requires);
      default:
        return m1;
    }
  });
  if (!result.ast) {
    try {
      result.ast = esprima.parse(result.code, {filename: qpath});
    } catch (e) {
      return callback(e);
    }
  }
  var flagCompress = result.compress !== undefined ? result.compress : cube.config.compress;
  if (flagCompress) {
    result.code = compressedCode(qpath, result.ast);
    var wraper = esprima.parse(header + footer, {filename: getFileName(qpath, '.source.$1')});
    var body = wraper.body[0].expression.arguments[2].body.body;
    wraper.body[0].expression.arguments[2].body.body = result.ast.body;
    result.ast.body.push(body[0]);
    var compressRes = compressedCode(qpath, wraper);
    result.codeWraped = compressRes[0];
  } else {
    result.codeWraped = genUncompressCode(
      header,
      result.code,
      footer,
      cube.config.release
    );
  }
  callback(null, result);
};

var cssProcess = new Css({
  compatibility: true,
  noAdvanced: true,
  keepSpecialComments: 0,
  processImport: false
});
exports.processCssCode = function (cube, result, callback) {
  var qpath = result.queryPath;
  result.code = cube.fixupResPath(path.dirname(qpath), result.code);
  var flagCompress = result.compress !== undefined ? result.compress : cube.config.compress;
  if (flagCompress) {
    cssProcess.minify(result.code, function (err, minified) {
      if (err) {
        var error = new Error('[CUBE] minify css error ');
        error.file = qpath;
        error.message += err.message;
        return callback(error);
      }
      result.code = minified.styles;
      callback(null, result);
    });
  } else {
    callback(null, result);
  }
};

exports.wrapStyle = function (cube, result, callback) {
  var qpath = result.queryPath;
  var finalQpath = utils.moduleName(qpath, 'style', cube.config.release, cube.config.remote);

  function wraper(code) {
    return 'Cube("' + finalQpath +'", [], function(m){' +
    'm.exports=' + JSON.stringify(code) + ';return m.exports});';
  }
  result.codeWraped = wraper(result.code);
  callback(null, result);
};

exports.wrapTemplate = function (cube, result, callback) {
  var qpath = result.queryPath;
  var code = result.code;
  var requires = result.requires || [];
  var wrapedCode = 'Cube("' + utils.moduleName(qpath, 'template', cube.config.release, cube.config.remote) +
    '",' + JSON.stringify(requires) + ',function(module,exports,require){' + code + '; return module.exports});';
  var flagCompress = result.compress !== undefined ? result.compress : cube.config.compress;
  if (flagCompress) {
    result.codeWraped = compressedCode(qpath, wrapedCode);
  } else {
    result.codeWraped = wrapedCode;
  }
  callback(null, result);
};
