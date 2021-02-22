import { Type, FunctionType, Variable, Function } from "./ast.js"

function makeConstant(name, type, value) {
  const constant = new Variable(name, true)
  constant.type = type
  constant.value = value
  return constant
}

function makeFunction(name, type, pattern) {
  const functionObject = new Function(name)
  functionObject.type = type
  functionObject.pattern = pattern
  return functionObject
}

const numNumType = new FunctionType([Type.NUMBER], Type.NUMBER)
const numNumNumType = new FunctionType([Type.NUMBER, Type.NUMBER], Type.NUMBER)

export const types = {
  number: Type.NUMBER,
  boolean: Type.BOOLEAN,
  void: Type.VOID,
}

export const constants = {
  π: makeConstant("π", Type.NUMBER, Math.PI),
}

export const functions = {
  sin: makeFunction("sin", numNumType, `Math.sin($0)`),
  cos: makeFunction("cos", numNumType, `Math.cos($0)`),
  exp: makeFunction("exp", numNumType, `Math.exp($0)`),
  ln: makeFunction("ln", numNumType, `Math.log($0)`),
  hypot: makeFunction("hypot", numNumNumType, `Math.hypot($0,$1)`),
}
