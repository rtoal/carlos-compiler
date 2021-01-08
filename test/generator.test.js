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
    x = 5 ** -x / -true + false - abs x
    print x
  `,
  expected: dedent`
      let x_1 = 3.1;
      x_1 = ((((5 ** -(x_1)) / -(true_2)) + false_3) - Math.abs(x_1));
      console.log(x_1);
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
