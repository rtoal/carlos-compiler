import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let x = 1024 - 0
  while x > 3 {
    let y = false && (true || 2 >= x)
    if false {
      const hello = (0 + x) / 2 ** 1
      break
    } else if true {
      let hello = false // A different hello
    } else {
      print y
      continue
    }
    print x   // TADA 🥑
  }`

const expectedAst = String.raw`   1 | Program statements=[#2,#6]
   2 | VariableDeclaration name='x' readOnly=false initializer=#3 variable=#5
   3 | BinaryExpression op='-' left=1024 right=0 type=#4
   4 | Type name='number'
   5 | Variable name='x' readOnly=false type=#4
   6 | WhileStatement test=#7 body=[#9,#14,#26]
   7 | BinaryExpression op='>' left=#5 right=3 type=#8
   8 | Type name='boolean'
   9 | VariableDeclaration name='y' readOnly=false initializer=#10 variable=#13
  10 | AndExpression conjuncts=[false,#11] type=#8
  11 | OrExpression disjuncts=[true,#12] type=#8
  12 | BinaryExpression op='>=' left=2 right=#5 type=#8
  13 | Variable name='y' readOnly=false type=#8
  14 | IfStatement test=false consequent=[#15,#20] alternative=#21
  15 | VariableDeclaration name='hello' readOnly=true initializer=#16 variable=#19
  16 | BinaryExpression op='/' left=#17 right=#18 type=#4
  17 | BinaryExpression op='+' left=0 right=#5 type=#4
  18 | BinaryExpression op='**' left=2 right=1 type=#4
  19 | Variable name='hello' readOnly=true type=#4
  20 | BreakStatement
  21 | IfStatement test=true consequent=[#22] alternative=[#24,#25]
  22 | VariableDeclaration name='hello' readOnly=false initializer=false variable=#23
  23 | Variable name='hello' readOnly=false type=#8
  24 | PrintStatement argument=#13
  25 | ContinueStatement
  26 | PrintStatement argument=#5`

const semanticChecks = [
  ["break in nested if", "while false {if true {break}}"],
  ["continue in nested if", "while false {if true {continue}}"],
]

const semanticErrors = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
  ["assign to const", "const x = 1\nx = 2", /Cannot assign to constant x/],
  ["assign bad type", "let x=1\nx=true", /'=' operands must have same types/],
  ["bad types for ||", "print false||1", /'\|\|' operand must be a boolean/],
  ["bad types for &&", "print false&&1", /'&&' operand must be a boolean/],
  ["bad types for +", "print false+1", /'\+' operand must be a number/],
  ["bad types for -", "print false-1", /'-' operand must be a number/],
  ["bad types for *", "print false*1", /'\*' operand must be a number/],
  ["bad types for /", "print false/1", /'\/' operand must be a number/],
  ["bad types for **", "print false**1", /'\*\*' operand must be a number/],
  ["bad types for <", "print false<1", /'<' operand must be a number/],
  ["bad types for <=", "print false<=1", /'<=' operand must be a number/],
  ["bad types for >", "print false>1", /'>' operand must be a number/],
  ["bad types for >=", "print false>=1", /'>=' operand must be a number/],
  ["bad types for negation", "print -true", /'-' operand must be a number/],
  ["non-boolean if test", "if 1 {}", /'if' operand must be a boolean/],
  ["non-boolean while test", "while 1 {}", /'while' operand must be a boolean/],
  [
    "shadowing",
    "let x = 1\nwhile true {let x = 1}",
    /Identifier x already declared/,
  ],
  ["break outside loop", "break", /'break' can only appear in a loop/],
  ["continue outside loop", "continue", /'continue' can only appear in a loop/],
]

describe("The analyzer", () => {
  for (const [scenario, source] of semanticChecks) {
    it(`recognizes ${scenario}`, () => {
      assert.ok(analyze(parse(source)))
    })
  }
  for (const [scenario, source, errorMessagePattern] of semanticErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => analyze(parse(source)), errorMessagePattern)
    })
  }
  it("can analyze all the nodes", () => {
    assert.deepStrictEqual(util.format(analyze(parse(source))), expectedAst)
  })
})
