import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let x = 1024 - 0
  while x < 3 {
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
   2 |   statements[0]: Declaration name='x' readOnly=false
   3 |     initializer: BinaryExpression op='-'
   4 |       left: LiteralExpression value=1024
   5 |       right: LiteralExpression value=0
   6 |   statements[1]: WhileStatement
   7 |     test: BinaryExpression op='<'
   8 |       left: IdentifierExpression name='x' referent=$2
   9 |       right: LiteralExpression value=3
  10 |     body: Block
  11 |       statements[0]: Declaration name='y' readOnly=false
  12 |         initializer: AndExpression
  13 |           conjuncts[0]: IdentifierExpression name='false'
  14 |             referent: Declaration name='false' readOnly=true
  15 |               initializer: LiteralExpression value=false
  16 |           conjuncts[1]: OrExpression
  17 |             disjuncts[0]: IdentifierExpression name='true'
  18 |               referent: Declaration name='true' readOnly=true
  19 |                 initializer: LiteralExpression value=true
  20 |             disjuncts[1]: BinaryExpression op='>='
  21 |               left: LiteralExpression value=2
  22 |               right: IdentifierExpression name='x' referent=$2
  23 |       statements[1]: Assignment
  24 |         target: IdentifierExpression name='x' referent=$2
  25 |         source: BinaryExpression op='/'
  26 |           left: BinaryExpression op='+'
  27 |             left: LiteralExpression value=0
  28 |             right: IdentifierExpression name='x' referent=$2
  29 |           right: BinaryExpression op='**'
  30 |             left: LiteralExpression value=2
  31 |             right: LiteralExpression value=1
  32 |       statements[2]: IfStatement
  33 |         test: IdentifierExpression name='false' referent=$14
  34 |         consequent: Block
  35 |           statements[0]: Declaration name='hello' readOnly=true
  36 |             initializer: BinaryExpression op='-'
  37 |               left: BinaryExpression op='-'
  38 |                 left: UnaryExpression op='sqrt'
  39 |                   operand: LiteralExpression value=100
  40 |                 right: UnaryExpression op='abs'
  41 |                   operand: LiteralExpression value=3.1
  42 |               right: LiteralExpression value=3
  43 |           statements[1]: PrintStatement
  44 |             expression: LiteralExpression value=1
  45 |         alternative: IfStatement
  46 |           test: IdentifierExpression name='true' referent=$18
  47 |           consequent: Block
  48 |             statements[0]: Declaration name='hello' readOnly=false
  49 |               initializer: IdentifierExpression name='false' referent=$14
  50 |           alternative: Block
  51 |             statements[0]: PrintStatement
  52 |               expression: IdentifierExpression name='y' referent=$11
  53 |       statements[3]: PrintStatement
  54 |         expression: IdentifierExpression name='x' referent=$2`

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
  ["non-boolean if test", "if 1 {}", /if' operand must be a boolean/],
  ["non-boolean while test", "while 1 {}", /while' operand must be a boolean/],
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
