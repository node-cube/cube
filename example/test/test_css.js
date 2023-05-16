describe('test/test_css', () => {

  it('expect loading wrap css module fine, compatible with IE hacks', (done) => {
    async('../css/test_css.css', (css) => {
      expect(css).to.match(/\/css\/test_css\.css/);
      done();
    });
  });

  it('expect inject css fine', (done) => {
    async('../css/test_css.css', '.ns', (css) => {
      expect(css).to.equal('/css/test_css.css');
      let res = $('style[mod="/css/test_css.css"][ns=".ns"]').html() || $('style[mod="/css/test_css.css.js"][ns=".namespace"]').html()
      expect(res).to.match(/\.ns\s+\.test/);
      done();
    });
  });

  it('expect inject css fine with require(css, namespace)', () => {
    let mname = require('../css/test_require_css.css', '.ns');
    let node = $('style[mod="' + mname + '"][ns=".ns"]');
    expect(node.length).to.be(1);
    expect(node.html()).to.match(/\.test_require/)
  });
})