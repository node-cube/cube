'use strict';

var xfs = require('xfs');
var path = require('path');
var async = require('async');
var utils = require('./lib/utils');
var _ = require('lodash');

/**
 * 处理整个Dir的编译
 * @param {Cube} cube instance
 * @param {Object} options 参数
 *                    - src
 *                    - dest
 */
function processDir(cube, options, cb) {
  let source = options.src;
  let dest = options.dest;
  if (!dest) {
    return console.log('[ERROR] param missing! dest');
  }
  if (!cb) {
    cb = function () {};
  }
  var st = new Date().getTime();
  var fileCount = 0;
  var errors = [];
  var root = cube.config.root;

  // analyseNoduleModules(path.join(source, 'node_modules'), nodeModulesMap, function () {
  xfs.walk(source, function (err, sourceFile, done) {
    if (err) {
      return done(err);
    }
    fileCount++;

    var relFile = utils.fixWinPath(sourceFile.substr(root.length));
    var destFile = path.join(dest, relFile);
    var checked = cube.checkIgnore(relFile);

    if (checked.ignore) {
      console.log('[ignore file]:', relFile.substr(1));
      return done();
    } else if (checked.skip) {
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      console.log('[copy file]:', relFile.substr(1));
      return done();
    }

    try {
      processFile(cube, {
        src: sourceFile,
        dest: dest
      }, function (err) {
        if (err) {
          if (typeof err == 'string') err = new Error(err);
          if (!err.file) err.file = sourceFile;
          errors.push(err);
        }
        done();
      });
    } catch (e) {
      if (/node_modules/.test(sourceFile)) {
        // should ignore the error
        e.file = sourceFile;
        errors.push(e);
      } else {
        throw e;
      }
      done();
    }
  }, function () {
    xfs.writeFileSync(
      path.join(dest, 'cube.js'),
      xfs.readFileSync(path.join(__dirname, './runtime/cube.min.js'))
    );
    var end = new Date().getTime();
    cb(errors, {
      total: fileCount,
      time: Math.ceil((end - st) / 1000)
    });
  });
  // });
}


/**
 * 选择性编译
 *   1. 当前目录下，除了node_modules目录，其他文件都编译
 *   2. node_modules目录，选择性编译
 * @param  {Cube}   cube
 * @param  {Object}   data
 *         - src
 *         - dest
 *         - withSource
 * @param  {Function} cb()
 */

function processDirSmart(cube, data, cb) {
  // merge 第一步，入口文件，交叉文件入common
  var source = data.src;
  var dest = data.dest;
  var st = new Date();
  if (!dest) {
    return console.log('[ERROR] param missing! dest');
  }
  if (!cb) {
    cb = function () {};
  }
  var errors = [];
  var root = cube.config.root;
  var requiredModuleFile = {}; // 依赖的node_modules文件
  var files = [];

  // let st = new Date().getTime();

  console.time('process app file');

  // analyseNoduleModules(path.join(source, 'node_modules'), nodeModulesMap, function () {
  xfs.walk(source, function check(p) {
    var relFile = utils.fixWinPath(p.substr(root.length));
    if (/^\/node_modules\//.test(relFile)) {
      return false;
    }
    return true;
  }, function (err, sourceFile, done) {
    // 遍历得到使用中的 node_modules 包 requiredModuleFile
    // 所有文件放入 files
    // code, codeWraped, absPath, requires, requiresOrigin, ast, queryPath, realPath
    if (err) {
      return done(err);
    }

    var relFile = utils.fixWinPath(sourceFile.substr(root.length));
    var destFile = path.join(dest, relFile);
    var checked = cube.checkIgnore(relFile);

    if (checked.ignore) {
      console.log('[ignore file]:', relFile.substr(1));
      return done();
    } else if (checked.skip) {
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      console.log('[copy file]:', relFile.substr(1));
      return done();
    }

    try {
      processFile(cube, {
        src: sourceFile
      }, function (err, res) {
        if (err) {
          if (err === 'unknow_type') {
            xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
            console.log('[copy file]:', relFile.substr(1));
            return done();
          } else if (!err.file) {
            if (typeof err == 'string') err = new Error(err);
            err.file = sourceFile;
          }
          errors.push(err);
        }
        var originRequire;
        if (res && res.data) {
          if (res.data.type === 'style') {
            xfs.sync().save(destFile.replace(/\.\w+$/, '.css'), res.data.code);
          }
          files.push(res.data);
          originRequire = res.data.requiresOrigin;
          originRequire && originRequire.forEach(function (v) {
            if (/^\/node_modules/.test(v)) {
              requiredModuleFile[v] = true;
            }
          });
        }
        done();
      });
    } catch (e) {
      if (/node_modules/.test(sourceFile)) {
        // should ignore the error
        e.file = sourceFile;
        errors.push(e);
      } else {
        throw e;
      }
      done();
    }
  }, function () {
    console.timeEnd('process app file');
    let requireModules = Object.keys(requiredModuleFile);
    console.time('process node_modules file');
    // 遍历依赖的 npm 包，并遍历包中的所有文件
    processRequireModules(cube, requireModules, function (err, modFiles) {
      console.timeEnd('process node_modules file');
      files = files.concat(modFiles);
      files = processMerge(files);
      let actions = [];
      files.forEach(function (tmp) {
        actions.push(function (done) {
          let targetPath = path.join(dest, tmp.queryPath.replace(/^\w+:/, ''));
          console.log('> gen code:', targetPath);
          xfs.sync().save(targetPath, tmp.codeWraped);
          done();
        });
      });

      async.waterfall(actions, function (err) {
        xfs.writeFileSync(
          path.join(dest, 'cube.js'),
          xfs.readFileSync(path.join(__dirname, './runtime/cube.min.js'))
        );
        console.log('file total', files.length);
        console.log('done', err ? err : 'success');
        let end = new Date();
        cb(errors, {
          total: files.length,
          time: Math.ceil((end - st) / 1000)
        });
      });
    });
  });
}

/**
 * 处理依赖的node_modules中的文件，传入是个文件列表
 * @param  {Cube}   cube     [description]
 * @param  {Array}   arr     文件路径列表， 相对于root
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function processRequireModules(cube, arr, callback) {
  var res = [];
  var cached = {};
  if (!arr || !arr.length) {
    return callback(null, res);
  }
  var root = cube.config.root;
  async.eachLimit(arr, 10, function (file, done) {
    if (cached[file]) {
      return done();
    }
    cached[file] = true;
    var sourceFile = path.join(root, file);
    processFileWithRequires(cube, {
      src: sourceFile,
      cached: cached
    }, function (err, data) {
      res = res.concat(data);
      done();
    });
  }, function (err) {
    callback(err, res);
  });
}
/**
 * 处理文件并且递归其依赖关系合并以来
 * @param  {[type]}   cube [description]
 * @param  {[type]}   data
 *                       - src
 *                       - cached 缓存标记，记录某模块是否已经被build过
 * @param  {Function} cb   [description]
 * @return {[type]}        [description]
 */
function processFileWithRequires(cube, data, callback) {
  var root = cube.config.root;
  var count = 1;
  var files = [];
  var cached = data.cached || {};
  function _cb(err, res) {
    if (err) {
      if (!Array.isArray(err)) {
        err = [err];
      }
      err.forEach(function (e) {
        console.log(e);
      });
      return ;
    }
    var result = res.data;
    files.push(result);
    count --;
    if (result.requiresOrigin) {
      result.requiresOrigin.forEach(function (m) {
        if (cached[m]) {
          return;
        }
        cached[m] = true;
        count ++;
        processFile(cube, {
          src: path.join(root, m)
        }, function (err, data) {
          process.nextTick(function () {
            _cb(err, data);
          });
        });
      });
    }
    if (count === 0) {
      callback(null, files);
    }
  }
  processFile(cube, data, function (err, res) {
    _cb(err, res);
  });
}

/**
 * 合并文件
 * @param  {Array} files         处理完的文件列表
 * @param  {Array} exportModules 人肉设定的root文件
 * @return {[type]}               [description]
 */
function processMerge(files, exportModules) {
  /**
   * 文件名Map
   */
  let fileMap = {};
  /**
   * 被依赖Map
   */
  let requiredMap = {};
  /**
   * 入口 root 和被标记为 cors 的文件都是 root，这个 map 将会在每次深层遍历 root 的时候清空
   */
  let roots = [];
  /**
   * 文件名Map
   */
  let restFile = {};
  /**
   * 最终的 root 表
   */
  let rootMap = {};

  let loads = [];

  console.log('prepare files');
  // 建立 qpath -> file 的一对一映射关系
  // 建立 child -> parent 的一对多映射关系
  files.forEach(function (file) {
    let reqs = file.requires;
    let reqso = file.requiresOrigin;
    let qpath = file.queryPath;
    if (!qpath) {
      console.log('[ERROR] queryPath not Found:', file);
    }
    if (file.loads) {
      loads = loads.concat(file.loads);
    }
    if (!requiredMap[qpath]) {
      requiredMap[qpath] = {};
    }
    restFile[qpath] = fileMap[qpath] = file;
    if (reqs && reqs.length) {
      reqs.forEach(function (req, index) {
        // 带 --remote 参数时不能过滤，所以判断 reqso 而不是 reqs
        if (/^\w+:/.test(reqso[index])) {
          // remote require, ignore
          return;
        }
        if (!requiredMap[req]) {
          requiredMap[req] = {};
        }
        requiredMap[req][qpath] = true;
      });
    }
  });

  // 找出根节点
  console.log('find root file');
  let mods = Object.keys(requiredMap);
  roots = findRoot(mods);
  // merge custom roots
  if (exportModules && exportModules.length) {
    roots = roots.concat(exportModules);
  }
  if (loads.length) {
    roots = roots.concat(unique(loads));
  }

  function clearDepList(code) {
    return code.replace(/^Cube\([^\[]+(\[[^\]]+\])/, function(whole, deps){
      var Jdeps = JSON.parse(deps.replace(/'/g, '\"'));
      Jdeps = Jdeps.filter(function(dep){
        return !!rootMap[dep]; // 删除非 root 的依赖
      });
      return whole.replace(deps, JSON.stringify(Jdeps));
    });
  }

  /** 标记root  */
  function markRoot(list, root) {
    let sub = [];
    list.forEach(function (modName) {
      let mod = restFile[modName];
      // 模块不存在，则忽略
      if (!mod) {
        return;
      }
      // 还没初始化，则初始化
      if (!mod.__roots) {
        mod.__roots = {};
      }
      // 已经标记过该root， 则返回， 解循环依赖的问题
      if (mod.__roots[root]) {
        return;
      }
      // 标记该root
      mod.__roots[root] = true;
      /*
      if (Object.keys(mod.__roots).length > 1) {
        return;
      }
      */
      let reqs = mod.requires;
      if (reqs) {
        sub = sub.concat(reqs);
      }
    });
    // 返回下一层模块
    return sub;
  }
  // 去重
  function unique(arr) {
    var map = {};
    arr.forEach(function (f) {
      map[f] = true;
    });
    return Object.keys(map);
  }

  // 合并文件
  function mergeFile(list, nodes, root) {
    let sub = [];
    nodes.forEach((node) => {
      list.unshift(node.queryPath);
      delete node.__roots[root];
      if (!Object.keys(node.__roots).length) {
        delete restFile[node.queryPath];
      }
      node.requires && node.requires.forEach(function (reqPath) {
        let req = restFile[reqPath];
        if (!req || !req.__roots[root]) { //  不存在的文件
          return;
        }
        let len = Object.keys(req.__roots).length;
        if (len === 0) {
          // this is impossible
        } else if (len === 1) {
          sub.push(req);
        } else {
          // 多 root 的情况
          // 标记为下一轮的 root
          roots.push(reqPath);
          //delete req.__roots[root];
        }
      });
    });
    return sub;
  }

  function findRoot(mods) {
    let root = [];
    mods.forEach(function (k) {
      let tmp = requiredMap[k];
      let parents = Object.keys(tmp);
      if (parents.length === 0) {
        root.push(k);
      }
    });
    return root;
  }

  function markSubIntoRoot(){
    var cache = _.clone(unique(roots));
    // 递归重置
    roots = [];
    _.each(restFile, function(mod){
      mod.__roots = {};
    });
    // 标记各文件的root
    // 将各个 root 下依赖的文件依次打上该 root 的标，包括 root 文件自己
    cache.forEach(function (root) {
      let sub = [root];
      while(sub.length) {
        sub = markRoot(sub, root);
      }
    });

    // 找出只！！被该 root 引用的所有文件，也就是 __roots.length == 1
    // 放入 rootMap[root] 中
    cache.forEach(function (root) {
      var list = [];
      var tmp = [restFile[root]];
      while (tmp.length) {
        tmp = mergeFile(list, tmp, root); // will re-calculate the roots
      }
      rootMap[root] = unique(list);
    });

    return cache.length && cache.length !== unique(roots).length; // 每次处理应该有变化
  }


    // 递归处理 root 和交叉节点
  while (markSubIntoRoot()) {
    // do nothing
  }

  var result = [];
  _.each(rootMap, function(deps, qpath) {
    var rootFile = fileMap[qpath];
    var mergeList = [clearDepList(rootFile.codeWraped)];
    // rootFile.codeWraped = clearDepList(rootFile.codeWraped);
    deps.forEach(function(sub){
      if (sub == qpath) return true;

      mergeList.unshift(clearDepList(fileMap[sub].codeWraped));
      //rootFile.codeWraped += ';'+clearDepList(fileMap[sub].codeWraped);
      //fileMap[sub].codeWraped = ''; // 节约内存
    });
    rootFile.codeWraped = mergeList.join(';');
    result.push(rootFile);
  });

  return result;
}
/**
 * processFile
 * @param  {Cube}   cube   cube instance
 * @param  {Object} data
 *         - src abs file path
 *         - dest output dir
 *         - destFile output file
 * @param  {Function} cb(err, res)
 */
function processFile(cube, options, cb) {
  var source = options.src;
  var dest = options.dest;

  if (!cb) {
    cb = function () {};
  }
  var st = new Date().getTime();
  var root = cube.config.root;


  var realFile = utils.fixWinPath(source.substr(root.length));
  // var queryFile = freezeDest ? fixWinPath(dest.substr(root.length)) : realFile;
  var queryFile = realFile;
  var destFile = options.destFile;
  if (dest) {
    destFile = path.join(dest, realFile);
  }
  // var destMapFile = path.join(dest, relFile.replace(/\.(\w+)$/, '.map'));
  // var fileName = path.basename(relFile);
  var ext = path.extname(realFile);

  var type =  cube.extMap[ext];
  if (type === undefined) {
    if (destFile) {
      console.log('[copying file]:', realFile.substr(1));
      destFile && xfs.sync().save(destFile, xfs.readFileSync(source));
      return cb();
    } else {
      // unknow type, copy file
      console.log('[unknow file type]', realFile.substr(1));
      return cb('unknow_type');
    }
  }
  var ps = cube.processors[type];
  var processors = ps[ext];

  console.log('[transfer ' + type + ']:', realFile.substr(1));

  async.waterfall([
    function prepare(done) {
      let data = {
        queryPath: queryFile,
        realPath: realFile,
        type: type,
        code: null,
        codeWraped: null,
        source: null,
        sourceMap: null,
        processors: processors,
        wrap: true,
        compress: options.compress !== undefined ? data.compress : cube.config.compress
      };
      done(null, data);
    },
    cube.seekFile.bind(cube),
    cube.readFile.bind(cube),
    cube.transferCode.bind(cube),
    function (data, done) {
      data.genCode(done);
    },
    function output(data, done) {
      let flagWithoutWrap = !data.wrap;
      if (dest) {
        var finalFile, wrapDestFile;
        destFile = path.join(dest, data.queryPath.replace(/^\w+:/, ''));
        if (type === 'script') {
          /**
           * script type, write single js file
           */
          wrapDestFile = destFile; // .replace(/(\.\w+)?$/, '.js');
          xfs.sync().save(wrapDestFile, flagWithoutWrap ? data.code : data.codeWraped);
          // var destSourceFile = destFile.replace(/\.js/, '.source.js');
          // withSource && xfs.sync().save(destSourceFile, result.source);
        } else if (type === 'style') {
          /**
           * style type, should write both js file and css file
           */
          finalFile = path.join(dest, realFile).replace(/(\.\w+)?$/, '.css');
          wrapDestFile = destFile;
          xfs.sync().save(wrapDestFile, flagWithoutWrap ? data.code : data.codeWraped);
          xfs.sync().save(finalFile, data.code);
        } else if (type === 'template') {
          wrapDestFile = destFile;
          if (/\.html?$/.test(ext)) {
            xfs.sync().save(path.join(dest, data.realPath), data.source);
          }
          xfs.sync().save(wrapDestFile, flagWithoutWrap ? data.code : data.codeWraped);
        }
      } else if (destFile) {
        xfs.sync().save(destFile, flagWithoutWrap ? data.code : data.codeWraped);
      }
      var end = new Date().getTime();
      if (data) {
        data.file = realFile;
      }
      done(null, {
        total: 1,
        time: Math.ceil((end - st) / 1000),
        data: data
      });
    }
  ], cb);
}

/**
 * [allInOneCode description]
 * @param  {Cube}   cube     [description]
 * @param  {Object}   options
 *                       - queryPath
 *                       - compress
 *                       - code
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function allInOneCode(cube, options, callback) {
  var result = {};

  function prepare(options) {
    return {
      queryPath: options.queryPath,
      realPath: options.queryPath,
      type: 'script',
      ext: '.js',
      targetExt: '.js',
      code: options.code || null,
      codeWraped: null,
      source: options.code || '',
      sourceMap: null,
      wrap: (options.ignoreFirstCodeWrap) ? false : true,
      compress: options.compress !== undefined ? options.compress : cube.config.compress
    };
  }
  function process(cube, data, cb) {
    async.waterfall([
      function prepare(done) {
        done(null, data);
      },
      cube.readFile.bind(cube),
      cube.transferCode.bind(cube)
    ], function (err, data) {
      if (err) {
        return cb(err);
      }
      result[data.queryPath] = data;
      if (data.requires && data.requires.length) {
        async.eachLimit(data.requires, 10, function (req, done) {
          if (result[req]) {
            return done(null);
          }
          process(cube, prepare({
            queryPath: req,
            compress: options.compress
          }), done);
        }, cb);
      } else {
        cb(null);
      }
    });
  }
  process(cube, prepare(options), function (err) {
    if (err) {
      return callback(err);
    }
    let arr = [];
    async.eachSeries(result, function (data, done) {
      data.requires = [];
      data.genCode(function (err, data) {
        if (err) {
          return done(err);
        }
        arr.unshift(data.wrap ? data.codeWraped : data.code);
        done(null);
      });
    }, function (err) {
      callback(err, arr);
    });
  });
}

/**
 * portal API
 */
exports.allInOneCode = allInOneCode;
exports.processFile = processFile;
exports.processDir = processDir;
exports.processDirSmart = processDirSmart;
exports.processFileWithRequires = processFileWithRequires;
