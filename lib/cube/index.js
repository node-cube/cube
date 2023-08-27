'use strict';

const path = require('path');
const Events = require('events');
const debug = require('debug')('cube:init');
const Css = require('clean-css');
const Cache = require('./cache');
const utils = require('../utils');
const FileNameMangle = require('../file_name_mangle');
const EXT_API_PROCESS = require('./api_process');
const EXT_API_TRANSFER = require('./api_transform');

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
 * 检查processors配置, 能否加载到，是否有冲突
 * @param  {String|Array} processor
 *             processor_name, processor_abspath,
 *             [processor_name, ...]
 *             [[processor_name, configObj], ...]
 * @param  {String} ext the file extname
 * @return {Object}
 */
function checkProcessor(root, pList, ext) {
  let res = [];
  let type = null;
  let pListTmp = [];
  pList.forEach(function (pcfg) {
    let p;
    let mod = pcfg[0]
    let modCfg = pcfg[1];

    if (typeof mod === 'string' || Array.isArray(mod)) {
      try {
        p = require(mod);
      } catch (e) {
        throw new Error(`[CUBE_ERROR] load processor [${mod}] error: ${e.message}`);
      }
    } else {
      p = mod;
    }
    pListTmp.push((p.name || p.constructor.name) + " type:" + p.type);
    if (!p.type || !p.prototype.process) {
      throw new Error('[CUBE_ERROR] process error， not a vaild processor:' + mod);
    }
    if (type === null) {
      type = p.type;
    } else {
      if (type !== p.type) {
        throw new Error('[CUBE_ERROR] more then one type of process find in `' + ext + '` config, processors:' + pListTmp.join(','));
      }
    }
    res.push([p, modCfg]);
  });
  return {type: type, ext: ext, processors: res};
}

const defaultConfig = {
  moduleMap: {},
  moduleRegistered: {},
  moduleIgnore: {},
  ignores: {
    skip:[],
    ignore: []
  },
  processors: {
    '.jsx, .tsx, .js, .ts, .cjs': require('../processor/js.js'),
    '.json': require('../processor/json.js'),
    '.html, .txt': require('../processor/raw.js'),
    '.css': require('../processor/css.js'),
    '.jpg,.jpeg,.png,.gif,.webp': require('../processor/image.js')
  }
};


class Cube extends Events {
  /**
   * @param {Object} config config object
   *
   *     - rootPath {Path} the project static root file path
   *     - httpPath {String} [optional] the http path for resource, same as resBase
   *     - entry {Array} 入口文件
   *     - release {Bool} release model, default is false
   *     - processors {Array} [optional] set the extenal processors, 配置还可能来自 package.json, 并且package.json中的配置优先级更高
   *     - cache {Boolean} use cache in dev model, default is true
   *     - cacheDir {AbsPath} dev model cache dir, default is ${root}/.cubecache
   *     - mangleFileName {Boolean} build的时候，是否转换文件名
   *     - export {Object} 导出的文件, 需要导出的文件，都需要保留文件名，并且不能被合并
   *     - moduleMap {Object} 映射模块寻址路径，某些模块通过映射到dist/mini,更方便
   *     - forceRequire {Boolean} 是否强制require, 即使require的内容不存在
   *     - log {Object} default is console.log
   */
  constructor(config) {
    super();
    /*!
     * ========================
     * check & prepare config
     * ========================
     */
    if (!config.log) {
      config.log = require('./log');
    }
    config.httpPath = config.httpPath;

    this.config = config;
    this.log = config.log;

    /**
     * remove the last slash(\|/) in config.root
     */
    config.root = config.rootPath.replace(/[\\/]$/, '');
    let root = config.root;

    if (config.release) {
      config.compress = true;
    }
    if (!config.release && config.cache) {
      config.devCache = true;
    }
    /*!
     * ================
     * init properties
     * ================
     */
    config.processors = utils.prepareProcessors(config.processors);
    defaultConfig.processors = utils.prepareProcessors(defaultConfig.processors);
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

    if (config.cache) {
      this.caches = new Cache({
        tmpDir: config.cacheDir || path.join(root, './.cubecache'),
        cleanCache: config.cleanCache
      });
    }
    /**
     * 文件后缀名-类型映射表
     */
    this.extMap = {
      '.js': 'script',
      '.jxs': 'script',
      '.ts': 'script',
      '.tsx': 'script',
      '.css': 'style',
      '.json': 'json',
      '.html': 'text',
      '.txt': 'text',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.png': 'image',
      '.gif': 'image',
      '.webp': 'image'
    };
    /**
     * 类型，文件后缀名映射表
     * type - [ext, txt]
     */
    this.typeMap = {};
    debug('loading default process');
    /**
     * 文件processors映射表
     * {
     *   typeName: {
     *     ext1: pList
     *     ext2: pList
     *   }
     * }
     */
    this.processors = {};
    let self = this;
    /**
     * build config property
     */
    this.ignoreRules = config.ignoreRules || {
      ignore: [],
      skip: []
    };
    /**
     * loading config from package.json -> cube
     */
    let cfg = {};
    let pkgPath;
    try {
      pkgPath = path.join(root, './package.json');
      cfg = require(path.join(root, './package.json')).cube || {};
      if (cfg.processors) {
        cfg.processors = utils.prepareProcessors(cfg.processors);
      }
      if (!cfg || Object.keys(cfg).length <= 0) {
        this.log.info('package.json is not contain cube config， using default config');
      }
    } catch (e) {
      this.log.warn(`read ${pkgPath} failed, ${e.message}`);
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
            target[ext] = prop[ext];
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

    if (config.release) {
      // filename mangle
      let fnMangleOpt = {
        mangleIgnore: {}
      };
      config.entry.forEach((file) => {
        fnMangleOpt.mangleIgnore[file] = true;
      });

      this.fileNameMangle = new FileNameMangle(fnMangleOpt);
      this.fileNameSaveFlagMap = {};

      // css 压缩
      this.cssMinify = new Css({
        inline: ['local'],
        compatibility: 'compatibility',
        noAdvanced: true,
        specialComments: 0,
        rebaseTo: root
      });
    }
    // 文件映射
    Object.keys(config.moduleMap).forEach((key) => {
      if (config.moduleMap[key][0] != '/') {
        config.moduleMap[key] = '/' + config.moduleMap[key];
      }
    });

    // 处理process的加载路径
    utils.fixProcessorConfig(config.processors, root);

    // register processors
    let processors = config.processors;
    Object.keys(processors).forEach(function (ext) {
      let plist = processors[ext];
      self.registerProcessor(ext, plist);
    });
    // prepare TypeMap
    for (let ext in this.extMap) {
      let type = this.extMap[ext];
      if (!this.typeMap[type]) {
        this.typeMap[type] = [];
      }
      this.typeMap[type].push(ext);
    }
    // init transformer
    if (config.transformer == 'swc') {
      this.transformer = require('./transformer_swc')(this);
    } else if (!config.transformer || config.transformer == 'babel') {
      // default using babel
      this.transformer = require('./transformer_babel')(this);
    }
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
   *  registerProcessor('.js', [processors....])
   *
   *  registerProcessor('*', processor);
   *
   * @param {String} ext 后缀名
   * @param {Array} ps processor列表, 可以是 Array<String>, 也可以是 Array<ModuleObject>
   *
   * @example
   *   '.js'  [['cube-es2015', {/* config *\/}], 'cube-react']
   */
  registerProcessor(ext, plist) {
    var processors = this.processors;
    var preparedProcessor = checkProcessor(this.config.root, plist, ext);

    // processor type
    var pType = preparedProcessor.type;

    if (!this.extMap[ext]) {
      this.extMap[ext] = pType;
    }
    if (!processors[ext]) {
      processors[ext] = [];
    }

    var processInstances = [];
    preparedProcessor.processors.forEach(p => {
      // create process instance
      processInstances.push(new p[0](this, p[1] || {}));
    });

    processors[ext] = uniqueProcessors(processors[ext].concat(processInstances));
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
  fixStyleAbsPath(dir, code) {
    var base = this.config.httpPath || '/';
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
    // TODO deal with : @import xxx.css
    var base = this.config.httpPath || '/';
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
      // TODO local file abs path, check image size, if small img, just embed into css file
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
  mangleFileName(fileName, rootMap) {
    if (!this.config.mangleFileName) {
      return fileName;
    }
    // 如果是root节点，则不改变名字
    if (rootMap && rootMap[fileName]) {
      return fileName;
    }
    if (typeof fileName !== 'string') {
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
