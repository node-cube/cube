var debug = require('debug')('cube');
var path = require('path');
var fs = require('fs');
exports.seekFile = function(root, qpath, ps, callback) {
  var origExt = path.extname(qpath);
  var fName = path.basename(qpath, origExt);
  var fPath = path.dirname(qpath);
  var dir = path.join(root, fPath);
  var watchedExts = Object.keys(ps);
  fs.readdir(dir, function (err, arr) {
    var tmp, ext, index;
    var matchedExts = [];
    if (err) {
      return callback(err, null);
    }
    for(var i = 0, len = arr.length; i < len; i++) {
      tmp = arr[i];
      if (tmp.indexOf(fName + '.') !== 0) {
        continue;
      }
      ext = tmp.substr(fName.length);
      index = watchedExts.indexOf(ext);
      if (index !== -1) {
        matchedExts.push([ext, index]);
      }
    }
    if (!matchedExts.length) {
      err = new Error('file not found! ' + qpath);
      err.code = 'FILE_NOT_FOUND';
      return callback(err);
    }
    ext = '';
    index = -1;
    matchedExts.forEach(function (v) {
      if (v[1] > index) {
        ext = v[0];
        index = v[1];
      }
    });
    if (matchedExts.length > 1) {
      debug('multi-file with same name but different ext', matchedExts);
    }

    return callback(null, fPath + '/' + fName + ext, ext, ps[ext]);
  });
};

exports.merge = function (target, source) {
  Object.keys(source).forEach(function (key) {
    target[key] = source[key];
  });
};