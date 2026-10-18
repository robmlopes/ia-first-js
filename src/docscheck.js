/**
 * `aif docs`: documentation consistency checks (DOC001-DOC004).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const RULE_REGEX = /\b(?:AIF|CON|INT|AGT|DOC)\d{3}\b/g;
const LINK_REGEX = /(?<!\!)\[[^\]]*\]\(([^)\s]+)\)/g;
const HEADING_REGEX = /^#{1,6}\s+(.*)$/gm;
const CODE_FENCE_REGEX = /```[\s\S]*?```/g;

function error(rule, file, cause, suggestion) {
  return {
    stage: 'docs',
    rule,
    file,
    line: 1,
    cause,
    suggestion,
  };
}

function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function extractAnchors(text) {
  const cleaned = text.replace(CODE_FENCE_REGEX, '');
  const anchors = new Set();
  let match;
  while ((match = HEADING_REGEX.exec(cleaned)) !== null) {
    anchors.add(slugify(match[1]));
  }
  return anchors;
}

/**
 * Check markdown links (DOC004).
 * @param {string} root
 * @returns {Array<Record<string, any>>}
 */
export function checkLinks(root) {
  const errors = [];
  const docsDir = join(root, 'docs');
  if (!existsSync(docsDir)) return [];

  const files = readdirSync(docsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(docsDir, f));

  const readme = join(root, 'README.md');
  if (existsSync(readme)) files.push(readme);

  for (const filePath of files) {
    const rel = relative(root, filePath).replace(/\\/g, '/');
    let text = '';
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const cleaned = text.replace(CODE_FENCE_REGEX, '');
    const anchors = extractAnchors(text);

    let match;
    while ((match = LINK_REGEX.exec(cleaned)) !== null) {
      const target = match[1];
      if (/^[a-z]+:/i.test(target)) continue; // external URL
      if (target.startsWith('#')) {
        const anchor = target.slice(1);
        if (!anchors.has(anchor)) {
          errors.push(error('DOC004', rel, `link anchor not found: ${target}`, 'fix the heading anchor'));
        }
        continue;
      }

      const [pathPart, anchorPart] = target.split('#');
      const dest = pathPart ? resolve(dirname(filePath), pathPart) : filePath;

      if (pathPart && !existsSync(dest)) {
        errors.push(error('DOC004', rel, `broken link: ${target}`, 'fix the path or remove the link'));
      } else if (anchorPart && dest.endsWith('.md')) {
        try {
          const destText = readFileSync(dest, 'utf8');
          const destAnchors = extractAnchors(destText);
          if (!destAnchors.has(anchorPart)) {
            errors.push(error('DOC004', rel, `link anchor not found: ${target}`, 'fix the heading anchor'));
          }
        } catch {
          // Ignored
        }
      }
    }
  }

  return errors;
}

/**
 * Check CLI command documentation (DOC003).
 * @param {string} root
 * @param {string[]} commands
 * @returns {Array<Record<string, any>>}
 */
export function checkCliDocs(root, commands) {
  const cliDoc = join(root, 'docs', 'cli.md');
  if (!existsSync(cliDoc)) return [];

  const text = readFileSync(cliDoc, 'utf8');
  const rel = relative(root, cliDoc).replace(/\\/g, '/');
  const errors = [];

  for (const cmd of commands) {
    const reg = new RegExp(`\`${cmd}\\b|## \`aif ${cmd}\\b`);
    if (!reg.test(text)) {
      errors.push(error('DOC003', rel, `CLI command \`${cmd}\` is not documented`, `add a \`${cmd}\` entry to ${rel}`));
    }
  }

  return errors;
}

/**
 * Run documentation validation over the repository.
 * @param {string} root
 * @param {string[]} [commands]
 * @returns {Array<Record<string, any>>}
 */
export function runDocsCheck(root, commands = []) {
  const docsDir = join(root, 'docs');
  if (!existsSync(docsDir)) return [];

  const errors = [];
  if (commands && commands.length > 0) {
    errors.push(...checkCliDocs(root, commands));
  }
  errors.push(...checkLinks(root));

  return errors;
}
