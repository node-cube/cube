describe 'test/test_css', ()->

  it 'expect loading wrap css module fine, compatible with IE hacks', (done) ->
    async '../css/test_css.css', (css) ->
      expect(css).to.match(/\.test\s*\{/)
      expect(css).to.match(/color:\s*red\\9/)
      expect(css).to.match(/\*color:/)
      expect(css).to.match(/_color:/)
      done()

  it 'expect inject css fine', (done) ->
    async '../css/test_css.css', '.namespace', (css) ->
      expect($('style[mod="/css/test_css.css"]').html()).to.match(/\.namespace\s+\.test/)
      done()

  it 'expect inject css fine with require(css, namespace)', () ->
    require('../css/test_require_css.css', '');
    node = $('style[mod="/css/test_require_css.css"]');
    expect(node.length).to.be(1);
    expect(node.html()).to.match(/\.test_require/)