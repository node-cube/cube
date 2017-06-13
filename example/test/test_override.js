
function test(require, module) {
  require('./hello_def');

  module.exports = function () {
    require('./hello_test');
  };
}

function require() {

}

require('./hello_abc');
