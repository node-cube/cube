const swc = require('@swc/core');
const _ = require('lodash');

let swcOptions = {
  jsc: {
    transform: {},
    parser: {
      syntax: /^\.tsx?$/.test(data.ext) ? 'typescript' : 'ecmascript',
      jsx: true,
      dynamicImport: false,
      sourceType: 'module',
      preserveAllComments: true
    },
    target: 'es2020',
    loose: false
  },
  filename: filepath,
  isModule: true,
  minify: false,
  module: {
    type: 'commonjs',
    strict: false,
    strictMode: false,
    lazy: false,
    noInterop: false
  }
};
module.exports = function (cube) {
  var opt = _.merge({}, swcOptions, cube.config.swc);
  opt.jsc.plugin.push([require('./transformer_swc_plugin'), {}]);
  opt.jsc.plugins.forEach((plugin, i, a) => {
    if (!Array.isArray(plugin)) {
      a[i] = plugin = [plugin, {}];
    }
    if (!plugin[1]) {
      plugin[1] = {};
    }
  });
  return {
    transform(data, callback) {
      let optTmp = _.clone(opt);
      optTmp.jsc.parser.syntax = /^\.tsx?$/.test(data.ext) ? 'typescript' : 'ecmascript';
      optTmp.jsc.plugins = _.cloneDeep(opt.jsc.plugins);
      /**
       * 插件通过  swc.jsc.plugins来配置, [module, config]
       * 注意 config中会注入 cube、data
       * ast的遍历需要自己实现
       * plugin的写法，参考 google bard提问 
       */
      optTmp.jsc.plugins.forEach((plugin) => {
        plugin[1].data = data;
        plugin[1].cube = cube;
      });
      swc.transform(data.code, opt).optTmp((out) => {
        // resolve module path 执行之前，不得修改 queryPath, 所以移动到最后变换
        // data.queryPath = utils.moduleName(data.queryPath, data.type, config.release, config.remote);
        data.requires = unique(data.requires);
        data.requiresOrigin = unique(data.requiresOrigin);
        debug('module path resolved file require list', data.queryPath, data.requires);
        data.code = out.code;
        callback(null, data);
      }).catch((e) => {
        e.code = 'Js_Parse_Error';
        e.file = filepath;
        e.line = e.lineNumber;
        console.log(`Cube transform file "${data.queryPath} error,`, e);
        return callback(e);
      });
    }
  }
};