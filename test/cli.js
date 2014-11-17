var exec = require('child_process').exec;
var expect = require('expect.js');
var path = require('path');
var xfs = require('xfs');

describe('cli', function () {
  describe('init', function () {
    it('should work fine', function (done) {
      var cmd = 'cd ' + path.join(__dirname, '../') + '; test ! -d test_init && mkdir test_init; cd test_init;';
      cmd += '../bin/cube init';
      exec(cmd, function (err, stdout, stderr) {
        var res = stdout.toString().split('\n');
        stderr = stderr.toString();
        expect(stderr).to.be('');
        expect(res).match(/successfully/);
        xfs.sync().rmdir(path.join(__dirname, '../test_init'));
        done();
      });
    });
  });
  describe('build', function () {
    it('should work fine', function (done) {
      var cmd = 'cd ' + path.join(__dirname, '../') + ';';
      cmd += 'bin/cube build example';
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
        expect(info[1]).match(/Error: 1/);
        xfs.sync().rmdir(path.join(__dirname, '../example.release'));
        done();
      });
    });
    it('should work fine with -o relative path', function (done) {
      var cmd = 'cd ' + path.join(__dirname, '../') + ';';
      cmd += 'bin/cube build -p cube-less,cube-ejs,cube-stylus example -o example.out';
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
        expect(info[1]).match(/Error: 1/);
        expect(xfs.existsSync(path.join(__dirname, '../example.out'))).to.be(true);
        xfs.sync().rmdir(path.join(__dirname, '../example.out'));
        done();
      });
    });
    it('should work fine with -o abs path', function (done) {
      var cmd = 'cd ' + path.join(__dirname, '../') + ';';
      cmd += 'bin/cube build -p cube-less,cube-ejs,cube-stylus example -o ' + path.join(__dirname, '../example.abs');
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
        expect(info[1]).match(/Error: 1/);
        expect(xfs.existsSync(path.join(__dirname, '../example.abs'))).to.be(true);
        xfs.sync().rmdir(path.join(__dirname, '../example.abs'));
        done();
      });
    });
    it('should work fine when build single file', function (done) {
      var cmd = 'cd ' + path.join(__dirname, '../') + ';';
      cmd += 'bin/cube build -p cube-less,cube-ejs,cube-stylus example/css/test_less.less';
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
        expect(info[1]).match(/successfully/);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/test_less.min.css'))).to.be(true);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/test_less.min.less.js'))).to.be(true);
        xfs.sync().rm(path.join(__dirname, '../example/css/test_less.min.css'));
        xfs.sync().rm(path.join(__dirname, '../example/css/test_less.min.less.js'));
        done();
      });
    });
    it('should work fine when build single file', function (done) {
      var cmd = 'cd ' + path.join(__dirname, '../') + ';';
      cmd += 'bin/cube build -p cube-less,cube-ejs,cube-stylus example/css/test_less.less -o example/css/custom';
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
        expect(info[1]).match(/successfully/);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/custom'))).to.be(true);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/custom.js'))).to.be(true);
        xfs.sync().rm(path.join(__dirname, '../example/css/custom'));
        xfs.sync().rm(path.join(__dirname, '../example/css/custom.js'));
        done();
      });
    });
  });
});