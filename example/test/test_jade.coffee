describe 'test/test_jade', () ->

  it 'expect return an tpl function', () ->
    tpl = require '../tpl/test.jade'
    expect(tpl({user: {name: 'fishbar'}})).to.match(/<div>fishbar<\/div>/);