import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let two = 2 - 0
  print(1 ** two)   // TADA 🥑 
  two = sqrt 101.3E-5
  const x = 8`

const expectedAst = String.raw`   1 | Program statements=[$2,$6,$10,$14]
   2 | Variable name='two' readOnly=false initializer=$3
   3 | BinaryExpression op='-' left=$4 right=$5
   4 | Literal value=2
   5 | Literal value=0
   6 | PrintStatement argument=$7
   7 | BinaryExpression op='**' left=$8 right=$9
   8 | Literal value=1
   9 | IdentifierExpression name='two' referent=$2
  10 | Assignment target=$11 source=$12
  11 | IdentifierExpression name='two' referent=$2
  12 | UnaryExpression op='sqrt' operand=$13
  13 | Literal value=0.001013
  14 | Variable name='x' readOnly=true initializer=$15
  15 | Literal value=8`

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
