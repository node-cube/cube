// WATCH! 该文件由 cube-reconstruct.ts 导出 请勿直接改动

import { scriptCubeCss, noop, fixMododulePath, rebase, parseQueryString, fetchCubeCode } from './cube-enhancer';
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
};
/**
 * cube 重构
 * https://yuque.antfin.com/lcv0by/ph89oq/chzehxz50ldg5krg
 */
export class Cube {
  constructor() {
    this.config = { ...DEFAULT_CUBE_CONFIG };
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
    this.register = (moduleName, exports, option = { matchType: 'version' }) => {
      const { matchType } = option;
      if (this._getReadyModule(moduleName)) {
        return console.warn('Cube Warning: Module ' + "'" + moduleName + "'" + ' already registered');
      }
      this.state.installedModules[moduleName] = {
        exports: exports,
        sourceCode: noop,
        dep: [],
        refer: { upperDep: [], entryDep: [] },
        ready: true,
        loaded: true,
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
      if (config.base && config.base !== '/') {
        this.config.base = config.base.replace(/\/$/, '');
      }
      if (config.remoteBase) {
        for (let key in config.remoteBase) {
          if (config.remoteBase.hasOwnProperty(key)) {
            this.config.remoteBase[key] = config.remoteBase[key].replace(/\/$/, '');
          }
        }
      }
      this.config.version = config.version ?? this.config.version;
      this.config.esModule = config.esModule ?? this.config.esModule;
      this.config.debug = config.debug ?? this.config.debug;
      this.config.combine = config.combine ?? this.config.combine;
      this.state.inited = true;
      while (this.state.pendingQueue.length) {
        const pendingInfo = this.state.pendingQueue.shift();
        this._load(pendingInfo[0], pendingInfo[1]);
      }
    };
    /**
     * 异步加载模块
     */
    this.use = (moduleName, refererOrCallback, callbackOrOmitFix, omitFixOrUndefined) => {
      if (!moduleName) {
        throw new Error('Cube.use(moduleName) moduleName is undefined!');
      }
      // 整理入参
      // 确保 moduleNames 唯一
      let moduleNames = typeof moduleName === 'string' ? [moduleName] : [...moduleName];
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
      moduleNames = !omitFix ? fixMododulePath(moduleNames, this.config.remoteSeparator) : moduleNames;
      this.state.entrances.set(moduleNames, {
        callback,
        loadSources: [...moduleNames],
      });
      this._load(moduleNames, moduleNames);
    };
    /** 执行 cube 源码 即原 Cube(...) */
    this.execute = (responseName, requires, sourceCode) => {
      const moduleName = this._calibrateName(responseName);
      // load 处已做判断 但仍有可能某个模块源码带有其他冗余模块的情况
      if (this.state.installedModules[moduleName]?.loaded) {
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
      // 不重复存储
      if (this.state.installedModules[moduleName]?.loaded) {
        return;
      }
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
          refer: { upperDep: [], entryDep: [] },
          loaded: true,
          ready: false,
          fired: false,
        };
      }
    };
    /** 请求资源 */
    this._load = (moduleNames, refer) => {
      if (!this.state.inited) {
        this.state.pendingQueue.push([moduleNames, refer]);
        return;
      }
      moduleNames.forEach((moduleName) => {
        const module = this.state.installedModules[moduleName];
        if (this._getReadyModule(moduleName)) {
          this._triggerCallback(this._addReferToModule({ upperDep: [], entryDep: [] }, refer));
          return;
        }
        if (module) {
          this._addReferToModule(module.refer, refer);
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
            upperDep: [],
          },
          loaded: false,
          ready: false,
          fired: false,
        };
        this._addReferToModule(this.state.installedModules[moduleName].refer, refer);
        const srcPath = this._generatePath(moduleName);
        fetchCubeCode(srcPath);
      });
    };
    /** 向上检索树依赖及回调 */
    this._triggerCallback = (refer) => {
      refer.upperDep.forEach((mName) => {
        const upperModule = this.state.installedModules[mName];
        if (upperModule) {
          this._initiate(mName);
        }
      });
      refer.entryDep.forEach((entry) => {
        const upperModule = this.state.entrances.get(entry);
        if (upperModule) {
          this._triggerEntryCallback(entry);
        }
      });
    };
    /** 实例化并执行回调 */
    this._initiate = (moduleName) => {
      if (!this.state.installedModules[moduleName] || this.state.installedModules[moduleName].ready) return;
      const module = this.state.installedModules[moduleName];
      if (module) {
        if (!module.loaded) return;
        if (module.dep.length) {
          let allLoad = true;
          module.dep.forEach((name) => {
            if (this._getReadyModule(name)) return;
            if (this._checkCursiveDep(moduleName, name)) return;
            allLoad = false;
            this._load([name], moduleName);
          });
          if (!allLoad) return;
        }
      }
      // 此处直接fire 请求资源都默认为需要的
      this.state.installedModules[moduleName].ready = true;
      this._triggerCallback(module.refer);
    };
    /** 执行回调函数 */
    this._triggerEntryCallback = (entry) => {
      const entryInfo = this.state.entrances.get(entry);
      if (entryInfo && entryInfo.loadSources.every(this._getReadyModule)) {
        // 存在隐藏依赖的情况 降低 _fireModule 触发时机
        if (entryInfo.loadSources.every(this._fireModule)) {
          entryInfo.callback(...entry.map((e) => this.state.installedModules[e].exports));
          this.state.entrances.delete(entry);
        }
      }
    };
    /** 实例化某一模块 */
    this._fireModule = (moduleName) => {
      const module = this.state.installedModules[moduleName];
      if (!module || !module.ready) return false;
      if (module.fired) return true;
      let fireResult = true;
      try {
        const exports = module.sourceCode.apply(window, [
          module,
          module.exports,
          this._cubeRequire(moduleName),
          this._cubeLoad(moduleName),
          this.config.mockedProcess,
          this.config.mockedGlobal,
        ]);
        module.exports = this._isEsModule(exports) ? exports.default : exports;
        module.error = false;
      } catch (e) {
        if (e.message === `Cube inner denpendency lost; refetch inited`) {
          console.warn('Cube 检测到文件依赖缺失');
          fireResult = false;
        } else {
          console.error('Cube 生成实例失败', e);
          console.error(moduleName, module);
          module.error = true;
        }
      } finally {
        // 避免组件内部有 catch 导致 抓不到错误的情况
        if (this.state.lostDepModule[moduleName]) {
          module.ready = false;
          this.state.lostDepModule[moduleName].forEach((name) => {
            if (!module.dep.includes(name)) {
              module.dep.push(name);
              this._load([name], moduleName);
              console.warn(`Cube module ${moduleName} 缺失声明依赖 ${name}`);
            }
          });
          Reflect.deleteProperty(this.state.lostDepModule, moduleName);
          fireResult = false;
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
        if (module?.fired) {
          return module.exports;
        }
        if (this._checkCursiveDep(selfName, moduleName)) {
          console.error(`Cube 检测到循环依赖 ${moduleName} --> ${selfName}`);
          return {};
        }
        const fireSucceed = this._fireModule(moduleName);
        if (!module || !fireSucceed) {
          if (this.state.lostDepModule[selfName]) {
            this.state.lostDepModule[selfName].push(moduleName);
          } else {
            this.state.lostDepModule[selfName] = [moduleName];
          }
          // WATCH! 由于组件内相对路径依赖没有声明 导致必须强行中断流程，
          // 后续应该将相对依赖加入依赖中
          throw new Error(`Cube inner denpendency lost; refetch inited`);
        } else {
          return module.exports;
        }
      } else {
        // 默认 css 模块不再依赖其它模块
        let css;
        const module = this._getReadyModule(moduleName);
        if (!module) return;
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
      // 历史逻辑 疑似命中缓存
      query.push('m=1');
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
      if (query.length) {
        srcPath = srcPath + '?' + query.join('&');
      }
      return srcPath;
    };
    /** 存储引用关系 */
    this._addReferToModule = (module, referer) => {
      if (!referer) {
        return module;
      }
      // 此处简单判断
      const isEntry = typeof referer !== 'string';
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
    this._calibrateName = (responseName) => {
      // 兼容返回的 name 不带入参的情况
      const moduleName = this.state.requireMap[responseName] || responseName;
      if (this.state.requireMap[responseName]) {
        Reflect.deleteProperty(this.state.requireMap, responseName);
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
    this._getGlobalRegister = (requirePath) => {
      for (const register of this.state.registerModules) {
        if (requirePath && register.match.test(requirePath)) {
          return register.module;
        }
      }
    };
    this._getReadyModule = (name) => {
      const module = this._getModule(name);
      if (module?.ready) {
        return module;
      }
    };
    this._getModule = (name) => {
      const module = this.state.installedModules[name];
      if (!module) {
        return this._getGlobalRegister(name);
      }
      return module;
    };
    this._isEsModule = (module) => {
      return this.config.esModule && module && typeof module === 'object' && module.__esModule;
    };
    this._checkCursiveDep = (selfName, requireName) => {
      if (requireName === selfName) return true;
      let depArr = [requireName];
      let detected = false;
      let times = 6; // 防止下层依赖环
      do {
        let newDep = [];
        depArr.forEach((d) => {
          const depModule = this.state.installedModules[d];
          if (depModule && !depModule.fired) {
            newDep.push(...depModule.dep);
          }
        });
        if (newDep.includes(selfName)) {
          detected = true;
        }
        depArr = newDep;
        times -= 1;
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
    this.cache = () => {
      console.info('modules:', this.state.installedModules);
      console.info(
        'unloaded:',
        Object.values(this.state.installedModules).filter((m) => !m.loaded)
      );
      console.info(
        'unfired:',
        Object.values(this.state.installedModules).filter((m) => !m.fired)
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
/** 全局初始化单例 */
export function setGlobalCube(alias = 'Cube') {
  const global = window;
  if (global[alias]) {
    console.error('Cube Error: window.' + alias + ' already in using');
    return global[alias];
  }
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
  return global[alias];
}
/** 模拟目前主动挂在 window 的做法 */
setGlobalCube();
