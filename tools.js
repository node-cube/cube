'use strict';

var xfs = require('xfs');
var path = require('path');
var async = require('async');
var utils = require('./lib/utils');
// var _ = require('lodash');

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
    return cube.log.error('param missing! dest');
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
      cube.log.warn('ignore file:', relFile.substr(1));
      return done();
    } else if (checked.skip) {
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      cube.log.info('skip process, copy file:', relFile.substr(1));
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
  var tmpStartTime = new Date();
  var tmpEndTime;
  if (!dest) {
    return cube.log.error('param missing! dest');
  }
  if (!cb) {
    cb = function () {};
  }
  var errors = [];
  var root = cube.config.root;
  var requiredModuleFile = {}; // 依赖的node_modules文件
  var files = [];

  // let st = new Date().getTime();

  // console.time('process app file');

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
      cube.log.warn('ignore file:', relFile.substr(1));
      return done();
    } else if (checked.skip) {
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      cube.log.info('skip, copy file:', relFile.substr(1));
      return done();
    }

    try {
      processFile(cube, {
        src: sourceFile,
        genCodeLater: true
      }, function (err, res) {
        if (err) {
          if (err === 'unknow_type') {
            xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
            cube.log.info('unknow file type, copy file:', relFile.substr(1));
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
    tmpEndTime = new Date();
    cube.log.info('process app\'s file done, cost:', (tmpEndTime - tmpStartTime) + 'ms');
    tmpStartTime = new Date();
    let requireModules = Object.keys(requiredModuleFile);
    // 遍历依赖的 npm 包，并遍历包中的所有文件
    processRequireModules(cube, requireModules, true, function (err, modFiles) {
      tmpEndTime = new Date();
      cube.log.info('process node_modules file done, cost:', (tmpEndTime - tmpStartTime) + 'ms');
      tmpStartTime = new Date();

      files = files.concat(modFiles);
      let finalfiles = processMerge(cube, files, cube.config.export);
      let actions = [];
      finalfiles.forEach(function (tmp) {
        cube.setMangleFileNameSaveFlag(tmp.queryPath);
        actions.push(function (done) {
          let nodes = [];
          function mergeNode(node) {
            nodes.push(node);
            if (node.merges) {
              node.merges.forEach(function (file) {
                mergeNode(file);
              });
            }
          }

          function genCode(callback) {
            let codes = [];
            async.eachSeries(nodes, function (node, done) {
              node.queryPath = cube.mangleFileName(node.queryPath);
              node.requiresArgsRefer && node.requiresArgsRefer.forEach((arg0) => {
                arg0.value = cube.mangleFileName(arg0.value);
              });
              node.requires && node.requires.forEach((v, i, a) => {
                a[i] = cube.mangleFileName(v);
              });
              node.genCode(function (err, data) {
                if (err) {
                  done(err);
                } else {
                  codes.unshift(data.codeWraped);
                  done();
                }
              });
            }, function (err) {
              callback(err, codes);
            });
          }

          mergeNode(tmp);

          genCode(function (err, codes) {
            if (err) {
              return done(err);
            }
            let targetPath = path.join(dest, tmp.queryPath.replace(/^\w+:/, ''));
            cube.log.info('> gen code:', targetPath);
            xfs.sync().save(targetPath, codes.join('\n'));
            done();
          });
        });
      });

      async.waterfall(actions, function (err) {
        xfs.writeFileSync(
          path.join(dest, 'cube.js'),
          xfs.readFileSync(path.join(__dirname, './runtime/cube.min.js'))
        );
        xfs.writeFileSync(
          path.join(dest, 'cube_file_map.json'),
          JSON.stringify(cube.mangleFileNameMap(), null, 2)
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
 * @param  {Cube}   cube  实例
 * @param  {Array}   arr     文件路径列表， 相对于root
 * @param  {Function} callback(err, Array)
 */
function processRequireModules(cube, arr, flagGenCodeLater, callback) {
  var res = [];
  var cached = {};
  if (!arr || !arr.length) {
    return callback(null, res);
  }
  var root = cube.config.root;
  async.eachSeries(arr, function (file, done) {
    if (cached[file]) {
      return done();
    }
    cached[file] = true;
    var sourceFile = path.join(root, file);
    processFileWithRequires(cube, {
      src: sourceFile,
      cached: cached,
      genCodeLater: flagGenCodeLater
    }, function (err, data) {
      if (err) {
        return done(err);
      }
      res = res.concat(data);
      done();
    });
  }, function (err) {
    callback(err, res);
  });
}
/**
 * 处理文件并且递归其依赖关系合并以来
 * @param  {Cube}   cube [description]
 * @param  {Object}   data
 *                       - src
 *                       - cached 缓存标记，记录某模块是否已经被build过
 * @param  {Function} cb   [description]
 */
function processFileWithRequires(cube, data, callback) {
  var root = cube.config.root;
  var files = [];
  var cached = data.cached || {};
  processFile(cube, data, function (err, res) {
    if (err) {
      if (!Array.isArray(err)) {
        err = [err];
      }
      return callback(err);
    }
    var result = res.data;
    files.push(result);
    if (result.requiresOrigin) {
      async.eachSeries(result.requiresOrigin, function (m, done) {
        if (cached[m]) {
          return done();
        }
        cached[m] = true;
        processFileWithRequires(cube, {
          src: path.join(root, m),
          cached: cached,
          genCodeLater: data.genCodeLater
        }, function (err, fileList) {
          if (err) {
            return done(err);
          }
          files = files.concat(fileList);
          done(null);
        });
      }, function (err) {
        callback(err, files);
      });
    } else {
      callback(null, files);
    }
  });
}
/**
 * 合并文件
 * @param  {Array} files   文件对象列表
 * @param  {Object} exportFiles 排除文件，无需合并
 * @return {Array}  合并之后的文件列表
 */
function processMerge(cube, files, exportFiles) {
  /**
   * 文件名Map
   */
  let fileMap = {};
  /**
   * 依赖Map
   */
  let requireMap = {};
  /**
   * 被依赖Map
   */
  let requiredMap = {};
  let originRequiredMap = {};
  /**
   * 动态加载模块列表
   */
  let loads = [];

  exportFiles = exportFiles || {};

  cube.log.info('prepare files');
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
      originRequiredMap[qpath] = {};
    }
    fileMap[qpath] = file;
    if (!requireMap[qpath]) {
      requireMap[qpath] = {};
    }
    if (reqs && reqs.length) {
      reqs.forEach(function (req, index) {
        // reqs在加工之后，会带上remote标记, 而reqso则保持原样
        // 所以在判断的时候，需要使用 reqso
        // 带 --remote 参数时不能过滤
        if (/^\w+:/.test(reqso[index])) {
          // remote require, ignore
          return;
        }
        if (!requiredMap[req]) {
          requiredMap[req] = {};
          originRequiredMap[req] = {};
        }
        requiredMap[req][qpath] = true;
        originRequiredMap[req][qpath] = true;
        requireMap[qpath][req] = true;
      });
    }
  });

  let tmpList;
  let count = 1;
  let mergeFlag = true;

  while (mergeFlag) {
    mergeFlag = false;
    tmpList = [];
    files.forEach(function (file) {
      let qpath = file.queryPath;
      let reqs = requireMap[qpath];
      let reqeds = requiredMap[qpath];
      let reqedList = Object.keys(reqeds);

      if (reqedList.length === 1 && !exportFiles[qpath]) {
        /**
         * 只有一个模块依赖当前模块，则可以合并入父级
         */
        mergeFlag = true;
        // 只被一个文件依赖，则合并入父级
        let parent = fileMap[reqedList[0]];
        if (!parent.merges) {
          parent.merges = [];
        }
        parent.merges.push(file);

        // 清理原始依赖链上的require
        let originRequired = originRequiredMap[qpath];
        Object.keys(originRequired).forEach((key) => {
          let tmp = fileMap[key];
          tmp.requires = tmp.requires.filter((v) => {
            if (v === qpath) {
              return false;
            }
            return true;
          });
        });

        console.log(`[${count}] merge ${qpath} to ${reqedList[0]}`);

        /**
         * 修改 requireMap, requiredMap
         */
        let parentReqs = requireMap[parent.queryPath];
        // 去除对合并节点的依赖
        delete parentReqs[qpath];
        // 被合并节点的依赖，变成父级节点的依赖
        for (var i in reqs) {
          parentReqs[i] = true;
          // 同时更新这些依赖节点的被依赖列表
          delete requiredMap[i][qpath];
          requiredMap[i][parent.queryPath] = true;
        }
      } else {
        /**
         * 有0个父级，或则有多个父级，则无法合并
         */
        tmpList.push(file);
      }
    });
    files = tmpList;
    count ++;
  }
  return files;
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
      cube.log.info('copying file:', realFile.substr(1));
      destFile && xfs.sync().save(destFile, xfs.readFileSync(source));
      return cb();
    } else {
      // unknow type, copy file
      // console.log('[unknow file type]', realFile.substr(1));
      return cb('unknow_type');
    }
  }
  var ps = cube.processors[type];
  var processors = ps[ext];

  cube.log.info('transferring ' + type + ' file:', realFile.substr(1));

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
      if (options.genCodeLater) {
        return done(null, data);
      }
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
        //可以过滤需要拉取文件的数组
        let _requires = data.requires.slice(0);
        if (options.processFilter) _requires = options.processFilter(_requires);
        async.eachLimit(_requires, 10, function (req, done) {
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
      //可以过滤出现在代码开头的依赖数组
      data.requires = options.requireFilter ? options.requireFilter(data.requires) : [];
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
 * for test only
 */
exports._processMerge = processMerge;

/**
 * portal API
 */
exports.allInOneCode = allInOneCode;
exports.processFile = processFile;
exports.processDir = processDir;
exports.processDirSmart = processDirSmart;
exports.processFileWithRequires = processFileWithRequires;
