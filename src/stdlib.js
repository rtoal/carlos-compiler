import { Type, FunctionType, Variable, Function } from "./ast.js"

function makeConstant(name, type, value) {
  const constant = new Variable(name, true)
  constant.type = type
  constant.value = value
  return constant
}

function makeFunction(name, type) {
  const functionObject = new Function(name)
  functionObject.type = type
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
  sin: makeFunction("sin", numNumType),
  cos: makeFunction("cos", numNumType),
  exp: makeFunction("exp", numNumType),
  ln: makeFunction("ln", numNumType),
  hypot: makeFunction("hypot", numNumNumType),
}
