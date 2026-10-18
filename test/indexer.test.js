import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateIndex, saveIndex, findSourceFiles, moduleKeyOf } from '../src/indexer.js';
import { loadConfig } from '../src/config.js';
import { main } from '../src/cli.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-indexer-'));
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

test('moduleKeyOf normalizes file path to dotted module name', () => {
  assert.equal(moduleKeyOf('domain/transfer.js'), 'domain.transfer');
  assert.equal(moduleKeyOf('domain/pricing/calc.ts'), 'domain.pricing.calc');
  assert.equal(moduleKeyOf('domain\\user.js'), 'domain.user');
});

test('findSourceFiles returns supported source files from configured sourceDirs', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain', 'ports', 'adapters'] }),
    'domain/logic.js': 'export const a = 1;',
    'domain/calc.ts': 'export const b = 2;',
    'ports/db.ts': 'export interface Db {}',
    'other/ignore.js': 'export const c = 3;',
    'node_modules/pkg/x.js': 'export const d = 4;',
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const found = findSourceFiles(root, cfg).map(f => f.replace(/\\/g, '/'));
    assert.equal(found.includes('domain/logic.js'), true);
    assert.equal(found.includes('domain/calc.ts'), true);
    assert.equal(found.includes('ports/db.ts'), true);
    assert.equal(found.some(f => f.includes('other')), false);
    assert.equal(found.some(f => f.includes('node_modules')), false);
  });
});

test('generateIndex extracts functions and classes into canonical JSON format', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain', 'adapters'] }),
    'domain/transfer.js': `
      /**
       * Transfers amount.
       * @param {number} balance
       * @param {number} amount
       * @returns {number}
       */
      export const transfer = contract({
        requires: ({ amount }) => amount > 0,
        effects: ['db.write'],
      })(function transfer(balance, amount) {
        return balance - amount;
      });
    `,
    'adapters/sqlite.js': `
      export class SqliteDb {
        static timeout = 1000;
        constructor(path) {
          this.path = path;
          this._conn = null;
        }
        save(account) {
          return true;
        }
      }
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const index = generateIndex(root, cfg);

    assert.ok(index['domain']);
    assert.ok(index['adapters']);
    assert.ok(index['domain.transfer']);
    assert.ok(index['adapters.sqlite']);

    const fn = index['domain.transfer']['transfer'];
    assert.equal(fn.kind, 'function');
    assert.deepEqual(fn.args, ['balance', 'amount']);
    assert.equal(fn.returns, 'number');
    assert.equal(fn.doc.includes('Transfers amount'), true);
    assert.deepEqual(fn.contract.effects, ['db.write']);

    const cls = index['adapters.sqlite']['SqliteDb'];
    assert.equal(cls.kind, 'class');
    assert.deepEqual(cls.attributes, ['timeout']);
    assert.deepEqual(cls.instance_attributes.sort(), ['_conn', 'path']);
    assert.ok(cls.methods['save']);
    assert.equal(cls.methods['save'].kind, 'method');
  });
});

test('saveIndex writes atomic .aif/index.json', async () => {
  const files = {
    'domain/op.js': 'export function op() {}',
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    saveIndex(root, cfg);

    const target = join(root, '.aif', 'index.json');
    assert.equal(existsSync(target), true);
    const data = JSON.parse(readFileSync(target, 'utf8'));
    assert.ok(data['domain.op']['op']);
  });
});

test('CLI command aif index generates .aif/index.json and returns 0', async () => {
  const files = {
    'domain/op.js': 'export function op() {}',
  };

  await withFixture(files, async (root) => {
    const out = [];
    const io = { stdout: (t) => out.push(t), stderr: () => {} };
    const code = await main(['index', '--root', root], io);
    assert.equal(code, 0);
    assert.match(out.join(''), /index written to \.aif\/index\.json/);
    assert.equal(existsSync(join(root, '.aif', 'index.json')), true);
  });
});
