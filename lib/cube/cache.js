'use strict';

const path = require('path');
const fs = require('xfs');
const async = require('async');


function placeHolder(module) {
  return `Cube("no-cached", ${JSON.stringify(module)}, function(){});`;
}

class Cache {
  constructor(options) {
    this.tmpDir = options.tmpDir;
    /**
     * moduleName 索引 cacheKey
     */
    this._modulemap = {};
    /**
     * cacheKey 索引cache内容
     */
    this._cache = {};
    if (options.cleanCache) {
      fs.sync().rm(this.tmpDir);
    }

    this.initFromDisk();
  }
  get(key) {
    if (this._cache[key]) return this._cache[key];
    try {
      const data = JSON.parse(fs.readFileSync(path.join(this.tmpDir, key), 'utf8'));
      this._cache[key] = data;
      this._modulemap[data.queryPath] = key;
      return data;
    } catch (e) {
      return null;
    }
  }
  set(key, v) {
    delete v.source;
    this._cache[key] = v;
    this._modulemap[v.queryPath] = key;
    this.saveToDisk(key, v);
  }
  clean(cb) {
    this._cache = {};
    this._modulemap = {};
    fs.rm(this.tmpDir, cb);
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
          let data;
          try {
            data = JSON.parse(fdata);
          } catch (e) {
            // parse error 的文件就不要了
            return;
          }
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
  getNodeModules(process, done) {
    let modules = this._cache;
    let mods = Object.keys(modules);
    let modulesMap = this._modulemap;
    let rest = {};
    /**
     * 规则:
     *    1. 检查自己是否过期，过期丢弃
     *    2. 检查自己的依赖是否存在缓存，不存在就占位
     *    3. 清理自己的所有依赖
     */
    async.eachLimit(mods, 32, (key, cb) => {
      let node = modules[key];
      if (!/^\/node_modules\//.test(node.queryPath)) {
        return cb();
      }
      fs.lstat(node.absPath, (err, stats) => {
        if (err) {
          return cb();
        }
        var mtime = new Date(stats.mtime).getTime();
        /**
         * check if cache expired
         */
        if (node.modifyTime !== mtime) {
          delete this._cache[key];
          rest[node.queryPath] = true;
          return cb();
        }
        /*
        if (
          node.modifyTime >= new Date().getTime() - 10800000
        ) {
          rest[node.queryPath] = true;
          return cb();
        }
        */
        let reqs = node.requires;
        reqs && reqs.forEach((v) => {
          if (!modulesMap[v]) {
            rest[v] = true;
          }
        });
        process(node.code.replace(/^(Cube\([^,]+,) *(\[[^\]]+\] *,)?/s, '$1'));
        cb();
      });
    }, () => {
      process(placeHolder(Object.keys(rest)));
      done();
    });
  }
}

module.exports = Cache;
