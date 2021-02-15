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

const expectedAst = String.raw`   1 | Program statements=[#2,undefined,#5]
   2 | VariableDeclaration name='x' readOnly=false initializer=1024 variable=#3
   3 | Variable name='x' readOnly=false type=#4
   4 | Type name='number'
   5 | WhileStatement test=#6 body=[#8,#13,#23,#32]
   6 | BinaryExpression op='>' left=#3 right=3 type=#7
   7 | Type name='boolean'
   8 | VariableDeclaration name='y' readOnly=false initializer=#9 variable=#12
   9 | AndExpression conjuncts=[false,#10] type=#7
  10 | OrExpression disjuncts=[true,#11] type=#7
  11 | BinaryExpression op='>=' left=2 right=#3 type=#7
  12 | Variable name='y' readOnly=false type=#7
  13 | Assignment target=#3 source=#14
  14 | BinaryExpression op='/' left=#15 right=#16 type=#4
  15 | BinaryExpression op='+' left=0 right=#3 type=#4
  16 | BinaryExpression op='**' left=2 right=#17 type=#4
  17 | Call callee=#18 args=[0] type=#4
  18 | Function name='next' parameters=[#19] returnType=#4 body=[#20] type=#22
  19 | Parameter name='n' type=#4
  20 | ReturnStatement expression=#21
  21 | BinaryExpression op='+' left=#19 right=1 type=#4
  22 | FunctionType parameterTypes=[#4] returnType=#4
  23 | IfStatement test=false consequent=[#24,undefined,#26] alternative=#27
  24 | VariableDeclaration name='hello' readOnly=true initializer=5 variable=#25
  25 | Variable name='hello' readOnly=true type=#4
  26 | BreakStatement
  27 | IfStatement test=true consequent=[#28,#29] alternative=[#31]
  28 | Call callee=#18 args=[99] type=#4
  29 | VariableDeclaration name='hello' readOnly=false initializer=#12 variable=#30
  30 | Variable name='hello' readOnly=false type=#7
  31 | ContinueStatement
  32 | PrintStatement argument=#3`

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
  [
    "function type mismatch",
    `function f(x: number, y: (boolean)->void): number { return 1 }
     function g(z: boolean): number { return 5 }
     f(2, g)`,
    /Expected type \(boolean\)->void, got type \(boolean\)->number/,
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
