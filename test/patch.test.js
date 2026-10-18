import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPatch } from '../src/patch.js';
import { main } from '../src/cli.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-patch-'));
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

test('applyPatch replaces a top-level function cleanly', async () => {
  const files = {
    'domain/calc.js': `
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
`,
  };

  await withFixture(files, (root) => {
    const newCode = `export function add(a, b) {\n  return a + b + 0;\n}`;
    const res = applyPatch(join(root, 'domain/calc.js'), 'add', newCode);
    assert.equal(res.ok, true);
    assert.ok(res.diff);

    const updated = readFileSync(join(root, 'domain/calc.js'), 'utf8');
    assert.match(updated, /return a \+ b \+ 0;/);
    assert.match(updated, /export function multiply/);
  });
});

test('applyPatch rejects patch if symbol not found or new code has syntax errors', async () => {
  const files = {
    'domain/calc.js': `export function add(a, b) { return a + b; }`,
  };

  await withFixture(files, (root) => {
    // 1. Symbol not found
    const res1 = applyPatch(join(root, 'domain/calc.js'), 'nonExistent', 'function x() {}');
    assert.equal(res1.ok, false);
    assert.match(res1.cause, /symbol 'nonExistent' not found/);

    // 2. Syntax error
    const res2 = applyPatch(join(root, 'domain/calc.js'), 'add', 'export function add(a, {');
    assert.equal(res2.ok, false);
    assert.match(res2.cause, /syntax error/);
  });
});

test('CLI command aif patch works end-to-end', async () => {
  const files = {
    'domain/calc.js': `export function foo() { return 1; }\n`,
  };

  await withFixture(files, async (root) => {
    const out = [];
    const io = { stdout: (t) => out.push(t), stderr: () => {} };
    const filePath = join(root, 'domain/calc.js');
    const newCode = 'export function foo() { return 2; }\n';

    const code = await main(['patch', filePath, 'foo', newCode], io);
    assert.equal(code, 0);

    const updated = readFileSync(filePath, 'utf8');
    assert.equal(updated, 'export function foo() { return 2; }\n');
  });
});
