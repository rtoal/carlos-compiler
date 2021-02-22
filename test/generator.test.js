import assert from "assert"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import optimize from "../src/optimizer.js"
import generate from "../src/generator.js"

function dedent(s) {
  return `${s}`.replace(/(?<=\n)\s+/g, "").trim()
}

const fixtures = [
  {
    name: "small",
    source: `
      let x = 3.1 * 7
      let y = true
      y = 5 ** -x / -100 > - x || false
      print (y && y) || false || (x*2) != 5
    `,
    expected: dedent`
      let x_1 = 21.7;
      let y_2 = true;
      y_2 = ((((5 ** -(x_1)) / -100) > -(x_1)) || false);
      console.log(((y_2 && y_2) || false || ((x_1 * 2) !== 5)));
    `,
  },
  {
    name: "iffy",
    source: `
      let x = 0
      if (x == 0) { print 1 }
      if (x == 0) { print 1 } else { print 2 }
      if (x == 0) { print 1 } else if (x == 2) { print 3 }
      if (x == 0) { print 1 } else if (x == 2) { print 3 } else { print 4 }
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
      console.log(1);
      }
      if ((x_1 === 0)) {
      console.log(1);
      } else {
      console.log(2);
      }
      if ((x_1 === 0)) {
      console.log(1);
      } else {
      if ((x_1 === 2)) {
      console.log(3);
      }
      }
      if ((x_1 === 0)) {
      console.log(1);
      } else
      if ((x_1 === 2)) {
      console.log(3);
      } else {
      console.log(4);
      }
    `,
  },
  {
    name: "whiley",
    source: `
      let x = 0
      while x < 5 {
        let y = 0
        while y < 5 {
          print x * y
          y = y + 1
          break
        }
        x = x + 1
        continue
      }
    `,
    expected: dedent`
      let x_1 = 0;
      while ((x_1 < 5)) {
      let y_2 = 0;
      while ((y_2 < 5)) {
      console.log((x_1 * y_2));
      y_2 = (y_2 + 1);
      break;
      }
      x_1 = (x_1 + 1);
      continue;
      }
    `,
  },
  {
    name: "functions",
    source: `
      let z = 0
      function f(x: number, y: boolean) {
        print(x > 1)
        return
      }
      function g(): boolean {
        return false
      }
      f(z, g())
    `,
    expected: dedent`
      let z_1 = 0;
      function f_2(x_3, y_4) {
      console.log((x_3 > 1));
      return;
      }
      function g_5() {
      return false;
      }
      f_2(z_1, g_5());
    `,
  },
  {
    name: "arrays",
    source: `
      let a = [boolean](true, false, true)
      let b = [number](10, 40 - 20, 30)
      const c = [[number]]()
      print a[1] || (b[0] < 88)
    `,
    expected: dedent`
      let a_1 = [true,false,true];
      let b_2 = [10,20,30];
      let c_3 = [];
      console.log((a_1[1] || (b_2[0] < 88)));
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
