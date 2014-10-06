describe 'test/test_registered_module', () ->
  $ = require('jquery');

  it 'expect registered module work fine', () ->
    expect($ == jQuery).to.be.ok();