describe.only 'test/test_less', ()->

  it 'expect inject less fine', (done) ->
    async '../css/test_less.less', '.namespace', (css) ->
      res = $('style[mod="/css/test_less.less"]').html() || $('style[mod="/css/test_less.less.js"]').html()
      expect(res).to.match(/\.namespace\s+\.test/)
      done()