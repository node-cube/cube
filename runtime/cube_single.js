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
  // var DEBUG = false;
  // var ENABLE_CSS = false;
  // var ENABLE_SOURCE = window.localStorage ? window.localStorage.getItem('__cube_debug__') : false;
  var HEAD = document.getElementsByTagName('head')[0];

  var MOD_LOADING = 1;
  var MOD_LOADED = 0;
  var CACHED = {};
  var FLAG = {};
  var TREE = {}; // parent -> child
  var RTREE = {}; // child -> parent
  var count = 0;

  function dummy() {}

  /**
   * If mod is like 'remoteXXX:/com/user/index.js', replace remoteXXX with path defined in init()
   */
  function reBase(mod) {
    var offset = mod.indexOf(REMOTE_SEPERATOR);
    if (offset > 0) {
      return REMOTE_BASE[mod.substr(0, offset)] + mod.substr(offset + 1);
    } else {
      return '';
    }
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
  function Cube(name, requires, callback) {
    if (arguments.length === 3) {
      var ld = new Cube(name);
      ld.load(requires, callback);
    } else {
      this.name = name ? name : '_' + (count++);
      this.base = BASE;
      this.charset = CHARSET;
      // FLAG[this.name] = [];
      // FLAG[this.name].module = {exports: {}};
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
        REMOTE_BASE[key] = config.remoteBase[key].replace(/\/$/, '');
      }
    }
    if (config.charset) {
      CHARSET = config.charset;
    }
    if (config.version) {
      VERSION = config.version;
    }
    // if (config.debug) {
    //   DEBUG = config.debug;
    // }
    if (config.timeout) {
      TIMEOUT = config.timeout;
    }
    /*
    if (config.enableCss) {
      ENABLE_CSS = config.enableCss;
    }
    */
    return this;
  };
  /**
   * global switch for loading compressed-code, or source code
   * it's useful in pre env for debug, much better then sourcemap
   * @public
   */
  /*
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
  */
  function fixUseModPath(mods) {
    if (typeof mods === 'string') {
      mods = [mods];
    }
    var len = mods.length;
    var mod;
    for (var i = 0; i < len; i++) {
      mod = mods[i];
      if (mod.indexOf(REMOTE_SEPERATOR) === -1) {
        /** fix #12 **/
        if (mod.indexOf('./') === 0) {  // be compatible with ./test.js
          mod = mod.substr(1);
        } else if (mod[0] !== '/') {    // be campatible with test.js
          mod = '/' + mod;
        }
      }
    }
    return mods;
  }
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
    mod = fixUseModPath(mod);
    mod.forEach(function (v, i, a) {
      a[i] = CACHED[v];
    });
    cb.apply(window, mod);
    return this;
  };
  /**
   * @interface inject css into page
   * css inject is comp
   * ie8 and lower only support 32 stylesheets, so this function
   * @param  {String} name module name
   * @param  {CssCode} css  css code
   */
  var parseCssRe = /\}\n?([\s\S]*?)\{/g;
  var cssMod = {};
  Cube.css = function (css, namespace, file) {
    if (!css) {
      return;
    }
    var modId = file + '@' + namespace;
    if (cssMod[modId]) {
      return;
    }
    cssMod[modId] = true;
    if (namespace) {
      css = css.replace(/([^};]+)(\{[^}]+\})/g, function (m0, m1, m2) {
        var selectors = m1.split(',').map(function (selector) {
          return namespace + ' ' + selector.trim();
        });
        return selectors.join(',') + m2;
      });
    }
    var style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('mod', file);
    if (namespace) {
      style.setAttribute('ns', namespace);
    }
    HEAD.appendChild(style);
    style.innerHTML = css;
    return css;
  };
  /**
   * remove module from mem cache
   * css remove should override this function to delete style node
   * @interface
   * @param  {Path}     name module name
   * @return {Object}   Cube
   */
  Cube.remove = function (name) {
    delete CACHED[name];
  };
  /**
   * register module in to cache
   * @param  {string} name    [description]
   * @param  {} exports [description]
   * @return {[type]}         [description]
   */
  Cube.register = function (name, exports) {
    var cached = CACHED[name];
    if (cached) {
      console.error('module already registered:', name);
    } else {
      CACHED[name] = exports;
    }
  };
  /**
   * module already loaded
   */
  Cube._cached = CACHED;
  /**
   * module loaded broadcast
   */
  Cube._flag = FLAG;
  Cube._rtree = RTREE;
  Cube._tree = TREE;
  /**
   * global require function
   * @param  {[type]} mod [description]
   * @return {[type]}     [description]
   */
  function Require(mod, ns, cb) {
    var len = arguments.length;
    if (len > 1) {
      if (typeof ns === 'function') {
        Cube.use(mod, ns);
      } else {
        if (cb && typeof cb === 'function') {
          Cube.use(mod, function (css) {
            css = Cube.css(css, ns, mod);
            cb && cb(css);
          });
        } else {
          Cube.css(CACHED[mod], ns, mod);
        }
      }
    } else {
      return CACHED[mod];
    }
  }
  /**
   get module by name
   **/
  Cube.module = function (name) {
    return this.CACHED[name];
  };
  Cube.prototype = {
    /**
     * load script from server
     * @param {string|array} require
     * @param {function} cb callback
     */
    load: function (require, cb) {
      if (typeof require === 'string') {
        // setup file timeout
        setTimeout(function () {
          if (FLAG[require]) {
            console.error('load script timeout:', require);
          }
        }, TIMEOUT);
      }

      if (!require) {
        require = [];
      } else if (typeof require === 'string') {
        require = [require];
      }
      // module without requires
      this._leafMod(require, cb);
    },
    /**
     * the module without require
     */
    _leafMod: function (requires, cb) {
      var mod;
      var name = this.name;
      var module = CACHED[name] || {exports: {}};
      requires.forEach(function (m) {
        if (!CACHED[m]) {
          CACHED[m] = {
            exports: {}
          };
        }
      });
      if (cb) {
        // mod = cb.apply(HOST, [module, module.exports, Require, Async, '', '']);
        mod = cb.apply(HOST, [module, module.exports, Require, Require, '', '']);
      }
      if (!mod) {
        mod = true;
      }
      CACHED[name] = mod;
    }
  };
  rename = rename || 'Cube';
  if (HOST[rename]) {
    console.log('window.' + rename + ' already in using, replace the last "null" param in cube.js');
  } else {
    HOST[rename] = Cube;
  }
  /**
   * intergration with <script> tag
   * <script data-base="" src=""></script>
   */
  var cse = document.currentScript;
  if (cse) {
    var cfg = cse.dataset;
    if (cfg.base) {
      Cube.init(cfg);
      Cube.use(cfg.main || 'index.js', function(app){app.run&& app.run();});
    }
  }
})(window, null);