import type { Config, StructuredError } from './config.js';

export interface SkippedFunction {
  module: string;
  function: string;
  line: number;
  file: string;
  reason: string;
}

export function findSkippedFunctions(
  root: string,
  cfg: Config,
  fuzzedSet: Set<string>,
): SkippedFunction[];

export function buildFuzzReport(
  root: string,
  cfg: Config,
  errors: StructuredError[],
  tested: any[],
): Record<string, any>;
