const _ = require('lodash');
const babel = require('@babel/core');
const path = require('path');
const debug = require('debug')('transformer_babel');

// 默认配置
const babelOption = {
  ast: false,
  minified: false,
  comments: true,
  sourceType: 'module',
  presets: [
    ["@babel/preset-env", {
      "targets": {
        "browsers": ["last 3 versions"]
      },
      "useBuiltIns": "usage",
      "corejs": 3,
      "modules": "cjs",
    }]
  ],
  plugins: [
    "@babel/plugin-transform-runtime"
  ]
};

function customMerge(objValue, srcValue) {
  if (_.isArray(objValue)) {
    return srcValue; // 直接覆盖数组
  }
}

module.exports = function (cube) {
  let opt = _.mergeWith({}, babelOption, cube.config.babel, customMerge);
  opt.plugins.push([require('./transformer_babel_plugin'), {}]);
  let workspaceNodeModulesRoot = path.join(cube.config.root, 'node_modules');
  opt.presets && opt.presets.forEach((preset, i, a) => {
    if (!Array.isArray(preset)) {
      a[i] = preset = [preset, {}];
    }
    if (!preset[1]) {
      preset[1] = {};
    }
    let mod =  preset[0];
    if (typeof mod === 'string' && /^(\w|\@)/.test(mod)) {
      try {
        mod = require.resolve(mod, {paths: [workspaceNodeModulesRoot]});
      } catch (e) {
        if (e.code == 'MODULE_NOT_FOUND') {
          let err = new Error(`can not find module "${mod}", Please add missing module to devDependencies to ${cube.config.root}/package.json`);
          err.stack = null;
          throw err;
        } else {
          throw e;
        }
      }
      preset[0] = mod;
    }
  })
  /**
   * 插件通过  babel.plugins来配置, [module, config]
   * 注意 config中会注入 cube、data
   * ast的遍历需要自己实现
   * plugin的写法，参考 google bard提问 
   */
  opt.plugins.forEach((plugin, i, a) => {
    if (!Array.isArray(plugin)) {
      a[i] = plugin = [plugin, {}];
    }
    if (!plugin[1]) {
      plugin[1] = {};
    }
    let mod =  plugin[0];
    if (typeof mod === 'string' && /^(\w|\@)/.test(mod)) {
      try {
        mod = require.resolve(mod, {paths: [workspaceNodeModulesRoot]});
      } catch (e) {
        if (e.code == 'MODULE_NOT_FOUND') {
          let err = new Error(`can not find module "${mod}", Please add missing module to devDependencies to ${cube.config.root}/package.json`);
          err.stack = null;
          throw err;
        } else {
          throw e;
        }
      }
      plugin[0] = mod;
    }
  });
  return {
    transform (data, callback) {
      let optTmp = _.clone(opt);
      optTmp.plugins = _.cloneDeep(opt.plugins);
      /**
       * 注入 
       */
      optTmp.plugins.forEach((plugin) => {
        plugin[1].data = data;
        plugin[1].cube = cube;
      });

      babel.transform(data.code, optTmp, (e, out) => {
        if (e) {
          e.code = 'Js_Parse_Error';
          e.file = data.queryPath;
          e.line = e.lineNumber;
          console.log(`Cube transform file "${data.queryPath} error,`, e);
          return callback(e);
        }
        debug('module path resolved file require list', data.queryPath, data.requires);
        data.code = out.code;
        callback(null, data);
      });
    }
  };
}