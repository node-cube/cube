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
        // check require('css')
        var css_namespace_autofill = xfs.readFileSync(path.join(__dirname, '../example.release/test/test_css_namespace.js'));
        expect(css_namespace_autofill.toString()).match(/"\/css\/test_css.css.js",""/);
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
    it('should work fine when build single file with var', function (done) {
      var cmd = 'cd ' + path.join(__dirname, '../') + ';';
      cmd += 'bin/cube build -p cube-less,cube-ejs,cube-stylus test/test_require_with_var.coffee -b example -o example/test/test_require_with_var.release.js';
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
        var target = path.join(__dirname, '../example/test/test_require_with_var.release.js');
        var fileCnt = xfs.readFileSync(target).toString();
        expect(fileCnt).to.match(/"\/test\/"\+\w\+"\.js",function/ig);
        expect(fileCnt).to.match(/"\/test\/"\+\w\+"_require_var\.js",function/ig);
        expect(fileCnt).to.match(/"\/test\/"\+\w\,function/ig);
        expect(fileCnt).to.match(/\w\+"\.js",function/ig);
        expect(fileCnt).to.match(/\w,function/ig);
        //expect(xfs.existsSync(path.join(__dirname, '../example/css/custom'))).to.be(true);
        //expect(xfs.existsSync(path.join(__dirname, '../example/css/custom.js'))).to.be(true);
        xfs.sync().rm(target);
        done();
      });
    });
    it('should work fine when build with --resbase option', function (done) {
      var cmd = 'cd ' + path.join(__dirname, '../') + ';';
      cmd += 'bin/cube build -p cube-less,cube-ejs,cube-stylus -r /resouce_path example/css/test_less_img.less -o example/css/custom';
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
        var content = xfs.readFileSync(path.join(__dirname, '../example/css/custom')).toString();
        expect(content).to.match(/\/resouce_path\/a/);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/custom.js'))).to.be(true);
        xfs.sync().rm(path.join(__dirname, '../example/css/custom'));
        xfs.sync().rm(path.join(__dirname, '../example/css/custom.js'));
        done();
      });
    });
  });
});