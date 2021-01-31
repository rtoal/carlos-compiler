import assert from "assert"
import util from "util"
import { BinaryExpression, Literal, Program, Variable } from "../src/ast.js"
import parse from "../src/parser.js"

const source = `let x = 1024
  function next(n: number): number[] {
    let a = number[](1, 2, 3)
    a[1] = 100
    return a
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

const expectedAst = `   1 | Program statements=[$2,$4,$23]
   2 | Variable name='x' readOnly=false initializer=$3
   3 | Literal value=1024
   4 | Function name='next' parameters=[$5] returnTypeExpression=$7 body=[$9,$16,$21]
   5 | Parameter name='n' typeExpression=$6
   6 | NamedTypeExpression name='number'
   7 | ArrayTypeExpression baseType=$8
   8 | NamedTypeExpression name='number'
   9 | Variable name='a' readOnly=false initializer=$10
  10 | Call callee=$11 args=[$13,$14,$15]
  11 | ArrayTypeExpression baseType=$12
  12 | NamedTypeExpression name='number'
  13 | Literal value=1
  14 | Literal value=2
  15 | Literal value=3
  16 | Assignment target=$17 source=$20
  17 | SubscriptExpression array=$18 element=$19
  18 | IdentifierExpression name='a'
  19 | Literal value=1
  20 | Literal value=100
  21 | ReturnStatement expression=$22
  22 | IdentifierExpression name='a'
  23 | WhileStatement test=$24 body=[$27,$35,$46,$67]
  24 | BinaryExpression op='>' left=$25 right=$26
  25 | IdentifierExpression name='x'
  26 | Literal value=3
  27 | Variable name='y' readOnly=false initializer=$28
  28 | AndExpression conjuncts=[$29,$30]
  29 | Literal value=false
  30 | OrExpression disjuncts=[$31,$32]
  31 | Literal value=true
  32 | BinaryExpression op='>=' left=$33 right=$34
  33 | Literal value=2
  34 | IdentifierExpression name='x'
  35 | Assignment target=$36 source=$37
  36 | IdentifierExpression name='x'
  37 | BinaryExpression op='/' left=$38 right=$41
  38 | BinaryExpression op='+' left=$39 right=$40
  39 | Literal value=0
  40 | IdentifierExpression name='x'
  41 | BinaryExpression op='**' left=$42 right=$43
  42 | Literal value=2
  43 | Call callee=$44 args=[$45]
  44 | NamedTypeExpression name='next'
  45 | Literal value=0
  46 | IfStatement test=$47 consequent=[$48,$56,$58] alternative=$59
  47 | Literal value=false
  48 | Variable name='hello' readOnly=true initializer=$49
  49 | BinaryExpression op='-' left=$50 right=$55
  50 | BinaryExpression op='-' left=$51 right=$53
  51 | UnaryExpression op='sqrt' operand=$52
  52 | Literal value=100
  53 | UnaryExpression op='abs' operand=$54
  54 | Literal value=3.1
  55 | Literal value=3
  56 | Function name='g' parameters=[] returnTypeExpression=null body=[$57]
  57 | ReturnStatement expression=null
  58 | BreakStatement
  59 | IfStatement test=$60 consequent=[$61,$64] alternative=[$66]
  60 | Literal value=true
  61 | Call callee=$62 args=[$63]
  62 | IdentifierExpression name='next'
  63 | Literal value=99
  64 | Variable name='hello' readOnly=false initializer=$65
  65 | IdentifierExpression name='y'
  66 | ContinueStatement
  67 | PrintStatement argument=$68
  68 | IdentifierExpression name='x'`

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
  ["array type for param", "function f(x: boolean[][][]) {}"],
  ["array type returned", "function f(): number[][] {}"],
  ["empty array literal", "print number[]()"],
  ["nonempty array literal", "print number[](1, 2, 3)"],
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
  ["unbalanced brackets", "function f(): number[", /Line 1, col 21/],
  ["array lit w/o type", "print [1,2]", /Line 1, col 7/],
  ["empty subscript", "print a[]", /Line 1, col 10/],
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
