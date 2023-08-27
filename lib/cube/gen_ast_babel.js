const t = require('@babel/types');
const ID_EXPORT_DEFAULT = 'default';

const useStrict = t.expressionStatement(
  t.stringLiteral('use strict')
);

exports.ID_EXPORT_DEFAULT = ID_EXPORT_DEFAULT;

/**
 * gen  Cube('mod', ['require'], (module, exports, import) => {})
 * @param {*} modName module name
 * @param {*} modRequires requires
 * @param {*} mainAst originAst
 * @returns 
 */
exports.genCubeWraper = function (modName, modRequires, mainAst) {
  let cubeWrapArgs = [
    t.stringLiteral(modName)
  ];
  if (modRequires.length) {
    let arrs = [];
    modRequires.forEach((mReq) => {
      arrs.push(t.stringLiteral(mReq));
    });
    cubeWrapArgs.push(t.arrayExpression(arrs))
  }
  cubeWrapArgs.push(
    t.arrowFunctionExpression(
      [t.identifier('module'), t.identifier('exports'), t.identifier('require'), t.identifier('async')],
      t.blockStatement(mainAst)
    )
  );
  let cubeWrap = t.expressionStatement(
    t.callExpression(
      t.identifier('Cube'), // 函数名
      cubeWrapArgs
    )
  );
  return t.program([useStrict, cubeWrap]);
}

/**
 * gen code: var {a,b,c} = require("a")
 */
exports.genSimpleRequire = function (varList, requireFile) {
  let varArr = [];
  let nsVarArr = [];
  varList.forEach((varItem) => {
    if (varItem.export) {
      varArr.push(t.objectProperty(t.identifier(varItem.export), t.identifier(varItem.local)))
    } else {
      nsVarArr.push(t.identifier(varItem.local))
    }
  })
  let decls = [];
  if (varArr.length) {
    decls.push(t.variableDeclarator(
      t.objectPattern(varArr),
      t.callExpression(
        t.identifier('require'),
        [t.stringLiteral(requireFile)]
      )
    ))
  }
  if (nsVarArr.length) {
    nsVarArr.forEach((item) => {
      decls.push(t.variableDeclarator(
        item,
        t.callExpression(
          t.identifier('require'),
          [t.stringLiteral(requireFile)]
        )
      ))
    })
  }
  let ast = t.variableDeclaration('const', decls);
  return ast;
}

/**
 * gen code:  require("abc")
 */
exports.genRequireCallStmt = function (requireFile) {
  let ast = t.callExpression(
    t.identifier('require'),
    [t.stringLiteral(requireFile)]
  );
  return ast;
}

/**
 * gen code:  exports.xxx = xxxx
 * @param {Array} varList
 *  {
 *    varName: pNode.value,
      varValue: declNode.init,
      varProperty: pNode.key.value
      source:  
 *  }
    result:
 *    exports.${varName} = ${varValue}.${varProperty}
      exports.${varName} = require("${source}").${varValue}
 */
exports.genExportStmt = function (varList) {
  // 创建赋值表达式节点
  let assignments = [];
  varList.forEach((varItem) => {
    let right;
    if (varItem.source) {
      if (varItem.varValue) {
        right = t.memberExpression(
          t.callExpression(
            t.identifier('require'),
            [varItem.source]
          ),
          t.identifier(varItem.varValue)
        );
      } else {
        right = t.callExpression(
          t.identifier('require'),
          [varItem.source]
        );
      }
    } else {
      if (varItem.varProperty) {
        right = t.memberExpression(
          varItem.varValue,
          varItem.varProperty
        );
      } else {
        right = varItem.varValue;
      }
    }
    assignments.push(
      t.assignmentExpression('=', t.memberExpression(t.identifier('exports'), varItem.varName), right)
    );
  });
  // 创建 SequenceExpression 节点，将两个赋值表达式组合成一个语句
  const sequenceExpression = t.sequenceExpression(assignments);
  // 创建程序节点包含 SequenceExpression
  return t.expressionStatement(sequenceExpression);
}

/**
 * export default abc
 * @param {*} subNode 
 * @returns 
 */
exports.genExportDefaultStmt = function (subNode) {
  if (t.isIdentifier(subNode)) {
    return t.expressionStatement(t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier('exports'), t.identifier(ID_EXPORT_DEFAULT)),
      subNode
    ));
  } else if (t.isExpression(subNode)) {
    return t.expressionStatement(t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier('exports'), t.identifier(ID_EXPORT_DEFAULT)),
      subNode
    ));
  } else if (t.isDeclaration(subNode)){
    return [subNode, t.expressionStatement(t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier('exports'), t.identifier(ID_EXPORT_DEFAULT)),
      subNode.id
    ))]
  } else {
    throw new Error('unknow type of `export default`, subNode:' + subNode.id.name);
  }
}

exports.genExportNamedStmt = function (subNode) {

  if (t.isVariableDeclaration(subNode)) {
    // export const a = 1, b=2;
    let assignmentExprs = []
    subNode.declarations.forEach((item) => {
      assignmentExprs.push(
        t.assignmentExpression(
          '=',
          t.memberExpression(t.identifier('exports'), item.id),
          item.id
        )
      )
    });
    return [subNode, t.expressionStatement(t.sequenceExpression(assignmentExprs))]
  } else if (t.isFunctionDeclaration(subNode)) {
    // export function () {}
    return [subNode, t.expressionStatement(t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier('exports'), subNode.id),
      subNode.id
    ))]
  } else if (t.isClassDeclaration(node.declaration)) {
    // export class A{}
    return [subNode, t.expressionStatement(t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier('exports'), subNode.id),
      subNode.id
    ))]
  } else {
    throw new Error('unknow type of `export default`, subNode:' + subNode.id.name);
  }
}

/**
 * 
 * @param {*} data
 *   source: node identify 
 *   varName: var identify
 */
exports.genExportAllStmt = function(data) {
  if (data.varName) {
    // export * as abc from "mod"
    // exports.${varName} = require("mod")
    return t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(
          t.identifier('exports'),
          data.varName
        ),
        t.callExpression(
          t.identifier('require'),
          [data.source]
        )
      )
    );
  } else {
    // export * from "mod"
    // for(const [k,v] of require("mod")){exports[k]=v}; exports._default=require('mod')._default;
    //
    // const  for(let i in require(${source}){exports[i] = })
    // 创建 const [key, value] 的解构赋值表达式
    const destructurePattern = t.arrayPattern([
      t.identifier('key'),
      t.identifier('value')
    ]);

    // 创建 require("mod") 表达式
    const requireExpression = t.callExpression(
      t.identifier('require'),
      [data.source]
    );

    // 创建 for...of 循环语句块
    const loopBody = t.blockStatement([
      t.expressionStatement(
        t.assignmentExpression(
          '=',
          t.memberExpression(t.identifier('exports'), t.identifier('key')),
          t.identifier('value')
        )
      )
    ]);
    const assignmentExpression = t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier('exports'), t.identifier(ID_EXPORT_DEFAULT)),
      t.memberExpression(
        t.callExpression(
          t.identifier('require'),
          [t.stringLiteral('mod')]
        ),
        t.identifier(ID_EXPORT_DEFAULT)
      )
    );
    return t.sequenceExpression(
      t.forOfStatement(destructurePattern, requireExpression, loopBody),
      t.expressionStatement(assignmentExpression)
    )
  }
};
