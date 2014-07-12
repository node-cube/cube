var fs = require('fs');
var path = require('path');
var css = require('clean-css');

function process(root, file, options) {
  var code = fs.readFileSync(path.join(root, file)).toString();
  if (!options.compress) {
    return {
      source: code
    };
  }
  var codeMin = new css({
    compatibility: true,
    noAdvanced: true,
    keepSpecialComments: 0
  }).minify(code);

  var res = {
    source: code,
    min: codeMin
  };
  return res;
}

module.exports = function (root, file, options, callback) {
  try {
    var res = process(root, file, options);
    callback(null, res);
  } catch (err) {
    err.message = '[CUBE] process css file error' + err.message + ' ' + file;
    callback(err);
  }
};

exports.process = process;