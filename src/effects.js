/**
 * Effect and capability checking: signature capabilities, architectural layering
 * and forbidden calls in pure code. Adheres to canonical AIF schema.
 */

import { moduleKeyOf } from './indexer.js';
import { Model } from './model.js';

function error(rule, file, line, cause, suggestion) {
  return {
    stage: 'effects',
    rule,
    file,
    line,
    cause,
    suggestion,
  };
}

/**
 * Checks effect declarations and capability parameters.
 * @param {string} relFile
 * @param {any} fn
 * @param {import('./config.js').Config} cfg
 * @returns {Array<Record<string, any>>}
 */
function checkFunctionEffects(relFile, fn, cfg) {
  if (!fn.hasContract) return [];
  const errors = [];
  const declared = new Set(fn.contractEffects || []);
  const knownEffects = new Set();

  for (const effList of Object.values(cfg.capabilities)) {
    for (const eff of effList) knownEffects.add(eff);
  }

  // AIF008: Unknown effect declared in @contract
  for (const eff of declared) {
    if (!knownEffects.has(eff)) {
      errors.push(
        error(
          'AIF008',
          relFile,
          fn.line,
          `unknown effect '${eff}' in ${fn.name}`,
          `valid effects: ${[...knownEffects].sort().join(', ')}`,
        ),
      );
    }
  }

  // Capability types received via parameters
  const usedEffects = new Set();
  for (const p of fn.params) {
    if (!p.type) continue;
    // Extract raw type name without modifiers (e.g. "DbWrite" from "DbWrite | null")
    for (const [capName, grantedEffects] of Object.entries(cfg.capabilities)) {
      if (p.type.includes(capName)) {
        for (const ge of grantedEffects) usedEffects.add(ge);
      }
    }
  }

  // AIF009: Missing effect declaration
  for (const eff of usedEffects) {
    if (!declared.has(eff)) {
      errors.push(
        error(
          'AIF009',
          relFile,
          fn.line,
          `${fn.name} receives a '${eff}' capability but does not declare the effect`,
          `add effects=['${eff}'] to @contract`,
        ),
      );
    }
  }

  // AIF009: Declares effect without receiving capability
  for (const eff of declared) {
    if (knownEffects.has(eff) && !usedEffects.has(eff)) {
      errors.push(
        error(
          'AIF009',
          relFile,
          fn.line,
          `${fn.name} declares '${eff}' without receiving the capability`,
          'inject the matching port as a parameter or remove the effect',
        ),
      );
    }
  }

  return errors;
}

/**
 * Check if a module transitively imports any module in forbidden layers.
 * @param {string} startMod
 * @param {Map<string, string[]>} graph
 * @param {string[]} forbiddenLayers
 * @returns {string | null} the first forbidden module encountered or null
 */
function findForbiddenTarget(startMod, graph, forbiddenLayers) {
  const queue = [...(graph.get(startMod) || [])];
  const visited = new Set(queue);

  while (queue.length > 0) {
    const current = queue.shift();
    const layer = current.split('.')[0];
    if (forbiddenLayers.includes(layer)) {
      return current;
    }
    for (const next of graph.get(current) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return null;
}

/**
 * Run all effect and layering checks over the project.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @returns {Array<Record<string, any>>}
 */
export function runEffects(root, cfg) {
  const model = new Model(root, cfg);
  const graph = model.importGraph();
  const errors = [];

  const forbiddenCallsSet = new Set(cfg.forbiddenCalls || []);
  const forbiddenClockSet = new Set(cfg.forbiddenClock || []);

  for (const [relFile, { parsed }] of model.parsedFiles.entries()) {
    const layer = cfg.layer(relFile);
    const isPure = cfg.pureDirs.includes(layer);
    const modKey = moduleKeyOf(relFile);

    // 1. Functions & capabilities (AIF008, AIF009)
    for (const fn of parsed.functions) {
      errors.push(...checkFunctionEffects(relFile, fn, cfg));
    }

    // 2. Pure code checks (AIF010, AIF013)
    if (isPure) {
      for (const call of parsed.calls) {
        // AIF010: Forbidden direct calls or clock
        if (forbiddenCallsSet.has(call.callee) || forbiddenClockSet.has(call.callee)) {
          errors.push(
            error(
              'AIF010',
              relFile,
              call.line,
              `direct effect call: ${call.callee}()`,
              'use an injected port',
            ),
          );
        }

        // AIF013: Dynamic dispatch in pure code
        if (call.isDynamic) {
          errors.push(
            error(
              'AIF013',
              relFile,
              call.line,
              `dynamic dispatch in pure code: ${call.callee}`,
              'call a named function or inject the behavior as a port',
            ),
          );
        }
      }

      // AIF011: Pure layer (domain) importing adapter layers
      const adapterTarget = findForbiddenTarget(modKey, graph, cfg.adapterDirs);
      if (adapterTarget) {
        errors.push(
          error(
            'AIF011',
            relFile,
            1,
            `domain module ${modKey} imports adapter layer: ${adapterTarget}`,
            'invert the dependency: domain must depend only on ports (ports/)',
          ),
        );
      }
    }

    // 3. Entry layers (AIF016)
    if (cfg.entryDirs && cfg.entryDirs.includes(layer)) {
      const isCompositionRoot = cfg.compositionRoots && cfg.compositionRoots.includes(modKey);
      if (!isCompositionRoot) {
        const directImports = graph.get(modKey) || [];
        for (const target of directImports) {
          const targetLayer = target.split('.')[0];
          if (cfg.adapterDirs.includes(targetLayer)) {
            errors.push(
              error(
                'AIF016',
                relFile,
                1,
                `entry module ${modKey} imports adapter ${target} directly`,
                `wire adapters only in composition roots: ${cfg.compositionRoots.join(', ')}`,
              ),
            );
          }
        }
      }
    }
  }

  return errors;
}
