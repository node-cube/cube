/**
 * visitor  proxy
 * 可支持多个处理器叠加，一次遍历完成多个任务，效率更好
 */
const Visitor = require('@swc/core/Visitor').Visitor;
class CubeAstVisitorProxy extends Visitor {
  constructor() {
    this.vs = {};
  }
  registerVisotor(visitor) {
    let vs = this.vs;
    for (let i in visitor) {
      if (/^visit/.test(i) && typeof visitor[i] === 'function') {
        if (!CubeAstVisitorProxy.prototype[i]) {
          // register visitors fn
          CubeAstVisitorProxy.prototype[i] = (node) => {
            let list = vs[i];
            if (!list || list.length === 0) {
              return node;
            }
            for (let i = 0 ; i < list.length; i++) {
              node = list[i](node);
            }
          };
          vs[i] = [];
        }
        vs[i].push(visitor[i].bind(visitor));
      }
    }
  }
}

module.exports = CubeAstVisitorProxy;