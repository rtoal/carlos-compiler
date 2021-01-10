import assert from "assert"
import util from "util"
import parse from "../src/parser.js"

const source = `let x = 1024 - 0
  while x > 3 {
    let y = false && (true || 2 >= x)
    x = (0 + x) / 2 ** 1
    if false {
      const hello = sqrt 100 - abs 3.1-3
      print 1
    } else if true {
      let hello = false // A different hello
    } else {
      print y
    }
    print x   // TADA 🥑
  }`

const expectedAst = `   1 | program: Program
   2 |   statements[0]: Declaration name='x' readOnly=false
   3 |     initializer: BinaryExpression op='-'
   4 |       left: LiteralExpression value=1024
   5 |       right: LiteralExpression value=0
   6 |   statements[1]: WhileStatement
   7 |     test: BinaryExpression op='>'
   8 |       left: IdentifierExpression name='x'
   9 |       right: LiteralExpression value=3
  10 |     body[0]: Declaration name='y' readOnly=false
  11 |       initializer: AndExpression
  12 |         conjuncts[0]: IdentifierExpression name='false'
  13 |         conjuncts[1]: OrExpression
  14 |           disjuncts[0]: IdentifierExpression name='true'
  15 |           disjuncts[1]: BinaryExpression op='>='
  16 |             left: LiteralExpression value=2
  17 |             right: IdentifierExpression name='x'
  18 |     body[1]: Assignment
  19 |       target: IdentifierExpression name='x'
  20 |       source: BinaryExpression op='/'
  21 |         left: BinaryExpression op='+'
  22 |           left: LiteralExpression value=0
  23 |           right: IdentifierExpression name='x'
  24 |         right: BinaryExpression op='**'
  25 |           left: LiteralExpression value=2
  26 |           right: LiteralExpression value=1
  27 |     body[2]: IfStatement
  28 |       test: IdentifierExpression name='false'
  29 |       consequent[0]: Declaration name='hello' readOnly=true
  30 |         initializer: BinaryExpression op='-'
  31 |           left: BinaryExpression op='-'
  32 |             left: UnaryExpression op='sqrt'
  33 |               operand: LiteralExpression value=100
  34 |             right: UnaryExpression op='abs'
  35 |               operand: LiteralExpression value=3.1
  36 |           right: LiteralExpression value=3
  37 |       consequent[1]: PrintStatement
  38 |         expression: LiteralExpression value=1
  39 |       alternative: IfStatement
  40 |         test: IdentifierExpression name='true'
  41 |         consequent[0]: Declaration name='hello' readOnly=false
  42 |           initializer: IdentifierExpression name='false'
  43 |         alternative[0]: PrintStatement
  44 |           expression: IdentifierExpression name='y'
  45 |     body[3]: PrintStatement
  46 |       expression: IdentifierExpression name='x'`

const syntaxChecks = [
  ["integers and floating point literals", "print 8 * 899.123"],
  ["complex expressions", "print 83 * ((((((((13 / 21)))))))) + 1 - sqrt 0"],
  ["end of program inside comment", "print 0 // yay"],
  ["comments with no text", "print 1//\nprint 0//"],
  ["non-Latin letters in identifiers", "let コンパイラ = 100"],
  ["ors can be chained", "print 1 || 2 || 3 || 4 || 5"],
  ["ands can be chained", "print 1 && 2 && 3 && 4 && 5"],
  ["relational operators", "print 1<2||1<=2||1==2||1!=2||1>=2||1>2"],
  ["short if", "if true { print 1 }"],
  ["longer if", "if true { print 1 } else { print 1 }"],
  ["even longer if", "if true { print 1 } else if false { print 1}"],
  ["while with empty block", "while true {}"],
  ["while with one statement block", "while true { let x = 1 }"],
  ["while with long block", "while true { print 1\nprint 2\nprint 3 }"],
  ["if inside while", "while true { if true { print 1 } }"],
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
  ["while without braces", "while true\nprint 1", /Line 2, col 1/],
  ["if without braces", "if x < 3\nprint 1", /Line 2, col 1/],
  ["while as identifier", "let while = 3", /Line 1, col 5/],
  ["if as identifier", "let if = 8", /Line 1, col 5/],
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
