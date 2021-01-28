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

const expectedAst = String.raw`   1 | Program statements=[$2,$7]
   2 | Variable name='x' readOnly=false initializer=$3 type=$5
   3 | BinaryExpression op='-' left=$4 right=$6 type=$5
   4 | Literal value=1024 type=$5
   5 | Type name='number'
   6 | Literal value=0 type=$5
   7 | WhileStatement test=$8 body=[$12,$20,$29,$47]
   8 | BinaryExpression op='>' left=$9 right=$10 type=$11
   9 | IdentifierExpression name='x' referent=$2 type=$5
  10 | Literal value=3 type=$5
  11 | Type name='boolean'
  12 | Variable name='y' readOnly=false initializer=$13 type=$11
  13 | AndExpression conjuncts=[$14,$15] type=$11
  14 | Literal value=false type=$11
  15 | OrExpression disjuncts=[$16,$17] type=$11
  16 | Literal value=true type=$11
  17 | BinaryExpression op='>=' left=$18 right=$19 type=$11
  18 | Literal value=2 type=$5
  19 | IdentifierExpression name='x' referent=$2 type=$5
  20 | Assignment target=$21 source=$22
  21 | IdentifierExpression name='x' referent=$2 type=$5
  22 | BinaryExpression op='/' left=$23 right=$26 type=$5
  23 | BinaryExpression op='+' left=$24 right=$25 type=$5
  24 | Literal value=0 type=$5
  25 | IdentifierExpression name='x' referent=$2 type=$5
  26 | BinaryExpression op='**' left=$27 right=$28 type=$5
  27 | Literal value=2 type=$5
  28 | Literal value=1 type=$5
  29 | IfStatement test=$30 consequent=[$31,$39] alternative=$41
  30 | Literal value=false type=$11
  31 | Variable name='hello' readOnly=true initializer=$32 type=$5
  32 | BinaryExpression op='-' left=$33 right=$38 type=$5
  33 | BinaryExpression op='-' left=$34 right=$36 type=$5
  34 | UnaryExpression op='sqrt' operand=$35 type=$5
  35 | Literal value=100 type=$5
  36 | UnaryExpression op='abs' operand=$37 type=$5
  37 | Literal value=3.1 type=$5
  38 | Literal value=3 type=$5
  39 | PrintStatement argument=$40
  40 | Literal value=1 type=$5
  41 | IfStatement test=$42 consequent=[$43] alternative=[$45]
  42 | Literal value=true type=$11
  43 | Variable name='hello' readOnly=false initializer=$44 type=$11
  44 | Literal value=false type=$11
  45 | PrintStatement argument=$46
  46 | IdentifierExpression name='y' referent=$12 type=$11
  47 | PrintStatement argument=$48
  48 | IdentifierExpression name='x' referent=$2 type=$5`

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
  ["non-boolean if test", "if 1 {}", /if' operand must be a boolean/],
  ["non-boolean while test", "while 1 {}", /while' operand must be a boolean/],
  [
    "shadowing",
    "let x = 1\nwhile true {let x = 1}",
    /Identifier x already declared/,
  ],
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
