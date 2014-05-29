/*!
 * cube: test/jstransfer.js
 * Authors  : = <=> (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var expect = require('expect.js');
var testMod = require('../lib/jstransfer');
var xfs = require('xfs');
var path = require('path');

describe('lib/transfer.js', function () {

  before(function () {
    testMod.init({root: path.join(__dirname, '../example')});
  });

  after(function () {
    xfs.sync().rm(path.join(__dirname, '../example/node_modules/test2'));
    xfs.sync().rm(path.join(__dirname, '../example/node_modules/test3'));
    xfs.sync().rm(path.join(__dirname, '../example/node_modules/test4'));
  });

  describe('transfer()', function () {
    it('should ok when require a regular module', function () {
      var code = 'var b = require("./test.js"); var a = require("../hello");';
      code = testMod.transfer('/a/b/c/test.js', code);
      expect(code).to.match(/_m_\("\/a\/b\/c\/test.js", \["\/a\/b\/c\/test\.js","\/a\/b\/hello\.js"\],/);
    });
    it('should ok when require module with abs path', function () {
      var code = 'var b = require("/test.js");';
      code = testMod.transfer('/a/b/c/test.js', code);
      expect(code).to.match(/_m_\("\/a\/b\/c\/test.js", \["\/test\.js"\],/);
    });
    it('should ok when require a module in node_modules: single file', function () {
      xfs.sync().save(path.join(__dirname, '../example/node_modules/test_mod.js'), '');
      var code = 'require("test_mod");';
      code = testMod.transfer('/a/b/c/test.js', code);
      expect(code).to.match(/"\/node_modules\/test_mod\.js"/);
    });
    it('should ok when require a module in node_modules: module with folder', function () {
      xfs.sync().save(path.join(__dirname, '../example/node_modules/test3/a.js'), '');
      xfs.sync().save(path.join(__dirname, '../example/node_modules/test3/package.json'), '{"main": "a"}');
      var code = 'require("test3")';
      code = testMod.transfer('/a/b/c/test.js', code);
      expect(code).to.match(/"\/node_modules\/test3\/a\.js"/);
    });
    it('should ok when require part of a module in node_modules', function () {
      xfs.sync().save(path.join(__dirname, '../example/node_modules/test2/a.js'), '');
      var code = 'require("test2/a");';
      code = testMod.transfer('/a/b/c/test.js', code);
      expect(code).to.match(/"\/node_modules\/test2\/a\.js"/);
    });
    it('should ok when require a module in node_modules: without package.json::main', function () {
      xfs.sync().save(path.join(__dirname, '../example/node_modules/test4/index.js'), '');
      var code = 'require("test4");';
      code = testMod.transfer('/a/b/c/test.js', code);
      expect(code).to.match(/"\/node_modules\/test4\/index\.js"/);
    });
    it('should return error when require none exists module', function () {
      function test(){
        var code = 'require("test5")';
        code = testMod.transfer('/a/b/c/test.js', code);
      }
      expect(test).to.throwException(/module not found/);
    });
    it('should ok when require with wrong param', function () {
      var code = '/**@merge **/var b = require(); var a = require(""); var c = require(" ");var d = require(null); var e = require(1);';
      code = testMod.transfer('/a/b/c/test.js', code);
      expect(code).to.match(/_m_\("\/a\/b\/c\/test.js", \[\],/);
    });
    it('should ok when compress code', function () {
      var code = 'var a = 1;';
      code = testMod.transfer('/test.js', code, true);
      expect(code).to.match(/_m_/);
      expect(code).to.not.match(/module|require/);
    });
    it('should recognize the local require() when require is override', function () {
      var code = 'function require(){} require("query");';
      code = testMod.transfer('/test.js', code);
      expect(code).to.match(/_m_\("\/test\.js", \[\], /);
    });
  });
});