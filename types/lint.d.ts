import type { Config, StructuredError } from './config.js';
import type { Model } from './model.js';

export function checkLintRules(
  relFile: string,
  parsedData: any,
  cfg: Config,
  index: Record<string, any>,
  model: Model,
  declaredPackages: Set<string>,
): StructuredError[];

export function runLint(root: string, cfg: Config, only?: Set<string> | null): StructuredError[];
