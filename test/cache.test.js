import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeModuleKeys, loadCache, saveCache } from '../src/cache.js';
import { loadConfig } from '../src/config.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-cache-'));
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

test('loadCache returns empty object when cache does not exist', async () => {
  await withFixture({}, (root) => {
    assert.deepEqual(loadCache(root), {});
  });
});

test('saveCache and loadCache persist module hashes', async () => {
  await withFixture({}, (root) => {
    const data = { 'domain.calc': 'abcdef123456' };
    saveCache(root, data);
    assert.deepEqual(loadCache(root), data);
  });
});

test('computeModuleKeys changes hash when module source changes', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/calc.js': 'export function add(a, b) { return a + b; }',
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const keys1 = computeModuleKeys(root, cfg);
    assert.ok(keys1['domain.calc']);

    writeFileSync(join(root, 'domain/calc.js'), 'export function add(a, b) { return a + b + 1; }');
    const keys2 = computeModuleKeys(root, cfg);
    assert.notEqual(keys1['domain.calc'], keys2['domain.calc']);
  });
});
