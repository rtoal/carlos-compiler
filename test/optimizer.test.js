import assert from "assert"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import optimize from "../src/optimizer.js"

const binaryOptimizationFixture = [
  ["folds +", "print 8 + 5", "print 13"],
  ["folds -", "print 8 - 5", "print 3"],
  ["folds *", "print 8 * 5", "print 40"],
  ["folds /", "print 8 / 5", "print 1.6"],
  ["folds **", "print 3 ** 5", "print 243"],
  ["folds <", "print 3 < 5", "print true"],
  ["folds <=", "print 3 <= 5", "print true"],
  ["folds ==", "print 3 == 5", "print false"],
  ["folds !=", "print 3 != 5", "print true"],
  ["folds >=", "print 3 >= 5", "print false"],
  ["folds >", "print 3 > 5", "print false"],
  ["optimizes -0", "let x = 8\nprint x - 0", "let x = 8\nprint x"],
  ["optimizes +0", "let x = 8\nprint x + 0", "let x = 8\nprint x"],
  ["optimizes *1", "let x = 8\nprint x * 1", "let x = 8\nprint x"],
  ["optimizes /1", "let x = 8\nprint x / 1", "let x = 8\nprint x"],
  ["optimizes *0", "let x = 8\nprint x * 0", "let x = 8\nprint 0"],
  ["optimizes 0*", "let x = 8\nprint 0 * x", "let x = 8\nprint 0"],
  ["optimizes 0/", "let x = 8\nprint 0 / x", "let x = 8\nprint 0"],
  ["optimizes 0-", "let x = 8\nprint 0 - x", "let x = 8\nprint -x"],
  ["optimizes 0+", "let x = 8\nprint 0 + x", "let x = 8\nprint x"],
  ["optimizes 1*", "let x = 8\nprint 1 * x", "let x = 8\nprint x"],
  ["optimizes 1**", "let x = 8\nprint 1 ** x", "let x = 8\nprint 1"],
  ["optimizes **0", "let x = 8\nprint x ** 0", "let x = 8\nprint 1"],
]

const unaryOptimizationFixture = [
  ["folds abs for negatives", "print abs(-5)", "print 5"],
  ["folds abs for positive", "print abs(8)", "print 8"],
  ["folds sqrt", "print sqrt 2.25", "print 1.5"],
]

const statementOptimizationFixture = [
  ["removes x=x at end", "let x = 0\nx = x", "let x = 0"],
  ["removes x=x in middle", "let x = 0\nx = x\nprint x", "let x = 0\nprint x"],
  ["optimizes if-true", "if (true) {print 1 + 1} else {}", "print 2"],
  ["optimizes if-false", "if (false) {} else {print 1}", "print 1"],
  ["optimizes short-if-true", "if (true) {print 1 + 1}", "print 2"],
  ["optimizes short-if-false", "print 8\nif (false) {print 1}", "print 8"],
  ["optimizes while-false", "print 1\nwhile false {print 2}", "print 1"],
  ["applies if-false after folding", "if (1 == 1) {print 1}", "print 1"],
]

const logicalOperatorOptimizationFixture = [
  [
    "removes disjuncts after true",
    "print false || true || 0 > 1",
    "print false || true",
  ],
  [
    "removes conjuncts after false",
    "print true && false && 1 <= 1",
    "print true && false",
  ],
]

// We have to test that non-optimizable constructs are left unchanged!
const nothingToOptimizeFixture = [
  [
    "passes through nonoptimizable constructs",
    ...Array(2).fill("let x=0\nlet y=9\nx=y*abs x"),
  ],
]

describe("The optimizer", () => {
  for (const fixture of [
    binaryOptimizationFixture,
    unaryOptimizationFixture,
    statementOptimizationFixture,
    nothingToOptimizeFixture,
    logicalOperatorOptimizationFixture,
  ]) {
    for (const [scenario, before, after] of fixture) {
      it(`${scenario}`, done => {
        const actual = analyze(optimize(analyze(parse(before))))
        const expected = analyze(parse(after))
        assert.deepStrictEqual(actual, expected)
        done()
      })
    }
  }
})
