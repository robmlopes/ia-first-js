/**
 * AIF005 size limits: code lines only, per-layer limits, early warnings and extraction hints.
 * Matches Python AIF limits implementation.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSourceFiles } from './indexer.js';
import { parseSource } from './parser.js';

const MIN_WARN_LIMIT = 10;

/**
 * Returns a Set of line numbers (1-based) that are blank or inside comments.
 * @param {string} text
 * @returns {Set<number>}
 */
export function getCommentAndBlankLines(text) {
  const skip = new Set();
  const lines = text.split('\n');
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    let trimmed = lines[i].trim();

    if (inBlockComment) {
      skip.add(lineNum);
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    if (!trimmed) {
      skip.add(lineNum);
      continue;
    }

    if (trimmed.startsWith('//')) {
      skip.add(lineNum);
      continue;
    }

    if (trimmed.startsWith('/*')) {
      skip.add(lineNum);
      if (!trimmed.includes('*/')) {
        inBlockComment = true;
      }
      continue;
    }
  }

  return skip;
}

/**
 * Count effective code lines in text, skipping blanks and comments.
 * @param {string} text
 * @returns {number}
 */
export function countCodeLines(text) {
  const skip = getCommentAndBlankLines(text);
  const total = text.split('\n').length;
  let count = 0;
  for (let i = 1; i <= total; i++) {
    if (!skip.has(i)) count++;
  }
  return count;
}

function calculateSize(startLine, endLine, skip, countCodeLinesOnly) {
  if (!countCodeLinesOnly) return endLine - startLine + 1;
  let count = 0;
  for (let i = startLine; i <= endLine; i++) {
    if (!skip.has(i)) count++;
  }
  return count;
}

function judge(size, limit, warnRatio) {
  if (size > limit) return 'error';
  if (limit >= MIN_WARN_LIMIT && size > limit * warnRatio) return 'warning';
  return null;
}

function fileHint(functions, classes) {
  const parts = [];
  for (const fn of functions) {
    const size = fn.endLine - fn.line + 1;
    parts.push({ name: `function ${fn.name}`, size, line: fn.line });
  }
  for (const cls of classes) {
    const size = cls.methods.length;
    parts.push({ name: `class ${cls.name}`, size, line: cls.line });
  }
  if (parts.length < 2) return 'split the module';
  const top = parts.sort((a, b) => b.size - a.size).slice(0, 3);
  const list = top.map((p) => `${p.name} (line ${p.line})`).join(', ');
  return `move cohesive definitions to a new module; biggest: ${list}`;
}

/**
 * Check size limits for a parsed file.
 * @param {ReturnType<typeof parseSource>} parsed
 * @param {string} code
 * @param {string} relPath
 * @param {import('./config.js').Config} cfg
 * @returns {[Array<Record<string, any>>, Array<Record<string, any>>]} [errors, warnings]
 */
export function checkFileLimits(parsed, code, relPath, cfg) {
  const errors = [];
  const warnings = [];
  const lines = code.split('\n');
  const skip = cfg.countCodeLines ? getCommentAndBlankLines(code) : new Set();
  const counted = cfg.countCodeLines ? 'code lines' : 'lines';

  // 1. File size
  const flimit = cfg.limit(relPath, 'maxFileLines');
  const fsize = calculateSize(1, lines.length, skip, cfg.countCodeLines);
  const fkind = judge(fsize, flimit, cfg.limitWarnRatio);

  if (fkind) {
    const entry = {
      stage: 'lint',
      rule: 'AIF005',
      file: relPath,
      line: 1,
      cause: `file has ${fsize} ${counted} (max ${flimit})`,
      suggestion: fileHint(parsed.functions, parsed.classes),
    };
    if (fkind === 'warning') entry.severity = 'warning';
    (fkind === 'error' ? errors : warnings).push(entry);
  }

  // 2. Function size
  const fnLimit = cfg.limit(relPath, 'maxFunctionLines');
  for (const fn of parsed.functions) {
    const size = calculateSize(fn.line, fn.endLine, skip, cfg.countCodeLines);
    const kind = judge(size, fnLimit, cfg.limitWarnRatio);
    if (kind) {
      const entry = {
        stage: 'lint',
        rule: 'AIF005',
        file: relPath,
        line: fn.line,
        cause: `${fn.name} has ${size} ${counted} (max ${fnLimit})`,
        suggestion: `extract a helper from ${fn.name} (lines ${fn.line}-${fn.endLine})`,
      };
      if (kind === 'warning') entry.severity = 'warning';
      (kind === 'error' ? errors : warnings).push(entry);
    }
  }

  return [errors, warnings];
}

/**
 * Collect all warnings across source files.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @param {Set<string> | null} [only]
 * @returns {Array<Record<string, any>>}
 */
export function getWarnings(root, cfg, only = null) {
  const warnings = [];
  const files = findSourceFiles(root, cfg);

  for (const relFile of files) {
    if (only && !only.has(relFile)) continue;
    try {
      const code = readFileSync(join(root, relFile), 'utf8');
      const parsed = parseSource(relFile, code);
      const [, fileWarns] = checkFileLimits(parsed, code, relFile, cfg);
      warnings.push(...fileWarns);
    } catch {
      // Ignore unreadable files in warnings pass
    }
  }

  return warnings;
}
