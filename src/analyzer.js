// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.
// Checks are made relative to a semantic context that is passed to the analyzer
// function for each node.

import { Variable, Literal, Type } from "./ast.js"

class Context {
  constructor(parent = null, { inLoop } = {}) {
    // This is where we maintain the local variables of a block as well as
    // a reference to the parent context for static scope analysis. Our
    // language does not have functions yet, but we do have to keep track
    // of whether we are in a loop, to make sure breaks and continues are
    // legal
    this.parent = parent
    this.locals = new Map()
    this.inLoop = inLoop ?? parent?.inLoop ?? false
  }
  sees(name) {
    // Search "outward" through enclosing scopes
    return this.locals.has(name) || this.parent?.sees(name)
  }
  add(name, entity) {
    // No shadowing! Prevent addition if id anywhere in scope chain!
    if (this.sees(name)) {
      throw new Error(`Identifier ${name} already declared`)
    }
    this.locals.set(name, entity)
  }
  lookup(name) {
    const entity = this.locals.get(name)
    if (entity) {
      return entity
    } else if (this.parent) {
      return this.parent.lookup(name)
    }
    throw new Error(`Identifier ${name} not declared`)
  }
  newChild({ inLoop } = {}) {
    // Create new (nested) context, which is just like the current context
    // except that certain fields can be overridden
    return new Context(this, { inLoop })
  }
}

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

function checkInLoop(context, disruptor) {
  check(context.inLoop, `'${disruptor}' can only appear in a loop`)
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
    v.type = v.initializer.type
    context.add(v.name, v)
  },
  Assignment(s, context) {
    analyze(s.source, context)
    analyze(s.target, context)
    checkSameTypes(s.target, s.source, "=")
    checkNotReadOnly(s.target.referent)
  },
  PrintStatement(s, context) {
    analyze(s.argument, context)
  },
  WhileStatement(s, context) {
    analyze(s.test, context)
    checkBoolean(s.test, "while")
    const bodyContext = context.newChild({ inLoop: true })
    s.body.forEach(s => analyze(s, bodyContext))
  },
  IfStatement(s, context) {
    analyze(s.test, context)
    checkBoolean(s.test, "if")
    analyze(s.consequent, context.newChild())
    if (s.alternative.constructor === Array) {
      // It's a block of statements, make a new context
      analyze(s.alternative, context.newChild())
    } else if (s.alternative) {
      // It's a trailing if-statement, so same context
      analyze(s.alternative, context)
    }
  },
  ShortIfStatement(s, context) {
    analyze(s.test, context)
    checkBoolean(s.test, "if")
    analyze(s.consequent, context.newChild())
  },
  BreakStatement(s, context) {
    checkInLoop(context, "break")
  },
  ContinueStatement(s, context) {
    checkInLoop(context, "continue")
  },
  OrExpression(e, context) {
    for (const disjunct of e.disjuncts) {
      analyze(disjunct, context)
      checkBoolean(disjunct, "||")
    }
    e.type = Type.BOOLEAN
  },
  AndExpression(e, context) {
    for (const conjunct of e.conjuncts) {
      analyze(conjunct, context)
      checkBoolean(conjunct, "&&")
    }
    e.type = Type.BOOLEAN
  },
  BinaryExpression(e, context) {
    analyze(e.left, context)
    analyze(e.right, context)
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
  },
  UnaryExpression(e, context) {
    analyze(e.operand, context)
    // All unary operands (for now) are number -> number
    checkNumber(e.operand, e.op)
    e.type = Type.NUMBER
  },
  IdentifierExpression(e, context) {
    // Find out which actual variable is being referred to
    e.referent = context.lookup(e.name)
    // We want *all* expressions to have a type property
    e.type = e.referent.type
  },
  Literal(e) {
    // We only have numbers and booleans for now
    e.type = typeof e.value === "number" ? Type.NUMBER : Type.BOOLEAN
  },
  Array(a, context) {
    a.forEach(entity => analyze(entity, context))
  },
}
