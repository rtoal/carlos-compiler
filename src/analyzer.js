// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.
// Checks are made relative to a semantic context that is passed to the analyzer
// function for each node.

import { Variable } from "./ast.js"

class Context {
  constructor(context) {
    // Currently, the only analysis context needed is the set of declared
    // variables. We store this as a map, indexed by the variable name,
    // for efficient lookup.
    //
    // Later, contexts will need to record the current function or module,
    // whether you were in a loop (for validating breaks and continues),
    // and have a reference to the parent context for static scope analysis,
    // among other things.
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
  VariableDeclaration(d, context) {
    analyze(d.initializer, context)
    // Declarations are syntactic, but the real variable is semantic
    d.variable = new Variable(d.name, d.readOnly)
    // Record in context so we can look it up when used in expressions
    context.add(d.name, d.variable)
  },
  Assignment(s, context) {
    analyze(s.source, context)
    analyze(s.target, context)
    if (s.target.referent.readOnly) {
      throw new Error(`Cannot assign to constant ${s.target.referent.name}`)
    }
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
    // This expressions refers to an actual variable
    e.referent = context.lookup(e.name)
  },
  Literal(e, context) {
    // There is LITERALly nothing to analyze here (sorry)
  },
  Array(a, context) {
    a.forEach(entity => analyze(entity, context))
  },
}
