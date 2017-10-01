/*!
 * cube: index.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
'use strict';
const Cube = require('./lib/cube');
/**
 * 初始化一个middleware
 * @param  {Object} config config object
 *
 *     - port       listen port [optional]
 *     - connect    the connect object
 *     - root       {Path} static root
 *     - processors {Array} extenal processors
 *     - cached     {Path} the cached path
 *     - built      {Boolean} if root path is built code
 *
 * @return {cube}
 */
Cube.middleware = function (cube, config) {
  if (config === undefined) {
    config = cube;
    cube = new Cube(config);
  }
  config.middleware = true;
  let service = require('./service');
  service.init(cube);
  return cube.middleware;
};
/**
 * 启动一个cube服务
 * @param  {Object} config config object
 * @return {Cube}  cube
 */
Cube.service = function (config) {
  let cube = new Cube(config);
  let service = require('./service');
  service.init(cube);
  return cube;
};
/**
 * 获取工具包
 */
Cube.tools = require('./tools');

module.exports = Cube;
