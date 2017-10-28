'use strict';

const fs = require('fs');
const async = require('async');


function placeHolder(module) {
  return `Cube("tmp_${new Date().getTime()}", ["${module}"], function(){});`;
}

class Cache {
  constructor() {
    this._cache = {};
    this._modulemap = {};
  }
  get(key) {
    return this._cache[key] || null;
  }
  set(key, v) {
    this._cache[key] = v;
    this._modulemap[v.queryPath] = key;
  }
  getNodeModules(process, done) {
    let modules = this._cache;
    let modulesMap = this._modulemap;
    let mods = Object.keys(modules);

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
            process(placeHolder(node.queryPath));
          }
        });
        process(node.codeWraped.replace(/^(Cube\([^\[]+)\[[^\]]+\]/, '$1[]'));
        cb();
      });
    }, done);
  }
}

module.exports = Cache;
