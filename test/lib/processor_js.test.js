var JsProcessor = require('../../lib/processor_js2');
var Cube = require('../../index');
describe('lib/processor_js', function () {

  describe('processCode', function () {
    var cube = new Cube({
      root: __dirname
    });

    it('should process code fine', function (done) {
      var jsp = new JsProcessor(cube);
      var code = 'require("./process" + a + ".js");';
      jsp.processCode('/test.js', code, {root: __dirname}, function (err, data) {
        console.log(err, data);
        done();
      });

    });

    it('should process code fine with compress option', function (done) {
      var jsp = new JsProcessor(cube);
      var code = 'require("./process" + a + ".js");';
      jsp.processCode('/test.js', code, {root: __dirname, compress: true}, function (err, data) {
        console.log(err, data);
        done();
      });
    });

  });

});
