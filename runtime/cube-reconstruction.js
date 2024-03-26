// WATCH! 该文件由 cube-reconstruct.ts 导出 请勿直接改动
(function () {

  var __assign = function() {
      __assign = Object.assign || function __assign(t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
              s = arguments[i];
              for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
          }
          return t;
      };
      return __assign.apply(this, arguments);
  };
  
  function __spreadArray(to, from, pack) {
      if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
          if (ar || !(i in from)) {
              if (!ar) ar = Array.prototype.slice.call(from, 0, i);
              ar[i] = from[i];
          }
      }
      return to.concat(ar || Array.prototype.slice.call(from));
  }
  
  // 支持 cube 的一些工具方法
  function noop() { }
  function baseCodeProxy(c) {
      return c;
  }
  function combineExecute(c) {
      return 'Cube.cStart();' + c + ';Cube.cStop();';
  }
  function fetchCubeCode(url, inputCodeProxy, responseAdapter) {
      var codeProxy = inputCodeProxy || baseCodeProxy;
      var options = typeof url === 'string' ? { url: url } : url;
      return (typeof options.fetch === 'function' ? options.fetch : fetch)(options.url, {
          headers: {
              "Content-Type": "text/plain",
          },
      })
          .then(function (response) {
          if (responseAdapter)
              responseAdapter(response);
          return response;
      })
          .then(function (response) { return response.text(); })
          .then(function (code) {
          var _a;
          try {
              return new Function(codeProxy(code))();
          }
          catch (error) {
              (_a = options.onCodeError) === null || _a === void 0 ? void 0 : _a.call(options, error, {
                  url: options.url,
              });
              /** 保持抛错 */
              console.error(error);
          }
      });
  }
  var head = document.querySelector('head');
  /** 原有 cube 请求方法 */
  function scriptCubeCode(url) {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.onerror = function () {
          console.error("load module failed.");
      };
      script.src = url;
      head.appendChild(script);
  }
  function fixMododulePath(paths, remoteSeparator) {
      var len = paths.length;
      var mod;
      for (var i = 0; i < len; i++) {
          mod = paths[i];
          if (mod.indexOf(remoteSeparator) === -1) {
              /** fix #12 **/
              if (mod.indexOf('./') === 0) {
                  // be compatible with ./test.js
                  paths[i] = mod.substr(1);
              }
              else if (mod[0] !== '/') {
                  // be campatible with test.js
                  paths[i] = '/' + mod;
              }
          }
      }
      return paths;
  }
  var parseCssRe = /([^};]+)(\{[^}]+\})/g;
  /** 原有 css 请求方法 */
  function scriptCubeCss(originCss, namespace, file) {
      var css = originCss;
      if (namespace) {
          css = originCss.replace(parseCssRe, function (_m0, m1, m2) {
              var selectors = m1.split(',').map(function (selector) {
                  return namespace + ' ' + selector.trim();
              });
              return selectors.join(',') + m2;
          });
      }
      var style = document.createElement('style');
      style.setAttribute('type', 'text/css');
      if (file) {
          style.setAttribute('mod', file);
      }
      if (namespace) {
          style.setAttribute('ns', namespace);
      }
      head.appendChild(style);
      style.innerHTML = css;
      return css;
  }
  function parseQueryString(param) {
      var kvs = param.split('&');
      var obj = {};
      kvs.forEach(function (kv) {
          var tmp = kv.split('=');
          obj[tmp[0]] = tmp[1];
      });
      return obj;
  }
  /**
   * If name is like 'remoteXXX:/com/user/index.js', replace remoteXXX with path defined in init()
   */
  function rebase(name, config) {
      var base = config.base, remoteSeparator = config.remoteSeparator, remoteBase = config.remoteBase;
      var defaultPath = base + name;
      var offset = name.indexOf ? name.indexOf(remoteSeparator) : 0;
      if (offset <= 0)
          return defaultPath;
      var rbase = name.substr(0, offset);
      if (!remoteBase[rbase])
          return defaultPath;
      return remoteBase[rbase] + name.substr(offset + 1);
  }
  // 定制业务逻辑 ?env=publish === 不加 env
  // 此逻辑加在 cube 似乎处不合理
  function removePublishName(name) {
      var _a = String(name).split('?'), main = _a[0], params = _a[1];
      if (params) {
          var kvs = params.split('&');
          if (kvs.includes('env=publish')) {
              kvs = kvs.filter(function (v) { return v !== 'env=publish'; });
              var newParams = kvs.join('&');
              if (newParams) {
                  return main + '?' + newParams;
              }
              else {
                  return main;
              }
          }
      }
      return name;
  }
  
  // import Cube from 'node-cube/runtime/cube';
  
  function mockClassialCube() {
    /* short global val */
    var global = window;
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
    var combine = true;
  
    var mockedProcess = {
      env: { NODE_ENV: 'production' },
    };
    var mockedGlobal = undefined;
    var esModule = false;
  
    var entrances = new Map(); // Cube.use's cb
    // 兼容请求 key 带入参，返回 key 不带入参的情况。eg. 请求 /xxx?env=xx 返回 Cube('/xxx',), requireMap 缓存了 { '/xxx': '/xxx?env=xx' }
    // 此兼容是在业务方已知的情况，后期会改造返回的代码头。
    var requireMap = {};
    var registerArr = [];
    var installedModules = {
      /*exports, fn, loaded, fired*/
    }; // The module cache
    var loading = {};
    var combineMap = {};
    // type BlackList = Array<string|regexp>
    var combineBlackList = [];
  
    /* store requires before init */
    var inited = false;
    /** 未初始化时添加的等待请求的 module */
    var loadQueue = [];
    var combineFailTime = 10000;
  
    // watch! 旧版使用 fetch 容易产生问题
    let requestMethod = 'script'; // 'fetch' | 'script'
    // let isIntercepted = false;
    let fetchMethod = undefined;
    let onCodeError = undefined;
  
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
  
    function checkAllDownloaded() {
      if (loadQueue.length) {
        return false;
      }
      for (var i in loading) {
        if (loading.hasOwnProperty(i)) {
          return false;
        }
      }
      startAppAndCallback();
    }
  
    /**
     * 下载模块
     * @param requires
     * @param referer
     * @param root 是否为顶层请求组件
     */
    function load(requires, referer, root) {
      if (typeof requires === 'string') {
        requires = [requires];
      }
      if (!inited) {
        loadQueue.push([requires, referer]);
        return;
      }
  
      requires.forEach(function (require) {
        if (installedModules[require] || getGlobalRegister(require)) {
          if (
            combineMap[require] &&
            combineMap[require].failed &&
            installedModules[require] &&
            installedModules[require].loaded === false
          ) ; else {
            return;
          }
        }
  
        installedModules[require] = {
          exports: {},
          loaded: false,
          fired: false,
        };
  
        // 只有拼 src 时要带上 m & ref 时才需要分离 require 里的入参 query, 平时 /xxx?query=xx 才作为 installedModules 的 key
        const [mod, custom] = String(require).split('?');
  
        var rebaseName = rebase(mod, { base, remoteSeparator, remoteBase });
        var srcPath = rebaseName || base + mod;
  
        var query = [];
        if (version) {
          query.push(version);
        }
        // 目前仅根节点（组件级别）发起 combine
        if (checkCombineState(srcPath) && root) {
          query.push('combine=true');
          installedModules[require].combine = true;
          if (!combineMap[require]) {
            combineMap[require] = {
              start: Date.now(),
              timeout: setTimeout(() => {
                if (loading[require]) {
                  combineMap[require].failed = true;
                  load(require, referer);
                  // 标记超时了
                }
              }, combineFailTime),
              failed: false,
            };
          }
        }
  
        if (custom) {
          const customArgs = parseQueryString(custom);
          Array.prototype.push.apply(
            query,
            Object.keys(customArgs).map((c) => {
              return `${c}=${customArgs[c]}`;
            })
          );
        }
  
        if (query.length) {
          srcPath = srcPath + '?' + query.join('&');
        }
  
        if (requestMethod === 'fetch') {
          // combine 接口失败后的 traceId 记录排查
          if (combine && combineMap[require] && !combineMap[require].traceId) {
            fetchCubeCode({
              url: srcPath,
              fetch: fetchMethod,
              onCodeError: onCodeError,
            }, undefined, (res) => {
              if (res.headers.has('request-id')) {
                combineMap[require].traceId = res.headers.get('request-id');
              }
            });
          } else {
            fetchCubeCode(srcPath);
          }
        } else {
          scriptCubeCode(srcPath);
        }
  
        requireMap[mod] = require;
        loading[require] = true;
      });
      checkAllDownloaded();
    }
  
    function checkCombineState(path) {
      if (!combine) return false;
      if (combineBlackList.length) {
        return !combineBlackList.some((black) => {
          return !!path.match(black);
        });
      }
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
      var m = getGlobalRegister(module) || installedModules[module];
      if (!m) {
        const err = new Error('Cube Error: Cannot find module ' + "'" + module + "'");
        if (strict) {
          throw err;
        } else {
          log.error(err);
          return {};
        }
      }
      if (!m.fired) {
        m.fired = true;
        if (strict) {
          m.exports = m.fn.apply(global, [
            m,
            m.exports,
            __cube_require__,
            __cube_load_creator__(module),
            mockedProcess,
            mockedGlobal,
          ]);
        } else {
          try {
            m.exports = m.fn.apply(global, [
              m,
              m.exports,
              __cube_require__,
              __cube_load_creator__(module),
              mockedProcess,
              mockedGlobal,
            ]);
          } catch (e) {
            log.error(e);
            m.exports = {};
          }
        }
      }
      return isEsModule(m.exports) ? m.exports.default : m.exports;
    }
  
    /**
     * 从Cube.use的文件开始自上而下运行,并调用回调函数
     */
    function startAppAndCallback() {
      for (let [key, value] of entrances) {
        key.length &&
          key.forEach(function (entrance) {
            // 出现多次 startAppAndCallback, 在某次 startAppAndCallback 未结束时，entrances 增加了，但其实 loading 并未结束
            // 严格检查
            if (loading[entrance]) return;
            var count = 0;
            const exportModule = fireModule(entrance);
            value.length &&
              value.forEach(function (fn) {
                var called = fn(exportModule);
                if (called) {
                  count++;
                }
              });
            if (value.length === count) {
              // 回调函数都执行完后删除
              entrances.delete(key);
            }
          });
      }
    }
  
    /**
     * 非构造函数,只供模块的wrapper调用
     * installedModules[name] name 是带入参的，不同入参的，不同key
     * @param name
     * @param requires
     * @param sourceCode
     */
    function Cube(name, requires, callback) {
      // 暂时兼容返回的 name 不带入参的情况
      const oldName = String(name);
      name = requireMap[name] || name;
      var mod = installedModules[name];
      // 定制业务逻辑 ?env=publish === 不加 env
      mod = removePublishName(mod);
      if (!mod) {
        mod = installedModules[name] = {
          exports: {},
          fired: false,
        };
      }
      // 记录或清理合并接口信息
      if (combineMap[name] && !mod.loaded) {
        if (!combineMap[name].failed) {
          clearTimeout(combineMap[name].timeout);
          delete combineMap[name];
        } else {
          combineMap[name].end = Date.now();
        }
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
  
      if (config.strict !== undefined) {
        strict = config.strict;
      }
      if (config.env) {
        mockedProcess.env.NODE_ENV = config.env;
      }
      if (config.global) {
        mockedGlobal = config.global;
      }
      if (config.combine !== undefined) {
        combine = config.combine;
      }
      if (config.combineBlackList) {
        combineBlackList = config.combineBlackList;
      }
      if (config.requestMethod) {
        requestMethod = config.requestMethod;
      }
      // support ES6 module, default is true
      if (config.esModule !== undefined) {
        esModule = config.esModule;
      }
  
      if (config.fetchMethod) {
        fetchMethod = config.fetchMethod;
      }
  
      if (config.onCodeError) {
        onCodeError = config.onCodeError;
      }
  
      if (config.combineFailTime) {
        combineFailTime = config.combineFailTime;
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
     * @param  {Path}     moduleNames module abs path
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
        mods = [removePublishName(mods)];
      } else {
        mods = mods.map(removePublishName);
      }
  
      if (!noFix) {
        mods = fixMododulePath(mods, remoteSeparator);
      }
  
      // WARN: mods 是数组，会被自然的用 , 拼接，但 query 入参也可能带 , 所以这边 entrances 用 Map
      if (!entrances.has(mods)) {
        entrances.set(mods, []);
      }
      entrances.get(mods).push(
        (function () {
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
        })()
      );
      load(mods, referer, true);
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
        return log.warn('Cube Warning: Module ' + "'" + module + "'" + ' already registered');
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
      return scriptCubeCss(css, namespace, file);
    };
  
    Cube.debug = function () {
      log.error('Cube Error: Cube.debug nolonger supported');
    };
  
    Cube.cache = function () {
      var unloaded = {},
        unfired = {},
        i,
        m;
  
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
  
    if (global['Cube']) {
      log.error('Cube Error: window.' + 'Cube' + ' already in using, replace the last "null" param in cube.js');
    } else {
      global['Cube'] = Cube;
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
        Cube.use(cfg.main || 'index.js', function (app) {
          app.run && app.run();
        });
      }
    }
    // 支持 Cube 获取配置信息与新版一致
    Object.defineProperty(Cube, 'config', {
      get() {
        return {
          base,
          remoteBase,
          remoteSeparator,
          version,
          strict,
          debug,
          esModule,
          mockedGlobal,
          mockedProcess,
          charset,
          combine,
          combineMap,
        };
      },
    });
  
    function isEsModule(module) {
      return esModule && module && typeof module === 'object' && module.__esModule;
    }
  }
  
  /**
   * 默认配置项变量
   */
  var DEFAULT_CUBE_CONFIG = {
      base: '',
      remoteBase: {},
      remoteSeparator: ':',
      mockedProcess: {
          env: { NODE_ENV: 'production' },
      },
      mockedGlobal: undefined,
      /** 这个字段应该已经废弃了 */
      charset: 'utf-8',
      /** 仅严格模式 */
      strict: true,
      /** 声明组件源码是否使用 esModule 模式*/
      esModule: false,
      version: undefined,
      /** 是否开启 debug 模式*/
      debug: true,
      /** 是否开启请求合并 */
      combine: false,
      /** 声明使用 fetch 请求还是创建 script 请求 */
      requestMethod: 'fetch',
      // 旧版 fetchUndeclaredModule = false && aggregateFetch = true
      // 新版 fetchUndeclaredModule = true && aggregateFetch = false
      /** 是否重新请求未声明的文件 */
      fetchUndeclaredModule: false,
      /** 是否聚合请求 */
      aggregateFetch: true,
      /** 自定义 fetch 方法 */
      fetchMethod: undefined,
      /** 下载脚本报错回调 */
      onCodeError: undefined,
  };
  /**
   * cube 重构
   * https://yuque.antfin.com/lcv0by/ph89oq/chzehxz50ldg5krg
   */
  var Cube = /** @class */ (function () {
      function Cube() {
          var _this = this;
          this.config = __assign({}, DEFAULT_CUBE_CONFIG);
          this.state = {
              /** 是否完成初始化 */
              inited: false,
              /** 是否被拦截 */
              isIntercepted: false,
              /** 未初始化时添加的等待请求的 module */
              pendingQueue: [],
              lostDepModule: {},
              /** 记录资源加载完成后的回调信息 */
              entrances: new Map(),
              /** 记录 css 模块加载情况 */
              cssModule: {},
              /** 已下载模块 */
              installedModules: getStringOnlyObj(),
              /** 注册模块 */
              registerModules: [],
              // 兼容请求 key 带入参，返回 key 不带入参的情况。
              // eg. 请求 /xxx?env=xx 返回 Cube('/xxx',), requireMap 缓存了 { '/xxx': '/xxx?env=xx' }
              requireMap: {},
              // 是否处于文件合并执行状态
              fileExecuting: false,
              // 聚合请求
              aggregateLoading: {},
              delayTrigger: undefined,
              // TODO 新版支持 combine 兜底（combineMap)
          };
          /**
           * 跳过请求注册模块
           * @param moduleName 模块名
           * @param exports 模块实例
           * @param matchType 匹配模式，version 默认为按版本全匹配; module 按库级别，只要库一致就替换
           */
          this.register = function (moduleName, exports, option) {
              var _a;
              if (option === void 0) { option = { matchType: 'version' }; }
              var matchType = option.matchType;
              if ((_a = _this._getModule(moduleName)) === null || _a === void 0 ? void 0 : _a.fired) {
                  return console.warn('Cube Warning: Module ' + "'" + moduleName + "'" + ' already registered');
              }
              _this.state.installedModules[moduleName] = {
                  exports: exports,
                  sourceCode: noop,
                  dep: [],
                  refer: { entryDep: [] },
                  loaded: true,
                  firing: false,
                  fired: true,
              };
              if (matchType === 'module') {
                  _this.state.registerModules.push({
                      moduleName: moduleName,
                      matchType: matchType,
                      match: new RegExp("^datav:/npm/".concat(moduleName, "/([^/]+)?$")),
                      module: _this.state.installedModules[moduleName],
                  });
              }
          };
          /** 初始化 */
          this.init = function (config) {
              var _a, _b, _c, _d, _e, _f, _g;
              if (_this.state.inited) {
                  console.warn('Cube 重复初始化，可能产生资源请求错误');
              }
              if (config.base && config.base !== '/') {
                  _this.config.base = config.base.replace(/\/$/, '');
              }
              if (config.remoteBase) {
                  for (var key in config.remoteBase) {
                      if (config.remoteBase.hasOwnProperty(key)) {
                          _this.config.remoteBase[key] = config.remoteBase[key].replace(/\/$/, '');
                      }
                  }
              }
              _this.config.version = (_a = config.version) !== null && _a !== void 0 ? _a : _this.config.version;
              _this.config.esModule = (_b = config.esModule) !== null && _b !== void 0 ? _b : _this.config.esModule;
              _this.config.debug = (_c = config.debug) !== null && _c !== void 0 ? _c : _this.config.debug;
              _this.config.combine = (_d = config.combine) !== null && _d !== void 0 ? _d : _this.config.combine;
              _this.config.requestMethod = (_e = config.requestMethod) !== null && _e !== void 0 ? _e : _this.config.requestMethod;
              _this.config.fetchUndeclaredModule = (_f = config.fetchUndeclaredModule) !== null && _f !== void 0 ? _f : _this.config.fetchUndeclaredModule;
              _this.config.aggregateFetch = (_g = config.aggregateFetch) !== null && _g !== void 0 ? _g : _this.config.aggregateFetch;
              _this.config.fetchMethod = config.fetchMethod || fetch;
              _this.config.onCodeError = config.onCodeError;
              _this.state.inited = true;
              for (var i = 0; i < _this.state.pendingQueue.length; i++) {
                  var pendingInfo = _this.state.pendingQueue[i];
                  _this._load(pendingInfo[0], pendingInfo[1]);
              }
              _this.state.pendingQueue = [];
          };
          /**
           * 异步加载模块
           */
          this.use = function (moduleName, refererOrCallback, callbackOrOmitFix, omitFixOrUndefined) {
              if (!moduleName) {
                  throw new Error('Cube.use(moduleName) moduleName is undefined!');
              }
              // 整理入参
              // 确保 moduleNames 唯一
              var moduleNames = typeof moduleName === 'string'
                  ? [moduleName]
                  : typeof moduleName === 'number'
                      ? [moduleName.toString()]
                      : __spreadArray([], moduleName, true);
              var omitFix = omitFixOrUndefined;
              // let _referer: string | undefined;
              var callback;
              if (typeof refererOrCallback === 'string') {
                  // referer = refererOrCallback;
                  callback = callbackOrOmitFix;
              }
              else {
                  // referer = undefined;
                  callback = refererOrCallback;
                  omitFix = callbackOrOmitFix;
              }
              callback = callback || noop;
              moduleNames = !omitFix ? fixMododulePath(moduleNames, _this.config.remoteSeparator) : moduleNames;
              var entry = {
                  callback: callback,
                  loadSource: {},
                  targets: __spreadArray([], moduleNames, true),
              };
              if (_this.config.aggregateFetch) ;
              else {
                  moduleNames.forEach(function (i) {
                      entry.loadSource[i] = false;
                  });
              }
              _this.state.entrances.set(moduleNames, entry);
              moduleNames.forEach(function (mName) { return _this._load(mName, moduleNames); });
          };
          /** 执行 cube 源码 即原 Cube(...) */
          this.execute = function (responseName, requires, sourceCode) {
              var _a;
              if (typeof responseName === 'number') {
                  responseName = responseName.toString();
              }
              var moduleName = _this._calibrateName(responseName);
              // load 处已做判断 但仍有可能某个模块源码带有其他冗余模块的情况
              if ((_a = _this.state.installedModules[moduleName]) === null || _a === void 0 ? void 0 : _a.loaded) {
                  return;
              }
              _this._store(moduleName, requires, sourceCode);
              _this._initiate(moduleName);
          };
          /**
           * 加载 css
           */
          this.css = function (css, namespace, file) {
              if (!css) {
                  return;
              }
              var modId = file + '@' + namespace;
              if (_this.state.cssModule[modId]) {
                  return;
              }
              _this.state.cssModule[modId] = true;
              return scriptCubeCss(css, namespace, file);
          };
          /**
           * 模块存储
           */
          this._store = function (moduleName, dep, sourceCode) {
              var _a;
              var module = _this.state.installedModules[moduleName];
              if (module) {
                  (_a = module.dep).push.apply(_a, dep);
                  module.sourceCode = sourceCode;
                  module.loaded = true;
              }
              else {
                  _this.state.installedModules[moduleName] = {
                      exports: {},
                      sourceCode: sourceCode,
                      dep: dep,
                      refer: { entryDep: [] },
                      loaded: true,
                      firing: false,
                      fired: false,
                  };
              }
          };
          /** 请求资源 */
          this._load = function (moduleName, entryKey) {
              if (typeof moduleName === 'number') {
                  moduleName = moduleName.toString();
              }
              if (!_this.config.aggregateFetch) {
                  var entry = _this.state.entrances.get(entryKey);
                  if (entry && !entry.loadSource.hasOwnProperty(moduleName)) {
                      entry.loadSource[moduleName] = false;
                  }
              }
              if (!_this.state.inited || _this.state.fileExecuting) {
                  _this.state.pendingQueue.push([moduleName, entryKey]);
                  return;
              }
              var module = _this._getModule(moduleName);
              if (module) {
                  _this._addReferToDependency(moduleName, module, entryKey);
                  if (module.loaded) {
                      _this._triggerCallback(moduleName, module);
                  }
                  return;
              }
              var name = moduleName.split('?')[0];
              _this.state.requireMap[name] = moduleName;
              _this.state.installedModules[moduleName] = {
                  exports: {},
                  sourceCode: undefined,
                  dep: [],
                  refer: {
                      entryDep: [],
                  },
                  loaded: false,
                  firing: false,
                  fired: false,
              };
              _this._addReferToDependency(moduleName, _this.state.installedModules[moduleName], entryKey);
              var srcPath = _this._generatePath(moduleName);
              _this.config.requestMethod === 'fetch' ? fetchCubeCode({
                  url: srcPath,
                  fetch: _this.config.fetchMethod,
                  onCodeError: _this.config.onCodeError,
              }, combineExecute) : scriptCubeCode(srcPath);
          };
          /** 实例化并执行回调 */
          this._initiate = function (moduleName) {
              var module = _this.state.installedModules[moduleName];
              _this._triggerCallback(moduleName, module);
          };
          /** 向上检索树依赖及回调 */
          this._triggerCallback = function (moduleName, module) {
              if (!module.loaded)
                  return;
              if (_this.config.aggregateFetch) {
                  module.dep.forEach(function (m) {
                      var _a;
                      if ((_a = _this._getModule(m)) === null || _a === void 0 ? void 0 : _a.loaded) {
                          return;
                      }
                      _this._load(m, []);
                  });
                  if (_this.state.aggregateLoading[moduleName]) {
                      delete _this.state.aggregateLoading[moduleName];
                      _this._triggerAllCallback();
                  }
                  return;
              }
              var refDep = module.refer;
              var finishedEntry = [];
              refDep.entryDep.forEach(function (entryKey) {
                  var entry = _this.state.entrances.get(entryKey);
                  if (entry) {
                      entry.loadSource[moduleName] = true;
                      var next_1 = true;
                      if (!module.fired) {
                          module.dep.forEach(function (m) {
                              if (entry.loadSource[m])
                                  return;
                              var subModule = _this._getModule(m);
                              if (subModule === null || subModule === void 0 ? void 0 : subModule.fired)
                                  return;
                              next_1 = false;
                              _this._load(m, entryKey);
                          });
                      }
                      if (next_1) {
                          // 考虑标记 unload 提速
                          if (Object.values(entry.loadSource).every(function (i) { return i; })) {
                              _this._triggerEntryCallback(entryKey, entry);
                          }
                      }
                  }
                  else {
                      finishedEntry.push(entryKey);
                  }
              });
              if (finishedEntry.length) {
                  module.refer.entryDep = refDep.entryDep.filter(function (i) { return !finishedEntry.includes(i); });
              }
          };
          /** 执行回调函数 */
          this._triggerEntryCallback = function (entryKey, entry) {
              var readyCallback = true;
              entry.targets.forEach(function (moduleName) {
                  var module = _this._getModule(moduleName);
                  if (module.fired)
                      return;
                  // 理论上不会不存在
                  if (module.firing) {
                      readyCallback = false;
                      return;
                  }
                  _this._fireModule(moduleName);
                  if (module.fired)
                      return;
                  readyCallback = false;
              });
              if (readyCallback) {
                  entry.callback.apply(entry, entry.targets.map(function (e) { return _this.state.installedModules[e].exports; }));
                  _this.state.entrances.delete(entryKey);
              }
          };
          this._triggerAllCallback = function () {
              if (_this.state.delayTrigger)
                  return;
              // this.state.delayTrigger = setTimeout(() => {
              // this.state.delayTrigger = undefined;
              if (_this.state.pendingQueue.length)
                  return;
              if (Object.keys(_this.state.aggregateLoading).length)
                  return;
              _this.state.entrances.forEach(function (entry, entryKey) {
                  _this._triggerEntryCallback(entryKey, entry);
              });
              // });
          };
          /** 实例化某一模块 */
          this._fireModule = function (moduleName) {
              var module = _this.state.installedModules[moduleName];
              if (!module || !module.loaded)
                  return false;
              if (module.fired)
                  return true;
              // 处理循环依赖问题
              if (module.firing) {
                  return true;
              }
              var fireResult = true;
              try {
                  module.firing = true;
                  var exports = module.sourceCode.apply(window, [
                      module,
                      // 此处需要组件不改变实例
                      module.exports,
                      _this._cubeRequire(moduleName),
                      _this._cubeLoad(moduleName),
                      _this.config.mockedProcess,
                      _this.config.mockedGlobal,
                  ]);
                  module.exports = _this._isEsModule(exports) ? exports.default : exports;
                  module.error = false;
              }
              catch (e) {
                  if (_this.config.fetchUndeclaredModule && e.message === "Cube inner denpendency lost; refetch inited") {
                      console.warn('Cube 检测到文件依赖缺失');
                      fireResult = false;
                  }
                  else {
                      console.error('Cube 生成实例失败', e);
                      console.error(moduleName, module);
                      module.error = true;
                  }
              }
              finally {
                  module.firing = false;
                  if (_this.config.fetchUndeclaredModule) {
                      // 避免组件内部有 catch 导致 抓不到错误的情况
                      if (_this.state.lostDepModule[moduleName]) {
                          _this.state.lostDepModule[moduleName].forEach(function (name) {
                              if (!module.dep.includes(name)) {
                                  module.dep.push(name);
                                  module.refer.entryDep.forEach(function (eKey) {
                                      _this._load(name, eKey);
                                  });
                                  console.warn("Cube module ".concat(moduleName, " \u7F3A\u5931\u58F0\u660E\u4F9D\u8D56 ").concat(name));
                              }
                          });
                          Reflect.deleteProperty(_this.state.lostDepModule, moduleName);
                          fireResult = false;
                      }
                  }
                  else {
                      module.fired = true;
                  }
              }
              return fireResult;
          };
          /** 支持组件内模块请求 */
          this._cubeRequire = function (selfName) { return function (moduleName, namespace) {
              if (namespace === undefined) {
                  var module = _this._getModule(moduleName);
                  if (module === null || module === void 0 ? void 0 : module.fired) {
                      return module.exports;
                  }
                  var fireFinished = _this._fireModule(moduleName);
                  if (!module || !fireFinished) {
                      if (_this.config.fetchUndeclaredModule) {
                          if (_this.state.lostDepModule[selfName]) {
                              _this.state.lostDepModule[selfName].push(moduleName);
                          }
                          else {
                              _this.state.lostDepModule[selfName] = [moduleName];
                          }
                          // WATCH! 由于组件内相对路径依赖没有声明 导致必须强行中断流程，
                          // 后续应该将相对依赖加入依赖中
                          throw new Error("Cube inner denpendency lost; refetch inited");
                      }
                      else {
                          throw new Error("Cube \u83B7\u53D6\u672A\u58F0\u660E\u8D44\u6E90 ".concat(moduleName, " \u5931\u8D25"));
                      }
                  }
                  else {
                      return module.exports;
                  }
              }
              else {
                  // 默认 css 模块不再依赖其它模块
                  var css = void 0;
                  var module = _this._getModule(moduleName);
                  if (!module || !module.loaded)
                      return;
                  if (module.fired) {
                      css = module.exports;
                  }
                  var fireSucceed = _this._fireModule(moduleName);
                  if (fireSucceed) {
                      css = module.exports;
                  }
                  return _this.css(css, namespace, moduleName);
              }
          }; };
          /** 支持组件内模块加载 */
          this._cubeLoad = function (referer) {
              /** The load function */
              var __cube_load__ = function (moduleName, namespace, cb) {
                  if (cb === undefined && typeof namespace === 'function') {
                      cb = namespace;
                      namespace = '';
                      _this.use(moduleName, referer, cb);
                  }
                  else {
                      _this.use(moduleName, referer, function (css) {
                          css = _this.css(css, namespace, moduleName);
                          cb && cb(css);
                      });
                  }
              };
              return __cube_load__;
          };
          /** 请求路径生成 */
          this._generatePath = function (moduleName) {
              // 只有拼 src 时要带上 m & ref 时才需要分离 require 里的入参 query, 平时 /xxx?query=xx 才作为 installedModules 的 key
              var _a = moduleName.split('?'), name = _a[0], custom = _a[1];
              var srcPath = rebase(name, _this.config);
              var query = [];
              if (_this.config.version) {
                  query.push(_this.config.version);
              }
              if (_this.config.combine) {
                  query.push('combine=true');
              }
              if (custom) {
                  var customArgs_1 = parseQueryString(custom);
                  query.push(Object.keys(customArgs_1).map(function (c) {
                      return "".concat(c, "=").concat(customArgs_1[c]);
                  }));
              }
              // 历史逻辑 疑似命中缓存
              if (!query.includes('m=1')) {
                  query.push('m=1');
              }
              if (query.length) {
                  srcPath = srcPath + '?' + query.join('&');
              }
              return srcPath;
          };
          /** 存储引用关系 */
          this._addReferToDependency = function (moduleName, module, referer) {
              if (_this.config.aggregateFetch) {
                  if (!module.loaded) {
                      _this.state.aggregateLoading[moduleName] = true;
                  }
                  return;
              }
              var refDep = module.refer;
              if (!referer) {
                  return;
              }
              if (!refDep.entryDep.includes(referer)) {
                  refDep.entryDep.push(referer);
              }
          };
          /** 修正返回值 */
          this._calibrateName = function (responseName) {
              // 兼容返回的 name 不带入参的情况
              var moduleName = _this.state.requireMap[responseName] || responseName;
              if (_this.state.requireMap[responseName]) {
                  Reflect.deleteProperty(_this.state.requireMap, responseName);
              }
              return moduleName;
          };
          /**
           * 获取全局默认模块
           * requirePath => datav:/npm/react/16.4.6?env=xxx
           */
          this._getGlobalRegister = function (requirePath) {
              for (var _i = 0, _a = _this.state.registerModules; _i < _a.length; _i++) {
                  var register = _a[_i];
                  if (requirePath && register.match.test(requirePath)) {
                      return register.module;
                  }
              }
          };
          this._getModule = function (name) {
              // TODO 此处有问题 理论上优先选取 globalRegister
              // 但考虑到正则匹配的耗时 每次匹配耗时过长
              // 所以应该是此处顺序不变 注册的时候做一次是否满足正则的校验
              var module = _this.state.installedModules[name];
              if (!module) {
                  return _this._getGlobalRegister(name);
              }
              return module;
          };
          this._isEsModule = function (module) {
              return _this.config.esModule && module && typeof module === 'object' && module.__esModule;
          };
          this.cStart = function () {
              _this.state.fileExecuting = true;
          };
          this.cStop = function () {
              _this.state.fileExecuting = false;
              for (var i = 0; i < _this.state.pendingQueue.length; i++) {
                  var pendingInfo = _this.state.pendingQueue[i];
                  _this._load(pendingInfo[0], pendingInfo[1]);
              }
              _this.state.pendingQueue = [];
          };
          /****************************** 以下为原有方法兼容 **************************/
          /** 原有方法 直接打印内部状态 */
          this.cache = function () {
              console.info('modules:', Object.fromEntries(Object.entries(_this.state.installedModules)));
              console.info('unloaded:', Object.fromEntries(Object.entries(_this.state.installedModules).filter(function (m) { return !m[1].loaded; })));
              console.info('unfired:', Object.fromEntries(Object.entries(_this.state.installedModules).filter(function (m) { return !m[1].fired; })));
          };
          /** @deprecated */
          this.debug = function () {
              console.error('debug 方法不再支持');
          };
          /** @deprecated */
          this.setRemoteBase = function () {
              console.error('不支持动态修改 remoteBase');
          };
      }
      return Cube;
  }());
  function getStringOnlyObj() {
      return new Proxy({}, {
          get: function (target, propKey) {
              var key = typeof propKey === 'number' ? propKey.toString() : propKey;
              return Reflect.get(target, key);
          },
          set: function (target, propKey, value, receiver) {
              var key = typeof propKey === 'number' ? propKey.toString() : propKey;
              return Reflect.set(target, key, value, receiver);
          },
      });
  }
  /** 全局初始化单例 */
  function setGlobalCube(oldVersion) {
      var alias = 'Cube';
      var global = window;
      if (global[alias]) {
          console.error('Cube Error: window.' + alias + ' already in using');
          return global[alias];
      }
      if (oldVersion) {
          mockClassialCube();
      }
      else {
          var cube_1 = new Cube();
          // 支持 Cube(...args) 的写法
          var cubeHandler = function (moduleName, requires, instance) {
              return cube_1.execute(moduleName, requires, instance);
          };
          var mockCube = new Proxy(cubeHandler, {
              get: function (handler, key) {
                  if (Reflect.ownKeys(cube_1).includes(key)) {
                      return cube_1[key];
                  }
                  return Reflect.get(handler, key);
              },
          });
          global[alias] = mockCube;
      }
      var cubeVersion = '5.0.0-beta.18';
      global[alias].cubeVersion = cubeVersion;
      global[alias].oldVersion = oldVersion;
      return global[alias];
  }
  
  setGlobalCube(true);
  })();