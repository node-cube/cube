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
var processors = {
  map: {
    '.js': 'script',
    '.css': 'style'
  },
  types: {
    script: {},
    style: {}
  }
};

var buildInModule = {
  ejs_runtime: true,
  jade_runtime: true
};

var mimeType = {
  'script': 'application/javascript',
  'style': 'text/css'
};

function bind(type, ext, processor, force) {
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
  types[ext] = processor;
}

exports.processors = processors;
exports.bind = bind;
exports.buildInModule = buildInModule;
exports.mimeType = mimeType;
exports.setBuildInModule = function (obj) {
  Object.keys(obj).forEach(function (key) {
    buildInModule[key] = true;
  });
};
