import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFuzz, fuzzFunction } from '../src/fuzz.js';
import { contract } from '../src/contract.js';
import { loadConfig } from '../src/config.js';

test('fuzzFunction detects CON001 when ensures returns false on valid inputs', () => {
  const buggyDiscount = contract({
    requires: ({ price, percent }) => price >= 0 && percent >= 0 && percent <= 100,
    ensures: (result, { price, percent }) => result <= price, // Buggy implementation will violate this
  })(function buggyDiscount(price, percent) {
    return price + percent; // Returns more than price!
  });

  const [err] = fuzzFunction('domain.calc', buggyDiscount, { examples: 20 });
  assert.ok(err);
  assert.equal(err.stage, 'fuzz');
  assert.equal(err.rule, 'CON001');
  assert.match(err.cause, /postcondition.*failed/);
  assert.ok(err.counterexample);
  assert.ok(err.counterexample.inputs);
});

test('fuzzFunction detects CON002 when function throws for valid inputs', () => {
  const throwingFn = contract({
    requires: ({ n }) => n >= 0,
    ensures: (result) => result >= 0,
  })(function throwingFn(n) {
    if (n > 5) throw new Error('boom');
    return n;
  });

  const [err] = fuzzFunction('domain.calc', throwingFn, { examples: 30 });
  assert.ok(err);
  assert.equal(err.stage, 'fuzz');
  assert.equal(err.rule, 'CON002');
  assert.match(err.cause, /raised Error: boom/);
  assert.ok(err.counterexample);
});

test('fuzzFunction detects CON004 when requires rejects all inputs (contradictory)', () => {
  const contradictory = contract({
    requires: ({ x }) => x > 100 && x < 50, // Impossible!
    ensures: (result) => result === 1,
  })(function contradictory(x) {
    return 1;
  });

  const [err] = fuzzFunction('domain.calc', contradictory, { examples: 20 });
  assert.ok(err);
  assert.equal(err.stage, 'fuzz');
  assert.equal(err.rule, 'CON004');
  assert.match(err.cause, /rejected/);
});

test('fuzzFunction passes cleanly on correct contract and implementation', () => {
  const correct = contract({
    requires: ({ a, b }) => a >= 0 && b >= 0,
    ensures: (result, { a, b }) => result >= a && result >= b,
  })(function correct(a, b) {
    return a + b;
  });

  const errors = fuzzFunction('domain.calc', correct, { examples: 20 });
  assert.deepEqual(errors, []);
});

test('fuzzFunction fuzzes relational constraints without false positive CON004', () => {
  const rangeOverlap = contract({
    requires: ({ start, end }) => typeof start === 'number' && typeof end === 'number' && start < end,
    ensures: (res) => typeof res === 'boolean',
  })(function rangeOverlap(start, end) {
    return end - start > 0;
  });

  const errors = fuzzFunction('domain.calc', rangeOverlap, { examples: 20 });
  assert.deepEqual(errors, []);
});

test('runFuzz executes over project modules with cache', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aif-fuzz-test-'));
  try {
    mkdirSync(join(root, 'domain'), { recursive: true });
    writeFileSync(
      join(root, 'aif.config.json'),
      JSON.stringify({ sourceDirs: ['domain'], fuzzExamples: 10 }),
    );
    writeFileSync(
      join(root, 'domain', 'calc.js'),
      `
      import { contract } from '${join(process.cwd(), 'src', 'contract.js')}';
      export const add = contract({
        requires: ({ a, b }) => a >= 0 && b >= 0,
        ensures: (result, { a, b }) => result === a + b,
      })(function add(a, b) { return a + b; });
      `,
    );

    const cfg = loadConfig(root);
    const { errors, tested } = await runFuzz(root, cfg, true);
    assert.deepEqual(errors, []);
    assert.equal(tested.length, 1);
    assert.equal(tested[0].function, 'add');
    assert.equal(tested[0].status, 'passed');

    // Second run should use cache
    const second = await runFuzz(root, cfg, true);
    assert.deepEqual(second.errors, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
