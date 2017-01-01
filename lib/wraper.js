'use strict';

var utils = require('./utils');
var fs = require('fs');
var path = require('path');
var escope = require('escope');
var estraverse = require('estraverse');
var esminify = require('esminify');
var esprima = esminify.esprima;
var debug = require('debug')('cube:wraper');
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

/**
 * tryFiles 扫描文件
 *   根据给定的modPath, 识别出文件类型，默认是 script
 *   如果要加载style和template, require的时候必须带后缀
 *
 *   确定完类型之后，开始寻找存在的文件：
 *     比如请求的文件是  index.js, 实际文件可以是 fname.$possibleExts
 *     $possibleExts 就是类型下所有注册的可能的后缀名称
 *
 * @exceptions
 *
 * @return {String} or throw exception
 *
 */
function tryFiles(cube, root, modPath) {
  var origExt = path.extname(modPath);
  var fName = path.basename(modPath, origExt);
  var dir = path.dirname(modPath);
  var arr;
  var err;
  debug('tryFiles: %s, ext: %s', modPath, origExt);
  try {
    arr = fs.readdirSync(dir);
  } catch (e) {
    err = new Error('[ERROR] dir not found: `' + modPath.substr(root.length) + '`');
    err.code = 'DIR_NOT_FOUND';
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
    err.code = 'TRY_FILE_EXT_NO_PATCH';
    throw err;
  }
  var finalPath = path.join(dir, fName + targetExt);

  var finalStat;
  try {
    finalStat = fs.statSync(finalPath);
    if (!finalStat.isFile()) {
      err = new Error('[ERROR] required module is not File: `' + finalStat + '`');
      err.code = 'TRY_FILE_IS_NOT_FILE';
      throw err;
    }
  } catch (e) {
    err = new Error('[ERROR] required module not found: `' + modPath.substr(root.length) + '`');
    err.code = 'TRY_FILE_EXT_NO_PATCH';
    throw err;
  }
  debug('tryFiles: finally path >', finalPath);
  return finalPath;
}
/**
 * testModPath and return the relative real path
 * @param  {Path} modPath abs root, may be file, may be module dir
 * @return {Path}  relative path based on root
 */
function testModPath(cube, root, modPath, modName, moduleMap) {
  var tmpModPath;
  let stat;
  try {
    // test if dir
    try {
      stat = fs.statSync(modPath);
    } catch(e) {
      // DO NOTHING
    }
    try {
      debug('testModPath: try single-file first.', modPath);
      tmpModPath = tryFiles(cube, root, modPath);
    } catch (e) {
      if (stat && stat.isDirectory()) {
        // get module default enter
        try {
          let pkg = require(path.join(modPath, './package.json'));
          let alreadyFound = false;
          /**
           * first of all: moduleMap
           */
          // tmpModPath = cube.config.moduleMap && cube.config.moduleMap[modName];
          // if (cube.config.moduleMap && tmpModPath) {
          //   tmpModPath = path.join(modPath, cube.config.moduleMap[modName]);
          //   debug('testModPath: try moduleMap[', modName, ',', cube.config.moduleMap[modName],']');
          // }
          /**
           * then search for browserify config in package.json
           * "browserify": "d3.js"
           */
          if (moduleMap && moduleMap[modName]) {
            let tmp;
            try {
              tmp = fs.readlinkSync(modPath);
              modPath = path.join(path.dirname(modPath), tmp);
            } catch (e) {
              // do nothing
            }
            tmpModPath = path.join(modPath, moduleMap[modName]);
          }

          else if (pkg.browserify && typeof pkg.browserify === 'string') {
            tmpModPath = path.join(modPath, pkg.browserify);
            debug('testModPath: try package.json.browserify', tmpModPath);
          }
          /**
           * then search for browser config in package.json
           * "browser": "browser.js"
           */
          else if (pkg.browser && typeof pkg.browser === 'string') {
            tmpModPath = path.join(modPath, pkg.browser);
            debug('testModPath: try package.json.browser', tmpModPath);
          }
          /**
           * then search for pkg.main
           */
          else if (pkg.main && typeof pkg.main === 'string') {
            tmpModPath = path.join(modPath, pkg.main);
            debug('testModPath: try package.json.main ', tmpModPath);
            try {
              tmpModPath = tryFiles(cube, root, tmpModPath);
              alreadyFound = true;
            } catch (e) {
              /** if package.main like : ./lib, it means ./lib/index.js **/
              tmpModPath = path.join(tmpModPath, './index.js');
              debug('testModPath: try package.json.main / index.js ', tmpModPath);
            }
          } else {
            tmpModPath = path.join(modPath, './index.js');
            debug('testModPath: try module_dir/index.js', tmpModPath);
          }
          if (!alreadyFound) {
            tmpModPath = tryFiles(cube, root, tmpModPath);
          }
        } catch (e) {
          debug('testModPath: not found', e);
          // can not find module main enter, use index.js as default
          tmpModPath = path.join(modPath, 'index');
          debug('testModPath: try default module/index', tmpModPath);
          try {
            tmpModPath = tryFiles(cube, root, tmpModPath);
          } catch (e) {
            debug('testModPath: not found');
            throw e;
          }
        }
      }
    }
  } catch (e) {
    debug('testModPath: not found at last', modPath);
    throw e;
  }
  return tmpModPath.substr(root.length);
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
 * @param {Cube} cube    cube instance
 * @param {Path} root [description]
 * @param  {Path} base   the base file
 * @param  {String} moduleName
 * @return {[type]}        [description]
 */
function resolvePath(cube, root, base, module, moduleMap) {
  debug('start resolver path', root, base, module);
  var dir = path.dirname(base);
  var count = 0;
  var nodeModulePath;
  var p;
  /**
   * STATE
   * @type {Number}
   *       0 表示正常
   *       1 表示没找到
   *       2 表示被ignore了
   */
  var STATE = 0;
  // console.log('>>-- original path:', dir, base);
  // require a common module in node_modules, like "jquery", or "jquery/ajax"
  if (/^\w+:/.test(module)) {
    return [fixWinPath(module), STATE];
  } else if (/^@?\w+/.test(module)) {
    debug('module type: node_modules');
    while (dir) {
      count++;
      nodeModulePath = path.join(root, dir, '/node_modules/', module);
      if (cube.checkIgnore(nodeModulePath)) {
        console.error('[CUBE_WARN] required node_module ignored by .cubeignore config', module, nodeModulePath);
        p = module;
        // if not the root dir, find the parent node_modules
        if (!ifRootPath(dir)) {
          dir = path.dirname(dir);
          continue;
        } else {
          STATE = 2;
          break;
        }
      }
      try {
        p = testModPath(cube, root, nodeModulePath, module, moduleMap);
        debug('resolvePath: ok > ', p);
        break;
      } catch (e) {
        debug('node_module not found:', path.join(dir, '/node_modules/'));
        if (ifRootPath(dir)) {
          console.error('[CUBE_WARN] required node_module: `' + module + '` not found in file:', base);
          p = module;
          STATE = 1;
          break;
        }
        dir = path.dirname(dir);
      }
      if (count > 100) {
        debug('resolvePath error, seek node_modules 100 times, max retry, may be cycle required, exit');
        p = module;
        STATE = 1;
        break;
      }
    }
  } else {
    if (/^\//.test(module)) { // if abs path: like "/jquery"
      debug('module type: abs_module', module);
      p = path.join(root, module);
    } else {
      debug('module type: relative_module', module);
      p = path.join(root, dir, module);
    }
    try {
      p = testModPath(cube, root, p, module);
    } catch (e) {
      debug('resolvePath error, module not found', module);
      console.log('[CUBE_WARN] require path:', module, 'not found in file:', base);
      p = module;
      STATE = 1;
    }
  }

  return [fixWinPath(p), STATE];
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
  code = esminify.minify({
    ast: ast,
    cmd: true,
    strictMod: true
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
  var remote = config.remote;
  var scope;
  var currentScope;
  var debugInfo = [];
  var requiresRef = [];

  if (!filepath) {
    err = new Error('filepath needed!');
    err.code = 'PARAM_ERROR';
    throw err;
  }

  if (!data.wrap) {
    return data;
  }
  data.queryPath = utils.moduleName(data.queryPath, data.type, config.release, config.remote);

  debug('------------- process file:', data.queryPath);
  try {
    ast = esprima.parse(code, {
      loc: true,
      range: true
    });
  } catch (e) {
    e.code = 'Js_Parse_Error';
    e.file = filepath;
    e.line = e.lineNumber;
    throw e;
  }
  debug('parse ast ok', filepath);
  scope = escope.analyze(ast);
  currentScope = scope.acquire(ast);
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
          if (v.name === node.callee.name && v.defs.length) {
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
      var abspath;
      var abspathOrigin;
      var line = args0.loc.start.line - 1;
      var column = args0.loc.start.column;
      var offset = args0.range[1] - args0.range[0] - 2;
      var resolvedRes;
      v = cube.hook('beforeResolvePath', v);
      resolvedRes = (config.resolvePath || resolvePath)(cube, root, filepath, v, config.moduleMap);
      abspathOrigin = resolvedRes[0];
      var ext = path.extname(abspathOrigin);
      var type = cube.processors.map[ext];
      abspath = utils.moduleName(abspathOrigin, type, config.release);
      debug('origin:', v, 'absOrigin:', abspathOrigin, 'abs:', abspath);

      /*
      if (config.mangleFileName) {
        abspath = cube.getFileShortName(abspath, config.merge);
      }
      */
      if (remote) {
        abspath = remote + ':' + abspath;
      }
      // if callee.name === load, ignore
      // only cache require path
      if (node.callee.name === 'require') {
        if (config.forceRequire) {
          requires.push(abspath);
          originalRequires.push(abspathOrigin);
        } else {
          switch(resolvedRes[1]) {
            case 2:
              debugInfo.push('console.warn("[CUBE_WARN]' + filepath + ':", "module `' + abspath + '` is ignored by ignoreconfig");');
              break;
            case 1:
              debugInfo.push('console.error("[CUBE_ERROR]' + filepath + ':", "module `' + abspath + '` is not found!");');
              break;
            default:
              requires.push(abspath);
              originalRequires.push(abspathOrigin);
          }
        }
        requiresRef.push(args0);
      }
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
  data.debugInfo = debugInfo;
  data.requiresRef = requiresRef;
  return data;
};

exports.wrapScript = function (cube, result, callback) {
  var header = 'Cube("$$filepath$$", $$requires$$, function (module, exports, require, load, __dirname, __filename) {';
  var footer = '\nreturn module.exports;});';
  // var config = cube.config;
  var finalQpath = result.queryPath;
  var requires = result.requires;
  /*
  if (config.mangleFileName) {
    finalQpath = cube.getFileShortName(finalQpath, config.merge);
  }
  */
  result.queryPath = finalQpath;
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
      result.ast = esprima.parse(result.code, {filename: finalQpath});
    } catch (e) {
      return callback(e);
    }
  }
  var flagCompress = result.compress !== undefined ? result.compress : cube.config.compress;
  if (flagCompress) {
    if (!result.wrap) {
      result.code = compressedCode(finalQpath, result.ast);
    } else {
      var wraper = esprima.parse(header + footer, {filename: getFileName(finalQpath, '.source.$1')});
      var body = wraper.body[0].expression.arguments[2].body.body;
      wraper.body[0].expression.arguments[2].body.body = result.ast.body;
      result.ast.body.push(body[0]);
      var compressRes = compressedCode(finalQpath, wraper);
      result.codeWraped = compressRes[0];
    }
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

/**
 * 修复资源依赖路径，打包image 等等
 */
exports.processStyle = function (cube, result, callback) {
  var qpath = result.queryPath;
  var config = cube.config;
  result.queryPath = utils.moduleName(qpath, 'style', config.release, config.remote);
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
  var finalQpath = result.queryPath;
  // var config = cube.config;
  /*
  if (config.mangleFileName) {
    finalQpath = cube.getFileShortName(finalQpath, config.merge);
  }
  */
  function wraper(code) {
    return 'Cube("' + finalQpath +'", [], function(m){' +
    'm.exports=' + JSON.stringify(code) + ';return m.exports});';
  }
  result.queryPath = finalQpath;
  result.codeWraped = wraper(result.code);
  callback(null, result);
};

exports.wrapTemplate = function (cube, result, callback) {
  var qpath = result.queryPath;
  var code = result.code;
  var config = cube.config;
  var requires = result.requires || [];
  var finalQpath = utils.moduleName(qpath, 'template', config.release, config.remote);
  var wrapedCode = 'Cube("' + finalQpath +
    '",' + JSON.stringify(requires) + ',function(module,exports,require){' + code + '; return module.exports});';
  var flagCompress = result.compress !== undefined ? result.compress : config.compress;
  if (flagCompress) {
    result.codeWraped = compressedCode(qpath, wrapedCode);
  } else {
    result.codeWraped = wrapedCode;
  }
  result.queryPath = finalQpath;
  callback(null, result);
};
