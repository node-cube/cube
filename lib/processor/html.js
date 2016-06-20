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

HtmlProcessor.type = 'template';
HtmlProcessor.ext = '.html';

module.exports = HtmlProcessor;
