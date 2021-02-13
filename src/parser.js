// Parser
//
// Exports a single function called parse which accepts the source code
// as a string and returns the AST.

import ohm from "ohm-js"
import * as ast from "./ast.js"

const carlosGrammar = ohm.grammar(String.raw`Carlos {
  Program   = Statement+
  Statement = TypeDecl
            | VarDecl
            | FunDecl
            | Var "=" Exp                     --assign
            | Var "(" Args ")"                --call
            | print Exp                       --print
            | WhileStmt
            | IfStmt
            | break                           --break
            | continue                        --continue
            | return Exp?                     --return
  TypeDecl  = type id "=" TypeId array
  VarDecl   = (let | const) id "=" Exp
  FunDecl   = function id Params (":" TypeId)? Block
  Params    = "(" ListOf<Param, ","> ")"
  Param     = id ":" TypeId
  TypeId    = id
  WhileStmt = while Exp Block
  IfStmt    = if Exp Block (else (Block | IfStmt))?
  Block     = "{" Statement* "}"
  Exp       = Exp1 ("||" Exp1)+               --or
            | Exp1 ("&&" Exp1)+               --and
            | Exp1
  Exp1      = Exp2 relop Exp2                 --binary
            | Exp2
  Exp2      = Exp2 ("+" | "-") Exp3           --binary
            | Exp3
  Exp3      = Exp3 ("*"| "/") Exp4            --binary
            | Exp4
  Exp4      = Exp5 "**" Exp4                  --binary
            | Exp5
            | "-" Exp5                        --unary
  Exp5      = Var
            | true
            | false
            | num
            | "(" Exp ")"                     --parens
  Var       = id "(" Args ")" "[" Exp "]"     --call
            | Var "[" Exp "]"                 --subscript
            | id
  Args      = ListOf<Exp, ",">
  relop     = "<=" | "<" | "==" | "!=" | ">=" | ">"
  num       = digit+ ("." digit+)? (("E" | "e") ("+" | "-")? digit+)?
  type      = "type" ~alnum
  array     = "array" ~alnum
  let       = "let" ~alnum
  const     = "const" ~alnum
  function  = "function" ~alnum
  print     = "print" ~alnum
  if        = "if" ~alnum
  else      = "else" ~alnum
  while     = "while" ~alnum
  break     = "break" ~alnum
  continue  = "continue" ~alnum
  return    = "return" ~alnum
  true      = "true" ~alnum
  false     = "false" ~alnum
  keyword   = type | array | let | const | function | print | if | else 
            | while | return | break | continue | true | false
  id        = ~keyword letter alnum*
  space    += "//" (~"\n" any)* ("\n" | end)  --comment
}`)

const astBuilder = carlosGrammar.createSemantics().addOperation("ast", {
  Program(body) {
    return new ast.Program(body.ast())
  },
  TypeDecl(_type, id, _eq, baseTypeName, _array) {
    return new ast.TypeDeclaration(id.sourceString, baseTypeName.sourceString)
  },
  VarDecl(kind, id, _eq, initializer) {
    const readOnly = kind.sourceString === "const"
    return new ast.Variable(id.sourceString, readOnly, initializer.ast())
  },
  FunDecl(_fun, id, parameters, _colons, typeNames, body) {
    return new ast.Function(
      id.sourceString,
      parameters.ast(),
      typeNames.ast().length === 0 ? null : typeNames.ast()[0],
      body.ast()
    )
  },
  Params(_left, bindings, _right) {
    return bindings.asIteration().ast()
  },
  Param(id, _colon, typeName) {
    return new ast.Parameter(id.sourceString, typeName.ast())
  },
  TypeId(id) {
    return id.sourceString
  },
  Statement_assign(variable, _eq, expression) {
    return new ast.Assignment(variable.ast(), expression.ast())
  },
  Statement_call(callee, _left, args, _right) {
    return new ast.Call(callee.ast(), args.ast())
  },
  Statement_print(_print, expression) {
    return new ast.PrintStatement(expression.ast())
  },
  WhileStmt(_while, test, body) {
    return new ast.WhileStatement(test.ast(), body.ast())
  },
  IfStmt(_if, test, consequent, _elses, alternatives) {
    const testTree = test.ast()
    const consequentTree = consequent.ast()
    const alternativesTree = alternatives.ast()
    if (alternativesTree.length === 0) {
      return new ast.ShortIfStatement(testTree, consequentTree)
    }
    return new ast.IfStatement(testTree, consequentTree, alternativesTree[0])
  },
  Statement_break(_break) {
    return new ast.BreakStatement()
  },
  Statement_continue(_continue) {
    return new ast.ContinueStatement()
  },
  Statement_return(_return, expression) {
    return new ast.ReturnStatement(
      expression.ast().length === 0 ? null : expression.ast()[0]
    )
  },
  Block(_open, body, _close) {
    // This one is fun, don't wrap the statements, just return the list
    return body.ast()
  },
  Exp_or(first, _ors, rest) {
    return new ast.OrExpression([first.ast(), ...rest.ast()])
  },
  Exp_and(first, _ors, rest) {
    return new ast.AndExpression([first.ast(), ...rest.ast()])
  },
  Exp1_binary(left, op, right) {
    return new ast.BinaryExpression(op.sourceString, left.ast(), right.ast())
  },
  Exp2_binary(left, op, right) {
    return new ast.BinaryExpression(op.sourceString, left.ast(), right.ast())
  },
  Exp3_binary(left, op, right) {
    return new ast.BinaryExpression(op.sourceString, left.ast(), right.ast())
  },
  Exp4_binary(left, op, right) {
    return new ast.BinaryExpression(op.sourceString, left.ast(), right.ast())
  },
  Exp4_unary(op, operand) {
    return new ast.UnaryExpression(op.sourceString, operand.ast())
  },
  Exp5_parens(_open, expression, _close) {
    return expression.ast()
  },
  Var_call(callee, _left, args, _right) {
    return new ast.Call(callee.ast(), args.ast())
  },
  Var_subscript(array, _left, subscript, _right) {
    return new ast.SubscriptExpression(array.ast(), subscript.ast())
  },
  Var(id) {
    return new ast.IdentifierExpression(id.sourceString)
  },
  Args(expressions) {
    return expressions.asIteration().ast()
  },
  true(_) {
    return true
  },
  false(_) {
    return false
  },
  num(_whole, _point, _fraction, _e, _sign, _exponent) {
    return Number(this.sourceString)
  },
})

export default function parse(sourceCode) {
  const match = carlosGrammar.match(sourceCode)
  if (!match.succeeded()) {
    throw new Error(match.message)
  }
  return astBuilder(match).ast()
}
