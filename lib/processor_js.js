/*!
 * cube: lib/js_processor.js
 * support buth js and coffee
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
'use strict';
var debug = require('debug')('cube:processor:js');

/**
 * Class JsProcessor
 * @param {Object}   cube     the cube instance
 */
function JsProcessor(cube) {
  this.cube = cube;
}

JsProcessor.type = 'script';
JsProcessor.ext = '.js';
JsProcessor.requires = {};

JsProcessor.prototype = {
  /**
   * process js file
   * @param {Object} data the process data
   *                    - queryPath
   *                    - realPath
   *                    - code
   * @param  {Function} callback({err, data:{source, code, sourceMap}})
   */
  process: function (data, callback) {
    debug('JsProcessor', data.queryPath);
    callback(null, data);
  }
};

module.exports = JsProcessor;
