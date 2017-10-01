'use strict';

class  EmptyProcessor {
  constructor(cube) {
    this.cube = cube;
  }
  process(data, callback) {
    callback(null, data);
  }
}

EmptyProcessor.type = 'script';
EmptyProcessor.ext = '.js';

module.exports = EmptyProcessor;
