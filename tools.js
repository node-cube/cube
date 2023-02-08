'use strict';

var xfs = require('xfs');
var path = require('path');
var async = require('async');
var utils = require('./lib/utils');
var _ = require('lodash');
var debug = require('debug')('cube:merge');

function dump(file, obj) {
  require('fs').writeFileSync(file, JSON.stringify(obj, null, 2));
}
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
    if (/^\/\./.test(relFile)) {
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

      let filesLoad = {};

      // TODO 优化这个遍历，可以合并入processMerge， 但需要续订processMerge的测试
      files.forEach((f) => {
        f.loads && f.loads.forEach((v) => {
          filesLoad[v.replace(/^[^:]+:/, '')] = true;
        });
      });

      let rootFiles = _.merge({}, cube.config.export, filesLoad);
      let finalfiles = processMerge(cube, files, rootFiles);
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
              if (node.flagMangled) {
                codes.unshift(node.codeWraped);
                return done();
              }
              node.flagMangled = true;
              node.queryPath = cube.mangleFileName(node.queryPath, rootFiles);
              node.requiresArgsRefer && node.requiresArgsRefer.forEach((arg0) => {
                arg0.value = cube.mangleFileName(arg0.value, rootFiles);
              });
              node.requires && node.requires.forEach((v, i, a) => {
                a[i] = cube.mangleFileName(v, rootFiles);
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
            // TODO  理论上 queryPath 不会绑定remote, remote只会在文件中的require中存在
            let targetPath = path.join(dest, tmp.queryPath.replace(/^[^:]+:/, ''));
            cube.log.info('> gen code:', targetPath);
            xfs.sync().save(targetPath, codes.join('\n'));
            done();
          });
        });
      });

      async.waterfall(actions, function (err) {
        // xfs.writeFileSync(
        //   path.join(dest, 'cube.js'),
        //   xfs.readFileSync(path.join(__dirname, './runtime/cube.min.js'))
        // );
        xfs.writeFileSync(
          path.join(dest, 'cube.js'),
          xfs.readFileSync(path.join(__dirname, './runtime/cube-reconstruction.min.js'))
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
    if (result.requiresOrigin && result.requiresOrigin.length) {
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
 * @param  {Object} rootFiles 排除文件，无需合并
 * @return {Array}  合并之后的文件列表
 */
function processMerge(cube, files, rootFiles) {
  /**
   * 文件名Map
   */
  let fileMap = {};
  /**
   * 依赖Map: key:文件引用了谁，寻找child用
   */
  let requireMap = {};
  /**
   * 被依赖Map:  key:文件  被谁引用了，寻找parent用
   */
  let requiredMap = {};
  let originRequiredMap = {};
  /** 已合并文件列表 */
  let mergedFile = {};

  cube.log.info('prepare files');
  // 建立 qpath -> file 的一对一映射关系
  // 建立 child -> parent 的一对多映射关系
  files.forEach((file) => {
    let reqs = file.requires;
    let reqso = file.requiresOrigin;
    let qpath = file.queryPath;
    if (!qpath) {
      console.log('[ERROR] queryPath not Found:', file);
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
        // reqs在加工之后，会带上remote标记, 而reqs origin则保持原样
        // 所以在判断的时候，需要使用 reqs origin
        // 带 --remote 参数时不能过滤
        if (/^\w+:/.test(reqso[index])) {
          // remote require, ignore
          return;
        }
        if (!requiredMap[req]) {
          requiredMap[req] = {};
          originRequiredMap[req] = {};
        }
        // 被设置为rootFile之后，就需要斩断依赖，没有parent required
        if (!rootFiles[req]) {
          requiredMap[req][qpath] = true;
          originRequiredMap[req][qpath] = true;
        }
        requireMap[qpath][req] = true;
      });
    }
  });

  dump(path.join(cube.config.root, 'cube_info.require_map.json'), requireMap);
  dump(path.join(cube.config.root, 'cube_info.required_map.json'), requiredMap);

  let tmpList;
  let count = 1;
  let mergeFlag = true;

  let tmpFiles = _.clone(files);

  while (mergeFlag) {
    mergeFlag = false;
    tmpList = [];
    tmpFiles.forEach(function (file) {
      let qpath = file.queryPath;
      let reqs = requireMap[qpath];
      let reqeds = requiredMap[qpath];
      let reqedList = Object.keys(reqeds);
      if (reqedList.length === 1 && !rootFiles[qpath.replace(/^[^:]+:/, '')]) {
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
        mergedFile[qpath] = true;

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

        debug(`[${count}] merge ${qpath} > ${reqedList[0]}`);

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
    tmpFiles = tmpList;
    count ++;
  }
  tmpFiles = null;
  /**
   * TODO: 优化多依赖的文件合并
   *
   * 最佳方案A：
   * 对非rootFile分组，并比对各组的差异，建立分级公共文件，并将公共文件的加载，压入依赖栈中
   * 
   * 快速方案B：
   * 抽取非root文件，合并成一个文件，并在rootFiles中增加该公共文件的依赖
   *
   * 以下B方案快速实现
   */
  // 搜寻出来的根节点，将比定义出来需要保留名字的根节点多
  // 原因：比如一些废弃的文件
  // 现在的逻辑，rootFile都是有构建的 export参数指定的列表 + 动态load的模块列表
  // 扁平化的依赖关系， root -> 节点
  let allRootDeps = {};
  // 扁平化的节点的root关系， 节点 -> root
  let allFileRoot = {};

  files.forEach((file) => {
    let qpath = file.queryPath;
    // 文件已合并，无需处理
    if (mergedFile[qpath]) {
      return;
    }
    // 如果是rootFile,默认就需要导出，跳过
    if (rootFiles[qpath]) {
      return;
    }
    // 找到当前文件的所有root
    let fileRoots = Object.keys(findRoot(qpath, originRequiredMap));
    
    allFileRoot[qpath] = fileRoots;
    fileRoots.forEach((root) => {
      // 如果不在定义的入口文件列表中，则跳过
      // 因为可能是废弃的根文件
      if (!rootFiles[root]) {
        return;
      }
      if (!allRootDeps[root]) {
        allRootDeps[root] = {};
      }
      allRootDeps[root][qpath] = true;
    });
  });

  dump(path.join(cube.config.root, 'cube_info.root_module_deps.json'), allRootDeps);
  // 各root文件
  console.log('> export root files:', rootFiles);
  console.log('> all root files (include dynamic load):', Object.keys(allRootDeps));
  console.log('> total files:', files.length);
  console.log('> first class merge reduce files:', Object.keys(mergedFile).length);
  // build common file
  let allRoots = Object.keys(allRootDeps);
  let commonFilesTmp = {};
  let commonFiles = {};

  // 经过一轮合并之后，剩下的文件
  // 统计文件被root文件引用的次数
  allRoots.forEach((k) => {
    let rootF = allRootDeps[k];
    Object.keys(rootF).forEach((k) => {
      if (commonFilesTmp[k] === undefined) {
        commonFilesTmp[k] = 0;
      }
      commonFilesTmp[k] ++;
    });
  });

  // 超过 mergeFactor 的root引用了文件，则合并为公共引用
  let mergeFactor = cube.config.mergeFactor;
  Object.keys(commonFilesTmp).forEach((k) => {
    if (commonFilesTmp[k] >= mergeFactor) {
      commonFiles[k] = true;
    } else {
      // 非公共依赖，则合并到引用的root文件
      let fileRoots = allFileRoot[k];
      let file = fileMap[k];
      let qpath = file.queryPath;
      fileRoots.forEach((root) => {
        if (!rootFiles[root]) {
          return;
        }
        let parent = fileMap[root];
        if (!parent.merges) {
          parent.merges = [];
        }
        parent.merges.push(file);
        mergedFile[qpath] = true;

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

        debug(`[-] merge ${qpath} > ${root}`);
      });
    }
  });

  console.log('> second class merge reduce files:', Object.keys(mergedFile).length);

  // console.log('> common', commonFiles);
  // create virtual common file
  let realName = '/__common__.js';
  let commonQueryPath = utils.moduleName(realName, 'script', cube.config.release, cube.config.remote);
  let cmfile = {
    queryPath: commonQueryPath,
    realPath: '/__common__.js',
    type: 'script',
    code: '',
    codeWraped: '',
    source: '',
    sourceMap: '',
    wrap: true,
    compress: true,
    requires: [],
    requiresOrigin: [],
    merges: []
  };
  Object.keys(commonFiles).forEach((f) => {
    let file = fileMap[f];
    cmfile.merges.push(file);
    mergedFile[f] = true;
  });
  cmfile.genCode = function (cb) {
    cmfile.codeWraped = `Cube('${cmfile.queryPath}',[],function(m){return m.exports});`;
    cb && cb(null, cmfile);
  };

  allRoots.forEach((f) => {
    let file = fileMap[f];
    file.requires.push(commonQueryPath);
  });
  files.push(cmfile);

  let finalfiles = [];

  files.forEach((file) => {
    if (file.requires) {
      file.requires = file.requires.filter((req) => {
        if (mergedFile[req]) {
          return false
        }
        return true;
      });
    }
    if (mergedFile[file.queryPath]) {
      return;
    }
    finalfiles.push(file);
  });

  return finalfiles;
}

/**
 * 寻找某模块的Root
 * @param  {[type]} file     [description]
 * @param  {[type]} reqedMap [description]
 * @return {[type]}          [description]
 */
function findRoot(file, reqedMap) {
  // console.log('> find file require root:', file);
  let count = 0;
  let maxCount = 50000;
  let checkList = [[file, {}]];
  let startNode = file;
  let roots = {};
  while (checkList.length) {
    let tmp = {};
    checkList.forEach((node) => {
      let q = node[0];
      let map = node[1];
      let parents = _.clone(reqedMap[q]);
      // 如果parents不存在，说明到顶了
      if (!parents) {
        roots[q] = true;
        return;
      }
      // 父节点包含起始节点，说明循环了，删除掉该节点，避免死循环
      if (parents[startNode]) {
        delete parents[startNode];
      }
      // parents为空，说明到顶了
      let list = Object.keys(parents);
      if (!list.length) {
        roots[q] = true;
        return;
      }
      list.forEach((key) => {
        if (map[key]) {
          // console.log('>> 循环依赖', map);
          return;
        }
        map[key] = true;
        tmp[key] = _.clone(map);
      });
    });
    let list = [];
    Object.keys(tmp).forEach((k) => {
      list.push([k, tmp[k]]);
    });
    
    checkList = list;
    count++;
    /*
    if (count > maxCount) {
      throw new Error('processMerge > findRoot too many recursion, at:' + file);
    }*/
  }
  delete roots[startNode];
  return roots;
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
 * allInOneCode
 * @param  {Cube}   cube     [description]
 * @param  {Object}   options
 *                       - queryPath
 *                       - compress
 *                       - code
 *                       - concurrent default is 10
 * @param  {Function} callback(err, arr)
 */
/*
function allInOneCode(cube, options, callback) {

  var result = {};
  let concurrent = options.concurrent || 10;

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
      wrap: true,
      ignoreCubeWrap: options.ignoreFirstCodeWrap,
      compress: options.compress !== undefined ? options.compress : cube.config.compress
    };
  }
  function genCode(data, done) {
    data._requires = data.requires.slice(0);
    data.requires = options.requireFilter ? options.requireFilter(data.requires) : [];
    data.genCode(done);
  }
  function process(cube, data, cb) {
    if (result[data.queryPath]) {
      return cb();
    }
    result[data.queryPath] = true;
    async.waterfall([
      function prepare(done) {
        done(null, data);
      },
      cube.readFile.bind(cube),
      cube.transferCode.bind(cube),
      genCode
    ], function (err, data) {
      if (err) {
        return cb(err);
      }
      result[data.queryPath] = data.wrap ? data.codeWraped : data.code;
      if (data._requires && data._requires.length) {
        //可以过滤需要拉取文件的数组
        let _requires = data._requires.slice(0);
        if (options.processFilter) _requires = options.processFilter(_requires);
        async.eachLimit(_requires, concurrent, function (req, done) {
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
    async.eachSeries(result, function (code, done) {
      arr.unshift(code);
      done();
    }, function (err) {
      callback(err, arr);
    });
  });
}
*/

/**
 * allInOneCode, 给定入口文件，返回一个包含所有依赖代码的数组
 * 广度优先遍历，并解决递归stack overflow
 * @param  {Cube}   cube     [description]
 * @param  {Object}   options
 *                       - queryPath
 *                       - compress
 *                       - code
 *                       - concurrent default is 10
 * @param  {Function} callback(err, arr)
 */
function allInOneCode(cube, options, callback) {

  var result = {};
  let concurrent = options.concurrent || 10;

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
      wrap: true,
      ignoreCubeWrap: options.ignoreFirstCodeWrap,
      compress: options.compress !== undefined ? options.compress : cube.config.compress
    };
  }
  function genCode(data, done) {
    data._requires = data.requires ? data.requires.slice(0) : [];
    data.requires = options.requireFilter ? options.requireFilter(data.requires) : [];
    data.genCode(done);
  }
  function getResult() {
    let arr = [];
    Object.keys(result).forEach((key) => {
      arr.unshift(result[key]);
    });
    return arr;
  }
  /**
   * 处理单个文件
   * @param  {Cube}   cube
   * @param  {Object}   data
   * @param  {Function} cb(null, requires)
   */
  function processSingle(cube, data, cb) {
    if (result[data.queryPath]) {
      return cb();
    }
    result[data.queryPath] = true;
    async.waterfall([
      function prepare(done) {
        done(null, data);
      },
      cube.readFile.bind(cube),
      cube.transferCode.bind(cube),
      genCode
    ], function (err, data) {
      if (err) {
        return cb(err);
      }
      result[data.queryPath] = data.wrap ? data.codeWraped : data.code;
      cb(null, data._requires);
    });
  }
  /**
   * 处理数组
   */
  function processArr(arr, cb) {
    let requires = [];
    async.eachLimit(arr, concurrent, (item, done) => {
      if (typeof item === 'string') {
        item = prepare({
          queryPath: item,
          compress: options.compress
        });
      }
      processSingle(cube, item, (err, reqs) => {
        if (err) {
          return cb(err);
        }
        if (reqs && reqs.length) {
          if (options.processFilter) reqs = options.processFilter(reqs);
          requires = requires.concat(reqs);
        }
        done(null);
      });
    }, (err) => {
      if (err) {
        return cb(err);
      }
      cb(null, requires);
    });
  }

  function done(err, requires) {
    if (err) {
      return callback(err);
    }
    if (!requires.length) {
      return callback(null, getResult());
    }
    process.nextTick(() => {
      processArr(requires, done);
    });
  };
  processArr([prepare(options)], done);
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
