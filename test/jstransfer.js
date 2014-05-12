/*!
 * cube: test/jstransfer.js
 * Authors  : = <=> (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var expect = require('expect.js');
var testMod = require('../lib/jstransfer');

describe('lib/transfer.js', function () {
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
  });
});