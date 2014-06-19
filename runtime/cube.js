/*!
 * cube: example/cube.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 *
 * run in browser
 */
(function (HOST, rename) {

  var BASE = '';
  var CHARSET = 'utf-8';
  var VERSION = new Date().getTime();
  var TIMEOUT = 10000; // default 10's
  var DEBUG = false;

  /**
   * Class Cube
   *
   * 1. used as loaded module enter
   *   Cube(name, requires, callback);
   * 2. used as Cube constructor
   *   var loader = new Cube(name);
   *   loader.load(requires, callback);
   * @public
   * @param
   */
  function Cube (name, requires, callback) {
    if (arguments.length === 3) {
      var ld = new Cube(name);
      ld.load(requires, callback);
    } else {
      this.name = name ? name : '_';
      this.base = BASE;
      this.charset = CHARSET;
    }
  };
  /**
   * init global setting for Cube
   * @static
   * @param  {Object} config {base, charset, version, debug, timeout}
   * @return {Object} Cube
   */
  Cube.init = function (config) {
    if (config.base && config.base !== '/') {
      BASE = config.base;
    }
    if (config.charset) {
      CHARSET = config.charset;
    }
    if (config.version) {
      VERSION = config.version;
    }
    if (config.debug) {
      DEBUG = config.debug;
    }
    if (config.timeout) {
      TIMEOUT = config.timeout;
    }
    return this;
  };
  /**
   * global switch for loading compressed-code, or source code
   * it's useful in pre env for debug, much better then sourcemap
   * @public
   */
  Cube.source = function () {

  };
  /**
   * loading module async, this function only support abs path
   * @public
   * @param  {Path}     mod module abs path
   * @param  {Function} cb  callback function, usually with module.exports as it's first param
   * @return {Object}   Cube
   */
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
   * @interface inject css into page
   * css inject is comp
   * ie8 and lower only support 32 stylesheets, so this function
   * @param  {String} name module name
   * @param  {CssCode} css  css code
   */
  Cube.css = function (name, css) {
    /*
    var style = document.createElement('style');
    style.setAttribute('mod', name);
    document.getElementsByTagName('HEAD')[0].appendChild(style);
    */
  };
  /**
   * remove module from mem cache
   * css remove should override this function to delete style node
   * @interface
   * @param  {Path}     name module name
   * @return {Object}   Cube
   */
  Cube.remove = function (name) {
    //
  };
  /**
   * register module in to cache
   * @param  {string} name    [description]
   * @param  {} exports [description]
   * @return {[type]}         [description]
   */
  Cube.register = function (name, exports) {
    var cached = this._cached[name];
    if (cached) {
      console.error('module already registered:', name);
    } else {
      this._cached[name] = exports;
    }
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
    return Cube._cached[mod];
  }
  function Async(mod, cb) {
    Cube.use(mod, cb);
  }
  /**
   get module by name
   **/
  Cube.module = function (name) {
    return this._cached[name];
  };
  Cube.prototype = {
    /**
     * load script from server
     * @param {string|array} require
     * @param {function} cb callback
     */
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
        }, TIMEOUT);
      }

      if (!require) {
        require = [];
      } else if (typeof require === 'string') {
        require = [require];
      }
      //if(!cb) cb = function(){};
      var len = require.length;
      var _stack = [];
      var ifCycle = false;
      this._load_stack = {
        req: _stack,
        total: len,
        cb: cb,
        count: 0
      };
      if (len) {
        for (var i = 0, tmp; i < len ; i++) {
          tmp = require[i];
          if (DEBUG) {
            if (!Cube._tree[tmp]) {
              Cube._tree[tmp] = {};
            }
            Cube._tree[tmp][mName] = true;
            ifCycle = this._checkCycle(tmp);
          }
          if (!ifCycle) {
            _stack.push(tmp);
            this._loadScript(tmp);
          }
        }
        if (!_stack.length) {
          this._leafMod(cb);
        }
      } else {
        this._leafMod(cb);
      }
    },
    /**
     * [_loaded description]
     * @return {[type]} [description]
     */
    _leafMod: function (cb) {
      var mod;
      var module = {exports : {}};
      if (cb) {
        mod = cb.apply(HOST, [module, module.exports, Require, Async, '', '']);
      }
      if (!mod) {
        mod = true;
      } else {
        mod.__filename = this.name;
      }
      Cube._cached[this.name] = mod;
      fireMod(this.name);
    },
    _checkCycle: function (name, parents) {
      if (!parents) {
        parents = [name];
      }
      var tmp = Cube._tree[name];
      var tmpParent;
      var flag;
      if (!tmp) {
        return false;
      }
      for (var i in tmp) {
        if (parents.indexOf(i) !== -1) {
          parents.unshift(i);
          console.warn('[WARNNING]', 'cycle require : ' + parents.join(' > '));
          return true;
        }
        tmpParent = parents.slice(0);
        tmpParent.unshift(i);
        flag = this._checkCycle(i, tmpParent);
        if (flag) {
          return true;
        }
      }
      return false;
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
            mod = flag.cb.apply(HOST, [module, module.exports, Require, Async, s_filename, s_dirname]);
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
          fireMod(ww);
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
      var _src = [ this.base, name, '?m=1&', VERSION];
      script.src = _src.join('');
    }
  };
  /**
   * fire a module loaded event
   * @param  {String} name modulename
   */
  function fireMod(name) {
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
        // one module self is loaded ,so fire it
        fireMod(n);
      }
    }
  }

  rename = rename ? rename : 'Cube';
  if (HOST[rename]) {
    console.log('window.' + rename + ' already in using, replace the last "null" param in cube.js');
  } else {
    HOST[rename] = Cube;
  }
})(window, null);