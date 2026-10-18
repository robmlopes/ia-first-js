import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runEffects } from '../src/effects.js';
import { loadConfig } from '../src/config.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-effects-'));
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

test('AIF008: detects unknown effect in @contract', async () => {
  const files = {
    'aif.config.json': JSON.stringify({
      sourceDirs: ['domain'],
      capabilities: { DbWrite: ['db.write'] },
    }),
    'domain/save.js': `
      export const save = contract({
        effects: ['invented.effect'],
      })(function save(db) {});
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runEffects(root, cfg);
    const aif008 = errors.filter(e => e.rule === 'AIF008');
    assert.equal(aif008.length, 1);
    assert.equal(aif008[0].stage, 'effects');
    assert.match(aif008[0].cause, /unknown effect 'invented\.effect'/);
  });
});

test('AIF009: detects effect declared without capability parameter', async () => {
  const files = {
    'aif.config.json': JSON.stringify({
      sourceDirs: ['domain'],
      capabilities: { DbWrite: ['db.write'] },
    }),
    'domain/save.js': `
      /**
       * @param {string} name
       */
      export const save = contract({
        effects: ['db.write'],
      })(function save(name) {});
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runEffects(root, cfg);
    const aif009 = errors.filter(e => e.rule === 'AIF009');
    assert.equal(aif009.length, 1);
    assert.match(aif009[0].cause, /declares 'db\.write' without receiving the capability/);
  });
});

test('AIF009: detects capability parameter without declaring effect', async () => {
  const files = {
    'aif.config.json': JSON.stringify({
      sourceDirs: ['domain'],
      capabilities: { DbWrite: ['db.write'] },
    }),
    'domain/save.js': `
      /**
       * @param {DbWrite} db
       */
      export const save = contract({
        effects: [],
      })(function save(db) {});
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runEffects(root, cfg);
    const aif009 = errors.filter(e => e.rule === 'AIF009');
    assert.equal(aif009.length, 1);
    assert.match(aif009[0].cause, /receives a 'db\.write' capability but does not declare the effect/);
  });
});

test('AIF010: detects direct calls to forbidden calls or clock in pure code', async () => {
  const files = {
    'aif.config.json': JSON.stringify({
      sourceDirs: ['domain'],
      pureDirs: ['domain'],
      forbiddenCalls: ['eval', 'setTimeout'],
      forbiddenClock: ['Date.now'],
    }),
    'domain/impure.js': `
      export function dirty() {
        const t = Date.now();
        eval('1');
      }
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runEffects(root, cfg);
    const aif010 = errors.filter(e => e.rule === 'AIF010');
    assert.equal(aif010.length, 2);
    assert.equal(aif010.some(e => e.cause.includes('Date.now')), true);
    assert.equal(aif010.some(e => e.cause.includes('eval')), true);
  });
});

test('AIF011: detects domain importing adapter layer directly or transitively', async () => {
  const files = {
    'aif.config.json': JSON.stringify({
      sourceDirs: ['domain', 'adapters'],
      pureDirs: ['domain'],
      adapterDirs: ['adapters'],
    }),
    'adapters/db.js': `export class SqliteDb {}`,
    'domain/leak.js': `
      import { SqliteDb } from '../adapters/db.js';
      export class Service {}
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runEffects(root, cfg);
    const aif011 = errors.filter(e => e.rule === 'AIF011');
    assert.equal(aif011.length, 1);
    assert.match(aif011[0].cause, /domain module domain\.leak imports adapter layer/);
  });
});

test('AIF013: detects dynamic dispatch in pure code', async () => {
  const files = {
    'aif.config.json': JSON.stringify({
      sourceDirs: ['domain'],
      pureDirs: ['domain'],
    }),
    'domain/dyn.js': `
      export function dispatch(table, action) {
        table[action]();
      }
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runEffects(root, cfg);
    const aif013 = errors.filter(e => e.rule === 'AIF013');
    assert.equal(aif013.length, 1);
    assert.match(aif013[0].cause, /dynamic dispatch in pure code/);
  });
});

test('AIF016: detects entry layer importing adapters directly outside composition roots', async () => {
  const files = {
    'aif.config.json': JSON.stringify({
      sourceDirs: ['web', 'adapters'],
      entryDirs: ['web'],
      adapterDirs: ['adapters'],
      compositionRoots: ['web.main'],
    }),
    'adapters/db.js': `export class SqliteDb {}`,
    'web/routes.js': `
      import { SqliteDb } from '../adapters/db.js';
      export function route() {}
    `,
    'web/main.js': `
      import { SqliteDb } from '../adapters/db.js'; // allowed in composition root
      export function init() {}
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = runEffects(root, cfg);
    const aif016 = errors.filter(e => e.rule === 'AIF016');
    assert.equal(aif016.length, 1);
    assert.match(aif016[0].file, /web\/routes\.js/);
  });
});
