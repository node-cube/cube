'use strict';

class  HtmlProcessor{
  constructor(cube) {
    this.cube = cube;
  }
  process(data, callback) {
    data.code = 'module.exports = function () {return ' + JSON.stringify(data.code) + ';}';
    callback(null, data);
  }
}

HtmlProcessor.type = 'script';
HtmlProcessor.ext = '.txt';

module.exports = HtmlProcessor;
