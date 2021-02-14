// Parser
//
// Exports a single function called parse which accepts the source code
// as a string and returns the AST.

import ohm from "ohm-js"
import * as ast from "./ast.js"

const carlosGrammar = ohm.grammar(String.raw`Carlos {
  Program   = Statement+
  Statement = (let | const) id "=" Exp            --vardec
            | Var "=" Exp                         --assign
            | print Exp                           --print
            | WhileStmt
            | IfStmt
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
  Exp5      = Var
            | true
            | false
            | num
            | "(" Exp ")"                         --parens
  relop     = "<=" | "<" | "==" | "!=" | ">=" | ">"
  Var       = id
  num       = digit+ ("." digit+)? (("E" | "e") ("+" | "-")? digit+)?
  let       = "let" ~alnum
  const     = "const" ~alnum
  print     = "print" ~alnum
  if        = "if" ~alnum
  while     = "while" ~alnum
  else      = "else" ~alnum
  true      = "true" ~alnum
  false     = "false" ~alnum
  keyword   = let | const | print | if | while | else | true | false
  id        = ~keyword letter alnum*
  space    += "//" (~"\n" any)* ("\n" | end)      --comment
}`)

const astBuilder = carlosGrammar.createSemantics().addOperation("ast", {
  Program(body) {
    return new ast.Program(body.ast())
  },
  Statement_vardec(kind, id, _eq, initializer) {
    const readOnly = kind.sourceString === "const"
    return new ast.Variable(id.sourceString, readOnly, initializer.ast())
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
  Var(id) {
    return new ast.IdentifierExpression(id.sourceString)
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
