/**
 * Project indexer: scans sourceDirs and generates `.aif/index.json`.
 * Matches the canonical schema of the Python AIF framework so AI agents
 * can inspect functions, classes, signatures, contracts and attributes.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseSource } from './parser.js';

const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts']);

/**
 * Normalizes a relative file path to a dotted module key.
 * e.g. "domain/transfer.js" -> "domain.transfer"
 * @param {string} relPath
 * @returns {string}
 */
export function moduleKeyOf(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const withoutExt = normalized.replace(/\.[a-zA-Z0-9]+$/, '');
  return withoutExt.replace(/\//g, '.');
}

/**
 * Recursively find all supported source files inside configured sourceDirs.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @returns {string[]} Relative paths of discovered files
 */
export function findSourceFiles(root, cfg) {
  const results = [];

  function walk(dir) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const dotIndex = entry.name.lastIndexOf('.');
        if (dotIndex !== -1 && EXTENSIONS.has(entry.name.slice(dotIndex).toLowerCase())) {
          results.push(relative(root, fullPath));
        }
      }
    }
  }

  for (const sourceDir of cfg.sourceDirs) {
    walk(join(root, sourceDir));
  }

  return results.sort();
}

/**
 * Generates the full index dictionary matching AIF Python schema.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @returns {Record<string, any>}
 */
export function generateIndex(root, cfg) {
  const index = {};

  // Register base layer keys (e.g. domain: {}, adapters: {})
  for (const dir of cfg.sourceDirs) {
    const topKey = dir.replace(/\\/g, '/').split('/')[0];
    if (topKey && !index[topKey]) {
      index[topKey] = {};
    }
  }

  const files = findSourceFiles(root, cfg);

  for (const relFile of files) {
    const fullPath = join(root, relFile);
    let code = '';
    try {
      code = readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }

    const parsed = parseSource(relFile, code);
    const modKey = moduleKeyOf(relFile);
    const moduleSymbols = {};

    // Functions
    for (const fn of parsed.functions) {
      if (!fn.isExported) continue;
      moduleSymbols[fn.name] = {
        kind: 'function',
        args: fn.params.map((p) => p.name),
        returns: fn.returnType || 'any',
        contract: fn.hasContract
          ? {
              effects: fn.contractEffects,
              requires: true,
              ensures: true,
            }
          : null,
        doc: fn.doc || '',
        line: fn.line,
      };
    }

    // Classes
    for (const cls of parsed.classes) {
      if (!cls.isExported) continue;
      const methods = {};
      for (const m of cls.methods) {
        methods[m.name] = {
          kind: 'method',
          args: [],
          returns: 'any',
          contract: null,
          doc: '',
          line: m.line,
        };
      }

      moduleSymbols[cls.name] = {
        kind: 'class',
        line: cls.line,
        doc: '',
        bases: cls.bases,
        methods,
        attributes: cls.staticAttributes,
        instance_attributes: cls.instanceAttributes,
      };
    }

    index[modKey] = moduleSymbols;
  }

  return index;
}

/**
 * Atomically save the index to `.aif/index.json`.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 */
export function saveIndex(root, cfg) {
  const dir = join(root, '.aif');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const target = join(dir, 'index.json');
  const tmp = join(dir, 'index.json.tmp');
  const data = generateIndex(root, cfg);
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  renameSync(tmp, target);
  return data;
}
