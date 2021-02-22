import { Type, FunctionType } from "./ast.js"

export const constants = {
  π: [Math.PI, Type.NUMBER],
  e: [Math.E, Type.NUMBER],
}

export const types = {
  number: Type.NUMBER,
  boolean: Type.BOOLEAN,
  void: Type.VOID,
}

const numNumType = new FunctionType([Type.NUMBER], Type.NUMBER)
const numNumNumType = new FunctionType([Type.NUMBER, Type.NUMBER], Type.NUMBER)

export const functions = {
  sin: ["sin", [numNumType, Math.sin]],
  cos: ["cos", [numNumType, Math.cos]],
  hypot: ["hypot", [numNumNumType, Math.hypot]],
}
