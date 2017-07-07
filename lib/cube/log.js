'use strict';

let methods = ['debug', 'info', 'warn', 'error'];

function log(type, args) {
  args = [].slice.call(args);
  args.unshift(type);
  args.unshift('[CUBE]');
  console.log.apply(console, args);
}


methods.forEach( (method) => {
  exports[method] = function () {
    log('[' + method.toUpperCase() + ']', arguments);
  };
});