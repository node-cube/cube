var xfs = require('xfs');
var path = require('path');
var requires = require('requires');
var utils = require('./lib/utils');


function Done(total, done) {
  var count = 0;
  return function () {
    count++;
    if (total === count) {
      done();
    }
  };
}

function analyseNoduleModules(fpath, map, done) {
  var modules = xfs.readdirSync(fpath);
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
  var ignores = utils.loadIgnore(source);
  var errors = [];
  var root = cube.config.root;

  // analyseNoduleModules(path.join(source, 'node_modules'), nodeModulesMap, function () {
  xfs.walk(source, function (err, sourceFile) {
    if (err) {
      throw err;
    }
    fileCount++;

    var relFile = fixWinPath(sourceFile.substr(root.length));
    var destFile = path.join(dest, relFile);
    var checked = utils.checkIgnore(relFile, ignores);
    /*
    if (/\.min\.(css|js)$/.test(sourceFile)) {
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      console.log('[copy file]:', relFile.substr(1));
      return;
    }
    */
    if (checked.ignore) {
      console.log('[ignore file]:', relFile.substr(1));
      return;
    } else if (checked.skip) {
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      console.log('[copy file]:', relFile.substr(1));
      return;
    }

    try {
      processFile(cube, sourceFile, destFile, opts, function (err) {
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
    console.log('[copying file]:', relFile.substr(1));
    xfs.sync().save(destFile, xfs.readFileSync(source));
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
  console.log('[transfer ' + type + ']:', relFile.substr(1));
  // var st = new Date().getTime();
  processor.process(relFile, options, function (err, result) {
    if (err) {
      console.log('[ERROR]', err.message);
      errors.push(err);
    } else {
      var finalFile, wrapDestFile;
      if (type === 'script') {
        destFile = destFile.replace(/\.\w+$/, '.js');
        var destSourceFile = destFile.replace(/\.js/, '.source.js');
        xfs.sync().save(destFile, result.code);
        opts.withSource && xfs.sync().save(destSourceFile, result.source);
      } else if (type === 'style') {
        finalFile = destFile.replace(/\.\w+$/, '.css');
        wrapDestFile = destFile + '.js';
        xfs.sync().save(wrapDestFile, result.wraped);
        xfs.sync().save(finalFile, result.code);
      } else if (type === 'template') {
        wrapDestFile = destFile + '.js';
        xfs.sync().save(destFile, result.source);
        xfs.sync().save(wrapDestFile, result.wraped);
      }
    }
    var end = new Date().getTime();
    cb(errors, {
      total: 1,
      requires: result ? result.requires : [],
      time: Math.ceil((end - st) / 1000)
    });
  });
}

function fixWinPath(fpath) {
  return fpath.replace(/\\/g, '/');
}

exports.processFile = processFile;
exports.processDir = processDir;
