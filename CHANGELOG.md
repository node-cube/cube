v1.0.1
  * .cubeignre support ignore patten in dev model

v0.1.0
  * support custom processor now
  * support `require('css', ns);`
  * support multi cube instance
  * build-in support only: html/css/js/coffee,
  * processors: jade、ejs、less、stylus have been moved to independent modules
  * ignore build-in-module(node_modules/xxx) not found error, let browser throw error


v0.0.18
  * cube build support `-i` option, for set up build-in module ignore
  * fix css inject when namespace is undefined
  * fix jsprocessor build-in ignore bug
  * update readme

v0.0.17
  * add version num to cube.js
  * simplify cube_css.js
  * support node_modules with namespace, like @ali/test

v0.0.16
  * update seek file rule, simplify rules

v0.0.15
  * rebuild code, support plugin the Cube

v0.0.12
  * process static inside cube

v0.0.10
  * trim() path tail /, both server-side and client-side

v0.0.9
  * fix filename with dot bug
  * fix cube.js base missing
  * update readme

v0.0.7
  * fix css process bug

v0.0.6
  * fix require module in node_modules

v0.0.2
  * basic function ok