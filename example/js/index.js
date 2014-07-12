/*!
 * cube: example/script/index.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var jquery = require('./jquery');
var cycle = require('./cycle_require_test');
var testCoffee = require('./test_coffee');
var merge = require('./merge');
//var tpl = require('../tpl/test.jade');
exports.run = jquery.run;

async('../tpl/test_jade', function (tpl) {
  console.log(tpl({user:{name: 'jade'}}));
});
async('../tpl/test_jade', function (tpl) {
  console.log(tpl({user:{name: 'ejs'}}));
});

async('../css/test_less.less');

testCoffee.run();