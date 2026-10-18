import type { Config, StructuredError } from './config.js';

export function parseTscOutput(output: string, root: string): StructuredError[];
export function runTypeCheck(root: string, cfg: Config): Promise<StructuredError[]>;
