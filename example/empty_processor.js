'use strict';

class  EmptyProcessor {
  constructor(cube, config) {
    this.cube = cube;
    this.config = config;
  }
  process(data, callback) {
    callback(null, data);
  }
}

EmptyProcessor.type = 'script';
EmptyProcessor.ext = '.js';

module.exports = EmptyProcessor;
