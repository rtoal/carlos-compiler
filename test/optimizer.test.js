import assert from "assert"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import optimize from "../src/optimizer.js"
import * as ast from "../src/ast.js"

const x = new ast.IdentifierExpression("x", 0)
const y = new ast.IdentifierExpression("x", 0)

const tests = [
  ["folds +", new ast.BinaryExpression("+", 5, 8), 13],
  ["folds -", new ast.BinaryExpression("-", 5, 8), -3],
  ["folds *", new ast.BinaryExpression("*", 5, 8), 40],
  ["folds /", new ast.BinaryExpression("/", 5, 8), 0.625],
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
      new ast.Variable("x", 1),
    ],
    [new ast.PrintStatement(1), new ast.Variable("x", 1)],
  ],
  // [
  //   "passes through nonoptimizable constructs",
  //   Array(2).fill([
  //     new ast.Variable("x", 0),
  //     new ast.Assignment(x, new ast.BinaryExpression("*", x, y)),
  //   ]),
  // ],
]

describe("The optimizer", () => {
  for (const [scenario, before, after] of tests) {
    it(`${scenario}`, () => {
      assert.deepStrictEqual(optimize(before), after)
    })
  }
})
