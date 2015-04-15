# do not run this file in browser testcase
a = 'file_for_require_var'
#  common
async './' + a  + '.js', (test) ->
  expect(test()).to.be('success');
b = 'file_for'
# no ext
async './' + a  + '_require_var', (test) ->
  expect(test()).to.be('success');

# only left
async './' + a, (test) ->
  expect(test()).to.be('success');

# only right
async a + '.coffee', (test) ->
  expect(test()).to.be('success');

async a + '.jade', (test) ->
  expect(test()).to.be('success');

# only variable
async a, (test) ->
  expect(test()).to.be('success');