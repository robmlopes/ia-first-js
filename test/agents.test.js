import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderAgentFiles, staleAgentFiles, writeAgentFiles } from '../src/agents.js';
import { main } from '../src/cli.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-agents-'));
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

test('renderAgentFiles produces AGENTS.md, CLAUDE.md and .cursor/rules/aif.mdc from protocol.md', async () => {
  const files = {
    '.aif/protocol.md': '## Rules\n1. Always write contracts.\n',
  };

  await withFixture(files, (root) => {
    const rendered = renderAgentFiles(root);
    assert.ok(rendered['AGENTS.md']);
    assert.ok(rendered['CLAUDE.md']);
    assert.ok(rendered['.cursor/rules/aif.mdc']);

    assert.match(rendered['AGENTS.md'], /Generated from \.aif\/protocol\.md/);
    assert.match(rendered['AGENTS.md'], /Always write contracts/);
    assert.match(rendered['.cursor/rules/aif.mdc'], /^---/); // Frontmatter preserved at top
  });
});

test('staleAgentFiles and writeAgentFiles detect missing files and write them', async () => {
  const files = {
    '.aif/protocol.md': '## Protocol\nStrict TDD\n',
  };

  await withFixture(files, (root) => {
    assert.equal(staleAgentFiles(root).length, 3);
    const written = writeAgentFiles(root);
    assert.equal(written.length, 3);
    assert.equal(staleAgentFiles(root).length, 0);

    assert.equal(existsSync(join(root, 'AGENTS.md')), true);
    assert.equal(existsSync(join(root, 'CLAUDE.md')), true);
    assert.equal(existsSync(join(root, '.cursor/rules/aif.mdc')), true);
  });
});

test('CLI command aif agents reports stale or writes files with --write', async () => {
  const files = {
    '.aif/protocol.md': '## Protocol\nStrict TDD\n',
  };

  await withFixture(files, async (root) => {
    const out1 = [];
    const io1 = { stdout: (t) => out1.push(t), stderr: () => {} };
    // 1. Without write: warns about stale files
    const code1 = await main(['agents', '--root', root], io1);
    assert.equal(code1, 1);
    assert.match(out1.join(''), /out of date/);

    // 2. With write: updates files and returns 0
    const out2 = [];
    const io2 = { stdout: (t) => out2.push(t), stderr: () => {} };
    const code2 = await main(['agents', '--write', '--root', root], io2);
    assert.equal(code2, 0);
    assert.match(out2.join(''), /updated/);
  });
});
