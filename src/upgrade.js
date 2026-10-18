/**
 * `aif upgrade`: bring a project's AIF-owned files up to date with the installed framework.
 * Replaces agent files and gitignore entries while preserving custom `## ` sections in protocol.md.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { staleAgentFiles, writeAgentFiles } from './agents.js';

const STANDARD_GITIGNORE = ['node_modules/', '.aif/cache/', '.aif/last-check.json'];

function checkGitignore(root) {
  const file = join(root, '.gitignore');
  if (!existsSync(file)) return [...STANDARD_GITIGNORE];
  const content = readFileSync(file, 'utf8');
  const lines = new Set(content.split('\n').map((l) => l.trim()));
  return STANDARD_GITIGNORE.filter((e) => !lines.has(e));
}

/**
 * Check what is out of date in the project.
 * @param {string} root
 * @returns {Record<string, any>}
 */
export function checkUpgrade(root) {
  const cfgPath = join(root, 'aif.config.json');
  if (!existsSync(cfgPath)) {
    return {
      ok: false,
      stage: 'upgrade',
      cause: `${root} has no aif.config.json`,
      suggestion: 'use `aif init`',
    };
  }

  const agentFiles = staleAgentFiles(root);
  const gitignoreMissing = checkGitignore(root);

  const pending = agentFiles.length > 0 || gitignoreMissing.length > 0;

  return {
    ok: true,
    applied: false,
    up_to_date: !pending,
    changes: {
      agent_files: agentFiles,
      gitignore: gitignoreMissing,
    },
    manual: [],
    next: pending ? ['aif upgrade --apply'] : [],
  };
}

/**
 * Apply upgrades in place.
 * @param {string} root
 * @returns {Record<string, any>}
 */
export function applyUpgrade(root) {
  const check = checkUpgrade(root);
  if (!check.ok) return check;

  writeAgentFiles(root);

  if (check.changes.gitignore && check.changes.gitignore.length > 0) {
    const file = join(root, '.gitignore');
    const old = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const updated = old.trimEnd() + '\n' + check.changes.gitignore.join('\n') + '\n';
    writeFileSync(file, updated, 'utf8');
  }

  return {
    ok: true,
    applied: true,
    up_to_date: true,
    changes: check.changes,
    manual: [],
    next: ['aif check --json'],
  };
}
