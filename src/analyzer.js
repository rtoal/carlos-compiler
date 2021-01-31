// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.

import { Type } from "./ast.js"

function check(condition, errorMessage) {
  if (!condition) {
    throw new Error(errorMessage)
  }
}

function checkNumber(e, op) {
  check(e.type === Type.NUMBER, `'${op}' operand must be a number`)
}

function checkBoolean(e, op) {
  check(e.type === Type.BOOLEAN, `'${op}' operand must be a boolean`)
}

function checkSameTypes(e1, e2, op) {
  check(e1.type === e2.type, `'${op}' operands must have same types`)
}

function checkNotReadOnly(e) {
  check(!e.readOnly, `Cannot assign to constant ${e.name}`)
}

class Context {
  constructor(context) {
    // Currently, the only analysis context needed is the set of declared
    // variables. We store this as a map, indexed by the variable name,
    // for efficient lookup. More complex languages will a lot more here,
    // such as the current function (to validate return statements), whether
    // you were in a loop (for validating breaks and continues), and a link
    // to a parent context for static scope analysis.
    this.locals = new Map()
  }
  analyze(node) {
    this[node.constructor.name](node)
  }
  add(name, entity) {
    if (this.locals.has(name)) {
      throw new Error(`Identifier ${name} already declared`)
    }
    this.locals.set(name, entity)
  }
  lookup(name) {
    const entity = this.locals.get(name)
    if (entity) {
      return entity
    }
    throw new Error(`Identifier ${name} not declared`)
  }
  Program(p) {
    this.analyze(p.statements)
  }
  Variable(v) {
    this.analyze(v.initializer)
    v.type = v.initializer.type
    this.add(v.name, v)
  }
  Assignment(s) {
    this.analyze(s.source)
    this.analyze(s.target)
    checkSameTypes(s.target, s.source, "=")
    checkNotReadOnly(s.target.referent)
  }
  PrintStatement(s) {
    this.analyze(s.argument)
  }
  OrExpression(e) {
    for (const disjunct of e.disjuncts) {
      this.analyze(disjunct)
      checkBoolean(disjunct, "||")
    }
    e.type = Type.BOOLEAN
  }
  AndExpression(e) {
    for (const conjunct of e.conjuncts) {
      this.analyze(conjunct)
      checkBoolean(conjunct, "&&")
    }
    e.type = Type.BOOLEAN
  }
  BinaryExpression(e) {
    this.analyze(e.left)
    this.analyze(e.right)
    if (["+", "-", "*", "/", "**"].includes(e.op)) {
      checkNumber(e.left, e.op)
      checkNumber(e.right, e.op)
      e.type = Type.NUMBER
    } else if (["<", "<=", ">", ">="].includes(e.op)) {
      checkNumber(e.left, e.op)
      checkNumber(e.right, e.op)
      e.type = Type.BOOLEAN
    } else if (["==", "!="].includes(e.op)) {
      checkSameTypes(e.left, e.right, e.op)
      e.type = Type.BOOLEAN
    }
  }
  UnaryExpression(e) {
    this.analyze(e.operand)
    checkNumber(e.operand, e.op)
    e.type = Type.NUMBER
  }
  IdentifierExpression(e) {
    // Find out which actual variable is being referred to
    e.referent = this.lookup(e.name)
    e.type = e.referent.type
  }
  Number(e) {
    // Nothing to analyze
  }
  Boolean(e) {
    // Nothing to analyze
  }
  Array(a) {
    a.forEach(entity => this.analyze(entity))
  }
}

export default function analyze(node) {
  Number.prototype.type = Type.NUMBER
  Boolean.prototype.type = Type.BOOLEAN
  new Context().analyze(node)
  return node
}
