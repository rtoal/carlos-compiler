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

function checkInLoop(context, disruptor) {
  check(context.inLoop, `'${disruptor}' can only appear in a loop`)
}

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
  analyze(node) {
    this[node.constructor.name](node)
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
  WhileStatement(s) {
    this.analyze(s.test)
    checkBoolean(s.test, "while")
    const bodyContext = this.newChild({ inLoop: true })
    s.body.forEach(s => bodyContext.analyze(s))
  }
  IfStatement(s) {
    this.analyze(s.test)
    checkBoolean(s.test, "if")
    this.newChild().analyze(s.consequent)
    if (s.alternative.constructor === Array) {
      // It's a block of statements, make a new context
      this.newChild().analyze(s.alternative)
    } else if (s.alternative) {
      // It's a trailing if-statement, so same context
      this.analyze(s.alternative)
    }
  }
  ShortIfStatement(s) {
    this.analyze(s.test)
    checkBoolean(s.test, "if")
    this.newChild().analyze(s.consequent)
  }
  BreakStatement(s) {
    checkInLoop(this, "break")
  }
  ContinueStatement(s) {
    checkInLoop(this, "continue")
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
