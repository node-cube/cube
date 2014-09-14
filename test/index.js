/*!
 * cube: test/index.js
 * Authors  : = <=> (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var expect = require('expect.js');
var testMod = require('../index');
var path = require('path');
var request = require('supertest');
testMod.init({
  root: path.join(__dirname, '../example') + '/',
  port: 7777,
  router: '/a/b/',
  middleware: false,
  buildInModule: {
    'build_in_module': true
  }
});
request = request('http://localhost:7777');
describe('index.js', function () {
  describe('query js files', function () {
    it('should return regular js file', function (done) {
      request.get('/a/b/js/jquery.js')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(/^(?!Cube\()/, done);
    });
    it('should return regular js file which name with dot', function (done) {
      request.get('/a/b/js/file.dot.js')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(/^(?!Cube\()/, done);
    });
    it('should return transfered js file', function (done) {
      request.get('/a/b/js/index.js?m')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/require\('\/js\/jquery\.js'\)/);
          expect(body).to.match(/Cube\("\/js\/index\.js"/);
        })
        .end(done);
    });
    it('should return transfered coffee file', function (done) {
      request.get('/a/b/js/test_coffee.coffee?m')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/exports.run\s+=/);
          expect(body).to.match(/Cube\("\/js\/test_coffee\.coffee"/);
        })
        .end(done);
    });
    it('should return transfered coffee file call like a js file', function (done) {
      request.get('/a/b/js/test_coffee.js?m')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/exports.run\s+=/);
          expect(body).to.match(/Cube\("\/js\/test_coffee\.js"/);
        })
        .end(done);
    });

    it('should return a compress file', function (done) {
      request.get('/a/b/js/index.js?m&c')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/Cube\("\/js\/index\.js/);
          expect(body).not.match(/\/\*\!/);
          expect(body).not.match(/module/);
        })
        .end(done);
    });
    it('should return err message when file not found when moduleWrap is on', function (done) {
      request.get('/a/b/js/jquery-notfound.js?m')
        .expect(200)
        .expect(/console\.error/)
        .expect(/file not found/)
        .expect(/jquery-notfound/, done);
    });
    it('should return err message when file not found when normal query', function (done) {
      request.get('/a/b/js/jquery-notfound.js')
        .expect(404)
        .expect(/file not found/, done);
    });
    it('should return error message in console when file parse ast error', function (done) {
      request.get('/a/b/js/error.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/JS_Parser_Error/ig);
        })
        .end(done);
    });
    it('should return ok when file require node_modules', function (done) {
      request.get('/a/b/js/node_modules_test.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/\/node_modules\/test\/lib\/a\.js/);
          expect(res.text).to.match(/\/node_modules\/test\/lib\/b\.js/);
          expect(res.text).to.match(/\/node_modules\/test\/a\.js/);
        })
        .end(done);
    });
    it('should return 404 when file require node_modules not exist', function (done) {
      request.get('/a/b/js/node_modules_not_found.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/required module not found/);
        })
        .end(done);
    });
    it('should ignore build in modules', function (done) {
      request.get('/a/b/js/test_build_in_module.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/\["build_in_module"\]/);
        })
        .end(done);
    });
  });

  describe('query css file', function () {
    it('should return a transfered css file', function (done) {
      request.get('/a/b/css/test.css')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test \{/ig);
        })
        .end(done);
    });
    it('should return a transfered comressed css file', function (done) {
      request.get('/a/b/css/test.css?c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test\{/ig);
        })
        .end(done);
    });
    it('should return a transfered comressed css file with wrap', function (done) {
      request.get('/a/b/css/test.css?m&c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test\{/ig);
          expect(res.text).match(/^Cube\("\/css\/test\.css", *\[\]/);
          expect(res.text).match(/\.test\{color:#f30\}/);
        })
        .end(done);
    });
    it('should return a transfered less file', function (done) {
      request.get('/a/b/css/test_less.less')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.box a \{/ig);
        })
        .end(done);
    });
    it('should return a transfered compressed less file', function (done) {
      request.get('/a/b/css/test_less.less?c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.box a\{/ig);
          expect(res.text).not.match(/\n/);
        })
        .end(done);
    });

    it('should return a transfered styl file', function (done) {
      request.get('/a/b/css/test_styl.styl?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test a \{/ig);
        })
        .end(done);
    });

    it('should return a transfered styl file', function (done) {
      request.get('/a/b/css/test_styl.styl?m&c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test a\{/ig);
          expect(res.text).not.match(/\n/);
        })
        .end(done);
    });

    it('shoud seekFile success', function (done) {
      request.get('/a/b/css/test.styl?c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test\{color:#f30\}/ig);
          expect(res.text).not.match(/\n/);
        })
        .end(done);
    });
  });

  describe('query tpl file', function () {
    it('should return a compiled ejs file', function (done) {
      request.get('/a/b/tpl/test_ejs.ejs?m')
        .expect(200)
        .expect(function (res) {
          var code = res.text;
          expect(code).match(/^Cube\(/);
        }).end(done);
    });
    it('should return a compiled jade file', function (done) {
      request.get('/a/b/tpl/test_jade.jade?m')
        .expect(200)
        .expect(function (res) {
          var code = res.text;
          expect(code).match(/^Cube\(/);
        }).end(done);
    });
  });
});

function wrapCode(code) {
  var header = '\
    var M = {}; \
    function require(name) {return M[name]};\
    function Cube(mo, requires, cb){\
      var module = {exports: {}}; \
      M[mo] = cb(module, module.exports, require);\
    }\n';
  var footer = '\nreturn M;';
  var fn = new Function(header + code + footer);
  return fn;
}
