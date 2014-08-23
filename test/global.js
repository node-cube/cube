var testMod = require('../global');
var expect = require('expect.js');

describe('global.js', function () {
  it('bind should throw exception', function () {
    var type = 'script';
    var ext = '.dart';
    var processor = {};
    var err;
    testMod.bind(type, ext, processor);
    try {
      testMod.bind(type, ext, processor);
    } catch (e) {
      err = e;
    }
    expect(err.code).to.match(/CUBE_BIND_TRANSFER_ERROR/);
  });
  it('bind should when force', function () {
    var type = 'script';
    var ext = '.dart';
    var processor = 'abc';
    testMod.bind(type, ext, processor, true);
    expect(testMod.processors.types['script']['.dart']).to.match(/abc/);
  });
  it('setBuildInModule() should ok', function () {
    testMod.setBuildInModule({
      jquery: true,
      d3: true
    });
    expect(testMod.buildInModule.jquery).to.be(true);
  });
});