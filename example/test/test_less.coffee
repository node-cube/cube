describe 'test/test_less', ()->

  it 'expect inject less fine', (done) ->
    async '../css/test_less.less', '.namespace', (css) ->
      expect($('style[mod="/css/test_less.less"]').html()).to.match(/\.namespace\s+\.test/)
      done()