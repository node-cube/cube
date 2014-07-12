var fs = require('fs');
var path = require('path');
var stylus = require('stylus');

function process(root, file, options) {
  var code = fs.readFileSync(path.join(root, file)).toString();
  var codeRes = stylus.render(code, {compress: options.compress});
  var res = {
    source: codeRes,
    min: codeRes
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