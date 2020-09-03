'use strict';
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const babylon = require('babylon');
const babelType = require('babel-types');
const babelTraverse = require('babel-traverse').default;
const babelGenerator = require('babel-generator').default;
const esminify = require('esminify');
const uuid = require('uuid');
const debug = require('debug')('cube:wraper');
const utils = require('../utils');

/**
 * transfer filename: the ext part
 */
function getFileName(filepath, ext) {
  // make sure filepath to be a string;
  // when mangle-file-name, filepath could be a number
  var filename = path.basename(filepath + '');
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
 * 先用 tryFilesBaisc 扫描，假如没找到，再试下默认后缀的识别方法
 * 
 * eg. xxx.glsl => 找不到
 *     xxx.glsl.js => 找到
 *
 * @exceptions
 *
 * @return {String} or throw exception
 *
 */
function tryFiles(cube, root, modPath) {
  try {
    // 按原始后缀找一次
    return tryFilesBaisc(cube, root, modPath, path.extname(modPath));
  } catch (e) {
    // 兜底用默认后缀找一次
    return tryFilesBaisc(cube, root, modPath, '');
  }
}

/**
 * tryFilesBaisc 扫描文件
 * 根据给定的modPath, 识别出文件类型，默认是 script
 *   如果要加载style和template, require的时候必须带后缀
 *
 *   确定完类型之后，开始寻找存在的文件：
 *     比如请求的文件是  index.js, 实际文件可以是 fname.$possibleExts
 *     $possibleExts 就是类型下所有注册的可能的后缀名称
 */
function tryFilesBaisc(cube, root, modPath, origExt) {
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
  var type = cube.extMap[origExt || '.js'];
  if (!type) {
    // may be filename like `require('./abc.dot')`
    // if unknow type, switch to script type
    type = 'script';
    fName = path.basename(modPath);
  }
  var possibleExts = Object.keys(cube.processors[type]);
  var targetExt = utils.getPossibleExt(cube, arr, fName, origExt, possibleExts);
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
 * 
 * 要注意 browser module main 的关系：https://github.com/SunshowerC/blog/issues/8
 * 
 * @param {Path} modPath abs root, may be file, may be module dir
 * @param {String} modName  在require中书写的模块名
 * @param {String} modRootPath 在require中书写的模块名的根节点，即 package.json 的所在位置
 * @return {Path}  relative path based on root
 */
function testModPath(cube, modPath, modName, modRootPath) {
  let tmpModPath;
  let stat;
  let root = cube.config.root;
  try {
    // test if dir
    try {
      stat = fs.statSync(modPath);
    } catch(e) {
      // DO NOTHING
    }
    // 文件夹和文件的处理趋于一致
    tmpModPath = testModPathBaisc(cube, modPath, modName, modRootPath, stat && stat.isDirectory());
  } catch (e) {
    debug('testModPath: not found at last', modPath);
    throw e;
  }
  return tmpModPath.substr(root.length);
}

/**
 * 文件处理：
 * 找到包目录下 package.json，按 moduleMap => browserify => broswer => modPath => modPath/index.js 
 *  
 * 文件夹处理：
 * 1. 找当前目录有没有 package.json，没有的话找包目录下 package.json
 * 2. 按 moduleMap => browserify => broswer => main => modPath => modPath/index.js 
 */
function testModPathBaisc(cube, modPath, modName, modRootPath, isDirectory) {
  let root = cube.config.root;
  let moduleMap = cube.config.moduleMap;
  let tmpModPath;
  try {
    let pkg;
    let isRoot = false;
    // 获取 package.json
    if (isDirectory) {
      // 看看当前目录有没有 package.json, 优先级会更高
      isRoot = modPath === modRootPath;
      try {
        pkg = require(path.join(modPath, './package.json'));
      } catch(e) {} // DO NOTHING
    }
    // 假如没有，不论文件夹还是文件都再次找一下包根目录有没有 package.json
    if (!pkg) {
      try {
        pkg = require(path.join(modRootPath, './package.json'));
      } catch (e) {}  // DO NOTHING
    }

    let alreadyFound = false;
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

    /**
     * "browserify": "browserify.js"
     */
    else if (pkg && pkg.browserify && typeof pkg.browserify === 'string') {
      tmpModPath = path.join(modPath, pkg.browserify);
      debug('testModPath: try package.json.browserify', tmpModPath);
    }

    /**
     * then search for browser config in package.json
     * "browser": "browser.js"
     */
    else if (pkg && pkg.browser && typeof pkg.browser === 'string') {
      tmpModPath = path.join(modPath, pkg.browser);
      debug('testModPath: try package.json.browser', tmpModPath);
    }

    /**
     * "browser": {
     *    "./aaa/aaa.js": "./aaa/dist/aaa.js"
     * }
     */
    else if (pkg && pkg.browser && typeof pkg.browser === 'object' && !!exist(pkg.browser, modRootPath, modPath)) {
      tmpModPath = exist(pkg.browser, modRootPath, modPath);
      debug('testModPath: try package.json.browser', tmpModPath);
    }
    /**
     * then search for pkg.main
     */
    else if (pkg && isRoot && pkg.main && typeof pkg.main === 'string') {
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
      try {
        tmpModPath = tryFiles(cube, root, modPath);
        alreadyFound = true;
      } catch(e) {
        tmpModPath = path.join(modPath, './index.js');
        debug('testModPath: try module_dir/index.js', tmpModPath);
      }
    }

    if (!alreadyFound) {
      tmpModPath = tryFiles(cube, root, tmpModPath);
    }
  } catch(e) {
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
  return tmpModPath;
}

function exist(searchObj, root, mod) {
  const searchArr = Object.keys(searchObj);
  let existPath;

  for (let i =0; i < searchArr.length; i++) {
    if (path.resolve(root, searchArr[i]) === mod) {
      // browser 被置为了 false, 需要忽略，这边造一个伪文件
      if (!searchObj[searchArr[i]]) {
        const id = `./${uuid.v4()}.js`;
        searchObj[searchArr[i]] = id;
        fs.writeFileSync(path.join(root, id), 'module.exports = {};');
      }
      existPath = path.resolve(root, searchObj[searchArr[i]]);
      break;
    }
  }
  return existPath;
}

function ifRootPath(path) {
  return path === '/' || path === '\\';
}

/*
function sortMap(arr) {
  arr.sort(function (a, b) {
    return a.col - b.col;
  });
}
*/
/**
 * update require path for dev model
 * @param  {String} code        [description]
 * @param  {Object} requiresMap [description]
 * @return {String}             [description]
 */
/*
function transferRequire(code, requiresMap) {
  var arr = code.split(/\r?\n/);
  var tmp, line, res, offset, i;
  for (i in requiresMap) {
    res = [];
    offset = 0;
    tmp = requiresMap[i];
    sortMap(tmp);
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
*/

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
/*
function fillMap(node, tarv, map) {
  var col = node.loc.start.column;
  var offset = node.end - node.start - 2; // 前后引号
  var line = node.loc.start.line - 1;
  if (!map[line]) {
    map[line] = [{col: col, offset: offset, name: tarv}];
  } else {
    map[line].push({col: col, offset: offset, name: tarv});
  }
}
*/
/**
 * fix the left part, from relpath to abspath
 * @param  {String} str
 * @return {String}
 */
function fixLeftPart(cube, root, filepath, node, release, /*map,*/ remote) {
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
        //throw new Error('max try in fixLeftPart()');
        cube.log.error('max try in fixLeftPart()');
        return ;// 打包过程中遇到不必要的文件使用 require('a'+b) 的语法导致打包中断，故忽略
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
  tmp = utils.fixWinPath(tmp);
  if (remote) {
    tmp = remote + ':' + tmp;
  }
  if (flag) {
    node.value.raw = tmp;
    node.value.cooked = tmp;
  } else {
    node.value = tmp;
  }

  // fillMap(node, tmp, map);
}
/**
 * fix the right part, change the suffix
 * @return {String}
 */
function fixRightPart(cube, root, filepath, node, release/*, map*/) {
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
    type = cube.extMap[sufix];
    if (!type) {
      tmp = value + '.js';
    } else {
      tmp = utils.moduleName(value, type, release);
    }
  }
  tmp = utils.fixWinPath(tmp);
  if (flag) {
    node.value.raw = tmp;
    node.value.cooked = tmp;
  } else {
    node.value = tmp;
  }
  // fillMap(node, tmp, map);
}

function fixAst(ast) {
  let body = ast.program.body;
  ast.program.body = [];
  let newAst = JSON.parse(JSON.stringify(ast));
  newAst.program.body = body;
  return newAst;
}
function genCode(cube, qpath, ast, compress) {
  if (compress) {
    let minifyOpt = cube.config.minify;
    let opt = {};
    if (typeof ast === 'string') {
      opt.code = ast;
    } else {
      /*
       目前babel 6 版本的 遍历功能看起来对ast有污染，无法做到ast复用去minify
       所以需要fix一次ast
       */
      opt.ast = fixAst(ast);
    }
    opt.config = minifyOpt;
    return esminify.minify(opt);
  } else {
    if (typeof ast === 'string') {
      return ast;
    }
    let out = babelGenerator(ast, {
      retainLines: true,
      filename: qpath,
      quotes: 'single'
    });
    return out.code;
  }
}


module.exports = {
  /**
   *
   * @param {Path} base   the base file
   * @param {String} curModule 当前模块
   * @param {String} module require的module name
   * @param {Function} callback(err, data)
   */
  resolveModulePath(data, module, callback) {
    let curModule = data.queryPath;
    let root = this.config.root;
    let dir = path.dirname(curModule);
    let count = 0;
    let nodeModulePath;
    let moduleRootPath;
    let p;
    debug(`${curModule} resolve path: "${module}" in root: "${root}"`);
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
      return callback(null, {
        path: utils.fixWinPath(module),
        code: STATE
      });
    } else if (/^@?\w+/.test(module)) {
      debug('module type: node_modules');
      var modName = module[0] === '@' ? module.split('/').slice(0, 2).join('/') : module.split('/')[0];
      while (dir) {
        count++;
        nodeModulePath = path.join(root, dir, '/node_modules/', module);
        moduleRootPath = path.join(root, dir, '/node_modules/', modName);
        let ignore = this.checkIgnore(nodeModulePath.substr(root.length));
        if (ignore.ignore) {
          this.log.warn(`"${module}" which required by "${curModule}" is ignored by .cubeignore config`);
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
          p = testModPath(this, nodeModulePath, module, moduleRootPath);
          debug('resolvePath: ok > ', p);
          break;
        } catch (e) {
          debug('node_module not found:', path.join(dir, '/node_modules/'));
          if (ifRootPath(dir)) {
            this.log.error(`required node_module: "${module}" not found in file: ${curModule}`);
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
      } else { // if relative path :  ./xxx
        debug('module type: relative_module', module);
        p = path.join(root, dir, module);
      }
      try {
        p = testModPath(this, p, module, root);
      } catch (e) {
        debug('resolvePath error, module not found', module);
        this.log.warn(`required path:'${module}' not found in file: ${curModule}`);
        p = module;
        STATE = 1;
      }
    }
    callback(null, {
      path: utils.fixWinPath(p),
      code: STATE
    });
  },
  processScript(data, callback) {
    var self = this;
    var filepath = data.queryPath;
    var config = self.config;
    var code = data.code || '';
    var err;
    var ast;
    var root = config.root;
    var requires = [];
    var loads = [];
    var originalLoads = [];
    // var requiresMap = {};
    var originalRequires = [];
    var remote = config.remote;
    var debugInfo = [];
    var requiresArgsRefer = [];

    if (!filepath) {
      err = new Error('filepath needed!');
      err.code = 'PARAM_ERROR';
      return callback(err);
    }
    /**
     * wrap的设置，更多的意思是说，是否需要分析代码寻找require
     * 有些代码是直接页面引用的，无需分析
     *
     * 但是跳过cubeWrap的设置，使用的是 cubeWrap: false
     * 这在allInOne merge的时候用到
     */
    if (data.skip) {
      return callback(null, data);
    }
    if (data.noAstParse) {
      /** load 列表 */
      data.loads = [];
      data.originalLoads = [];
      /** require 列表 */
      data.requires = [];
      data.requiresOrigin = [];
      return callback(null, data);
    }

    try {
      ast = babylon.parse(code, {
        // sourceType: 'module',
        filename: filepath
      });
    } catch (e) {
      e.code = 'Js_Parse_Error';
      e.file = filepath;
      e.line = e.lineNumber;
      return callback(e);
    }
    debug('parse ast ok', filepath);
    let wait = 0;
    let traverseFlag = false;
    //////////////////// walker start //////////////////////
    babelTraverse(ast, {
      CallExpression: {
        enter: function (nodePath) {
          let node = nodePath.node;
          let scope = nodePath.scope;
          // filter other property calls, like `require[test]();`, `require.resolve()`
          if (!babelType.isIdentifier(node.callee)) {
            return;
          }

          let callFuncName = node.callee.name;
          // filter other calls
          if (callFuncName !== 'require' && callFuncName !== 'load') {
            return;
          }

          let methodOverride = false;
          let module;  // 在require中被引用的module
          // scope.local
          let currentScope = scope;
          while (currentScope) {
            let scopeVars = currentScope.bindings;
            for (let i in scopeVars) {
              if (scopeVars[i].identifier.name === node.callee.name) {
                methodOverride = true;
                break;
              }
            }
            if (methodOverride) {
              break;
            }
            currentScope = currentScope.parent;
          }

          if (methodOverride) {
            debug('require is override');
            return;
          }
          // if require no arguments, return
          if (!node.arguments.length || node.arguments.length > 3) {
            return;
          }

          debug(`function call "${callFuncName}" is found:`, node.arguments[0].value);

          let args0 = node.arguments[0];
          let theRight;
          let theLeft;
          let flagRequireWithVar = false;
          // check if Binary express, like `load('./abc' + vars + '.js');`
          if (babelType.isBinaryExpression(args0)) {
            flagRequireWithVar = true;
            // get the right and the
            theRight = args0.right;
            theLeft = getTheLeftNode(args0);

            if (babelType.isStringLiteral(theLeft)) {
              // 处理left前缀
              fixLeftPart(self, root, filepath, theLeft, config.release/*, requiresMap*/, remote);
            }
            if (babelType.isStringLiteral(theRight)) {
              // 处理right后缀，
              fixRightPart(self, root, filepath, theRight, config.release/*, requiresMap*/);
            }
          } else if (babelType.isTemplateLiteral(args0)) {
            flagRequireWithVar = true;
            theLeft = args0.quasis[0];
            theRight = args0.quasis[args0.quasis.length - 1];
            if (theLeft.value.raw) {
              fixLeftPart(self, root, filepath, theLeft, config.release/*, requiresMap*/, remote);
            }
            if (theRight.value.raw) {
              fixRightPart(self, root, filepath, theRight, config.release/*, requiresMap*/);
            }
          }
          if (flagRequireWithVar && callFuncName === 'require') {
            // if binary, should return, because the require with var must be a async loading
            // err = new Error('require not support variable, please using load() instead');
            // err.file = filepath;
            // err.line = node.loc.start.line;
            // err.column = node.loc.start.column;
            // err.code = 'CUBE_EXCEPTION';
            return nodePath.stop();
          }

          if (babelType.isStringLiteral(args0)) {
            module = args0.value;
          } else if (babelType.isTemplateLiteral(args0)) {
            module = args0.quasis[0].value.raw;
          }
          /**
           * 如果
           *   requre参数不存在 ||
           *   require的不是一个模块的字符串名字（可能是个变量）||
           *   require了一个空字符串
           * 则忽略
           */
          if (!module || !module.trim()) {
            return;
          }

          if(config.moduleIgnore && config.moduleIgnore[module]) {
            return;
          }

          // 处理 moduleMap 映射
          if (config.moduleMap && config.moduleMap[module]) {
            let mapd = config.moduleMap[module];
            module = path.join(module, mapd);
          }
          /*
          let line = args0.loc.start.line - 1;
          let column = args0.loc.start.column;
          let offset = args0.loc.end.column - args0.loc.start.column - 2;
          */
          wait++;
          self.resolveModulePath(data, module, function (err, resolveResult) {
            wait --;
            if (err) {
              return done(err);
            }
            let abspath;
            let abspathOrigin;
            abspathOrigin = resolveResult.path;
            let ext = path.extname(abspathOrigin);
            let type = self.extMap[ext];
            // 名字转换，如果是release状态，需要将名字做转换, 类似: .less -> .less.js
            abspath = utils.moduleName(abspathOrigin, type, config.release);
            debug('module path resolved', data.queryPath,  'origin:', module, 'absOrigin:', abspathOrigin, 'abs:', abspath);

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
                switch(resolveResult.code) {
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
            } else {
              loads.push(abspath);
              originalLoads.push(abspathOrigin);
            }
            /*
            if (!requiresMap[line]) {
              requiresMap[line] = [{col: column, offset: offset, name: abspath}];
            } else {
              requiresMap[line].push({col: column, offset: offset, name: abspath});
            }
            */
            args0.value = abspath;
            // auto
            if (self.getType(abspathOrigin) === 'style' && node.arguments.length === 1) {
              node.arguments[1] = {
                type: 'StringLiteral',
                value: ''
              };
              // requiresMap[line].push({col: column + offset + 1, offset: 0, name: ',""'});
            }
            requiresArgsRefer.push(args0);
            done(err);
          });
        },
        exit: function () {}
      }
    });

    if (err) {
      return callback(err);
    }
    traverseFlag = true;
    let callbackFlag = false;
    function done(err) {
      if (!traverseFlag) {
        return;
      }
      if (wait > 0) {
        return;
      }
      if (callbackFlag) {
        return;
      }
      callbackFlag = true;
      if (err) {
        return callback(err);
      }

      // resolve module path 执行之前，不得修改 queryPath, 所以移动到最后变换
      data.queryPath = utils.moduleName(data.queryPath, data.type, config.release, config.remote);

      requires = unique(requires);
      originalRequires = unique(originalRequires);
      debug('module path resolved file require list', data.queryPath, requires);
      /** load 列表 */
      data.loads = loads;
      data.originalLoads = originalLoads;
      /** require 列表 */
      data.requires = requires;
      data.requiresOrigin = originalRequires;
      // data.requiresGlobalScopeMap = requiresGlobalScopeMap;
      // data.code = transferRequire(code, requiresMap);
      data.ast = ast;
      data.debugInfo = debugInfo;
      data.requiresArgsRefer = requiresArgsRefer;
      callback(null, data);
    }
    done();
  },
  processStyle(data, callback) {
    var qpath = data.queryPath;
    var config = this.config;
    data.queryPath = utils.moduleName(qpath, 'style', config.release, config.remote);
    var flagCompress = data.compress !== undefined ? data.compress : this.config.compress;
    if (flagCompress) {
      let input = {};
      input[data.absPath] = {
        styles: data.code
      };
      this.cssMinify.minify(input,  (err, minified) => {
        if (err) {
          var error = new Error('[CUBE] minify css error');
          error.file = qpath;
          error.message += err.join('; ');
          return callback(error);
        }
        // data.code = minified.styles;
        data.code = this.fixStyleAbsPath(path.dirname(qpath), minified.styles);
        callback(null, data);
      });
    } else {
      data.code = this.fixStyleResPath(path.dirname(qpath), data.code);
      callback(null, data);
    }
  },
  processTemplate(data, callback) {
    this.processScript(data, callback);
  },
  wrapScript(data, callback) {
    var header = 'Cube($$filepath$$, $$requires$$, function (module, exports, require, load, process, global) {';
    var footer = '\nreturn module.exports;});';
    // var config = cube.config;
    var finalQpath = data.queryPath;
    var requires = data.requires;

    // data.queryPath = finalQpath;
    header = header.replace(/\$\$(\w+)\$\$/g, function (m0, m1) {
      switch (m1) {
        case 'filepath':
          return JSON.stringify(finalQpath);
        case 'requires':
          return JSON.stringify(requires);
        default:
          return m1;
      }
    });
    if (data.noAstParse) {
      data.codeWraped = header + '\n' + data.code + footer;
      return callback(null, data); 
    }
    if (!data.ast) {
      try {
        data.ast = babylon.parse(data.code, {
          filename: finalQpath,
          // sourceType: 'module'
        });
      } catch (e) {
        return callback(e);
      }
    }
    let flagCompress = data.compress !== undefined ? data.compress : this.config.compress;

    if (data.ignoreCubeWrap) {
      data.codeWraped = genCode(this, finalQpath, data.ast, flagCompress);
      debug('wrapScript done, ignoreCubeWrap = true');
      callback(null, data);
    } else {
      let wraper = babylon.parse(header + footer, {
        filename: getFileName(finalQpath, '.source.$1'),
        // sourceType: 'module'
      });
      let body = wraper.program.body[0].expression.arguments[2].body.body;
      wraper.program.body[0].expression.arguments[2].body.body = data.ast.program.body;
      data.ast.program.body.push(body[0]);
      data.codeWraped = genCode(this, finalQpath, wraper, flagCompress);
      debug('wrapScript done');
      callback(null, data);
    }
  },
  wrapStyle(data, callback) {
    var finalQpath = data.queryPath;
    function wraper(code) {
      return 'Cube(' + JSON.stringify(finalQpath) +', [], function(m){' +
      'm.exports=' + JSON.stringify(code) + ';return m.exports});';
    }
    data.queryPath = finalQpath;
    data.codeWraped = wraper(data.code);
    callback(null, data);
  },
  wrapTemplate(data, callback) {
    let qpath = data.queryPath;
    let code = data.code;
    let config = this.config;
    let requires = data.requires || [];
    let finalQpath = utils.moduleName(qpath, 'template', config.release, config.remote);
    let wrapedCode = 'Cube(' + JSON.stringify(finalQpath) +
      ',' + JSON.stringify(requires) + ',function(module,exports,require, load, process, global){' + code + '; return module.exports});';
    let flagCompress = data.compress !== undefined ? data.compress : config.compress;

    data.codeWraped = genCode(this, qpath, wrapedCode, flagCompress);

    data.queryPath = finalQpath;
    callback(null, data);
  }
};
