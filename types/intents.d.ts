import type { Config, StructuredError } from './config.js';

export function parseIntents(text: string): { title: string; sections: Record<string, string[]> };
export function getScopePaths(parsed: { title: string; sections: Record<string, string[]> }): string[];
export function validateIntent(root: string, filePath: string): StructuredError[];
export function listIntents(root: string): Array<{ id: string; title: string; scope: string[] }>;
export function createIntent(
  root: string,
  cfg: Config,
  intentId: string,
  title: string,
): { ok: boolean; stage?: string; cause?: string; suggestion?: string; file?: string };
export function checkCommitMessage(root: string, message: string): StructuredError | null;
export function checkIntentScope(root: string, message: string, changed: string[]): StructuredError[];
