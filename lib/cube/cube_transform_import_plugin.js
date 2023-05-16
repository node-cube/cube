const Visitor = require('@swc/core/Visitor').Visitor;
const utils = require('../utils');
const genAst = require('./gen_ast');
const log = require('./log');

function unique(arr) {
  var map = {};
  arr.forEach(function (v) {
    map[v] = true;
  });
  return Object.keys(map);
}

/**
ref: @swc/core/Visitor.js line 24
*/
class CubeTransformImportPlugin extends Visitor {
  constructor(options) {
    super();
    this.cube = options.cube;
    this.data = options.data;
    // all requires
    this.requires = [];
    this.requiresOrigin = [];
    // all dynamic loadings;
    this.asyncs = [];
    this.asyncsOrigin = [];
    // all requires with variables, this is not support
    this.requiresWithVar = [];
    this.errors = [];
  }
  // set require
  setRequire(reqName) {
    this.requires.push(reqName);
  }
  // set async require
  setAsync(reqName) {
    this.asyncs.push(reqName);
  }
  // set require with var
  setRequireWithVar(node) {
    this.requiresWithVar.push(node);
  }
  moduleName(modName) {
    return utils.moduleName(modName, this.data.type, this.cube.config.release, this.cube.config.remote);
  }
  processRequireArgs(calleeName, reqCallExprArg0) {
    let arg0 = reqCallExprArg0;
    let modName;

    if (arg0.expression.type === 'BinaryExpression') {
      this.errors.push('require with var');
      return;
    } else if (arg0.expression.type === 'TemplateLiteral') {
      if (arg0.expression.expressions.length !== 0) {
        this.errors.push('require with var');
        return;
      }
      modName = arg0.expression.quasis[0].cooked;
    } else if (arg0.expression.type === 'StringLiteral'){
      modName = arg0.expression.value;
    } else {
      this.errors.push('unknow type of require');
      return;
    }
    /**
     * 如果
     *   requre参数不存在 ||
     *   require的不是一个模块的字符串名字（可能是个变量）||
     *   require了一个空字符串
     * 则忽略
     */
    if (!modName || !modName.trim()) {
      this.errors.push('empty require');
      return;
    }

    if(this.cube.config.moduleIgnore && this.cube.config.moduleIgnore[modName]) {
      this.errors.push('ignored require');
      return;
    }

    let flagMap;
    let modNameOrign;
    // 处理 moduleMap 映射
    if (this.cube.config.moduleMap && this.cube.config.moduleMap[modName]) {
      modNameOrign = modName;
      modName = this.cube.config.moduleMap[modName];
      if (modName[0] === '/') {
        modName = modNameOrign + modName;
      }
      flagMap = true;
    }
    let res = this.cube.resolveModulePath(this.data, modName);
    if (res.error && !this.cube.config.moduleRegistered[modName]) {
      res.error = `Cube process module "${this.data.queryPath}" error, ` + res.error;
      // 没找到、或者被ignore了
      this.errors.push(res.error);
      return false;
    }
    modName = res.modName;
    if (calleeName == 'require') {
      this.setRequire(modName);
    } else if (calleeName == 'async') {
      this.setAsync(modName);
    }

    if (arg0.expression.type === 'StringLiteral') {
      arg0.expression.value = modName;
      arg0.expression.raw = genAst.raw(modName);
    } else if (arg0.expression.type === 'TemplateLiteral') {
      arg0.expression.quasis[0].cooked = modName;
      arg0.expression.quasis[0].raw = genAst.raw(modName);
    }
  }
  visitModule(m) {
    // do wrap here 
    m.body = this.visitModuleItems(m.body);
    this.requires = unique(this.requires);
    // this.requiresOrigin = unique(this.requiresOrigin);
    this.asyncs = unique(this.asyncs);
    // this.asyncsOrigin = unique(this.loads);
    let finalNode = genAst.genCubeWrapper(this.data.queryPath, this.requires, m);
    this.errors.forEach((err)=> {
      console.log('[Error]', err);
    });
    return finalNode
  }
  /**
   * async('abc', (mod) => {mod.run()})
   * require('abc')
   *
   * 注意，所有的 import 都会先被转换成 require，然后来过这个visit
   * 所以在import指令处，并不会去检查require的模块是否存在，都在这个
   * 函数中处理
   */
  visitCallExpression(node) {
    let callFuncName = node.callee.value;
    // filter other calls
    if (callFuncName !== 'require' && callFuncName !== 'async') {
      return super.visitCallExpression(node);
    }
    if (!node.arguments.length) {
      return super.visitCallExpression(node);
    }
    // examples:
    //   require('abc.css', '.ns')
    //   async('abc.css', '.ns', ()=>{})
    if (node.arguments.length > 3) {
      return super.visitCallExpression(node);
    }
    node.callee.span.ctxt = 2;

    let arg0 = node.arguments[0];
    // console.log('>>>>', node);
    let ok = this.processRequireArgs(callFuncName, arg0);
    /*
    if (ok === false) {
      // TODO this.errors
      return genAst.genErrorExpression(this.data.queryPath, this.errors);
      // return genAst.genEmpty().expression;
    }
    */
    return node;
  }
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
  visitImportDeclaration(node) {
    let requireFile = node.source.value;
    let varList = [];
    let localVar, ctxt, importedVar, importedType;
    node.specifiers.forEach((specNode) => {
      switch (specNode.type) {
        case 'ImportDefaultSpecifier':
          localVar = specNode.local.value;
          ctxt = specNode.local.span.ctxt;
          // equals: const $localVar = require(requireFile).__default;
          varList.push({
            local: localVar,
            export: genAst.ID_EXPORT_DEFAULT,
            ctxt: ctxt
          });
          break;
        case 'ImportNamespaceSpecifier':
          localVar = specNode.local.value;
          ctxt = specNode.local.span.ctxt;
          // equals: const $localVar = require(requireFile);
          varList.push({
            local: localVar,
            ctxt: ctxt
          });
          break;
        case 'ImportSpecifier':
          localVar = specNode.local.value;
          ctxt = specNode.local.span.ctxt;
          if (specNode.imported === null) {
            // import {a} from 'abc'
            // equals: const $localVar = require(requireFile).$localVar;
            varList.push({
              local: localVar,
              export: localVar,
              ctxt: ctxt
            });
          } else {
            importedVar = specNode.imported.value;
            importedType = specNode.imported.type;
            if (importedVar == 'default') {
              importedVar = genAst.ID_EXPORT_DEFAULT;
            }
            // import {a as b} from 'abc'
            // equals: const $localVar = require(requireFile).$importedVar;
            varList.push({
              local: localVar,
              ctxt: ctxt,
              export: {type: importedType, value:importedVar}
            });
          }
          break;
        default:
          console.log('unknow import declaration specifier node type', spec)
      }
    });
    let newNode;
    if (varList.length) {
      newNode = genAst.genSimpleRequire(varList, requireFile);
      return this.visitDeclaration(newNode);
    } else {
      newNode = genAst.genRequireCallStmt(requireFile);
      return this.visitExpressionStatement(newNode);
    }
  }
  /**
   * typescript ImportEqualsDeclaration
   *
   * import type A = require("A");
   * export import type B = require("B");
   * 不推荐这种模式
   */
  visitTsImportEqualsDeclaration(node) {
    if (node.isTypeOnly) {
      return genAst.genEmptyStmt();
    }
    return node;
  }
  /**
   * typescript ExportAssignment
   * example:
   * import * as config from 'config';
   */
  visitTsExportAssignment(node) {
    return node;
  }
  /**
   * typescript NamespaceExportDeclaration
   * example:
   * export as namespace mathLib; // 导出到全局， window.mathLib = module.exports
   */
  visitTsNamespaceExportDeclaration(node) {
    return node;
  }
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
  visitExportDeclaration(node) {
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
    case 'TsInterfaceDeclaration':
      // ;
      return genAst.genEmptyStmt();
    }
    return genAst.genExportStmt(varList);
  }
  /**
   * export default
   * -- Default exports
   * 
   * export default expression;
   */
  visitExportDefaultExpression(node) {
    return genAst.genExportDefaultStmt(node.expression);
  }
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
  visitExportDefaultDeclaration(node) {
    return genAst.genExportDefaultStmt(node.decl);
  }
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
  visitExportNamedDeclaration(node) {
    var varList = [];
    var source = node.source;
    if (node.typeOnly) {
      return genAst.genEmptyStmt();
    }
    node.specifiers.forEach((specNode) => {
      if (specNode.name) {
        let v = {
          varName: specNode.name,
        };
        if (source) {
          v.source = source;
        }
        varList.push(v);
      } else if (specNode.exported) {
        let v = {
          varName: specNode.exported,
          varValue: specNode.orig,
        };
        if (source) {
          v.source = source;
        }
        varList.push(v);
      } else {
        let v = {
          varName: specNode.orig,
          varValue: specNode.orig
        };
        if (source) {
          v.source = source;
        }
        if (v.varName.type == 'Identifier' && v.varName.value == 'default') {
          v.varName.value = genAst.ID_EXPORT_DEFAULT;
          v.varName.raw = genAst.raw(genAst.ID_EXPORT_DEFAULT);
        }
        varList.push(v);
      }
    });
    let namedExportNode = genAst.genExportStmt(varList);
    return this.visitExpressionStatement(namedExportNode);
  }
  /**
   * export all
   *
   * export * from "module-name";
   * export * as name1 from "module-name";
   */
  visitExportAllDeclaration(node) {
    let newNode = genAst.genExportAllStmt({
      source: node.source
    });
    return this.visitExpressionStatement(newNode);
  }
  visitIdentifier(node) {
    if (node.value === 'exports' || node.value === 'module') {
      node.span.ctxt = 2;
    }
    return node;
  }
}

module.exports = CubeTransformImportPlugin;