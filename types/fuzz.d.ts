import type { Config, StructuredError } from './config.js';

export function fuzzFunction(
  moduleName: string,
  fn: any,
  options?: { examples?: number; seed?: number },
): StructuredError[];

export function runFuzz(
  root: string,
  cfg: Config,
  useCache?: boolean,
): Promise<{ errors: StructuredError[]; tested: Array<{ module: string; function: string; status: string; examples: number }> }>;

export function reportFuzz(root: string, cfg: Config): Promise<Record<string, any>>;
