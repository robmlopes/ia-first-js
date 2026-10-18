import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDocsCheck } from '../src/docscheck.js';
import { main, COMMANDS } from '../src/cli.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-docs-'));
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

test('runDocsCheck detects broken relative links DOC004', async () => {
  const files = {
    'docs/guide.md': 'See [other doc](./missing.md) and [good link](#section).\n\n# Section\nContent.\n',
  };

  await withFixture(files, (root) => {
    const errors = runDocsCheck(root, COMMANDS);
    assert.ok(errors.some((e) => e.rule === 'DOC004' && e.cause.includes('missing.md')));
  });
});

test('runDocsCheck detects undocumented CLI command DOC003', async () => {
  const files = {
    'docs/cli.md': '## `aif check`\nRuns checks.\n',
  };

  await withFixture(files, (root) => {
    const errors = runDocsCheck(root, ['check', 'nonExistentCommand']);
    assert.ok(errors.some((e) => e.rule === 'DOC003' && e.cause.includes('nonExistentCommand')));
  });
});

test('CLI command aif docs returns 0 when docs are clean or empty', async () => {
  await withFixture({}, async (root) => {
    const out = [];
    const io = { stdout: (t) => out.push(t), stderr: () => {} };
    const code = await main(['docs', '--root', root], io);
    assert.equal(code, 0);
  });
});
