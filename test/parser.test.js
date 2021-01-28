import assert from "assert"
import util from "util"
import { BinaryExpression, Literal, Program, Variable } from "../src/ast.js"
import parse from "../src/parser.js"

const source = `let x = 1024
  function next(n: number): number {
    return n + 1
  }
  while x > 3 {
    let y = false && (true || 2 >= x)
    x = (0 + x) / 2 ** next(0) // call in expression
    if false {
      const hello = sqrt 100 - abs 3.1E0-3
      function g() { return }
      break
    } else if true {
      next(99)   // call statement
      let hello = y // a different hello
    } else {
      continue
    }
    print x   // TADA 🥑
  }`

const expectedAst = `   1 | Program statements=[$2,$4,$12]
   2 | Variable name='x' readOnly=false initializer=$3
   3 | Literal value=1024
   4 | Function name='next' parameters=[$5] returnTypeExpression=$7 body=[$8]
   5 | Parameter name='n' typeExpression=$6
   6 | NamedTypeExpression name='number'
   7 | NamedTypeExpression name='number'
   8 | ReturnStatement expression=$9
   9 | BinaryExpression op='+' left=$10 right=$11
  10 | IdentifierExpression name='n'
  11 | Literal value=1
  12 | WhileStatement test=$13 body=[$16,$24,$35,$56]
  13 | BinaryExpression op='>' left=$14 right=$15
  14 | IdentifierExpression name='x'
  15 | Literal value=3
  16 | Variable name='y' readOnly=false initializer=$17
  17 | AndExpression conjuncts=[$18,$19]
  18 | Literal value=false
  19 | OrExpression disjuncts=[$20,$21]
  20 | Literal value=true
  21 | BinaryExpression op='>=' left=$22 right=$23
  22 | Literal value=2
  23 | IdentifierExpression name='x'
  24 | Assignment target=$25 source=$26
  25 | IdentifierExpression name='x'
  26 | BinaryExpression op='/' left=$27 right=$30
  27 | BinaryExpression op='+' left=$28 right=$29
  28 | Literal value=0
  29 | IdentifierExpression name='x'
  30 | BinaryExpression op='**' left=$31 right=$32
  31 | Literal value=2
  32 | Call callee=$33 args=[$34]
  33 | IdentifierExpression name='next'
  34 | Literal value=0
  35 | IfStatement test=$36 consequent=[$37,$45,$47] alternative=$48
  36 | Literal value=false
  37 | Variable name='hello' readOnly=true initializer=$38
  38 | BinaryExpression op='-' left=$39 right=$44
  39 | BinaryExpression op='-' left=$40 right=$42
  40 | UnaryExpression op='sqrt' operand=$41
  41 | Literal value=100
  42 | UnaryExpression op='abs' operand=$43
  43 | Literal value=3.1
  44 | Literal value=3
  45 | Function name='g' parameters=[] returnTypeExpression=null body=[$46]
  46 | ReturnStatement expression=null
  47 | BreakStatement
  48 | IfStatement test=$49 consequent=[$50,$53] alternative=[$55]
  49 | Literal value=true
  50 | Call callee=$51 args=[$52]
  51 | IdentifierExpression name='next'
  52 | Literal value=99
  53 | Variable name='hello' readOnly=false initializer=$54
  54 | IdentifierExpression name='y'
  55 | ContinueStatement
  56 | PrintStatement argument=$57
  57 | IdentifierExpression name='x'`

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
  ["array type for param", "function f(x: [[[boolean]]]) {}"],
  ["array type returned", "function f(): [[number]] {}"],
  ["empty array literal", "print [number]()"],
  ["nonempty array literal", "print [number](1, 2, 3)"],
  ["subscript", "print a[100 - (3 * x)]"],
  ["subscript exp is writable", "a[2] = 50"],
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
  ["unbalanced brackets", "function f(): [number", /Line 1, col 22/],
  ["array lit w/o type", "print [1,2]", /Line 1, col 8/],
  ["empty subscript", "print a[]", /Line 1, col 9/],
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
