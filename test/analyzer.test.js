import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

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

const expectedAst = String.raw`   1 | program: Program
   2 |   statements[0]: Variable name='x' readOnly=false
   3 |     initializer: Literal value=1024
   4 |   statements[1]: Function name='next'
   5 |     parameters[0]: Parameter name='n'
   6 |       typeExpression: NamedTypeExpression name='number'
   7 |     returnTypeExpression: NamedTypeExpression name='number'
   8 |     body[0]: ReturnStatement
   9 |       expression: BinaryExpression op='+'
  10 |         left: IdentifierExpression name='n' referent=$5
  11 |         right: Literal value=1
  12 |     returnType: Type name='number'
  13 |   statements[2]: WhileStatement
  14 |     test: BinaryExpression op='>'
  15 |       left: IdentifierExpression name='x' referent=$2
  16 |       right: Literal value=3
  17 |     body[0]: Variable name='y' readOnly=false
  18 |       initializer: AndExpression
  19 |         conjuncts[0]: Literal value=false
  20 |         conjuncts[1]: OrExpression
  21 |           disjuncts[0]: Literal value=true
  22 |           disjuncts[1]: BinaryExpression op='>='
  23 |             left: Literal value=2
  24 |             right: IdentifierExpression name='x' referent=$2
  25 |     body[1]: Assignment
  26 |       target: IdentifierExpression name='x' referent=$2
  27 |       source: BinaryExpression op='/'
  28 |         left: BinaryExpression op='+'
  29 |           left: Literal value=0
  30 |           right: IdentifierExpression name='x' referent=$2
  31 |         right: BinaryExpression op='**'
  32 |           left: Literal value=2
  33 |           right: Call
  34 |             callee: IdentifierExpression name='next' referent=$4
  35 |             args[0]: Literal value=0
  36 |     body[2]: IfStatement
  37 |       test: Literal value=false
  38 |       consequent[0]: Variable name='hello' readOnly=true
  39 |         initializer: BinaryExpression op='-'
  40 |           left: BinaryExpression op='-'
  41 |             left: UnaryExpression op='sqrt'
  42 |               operand: Literal value=100
  43 |             right: UnaryExpression op='abs'
  44 |               operand: Literal value=3.1
  45 |           right: Literal value=3
  46 |       consequent[1]: Function name='g' returnTypeExpression=null returnType=null
  47 |         body[0]: ReturnStatement expression=null
  48 |       consequent[2]: BreakStatement
  49 |       alternative: IfStatement
  50 |         test: Literal value=true
  51 |         consequent[0]: Call
  52 |           callee: IdentifierExpression name='next' referent=$4
  53 |           args[0]: Literal value=99
  54 |         consequent[1]: Variable name='hello' readOnly=false
  55 |           initializer: IdentifierExpression name='y' referent=$17
  56 |         alternative[0]: ContinueStatement
  57 |     body[3]: PrintStatement
  58 |       argument: IdentifierExpression name='x' referent=$2`

const semanticChecks = [
  ["return in nested if", "function f() {if true {return}}"],
  ["break in nested if", "while false {if true {break}}"],
  ["continue in nested if", "while false {if true {continue}}"],
]

const semanticErrors = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
  ["assign to const", "const x = 1\nx = 2", /Cannot assign to constant x/],
  [
    "assign bad type",
    "let x=1\nx=true",
    /Expected type number, got type boolean/,
  ],
  ["bad types for ||", "print false||1", /'\|\|' operand must be a boolean/],
  ["bad types for &&", "print false&&1", /'&&' operand must be a boolean/],
  ["bad types for +", "print false+1", /'\+' operand must be a number/],
  ["bad types for -", "print false-1", /'-' operand must be a number/],
  ["bad types for *", "print false*1", /'\*' operand must be a number/],
  ["bad types for /", "print false/1", /'\/' operand must be a number/],
  ["bad types for **", "print false**1", /'\*\*' operand must be a number/],
  ["bad types for <", "print false<1", /'<' operand must be a number/],
  ["bad types for <=", "print false<=1", /'<=' operand must be a number/],
  ["bad types for >", "print false>1", /'>' operand must be a number/],
  ["bad types for >=", "print false>=1", /'>=' operand must be a number/],
  ["bad types for sqrt", "print sqrt true", /sqrt' operand must be a number/],
  ["bad types for abs", "print abs true", /'abs' operand must be a number/],
  ["bad types for negation", "print -true", /'-' operand must be a number/],
  ["non-boolean if test", "if 1 {}", /'if' operand must be a boolean/],
  ["non-boolean while test", "while 1 {}", /'while' operand must be a boolean/],
  [
    "shadowing",
    "let x = 1\nwhile true {let x = 1}",
    /Identifier x already declared/,
  ],
  ["break outside loop", "break", /'break' can only appear in a loop/],
  ["continue outside loop", "continue", /'continue' can only appear in a loop/],
  [
    "break inside function",
    "while true {function f() {break}}",
    /'break' can only appear in a loop/,
  ],
  [
    "continue inside function",
    "while true {function f() {continue}}",
    /'continue' can only appear in a loop/,
  ],
  [
    "return expression from void function",
    "function f() {return 1}",
    /Cannot return a value here/,
  ],
  [
    "return nothing when should have",
    "function f(): number {return}",
    /Something should be returned here/,
  ],
  [
    "Too many args",
    "function f(x: number) {}\nf(1,2)",
    /1 parameter\(s\) required, but 2 argument\(s\) passed/,
  ],
  [
    "Too few args",
    "function f(x: number) {}\nf()",
    /1 parameter\(s\) required, but 0 argument\(s\) passed/,
  ],
  [
    "Parameter type mismatch",
    "function f(x: number) {}\nf(false)",
    /Expected type number, got type boolean/,
  ],
  ["call of non-function", "let x = 1\nprint x()", /Call of non-function/],
]

describe("The analyzer", () => {
  for (const [scenario, source] of semanticChecks) {
    it(`recognizes ${scenario}`, done => {
      assert(parse(source))
      done()
    })
  }
  it("can analyze all the nodes", done => {
    assert.deepStrictEqual(util.format(analyze(parse(source))), expectedAst)
    done()
  })
  for (const [scenario, source, errorMessagePattern] of semanticErrors) {
    it(`throws on ${scenario}`, done => {
      assert.throws(() => analyze(parse(source)), errorMessagePattern)
      done()
    })
  }
})
