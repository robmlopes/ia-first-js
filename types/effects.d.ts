import type { Config, StructuredError } from './config.js';

export function runEffects(root: string, cfg: Config): StructuredError[];
