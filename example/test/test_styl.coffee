describe 'test/test_styl', ()->

  it 'expect inject styl fine', (done) ->
    async '../css/test_styl.styl', '.namespace', (css) ->
      expect($('style[mod="/css/test_styl.styl"]').html()).to.match(/\.namespace\s+\.test/)
      done()