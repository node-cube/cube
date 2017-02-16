'use strict';

var xfs = require('xfs');
var path = require('path');
var async = require('async');
var utils = require('./lib/utils');
var processor = require('./processor');

function processDir(cube, data, cb) {
  var source = data.src;
  var dest = data.dest;
  if (!dest) {
    return console.log('[ERROR] param missing! dest');
  }
  if (!cb) {
    cb = function () {};
  }
  var st = new Date().getTime();
  var fileCount = 0;
  var ignores = cube.ignoresRules;
  var errors = [];
  var root = cube.config.root;

  // analyseNoduleModules(path.join(source, 'node_modules'), nodeModulesMap, function () {
  xfs.walk(source, function (err, sourceFile, done) {
    if (err) {
      return done(err);
    }
    fileCount++;

    var relFile = fixWinPath(sourceFile.substr(root.length));
    var destFile = path.join(dest, relFile);
    var checked = utils.checkIgnore(relFile, ignores);

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
    var end = new Date().getTime();
    cb(errors, {
      total: fileCount,
      time: Math.ceil((end - st) / 1000)
    });
  });
  // });
}

function processDirSmart1(cube, data, cb) {
  var source = data.src;
  var dest = data.dest;
  if (!dest) {
    return console.log('[ERROR] param missing! dest');
  }
  if (!cb) {
    cb = function () {};
  }
  var ignores = cube.ignoresRules;
  var errors = [];
  var root = cube.config.root;
  var requiredModuleFile = {}; // 依赖的node_modules文件
  var files = [];

  let st = new Date().getTime();

  console.time('process app file');

  // analyseNoduleModules(path.join(source, 'node_modules'), nodeModulesMap, function () {
  xfs.walk(source, function check(p) {
    var relFile = fixWinPath(p.substr(root.length));
    if (/^\/node_modules\//.test(relFile)) {
      return false;
    }
    return true;
  }, function (err, sourceFile, done) {
    if (err) {
      return done(err);
    }

    var relFile = fixWinPath(sourceFile.substr(root.length));
    var destFile = path.join(dest, relFile);
    var checked = utils.checkIgnore(relFile, ignores);

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
            err.file = sourceFile;
          }
          errors.push(err);
        }
        var originRequire;
        if (res && res.result) {
          if (res.result.type === 'style') {
            xfs.sync().save(destFile.replace(/\.\w+$/, '.css'), res.result.code);
          }
          files.push(res.result);
          originRequire = res.result.requiresOrigin;
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
    console.log(requireModules);
    console.time('process node_modules file');
    processRequireModules2(cube, requireModules, function (err, modFiles) {
      console.timeEnd('process node_modules file');
      files = files.concat(modFiles);
      let actions = [];
      files.forEach(function (tmp) {
        actions.push(function (done) {
          let targetPath = path.join(dest, tmp.queryPath.replace(/^\w+:/, ''));
          console.log('> gen code:', targetPath);
          tmp.genCode(function (err, res) {
            if (res) {
              tmp.codeWraped = res.codeWraped;
            }
            xfs.sync().save(targetPath, res.codeWraped);
            done(err);
          });
        });
      });
      async.waterfall(actions, function (err) {
        console.log('file total', files.length);
        console.log('done', err ? err : 'success');
      });
    });
  });
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

function processDirSmart2(cube, data, cb) {
  var source = data.src;
  var dest = data.dest;
  if (!dest) {
    return console.log('[ERROR] param missing! dest');
  }
  if (!cb) {
    cb = function () {};
  }
  var ignores = cube.ignoresRules;
  var errors = [];
  var root = cube.config.root;
  var requiredModuleFile = {}; // 依赖的node_modules文件
  var files = [];

  let st = new Date().getTime();

  console.time('process app file');

  // analyseNoduleModules(path.join(source, 'node_modules'), nodeModulesMap, function () {
  xfs.walk(source, function check(p) {
    var relFile = fixWinPath(p.substr(root.length));
    if (/^\/node_modules\//.test(relFile)) {
      return false;
    }
    return true;
  }, function (err, sourceFile, done) {
    if (err) {
      return done(err);
    }

    var relFile = fixWinPath(sourceFile.substr(root.length));
    var destFile = path.join(dest, relFile);
    var checked = utils.checkIgnore(relFile, ignores);

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
            err.file = sourceFile;
          }
          errors.push(err);
        }
        var originRequire;
        if (res && res.result) {
          if (res.result.type === 'style') {
            xfs.sync().save(destFile.replace(/\.\w+$/, '.css'), res.result.code);
          }
          files.push(res.result);
          originRequire = res.result.requiresOrigin;
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
    processRequireModules2(cube, requireModules, function (err, modFiles) {
      console.timeEnd('process node_modules file');
      files = files.concat(modFiles);

      let appCodes = mergeNode(files, cube.config.build && cube.config.build.exportModules);
      // 建立 被依赖 映射
      // let modCodes = mergeNode(modFiles, requireModules);

      // console.log(appCodes);
      let merged = Object.keys(appCodes);
      let total = merged.length;
      let count = 0;
      merged.forEach(function (key) {
        let code = appCodes[key];
        let targetPath = path.join(dest, key);
        let map = {};
        let stream = [];
        let actions = [function (callback) {
          callback(null);
        }];
        code.forEach(function (cc) {
          if (map[cc.queryPath]) {
            return;
          }
          map[cc.queryPath] = true;
          actions.push(function (callback) {
            // genCode 之前，先判断是否mangleFileName;
            if (!appCodes[cc.queryPath]) {
              cc.queryPath = cube.getFileShortName(cc.queryPath);
            }
            let requiresNew = [];
            cc.requires && cc.requires.forEach(function (key) {
              if (appCodes[key]) {
                requiresNew.push(key);
              }
            });
            cc.requires = requiresNew;

            cc.requiresRef && cc.requiresRef.forEach(function (node) {
              if (appCodes[node.value]) {
                return;
              }
              node.value = cube.getFileShortName(node.value);
            });

            cc.genCode(function (err, res) {
              stream.push(res.codeWraped);
              callback(null);
            });
          });
        });
        async.waterfall(actions, function () {
          xfs.sync().save(targetPath, stream.join('\n'));
          count++;
          if (count >= total) {
            end();
          }
        });
      });
      function end() {
        xfs.sync().save(path.join(dest, '/filemap.json'), JSON.stringify(cube.getFileShortNameMap(), null, 2));
        console.log('done!');
        let end = new Date().getTime();
        cb(errors, {
          total: files.length,
          merged: merged.length,
          time: Math.ceil((end - st) / 1000)
        });
      }
    });
  });
}

function mergeNode(files, exportModules) {
  let fileMap = {};
  let requiredMap = {};
  function processCycleRequire(file, parents) {
    // console.log('-------', file, parents);
    if (!parents) parents = [];
    if (!file) return;
    let modName = file.queryPath;
    if (parents.indexOf(modName) >= 0) {
      // cycle require
      console.log('[warning] cycle require:', parents.join('>') + '>' + modName);
      // cut off the cycle
      let lastMod = parents[parents.length - 1];
      // remove requiredMap
      delete requiredMap[modName][lastMod];
      // remove file require to t
      let index = fileMap[lastMod].requires.indexOf(modName);
      fileMap[lastMod].requires.splice(index, 1);
      return;
    }

    parents.push(modName);

    file.requires && file.requires.forEach(function (k) {
      let f = fileMap[k];
      let p = parents.slice(0);
      processCycleRequire(f, p);
    });
  }
  /*
  function markRoot(list, root) {
    let sub = [];
    list.forEach(function (modName) {
      let mod = fileMap[modName];
      if (!mod) {
        return;
      }
      if (!mod.__roots) {
        mod.__roots = {};
      }
      if (mod.__roots[root]) {
        return;
      }

      mod.__roots[root] = true;

      if (Object.keys(mod.__roots).length > 1) {
        return;
      }
      let reqs = mod.requires;
      if (reqs) {
        sub = sub.concat(reqs);
      }
    });
    return sub;
  }
  **/
  function unique(arr) {
    let obj = {};
    arr.forEach(function (f) {
      obj[f] = true;
    });
    return Object.keys(obj);
  }

  // 建立模块被谁依赖的关系
  console.log('prepare files');
  files.forEach(function (file) {
    let reqs = file.requires;
    let qpath = file.queryPath;
    if (!qpath) {
      console.log(file);
    }
    if (!requiredMap[qpath]) {
      requiredMap[qpath] = {};
    }
    fileMap[qpath] = file;
    if (reqs && reqs.length) {
      reqs.forEach(function (req) {
        if (/^\w+:/.test(req)) {
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

  // 从根节点开始检查循环依赖
  let mods = Object.keys(requiredMap);
  let roots = [];

  // 找出根节点
  console.log('find root file');
  mods.forEach(function (k) {
    let tmp = requiredMap[k];
    let parents = Object.keys(tmp);
    if (parents.length === 0) {
      roots.push(k);
    }
  });
  // merge custom roots
  if (exportModules) {
    roots = unique(roots.concat(exportModules));
  }

  // 解开循环引用
  console.log('process cycle require');
  roots.forEach(function (k) {
    let file = fileMap[k];
    processCycleRequire(file);
  });

  console.log('root list:', roots);
  // 各模块自根向下检查，如果只属于一个rootNode，标记合并
  // 如果属于不同root, 则提升为rootNode
  /*
  console.log('mark root node');
  roots.forEach(function (root) {
    let sub = [root];
    while(sub.length) {
      sub = markRoot(sub, root);
    }
  });
  */

  console.log('merge node');
  let result = {};
  let list = [];
  roots.forEach(function (root) {
    list.push({
      reqs: [root],
      root: root
    });
  });
  while (list.length) {
    let tmp = [];
    list.forEach(function (n) {
      n.reqs.forEach(function (m) {
        let next = mergeFromRoot(result[n.root], m, n.root);
        if (next) {
          tmp.push(next);
        }
      });
    });
    list = tmp;
  }

  function checkRoot(roots) {
    return Object.keys(roots).length > 1;
  }
  /**
   * 从跟节点开始合并，
   * 判断被多依赖的模块，只有所有的依赖到齐，才继续向下分析
   * 这样能合并很多分析，加速合并流程
   */
  function mergeFromRoot(arr, moduleName, root) {
    let tmp = fileMap[moduleName];
    // 如果模块不存在，跳过
    if (!tmp) {
      return;
    }
    // 如果已经处理过，跳过
    if (tmp.merged) {
      return;
    }
    // 初始化模块的 roots
    if (!tmp.__roots) {
      tmp.__roots = {};
      tmp.__roots[root] = true;
    }

    // 检查模块的依赖方，如果模块的依赖方都还没到齐， 跳过
    let reqeds = requiredMap[moduleName];
    let flag = true;
    Object.keys(reqeds).forEach(function (key) {
      let t = fileMap[key];
      if (!t.merged) {
        flag = false;
      }
      t.__roots && Object.keys(t.__roots).forEach(function (k) {
        tmp.__roots[k] = true;
      });
    });
    if (!flag) {
      return {reqs: [moduleName], root: root};
    }

    if (!arr || checkRoot(tmp.__roots)) {
      if (result[moduleName]) {
        // already split
        return;
      }
      if (arr) {
        console.log('>> split :', moduleName, tmp.__roots);
        root = moduleName;
        tmp.__roots = {};
        tmp.__roots[root] = true;
      }
      arr = [];
      result[moduleName] = arr;
      requiredMap[moduleName] = {};
    }

    tmp.merged = true;
    arr.unshift(tmp);
    let reqs = tmp.requires;
    if (!reqs) {
      return null;
    }
    return {reqs: reqs, root: root};
  }
  return result;
}

function Pedding(num, cb) {
  var count = 0;
  return function done() {
    count ++;
    if (count === num) {
      cb();
    }
  };
}
/**
 * 建立映射关系，避免循环依赖导致无法结束
 */
var builtModules = {};

function processRequireModules2(cube, arr, callback) {
  var res = [];
  if (!arr || !arr.length) {
    return callback(null, res);
  }
  var done = Pedding(arr.length, function () {
    callback(null, res);
  });
  var root = cube.config.root;

  arr.forEach(function (v) {
    if (builtModules[v]) {
      return done();
    }
    builtModules[v] = true;
    var sourceFile = path.join(root, v);
    processFileWithRequire2(cube, {
      src: sourceFile
    }, function (err, data) {
      res = res.concat(data);
      done();
    });
  });
}

function processFileWithRequire2(cube, data, cb) {
  var root = cube.config.root;
  var count = 1;
  var files = [];
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
    var result = res.result;
    files.push(res.result);
    count --;
    if (result.requiresOrigin) {
      result.requiresOrigin.forEach(function (m) {
        if (builtModules[m]) {
          return;
        }
        builtModules[m] = true;
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
      cb(null, files);
    }
  }
  processFile(cube, data, function (err, data) {
    _cb(err, data);
  });
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
function processFile(cube, data, cb) {
  var source = data.src;
  var dest = data.dest;
  //var withSource = data.withSource;
  //var freezeDest = data.freezeDest;
  if (!cb) {
    cb = function () {};
  }
  var st = new Date().getTime();
  var root = cube.config.root;


  var realFile = fixWinPath(source.substr(root.length));
  // var queryFile = freezeDest ? fixWinPath(dest.substr(root.length)) : realFile;
  var queryFile = realFile;
  var destFile = data.destFile;
  if (dest) {
    destFile = path.join(dest, realFile);
  }
  // var destMapFile = path.join(dest, relFile.replace(/\.(\w+)$/, '.map'));
  // var fileName = path.basename(relFile);
  var ext = path.extname(realFile);

  var type =  cube.processors.map[ext];
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
  var ps = cube.processors.types[type];
  var processors = ps[ext];
  console.log('[transfer ' + type + ']:', realFile.substr(1));

  var processData = {
    queryPath: queryFile,
    realPath: realFile,
    type: type,
    code: null,
    codeWraped: null,
    source: null,
    sourceMap: null,
    processors: processors,
    wrap: true,
    compress: data.compress !== undefined ? data.compress : cube.config.compress
  };

  processor.process(cube, processData, function (err, result) {
    if (err) {
      // console.error(err.file, err.line, err.message);
      return cb(err);
    }
    let flagWithoutWrap = !result.wrap;
    if (dest) {
      var finalFile, wrapDestFile;
      destFile = path.join(dest, result.queryPath.replace(/^\w+:/, ''));
      if (type === 'script') {
        /**
         * script type, write single js file
         */
        wrapDestFile = destFile.replace(/(\.\w+)?$/, '.js');
        xfs.sync().save(wrapDestFile, flagWithoutWrap ? result.code : result.codeWraped);
        // var destSourceFile = destFile.replace(/\.js/, '.source.js');
        // withSource && xfs.sync().save(destSourceFile, result.source);
      } else if (type === 'style') {
        /**
         * style type, should write both js file and css file
         */
        finalFile = path.join(dest, realFile).replace(/(\.\w+)?$/, '.css');
        wrapDestFile = destFile;
        xfs.sync().save(wrapDestFile, flagWithoutWrap ? result.code : result.codeWraped);
        xfs.sync().save(finalFile, result.code);
      } else if (type === 'template') {
        wrapDestFile = destFile;
        if (/\.html?$/.test(ext)) {
          xfs.sync().save(path.join(dest, result.realPath), result.source);
        }
        xfs.sync().save(wrapDestFile, flagWithoutWrap ? result.code : result.codeWraped);
      }
    } else if (destFile) {
      xfs.sync().save(destFile, flagWithoutWrap ? result.code : result.codeWraped);
    }
    var end = new Date().getTime();
    if (result) {
      result.file = realFile;
    }
    cb(null, {
      total: 1,
      time: Math.ceil((end - st) / 1000),
      result: result
    });
  });
}

function fixWinPath(fpath) {
  return fpath.replace(/\\/g, '/');
}

exports.mergeNode = mergeNode;
exports.processFile = processFile;
exports.processDir = processDir;
exports.processDirSmart1 = processDirSmart1;
exports.processDirSmart2 = processDirSmart2;
