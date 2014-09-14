var exec = require('child_process').exec;
var expect = require('expect.js');
var path = require('path');

describe('cli', function () {
  it('bind should throw exception', function (done) {
    var cmd = 'cd ' + path.join(__dirname, '../') + ';';
    cmd += 'bin/cube build -i build_in_module example';

    exec(cmd, function (err, stdout, stderr) {
      var res = stdout.toString().split('\n');
      var info = [];
      var flag = false;
      res.forEach(function (v) {
        if (/^=+$/.test(v)) {
          if (!flag) {
            flag = true;
          } else {
            flag = false;
          }
        } else if (flag) {
          info.push(v);
        }
      });
      expect(info[0]).match(/Files: \d+ Cost: \d+s/);
      expect(info[1]).match(/Error: 3/);
      done();
    });
  });
});