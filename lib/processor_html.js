/*!
 * cube: lib/csscombine.js
 * Authors  : Fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
function HtmlProcessor(cube) {
  this.cube = cube;
}

HtmlProcessor.type = 'template';
HtmlProcessor.ext = '.html';

HtmlProcessor.prototype = {
  process: function (data, callback) {
    data.code = 'module.exports = function () {return ' + JSON.stringify(data.code) + ';}';
    callback(null, data);
  }
};

module.exports = HtmlProcessor;