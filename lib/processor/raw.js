'use strict';
/**
 * 原始字符串类型的模块，都可以使用此processor来处理
 */
class DefaultProcessor{
  constructor(cube) {
    this.cube = cube;
  }
  process(data, callback) {
    data.code = 'module.exports = function () {return ' + JSON.stringify(data.code) + ';}';
    callback(null, data);
  }
}

DefaultProcessor.type = 'raw';
DefaultProcessor.ext = '*';

module.exports = DefaultProcessor;
