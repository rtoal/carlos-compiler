import assert from "assert"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import optimize from "../src/optimizer.js"
import generate from "../src/generator.js"

function dedent(s) {
  return `${s}`.replace(/(\n)\s+/g, "$1").trim()
}

// Ideally there should be a ton of test cases here, right now we don't
// have many. Should have 100% coverage though.

const smallFixture = {
  name: "small",
  source: `
    let x = 3.1
    x = 5 ** -x / -100 && false - abs x
    print x || x || false || (x<2) != 5

  `,
  expected: dedent`
      let x_1 = 3.1;
      x_1 = (((5 ** -(x_1)) / -100) && (false - Math.abs(x_1)));
      console.log((x_1 || x_1 || false || ((x_1 < 2) !== 5)));
    `,
}

describe("The code generator", () => {
  for (const fixture of [smallFixture]) {
    it(`produces expected js output for the ${fixture.name} program`, done => {
      const actual = generate(optimize(analyze(parse(fixture.source))))
      assert.deepStrictEqual(actual, fixture.expected)
      done()
    })
  }
})
