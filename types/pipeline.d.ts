import type { Config, StructuredError } from './config.js';
import type { CheckResult } from './history.js';

export interface StageContext {
  root: string;
  config: Config;
  only: ReadonlySet<string> | null;
}

export interface Stage {
  name: string;
  run(context: StageContext): StructuredError[] | Promise<StructuredError[]>;
}

export function runStages(
  stages: Stage[],
  context: Partial<StageContext> & Record<string, unknown>,
): Promise<{ errors: StructuredError[]; timings: Record<string, number> }>;
export const indexStage: Stage;
export const styleStage: Stage;
export const lintStage: Stage;
export const effectsStage: Stage;
export const typesStage: Stage;
export const fuzzStage: Stage;
export function testsStage(context: { root: string }): Promise<StructuredError[]>;
export function changedFiles(root: string): Set<string> | null;
export const defaultStages: Stage[];
export function check(root: string, options?: { changed?: boolean; stages?: Stage[] }): Promise<CheckResult>;
export { readLast } from './history.js';
