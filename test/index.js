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
  root: path.join(__dirname, '../example'),
  port: 7777,
  router: '/',
  middleware: false,
  processors: [
    require('cube-ejs'),
    path.join(__dirname, '../node_modules/cube-jade'),
    'cube-less',
    'cube-stylus',  // do not delete this comma, for branch test
  ]
});
request = request('http://localhost:7777');

describe('index.js', function () {
  describe('query js files', function () {
    it('should return regular js file', function (done) {
      request.get('/main.js')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(/exports\.run/)
        .expect(/^(?!Cube\()/, done);
    });
    it('should return regular js file which name with dot', function (done) {
      request.get('/test/test_file.with.dot.js')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(/^(?!Cube\()/, done);
    });
    it('should return regular js file which name with hyphen', function (done) {
      request.get('/test/test_file-with-hyphen.js?m')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(/^Cube\(/, done);
    });
    it('should return transfered js file', function (done) {
      request.get('/main.js?m')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/require\('\/tests\.js'\)/);
          expect(body).to.match(/Cube\("\/main\.js"/);
        })
        .end(done);
    });
    it('should return transfered coffee file', function (done) {
      request.get('/test/test_coffee.coffee?m')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/hello coffee-script/);
          expect(body).to.match(/Cube\("\/test\/test_coffee\.coffee"/);
        })
        .end(done);
    });
    it('should return transfered coffee file call like a js file', function (done) {
      request.get('/test/test_coffee.js?m')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/hello coffee-script/);
          expect(body).to.match(/Cube\("\/test\/test_coffee\.js"/);
        })
        .end(done);
    });

    it('should return a compress file', function (done) {
      request.get('/test/test_main.js?m&c')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/Cube\("\/test\/test_main\.js/);
          expect(body).not.match(/\/\*\!/);
        })
        .end(done);
    });
    it('should return err message when file not found when moduleWrap is on', function (done) {
      request.get('/test/module-not-found.js?m')
        .expect(200)
        .expect(/console\.error/)
        .expect(/file not found/)
        .expect(/module-not-found/, done);
    });
    it('should return err message when file not found when normal query', function (done) {
      request.get('/test/module-not-found.js')
        .expect(404)
        .expect(/file not found/, done);
    });
    it('should return error message in console when file parse ast error', function (done) {
      request.get('/test/test_error.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/JS_Parser_Error/ig);
        })
        .end(done);
    });
    it('should return ok when file require node_modules', function (done) {
      request.get('/test/test_module.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/\/node_modules\/test\/lib\/a\.js/);
          expect(res.text).to.match(/\/node_modules\/test\/lib\/b\.js/);
          expect(res.text).to.match(/\/node_modules\/test\/a\.js/);
        })
        .end(done);
    });
    it('should return 200 when require node_modules not exist, they maybe registered in the page', function (done) {
      request.get('/test/test_registered_module.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/\["jquery"\]/);
        })
        .end(done);
    });
  });

  describe('query css file', function () {
    it('should return a transfered css file', function (done) {
      request.get('/css/test_css.css')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test \{/ig);
        })
        .end(done);
    });
    it('should return a transfered comressed css file', function (done) {
      request.get('/css/test_css.css?c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test\{/ig);
        })
        .end(done);
    });
    it('should return a wraped & comressed css file, actually a js module', function (done) {
      request.get('/css/test_css.css?m&c')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(function (res) {
          expect(res.text).match(/\.test\{/ig);
          expect(res.text).match(/^Cube\("\/css\/test_css\.css", *\[\]/);
          expect(res.text).match(/\.test\{color:/);
        })
        .end(done);
    });
    it('should return the source less file', function (done) {
      request.get('/css/test_less.less')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\@red/ig);
          expect(res.text).not.match(/\.test \.box/ig);
        })
        .end(done);
    });
    it('should return the transfered less file', function (done) {
      request.get('/css/test_less.css')
        .expect(200)
        .expect('content-type', 'text/css')
        .expect(function (res) {
          expect(res.text).match(/\.test \.box/ig);
        })
        .end(done);
    });
    it('should return a transfered compressed less file', function (done) {
      request.get('/css/test_less.less?c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test \.box a\{/ig);
          expect(res.text).not.match(/\n/);
        })
        .end(done);
    });
    it('should return a transfered & compressed & wraped less file', function (done) {
      request.get('/css/test_less.less?m&c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test \.box a\{/ig);
          expect(res.text).match(/^Cube\("\/css\/test_less\.less"/);
        })
        .end(done);
    });

    it('should return a transfered styl file', function (done) {
      request.get('/css/test_styl.styl?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test a \{/ig);
        })
        .end(done);
    });

    it('should return a transfered compressed styl file', function (done) {
      request.get('/css/test_styl.styl?m&c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test a\{/ig);
          expect(res.text).not.match(/\n/);
        })
        .end(done);
    });

    it('shoud return a compressed css file, but not transfered', function (done) {
      request.get('/css/test_styl.css?c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test a\{color:#f30\}/ig);
          expect(res.text).not.match(/\n/);
          expect(res.text).not.match(/^Cube/);
        })
        .end(done);
    });
  });

  describe('query tpl file', function () {
    it('should return a regular html file', function (done) {
      request.get('/tpl/test.html')
        .expect(200)
        .expect('content-type', 'text/html')
        .expect(function (res) {
          var code = res.text;
          expect(code).not.match(/^Cube\(/);
          expect(code).to.match(/<h3>/);
        }).end(done);
    });
    it('should return a wraped html file', function (done) {
      request.get('/tpl/test.html?m')
        .expect(200)
        .expect('content-type', 'application/javascript')
        .expect(function (res) {
          var code = res.text;
          expect(code).match(/^Cube\(/);
          expect(code).to.match(/<h3>/);
        }).end(done);
    });
    it('should return a compiled ejs file', function (done) {
      request.get('/tpl/test_ejs.ejs?m')
        .expect(200)
        .expect(function (res) {
          var code = res.text;
          expect(code).match(/^Cube\(/);
        }).end(done);
    });
    it('should return a compiled jade file', function (done) {
      request.get('/tpl/test_jade.jade?m')
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
