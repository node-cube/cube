'use strict';

var xfs = require('xfs');
var path = require('path');
var requires = require('requires');
var utils = require('./lib/utils');
var wraper = require('./lib/wraper');
var processor = require('./processor');
var async = require('async');
var debug = require('debug');

function Done(total, done) {
  var count = 0;
  return function () {
    count++;
    if (total === count) {
      done();
    }
  };
}

/*
function analyseNoduleModules(fpath, map, done) {
  var modules = xfs.readdirSync(fpath);
  var c = 0;
  var mlist = [];

  modules.forEach(function (mname) {
    if (mname === '.bin') {
      return;
    }
    mlist.push(mname);
  });
  var d = Done(mlist.length, done);
  mlist.forEach(function (mname) {
    var mpath = path.join(fpath, mname);
    analyseModule(mpath, map, function () {
      c++;
      d();
    });
  });
}

function analyseModule(mpath, map, done) {
  //console.log(mpath);
  var stat = xfs.statSync(mpath);
  if (!stat.isDirectory()) {
    return done();
  }
  var pkgInfo;
  var d;
  try {
    pkgInfo = JSON.parse(xfs.readFileSync(path.join(mpath, 'package.json')));
  } catch (e) {
    return analyseNoduleModules(mpath, map, done);
  }
  if (!pkgInfo.main) {
    if (xfs.existsSync(path.join(mpath, 'index.js'))) {
      pkgInfo.main = 'index.js';
    }
  }
  if (!pkgInfo.main) {
    if (xfs.existsSync(path.join(mpath, 'node_modules'))) {
      d = Done(2, done);
      analyseNoduleModules(path.join(mpath, 'node_modules'), map, d);
    } else {
      d = Done(1, done);
    }
    // console.log('package.main not found');
    xfs.walk(mpath, function (fpath) {
      if (/node_modules\/?$/.test(fpath)) {
        return false;
      } else if (/(\.md|\/\.\w+)$/ig.test(fpath)) {
        return false;
      }
      return true;
    }, function (err, file) {
      map[file] = true;
    }, function () {
      d();
    });
  } else {
    d = Done(2, done);
    var mainScript = require.resolve(path.join(mpath, pkgInfo.main));
    analyseRequires(mainScript, map, d);
    // add the rest file
    xfs.walk(mpath, function (fpath) {
      if (/node_modules\/?$/.test(fpath)) {
        return false;
      } else if (!/\.(png|jpg|gif|json|svg)$/ig.test(fpath)) {
        return false;
      }
      return true;
    }, function (err, file) {
      map[file] = true;
    }, d);
  }
}

function analyseRequires(script, map, done) {
  map[script] = true;
  var fstr = xfs.readFileSync(script).toString();
  var list = requires(fstr);
  var list1 = [];
  var list2 = [];
  list.forEach(function (n) {
    var p = n.path;
    if (!/^[\/\.]/.test(p)) {
      p = 'node_modules/' + p;
      p = path.join(path.dirname(script), p);
      if (xfs.existsSync(p)) {
        list2.push(p);
      }
      return;
    }
    var realp = require.resolve(path.join(path.dirname(script), p));
    map[realp] = true;
    list1.push(realp);
  });
  var totalLen = list1.length + list2.length;
  if (totalLen === 0) {
    return done();
  }
  var d = Done(totalLen, done);
  list1.forEach(function (p) {
    analyseRequires(p, map, d);
  });
  list2.forEach(function (p) {
    analyseModule(p, map, d);
  });
}
*/

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
  var source = data.src;
  var dest = data.dest;
  var withSource = data.withSource;
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
  var requiredModuleFile = []; // 依赖的node_modules文件

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
        dest: dest,
        withSource: withSource
      }, function (err, res) {
        if (err) {
          if (!err.file) err.file = sourceFile;
          errors.push(err);
        }
        var originRequire;
        if (res && res.result) {
          originRequire = res.result.requiresOrigin;
          originRequire && originRequire.forEach(function (v) {
            if (/^\/node_modules/.test(v)) {
              requiredModuleFile.push(v);
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
    processRequireModules(cube, dest, requiredModuleFile, function () {
      var end = new Date().getTime();
      cb(errors, {
        total: fileCount,
        time: Math.ceil((end - st) / 1000)
      });
    });
  });
  // });
}

function processDirSmart2(cube, data, cb) {
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
  var requiredModuleFile = []; // 依赖的node_modules文件
  var files = [];

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
        src: sourceFile
      }, function (err, res) {
        if (err) {
          if (!err.file) err.file = sourceFile;
          errors.push(err);
        }
        var originRequire;
        if (res && res.result) {
          console.log('>>>>', relFile, res.time);
          files.push(res.result);
          originRequire = res.result.requiresOrigin;
          originRequire && originRequire.forEach(function (v) {
            if (/^\/node_modules/.test(v)) {
              requiredModuleFile.push(v);
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
    processRequireModules2(cube, dest, requiredModuleFile, function (err, modFiles) {
      let end = new Date().getTime();
      files = files.concat(modFiles);
      // 建立 被依赖 映射
      let finalCodes = mergeNode(files);

      finalCodes.forEach(function (code) {
        let targetPath = path.join(dest, code.file);
        xfs.sync().save(targetPath, code.code);
      });
      //
      cb(errors, {
        total: fileCount,
        time: Math.ceil((end - st) / 1000)
      });
    });
  });
}

function mergeNode(files) {
  let requiredMap = {}; // 模块被谁依赖
  let fileMap = {};
  files.forEach(function (file) {
    let reqs = file.requires;
    let qpath = file.queryPath;
    if (!requiredMap[qpath]) {
      requiredMap[qpath] = {};
    }
    fileMap[qpath] = file;
    reqs && reqs.forEach(function (req) {
      if (/^\w+:/.test(req)) {
        // remote require, ignore
        return;
      }
      if (!requiredMap[req]) {
        requiredMap[req] = {};
      }
      requiredMap[req][qpath] = true;
    });
  });

  console.log(requiredMap);

  // 相邻节点折叠
  Object.keys(requiredMap).forEach(function (k) {
    let tmp = requiredMap[k];
    let parents = Object.keys(tmp);

    if (parents.length === 0) {
      fileMap[k].__root = true;
      // root node, ignore
    } else if (parents.length === 1) {
      let f = parents[0];
      if (!fileMap[f].merges) {
        fileMap[f].merges = [];
      }
      fileMap[f].merges.push(k);
      // requiredMap[k];
    }
  });

  //console.log(requiredMap);

  function recurseMerge(arr, node) {
    arr.unshift({file: node.queryPath, code: node.codeWraped});
    if (node.merges) {
      node.merges.forEach(function (key) {
        recurseMerge(arr, fileMap[key]);
      });
    }
  }

  let finalList = [];
  // 根据上面的折叠，递归合并
  files.forEach(function(file) {
    if (!file.__root) {
      finalList.push({
        file: file.queryPath,
        code: file.codeWraped
      });
      return;
    }
    let code = [];
    let map = {};
    let finalCode = [];
    recurseMerge(code, file);
    // 去重
    code.forEach(function (c) {
      if (map[c.file]) {
        return;
      }
      map[c.file] = true;
      finalCode.push(c.code);
    });
    finalList.push({file: file.queryPath, code: finalCode.join(';')});
  });
  return finalList;
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
function processRequireModules(cube, dest, arr, callback) {
  var done = Pedding(arr.length, callback);
  var root = cube.config.root;
  arr.forEach(function (v) {
    if (builtModules[v]) {
      return done();
    }
    builtModules[v] = true;
    var sourceFile = path.join(root, v);
    processFileWithRequire(cube, {
      src: sourceFile,
      dest: dest
    }, done);
  });
}

function processFileWithRequire(cube, data, cb) {
  var root = cube.config.root;
  var count = 1;
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
    count --;
    if (result.requiresOrigin) {
      result.requiresOrigin.forEach(function (m) {
        if (builtModules[m]) {
          return;
        }
        builtModules[m] = true;
        count ++;
        processFile(cube, {
          src: path.join(root, m),
          dest: data.dest
        }, function (err, data) {
          _cb(err, data);
        });
      });
    }
    if (count === 0) {
      cb();
    }
  }
  processFile(cube, data, function (err, data) {
    _cb(err, data);
  });
}


function processRequireModules2(cube, dest, arr, callback) {
  var res = [];
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
    } else {
      // unknow type, copy file
      console.log('[unknow file type]', realFile.substr(1));
    }
    return cb();
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
  /**
  try {
    processData.source = processData.code = xfs.readFileSync(path.join(root, realFile)).toString();
  } catch (e) {
    return cb(new Error('read file error:' + realFile));
  }
  var processActions = [
    function (done) {
      debug('start process');
      done(null, processData);
    }
  ];
  processData.processors.forEach(function (p) {
    var name = p.constructor.name;
    processActions.push(function (d, done) {
      debug('step into processor:' + name);
      p.process(d, done);
    });
  });
  async.waterfall(processActions, function (err, result) {
    if (err) {
      // console.error(err.file, err.line, err.column, err.message);
      return cb(err);
    }
    var wraperMethod;
    switch(type) {
      case 'script':
        try {
          result = wraper.processScript(cube, result);
        } catch (e) {
          return end(e, result);
        }
        wraperMethod = 'wrapScript';
        end(null, result);
        break;
      case 'style':
        wraperMethod = 'wrapStyle';
        wraper.processCssCode(cube, result, end);
        break;
      case 'template':
        try {
          result = wraper.processScript(cube, result);
        } catch (e) {
          return end(e, result);
        }
        wraperMethod = 'wrapScript';
        end(null, result);
        break;
    }
    function end(err, result) {
      if (err) {
        // console.error(err.file, err.line, err.message);
        return cb(err);
      }
      result.mime = cube.getMIMEType('script');
      var flagWithoutWrap = cube.config.withoutWrap;
      if (flagWithoutWrap) {
        _end(null, result);
      } else {
        wraper[wraperMethod](cube, result, _end);
      }

      function _end(err, result) {
        if (err) {
          // console.error(err.file, err.line, err.message);
          return cb(err);
        }
        if (dest) {
          var finalFile, wrapDestFile;
          destFile = path.join(dest, result.queryPath.replace(/^\w+:/, ''));
          if (type === 'script') {
            /**
             * script type, write single js file
             *
            wrapDestFile = destFile.replace(/(\.\w+)?$/, '.js');
            xfs.sync().save(wrapDestFile, flagWithoutWrap ? result.code : result.codeWraped);
            // var destSourceFile = destFile.replace(/\.js/, '.source.js');
            // withSource && xfs.sync().save(destSourceFile, result.source);
          } else if (type === 'style') {
            /**
             * style type, should write both js file and css file
             *
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
      }
    }
  });
  */
}

function fixWinPath(fpath) {
  return fpath.replace(/\\/g, '/');
}

exports.processFile = processFile;
exports.processDir = processDir;
exports.processDirSmart = processDirSmart;
exports.processDirSmart2 = processDirSmart2;
