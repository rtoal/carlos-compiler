import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let two = 2 - 0
  print(1 * two)   // TADA 🥑 
  two = sqrt 101.3E-5
  const x = true + true`

const expectedAst = String.raw`   1 | program: Program
   2 |   statements[0]: VariableDeclaration name='two' readOnly=false
   3 |     initializer: BinaryExpression op='-'
   4 |       left: Literal value=2
   5 |       right: Literal value=0
   6 |     variable: Variable name='two' readOnly=false
   7 |   statements[1]: PrintStatement
   8 |     argument: BinaryExpression op='*'
   9 |       left: Literal value=1
  10 |       right: IdentifierExpression name='two' referent=$6
  11 |   statements[2]: Assignment
  12 |     target: IdentifierExpression name='two' referent=$6
  13 |     source: UnaryExpression op='sqrt'
  14 |       operand: Literal value=0.001013
  15 |   statements[3]: VariableDeclaration name='x' readOnly=true
  16 |     initializer: BinaryExpression op='+'
  17 |       left: IdentifierExpression name='true'
  18 |         referent: Variable name='true' readOnly=true
  19 |       right: IdentifierExpression name='true' referent=$18
  20 |     variable: Variable name='x' readOnly=true`

const semanticErrors = [
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
  for (const [scenario, source, errorMessagePattern] of semanticErrors) {
    it(`throws on ${scenario}`, done => {
      assert.throws(() => analyze(parse(source)), errorMessagePattern)
      done()
    })
  }
})
