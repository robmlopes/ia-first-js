import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeLast, readLast, record, load, stats } from '../src/history.js';

function withRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-history-'));
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const failing = { ok: false, errors: [{ stage: 'lint', rule: 'AIF001' }, { stage: 'lint', rule: 'AIF001' }, { stage: 'tests' }], timings: { lint: 0.1, total: 0.2 } };
const passing = { ok: true, errors: [], timings: { lint: 0.3, total: 0.4 } };

test('writeLast creates .aif and replaces the file atomically', () => {
  withRoot((root) => {
    writeLast(root, { status: 'done', ok: true });
    writeLast(root, { status: 'done', ok: false });
    assert.deepEqual(JSON.parse(readFileSync(join(root, '.aif', 'last-check.json'), 'utf8')), { status: 'done', ok: false });
    assert.deepEqual(readdirSync(join(root, '.aif')), ['last-check.json']);
  });
});

test('readLast returns the stored payload', () => {
  withRoot((root) => {
    writeLast(root, { status: 'running' });
    assert.deepEqual(readLast(root), { status: 'running' });
  });
});

test('readLast reports status none when no check has run', () => {
  withRoot((root) => {
    const last = readLast(root);
    assert.equal(last.status, 'none');
    assert.match(last.suggestion, /aif check/);
  });
});

test('readLast reports a corrupt file explicitly instead of hiding it', () => {
  withRoot((root) => {
    mkdirSync(join(root, '.aif'));
    writeFileSync(join(root, '.aif', 'last-check.json'), '{ broken');
    const last = readLast(root);
    assert.equal(last.status, 'corrupt');
    assert.match(last.cause, /not valid JSON/);
  });
});

test('record appends one JSON line with rules, stages and timings', () => {
  withRoot((root) => {
    record(root, failing, false);
    record(root, passing, true);
    const lines = readFileSync(join(root, '.aif', 'history.jsonl'), 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    const first = JSON.parse(lines[0]);
    assert.equal(first.ok, false);
    assert.equal(first.changed_only, false);
    assert.equal(first.errors, 3);
    assert.deepEqual(first.stages, ['lint', 'tests']);
    assert.deepEqual(first.rules, { AIF001: 2, tests: 1 });
    assert.deepEqual(first.timings, failing.timings);
    assert.equal(JSON.parse(lines[1]).changed_only, true);
  });
});

test('load returns entries and counts corrupt lines instead of dropping them silently', () => {
  withRoot((root) => {
    record(root, passing, false);
    writeFileSync(join(root, '.aif', 'history.jsonl'), `${readFileSync(join(root, '.aif', 'history.jsonl'), 'utf8')}garbage\n`);
    const { runs, skipped } = load(root);
    assert.equal(runs.length, 1);
    assert.equal(skipped, 1);
  });
});

test('load on a project without history returns empty', () => {
  withRoot((root) => {
    assert.deepEqual(load(root), { runs: [], skipped: 0 });
    assert.equal(existsSync(join(root, '.aif')), false);
  });
});

test('stats explains when there is no history', () => {
  withRoot((root) => {
    const out = stats(root);
    assert.equal(out.runs, 0);
    assert.match(out.suggestion, /aif check/);
  });
});

test('stats aggregates attempts before ok, rules and timings', () => {
  withRoot((root) => {
    record(root, failing, false);
    record(root, failing, false);
    record(root, passing, false);
    record(root, passing, false);
    record(root, failing, false);
    const out = stats(root);
    assert.equal(out.runs, 5);
    assert.equal(out.passed, 2);
    assert.equal(out.failed, 3);
    assert.equal(out.pending_failures_since_last_ok, 1);
    assert.deepEqual(out.attempts_before_ok, { samples: 2, average: 1, max: 2 });
    assert.equal(out.average_seconds, 0.28);
    assert.deepEqual(out.average_seconds_per_stage, { lint: 0.18 });
    assert.deepEqual(out.top_rules[0], ['AIF001', 6]);
    assert.equal(out.skipped_lines, 0);
  });
});
