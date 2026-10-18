import type { Config, StructuredError } from './config.js';

export function formatSource(content: string): string;
export function checkStyle(root: string, cfg: Config, only?: Set<string> | null): StructuredError[];
export function fixStyle(root: string, cfg: Config, only?: Set<string> | null): {
  ok: boolean;
  errors: StructuredError[];
};
