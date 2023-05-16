/*!
 * cube: test/index.js
 * Authors  : = <=> (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
'use strict';

var expect = require('expect.js');
var testMod = require('../index');
var path = require('path');
var fs = require('fs');
var Request = require('supertest');
var cubeInst = testMod.service({
  root: path.join(__dirname, '../example'),
  port: 7777,
  router: '/',
  middleware: false,
  devCache: false,
  resBase: '/resouce_path',
  processors: {
    // '.less': [[path.join(__dirname, '../node_modules/cube-less'), {test: true}]],
    // '.styl': require('cube-stylus')  // do not delete this comma, for branch test
  }
});

testMod.service({
  root: path.join(__dirname, '../example'),
  port: 8888,
  router: '/',
  middleware: false,
  devCache: false,
  remote: 'REMOTE',
  resBase: '/resouce_path',
  processors: {
    //'.less': require('cube-less'),
    //'.styl': require('cube-stylus')  // do not delete this comma, for branch test
  }
});

testMod.service({
  root: path.join(__dirname, '../example'),
  port: 7778,
  router: '/',
  middleware: false,
  resBase: '/resouce_path',
  hooks: {
    beforeResolvePath: function(file) {
      if (/^\w+?:/.test(file)){
        var _file = file.split(':');
        var _path = path.join(this.config.root, _file[1]);
        if (fs.existsSync(_path)) {
          return _path.replace(this.config.root, '');
        }
      }
      return file;
    }
  },
  processors: {
    // '.less': require('cube-less'),
    // '.styl': require('cube-stylus')  // do not delete this comma, for branch test
  }
});

var request = Request('http://localhost:7777');
var remoteRequest = Request('http://localhost:8888');
var hookRequest = Request('http://localhost:7778');

describe('index.js', function () {

  describe('remote request', function () {
    it('should return a js module with remote info', function (done) {
      remoteRequest.get('/main.js?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/Cube\("REMOTE:\/main\.js"/)
        .expect(/require\(['"]REMOTE:\/tests\.js/)
        .expect(/exports\.run/)
        .expect(/Cube/, done);
    });
    it('should return a style module with remote info', function (done) {
      remoteRequest.get('/css/test_css.css?m&c')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/Cube\("REMOTE:\/css\/test_css\.css"/, done);

    });
    it('should return a template module with remote info', function (done) {
      remoteRequest.get('/tpl/test.html?m&c')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/Cube\('REMOTE:\/tpl\/test\.html'/, done);
    });
    it('should process require with vars ok with remote info', function (done) {
      remoteRequest.get('/test/test_require_with_var.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/load\('REMOTE:\/test\/' \+ a \+ '\.js',/ig);
          // auto ext added
          expect(res.text).to.match(/load\('REMOTE:\/test\/' \+ a \+ '_require_var\.js',/ig);
          // only left side
          expect(res.text).to.match(/load\('REMOTE:\/test\/' \+ a,/ig);
          // only right side, dev model will not change the ext
          expect(res.text).to.match(/load\(a \+ '\.coffee\.js',/ig);
          // only var
          expect(res.text).to.match(/load\(a,/ig);
        })
        .end(done);
    });

    it('should work fine', function (done) {
      request.get('/test/test_remote_module.js?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/\["datav:\/coms\/abc"\]/)
        .expect(/^Cube\(/, done);
    });

    it('should work fine with babel transfer', function (done) {
      request.get('/es6.js?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/^Cube\(/, done);
    });

    it('should work fine when require override', function (done) {
      remoteRequest.get('/test/test_override.js?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/\'\.\/hello_def\'/)
        .expect(/\'\.\/hello_test\'/)
        .expect(/\'\.\/hello_abc\'/)
        .end(done);
    });
  });

  describe('query js files', function () {
    it('should return regular js file', function (done) {
      request.get('/main.js')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/exports\.run/)
        .expect(/^(?!Cube\()/, done);
    });
    it('should ignore file parse when file in .cubeignore list', function (done) {
      request.get('/test/test_ignore.js?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/Cube\("\/test\/test_ignore\.js"/)
        .expect(/require\('ignores'\)/, done);
    });
    it('should return regular js file which name with dot', function (done) {
      request.get('/test/test_file.with.dot.js')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/^(?!Cube\()/, done);
    });
    it('should return regular js file which name with hyphen', function (done) {
      request.get('/test/test_file-with-hyphen.js?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/^Cube\(/, done);
    });
    it('should return transfered js file', function (done) {
      request.get('/main.js?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/require\('\/tests\.js'\)/);
          expect(body).to.match(/Cube\("\/main\.js"/);
        })
        .end(done);
    });
    it('should return transfered js file auto fix css namespace', function (done) {
      request.get('/test/test_css_namespace.js?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/require\('\/css\/test_css\.css', ''\);/);
        })
        .end(done);
    });
    it('should return transfered compressed js file auto fix css namespace', function (done) {
      request.get('/test/test_css_namespace.js?m&c')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/\('\/css\/test_css\.css',''\)/);
        })
        .end(done);
    });
    it.skip('should return transfered coffee file', function (done) {
      request.get('/test/test_coffee.coffee?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/hello coffee-script/);
          expect(body).to.match(/Cube\("\/test\/test_coffee\.coffee"/);
        })
        .end(done);
    });
    it.skip('should return transfered coffee file call like a js file', function (done) {
      request.get('/test/test_coffee.js?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
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
        .expect('content-type', /application\/javascript/)
        .expect(function (res) {
          var body = res.text;
          expect(body).to.match(/Cube\('\/test\/test_main\.js/);
          expect(body).not.match(/\/\*\!/);
        })
        .end(done);
    });
    it('should return err message when file not found when moduleWrap is on', function (done) {
      request.get('/test/module-not-found.js?m')
        .expect(function (res) {
          expect(res.text).match(/console\.error\(/);
        })
        .expect(/console\.error/)
        .expect(/FILE_NOT_FOUND/)
        .expect(/module-not-found/, done);
    });
    it('should return err message when file not found when normal query', function (done) {
      request.get('/test/module-not-found.js')
        .expect(404)
        .expect(/FILE_NOT_FOUND/, done);
    });
    it('should return error message in console when file parse ast error', function (done) {
      request.get('/test/test_error.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/Unexpected token/ig);
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
    it('should return ok when file require node_modules/test', function (done) {
      request.get('/node_modules/@ali/ns_coffee/index.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/\/node_modules\/test\/a\.js/);
        })
        .end(done);
    });
    it('should return 200 when require node_modules not exist, they maybe registered in the page', function (done) {
      request.get('/test/test_registered_module.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/\[\]/);
        })
        .end(done);
    });

    it('should return ok when require or load is redefined', function (done) {
      request.get('/node_modules/modulemap/lib/index.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/Cube\("\/node_modules\/modulemap\/lib\/index\.js", \["\/node_modules\/modulemap\/lib\/test\.js"\]/);
        })
        .end(done);
    });

    it('should process require with vars', function (done) {
      request.get('/test/test_require_with_var.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/load\('\/test\/' \+ a \+ '\.js',/ig);
          // auto ext added
          expect(res.text).to.match(/load\('\/test\/' \+ a \+ '_require_var\.js',/ig);
          expect(res.text).to.match(/load\('\/test\/cycle\/' \+ a \+ '_require_var\.js',/ig);
          // only left side
          expect(res.text).to.match(/load\('\/test\/' \+ a,/ig);
          // only right side, dev model will not change the ext
          expect(res.text).to.match(/load\(a \+ '\.coffee.js',/ig);
          // only var
          expect(res.text).to.match(/load\(a,/ig);
        })
        .end(done);
    });
    it.skip('should merge query when enter file is an node_modules, and cycle require is also fine', function (done) {
      request.get('/node_modules/cycle_server/a.js?m')
        .expect(200)
        .expect(function (res) {
          expect(res.text).to.match(/\/node_modules\/cycle_server\/a\.js/);
          expect(res.text).to.match(/\/node_modules\/cycle_server\/b\.js/);
          expect(res.text).to.match(/\/node_modules\/cycle_server\/c\.js/);
          let indexA = res.text.indexOf('Cube("/node_modules/cycle_server/a.js');
          let indexB = res.text.indexOf('Cube("/node_modules/cycle_server/b.js');
          let indexC = res.text.indexOf('Cube("/node_modules/cycle_server/c.js');
          expect(indexA > indexB).to.be(true);
          expect(indexA > indexC).to.be(true);
          expect(indexB > indexC).to.be(true);
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
          expect(res.text).match(/\@import url\(\/resouce_path\/css\/test_require_css\.css\);/);
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
    it('should fixup image path in css', function (done) {
      request.get('/css/test_css_img.css?c')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/url\(\/resouce_path\/css\/a.png\)/);
          expect(res.text).match(/url\(\/resouce_path\/css\/b.png\)/);
          expect(res.text).match(/url\(\/resouce_path\/css\/c.png\)/);
          expect(res.text).match(/url\(data:image\/gif;base64,AAAA\)/);
          expect(res.text).match(/url\(http:\/\/www\.taobao\.com\)/);
          expect(res.text).match(/url\(\/foo\)/);
        })
        .end(done);
    });
    it('should return a wraped & comressed css file, actually a js module', function (done) {
      request.get('/css/test_css.css?m&c')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(function (res) {
          expect(res.text).match(/\.test\{/ig);
          expect(res.text).match(/^Cube\("\/css\/test_css\.css", *\[\]/);
          expect(res.text).match(/\.test\{color:/);
          //expect(res.text).match(/@import url\(\/resouce_path\/css\/test_require_css\.css\)/);
        })
        .end(done);
    });
    it('should return the compiled css file', function (done) {
      request.get('/css/test_less.less')
        .expect(200)
        .expect(function (res) {
          expect(res.text).match(/\.test \.box a/ig);
        })
        .end(done);
    });
    it('should return the transfered less file', function (done) {
      request.get('/css/test_less.css')
        .expect(200)
        .expect('content-type', /text\/css/)
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
    it('should fixup image path in less', function (done) {
      request.get('/css/test_less_img.css?c')
        .expect(function (res) {
          expect(res.text).match(/url\(\/resouce_path\/css\/a.png\)/);
          expect(res.text).match(/url\(\/resouce_path\/css\/b.png\)/);
          expect(res.text).match(/url\(\/resouce_path\/css\/c.png\)/);
          expect(res.text).match(/url\(data:image\/gif;base64,AAAA\)/);
          expect(res.text).match(/url\(http:\/\/www\.taobao\.com\)/);
          expect(res.text).match(/url\(\/foo\)/);
        })
        //.expect(200)
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

    it('should fixup image path in stylus', function (done) {
      request.get('/css/test_styl_img.styl?c')
        .expect(function (res) {
          expect(res.text).match(/url\(\/resouce_path\/css\/a.png\)/);
          expect(res.text).match(/url\(\/resouce_path\/css\/b.png\)/);
          expect(res.text).match(/url\(\/resouce_path\/css\/c.png\)/);
          expect(res.text).match(/url\(http:\/\/www\.taobao\.com\)/);
          expect(res.text).match(/url\(\/foo\)/);
        })
        //.expect(200)
        .end(done);
    });
  });

  describe('query tpl file', function () {
    it('should return a regular html file', function (done) {
      request.get('/tpl/test.html')
        .expect(200)
        .expect('content-type', /text\/html/)
        .expect(function (res) {
          var code = res.text;
          expect(code).not.match(/^Cube\(/);
          expect(code).to.match(/<h3>/);
        }).end(done);
    });
    it('should return a wraped html file', function (done) {
      request.get('/tpl/test.html?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(function (res) {
          var code = res.text;
          expect(code).match(/^Cube\(/);
          expect(code).to.match(/<h3>/);
        }).end(done);
    });
    it.skip('should return a compiled ejs file', function (done) {
      request.get('/tpl/test_ejs.ejs?m')
        .expect(200)
        .expect(function (res) {
          var code = res.text;
          expect(code).match(/^Cube\(/);
        }).end(done);
    });
    it.skip('should return a compiled jade file', function (done) {
      request.get('/tpl/test_jade.jade?m')
        .expect(200)
        .expect(function (res) {
          var code = res.text;
          expect(code).match(/^Cube\(/);
        }).end(done);
    });
  });

  describe('test processCode', function () {
    it.skip('should work fine', function (done) {
      var code = fs.readFileSync(path.join(__dirname, '../example/main.js')).toString();
      cubeInst.processJsCode({
        file: '/main.js',
        code: code,
        compress: true
      },
      function (err, result) {
        expect(err).to.be(null);
        expect(result.codeWraped).to.match(/Cube\('\/main\.js',\[\'\/tests\.js\']/);
        done();
      });
    });
  });

  describe('test hook', function () {
    it.skip('resolve filepath', function (done) {
      hookRequest.get('/test_hook.js?m')
        .expect(200)
        .expect('content-type', /application\/javascript/)
        .expect(/Cube\("\/test_hook\.js"/)
        .expect(/require\(['"]remote:path\/to\/file/)
        .expect(/require\(['"]\/tests\.js/)
        .expect(/exports = function/)
        .expect(/Cube/, done);
    });
  });
});

/*
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
*/
