import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, COMMANDS } from '../src/cli.js';

const BIN = fileURLToPath(new URL('../bin/aif.js', import.meta.url));
const GREEN = "import { test } from 'node:test';\ntest('ok', () => {});\n";
const RED = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('adds', () => assert.equal(1 + 1, 3));\n";

async function withProject(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-cli-'));
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

function capture() {
  const out = [];
  const err = [];
  return { io: { stdout: (text) => out.push(text), stderr: (text) => err.push(text) }, out, err };
}

test('check --json on a green project prints ok and exits 0', async () => {
  await withProject({ 'test/ok.test.js': GREEN }, async (root) => {
    const { io, out } = capture();
    const code = await main(['check', '--json', '--root', root], io);
    assert.equal(code, 0);
    const result = JSON.parse(out.join(''));
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });
});

test('check --json on a failing project exits 1 with structured errors', async () => {
  await withProject({ 'test/bad.test.js': RED }, async (root) => {
    const { io, out } = capture();
    const code = await main(['check', '--json', '--root', root], io);
    assert.equal(code, 1);
    const result = JSON.parse(out.join(''));
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].stage, 'tests');
  });
});

test('check human output summarizes ok and failures', async () => {
  await withProject({ 'test/ok.test.js': GREEN }, async (root) => {
    const { io, out } = capture();
    assert.equal(await main(['check', '--root', root], io), 0);
    assert.match(out.join(''), /^OK \(/);
  });
  await withProject({ 'test/bad.test.js': RED }, async (root) => {
    const { io, out } = capture();
    assert.equal(await main(['check', '--root', root], io), 1);
    const text = out.join('');
    assert.match(text, /1 error\(s\)/);
    assert.match(text, / - tests /);
  });
});

test('check is the default command', async () => {
  await withProject({ 'test/ok.test.js': GREEN }, async (root) => {
    const { io, out } = capture();
    assert.equal(await main(['--root', root], io), 0);
    assert.match(out.join(''), /^OK/);
  });
});

test('check --changed reports the mode in JSON', async () => {
  await withProject({ 'test/ok.test.js': GREEN }, async (root) => {
    const { io, out } = capture();
    await main(['check', '--json', '--changed', '--root', root], io);
    assert.ok('changed_only' in JSON.parse(out.join('')));
  });
});

test('status reports none before any check, then done after', async () => {
  await withProject({ 'test/ok.test.js': GREEN }, async (root) => {
    const first = capture();
    assert.equal(await main(['status', '--root', root], first.io), 1);
    assert.equal(JSON.parse(first.out.join('')).status, 'none');
    await main(['check', '--root', root], capture().io);
    const second = capture();
    assert.equal(await main(['status', '--root', root], second.io), 0);
    assert.equal(JSON.parse(second.out.join('')).status, 'done');
  });
});

test('stats reads the history', async () => {
  await withProject({ 'test/ok.test.js': GREEN }, async (root) => {
    await main(['check', '--root', root], capture().io);
    const { io, out } = capture();
    assert.equal(await main(['stats', '--root', root], io), 0);
    assert.equal(JSON.parse(out.join('')).runs, 1);
  });
});

test('commands from later phases fail explicitly (stage cli, no rule) and exit 2', async () => {
  for (const command of COMMANDS.filter((name) => !['check', 'status', 'stats'].includes(name))) {
    const { io, out } = capture();
    const code = await main([command], io);
    assert.equal(code, 2, command);
    const result = JSON.parse(out.join(''));
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'cli');
    assert.equal('rule' in result, false);
    assert.match(result.cause, new RegExp(command));
    assert.ok(result.suggestion);
  }
});

test('an unknown command fails with stage cli and exit 2', async () => {
  const { io, out } = capture();
  assert.equal(await main(['frobnicate'], io), 2);
  assert.equal(JSON.parse(out.join('')).stage, 'cli');
});

test('an unknown option fails with stage cli and exit 2', async () => {
  const { io, out } = capture();
  assert.equal(await main(['check', '--nope'], io), 2);
  assert.equal(JSON.parse(out.join('')).stage, 'cli');
});

test('an invalid config surfaces as a config error through the CLI', async () => {
  await withProject({ 'aif.config.json': '{ nope' }, async (root) => {
    const { io, out } = capture();
    assert.equal(await main(['check', '--json', '--root', root], io), 1);
    assert.equal(JSON.parse(out.join('')).errors[0].stage, 'config');
  });
});

test('--help lists the commands and exits 0', async () => {
  const { io, out } = capture();
  assert.equal(await main(['--help'], io), 0);
  assert.match(out.join(''), /aif check/);
});

test('bin/aif.js works end to end as a real process', async () => {
  await withProject({ 'test/ok.test.js': GREEN }, async (root) => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, [BIN, 'check', '--json', '--root', root], { encoding: 'utf8', env, timeout: 30000 });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout).ok, true);
  });
  await withProject({ 'test/bad.test.js': RED }, async (root) => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, [BIN, 'check', '--json', '--root', root], { encoding: 'utf8', env, timeout: 30000 });
    assert.equal(run.status, 1);
  });
});
