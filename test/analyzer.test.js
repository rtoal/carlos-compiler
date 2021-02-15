import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let count = 101.3E-5 - 0
  print(1 ** count)   // TADA 🥑
  const x = 1 < 5 || false == true`

const expectedAst = String.raw`   1 | Program statements=[#2,#6,#8]
   2 | VariableDeclaration name='count' readOnly=false initializer=#3 variable=#5
   3 | BinaryExpression op='-' left=0.001013 right=0 type=#4
   4 | Type name='number'
   5 | Variable name='count' readOnly=false type=#4
   6 | PrintStatement argument=#7
   7 | BinaryExpression op='**' left=1 right=#5 type=#4
   8 | VariableDeclaration name='x' readOnly=true initializer=#9 variable=#13
   9 | OrExpression disjuncts=[#10,#12] type=#11
  10 | BinaryExpression op='<' left=1 right=5 type=#11
  11 | Type name='boolean'
  12 | BinaryExpression op='==' left=false right=true type=#11
  13 | Variable name='x' readOnly=true type=#11`

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
