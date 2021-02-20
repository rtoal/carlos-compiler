// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.

import { Variable, Type } from "./ast.js"

function check(condition, errorMessage) {
  if (!condition) {
    throw new Error(errorMessage)
  }
}

function checkIsNumber(e) {
  check(e.type === Type.NUMBER, `Expected a number but got a ${e.type.name}`)
}

function checkIsBoolean(e) {
  check(e.type === Type.BOOLEAN, `Expected a boolean but got a ${e.type.name}`)
}

function checkHaveSameTypes(e1, e2) {
  check(e1.type === e2.type, "Operands do not have the same type")
}

function checkIsAssignable(source, { to: target }) {
  check(
    source.type === target.type,
    `Cannot assign a ${source.type.name} to a ${target.type.name}`
  )
}

function checkIsNotReadOnly(e) {
  check(!e.readOnly, `Cannot assign to constant ${e.name}`)
}

class Context {
  constructor(parent = null) {
    // This is where we maintain the local variables of a block as well as
    // a reference to the parent context for static scope analysis (i.e., we
    // will have nested scopes). Later we will have more to record, such as
    // whether we are currently in a loop (to check future break and continue
    // statements) or whether we are currently in a function body (to check
    // future return statements).
    this.parent = parent
    this.locals = new Map()
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
  newChild() {
    // Create new (nested) context (used for if and while statement bodies)
    return new Context(this)
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
    checkIsAssignable(s.source, { to: s.target })
    checkIsNotReadOnly(s.target)
    return s
  }
  PrintStatement(s) {
    s.argument = this.analyze(s.argument)
    return s
  }
  WhileStatement(s) {
    s.test = this.analyze(s.test)
    checkIsBoolean(s.test, "while")
    s.body = this.newChild().analyze(s.body)
    return s
  }
  IfStatement(s) {
    s.test = this.analyze(s.test)
    checkIsBoolean(s.test, "if")
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
    checkIsBoolean(s.test, "if")
    s.consequent = this.newChild().analyze(s.consequent)
    return s
  }
  OrExpression(e) {
    e.disjuncts = this.analyze(e.disjuncts)
    e.disjuncts.forEach(disjunct => checkIsBoolean(disjunct))
    e.type = Type.BOOLEAN
    return e
  }
  AndExpression(e) {
    e.conjuncts = this.analyze(e.conjuncts)
    e.conjuncts.forEach(conjunct => checkIsBoolean(conjunct))
    e.type = Type.BOOLEAN
    return e
  }
  BinaryExpression(e) {
    e.left = this.analyze(e.left)
    e.right = this.analyze(e.right)
    if (["+", "-", "*", "/", "**"].includes(e.op)) {
      checkIsNumber(e.left)
      checkIsNumber(e.right)
      e.type = Type.NUMBER
    } else if (["<", "<=", ">", ">="].includes(e.op)) {
      checkIsNumber(e.left)
      checkIsNumber(e.right)
      e.type = Type.BOOLEAN
    } else if (["==", "!="].includes(e.op)) {
      checkHaveSameTypes(e.left, e.right)
      e.type = Type.BOOLEAN
    }
    return e
  }
  UnaryExpression(e) {
    e.operand = this.analyze(e.operand)
    checkIsNumber(e.operand)
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
