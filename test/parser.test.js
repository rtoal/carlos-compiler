import assert from "assert"
import util from "util"
import parse from "../src/parser.js"

const source = `let two = 2 - 0
  print(1 ** two)   // TADA 🥑
  two = sqrt 101.3
  const x = 8`

const expectedAst = `   1 | program: Program
   2 |   statements[0]: Declaration name='two' readOnly=false
   3 |     initializer: BinaryExpression op='-'
   4 |       left: LiteralExpression value=2
   5 |       right: LiteralExpression value=0
   6 |   statements[1]: PrintStatement
   7 |     expression: BinaryExpression op='**'
   8 |       left: LiteralExpression value=1
   9 |       right: IdentifierExpression name='two'
  10 |   statements[2]: Assignment
  11 |     target: IdentifierExpression name='two'
  12 |     source: UnaryExpression op='sqrt'
  13 |       operand: LiteralExpression value=101.3
  14 |   statements[3]: Declaration name='x' readOnly=true
  15 |     initializer: LiteralExpression value=8`

const syntaxChecks = [
  ["integers and floating point literals", "print 8 * 899.123"],
  ["complex expressions", "print 83 * ((((((((13 / 21)))))))) + 1 - sqrt 0"],
  ["end of program inside comment", "print 0 // yay"],
  ["comments with no text", "print 1//\nprint 0//"],
  ["non-Latin letters in identifiers", "let コンパイラ = 100"],
]

const syntaxErrors = [
  ["non-letter in an identifier", "let ab😭c = 2", /Line 1, col 7:/],
  ["malformed number", "let x= 2.", /Line 1, col 10:/],
  ["a number with an E but no exponent", "let x = 5E * 11", /Line 1, col 12:/],
  ["a missing right operand", "print 5 -", /Line 1, col 10:/],
  ["a non-operator", "print 7 * ((2 _ 3)", /Line 1, col 15:/],
  ["an expression starting with a )", "print )", /Line 1, col 7:/],
  ["a statement starting with expression", "x * 5", /Line 1, col 3:/],
  ["an illegal statement on line 2", "print 5\nx * 5", /Line 2, col 3:/],
  ["a statement starting with a )", "print 5\n) * 5", /Line 2, col 1:/],
  ["an expression starting with a *", "let x = * 71", /Line 1, col 9:/],
  ["negation before exponentiation", "print -2**2", /Line 1, col 10:/],
]

describe("The parser", () => {
  for (const [scenario, source] of syntaxChecks) {
    it(`recognizes that ${scenario}`, done => {
      assert(parse(source))
      done()
    })
  }
  for (const [scenario, source, errorMessagePattern] of syntaxErrors) {
    it(`throws on ${scenario}`, done => {
      assert.throws(() => parse(source), errorMessagePattern)
      done()
    })
  }
  it("produces the expected AST for all node types", done => {
    assert.deepStrictEqual(util.format(parse(source)), expectedAst)
    done()
  })
})
