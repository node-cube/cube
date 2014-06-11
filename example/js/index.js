/*!
 * cube: example/script/index.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var jquery = require('./jquery');
//var tpl = require('../tpl/test.jade');
exports.run = jquery.run;

require('../tpl/test.jade', function (tpl) {
  console.log(tpl({user:{name: 'jade'}}));
});
require('../tpl/test.ejs', function (tpl) {
  console.log(tpl({user:{name: 'ejs'}}));
});