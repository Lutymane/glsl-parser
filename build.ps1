# Clean the output dir
Remove-Item dist/* -Recurse -Force

# Compile the typescript project
npx tsc

# Build the parers with peggy. Requires tsc to run first for the subfolders
npx peggy --format es --cache -o dist/parser/parser.js src/parser/glsl-grammar.pegjs
# Manualy copy in the type definitions
cp src/parser/parser.d.ts dist/parser/parser.d.ts

npx peggy --format es --cache -o dist/preprocessor/preprocessor-parser.js src/preprocessor/preprocessor-grammar.pegjs
cp src/preprocessor/preprocessor-parser.d.ts dist/preprocessor/preprocessor-parser.d.ts
