/*!
 * cube: test/tpl_transfer.js
 * Authors  : 剪巽 <jianxun.zxl@taobao.com> (https://github.com/fishbar)
 * Create   : 2014-06-11 14:43:42
 * CopyRight 2014 (c) Alibaba Group
 */
var expect = require('expect.js');
var testMod = require('../lib/tpl_transfer');
var xfs = require('xfs');
var path = require('path');

describe('lib/tpl_transfer.js', function () {

  before(function () {
    testMod.init({root: path.join(__dirname, '../example')});
  });

  describe('transferFile(file, compress)', function () {
    it('should ok when transfer ejs', function () {
      xfs.sync().save(path.join(__dirname, '../example/tpl/test.ejs'), '<div><%= user.name %></div>');
      var res = testMod.transferFile('/tpl/test.ejs', true);
      var M = wrapCode(res);
      expect(M['/tpl/test.ejs']).to.be.a('function');
    });
    it('should ok when transfer jade', function () {
      xfs.sync().save(path.join(__dirname, '../example/tpl/test.jade'), 'div #{user.name}');
      var res = testMod.transferFile('/tpl/test.jade', true);
      var M = wrapCode(res);
      expect(M['/tpl/test.jade']).to.be.a('function');
    });
  });
});

function wrapCode(code) {
  var header = '\
    var M = {}; \
    function require(name) {return M[name]};\
    function _m_(mo, requires, cb) {\
      var module = {exports: {}}; \
      M[mo] = cb(module, module.exports, require);\
    }\n';
  var footer = '\nreturn M;';
  var fn = new Function(header + code + footer);
  return fn();
}