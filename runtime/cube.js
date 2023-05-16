/*!
 * cube: runtime/cube.js
 * Authors  : fish (https://github.com/fishbar)
 * Authors  : HQidea (https://github.com/HQidea)
 * Create   : 2014-04-18 15:32:20
 * Refactor : 2016-02-29
 * CopyRight 2014 (c) Fish And Other Contributors
 *
 * this file is running in browser
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
  var version;
  var strict = true;
  var debug = true;
  var entrances = {};  // Cube.use's cb
  /**
   * The module cache
   * mod = {exports, fn, fired}
   */
  var installedModules = {};
  var loading = 0;
  var head = doc.querySelector('head');
  function noop() {}

  console.time('cube load');
  /**
   * The require function
   * @param module
   * @param namespace
   * @returns {*}
   * @private
   */
  function __cube_require__(module, namespace) {
    let mod = fireModule(module);
    if (mod._css_) {
      Cube.css(mod._css_, namespace, module);
      mod = module;
    }
    return mod;
  }
  /**
   * This function creates the load function
   */
  function __cube_async__(module, namespace, cb) {
    if (arguments.length === 2 && typeof namespace === 'function') {
      cb = namespace;
      namespace = '';
    }
    Cube.use(module, (mod) => {
      if (mod._css_) {
        Cube.css(mod._css_, namespace, module);
        mod = module; // css module only return the css file name
      }
      cb && cb(mod);
    });
  };
  /**
   * If mod is like 'remoteXXX:/com/user/index.js', replace remoteXXX with path defined in init()
   */
  function reBase(mod) {
    var offset = mod.indexOf ? mod.indexOf(remoteSeparator) : 0;
    if (offset > 0) {
      return remoteBase[mod.substr(0, offset)] + mod.substr(offset + 1);
    } else {
      return '';
    }
  }

  function fixUseModPath(mod) {
    if (mod.indexOf(remoteSeparator) === -1) {
      /** fix #12 **/
      if (mod.indexOf('./') === 0) {  // be compatible with ./test.js
        mod[i] = mod.substr(1);
      } else if (mod[0] !== '/') {    // be campatible with test.js
        mod[i] = '/' + mod;
      }
    }
    return mod;
  }

  function checkAllDownloaded() {
    if (loading > 0) {
      return false;
    }
    console.timeEnd('cube load');
    execEntry();
  }
  /**
   * loading script from server
   * @param requires
   * @param referer
   */
  function load(requires, referer) {
    for (let i=0, ll = requires.length;i<ll; i++) {
      let require = requires[i];
      if (installedModules[require]) {
        return;
      }
      // load script from server
      var script = doc.createElement('script');
      script.type = 'text/javascript';
      script.async = 'true';
      script.onerror = () => {
        // set up required module loading error
        // so the require(module) will print this error message
        Cube(require, [], () => {
          console.error(`load module: ${require} failed.`);
        });
      };
      var srcPath = reBase(require) || (base + require);
      var q = ['m', version];
      script.src = srcPath + '?' + q.join('&');
      installedModules[require] = {
        exports: {},
        fired: false
      };
      // loading[require] = true;
      loading ++;
      head.appendChild(script);
    }
  }

  /**
   * 运行模块
   * @param module
   * @returns {*}
   */
  function fireModule(module) {
    var m = installedModules[module];
    if (!m) {
      let e = new Error('Cube Error: Cannot find module ' + '\'' + module + '\'');
      throw e;
    }
    if (!m.fired) {
      m.fired = true;
      try {
        m.fn.apply(global, [m, m.exports, __cube_require__, __cube_async__]);
      } catch (e) {
        log.error(`Cube Error: module "${module}" init error,` + e.message);
      }
    }
    return m.exports;
  }

  /**
   * 从Cube.use的文件开始自上而下运行,并调用回调函数
   */
  function execEntry() {
    let key, arr;
    console.time('cube exec');
    for (key in entrances) {
      let count = 0;
      let mod = fireModule(key);
      entrances[key].forEach(function (fn) {
        fn(mod);
      });
      delete entrances[key];
    }
    console.timeEnd('cube exec');
  }

  /**
   * module wrapper function
   * Cube('name', function() {})
   * Cube('name', [], function(){})
   * @param name
   * @param requires
   * @param callback
   */
  function Cube(name, requires, callback) {
    var mod = installedModules[name];
    var preload = false;
    // preload module will trigger this condition
    if (!mod) {
      mod = installedModules[name] = {
        exports: {},
        fired: false
      };
      preload = true;
    }
    if (!callback) {
      callback = requires;
      requires = [];
    } 
    mod.fn = callback;
    if (requires.length) {
      load(requires, name);
    }

    if (!preload) {
      loading--;
      checkAllDownloaded();
    }
  }

  /** version, will replace in `make release` **/
  Cube.toString = function () {
    return 'Cube:v$$version$$';
  };

  /**
   * init global setting for Cube
   * @static
   * @param  {Object} config {base, remoteBase, version}
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
    if (config.version) {
      version = config.version;
    }
    return this;
  };
  /**
   * loading module async, this function only support abs path
   * @public
   * @param  {Path}     mod module abs path
   * @param  {Function} cb  callback function, usually with module.exports as it's first param
   */
  Cube.use = function (mod, cb) {
    if (!mod) {
      throw new Error('Cube.use(moduleName) moduleName is undefined!');
    }
    cb = cb || noop;
    mod = fixUseModPath(mod);
    if (!entrances[mod]) {
      entrances[mod] = [cb]
    } else {
      entrances[mod].push(cb)
    }
    load([mod]);
    checkAllDownloaded();
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

  /**
   * print debug info
   */
  Cube.debug = function () {
    var unfired = {}, i, m;
    for (i in installedModules) {
      if (installedModules.hasOwnProperty(i)) {
        m = installedModules[i];
        if (!m.fired) {
          unfired[i] = m;
        }
      }
    }
    log.info('modules:', installedModules);
    log.info('unfired:', unfired);
  };

  alias = alias || 'Cube';
  if (global[alias]) {
    log.error('Cube Error: window.' + alias + ' already in using, replace the last "null" param in cube.js');
  } else {
    global[alias] = Cube;
  }
  /**
   * intergration with <script> tag
   * <script data-base="" src=""></script>
   *
    var cse = doc.currentScript;
    if (cse) {
      var cfg = cse.dataset;
      if (cfg.base) {
        Cube.init(cfg);
        Cube.use(cfg.main || 'index.js', function(app){
          app.run&& app.run();
        });
      }
    }
   */
})(window, null);
