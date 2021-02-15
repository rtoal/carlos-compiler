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

import { Variable, UnaryExpression } from "./ast.js"

export default function optimize(node) {
  return optimizers[node.constructor.name](node)
}

const optimizers = {
  Program(p) {
    p.statements = optimize(p.statements)
    return p
  },
  VariableDeclaration(d) {
    d.initializer = optimize(d.initializer)
    return d
  },
  Variable(v) {
    return v
  },
  Assignment(s) {
    s.source = optimize(s.source)
    s.target = optimize(s.target)
    if (s.target.constructor === Variable) {
      if (s.source === s.target) {
        return null
      }
    }
    return s
  },
  PrintStatement(s) {
    s.argument = optimize(s.argument)
    return s
  },
  OrExpression(e) {
    // Get rid of all disjuncts after a literal true
    const optimizedDisjuncts = []
    for (const disjunct of e.disjuncts) {
      const optimized = optimize(disjunct)
      optimizedDisjuncts.push(optimized)
      if (optimized === true) {
        break
      }
    }
    e.disjuncts = optimizedDisjuncts
    return e
  },
  AndExpression(e) {
    // Get rid of all conjuncts after a literal false
    const optimizedConjuncts = []
    for (const conjunct of e.conjuncts) {
      const optimized = optimize(conjunct)
      optimizedConjuncts.push(optimized)
      if (optimized === false) {
        break
      }
    }
    e.conjuncts = optimizedConjuncts
    return e
  },
  BinaryExpression(e) {
    e.left = optimize(e.left)
    e.right = optimize(e.right)
    if (e.left.constructor === Number) {
      if (e.right.constructor === Number) {
        if (e.op == "+") {
          return e.left + e.right
        } else if (e.op == "-") {
          return e.left - e.right
        } else if (e.op == "*") {
          return e.left * e.right
        } else if (e.op == "/") {
          return e.left / e.right
        } else if (e.op == "**") {
          return e.left ** e.right
        } else if (e.op == "<") {
          return e.left < e.right
        } else if (e.op == "<=") {
          return e.left <= e.right
        } else if (e.op == "==") {
          return e.left === e.right
        } else if (e.op == "!=") {
          return e.left !== e.right
        } else if (e.op == ">=") {
          return e.left >= e.right
        } else if (e.op == ">") {
          return e.left > e.right
        }
      } else if (e.left === 0 && e.op === "+") {
        return e.right
      } else if (e.left === 1 && e.op === "*") {
        return e.right
      } else if (e.left === 0 && e.op === "-") {
        return new UnaryExpression("-", e.right)
      } else if (e.left === 1 && e.op === "**") {
        return 1
      } else if (e.left === 0 && ["*", "/"].includes(e.op)) {
        return 0
      }
    } else if (e.right.constructor === Number) {
      if (["+", "-"].includes(e.op) && e.right === 0) {
        return e.left
      } else if (["*", "/"].includes(e.op) && e.right === 1) {
        return e.left
      } else if (e.op === "*" && e.right === 0) {
        return 0
      } else if (e.op === "**" && e.right === 0) {
        return 1
      }
    }
    return e
  },
  UnaryExpression(e) {
    e.operand = optimize(e.operand)
    if (e.operand.constructor === Number) {
      if (e.op === "-") {
        return -e.operand
      }
    }
    return e
  },
  Number(e) {
    return e
  },
  Boolean(e) {
    return e
  },
  Array(a) {
    // Optimizing arrays involves flattening an removing nulls
    return a.flatMap(optimize).filter(s => s !== null)
  },
}
