/**
 * Fuzz result cache: a module is skipped when it and everything it imports are unchanged.
 * Persists SHA-256 hashes in `.aif/cache/fuzz.json`.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { findSourceFiles, moduleKeyOf } from './indexer.js';
import { Model } from './model.js';

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function cachePath(root) {
  return join(root, '.aif', 'cache', 'fuzz.json');
}

/**
 * Load cache data from disk.
 * @param {string} root
 * @returns {Record<string, string>}
 */
export function loadCache(root) {
  const file = cachePath(root);
  if (!existsSync(file)) return {};
  try {
    const raw = readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Save cache data to disk atomically.
 * @param {string} root
 * @param {Record<string, string>} passed
 */
export function saveCache(root, passed) {
  const file = cachePath(root);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(passed, null, 2), 'utf8');
}

/**
 * Transitive closure of dependencies of a module.
 * @param {string} modKey
 * @param {Map<string, string[]>} graph
 * @returns {Set<string>}
 */
function transitiveClosure(modKey, graph) {
  const visited = new Set();
  const queue = [modKey];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    for (const dep of graph.get(current) || []) {
      if (!visited.has(dep)) {
        queue.push(dep);
      }
    }
  }

  return visited;
}

/**
 * Compute SHA-256 cache key per module considering module source and its dependency closure.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @returns {Record<string, string>}
 */
export function computeModuleKeys(root, cfg) {
  const model = new Model(root, cfg);
  const graph = model.importGraph();
  const files = findSourceFiles(root, cfg);
  const modToFile = new Map();

  for (const f of files) {
    modToFile.set(moduleKeyOf(f), f);
  }

  const commonSettings = JSON.stringify([cfg.fuzzExamples, cfg.fuzzFiniteNumbers]);
  const out = {};

  for (const modKey of modToFile.keys()) {
    const closure = transitiveClosure(modKey, graph);
    const sortedClosure = [...closure].sort();

    const hash = createHash('sha256');
    hash.update(commonSettings);

    for (const dep of sortedClosure) {
      const relFile = modToFile.get(dep);
      if (relFile) {
        try {
          const content = readFileSync(join(root, relFile), 'utf8');
          hash.update(dep);
          hash.update(content);
        } catch {
          // Ignored
        }
      }
    }

    out[modKey] = hash.digest('hex');
  }

  return out;
}
