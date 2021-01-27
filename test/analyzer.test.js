import assert from "assert"
import util from "util"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"

const source = `let two = 2 - 0
  print (1 * two) / 1   // TADA 🥑 
  two = sqrt 101.3E-5
  const x = 1 < 5 || false == true`

const expectedAst = String.raw`   1 | Program statements=[$2,$7,$12,$16]
   2 | Variable name='two' readOnly=false initializer=$3 type=$5
   3 | BinaryExpression op='-' left=$4 right=$6 type=$5
   4 | Literal value=2 type=$5
   5 | Type name='number'
   6 | Literal value=0 type=$5
   7 | PrintStatement argument=$8
   8 | BinaryExpression op='/' left=$9 right=$10 type=$5
   9 | BinaryExpression op='*' left=$10 right=$11 type=$5
  10 | Literal value=1 type=$5
  11 | IdentifierExpression name='two' referent=$2 type=$5
  12 | Assignment target=$13 source=$14
  13 | IdentifierExpression name='two' referent=$2 type=$5
  14 | UnaryExpression op='sqrt' operand=$15 type=$5
  15 | Literal value=0.001013 type=$5
  16 | Variable name='x' readOnly=true initializer=$17 type=$20
  17 | OrExpression disjuncts=[$18,$21] type=$20
  18 | BinaryExpression op='<' left=$10 right=$19 type=$20
  19 | Literal value=5 type=$5
  20 | Type name='boolean'
  21 | BinaryExpression op='==' left=$22 right=$23 type=$20
  22 | Literal value=false type=$20
  23 | Literal value=true type=$20`

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
