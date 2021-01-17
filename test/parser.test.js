import assert from "assert"
import util from "util"
import parse from "../src/parser.js"

const source = `let x = 1024 - 0
  function next(n: number): number {
    return n + 1
  }
  while x > 3 {
    let y = false && (true || 2 >= x)
    x = (0 + x) / 2 ** next(0)
    if false {
      const hello = sqrt 100 - abs 3.1-3
      print 1
    } else if true {
      let hello = false // A different hello
    } else {
      print y
      break
      continue
    }
    print x   // TADA 🥑
  }`

const expectedAst = `   1 | program: Program
   2 |   statements[0]: VariableDeclaration name='x' readOnly=false
   3 |     initializer: BinaryExpression op='-'
   4 |       left: Literal value=1024
   5 |       right: Literal value=0
   6 |   statements[1]: FunDeclaration
   7 |     name: IdentifierExpression name='next'
   8 |     parameters[0]: Binding name='n'
   9 |       typeExpression: NamedTypeExpression name='number'
  10 |     returnTypeExpression[0]: NamedTypeExpression name='number'
  11 |     body[0]: ReturnStatement
  12 |       expression: BinaryExpression op='+'
  13 |         left: IdentifierExpression name='n'
  14 |         right: Literal value=1
  15 |   statements[2]: WhileStatement
  16 |     test: BinaryExpression op='>'
  17 |       left: IdentifierExpression name='x'
  18 |       right: Literal value=3
  19 |     body[0]: VariableDeclaration name='y' readOnly=false
  20 |       initializer: AndExpression
  21 |         conjuncts[0]: IdentifierExpression name='false'
  22 |         conjuncts[1]: OrExpression
  23 |           disjuncts[0]: IdentifierExpression name='true'
  24 |           disjuncts[1]: BinaryExpression op='>='
  25 |             left: Literal value=2
  26 |             right: IdentifierExpression name='x'
  27 |     body[1]: Assignment
  28 |       target: IdentifierExpression name='x'
  29 |       source: BinaryExpression op='/'
  30 |         left: BinaryExpression op='+'
  31 |           left: Literal value=0
  32 |           right: IdentifierExpression name='x'
  33 |         right: BinaryExpression op='**'
  34 |           left: Literal value=2
  35 |           right: Call
  36 |             callee: IdentifierExpression name='next'
  37 |             args[0]: Literal value=0
  38 |     body[2]: IfStatement
  39 |       test: IdentifierExpression name='false'
  40 |       consequent[0]: VariableDeclaration name='hello' readOnly=true
  41 |         initializer: BinaryExpression op='-'
  42 |           left: BinaryExpression op='-'
  43 |             left: UnaryExpression op='sqrt'
  44 |               operand: Literal value=100
  45 |             right: UnaryExpression op='abs'
  46 |               operand: Literal value=3.1
  47 |           right: Literal value=3
  48 |       consequent[1]: PrintStatement
  49 |         argument: Literal value=1
  50 |       alternative: IfStatement
  51 |         test: IdentifierExpression name='true'
  52 |         consequent[0]: VariableDeclaration name='hello' readOnly=false
  53 |           initializer: IdentifierExpression name='false'
  54 |         alternative[0]: PrintStatement
  55 |           argument: IdentifierExpression name='y'
  56 |         alternative[1]: BreakStatement
  57 |         alternative[2]: ContinueStatement
  58 |     body[3]: PrintStatement
  59 |       argument: IdentifierExpression name='x'`

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
  ["function with no params", "function f() {}"],
  ["function with one param", "function f(x: number) {}"],
  ["function with two params", "function f(x: number, y: boolean) {}"],
  ["function with no params", "function f(): number {}"],
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
