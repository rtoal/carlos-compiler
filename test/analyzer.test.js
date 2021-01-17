import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let x = 1024 - 0
  while x > 3 {
    let y = false && (true || 2 >= x)
    x = (0 + x) / 2 ** 1
    if false {
      const hello = sqrt 100 - abs 3.1-3
      print 1
    } else if true {
      let hello = false // A different hello
    } else {
      print y
    }
    print x   // TADA 🥑
  }`

const expectedAst = String.raw`   1 | program: Program
   2 |   statements[0]: VariableDeclaration name='x' readOnly=false
   3 |     initializer: BinaryExpression op='-'
   4 |       left: Literal value=1024
   5 |       right: Literal value=0
   6 |     variable: Variable name='x' readOnly=false
   7 |   statements[1]: WhileStatement
   8 |     test: BinaryExpression op='>'
   9 |       left: IdentifierExpression name='x' referent=$6
  10 |       right: Literal value=3
  11 |     body[0]: VariableDeclaration name='y' readOnly=false
  12 |       initializer: AndExpression
  13 |         conjuncts[0]: IdentifierExpression name='false'
  14 |           referent: Variable name='false' readOnly=true
  15 |         conjuncts[1]: OrExpression
  16 |           disjuncts[0]: IdentifierExpression name='true'
  17 |             referent: Variable name='true' readOnly=true
  18 |           disjuncts[1]: BinaryExpression op='>='
  19 |             left: Literal value=2
  20 |             right: IdentifierExpression name='x' referent=$6
  21 |       variable: Variable name='y' readOnly=false
  22 |     body[1]: Assignment
  23 |       target: IdentifierExpression name='x' referent=$6
  24 |       source: BinaryExpression op='/'
  25 |         left: BinaryExpression op='+'
  26 |           left: Literal value=0
  27 |           right: IdentifierExpression name='x' referent=$6
  28 |         right: BinaryExpression op='**'
  29 |           left: Literal value=2
  30 |           right: Literal value=1
  31 |     body[2]: IfStatement
  32 |       test: IdentifierExpression name='false' referent=$14
  33 |       consequent[0]: VariableDeclaration name='hello' readOnly=true
  34 |         initializer: BinaryExpression op='-'
  35 |           left: BinaryExpression op='-'
  36 |             left: UnaryExpression op='sqrt'
  37 |               operand: Literal value=100
  38 |             right: UnaryExpression op='abs'
  39 |               operand: Literal value=3.1
  40 |           right: Literal value=3
  41 |         variable: Variable name='hello' readOnly=true
  42 |       consequent[1]: PrintStatement
  43 |         argument: Literal value=1
  44 |       alternative: IfStatement
  45 |         test: IdentifierExpression name='true' referent=$17
  46 |         consequent[0]: VariableDeclaration name='hello' readOnly=false
  47 |           initializer: IdentifierExpression name='false' referent=$14
  48 |           variable: Variable name='hello' readOnly=false
  49 |         alternative[0]: PrintStatement
  50 |           argument: IdentifierExpression name='y' referent=$21
  51 |     body[3]: PrintStatement
  52 |       argument: IdentifierExpression name='x' referent=$6`

const semanticErrors = [
  ["redeclarations", "print x", /Identifier x not declared/],
  ["non declared ids", "let x = 1\nlet x = 1", /Identifier x already declared/],
  ["assign to const", "const x = 1\nx = 2", /Cannot assign to constant x/],
  ["redeclare true", "let true = 1<1", /Identifier true already declared/],
  ["assign to true", "true = 1<1", /Cannot assign to constant true/],
  ["redeclare false", "let false = 1<1", /Identifier false already declared/],
  ["assign to false", "false = 1<1", /Cannot assign to constant false/],
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
