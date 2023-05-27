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
 *     - root       {Path} static root
 *     - base       {Path} http prefix
 *     - processors {Array} extenal processors
 *     - cached     {Path} the cached path
 *
 * @return {cube}
 */
Cube.middleware = function (cube, config) {
  let middleware = require('./lib/cube_server').middleware;
  return middleware(cube);
};
/**
 * 初始化一个服务
 * @param  {Object} config config object
 *     - port       listen port [optional]
 *     - connect    the connect object
 *     - root       {Path} static root
 *     - base       {Path} http prefix
 *     - processors {Array} extenal processors
 *     - cached     {Path} the cached path
 * @param {Object}
 * @return {cube}
 */
Cube.service = Cube.server = function (cube, servOpt) {
  let server = require('./lib/cube_server').server;
  server(cube, servOpt);
  return cube;
};
/**
 * 获取工具包
 */
Cube.tools = require('./tools');

module.exports = Cube;
