import assert from "assert"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import optimize from "../src/optimizer.js"
import generate from "../src/generator.js"

function dedent(s) {
  return `${s}`.replace(/(\n)\s+/g, "$1").trim()
}

const fixtures = [
  {
    name: "small",
    source: `
    let x = 3.1 * 7
    let y = 3 / x
    x = 5 ** x / -x + x - -x
    print x
  `,
    expected: dedent`
      let x_1 = 21.7;
      let y_2 = (3 / x_1);
      x_1 = ((((5 ** x_1) / -(x_1)) + x_1) - -(x_1));
      console.log(x_1);
    `,
  },
]

describe("The code generator", () => {
  for (const fixture of fixtures) {
    it(`produces expected js output for the ${fixture.name} program`, () => {
      const actual = generate(optimize(analyze(parse(fixture.source))))
      assert.deepStrictEqual(actual, fixture.expected)
    })
  }
})
