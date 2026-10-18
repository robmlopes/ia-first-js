import type { Config, StructuredError } from './config.js';
import type { ParsedSource } from './parser.js';

export function getCommentAndBlankLines(text: string): Set<number>;
export function countCodeLines(text: string): number;
export function checkFileLimits(
  parsed: ParsedSource,
  code: string,
  relPath: string,
  cfg: Config,
): [StructuredError[], StructuredError[]];
export function getWarnings(root: string, cfg: Config, only?: Set<string> | null): StructuredError[];
