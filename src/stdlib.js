import { Type, FunctionType, Variable, Function, ArrayType } from "./ast.js"

function makeConstant(name, type, value) {
  return Object.assign(new Variable(name, true), { type, value })
}

function makeFunction(name, type) {
  return Object.assign(new Function(name), { type })
}

const numsType = new ArrayType(Type.NUMBER)
const numNumType = new FunctionType([Type.NUMBER], Type.NUMBER)
const numNumNumType = new FunctionType([Type.NUMBER, Type.NUMBER], Type.NUMBER)
const stringToNumsType = new FunctionType([Type.STRING], numsType)

export const types = {
  number: Type.NUMBER,
  boolean: Type.BOOLEAN,
  string: Type.STRING,
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
  bytes: makeFunction("bytes", stringToNumsType),
  codepoints: makeFunction("codepoints", stringToNumsType),
}
