describe('test/test_registered_module', () => {
  let $ = require('jquery');
  let d3 = require('d3');

  it('expect registered module work fine', () => {
    expect($ == jQuery).to.be.ok();
  });

});
