// Parser
//
// Exports a single function called parse which accepts the source code
// as a string and returns the AST.

import ohm from "ohm-js"
import * as ast from "./ast.js"

const carlosGrammar = ohm.grammar(String.raw`Carlos {
  Program   = Statement+
  Statement = (let | const) id "=" Exp        --declare
            | id "=" Exp                      --assign
            | print Exp                       --print
            | WhileStmt
            | IfStmt
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
            | ("-" | abs | sqrt) Exp5         --unary
  Exp5      = id
            | num
            | "(" Exp ")"                     --parens
  relop     = "<=" | "<" | "==" | "!=" | ">=" | ">"
  num       = digit+ ("." digit+)? (("E" | "e") ("+" | "-")? digit+)?
  let       = "let" ~alnum
  const     = "const" ~alnum
  print     = "print" ~alnum
  if        = "if" ~alnum
  while     = "while" ~alnum
  else      = "else" ~alnum
  abs       = "abs" ~alnum
  sqrt      = "sqrt" ~alnum
  keyword   = let | const | print | if | while | else | abs | sqrt
  id        = ~keyword letter alnum*
  space    += "//" (~"\n" any)* ("\n" | end)  --comment
}`)

const astBuilder = carlosGrammar.createSemantics().addOperation("ast", {
  Program(body) {
    return new ast.Program(body.ast())
  },
  Statement_declare(kind, id, _eq, expression) {
    return new ast.Declaration(
      id.sourceString,
      kind.sourceString === "const",
      expression.ast()
    )
  },
  Statement_assign(id, _eq, expression) {
    return new ast.Assignment(
      new ast.IdentifierExpression(id.sourceString),
      expression.ast()
    )
  },
  Statement_print(_print, expression) {
    return new ast.PrintStatement(expression.ast())
  },
  WhileStmt(_while, test, body) {
    return new ast.WhileStatement(test.ast(), body.ast())
  },
  IfStmt(_if, test, consequent, _elses, alternatives) {
    return new ast.IfStatement(
      test.ast(),
      consequent.ast(),
      alternatives.ast().length > 0 ? alternatives.ast()[0] : null
    )
  },
  Block(_open, body, _close) {
    return new ast.Block(body.ast())
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
  num(_base, _radix, _fraction, _e, _sign, _exponent) {
    return new ast.LiteralExpression(+this.sourceString)
  },
  id(_firstChar, _restChars) {
    return new ast.IdentifierExpression(this.sourceString)
  },
})

export default function parse(sourceCode) {
  const match = carlosGrammar.match(sourceCode)
  if (!match.succeeded()) {
    throw new Error(match.message)
  }
  return astBuilder(match).ast()
}
