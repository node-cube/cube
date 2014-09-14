/*!
 * cube: index.js
 * Authors  : fish (https://github.com/fishbar)
 * Create   : 2014-04-18 15:32:20
 * CopyRight 2014 (c) Fish And Other Contributors
 */
var G = require('./global');
var T = require('./tools');
var S = require('./service');
var utils = require('./lib/utils');


G.bind('script', '.js', './lib/js_processor');
G.bind('script', '.coffee', './lib/js_processor');
G.bind('template', '.ejs', './lib/tpl_processor');
G.bind('template', '.jade', './lib/tpl_processor');
G.bind('template', '.html', './lib/html_processor');
G.bind('style', '.css', './lib/css_processor');
G.bind('style', '.less', './lib/less_processor');
G.bind('style', '.styl', './lib/styl_processor');

utils.merge(exports, G);
utils.merge(exports, T);
utils.merge(exports, S);
