
'use strict';
const async = require('async');
const path = require('path');
const debug = require('debug')('cube:processor');
const xfs = require('xfs');
const wraper = require('./lib/wraper');

exports.process = function (cube, data, callback) {
  let config = cube.config;
  let qpath = data.queryPath;
  let rpath = data.realPath;
  let flagModuleWrap = data.wrap;
  let flagCompress = data.compress;
  let cachePath = qpath + ':' + flagModuleWrap + ':' + flagCompress + ':' + config.remote;

  function checkCache(done) {
    var tmp = cube.CACHE[cachePath];
    xfs.lstat(path.join(config.root, rpath), function (err, stats) {
      if (err) {
        return done({
          code: 500,
          message: 'read file stats error:' + err.message
        });
      }

      var mtime = new Date(stats.mtime).getTime();
      if (tmp) { // if cached, check cache
        if (tmp.modifyTime === mtime) { // target the cache, just return
          debug('hint cache', rpath);
          return done({code: 'CACHED'}, tmp);
        }
      }
      data.modifyTime = mtime;
      done(null, data);
    });
  }

  function prepareCode(data, done) {
    try {
      data.source = data.code = xfs.readFileSync(path.join(config.root, data.realPath)).toString();
    } catch (e) {
      return done({
        code: 500,
        file: qpath,
        message: 'read file content error:' + e.message
      });
    }
    done(null, data);
  }

  function processResult(err, result) {
    if (err) {
      callback(err, data);
      return;
    }
    var wraperMethod;
    switch(data.type) {
      case 'script':
        try {
          result = wraper.processScript(cube, result);
        } catch (e) {
          return callback(e, result);
        }
        if (flagModuleWrap) {
          wraperMethod = 'wrapScript';
        }
        // utils.setRequires(result.queryPath, result.requires);
        end(null, result);
        break;
      case 'style':
        if (flagModuleWrap) {
          wraperMethod = 'wrapStyle';
        }
        wraper.processStyle(cube, result, end);
        break;
      case 'template':
        if (flagModuleWrap) {
          try {
            result = wraper.processScript(cube, result);
          } catch (e) {
            return callback(e, result);
          }
          wraperMethod = 'wrapScript';
        }
        end(null, result);
        break;
      default:
        callback('unknow type', result);
    }
    function end(err, result) {
      if (err) {
        return callback(err);
      }
      /** build 的时候，启用lazyWrap， 方便确认哪些require需要被转名字 */
      if (config.lazyWrap) {
        result.genCode = function (cb) {
          wraper[wraperMethod](cube, this, function (err, result) {
            if (!err) {
              //cache(result);
            }
            cb(err, result);
          });
        };
        callback(null, result);
      } else if (flagModuleWrap) {
        result.mime = cube.getMIMEType('script');
        wraper[wraperMethod](cube, result, function (err, result) {
          if (!err) {
            cache(result);
          }
          callback(err, result);
        });
      } else {
        cache(result);
        callback(null, result);
      }
    }

    function cache(data) {
      // cache result
      if (cube.config.devCache) {
        debug('cache processed file: %s, %s', result.realPath, result.mtime);
        delete data.ast;
        delete data.processors;
        cube.CACHE[cachePath] = data;
      }
    }
  }

  let actions = [
    checkCache,
    prepareCode
  ];
  async.waterfall(actions, function (err, data) {
    if (err) {
      if (err.code === 'CACHED') {
        callback(err, data);
      } else {
        callback(err, data);
      }
      return;
    }
    var processActions = [
      function (done) {
        debug('start process');
        done(null, data);
      }
    ];
    data.processors.forEach(function (p) {
      var name = p.constructor.name;
      processActions.push(function (d, done) {
        debug('step into processor:' + name);
        p.process(d, done);
      });
    });
    async.waterfall(processActions, processResult);
  });
};
