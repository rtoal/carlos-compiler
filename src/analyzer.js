// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.
// Checks are made relative to a semantic context that is passed to the analyzer
// function for each node.

import { Variable, Literal, Type } from "./ast.js"

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
  static get initial() {
    // The initial context for a compilation holds all the predefined
    // identifiers. In our case, so far, the only predefined identifiers
    // are the *constants* false and true.
    const context = new Context()
    for (let [name, value] of Object.entries({ false: false, true: true })) {
      analyze(new Variable(name, true, new Literal(value)), context)
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
    // This expressions refers to an actual variable
    e.referent = context.lookup(e.name)
    // And for convenience, mark the reference itself with a type
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
