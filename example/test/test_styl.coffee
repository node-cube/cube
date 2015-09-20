describe 'test/test_styl', ()->

  it 'expect inject styl fine', (done) ->
    async '../css/test_styl.styl', '.namespace', (css) ->
      res = $('style[mod="/css/test_styl.styl"]').html() || $('style[mod="/css/test_styl.styl.js"]').html()
      expect(res).to.match(/\.namespace\s+\.test/)
      done()