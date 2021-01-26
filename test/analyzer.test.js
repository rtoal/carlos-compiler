import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let x = 1024 - 0
  while x > 3 {
    let y = false && (true || 2 >= x)
    x = (0 + x) / 2 ** 1
    if false {
      const hello = sqrt 100 - abs 3.1E0-3
      break
    } else if true {
      let hello = false // A different hello
    } else {
      print y
      continue
    }
    print x   // TADA 🥑
  }`

const expectedAst = String.raw`   1 | program: Program
   2 |   statements[0]: Variable name='x' readOnly=false
   3 |     initializer: BinaryExpression op='-'
   4 |       left: Literal value=1024
   5 |       right: Literal value=0
   6 |   statements[1]: WhileStatement
   7 |     test: BinaryExpression op='>'
   8 |       left: IdentifierExpression name='x' referent=$2
   9 |       right: Literal value=3
  10 |     body[0]: Variable name='y' readOnly=false
  11 |       initializer: AndExpression
  12 |         conjuncts[0]: Literal value=false
  13 |         conjuncts[1]: OrExpression
  14 |           disjuncts[0]: Literal value=true
  15 |           disjuncts[1]: BinaryExpression op='>='
  16 |             left: Literal value=2
  17 |             right: IdentifierExpression name='x' referent=$2
  18 |     body[1]: Assignment
  19 |       target: IdentifierExpression name='x' referent=$2
  20 |       source: BinaryExpression op='/'
  21 |         left: BinaryExpression op='+'
  22 |           left: Literal value=0
  23 |           right: IdentifierExpression name='x' referent=$2
  24 |         right: BinaryExpression op='**'
  25 |           left: Literal value=2
  26 |           right: Literal value=1
  27 |     body[2]: IfStatement
  28 |       test: Literal value=false
  29 |       consequent[0]: Variable name='hello' readOnly=true
  30 |         initializer: BinaryExpression op='-'
  31 |           left: BinaryExpression op='-'
  32 |             left: UnaryExpression op='sqrt'
  33 |               operand: Literal value=100
  34 |             right: UnaryExpression op='abs'
  35 |               operand: Literal value=3.1
  36 |           right: Literal value=3
  37 |       consequent[1]: BreakStatement
  38 |       alternative: IfStatement
  39 |         test: Literal value=true
  40 |         consequent[0]: Variable name='hello' readOnly=false
  41 |           initializer: Literal value=false
  42 |         alternative[0]: PrintStatement
  43 |           argument: IdentifierExpression name='y' referent=$10
  44 |         alternative[1]: ContinueStatement
  45 |     body[3]: PrintStatement
  46 |       argument: IdentifierExpression name='x' referent=$2`

const semanticErrors = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
  ["assign to const", "const x = 1\nx = 2", /Cannot assign to constant x/],
  ["assign bad type", "let x=1\nx=true", /'=' operands must have same types/],
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
]

describe("The analyzer", () => {
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
