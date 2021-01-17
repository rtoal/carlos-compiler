import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let two = 2 - 0
  print (1 * two) / 1   // TADA 🥑 
  two = sqrt 101.3E-5
  const x = 1 < 5 || false == true`

const expectedAst = String.raw`   1 | program: Program
   2 |   statements[0]: VariableDeclaration name='two' readOnly=false
   3 |     initializer: BinaryExpression op='-'
   4 |       left: Literal value=2
   5 |       right: Literal value=0
   6 |     variable: Variable name='two' readOnly=false
   7 |   statements[1]: PrintStatement
   8 |     argument: BinaryExpression op='/'
   9 |       left: BinaryExpression op='*'
  10 |         left: Literal value=1
  11 |         right: IdentifierExpression name='two' referent=$6
  12 |       right: Literal value=1
  13 |   statements[2]: Assignment
  14 |     target: IdentifierExpression name='two' referent=$6
  15 |     source: UnaryExpression op='sqrt'
  16 |       operand: Literal value=0.001013
  17 |   statements[3]: VariableDeclaration name='x' readOnly=true
  18 |     initializer: OrExpression
  19 |       disjuncts[0]: BinaryExpression op='<'
  20 |         left: Literal value=1
  21 |         right: Literal value=5
  22 |       disjuncts[1]: BinaryExpression op='=='
  23 |         left: IdentifierExpression name='false'
  24 |           referent: Variable name='false' readOnly=true
  25 |         right: IdentifierExpression name='true'
  26 |           referent: Variable name='true' readOnly=true
  27 |     variable: Variable name='x' readOnly=true`

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
