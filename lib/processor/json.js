'use strict';

class JSONProcessor{
  constructor(cube) {
    this.cube = cube;
  }
  process(data, callback) {
    callback(null, data);
  }
}

JSONProcessor.type = 'json';
JSONProcessor.ext = '.json';

module.exports = JSONProcessor;
