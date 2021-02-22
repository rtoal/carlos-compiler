import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `
  let x = 1024 - 0
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
  }
`

const expectedAst = `
   1 | Program statements=[#2,#6]
   2 | VariableDeclaration name='x' readOnly=false initializer=#3 variable=#5
   3 | BinaryExpression op='-' left=1024 right=0 type=#4
   4 | Type name='number'
   5 | Variable name='x' readOnly=false type=#4
   6 | WhileStatement test=#7 body=[#9,#14,#25]
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
  20 | PrintStatement argument=1
  21 | IfStatement test=true consequent=[#22] alternative=[#24]
  22 | VariableDeclaration name='hello' readOnly=false initializer=false variable=#23
  23 | Variable name='hello' readOnly=false type=#8
  24 | PrintStatement argument=#13
  25 | PrintStatement argument=#5
`.slice(1, -1)

const semanticErrors = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
  ["assign to const", "const x = 1\nx = 2", /Cannot assign to constant x/],
  ["assign bad type", "let x=1\nx=true", /Cannot assign a boolean to a number/],
  ["bad types for ||", "print false||1", /a boolean but got a number/],
  ["bad types for &&", "print false&&1", /a boolean but got a number/],
  ["bad types for ==", "print false==1", /Operands do not have the same type/],
  ["bad types for !=", "print false==1", /Operands do not have the same type/],
  ["bad types for +", "print false+1", /a number but got a boolean/],
  ["bad types for -", "print false-1", /a number but got a boolean/],
  ["bad types for *", "print false*1", /a number but got a boolean/],
  ["bad types for /", "print false/1", /a number but got a boolean/],
  ["bad types for **", "print false**1", /a number but got a boolean/],
  ["bad types for <", "print false<1", /a number but got a boolean/],
  ["bad types for <=", "print false<=1", /a number but got a boolean/],
  ["bad types for >", "print false>1", /a number but got a boolean/],
  ["bad types for >=", "print false>=1", /a number but got a boolean/],
  ["bad types for negation", "print -true", /a number but got a boolean/],
  ["non-boolean if test", "if 1 {}", /a boolean but got a number/],
  ["non-boolean while test", "while 1 {}", /a boolean but got a number/],
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
