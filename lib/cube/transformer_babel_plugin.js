const utils = require('../utils');
const genAst = require('./gen_ast_babel');

function unique(arr) {
  var map = {};
  arr.forEach(function (v) {
    map[v] = true;
  });
  return Object.keys(map);
}


module.exports = function CubeTransformImportPlugin(babel, options) {
  const { types: t } = babel;
  let data = options.data;
  let cube = options.cube;
  let requires = [];
  let requiresOrigin = [];
  // 异步加载
  let asyncs = [];
  let asyncsOrigin = [];
  // error
  let errors = [];
  function setRequire(reqName) {
    requires.push(reqName);
  }
  function setAsync(reqName) {
    asyncs.push(reqName);
  }
  function moduleName(modName) {
    return utils.moduleName(modName, data.type, cube.config.release, cube.config.remote);
  }
  function processRequireArgs(calleeName, arg0) {
    if (arg0.type !== 'StringLiteral' && arg0.type !== 'TemplateLiteral') {
      return;
    }
    let modName = arg0.quasis ? arg0.quasis[0].value : arg0.value;
    /**
     * 如果
     *   requre参数不存在 ||
     *   require的不是一个模块的字符串名字（可能是个变量）||
     *   require了一个空字符串
     * 则忽略
     */
    if (!modName || !modName.trim()) {
      errors.push('empty require');
      return;
    }

    if(cube.config.moduleIgnore[modName]) {
      errors.push('ignored require');
      return;
    }

    let flagMap;
    let modNameOrign;
    // 处理 moduleMap 映射
    if (cube.config.moduleMap && cube.config.moduleMap[modName]) {
      modNameOrign = modName;
      modName = cube.config.moduleMap[modName];
      if (modName[0] === '/') {
        modName = modNameOrign + modName;
      }
      flagMap = true;
    }
    let res = cube.resolveModulePath(data, modName);
    if (res.error && !cube.config.moduleRegistered[modName]) {
      res.error = `Cube process module "${data.queryPath}" error, ` + res.error;
      // 没找到、或者被ignore了
      errors.push(res.error);
      return false;
    }
    modName = res.modName;
    if (calleeName == 'require') {
      setRequire(modName);
    } else if (calleeName == 'async') {
      setAsync(modName);
    }

    if (arg0.type === 'StringLiteral') {
      arg0.value = modName;
    } else if (arg0.expression.type === 'TemplateLiteral') {
      arg0.expression.quasis[0].cooked = modName;
      arg0.expression.quasis[0].raw = modName;
    }
  }

  let visitor = {
    /**
     * async('abc', (mod) => {mod.run()})
     * require('abc')
     *
     * 注意，所有的 import 都会先被转换成 require，然后来过这个visit
     * 所以在import指令处，并不会去检查require的模块是否存在，都在这个
     * 函数中处理
     */
    CallExpression(path) {
      let node = path.node;
      let callFuncName = node.callee.name;
      // filter other calls
      if (callFuncName !== 'require' && callFuncName !== 'async') {
        return;
      }
      if (!node.arguments.length) {
        return;
      }
      // examples:
      //   require('abc.css', '.ns')
      //   async('abc.css', '.ns', ()=>{})
      let argc = node.arguments.length;
      if (
        (callFuncName == "require" && argc > 2) || 
        (callFuncName == "async" && argc > 3)
      ) {
        return;
      } 
      let arg0 = node.arguments[0];
      let ok = processRequireArgs(callFuncName, arg0);
    },
    /**
     * import ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import
     * 
     * import defaultExport from "module-name";
     * import * as name from "module-name";
     * import { export1 } from "module-name";
     * import { export1 as alias1 } from "module-name";
     * import { default as alias } from "module-name";
     * import { export1, export2 } from "module-name";
     * import { export1, export2 as alias2, /* … * } from "module-name";
     * import { "string name" as alias } from "module-name";
     * import defaultExport, { export1, /* … * } from "module-name";
     * import defaultExport, * as name from "module-name";
     * import "module-name"; 
     */
    ImportDeclaration(path) {
      let node = path.node;
      let requireFile = node.source.value;
      let varList = [];
      let localVar, ctxt, importedVar, importedType;
      node.specifiers.forEach((specNode) => {
        switch (specNode.type) {
          case 'ImportDefaultSpecifier':
            // import defaultExport from "module-name";
            localVar = specNode.local.name;
            // equals: const $localVar = require(requireFile).__default;
            varList.push({
              local: localVar,
              export: genAst.ID_EXPORT_DEFAULT,
            });
            break;
          case 'ImportNamespaceSpecifier':
            // import * as name from "module-name";
            localVar = specNode.local.name;
            // equals: const $localVar = require(requireFile);
            varList.push({
              local: localVar,
            });
            break;
          case 'ImportSpecifier':
            localVar = specNode.local.name;
            if (specNode.imported === null) {
              // import {a} from 'abc'
              // equals: const $localVar = require(requireFile).$localVar;
              varList.push({
                local: localVar,
                export: localVar,
              });
            } else {
              importedVar = specNode.imported.name;
              if (importedVar == 'default') {
                importedVar = genAst.ID_EXPORT_DEFAULT;
              }
              // import {a as b} from 'abc'
              // equals: const $localVar = require(requireFile).$importedVar;
              varList.push({
                local: localVar,
                export: importedVar
              });
            }
            break;
          default:
            console.log('unknow import declaration specifier node type', spec)
        }
      });
      let newNode;
      if (varList.length) {
        // var {a,b,c} = require('mod')
        newNode = genAst.genSimpleRequire(varList, requireFile);
      } else {
        // require('mod')
        newNode = genAst.genRequireCallStmt(requireFile);
      }
      path.replaceWith(newNode);
      // path.traverse(visitor);
    },
    /**
     * export abc
     * ref: https://developer.mozilla.org/en-US/docs/web/javascript/reference/statements/export
     *
     * -- Exporting declarations
     * export let name1, name2;  // also var
     * export const name1 = 1, name2 = 2; // also var, let
     * export function functionName() {}
     * export class ClassName {}
     * export function* generatorFunctionName() {}
     * export const { name1, name2: bar } = o;
     * export const [ name1, name2 ] = array;
     * 
     */
    ExportDeclaration(path) {
      let node = path.node;
      let varList = [];
      switch(node.declaration.type) {
      case 'VariableDeclaration':
        // Exporting declarations
        node.declaration.declarations.forEach((declNode)=> {
          if (declNode.id.type == 'Identifier') {
            varList.push({
              varName: declNode.id,
              varValue: declNode.init
            });
          } else if (declNode.id.type == 'ObjectPattern') {
            // exports.abc=d.abc
            declNode.id.properties.forEach((pNode) => {
              if (pNode.type == 'AssignmentPatternProperty') {
                // export const {name} = o
                varList.push({
                  varName: pNode.key,
                  varValue: declNode.init,
                  varProperty: pNode.key.value
                });
              } else if (pNode.type == 'KeyValuePatternProperty'){
                // export const {name:alias} = o
                varList.push({
                  varName: pNode.value,
                  varValue: declNode.init,
                  varProperty: pNode.key.value
                });
              }
            });
          }
        });
        break;
      case 'FunctionDeclaration':
        node.declaration.type = 'FunctionExpression';
        varList.push({
          varName: node.declaration.identifier,
          varValue: node.declaration
        });
        break;
      case 'ClassDeclaration':
        node.declaration.type = 'ClassExpression';
        varList.push({
          varName: node.declaration.identifier,
          varValue: node.declaration
        });
        break;
      }
      return genAst.genExportStmt(varList);
    },
    /**
     * export default decl
     * -- Default exports
     * 
     * export default function functionName() {}
     * export default class ClassName {}
     * export default function* generatorFunctionName() {}
     * export default function () {}
     * export default class {}
     * export default function* () {}
     */
    ExportDefaultDeclaration(path) {
      let node = path.node;
      let ast = genAst.genExportDefaultStmt(node.declaration);
      if (ast.length == 2) {
        path.insertAfter(ast[1]);
        path.replaceWith(ast[0]);
      } else {
        path.replaceWith(ast);
      }
      // path.traverse(visitor);
    },
    /**
     * export {a,b,c}
     * ref: https://developer.mozilla.org/en-US/docs/web/javascript/reference/statements/export
     *
     * -- Export list
     * export { name1, nameN };
     * export { variable1 as name1, variable2 as name2, nameN };
     * export { variable1 as "string name" };
     * export { name1 as default, nameN };
     * 
     * * -- Aggregating modules
     * export { name1, nameN } from "module-name";
     * export { import1 as name1, import2 as name2, nameN } from "module-name";
     * export { default, nameN } from "module-name";
     * 
     */
    ExportNamedDeclaration(path) {
      let node = path.node;
      var varList = [];
      var source = node.source;
      if ((!node.specifiers || !node.specifiers.length) && node.declaration) {
        let ast = genAst.genExportNamedStmt(node.declaration);
        path.insertAfter(ast[1]);
        path.replaceWith(ast[0]);
        return;
      }
      node.specifiers.forEach((specNode) => {
        let v = {
          varName: '',
          varValue: '',
          source: source
        };
        if (specNode.local) {
          // export {abc}
          // eport {local as export} from "module"
          v.varName = specNode.exported;
          v.varValue = specNode.local;
        } else {
          if (specNode.type == "ExportNamespaceSpecifier") {
            // export * as abc, {a as b} from "module" 里面的 * as
            v.varName = specNode.exported;
          } else {
            // export { A, A as Link, A as NavLink};
            v.varName = specNode.exported;
            v.varValue = specNode.local;
          }
        }
        if (v.varName.type == 'Identifier' && v.varName.value == 'default') {
          v.varName.value = genAst.ID_EXPORT_DEFAULT;
        }
        varList.push(v);
      });
      let ast = genAst.genExportStmt(varList);
      path.replaceWith(ast);
      // path.traverse(visitor);
    },
    /**
     * export all
     *
     * export * from "module-name";
     * export * as name1 from "module-name";
     */
    ExportAllDeclaration(path) {
      let node = path.node;
      let v = {
        source: node.source
      };
      if (node.specifiers && node.specifiers[0]) {
        // export * as name1 from "mod";
        let n = node.specifiers[0];
        v.varName = n.exported;
      } else {
        // export * from "mod"
      }
      let ast = genAst.genExportAllStmt(v);
      path.replaceWith(ast);
      // path.traverse(visitor);
    }
  }
  return {visitor: {
    Program: {
      exit(path) {
        path.traverse(visitor);
        data.requires = unique(requires);
        data.requiresOrigin = unique(requiresOrigin);
        data.asyncs = unique(asyncs);
        data.asyncsOrigin = unique(asyncsOrigin);

        // print errors
        errors.forEach((err)=> {
          console.log('[Error]', err);
        });
        // data.requiresWithVar = requiresWithVar;
        // do cube wrap
        let finalAst = genAst.genCubeWraper(data.queryPath, requires, path.node.body);
        // console.log(finalAst);
        /*
        if (path.container) {
          const listKey = path.listKey || path.key;
          const oldNode = path.node;
          console.log('>>>>>>>>>>>++++++', listKey, path.container[listKey] === oldNode);
          path.container[listKey] = finalAst;
        }
        */
        path.node.body = finalAst.body;
        // console.log('cube import plugin, program post');
      }
    },
  }}
};