import type { Program } from '../ast';

export type ParserOptions = Partial<{
  quiet: boolean;
  grammarSource: string | object;
  includeLocation: boolean;
}>;

export type Parse = {
  (input: string, options?: ParserOptions): Program;
};

// Convenience export to cast the parser in tests
export type Parser = {
  parse: Parse;
};

export const parse: Parse;
