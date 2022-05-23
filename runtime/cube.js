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
  var charset = 'utf-8';
  var version;
  var strict = true;
  var debug = true;
  var entrances = new Map();  // Cube.use's cb
  // 兼容请求 key 带入参，返回 key 不带入参的情况。eg. 请求 /xxx?env=xx 返回 Cube('/xxx',), requireMap 缓存了 { '/xxx': '/xxx?env=xx' }
  // 此兼容是在业务方已知的情况，后期会改造返回的代码头。
  var requireMap = {};
  var registerArr = [];

  var mockedProcess = {
    env: {NODE_ENV: 'production'}
  };
  var mockedGlobal = undefined;

  var installedModules = {/*exports, fn, loaded, fired*/};  // The module cache
  var loading = {};
  var head = doc.querySelector('head');
  function noop() {}

  /* store requires before init */
  var inited = false;
  var loadQueue = [];
  debug && console.time('cube load');
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
      return module;
    }
  }

  /**
   * This function creates the load function
   */
  function __cube_load_creator__(referer) {
    /**
     * The load function
     * @param module
     * @param namespace
     * @param cb
     * @private
     */
    return function __cube_load__(module, namespace, cb) {
      if (arguments.length === 2 && typeof namespace === 'function') {
        cb = namespace;
        namespace = null;
        Cube.use(module, referer, cb);
      } else {
        Cube.use(module, referer, function (css) {
          css = Cube.css(css, namespace, module);
          cb && cb(css);
        });
      }
    };
  }

  Cube.setRemoteBase = function (_remoteBase) {
    Object.assign(remoteBase, _remoteBase);
  };

  /**
   * If mod is like 'remoteXXX:/com/user/index.js', replace remoteXXX with path defined in init()
   */
  function reBase(mod) {
    var offset = mod.indexOf ? mod.indexOf(remoteSeparator) : 0;
    if (offset <= 0) return '';
    
    var rbase = mod.substr(0, offset);
    if (!remoteBase[rbase]) return '';

    return remoteBase[rbase] + mod.substr(offset + 1);
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
    if (loadQueue.length) {
      return false;
    }
    for (var i in loading) {
      if (loading.hasOwnProperty(i)) {
        return false;
      }
    }
    debug && console.timeEnd('cube load');
    startAppAndCallback();
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
    if (!inited) {
      loadQueue.push([requires, referer]);
      return;
    }

    requires.forEach(function (require) {
      if (installedModules[require] || getGlobalRegister(require)) {
        return;
      }
      
      // 只有拼 src 时要带上 m & ref 时才需要分离 require 里的入参 query, 平时 /xxx?query=xx 才作为 installedModules 的 key
      const [mod, custom] = String(require).split('?');
      // download form server
      var script = doc.createElement('script');
      script.type = 'text/javascript';
      script.async = 'true';
      script.charset = charset;
      script.onerror = () => {
        Cube(require, [], () => {
          console.error(`load module: ${require} failed.`);
        });
      };

      var rebaseName = reBase(mod);
      var srcPath = rebaseName || (base + mod);

      var q = [];
      if (version) {
        q.push(version);
      }
      if (debug) {
        q.push('m');
        q.push('ref=' + referer);
      }

      if (custom) {
        const customArgs = parseQueryString(custom);
        Array.prototype.push.apply(q, Object.keys(customArgs).map(c => {
          return `${c}=${customArgs[c]}`
        }));
      }

      if (q.length) {
        script.src = srcPath + '?' + q.join('&');
      } else {
        script.src = srcPath;
      }
      head.appendChild(script);
      installedModules[require] = {
        exports: {},
        loaded: false,
        fired: false
      };
      requireMap[mod] = require;
      loading[require] = true;
    });
    checkAllDownloaded();
  }

  // require => datav:/npm/react/16.4.6?env=xxx
  function getGlobalRegister(require) {
    for (const register of registerArr) {
      if (require && register.match.test(require)) {
        return register.module;
      } 
    }
    return false;
  }

  /**
   * 运行模块
   * @param module
   * @returns {*}
   */
  function fireModule(module) {
    var m = installedModules[module] || getGlobalRegister(module);
    if (!m) {
      const err = new Error('Cube Error: Cannot find module ' + '\'' + module + '\'');
      if (strict) {
        throw err;
      } else {
        log.error(err);
        return {};
      }
    }
    if (!m.fired) {
      m.fired = true;
      if (strict){
        m.exports = m.fn.apply(global, [m, m.exports, __cube_require__, __cube_load_creator__(module), mockedProcess, mockedGlobal]);
      } else {
        try {
          m.exports = m.fn.apply(global, [m, m.exports, __cube_require__, __cube_load_creator__(module), mockedProcess, mockedGlobal]);
        } catch (e) {
          log.error(e);
          m.exports = {};
        }
      }
    }
    return m.exports;
  }

  /**
   * 从Cube.use的文件开始自上而下运行,并调用回调函数
   */
  function startAppAndCallback() {
    debug && console.time('cube exec');
    for (let [key, value] of entrances) {
      key.length && key.forEach(function (entrance) {
        // 出现多次 startAppAndCallback, 在某次 startAppAndCallback 未结束时，entrances 增加了，但其实 loading 并未结束
        // 严格检查
        if (loading[entrance]) return;
        var count = 0;
        fireModule(entrance);
        value.length && value.forEach(function (fn) {
          var called = fn(installedModules[entrance].exports);
          if (called) {
            count++;
          }
        });
        if (value.length === count) {  // 回调函数都执行完后删除
          entrances.delete(key);
        }
      });
    }
    debug && console.timeEnd('cube exec');
  }

  /**
   * 非构造函数,只供模块的wrapper调用
   * installedModules[name] name 是带入参的，不同入参的，不同key
   * @param name
   * @param requires
   * @param callback
   */
  function Cube(name, requires, callback) {
    // 暂时兼容返回的 name 不带入参的情况 
    const oldName = String(name);
    name = requireMap[name] || name;
    var mod = installedModules[name];
    if (!mod) {
      mod = installedModules[name] = {
        exports: {},
        fired: false
      };
    }
    mod.loaded = true;
    mod.fn = callback;
    requireMap[oldName] && delete requireMap[oldName];
    if (loading[name]) {
      delete loading[name];
      load(requires, name);
    } else if (requires.length) {
      load(requires, name);
    }
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
    if (config.debug !== undefined) {
      debug = config.debug;
    }
    if (config.strict !== undefined) {
      strict = config.strict;
    }
    if (config.env) {
      mockedProcess.env.NODE_ENV = config.env;
    }
    if (config.global) {
      mockedGlobal = config.global;
    }

    inited = true;

    while (loadQueue.length) {
      var deps = loadQueue.shift();
      load(deps[0], deps[1]);
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
  Cube.use = function (mods, referer, cb, noFix) {
    if (!mods) {
      throw new Error('Cube.use(moduleName) moduleName is undefined!');
    }
    if (typeof referer === 'function') {
      noFix = cb;
      cb = referer;
      referer = undefined;
    }
    if (!referer) {
      referer = 'Cube.use';
    }
    cb = cb || noop;

    if (typeof mods === 'string') {
      mods = [mods];
    }

    if (!noFix) {
      mods = fixUseModPath(mods);
    }

    // WARN: mods 是数组，会被自然的用 , 拼接，但 query 入参也可能带 , 所以这边 entrances 用 Map
    if (!entrances.has(mods)) {
      entrances.set(mods, []);
    }
    entrances.get(mods).push(function () {
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

    load(mods, referer);
    return this;
  };
  /**
   * register module in to cache
   * @param {string} module [description]
   * @param {} exports [description]
   * @param {object} options 配置项
   * @param {string} options.matchType 匹配模式，version 默认为按版本全匹配; module 按库级别，只要库一致就替换
   */
  Cube.register = function (module, exports, { matchType = 'version' } = {}) {
    if (installedModules[module]) {
      return log.warn('Cube Warning: Module ' + '\'' + module + '\'' + ' already registered');
    }
    installedModules[module] = {
      exports: exports,
      fn: noop,
      loaded: true,
      fired: true,
    };

    if (matchType === 'module') {
      registerArr.push({
        require: module,
        matchType,
        match: new RegExp(`^datav:\/npm\/${module}\/([^\/]+)?$`),
        module: installedModules[module],
      });
    }

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

  function parseQueryString(param) {
    let kvs = param.split('&');
    let obj = {};
    kvs.forEach((kv) => {
      let tmp = kv.split('=');
      obj[tmp[0]] = tmp[1];
    });
    return obj;
  }
})(window, null);