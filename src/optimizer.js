// Optimizer
//
// This module exports a single function to perform machine-independent
// optimizations on the analyzed semantic graph.
//
// The only optimizations supported here are:
//
//   - assignments to self (x = x) turn into no-ops
//   - constant folding
//   - some strength reductions (+0, -0, *0, *1, etc.)
//   - turn references to built-ins true and false to be literals
//   - remove all disjuncts in || list after literal true
//   - remove all conjuncts in && list after literal false

import {
  IdentifierExpression,
  LiteralExpression,
  UnaryExpression,
} from "./ast.js"

export default function optimize(node) {
  return optimizers[node.constructor.name](node)
}

const optimizers = {
  Program(p) {
    p.statements = p.statements.map(optimize).filter(s => s !== null)
    return p
  },
  Declaration(d) {
    d.initializer = optimize(d.initializer)
    return d
  },
  Assignment(s) {
    s.source = optimize(s.source)
    s.target = optimize(s.target)
    if (s.target.constructor == IdentifierExpression) {
      if (s.source.referent === s.target.referent) {
        return null
      }
    }
    return s
  },
  PrintStatement(s) {
    s.expression = optimize(s.expression)
    return s
  },
  OrExpression(e) {
    // Get rid of all disjuncts after a literal true
    const optimizedDisjuncts = []
    for (const d of e.disjuncts) {
      const optimized = optimize(d)
      optimizedDisjuncts.push(optimized)
      if (optimized.constructor === LiteralExpression && optimized.value) {
        break
      }
    }
    e.disjuncts = optimizedDisjuncts
    return e
  },
  AndExpression(e) {
    // Get rid of all conjuncts after a literal false
    const optimizedConjuncts = []
    for (const d of e.conjuncts) {
      const optimized = optimize(d)
      optimizedConjuncts.push(optimized)
      if (optimized.constructor === LiteralExpression && !optimized.value) {
        break
      }
    }
    e.conjuncts = optimizedConjuncts
    return e
  },
  BinaryExpression(e) {
    e.left = optimize(e.left)
    e.right = optimize(e.right)
    if (e.left.constructor === LiteralExpression) {
      const x = e.left.value
      if (e.right.constructor === LiteralExpression) {
        const y = e.right.value
        if (e.op == "+") {
          return new LiteralExpression(x + y)
        } else if (e.op == "-") {
          return new LiteralExpression(x - y)
        } else if (e.op == "*") {
          return new LiteralExpression(x * y)
        } else if (e.op == "/") {
          return new LiteralExpression(x / y)
        } else if (e.op == "**") {
          return new LiteralExpression(x ** y)
        }
      } else if (x === 0 && e.op === "+") {
        return e.right
      } else if (x === 1 && e.op === "*") {
        return e.right
      } else if (x === 0 && e.op === "-") {
        return new UnaryExpression("-", e.right)
      } else if (x === 0 && e.op === "*") {
        return new LiteralExpression(0)
      } else if (x === 0 && e.op === "/") {
        return new LiteralExpression(0)
      } else if (x === 1 && e.op === "**") {
        return new LiteralExpression(1)
      }
    } else if (e.right.constructor === LiteralExpression) {
      const y = e.right.value
      if (["+", "-"].includes(e.op) && y === 0) {
        return e.left
      } else if (["*", "/"].includes(e.op) && y === 1) {
        return e.left
      } else if (e.op === "*" && y === 0) {
        return new LiteralExpression(0)
      } else if (e.op === "**" && y === 0) {
        return new LiteralExpression(1)
      }
    }
    return e
  },
  UnaryExpression(e) {
    e.operand = optimize(e.operand)
    if (e.operand.constructor === LiteralExpression) {
      const x = e.operand.value
      if (e.op === "-") {
        return new LiteralExpression(-x)
      } else if (e.op === "abs") {
        return new LiteralExpression(Math.abs(x))
      } else if (e.op === "sqrt") {
        return new LiteralExpression(Math.sqrt(x))
      }
    }
    return e
  },
  IdentifierExpression(e) {
    if (e.name === "true" || e.name === "false") {
      // Who needs references when we can have straight up literals
      return e.referent.initializer
    }
    return e
  },
  LiteralExpression(e) {
    return e
  },
}
