'use strict';

const path = require('path');
const fs = require('fs');
const async = require('async');
const debug = require('debug')('cube:api');
const utils = require('../utils');

module.exports = {
  /**
   * 文件寻址
   * @interface 支持重写此方法，以实现不同寻常的文件寻址方式
   */
  seekFile(data, callback) {
    let qpath = data.queryPath;
    let root = this.config.root;

    let origExt = path.extname(qpath);
    let qDir = path.dirname(qpath);
    let qBaseName = path.basename(qpath, origExt);
    let absDir = path.join(root, qDir);

    let type = this.extMap[origExt];
    if (!type) {
      if (this.config.passUnknowExt) {
        return callback({code: 'PASS_UNKNOW_EXT'});
      } else {
        let msg = 'unknow type of queryfile: ' + qpath;
        msg += ', all registered ext:' + Object.keys(this.extMap);
        msg += ', you can setup cube by `options.passUnknowExt: true` to ignore this error';
        let err = new Error(msg);
        err.code = 'UNKNOW_TYPE';
        return callback(err);
      }
    }
    let possibleExts = Object.keys(this.processors[type]); // 列出所有注册在这个类型下的文件后缀

    debug('seekFile, type: %s ,qpath: %s, possibleExts: %s', type, qpath, possibleExts);
    fs.readdir(absDir, (err, arr) => {
      if (err) {
        return callback(err, null);
      }
      let targetExt = utils.getPossibleExt(this, arr, qBaseName, origExt, possibleExts);
      if (targetExt === null) {
        err = new Error(`seeking possible exts: ${possibleExts}, but file still not found: ${qpath}`);
        err.code = 'FILE_NOT_FOUND';
        return callback(err);
      }
      let realPath = path.join(qDir, qBaseName + targetExt);

      // 在这个seekFile中，必须补全的信息，如下：
      data.type = type;
      data.mime = this.getMIMEType(type);
      data.ext = origExt;
      data.targetExt = targetExt;
      data.realPath = realPath;
      data.absPath = path.join(root, realPath);

      if (!data.modifyTime) {
        let stats = fs.lstatSync(data.absPath);
        data.modifyTime = new Date(stats.mtime).getTime();
      }


      debug('seek file: %s realpath: %s type: %s %s', qpath, realPath, type, data.mime);
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
        data.code = data.source = content.toString();
        callback(null, data);
      }
    });
  },
  /**
   * 处理文件转换
   */
  transferCode(data, callback) {
    let flagModuleWrap = data.wrap;
    let self = this;

    let processActions = [
      function (done) {
        debug('start process');
        done(null, data);
      }
    ];
    let targetExt = data.targetExt;
    let type = data.type;
    let realPath = data.realPath;
    let processors = this.processors[type][targetExt];
    if (!processors) {
      let err = new Error(`unknow file ext, no processor match, ext: ${targetExt}, realFile: ${realPath}`);
      err.code = 'UNKNOW_FILE_EXT';
      return callback(err);
    }
    processors.forEach(function (p) {
      var name = p.constructor.name;
      processActions.push(function (d, done) {
        debug('step into processor:' + name);
        p.process(d, done);
      });
    });
    /** 处理 */
    processActions.push(function processResult(data) {
      debug('custom process all done');
      var wraperMethod;
      switch(data.type) {
        case 'script':
          if (flagModuleWrap) {
            wraperMethod = 'wrapScript';
          }
          self.processScript(data, end);
          break;
        case 'style':
          if (flagModuleWrap) {
            wraperMethod = 'wrapStyle';
          }
          self.processStyle(data, end);
          break;
        case 'template':
          if (flagModuleWrap) {
            wraperMethod = 'wrapScript';
          }
          self.processTemplate(data, end);
          break;
        default:
          callback('unknow type', data);
      }
      function end(err, result) {
        if (err) {
          return callback(err);
        }
        if (flagModuleWrap) {
          result.mime = self.getMIMEType('script');
        }
        result.genCode = function (cb) {
          if (wraperMethod) {
            self[wraperMethod](this, cb);
          } else {
            cb(null, this);
          }
        };
        callback(null, result);
      }
    });
    async.waterfall(processActions, callback);
  }
};
