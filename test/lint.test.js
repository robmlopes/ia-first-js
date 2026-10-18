import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLint } from '../src/lint.js';
import { loadConfig } from '../src/config.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-lint-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(root, name, '..'), { recursive: true });
      writeFileSync(join(root, name), content);
    }
    return await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('AIF001: detects forbidden import in pure module', async () => {
  const files = {
    'aif.config.json': JSON.stringify({
      sourceDirs: ['domain'],
      pureDirs: ['domain'],
      forbiddenImports: ['node:fs', 'node:http', 'axios'],
    }),
    'domain/pure.js': `
      import { readFileSync } from 'node:fs';
      export function readData() { return readFileSync('foo'); }
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runLint(root, cfg);
    const aif001 = errors.filter(e => e.rule === 'AIF001');
    assert.equal(aif001.length, 1);
    assert.equal(aif001[0].stage, 'lint');
    assert.match(aif001[0].cause, /forbidden import in pure module: node:fs/);
  });
});

test('AIF002: detects public top-level function in pure module without contract', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'], pureDirs: ['domain'] }),
    'domain/calc.js': `
      export function calculateInterest(rate, principal) {
        return rate * principal;
      }
      function _privateHelper(x) {
        return x;
      }
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runLint(root, cfg);
    const aif002 = errors.filter(e => e.rule === 'AIF002');
    assert.equal(aif002.length, 1);
    assert.match(aif002[0].cause, /calculateInterest/);
  });
});

test('AIF003: detects function without complete type annotations or JSDoc', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/untyped.ts': `
      export function untyped(a, b: number) {
        return a + b;
      }
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runLint(root, cfg);
    const aif003 = errors.filter(e => e.rule === 'AIF003');
    assert.equal(aif003.length, 1);
    assert.match(aif003[0].cause, /untyped lacks complete type hints/);
  });
});

test('AIF004: detects bare or empty catch blocks (anti-swallow)', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/swallow.js': `
      export function risky() {
        try {
          doWork();
        } catch {}
      }
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runLint(root, cfg);
    const aif004 = errors.filter(e => e.rule === 'AIF004');
    assert.equal(aif004.length, 1);
    assert.match(aif004[0].cause, /generic or empty catch block/);
  });
});

test('AIF006: detects hallucinated/unknown imports within the project', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/account.js': `
      export class Account {}
    `,
    'domain/service.js': `
      import { NonExistent } from './account.js';
      import './non_existent_module.js';

      export const s = 1;
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runLint(root, cfg);
    const aif006 = errors.filter(e => e.rule === 'AIF006');
    assert.ok(aif006.length >= 1);
    assert.equal(aif006.some(e => e.cause.includes('NonExistent')), true);
  });
});

test('AIF007: detects forbidden usage of globalThis or window', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/leak.js': `
      export function leak() {
        globalThis.dirtyState = 123;
      }
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runLint(root, cfg);
    const aif007 = errors.filter(e => e.rule === 'AIF007');
    assert.equal(aif007.length, 1);
    assert.match(aif007[0].cause, /global scope/);
  });
});

test('AIF012: detects hallucinated member access on project classes', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/db.js': `
      export class Db {
        connect() {}
      }
    `,
    'domain/app.js': `
      import { Db } from './db.js';
      export function start() {
        Db.nonExistentMethod();
      }
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runLint(root, cfg);
    const aif012 = errors.filter(e => e.rule === 'AIF012');
    assert.equal(aif012.length, 1);
    assert.match(aif012[0].cause, /unknown member 'nonExistentMethod' on class 'Db'/);
  });
});

test('AIF014: detects undeclared third-party imports', async () => {
  const files = {
    'package.json': JSON.stringify({ name: 'test-app', dependencies: { 'lodash': '^4.17.21' } }),
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'], thirdParty: ['lodash'] }),
    'domain/client.js': `
      import axios from 'axios'; // undeclared!
      export const x = 1;
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runLint(root, cfg);
    const aif014 = errors.filter(e => e.rule === 'AIF014');
    assert.equal(aif014.length, 1);
    assert.match(aif014[0].cause, /undeclared third-party import: axios/);
  });
});
