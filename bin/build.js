#!/usr/bin/env node
'use strict';
const fs = require('xfs');
const path = require('path');
const cmd = require('commander');
const Cube = require('../index');

function getCwd() {
  return process.cwd();
}
function isAbsPath(p) {
  if (process.platform.indexOf('win') === 0) {
    return /^\w:/.test(p);
  } else {
    return /^\//.test(p);
  }
}
function buildOutput(err, info) {
  // cube.printFileShortNameMap();
  console.log('==================');
  if (!err) {
    err = [];
  }
  if (!Array.isArray(err)) {
    err = [err];
  }
  if (err && err.length) {
    err.forEach(function (e) {
      var out = [
        '*',
        'File:', e.file
      ];
      if (e.line) {
        out.push('Line:', e.line);
      }
      if (e.column) {
        out.push('Column:', e.column);
      }
      if (e.code) {
        out.push('Code:', e.code);
      }
      if (e.message) {
        out.push('Message:', e.message);
      }

      console.log.apply(console, out);
    });
  } else {
    console.log('    ');
  }
  console.log('==================');
  console.log(err.length ? 'Build Finished, Total Errors: ' + err.length :  ' Build Successfully');
  info && console.log('Files:', info.total, 'Cost:', info.time + 's');
  console.log('==================');
}

function findRoot(file) {
  let dir = path.dirname(file);
  let res = null;
  while (dir) {
    let origin = dir;
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      res = dir;
      break;
    }
    dir = path.dirname(dir);
    if (dir === origin) { // if dir is the root dir, break
      break;
    }
  }
  return res;
}

cmd
  .usage(' your_code_dir')
  .description('build the hole project')
  .option('-p, --processors [value]', 'process list, "a,b,c"')
  .option('-o, --output [value]', 'set the output dir')
  .option('-b, --base [value]', 'the http virtual base, i.e `http://static.taobao.com/res/js/`, base -> `/res/js/`')
  .option('-r, --root [value]', 'the code root dir')
  .option('--all-in-one', 'all in one code')
  .option('--output-file [value]', 'set the output file')
  .option('--remote [value]', 'set the namespace for remote call')
  .option('--export [value]', 'files will be exported, do not merge, example: /a.js,/b.js')
  .option('--mangle-file-name', 'mangle the file name into random name')
  .option('--without-compress', 'do not compress code')
  .option('--without-wrap', 'do not wraper code')
  .option('--smart', 'smart build, only build necessary')
  .option('--merge-factor [value]', 'merge factor, it\'s a number, default is 3, means when module with 3 common refer will be merge to __common__.js ')
  .parse(process.argv);

var source = cmd.args[0];
var args = cmd;

if (!args || !source) {
  cmd.help();
  return;
}

let map = {};

if (args.export) {
  let tmp = args.export.split(',');
  tmp.forEach((key) => {
    map[key] = true;
  });
}

args.export = map;

var cwd = getCwd();
var fstat;
var inputPath, outputPath, cube, tool, root;
var compress = args.withoutCompress ? false : true;

root = args.root ? args.root : '';
if (root) {
  root = isAbsPath(root) ? root : path.join(cwd, root);
}
source = isAbsPath(source) ? source : path.join(cwd, source);
inputPath = source;

try {
  fstat = fs.statSync(source);
} catch (e) {
  console.log('source not fould', e);
  cmd.help();
  return;
}

if (args.processors) {
  args.processors = args.processors.split(',');
}

if (fstat.isFile()) {
  if (!args.output && !args.outputFile) {
    console.error('`-o or --output-file`options missing, should tell cube the output');
    process.exit(1);
  }
  outputPath = args.output ?
    (isAbsPath(args.output) ? args.output : path.join(cwd, args.output)) :
    undefined;
  root = (root ? root : findRoot(source) || path.dirname(source)).replace(/(\/|\\)$/, '');
  cube = new Cube({
    release: true,
    root: root,
    compress: compress,
    middleware: false,
    processors: args.processors,
    resBase: args.base,
    remote: args.remote,
    withoutWrap: args.withoutWrap,
    mangleFileName: args.mangleFileName,
    export: args.export,
    lazyWrap: args.smart,
    mergeFactor: args.mergeFactor || 3,
    minify: {}
  });
  tool = Cube.tools;
  if (args.allInOne) {
    tool.allInOneCode(cube, {
      queryPath: source.substr(root.length),
      compress: compress,
      ignoreFirstCodeWrap: true
    }, (err, data) => {
      buildOutput(err, data);
      process.exit((err && err.length) ? 1 : 0);
    });
  } else {
    tool.processFile(cube, {
      src: source,
      dest: outputPath,
      destFile: args.outputFile
    }, function (err, data) {
      buildOutput(err, data);
      process.exit((err && err.length) ? 1 : 0);
    });
  }
} else if (fstat.isDirectory()) {
  outputPath = args.output ? (isAbsPath(args.output) ? args.output : path.join(cwd, args.output)) : (source.replace(/(\/|\\)$/, '') + '.release');
  root = (root ? root : source).replace(/(\/|\\)$/, '');
  cube = new Cube({
    release: true,
    root: root,
    compress: compress,
    middleware: false,
    processors: args.processors,
    resBase: args.base,
    remote: args.remote,
    mangleFileName: args.mangleFileName,
    export: args.export,
    lazyWrap: args.smart,
    mergeFactor: args.mergeFactor || 3,
    minify: {}
  });
  tool = Cube.tools;
  tool[args.smart ? 'processDirSmart' : 'processDir'](cube, {src: inputPath, dest:outputPath}, function (err, data) {
    buildOutput(err, data);
    process.exit((err && err.length) ? 1 : 0);
  });
} else {
  console.log('unknow type input source', source);
}