// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.
// Checks are made relative to a semantic context that is passed to the analyzer
// function for each node.

import util from "util"
import { Variable, Literal, Type } from "./ast.js"

class Context {
  constructor(parent = null) {
    // Parent for static scoping
    this.parent = parent

    // All local declarations. Names map to variable declarations, types, and
    // function declarations.
    this.locals = new Map()

    // Whether we are in a loop, so that we know whether breaks and continues
    // are legal here
    this.inLoop = false

    // Whether we are in a function, so that we know whether a return
    // statement can appear here, and if so, how we typecheck it
    this.function = null
  }

  sees(name) {
    return this.locals.has(name) || this.parent?.sees(name)
  }

  add(name, entity) {
    if (this.sees(name)) {
      throw new Error(`Identifier ${name} already declared`)
    }
    this.locals.set(name, entity)
  }

  lookup(name) {
    // console.log(
    //   `Looking up ${name} where locals is ${util.inspect(this.locals)}`
    // )
    const entity = this.locals.get(name)
    if (entity) {
      return entity
    } else if (this.parent) {
      return this.parent.lookup(name)
    }
    throw new Error(`Identifier ${name} not declared`)
  }

  newChild({ inLoop = false, forFunction = null } = {}) {
    const childContext = new Context(this)
    childContext.inLoop = inLoop
    childContext.function = forFunction
    return childContext
  }

  static get initial() {
    // The initial context for a compilation holds all the predefined
    // identifiers, which so far are the constants true and false and the
    // types number and boolean.
    const context = new Context()
    context.add("number", Type.NUMBER)
    context.add("boolean", Type.BOOLEAN)
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

function checkAssignable(targetType, sourceType) {
  check(
    targetType === sourceType,
    `Expected type ${targetType.name}, got type ${sourceType.name}`
  )
}
function checkNotReadOnly(e) {
  check(!e.readOnly, `Cannot assign to constant ${e.name}`)
}

function checkInLoop(context, disruptor) {
  check(context.inLoop, `'${disruptor}' can only appear in a loop`)
}

function checkInFunction(context) {
  check(context.function, "Return can only appear in a function")
}

function checkInVoidFunction(context) {
  check(!context.function.returnType, "Something should be returned here")
}

function checkInNonVoidFunction(context) {
  check(context.function.returnType, "Cannot return a value here")
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
  NamedTypeExpression(t, context) {
    // In syntax, it's just a name, but in semantics we find the real type
    t.type = context.lookup(t.name)
  },
  Function(f, context) {
    if (f.returnTypeExpression) {
      analyze(f.returnTypeExpression, context)
      f.returnType = f.returnTypeExpression.type
    } else {
      f.returnType = null
    }
    context.add(f.name, f)
    const childContext = context.newChild({ inLoop: false, forFunction: f })
    f.parameters.forEach(p => analyze(p, childContext))
    analyze(f.body, childContext)
  },
  Parameter(p, context) {
    analyze(p.typeExpression, context)
    p.type = p.typeExpression.type
    context.add(p.name, p)
  },
  Assignment(s, context) {
    analyze(s.source, context)
    analyze(s.target, context)
    checkAssignable(s.target.type, s.source.type)
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
  ReturnStatement(s, context) {
    checkInFunction(context)
    if (s.expression === null) {
      // Plain return statement, current function must be void
      checkInVoidFunction(context)
    } else {
      // Return statement with value, need a type check
      analyze(s.expression, context)
      checkInNonVoidFunction(context)
      checkAssignable(context.function.returnType, s.expression.type)
    }
  },
  Call(c, context) {
    analyze(c.callee, context)
    c.callee = c.callee.referent
    const [argCount, paramCount] = [c.args.length, c.callee.parameters.length]
    check(
      argCount === paramCount,
      `${paramCount} parameters required, but call has ${argCount} arguments`
    )
    for (let i = 0; i < argCount; i++) {
      analyze(c.args[i], context)
      checkAssignable(c.callee.parameters[i].type, c.args[i].type)
    }
    c.type = c.callee.returnType
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
    // This expression refers to an actual variable
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
