#! /usr/bin/env node

import fs from "fs/promises"
import process from "process"
import compile from "./compiler.js"

const help = `Carlos compiler

Syntax: src/carlos <filename> <outputType>

Prints to stdout according to <outputType>, which must be one of:

  ast        the abstract syntax tree
  analyzed   the semantically analyzed representation
  optimized  the optimized semantically analyzed representation
  js         the translation to JavaScript
`

if (process.argv.length !== 4) {
  console.log(help)
} else {
  ;(async () => {
    try {
      const buffer = await fs.readFile(process.argv[2])
      console.log(compile(buffer.toString(), process.argv[3]))
    } catch (e) {
      console.error(`${e}`)
      process.exitCode = 1
    }
  })()
}
