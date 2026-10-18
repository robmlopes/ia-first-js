/**
 * Agent instruction files, generated from the single source `.aif/protocol.md`.
 * Keeps AGENTS.md, CLAUDE.md and .cursor/rules/aif.mdc synchronized.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const TARGETS = {
  'AGENTS.md': ['# Agent instructions (AIF)\n\nFor any coding agent working in this repository.\n\n', ''],
  'CLAUDE.md': ['# Agent protocol (AIF)\n\n', ''],
  '.cursor/rules/aif.mdc': [
    '---\ndescription: AIF agent protocol\nalwaysApply: true\n---\n\n# Agent protocol (AIF)\n\n',
    '',
  ],
};

const NOTICE = '<!-- Generated from .aif/protocol.md by `aif agents`. Do not edit by hand. -->\n\n';

/**
 * Render all agent instruction target files from `.aif/protocol.md`.
 * @param {string} root
 * @returns {Record<string, string>}
 */
export function renderAgentFiles(root) {
  const protocolPath = join(root, '.aif', 'protocol.md');
  const body = existsSync(protocolPath) ? readFileSync(protocolPath, 'utf8') : '';
  const out = {};

  for (const [name, [head, tail]] of Object.entries(TARGETS)) {
    if (head.startsWith('---')) {
      const parts = head.split('\n\n# ');
      const front = parts[0];
      const rest = parts[1];
      out[name] = `${front}\n\n${NOTICE}# ${rest}${body}${tail}`;
    } else {
      const parts = head.split('\n\n');
      const title = parts[0];
      const rest = parts.slice(1).join('\n\n');
      out[name] = `${title}\n\n${NOTICE}${rest}${body}${tail}`;
    }
  }

  return out;
}

/**
 * Find agent files that are missing or differ from canonical protocol.
 * @param {string} root
 * @returns {string[]}
 */
export function staleAgentFiles(root) {
  const rendered = renderAgentFiles(root);
  const out = [];

  for (const [name, text] of Object.entries(rendered)) {
    const full = join(root, name);
    if (!existsSync(full) || readFileSync(full, 'utf8') !== text) {
      out.push(name);
    }
  }

  return out;
}

/**
 * Write/sync rendered agent instruction files to disk.
 * @param {string} root
 * @returns {string[]} list of updated file paths
 */
export function writeAgentFiles(root) {
  const rendered = renderAgentFiles(root);
  const written = [];

  for (const [name, text] of Object.entries(rendered)) {
    const full = join(root, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text, 'utf8');
    written.push(name);
  }

  return written;
}
