// Code Generator Carlos -> JavaScript
//
// Invoke generate(program) with the program node to get back the JavaScript
// translation as a string.

import { IfStatement } from "./ast.js"

export default function generate(program) {
  const output = []

  // Variable and function names in JS will be suffixed with _1, _2, _3,
  // etc. This is because "while", for example, is a legal name in Carlos,
  // but not in JS. So we want to generate something like "while_1".
  // We handle this by mapping each name to its suffix.
  const targetName = (mapping => {
    return entity => {
      if (!mapping.has(entity)) {
        mapping.set(entity, mapping.size + 1)
      }
      return `${entity.name}_${mapping.get(entity)}`
    }
  })(new Map())

  const gen = node => generators[node.constructor.name](node)

  const generators = {
    Program(p) {
      gen(p.statements)
    },
    VariableDeclaration(d) {
      output.push(`let ${targetName(d.variable)} = ${gen(d.initializer)};`)
    },
    Assignment(s) {
      const source = gen(s.source)
      const target = gen(s.target)
      output.push(`${target} = ${source};`)
    },
    IfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      gen(s.consequent)
      if (s.alternative.constructor === IfStatement) {
        output.push("} else")
        gen(s.alternative)
      } else {
        output.push("} else {")
        gen(s.alternative)
        output.push("}")
      }
    },
    ShortIfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      gen(s.consequent)
      output.push("}")
    },
    WhileStatement(s) {
      output.push(`while (${gen(s.test)}) {`)
      gen(s.body)
      output.push("}")
    },
    BreakStatement(s) {
      output.push("break;")
    },
    ContinueStatement(s) {
      output.push("continue;")
    },
    PrintStatement(s) {
      output.push(`console.log(${gen(s.argument)});`)
    },
    OrExpression(e) {
      return `(${gen(e.disjuncts).join(" || ")})`
    },
    AndExpression(e) {
      return `(${gen(e.conjuncts).join(" && ")})`
    },
    BinaryExpression(e) {
      const op = { "==": "===", "!=": "!==" }[e.op] ?? e.op
      return `(${gen(e.left)} ${op} ${gen(e.right)})`
    },
    UnaryExpression(e) {
      const op = { abs: "Math.abs", sqrt: "Math.sqrt" }[e.op] ?? e.op
      return `${op}(${gen(e.operand)})`
    },
    IdentifierExpression(e) {
      return targetName(e.referent)
    },
    Literal(e) {
      return e.value
    },
    Array(a) {
      return a.map(gen)
    },
  }

  gen(program)
  return output.join("\n")
}
