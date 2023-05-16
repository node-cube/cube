'use strict';

const path = require('path');
const fs = require('fs');
const async = require('async');
const debug = require('debug')('cube:api');
const utils = require('../utils');

/**
 * Cube methods, mix in 
 */

module.exports = {
  /**
   * 转换文件, 主入口
   */
  transform(queryPath, callback) {
    async.waterfall([
      /**
       * 创建新文件对象
       */
      this.newFile.bind(this, queryPath),
      /**
       * 检查缓存
       */
      this.checkCache.bind(this),
      /**
       * 寻找源码文件
       */
      this.seekFile.bind(this),
      /**
       * 读取源码文件
       */
      this.readFile.bind(this),
      /**
       * 转换代码
       */
      this.processFile.bind(this),
      /**
       * 设置缓存
       */
      this.setCache.bind(this)
    ], callback);
  },
  /**
   * 初始化一个文件对象，用于后面的处理
   * @return {[type]} [description]
   */
  newFile(qpath, callback) {
    // TODO qpath = /../../../ 处理路径中的../
    let data = {
      queryPath: qpath,           // 查询的原始路径，绝对http路径, 从静态资源的跟目录开始计算
      realPath: '',               // 真实文件路径path，相对于rootPath的文件路径
      absPath: '',                // 真实文件的绝对路径
      ext: '',
      type: '',                   // 文件类型
      source: '',                 // 源码
      code: '',                   // 文件代码
      sourceMap: '',              // 源码的sourceMap
      modifyTime: 0,              // 修改时间，检测缓存用
      namespace: this.namespace   // 命名空间
    };
    let ext = path.extname(qpath);
    let type = this.typeMap[ext];
    if (!ext) {
      type = 'script';
      // 默认为script类型，随机赋予一个ext即可，后面seek的时候会去猜测
      ext = this.typeMap[type][0];
    }
    if (!type || !ext) {
      // unknow file,
      let msg = 'unknow type of queryfile: ' + qpath;
        msg += ', all registered ext:' + Object.keys(this.extMap);
        msg += ', you can setup cube by `options.passUnknowExt: true` to ignore this error';
      return callback({code: 'UNKNOW_TYPE', message: msg});
    }
    data.type = type;
    data.ext = ext;

    const handler = {
      set(target, property, value) {
        if (!(property in target)) {
          throw new Error('Cannot add new properties.');
        }
        return Reflect.set(target, property, value);
      }
    };
    const pData = new Proxy(data, handler);
    callback(null, pData);
  },
  checkCache(data, callback) {
    let config = this.config;
    if (!config.cache) {
      return callback(null, data);
    }
    let cachePath = data.queryPath + ':' + (config.remote || '-');
    let cacheData = this.caches.get(cachePath);
    if (cacheData) {
      return callback(null, cacheData);
    }
    xfs.lstat(cacheData.absPath, function (err, stats) {
      if (err) {
        return callback({
          code: 'CHECK_CACHE_FILE_ERROR',
          message: 'read file stats error:' + err.message
        });
      }
      var mtime = new Date(stats.mtime).getTime();
      if (cacheData.modifyTime === mtime) { // target the cache, just return
        debug('hint cache', cachePath);
        return done(null, cacheData);
      }
      data.modifyTime = mtime;
      callback(null, data);
    });
  },
  /**
   * 文件寻址
   * @interface 支持重写此方法，以实现不同寻常的文件寻址方式
   */
  seekFile(data, callback) {
    let root = this.config.root;
    let qpath = data.queryPath;
    let qDir = path.dirname(qpath);
    let qBaseName = path.basename(qpath, data.ext);
    let realDir = path.join(root, qDir);
    let possibleExts = this.typeMap[data.type]; // 列出所有注册在这个类型下的文件后缀
    debug('seekFile, type: %s ,qpath: %s, possibleExts: %s', type, qpath, possibleExts);
    fs.readdir(realDir, (err, arr) => {
      if (err) {
        return callback(err, null);
      }
      let targetExt = utils.getPossibleExt(this, arr, qBaseName, data.ext, possibleExts);
      if (targetExt === null) {
        err = new Error(`seeking possible exts: ${possibleExts}, but file still not found: ${qpath}`);
        err.code = 'FILE_NOT_FOUND';
        return callback(err);
      }
      let realPath = path.join(qDir, qBaseName + targetExt);
      // update data info
      data.ext = targetExt;
      data.realPath = realPath;
      data.absPath = path.join(root, realPath);
      if (!data.modifyTime) {
        let stats = fs.lstatSync(data.absPath);
        data.modifyTime = new Date(stats.mtime).getTime();
      }
      debug('seek file: %s realpath: %s type: %s modifyTime: %s', qpath, realPath, data.type, data.modifyTime);
      callback(null, data);
    });
  },
  /**
   * 读取文件
   * @interface 支持重写此方法，以支持不同寻常的文件读取方式
   */
  readFile(data, callback) {
    let config = this.config;
    let absPath = path.join(config.root, data.realPath);
    fs.readFile(absPath, function (err, content) {
      if (err) {
        err.code = 'READ_FILE_ERROR';
        return callback(err);
      } else {
        // TODO 文件编码
        data.code = data.source = content.toString();
        callback(null, data);
      }
    });
  },
  /**
   * 处理文件转换
   */
  processFile(data, callback) {
    let self = this;
    let processActions = [
      function (done) {
        debug('start process');
        done(null, data);
      }
    ];
    let ext = data.ext;
    let type = data.type;
    let realPath = data.realPath;
    let processors = this.processors[ext];
    if (!processors) {
      let err = new Error(`unknow file ext, no processor match, ext: ${targetExt}, realFile: ${realPath}`);
      err.code = 'UNKNOW_FILE_EXT';
      return callback(err);
    }
    processors.forEach(function (p) {
      var name = p.constructor.name;
      processActions.push(function (d, done) {
        debug('start processor:' + name);
        p.process(d, function(err, data) {
          debug('end processor:' + name);
          done(err, data);
        });
      });
    });
    /** 
     * 最后的处理，wrap / transform
     */
    processActions.push(function (data, done) {
      debug('custom process all done');
      switch(data.type) {
        case 'script':
          self.processScript(data, end);
          break;
        case 'style':
          self.processStyle(data, end);
          break;
        case 'json':
          self.processJson(data, end);
        case 'text':
          self.processText(data, end);
          break;
        case 'image':
          // TODO 
          self.processImage(data, end);
        default:
          done('unknow type', data);
      }
      function end(err, data) {
        if (err) {
          return done(err, data);
        }
        done(null, data);
      }
    });
    async.waterfall(processActions, callback);
  },
  /**
   * set up cache
   */
  setCache(data, callback) {
    let config = this.config;
    if (config.cache) {
      let cachePath = data.queryPath + ':' + (config.remote || '-');
      cube.caches.set(cachePath, data);
      debug('cache processed file: %s, %s', cachePath, data.modifyTime);
    }
    callback(null, data);
  }
};
