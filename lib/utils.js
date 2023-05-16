'use strict';

var debug = require('debug')('cube');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');

exports.fixWinPath = function (fpath) {
  return fpath.replace(/\\/g, '/');
};
/**
 * 检查文件列表，找出可能的文件后缀。
 * 如果多个文件匹配，则按processor的注册顺序优先级返回最前的可能
 * @param {Array} dirFList        文件夹中的文件列表
 * @param {[type]} fNameWithoutExt 去掉后缀之后的文件名
 * @param {} [varname] [description]
 * @param  {[type]} possibleExts    原始后缀
 * @return {[type]}                 [description]
 */
exports.getPossibleExt = function (cube, dirFList, fNameWithoutExt, origExt, possibleExts) {
  var tmp, ext, index;
  var matchedExts = [];
  debug('try match ext', origExt, fNameWithoutExt, possibleExts);
  for (var i = 0, len = dirFList.length; i < len; i++) {
    tmp = dirFList[i];
    if (tmp.indexOf(fNameWithoutExt + '.') !== 0) {
      continue;
    }
    ext = tmp.substr(fNameWithoutExt.length);
    if (ext === origExt) {
      return origExt;
    }
    index = possibleExts.indexOf(ext);
    if (index !== -1) {
      matchedExts.push([ext, index]);
    }
  }
  if (!matchedExts.length) {
    debug('file match with possibleExts failed, no file matched', fNameWithoutExt, possibleExts);
    return null;
  }
  if (matchedExts.length > 1) {
    debug('more then one file with same fileName but different ext', matchedExts);
    cube.log.warn('more then one file with same fileName but different ext', matchedExts);
  }
  ext = '';
  index = possibleExts.length;
  /**
   * 按注册processor的顺序优先寻址
   */
  matchedExts.forEach(function (v) {
    if (v[1] < index) {
      ext = v[0];
      index = v[1];
    }
  });
  return ext;
};

/**
 * 文件寻址
 * @param  {[type]}   cube     [description]
 * @param  {[type]}   root     [description]
 * @param  {[type]}   qpath    [description]
 * @param  {[type]}   ps       [description]
 * @param  {Function} callback(err, targetFile, targetExt, processor)
 * @return {[type]}            [description]
 */
exports.seekFile = function(cube, root, qpath, callback) {
  // var origFile = path.join(root, qpath);
  var origExt = path.extname(qpath);
  var fPath = path.dirname(qpath);
  var fName = path.basename(qpath, origExt);
  var dir = path.join(root, fPath);

  var type = cube.extMap[origExt];
  var possibleExts = Object.keys(cube.processors[type]);
  debug('seekFile, type: %s ,qpath: %s, possibleExts: %s', type, qpath, possibleExts);
  fs.readdir(dir, function (err, arr) {
    if (err) {
      return callback(err, null);
    }
    var targetExt = exports.getPossibleExt(cube, arr, fName, origExt, possibleExts);
    if (targetExt === null) {
      err = new Error('file not found: ' + qpath);
      err.code = 'FILE_NOT_FOUND';
      return callback(err);
    }
    return callback(null, path.join(fPath, fName + targetExt), targetExt);
  });
};
/**
 * 更新模块名称
 *   类似 .less .jsx 文件, build之后的文件名需要增加.js后缀, 以方便后续静态加载
 * @param  {Path} file      the require filename
 * @param  {Boolean} ifRelease two model: dev or release
 * @return {Path} targetFileName
 */
exports.moduleName = function(file, type, ifRelease, remote) {
  if (!ifRelease) {
    return remote ? remote + ':' + file : file;
  }

  if (type === 'script') {
    // change all script type to .js file except .json
    if (file.endsWith('.json')) {
      file = file + '.js';
    } else {
      file = file.replace(/\.\w+$/, '.js');
    }
  } else if (type === 'style') {
    // add .js suffix to style file
    file = file + '.js';
  } else if (type === 'template') {
    // add .js suffix to template file
    file = file + '.js';
  }
  return remote ? remote + ':' + file : file;
};

function genRule(rule) {
  if (typeof rule === 'object') {
    return rule;
  }
  if (rule.indexOf('/') === 0) {
    rule = '^' + rule;
  }
  return new RegExp(rule.replace(/\./g, '\\.').replace(/\*/g, '.*'));
}
exports.genRule = genRule;

exports.mergeIgnore = function (dest, src) {
  src.skip && src.skip.forEach(function (v) {
    if (!v) {
      return ;
    }
    dest.skip.push(genRule(v));
  });
  src.ignore && src.ignore.forEach(function (v) {
    if (!v) {
      return ;
    }
    dest.ignore.push(genRule(v));
  });
};
/**
 * loading ignore config
 * @param  {String} curPath 寻址的dir, 一般为root目录
 * @return {Object} 配置信息
 */
exports.loadIgnore = function (curPath) {
  var ignoreRules;
  if (!/^(\w:|\/)/.test(curPath)) {
    curPath = path.join(process.cwd(), curPath);
  }
  var ignore = {skip: [], ignore: []};
  var ending = process.platform.match(/^win/) ? /^\w:\\?$/ : /^\/$/;
  while (!ending.test(curPath)) {
    try {
      ignoreRules = fs.readFileSync(path.join(curPath, '.cubeignore')).toString().split(/\r?\n/g);
      debug('.cubeignore found: ', path.join(curPath, '.cubeignore'));
      break;
    } catch (e) {
      if (e.code === 'ENOENT') {
        const newCurPath = path.dirname(curPath);
        if (newCurPath !== curPath) {
          curPath = newCurPath;
        } else {
          e.message = '[CUBE] loading .cubeignore error, ' + e.message;
          console.error(e.message);
          return ignore;
        }
      } else {
        e.message = '[CUBE] loading .cubeignore error, ' + e.message;
        console.error(e.message);
        return ignore;
      }
    }
  }

  var cate = 'skip';
  ignoreRules && ignoreRules.forEach(function (v) {
    if (v === '[skip]') {
      cate = 'skip';
      return;
    } else if (v === '[ignore]') {
      cate = 'ignore';
      return;
    }
    if (!v) {
      return;
    }
    ignore[cate].push(genRule(v));
  });
  return ignore;
};

exports.mixin = function (target, props) {
  Object.keys(props).forEach(function (key) {
    target.prototype[key] = props[key];
  });
};

/**
 * 检查是否忽略
 * @param  {String} file    文件名
 * @param  {Object} ignores 配置信息
 * @return {Number} 1: skip, 2: ignore
 */
exports.checkIgnore = function (file, ignores) {
  var flag = {};
  var rule;
  ['skip', 'ignore'].forEach(function (cate) {
    var tmp = ignores[cate];
    var len = tmp.length;
    for (var i = 0; i < len; i++) {
      rule = tmp[i];
      if (rule.test(file)) {
        flag[cate] = true;
        break;
      }
    }
  });

  return flag;
};


/**
 * check cycular require
 */
/*
var RTREE = {};

exports.setRequires = function (module, requires) {
  requires.forEach(function (name) {
    if (!RTREE[name]) {
      RTREE[name] = {};
    }
    RTREE[name][module] = true;
  });
};
exports.checkCycularRequire = function (requires) {
  var res = [];
  requires.forEach(function (mod) {
    var tmp = checkCycularRequire[mod];
    if (tmp) {
      res.concat(tmp);
    }
  });
  return res;
};

function checkCycularRequire(name, parents) {
  if (!parents) {
    parents = [name];
  }
  var tmp = RTREE[name];
  var tmpParent;
  var flags;
  if (!tmp) {
    return false;
  }
  var res = [];
  Object.keys(tmp).forEach(function (i) {
    if (parents.indexOf(i) !== -1) {
      parents.unshift(i);
      console.warn('[WARNNING]', 'cycle require : ' + parents.join(' > '));
      res.push(parents);
    }
    tmpParent = parents.slice(0);
    tmpParent.unshift(i);
    flags = checkCycularRequire(i, tmpParent);
    if (flags) {
      res = res.concat(flags);
    }
  });
  return res.length ? res : false;
}

exports.processCycularRequire = function (requireChain, caches) {
  var len = requireChain.length;
  var offset;
  var tarMod;
  var tarReq;
  for (offset = len - 2; offset >= 0; offset --) {
    tarMod = requireChain[offset];
    tarReq = requireChain[offset + 1];
    if (!caches[tarMod].requiresGlobalScopeMap[tarReq]) {
      // broken require here
      caches[tarMod] = null;
      break;
    }
  }
  return {targetModule: tarMod, brokenRequire: tarReq};
};
*/

/**
 * prepare processor's config
 * @param  {Object} cfg
 * {
 *   '.a, .b, .c': 'abc'
 * }
 */
exports.prepareProcessors = function (cfg) {
  if (!cfg) {
    return cfg;
  }
  let res = {};
  Object.keys(cfg).forEach((key) => {
    let v = cfg[key];
    let keys = key.split(',');
    keys.forEach((key) => {
      res[key.trim()] = v;
    });
  });
  return res;
};

/**
 * fix processor's loading path
 * @param processors 
 *        {
 *          '.js': ["p1", "p2", "p3"]
 *          '.css': "css"
 *          '.less': [['asd', {}], ['def', {}]]
 *        }
 *   >> to >> 
 *        {
 *          '.less': [['asd', {}], ['def', {}]]
 *        }
 */
exports.fixProcessorConfig = function (processors, root) {
  if (!processors) {
    return;
  }
  Object.keys(processors).forEach((ext) => {
    let procs = processors[ext];
    if (!procs) {
      return;
    }
    if (!Array.isArray(procs)) {
      processors[ext] = procs = [procs];
    }
    procs.forEach((proc, i, a) => {
      if (!Array.isArray(proc)) {
        a[i] = [proc]
      }
    })
    this.fixProcessorPath(procs, root);
  });
};

/**
 * 补全processor的路径
 * @return {Array} procList
 *          [
 *            ['process', config]
 *          ]
 * @param  {Path} root
 */
exports.fixProcessorPath = function (procList, root) {
  var isWin = process.platform.indexOf('win') === 0;
  var end;
  if (isWin) {
    end = /^\w:\\$/;
  } else {
    end = /^\/$/;
  }
  root = root || process.cwd();

  procList.forEach(function (v, i, a) {
    /**
     * may be module is already loaded, like: require('cube-less')
     */
    if (typeof v[0] !== 'string') {
      return;
    }
    /**
     * if process path is abs
     */
    if (/^(\/|\w:\\)/.test(v[0])) {
      return;
    }
    /**
     * if relative path
     */
    if (v[0].indexOf('.') === 0) {
      console.error('[CUBE_ERROR] processor "' + v[0] + '" should be abs path, relative path not support');
      process.exit(1);
    }

    let modPath;
    let start = root;
    /**
     * find modules in current cwd path first
     * if none match, try the global module
     * if none match, throw error
     */
    while (!end.test(start)) {
      if (fs.existsSync(path.join(start, '/node_modules', v[0]))) {
        modPath = path.join(start, '/node_modules', v[0]);
        break;
      }
      start = path.dirname(start);
    }
    if (!modPath) {
      try {
        require.resolve(v[0]);
        modPath = v[0];
      } catch (e) {
        // do nothing
      }
    }
    if (!modPath) {
      console.error('[CUBE_ERROR] processor "' + v[0] + '" not find, please install the module `' + v[0] + '`');
      process.exit(1);
    }
    v[0] = modPath;
  });
  return procList;
};