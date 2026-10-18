import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, runStages, changedFiles, testsStage } from '../src/pipeline.js';

async function withProject(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-pipeline-'));
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

const stage = (name, errors, calls) => ({
  name,
  run: () => {
    calls.push(name);
    return errors;
  },
});

test('runStages runs in order and stops at the first stage with errors', async () => {
  const calls = [];
  const error = { stage: 'b', cause: 'boom' };
  const { errors, timings } = await runStages([stage('a', [], calls), stage('b', [error], calls), stage('c', [], calls)], {});
  assert.deepEqual(calls, ['a', 'b']);
  assert.deepEqual(errors, [error]);
  assert.deepEqual(Object.keys(timings), ['a', 'b']);
});

test('runStages supports async stages and records timings', async () => {
  const { errors, timings } = await runStages([{ name: 'slow', run: async () => [] }], {});
  assert.deepEqual(errors, []);
  assert.equal(typeof timings.slow, 'number');
});

test('a stage that throws becomes a structured error, never a crash or silence', async () => {
  const { errors } = await runStages([{ name: 'bad', run: () => { throw new Error('kaput'); } }], {});
  assert.equal(errors.length, 1);
  assert.equal(errors[0].stage, 'bad');
  assert.equal('rule' in errors[0], false);
  assert.ok(errors[0].suggestion);
  assert.match(errors[0].cause, /kaput/);
});

test('testsStage returns no errors when there are no test files', async () => {
  await withProject({ 'README.md': 'x' }, async (root) => {
    assert.deepEqual(await testsStage({ root }), []);
  });
});

test('testsStage reports failing tests with file and cause', async () => {
  const files = { 'test/a.test.js': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('adds', () => assert.equal(1 + 1, 3));\n" };
  await withProject(files, async (root) => {
    const errors = await testsStage({ root });
    assert.equal(errors.length, 1);
    assert.equal(errors[0].stage, 'tests');
    assert.equal(errors[0].test, 'adds');
    assert.match(errors[0].file, /a\.test\.js$/);
    assert.ok(errors[0].cause);
  });
});

test('testsStage extracts contract violations as counterexamples', async () => {
  const payload = JSON.stringify({ kind: 'precondition', function: 'f', counterexample: { inputs: { x: 1 } } });
  const files = { 'test/c.test.js': `import { test } from 'node:test';\ntest('contract', () => { throw new Error('AIF_CONTRACT ${payload}'); });\n` };
  await withProject(files, async (root) => {
    const [error] = await testsStage({ root });
    assert.equal(error.cause, 'contract violated');
    assert.equal(error.kind, 'precondition');
    assert.equal(error.function, 'f');
    assert.deepEqual(error.counterexample, { inputs: { x: 1 } });
  });
});

test('testsStage passes on a green suite', async () => {
  const files = { 'test/ok.test.js': "import { test } from 'node:test';\ntest('ok', () => {});\n" };
  await withProject(files, async (root) => {
    assert.deepEqual(await testsStage({ root }), []);
  });
});

test('check returns ok, errors, warnings and timings, and writes the snapshot and history', async () => {
  const files = { 'test/ok.test.js': "import { test } from 'node:test';\ntest('ok', () => {});\n" };
  await withProject(files, async (root) => {
    const result = await check(root);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(typeof result.timings.total, 'number');
    assert.equal(JSON.parse(readFileSync(join(root, '.aif', 'last-check.json'), 'utf8')).status, 'done');
    assert.ok(existsSync(join(root, '.aif', 'history.jsonl')));
  });
});

test('check respects history: false', async () => {
  const files = { 'aif.config.json': '{ "history": false }', 'test/ok.test.js': "import { test } from 'node:test';\ntest('ok', () => {});\n" };
  await withProject(files, async (root) => {
    await check(root);
    assert.equal(existsSync(join(root, '.aif', 'history.jsonl')), false);
  });
});

test('check turns an invalid config into a structured error', async () => {
  await withProject({ 'aif.config.json': '{ nope' }, async (root) => {
    const result = await check(root);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].stage, 'config');
    assert.equal('rule' in result.errors[0], false);
  });
});

test('check with changed outside git explains it checked everything', async () => {
  await withProject({ 'test/ok.test.js': "import { test } from 'node:test';\ntest('ok', () => {});\n" }, async (root) => {
    const result = await check(root, { changed: true });
    assert.match(result.changed_only, /not a git repository/);
  });
});

test('changedFiles returns null outside a git repository', async () => {
  await withProject({ 'a.js': '1' }, (root) => {
    assert.equal(changedFiles(root), null);
  });
});
