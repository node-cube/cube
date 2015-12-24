var debug = require('debug')('cube');
var path = require('path');
var fs = require('fs');

/**
 * 检查文件列表，找出可能的文件后缀。
 * 如果多个文件匹配，则按processor的注册顺序优先级返回最前的可能
 * @param  {[type]} dirFList        [description]
 * @param  {[type]} fNameWithoutExt [description]
 * @param  {[type]} possibleExts    [description]
 * @return {[type]}                 [description]
 */
exports.getPossibleExt = function (dirFList, fNameWithoutExt, origExt, possibleExts) {
  var tmp, ext, index;
  var matchedExts = [];
  // console.log('>>>>>>>', dirFList, fNameWithoutExt, possibleExts);
  for (var i = 0, len = dirFList.length; i < len; i++) {
    tmp = dirFList[i];
    if (tmp.indexOf(fNameWithoutExt + '.') !== 0) {
      continue;
    }
    ext = tmp.substr(fNameWithoutExt.length);
    if (ext === origExt) {
      return origExt;
    }
    index = possibleExts.indexOf(ext);
    if (index !== -1) {
      matchedExts.push([ext, index]);
    }
  }
  if (!matchedExts.length) {
    debug('file match ext failed, no ext matched');
    return null;
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
    var targetExt = exports.getPossibleExt(arr, fName, origExt, possibleExts);
    if (targetExt === null) {
      var err = new Error('file not found: ' + qpath);
      return callback(err);
    }
    return callback(null, path.join(fPath, fName + targetExt), targetExt, ps ? ps[targetExt] : undefined);
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

/**
 * loading ignore config
 * @param  {String} curPath 寻址的dir, 一般为root目录
 * @return {Object} 配置信息
 */
exports.loadIgnore = function (curPath) {
  var ignoreRules;
  if (!/^(\w:|\/)/.test(curPath)) {
    curPath = path.join(process.cwd(), curPath);
  }
  var ignore = {skip: [], ignore: []};
  var ending = process.platform.match(/^win/) ? /^\w:$/ : /^\/$/;
  while (!ending.test(curPath)) {
    // console.log('>>>>>>', curPath, ending, ending.test(curPath));
    try {
      ignoreRules = fs.readFileSync(path.join(curPath, '.cubeignore')).toString().split(/\r?\n/g);
      console.log('.cubeignore found: ', path.join(curPath, '.cubeignore'));
      break;
    } catch (e) {
      if (e.code === 'ENOENT') {
        curPath = path.dirname(curPath);
      } else {
        e.message = '[CUBE] loading .cubeignore error, ' + e.message;
        console.log(e.message);
        return ignore;
      }
    }
  }

  var cate = 'skip';
  ignoreRules && ignoreRules.forEach(function (v) {
    if (v === '[skip]') {
      cate = 'skip';
      return;
    } else if (v === '[ignore]') {
      cate = 'ignore';
      return;
    }
    if (!v) {
      return;
    }
    if (v.indexOf('/') === 0) {
      v = '^' + v;
    }
    ignore[cate].push(new RegExp(v.replace(/\./g, '\\.').replace(/\*/g, '.*')));
  });
  return ignore;
};

/**
 * 检查是否忽略
 * @param  {String} file    文件名
 * @param  {Object} ignores 配置信息
 * @return {Number} 1: skip, 2: ignore
 */
exports.checkIgnore = function (file, ignores) {
  var flag = {};
  var rule;
  ['skip', 'ignore'].forEach(function (cate) {
    var tmp = ignores[cate];
    var len = tmp.length;
    for (var i = 0; i < len; i++) {
      rule = tmp[i];
      if (rule.test(file)) {
        flag[cate] = true;
        break;
      }
    }
  });

  return flag;
};
