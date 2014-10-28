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
} catch (e) {}

function debugRegister(cube, module) {
  if (!debug) {
    return;
  }
  console.error('load debug processor', module);
  cube.register(module);
}

function defaultProcessor(cube) {
  cube.register(path.join(__dirname, './lib/processor_js'));
  cube.register(path.join(__dirname, './lib/processor_coffee'));
  cube.register(path.join(__dirname, './lib/processor_css'));
  cube.register(path.join(__dirname, './lib/processor_html'));

  debugRegister(cube, path.join(__dirname, '../cube-ejs'));
  debugRegister(cube, path.join(__dirname, '../cube-jade'));
  debugRegister(cube, path.join(__dirname, '../cube-less'));
  debugRegister(cube, path.join(__dirname, '../cube-stylus'));
}

/**
 * [Cube description]
 * @param {Object} config
 *        - root {Path}
 *        - port {String} [optional] server port
 *        - router {String} [optional] server router match
 *        - release {Boolean} if build project, set true
 *        - processors {Array} [optional]
 *
 */
function Cube(config) {
  config.root = config.root.replace(/[\\\/]$/, '');
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
        return
      }
      self.register(processor, true);
    });
  }
}
/**
 *
 * @param  {Object} config
 *         - port       listen port [optional]
 *         - connect    the connect object
 *         - root       static root
 *         - router     http path
 *         - middleware  boolean, default false
 *         - processors {type, ext, processor, forceOverride}
 */
Cube.init = function (config) {
  var cube = new Cube(config);
  var service = require('./service');
  service.init(cube, config);
  if (config.middleware) {
    return cube.middleware;
  }
  return cube;
};

Cube.getTool = function () {
  return require('./tools');
};

/**
 * register a processor for cube
 * @param  {String|Object} mod   mod can be a string(module path) or an mod object
 * @param  {Boolean} force       set force will override the origin register
 */
Cube.prototype.register = function (mod, force) {
  var processors = this.processors;
  var info, type, ext;
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
  info = Processor.info;
  if (typeof info !== 'object') {
    return console.error('[CUBE_ERRROR] processor formatter error, no info found', mod);
  }
  type = info.type;
  ext = info.ext;
  if (!type || !ext) {
    return console.error('[CUBE_ERRROR] formatter error, no info found', mod);
  }
  var types = processors.types[type];
  if (!types) {
    types = processors.types[type] = {};
  }
  if (!processors.map[ext]) {
    processors.map[ext] = type;
  }
  var origin = types[ext];
  if (origin && !force) {
    var err = new Error('the ext `' + ext + '` is already binded, you should pass `force` param to override it!');
    err.code = 'CUBE_BIND_TRANSFER_ERROR';
    throw err;
  }
  types[ext] = new Processor(this);
};

Cube.prototype.getMIMEType = function (type) {
  var defaultMime = 'text/plain';
  return this.mimeType[type] || defaultMime;
};

Cube.prototype.wrapScript = function (qpath, code, require) {

};

Cube.prototype.wrapStyle = function (qpath, code) {
  var options = this.config;
  return 'Cube("' + utils.moduleName(qpath, 'style', options.release) + '", [], function(m){m.exports=' + JSON.stringify(code) + ';return m.exports});';
};
Cube.prototype.wrapTemplate = function (qpath, code, require, literal) {
  var options = this.config;
  require = require ? require : [];
  literal = literal === 'string' ? true : false;
  if (literal) {
    code = 'module.exports=function(){return ' + JSON.stringify(code) + '};';
  }
  return 'Cube("' + utils.moduleName(qpath, 'template', options.release) +
    '",' + JSON.stringify(require) + ',function(module,exports,require){' + code +'; return module.exports});';
};


module.exports = Cube;

