/**
 * The `aif check` pipeline: ordered stages, each running only when the previous one is clean.
 * Every problem is reported as a structured error; nothing is swallowed.
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig } from './config.js';
import { readLast, record, writeLast } from './history.js';
import { getWarnings, checkFileLimits } from './limits.js';
import { saveIndex, findSourceFiles } from './indexer.js';
import { parseSource } from './parser.js';
import { runLint } from './lint.js';
import { runEffects } from './effects.js';

/**
 * @typedef {Record<string, any>} StageError
 * @typedef {{ root: string, config: import('./config.js').Config, only: ReadonlySet<string> | null }} StageContext
 * @typedef {{ name: string, run: (context: StageContext) => StageError[] | Promise<StageError[]> }} Stage
 */

const REPORTER = fileURLToPath(new URL('./reporter.js', import.meta.url));
const CONTRACT = /AIF_CONTRACT (\{.*\})/;
const TESTS_TIMEOUT_MS = 10 * 60 * 1000;

const seconds = (start) => Math.round(((performance.now() - start) / 1000) * 100) / 100;

/**
 * Run stages in order; stop at the first one that reports errors.
 * A stage that throws is turned into a structured error (no `rule`, like the runner failures of the Python framework).
 * @param {Stage[]} stages
 * @param {StageContext | Record<string, unknown>} context
 * @returns {Promise<{ errors: StageError[], timings: Record<string, number> }>}
 */
export async function runStages(stages, context) {
  const timings = {};
  for (const stage of stages) {
    const start = performance.now();
    let errors;
    try {
      errors = await stage.run(context);
    } catch (error) {
      errors = [{
        stage: stage.name,
        cause: `stage "${stage.name}" crashed: ${error?.message ?? error}`,
        suggestion: 'fix the stage or report the framework bug',
      }];
    }
    timings[stage.name] = seconds(start);
    if (errors.length > 0) return { errors, timings };
  }
  return { errors: [], timings };
}

function runNodeTests(root, destination) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // otherwise the child behaves as a subprocess of the outer runner
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--test', `--test-reporter=${REPORTER}`, `--test-reporter-destination=${destination}`],
      { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), TESTS_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

/**
 * Run the project's tests with `node --test`; failures become structured errors.
 * Contract violations are reported with their counterexample.
 * @param {{ root: string }} context
 * @returns {Promise<StageError[]>}
 */
export async function testsStage({ root }) {
  const tmp = mkdtempSync(join(tmpdir(), 'aif-tests-'));
  const destination = join(tmp, 'failures.jsonl');
  try {
    const { code, output } = await runNodeTests(root, destination);
    let raw = '';
    try {
      raw = readFileSync(destination, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const failures = raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
    if (failures.length === 0) {
      if (code === 0) return [];
      return [{ stage: 'tests', cause: `node --test exited with code ${code} without reporting failures`, detail: output.slice(-800), suggestion: 'run `node --test` directly to see the output' }];
    }
    return failures.map((failure) => {
      const error = { stage: 'tests', test: failure.name, file: failure.file, line: 1 };
      const found = CONTRACT.exec(failure.message);
      if (found) return { ...error, cause: 'contract violated', ...JSON.parse(found[1]) };
      return { ...error, cause: failure.message.slice(0, 300) };
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Files modified, staged or untracked relative to HEAD; `null` outside a git repository.
 * @param {string} root
 * @returns {Set<string> | null}
 */
export function changedFiles(root) {
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  const found = new Set();
  const diff = git('diff', '--name-only', '--diff-filter=ACMR', 'HEAD');
  // No commits yet: everything tracked counts as changed.
  const tracked = diff.status === 0 ? diff : git('ls-files');
  if (tracked.status !== 0) return null;
  for (const file of tracked.stdout.split('\n').filter(Boolean)) found.add(file);
  const untracked = git('ls-files', '--others', '--exclude-standard');
  if (untracked.status !== 0) return null;
  for (const file of untracked.stdout.split('\n').filter(Boolean)) found.add(file);
  return found;
}

/** @type {Stage} */
export const indexStage = {
  name: 'index',
  run: ({ root, config }) => {
    saveIndex(root, config);
    return [];
  },
};

/** @type {Stage} */
export const lintStage = {
  name: 'lint',
  run: ({ root, config, only }) => {
    const errors = runLint(root, config, only);
    const files = findSourceFiles(root, config);
    for (const relFile of files) {
      if (only && !only.has(relFile)) continue;
      try {
        const code = readFileSync(join(root, relFile), 'utf8');
        const parsed = parseSource(relFile, code);
        const [fileErrors] = checkFileLimits(parsed, code, relFile, config);
        errors.push(...fileErrors);
      } catch {
        // Ignored unreadable files
      }
    }
    return errors;
  },
};

/** @type {Stage} */
export const effectsStage = {
  name: 'effects',
  run: ({ root, config }) => runEffects(root, config),
};

/** @type {Stage[]} */
export const defaultStages = [
  indexStage,
  lintStage,
  effectsStage,
  { name: 'tests', run: testsStage },
];

/**
 * Run the whole pipeline for the project at `root`.
 * @param {string} root
 * @param {{ changed?: boolean, stages?: Stage[] }} [options]
 */
export async function check(root, options = {}) {
  const started = performance.now();
  let config;
  try {
    config = loadConfig(root);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    return { ok: false, errors: [error.toJSON()], warnings: [], timings: { total: seconds(started) } };
  }
  const only = options.changed ? changedFiles(root) : null;
  const { errors, timings } = await runStages(options.stages ?? defaultStages, { root, config, only });
  const warnings = getWarnings(root, config, only);
  const result = {
    ok: errors.length === 0,
    errors,
    warnings,
    timings: { ...timings, total: seconds(started) },
  };
  if (options.changed) {
    result.changed_only = only ? [...only].sort() : 'not a git repository: checked everything';
  }
  if (config.history) record(root, result, Boolean(options.changed));
  writeLast(root, { status: 'done', ...result });
  return result;
}

export { readLast };
