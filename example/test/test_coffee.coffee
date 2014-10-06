describe 'test/test_coffee', () ->
  node = $('<div class="box"><div>');
  $('body').append(node)
  node.html 'hello coffee-script'

  it 'coffee script should work fine', (done) ->
    expect(node.html()).to.be 'hello coffee-script'
    done()