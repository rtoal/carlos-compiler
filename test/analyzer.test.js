import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let two = 2 - 0
  print(1 * two)   // TADA 🥑 
  two = sqrt 101.3
  const x = 8`

const expectedAst = String.raw`   1 | program: Program
   2 |   statements[0]: Declaration name='two' readOnly=false
   3 |     initializer: BinaryExpression op='-'
   4 |       left: LiteralExpression value=2
   5 |       right: LiteralExpression value=0
   6 |   statements[1]: PrintStatement
   7 |     expression: BinaryExpression op='*'
   8 |       left: LiteralExpression value=1
   9 |       right: IdentifierExpression name='two' ref=$2
  10 |   statements[2]: Assignment
  11 |     target: IdentifierExpression name='two' ref=$2
  12 |     source: UnaryExpression op='sqrt'
  13 |       operand: LiteralExpression value=101.3
  14 |   statements[3]: Declaration name='x' readOnly=true
  15 |     initializer: LiteralExpression value=8`

const errorFixture = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
  ["assign to const", "const x = 1\nx = 2", /Cannot assign to constant x/],
  ["redeclare true", "let true = 1", /Identifier true already declared/],
  ["assign to true", "true = 1", /Cannot assign to constant true/],
  ["redeclare false", "let false = 1", /Identifier false already declared/],
  ["assign to false", "false = 1", /Cannot assign to constant false/],
]

describe("The analyzer", () => {
  it("can analyze all the nodes", done => {
    assert.deepStrictEqual(util.format(analyze(parse(source))), expectedAst)
    done()
  })
  for (const [scenario, source, errorMessagePattern] of errorFixture) {
    it(`throws on ${scenario}`, done => {
      assert.throws(() => analyze(parse(source)), errorMessagePattern)
      done()
    })
  }
})
