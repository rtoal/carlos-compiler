// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.

import { Variable, Type } from "./ast.js"

function must(condition, errorMessage) {
  if (!condition) {
    throw new Error(errorMessage)
  }
}

const check = {
  isNumber(e) {
    must(e.type === Type.NUMBER, `Expected a number but got a ${e.type.name}`)
  },
  isBoolean(e) {
    must(e.type === Type.BOOLEAN, `Expected a boolean but got a ${e.type.name}`)
  },
  haveSameTypes(e1, e2) {
    must(e1.type === e2.type, "Operands do not have the same type")
  },
  isTypeAssignable(from, { to }) {
    must(from === to, `Cannot assign a ${from.name} to a ${to.name}`)
  },
  isAssignable(from, { to }) {
    check.isTypeAssignable(from.type, { to: to.type })
  },
  isNotReadOnly(e) {
    must(!e.readOnly, `Cannot assign to constant ${e.name}`)
  },
  inLoop(context, disruptor) {
    must(context.inLoop, `'${disruptor}' can only appear in a loop`)
  },
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
    return this[node.constructor.name](node)
  }
  Program(p) {
    p.statements = this.analyze(p.statements)
    return p
  }
  VariableDeclaration(d) {
    // Declarations generate brand new variable objects
    d.initializer = this.analyze(d.initializer)
    d.variable = new Variable(d.name, d.readOnly)
    d.variable.type = d.initializer.type
    this.add(d.variable.name, d.variable)
    return d
  }
  Assignment(s) {
    s.source = this.analyze(s.source)
    s.target = this.analyze(s.target)
    check.isAssignable(s.source, { to: s.target })
    check.isNotReadOnly(s.target)
    return s
  }
  PrintStatement(s) {
    s.argument = this.analyze(s.argument)
    return s
  }
  WhileStatement(s) {
    s.test = this.analyze(s.test)
    check.isBoolean(s.test, "while")
    s.body = this.newChild({ inLoop: true }).analyze(s.body)
    return s
  }
  IfStatement(s) {
    s.test = this.analyze(s.test)
    check.isBoolean(s.test, "if")
    s.consequent = this.newChild().analyze(s.consequent)
    if (s.alternative.constructor === Array) {
      // It's a block of statements, make a new context
      s.alternative = this.newChild().analyze(s.alternative)
    } else if (s.alternative) {
      // It's a trailing if-statement, so same context
      s.alternative = this.analyze(s.alternative)
    }
    return s
  }
  ShortIfStatement(s) {
    s.test = this.analyze(s.test)
    check.isBoolean(s.test, "if")
    s.consequent = this.newChild().analyze(s.consequent)
    return s
  }
  BreakStatement(s) {
    check.inLoop(this, "break")
    return s
  }
  ContinueStatement(s) {
    check.inLoop(this, "continue")
    return s
  }
  OrExpression(e) {
    e.disjuncts = this.analyze(e.disjuncts)
    e.disjuncts.forEach(disjunct => check.isBoolean(disjunct))
    e.type = Type.BOOLEAN
    return e
  }
  AndExpression(e) {
    e.conjuncts = this.analyze(e.conjuncts)
    e.conjuncts.forEach(conjunct => check.isBoolean(conjunct))
    e.type = Type.BOOLEAN
    return e
  }
  BinaryExpression(e) {
    e.left = this.analyze(e.left)
    e.right = this.analyze(e.right)
    if (["+", "-", "*", "/", "**"].includes(e.op)) {
      check.isNumber(e.left)
      check.isNumber(e.right)
      e.type = Type.NUMBER
    } else if (["<", "<=", ">", ">="].includes(e.op)) {
      check.isNumber(e.left)
      check.isNumber(e.right)
      e.type = Type.BOOLEAN
    } else if (["==", "!="].includes(e.op)) {
      check.haveSameTypes(e.left, e.right)
      e.type = Type.BOOLEAN
    }
    return e
  }
  UnaryExpression(e) {
    e.operand = this.analyze(e.operand)
    check.isNumber(e.operand)
    e.type = Type.NUMBER
    return e
  }
  IdentifierExpression(e) {
    // Id expressions get "replaced" with the variables they refer to
    return this.lookup(e.name)
  }
  Number(e) {
    return e
  }
  Boolean(e) {
    return e
  }
  Array(a) {
    return a.map(item => this.analyze(item))
  }
}

export default function analyze(node) {
  Number.prototype.type = Type.NUMBER
  Boolean.prototype.type = Type.BOOLEAN
  // Analyze in a fresh global context
  return new Context().analyze(node)
}
