// Semantic Analyzer
//
// Analyzes the AST by looking for semantic errors and resolving references.
// Checks are made relative to a semantic context that is passed to the analyzer
// function for each node.

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
  addDeclaration(variable) {
    if (this.locals.has(variable.name)) {
      throw new Error(`Identifier ${variable.name} already declared`)
    }
    this.locals.set(variable.name, variable)
  }
  lookup(name) {
    const variable = this.locals.get(name)
    if (variable) {
      return variable
    }
    throw new Error(`Identifier ${name} not declared`)
  }
}

export default function analyze(node, context = new Context()) {
  analyzers[node.constructor.name](node, context)
  return node
}

const analyzers = {
  Program(p, context) {
    analyze(p.statements, context)
  },
  VariableDeclaration(d, context) {
    analyze(d.initializer, context)
    // Record this variable in the context since we might have to look it up
    context.addDeclaration(d)
  },
  Assignment(s, context) {
    analyze(s.source, context)
    analyze(s.target, context)
  },
  PrintStatement(s, context) {
    analyze(s.argument, context)
  },
  BinaryExpression(e, context) {
    analyze(e.left, context)
    analyze(e.right, context)
  },
  UnaryExpression(e, context) {
    analyze(e.operand, context)
  },
  IdentifierExpression(e, context) {
    // Tag this variable reference with the declaration it references
    e.referent = context.lookup(e.name)
  },
  Literal(e, context) {
    // There is LITERALly nothing to analyze here (sorry)
  },
  Array(a, context) {
    a.forEach(s => analyze(s, context))
  },
}
