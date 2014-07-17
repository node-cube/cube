var G = require('./global');
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

function processDir(source, dest, options, cb) {
  if (!dest) {
    return console.log('[ERROR] param missing! dest');
  }
  if (cb === undefined) {
    cb = options;
    options = {};
  }
  if (!cb) {
    cb = function () {};
  }
  var st = new Date().getTime();
  var fileCount = 0;
  var ignores = loadIgnore(path.join(source, '.cubeignore'));
  var errors = [];
  xfs.walk(source, function (err, sourceFile) {
    if (err) {
      throw err;
    }
    var relFile = sourceFile.substr(source.length);
    var destFile = path.join(dest, relFile);
    // var destMapFile = path.join(dest, relFile.replace(/\.(\w+)$/, '.map'));
    var fileName = path.basename(relFile);
    var ext = path.extname(relFile);
    fileCount ++;
    // if already minifyed, ignore it
    if (/\.min\.(css|js)$/.test(fileName) || checkIgnore(relFile, ignores)) {
      // copy file
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      console.log('[copy file]:', relFile.substr(1));
      return;
    }
    var type =  G.processors.map[ext];
    if (type === undefined) {
      // unknow type, copy file
      xfs.sync().save(destFile, xfs.readFileSync(sourceFile));
      console.log('[copy file]:', relFile.substr(1));
      return;
    }
    var ps = G.processors.types[type];
    var processor = ps[ext];
    // lazy loading processing
    if (typeof processor === 'string') {
      try {
        processor = require(processor);
        G.processors.types[type][ext] = processor;
      } catch (e) {
        e.message = 'loading transform error: type:`' + type + '` ext:`' + ext + '`';
        e.code = 'CUBE_LOADING_TRANSFORM_ERROR';
        errors.push(e);
      }
    }
    var options = {
      moduleWrap: true,
      sourceMap: false,
      compress: true,
      buildInModule: G.buildInModule,
      release: true
    };
    processor(source, relFile, options, function (err, result) {
      if (err) {
        console.log('[ERROR]', err.message);
        return errors.push(err);
      }
      var finalFile, wrapDestFile, wrapCode, modName;
      if (type === 'script') {
        destFile = destFile.replace(/\.\w+$/, '.js');
        var destSourceFile = destFile.replace(/\.js/, '.source.js');
        xfs.sync().save(destFile, result.min);
        xfs.sync().save(destSourceFile, result.source);
        console.log('[transfer script]:', relFile.substr(1));
      } else if (type === 'style') {
        finalFile = destFile.replace(/\w+$/, 'css');
        wrapDestFile = destFile + '.js';
        modName = relFile + '.js';
        wrapCode = 'Cube("' + modName + '",[],function(){return ' + JSON.stringify(result.min) + '});';
        xfs.sync().save(wrapDestFile, wrapCode);
        xfs.sync().save(finalFile, result.min);
        console.log('[transfer style]:', relFile.substr(1));
      } else if (type === 'template') {
        wrapDestFile = destFile + '.js';
        xfs.sync().save(destFile, result.source);
        xfs.sync().save(wrapDestFile, result.wrap);
        console.log('[transfer template]:', relFile.substr(1));
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
exports.processDir = processDir;
/**
 * transfer js module to browserify node
 * @param  {[type]} file     [description]
 * @param  {[type]} base     [description]
 * @param  {[type]} compress [description]
 * @param  {[type]} merge    [description]
 * @return {[type]}          [description]
 */
exports.buildJs = function (file, base, compress, merge) {

};
exports.minifyJs = function (file, outfile) {
  var destCode = ug.minify();
};
exports.buildTpl = function (file, base, compress) {

};
exports.buildCss = function (file, compress) {
  return ;
};