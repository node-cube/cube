describe 'test/test_css', ()->

  it 'expect loading wrap css module fine, compatible with IE hacks', (done) ->
    load '../css/test_css.css', '', (css) ->
      expect(css).to.match(/\.test\s*\{/)
      expect(css).to.match(/color:/)
      done()

  it 'expect inject css fine', (done) ->
    load '../css/test_css.css', '.namespace', (css) ->
      res = $('style[mod="/css/test_css.css"][ns=".namespace"]').html() || $('style[mod="/css/test_css.css.js"][ns=".namespace"]').html()
      expect(res).to.match(/\.namespace\s+\.test/)
      done()

  it 'expect inject css fine with require(css, namespace)', () ->
    require('../css/test_require_css.css');
    node = $('style[mod="/css/test_require_css.css"]');
    if !node.length
      node = $('style[mod="/css/test_require_css.css.js"]');
    expect(node.length).to.be(1);
    expect(node.html()).to.match(/\.test_require/)