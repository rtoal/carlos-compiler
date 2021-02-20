import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

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

const expectedAst = String.raw`   1 | Program statements=[#2,#5,#11]
   2 | VariableDeclaration name='x' readOnly=false initializer=1024 variable=#3
   3 | Variable name='x' readOnly=false type=#4
   4 | Type name='number'
   5 | FunctionDeclaration name='next' parameters=[#6] returnType=#4 body=[#7] function=#9
   6 | Parameter name='n' type=#4
   7 | ReturnStatement expression=#8
   8 | BinaryExpression op='+' left=#6 right=1 type=#4
   9 | Function name='next' type=#10
  10 | FunctionType parameterTypes=[#4] returnType=#4
  11 | WhileStatement test=#12 body=[#14,#19,#24,#39]
  12 | BinaryExpression op='>' left=#3 right=3 type=#13
  13 | Type name='boolean'
  14 | VariableDeclaration name='y' readOnly=false initializer=#15 variable=#18
  15 | AndExpression conjuncts=[false,#16] type=#13
  16 | OrExpression disjuncts=[true,#17] type=#13
  17 | BinaryExpression op='>=' left=2 right=#3 type=#13
  18 | Variable name='y' readOnly=false type=#13
  19 | Assignment target=#3 source=#20
  20 | BinaryExpression op='/' left=#21 right=#22 type=#4
  21 | BinaryExpression op='+' left=0 right=#3 type=#4
  22 | BinaryExpression op='**' left=2 right=#23 type=#4
  23 | Call callee=#9 args=[0] type=#4
  24 | IfStatement test=false consequent=[#25,#27,#33] alternative=#34
  25 | VariableDeclaration name='hello' readOnly=true initializer=5 variable=#26
  26 | Variable name='hello' readOnly=true type=#4
  27 | FunctionDeclaration name='g' parameters=[] returnType=#28 body=[#29,#30] function=#31
  28 | Type name='void'
  29 | PrintStatement argument=#26
  30 | ReturnStatement expression=null
  31 | Function name='g' type=#32
  32 | FunctionType parameterTypes=[] returnType=#28
  33 | BreakStatement
  34 | IfStatement test=true consequent=[#35,#36] alternative=[#38]
  35 | Call callee=#9 args=[99] type=#4
  36 | VariableDeclaration name='hello' readOnly=false initializer=#18 variable=#37
  37 | Variable name='hello' readOnly=false type=#13
  38 | ContinueStatement
  39 | PrintStatement argument=#3`

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
  [
    "pass a function to a function",
    `function f(x: number, y: (boolean)->void): number { return 1 }
     function g(z: boolean) {}
     f(2, g)`,
  ],
  [
    "function return types",
    `function square(x: number): number { return x * x }
     function compose(): (number)->number { return square }`,
  ],
]

const semanticErrors = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
  ["assign to const", "const x = 1\nx = 2", /Cannot assign to constant x/],
  ["assign bad type", "let x=1\nx=true", /Cannot assign a boolean to a number/],
  ["bad types for ||", "print false||1", /a boolean but got a number/],
  ["bad types for &&", "print false&&1", /a boolean but got a number/],
  ["bad types for ==", "print false==1", /Operands do not have the same type/],
  ["bad types for !=", "print false==1", /Operands do not have the same type/],
  ["bad types for +", "print false+1", /a number but got a boolean/],
  ["bad types for -", "print false-1", /a number but got a boolean/],
  ["bad types for *", "print false*1", /a number but got a boolean/],
  ["bad types for /", "print false/1", /a number but got a boolean/],
  ["bad types for **", "print false**1", /a number but got a boolean/],
  ["bad types for <", "print false<1", /a number but got a boolean/],
  ["bad types for <=", "print false<=1", /a number but got a boolean/],
  ["bad types for >", "print false>1", /a number but got a boolean/],
  ["bad types for >=", "print false>=1", /a number but got a boolean/],
  ["bad types for negation", "print -true", /a number but got a boolean/],
  ["non-boolean if test", "if 1 {}", /a boolean but got a number/],
  ["non-boolean while test", "while 1 {}", /a boolean but got a number/],
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
    /1 parameter\(s\) required but 2 argument\(s\) passed/,
  ],
  [
    "Too few args",
    "function f(x: number) {}\nf()",
    /1 parameter\(s\) required but 0 argument\(s\) passed/,
  ],
  [
    "Parameter type mismatch",
    "function f(x: number) {}\nf(false)",
    /Cannot assign a boolean to a number/,
  ],
  ["call of non-function", "let x = 1\nprint x()", /Call of non-function/],
  [
    "function type mismatch",
    `function f(x: number, y: (boolean)->void): number { return 1 }
     function g(z: boolean): number { return 5 }
     f(2, g)`,
    /Cannot assign a \(boolean\)->number to a \(boolean\)->void/,
  ],
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
