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
import { applyPatch } from './patch.js';
import { createIntent, listIntents } from './intents.js';
import { staleAgentFiles, writeAgentFiles } from './agents.js';
import { initProject } from './scaffold.js';
import { runDocsCheck } from './docscheck.js';
import { checkUpgrade, applyUpgrade } from './upgrade.js';

/** Every command of the framework; later phases implement the rest. */
export const COMMANDS = ['check', 'index', 'patch', 'fix', 'intent', 'agents', 'fuzz', 'init', 'status', 'stats', 'docs', 'upgrade'];
const IMPLEMENTED = new Set(['check', 'status', 'stats', 'index', 'fix', 'fuzz', 'patch', 'intent', 'agents', 'init', 'docs', 'upgrade']);

const HELP = `aif - AI-first framework for JavaScript and TypeScript

Usage:
  aif check [--json] [--changed] [--root DIR]   run the whole pipeline (default command)
  aif status [--root DIR]                       show the last check snapshot
  aif stats [--root DIR]                        usage statistics from .aif/history.jsonl
  aif index [--root DIR]                        rebuild .aif/index.json
  aif fix [--root DIR]                          format files canonically
  aif patch <file> <symbol> <new-source>        replace a function or class in-place
  aif fuzz [--report] [--json] [--root DIR]     contract fuzzing with counterexamples
  aif intent [list|create <id> [title]]         manage human feature intents
  aif agents [--write] [--root DIR]             render or check agent instruction files
  aif init [jsdoc|ts] [--root DIR]              scaffold a new AI-first project
  aif docs [--root DIR]                         check documentation consistency
  aif upgrade [--apply] [--root DIR]            upgrade framework-managed files

All 12 canonical commands implemented!
Exit codes: 0 ok, 1 check failed, 2 usage error, 3 check running.
`;

const OPTIONS = {
  json: { type: 'boolean' },
  changed: { type: 'boolean' },
  report: { type: 'boolean' },
  write: { type: 'boolean' },
  apply: { type: 'boolean' },
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
  if (command !== 'patch' && command !== 'intent' && rest.length > 0) {
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
  if (command === 'patch') {
    const targetFile = positionals[1];
    const symbol = positionals[2];
    const newSource = positionals[3];
    if (!targetFile || !symbol || newSource === undefined) {
      return usageError(io, 'aif patch requires <file> <symbol> <new-source>', 'provide file, symbol and replacement code');
    }
    const res = applyPatch(targetFile, symbol, newSource);
    if (!res.ok) {
      printJson(io, res);
      return 1;
    }
    io.stdout(`patched ${symbol} in ${targetFile}\n`);
    return 0;
  }
  if (command === 'init') {
    const template = values.template || positionals[1] || 'jsdoc';
    const res = initProject(root, { template });
    io.stdout(`initialized AI-first project using template '${template}'\n`);
    return 0;
  }
  if (command === 'docs') {
    const errors = runDocsCheck(root, COMMANDS);
    if (errors.length === 0) {
      io.stdout('all documentation is consistent\n');
      return 0;
    }
    printCheck(io, { ok: false, errors, warnings: [], timings: { total: 0 } });
    return 1;
  }
  if (command === 'upgrade') {
    const res = values.apply ? applyUpgrade(root) : checkUpgrade(root);
    printJson(io, res);
    return res.ok ? 0 : 1;
  }
  if (command === 'agents') {
    if (values.write) {
      const written = writeAgentFiles(root);
      io.stdout(`updated ${written.length} agent instruction file(s)\n`);
      return 0;
    }
    const stale = staleAgentFiles(root);
    if (stale.length === 0) {
      io.stdout('all agent instruction files are up to date\n');
      return 0;
    }
    io.stdout(`agent instruction files out of date: ${stale.join(', ')}\nrun \`aif agents --write\` to update\n`);
    return 1;
  }
  if (command === 'intent') {
    const sub = positionals[1] || 'list';
    if (sub === 'list') {
      const list = listIntents(root);
      if (values.json) {
        printJson(io, list);
      } else {
        const out = list.map((i) => ` - ${i.id}: ${i.title} (${i.scope.length} file(s))`).join('\n');
        io.stdout(out ? `${out}\n` : 'no intents defined\n');
      }
      return 0;
    }
    if (sub === 'create') {
      const intentId = positionals[2];
      const title = positionals[3] || intentId;
      if (!intentId) return usageError(io, 'aif intent create requires <id> [title]', 'provide intent id');
      const res = createIntent(root, loadConfig(root), intentId, title);
      if (!res.ok) {
        printJson(io, res);
        return 1;
      }
      io.stdout(`created intent ${res.file}\n`);
      return 0;
    }
    return usageError(io, `unknown intent subcommand "${sub}"`, 'use `aif intent list` or `aif intent create <id>`');
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
