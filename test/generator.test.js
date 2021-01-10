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
    let y = true
    y = 5 ** -x / -100 > - (abs x) || false
    print y || y || false || (x*2) != 5
  `,
  expected: dedent`
      let x_1 = 3.1;
      let y_2 = true;
      y_2 = ((((5 ** -(x_1)) / -100) > -(Math.abs(x_1))) || false);
      console.log((y_2 || y_2 || false || ((x_1 * 2) !== 5)));
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
