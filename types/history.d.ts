import type { StructuredError } from './config.js';

export interface CheckResult {
  ok: boolean;
  errors: StructuredError[];
  warnings: StructuredError[];
  timings: Record<string, number>;
  changed_only?: string[] | string;
}

/** One line of `.aif/history.jsonl` (snake_case, identical to the Python framework). */
export interface HistoryEntry {
  ts: number;
  ok: boolean;
  changed_only: boolean;
  errors: number;
  stages: string[];
  rules: Record<string, number>;
  timings: Record<string, number>;
}

export type LastCheck = { status: 'none' | 'corrupt' | 'running' | 'done'; [key: string]: unknown };

export interface Stats {
  runs: number;
  skipped_lines: number;
  cause?: string;
  suggestion?: string;
  passed?: number;
  failed?: number;
  pending_failures_since_last_ok?: number;
  attempts_before_ok?: { samples: number; average: number | null; max: number | null };
  average_seconds?: number;
  average_seconds_per_stage?: Record<string, number>;
  top_rules?: Array<[string, number]>;
}

export function writeLast(root: string, payload: Record<string, unknown>): void;
export function readLast(root: string): LastCheck;
export function record(root: string, result: Partial<CheckResult>, changedOnly: boolean): void;
export function load(root: string): { runs: HistoryEntry[]; skipped: number };
export function stats(root: string): Stats;
