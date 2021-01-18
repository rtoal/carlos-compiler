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
//   - while-false becomes a no-op
//   - if-true and if-false reduce to only the taken arm

import { IdentifierExpression, Literal, UnaryExpression } from "./ast.js"

export default function optimize(node) {
  return optimizers[node.constructor.name](node)
}

const optimizers = {
  Program(p) {
    p.statements = optimize(p.statements)
    return p
  },
  Variable(v) {
    v.initializer = optimize(v.initializer)
    return v
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
    s.argument = optimize(s.argument)
    return s
  },
  IfStatement(s) {
    s.test = optimize(s.test)
    s.consequent = optimize(s.consequent)
    if (s.alternative) {
      s.alternative = optimize(s.alternative)
    }
    if (s.test.constructor === Literal) {
      return s.test.value ? s.consequent : s.alternative
    }
    return s
  },
  ShortIfStatement(s) {
    s.test = optimize(s.test)
    s.consequent = optimize(s.consequent)
    if (s.test.constructor === Literal) {
      return s.test.value ? s.consequent : null
    }
    return s
  },
  WhileStatement(s) {
    s.test = optimize(s.test)
    if (s.test.constructor === Literal && !s.test.value) {
      // while false is a no-op
      return null
    }
    s.body = optimize(s.body)
    return s
  },
  OrExpression(e) {
    // Get rid of all disjuncts after a literal true
    const optimizedDisjuncts = []
    for (const d of e.disjuncts) {
      const optimized = optimize(d)
      optimizedDisjuncts.push(optimized)
      if (optimized.constructor === Literal && optimized.value) {
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
      if (optimized.constructor === Literal && !optimized.value) {
        break
      }
    }
    e.conjuncts = optimizedConjuncts
    return e
  },
  BinaryExpression(e) {
    e.left = optimize(e.left)
    e.right = optimize(e.right)
    if (e.left.constructor === Literal) {
      const x = e.left.value
      if (e.right.constructor === Literal) {
        const y = e.right.value
        if (e.op == "+") {
          return new Literal(x + y)
        } else if (e.op == "-") {
          return new Literal(x - y)
        } else if (e.op == "*") {
          return new Literal(x * y)
        } else if (e.op == "/") {
          return new Literal(x / y)
        } else if (e.op == "**") {
          return new Literal(x ** y)
        } else if (e.op == "<") {
          return new Literal(x < y)
        } else if (e.op == "<=") {
          return new Literal(x <= y)
        } else if (e.op == "==") {
          return new Literal(x === y)
        } else if (e.op == "!=") {
          return new Literal(x !== y)
        } else if (e.op == ">=") {
          return new Literal(x >= y)
        } else if (e.op == ">") {
          return new Literal(x > y)
        }
      } else if (x === 0 && e.op === "+") {
        return e.right
      } else if (x === 1 && e.op === "*") {
        return e.right
      } else if (x === 0 && e.op === "-") {
        return new UnaryExpression("-", e.right)
      } else if (x === 0 && e.op === "*") {
        return new Literal(0)
      } else if (x === 0 && e.op === "/") {
        return new Literal(0)
      } else if (x === 1 && e.op === "**") {
        return new Literal(1)
      }
    } else if (e.right.constructor === Literal) {
      const y = e.right.value
      if (["+", "-"].includes(e.op) && y === 0) {
        return e.left
      } else if (["*", "/"].includes(e.op) && y === 1) {
        return e.left
      } else if (e.op === "*" && y === 0) {
        return new Literal(0)
      } else if (e.op === "**" && y === 0) {
        return new Literal(1)
      }
    }
    return e
  },
  UnaryExpression(e) {
    e.operand = optimize(e.operand)
    if (e.operand.constructor === Literal) {
      const x = e.operand.value
      if (e.op === "-") {
        return new Literal(-x)
      } else if (e.op === "abs") {
        return new Literal(Math.abs(x))
      } else if (e.op === "sqrt") {
        return new Literal(Math.sqrt(x))
      }
    }
    return e
  },
  IdentifierExpression(e) {
    if (e.name === "true" || e.name === "false") {
      // Who needs references when we can have straight up literals
      return new Literal(e.name === "true")
    }
    return e
  },
  Literal(e) {
    return e
  },
  Array(a) {
    return a.flatMap(optimize).filter(s => s !== null)
  },
}
