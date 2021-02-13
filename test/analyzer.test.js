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

const expectedAst = String.raw`   1 | Program statements=[#2,#4,#9]
   2 | Variable name='x' readOnly=false initializer=1024 type=#3
   3 | Type name='number'
   4 | Function name='next' parameters=[#5] typeName='number' body=[#6] type=#3
   5 | Parameter name='n' typeName='number' type=#3
   6 | ReturnStatement expression=#7
   7 | BinaryExpression op='+' left=#8 right=1 type=#3
   8 | IdentifierExpression name='n' referent=#5 type=#3
   9 | WhileStatement test=#10 body=[#13,#18,#26,#39]
  10 | BinaryExpression op='>' left=#11 right=3 type=#12
  11 | IdentifierExpression name='x' referent=#2 type=#3
  12 | Type name='boolean'
  13 | Variable name='y' readOnly=false initializer=#14 type=#12
  14 | AndExpression conjuncts=[false,#15] type=#12
  15 | OrExpression disjuncts=[true,#16] type=#12
  16 | BinaryExpression op='>=' left=2 right=#17 type=#12
  17 | IdentifierExpression name='x' referent=#2 type=#3
  18 | Assignment target=#19 source=#20
  19 | IdentifierExpression name='x' referent=#2 type=#3
  20 | BinaryExpression op='/' left=#21 right=#23 type=#3
  21 | BinaryExpression op='+' left=0 right=#22 type=#3
  22 | IdentifierExpression name='x' referent=#2 type=#3
  23 | BinaryExpression op='**' left=2 right=#24 type=#3
  24 | Call callee=#25 args=[0] type=#3
  25 | IdentifierExpression name='next' referent=#4 type=#3
  26 | IfStatement test=false consequent=[#27,#28,#32] alternative=#33
  27 | Variable name='hello' readOnly=true initializer=5 type=#3
  28 | Function name='g' parameters=[] typeName=null body=[#29,#31] type=null
  29 | PrintStatement argument=#30
  30 | IdentifierExpression name='hello' referent=#27 type=#3
  31 | ReturnStatement expression=null
  32 | BreakStatement
  33 | IfStatement test=true consequent=[#34,#36] alternative=[#38]
  34 | Call callee=#35 args=[99] type=#3
  35 | IdentifierExpression name='next' referent=#4 type=#3
  36 | Variable name='hello' readOnly=false initializer=#37 type=#12
  37 | IdentifierExpression name='y' referent=#13 type=#12
  38 | ContinueStatement
  39 | PrintStatement argument=#40
  40 | IdentifierExpression name='x' referent=#2 type=#3`

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
    it(`recognizes ${scenario}`, () => {
      assert(parse(source))
    })
  }
  for (const [scenario, source, errorMessagePattern] of semanticErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => analyze(parse(source)), errorMessagePattern)
    })
  }
  it("can analyze all the nodes", () => {
    assert.deepStrictEqual(util.format(analyze(parse(source))), expectedAst)
  })
})
