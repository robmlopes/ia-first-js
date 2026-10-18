import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initProject, TEMPLATES } from '../src/scaffold.js';
import { check } from '../src/pipeline.js';
import { main } from '../src/cli.js';

async function withEmptyDir(run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-scaffold-'));
  try {
    return await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('initProject scaffolds ESM / JSDoc template and passes aif check out of the box', async () => {
  await withEmptyDir(async (root) => {
    const res = initProject(root, { template: 'jsdoc' });
    assert.equal(res.ok, true);

    // Verify key files
    assert.ok(existsSync(join(root, 'package.json')));
    assert.ok(existsSync(join(root, 'aif.config.json')));
    assert.ok(existsSync(join(root, '.aif/protocol.md')));
    assert.ok(existsSync(join(root, 'domain/calc.js')));
    assert.ok(existsSync(join(root, 'test/calc.test.js')));

    // Run pipeline check on the freshly created project
    const checkRes = await check(root);
    assert.equal(checkRes.ok, true);
    assert.deepEqual(checkRes.errors, []);
  });
});

test('initProject scaffolds TypeScript native template with tsconfig.json', async () => {
  await withEmptyDir(async (root) => {
    const res = initProject(root, { template: 'ts' });
    assert.equal(res.ok, true);

    assert.ok(existsSync(join(root, 'package.json')));
    assert.ok(existsSync(join(root, 'tsconfig.json')));
    assert.ok(existsSync(join(root, 'domain/calc.ts')));
  });
});

test('CLI command aif init creates project', async () => {
  await withEmptyDir(async (root) => {
    const out = [];
    const io = { stdout: (t) => out.push(t), stderr: () => {} };
    const code = await main(['init', '--root', root], io);
    assert.equal(code, 0);
    assert.match(out.join(''), /initialized/);
    assert.ok(existsSync(join(root, 'aif.config.json')));
  });
});
