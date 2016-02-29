var fs = require('fs');
var path = require('path');
var Css = require('clean-css');

function CssProcessor(cube) {
  this.cube = cube;
}

CssProcessor.type = 'style';
CssProcessor.ext = '.css';

CssProcessor.prototype = {
  process: function (data, callback) {
    callback(null, data);
  }
};

module.exports = CssProcessor;
