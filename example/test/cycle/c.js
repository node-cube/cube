/*!
 * cube: example/script/cycle/c.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var a = require('./a');

exports.test = function () {
  expect(a.name).to.be('a');
  console.log('a.name:"' + a.name + '" should equal "a"');
};
