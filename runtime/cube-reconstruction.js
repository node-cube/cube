// WATCH! 该文件由 cube-reconstruct.ts 导出 请勿直接改动
(function (globalThis) {
  // 支持 cube 的一些工具方法
  function noop() {}
  function baseCodeProxy(c) {
    return c;
  }
  function combineExecute(c) {
    return 'Cube.cStart();' + c + ';Cube.cStop();';
  }
  function fetchCubeCode(url, inputCodeProxy, responseAdapter) {
    const codeProxy = inputCodeProxy || baseCodeProxy;
    const options = typeof url === 'string' ? { url } : url;
    return (typeof options.fetch === 'function' ? options.fetch : fetch)(
      options.url,
      {
        headers: {
          'Content-Type': 'text/plain',
        },
      }
    )
      .then((response) => {
        if (responseAdapter) responseAdapter(response);
        return response;
      })
      .then((response) => response.text())
      .then((code) => {
        var _a;
        try {
          return new Function(codeProxy(code))();
        } catch (error) {
          (_a = options.onCodeError) === null || _a === void 0
            ? void 0
            : _a.call(options, error, {
                url: options.url,
              });
          /** 保持抛错 */
          console.error(error);
        }
      });
  }
  const head =
    typeof document === 'undefined'
      ? {
          appendChild: () => {},
        }
      : document.querySelector('head');
  /** 原有 cube 请求方法 */
  function scriptCubeCode(url) {
    var script =
      document === null || document === void 0
        ? void 0
        : document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.onerror = () => {
      console.error(`load module failed.`);
    };
    script.src = url;
    head === null || head === void 0 ? void 0 : head.appendChild(script);
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
        } else if (mod[0] !== '/') {
          // be campatible with test.js
          paths[i] = '/' + mod;
        }
      }
    }
    return paths;
  }
  const parseCssRe = /([^};]+)(\{[^}]+\})/g;
  /** 原有 css 请求方法 */
  function scriptCubeCss(originCss, namespace, file) {
    let css = originCss;
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
    head === null || head === void 0 ? void 0 : head.appendChild(style);
    style.innerHTML = css;
    return css;
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
  /**
   * If name is like 'remoteXXX:/com/user/index.js', replace remoteXXX with path defined in init()
   */
  function rebase(name, config) {
    const { base, remoteSeparator, remoteBase } = config;
    let defaultPath = base + name;
    var offset = name.indexOf ? name.indexOf(remoteSeparator) : 0;
    if (offset <= 0) return defaultPath;
    var rbase = name.substr(0, offset);
    if (!remoteBase[rbase]) return defaultPath;
    return remoteBase[rbase] + name.substr(offset + 1);
  }
  // 定制业务逻辑 ?env=publish === 不加 env
  // 此逻辑加在 cube 似乎处不合理
  function removePublishName(name) {
    const [main, params] = String(name).split('?');
    if (params) {
      let kvs = params.split('&');
      if (kvs.includes('env=publish')) {
        kvs = kvs.filter((v) => v !== 'env=publish');
        const newParams = kvs.join('&');
        if (newParams) {
          return main + '?' + newParams;
        } else {
          return main;
        }
      }
    }
    return name;
  }
  // 从模块路径中提取模块名称和模块版本
  function extractModuleInfo(path) {
    const regex = /^((@[^/]+\/[^/]+|[^/]+))(?:\/(.*))?$/;
    const match = path.match(regex);
    if (!match) return null;
    const moduleName = match[1];
    const modulePath = match[3] || ''; // 模块路径（默认为空字符串）
    return { moduleName, modulePath };
  }
  // require => datav:/npm/react/16.4.6?env=xxx
  function extractModuleInfoFromRequire(require) {
    const regex =
      /^datav:\/npm\/((?:@[^/]+\/[^/]+)|[^/]+)(?:\/([^/?]+))?(?:\/([^?]*))?/;
    const match = require.match(regex);
    if (!match) return null;
    const moduleName = match[1];
    const modulePath = match[3] || ''; // 模块路径（默认为空字符串）
    return { moduleName, modulePath };
  }

  // import Cube from 'node-cube/runtime/cube';

  function mockClassicalCube(global) {
    /* short global val */
    var doc = typeof document === 'undefined' ? {} : document;
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
      ...(global.process ?? {}),
      env: {
        ...(global.process?.env ?? {}),
        NODE_ENV: 'production',
      },
    };
    var mockedGlobal = undefined;
    var esModule = false;

    var entrances = new Map(); // Cube.use's cb
    // 兼容请求 key 带入参，返回 key 不带入参的情况。eg. 请求 /xxx?env=xx 返回 Cube('/xxx',), requireMap 缓存了 { '/xxx': '/xxx?env=xx' }
    // 此兼容是在业务方已知的情况，后期会改造返回的代码头。
    var requireMap = {};
    // 注册表。 eg. { [moduleName]: { [modulePath]: { require, matchType, match, module } } }
    var registerMap = {};
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
      if (typeof namespace === 'undefined') {
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
        if (typeof cb === 'undefined' && typeof namespace === 'function') {
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
          );
          else {
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
            fetchCubeCode(
              {
                url: srcPath,
                fetch: fetchMethod,
                onCodeError: onCodeError,
              },
              undefined,
              (res) => {
                if (res.headers.has('request-id')) {
                  combineMap[require].traceId = res.headers.get('request-id');
                }
              }
            );
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
      // combineBlackList 没有或错误的情况下兜底 combine
      return true;
    }

    // require => datav:/npm/react/16.4.6?env=xxx
    function getGlobalRegister(require) {
      if (!require.startsWith('datav:/npm/')) {
        return false;
      }

      let { moduleName, modulePath } = extractModuleInfoFromRequire(require);
      if (!registerMap[moduleName]) return false;

      modulePath = modulePath || 'default';
      if (registerMap[moduleName][modulePath])
        return registerMap[moduleName][modulePath].module;

      Object.entries(registerMap[moduleName]).forEach(([path, register]) => {
        if (register.match.test(require)) {
          return register.module;
        }
      });
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
        const err = new Error(
          'Cube Error: Cannot find module ' + "'" + module + "'"
        );
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
        return log.warn(
          'Cube Warning: Module ' + "'" + module + "'" + ' already registered'
        );
      }
      installedModules[module] = {
        exports: exports,
        fn: noop,
        loaded: true,
        fired: true,
      };

      if (matchType === 'module') {
        registerMap[module] = registerMap[module] || {};
        registerMap[module].default = {
          require: module,
          matchType,
          match: new RegExp(`^datav:\/npm\/${module}\/([^\/]+)?$`),
          module: installedModules[module],
          moduleName: module,
        };
      }

      if (matchType === 'function') {
        const { moduleName, modulePath } = extractModuleInfo(module);

        if (!modulePath) {
          return log.warn(
            'Cube Warning: Module ' +
              "'" +
              module +
              "'" +
              ' matchType is function, but no path'
          );
        }

        registerMap[moduleName] = registerMap[moduleName] || {};
        registerMap[moduleName][modulePath] = {
          require: module,
          matchType,
          match: new RegExp(
            `^datav:\/npm\/${moduleName}\/(?<version>\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.-]+)?(\\+[a-zA-Z0-9.-]+)?)\/${modulePath}$`
          ),
          module: installedModules[module],
          moduleName,
        };
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
      log.error(
        'Cube Error: window.' +
          'Cube' +
          ' already in using, replace the last "null" param in cube.js'
      );
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
      return (
        esModule && module && typeof module === 'object' && module.__esModule
      );
    }
  }

  /**
   * 默认配置项变量
   */
  const DEFAULT_CUBE_CONFIG = {
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
  class Cube {
    constructor() {
      this.config = Object.assign({}, DEFAULT_CUBE_CONFIG);
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
      this.register = (
        moduleName,
        exports,
        option = { matchType: 'version' }
      ) => {
        var _a;
        const { matchType } = option;
        if (
          (_a = this._getModule(moduleName)) === null || _a === void 0
            ? void 0
            : _a.fired
        ) {
          return console.warn(
            'Cube Warning: Module ' +
              "'" +
              moduleName +
              "'" +
              ' already registered'
          );
        }
        this.state.installedModules[moduleName] = {
          exports: exports,
          sourceCode: noop,
          dep: [],
          refer: { entryDep: [] },
          loaded: true,
          firing: false,
          fired: true,
        };
        if (matchType === 'module') {
          this.state.registerModules.push({
            moduleName,
            matchType,
            match: new RegExp(`^datav:\/npm\/${moduleName}\/([^\/]+)?$`),
            module: this.state.installedModules[moduleName],
          });
        }
      };
      /** 初始化 */
      this.init = (config) => {
        var _a, _b, _c, _d, _e, _f, _g;
        if (this.state.inited) {
          console.warn('Cube 重复初始化，可能产生资源请求错误');
        }
        if (config.base && config.base !== '/') {
          this.config.base = config.base.replace(/\/$/, '');
        }
        if (config.remoteBase) {
          for (let key in config.remoteBase) {
            if (config.remoteBase.hasOwnProperty(key)) {
              this.config.remoteBase[key] = config.remoteBase[key].replace(
                /\/$/,
                ''
              );
            }
          }
        }
        this.config.version =
          (_a = config.version) !== null && _a !== void 0
            ? _a
            : this.config.version;
        this.config.esModule =
          (_b = config.esModule) !== null && _b !== void 0
            ? _b
            : this.config.esModule;
        this.config.debug =
          (_c = config.debug) !== null && _c !== void 0
            ? _c
            : this.config.debug;
        this.config.combine =
          (_d = config.combine) !== null && _d !== void 0
            ? _d
            : this.config.combine;
        this.config.requestMethod =
          (_e = config.requestMethod) !== null && _e !== void 0
            ? _e
            : this.config.requestMethod;
        this.config.fetchUndeclaredModule =
          (_f = config.fetchUndeclaredModule) !== null && _f !== void 0
            ? _f
            : this.config.fetchUndeclaredModule;
        this.config.aggregateFetch =
          (_g = config.aggregateFetch) !== null && _g !== void 0
            ? _g
            : this.config.aggregateFetch;
        this.config.fetchMethod = config.fetchMethod || fetch;
        this.config.onCodeError = config.onCodeError;
        this.state.inited = true;
        for (let i = 0; i < this.state.pendingQueue.length; i++) {
          let pendingInfo = this.state.pendingQueue[i];
          this._load(pendingInfo[0], pendingInfo[1]);
        }
        this.state.pendingQueue = [];
      };
      /**
       * 异步加载模块
       */
      this.use = (
        moduleName,
        refererOrCallback,
        callbackOrOmitFix,
        omitFixOrUndefined
      ) => {
        if (!moduleName) {
          throw new Error('Cube.use(moduleName) moduleName is undefined!');
        }
        // 整理入参
        // 确保 moduleNames 唯一
        let moduleNames =
          typeof moduleName === 'string'
            ? [moduleName]
            : typeof moduleName === 'number'
            ? [moduleName.toString()]
            : [...moduleName];
        let omitFix = omitFixOrUndefined;
        // let _referer: string | undefined;
        let callback;
        if (typeof refererOrCallback === 'string') {
          // referer = refererOrCallback;
          callback = callbackOrOmitFix;
        } else {
          // referer = undefined;
          callback = refererOrCallback;
          omitFix = callbackOrOmitFix;
        }
        callback = callback || noop;
        moduleNames = !omitFix
          ? fixMododulePath(moduleNames, this.config.remoteSeparator)
          : moduleNames;
        const entry = {
          callback,
          loadSource: {},
          targets: [...moduleNames],
        };
        if (this.config.aggregateFetch);
        else {
          moduleNames.forEach((i) => {
            entry.loadSource[i] = false;
          });
        }
        this.state.entrances.set(moduleNames, entry);
        moduleNames.forEach((mName) => this._load(mName, moduleNames));
      };
      /** 执行 cube 源码 即原 Cube(...) */
      this.execute = (responseName, requires, sourceCode) => {
        var _a;
        if (typeof responseName === 'number') {
          responseName = responseName.toString();
        }
        const moduleName = this._calibrateName(responseName);
        // load 处已做判断 但仍有可能某个模块源码带有其他冗余模块的情况
        if (
          (_a = this.state.installedModules[moduleName]) === null ||
          _a === void 0
            ? void 0
            : _a.loaded
        ) {
          return;
        }
        this._store(moduleName, requires, sourceCode);
        this._initiate(moduleName);
      };
      /**
       * 加载 css
       */
      this.css = (css, namespace, file) => {
        if (!css) {
          return;
        }
        var modId = file + '@' + namespace;
        if (this.state.cssModule[modId]) {
          return;
        }
        this.state.cssModule[modId] = true;
        return scriptCubeCss(css, namespace, file);
      };
      /**
       * 模块存储
       */
      this._store = (moduleName, dep, sourceCode) => {
        const module = this.state.installedModules[moduleName];
        if (module) {
          module.dep.push(...dep);
          module.sourceCode = sourceCode;
          module.loaded = true;
        } else {
          this.state.installedModules[moduleName] = {
            exports: {},
            sourceCode,
            dep,
            refer: { entryDep: [] },
            loaded: true,
            firing: false,
            fired: false,
          };
        }
      };
      /** 请求资源 */
      this._load = (moduleName, entryKey) => {
        if (typeof moduleName === 'number') {
          moduleName = moduleName.toString();
        }
        if (!this.config.aggregateFetch) {
          const entry = this.state.entrances.get(entryKey);
          if (entry && !entry.loadSource.hasOwnProperty(moduleName)) {
            entry.loadSource[moduleName] = false;
          }
        }
        if (!this.state.inited || this.state.fileExecuting) {
          this.state.pendingQueue.push([moduleName, entryKey]);
          return;
        }
        const module = this._getModule(moduleName);
        if (module) {
          this._addReferToDependency(moduleName, module, entryKey);
          if (module.loaded) {
            this._triggerCallback(moduleName, module);
          }
          return;
        }
        const [name] = moduleName.split('?');
        this.state.requireMap[name] = moduleName;
        this.state.installedModules[moduleName] = {
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
        this._addReferToDependency(
          moduleName,
          this.state.installedModules[moduleName],
          entryKey
        );
        const srcPath = this._generatePath(moduleName);
        this.config.requestMethod === 'fetch'
          ? fetchCubeCode(
              {
                url: srcPath,
                fetch: this.config.fetchMethod,
                onCodeError: this.config.onCodeError,
              },
              combineExecute
            )
          : scriptCubeCode(srcPath);
      };
      /** 实例化并执行回调 */
      this._initiate = (moduleName) => {
        const module = this.state.installedModules[moduleName];
        this._triggerCallback(moduleName, module);
      };
      /** 向上检索树依赖及回调 */
      this._triggerCallback = (moduleName, module) => {
        if (!module.loaded) return;
        if (this.config.aggregateFetch) {
          module.dep.forEach((m) => {
            var _a;
            if (
              (_a = this._getModule(m)) === null || _a === void 0
                ? void 0
                : _a.loaded
            ) {
              return;
            }
            this._load(m, []);
          });
          if (this.state.aggregateLoading[moduleName]) {
            delete this.state.aggregateLoading[moduleName];
            this._triggerAllCallback();
          }
          return;
        }
        const refDep = module.refer;
        let finishedEntry = [];
        refDep.entryDep.forEach((entryKey) => {
          const entry = this.state.entrances.get(entryKey);
          if (entry) {
            entry.loadSource[moduleName] = true;
            let next = true;
            if (!module.fired) {
              module.dep.forEach((m) => {
                if (entry.loadSource[m]) return;
                const subModule = this._getModule(m);
                if (
                  subModule === null || subModule === void 0
                    ? void 0
                    : subModule.fired
                )
                  return;
                next = false;
                this._load(m, entryKey);
              });
            }
            if (next) {
              // 考虑标记 unload 提速
              if (Object.values(entry.loadSource).every((i) => i)) {
                this._triggerEntryCallback(entryKey, entry);
              }
            }
          } else {
            finishedEntry.push(entryKey);
          }
        });
        if (finishedEntry.length) {
          module.refer.entryDep = refDep.entryDep.filter(
            (i) => !finishedEntry.includes(i)
          );
        }
      };
      /** 执行回调函数 */
      this._triggerEntryCallback = (entryKey, entry) => {
        let readyCallback = true;
        entry.targets.forEach((moduleName) => {
          const module = this._getModule(moduleName);
          if (module.fired) return;
          // 理论上不会不存在
          if (module.firing) {
            readyCallback = false;
            return;
          }
          this._fireModule(moduleName);
          if (module.fired) return;
          readyCallback = false;
        });
        if (readyCallback) {
          entry.callback(
            ...entry.targets.map((e) => this.state.installedModules[e].exports)
          );
          this.state.entrances.delete(entryKey);
        }
      };
      this._triggerAllCallback = () => {
        if (this.state.delayTrigger) return;
        // this.state.delayTrigger = setTimeout(() => {
        // this.state.delayTrigger = undefined;
        if (this.state.pendingQueue.length) return;
        if (Object.keys(this.state.aggregateLoading).length) return;
        this.state.entrances.forEach((entry, entryKey) => {
          this._triggerEntryCallback(entryKey, entry);
        });
        // });
      };
      /** 实例化某一模块 */
      this._fireModule = (moduleName) => {
        const module = this.state.installedModules[moduleName];
        if (!module || !module.loaded) return false;
        if (module.fired) return true;
        // 处理循环依赖问题
        if (module.firing) {
          return true;
        }
        let fireResult = true;
        try {
          module.firing = true;
          const exports = module.sourceCode.apply(window, [
            module,
            // 此处需要组件不改变实例
            module.exports,
            this._cubeRequire(moduleName),
            this._cubeLoad(moduleName),
            this.config.mockedProcess,
            this.config.mockedGlobal,
          ]);
          module.exports = this._isEsModule(exports)
            ? exports.default
            : exports;
          module.error = false;
        } catch (e) {
          if (
            this.config.fetchUndeclaredModule &&
            e.message === `Cube inner denpendency lost; refetch inited`
          ) {
            console.warn('Cube 检测到文件依赖缺失');
            fireResult = false;
          } else {
            console.error('Cube 生成实例失败', e);
            console.error(moduleName, module);
            module.error = true;
          }
        } finally {
          module.firing = false;
          if (this.config.fetchUndeclaredModule) {
            // 避免组件内部有 catch 导致 抓不到错误的情况
            if (this.state.lostDepModule[moduleName]) {
              this.state.lostDepModule[moduleName].forEach((name) => {
                if (!module.dep.includes(name)) {
                  module.dep.push(name);
                  module.refer.entryDep.forEach((eKey) => {
                    this._load(name, eKey);
                  });
                  console.warn(
                    `Cube module ${moduleName} 缺失声明依赖 ${name}`
                  );
                }
              });
              Reflect.deleteProperty(this.state.lostDepModule, moduleName);
              fireResult = false;
            }
          } else {
            module.fired = true;
          }
        }
        return fireResult;
      };
      /** 支持组件内模块请求 */
      this._cubeRequire = (selfName) => (moduleName, namespace) => {
        if (namespace === undefined) {
          const module = this._getModule(moduleName);
          if (module === null || module === void 0 ? void 0 : module.fired) {
            return module.exports;
          }
          const fireFinished = this._fireModule(moduleName);
          if (!module || !fireFinished) {
            if (this.config.fetchUndeclaredModule) {
              if (this.state.lostDepModule[selfName]) {
                this.state.lostDepModule[selfName].push(moduleName);
              } else {
                this.state.lostDepModule[selfName] = [moduleName];
              }
              // WATCH! 由于组件内相对路径依赖没有声明 导致必须强行中断流程，
              // 后续应该将相对依赖加入依赖中
              throw new Error(`Cube inner denpendency lost; refetch inited`);
            } else {
              throw new Error(`Cube 获取未声明资源 ${moduleName} 失败`);
            }
          } else {
            return module.exports;
          }
        } else {
          // 默认 css 模块不再依赖其它模块
          let css;
          const module = this._getModule(moduleName);
          if (!module || !module.loaded) return;
          if (module.fired) {
            css = module.exports;
          }
          const fireSucceed = this._fireModule(moduleName);
          if (fireSucceed) {
            css = module.exports;
          }
          return this.css(css, namespace, moduleName);
        }
      };
      /** 支持组件内模块加载 */
      this._cubeLoad = (referer) => {
        /** The load function */
        const __cube_load__ = (moduleName, namespace, cb) => {
          if (cb === undefined && typeof namespace === 'function') {
            cb = namespace;
            namespace = '';
            this.use(moduleName, referer, cb);
          } else {
            this.use(moduleName, referer, (css) => {
              css = this.css(css, namespace, moduleName);
              cb && cb(css);
            });
          }
        };
        return __cube_load__;
      };
      /** 请求路径生成 */
      this._generatePath = (moduleName) => {
        // 只有拼 src 时要带上 m & ref 时才需要分离 require 里的入参 query, 平时 /xxx?query=xx 才作为 installedModules 的 key
        const [name, custom] = moduleName.split('?');
        let srcPath = rebase(name, this.config);
        const query = [];
        if (this.config.version) {
          query.push(this.config.version);
        }
        if (this.config.combine) {
          query.push('combine=true');
        }
        if (custom) {
          const customArgs = parseQueryString(custom);
          query.push(
            Object.keys(customArgs).map((c) => {
              return `${c}=${customArgs[c]}`;
            })
          );
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
      this._addReferToDependency = (moduleName, module, referer) => {
        if (this.config.aggregateFetch) {
          if (!module.loaded) {
            this.state.aggregateLoading[moduleName] = true;
          }
          return;
        }
        const refDep = module.refer;
        if (!referer) {
          return;
        }
        if (!refDep.entryDep.includes(referer)) {
          refDep.entryDep.push(referer);
        }
      };
      /** 修正返回值 */
      this._calibrateName = (responseName) => {
        // 兼容返回的 name 不带入参的情况
        const moduleName = this.state.requireMap[responseName] || responseName;
        if (this.state.requireMap[responseName]) {
          Reflect.deleteProperty(this.state.requireMap, responseName);
        }
        return moduleName;
      };
      /**
       * 获取全局默认模块
       * requirePath => datav:/npm/react/16.4.6?env=xxx
       */
      this._getGlobalRegister = (requirePath) => {
        for (const register of this.state.registerModules) {
          if (requirePath && register.match.test(requirePath)) {
            return register.module;
          }
        }
      };
      this._getModule = (name) => {
        // TODO 此处有问题 理论上优先选取 globalRegister
        // 但考虑到正则匹配的耗时 每次匹配耗时过长
        // 所以应该是此处顺序不变 注册的时候做一次是否满足正则的校验
        const module = this.state.installedModules[name];
        if (!module) {
          return this._getGlobalRegister(name);
        }
        return module;
      };
      this._isEsModule = (module) => {
        return (
          this.config.esModule &&
          module &&
          typeof module === 'object' &&
          module.__esModule
        );
      };
      this.cStart = () => {
        this.state.fileExecuting = true;
      };
      this.cStop = () => {
        this.state.fileExecuting = false;
        for (let i = 0; i < this.state.pendingQueue.length; i++) {
          let pendingInfo = this.state.pendingQueue[i];
          this._load(pendingInfo[0], pendingInfo[1]);
        }
        this.state.pendingQueue = [];
      };
      /****************************** 以下为原有方法兼容 **************************/
      /** 原有方法 直接打印内部状态 */
      this.cache = () => {
        console.info(
          'modules:',
          Object.fromEntries(Object.entries(this.state.installedModules))
        );
        console.info(
          'unloaded:',
          Object.fromEntries(
            Object.entries(this.state.installedModules).filter(
              (m) => !m[1].loaded
            )
          )
        );
        console.info(
          'unfired:',
          Object.fromEntries(
            Object.entries(this.state.installedModules).filter(
              (m) => !m[1].fired
            )
          )
        );
      };
      /** @deprecated */
      this.debug = () => {
        console.error('debug 方法不再支持');
      };
      /** @deprecated */
      this.setRemoteBase = () => {
        console.error('不支持动态修改 remoteBase');
      };
    }
  }
  function getStringOnlyObj() {
    return new Proxy(
      {},
      {
        get: function (target, propKey) {
          const key =
            typeof propKey === 'number' ? propKey.toString() : propKey;
          return Reflect.get(target, key);
        },
        set: function (target, propKey, value, receiver) {
          const key =
            typeof propKey === 'number' ? propKey.toString() : propKey;
          return Reflect.set(target, key, value, receiver);
        },
      }
    );
  }
  /** 全局初始化单例 */
  function setGlobalCube(oldVersion) {
    const alias = 'Cube';
    const global = typeof window !== 'undefined' ? window : globalThis;
    if (global[alias]) {
      console.error('Cube Error: window.' + alias + ' already in using');
      return global[alias];
    }
    if (oldVersion) {
      mockClassicalCube(global);
    } else {
      const cube = new Cube();
      // 支持 Cube(...args) 的写法
      const cubeHandler = (moduleName, requires, instance) => {
        return cube.execute(moduleName, requires, instance);
      };
      const mockCube = new Proxy(cubeHandler, {
        get: function (handler, key) {
          if (Reflect.ownKeys(cube).includes(key)) {
            return cube[key];
          }
          return Reflect.get(handler, key);
        },
      });
      global[alias] = mockCube;
    }
    const cubeVersion = '5.0.0-beta.27';
    global[alias].cubeVersion = cubeVersion;
    global[alias].oldVersion = oldVersion;
    return global[alias];
  }

  if (typeof window === 'undefined') {
    module.exports = setGlobalCube(true);
  } else {
    setGlobalCube(true);
  }
})(typeof window !== 'undefined' ? window : globalThis);
