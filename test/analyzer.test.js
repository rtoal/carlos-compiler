import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let two = 2 - 0
  print(1 * two)   // TADA 🥑 
  two = sqrt 101.3E-5
  const x = 8`

const expectedAst = String.raw`   1 | program: Program
   2 |   statements[0]: Variable name='two' readOnly=false
   3 |     initializer: BinaryExpression op='-'
   4 |       left: Literal value=2
   5 |       right: Literal value=0
   6 |   statements[1]: PrintStatement
   7 |     argument: BinaryExpression op='*'
   8 |       left: Literal value=1
   9 |       right: IdentifierExpression name='two' referent=$2
  10 |   statements[2]: Assignment
  11 |     target: IdentifierExpression name='two' referent=$2
  12 |     source: UnaryExpression op='sqrt'
  13 |       operand: Literal value=0.001013
  14 |   statements[3]: Variable name='x' readOnly=true
  15 |     initializer: Literal value=8`

const semanticErrors = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
  ["assign to const", "const x = 1\nx = 2", /Cannot assign to constant x/],
]

describe("The analyzer", () => {
  it("can analyze all the nodes", done => {
    assert.deepStrictEqual(util.format(analyze(parse(source))), expectedAst)
    done()
  })
  for (const [scenario, source, errorMessagePattern] of semanticErrors) {
    it(`throws on ${scenario}`, done => {
      assert.throws(() => analyze(parse(source)), errorMessagePattern)
      done()
    })
  }
})
