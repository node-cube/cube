/*!
 * cube: lib/jstransfer.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
'use strict';
var fs = require('fs');
var ug = require('uglify-js');
var path = require('path');
var coffee = require('coffee-script');

var root = '';
var buildInModule = {};
var MANGLE = false;
/**
 * 路径转化
 * @param  {[type]} base   [description]
 * @param  {[type]} module [description]
 * @return {[type]}        [description]
 */
function resolvePath(base, module) {
  var dir = path.dirname(base);
  var origModule = module;
  var count = 0;
  var p;
  // require a common module in node_modules, like "jquery", or "jquery/ajax"
  if (/^\w+/.test(module)) {
    while (dir) {
      count ++;
      try {
        p = path.join(dir, '/node_modules/', module);
        p = testModPath(path.join(root, p));
        break;
      } catch (e) {
        if (dir === '/') {
          e.message = '[Cube]' + base + ' required module not found "' + origModule + '"';
          throw e;
        }
        dir = path.dirname(dir);
      }
      if (count > 30) {
        var err = new Error('resolvePath error, may be cycle required');
        err.code = 'CubeResolvePathException';
        throw err;
      }
    }
  }
  // if abs path: like "/jquery"
  else if (/^\//.test(module)) {
    //abs path
    p = testModPath(path.join(root, module));
  } else {
    p = testModPath(path.join(root, dir, module));
  }
  return p;
}
/**
 * testModPath and return the relative real path
 * @param  {Path} modPath abs root, may be file, may be module dir
 * @return {Path}  relative path based on root
 */
function testModPath(modPath) {
  try {
    // test if dir
    var stat = fs.statSync(modPath);
    if (stat.isDirectory()) {
      // get module default enter
      try {
        var pkg = require(path.join(modPath, './package.json'));
        modPath = path.join(modPath, pkg.main);
        modPath = tryFiles(modPath);
      } catch (e) {
        // can not find module main enter, use index.js as default
        modPath = path.join(modPath, 'index');
        modPath = tryFiles(modPath);
      }
    }
  } catch (e) {
    if (/\.\w+$/.test(modPath)) {
      // if already has ext, throw exception
      throw e;
    }
    modPath = tryFiles(modPath);
  }
  return modPath.substr(root.length);
}

function tryFiles(modPath) {
  if (/\.\w+$/.test(modPath)) {
    fs.statSync(modPath);
    return modPath;
  }
  var tmp;
  try {
    tmp = modPath + '.js';
    fs.statSync(tmp);
  } catch (e) {
    tmp = modPath + '.coffee';
    try {
      fs.statSync(tmp);
    } catch (e1) {
      e1.message = 'no such file or directory ' + modPath + ' [js, coffee]';
      throw e1;
    }
  }
  return tmp;
}

exports.init = function (cfg) {
  root = cfg.root;
  /*
  if (/(\/|\\)$/.test(root) && root !== '/') {
    root = root.substr(0, root.length);
  }
  */
  buildInModule = cfg.buildInModule ? cfg.buildInModule : {};
};

exports.transferFile = function (filepath, compress, merges, recursive, parents) {
  var code;
  try {
    code = fs.readFileSync(path.join(root, filepath), 'utf8');
  } catch (e) {
    e.message = 'module not found "' + filepath + '"';
    throw e;
  }
  if (/\.coffee/i.test(filepath)) {
    return this.transferCoffee(filepath, code, compress, merges, recursive, parents);
  } else {
    return this.transfer(filepath, code, compress, merges, recursive, parents);
  }
};

exports.transferCoffee = function (filepath, code, compress, merges, recursive, parents) {
  code = coffee.compile(code, {header: false, shiftLine: true, sourceMap: null});
  return this.transfer(filepath, code, compress, merges, recursive, parents);
};
/**
 * [transfer description]
 * @param  {Path}     filepath relative to the code base
 * @param  {String}   code     the source code
 * @param  {Boolean}  compress if compress, will output compressd
 * @param  {Object}   merges   {list:[], map: {}}
 * @return {String}   reslut code
 */
exports.transfer = function (filepath, code, compress, merges, recursive, parents) {
  if (!filepath) {
    throw new Error('filepath needed!');
  }
  if (!code) {
    code = '';
  }
  var ast;
  try {
    ast = ug.parse(code);
  } catch (e) {
    e.code = 'JSPARSE_ERROR';
    throw e;
  }
  var requires = [];
  var requiresMap = {};
  var header = '_m_("$$filepath$$", $$requires$$, function (module, exports, require, __dirname, __filename) {';
  var footer = '\nreturn module.exports;});';
  var flagMerge = merges ? true : false;
  var walker = new ug.TreeWalker(function (node) {
    if (node instanceof ug.AST_Toplevel) {
      if (node.start && node.start.comments_before) {
        var cms = node.start.comments_before;
        cms.forEach(function (v) {
          if (/@merge/.test(v.value)) {
            flagMerge = true;
          }
        });
      }
    }
    if (node instanceof ug.AST_Call) {
      // filter other property calls
      if (node.expression.property) {
        return;
      }
      // filter other calls
      if (node.expression.name !== 'require') {
        return;
      }
      if (!node.expression.thedef.undeclared) {
        return;
      }
      // ignore empty require and async require
      if (!node.args.length) {
        return;
      }
      var v = node.args[0].value;
      if (!v || typeof v !== 'string') {
        return;
      }
      if (!v.trim()) {
        return;
      }
      // node.args[0].vaule -> module
      var abspath = resolvePath(filepath, v);
      if (node.args.length === 1) {
        requires.push(abspath);
      }
      var line = node.args[0].start.line - 1;
      if (!requiresMap[line]) {
        requiresMap[line] = [{col: node.args[0].start.col, offset: v.length, name: abspath}];
      } else {
        requiresMap[line].push({col: node.args[0].start.col, offset: v.length, name: abspath});
      }
      node.args[0].value = abspath;
    }
  });
  ast.figure_out_scope();
  ast.walk(walker);
  // do merge
  if (flagMerge) {
    if (!merges) {
      merges = {
        list: [],
        map: {}
      };
    }

    var self = this;
    if (!parents) {
      parents = {};
    }
    if (parents[filepath]) {
      var err = new Error('cyclical require:' + JSON.stringify(parents) + ' >> ' + filepath);
      err.code = 'JSPARSE_ERROR';
      throw err;
    }
    parents[filepath] = true;

    requires.forEach(function (v) {
      if (merges.map[v]) {
        return;
      }
      // native module
      if (!/\//.test(v)) {
        return;
      }
      merges.list.push(self.transferFile(v, compress, merges, true, parents));
      merges.map[v] = true;
    });
  }

  header = header.replace(/\$\$(\w+)\$\$/g, function (m0, m1) {
    switch (m1) {
      case 'filepath':
        return filepath;
      case 'requires':
        return JSON.stringify(requires);
      default:
        return m1;
    }
  });
  if (flagMerge && !recursive) { // merge flag, and the root call
    merges.list.push(compress ? compressCode(ast, header + footer) : header + transferRequire(code, requiresMap) + footer);
    return merges.list.join('\n');
  } else {
    var outcode = header + transferRequire(code, requiresMap) + footer;
    return compress ? compressCode(ast, header + footer) : outcode;
  }
};

function compressCode(ast, wraper) {
  //console.log(ast);
  wraper = ug.parse(wraper);
  var body = wraper.body[0].body.args[2].body;
  wraper.body[0].body.args[2].body = ast.body;
  ast.body.push(body[0]);

  var compress = { warnings: false };
  wraper.figure_out_scope();
  var sq = ug.Compressor(compress);
  wraper = wraper.transform(sq);

  wraper.compute_char_frequency();
  wraper.mangle_names(true);

  var stream = ug.OutputStream();
  wraper.print(stream);

  return stream.toString();
}

function transferRequire(code, requiresMap, requires) {
  var arr = code.split(/\r?\n/);
  var tmp, line, res, offset;
  for (var i in requiresMap) {
    res = [];
    offset = 0;
    tmp = requiresMap[i];
    line = arr[i];
    tmp.forEach(function (item) {
      res.push(line.substr(offset, item.col + 1));
      res.push(item.name);
      offset = item.col + item.offset + 1;
    });
    res.push(line.substr(offset));
    arr[i] = res.join('');
  }
  return arr.join('\n');
}
/*
function transferAST(ast, filename, requires) {
  var args = [];
  // filename
  args.push(new ug.AST_String({value: filename}));
  var astReqs = [];
  requires.forEach(function (v) {
    astReqs.push(new ug.AST_String({value: v}));
  });
  // requires
  args.push(new ug.AST_Array({
    elements: astReqs
  }));
  // function
  var newBody = ast.body;
  var func = new ug.AST_Function({
    argnames: [
      new ug.AST_String({value: 'module'}),
      new ug.AST_String({value: 'exports'}),
      new ug.AST_String({value: 'require'}),
      new ug.AST_String({value: '__filename'}),
      new ug.AST_String({value: '__dirname'})
    ],
    body: newBody,
    name: null
  });
  newBody.push(new ug.AST_Return({
    value: new ug.AST_Dot({
      expression: new ug.AST_SymbolRef({name: 'module', thedef: {global: false, undeclared: false}}),
      property: 'exports'
    })
  }));

  args.push(func);
  // the hole function
  var call = new ug.AST_Call({
    expression: new ug.AST_SymbolRef({name: '_m_', thedef: {global: true, undeclared: false}}),
    args: args
  });
  ast.body = [call];
  return call;
}
*/
exports.resolvePath = resolvePath;