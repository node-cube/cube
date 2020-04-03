// do not run this file in browser testcase
a = 'file_for_require_var'
// common
load('./' + a  + '.js', (test) => {
  expect(test()).to.be('success');
})

b = 'file_for'
// no ext
load('./' + a  + '_require_var', (test) => {
  expect(test()).to.be('success');
})
load('./cycle/' + a  + '_require_var', (test) => {
  
});


// only left
load('./' + a, (test) => {
  expect(test()).to.be('success');
})

// only right
load(a + '.coffee', (test) => {
  expect(test()).to.be('success');
});

load(a + '.jade', (test) => {
  expect(test()).to.be('success');
})

// only variable
load(a, (test) => {
  expect(test()).to.be('success');
});
