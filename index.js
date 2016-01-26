/*!
 * cube: index.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var utils = require('./lib/utils');
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
  console.error('load debug processor', module);
  try {
    cube.register(module);
  } catch (e) {
    // do nothing
  }
}

function defaultProcessor(cube) {
  cube.register(path.join(__dirname, './lib/processor_js'));
  // cube.register(path.join(__dirname, './lib/processor_coffee'));
  cube.register(path.join(__dirname, './lib/processor_css'));
  cube.register(path.join(__dirname, './lib/processor_html'));

  debugRegister(cube, 'cube-ejs');
  debugRegister(cube, 'cube-jade');
  debugRegister(cube, 'cube-less');
  debugRegister(cube, 'cube-stylus');
  debugRegister(cube, 'cube-coffee');
  debugRegister(cube, '../cube-jsx');
}
/**
 * [Cube description]
 * @param {Object} config
 *        - root {Path}
 *        - port {String} [optional] server port
 *        - router {String} [optional] server router match
 *        - release {Boolean} if build project, set true
 *        - processors {Array} [optional] set the extenal processors
 *        - resBase {String} [optional] the http base for resource
 *        - scope {String} [optional] set the module scope, like '@ali' [X]
 *        - devCache {Boolean} default true
 *        - withDist {Boolean} switch if search module dist dir
 *
 */
function Cube(config) {
  // remove the last slash(\|/) in config.root
  config.root = config.root.replace(/[\\\/]$/, '');
  if (config.devCache === undefined) {
    config.devCache = true;
  }
  this.config = config;
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
  if (this.config.compress === undefined) {
    this.config.compress;
  }
  this.processors = {
    map: {
      '.js': 'script',
      '.css': 'style'
    },
    types: {
      script: {},
      style: {}
    }
  };
  this.mimeType = {
    'script': 'application/javascript',
    'style': 'text/css',
    'template': 'text/html'
  };

  defaultProcessor(this);
  var self = this;
  if (config.processors) {
    config.processors.forEach(function (processor) {
      if (!processor) {
        return ;
      }
      self.register(processor, true);
    });
  }

  // load ignore
  this.ignoresRules = utils.loadIgnore(config.root);

  this.globalInfo = {
    requires: [],
    resources: []
  };
}
/**
 *
 * @param  {Object} config
 *         - port       listen port [optional]
 *         - connect    the connect object
 *         - root       static root
 *         - router     http path
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
 * @param  {Boolean} force       set force will override the origin register
 */
Cube.prototype.register = function (mod, force) {
  var processors = this.processors;
  var type, ext;
  var Processor;
  try {
    if (typeof mod === 'string') {
      Processor = require(mod);
    } else {
      Processor = mod;
    }
  } catch (e) {
    console.error('[CUBE_ERRROR]load processor error', mod, e);
    return;
  }
  if (Processor.info) {
    type = Processor.info.type;
    ext = Processor.info.ext;
  } else {
    type = Processor.type;
    ext = Processor.ext;
  }
  if (!type || !ext || !Processor.prototype.process) {
    return console.error('[CUBE_ERRROR] processor error, en processor should contain properties `name`, `type`, `ext`, `process`');
  }
  var types = processors.types[type];
  if (!types) {
    // register new type
    types = processors.types[type] = {};
  }
  if (!Array.isArray(ext)) {
    ext = [ext];
  }

  var self = this;
  ext.forEach(function (extName) {
    if (!processors.map[extName]) {
      processors.map[extName] = type;
    }
    var origin = types[extName];
    if (origin && !force) {
      var err = new Error('the ext `' + extName + '` is already binded, you should pass `force` param to override it!');
      err.code = 'CUBE_BIND_TRANSFER_ERROR';
      throw err;
    }
    types[extName] = new Processor(self);
  });
};

Cube.prototype.getMIMEType = function (type) {
  var defaultMime = 'text/plain';
  return this.mimeType[type] || defaultMime;
};

/*
Cube.prototype.wrapScript = function (qpath, code) {

};
*/

Cube.prototype.wrapStyle = function (qpath, code) {
  var options = this.config;
  return 'Cube("' + utils.moduleName(qpath, 'style', options.release, options.remote) + '", [], function(m){m.exports=' + JSON.stringify(code) + ';return m.exports});';
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

Cube.prototype.wrapTemplate = function (qpath, code, require, literal) {
  var options = this.config;
  require = require ? require : [];
  literal = literal === 'string' ? true : false;
  if (literal) {
    code = 'module.exports=function(){return ' + JSON.stringify(code) + '};';
  }
  return 'Cube("' + utils.moduleName(qpath, 'template', options.release, options.remote) +
    '",' + JSON.stringify(require) + ',function(module,exports,require){' + code + '; return module.exports});';
};

Cube.prototype.processJsCode = function (filepath, code, options, callback) {
  var jsp = this.processors.types.script['.js'];
  jsp.processCode(filepath, code, options, callback);
};


module.exports = Cube;

