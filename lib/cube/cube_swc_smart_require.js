const Visitor = require('@swc/core/Visitor').Visitor;

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
class CubeSmartRequirePlugin extends Visitor {
  /**
   * 
   * @param {Object} options
   *          rules {Object}
   *              {
   *                 "antd": {
   *                    tpl: "${module}/lib/${var}"
   *                 }
   *              } 
   */
  constructor(options) {
    super();
    this.cube = options.cube;
    this.data = options.data;
    this.rules = options.rules;
  }
  visitVariableDeclaration(node) {
    for (let i=0; i < node.declarations.length; i++) {
      let n = node.declarations[i];
      if (n.id.type !== 'ObjectPattern') {
        return node;
      }
      if (n.init.type !== 'CallExpression') {
        return node;
      }
      if (n.init.callee.value !== 'require' || n.init.callee.arguments.length !== 1) {
        return node;
      }
      let requireFile = n.init.callee.arguments[0].value;
      let rule = this.rules[requireFile];
      if (!rule) {
        return node;
      }
      let vList = [];
      n.id.properties.forEach((prop) => {
        let varName, ctxt, expt;
        if (prop.type === "AssignmentPatternProperty") {
          local = prop.key.value;
          ctxt = prop.key.span.ctxt;
        } else if (prop.type == "KeyValuePatternProperty") {
          // const {a:b} = require("antd")
          expt = prop.key.value;
          varName = prop.value.value;
          ctxt = prop.value.span.ctxt;
        }
        vList.push(genSimpleRequireVariableDeclarator(varName, ctxt, expt, requireFile, rule))
      });
      if (vList.length) {
        node.declarations.splice(2, 1, ...vList);
        i + vList.length - 1;
      }
    }
  }
  /**
   * import { export1 as alias1 } from "module-name";
   * import { export1, export2 } from "module-name";
   * import "module-name"; 
   */
  visitImportDeclaration(node) {
    let requireFile = node.source.value;
    let varList = [];
    let localVar, ctxt, importedVar, importedType;

    let rule = this.rules[requireFile];
    if (!rule) {
      return node;
    }
    node.specifiers.forEach((specNode) => {
      switch (specNode.type) {
        case 'ImportSpecifier':
          localVar = specNode.local.value;
          ctxt = specNode.local.span.ctxt;
          if (specNode.imported === null) {
            // import {a} from 'abc'
            // equals: const $localVar = require(requireFile).$localVar;
            varList.push({
              varName: localVar,
              ctxt: ctxt,
              expt: localVar
            });
          } else {
            // import {imported as local}
            importedVar = specNode.imported.value;
            importedType = specNode.imported.type;
            if (importedVar == 'default') {
              importedVar = genAst.ID_EXPORT_DEFAULT;
            }
            // import {a as b} from 'abc'
            // equals: const $localVar = require(requireFile).$importedVar;
            varList.push({
              varName: localVar,
              ctxt: ctxt,
              expt: importedVar
            });
          }
          break;
        default:
          console.log('unknow import declaration specifier node type', spec)
      }
    });

    if (varList.length) {
      return genSimpleRequire(varList, requireFile, rule);
    } else {
      return node;
    }
  }
}

function genSimpleRequire(varList, requireFile, rule) {
  let root = {
    "type": "VariableDeclaration",
    "span": { "start": 0, "end": 0, "ctxt": 0 },
    "kind": "const",
    "declare": false,
    "declarations": []
  }
  varList.forEach((varItem) => {
    root.declarations.push(genSimpleRequireVariableDeclarator(
      varItem.varName, varItem.ctxt, varItem.expt, requireFile, rule
    ));
  })
  return root;
}

var varFns = {
  lowercase: (str)=> {
    return str.toLowerCase()
  }
};

function genSimpleRequireVariableDeclarator(varName, ctxt, expt, requirefile, rule) {
  let requireFinal = rule.tpl.replace(/\$\{((\w+)|(\w+)\((\w+)\))\}/g, function (m0, m1, m2, m3, m4) {
    if (m3) {
      switch (m4) {
        case 'module':
          return varFns[m3](requirefile)
        case 'var':
          return varFns[m3](expt)
        default:
          return m0;
      }
    } else {
      switch (m1) {
        case 'module':
          return requirefile;
        case 'var':
          return expt;
        default:
          return m0;
      }
    }
  });
  return {
    "type": "VariableDeclarator",
    "span": {"start": 0,"end": 0,"ctxt": 0},
    "id": {
      "type": "Identifier",
      "span": { "start": 0,"end": 0,"ctxt": ctxt },
      "value": varName,
      "optional": false,
      "typeAnnotation": null
    },
    "init": {
      "type": "CallExpression",
      "span": {"start": 0,"end": 0,"ctxt": 0},
      "callee": {
        "type": "Identifier",
        "span": {"start": 0, "end": 0, "ctxt": 1},
        "value": "require",
        "optional": false
      },
      "arguments": [
        {
          "spread": null,
          "expression": {
            "type": "StringLiteral",
            "span": {"start": 0,"end": 0,"ctxt": 0},
            "value": requireFinal,
            "raw": "'"+requireFinal+"'"
          }
        }
      ],
      "typeArguments": null
    },
    "definite": false
  }
}

module.exports = CubeSmartRequirePlugin;