import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let count = 101.3 - 10.13E-5
  print(1 ** count)   // TADA 🥑
  const x = 1 < 5 || false == true
`

const expectedAst = `
   1 | Program statements=[#2,#5,#7]
   2 | VariableDeclaration name='count' readOnly=false initializer=#3 variable=#4
   3 | BinaryExpression op='-' left=101.3 right=0.0001013
   4 | Variable name='count' readOnly=false
   5 | PrintStatement argument=#6
   6 | BinaryExpression op='**' left=1 right=#4
   7 | VariableDeclaration name='x' readOnly=true initializer=#8 variable=#11
   8 | OrExpression disjuncts=[#9,#10]
   9 | BinaryExpression op='<' left=1 right=5
  10 | BinaryExpression op='==' left=false right=true
  11 | Variable name='x' readOnly=true
`.slice(1, -1)

const semanticErrors = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
  ["assign to const", "const x = 1\nx = 2", /Cannot assign to constant x/],
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
