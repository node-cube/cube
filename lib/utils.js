var debug = require('debug')('cube');
var path = require('path');
var fs = require('fs');

exports.traverseFList = function (arr, fName, possibleExts) {
  var tmp, ext, index;
  var matchedExts = [];
  for (var i = 0, len = arr.length; i < len; i++) {
    tmp = arr[i];
    if (tmp.indexOf(fName + '.') !== 0) {
      continue;
    }
    ext = tmp.substr(fName.length);
    index = possibleExts.indexOf(ext);
    if (index !== -1) {
      matchedExts.push([ext, index]);
    }
  }
  if (!matchedExts.length) {
    var err = new Error();
    err.name = err.code = 'FILE_NOT_FOUND';
    return err;
  }
  if (matchedExts.length > 1) {
    debug('more then one file with same fileName but different ext', matchedExts);
    console.log('[WARN] more then one file with same fileName but different ext', matchedExts);
  }
  ext = '';
  index = possibleExts.length;
  matchedExts.forEach(function (v) {
    if (v[1] < index) {
      ext = v[0];
      index = v[1];
    }
  });
  return ext;
};

exports.seekFile = function(cube, root, qpath, ps, callback) {
  var origFile = path.join(root, qpath);
  var origExt = path.extname(qpath);
  var fPath = path.dirname(qpath);
  var fName = path.basename(qpath, origExt);
  var dir = path.join(root, fPath);
  if (fs.existsSync(origFile)) {
    return callback(null, qpath, origExt, ps ? ps[origExt] : undefined);
  }
  var type = cube.processors.map[origExt];
  var possibleExts = Object.keys(cube.processors.types[type]);
  debug('seekFile, type: %s ,qpath: %s, possibleExts: %s', type, qpath, possibleExts);
  fs.readdir(dir, function (err, arr) {
    if (err) {
      return callback(err, null);
    }
    var targetExt = exports.traverseFList(arr, fName, possibleExts);
    if (targetExt instanceof Error) {
      targetExt.message = 'file not found: ' + qpath;
      return callback(targetExt);
    }
    return callback(null, fPath + '/' + fName + targetExt, targetExt, ps ? ps[targetExt] : undefined);
  });
};

exports.merge = function (target, source) {
  Object.keys(source).forEach(function (key) {
    target[key] = source[key];
  });
};
/**
 * update module name change
 * @param  {Path} file      the require filename
 * @param  {Boolean} ifRelease two model: dev or release
 * @return {Path} targetFileName
 */
exports.moduleName = function(file, type, ifRelease, remote) {
  if (!ifRelease) {
    return remote ? remote + ':' + file : file;
  }
  if (type === 'script') {
    // change all script type to .js file
    file = file.replace(/\.\w+$/, '.js');
  } else if (type === 'style') {
    // add .js suffix to style file
    file = file + '.js';
  } else if (type === 'template') {
    // add .js suffix to template file
    file = file + '.js';
  }
  return remote ? remote + ':' + file : file;
};