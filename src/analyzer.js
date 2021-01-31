// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.
// Checks are made relative to a semantic context passed to the analyzer
// function for each node.

import { Variable } from "./ast.js"

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
}

export default function analyze(node, context = new Context()) {
  analyzers[node.constructor.name](node, context)
  return node
}

const analyzers = {
  Program(p, context) {
    analyze(p.statements, context)
  },
  Variable(v, context) {
    analyze(v.initializer, context)
    context.add(v.name, v)
  },
  Assignment(s, context) {
    analyze(s.source, context)
    analyze(s.target, context)
  },
  PrintStatement(s, context) {
    analyze(s.argument, context)
  },
  BinaryExpression(e, context) {
    analyze(e.left, context)
    analyze(e.right, context)
  },
  UnaryExpression(e, context) {
    analyze(e.operand, context)
  },
  IdentifierExpression(e, context) {
    // Find out which actual variable is being referred to
    e.referent = context.lookup(e.name)
  },
  Number(e, context) {
    // Nothing to analyze
  },
  Array(a, context) {
    a.forEach(entity => analyze(entity, context))
  },
}
