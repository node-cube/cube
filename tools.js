var xfs = require('xfs');
var path = require('path');
var requires = require('requires');


function Done(total, done) {
  var count = 0;
  return function () {
    count++;
    if (total === count) {
      done();
    }
  };
}

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
  var ignore = [];
  ignoreRules.forEach(function (v, i, a) {
    if (!v) {
      return;
    }
    if (v.indexOf('/') === 0) {
      v = '^' + v;
    }
    ignore.push(new RegExp(v.replace(/\./g, '\\.').replace(/\*/g, '.*')));
  });
  return ignore;
}

function checkIgnore(file, ignores) {
  var flag = false;
  var rule;
  for (var i = 0; i < ignores.length; i++) {
    rule = ignores[i];
    if (rule.test(file)) {
      flag = true;
      break;
    }
  }
  return flag;
}

function analyseNoduleModules(fpath, map, done) {
  var modules = xfs.readdirSync(fpath);
  var count = modules.length;
  var c = 0;
  var mlist = [];

  modules.forEach(function (mname) {
    if (mname === '.bin') {
      return;
    }
    mlist.push(mname);
  });
  var d = Done(mlist.length, done);
  mlist.forEach(function (mname) {
    var mpath = path.join(fpath, mname);
    analyseModule(mpath, map, function () {
      c++;
      d();
    });
  });
}

function analyseModule(mpath, map, done) {
  //console.log(mpath);
  var stat = xfs.statSync(mpath);
  if (!stat.isDirectory()) {
    return done();
  }
  var pkgInfo;
  var d;
  try {
    pkgInfo = JSON.parse(xfs.readFileSync(path.join(mpath, 'package.json')));
  } catch (e) {
    return analyseNoduleModules(mpath, map, done);
  }
  if (!pkgInfo.main) {
    if (xfs.existsSync(path.join(mpath, 'index.js'))) {
      pkgInfo.main = 'index.js';
    }
  }
  if (!pkgInfo.main) {
    if (xfs.existsSync(path.join(mpath, 'node_modules'))) {
      d = Done(2, done);
      analyseNoduleModules(path.join(mpath, 'node_modules'), map, d);
    } else {
      d = Done(1, done);
    }
    // console.log('package.main not found');
    xfs.walk(mpath, function (fpath) {
      if (/node_modules\/?$/.test(fpath)) {
        return false;
      } else if (/(\.md|\/\.\w+)$/ig.test(fpath)) {
        return false;
      }
      return true;
    }, function (err, file) {
      map[file] = true;
    }, function () {
      d();
    });
  } else {
    d = Done(2, done);
    var mainScript = require.resolve(path.join(mpath, pkgInfo.main));
    analyseRequires(mainScript, map, d);
    // add the rest file
    xfs.walk(mpath, function (fpath) {
      if (/node_modules\/?$/.test(fpath)) {
        return false;
      } else if (!/\.(png|jpg|gif|json|svg)$/ig.test(fpath)) {
        return false;
      }
      return true;
    }, function (err, file) {
      map[file] = true;
    }, d);
  }
}

function analyseRequires(script, map, done) {
  map[script] = true;
  var fstr = xfs.readFileSync(script).toString();
  var list = requires(fstr);
  var list1 = [];
  var list2 = [];
  list.forEach(function (n) {
    var p = n.path;
    if (!/^[\/\.]/.test(p)) {
      p = 'node_modules/' + p;
      p = path.join(path.dirname(script), p);
      if (xfs.existsSync(p)) {
        list2.push(p);
      }
      return;
    }
    var realp = require.resolve(path.join(path.dirname(script), p));
    map[realp] = true;
    list1.push(realp);
  });
  var totalLen = list1.length + list2.length;
  if (totalLen === 0) {
    return done();
  }
  var d = Done(totalLen, done);
  list1.forEach(function (p) {
    analyseRequires(p, map, d);
  });
  list2.forEach(function (p) {
    analyseModule(p, map, d);
  });
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

  var nodeModulesMap = {};

  // analyseNoduleModules(path.join(source, 'node_modules'), nodeModulesMap, function () {
  xfs.walk(source, function (err, sourceFile) {
    if (err) {
      throw err;
    }
    fileCount++;

    var relFile = fixWinPath(sourceFile.substr(root.length));
    var destFile = path.join(dest, relFile);

    if (/\.min\.(css|js)$/.test(sourceFile) || checkIgnore(relFile, ignores)) {
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      console.log('[copy file]:', relFile.substr(1));
      return;
    }
    try {
      processFile(cube, sourceFile, destFile, opts, function (err, info) {
        if (err && err.length) {
          errors.push(err[0]);
        }
      });
    } catch (e) {
      if (/node_modules/.test(sourceFile)) {
        // ignore the error
        errors.push(e);
      } else {
        throw e;
      }
    }
  }, function () {
    var end = new Date().getTime();
    cb(errors, {
      total: fileCount,
      time: Math.ceil((end - st) / 1000)
    });
  });
  // });
}
/**
 * processFile
 * @param  {Cube}   cube   cube instance
 * @param  {Path}   source the abs source file
 * @param  {Path}   dest   this abs target file
 * @param  {Object}   opts
 * @param  {Function} cb(err, res)
 */
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
  // var fileCount = 0;
  var errors = [];
  var root = cube.config.root;

  var relFile = fixWinPath(source.substr(root.length));
  var destFile = dest;
  // var destMapFile = path.join(dest, relFile.replace(/\.(\w+)$/, '.map'));
  // var fileName = path.basename(relFile);
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
    compress: cube.config.compress,
    release: cube.config.release,
    root: cube.config.root,
    qpath: relFile
  };
  // var st = new Date().getTime();
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

function fixWinPath(fpath) {
  return fpath.replace(/\\/g, '/');
}

exports.processFile = processFile;
exports.processDir = processDir;
