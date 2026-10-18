/**
 * Run history and the last-check snapshot: measured data about how the framework is used.
 * Keys written to JSON are snake_case, identical to the Python framework, so both can be read by the same tools.
 * Files live in `.aif/`: `history.jsonl` (one line per check) and `last-check.json`.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HISTORY = 'history.jsonl';
const LAST = 'last-check.json';

function aifDir(root, { create }) {
  const dir = join(root, '.aif');
  if (create) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Atomically replace `.aif/last-check.json` so a poller never reads half a file.
 * @param {string} root
 * @param {Record<string, unknown>} payload
 */
export function writeLast(root, payload) {
  const target = join(aifDir(root, { create: true }), LAST);
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, JSON.stringify(payload, null, 2), 'utf8');
  renameSync(temporary, target);
}

/**
 * Read the last-check snapshot. Missing or corrupt files yield an explicit status, never an exception.
 * @param {string} root
 * @returns {Record<string, unknown>}
 */
export function readLast(root) {
  const file = join(aifDir(root, { create: false }), LAST);
  if (!existsSync(file)) {
    return { status: 'none', cause: 'no check has run yet', suggestion: 'run `aif check --json`' };
  }
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) return data;
    return { status: 'corrupt', cause: `${LAST} is not a JSON object`, suggestion: 'run `aif check --json` to regenerate it' };
  } catch (error) {
    return { status: 'corrupt', cause: `${LAST} is not valid JSON: ${error.message}`, suggestion: 'run `aif check --json` to regenerate it' };
  }
}

/**
 * Append one line per `aif check`: outcome, rules that fired, stage timings.
 * @param {string} root
 * @param {{ ok?: boolean, errors?: Array<Record<string, any>>, timings?: Record<string, number> }} result
 * @param {boolean} changedOnly
 */
export function record(root, result, changedOnly) {
  const errors = result.errors ?? [];
  const rules = {};
  for (const error of errors) {
    const key = error.rule ?? error.stage ?? '?';
    rules[key] = (rules[key] ?? 0) + 1;
  }
  const line = {
    ts: Math.round(Date.now()) / 1000,
    ok: result.ok ?? false,
    changed_only: changedOnly,
    errors: errors.length,
    stages: [...new Set(errors.map((error) => error.stage ?? '?'))].sort(),
    rules,
    timings: result.timings ?? {},
  };
  appendFileSync(join(aifDir(root, { create: true }), HISTORY), `${JSON.stringify(line)}\n`, 'utf8');
}

/**
 * Load the history. Lines that are not valid JSON are counted in `skipped`, not hidden.
 * @param {string} root
 * @returns {{ runs: Array<Record<string, any>>, skipped: number }}
 */
export function load(root) {
  const file = join(aifDir(root, { create: false }), HISTORY);
  if (!existsSync(file)) return { runs: [], skipped: 0 };
  const runs = [];
  let skipped = 0;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    try {
      runs.push(JSON.parse(raw));
    } catch {
      skipped += 1;
    }
  }
  return { runs, skipped };
}

/** Failing runs before each success: 0 means the first check already passed. */
function attemptsBeforeOk(runs) {
  const counts = [];
  let failed = 0;
  for (const run of runs) {
    if (run.ok) {
      counts.push(failed);
      failed = 0;
    } else {
      failed += 1;
    }
  }
  return counts;
}

const round2 = (value) => Math.round(value * 100) / 100;
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Aggregate the history into usage statistics.
 * @param {string} root
 */
export function stats(root) {
  const { runs, skipped } = load(root);
  if (runs.length === 0) {
    return { runs: 0, skipped_lines: skipped, cause: 'no history yet', suggestion: 'run `aif check` first' };
  }
  const rules = new Map();
  const stageTimes = new Map();
  for (const run of runs) {
    for (const [rule, count] of Object.entries(run.rules ?? {})) rules.set(rule, (rules.get(rule) ?? 0) + count);
    for (const [stage, seconds] of Object.entries(run.timings ?? {})) {
      if (stage === 'total') continue;
      stageTimes.set(stage, [...(stageTimes.get(stage) ?? []), Number(seconds)]);
    }
  }
  const attempts = attemptsBeforeOk(runs);
  const lastOk = [...runs].reverse().findIndex((run) => run.ok);
  return {
    runs: runs.length,
    skipped_lines: skipped,
    passed: runs.filter((run) => run.ok).length,
    failed: runs.filter((run) => !run.ok).length,
    pending_failures_since_last_ok: lastOk === -1 ? runs.length : lastOk,
    attempts_before_ok: {
      samples: attempts.length,
      average: attempts.length ? round2(mean(attempts)) : null,
      max: attempts.length ? Math.max(...attempts) : null,
    },
    average_seconds: round2(mean(runs.map((run) => Number(run.timings?.total ?? 0)))),
    average_seconds_per_stage: Object.fromEntries([...stageTimes].sort(([a], [b]) => a.localeCompare(b)).map(([stage, values]) => [stage, round2(mean(values))])),
    top_rules: [...rules].sort((a, b) => b[1] - a[1]).slice(0, 10),
  };
}
