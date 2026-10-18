import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFuzzReport, findSkippedFunctions } from '../src/fuzzreport.js';
import { loadConfig } from '../src/config.js';

async function withFixture(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-fuzzreport-'));
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

test('findSkippedFunctions lists functions not covered by fuzzing with reasons', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/calc.js': `
      // 1. Without contract
      export function uncontracted(x) { return x; }

      // 2. Private helper without contract (should be ignored, not reported)
      function _helper(x) { return x; }

      // 3. Contract with effects
      export const withEffects = contract({
        effects: ['db.write'],
      })(function withEffects(db) {});

      // 4. Contract without ensures
      export const withoutEnsures = contract({
        requires: (x) => x > 0,
      })(function withoutEnsures(x) { return x; });
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const skips = findSkippedFunctions(root, cfg, new Set());

    assert.equal(skips.length, 3);
    assert.ok(skips.some((s) => s.function === 'uncontracted' && s.reason.includes('no @contract')));
    assert.ok(skips.some((s) => s.function === 'withEffects' && s.reason.includes('declares effects')));
    assert.ok(skips.some((s) => s.function === 'withoutEnsures' && s.reason.includes('no `ensures`')));
    assert.equal(skips.some((s) => s.function === '_helper'), false);
  });
});

test('buildFuzzReport produces comprehensive summary with snake_case keys', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain'] }),
    'domain/calc.js': `
      export function f(x) { return x; }
    `,
  };

  await withFixture(files, (root) => {
    const cfg = loadConfig(root);
    const tested = [
      { module: 'domain.calc', function: 'pureAdd', status: 'passed', examples: 100 },
    ];
    const report = buildFuzzReport(root, cfg, [], tested);

    assert.equal(report.ok, true);
    assert.deepEqual(report.errors, []);
    assert.equal(report.summary.functions_fuzzed, 1);
    assert.equal(report.summary.examples_run, 100);
    assert.equal(report.summary.failed, 0);
    assert.ok(report.summary.skipped >= 1);
    assert.ok(report.summary.skipped_by_reason);
  });
});
