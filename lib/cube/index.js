'use strict';

const path = require('path');
const async = require('async');
const Events = require('events');
const debug = require('debug')('cube:init');
const Css = require('clean-css');
const fs = require('fs');
const utils = require('../utils');
const FileNameMangle = require('../file_name_mangle');
const EXT_API_PROCESS = require('./ext_api_process');
const EXT_API_TRANSFER = require('./ext_api_transfer');

const buildinProcessors = {
  BUILDIN_JS: new require(path.join(__dirname, '../processor/js')),
  BUILDIN_CSS: new require(path.join(__dirname, '../processor/css')),
  BUILDIN_JSON: new require(path.join(__dirname, '../processor/json')),
  BUILDIN_HTML: new require(path.join(__dirname, '../processor/html')),
  BUILDIN_RAW: new require(path.join(__dirname, '../processor/raw'))
};

/**
 * 保持一条线（一个处理流程）中同一个processor只出现一次
 */
function uniqueProcessors(list) {
  var res = [];
  var map = {};
  list.forEach(function (n) {
    var name = n.constructor.name;
    if (map[name]) {
      return;
    }
    map[name] = true;
    res.push(n);
  });
  return res;
}

/**
 * 检查processors配置
 * @param  {String|Array} processor
 *             processor_name, processor_abspath,
 *             [processor_name, ...]
 *             [[processor_name, configObj], ...]
 * @param  {String} ext the file extname
 * @return {Object}
 */
function prepareProcessor(root, processor, ext) {
  let res = [];
  if (!Array.isArray(processor)) {
    processor = [processor];
  }
  let type = null;
  let processorList = [];
  processor.forEach(function (mod) {
    let p;
    let config;
    if (!mod) {
      return;
    }

    if (Array.isArray(mod)) {
      config = mod[1];
      mod = mod[0];
    }

    if (typeof mod === 'string' || Array.isArray(mod)) {
      if (mod.startsWith('BUILDIN_')) {
        p = buildinProcessors[mod];
        if (!p) {
          throw new Error('[CUBE_ERROR] load build in processor error: can not find build-in processor:' + mod);
        }
      } else {
        try {
          p = require(mod);
        } catch (e) {
          throw new Error(`[CUBE_ERROR] load processor [${mod}] error: ${e.message}`);
        }
      }
    } else {
      p = mod;
    }
    if (!ext) {
      ext = p.ext;
    }
    processorList.push(p.name);
    if (!p.type || !p.ext || !p.prototype.process) {
      throw new Error('[CUBE_ERROR] process error， not a vaild processor:' + mod);
    }
    if (type === null) {
      type = p.type;
    } else {
      if (type !== p.type) {
        throw new Error('[CUBE_ERROR] more then one type of process find in `' + ext + '` config, processors:' + processorList.join(',') + ' types:' + type + ',' + p.type);
      }
    }
    if (config) {
      res.push([p, config]);
    } else {
      res.push(p);
    }
  });
  return {type: type, ext: ext, processors: res};
}

const defaultConfig = {
  processors: {
    '.js': ['BUILDIN_JS'],
    '.json': ['BUILDIN_JSON'],
    '.css': ['BUILDIN_CSS'],
    '.html': ['BUILDIN_HTML'],
    '.txt': ['BUILDIN_RAW']
  }
};


class Cube extends Events {
  /**
   * @param {Object} config config object
   *
   *     - root {Path} root path
   *     - port {String} [optional] server port
   *     - router {String} [optional] set up the app.use(`$router`, cube_middleware)
   *     - release {Boolean} if build project, set true
   *     - processors {Array} [optional] set the extenal processors, 配置还可能来自 package.json, 并且package.json中的配置优先级更高
   *     - resBase {String} [optional] the http base for resource
   *     - devCache {Boolean} default true
   *     - mangleFileName {Boolean} build的时候，是否转换文件名
   *     - export {Object} 导出的文件, 需要导出的文件，都需要保留文件名，并且不能被合并
   *     - built {Boolean} 是否已经编译过，编译过之后，直接启用编译结果，不做在线转换
   *     - moduleMap {Object} 映射模块寻址路径
   *     - forceRequire {Boolean} 是否强制require, 即使require的内容不存在
   *     - log
   */
  constructor(config) {
    super();
    /*!
     * ==============
     * prepare config
     * ==============
     */
    if (!config.log) {
      config.log = require('./log');
    }

    this.log = config.log;

    /**
     * remove the last slash(\|/) in config.root
     */
    config.root = config.root.replace(/[\\\/]$/, '');
    if (config.compress === undefined) {
      config.compress = false;
    }
    if (config.devCache === undefined) {
      config.devCache = true;
    }
    if (!config.router) {
      config.router = '/';
    }

    /*!
     * ================
     * init properties
     * ================
     */
    this.config = config;

    this.caches = {
      _cache: {},
      _nmodules: {},
      get: function (key) {
        return this._cache[key] || null;
      },
      set: function (key, v) {
        this._cache[key] = v;
        if (/^\/node_modules/.test(key)) {
          this._nmodules[key] = v;
        }
      },
      getNodeModules: function (each, done) {
        let mods = Object.keys(this._nmodules);
        async.eachLimit(mods, 10, (key, cb) => {
          let node = this._nmodules[key];
          fs.lstat(node.absPath, (err, stats) => {
            if (err) {
              return cb();
            }
            var mtime = new Date(stats.mtime).getTime();

            if (node.modifyTime !== mtime) {
              delete this._nmodules[key];
              delete this._cache[key];
              return cb();
            }
            each(node.codeWraped.replace(/^(Cube\([^\[]+)\[[^\]]+\]/, '$1[]'));
            cb();
          });
        }, done);
      }
    };
    /**
     * 文件后缀名-类型映射表
     */
    this.extMap = {};
    /**
     * 文件processors映射表
     */
    this.processors = {
      script: {},
      style: {},
      template: {},
      raw: {}
    };

    this.mimeType = {
      'script': 'application/javascript',
      'style': 'text/css',
      'template': 'text/html',
      'raw': 'application/javascript'
    };

    debug('loading default process');

    let self = this;
    /**
     * build config property
     */
    this.ignoreRules = config.ignoreRules || {
      ignore: [],
      skip: []
    };
    // loading ignore from `.cubeignore`
    utils.mergeIgnore(this.ignoreRules, utils.loadIgnore(config.root));
    /**
     * fix constructor's processors path
     */
    utils.fixProcessorConfig(config.processors, null, true);

    /**
     * loading configs from package.json:cube
     */
    let root = config.root;
    let cfg = {};
    let pkgPath;
    try {
      pkgPath = path.join(root, './package.json');
      cfg = require(path.join(root, './package.json')).cube || {};
      if (cfg.processors) {
        utils.fixProcessorConfig(cfg.processors, root);
      }
      if (!cfg || Object.keys(cfg).length <= 0) {
        this.log.warn('package.json is not contain cube config， using default config');
      }
    } catch (e) {
      this.log.warn(`${pkgPath} not found`);
    }

    /**
     * merge config from package.json
     */
    Object.keys(cfg).forEach(function (key) {
      var prop = cfg[key];
      var target = config[key];
      switch (key) {
        case 'processors':
        case 'moduleMap':
          if (!target) {
            target = config[key] = {};
          }
          Object.keys(prop).forEach(function (ext) {
            if (!target[ext]) {
              target[ext] = prop[ext];
            }
          });
          break;
        case 'ignoreRules':
          utils.mergeIgnore(self.ignoreRules, prop);
          break;
        default:
          if (target === undefined) {
            config[key] = prop;
          }
      }
    });

    /**
     * merge config from default
     */
    Object.keys(defaultConfig).forEach(function (key) {
      var prop = defaultConfig[key];
      var target = config[key];
      switch (key) {
        case 'processors':
        case 'moduleMap':
          if (!target) {
            target = config[key] = {};
          }
          Object.keys(prop).forEach(function (ext) {
            if (!target[ext]) {
              target[ext] = prop[ext];
            }
          });
          break;
        case 'ignoreRules':
          utils.mergeIgnore(self.ignoreRules, prop);
          break;
        default:
          if (target === undefined) {
            config[key] = prop;
          }
      }
    });

    this.fileNameMangle = new FileNameMangle({
      mangleIgnore: config.export
    });

    this.fileNameSaveFlagMap = {};

    // register processors
    let processors = config.processors;
    Object.keys(processors).forEach(function (ext) {
      let plist = processors[ext];
      if (!Array.isArray(plist)) {
        plist = [plist];
      }
      self.register(ext, plist);
    });

    // css 压缩
    this.cssMinify = new Css({
      inline: ['local'],
      compatibility: 'compatibility',
      noAdvanced: true,
      specialComments: 0,
      rebaseTo: root
    });
  }
  /**
   * 判断文件类型
   * @param  {Path} fpath 文件路径
   * @return {String}  文件类型
   */
  getType(fpath) {
    var ext = fpath.match(/\.\w+$/);
    if (!ext) {
      return null;
    }
    ext = ext[0];
    return this.extMap[ext];
  }
  /**
   * 检查排除列表
   * @param  {Path} absPath 相对于root的绝对路径， /开头
   * @return {Object}         [description]
   */
  checkIgnore(absPath) {
    return utils.checkIgnore(absPath, this.ignoreRules);
  }
  /**
   * 注册processor
   *
   *  register('.js', [processors....])
   *
   *  register('*', processor);
   *
   * @param {String} ext 后缀名
   * @param {Array} ps processor列表, 可以是 Array<String>, 也可以是 Array<ModuleObject>
   *
   * @example
   *   '.js'  [['cube-es2015', {/* config *\/}], 'cube-react']
   */
  register(ext, ps) {
    var processors = this.processors;
    var preparedProcessor;

    preparedProcessor = prepareProcessor(this.config.root, ps, ext);

    var type = preparedProcessor.type;

    var types = processors[type];
    if (!types) {
      types = processors[type] = {};
    }

    if (!this.extMap[ext]) {
      this.extMap[ext] = type;
    }
    if (!types[ext]) {
      types[ext] = [];
    }

    var processInstances = [];
    preparedProcessor.processors.forEach(p => {
      if (Array.isArray(p)) {
        processInstances.push(new p[0](this, p[1]));
      } else {
        processInstances.push(new p(this));
      }
    });

    if (ext === '*') {
      Object.keys(types).forEach(function (key) {
        types[key] = types[key].concat(processInstances);
      });
    } else {
      types[ext] = types[ext].concat(processInstances);
    }

    Object.keys(types).forEach(function (key) {
      types[key] = uniqueProcessors(types[key]);
    });
  }
  /**
  processJsCode(data, callback) {
    data.queryPath = data.file;
    data.realPath = data.file;
    data.wrap = data.wrap !== undefined ? data.wrap : true;
    data = wraper.processScript(this, data);
    wraper.wrapScript(this, data, callback);
  }
  */
  hook(hook, arg) {
    hook = this.config.hooks[hook];
    if (typeof hook === 'function') {
      return hook.call(this, arg);
    } else {
      return arg;
    }
  }
  /**
   * 根据文件类型来查对应的mimeType
   * @param  {String} type  can be script、style、template、raw
   * @return {String}
   */
  getMIMEType(type) {
    var defaultMime = 'text/plain';
    return this.mimeType[type] || defaultMime;
  }
  fixStyleAbsPath(dir, code) {
    var base = this.config.resBase || '/';
    code = code.replace(/url\( *([\'\"]*)([^\'\"\)]+)\1 *\)/ig, function (m0, m1, m2) {
      if (!m2) {
        return m0; // url() content is empty, do nothing
      }
      m2 = m2.trim();
      var st = 0;
      var end = m2.length;
      if (m2[0] === '\'' || m2[0] === '"') {
        st = 1;
      }
      if (m2[m2.length - 1] === '\'' || m2[m2.length - 1] === '"') {
        end = end - 1;
      }
      m2 = m2.substring(st, end);
      if (m2.indexOf('data:') === 0) { // url() is a base64 coded resource, ignore
        return m0;
      }
      if (m2.indexOf('http') === 0) { // url() is a remote resource, ignore
        return m0;
      }
      if (m2.indexOf('/') === 0) {
        return m0.replace(/\"|\'/g, ''); // url() is pointer to a abs path resource
      }
      var tmp = path.join(base, m2);
      return 'url(' + tmp.replace(/\\/g, '/') + ')';
    });
    return code;
  }
  /**
   * 修订res资源的路径
   * pack出来的资源，由于css会以style节点的形式插入Dom中，必须修订其中的图片、字体等资源路径
   */
  fixStyleResPath(dir, code) {
    var base = this.config.resBase || '/';
    code = code.replace(/url\( *([\'\"]*)([^\'\"\)]+)\1 *\)/ig, function (m0, m1, m2) {
      if (!m2) {
        return m0; // url() content is empty, do nothing
      }
      m2 = m2.trim();
      var st = 0;
      var end = m2.length;
      if (m2[0] === '\'' || m2[0] === '"') {
        st = 1;
      }
      if (m2[m2.length - 1] === '\'' || m2[m2.length - 1] === '"') {
        end = end - 1;
      }
      m2 = m2.substring(st, end);
      if (m2.indexOf('data:') === 0) { // url() is a base64 coded resource, ignore
        return m0;
      }
      if (m2.indexOf('http') === 0) { // url() is a remote resource, ignore
        return m0;
      }
      if (m2.indexOf('/') === 0) {
        return m0.replace(/\"|\'/g, ''); // url() is pointer to a abs path resource
      }
      var tmp = path.join(base, dir, m2);
      return 'url(' + tmp.replace(/\\/g, '/') + ')';
    });
    return code;
  }
  /**
   * 打印mangle之后， filename的对应关系
   */
  printFileShortNameMap() {
    console.log(this.fileNameMangle.fileNameMaps);
  }
  /**
   * 获取 mangle之后，文件名的映射集合
   */
  getFileShortNameMap() {
    return this.fileNameMangle.fileNameMaps;
  }
  mangleFileNameMap() {
    return this.fileNameMangle.fileNameMaps;
  }
  setMangleFileNameSaveFlag(key) {
    this.fileNameSaveFlagMap[key] = true;
  }
  /**
   * mangleFileName
   * @param  {} fileName [description]
   * @return {[type]}          [description]
   */
  mangleFileName(fileName) {
    if (!this.config.mangleFileName) {
      return fileName;
    }
    let flagSavedFile = false;
    let tmp = fileName.split(':');
    let remote = null;
    let fname = fileName;
    if (tmp.length === 2) {
      remote = tmp[0];
      fname = tmp[1];
    }
    if (this.fileNameSaveFlagMap[fileName]) {
      flagSavedFile = true;
    }

    fname = this.fileNameMangle.mangle(fname, function (alias) {
      let tmp;
      if (!flagSavedFile) {
        tmp = alias;
      } else {
        if (!/\.\w+$/.test(alias)) {
          tmp = '/' + alias + '.js';
        } else {
          tmp = alias;
        }
        tmp = remote ? remote + ':' + tmp : tmp;
      }
      // console.log('>------>', fileName, fname, '>', alias, '>', tmp, flagSavedFile);
      return tmp;
    });

    return fname;
  }
  /**
   * 兼容老接口， 同 mangleFileName
   */
  getFileShortName(fileName) {
    return this.mangleFileName(fileName);
  }
}

utils.mixin(Cube, EXT_API_PROCESS);
utils.mixin(Cube, EXT_API_TRANSFER);

module.exports = Cube;
