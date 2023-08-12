'use strict';
const fs = require('fs');
const path = require('path');
const debug = require('debug')('cube:wraper');
// const CubeTransformSolidPlugin = require('cube-solid-js');
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
  var type = cube.extMap[origExt || '.js'];
  if (!type) {
    // may be filename like `require('./abc.dot')`
    // if unknow type, switch to script type
    type = 'script';
    fName = path.basename(modPath);
  }
  var possibleExts = cube.typeMap[type];
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
 * @param {Path} modPath abs root, may be file, may be module dir
 * @param {String} modName  在require中书写的模块名
 * @return {Path}  relative path based on root
 */
function testModPath(cube, modPath, modName) {
  let tmpModPath;
  let stat;
  let root = cube.config.root;
  let moduleMap = cube.config.moduleMap;
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
          debug('testModPath: not found', e.message);
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
  return path === '/' || path === '\\';
}


module.exports = {
  /**
   * 模块寻址
   * @param {Data} data   the base file
   * @param {String} module require的module name
   * @return {path, code}
   */
  resolveModulePath(data, module) {
    let curModule = data.queryPath;
    let root = this.config.root;
    let dir = path.dirname(curModule);
    let nodeModulePath;
    let p;
    let moduleMap = this.config.moduleMap;
    debug(`${curModule} resolve path: "${module}" in root: "${root}"`);

    if (/^\w+:/.test(module)) {
      debug('module type: remote module');
      // remote module
      return {
        modName: utils.fixWinPath(module)
      };
    } else if (/^@?\w+/.test(module)) {
      debug('module type: node_modules');
      let count = 0;
      if (moduleMap[module]) {
        module = path.join(module, moduleMap[module])
      }
      while (dir) {
        count++;
        nodeModulePath = path.join(root, dir, '/node_modules/', module);
        let ignore = this.checkIgnore(nodeModulePath.substr(root.length));
        if (ignore.ignore) {
          this.log.warn(`"${module}" which required by "${curModule}" is ignored by .cubeignore config`);
          p = module;
          // if not the root dir, find the parent node_modules
          if (!ifRootPath(dir)) {
            dir = path.dirname(dir);
            continue;
          } else {
            return {
              modName: '',
              error: `module "${module}" ignored`
            };
          }
        }
        try {
          p = testModPath(this, nodeModulePath, module);
          debug('resolvePath: ok > ', p);
          break;
        } catch (e) {
          debug('node_module not found:', path.join(dir, '/node_modules/'));
          if (ifRootPath(dir)) {
            return {
              modName: '',
              error: `required node_module: "${module}" not found in file: ${curModule}`
            };
          }
          dir = path.dirname(dir);
        }
        if (count > 1024) {
          debug('resolvePath error, seek node_modules 256 times, max retry, may be cycle required, exit');
          return {
            modName: '',
            error: `resolvePath error, node_module: "${module}" in ${curModule} seek node_modules 256 times, max retry, may be cycle required, exit`
          };
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
        p = testModPath(this, p, module);
      } catch (e) {
        debug('resolvePath error, module not found', module);
        return {
          modName: '',
          error:`required path:'${module}' not found in file: ${curModule}`
        };
      }
    }
    return {
      modName: utils.fixWinPath(p)
    };
  },
  processScript(data, callback) {
    let self = this;
    let filepath = data.queryPath;
    let err;
    if (!filepath) {
      err = new Error('filepath needed!');
      err.code = 'PARAM_ERROR';
      return callback(err);
    }
    this.transformer.transform(data, function (e) {
      if (e) {
        e.code = 'Js_Parse_Error';
        e.file = filepath;
        e.line = e.lineNumber;
        console.error(`Cube transform file "${data.queryPath} error,`, e);
        return callback(e);
      }
      data.requires = unique(data.requires);
      data.requiresOrigin = unique(data.requiresOrigin);
      debug('module path resolved file require list', data.queryPath, data.requires);
      callback(null, data);
    })
  },
  processStyle(data, callback) {
    var qpath = data.queryPath;
    var config = this.config;
    data.queryPath = utils.moduleName(qpath, 'style', config.release, config.remote);
    if (data.compress) {
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
        this.wrapCode(data);
        this.processScript(data, callback);
      });
    } else {
      data.code = this.fixStyleResPath(path.dirname(qpath), data.code);
      this.wrapStyle(data);
      this.processScript(data, callback);
    }
  },
  processJson(data, callback) {
    this.wrapCode(data, true);
    this.processScript(data, callback);
  },
  processText(data, callback) {
    this.wrapCode(data);
    this.processScript(data, callback);
  },
  processImage(data, callback) {
    this.wrapCode(data);
    this.processScript(data, callback);
  },
  wrapStyle(data) {
    let code = `exports._css_ = ${JSON.stringify(data.code)}`;
    data.code = code;
  },
  wrapCode(data, json) {
    let code = `module.exports = ${json ? data.code : JSON.stringify(data.code)};`;
    data.code = code;
  }
};
