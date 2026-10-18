import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseIntents, validateIntent, createIntent, listIntents, checkCommitMessage, checkIntentScope } from '../src/intents.js';
import { loadConfig } from '../src/config.js';
import { main } from '../src/cli.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-intents-'));
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

test('createIntent creates a new kebab-case intent file', async () => {
  await withFixture({}, (root) => {
    const cfg = loadConfig(root);
    const res = createIntent(root, cfg, 'user-auth', 'User Authentication');
    assert.equal(res.ok, true);
    assert.equal(existsSync(join(root, '.aif/intents/user-auth.md')), true);

    const list = listIntents(root);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'user-auth');
    assert.equal(list[0].title, 'User Authentication');
  });
});

test('validateIntent checks structure: INT001 (kebab-case), INT002 (missing sections) and INT003 (missing files)', async () => {
  const files = {
    'domain/calc.js': 'export const x = 1;',
    '.aif/intents/BadId.md': `
# Missing Sections
## Why
Because.
`,
  };

  await withFixture(files, (root) => {
    const errs = validateIntent(root, join(root, '.aif/intents/BadId.md'));
    assert.ok(errs.some((e) => e.rule === 'INT001'));
    assert.ok(errs.some((e) => e.rule === 'INT002'));
  });
});

test('checkCommitMessage validates Intent trailer: INT004 and INT005', async () => {
  const files = {
    '.aif/intents/my-feature.md': `# Feature\n## Why\nx\n## Scope\n- a\n## Acceptance\n- b\n`,
  };

  await withFixture(files, (root) => {
    // 1. Missing trailer (INT004)
    const err1 = checkCommitMessage(root, 'feat: add something without trailer');
    assert.ok(err1);
    assert.equal(err1.rule, 'INT004');

    // 2. Unknown intent (INT005)
    const err2 = checkCommitMessage(root, 'feat: add something\n\nIntent: nonexistent');
    assert.ok(err2);
    assert.equal(err2.rule, 'INT005');

    // 3. Valid intent
    const err3 = checkCommitMessage(root, 'feat: add something\n\nIntent: my-feature');
    assert.equal(err3, null);
  });
});

test('CLI command aif intent works end-to-end', async () => {
  await withFixture({}, async (root) => {
    const out = [];
    const io = { stdout: (t) => out.push(t), stderr: () => {} };

    // Create intent
    const code1 = await main(['intent', 'create', 'new-flow', 'New Flow', '--root', root], io);
    assert.equal(code1, 0);

    // List intents
    const code2 = await main(['intent', 'list', '--root', root], io);
    assert.equal(code2, 0);
    assert.match(out.join(''), /new-flow/);
  });
});
