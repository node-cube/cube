global.window = {};
global.document = {
  scripts: [],
  getElementsByTagName: function () {
    return [{
      appendChild: function () {}
    }];
  },
  querySelector: function (name) {
    return {
      appendChild: function (script) {
        document.scripts.push(script);
        console.log(script);
      }
    };
  },
  createElement: function () {
    return {};
  }
};
require('../../runtime/cube.js');
var expect = require('expect.js');

describe('runtime/cube.js', function () {

  describe('test require', function () {
    beforeEach(function () {
      document.scripts = [];
    });

    it('should work fine modules load before init', function (done) {
      window.Cube.use('/test.js', function (mod) {
        setTimeout(function () {
          expect(mod.name).to.be('test');
          /*
          expect(Object.keys(window.Cube._flag).length).to.be(0);
          expect(Object.keys(window.Cube._cached)).to.eql([
            '/test.js',
            '/a',
            '/b',
            '/c',
            '_0'
          ]);
          */
          done();
        }, 1);
      });
      window.Cube('/test.js', ['/a', '/b', '/c'], function (module, exports, require) {
        require('/a');
        require('/b');
        require('/c');
        expect(module.exports === exports).to.be.ok();
        exports.name = 'test';
        return module.exports;
      });
      window.Cube('/a', [], function (module, exports) {
        exports.name = 'a';
        return module.exports;
      });
      window.Cube('/b', [], function (module, exports) {
        exports.name = 'b';
        return module.exports;
      });
      window.Cube('/c', [], function (module, exports) {
        exports.name = 'c';
        return module.exports;
      });
      window.Cube.init({});
      expect(document.scripts.length).to.be(0);
    });

    it('should work fine modules load after init', function (done) {
      window.Cube.init({});
      window.Cube.use('/test2.js', function (mod) {
        setTimeout(function () {
          expect(mod.name).to.be('test');
          /*
          expect(Object.keys(window.Cube._flag).length).to.be(0);
          expect(Object.keys(window.Cube._cached)).to.eql([
            '/test.js',
            '/a',
            '/b',
            '/c',
            '_0'
          ]);
          */
          done();
        }, 1);
      });
      window.Cube('/test2.js', ['/a2', '/b2', '/c2'], function (module, exports, require) {
        require('/a2');
        require('/b2');
        require('/c2');
        expect(module.exports === exports).to.be.ok();
        exports.name = 'test';
        return module.exports;
      });
      window.Cube('/a2', [], function (module, exports) {
        exports.name = 'a';
        return module.exports;
      });
      window.Cube('/b2', [], function (module, exports) {
        exports.name = 'b';
        return module.exports;
      });
      window.Cube('/c2', [], function (module, exports) {
        exports.name = 'c';
        return module.exports;
      });
      expect(document.scripts.length).to.be(4);
    });
  });
});
