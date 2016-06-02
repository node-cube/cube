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
  var settings = {
    base: '',
    remoteBase: {},
    remoteSeparator: ':',
    charset: 'utf-8',
    version: +new Date(),
    debug: false,
    entrances: {}  // Cube.use's cb
  };
  var installedModules = {/*exports, fn, loaded, fired*/};  // The module cache
  var loading = {};
  var head = document.querySelector('head');
  var runLock = false;
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
      return helpers.fireModule(module);
    } else {
      var css = helpers.fireModule(module);
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

  var helpers = {
    /**
     * If mod is like 'remoteXXX:/com/user/index.js', replace remoteXXX with path defined in init()
     */
    reBase: function (mod) {
      var offset = mod.indexOf(settings.remoteSeparator);
      if (offset > 0) {
        return settings.remoteBase[mod.substr(0, offset)] + mod.substr(offset + 1);
      } else {
        return '';
      }
    },
    fixUseModPath: function (mods) {
      var len = mods.length;
      var mod;
      for (var i = 0; i < len; i++) {
        mod = mods[i];
        if (mod.indexOf(settings.remoteSeparator) === -1) {
          /** fix #12 **/
          if (mod.indexOf('./') === 0) {  // be compatible with ./test.js
            mods[i] = mod.substr(1);
          } else if (mod[0] !== '/') {    // be campatible with test.js
            mods[i] = '/' + mod;
          }
        }
      }
      return mods;
    },
    checkAllDownloaded: function () {
      for (var i in loading) {
        if (loading.hasOwnProperty(i)) {
          return false;
        }
      }

      return true;
    },
    /**
     * 下载模块
     * @param requires
     * @param referer
     */
    load: function (requires, referer) {
      if (typeof requires === 'string') {
        requires = [requires];
      }
      requires.forEach(function (require) {
        if (installedModules[require]) {
          return;
        }
        // download form server
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = 'true';
        script.charset = settings.charset;

        var rebaseName = helpers.reBase(require);
        var srcPath = [rebaseName || (settings.base + require), '?m=1&', settings.version].join('');
        if (settings.debug) {
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
      if (helpers.checkAllDownloaded()) {
        helpers.startAppAndCallback();
      }
    },
    /**
     * 运行模块
     * @param module
     * @returns {*}
     */
    fireModule: function (module) {
      var m = installedModules[module];

      // sometimes, module in server side not found,
      // m is undefined
      if (!m) {
        return console.error('Cube Error: Cannot find module ' + '\'' + module + '\'');
      }
      if (!m.fired) {
        m.fired = true;
        m.exports = m.fn.apply(global, [m, m.exports, __cube_require__, __cube_load__]);
      }

      return m.exports;
    },
    /**
     * 从Cube.use的文件开始自上而下运行,并调用回调函数
     */
    startAppAndCallback: function () {
      if (runLock) {  // 确保只有一个实例会执行, 解决fireModule可能导致同时多次执行该函数的问题
        return;
      }

      runLock = true;
      var entrances = settings.entrances;
      var key, arr;

      for (key in entrances) {
        if (entrances.hasOwnProperty(key)) {
          arr = key.split(',');
          arr.forEach(function (entrance) {
            var count = 0;
            helpers.fireModule(entrance);
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

      runLock = false;
    }
  };

  /**
   * 非构造函数,只供模块的wrapper调用
   * @param name
   * @param requires
   * @param callback
   */
  function Cube(name, requires, callback) {
    //var requiresLoaded = false;

    // if (arguments.length === 3) {
    if (!installedModules[name]) {
      installedModules[name] = {
        exports: {},
        loaded: false,
        fired: false
      };
      /*
      requiresLoaded = true;
      if (requires.length && settings.debug) {
        console.info('Cube Info: Module ' + '\'' + requires + '\'' + ' should exist');
      }
      */
    }
    var module = installedModules[name];
    module.fn = callback;
    module.loaded = true;
    delete loading[name];
    //if (!requiresLoaded) {
    helpers.load(requires, name);
    //}
    // }
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
      settings.base = config.base.replace(/\/$/, '');
    }
    if (config.remoteBase) {
      for (var key in config.remoteBase) {
        if (config.remoteBase.hasOwnProperty(key)) {
          settings.remoteBase[key] = config.remoteBase[key].replace(/\/$/, '');
        }
      }
    }
    if (config.charset) {
      settings.charset = config.charset;
    }
    if (config.version) {
      settings.version = config.version;
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
      mods = helpers.fixUseModPath(mods);
    }
    helpers.load(mods, 'Cube.use');

    if (!settings.entrances[mods]) {
      settings.entrances[mods] = [];
    }
    settings.entrances[mods].push(function () {
      var apps = [];
      var length = mods.length;
      return function (entrance) {
        apps.push(entrance);
        if (apps.length === length) {
          cb.apply(global, apps);
          return true;
        }
      };
    }());
    if (helpers.checkAllDownloaded()) {  // 解决load已存在的模块时,不会进startAppAndCallback
      helpers.startAppAndCallback();
    }
    return this;
  };
  /**
   * register module in to cache
   * @param  {string} module    [description]
   * @param  {} exports [description]
   */
  Cube.register = function (module, exports) {
    if (installedModules[module]) {
      return console.error('Cube Error: Module ' + '\'' + module + '\'' + ' already registered');
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
    var style = document.createElement('style');
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
  if (window.localStorage && localStorage.cube === 'debug') {
    settings.debug = true;
    Cube.info = function () {
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

      console.info('modules:', installedModules);
      console.info('unloaded:', unloaded);
      console.info('unfired:', unfired);
    };
  }


  alias = alias || 'Cube';
  if (global[alias]) {
    console.error('Cube Error: window.' + alias + ' already in using, replace the last "null" param in cube.js');
  } else {
    global[alias] = Cube;
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
