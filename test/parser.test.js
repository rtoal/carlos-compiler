import assert from "assert"
import util from "util"
import parse from "../src/parser.js"

const source = `let x = 1024
  function next(n: number): [number] {
    let a = [number](1, 2, 3)
    a[1] = 100
    return a
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

const expectedAst = `   1 | Program statements=[#2,#3,#17]
   2 | Variable name='x' readOnly=false initializer=1024
   3 | Function name='next' parameters=[#4] returnType=#6 body=[#8,#12,#15]
   4 | Parameter name='n' type=#5
   5 | NamedType name='number'
   6 | ArrayType baseType=#7
   7 | NamedType name='number'
   8 | Variable name='a' readOnly=false initializer=#9
   9 | ArrayLiteral arrayType=#10 args=[1,2,3]
  10 | ArrayType baseType=#11
  11 | NamedType name='number'
  12 | Assignment target=#13 source=100
  13 | SubscriptExpression array=#14 element=1
  14 | IdentifierExpression name='a'
  15 | ReturnStatement expression=#16
  16 | IdentifierExpression name='a'
  17 | WhileStatement test=#18 body=[#20,#25,#33,#47]
  18 | BinaryExpression op='>' left=#19 right=3
  19 | IdentifierExpression name='x'
  20 | Variable name='y' readOnly=false initializer=#21
  21 | AndExpression conjuncts=[false,#22]
  22 | OrExpression disjuncts=[true,#23]
  23 | BinaryExpression op='>=' left=2 right=#24
  24 | IdentifierExpression name='x'
  25 | Assignment target=#26 source=#27
  26 | IdentifierExpression name='x'
  27 | BinaryExpression op='/' left=#28 right=#30
  28 | BinaryExpression op='+' left=0 right=#29
  29 | IdentifierExpression name='x'
  30 | BinaryExpression op='**' left=2 right=#31
  31 | Call callee=#32 args=[0]
  32 | IdentifierExpression name='next'
  33 | IfStatement test=false consequent=[#34,#35,#40] alternative=#41
  34 | Variable name='hello' readOnly=true initializer=5
  35 | Function name='g' parameters=[] returnType=#36 body=[#37,#39]
  36 | NamedType name='void'
  37 | PrintStatement argument=#38
  38 | IdentifierExpression name='hello'
  39 | ReturnStatement expression=null
  40 | BreakStatement
  41 | IfStatement test=true consequent=[#42,#44] alternative=[#46]
  42 | Call callee=#43 args=[99]
  43 | IdentifierExpression name='next'
  44 | Variable name='hello' readOnly=false initializer=#45
  45 | IdentifierExpression name='y'
  46 | ContinueStatement
  47 | PrintStatement argument=#48
  48 | IdentifierExpression name='x'`

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
  ["array type for param", "function f(x: [[[boolean]]]) {}"],
  ["array type returned", "function f(): [[number]] {}"],
  ["empty array literal", "print [number]()"],
  ["nonempty array literal", "print [number](1, 2, 3)"],
  ["subscript", "print a[100 - (3 * x)]"],
  ["subscript exp is writable", "a[2] = 50"],
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
  ["unbalanced brackets", "function f(): number[", /Line 1, col 21/],
  ["fake array literal", "print [1,2]", /Line 1, col 8/],
  ["empty subscript", "print a[]", /Line 1, col 9/],
  ["true is reserved", "true = 1", /Line 1, col 1/],
  ["false is reserved", "true = 1", /Line 1, col 1/],
  [
    "non-parenthesized function type",
    "function f(g:number->number) {}",
    /Line 1, col 20/,
  ],
]

describe("The parser", () => {
  for (const [scenario, source] of syntaxChecks) {
    it(`recognizes ${scenario}`, () => {
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
