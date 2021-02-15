// Parser
//
// Exports a single function called parse which accepts the source code
// as a string and returns the AST.

import ohm from "ohm-js"
import * as ast from "./ast.js"

const carlosGrammar = ohm.grammar(String.raw`Carlos {
  Program   = Statement+
  Statement = VarDecl
            | FunDecl
            | Var "=" Exp                         --assign
            | Exp6_call
            | print Exp                           --print
            | WhileStmt
            | IfStmt
            | break
            | continue
            | return Exp?                         --return
  VarDecl   = (let | const) id "=" Exp
  FunDecl   = function id Params (":" TypeExp)? Block
  Params    = "(" ListOf<Param, ","> ")"
  Param     = id ":" TypeExp
  TypeExp   = TypeExps "->" TypeExp               --function
            | id                                  --named
  TypeExps  = "(" ListOf<TypeExp, ","> ")"
  WhileStmt = while Exp Block
  IfStmt    = if Exp Block else (Block | IfStmt)  --long
            | if Exp Block                        --short
  Block     = "{" Statement* "}"
  Exp       = Exp1 ("||" Exp1)+                   --or
            | Exp1 ("&&" Exp1)+                   --and
            | Exp1
  Exp1      = Exp2 relop Exp2                     --binary
            | Exp2
  Exp2      = Exp2 ("+" | "-") Exp3               --binary
            | Exp3
  Exp3      = Exp3 ("*"| "/") Exp4                --binary
            | Exp4
  Exp4      = Exp5 "**" Exp4                      --binary
            | Exp5
            | "-" Exp5                            --unary
  Exp5      = Exp6
            | Exp7
  Exp6      = Exp6 "(" Args ")"                   --call
            | id                                  --id
  Exp7      = true
            | false
            | num
            | "(" Exp ")"                         --parens
  Args      = ListOf<Exp, ",">
  relop     = "<=" | "<" | "==" | "!=" | ">=" | ">"
  Var       = Exp6_id
  num       = digit+ ("." digit+)? (("E" | "e") ("+" | "-")? digit+)?
  let       = "let" ~alnum
  const     = "const" ~alnum
  function  = "function" ~alnum
  print     = "print" ~alnum
  if        = "if" ~alnum
  while     = "while" ~alnum
  else      = "else" ~alnum
  break     = "break" ~alnum
  continue  = "continue" ~alnum
  return    = "return" ~alnum
  true      = "true" ~alnum
  false     = "false" ~alnum
  keyword   = let | const | function | print | if | while | else 
            | return | break | continue | true | false
  id        = ~keyword letter alnum*
  space     += "//" (~"\n" any)* ("\n" | end)   --comment
}`)

const astBuilder = carlosGrammar.createSemantics().addOperation("ast", {
  Program(body) {
    return new ast.Program(body.ast())
  },
  VarDecl(kind, id, _eq, initializer) {
    const readOnly = kind.sourceString === "const"
    return new ast.Variable(id.sourceString, readOnly, initializer.ast())
  },
  FunDecl(_fun, id, parameters, _colons, returnType, body) {
    const returnTypeTree = returnType.ast()
    return new ast.Function(
      id.sourceString,
      parameters.ast(),
      returnTypeTree.length === 0
        ? new ast.NamedType("void")
        : returnTypeTree[0],
      body.ast()
    )
  },
  Params(_left, bindings, _right) {
    return bindings.asIteration().ast()
  },
  Param(id, _colon, type) {
    return new ast.Parameter(id.sourceString, type.ast())
  },
  TypeExp_function(inputType, _arrow, outputType) {
    return new ast.FunctionType(inputType.ast(), outputType.ast())
  },
  TypeExp_named(id) {
    return new ast.NamedType(id.sourceString)
  },
  TypeExps(_left, memberTypeList, _right) {
    return memberTypeList.asIteration().ast()
  },
  Statement_assign(variable, _eq, expression) {
    return new ast.Assignment(variable.ast(), expression.ast())
  },
  Statement_print(_print, expression) {
    return new ast.PrintStatement(expression.ast())
  },
  WhileStmt(_while, test, body) {
    return new ast.WhileStatement(test.ast(), body.ast())
  },
  IfStmt_long(_if, test, consequent, _else, alternative) {
    return new ast.IfStatement(test.ast(), consequent.ast(), alternative.ast())
  },
  IfStmt_short(_if, test, consequent) {
    return new ast.ShortIfStatement(test.ast(), consequent.ast())
  },
  break(_) {
    return new ast.BreakStatement()
  },
  continue(_) {
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
  Exp6_call(callee, _left, args, _right) {
    return new ast.Call(callee.ast(), args.ast())
  },
  Exp6_id(id) {
    return new ast.IdentifierExpression(id.sourceString)
  },
  Exp7_parens(_open, expression, _close) {
    return expression.ast()
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
