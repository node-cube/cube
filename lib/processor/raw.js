'use strict';

class  HtmlProcessor{
  constructor(cube) {
    this.cube = cube;
  }
  process(data, callback) {
    callback(null, data);
  }
}

HtmlProcessor.type = 'script';
HtmlProcessor.ext = '.txt';

module.exports = HtmlProcessor;
