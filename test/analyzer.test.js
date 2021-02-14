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

const expectedAst = String.raw`   1 | Program statements=[#2,#4,#10]
   2 | Variable name='x' readOnly=false initializer=1024 type=#3
   3 | Type name='number'
   4 | Function name='next' parameters=[#5] returnTypeName='number' body=[#6] returnType=#3 type=#9
   5 | Parameter name='n' typeName='number' type=#3
   6 | ReturnStatement expression=#7
   7 | BinaryExpression op='+' left=#8 right=1 type=#3
   8 | IdentifierExpression name='n' referent=#5 type=#3
   9 | FunctionType name='(number)->number' parameterTypes=[#3] returnType=#3
  10 | WhileStatement test=#11 body=[#14,#19,#27,#42]
  11 | BinaryExpression op='>' left=#12 right=3 type=#13
  12 | IdentifierExpression name='x' referent=#2 type=#3
  13 | Type name='boolean'
  14 | Variable name='y' readOnly=false initializer=#15 type=#13
  15 | AndExpression conjuncts=[false,#16] type=#13
  16 | OrExpression disjuncts=[true,#17] type=#13
  17 | BinaryExpression op='>=' left=2 right=#18 type=#13
  18 | IdentifierExpression name='x' referent=#2 type=#3
  19 | Assignment target=#20 source=#21
  20 | IdentifierExpression name='x' referent=#2 type=#3
  21 | BinaryExpression op='/' left=#22 right=#24 type=#3
  22 | BinaryExpression op='+' left=0 right=#23 type=#3
  23 | IdentifierExpression name='x' referent=#2 type=#3
  24 | BinaryExpression op='**' left=2 right=#25 type=#3
  25 | Call callee=#26 args=[0] type=#3
  26 | IdentifierExpression name='next' referent=#4 type=#9
  27 | IfStatement test=false consequent=[#28,#29,#35] alternative=#36
  28 | Variable name='hello' readOnly=true initializer=5 type=#3
  29 | Function name='g' parameters=[] returnTypeName=null body=[#30,#32] returnType=#33 type=#34
  30 | PrintStatement argument=#31
  31 | IdentifierExpression name='hello' referent=#28 type=#3
  32 | ReturnStatement expression=null
  33 | Type name='void'
  34 | FunctionType name='()->void' parameterTypes=[] returnType=#33
  35 | BreakStatement
  36 | IfStatement test=true consequent=[#37,#39] alternative=[#41]
  37 | Call callee=#38 args=[99] type=#3
  38 | IdentifierExpression name='next' referent=#4 type=#9
  39 | Variable name='hello' readOnly=false initializer=#40 type=#13
  40 | IdentifierExpression name='y' referent=#14 type=#13
  41 | ContinueStatement
  42 | PrintStatement argument=#43
  43 | IdentifierExpression name='x' referent=#2 type=#3`

const semanticChecks = [
  ["return in nested if", "function f() {if true {return}}"],
  ["break in nested if", "while false {if true {break}}"],
  ["continue in nested if", "while false {if true {continue}}"],
  ["assigned functions", "function f() {}\nlet g = f\ng = f"],
  ["call of assigned functions", "function f(x: number) {}\nlet g=f\ng(1)"],
  [
    "call of assigned function in expression",
    `function f(x: number, y: boolean): number {}
    let g = f
    print g(1, true)
    f = g // Type check here`,
  ],
]

const semanticChecks = [
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
      assert.ok(analyze(parse(source)))
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
