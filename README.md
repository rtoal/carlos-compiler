![Carlos](https://raw.githubusercontent.com/rtoal/carlos-compiler/main/docs/carlos.png)

This is a compiler for the language **Carlos** written with the help of the amazing [Ohm language library](https://ohmlang.github.io/).

Carlos is a small block-structured language designed for a course in Compiler Construction.

This repository has a number of branches, each corresponding to a step in the development of a full compiler. [Read the entire tutorial](https://cs.lmu.edu/~ray/notes/extendingael/).

## Running

The compiler is written in modern JavaScript.

Because this application was written as a tutorial, the compiler exposes what each phase does, as well as providing multiple translations:

```
src/carlos.js <filename> <outputType>
```

The output type argument tells the compiler what to print to standard output:

- `ast` &nbsp;&nbsp; the abstract syntax tree
- `analyzed` &nbsp;&nbsp; the semantically analyzed representation
- `optimized` &nbsp;&nbsp; the optimized semantically analyzed representation
- `js` &nbsp;&nbsp; the translation to JavaScript

To keep things simple, the compiler will halt on the first error it finds.

## Contributing

I’m happy to take PRs. As usual, be nice when filing issues and contributing. Do remember the idea is to keep the language tiny; if you’d like to extend the language, you’re probably better forking into a new project. However, I would _love_ to see any improvements you might have for the implementation or the pedagogy.

To contribute, make sure you have a modern version of Node.js, since the code has some ES2020 features. Clone the repo and run `npm install` as usual.

You can run tests with:

```
npm test
```

This project is so small that `npm test` is configured to always run a coverage report. I used [mocha](https://mochajs.org/) for the test runner and [c8](https://github.com/bcoe/c8) for the coverage.
