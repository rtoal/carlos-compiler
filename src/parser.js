// Parser
//
// Exports a single function called parse which accepts the source code
// as a string and returns the AST.

import ohm from "ohm-js"
import * as ast from "./ast.js"

const carlosGrammar = ohm.grammar(String.raw`Carlos {
  Program   = Statement+
  Statement = let id "=" Exp                  --vardec
            | Var "=" Exp                     --assign
            | print Exp                       --print
  Exp       = Exp ("+" | "-") Term            --binary
            | Term
  Term      = Term ("*"| "/") Factor          --binary
            | Factor
  Factor    = Var
            | num
            | "(" Exp ")"                     --parens
            | "-" Factor                      --unary
  Var       = id
  num       = digit+ ("." digit+)? (("E" | "e") ("+" | "-")? digit+)?
  let       = "let" ~alnum
  print     = "print" ~alnum
  keyword   = let | print
  id        = ~keyword letter alnum*
  space    += "//" (~"\n" any)* ("\n" | end)  --comment
}`)

const astBuilder = carlosGrammar.createSemantics().addOperation("ast", {
  Program(body) {
    return new ast.Program(body.ast())
  },
  Statement_vardec(_let, id, _eq, expression) {
    return new ast.Variable(id.sourceString, expression.ast())
  },
  Statement_assign(variable, _eq, expression) {
    return new ast.Assignment(variable.ast(), expression.ast())
  },
  Statement_print(_print, expression) {
    return new ast.PrintStatement(expression.ast())
  },
  Exp_binary(left, op, right) {
    return new ast.BinaryExpression(op.sourceString, left.ast(), right.ast())
  },
  Term_binary(left, op, right) {
    return new ast.BinaryExpression(op.sourceString, left.ast(), right.ast())
  },
  Factor_unary(op, operand) {
    return new ast.UnaryExpression(op.sourceString, operand.ast())
  },
  Factor_parens(_open, expression, _close) {
    return expression.ast()
  },
  Var(id) {
    return new ast.IdentifierExpression(id.sourceString)
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
