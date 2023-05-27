describe('test/test_html', () => {
  it('expect return an tpl function', () => {
    let tpl = require('../tpl/test.html')

    expect(tpl).to.match(/<section>/);
    expect(tpl).to.match(/<h3>/);
  });
});