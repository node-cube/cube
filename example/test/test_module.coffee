###
# cube: example/test/test_modules.js
# Authors  : fish <zhengxinlin@gmail.com> (https://github.com/fishbar)
# Create   : 2014-05-06 00:00:01
# CopyRight 2014 (c) Fish And Other Contributors
####

describe 'test/test_module', () ->

  test = require('test')
  testLibA = require('test/lib/a')
  testLibB = require('test/lib/b.js')
  testNs = require('ns_test')
  testNsCoffee = require('ns_coffee')

  it 'expect require the test module according package.json::main', () ->
    expect(test.version).to.be('1.0.1');
    expect(test.moduleName).to.be('test');

  it 'expect require the test/index', () ->
    expect(testLibA.run()).to.be('this is test.lib.a');

  it 'expect require the module with ns, default index.js', () ->
    expect(testNs.name).to.be('cube can load module with ns: @ali/ns_test');

  it 'expect require the module with ns, default index.js', () ->
    expect(testNsCoffee.name).to.be('index coffee');
