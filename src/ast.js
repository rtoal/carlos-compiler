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

// A function type node can only be created in the Semantic Analyzer, never
// from syntax processing. Thus we can take advantage of the fact that when
// we are creating them, the parameter types and return types will have
// already been analyzed and will be in good shape.
export class FunctionType extends Type {
  constructor(parameterTypes, returnType) {
    super(`(${parameterTypes.map(t => t.name).join(",")})->${returnType.name}`)
    Object.assign(this, { parameterTypes, returnType })
  }
}

export class Variable {
  constructor(name, readOnly, initializer) {
    Object.assign(this, { name, readOnly, initializer })
  }
}

export class Function {
  constructor(name, parameters, returnTypeName, body) {
    Object.assign(this, { name, parameters, returnTypeName, body })
  }
}

export class Parameter {
  constructor(name, typeName) {
    Object.assign(this, { name, typeName })
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
  const seen = new Map()

  function setIds(node) {
    if (seen.has(node) || typeof node !== "object" || node === null) return
    seen.set(node, seen.size + 1)
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(setIds)
      else setIds(child)
    }
  }

  function* lines() {
    function view(e) {
      if (seen.has(e)) return `#${seen.get(e)}`
      if (Array.isArray(e)) return `[${e.map(view)}]`
      return util.inspect(e)
    }
    for (let [node, id] of [...seen.entries()].sort((a, b) => a[1] - b[1])) {
      let [type, props] = [node.constructor.name, ""]
      for (const [prop, child] of Object.entries(node)) {
        props += ` ${prop}=${view(child)}`
      }
      yield `${String(id).padStart(4, " ")} | ${type}${props}`
    }
  }

  setIds(node)
  return [...lines()].join("\n")
}
