const fs = require('fs');
const path = require('path');
const pegjs = require('pegjs');
const util = require('util');
const { preprocessComments, preprocessAst } = require('./preprocessor.js');
const generate = require('./generator.js');

const fileContents = (filePath) =>
  fs.readFileSync(path.join(__dirname, filePath)).toString();

const grammar = fileContents('preprocessor.pegjs');
const parser = pegjs.generate(grammar, { cache: true });

const debugProgram = (program) => {
  debugAst(parser.parse(program));
};

const debugAst = (ast) => {
  console.log(util.inspect(ast, false, null, true));
};

const expectParsedProgram = (sourceGlsl) => {
  const ast = parser.parse(sourceGlsl);
  const glsl = generate(ast);
  if (glsl !== sourceGlsl) {
    debugAst(ast);
    expect(glsl).toBe(sourceGlsl);
  }
};

test('preprocessor ast', () => {
  expectParsedProgram(`
#line 0
#version 100 "hi"
#define GL_es_profile 1
#extension all : disable
#error whoopsie
#define A 1
before if
      #if A == 1 || B == 2
      inside if
      #define A
          #elif A == 1 || defined(B) && C == 2
          float a;
          #elif A == 1 || defined(B) && C == 2
          float a;
      #define B
      #endif
outside endif
#pragma mypragma: something(else)
final line after program
`);
});

test('nested expand macro', () => {
  const program = `#define X Y
#define Y Z
X`;

  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`Z`);
});

test('evaluate if branch', () => {
  const program = `
#define A
before if
#if defined(A)
inside if
#endif
after if
`;

  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
before if
inside if
after if
`);
});

test('evaluate elseif branch', () => {
  const program = `
#define A
before if
#if defined(B)
inside if
#elif defined(A)
inside elif
#else
else body
#endif
after if`;

  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
before if
inside elif
after if`);
});

test('evaluate else branch', () => {
  const program = `
#define A
before if
#if defined(D)
inside if
#elif defined(E)
inside elif
#else
else body
#endif
after if`;

  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
before if
else body
after if`);
});

test('empty branch', () => {
  const program = `before if
#ifdef GL_ES
precision mediump float;
#endif
after if`;

  const ast = parser.parse(program);

  preprocessAst(ast);
  expect(generate(ast)).toBe(`before if
after if`);
});

test('self referential object macro', () => {
  const program = `
#define first first second
#define second first
second`;

  // If this has an infinte loop, the test will never finish
  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
first second`);
});

test('self referential function macro', () => {
  const program = `
#define foo() foo()
foo()`;

  // If this has an infinte loop, the test will never finish
  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
foo()`);
});

test('self referential macro combinations', () => {
  const program = `
#define b c
#define first(a,b) a + b
#define second first(1,b)
second`;

  // If this has an infinte loop, the test will never finish
  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
1 + c`);
});

test("function call macro isn't expanded", () => {
  const program = `
#define foo() no expand
foo`;

  const ast = parser.parse(program);
  // debugAst(ast);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
foo`);
});

test("macro that isn't macro function call call is expanded", () => {
  const program = `
#define foo () yes expand
foo`;

  const ast = parser.parse(program);
  // debugAst(ast);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
() yes expand`);
});

test('unterminated macro function call', () => {
  const program = `
#define foo() yes expand
foo(
foo()`;

  const ast = parser.parse(program);
  expect(() => preprocessAst(ast)).toThrow(
    'foo( unterminated macro invocation'
  );
});

test('macro function calls with no arguments', () => {
  const program = `
#define foo() yes expand
foo()
foo
()`;

  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
yes expand
yes expand`);
});

test('macro function calls with bad arguments', () => {
  expect(() => {
    preprocessAst(
      parser.parse(`
      #define foo( a, b ) a + b
      foo(1,2,3)`)
    );
  }).toThrow("'foo': Too many arguments for macro");

  expect(() => {
    preprocessAst(
      parser.parse(`
      #define foo( a ) a + b
      foo(,)`)
    );
  }).toThrow("'foo': Too many arguments for macro");

  expect(() => {
    preprocessAst(
      parser.parse(`
      #define foo( a, b ) a + b
      foo(1)`)
    );
  }).toThrow("'foo': Not enough arguments for macro");
});

test('macro function calls with arguments', () => {
  const program = `
#define foo( a, b ) a + b
foo(x + y, (z-t + vec3(0.0, 1.0)))
foo
(q,
r)
foo(,)`;

  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
x + y + (z-t + vec3(0.0, 1.0))
q + r
 + `);
});

test('nested function macro expansion', () => {
  const program = `
#define X Z
#define foo(x, y) x + y
foo (foo (a, X), c)`;

  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
a + Z + c`);
});

test('token pasting', () => {
  const program = `
#define COMMAND(NAME)  { NAME, NAME ## _command ## x ## y }
COMMAND(x)`;

  const ast = parser.parse(program);
  preprocessAst(ast);
  expect(generate(ast)).toBe(`
{ x, x_commandxy }`);
});

test('preservation', () => {
  const program = `
#line 0
#version 100 "hi"
#define GL_es_profile 1
#extension all : disable
#error whoopsie
#define  A 1
before if
#if A == 1 || B == 2
inside if
#define A
#elif A == 1 || defined(B) && C == 2
float a;
#define B
#endif
outside endif
#pragma mypragma: something(else)
function_call line after program`;

  const ast = parser.parse(program);

  preprocessAst(ast, {
    // ignoreMacro: (identifier, body) => {
    //   // return identifier === 'A';
    // },
    preserve: {
      conditional: (path) => false,
      line: (path) => true,
      error: (path) => true,
      extension: (path) => true,
      pragma: (path) => true,
      version: (path) => true,
    },
  });
  expect(generate(ast)).toBe(`
#line 0
#version 100 "hi"
#extension all : disable
#error whoopsie
before if
inside if
outside endif
#pragma mypragma: something(else)
function_call line after program`);
});