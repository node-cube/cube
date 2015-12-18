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
  var ENABLE_CSS = false;
  // var ENABLE_SOURCE = window.localStorage ? window.localStorage.getItem('__cube_debug__') : false;
  var HEAD = document.getElementsByTagName('head')[0];

  var MOD_LOADING = 1;
  var MOD_LOADED = 0;
  var CACHED = {};
  var FLAG = {};
  var TREE = {}; // parent -> child
  var RTREE = {}; // child -> parent

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
    if (arguments.length === 3) { // register module
      var ld = new Cube(name);
      ld.load(requires, callback);
    } else { // new loader
      this.name = name ? name : '_';
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
    if (mod.indexOf(REMOTE_SEPERATOR) === -1) {
      /** fix #12 **/
      if (mod.indexOf('./') === 0) {  // be compatible with ./test.js
        mod = mod.substr(1);
      } else if (mod[0] !== '/') {    // be campatible with test.js
        mod = '/' + mod;
      }
    }
    var ll = new Cube();
    FLAG[ll.name] = [];
    FLAG[ll.name].module = {exports: {}};
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
  function Require(mod, ns) {
    if (ns !== undefined) {
      var css = CACHED[mod];
      Cube.css(css, ns, mod);
    }
    return CACHED[mod];
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
    return this.CACHED[name];
  };
  Cube.prototype = {
    /**
     * load script from server
     * @param {string|array} require
     * @param {function} cb callback
     */
    load: function (require, cb) {
      if (!require) {
        require = [];
      } else if (typeof require === 'string') {
        require = [require];
      }
      this._leafMod(cb);
    },
    /**
     * the module without require
     */
    _leafMod: function (cb) {
      var mod;
      var name = this.name;
      var module = FLAG[name].module;
      if (cb) {
        mod = cb.apply(HOST, [module, module.exports, Require, Async, '', '']);
      }
      if (!mod) {
        mod = true;
      }
      CACHED[name] = mod;
      FLAG[name].status = MOD_LOADED;
    },
    _genScriptTag: function (name) {
      var script = HEAD.appendChild(document.createElement('script'));
      script.type = 'text/javascript';
      script.async = 'true';
      script.charset = this.charset;
      // because here can not detect css file or js file
      // so ignore js source file like:  jquery.scroll.js
      // if (ENABLE_SOURCE && !/\.\w+\.js$/.test(name)) {
      //   name = name.replace(/\.js$/, '.source.js');
      // }
      var rebaseName = reBase(name);
      // module in node_modules, but can not find both in browser or server
      // if (rebaseName.indexOf('/') !== 0) {
      //  return console.error('[CUBE] module not found:', name, ', should install module in server side, or register(mod) in client side');
      // }
      var srcPath = [rebaseName || (this.base + name), '?m=1&', VERSION].join('');
      script.src = srcPath;
    }
  };
  /**
   * fire a module loaded event
   * @param  {String} name modulename
   */
  function fireMod(name) {
    var parent, res = {};
    var modFlag = FLAG[name];
    if (modFlag) {
      for (var n = modFlag.length - 1; n >= 0; n--) {
        parent = modFlag[n](name);
        if (parent) {
          // module relative ok
          modFlag.splice(n, 1);
          // should notify the parent mod
          res[parent] = true;
          // reset cursor n
          n = modFlag.length;
        }
      }

      if (!modFlag.length) {
        // all deps done
        delete FLAG[name];
      }

      for (n in res) {
        // one module self is loaded, so fire it
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
