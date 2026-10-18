/**
 * Intents: the human "why" per feature, stored in .aif/intents/<id>.md.
 * Validates INT001-INT006 following canonical schema.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const SECTIONS = ['Why', 'Scope', 'Acceptance'];
const ID_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TEMPLATE = `# {title}

## Why
Explain, in a sentence or two, the human reason for this feature.

## Scope
- {example}

## Acceptance
- Describe one observable behaviour that must hold.
`;

function error(rule, file, cause, suggestion) {
  return {
    stage: 'intents',
    rule,
    file,
    line: 1,
    cause,
    suggestion,
  };
}

function intentsDir(root) {
  return join(root, '.aif', 'intents');
}

/**
 * Parse an intent markdown file into structured object.
 * @param {string} text
 * @returns {{ title: string, sections: Record<string, string[]> }}
 */
export function parseIntents(text) {
  let title = '';
  const sections = {};
  let current = null;

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('# ') && !title) {
      title = line.slice(2).trim();
    } else if (line.startsWith('## ')) {
      current = line.slice(3).trim();
      sections[current] = [];
    } else if (current && line.trim()) {
      sections[current].push(line.trim());
    }
  }

  return { title, sections };
}

/**
 * Extract scope paths from parsed sections.
 * @param {ReturnType<typeof parseIntents>} parsed
 * @returns {string[]}
 */
export function getScopePaths(parsed) {
  const scope = parsed.sections['Scope'] || [];
  return scope
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim().replace(/`/g, ''));
}

/**
 * Validate an intent file.
 * @param {string} root
 * @param {string} filePath
 * @returns {Array<Record<string, any>>}
 */
export function validateIntent(root, filePath) {
  const fileStem = basename(filePath, '.md');
  const rel = relative(root, filePath).replace(/\\/g, '/');
  const errors = [];

  if (!ID_REGEX.test(fileStem)) {
    errors.push(
      error('INT001', rel, `intent id '${fileStem}' is not kebab-case`, 'use lowercase-words-with-dashes.md'),
    );
  }

  let content = '';
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [error('INT002', rel, 'cannot read intent file', 'check file permissions')];
  }

  const parsed = parseIntents(content);
  if (!parsed.title) {
    errors.push(error('INT002', rel, "missing '# title' line", "start the file with '# <title>'"));
  }

  for (const name of SECTIONS) {
    if (!parsed.sections[name] || parsed.sections[name].length === 0) {
      errors.push(error('INT002', rel, `section '## ${name}' is missing or empty`, `fill in '## ${name}'`));
    }
  }

  for (const path of getScopePaths(parsed)) {
    if (!existsSync(join(root, path))) {
      errors.push(
        error(
          'INT003',
          rel,
          `scope path does not exist: ${path}`,
          'update the intent or restore the file (see .aif/index.json)',
        ),
      );
    }
  }

  return errors;
}

/**
 * List all existing intents in `.aif/intents/`.
 * @param {string} root
 * @returns {Array<{ id: string, title: string, scope: string[] }>}
 */
export function listIntents(root) {
  const dir = intentsDir(root);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const list = [];

  for (const f of files) {
    const full = join(dir, f);
    try {
      const parsed = parseIntents(readFileSync(full, 'utf8'));
      list.push({
        id: basename(f, '.md'),
        title: parsed.title,
        scope: getScopePaths(parsed),
      });
    } catch {
      // Ignored
    }
  }

  return list;
}

/**
 * Create a new intent file.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @param {string} intentId
 * @param {string} title
 * @returns {{ ok: boolean, stage?: string, cause?: string, suggestion?: string, file?: string }}
 */
export function createIntent(root, cfg, intentId, title) {
  if (!ID_REGEX.test(intentId)) {
    return { ok: false, stage: 'intents', cause: `invalid id '${intentId}'`, suggestion: 'use kebab-case' };
  }

  const dir = intentsDir(root);
  const target = join(dir, `${intentId}.md`);
  if (existsSync(target)) {
    return { ok: false, stage: 'intents', cause: `${intentId} already exists`, suggestion: 'edit it instead' };
  }

  mkdirSync(dir, { recursive: true });
  const example = `${cfg.sourceDirs[0] || 'domain'}/<module>.js`;
  const text = TEMPLATE.replace('{title}', title).replace('{example}', example);
  writeFileSync(target, text, 'utf8');

  return { ok: true, file: relative(root, target).replace(/\\/g, '/') };
}

/**
 * Check a git commit message for the mandatory `Intent: <id>` trailer.
 * @param {string} root
 * @param {string} message
 * @returns {Record<string, any> | null}
 */
export function checkCommitMessage(root, message) {
  const match = message.match(/^Intent:\s*(\S+)\s*$/m);
  if (!match) {
    return error(
      'INT004',
      '<commit-message>',
      "commit message has no 'Intent: <id>' trailer",
      "add a line 'Intent: <id>' (see `aif intent list`)",
    );
  }

  const intentId = match[1];
  const target = join(intentsDir(root), `${intentId}.md`);
  if (!existsSync(target)) {
    const valid = listIntents(root).map((i) => i.id);
    return error(
      'INT005',
      '<commit-message>',
      `unknown intent '${intentId}'`,
      `existing intents: [${valid.join(', ')}]`,
    );
  }

  return null;
}

/**
 * Verify that all changed files are covered by the active intent's scope.
 * @param {string} root
 * @param {string} message
 * @param {string[]} changed
 * @returns {Array<Record<string, any>>}
 */
export function checkIntentScope(root, message, changed) {
  const match = message.match(/^Intent:\s*(\S+)\s*$/m);
  if (!match) return [];

  const intentId = match[1];
  const target = join(intentsDir(root), `${intentId}.md`);
  if (!existsSync(target)) return [];

  const parsed = parseIntents(readFileSync(target, 'utf8'));
  const scope = new Set(getScopePaths(parsed));
  const errors = [];

  for (const path of changed) {
    if (path in scope || path.startsWith('.aif/') || path.startsWith('docs/') || path.startsWith('test/') || !path.includes('/')) {
      continue;
    }
    errors.push(
      error(
        'INT006',
        path,
        `${path} changed but is not in the Scope of intent '${intentId}'`,
        `add it to '## Scope' in .aif/intents/${intentId}.md or split the commit`,
      ),
    );
  }

  return errors;
}
