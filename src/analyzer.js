// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.

import { Variable, Type, FunctionType } from "./ast.js"

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

function checkIsType(t) {
  check([Type, FunctionType].includes(t.constructor), "Type expected")
}

function checkSameTypes(e1, e2, op) {
  check(e1.type === e2.type, `'${op}' operands must have same types`)
}

// Covariance for parameters and contravariance for return types
function checkAssignable(targetType, sourceType) {
  function isAssignable(targetType, sourceType) {
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
  Function(f) {
    f.returnType = this.analyze(f.returnType)
    this.add(f.name, f)
    // When entering a function body, we must reset the inLoop setting,
    // because it is possible to declare a function inside a loop!
    const childContext = this.newChild({ inLoop: false, forFunction: f })
    f.parameters = childContext.analyze(f.parameters)
    const parameterTypes = f.parameters.map(p => p.type)
    f.type = new FunctionType(parameterTypes, f.returnType)
    childContext.analyze(f.body)
    return f
  }
  NamedType(t) {
    t = this.lookup(t.name)
    checkIsType(t)
    return t
  }
  FunctionType(t) {
    t.parameterTypes = t.parameterTypes.map(p => this.analyze(p))
    t.returnType = this.analyze(t.returnType)
    return t
  }
  Parameter(p) {
    p.type = this.analyze(p.type)
    this.add(p.name, p)
    return p
  }
  Assignment(s) {
    s.source = this.analyze(s.source)
    s.target = this.analyze(s.target)
    checkAssignable(s.target.type, s.source.type)
    checkNotReadOnly(s.target)
    return s
  }
  PrintStatement(s) {
    s.argument = this.analyze(s.argument)
    return s
  }
  WhileStatement(s) {
    s.test = this.analyze(s.test)
    checkBoolean(s.test, "while")
    s.body = this.newChild({ inLoop: true }).analyze(s.body)
    return s
  }
  IfStatement(s) {
    s.test = this.analyze(s.test)
    checkBoolean(s.test, "if")
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
    checkBoolean(s.test, "if")
    s.consequent = this.newChild().analyze(s.consequent)
    return s
  }
  ReturnStatement(s) {
    checkInFunction(this)
    if (this.function.returnType !== Type.VOID) {
      checkReturnHasExpression(s)
      s.expression = this.analyze(s.expression)
      checkAssignable(this.function.returnType, s.expression.type)
    } else {
      checkReturnHasNoExpression(s)
    }
    return s
  }
  Call(c) {
    c.callee = this.analyze(c.callee)
    checkIsCallable(c.callee)
    checkArgumentCount(c.callee, c.args)
    c.args = this.analyze(c.args)
    checkArgumentMatching(c.callee, c.args)
    c.type = c.callee.returnType
    return c
  }
  BreakStatement(s) {
    checkInLoop(this, "break")
    return s
  }
  ContinueStatement(s) {
    checkInLoop(this, "continue")
    return s
  }
  OrExpression(e) {
    e.disjuncts = this.analyze(e.disjuncts)
    e.disjuncts.forEach(disjunct => checkBoolean(disjunct, "||"))
    e.type = Type.BOOLEAN
    return e
  }
  AndExpression(e) {
    e.conjuncts = this.analyze(e.conjuncts)
    e.conjuncts.forEach(conjunct => checkBoolean(conjunct, "&&"))
    e.type = Type.BOOLEAN
    return e
  }
  BinaryExpression(e) {
    e.left = this.analyze(e.left)
    e.right = this.analyze(e.right)
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
    return e
  }
  UnaryExpression(e) {
    e.operand = this.analyze(e.operand)
    checkNumber(e.operand, e.op)
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
  Type.prototype.type = Type.TYPE
  const initialContext = new Context()
  initialContext.add("number", Type.NUMBER)
  initialContext.add("boolean", Type.BOOLEAN)
  initialContext.add("void", Type.VOID)
  initialContext.analyze(node)
  return node
}
