/**
 * `aif fuzz --report`: what contract fuzzing tested, what it skipped, and why.
 * Discovers reasons statically from the AST so unreached functions are visible.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSourceFiles, moduleKeyOf } from './indexer.js';
import { parseSource } from './parser.js';

const NO_ENSURES = 'contract has no `ensures`: nothing to check';
const EFFECTS = 'declares effects: needs real ports, covered by integration tests';
const NO_CONTRACT = 'no @contract';

/**
 * Determine why a function is skipped from fuzzing.
 * @param {import('./parser.js').ParsedFunction} fn
 * @param {string} code
 * @returns {string | null}
 */
function skipReason(fn, code) {
  if (!fn.hasContract) {
    return NO_CONTRACT;
  }
  if (fn.contractEffects && fn.contractEffects.length > 0) {
    return EFFECTS;
  }
  if (!fn.hasEnsures) {
    return NO_ENSURES;
  }
  return null;
}

/**
 * Find top-level functions that fuzzing does not cover, with the reason.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @param {Set<string>} fuzzedSet set of "module.function"
 * @returns {Array<Record<string, any>>}
 */
export function findSkippedFunctions(root, cfg, fuzzedSet) {
  const skips = [];
  const files = findSourceFiles(root, cfg);

  for (const relFile of files) {
    const layer = cfg.layer(relFile);
    if (cfg.portDirs && cfg.portDirs.includes(layer)) {
      continue;
    }
    let code = '';
    try {
      code = readFileSync(join(root, relFile), 'utf8');
    } catch {
      continue;
    }

    const parsed = parseSource(relFile, code);
    const modKey = moduleKeyOf(relFile);

    for (const fn of parsed.functions) {
      const fullKey = `${modKey}.${fn.name}`;
      if (fuzzedSet.has(fullKey)) continue;

      let reason = skipReason(fn, code);
      if (reason === NO_CONTRACT && fn.name.startsWith('_')) {
        // Private helpers are not part of public contract surface
        continue;
      }
      if (!reason) {
        reason = 'not reached by the worker (not a top-level function of an importable module)';
      }

      skips.push({
        module: modKey,
        function: fn.name,
        line: fn.line,
        file: relFile,
        reason,
      });
    }
  }

  return skips;
}

/**
 * Build complete fuzz report with summary stats.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @param {Array<Record<string, any>>} errors
 * @param {Array<Record<string, any>>} tested
 * @returns {Record<string, any>}
 */
export function buildFuzzReport(root, cfg, errors, tested) {
  const fuzzedSet = new Set(tested.map((t) => `${t.module}.${t.function}`));
  const skips = findSkippedFunctions(root, cfg, fuzzedSet);

  const reasonCounts = {};
  for (const s of skips) {
    reasonCounts[s.reason] = (reasonCounts[s.reason] || 0) + 1;
  }

  return {
    ok: errors.length === 0,
    errors,
    tested,
    skipped: skips,
    summary: {
      functions_fuzzed: tested.length,
      examples_run: tested.reduce((acc, t) => acc + (t.examples || 0), 0),
      failed: tested.filter((t) => t.status !== 'passed').length,
      skipped: skips.length,
      skipped_by_reason: reasonCounts,
      config: {
        fuzz: cfg.fuzz,
        fuzz_examples: cfg.fuzzExamples,
      },
    },
  };
}
