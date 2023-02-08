// WATCH! 该文件由 cube-reconstruct.ts 导出 请勿直接改动
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
var __spreadArray =
  (this && this.__spreadArray) ||
  function (to, from, pack) {
    if (pack || arguments.length === 2)
      for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
        }
      }
    return to.concat(ar || Array.prototype.slice.call(from));
  };
// 支持 cube 的一些工具方法
function noop() {}
function baseCodeProxy(c) {
  return c;
}
function fetchCubeCode(url, inputCodeProxy) {
  var codeProxy = inputCodeProxy || baseCodeProxy;
  return fetch(url, {
    headers: {
      'Content-Type': 'text/plain',
    },
  })
    .then(function (response) {
      return response.text();
    })
    .then(function (code) {
      return new Function(codeProxy(code))();
    });
}
var head = document.querySelector('head');
/** 原有 cube 请求方法 */
function scriptCubeCode(url) {
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.onerror = function () {
    window.Cube(require, [], function () {
      console.error('load module: '.concat(require, ' failed.'));
    });
  };
  script.src = url;
  head.appendChild(script);
}
function generateModuleCallback(moduleNames, callback) {
  var exportModules = {};
  return function (exportModule, path) {
    exportModules[path] = exportModule;
    // 外部调用时保障了对应关系 此处简单判断
    if (Object.keys(exportModules).length === moduleNames.length) {
      // 保证 module 顺序
      callback.apply(
        void 0,
        moduleNames.map(function (k) {
          return exportModules[k];
        })
      );
      return true;
    }
    return false;
  };
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
  var base = config.base,
    remoteSeparator = config.remoteSeparator,
    remoteBase = config.remoteBase;
  var defaultPath = base + name;
  var offset = name.indexOf ? name.indexOf(remoteSeparator) : 0;
  if (offset <= 0) return defaultPath;
  var rbase = name.substr(0, offset);
  if (!remoteBase[rbase]) return defaultPath;
  return remoteBase[rbase] + name.substr(offset + 1);
}
function intercept() {
  console.time('intercept exec');
  var referer = 'intercept_mock';
  var dep = [];
  var proxy = function (c) {
    var d = c.replaceAll('Cube(', 'Cube._store(');
    // console.log(d);
    return d;
  };
  return Promise.all(
    dep.map(function (s) {
      var _a = String(s).split('?'),
        mod = _a[0],
        custom = _a[1];
      var config = window.Cube.config;
      var srcPath = rebase(mod, config);
      var version = config.version,
        debug = config.debug;
      var query = [];
      if (version) {
        query.push(version);
      }
      if (debug) {
        query.push('m');
        query.push('ref=' + referer);
      }
      if (custom) {
        var customArgs_1 = parseQueryString(custom);
        Array.prototype.push.apply(
          query,
          Object.keys(customArgs_1).map(function (c) {
            return ''.concat(c, '=').concat(customArgs_1[c]);
          })
        );
      }
      if (query.length) {
        srcPath = srcPath + '?' + query.join('&');
      }
      return fetchCubeCode(srcPath, proxy);
    })
  ).then(function () {
    console.timeEnd('intercept exec');
  });
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
      inited: true,
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
      installedModules: {},
      /** 注册模块 */
      registerModules: [],
      // 兼容请求 key 带入参，返回 key 不带入参的情况。
      // eg. 请求 /xxx?env=xx 返回 Cube('/xxx',), requireMap 缓存了 { '/xxx': '/xxx?env=xx' }
      requireMap: {},
    };
    /**
     * 跳过请求注册模块
     * @param moduleName 模块名
     * @param exports 模块实例
     * @param matchType 匹配模式，version 默认为按版本全匹配; module 按库级别，只要库一致就替换
     */
    this.register = function (moduleName, exports, option) {
      if (option === void 0) {
        option = { matchType: 'version' };
      }
      var matchType = option.matchType;
      if (_this._getReadyModule(moduleName)) {
        return console.warn('Cube Warning: Module ' + "'" + moduleName + "'" + ' already registered');
      }
      _this.state.installedModules[moduleName] = {
        exports: exports,
        sourceCode: noop,
        dep: [],
        refer: { upperDep: [], entryDep: [] },
        ready: true,
        loaded: true,
        fired: true,
      };
      if (matchType === 'module') {
        _this.state.registerModules.push({
          moduleName: moduleName,
          matchType: matchType,
          match: new RegExp('^datav:/npm/'.concat(moduleName, '/([^/]+)?$')),
          module: _this.state.installedModules[moduleName],
        });
      }
    };
    /** 初始化 */
    this.init = function (config) {
      var _a, _b, _c, _d;
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
      _this.state.inited = true;
      while (_this.state.pendingQueue.length) {
        var pendingInfo = _this.state.pendingQueue.shift();
        _this._load(pendingInfo[0], pendingInfo[1]);
      }
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
      var moduleNames = typeof moduleName === 'string' ? [moduleName] : __spreadArray([], moduleName, true);
      var omitFix = omitFixOrUndefined;
      // let _referer: string | undefined;
      var callback;
      if (typeof refererOrCallback === 'string') {
        // referer = refererOrCallback;
        callback = callbackOrOmitFix;
      } else {
        // referer = undefined;
        callback = refererOrCallback;
        omitFix = callbackOrOmitFix;
      }
      callback = callback || noop;
      moduleNames = !omitFix ? fixMododulePath(moduleNames, _this.config.remoteSeparator) : moduleNames;
      _this.state.entrances.set(moduleNames, {
        callback: callback,
        loadSources: __spreadArray([], moduleNames, true),
      });
      _this._load(moduleNames, moduleNames);
    };
    /** 执行 cube 源码 即原 Cube(...) */
    this.execute = function (responseName, requires, sourceCode) {
      var _a;
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
      var _b;
      // 不重复存储
      if ((_b = _this.state.installedModules[moduleName]) === null || _b === void 0 ? void 0 : _b.loaded) {
        return;
      }
      var module = _this.state.installedModules[moduleName];
      if (module) {
        (_a = module.dep).push.apply(_a, dep);
        module.sourceCode = sourceCode;
        module.loaded = true;
      } else {
        _this.state.installedModules[moduleName] = {
          exports: {},
          sourceCode: sourceCode,
          dep: dep,
          refer: { upperDep: [], entryDep: [] },
          loaded: true,
          ready: false,
          fired: false,
        };
      }
    };
    /** 请求资源 */
    this._load = function (moduleNames, refer) {
      if (!_this.state.inited) {
        _this.state.pendingQueue.push([moduleNames, refer]);
        return;
      }
      moduleNames.forEach(function (moduleName) {
        var module = _this.state.installedModules[moduleName];
        if (_this._getReadyModule(moduleName)) {
          _this._triggerCallback(_this._addReferToModule({ upperDep: [], entryDep: [] }, refer));
          return;
        }
        if (module) {
          _this._addReferToModule(module.refer, refer);
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
            upperDep: [],
          },
          loaded: false,
          ready: false,
          fired: false,
        };
        _this._addReferToModule(_this.state.installedModules[moduleName].refer, refer);
        var srcPath = _this._generatePath(moduleName);
        fetchCubeCode(srcPath);
      });
    };
    /** 向上检索树依赖及回调 */
    this._triggerCallback = function (refer) {
      refer.upperDep.forEach(function (mName) {
        var upperModule = _this.state.installedModules[mName];
        if (upperModule) {
          _this._initiate(mName);
        }
      });
      refer.entryDep.forEach(function (entry) {
        var upperModule = _this.state.entrances.get(entry);
        if (upperModule) {
          _this._triggerEntryCallback(entry);
        }
      });
    };
    /** 实例化并执行回调 */
    this._initiate = function (moduleName) {
      if (!_this.state.installedModules[moduleName] || _this.state.installedModules[moduleName].ready) return;
      var module = _this.state.installedModules[moduleName];
      if (module) {
        if (!module.loaded) return;
        if (module.dep.length) {
          var allLoad_1 = true;
          module.dep.forEach(function (name) {
            if (_this._getReadyModule(name)) return;
            if (_this._checkCursiveDep(moduleName, name)) return;
            allLoad_1 = false;
            _this._load([name], moduleName);
          });
          if (!allLoad_1) return;
        }
      }
      // 此处直接fire 请求资源都默认为需要的
      _this.state.installedModules[moduleName].ready = true;
      _this._triggerCallback(module.refer);
    };
    /** 执行回调函数 */
    this._triggerEntryCallback = function (entry) {
      var entryInfo = _this.state.entrances.get(entry);
      if (entryInfo && entryInfo.loadSources.every(_this._getReadyModule)) {
        // 存在隐藏依赖的情况 降低 _fireModule 触发时机
        if (entryInfo.loadSources.every(_this._fireModule)) {
          entryInfo.callback.apply(
            entryInfo,
            entry.map(function (e) {
              return _this.state.installedModules[e].exports;
            })
          );
          _this.state.entrances.delete(entry);
        }
      }
    };
    /** 实例化某一模块 */
    this._fireModule = function (moduleName) {
      var module = _this.state.installedModules[moduleName];
      if (!module || !module.ready) return false;
      if (module.fired) return true;
      var fireResult = true;
      try {
        var exports = module.sourceCode.apply(window, [
          module,
          module.exports,
          _this._cubeRequire(moduleName),
          _this._cubeLoad(moduleName),
          _this.config.mockedProcess,
          _this.config.mockedGlobal,
        ]);
        module.exports = _this._isEsModule(exports) ? exports.default : exports;
        module.error = false;
      } catch (e) {
        if (e.message === 'Cube inner denpendency lost; refetch inited') {
          console.warn('Cube 检测到文件依赖缺失');
          fireResult = false;
        } else {
          console.error('Cube 生成实例失败', e);
          console.error(moduleName, module);
          module.error = true;
        }
      } finally {
        // 避免组件内部有 catch 导致 抓不到错误的情况
        if (_this.state.lostDepModule[moduleName]) {
          module.ready = false;
          _this.state.lostDepModule[moduleName].forEach(function (name) {
            if (!module.dep.includes(name)) {
              module.dep.push(name);
              _this._load([name], moduleName);
              console.warn('Cube module '.concat(moduleName, ' \u7F3A\u5931\u58F0\u660E\u4F9D\u8D56 ').concat(name));
            }
          });
          Reflect.deleteProperty(_this.state.lostDepModule, moduleName);
          fireResult = false;
        } else {
          module.fired = true;
        }
      }
      return fireResult;
    };
    /** 支持组件内模块请求 */
    this._cubeRequire = function (selfName) {
      return function (moduleName, namespace) {
        if (namespace === undefined) {
          var module = _this._getModule(moduleName);
          if (module === null || module === void 0 ? void 0 : module.fired) {
            return module.exports;
          }
          if (_this._checkCursiveDep(selfName, moduleName)) {
            console.error(
              'Cube \u68C0\u6D4B\u5230\u5FAA\u73AF\u4F9D\u8D56 '.concat(moduleName, ' --> ').concat(selfName)
            );
            return {};
          }
          var fireSucceed = _this._fireModule(moduleName);
          if (!module || !fireSucceed) {
            if (_this.state.lostDepModule[selfName]) {
              _this.state.lostDepModule[selfName].push(moduleName);
            } else {
              _this.state.lostDepModule[selfName] = [moduleName];
            }
            // WATCH! 由于组件内相对路径依赖没有声明 导致必须强行中断流程，
            // 后续应该将相对依赖加入依赖中
            throw new Error('Cube inner denpendency lost; refetch inited');
          } else {
            return module.exports;
          }
        } else {
          // 默认 css 模块不再依赖其它模块
          var css = void 0;
          var module = _this._getReadyModule(moduleName);
          if (!module) return;
          if (module.fired) {
            css = module.exports;
          }
          var fireSucceed = _this._fireModule(moduleName);
          if (fireSucceed) {
            css = module.exports;
          }
          return _this.css(css, namespace, moduleName);
        }
      };
    };
    /** 支持组件内模块加载 */
    this._cubeLoad = function (referer) {
      /** The load function */
      var __cube_load__ = function (moduleName, namespace, cb) {
        if (cb === undefined && typeof namespace === 'function') {
          cb = namespace;
          namespace = '';
          _this.use(moduleName, referer, cb);
        } else {
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
      var _a = moduleName.split('?'),
        name = _a[0],
        custom = _a[1];
      var srcPath = rebase(name, _this.config);
      var query = [];
      // 历史逻辑 疑似命中缓存
      query.push('m=1');
      if (_this.config.version) {
        query.push(_this.config.version);
      }
      if (_this.config.combine) {
        query.push('combine=true');
      }
      if (custom) {
        var customArgs_2 = parseQueryString(custom);
        query.push(
          Object.keys(customArgs_2).map(function (c) {
            return ''.concat(c, '=').concat(customArgs_2[c]);
          })
        );
      }
      if (query.length) {
        srcPath = srcPath + '?' + query.join('&');
      }
      return srcPath;
    };
    /** 存储引用关系 */
    this._addReferToModule = function (module, referer) {
      if (!referer) {
        return module;
      }
      // 此处简单判断
      var isEntry = typeof referer !== 'string';
      if (isEntry) {
        module.entryDep.push(referer);
      } else {
        if (!module.upperDep.includes(referer)) {
          module.upperDep.push(referer);
        }
      }
      return module;
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
    // /** 引用信息缺失时 自构建引用关系 剩者为王 */
    // private chaosBattle = (names: string[]) => {
    //   if (names.length === 1) {
    //     this._initiateAndCallback(names[0]);
    //   } else if (names.length > 1) {
    //     // this.state.combineStatus = 'execute';
    //     names.forEach((name) => this._initiateAndCallback(name));
    //   }
    // };
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
    this._getReadyModule = function (name) {
      var module = _this._getModule(name);
      if (module === null || module === void 0 ? void 0 : module.ready) {
        return module;
      }
    };
    this._getModule = function (name) {
      var module = _this.state.installedModules[name];
      if (!module) {
        return _this._getGlobalRegister(name);
      }
      return module;
    };
    this._isEsModule = function (module) {
      return _this.config.esModule && module && typeof module === 'object' && module.__esModule;
    };
    this._checkCursiveDep = function (selfName, requireName) {
      if (requireName === selfName) return true;
      var depArr = [requireName];
      var detected = false;
      var times = 6; // 防止下层依赖环
      var _loop_1 = function () {
        var newDep = [];
        depArr.forEach(function (d) {
          var depModule = _this.state.installedModules[d];
          if (depModule && !depModule.fired) {
            newDep.push.apply(newDep, depModule.dep);
          }
        });
        if (newDep.includes(selfName)) {
          detected = true;
        }
        depArr = newDep;
        times -= 1;
      };
      do {
        _loop_1();
      } while (detected === false && times > 0 && depArr.length > 0);
      if (detected) return true;
      return false;
    };
    // 测试使用
    // private _unResolvedDep = () => {
    //   Object.values(this.state.loadingModule).forEach((m) => {
    //     m.unresolveDep = m.dep.filter((d) => !this._getFiredModule(d));
    //   });
    // };
    /****************************** 以下为原有方法兼容 **************************/
    /** 原有方法 直接打印内部状态 */
    this.cache = function () {
      console.info('modules:', _this.state.installedModules);
      console.info(
        'unloaded:',
        Object.values(_this.state.installedModules).filter(function (m) {
          return !m.loaded;
        })
      );
      console.info(
        'unfired:',
        Object.values(_this.state.installedModules).filter(function (m) {
          return !m.fired;
        })
      );
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
})();
/** 全局初始化单例 */
function setGlobalCube(alias) {
  if (alias === void 0) {
    alias = 'Cube';
  }
  var global = window;
  if (global[alias]) {
    console.error('Cube Error: window.' + alias + ' already in using');
    return global[alias];
  }
  var cube = new Cube();
  // 支持 Cube(...args) 的写法
  var cubeHandler = function (moduleName, requires, instance) {
    return cube.execute(moduleName, requires, instance);
  };
  var mockCube = new Proxy(cubeHandler, {
    get: function (handler, key) {
      if (Reflect.ownKeys(cube).includes(key)) {
        return cube[key];
      }
      return Reflect.get(handler, key);
    },
  });
  global[alias] = mockCube;
  return global[alias];
}
/** 模拟目前主动挂在 window 的做法 */
setGlobalCube();