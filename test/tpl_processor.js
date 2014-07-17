/*!
 * cube: test/tpl_transfer.js
 * Authors  : 剪巽 <jianxun.zxl@taobao.com> (https://github.com/fishbar)
 * Create   : 2014-06-11 14:43:42
 * CopyRight 2014 (c) Alibaba Group
 */
var expect = require('expect.js');
var testMod = require('../lib/tpl_processor');
var xfs = require('xfs');
var path = require('path');
var root;

describe('lib/tpl_processor.js', function () {

  before(function () {
    root = path.join(__dirname, '../example');
  });

  describe('transferFile(file, compress)', function () {
    it('should ok when transfer ejs', function () {
      xfs.sync().save(path.join(__dirname, '../example/tpl/test.ejs'), '<div><%= user.name %></div>');
      testMod(root, '/tpl/test.ejs', {compress: true}, function (err, code) {
        var M = wrapCode(code.wrap);
        expect(M['/tpl/test.ejs']).to.be.a('function');
        expect(err).to.be(null);
      });
    });
    it('should ok when transfer ejs release model', function () {
      xfs.sync().save(path.join(__dirname, '../example/tpl/test.ejs'), '<div><%= user.name %></div>');
      testMod(root, '/tpl/test.ejs', {compress: true, release: true}, function (err, code) {
        var M = wrapCode(code.wrap);
        expect(M['/tpl/test.ejs.js']).to.be.a('function');
        expect(err).to.be(null);
      });
    });
    it('should ok when transfer jade', function () {
      xfs.sync().save(path.join(__dirname, '../example/tpl/test.jade'), 'div #{user.name}');
      testMod(root, '/tpl/test.jade', {compress: true}, function (err, code) {
        var M = wrapCode(code.wrap);
        expect(M['/tpl/test.jade']).to.be.a('function');
        expect(err).to.be(null);
      });
    });
    it('should ok when transfer jade in release model', function () {
      xfs.sync().save(path.join(__dirname, '../example/tpl/test.jade'), 'div #{user.name}');
      testMod(root, '/tpl/test.jade', {compress: true, release: true}, function (err, code) {
        var M = wrapCode(code.wrap);
        expect(M['/tpl/test.jade.js']).to.be.a('function');
        expect(err).to.be(null);
      });
    });
  });
});

function wrapCode(code) {
  var header = '\
    var M = {}; \
    function require(name) {return M[name]};\
    function Cube(mo, requires, cb) {\
      var module = {exports: {}}; \
      M[mo] = cb(module, module.exports, require);\
    }\n';
  var footer = '\nreturn M;';
  var fn = new Function(header + code + footer);
  return fn();
}