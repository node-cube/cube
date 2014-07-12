var fs = require('fs');
var path = require('path');
var less = require('less');

function process(root, file, options) {
  var code = fs.readFileSync(path.join(root, file)).toString();
  var codeRes;
  var lessParser = new(less.Parser)({
    paths: [root]
  });
  lessParser.parse(code, function (err, tree) {
    if (err) {
      console.log(err);
      throw err;
    }

    codeRes = tree.toCSS({
      compress: options.compress
    });
  });
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