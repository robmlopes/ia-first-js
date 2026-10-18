/**
 * Command line interface: `aif <command> [options]`.
 * `main` is pure with respect to the process: output goes through `io`, the exit code is returned.
 */

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { loadConfig } from './config.js';
import { readLast, stats } from './history.js';
import { check } from './pipeline.js';
import { saveIndex } from './indexer.js';
import { fixStyle } from './style.js';
import { runFuzz, reportFuzz } from './fuzz.js';

/** Every command of the framework; later phases implement the rest. */
export const COMMANDS = ['check', 'index', 'patch', 'fix', 'intent', 'agents', 'fuzz', 'init', 'status', 'stats', 'docs', 'upgrade'];
const IMPLEMENTED = new Set(['check', 'status', 'stats', 'index', 'fix', 'fuzz']);

const HELP = `aif - AI-first framework for JavaScript and TypeScript

Usage:
  aif check [--json] [--changed] [--root DIR]   run the whole pipeline (default command)
  aif status [--root DIR]                       show the last check snapshot
  aif stats [--root DIR]                        usage statistics from .aif/history.jsonl

Not implemented yet (later phases): ${COMMANDS.filter((name) => !IMPLEMENTED.has(name)).join(', ')}
Exit codes: 0 ok, 1 check failed, 2 usage error or unimplemented command, 3 check running.
`;

const OPTIONS = {
  json: { type: 'boolean' },
  changed: { type: 'boolean' },
  report: { type: 'boolean' },
  root: { type: 'string', default: '.' },
  help: { type: 'boolean', short: 'h' },
};

const printJson = (io, value) => io.stdout(`${JSON.stringify(value, null, 2)}\n`);

/** Same shape as the Python `patch`/`init` failures: `{ ok: false, stage, cause, suggestion }`. */
function usageError(io, cause, suggestion) {
  printJson(io, { ok: false, stage: 'cli', cause, suggestion });
  return 2;
}

function printCheck(io, result) {
  const lines = [result.ok ? `OK (${result.timings.total}s)` : `${result.errors.length} error(s) (${result.timings.total}s)`];
  for (const error of result.errors) {
    lines.push(` - ${error.rule ?? error.stage} ${error.file ?? error.test ?? ''} ${error.cause}`.replace(/ {2,}/g, ' '));
  }
  for (const warning of result.warnings) lines.push(` ~ ${warning.rule} ${warning.file} ${warning.cause}`);
  io.stdout(`${lines.join('\n')}\n`);
}

/**
 * Run the CLI.
 * @param {string[]} argv Arguments without `node` and the script path.
 * @param {{ stdout: (text: string) => void, stderr: (text: string) => void }} io
 * @returns {Promise<number>} Exit code.
 */
export async function main(argv, io) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (error) {
    return usageError(io, error.message, 'run `aif --help`');
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.stdout(HELP);
    return 0;
  }
  const [command = 'check', ...rest] = positionals;
  if (!COMMANDS.includes(command)) {
    return usageError(io, `unknown command "${command}"`, `use one of: ${COMMANDS.join(', ')}`);
  }
  if (!IMPLEMENTED.has(command)) {
    return usageError(io, `command "${command}" is not implemented yet`, 'see .loop/specs/002-port-inventory.md for the phase that delivers it');
  }
  if (rest.length > 0) {
    return usageError(io, `unexpected argument "${rest[0]}"`, 'run `aif --help`');
  }

  const root = resolve(values.root);
  if (command === 'status') {
    const last = readLast(root);
    printJson(io, last);
    if (last.status === 'done' && last.ok) return 0;
    return last.status === 'running' ? 3 : 1;
  }
  if (command === 'stats') {
    printJson(io, stats(root));
    return 0;
  }
  if (command === 'index') {
    saveIndex(root, loadConfig(root));
    io.stdout('index written to .aif/index.json\n');
    return 0;
  }
  if (command === 'fix') {
    const res = fixStyle(root, loadConfig(root));
    if (res.ok) {
      io.stdout('all files formatted canonically\n');
      return 0;
    }
    printCheck(io, { ok: false, errors: res.errors, warnings: [], timings: { total: 0 } });
    return 1;
  }
  if (command === 'fuzz') {
    const cfg = loadConfig(root);
    if (positionals.includes('--report') || values.report) {
      const rep = await reportFuzz(root, cfg);
      printJson(io, rep);
      return rep.ok ? 0 : 1;
    }
    const res = await runFuzz(root, cfg, true);
    if (values.json) {
      printJson(io, { ok: res.errors.length === 0, errors: res.errors, tested: res.tested });
    } else if (res.errors.length === 0) {
      io.stdout(`fuzz passed: ${res.tested.length} function(s) tested\n`);
    } else {
      printCheck(io, { ok: false, errors: res.errors, warnings: [], timings: { total: 0 } });
    }
    return res.errors.length === 0 ? 0 : 1;
  }

  const result = await check(root, { changed: values.changed });
  if (values.json) printJson(io, result);
  else printCheck(io, result);
  return result.ok ? 0 : 1;
}
