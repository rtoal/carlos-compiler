// Abstract Syntax Tree Nodes
//
// This module defines classes for the AST nodes. Only the constructors are
// defined here. Semantic analysis methods, optimization methods, and code
// generation are handled by other modules. This keeps the compiler organized
// by phase.
//
// The root (Program) node has a custom inspect method, so you can console.log
// the root node and you'll get a lovely formatted string with details on the
// entire AST. It even works well if you analyze the AST and turn it into a
// graph with cycles.

import util from "util"

export class Program {
  constructor(statements) {
    this.statements = statements
  }
  [util.inspect.custom]() {
    return prettied(this)
  }
}

export class Type {
  constructor(name) {
    this.name = name
  }
  static BOOLEAN = new Type("boolean")
  static NUMBER = new Type("number")
  static VOID = new Type("void")
  static TYPE = new Type("type")
}

export class NamedType {
  constructor(name) {
    this.name = name
  }
}

export class FunctionType {
  constructor(parameterTypes, returnType) {
    Object.assign(this, { parameterTypes, returnType })
  }
  get name() {
    return `(${this.parameterTypes.map(t => t.name).join(",")})->${
      this.returnType.name
    }`
  }
}

export class VariableDeclaration {
  constructor(name, readOnly, initializer) {
    Object.assign(this, { name, readOnly, initializer })
  }
}

export class Variable {
  constructor(name, readOnly) {
    Object.assign(this, { name, readOnly })
  }
}

export class FunctionDeclaration {
  constructor(name, parameters, returnType, body) {
    Object.assign(this, { name, parameters, returnType, body })
  }
}

export class Function {
  constructor(name, returnType) {
    // All other properties added during semantic analysis
    Object.assign(this, { name, returnType })
  }
}

export class Parameter {
  constructor(name, type) {
    Object.assign(this, { name, type })
  }
}

export class Assignment {
  constructor(target, source) {
    Object.assign(this, { target, source })
  }
}

export class PrintStatement {
  constructor(argument) {
    this.argument = argument
  }
}

export class Call {
  constructor(callee, args) {
    Object.assign(this, { callee, args })
  }
}

export class IfStatement {
  constructor(test, consequent, alternative) {
    Object.assign(this, { test, consequent, alternative })
  }
}

export class ShortIfStatement {
  constructor(test, consequent) {
    Object.assign(this, { test, consequent })
  }
}

export class WhileStatement {
  constructor(test, body) {
    Object.assign(this, { test, body })
  }
}

export class BreakStatement {
  // Intentionally empty
}

export class ContinueStatement {
  // Intentionally empty
}

export class ReturnStatement {
  constructor(expression) {
    Object.assign(this, { expression })
  }
}

export class OrExpression {
  constructor(disjuncts) {
    this.disjuncts = disjuncts
  }
}

export class AndExpression {
  constructor(conjuncts) {
    this.conjuncts = conjuncts
  }
}

export class BinaryExpression {
  constructor(op, left, right) {
    Object.assign(this, { op, left, right })
  }
}

export class UnaryExpression {
  constructor(op, operand) {
    Object.assign(this, { op, operand })
  }
}

export class IdentifierExpression {
  constructor(name) {
    this.name = name
  }
}

function prettied(node) {
  // Return a compact and pretty string representation of the node graph,
  // taking care of cycles. Written here from scratch because the built-in
  // inspect function, while nice, isn't nice enough.
  const tags = new Map()

  function tag(node) {
    if (tags.has(node) || typeof node !== "object" || node === null) return
    tags.set(node, tags.size + 1)
    for (const child of Object.values(node)) {
      Array.isArray(child) ? child.forEach(tag) : tag(child)
    }
  }

  function* lines() {
    function view(e) {
      if (tags.has(e)) return `#${tags.get(e)}`
      if (Array.isArray(e)) return `[${e.map(view)}]`
      return util.inspect(e)
    }
    for (let [node, id] of [...tags.entries()].sort((a, b) => a[1] - b[1])) {
      let [type, props] = [node.constructor.name, ""]
      Object.entries(node).forEach(([k, v]) => (props += ` ${k}=${view(v)}`))
      yield `${String(id).padStart(4, " ")} | ${type}${props}`
    }
  }

  tag(node)
  return [...lines()].join("\n")
}
