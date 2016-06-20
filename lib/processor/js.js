'use strict';

class JsProcessor {
  constructor (cube) {
    this.cube = cube;
  }
  process (data, callback) {
    callback(null, data);
  }
}

JsProcessor.type = 'script';
JsProcessor.ext = '.js';
JsProcessor.deps = {};

module.exports = JsProcessor;
