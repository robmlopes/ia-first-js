/**
 * AIF Core Lint rules implemented over the AST and project model.
 * Produces structured errors adhering strictly to canonical AIF schema.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateIndex, moduleKeyOf } from './indexer.js';
import { Model, resolveProjectImport } from './model.js';

function error(rule, file, line, cause, suggestion) {
  return {
    stage: 'lint',
    rule,
    file,
    line,
    cause,
    suggestion,
  };
}

/**
 * Reads package.json to identify declared packages for AIF014.
 * @param {string} root
 * @returns {Set<string>}
 */
function getDeclaredPackages(root) {
  const declared = new Set();
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const data = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const deps = {
        ...data.dependencies,
        ...data.devDependencies,
        ...data.peerDependencies,
      };
      for (const name of Object.keys(deps)) declared.add(name);
    } catch {
      // Ignored
    }
  }
  return declared;
}

/**
 * Checks a single file against AIF lint rules.
 * @param {string} relFile
 * @param {any} parsedData
 * @param {import('./config.js').Config} cfg
 * @param {Record<string, any>} index
 * @param {Model} model
 * @param {Set<string>} declaredPackages
 * @returns {Array<Record<string, any>>}
 */
export function checkLintRules(relFile, parsedData, cfg, index, model, declaredPackages) {
  const errors = [];
  const { parsed } = parsedData;
  const layer = cfg.layer(relFile);
  const isPure = cfg.pureDirs.includes(layer);
  const modKey = moduleKeyOf(relFile);

  // 1. AIF001: Forbidden imports in pure modules
  // 2. AIF006: Hallucinated / missing project imports
  // 3. AIF014: Undeclared third-party imports
  for (const imp of parsed.imports) {
    const src = imp.source;

    if (isPure && cfg.forbiddenImports.some((f) => src === f || src.startsWith(`${f}/`))) {
      errors.push(
        error(
          'AIF001',
          relFile,
          imp.line,
          `forbidden import in pure module: ${src}`,
          'receive the effect through an injected port (ports/)',
        ),
      );
    }

    if (src.startsWith('.')) {
      // Project local import (AIF006)
      const targetModKey = resolveProjectImport(relFile, src);
      if (!targetModKey || (!index[targetModKey] && !model.modules.has(targetModKey))) {
        errors.push(
          error(
            'AIF006',
            relFile,
            imp.line,
            `unknown module: ${src}`,
            `existing modules: ${Object.keys(index).filter((k) => !cfg.sourceDirs.includes(k)).sort().join(', ')}`,
          ),
        );
      } else {
        const targetModule = index[targetModKey] || {};
        for (const spec of imp.specifiers) {
          if (spec.isNamespace || spec.isDefault) continue;
          if (!targetModule[spec.name] && !model.lookup(targetModKey, spec.name)) {
            const available = Object.keys(targetModule).sort();
            errors.push(
              error(
                'AIF006',
                relFile,
                imp.line,
                `unknown symbol: ${spec.name} from ${src}`,
                `available symbols: ${available.join(', ')}`,
              ),
            );
          }
        }
      }
    } else if (!src.startsWith('node:') && !src.startsWith('/') && !src.startsWith('\\')) {
      // Third-party import (AIF014)
      const parts = src.split('/');
      const pkgName = src.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
      const isAllowed = declaredPackages.has(pkgName) || cfg.thirdParty.includes(pkgName);
      if (cfg.checkThirdParty && !isAllowed) {
        errors.push(
          error(
            'AIF014',
            relFile,
            imp.line,
            `undeclared third-party import: ${pkgName}`,
            `declare it in package.json or aif.config.json thirdParty`,
          ),
        );
      }
    }
  }

  // 4. AIF002 & AIF003: Functions checks
  for (const fn of parsed.functions) {
    if (isPure && fn.isExported && !fn.name.startsWith('_') && !fn.hasContract) {
      errors.push(
        error(
          'AIF002',
          relFile,
          fn.line,
          `public function ${fn.name} has no @contract`,
          'add @contract(requires=..., ensures=..., effects=[])',
        ),
      );
    }

    const untypedParam = fn.params.some((p) => !p.type);
    const untypedReturn = !fn.returnType;
    if (untypedParam || untypedReturn) {
      errors.push(
        error(
          'AIF003',
          relFile,
          fn.line,
          `${fn.name} lacks complete type hints`,
          'annotate every parameter and the return type',
        ),
      );
    }
  }

  // 5. AIF004: Anti-swallow catch blocks
  for (const c of parsed.catches) {
    if (c.isBare || c.isEmpty || c.statementCount === 0) {
      errors.push(
        error(
          'AIF004',
          relFile,
          c.line,
          'generic or empty catch block',
          'catch a specific error or log and handle properly',
        ),
      );
    }
  }

  // 6. AIF007: Forbidden globals
  for (const g of parsed.globals) {
    errors.push(
      error(
        'AIF007',
        relFile,
        g.line,
        `use of global scope '${g.name}'`,
        'pass state as a parameter or dependency',
      ),
    );
  }

  // 7. AIF012: Hallucinated member access on classes
  for (const call of parsed.calls) {
    const parts = call.callee.split('.');
    if (parts.length >= 2) {
      const baseName = parts[0];
      const memberName = parts[1];
      const resolved = model.lookup(modKey, baseName);
      if (resolved && resolved.kind === 'class') {
        const cls = resolved.info;
        const validMembers = model.members(cls, false);
        if (!validMembers.has(memberName)) {
          errors.push(
            error(
              'AIF012',
              relFile,
              call.line,
              `unknown member '${memberName}' on class '${cls.name}'`,
              `available members: ${[...validMembers].sort().join(', ')}`,
            ),
          );
        }
      }
    }
  }

  return errors;
}

/**
 * Run all lint rules over the project.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @param {Set<string> | null} [only]
 * @returns {Array<Record<string, any>>}
 */
export function runLint(root, cfg, only = null) {
  const index = generateIndex(root, cfg);
  const model = new Model(root, cfg);
  const declared = getDeclaredPackages(root);
  const errors = [];

  for (const [relFile, parsedData] of model.parsedFiles.entries()) {
    if (only && !only.has(relFile)) continue;
    errors.push(...checkLintRules(relFile, parsedData, cfg, index, model, declared));
  }

  return errors;
}
