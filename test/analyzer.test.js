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

const expectedAst = String.raw`   1 | Program statements=[$2,$5,$13]
   2 | Variable name='x' readOnly=false initializer=$3 type=$4
   3 | Literal value=1024 type=$4
   4 | Type name='number'
   5 | Function name='next' parameters=[$6] returnTypeExpression=$8 body=[$9] returnType=$4
   6 | Parameter name='n' typeExpression=$7 type=$4
   7 | NamedTypeExpression name='number' type=$4
   8 | NamedTypeExpression name='number' type=$4
   9 | ReturnStatement expression=$10
  10 | BinaryExpression op='+' left=$11 right=$12 type=$4
  11 | IdentifierExpression name='n' referent=$6 type=$4
  12 | Literal value=1 type=$4
  13 | WhileStatement test=$14 body=[$18,$26,$37,$58]
  14 | BinaryExpression op='>' left=$15 right=$16 type=$17
  15 | IdentifierExpression name='x' referent=$2 type=$4
  16 | Literal value=3 type=$4
  17 | Type name='boolean'
  18 | Variable name='y' readOnly=false initializer=$19 type=$17
  19 | AndExpression conjuncts=[$20,$21] type=$17
  20 | Literal value=false type=$17
  21 | OrExpression disjuncts=[$22,$23] type=$17
  22 | Literal value=true type=$17
  23 | BinaryExpression op='>=' left=$24 right=$25 type=$17
  24 | Literal value=2 type=$4
  25 | IdentifierExpression name='x' referent=$2 type=$4
  26 | Assignment target=$27 source=$28
  27 | IdentifierExpression name='x' referent=$2 type=$4
  28 | BinaryExpression op='/' left=$29 right=$32 type=$4
  29 | BinaryExpression op='+' left=$30 right=$31 type=$4
  30 | Literal value=0 type=$4
  31 | IdentifierExpression name='x' referent=$2 type=$4
  32 | BinaryExpression op='**' left=$33 right=$34 type=$4
  33 | Literal value=2 type=$4
  34 | Call callee=$35 args=[$36] type=$4
  35 | IdentifierExpression name='next' referent=$5 type=undefined
  36 | Literal value=0 type=$4
  37 | IfStatement test=$38 consequent=[$39,$47,$49] alternative=$50
  38 | Literal value=false type=$17
  39 | Variable name='hello' readOnly=true initializer=$40 type=$4
  40 | BinaryExpression op='-' left=$41 right=$46 type=$4
  41 | BinaryExpression op='-' left=$42 right=$44 type=$4
  42 | UnaryExpression op='sqrt' operand=$43 type=$4
  43 | Literal value=100 type=$4
  44 | UnaryExpression op='abs' operand=$45 type=$4
  45 | Literal value=3.1 type=$4
  46 | Literal value=3 type=$4
  47 | Function name='g' parameters=[] returnTypeExpression=null body=[$48] returnType=null
  48 | ReturnStatement expression=null
  49 | BreakStatement
  50 | IfStatement test=$51 consequent=[$52,$55] alternative=[$57]
  51 | Literal value=true type=$17
  52 | Call callee=$53 args=[$54] type=$4
  53 | IdentifierExpression name='next' referent=$5 type=undefined
  54 | Literal value=99 type=$4
  55 | Variable name='hello' readOnly=false initializer=$56 type=$17
  56 | IdentifierExpression name='y' referent=$18 type=$17
  57 | ContinueStatement
  58 | PrintStatement argument=$59
  59 | IdentifierExpression name='x' referent=$2 type=$4`

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
