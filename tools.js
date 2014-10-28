var xfs = require('xfs');
var path = require('path');
var ug = require('uglify-js');

function loadIgnore(path) {
  var ignoreRules;
  try {
    ignoreRules = xfs.readFileSync(path).toString().split(/\r?\n/g);
  } catch (e) {
    var msg = '';
    if (e.code === 'ENOENT') {
      msg = '[CUBE] .cubeignore not found, ignore';
    } else {
      msg = e.code + ' ' + e.message;
    }
    console.log(msg);
    return [];
  }
  var _ignore = [];
  ignoreRules.forEach(function (v, i, a) {
    if (!v) {
      return;
    }
    if (v.indexOf('/') === 0) {
      v = '^' + v;
    }
    _ignore.push(new RegExp(v.replace(/\./g, '\\.').replace(/\*/g, '.*')));
  });
  return _ignore;
}

function checkIgnore(file, ignores) {
  var flag = false;
  var rule;
  for (var i = 0; i < ignores.length; i++){
    rule = ignores[i];
    if (rule.test(file)) {
      flag = true;
      break;
    }
  }
  return flag;
}

function processDir(cube, source, dest, opts, cb) {
  if (!dest) {
    return console.log('[ERROR] param missing! dest');
  }
  if (cb === undefined) {
    cb = opts;
    opts = {};
  }
  if (!cb) {
    cb = function () {};
  }
  var st = new Date().getTime();
  var fileCount = 0;
  var ignores = loadIgnore(path.join(source, '.cubeignore'));
  var errors = [];
  var root = cube.config.root;
  xfs.walk(source, function (err, sourceFile) {
    if (err) {
      throw err;
    }
    fileCount ++;

    var relFile = sourceFile.substr(root.length);
    var destFile = path.join(dest, relFile);

    if (/\.min\.(css|js)$/.test(sourceFile) || checkIgnore(relFile, ignores)) {
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      console.log('[copy file]:', relFile.substr(1));
      return;
    }
    processFile(cube, sourceFile, destFile, opts, function (err, info) {
      if (err && err.length) {
        errors.push(err[0]);
      }
    });
  }, function () {
    var end = new Date().getTime();
    cb(errors, {
      total: fileCount,
      time: Math.ceil((end - st) / 1000)
    });
  });
}

function processFile(cube, source, dest, opts, cb) {
  if (!dest) {
    return console.log('[ERROR] param missing! dest');
  }
  if (cb === undefined) {
    cb = opts;
    opts = {};
  }
  if (!cb) {
    cb = function () {};
  }
  var st = new Date().getTime();
  var fileCount = 0;
  var errors = [];
  var root = cube.config.root;

  var relFile = source.substr(root.length);
  var destFile = dest;
  // var destMapFile = path.join(dest, relFile.replace(/\.(\w+)$/, '.map'));
  var fileName = path.basename(relFile);
  var ext = path.extname(relFile);

  var type =  cube.processors.map[ext];
  if (type === undefined) {
    // unknow type, copy file
    xfs.sync().save(destFile, xfs.readFileSync(source));
    console.log('[copy file]:', relFile.substr(1));
    return;
  }
  var ps = cube.processors.types[type];
  var processor = ps[ext];
  var options = {
    moduleWrap: true,
    sourceMap: false,
    compress: true,
    release: cube.config.release,
    root: cube.config.root,
    qpath: relFile,
  };
  var st = new Date().getTime();
  processor.process(relFile, options, function (err, result) {
    if (err) {
      console.log('[ERROR]', err.message);
      errors.push(err);
    } else {
      var finalFile, wrapDestFile, modName;
      if (type === 'script') {
        destFile = destFile.replace(/\.\w+$/, '.js');
        var destSourceFile = destFile.replace(/\.js/, '.source.js');
        xfs.sync().save(destFile, result.code);
        opts.withSource && xfs.sync().save(destSourceFile, result.source);
        console.log('[transfer script]:', relFile.substr(1));
      } else if (type === 'style') {
        finalFile = destFile.replace(/\.\w+$/, '.css');
        wrapDestFile = destFile + '.js';
        modName = relFile + '.js';
        xfs.sync().save(wrapDestFile, result.wraped);
        xfs.sync().save(finalFile, result.code);
        console.log('[transfer style]:', relFile.substr(1));
      } else if (type === 'template') {
        wrapDestFile = destFile + '.js';
        xfs.sync().save(destFile, result.source);
        xfs.sync().save(wrapDestFile, result.wraped);
        console.log('[transfer template]:', relFile.substr(1));
      }
    }
    var end = new Date().getTime();
    cb(errors, {
      total: 1,
      time: Math.ceil((end - st) / 1000)
    });
  });
}
exports.processFile = processFile;
exports.processDir = processDir;