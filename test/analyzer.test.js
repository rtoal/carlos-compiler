import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let count = 101.3E-5 - 0
  print(1 * count)   // TADA 🥑`

const expectedAst = String.raw`   1 | Program statements=[#2,#5]
   2 | VariableDeclaration name='count' initializer=#3 variable=#4
   3 | BinaryExpression op='-' left=0.001013 right=0
   4 | Variable name='count'
   5 | PrintStatement argument=#6
   6 | BinaryExpression op='*' left=1 right=#4`

const semanticErrors = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
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
