const _ = require('lodash');

const ID_EXPORT_DEFAULT = '_default';
function raw(val) {
  return typeof val === 'string' ? "'"+val+"'" : val + ''
}

exports.raw = raw;
exports.ID_EXPORT_DEFAULT = ID_EXPORT_DEFAULT;

exports.genCubeWrapper = function (modName, modRequires, mainAst) {
  var wrapNode = {
    "type": "ExpressionStatement",
    "span": {"start": 0,"end": 0,"ctxt": 0},
    "expression": {
      "type": "CallExpression",
      "span": {"start": 0,"end": 0,"ctxt": 0},
      "callee": {
        "type": "Identifier",
        "span": {"start": 0,"end": 0,"ctxt": 0},
        "value": "Cube",
        "optional": false
      },
      "arguments": [
        {
          "spread": null,
          "expression": {
            "type": "ArrowFunctionExpression",
            "span": {"start": 0,"end": 0,"ctxt": 0},
            "params": [
              {
                "type": "Identifier",
                "span": {"start": 0,"end": 0, "ctxt": 2},
                "value": "module",
                "optional": false,
                "typeAnnotation": null
              },
              {
                "type": "Identifier",
                "span": {"start": 0,"end": 0, "ctxt": 2},
                "value": "exports",
                "optional": false,
                "typeAnnotation": null
              },
              {
                "type": "Identifier",
                "span": {"start": 0,"end": 0, "ctxt": 2},
                "value": "require",
                "optional": false,
                "typeAnnotation": null
              },
              {
                "type": "Identifier",
                "span": {"start": 0,"end": 0, "ctxt": 2},
                "value": "async",
                "optional": false,
                "typeAnnotation": null
              }
            ],
            "body": {
              "type": "BlockStatement",
              "span": {"start": 0,"end": 0,"ctxt": 0},
              "stmts": []
            },
            "async": false,
            "generator": false,
            "typeParameters": null,
            "returnType": null
          }
        }
      ],
      "typeArguments": null
    }
  };
  function buildFirstArgs() {
    let t = typeof modName;

    return {
          "spread": null,
          "expression": {
            "type": t === 'string' ? "StringLiteral" : "NumericLiteral",
            "span": {"start": 0,"end": 0,"ctxt": 0},
            "value": modName,
            "raw": raw(modName)
          }
        }
  }
  function buildRequireArgs(modRequires) {
    if (!modRequires.length) {
      return null
    }
    let param = {
      "spread": null,
      "expression": {
        "type": "ArrayExpression",
        "span": {"start": 0,"end": 0,"ctxt": 0},
        "elements": []
      }
    };
    modRequires.forEach((modName) => {
      let t = typeof modName;
      param.expression.elements.push({
        "spread": null,
        "expression": {
          "type": t === 'string' ? "StringLiteral" : "NumericLiteral",
          "span": {"start": 0,"end": 0,"ctxt": 0},
          "value": modName,
          "raw": raw(modName)
        }
      });
    });
    return param;
  }
  let arg0 = buildFirstArgs();
  let arg1 = buildRequireArgs(modRequires);
  let argCount = 2;
  if (arg1) {
    wrapNode.expression.arguments.unshift(arg1);
    argCount++;
  }
  wrapNode.expression.arguments.unshift(arg0);
  wrapNode.expression.arguments[argCount-1].expression.body.stmts = mainAst.body
  mainAst.body = [wrapNode];
  return mainAst;
}
/**
 * gen empty stmt: ;
 * @return {[type]} [description]
 */
exports.genEmptyStmt = function() {
  return {
    "type": "EmptyStatement"
  }
};

/**
 * gen empty string expr: ''
 * 赋值给 stmt.expression
 * @return {[type]} [description]
 */
exports.genEmptyExpression = function () {
  return {
    "type": "StringLiteral",
    "span": {"start": 0,"end": 0,"ctxt": 0},
    "value": "",
    "hasEscape": false,
    "kind": {
      "type": "normal",
      "containsQuote": true
    }
  }
}
/**
 * gen error log stmt: console.error('msg');
 * @param  {String} module moduleName
 * @param  {<Array>} errors 
 */
exports.genErrorExpression = function (module, errors) {
  let msg = `Cube error: module "${module} init faild, ` + errors.join(',')
  return {
    "type": "CallExpression",
    "span": {"start": 0,"end": 0,"ctxt": 0},
    "callee": {
      "type": "MemberExpression",
      "span": {"start": 0,"end": 0,"ctxt": 0},
      "object": {
        "type": "Identifier",
        "span": {"start": 0,"end": 0,"ctxt": 0},
        "value": "console",
        "optional": false
      },
      "property": {
        "type": "Identifier",
        "span": {"start": 0,"end": 0,"ctxt": 0},
        "value": "error",
        "optional": false
      }
    },
    "arguments": [
      {
        "spread": null,
        "expression": {
          "type": "StringLiteral",
          "span": {"start": 0,"end": 0,"ctxt": 0},
          "value": msg,
          "hasEscape": true,
          "kind": {
            "type": "normal",
            "containsQuote": true
          }
        }
      }
    ],
    "typeArguments": null
  }
};

/**
 * gen simple require declaration
 *
 * const a = require('abc')
 * const a = require('abc')._default
 * @param  {String} varName
 * @param  {String} requireFile
 * @return {AstNode}
 */
exports.genSimpleRequire = function(varList, requireFile) {
  let node = {
    "type": "VariableDeclaration",
    "kind": "const",
    "declare": false,
    "span": {start:0, end:0, ctxt: 0},
    "declarations": []
  };
  varList.forEach((varDec) => {
    let decNode = {
      "type": "VariableDeclarator",
      "id": {
        "type": "Identifier",
        "value": varDec.local,
        "optional": false,
        "span": {start:0, end:0, ctxt: varDec.ctxt},
        "typeAnnotation": null
      },
      "span": {start:0, end:0, ctxt: 0},
      "init": null,
      "definite": false
    };
    if (varDec.export) {
      if (typeof varDec.export === 'string') {
        varDec.export = {
          type: 'Identifier',
          value: varDec.export
        };
      }
      decNode.init = {
        "type": "MemberExpression",
        "span": {start:0, end:0, ctxt: 0},
        "object": {
          "type": "CallExpression",
          "span": {start:0, end:0, ctxt: 0},
          "callee": {
            "type": "Identifier",
            "value": "require",
            "optional": false,
            "span": {start:0, end:0, ctxt: 0}
          },
          "arguments": [
            {
              "spread": null,
              "span": {start:0, end:0, ctxt: 0},
              "expression": {
                "type": "StringLiteral",
                "value": requireFile,
                "raw": raw(requireFile),
                "optional": false,
                "span": {start:0, end:0, ctxt: 0},
              }
            }
          ],
          "typeArguments": null
        },
        "property": null
      };
      if (varDec.export.type === 'Identifier') {
        decNode.init.property = {
          "type": 'Identifier',
          "value": varDec.export.value,
          "optional": false,
          "span": {start:0, end:0, ctxt: 0},
        };
      } else if (varDec.export.type === 'StringLiteral') {
        decNode.init.property = {
          "type": 'Computed',
          "span": {start:0, end:0, ctxt: 0},
          "expression": {
            "type": varDec.export.type,
            "value": varDec.export.value,
            "raw": raw(varDec.export.value),
            "optional": false,
            "span": {start:0, end:0, ctxt: 0},
          }
        };
      }
    } else {
      decNode.init = {
        "type": "CallExpression",
        "span": {start:0, end:0, ctxt: 0},
        "callee": {
          "type": "Identifier",
          "value": "require",
          "optional": false,
          "span": {start:0, end:0, ctxt: 0},
        },
        "arguments": [
          {
            "spread": null,
            "span": {start:0, end:0, ctxt: 0},
            "expression": {
              "type": "StringLiteral",
              "value": requireFile,
              "raw": raw(requireFile),
              "span": {start:0, end:0, ctxt: 0},
            }
          }
        ],
        "typeArguments": null
      };
    }
    // console.log(JSON.stringify(decNode, null, 2));
    node.declarations.push(decNode);
  });
  return node;
};

exports.genRequireCallStmt = function(requireFile) {
  return {
    "type": "ExpressionStatement",
    "span": {start:0, end:0, ctxt: 0},
    "expression": {
      "type": "CallExpression",
      "span": {start:0, end:0, ctxt: 0},
      "callee": {
        "type": "Identifier",
        "span": {start:0, end:0, ctxt: 0},
        "value": "require",
        "optional": false
      },
      "arguments": [
        {
          "spread": null,
          "expression": {
            "type": "StringLiteral",
            "span": {start:0, end:0, ctxt: 0},
            "value": requireFile,
            "raw": raw(requireFile)
          }
        }
      ],
      "typeArguments": null
    }
  }
};

exports.genExportStmt = function(varList) {
  let exportStmt = {
    "type": "ExpressionStatement",
    "span": {start:0, end:0, ctxt: 0},
    "expression": {
      "type": "SequenceExpression",
      "span": {start:0, end:0, ctxt: 0},
      "expressions": []
    }
  };
  let flagDefault = false;
  varList.forEach((varDecl) => {
    let memberNode;
    if (varDecl.varValue || varDecl.source) {
      memberNode = {
        "type": "AssignmentExpression",
        "span": {start:0, end:0, ctxt: 0},
        "operator": "=",
        "left": {
          "type": "MemberExpression",
          "span": {start:0, end:0, ctxt: 0},
          "object": {
            "type": "Identifier",
            "span": {start:0, end:0, ctxt: 2}, // TODO ctxt
            "value": "exports",
            "optional": false
          },
          "property": null
        },
        "right": null
      }

      if (varDecl.varName.type === 'StringLiteral') {
        // export['a-b'] = c
        memberNode.left.property = {
          "type": "Computed",
          "span": {start:0, end:0, ctxt: 0},
          "expression": varDecl.varName
        };
      } else {
        // export.a = c
        memberNode.left.property = varDecl.varName;
      }

      if (varDecl.varProperty) {
        memberNode.right = {
          "type": "MemberExpression",
          "span": {start:0, end:0, ctxt: 0},
          "object": varDecl.varValue,
          "property": {
            "type": "Identifier",
            "span": {start:0, end:0, ctxt: 0},
            "value": varDecl.varProperty,
            "optional": false
          }
        };
      } else if (varDecl.source) {
        if (varDecl.varValue) {
          memberNode.right = {
            "type": "MemberExpression",
            "span": {start:0, end:0, ctxt: 0},
            "object": {
              "type": "CallExpression",
              "span": {start:0, end:0, ctxt: 0},
              "callee": {
                "type": "Identifier",
                "span": {start:0, end:0, ctxt: 2},
                "value": "require",
                "optional": false
              },
              "arguments": [{
                "spread": null,
                "expression": _.cloneDeep(varDecl.source)
              }]
            },
            "property": varDecl.varValue
          };
        } else {
          memberNode.right = {
            "type": "CallExpression",
            "span": {start:0, end:0, ctxt: 0},
            "callee": {
              "type": "Identifier",
              "span": {start:0, end:0, ctxt: 2},
              "value": "require",
              "optional": false
            },
            "arguments": [{
              "spread": null,
              "expression": _.cloneDeep(varDecl.source)
            }]
          };
        }
      } else {
        memberNode.right = varDecl.varValue;
      }
    } else {
      // export let a;
      memberNode = {
        "type": "MemberExpression",
        "span": {start:0, end:0, ctxt: 0},
        "object": {
          "type": "Identifier",
          "value": "exports",
          "optional": false,
          "span": {start:0, end:0, ctxt: 2},
        },
        "property": varDecl.varName
      };
    }
    exportStmt.expression.expressions.push(memberNode);
    if (varDecl.varName.value == ID_EXPORT_DEFAULT) {
      flagDefault = true
    }
  });
  if (flagDefault) {
    exportStmt.expression.expressions.push(exports.genExportDefaultProtectExpress());
  }
  return exportStmt;
};

exports.genExportDefaultProtectExpress = function () {
  // Object.defineProperty(exports, '_default', {enumerable: false})
  return {
    "type": "CallExpression",
    "span": {start:0, end:0, ctxt: 0},
    "callee": {
      "type": "MemberExpression",
      "span": {start:0, end:0, ctxt: 0},
      "object": {
        "type": "Identifier",
        "span": {start:0, end:0, ctxt: 0},
        "value": "Object",
        "optional": false
      },
      "property": {
        "type": "Identifier",
        "span": {start:0, end:0, ctxt: 0},
        "value": "defineProperty",
        "optional": false
      }
    },
    "arguments": [
      {
        "spread": null,
        "expression": {
          "type": "Identifier",
          "span": {start:0, end:0, ctxt: 2},
          "value": "exports",
          "optional": false
        }
      },
      {
        "spread": null,
        "expression": {
          "type": "StringLiteral",
          "span": {start:0, end:0, ctxt: 0},
          "value": ID_EXPORT_DEFAULT,
          "raw": raw(ID_EXPORT_DEFAULT)
        }
      },
      {
        "spread": null,
        "expression": {
          "type": "ObjectExpression",
          "span": {start:0, end:0, ctxt: 0},
          "properties": [
            {
              "type": "KeyValueProperty",
              "key": {
                "type": "Identifier",
                "span": {start:0, end:0, ctxt: 0},
                "value": "enumerable",
                "optional": false
              },
              "value": {
                "type": "BooleanLiteral",
                "span": {start:0, end:0, ctxt: 0},
                "value": false
              }
            }
          ]
        }
      }
    ],
    "typeArguments": null
  };
};

exports.genExportDefaultStmt = function(data) {
  let exportDefaultStmt = {
    "type": "ExpressionStatement",
    "span": {start:0, end:0, ctxt: 0}, 
    "expression": {
      "type": "SequenceExpression",
      "span": {start:0, end:0, ctxt: 0},
      "expressions": []
    }
  };

  exportDefaultStmt.expression.expressions.push({
    "type": "AssignmentExpression",
    "span": {start:0, end:0, ctxt: 0},
    "operator": "=",
    "left": {
      "type": "MemberExpression",
      "span": {start:0, end:0, ctxt: 0},
      "object": {
        "type": "Identifier",
        "span": {start:0, end:0, ctxt: 2},
        "value": "exports",
        "optional": false
      },
      "property": {
        "type": "Identifier",
        "span": {start:0, end:0, ctxt: 0},
        "value": ID_EXPORT_DEFAULT,
        "optional": false
      }
    },
    "right": data
  });

  exportDefaultStmt.expression.expressions.push(exports.genExportDefaultProtectExpress());
  return exportDefaultStmt;
};

exports.genExportAllStmt = function(data) {
  let exportAllStmt = {
    "type": "ExpressionStatement",
    "span": {start:0, end:0, ctxt: 0},
    "expression": {
      "type": "AssignmentExpression",
      "span": {start:0, end:0, ctxt: 0},
      "operator": "=",
      "left": {
        "type": "MemberExpression",
        "span": {start:0, end:0, ctxt: 0},
        "object": {
          "type": "Identifier",
          "span": {start:0, end:0, ctxt: 2},
          "value": "module",
          "optional": false
        },
        "property": {
          "type": "Identifier",
          "span": {start:0, end:0, ctxt: 0},
          "value": "exports",
          "optional": false
        }
      },
      "right": {
        "type": "CallExpression",
        "span": {start:0, end:0, ctxt: 0},
        "callee": {
          "type": "Identifier",
          "span": {start:0, end:0, ctxt: 2},
          "value": "require",
          "optional": false
        },
        "arguments": [{
            "spread": null,
            "expression": data.source
        }],
        "typeArguments": null
      }
    }
  };
  return exportAllStmt;
};
