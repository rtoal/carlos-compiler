import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let x = 1024 - 0
  while x > 3 {
    let y = false && (true || 2 >= x)
    if false {
      const hello = (0 + x) / 2 ** 1
      print 1
    } else if true {
      let hello = false // A different hello
    } else {
      print y
    }
    print x   // TADA 🥑
  }`

const expectedAst = String.raw`   1 | Program statements=[#2,#5]
   2 | Variable name='x' readOnly=false initializer=#3 type=#4
   3 | BinaryExpression op='-' left=1024 right=0 type=#4
   4 | Type name='number'
   5 | WhileStatement test=#6 body=[#9,#14,#25]
   6 | BinaryExpression op='>' left=#7 right=3 type=#8
   7 | IdentifierExpression name='x' referent=#2 type=#4
   8 | Type name='boolean'
   9 | Variable name='y' readOnly=false initializer=#10 type=#8
  10 | AndExpression conjuncts=[false,#11] type=#8
  11 | OrExpression disjuncts=[true,#12] type=#8
  12 | BinaryExpression op='>=' left=2 right=#13 type=#8
  13 | IdentifierExpression name='x' referent=#2 type=#4
  14 | IfStatement test=false consequent=[#15,#20] alternative=#21
  15 | Variable name='hello' readOnly=true initializer=#16 type=#4
  16 | BinaryExpression op='/' left=#17 right=#19 type=#4
  17 | BinaryExpression op='+' left=0 right=#18 type=#4
  18 | IdentifierExpression name='x' referent=#2 type=#4
  19 | BinaryExpression op='**' left=2 right=1 type=#4
  20 | PrintStatement argument=1
  21 | IfStatement test=true consequent=[#22] alternative=[#23]
  22 | Variable name='hello' readOnly=false initializer=false type=#8
  23 | PrintStatement argument=#24
  24 | IdentifierExpression name='y' referent=#9 type=#8
  25 | PrintStatement argument=#26
  26 | IdentifierExpression name='x' referent=#2 type=#4`

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
  ["non-boolean if test", "if 1 {}", /if' operand must be a boolean/],
  ["non-boolean while test", "while 1 {}", /while' operand must be a boolean/],
  [
    "shadowing",
    "let x = 1\nwhile true {let x = 1}",
    /Identifier x already declared/,
  ],
]

describe("The analyzer", () => {
  for (const [scenario, source, errorMessagePattern] of semanticErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => analyze(parse(source)), errorMessagePattern)
    })
  }
  it("can analyze all the nodes", () => {
    assert.deepStrictEqual(util.format(analyze(parse(source))), expectedAst)
  })
})
