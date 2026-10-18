/**
 * Contract fuzzing engine: generates pseudo-random inputs satisfying `requires`
 * and checks `ensures` postcondition, shrinking/reporting counterexamples.
 * Emits CON001-CON005 with canonical schema.
 */

import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { inferBounds } from './bounds.js';
import { ContractViolation } from './contract.js';
import { computeModuleKeys, loadCache, saveCache } from './cache.js';
import { findSourceFiles, moduleKeyOf } from './indexer.js';
import { buildFuzzReport } from './fuzzreport.js';

function error(rule, module, fnName, line, file, cause, suggestion, extra = {}) {
  return {
    stage: 'fuzz',
    rule,
    file,
    line,
    cause,
    suggestion,
    ...extra,
  };
}

/**
 * Simple Linear Congruential Generator (LCG) for deterministic reproducibility.
 */
function createRng(seed = 123456789) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generate a random sample for a parameter based on inferred bounds or strategy.
 */
function sampleValue(name, bound, strategy, rng) {
  if (typeof strategy === 'function') {
    return strategy(rng);
  }
  let min = -100;
  let max = 100;
  if (bound) {
    if (bound[0] !== null) min = bound[0];
    if (bound[1] !== null) max = bound[1];
    if (bound[0] !== null && bound[1] === null) max = min + 100;
    if (bound[0] === null && bound[1] !== null) min = max - 100;
  }
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Fuzz a single contracted function.
 * @param {string} moduleName
 * @param {any} fn
 * @param {object} [options]
 * @returns {Array<Record<string, any>>}
 */
export function fuzzFunction(moduleName, fn, options = {}) {
  const meta = fn && fn.__aif__;
  const fnName = (fn && fn.name) || 'anonymous';
  const file = moduleName;
  const line = 1;

  if (!meta || !meta.ensures) {
    return [];
  }

  const examples = options.examples || 50;
  const params = meta.params || [];
  const bounds = inferBounds(meta.requires);
  const strategies = meta.strategies || {};
  const rng = createRng(options.seed || 42);

  let validCount = 0;
  let rejectedCount = 0;
  const maxAttempts = examples * 10;

  for (let attempt = 0; attempt < maxAttempts && validCount < examples; attempt++) {
    const inputs = {};
    for (const p of params) {
      inputs[p] = sampleValue(p, bounds[p], strategies[p], rng);
    }

    // Check requires
    if (meta.requires) {
      try {
        const passedRequires = meta.requires(inputs);
        if (!passedRequires) {
          rejectedCount++;
          continue;
        }
      } catch {
        rejectedCount++;
        continue;
      }
    }

    validCount++;

    // Call implementation
    let result;
    try {
      const args = params.map((p) => inputs[p]);
      result = fn(...args);
    } catch (err) {
      if (err instanceof ContractViolation || (err && err.name === 'ContractViolation')) {
        if (err.kind === 'postcondition') {
          return [
            error(
              'CON001',
              moduleName,
              fnName,
              line,
              file,
              `postcondition of ${fnName} failed for inputs satisfying \`requires\``,
              'fix the implementation or the `ensures` clause',
              { counterexample: { inputs, result: err.counterexample && err.counterexample.result } },
            ),
          ];
        }
      }
      return [
        error(
          'CON002',
          moduleName,
          fnName,
          line,
          file,
          `${fnName} raised ${err && err.name ? err.name : 'Error'}: ${err && err.message ? err.message : String(err)} for inputs satisfying \`requires\``,
          'tighten `requires` to exclude the input, or handle it in the implementation',
          { counterexample: { inputs } },
        ),
      ];
    }

    // Check ensures
    let ensuresOk = false;
    try {
      ensuresOk = Boolean(meta.ensures(result, inputs));
    } catch {
      ensuresOk = false;
    }

    if (!ensuresOk) {
      return [
        error(
          'CON001',
          moduleName,
          fnName,
          line,
          file,
          `postcondition of ${fnName} failed for inputs satisfying \`requires\``,
          'fix the implementation or the `ensures` clause',
          { counterexample: { inputs, result } },
        ),
      ];
    }
  }

  if (validCount === 0 && rejectedCount > 0) {
    return [
      error(
        'CON004',
        moduleName,
        fnName,
        line,
        file,
        `${fnName}: \`requires\` rejected (almost) every generated input`,
        'relax `requires`, or pass strategies= that produce valid inputs',
      ),
    ];
  }

  return [];
}

/**
 * Run fuzzing over all eligible project modules.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @param {boolean} [useCache=false]
 * @returns {Promise<{ errors: Array<Record<string, any>>, tested: Array<Record<string, any>> }>}
 */
export async function runFuzz(root, cfg, useCache = false) {
  if (!cfg.fuzz) {
    return { errors: [], tested: [] };
  }

  const files = findSourceFiles(root, cfg);
  const cacheKeys = useCache ? computeModuleKeys(root, cfg) : {};
  const passedCache = useCache ? loadCache(root) : {};

  const allErrors = [];
  const tested = [];
  const newPassed = { ...passedCache };

  for (const relFile of files) {
    const layer = cfg.layer(relFile);
    if (cfg.portDirs && cfg.portDirs.includes(layer)) continue;

    const modKey = moduleKeyOf(relFile);
    if (useCache && passedCache[modKey] === cacheKeys[modKey]) {
      continue;
    }

    const fullPath = join(root, relFile);
    const fileUrl = pathToFileURL(fullPath).href;

    let modExports = {};
    try {
      modExports = await import(fileUrl);
    } catch (err) {
      allErrors.push(
        error(
          'CON005',
          modKey,
          'module',
          1,
          relFile,
          `fuzz worker failed to import ${modKey}: ${err.message}`,
          'fix module syntax or export errors',
        ),
      );
      continue;
    }

    let moduleFailed = false;
    for (const [expName, expVal] of Object.entries(modExports)) {
      if (typeof expVal === 'function' && expVal.__aif__ && expVal.__aif__.ensures) {
        if (expVal.__aif__.effects && expVal.__aif__.effects.length > 0) {
          continue;
        }

        const errs = fuzzFunction(modKey, expVal, { examples: cfg.fuzzExamples });
        if (errs.length > 0) {
          allErrors.push(...errs);
          tested.push({ module: modKey, function: expName, status: 'failed', examples: cfg.fuzzExamples });
          moduleFailed = true;
        } else {
          tested.push({ module: modKey, function: expName, status: 'passed', examples: cfg.fuzzExamples });
        }
      }
    }

    if (!moduleFailed && cacheKeys[modKey]) {
      newPassed[modKey] = cacheKeys[modKey];
    } else {
      delete newPassed[modKey];
    }
  }

  if (useCache) {
    saveCache(root, newPassed);
  }

  return { errors: allErrors, tested };
}

/**
 * Detailed report of fuzzing execution and skips.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @returns {Promise<Record<string, any>>}
 */
export async function reportFuzz(root, cfg) {
  const { errors, tested } = await runFuzz(root, cfg, false);
  return buildFuzzReport(root, cfg, errors, tested);
}
