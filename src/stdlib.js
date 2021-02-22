import { Type, FunctionType } from "./ast.js"

export const constants = {
  π: [Type.NUMBER, Math.PI],
  e: [Type.NUMBER, Math.E],
}

export const types = {
  number: Type.NUMBER,
  boolean: Type.BOOLEAN,
  void: Type.VOID,
}

const numNumType = new FunctionType([Type.NUMBER], Type.NUMBER)
const numNumNumType = new FunctionType([Type.NUMBER, Type.NUMBER], Type.NUMBER)

export const functions = {
  sin: [numNumType, `Math.sin($0)`],
  cos: [numNumType, `Math.cos($0)`],
  hypot: [numNumNumType, `Math.hypot($0,$1)`],
}
