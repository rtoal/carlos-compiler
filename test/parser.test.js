import assert from "assert"
import util from "util"
import { BinaryExpression, Literal, Program, Variable } from "../src/ast.js"
import parse from "../src/parser.js"

const source = `let two = 2 - 0
  print (1 * two) / 1   // TADA 🥑 
  two = sqrt 101.3E-5
  const x = 1 < 5 || false == true`

const expectedAst = `   1 | Program statements=[$2,$6,$11,$15]
   2 | Variable name='two' readOnly=false initializer=$3
   3 | BinaryExpression op='-' left=$4 right=$5
   4 | Literal value=2
   5 | Literal value=0
   6 | PrintStatement argument=$7
   7 | BinaryExpression op='/' left=$8 right=$9
   8 | BinaryExpression op='*' left=$9 right=$10
   9 | Literal value=1
  10 | IdentifierExpression name='two'
  11 | Assignment target=$12 source=$13
  12 | IdentifierExpression name='two'
  13 | UnaryExpression op='sqrt' operand=$14
  14 | Literal value=0.001013
  15 | Variable name='x' readOnly=true initializer=$16
  16 | OrExpression disjuncts=[$17,$19]
  17 | BinaryExpression op='<' left=$9 right=$18
  18 | Literal value=5
  19 | BinaryExpression op='==' left=$20 right=$21
  20 | Literal value=false
  21 | Literal value=true`

const syntaxChecks = [
  ["integers and floating point literals", "print 8 * 899.123"],
  ["complex expressions", "print 83 * ((((((((13 / 21)))))))) + 1 - sqrt 0"],
  ["end of program inside comment", "print 0 // yay"],
  ["comments with no text", "print 1//\nprint 0//"],
  ["non-Latin letters in identifiers", "let コンパイラ = 100"],
  ["ors can be chained", "print 1 || 2 || 3 || 4 || 5"],
  ["ands can be chained", "print 1 && 2 && 3 && 4 && 5"],
  ["relational operators", "print 1<2||3<=4||5==6||7!=8||9>=10||10>11"],
  ["boolean literals", "let x = false || true"],
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
  ["mixing ands and ors", "print 1 && 2 || 3", /Line 1, col 14:/],
  ["mixing ors and ands", "print 1 || 2 && 3", /Line 1, col 14:/],
  ["associating relational operators", "print 1 < 2 < 3", /Line 1, col 13:/],
  ["true is reserved", "true = 1", /Line 1, col 1/],
  ["false is reserved", "true = 1", /Line 1, col 1/],
]

describe("The parser", () => {
  for (const [scenario, source] of syntaxChecks) {
    it(`recognizes ${scenario}`, done => {
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
