import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkUpgrade, applyUpgrade } from '../src/upgrade.js';
import { main } from '../src/cli.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-upgrade-'));
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

test('checkUpgrade detects missing gitignore entries and stale agent files', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    '.aif/protocol.md': '# Protocol\n\n## Custom\nCustom rules.\n',
  };

  await withFixture(files, (root) => {
    const report = checkUpgrade(root);
    assert.equal(report.ok, true);
    assert.equal(report.up_to_date, false);
    assert.ok(report.changes.agent_files.length > 0);
  });
});

test('applyUpgrade updates agent files and preserves custom protocol sections', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    '.aif/protocol.md': '# Protocol\n\n## Custom\nCustom rules.\n',
  };

  await withFixture(files, (root) => {
    const res = applyUpgrade(root);
    assert.equal(res.ok, true);
    assert.equal(existsSync(join(root, 'AGENTS.md')), true);
    assert.match(readFileSync(join(root, 'AGENTS.md'), 'utf8'), /Custom rules/);
  });
});

test('CLI command aif upgrade works end-to-end', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    '.aif/protocol.md': '# Protocol\n',
  };

  await withFixture(files, async (root) => {
    const out = [];
    const io = { stdout: (t) => out.push(t), stderr: () => {} };
    const code = await main(['upgrade', '--root', root], io);
    assert.equal(code, 0);
    const parsed = JSON.parse(out.join(''));
    assert.equal(parsed.ok, true);
  });
});
