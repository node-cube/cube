var jsdom = require('jsdom');
var expect = require('expect.js');
global.Cube = {};
var doc = '<html><head></head><body></body></html>';
global.document = jsdom.jsdom(doc);
global.window = document.parentWindow;
// require('../runtime/cube_css');

function findNode(mod) {
  var nodes = document.getElementsByTagName('STYLE');
  var node;
  nodes = Array.prototype.slice.call(nodes);
  nodes.forEach(function (v) {
    if (v.getAttribute('mod') === mod) {
      node = v;
    }
  });
  return node;
}

describe('runtime/cube_css.js', function () {
  it.skip('should ok when parse normal css', function () {
    var css = '.test div > p, a.select:active {font-weight:bolder;}';
    global.Cube.css(css, '.name', 'test1.css');
    var newCss = findNode('test1.css').innerHTML;
    expect(newCss).match(/\.name \.test div > p/);
    expect(newCss).match(/\.name a\.select:active/);
  });
  it.skip('should ok when parse normal css with comments', function () {
    var css = '/** test */\n.test div > p, a.select:active {font-weight:bolder;}';
    global.Cube.css(css, '.name', 'test1.css');
    var newCss = findNode('test1.css').innerHTML;
    expect(newCss).match(/\.name \/\*\* test \*\/\n\.test div > p/);
    expect(newCss).match(/\.name a\.select:active/);
  });
  it.skip('should ok when parse normal css without namespace', function () {
    var css = '/** test */\n.test div > p, a.select:active {font-weight:bolder;}';
    global.Cube.css(css, undefined, 'test1.css');
    var newCss = findNode('test1.css').innerHTML;
    expect(newCss).eql(css);
  });
  it.skip('should throw error when parse error css', function () {
    var css = '.test div > p {font-weight:bolder;';
    try {
      global.Cube.css(css, '.name', 'test2.css');
    } catch (e) {
      expect(e.message).to.match(/missing '\}' near line 1:35 test2.css/);
    }
  });
  it.skip('should ok when empty css, and no style node created', function () {
    var css = '';
    try {
      global.Cube.css(css, '.a', 'test3.css');
    } catch (e) {
      // nothing
    }
    expect(findNode('test3.css')).to.be(undefined);
  });
});
