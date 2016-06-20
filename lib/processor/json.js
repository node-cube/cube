'use strict';

class JSONProcessor{
  constructor(cube) {
    this.cube = cube;
  }
  process(data, callback) {
    data.code = 'module.exports = function () {return ' + data.code + ';}';
    callback(null, data);
  }
}

JSONProcessor.type = 'script';
JSONProcessor.ext = '.json';

module.exports = JSONProcessor;
