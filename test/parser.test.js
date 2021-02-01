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
      const hello = 5
      function g() { print hello return }
      break
    } else if true {
      next(99)   // call statement
      let hello = y // a different hello
    } else {
      continue
    }
    print x   // TADA 🥑
  }`

const expectedAst = `   1 | Program statements=[#2,#3,#8]
   2 | Variable name='x' readOnly=false initializer=1024
   3 | Function name='next' parameters=[#4] typeName='number' body=[#5]
   4 | Parameter name='n' typeName='number'
   5 | ReturnStatement expression=#6
   6 | BinaryExpression op='+' left=#7 right=1
   7 | IdentifierExpression name='n'
   8 | WhileStatement test=#9 body=[#11,#16,#24,#37]
   9 | BinaryExpression op='>' left=#10 right=3
  10 | IdentifierExpression name='x'
  11 | Variable name='y' readOnly=false initializer=#12
  12 | AndExpression conjuncts=[false,#13]
  13 | OrExpression disjuncts=[true,#14]
  14 | BinaryExpression op='>=' left=2 right=#15
  15 | IdentifierExpression name='x'
  16 | Assignment target=#17 source=#18
  17 | IdentifierExpression name='x'
  18 | BinaryExpression op='/' left=#19 right=#21
  19 | BinaryExpression op='+' left=0 right=#20
  20 | IdentifierExpression name='x'
  21 | BinaryExpression op='**' left=2 right=#22
  22 | Call callee=#23 args=[0]
  23 | IdentifierExpression name='next'
  24 | IfStatement test=false consequent=[#25,#26,#30] alternative=#31
  25 | Variable name='hello' readOnly=true initializer=5
  26 | Function name='g' parameters=[] typeName=null body=[#27,#29]
  27 | PrintStatement argument=#28
  28 | IdentifierExpression name='hello'
  29 | ReturnStatement expression=null
  30 | BreakStatement
  31 | IfStatement test=true consequent=[#32,#34] alternative=[#36]
  32 | Call callee=#33 args=[99]
  33 | IdentifierExpression name='next'
  34 | Variable name='hello' readOnly=false initializer=#35
  35 | IdentifierExpression name='y'
  36 | ContinueStatement
  37 | PrintStatement argument=#38
  38 | IdentifierExpression name='x'`

const syntaxChecks = [
  ["all numeric literal forms", "print 8 * 89.123 * 1.3E5 * 1.3E+5 * 1.3E-5"],
  ["complex expressions", "print 83 * ((((((((-13 / 21)))))))) + 1 - -0"],
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
    it(`recognizes that ${scenario}`, () => {
      assert(parse(source))
    })
  }
  for (const [scenario, source, errorMessagePattern] of syntaxErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => parse(source), errorMessagePattern)
    })
  }
  it("produces the expected AST for all node types", () => {
    assert.deepStrictEqual(util.format(parse(source)), expectedAst)
  })
})
