var exec = require('child_process').exec;
var expect = require('expect.js');
var path = require('path');
var xfs = require('xfs');

describe('cli', function () {
  describe('init', function () {
    if (/win/.test(process.platform)) {
      return ;
    }
    afterEach(function () {
      process.chdir(path.join(__dirname, '../'));
    });
    it('should work fine', function (done) {
      exec('mkdir -p test_init', function () {
        exec('cd ./test_init; ./bin/cube init', function (err, stdout, stderr) {
          var res = stdout.toString().split('\n');
          stderr = stderr.toString();
          console.log(res, stderr);
          expect(stderr).to.be('');
          expect(res).match(/successfully/);
          xfs.sync().rmdir(path.join(__dirname, '../test_init'));
          done();
        });
      });
    });
  });
  describe('build', function () {
    it('should work fine', function (done) {
      var cmd = 'node bin/cube build example';
      exec(cmd, function (err, stdout, stderr) {
        //console.log(stdout.toString(), stderr.toString());
        var res = stdout.toString().split('\n');
        var info = [];
        res.forEach(function (v) {
          if (/^=+$/.test(v)) {
            return;
          }
          if (v) {
            info.push(v);
          }
        });
        expect(info[info.length - 1]).match(/Files: \d+ Cost: \d+s/);
        expect(info[info.length - 2]).match(/Total Errors: 2/);
        // check require('css')
        var cssNamespaceAutofill = xfs.readFileSync(path.join(__dirname, '../example.release/test/test_css_namespace.js'));
        expect(cssNamespaceAutofill.toString()).match(/'\/css\/test_css.css.js',''/);
        expect(xfs.existsSync(path.join(__dirname, '../example.release/test/test_ignore.js'))).to.be(false);
        xfs.sync().rmdir(path.join(__dirname, '../example.release'));
        done();
      });
    });
    it('should work fine with -o relative path', function (done) {
      var cmd = 'node bin/cube build -p cube-less,cube-ejs,cube-stylus example -o example.out';
      exec(cmd, function (err, stdout) {
        var res = stdout.toString().split('\n');
        var info = [];
        res.forEach(function (v) {
          if (/^=+$/.test(v)) {
            return;
          }
          if (v) {
            info.push(v);
          }
        });
        expect(info[info.length - 1]).match(/Files: \d+ Cost: \d+s/);
        expect(info[info.length - 2]).match(/Total Errors: 2/);
        expect(xfs.existsSync(path.join(__dirname, '../example.out'))).to.be(true);
        xfs.sync().rmdir(path.join(__dirname, '../example.out'));
        done();
      });
    });
    it('should work fine with -o abs path', function (done) {
      var cmd = 'node bin/cube build -p cube-less,cube-ejs,cube-stylus example -o ' + path.join(__dirname, '../example.abs');
      exec(cmd, function (err, stdout) {
        var res = stdout.toString().split('\n');
        var info = [];
        res.forEach(function (v) {
          if (/^=+$/.test(v)) {
            return;
          }
          if (v) {
            info.push(v);
          }
        });
        expect(info[info.length - 1]).match(/Files: \d+ Cost: \d+s/);
        expect(info[info.length - 2]).match(/Total Errors: 2/);
        expect(xfs.existsSync(path.join(__dirname, '../example.abs'))).to.be(true);
        expect(xfs.readFileSync(path.join(__dirname, '../example.abs/main.js')).toString()).to.match(/Cube\('\/main\.js/);
        xfs.sync().rmdir(path.join(__dirname, '../example.abs'));
        done();
      });
    });
    it('should work fine when build single file', function (done) {
      var cmd = 'node bin/cube build -p cube-less,cube-ejs,cube-stylus example/css/test_less.less';
      exec(cmd, function (err, stdout) {
        var res = stdout.toString().split('\n');
        var info = [];
        res.forEach(function (v) {
          if (/^=+$/.test(v)) {
            return;
          }
          if (v) {
            info.push(v);
          }
        });
        expect(info[info.length - 1]).match(/Files: \d+ Cost: \d+s/);
        expect(info[info.length - 2]).match(/Successfully/);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/test_less.min.css'))).to.be(true);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/test_less.min.less.js'))).to.be(true);
        xfs.sync().rm(path.join(__dirname, '../example/css/test_less.min.css'));
        xfs.sync().rm(path.join(__dirname, '../example/css/test_less.min.less.js'));
        done();
      });
    });
    it('should work fine when build single file', function (done) {
      var cmd = 'node bin/cube build -p cube-less,cube-ejs,cube-stylus example/css/test_less.less -o example/css/custom';
      exec(cmd, function (err, stdout) {
        var res = stdout.toString().split('\n');
        var info = [];
        res.forEach(function (v) {
          if (/^=+$/.test(v)) {
            return;
          }
          if (v) {
            info.push(v);
          }
        });
        expect(info[info.length - 1]).match(/Files: \d+ Cost: \d+s/);
        expect(info[info.length - 2]).match(/Successfully/);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/custom'))).to.be(true);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/custom.js'))).to.be(true);
        xfs.sync().rm(path.join(__dirname, '../example/css/custom'));
        xfs.sync().rm(path.join(__dirname, '../example/css/custom.js'));
        done();
      });
    });
    it('should work fine when build single file with var', function (done) {
      var cmd = 'node bin/cube build -p cube-less,cube-ejs,cube-stylus ./example/test/test_require_with_var.coffee -b ./example -o ./example/test/test_require_with_var.release.js';
      exec(cmd, function (err, stdout) {
        var res = stdout.toString().split('\n');
        var info = [];
        res.forEach(function (v) {
          if (/^=+$/.test(v)) {
            return;
          }
          if (v) {
            info.push(v);
          }
        });
        expect(info[info.length - 1]).match(/Files: \d+ Cost: \d+s/);
        expect(info[info.length - 2]).match(/Successfully/);
        var target = path.join(__dirname, '../example/test/test_require_with_var.release.js');
        var fileCnt = xfs.readFileSync(target).toString();
        expect(fileCnt).to.match(/'\/test\/'\+\w\+'\.js',function/ig);
        expect(fileCnt).to.match(/'\/test\/'\+\w\+'_require_var\.js',function/ig);
        expect(fileCnt).to.match(/'\/test\/'\+\w\,function/ig);
        expect(fileCnt).to.match(/\w\+'\.js',function/ig);
        expect(fileCnt).to.match(/\w,function/ig);
        //expect(xfs.existsSync(path.join(__dirname, '../example/css/custom'))).to.be(true);
        //expect(xfs.existsSync(path.join(__dirname, '../example/css/custom.js'))).to.be(true);
        xfs.sync().rm(target);
        done();
      });
    });
    it('should work fine when build with --resbase option', function (done) {
      var cmd = 'node bin/cube build -p cube-less,cube-ejs,cube-stylus -r /resouce_path example/css/test_less_img.less -o example/css/custom';
      exec(cmd, function (err, stdout) {
        var res = stdout.toString().split('\n');
        var info = [];
        res.forEach(function (v) {
          if (/^=+$/.test(v)) {
            return;
          }
          if (v) {
            info.push(v);
          }
        });
        expect(info[info.length - 1]).match(/Files: \d+ Cost: \d+s/);
        expect(info[info.length - 2]).match(/Successfully/);
        var content = xfs.readFileSync(path.join(__dirname, '../example/css/custom')).toString();
        expect(content).to.match(/\/resouce_path\/a/);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/custom.js'))).to.be(true);
        xfs.sync().rm(path.join(__dirname, '../example/css/custom'));
        xfs.sync().rm(path.join(__dirname, '../example/css/custom.js'));
        done();
      });
    });

    it('should work fine with --remote option', function (done) {
      var cmd = 'node bin/cube build --remote TEST -p cube-less,cube-ejs,cube-stylus ./example/test/test_require_with_var.coffee -b ./example -o ./example/test/test_require_with_var.release.js';
      exec(cmd, function (err, stdout) {
        var res = stdout.toString().split('\n');
        var info = [];
        res.forEach(function (v) {
          if (/^=+$/.test(v)) {
            return;
          }
          if (v) {
            info.push(v);
          }
        });
        expect(info[info.length - 1]).match(/Files: \d+ Cost: \d+s/);
        expect(info[info.length - 2]).match(/Successfully/);
        var target = path.join(__dirname, '../example/test/test_require_with_var.release.js');
        var fileCnt = xfs.readFileSync(target).toString();
        expect(fileCnt).to.match(/Cube\('TEST:\/test\/test_require_with_var\.js'/);
        expect(fileCnt).to.match(/'TEST:\/test\/'\+\w\+'\.js',function/ig);
        expect(fileCnt).to.match(/'TEST:\/test\/'\+\w\+'_require_var\.js',function/ig);
        expect(fileCnt).to.match(/'TEST:\/test\/'\+\w\,function/ig);
        expect(fileCnt).to.match(/\w\+'\.js',function/ig);
        expect(fileCnt).to.match(/\w,function/ig);
        //expect(xfs.existsSync(path.join(__dirname, '../example/css/custom'))).to.be(true);
        //expect(xfs.existsSync(path.join(__dirname, '../example/css/custom.js'))).to.be(true);
        xfs.sync().rm(target);
        done();
      });
    });
  });
});
