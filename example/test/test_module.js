describe('test/test_module', () => {
  let test = require('test')
  let testLibA = require('test/lib/a')
  let testLibB = require('test/lib/b.js')
  let testModuleWithDot = require('module_with_dot.js');
  let testNs = require('@ali/ns_test')
  let testNsCoffee = require('@ali/ns_coffee')
  let testModulejs = require('module.js')
  let testModuleMap = require('modulemap')

  it('expect require the test module according package.json::main', () => {
    expect(test.version).to.be('1.0.1');
    expect(test.moduleName).to.be('test');
  });

  it('expect require the test/index', () => {
    expect(testLibA.run()).to.be('this is test.lib.a')
  });

  it('expect require the module with ns, default index.js', () => {
    expect(testNs.name).to.be('cube can load module with ns: @ali/ns_test');
  });

  it('expect require the module with ns, default index.js', () => {
    expect(testNsCoffee.name).to.be('index coffee')
  });

  it('expect require the module with dot success', () => {
    expect(testModuleWithDot).to.be('success')
  });

  it('expect require module.js with package.json and index.js', () => {
    expect(testModulejs).to.be('module.js/lib/index.js')
  });

  it('expect require modulemap should return test', () => {
    expect(testModuleMap).to.be('test')
  });
  
});
