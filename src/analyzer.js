// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.
// Checks are made relative to a semantic context that is passed to the analyzer
// function for each node.

import { Declaration, LiteralExpression, Type } from "./ast.js"

class Context {
  constructor(parent = null) {
    // This is where we maintain the local variables of a block as well as
    // a reference to the parent context for static scope analysis. Later
    // we will have more to record.
    this.parent = parent
    this.locals = new Map()
  }
  sees(name) {
    return this.locals.has(name) || this.parent?.sees(name)
  }
  addDeclaration(variable) {
    if (this.sees(variable.name)) {
      throw new Error(`Identifier ${variable.name} already declared`)
    }
    this.locals.set(variable.name, variable)
  }
  lookup(name) {
    const variable = this.locals.get(name)
    if (variable) {
      return variable
    } else if (this.parent) {
      return this.parent.lookup(name)
    }
    throw new Error(`Identifier ${name} not declared`)
  }
  newChild() {
    const childContext = new Context(this)
    return childContext
  }
  static get initial() {
    // The initial context for a compilation holds all the predefined
    // identifiers. In our case, so far, the only predefined identifiers
    // are the *constants* false and true.
    const context = new Context()
    for (let [name, value] of Object.entries({ false: false, true: true })) {
      const literal = new LiteralExpression(value)
      const declaration = new Declaration(name, true, literal)
      analyze(declaration, context)
    }
    return context
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

export default function analyze(node, context = Context.initial) {
  analyzers[node.constructor.name](node, context)
  return node
}

const analyzers = {
  Program(p, context) {
    analyze(p.statements, context)
  },
  Declaration(d, context) {
    analyze(d.initializer, context)
    // Tag this variable with the type of the expression initializing it
    d.type = d.initializer.type
    // Record this variable in the context since we might have to look it up
    context.addDeclaration(d)
  },
  Assignment(s, context) {
    analyze(s.source, context)
    analyze(s.target, context)
    checkSameTypes(s.target, s.source, "=")
    checkNotReadOnly(s.target.referent)
  },
  PrintStatement(s, context) {
    analyze(s.expression, context)
  },
  WhileStatement(s, context) {
    analyze(s.test, context)
    checkBoolean(s.test, "while")
    const bodyContext = context.newChild()
    s.body.forEach(s => analyze(s, bodyContext))
  },
  IfStatement(s, context) {
    analyze(s.test, context)
    checkBoolean(s.test, "if")
    analyze(s.consequent, context.newChild())
    if (s.alternative?.constructor === Array) {
      // It's a block of statements, make a new context
      analyze(s.alternative, context.newChild())
    } else if (s.alternative) {
      // It's a trailing if-statement, so same context
      analyze(s.alternative, context)
    }
  },
  Block(b, context) {
    for (const s of b.statements) {
      analyze(s, context)
    }
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
    // Tag this variable reference with the declaration it references
    e.referent = context.lookup(e.name)
    // And for convenience, mark the reference itself with a type
    e.type = e.referent.type
  },
  LiteralExpression(e) {
    // We only have numbers and booleans for now
    e.type = typeof e.value === "number" ? Type.NUMBER : Type.BOOLEAN
  },
  Array(a, context) {
    a.forEach(s => analyze(s, context))
  },
}
