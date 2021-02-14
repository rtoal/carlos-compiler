// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.

import { config } from "process"
import util from "util"
import { Type, Function, FunctionType } from "./ast.js"

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

function checkIsCallable(e) {
  check(e.type.constructor === FunctionType, "Call of non-function")
}

function checkSameTypes(e1, e2, op) {
  check(e1.type === e2.type, `'${op}' operands must have same types`)
}

// Covariance for parameters and contravariance for return types
function checkAssignable(targetType, sourceType) {
  function isAssignable(targetType, sourceType) {
    console.log(`Checking ${targetType.name} vs ${sourceType.name}`)
    if (targetType.constructor === FunctionType) {
      return (
        sourceType.constructor === FunctionType &&
        isAssignable(sourceType.returnType, targetType.returnType) &&
        sourceType.parameterTypes.length === targetType.parameterTypes.length &&
        sourceType.parameterTypes.every((t, i) =>
          isAssignable(targetType.parameterTypes[i], t)
        )
      )
    }
    return targetType === sourceType
  }
  check(
    isAssignable(targetType, sourceType),
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

function checkReturnHasExpression(returnStatement) {
  check(
    returnStatement.expression !== null,
    "Something should be returned here"
  )
}

function checkReturnHasNoExpression(returnStatement) {
  check(!returnStatement.expression, "Cannot return a value here")
}

function checkArgumentCount(callee, args) {
  const parameterCount = callee.type.parameterTypes.length
  const argumentCount = args.length
  check(
    parameterCount === argumentCount,
    `${parameterCount} parameter(s) required, ` +
      `but ${argumentCount} argument(s) passed`
  )
}

function checkArgumentMatching(callee, args) {
  callee.type.parameterTypes.forEach((t, i) => checkAssignable(t, args[i].type))
}

class Context {
  constructor(parent = null, configuration = {}) {
    // Parent (enclosing scope) for static scope analysis
    this.parent = parent
    // All local declarations. Names map to variable declarations, types, and
    // function declarations
    this.locals = new Map()
    // Whether we are in a loop, so that we know whether breaks and continues
    // are legal here
    this.inLoop = configuration.inLoop ?? parent?.inLoop ?? false
    // Whether we are in a function, so that we know whether a return
    // statement can appear here, and if so, how we typecheck it
    this.function = configuration.forFunction ?? parent?.function ?? null
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
  newChild(configuration = {}) {
    // Create new (nested) context, which is just like the current context
    // except that certain fields can be overridden
    return new Context(this, configuration)
  }
  static get initial() {
    // The initial context for a compilation holds all the predefined
    // identifiers. In our case, so far, the only predefined identifiers
    // are the *types* number and boolean.
    const context = new Context()
    context.add("number", Type.NUMBER)
    context.add("boolean", Type.BOOLEAN)
    return context
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
  Function(f) {
    f.returnType = f.returnTypeName ? this.lookup(f.returnTypeName) : Type.VOID
    this.add(f.name, f)
    // When entering a function body, we must reset the inLoop setting,
    // because it is possible to declare a function inside a loop!
    const childContext = this.newChild({ inLoop: false, forFunction: f })
    f.parameters.forEach(p => childContext.analyze(p))
    f.type = new FunctionType(
      f.parameters.map(p => p.type),
      f.returnType
    )
    childContext.analyze(f.body)
  }
  Parameter(p) {
    p.type = this.lookup(p.typeName)
    this.add(p.name, p)
  }
  Assignment(s) {
    this.analyze(s.source)
    this.analyze(s.target)
    checkAssignable(s.target.type, s.source.type)
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
    this.analyze(s.consequent, this.newChild())
  }
  ReturnStatement(s) {
    checkInFunction(this)
    if (this.function.returnType !== Type.VOID) {
      checkReturnHasExpression(s)
      this.analyze(s.expression)
      checkAssignable(this.function.returnType, s.expression.type)
    } else {
      checkReturnHasNoExpression(s)
    }
  }
  Call(c) {
    this.analyze(c.callee)
    checkIsCallable(c.callee.referent)
    checkArgumentCount(c.callee.referent, c.args)
    c.args.forEach(arg => this.analyze(arg))
    checkArgumentMatching(c.callee.referent, c.args)
    c.type = c.callee.referent.returnType
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
    // Record what this identifier is referring to
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
  Type.prototype.type = Type.TYPE
  Context.initial.analyze(node)
  return node
}
