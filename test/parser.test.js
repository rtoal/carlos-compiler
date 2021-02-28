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
  }
`

const expectedAst = `
   1 | Program statements=[#2,#3,#10]
   2 | VariableDeclaration name='x' readOnly=false initializer=1024
   3 | FunctionDeclaration name='next' parameters=[#4] returnType=#6 body=[#7]
   4 | Parameter name='n' type=#5
   5 | TypeName name='number'
   6 | TypeName name='number'
   7 | ReturnStatement expression=#8
   8 | BinaryExpression op='+' left=#9 right=1
   9 | IdentifierExpression name='n'
  10 | WhileStatement test=#11 body=[#13,#18,#26,#39]
  11 | BinaryExpression op='>' left=#12 right=3
  12 | IdentifierExpression name='x'
  13 | VariableDeclaration name='y' readOnly=false initializer=#14
  14 | AndExpression conjuncts=[false,#15]
  15 | OrExpression disjuncts=[true,#16]
  16 | BinaryExpression op='>=' left=2 right=#17
  17 | IdentifierExpression name='x'
  18 | Assignment target=#19 source=#20
  19 | IdentifierExpression name='x'
  20 | BinaryExpression op='/' left=#21 right=#23
  21 | BinaryExpression op='+' left=0 right=#22
  22 | IdentifierExpression name='x'
  23 | BinaryExpression op='**' left=2 right=#24
  24 | Call callee=#25 args=[0]
  25 | IdentifierExpression name='next'
  26 | IfStatement test=false consequent=[#27,#28,#32] alternative=#33
  27 | VariableDeclaration name='hello' readOnly=true initializer=5
  28 | FunctionDeclaration name='g' parameters=[] returnType=null body=[#29,#31]
  29 | PrintStatement argument=#30
  30 | IdentifierExpression name='hello'
  31 | ReturnStatement expression=null
  32 | BreakStatement
  33 | IfStatement test=true consequent=[#34,#36] alternative=[#38]
  34 | Call callee=#35 args=[99]
  35 | IdentifierExpression name='next'
  36 | VariableDeclaration name='hello' readOnly=false initializer=#37
  37 | IdentifierExpression name='y'
  38 | ContinueStatement
  39 | PrintStatement argument=#40
  40 | IdentifierExpression name='x'
`.slice(1, -1)

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
  ["function types in params", "function f(g: (number)->boolean) {}"],
  ["function types returned", "function f(): (number)->(number)->void {}"],
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
  ["false is reserved", "false = 1", /Line 1, col 1/],
  [
    "non-parenthesized function type",
    "function f(g:number->number) {}",
    /Line 1, col 20/,
  ],
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
