import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkStyle, fixStyle } from '../src/style.js';
import { loadConfig } from '../src/config.js';
import { main } from '../src/cli.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-style-'));
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

test('checkStyle detects trailing whitespace and missing final newline', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/dirty.js': 'export const a = 1;   \nexport const b = 2;', // trailing space on line 1, no final newline
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = checkStyle(root, cfg);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].stage, 'style');
    assert.equal(errors[0].rule, 'format');
    assert.equal(errors[0].file, 'domain/dirty.js');
    assert.equal(errors[0].cause, 'file is not in canonical format');
    assert.match(errors[0].suggestion, /aif fix/);
  });
});

test('checkStyle passes when file is canonical', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/clean.js': "export const a = 1;\nexport const b = 2;\n",
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const errors = checkStyle(root, cfg);
    assert.deepEqual(errors, []);
  });
});

test('fixStyle cleans trailing whitespace, normalizes multiple blank lines and adds final newline', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/bad.js': 'export const x = 1;  \n\n\n\nexport const y = 2; ',
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const result = fixStyle(root, cfg);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);

    const cleaned = readFileSync(join(root, 'domain/bad.js'), 'utf8');
    assert.equal(cleaned, 'export const x = 1;\n\nexport const y = 2;\n');
  });
});

test('CLI command aif fix formats files and returns 0', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/bad.js': 'export const a = 1;   \n',
  };

  await withFixture(files, async (root) => {
    const out = [];
    const io = { stdout: (t) => out.push(t), stderr: () => {} };
    const code = await main(['fix', '--root', root], io);
    assert.equal(code, 0);
    assert.match(out.join(''), /formatted/);

    const fixed = readFileSync(join(root, 'domain/bad.js'), 'utf8');
    assert.equal(fixed, 'export const a = 1;\n');
  });
});
