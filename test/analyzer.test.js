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
  19 |         conjuncts[0]: IdentifierExpression name='false'
  20 |           referent: Variable name='false' readOnly=true
  21 |             initializer: Literal value=false
  22 |         conjuncts[1]: OrExpression
  23 |           disjuncts[0]: IdentifierExpression name='true'
  24 |             referent: Variable name='true' readOnly=true
  25 |               initializer: Literal value=true
  26 |           disjuncts[1]: BinaryExpression op='>='
  27 |             left: Literal value=2
  28 |             right: IdentifierExpression name='x' referent=$2
  29 |     body[1]: Assignment
  30 |       target: IdentifierExpression name='x' referent=$2
  31 |       source: BinaryExpression op='/'
  32 |         left: BinaryExpression op='+'
  33 |           left: Literal value=0
  34 |           right: IdentifierExpression name='x' referent=$2
  35 |         right: BinaryExpression op='**'
  36 |           left: Literal value=2
  37 |           right: Call
  38 |             callee: IdentifierExpression name='next' referent=$4
  39 |             args[0]: Literal value=0
  40 |     body[2]: IfStatement
  41 |       test: IdentifierExpression name='false' referent=$20
  42 |       consequent[0]: Variable name='hello' readOnly=true
  43 |         initializer: BinaryExpression op='-'
  44 |           left: BinaryExpression op='-'
  45 |             left: UnaryExpression op='sqrt'
  46 |               operand: Literal value=100
  47 |             right: UnaryExpression op='abs'
  48 |               operand: Literal value=3.1
  49 |           right: Literal value=3
  50 |       consequent[1]: Function name='g' returnTypeExpression=null returnType=null
  51 |         body[0]: ReturnStatement expression=null
  52 |       consequent[2]: BreakStatement
  53 |       alternative: IfStatement
  54 |         test: IdentifierExpression name='true' referent=$24
  55 |         consequent[0]: Call
  56 |           callee: IdentifierExpression name='next' referent=$4
  57 |           args[0]: Literal value=99
  58 |         consequent[1]: Variable name='hello' readOnly=false
  59 |           initializer: IdentifierExpression name='y' referent=$17
  60 |         alternative[0]: ContinueStatement
  61 |     body[3]: PrintStatement
  62 |       argument: IdentifierExpression name='x' referent=$2`

const semanticChecks = [
  ["return in nested if", "function f() {if true {return}}"],
  ["break in nested if", "while false {if true {break}}"],
  ["continue in nested if", "while false {if true {continue}}"],
]

const semanticErrors = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
  ["assign to const", "const x = 1\nx = 2", /Cannot assign to constant x/],
  ["redeclare true", "let true = 1<1", /Identifier true already declared/],
  ["assign to true", "true = 1<1", /Cannot assign to constant true/],
  ["redeclare false", "let false = 1<1", /Identifier false already declared/],
  ["assign to false", "false = 1<1", /Cannot assign to constant false/],
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
