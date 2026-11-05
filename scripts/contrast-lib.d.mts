export type Rgba = { r: number; g: number; b: number; a: number };
export type Tokens = Record<string, string>;
export type PairResult = {
  fg: string;
  bg: string;
  min: number;
  kind: string;
  info?: boolean;
  ratio: number;
  pass: boolean;
};

export function parseRootTokens(css: string): Tokens;
export function parseColor(value: string): Rgba | null;
export function resolve(value: string, tokens: Tokens, depth?: number): string;
export function composite(fg: Rgba, bg: Rgba): Rgba;
export function luminance(color: Rgba): number;
export function contrastRatio(a: Rgba, b: Rgba): number;
export function requiredPairs(): Omit<PairResult, "ratio" | "pass">[];
export function evaluate(tokens: Tokens): PairResult[];
