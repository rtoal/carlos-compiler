import assert from "assert"
import optimize from "../src/optimizer.js"
import * as ast from "../src/ast.js"

const x = new ast.IdentifierExpression("x", 0)

const tests = [
  ["folds +", new ast.BinaryExpression("+", 5, 8), 13],
  ["folds -", new ast.BinaryExpression("-", 5, 8), -3],
  ["folds *", new ast.BinaryExpression("*", 5, 8), 40],
  ["folds /", new ast.BinaryExpression("/", 5, 8), 0.625],
  ["folds **", new ast.BinaryExpression("**", 5, 8), 390625],
  ["folds <", new ast.BinaryExpression("<", 5, 8), true],
  ["folds <=", new ast.BinaryExpression("<=", 5, 8), true],
  ["folds ==", new ast.BinaryExpression("==", 5, 8), false],
  ["folds !=", new ast.BinaryExpression("!=", 5, 8), true],
  ["folds >=", new ast.BinaryExpression(">=", 5, 8), false],
  ["folds >", new ast.BinaryExpression(">", 5, 8), false],
  ["optimizes +0", new ast.BinaryExpression("+", x, 0), x],
  ["optimizes -0", new ast.BinaryExpression("-", x, 0), x],
  ["optimizes *1", new ast.BinaryExpression("*", x, 1), x],
  ["optimizes /1", new ast.BinaryExpression("/", x, 1), x],
  ["optimizes *0", new ast.BinaryExpression("*", x, 0), 0],
  ["optimizes 0*", new ast.BinaryExpression("*", 0, x), 0],
  ["optimizes 0/", new ast.BinaryExpression("/", 0, x), 0],
  ["optimizes 0+", new ast.BinaryExpression("+", 0, x), x],
  [
    "optimizes 0-",
    new ast.BinaryExpression("-", 0, x),
    new ast.UnaryExpression("-", x),
  ],
  ["optimizes 1*", new ast.BinaryExpression("*", 1, x), x],
  ["folds negation", new ast.UnaryExpression("-", 8), -8],
  ["optimizes 1**", new ast.BinaryExpression("**", 1, x), 1],
  ["optimizes **0", new ast.BinaryExpression("**", x, 0), 1],
  [
    "removes disjuncts after true",
    new ast.OrExpression([new ast.BinaryExpression("<", x, 1), true, false]),
    new ast.OrExpression([new ast.BinaryExpression("<", x, 1), true]),
  ],
  [
    "removes conjuncts after false",
    new ast.AndExpression([new ast.BinaryExpression("<", x, 1), false, true]),
    new ast.AndExpression([new ast.BinaryExpression("<", x, 1), false]),
  ],
  [
    "removes x=x at end",
    [new ast.PrintStatement(1), new ast.Assignment(x, x)],
    [new ast.PrintStatement(1)],
  ],
  [
    "removes x=x in middle",
    [
      new ast.PrintStatement(1),
      new ast.Assignment(x, x),
      new ast.Variable("x", false, 1),
    ],
    [new ast.PrintStatement(1), new ast.Variable("x", false, 1)],
  ],
  [
    "passes through nonoptimizable constructs",
    [
      new ast.Variable("x", false, 0),
      new ast.PrintStatement(x, new ast.BinaryExpression("*", x, 100)),
    ],
    [
      new ast.Variable("x", false, 0),
      new ast.PrintStatement(x, new ast.BinaryExpression("*", x, 100)),
    ],
  ],
]

describe("The optimizer", () => {
  for (const [scenario, before, after] of tests) {
    it(`${scenario}`, () => {
      assert.deepStrictEqual(optimize(before), after)
    })
  }
})
