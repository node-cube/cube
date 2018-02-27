'use strict';

const path = require('path');
const fs = require('xfs');
const async = require('async');


function placeHolder(module) {
  return `Cube("tmp_${new Date().getTime()}", ["${module}"], function(){});`;
}

class Cache {
  constructor(options) {
    this.tmpDir = options.tmpDir;
    /**
     * cacheKey 索引cache内容
     */
    this._cache = {};
    /**
     * moduleName 索引 cacheKey
     */
    this._modulemap = {};

    if (options.cleanCache) {
      fs.sync().rm(this.tmpDir);
    }

    this.initFromDisk();
  }
  get(key) {
    return this._cache[key] || null;
  }
  set(key, v) {
    this._cache[key] = v;
    this._modulemap[v.queryPath] = key;
    this.saveToDisk(key, v);
  }
  saveToDisk(key, v) {
    fs.save(path.join(this.tmpDir, key), JSON.stringify(v), () => {});
  }
  initFromDisk() {
    fs.walk(this.tmpDir, (err, file, done) => {
      if (err) {
        console.error(err);
      }
      fs.readFile(file, (err, fdata) => {
        if (err) {
          console.error(err);
        } else {
          let data = JSON.parse(fdata);
          let key = file.substr(this.tmpDir.length);
          if (!this._cache[key]) {
            this._cache[key] = data;
            this._modulemap[data.queryPath] = key;
          }
        }
        done();
      });
    }, function () {
      console.log('[CUBE] init cache from disk');
    });
  }
  keys() {
    return Object.keys(this._modulemap);
  }
  getNodeModules(process, done) {
    let modules = this._cache;
    let modulesMap = this._modulemap;
    let mods = Object.keys(modules);

    /**
     * 规则:
     *    1. 检查自己是否过期，过期丢弃
     *    2. 检查自己的依赖是否存在缓存，不存在就占位
     *    3. 清理自己的所有依赖
     */
    async.eachLimit(mods, 10, (key, cb) => {
      let node = modules[key];
      fs.lstat(node.absPath, (err, stats) => {
        if (err) {
          return cb();
        }
        var mtime = new Date(stats.mtime).getTime();
        /**
         * check if cache expired
         */
        if (node.modifyTime !== mtime) {
          delete this._modulemap[node.queryPath];
          delete this._cache[key];
          process(placeHolder(node.queryPath));
          return cb();
        }
        if (!node.codeWraped) {
          return cb();
        }
        let reqs = node.requires;
        reqs && reqs.forEach((v) => {
          if (!modulesMap[v]) {
            process(placeHolder(v));
          }
        });
        process(node.codeWraped.replace(/^(Cube\([^[]+)\[[^\]]+\]/, '$1[]'));
        cb();
      });
    }, done);
  }
}

module.exports = Cache;
