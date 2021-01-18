// Parser
//
// Exports a single function called parse which accepts the source code
// as a string and returns the AST.

import ohm from "ohm-js"
import * as ast from "./ast.js"

const carlosGrammar = ohm.grammar(String.raw`Carlos {
  Program   = Statement+
  Statement = (let | const) id "=" Exp        --variable
            | id "=" Exp                      --assign
            | print Exp                       --print
            | WhileStmt
            | IfStmt
            | break                           --break
            | continue                        --continue
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
  break     = "break" ~alnum
  continue  = "continue" ~alnum
  abs       = "abs" ~alnum
  sqrt      = "sqrt" ~alnum
  keyword   = let | const | print | if | while | else | break 
            | continue | abs | sqrt
  id        = ~keyword letter alnum*
  space    += "//" (~"\n" any)* ("\n" | end)  --comment
}`)

const astBuilder = carlosGrammar.createSemantics().addOperation("ast", {
  Program(body) {
    return new ast.Program(body.ast())
  },
  Statement_variable(kind, id, _eq, initializer) {
    const readOnly = kind.sourceString === "const"
    return new ast.Variable(id.sourceString, readOnly, initializer.ast())
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
    let testTree = test.ast()
    let consequentTree = consequent.ast()
    let alternativesTree = alternatives.ast()
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
  num(_whole, _point, _fraction, _e, _sign, _exponent) {
    return new ast.Literal(Number(this.sourceString))
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
