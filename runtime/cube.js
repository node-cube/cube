/*!
 * cube: example/cube.js
 * Authors  : fish (https://github.com/fishbar)
 * Authors  : HQidea (https://github.com/HQidea)
 * Create   : 2014-04-18 15:32:20
 * Refactor : 2016-02-29
 * CopyRight 2014 (c) Fish And Other Contributors
 *
 * run in browser
 */
(function (global, alias) {
  /* short global val */
  var win = window;
  var doc = document;
  var log = console;
  
  /* settings */
  var base = '';
  var remoteBase = {};
  var remoteSeparator = ':';
  var charset = 'utf-8';
  var version = +new Date();
  var strict = true;
  var debug = false;
  var entrances = {};  // Cube.use's cb
  
  var installedModules = {/*exports, fn, loaded, fired*/};  // The module cache
  var loading = {};
  var head = doc.querySelector('head');
  function noop() {}

  /**
   * The require function
   * @param module
   * @param namespace
   * @returns {*}
   * @private
   */
  function __cube_require__(module, namespace) {
    if (arguments.length === 1) {
      return fireModule(module);
    } else {
      var css = fireModule(module);
      Cube.css(css, namespace, module);
    }
  }

  /**
   * The load function
   * @param module
   * @param namespace
   * @param cb
   * @private
   */
  function __cube_load__(module, namespace, cb) {
    if (arguments.length === 2 && typeof namespace === 'function') {
      cb = namespace;
      namespace = null;
      Cube.use(module, cb);
    } else {
      Cube.use(module, function (css) {
        css = Cube.css(css, namespace, module);
        cb && cb(css);
      });
    }
  }


  /**
   * If mod is like 'remoteXXX:/com/user/index.js', replace remoteXXX with path defined in init()
   */
  function reBase(mod) {
    var offset = mod.indexOf(remoteSeparator);
    if (offset > 0) {
      return remoteBase[mod.substr(0, offset)] + mod.substr(offset + 1);
    } else {
      return '';
    }
  }

  function fixUseModPath(mods) {
    var len = mods.length;
    var mod;
    for (var i = 0; i < len; i++) {
      mod = mods[i];
      if (mod.indexOf(remoteSeparator) === -1) {
        /** fix #12 **/
        if (mod.indexOf('./') === 0) {  // be compatible with ./test.js
          mods[i] = mod.substr(1);
        } else if (mod[0] !== '/') {    // be campatible with test.js
          mods[i] = '/' + mod;
        }
      }
    }
    return mods;
  }

  function checkAllDownloaded() {
    for (var i in loading) {
      if (loading.hasOwnProperty(i)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 下载模块
   * @param requires
   * @param referer
   */
  function load(requires, referer) {
    if (typeof requires === 'string') {
      requires = [requires];
    }
    requires.forEach(function (require) {
      if (installedModules[require]) {
        return;
      }
      // download form server
      var script = doc.createElement('script');
      script.type = 'text/javascript';
      script.async = 'true';
      script.charset = charset;

      var rebaseName = reBase(require);
      var srcPath = [rebaseName || (base + require), '?m=1&', version].join('');
      if (debug) {
        srcPath += '&ref=' + referer;
      }
      script.src = srcPath;

      head.appendChild(script);
      installedModules[require] = {
        exports: {},
        loaded: false,
        fired: false
      };
      loading[require] = true;
    });
    if (checkAllDownloaded()) {
      startAppAndCallback();
    }
  }

  /**
   * 运行模块
   * @param module
   * @returns {*}
   */
  function fireModule(module) {
    function fire() {
      var m = installedModules[module];

      // sometimes, module in server side not found,
      // m is undefined
      if (!m) {
        throw new Error('Cube Error: Cannot find module ' + '\'' + module + '\'');
      }
      if (!m.fired) {
        m.fired = true;
        m.exports = m.fn.apply(global, [m, m.exports, __cube_require__, __cube_load__]);
      }

      return m.exports;
    }

    if (strict) {
      return fire();
    } else {
      try {
        return fire();
      } catch (e) {
        log.error(e);
        return {};
      }
    }
  }

  /**
   * 从Cube.use的文件开始自上而下运行,并调用回调函数
   */
  function startAppAndCallback() {
    var key, arr;

    for (key in entrances) {
      if (entrances.hasOwnProperty(key)) {
        arr = key.split(',');
        arr.forEach(function (entrance) {
          var count = 0;
          fireModule(entrance);
          entrances[key].forEach(function (fn) {
            var called = fn(installedModules[entrance].exports);
            if (called) {
              count++;
            }
          });
          if (entrances[key].length === count) {  // 回调函数都执行完后删除
            delete entrances[key];
          }
        });
      }
    }
  }


  /**
   * 非构造函数,只供模块的wrapper调用
   * @param name
   * @param requires
   * @param callback
   */
  function Cube(name, requires, callback) {
    if (!installedModules[name]) {
      installedModules[name] = {
        exports: {},
        loaded: false,
        fired: false
      };
    }

    var module = installedModules[name];
    module.fn = callback;
    module.loaded = true;
    delete loading[name];
    load(requires, name);
  }

  /** version, will replace in `make release` **/
  Cube.toString = function () {
    return 'Cube:v$$version$$';
  };

  /**
   * init global setting for Cube
   * @static
   * @param  {Object} config {base, remoteBase, charset, version}
   */
  Cube.init = function (config) {
    if (config.base && config.base !== '/') {
      base = config.base.replace(/\/$/, '');
    }
    if (config.remoteBase) {
      for (var key in config.remoteBase) {
        if (config.remoteBase.hasOwnProperty(key)) {
          remoteBase[key] = config.remoteBase[key].replace(/\/$/, '');
        }
      }
    }
    if (config.charset) {
      charset = config.charset;
    }
    if (config.version) {
      version = config.version;
    }
    if (config.strict !== undefined) {
      strict = config.strict;
    }
    return this;
  };
  /**
   * loading module async, this function only support abs path
   * @public
   * @param  {Path}     mods module abs path
   * @param  {Function} cb  callback function, usually with module.exports as it's first param
   * @param  {Boolean}  noFix used only in single mode
   */
  Cube.use = function (mods, cb, noFix) {
    if (!mods) {
      throw new Error('Cube.use(moduleName) moduleName is undefined!');
    }
    cb = cb || noop;

    if (typeof mods === 'string') {
      mods = [mods];
    }
    if (!noFix) {
      mods = fixUseModPath(mods);
    }

    if (!entrances[mods]) {
      entrances[mods] = [];
    }
    entrances[mods].push(function () {
      var apps = [];
      var length = mods.length;
      var firing = false;

      return function (exports) {
        if (firing) {
          return;
        }
        apps.push(exports);
        if (apps.length === length) {
          firing = true;
          cb.apply(global, apps);
          return true;
        }
      };
    }());

    load(mods, 'Cube.use');
    return this;
  };
  /**
   * register module in to cache
   * @param  {string} module    [description]
   * @param  {} exports [description]
   */
  Cube.register = function (module, exports) {
    if (installedModules[module]) {
      return log.error('Cube Error: Module ' + '\'' + module + '\'' + ' already registered');
    }
    installedModules[module] = {
      exports: exports,
      fn: noop,
      loaded: true,
      fired: true
    };
    return this;
  };
  /**
   * @interface inject css into page
   * css inject is comp
   * ie8 and lower only support 32 stylesheets, so this function
   * @param  {String} name module name
   * @param  {CssCode} css  css code
   */
  var parseCssRe = /([^};]+)(\{[^}]+\})/g;
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
      css = css.replace(parseCssRe, function (m0, m1, m2) {
        var selectors = m1.split(',').map(function (selector) {
          return namespace + ' ' + selector.trim();
        });
        return selectors.join(',') + m2;
      });
    }
    var style = doc.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('mod', file);
    if (namespace) {
      style.setAttribute('ns', namespace);
    }
    head.appendChild(style);
    style.innerHTML = css;
    return css;
  };


  /* debug */
  Cube.debug = function () {
    if (win.localStorage && win.addEventListener) {
      localStorage.cube = 'debug';
      location.reload();
    } else {
      log.error('Cube Error: Cannot debug, your browser does not support localStorage or addEventListener');
    }
  };

  Cube.cache = function () {
    var unloaded = {}, unfired = {}, i, m;

    for (i in installedModules) {
      if (installedModules.hasOwnProperty(i)) {
        m = installedModules[i];
        if (!m.loaded) {
          unloaded[i] = m;
        }
        if (!m.fired) {
          unfired[i] = m;
        }
      }
    }

    log.info('modules:', installedModules);
    log.info('unloaded:', unloaded);
    log.info('unfired:', unfired);
  };

  if (win.localStorage && localStorage.cube === 'debug') {
    debug = true;
    win.addEventListener('load', Cube.cache);
  }


  alias = alias || 'Cube';
  if (global[alias]) {
    log.error('Cube Error: window.' + alias + ' already in using, replace the last "null" param in cube.js');
  } else {
    global[alias] = Cube;
  }


  /**
   * intergration with <script> tag
   * <script data-base="" src=""></script>
   */
  var cse = doc.currentScript;
  if (cse) {
    var cfg = cse.dataset;
    if (cfg.base) {
      Cube.init(cfg);
      Cube.use(cfg.main || 'index.js', function(app){app.run&& app.run();});
    }
  }
})(window, null);
