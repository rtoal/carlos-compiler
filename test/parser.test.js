import assert from "assert"
import util from "util"
import parse from "../src/parser.js"

const source = `let x = 1024
  function next(n: number): number {
    return n + 1
  }
  while x > 3 {
    let y = false && (true || 2 >= x)
    x = (0 + x) / 2 ** next(0) // call in expression
    if false {
      const hello = sqrt 100 - abs 3.1-3
      function g() { return }
    } else if true {
      next(y)   // call statement
      let hello = 0 // a different hello
    } else {
      break
      continue
    }
    print x   // TADA 🥑
  }`

const expectedAst = `   1 | program: Program
   2 |   statements[0]: Variable name='x' readOnly=false
   3 |     initializer: Literal value=1024
   4 |   statements[1]: Function name='next'
   5 |     parameters[0]: Parameter name='n'
   6 |       typeExpression: NamedTypeExpression name='number'
   7 |     returnTypeExpression: NamedTypeExpression name='number'
   8 |     body[0]: ReturnStatement
   9 |       expression: BinaryExpression op='+'
  10 |         left: IdentifierExpression name='n'
  11 |         right: Literal value=1
  12 |   statements[2]: WhileStatement
  13 |     test: BinaryExpression op='>'
  14 |       left: IdentifierExpression name='x'
  15 |       right: Literal value=3
  16 |     body[0]: Variable name='y' readOnly=false
  17 |       initializer: AndExpression
  18 |         conjuncts[0]: IdentifierExpression name='false'
  19 |         conjuncts[1]: OrExpression
  20 |           disjuncts[0]: IdentifierExpression name='true'
  21 |           disjuncts[1]: BinaryExpression op='>='
  22 |             left: Literal value=2
  23 |             right: IdentifierExpression name='x'
  24 |     body[1]: Assignment
  25 |       target: IdentifierExpression name='x'
  26 |       source: BinaryExpression op='/'
  27 |         left: BinaryExpression op='+'
  28 |           left: Literal value=0
  29 |           right: IdentifierExpression name='x'
  30 |         right: BinaryExpression op='**'
  31 |           left: Literal value=2
  32 |           right: Call
  33 |             callee: IdentifierExpression name='next'
  34 |             args[0]: Literal value=0
  35 |     body[2]: IfStatement
  36 |       test: IdentifierExpression name='false'
  37 |       consequent[0]: Variable name='hello' readOnly=true
  38 |         initializer: BinaryExpression op='-'
  39 |           left: BinaryExpression op='-'
  40 |             left: UnaryExpression op='sqrt'
  41 |               operand: Literal value=100
  42 |             right: UnaryExpression op='abs'
  43 |               operand: Literal value=3.1
  44 |           right: Literal value=3
  45 |       consequent[1]: Function name='g' returnTypeExpression=null
  46 |         body[0]: ReturnStatement expression=null
  47 |       alternative: IfStatement
  48 |         test: IdentifierExpression name='true'
  49 |         consequent[0]: Call
  50 |           callee: IdentifierExpression name='next'
  51 |           args[0]: IdentifierExpression name='y'
  52 |         consequent[1]: Variable name='hello' readOnly=false
  53 |           initializer: Literal value=0
  54 |         alternative[0]: BreakStatement
  55 |         alternative[1]: ContinueStatement
  56 |     body[3]: PrintStatement
  57 |       argument: IdentifierExpression name='x'`

const syntaxChecks = [
  ["integers and floating point literals", "print 8 * 899.123 / 89.11E-1"],
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
  ["function with no params, no return type", "function f() {}"],
  ["function with one param", "function f(x: number) {}"],
  ["function with two params", "function f(x: number, y: boolean) {}"],
  ["function with no params + return type", "function f(): number {}"],
  ["call in exp", "print 5 * f(x, y, 2 * y)"],
  ["call in statement", "let x = 1\nf(100)\nprint 1"],
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
