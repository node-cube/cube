/*!
 * cube: index.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var utils = require('./lib/utils');
var wraper = require('./lib/wraper');
var path = require('path');
var debug;

try {
  debug = require('./debug.json');
} catch (e) {
  // ignore error
}

function debugRegister(cube, module) {
  if (!debug) {
    return;
  }
  console.log('load debug processor', module);
  try {
    cube.register(module);
  } catch (e) {
    // do nothing
  }
}

function loadDefaultProcessor(cube) {
  cube.register(path.join(__dirname, './lib/processor_js'));
  cube.register(path.join(__dirname, './lib/processor_css'));
  cube.register(path.join(__dirname, './lib/processor_html'));
  /*
  debugRegister(cube, 'cube-ejs');
  debugRegister(cube, 'cube-jade');
  debugRegister(cube, 'cube-less');
  debugRegister(cube, 'cube-stylus');
  debugRegister(cube, 'cube-coffee');
  debugRegister(cube, 'cube-react');
  */
}
/**
 * [Cube description]
 * @param {Object} config
 *        - root {Path}
 *        - port {String} [optional] server port
 *        - router {String} [optional] set the app.use(`$router`, cube_middleware)
 *        - release {Boolean} if build project, set true
 *        - processors {Array} [optional] set the extenal processors
 *        - resBase {String} [optional] the http base for resource
 *        - devCache {Boolean} default true
 *        - withDist {Boolean} switch if search module dist dir
 *
 */
function Cube(config) {
  // remove the last slash(\|/) in config.root
  config.root = config.root.replace(/[\\\/]$/, '');
  /**
   * processor mapping
   * @type {Object}
   *       {
   *         // from ext to type
   *         map: {
   *           '.js': 'script'
   *         },
   *         types: {
   *           script: {
   *             '.js': 'js_processor',
   *             '.coffee': 'js_processor'
   *           },
   *           style: {
   *             '.css': 'css_processor',
   *             '.less': 'less_processor'
   *           },
   *           template: {
   *             '.jade': 'tpl_processor',
   *             '.ejs': 'tpl_processor'
   *           }
   *         }
   *       }
   */
  if (config.compress === undefined) {
    config.compress = false;
  }
  if (config.devCache === undefined) {
    config.devCache = true;
  }
  if (!config.router) {
    config.router = '/';
  }

  this.config = config;

  this.processors = {
    map: {
      // sufix: type
    },
    types: {
      script: {},
      style: {},
      template: {}
    }
  };
  this.mimeType = {
    'script': 'application/javascript',
    'style': 'text/css',
    'template': 'text/html'
  };

  loadDefaultProcessor(this);
  var self = this;
  if (config.processors) {
    config.processors.forEach(function (processor) {
      if (!processor) {
        return ;
      }
      self.register(processor);
    });
  }
  // load ignore
  this.ignoresRules = utils.loadIgnore(config.root);

  // loading configs from package.json:cube
  var root = config.root;
  var pkg;
  try {
    pkg = require(path.join(root, './package.json'));
    console.log('[INFO] loaded static_dir\'s package.json');
  } catch (e) {
    console.log('[WARN] loading static_dir\'s package.json failed');
  }
  if (pkg) {
    var anotherCfg = pkg.cube;
    Object.keys(anotherCfg).forEach(function (key) {
      var cfg = anotherCfg[key];
      switch (key) {
        case 'processors':
          Object.keys(cfg).forEach(function (p) {
            self.register(cfg[p], p);
          });
          break;
        case 'build':
          cfg.skip.forEach(function (v) {
            if (!v) {
              return ;
            }
            self.ignoresRules.skip.push(utils.genRule(v));
          });
          cfg.ignore.forEach(function (v) {
            if (!v) {
              return ;
            }
            self.ignoresRules.ignore.push(utils.genRule(v));
          });
          break;
        default:
          console.log('override cube config:' + key);
          config[key] = anotherCfg[key];
      }
    });
  }
}
/**
 *
 * @param  {Object} config
 *         - port       listen port [optional]
 *         - connect    the connect object
 *         - root       static root
 *         - middleware  boolean, default false
 *         - processors {Array} extenal processors
 *         - cached     the cached path
 *         - builded    {Boolean} if root path is builded code
 *
 */
Cube.init = function (config) {
  var cube = new Cube(config);
  var service = require('./service');
  service.init(cube);
  if (config.middleware) {
    return cube.middleware;
  }
  return cube;
};

Cube.getTool = function () {
  return require('./tools');
};

Cube.prototype.getType = function (fpath) {
  var ext = fpath.match(/\.\w+$/);
  if (!ext) {
    return null;
  }
  ext = ext[0];
  return this.processors.map[ext];
};

Cube.prototype.checkIgnore = function (absPath) {
  // console.log(absPath.substr(this.config.root.length), this.ignoresRules);
  var res = utils.checkIgnore(absPath.substr(this.config.root.length), this.ignoresRules);
  // console.log(res);
  return res.ignore;
};

/**
 * register a processor for cube
 * @param  {String|Object} mod   mod can be a string(module path) or an mod object
 *     a module shoud contain {
 *       ext: {String|Array}
 *       type: {String}
 *       process: {Function}
 *     }
 * @param {String} ext the regist extension name
 */
Cube.prototype.register = function (mod, ext) {
  var processors = this.processors;
  var type;
  var customProcessors;
  try {
    customProcessors = prepareProcessor(this.config.root, mod, ext);
  } catch (e) {
    return console.error(e.message);
  }
  type = customProcessors.type;
  ext = ext || customProcessors.ext;
  /*
  type = Processor.type || (Processor.info ? Processor.info.type : '');
  if (!ext) {
    ext = Processor.ext || (Processor.info ? Processor.info.ext : '');
  }
  */
  var types = processors.types[type];
  if (!types) {
    types = processors.types[type] = {};
  }
  if (!processors.map[ext]) {
    processors.map[ext] = type;
  }
  var origin = types[ext];
  if (origin) {
    console.log('[WARN] ' + ext + ' already register:' + getProcessNames(origin));
    console.log('[WARN] ' + ext + ' now register:' + getProcessNames(customProcessors.processors));
  }
  var processInstances = [];
  var self = this;
  customProcessors.processors.forEach(function (p) {
    processInstances.push(new p(self));
  });
  types[ext] = processInstances;
};

function getProcessNames(processor) {
  var res = [];
  if (Array.isArray(processor)) {
    processor.forEach(function (p) {
      res.push(p.name);
    });
  } else {
    res.push(processor.name);
  }
  return res.join('|');
}
/**
 * [prepareProcessor description]
 * @param  {String|Array} processor
 * @param  {String} ext the file extname
 * @return {[type]}           [description]
 */
function prepareProcessor(root, processor, ext) {
  var res = [];
  if (!Array.isArray(processor)) {
    processor = [processor];
  }
  var type = null;
  var processorList = [];
  var typeList = [];
  utils.fixProcessorPath(root, processor);
  processor.forEach(function (mod) {
    var p;
    if (!mod) {
      return;
    }
    if (typeof mod === 'string') {
      try {
        p = require(mod);
      } catch (e) {
        throw new Error('[CUBE_ERROR] load processor error:' + e.message);
      }
    } else {
      p = mod;
    }
    if (!ext) {
      ext = p.ext;
    }
    processorList.push(p.name);
    if (!p.type || !p.ext || !p.prototype.process) {
      throw new Error('[CUBE_ERROR] process error');
    }
    if (type === null) {
      type = p.type;
    } else {
      if (type !== p.type) {
        throw new Error('[CUBE_ERROR] more then one type of process find in `' + ext + '` config, processors:' + processorList.join(',') + ' types:' + typeList.join(','));
      }
    }
    typeList.push(type);
    res.push(p);
  });
  return {type: type, ext: ext, processors: res};
}

Cube.prototype.getMIMEType = function (type) {
  var defaultMime = 'text/plain';
  return this.mimeType[type] || defaultMime;
};

var fileNameMaps = {};
var count = 65;
var prefix = [];

function genName() {
  //65 ~ 90  A-Z
  //97 ~ 122 a-z
  var lastPrefixIndex = prefix.length ? prefix.length - 1 : 0;
  var lastPrefix = prefix[lastPrefixIndex];
  if (count === 91) {
    count = 97;
  } else if (count === 123) {
    count = 65;
    if (!lastPrefix) {
      lastPrefix = 65;
    } else {
      lastPrefix += 1;
    }
    if (lastPrefix === 91) {
      lastPrefix = 97;
    }  else if (lastPrefix === 123) {
      lastPrefix -= 1;
      prefix.push(65);
    }
    prefix[lastPrefixIndex] = lastPrefix;
  }
  var value = '';
  prefix.forEach(function (v) {
    if (v) {
      value += String.fromCharCode(v);
    }
  });
  value += String.fromCharCode(count);
  count ++;
  return value;
}

Cube.prototype.getFileShortName = function (fileName) {
  if (fileNameMaps[fileName]) {
    return fileNameMaps[fileName];
  }
  var alias = genName();
  fileNameMaps[fileName] = alias;
  return alias;
};

/** 修订css文件中的资源文件中的路径 **/
Cube.prototype.fixupResPath = function (dir, code) {
  var base = this.config.resBase || '';
  return code.replace(/url\( *([\'\"]*)([^\'\"\)]+)\1 *\)/ig, function (m0, m1, m2) {
    if (!m2) {
      return m0; // url() content is empty, do nothing
    }
    m2 = m2.trim();
    if (m2.indexOf('data:') === 0) { // url() is a base64 coded resource, ignore
      return m0;
    }
    if (m2.indexOf('/') === 0 || /https?:\/\//.test(m2)) {
      return m0.replace(/\"|\'/g, ''); // url() is pointer to a abs path resource
    }
    var tmp = path.join(base, dir, m2);
    return 'url(' + tmp.replace(/\\/g, '/') + ')';
  });
};

Cube.prototype.processJsCode = function (data, callback) {
  data.queryPath = data.file;
  data.realPath = data.file;
  data = wraper.processScript(this, data);
  wraper.wrapScript(this, data, callback);
};


module.exports = Cube;

