/**
 * Canonical code style and formatting stage (`stage: "style"`).
 * Checks and fixes formatting: trailing whitespace, line endings, redundant blanks.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSourceFiles } from './indexer.js';

/**
 * Format source text into canonical form.
 * @param {string} content
 * @returns {string}
 */
export function formatSource(content) {
  if (!content) return '';
  let formatted = content.replace(/\r\n/g, '\n');
  const lines = formatted.split('\n');
  const trimmedLines = lines.map((line) => line.replace(/[ \t]+$/, ''));
  formatted = trimmedLines.join('\n');
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  if (!formatted.endsWith('\n')) {
    formatted += '\n';
  }
  return formatted;
}

/**
 * Check source files for canonical formatting.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @param {Set<string> | null} [only]
 * @returns {Array<Record<string, any>>}
 */
export function checkStyle(root, cfg, only = null) {
  if (!cfg.style) return [];
  const errors = [];
  const files = findSourceFiles(root, cfg);

  for (const relFile of files) {
    if (only && !only.has(relFile)) continue;
    try {
      const fullPath = join(root, relFile);
      const content = readFileSync(fullPath, 'utf8');
      const canonical = formatSource(content);
      if (content !== canonical) {
        // Find first line that differs
        const origLines = content.split('\n');
        const canonLines = canonical.split('\n');
        let diffLine = 1;
        for (let i = 0; i < origLines.length; i++) {
          if (origLines[i] !== canonLines[i]) {
            diffLine = i + 1;
            break;
          }
        }
        errors.push({
          stage: 'style',
          rule: 'format',
          file: relFile,
          line: diffLine,
          cause: 'file is not in canonical format',
          suggestion: 'run `aif fix`',
        });
      }
    } catch {
      // Ignored unreadable files
    }
  }

  return errors;
}

/**
 * Format all target source files in place.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @param {Set<string> | null} [only]
 * @returns {{ ok: boolean, errors: Array<Record<string, any>> }}
 */
export function fixStyle(root, cfg, only = null) {
  const files = findSourceFiles(root, cfg);
  for (const relFile of files) {
    if (only && !only.has(relFile)) continue;
    try {
      const fullPath = join(root, relFile);
      const content = readFileSync(fullPath, 'utf8');
      const canonical = formatSource(content);
      if (content !== canonical) {
        writeFileSync(fullPath, canonical, 'utf8');
      }
    } catch {
      // Ignored
    }
  }

  const remaining = checkStyle(root, cfg, only);
  return {
    ok: remaining.length === 0,
    errors: remaining,
  };
}
