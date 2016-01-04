/*!
 * cube: example/script/index.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
/*
var jquery = require('./jquery');
var cycle = require('./cycle_require_test');
var testCoffee = require('./test_coffee');
var merge = require('./merge');
var dash = require('./file.with.dash');
//var tpl = require('../tpl/test.jade');
exports.run = jquery.run;

/*
async('../tpl/test_jade.jade', function (tpl) {
  console.log(tpl({user:{name: 'jade'}}));
});
async('../tpl/test_jade.ejs', function (tpl) {
  console.log(tpl({user:{name: 'ejs'}}));
});
*/
/*
async('../css/test_less.less');
*/

// testCoffee.run();

describe('test/test_main', function () {
  var node;
  var fileWithDot = require('./test_file.with.dot');
  var fileWithHyphen = require('./test_file-with-hyphen');
  node = $('<div class="box">');
  $('#main').append(node);

  exports.run = function (cfg) {
    node.html('app started!');
  };

  it('app.run should be called', function (done) {
    expect(node.html()).to.be('app started!');
    done();
  });

  it('async should work fine', function (done) {
    load('./test_async', function (mod) {
      expect(mod.run()).to.match(/this is async loaded module/);
      done();
    });
  });

  it ('expect require filename with dot fine', function () {
    expect(fileWithDot.name).to.be('file with dot');
  });

  it ('expect require filename with dot fine', function () {
    expect(fileWithHyphen.name).to.be('file with hyphen');
  });
});