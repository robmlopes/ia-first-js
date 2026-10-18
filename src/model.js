/**
 * In-memory Project Model: classes, functions, imports, inheritance and dependencies.
 * Built from the AST once per run to power lint rules and architectural validation.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { findSourceFiles, moduleKeyOf } from './indexer.js';
import { parseSource } from './parser.js';

/**
 * Resolves a module specifier from an importing file to a project module key.
 * @param {string} importerRelPath e.g. "domain/transfer.js"
 * @param {string} importSource e.g. "./account.js" or "../ports/db.ts"
 * @returns {string | null} dotted module key or null if third-party/external
 */
export function resolveProjectImport(importerRelPath, importSource) {
  if (!importSource.startsWith('.')) {
    return null; // External package or built-in
  }
  const importerDir = dirname(importerRelPath);
  const resolved = normalize(join(importerDir, importSource)).replace(/\\/g, '/');
  return moduleKeyOf(resolved);
}

export class Model {
  /**
   * @param {string} root
   * @param {import('./config.js').Config} cfg
   */
  constructor(root, cfg) {
    this.root = root;
    this.cfg = cfg;
    this.modules = new Map();
    this.parsedFiles = new Map();

    const files = findSourceFiles(root, cfg);

    // First pass: parse all files and index declarations
    for (const relFile of files) {
      let code = '';
      try {
        code = readFileSync(join(root, relFile), 'utf8');
      } catch {
        continue;
      }

      const parsed = parseSource(relFile, code);
      this.parsedFiles.set(relFile, { parsed, code });
      const modKey = moduleKeyOf(relFile);

      const classes = new Map();
      for (const cls of parsed.classes) {
        classes.set(cls.name, {
          module: modKey,
          name: cls.name,
          bases: cls.bases,
          staticAttributes: new Set(cls.staticAttributes),
          instanceAttributes: new Set(cls.instanceAttributes),
          methods: new Map(cls.methods.map((m) => [m.name, m])),
        });
      }

      const functions = new Map();
      for (const fn of parsed.functions) {
        functions.set(fn.name, {
          module: modKey,
          name: fn.name,
          params: fn.params,
          returnType: fn.returnType,
          hasContract: fn.hasContract,
          contractEffects: fn.contractEffects,
        });
      }

      // Index imports
      const imports = new Map();
      for (const imp of parsed.imports) {
        const targetModuleKey = resolveProjectImport(relFile, imp.source);
        if (targetModuleKey) {
          for (const spec of imp.specifiers) {
            const localName = spec.alias || spec.name;
            imports.set(localName, {
              targetModuleKey,
              exportName: spec.name,
              isDefault: spec.isDefault,
            });
          }
        }
      }

      this.modules.set(modKey, {
        name: modKey,
        relPath: relFile,
        classes,
        functions,
        imports,
        rawImports: parsed.imports,
        calls: parsed.calls,
        catches: parsed.catches,
        globals: parsed.globals,
        hasDynamicCalls: parsed.hasDynamicCalls,
      });
    }
  }

  /**
   * Lookup a symbol as visible from a module.
   * @param {string} moduleKey
   * @param {string} name
   * @param {number} [depth=0]
   * @returns {{ kind: 'class' | 'function', info: any } | null}
   */
  lookup(moduleKey, name, depth = 0) {
    if (depth > 8) return null;
    const mod = this.modules.get(moduleKey);
    if (!mod) return null;

    if (mod.classes.has(name)) {
      return { kind: 'class', info: mod.classes.get(name) };
    }
    if (mod.functions.has(name)) {
      return { kind: 'function', info: mod.functions.get(name) };
    }

    if (mod.imports.has(name)) {
      const imp = mod.imports.get(name);
      return this.lookup(imp.targetModuleKey, imp.exportName, depth + 1);
    }

    return null;
  }

  /**
   * Resolve a class definition as seen from a module.
   * @param {string} moduleKey
   * @param {string} name
   * @returns {any | null}
   */
  resolveClass(moduleKey, name) {
    const res = this.lookup(moduleKey, name);
    return res && res.kind === 'class' ? res.info : null;
  }

  /**
   * Returns class followed by all known project base classes.
   * @param {any} cls
   * @returns {any[]}
   */
  classHierarchy(cls) {
    const chain = [cls];
    const visited = new Set([`${cls.module}.${cls.name}`]);

    for (const baseName of cls.bases) {
      const parent = this.resolveClass(cls.module, baseName);
      if (parent && !visited.has(`${parent.module}.${parent.name}`)) {
        visited.add(`${parent.module}.${parent.name}`);
        chain.push(...this.classHierarchy(parent));
      }
    }

    return chain;
  }

  /**
   * Get all declared and inherited members of a class.
   * @param {any} cls
   * @param {boolean} isInstance
   * @returns {Set<string>}
   */
  members(cls, isInstance = false) {
    const names = new Set();
    const hierarchy = this.classHierarchy(cls);

    for (const c of hierarchy) {
      for (const m of c.methods.keys()) names.add(m);
      for (const a of c.staticAttributes) names.add(a);
      if (isInstance) {
        for (const i of c.instanceAttributes) names.add(i);
      }
    }

    return names;
  }

  /**
   * Generates the dependency graph of project modules.
   * @returns {Map<string, string[]>}
   */
  importGraph() {
    const graph = new Map();
    for (const [modKey, mod] of this.modules.entries()) {
      const targets = new Set();
      for (const imp of mod.imports.values()) {
        if (this.modules.has(imp.targetModuleKey)) {
          targets.add(imp.targetModuleKey);
        }
      }
      graph.set(modKey, [...targets].sort());
    }
    return graph;
  }
}
