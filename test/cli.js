var exec = require('child_process').exec;
var expect = require('expect.js');
var path = require('path');
var xfs = require('xfs');

describe('cli', function () {
  describe('init', function () {
    if (/^win/.test(process.platform)) {
      return ;
    }
    afterEach(function () {
      process.chdir(path.join(__dirname, '../'));
    });
    it('should work fine', function (done) {
      exec('mkdir -p test_init', function () {
        exec('cd ./test_init; ../bin/cube init', function (err, stdout, stderr) {
          var res = stdout.toString().split('\n');
          stderr = stderr.toString();
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
        console.log(stdout.toString(), stderr.toString());
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
        expect(info[info.length - 2]).match(/Total Errors: 5/);
        // check require('css')
        var cssNamespaceAutofill = xfs.readFileSync(path.join(__dirname, '../example.release/test/test_css_namespace.js'));
        expect(cssNamespaceAutofill.toString()).match(/'\/css\/test_css.css.js',''/);
        expect(xfs.existsSync(path.join(__dirname, '../example.release/test/test_ignore.js'))).to.be(false);
        xfs.sync().rmdir(path.join(__dirname, '../example.release'));
        done();
      });
    });
    it('should work fine with --smart', function (done) {
      var cmd = 'node bin/cube build --smart example';
      exec(cmd, function (err, stdout, stderr) {
        // console.log(stdout.toString(), stderr.toString());
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
        expect(info[info.length - 2]).match(/Total Errors: 5/);
        // check require('css')
        var cssNamespaceAutofill = xfs.readFileSync(path.join(__dirname, '../example.release/test/test_css_namespace.js'));
        expect(cssNamespaceAutofill.toString()).match(/'\/css\/test_css.css.js',''/);
        expect(xfs.existsSync(path.join(__dirname, '../example.release/test/test_ignore.js'))).to.be(false);
        // node_modules relative file should be build
        expect(xfs.existsSync(path.join(__dirname, '../example.release/node_modules/test/lib/b.js'))).to.be(true);
        // node_modules no rel file should not build
        expect(xfs.existsSync(path.join(__dirname, '../example.release/node_modules/test_ignored_by_smartbuild.js'))).to.be(false);
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
        expect(info[info.length - 2]).match(/Total Errors: 5/);
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
        expect(info[info.length - 2]).match(/Total Errors: 5/);
        expect(xfs.existsSync(path.join(__dirname, '../example.abs'))).to.be(true);
        expect(xfs.readFileSync(path.join(__dirname, '../example.abs/main.js')).toString()).to.match(/Cube\('\/main\.js/);
        xfs.sync().rmdir(path.join(__dirname, '../example.abs'));
        done();
      });
    });
    it('should work fine when build single file', function (done) {
      var cmd = 'node bin/cube build -p cube-less,cube-ejs,cube-stylus example/css/test_less.less -o example/css/test_less_out';
      exec(cmd, function (err, stdout, stderr) {
        var res = stdout.toString().split('\n');
        // console.log(stdout.toString(), stderr.toString());
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
        expect(xfs.existsSync(path.join(__dirname, '../example/css/test_less_out/test_less.css'))).to.be(true);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/test_less_out/test_less.less.js'))).to.be(true);
        xfs.sync().rm(path.join(__dirname, '../example/css/test_less_out'));
        done();
      });
    });

    it('should work fine when build single file with --output-file', function (done) {
      var cmd = 'node bin/cube build -p cube-less,cube-ejs,cube-stylus --output-file example/__test_less.css example/css/test_less.less';
      exec(cmd, function (err, stdout, stderr) {
        var res = stdout.toString().split('\n');
        // console.log(stdout.toString(), stderr.toString());
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
        expect(xfs.existsSync(path.join(__dirname, '../example/__test_less.css'))).to.be(true);
        xfs.sync().rm(path.join(__dirname, '../example/__test_less.css'));
        done();
      });
    });

    it('should work fine when build single file 1', function (done) {
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
        expect(xfs.existsSync(path.join(__dirname, '../example/css/custom/test_less.css'))).to.be(true);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/custom/test_less.less.js'))).to.be(true);
        xfs.sync().rm(path.join(__dirname, '../example/css/custom'));
        done();
      });
    });
    it('should work fine when build single file with var 2', function (done) {
      var cmd = 'node bin/cube build -p cube-less,cube-ejs,cube-stylus ./example/test/test_require_with_var.coffee -b ./example -o ./example/test/test_require_with_var_dir';
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
        var target = path.join(__dirname, '../example/test/test_require_with_var_dir/test/test_require_with_var.js');
        var fileCnt = xfs.readFileSync(target).toString();
        expect(fileCnt).to.match(/'\/test\/'\+\w\+'\.js',function/ig);
        expect(fileCnt).to.match(/'\/test\/'\+\w\+'_require_var\.js',function/ig);
        expect(fileCnt).to.match(/'\/test\/'\+\w\,function/ig);
        expect(fileCnt).to.match(/\w\+'\.js',function/ig);
        expect(fileCnt).to.match(/\w,function/ig);
        //expect(xfs.existsSync(path.join(__dirname, '../example/css/custom'))).to.be(true);
        //expect(xfs.existsSync(path.join(__dirname, '../example/css/custom.js'))).to.be(true);
        xfs.sync().rm(path.dirname(path.dirname(target)));
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
        var content = xfs.readFileSync(path.join(__dirname, '../example/css/custom/test_less_img.css')).toString();
        expect(content).to.match(/\/resouce_path\/a/);
        expect(xfs.existsSync(path.join(__dirname, '../example/css/custom/test_less_img.less.js'))).to.be(true);
        xfs.sync().rm(path.join(__dirname, '../example/css/custom'));
        done();
      });
    });

    it('should work fine with --remote option', function (done) {
      var cmd = 'node bin/cube build --remote TEST -p cube-less,cube-ejs,cube-stylus ./example/test/test_require_with_var.coffee -b ./example -o ./example/test/test_require_with_var';
      exec(cmd, function (err, stdout, stderr) {
        var res = stdout.toString().split('\n');
        // console.log(stdout.toString(), stderr.toString());
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
        var target = path.join(__dirname, '../example/test/test_require_with_var/test/test_require_with_var.js');
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
    it('should work fine with -t option', function (done) {
      var cmd = 'node bin/cube build -t example/test/test_es2015.js -o example/test/out';
      exec(cmd, function (err, stdout, stderr) {
        var res = stdout.toString().split('\n');
        // console.log(stdout.toString(), stderr.toString());
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
        var target = path.join(__dirname, '../example/test/out/test_es2015.js');
        var fileCnt = xfs.readFileSync(target).toString();
        expect(fileCnt).not.to.match(/class Point/);
        expect(fileCnt).not.to.match(/=>/);
        expect(fileCnt).not.to.match(/`.*\$\{.+\}.*`/);
        expect(fileCnt).not.to.match(/let/);
        xfs.sync().rm(path.join(__dirname, '../example/test/out'));
        done();
      });
    });
    it('should work fine to transform jsx', function (done) {
      var cmd = 'node bin/cube build -p cube-react -t example/test/test_react_es2015.jsx -o example/test/out';
      exec(cmd, function (err, stdout, stderr) {
        var res = stdout.toString().split('\n');
        // console.log(stdout.toString(), stderr.toString());
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
        var target = path.join(__dirname, '../example/test/out/test_react_es2015.js');
        var fileCnt = xfs.readFileSync(target).toString();
        expect(fileCnt).not.to.match(/<.*>/);
        expect(fileCnt).not.to.match(/`.*\$\{.+\}.*`/);
        xfs.sync().rm(path.join(__dirname, '../example/test/out'));
        done();
      });
    });
  });
});
