/**
 * Project scaffolder: creates a new AI-first project that passes `aif check` out of the box.
 * Supports both JSDoc/ESM and Native TypeScript templates as requested by the user.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeAgentFiles } from './agents.js';
import { saveIndex } from './indexer.js';
import { loadConfig } from './config.js';

export const TEMPLATES = {
  jsdoc: {
    'package.json': JSON.stringify(
      {
        name: 'aif-app',
        version: '0.1.0',
        type: 'module',
        scripts: {
          test: 'node --test test/**/*.test.js',
          check: 'aif check',
        },
      },
      null,
      2,
    ) + '\n',
    'aif.config.json': JSON.stringify(
      {
        sourceDirs: ['domain', 'ports', 'adapters'],
        pureDirs: ['domain'],
        adapterDirs: ['adapters'],
        portDirs: ['ports'],
        testDirs: ['test'],
        history: true,
      },
      null,
      2,
    ) + '\n',
    '.gitignore': 'node_modules/\n.aif/cache/\n.aif/last-check.json\n',
    '.aif/protocol.md': '# Protocol\n\n1. Contracts: Every pure function has @contract with requires and ensures.\n2. Layering: domain imports only ports.\n3. Tests: node:test for unit and contract testing.\n',
    '.aif/intents/bootstrap.md': '# Bootstrap\n\n## Why\nInitial project setup.\n\n## Scope\n- domain/calc.js\n- test/calc.test.js\n\n## Acceptance\n- Basic operations work and pass aif check.\n',
    'domain/calc.js': `import { contract } from '${join(process.cwd(), 'src', 'contract.js')}';\n\n/**\n * @param {number} a\n * @param {number} b\n * @returns {number}\n */\nexport const add = contract({\n  requires: ({ a, b }) => typeof a === 'number' && typeof b === 'number',\n  ensures: (result, { a, b }) => result === a + b,\n  effects: [],\n})(function add(a, b) {\n  return a + b;\n});\n`,
    'ports/clock.js': '/** Clock port */\nexport class ClockPort {\n  now() { throw new Error("not implemented"); }\n}\n',
    'adapters/system-clock.js': 'import { ClockPort } from "../ports/clock.js";\n\nexport class SystemClock extends ClockPort {\n  now() { return new Date(); }\n}\n',
    'test/calc.test.js': `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from '../domain/calc.js';\n\ntest('add adds numbers', () => {\n  assert.equal(add(2, 3), 5);\n});\n`,
  },
  ts: {
    'package.json': JSON.stringify(
      {
        name: 'aif-app-ts',
        version: '0.1.0',
        type: 'module',
        scripts: {
          test: 'node --test test/**/*.test.js',
          check: 'aif check',
        },
      },
      null,
      2,
    ) + '\n',
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noEmit: true,
        },
        include: ['domain/**/*', 'ports/**/*', 'adapters/**/*', 'test/**/*'],
      },
      null,
      2,
    ) + '\n',
    'aif.config.json': JSON.stringify(
      {
        sourceDirs: ['domain', 'ports', 'adapters'],
        pureDirs: ['domain'],
        adapterDirs: ['adapters'],
        portDirs: ['ports'],
        testDirs: ['test'],
        history: true,
      },
      null,
      2,
    ) + '\n',
    '.gitignore': 'node_modules/\ndist/\n.aif/cache/\n.aif/last-check.json\n',
    '.aif/protocol.md': '# Protocol\n\n1. Contracts: Pure functions have contracts.\n2. Layering: domain imports only ports.\n',
    '.aif/intents/bootstrap.md': '# Bootstrap\n\n## Why\nInitial TS setup.\n\n## Scope\n- domain/calc.ts\n\n## Acceptance\n- Types compile cleanly.\n',
    'domain/calc.ts': `import { contract } from '${join(process.cwd(), 'src', 'contract.js')}';\n\nexport const add = contract({\n  requires: ({ a, b }: { a: number, b: number }) => typeof a === 'number',\n  ensures: (result: number, { a, b }: { a: number, b: number }) => result === a + b,\n  effects: [],\n})(function add(a: number, b: number): number {\n  return a + b;\n});\n`,
    'ports/clock.ts': 'export interface ClockPort {\n  now(): Date;\n}\n',
    'adapters/system-clock.ts': 'import type { ClockPort } from "../ports/clock.js";\n\nexport class SystemClock implements ClockPort {\n  now(): Date { return new Date(); }\n}\n',
  },
};

/**
 * Initialize a new project from a template.
 * @param {string} root
 * @param {{ template?: 'jsdoc' | 'ts' }} [options]
 * @returns {{ ok: boolean, files: string[] }}
 */
export function initProject(root, options = {}) {
  const tplName = options.template === 'ts' ? 'ts' : 'jsdoc';
  const layout = TEMPLATES[tplName];
  const filesCreated = [];

  for (const [relPath, content] of Object.entries(layout)) {
    const target = join(root, relPath);
    if (!existsSync(target)) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, 'utf8');
      filesCreated.push(relPath);
    }
  }

  // Generate agent files
  writeAgentFiles(root);
  // Generate initial index
  const cfg = loadConfig(root);
  saveIndex(root, cfg);

  return { ok: true, files: filesCreated };
}
