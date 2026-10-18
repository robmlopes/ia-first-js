import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Find a TypeScript compiler: AIF_TSC, local node_modules, or PATH. */
function findTsc() {
  const candidates = [process.env.AIF_TSC, join(ROOT, 'node_modules', '.bin', 'tsc')];
  for (const dir of (process.env.PATH ?? '').split(delimiter)) candidates.push(join(dir, 'tsc'));
  return candidates.find((path) => path && existsSync(path));
}

const tsc = findTsc();
const skip = tsc ? false : 'TypeScript compiler not found: set AIF_TSC=/path/to/tsc or install typescript';

function compile(project) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(tsc, ['-p', join(ROOT, 'typecheck', project)], { cwd: ROOT, encoding: 'utf8', env, timeout: 50000 });
}

test('a TypeScript consumer type-checks against the shipped .d.ts', { skip }, () => {
  const run = compile('tsconfig.json');
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('the types reject misuse', { skip }, () => {
  const run = compile('tsconfig.negative.json');
  assert.notEqual(run.status, 0);
  assert.match(run.stdout, /TS2322/);
  assert.match(run.stdout, /TS2345/);
});
