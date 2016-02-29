describe 'test/test_ejs', () ->

  it 'expect return an tpl function', () ->
    tpl = require '../tpl/test.ejs'
    console.log(tpl.toString());
    expect(tpl({user: {name: 'fishbar'}})).to.match(/<div>fishbar<\/div>/);