/*!
 * cube: test/index.js
 * Authors  : = <=> (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
'use strict';

var expect = require('expect.js');
var testMod = require('../lib/file_name_mangle');
var path = require('path');
var fs = require('fs');
var Request = require('supertest');

describe('lib/file_name_mangle.js', function () {
  let mangle = new testMod({
    mangleFileNameIgnore: [
      'test'
    ]
  });
  it('should work fine', function () {
    let obj = {};
    for (let a = 0; a < 1000; a ++) {
      obj[mangle.mangle('/i' + a)] = true;
    }
    expect(Object.keys(obj).length).to.eql(1000);
  });

});
