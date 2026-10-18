export const CONFIG_FILE: 'aif.config.json';

export interface Config {
  sourceDirs: string[];
  pureDirs: string[];
  portDirs: string[];
  adapterDirs: string[];
  entryDirs: string[];
  compositionRoots: string[];
  maxFileLines: number;
  maxFunctionLines: number;
  /** Per-layer overrides, e.g. `{ web: { maxFunctionLines: 60 } }`. */
  limits: Record<string, Record<string, number>>;
  countCodeLines: boolean;
  limitWarnRatio: number;
  parallel: boolean;
  docsCheck: boolean;
  history: boolean;
  intents: boolean;
  style: boolean;
  typecheck: boolean;
  typecheckTests: boolean;
  fuzz: boolean;
  fuzzExamples: number;
  fuzzSetup: string;
  forbiddenImports: string[];
  forbiddenCalls: string[];
  forbiddenClock: string[];
  thirdParty: string[];
  checkThirdParty: boolean;
  capabilities: Record<string, string[]>;
  limit(path: string, key: string): number;
  layer(path: string): string;
}

export interface StructuredError {
  stage: string;
  rule?: string;
  file?: string;
  line?: number;
  cause: string;
  suggestion?: string;
  [key: string]: unknown;
}

export class ConfigError extends Error {
  constructor(file: string, cause: string, suggestion: string);
  stage: 'config';
  file: string;
  cause: string;
  suggestion: string;
  toJSON(): StructuredError;
}

export function defaults(): Config;
export function loadConfig(root: string): Config;
