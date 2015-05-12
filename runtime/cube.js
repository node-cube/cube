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
  var REMOTE_BASE = {};
  var REMOTE_SEPERATOR = ':';
  var CHARSET = 'utf-8';
  var VERSION = new Date().getTime();
  var TIMEOUT = 10000; // default 10's
  var DEBUG = false;
  var ENABLE_CSS = false;
  var ENABLE_SOURCE = window.localStorage ? window.localStorage.getItem('__cube_debug__') : false;
  var HEAD = document.getElementsByTagName('head')[0];

  function dummy() {}

  /**
   * If mod is like 'remoteXXX:/com/user/index.js', replace remoteXXX with path defined in init()
   */
  function adjustBase(mod) {
    pathes = mod.split(REMOTE_SEPERATOR);
    return REMOTE_BASE[pathes[0]] + pathes[1];
  }

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
  }
  /** version **/
  Cube.toString = function () {
    return 'Cube:v$$version$$';
  };
  /**
   * init global setting for Cube
   * @static
   * @param  {Object} config {base, charset, version, debug, timeout}
   * @return {Object} Cube
   */
  Cube.init = function (config) {
    if (config.base && config.base !== '/') {
      BASE = config.base.replace(/\/$/, '');
    }
    if (config.remoteBase) {
      for (var key in config.remoteBase) {
        config.remoteBase[key] = config.remoteBase[key].replace(/\/$/, '');
      }
      REMOTE_BASE = config.remoteBase;
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
    if (config.enableCss) {
      ENABLE_CSS = config.enableCss;
    }
    return this;
  };
  /**
   * global switch for loading compressed-code, or source code
   * it's useful in pre env for debug, much better then sourcemap
   * @public
   */
  Cube.debug = function () {
    if (window.localStorage) {
      var item = localStorage.getItem('__cube_debug__');
      if (item) {
        localStorage.removeItem('__cube_debug__');
      } else {
        localStorage.setItem('__cube_debug__', true);
      }
    }
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
    if (!cb) {
      cb = dummy;
    }
    if(mod.indexOf(REMOTE_SEPERATOR) === -1) {
      /** fix #12 **/
      if (mod.indexOf('./') === 0) {  // be compatible with ./test.js
        mod = mod.substr(1);
      } else if (mod[0] !== '/') {    // be campatible with test.js
        mod = '/' + mod;
      }
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
  Cube.css = function (mod, namespace) {};
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
  function Require(mod, ns) {
    if (ns !== undefined) {
      var css = Cube._cached[mod];
      Cube.css(css, ns, mod);
    }
    return Cube._cached[mod];
  }
  /**
   * async loading resource
   * i.e
   *   async(modName, function(mod){ //TODO// });
   *   async(cssMod, nameSpace, function(){ //TODO// });
   * @param {Path}   mod   [description]
   * @param {Function|String} cb    [description]
   * @param {Function}   param
   */
  function Async(mod, param1, param2) {
    if (typeof param1 !== 'function') {
      if (!ENABLE_CSS) {
        console.warn('[Cube] dynamic loading css disabled!');
        return;
      }
      // mod cb -> namespace
      Cube.use(mod, function (css) {
        Cube.css(css, param1, mod);
        param2 && param2(css);
      });
    } else {
      Cube.use(mod, param1);
    }
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
    load: function (req, cb) {
      var mName = this.name;
      var require = req;
      if (typeof require === 'string') {
        // setup file timeout
        setTimeout(function () {
          if (Cube._flag[req]) {
            console.error('load script timeout:', req);
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
     * the module without require
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
          flag.count++;
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
      var script = HEAD.appendChild(document.createElement('script'));
      script.type = 'text/javascript';
      script.async = 'true';
      script.charset = this.charset;
      // because here can not detect css file or js file
      // so ignore js source file like:  jquery.scroll.js
      if (ENABLE_SOURCE && !/\.\w+\.js$/.test(name)) {
        name = name.replace(/\.js$/, '.source.js');
      }
      var _src = name.indexOf(REMOTE_SEPERATOR) !== -1 ? adjustBase(name) : [ this.base, name, '?m=1&', VERSION].join('');
      script.src = _src;
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
      for (var n = ww.length - 1; n >= 0; n--) {
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
  rename = rename || 'Cube';
  if (HOST[rename]) {
    console.log('window.' + rename + ' already in using, replace the last "null" param in cube.js');
  } else {
    HOST[rename] = Cube;
  }
})(window, null);
