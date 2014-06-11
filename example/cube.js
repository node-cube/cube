/*!
 * cube: example/cube.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 *
 * run in browser
 */
(function (HOST, rename) {
  /**
   * module define
   */
  HOST._m_ = function (name, require, cb) {
    var ld = new Cube(name);
    ld.load(require, cb);
  };
  /** class Cube **/
  function Cube (name, base) {
    this.name = name ? name : '_';
    this.base = base ? base : Cube.BASE;
    this.charset = Cube.CHARSET ? Cube.CHARSET : 'utf-8';
  };
  Cube.BASE = '';
  Cube.CHARSET = 'utf-8';
  Cube.VERSION = new Date().getTime();
  Cube.init = function (config) {
    if (config.base && config.base !== '/') {
      this.BASE = config.base;
    }
    if (config.charset) {
      this.CHARSET = config.charset;
    }
    if (config.version) {
      this.VERSION = config.version;
    }
    return this;
  };
  Cube.use = function (mod, cb) {
    if (!mod) {
      throw new Error('Cube.use(moduleName) moduleName is undefined!');
    }
    var ll = new Cube();
    ll.load(mod, function (module, exports, require) {
      cb(require(mod));
    });
    return this;
  };
  /**
   * module already loaded
   */
  Cube._cached = {};
  /**
   * module loaded broadcast
   */
  Cube._flag = {};
  Cube._tree = {};
  /**
   * global require function
   * @param  {[type]} mod [description]
   * @return {[type]}     [description]
   */
  function Require(mod, cb) {
    if (cb) {
      return Cube.use(mod, cb);
    }
    return Cube._cached[mod];
  }
  /**
   get module by name
   **/
  Cube.module = function (name) {
    return this._cached[name];
  };
  Cube.prototype = {
    /**
      load script from server
      @param {string|array} require
      @param {function} cb callback
      **/
    load: function (require, cb) {
      var mName = this.name;
      if (typeof require === 'string') {
        // TODO which file timeout
        setTimeout(function () {
          var flag = false;
          for (var i in Cube._flag) {
            flag = true;
            break;
          }
          if (flag) {
            console.error('load script timeout:', require, mName);
          }
        }, 5000);
      }

      if (!require) {
        require = [];
      } else if (typeof require === 'string') {
        require = [require];
      }
      //if(!cb) cb = function(){};
      var len = require.length;
      var _stack = [];
      this._load_stack = {
        req: _stack,
        total: len,
        cb: cb,
        count: 0
      };
      if (len) {
        for (var i = 0, tmp; i < len ; i++) {
          tmp = require[i];
          if (Cube.DEBUG) {
            if (!Cube._tree[tmp]) {
              Cube._tree[tmp] = {};
            }
            Cube._tree[tmp][mName] = true;
            this._checkCycle(tmp);
          }
          _stack.push(tmp);
          this._loadScript(tmp);
        }
      } else {
        var mod;
        var module = {exports : {}};
        if (cb) {
          mod = cb.apply(HOST, [module, module.exports, Require, '', '']);
        }
        if (!mod) {
          mod = true;
        } else {
          mod.__filename = this.name;
        }
        Cube._cached[this.name] = mod;
        Cube.fire(this.name);
      }
    },
    _checkCycle: function (name, parents) {
      if (!parents) {
        parents = [name];
      }
      var tmp = Cube._tree[name];
      if (!tmp) {
        return;
      }
      for (var i in tmp) {
        if (parents.indexOf(i) !== -1) {
          var message = 'cycle require : ' + parents.join('>') + '>' + i;
          throw new Error(message);
        }
        parents.push(i);
        this._checkCycle(i, parents.slice(0));
      }
    },
    _loadScript: function (name, bool) {
      var mod = Cube._cached[name];
      var self = this;
      var ww = Cube._flag;
      function cb(mm) {
        var flag = self._load_stack;
        var ok = false;
        if (Cube._cached[mm]) {
          flag.count ++;
          ok = self.name;
        }
        // check if all require is done;
        if (flag.total <= flag.count) {
          var module = {exports : {}};
          var s_filename = self.name;
          var s_dirname = s_filename.replace(/[^\/]*$/, '');
          var mod;
          if (flag.cb) {
            mod = flag.cb.apply(HOST, [module, module.exports, Require, s_filename, s_dirname]);
          }
          if (!mod) {
            mod = true;
          } else {
            mod.__filename = self.name;
          }
          Cube._cached[self.name] = mod;
        }
        return ok;
      }

      if (mod) {
        ww = cb(name);
        if (ww !== false) {
          Cube.fire(ww);
        }
        return;
      } else if (mod === false) {
        ww[name].push(cb);
        return;
      }

      if (!ww[name]) {
        ww[name] = [];
      }
      ww[name].push(cb);
      Cube._cached[name] = false;
      var script = document.getElementsByTagName('head')[0].appendChild(document.createElement('script'));
      script.type = 'text/javascript';
      script.async = 'true';
      script.charset = this.charset;
      var _src = [ this.base, name, '?m=1&', Cube.VERSION];
      script.src = _src.join('');
    }
  };
  Cube.fire = function (name) {
    var wts = Cube._flag, ww, flag, res = {};
    ww = wts[name];
    if (ww) {
      for (var n = ww.length - 1; n >= 0; n --) {
        flag = ww[n](name);
        if (flag !== false) { // module relative ok
          ww.splice(n, 1);
          n = ww.length;
          if (flag) {
            res[flag] = true;
          }
        }
      }
      if (!ww.length) {
        delete  wts[name];
      }
      for (n in res) {
        // one module self is loaded ,so file
        Cube.fire(n);
      }
    }
  };
  rename = rename ? rename : 'Cube';
  if (HOST[rename]) {
    console.log('window.' + rename + ' already in using, replace the last "null" param in cube.js');
  } else {
    HOST[rename] = Cube;
  }
})(window, null);