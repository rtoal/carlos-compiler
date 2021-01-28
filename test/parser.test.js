import assert from "assert"
import util from "util"
import { BinaryExpression, Literal, Program, Variable } from "../src/ast.js"
import parse from "../src/parser.js"

const source = `let x = 1024 - 0
  while x > 3 {
    let y = false && (true || 2 >= x)
    x = (0 + x) / 2 ** 1
    if false {
      const hello = sqrt 100 - abs 3.1E0-3
      break
    } else if true {
      let hello = false // A different hello
    } else {
      print y
      continue
    }
    print x   // TADA 🥑
  }`

const expectedAst = `   1 | Program statements=[$2,$6]
   2 | Variable name='x' readOnly=false initializer=$3
   3 | BinaryExpression op='-' left=$4 right=$5
   4 | Literal value=1024
   5 | Literal value=0
   6 | WhileStatement test=$7 body=[$10,$18,$27,$45]
   7 | BinaryExpression op='>' left=$8 right=$9
   8 | IdentifierExpression name='x'
   9 | Literal value=3
  10 | Variable name='y' readOnly=false initializer=$11
  11 | AndExpression conjuncts=[$12,$13]
  12 | Literal value=false
  13 | OrExpression disjuncts=[$14,$15]
  14 | Literal value=true
  15 | BinaryExpression op='>=' left=$16 right=$17
  16 | Literal value=2
  17 | IdentifierExpression name='x'
  18 | Assignment target=$19 source=$20
  19 | IdentifierExpression name='x'
  20 | BinaryExpression op='/' left=$21 right=$24
  21 | BinaryExpression op='+' left=$22 right=$23
  22 | Literal value=0
  23 | IdentifierExpression name='x'
  24 | BinaryExpression op='**' left=$25 right=$26
  25 | Literal value=2
  26 | Literal value=1
  27 | IfStatement test=$28 consequent=[$29,$37] alternative=$38
  28 | Literal value=false
  29 | Variable name='hello' readOnly=true initializer=$30
  30 | BinaryExpression op='-' left=$31 right=$36
  31 | BinaryExpression op='-' left=$32 right=$34
  32 | UnaryExpression op='sqrt' operand=$33
  33 | Literal value=100
  34 | UnaryExpression op='abs' operand=$35
  35 | Literal value=3.1
  36 | Literal value=3
  37 | BreakStatement
  38 | IfStatement test=$39 consequent=[$40] alternative=[$42,$44]
  39 | Literal value=true
  40 | Variable name='hello' readOnly=false initializer=$41
  41 | Literal value=false
  42 | PrintStatement argument=$43
  43 | IdentifierExpression name='y'
  44 | ContinueStatement
  45 | PrintStatement argument=$46
  46 | IdentifierExpression name='x'`

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
  ["while without braces", "while true\nprint 1", /Line 2, col 1/],
  ["if without braces", "if x < 3\nprint 1", /Line 2, col 1/],
  ["while as identifier", "let while = 3", /Line 1, col 5/],
  ["if as identifier", "let if = 8", /Line 1, col 5/],
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
