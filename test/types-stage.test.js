import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTypeCheck, parseTscOutput } from '../src/types.js';
import { loadConfig } from '../src/config.js';

test('parseTscOutput parses compiler diagnostics into structured AIF errors', () => {
  const output = `
domain/calc.ts:5:7 - error TS2322: Type 'string' is not assignable to type 'number'.
ports/db.ts:12:3 - error TS2304: Cannot find name 'Account'.
  `;

  const errors = parseTscOutput(output, '/fake/root');
  assert.equal(errors.length, 2);

  assert.equal(errors[0].stage, 'types');
  assert.equal(errors[0].rule, 'TS2322');
  assert.equal(errors[0].file, 'domain/calc.ts');
  assert.equal(errors[0].line, 5);
  assert.match(errors[0].cause, /not assignable to type 'number'/);
  assert.ok(errors[0].suggestion);

  assert.equal(errors[1].rule, 'TS2304');
  assert.equal(errors[1].file, 'ports/db.ts');
  assert.equal(errors[1].line, 12);
});

test('runTypeCheck runs tsc over project and returns structured errors', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aif-types-'));
  try {
    mkdirSync(join(root, 'domain'), { recursive: true });
    writeFileSync(
      join(root, 'aif.config.json'),
      JSON.stringify({ sourceDirs: ['domain'] }),
    );
    // TypeScript code with an intentional type error:
    writeFileSync(
      join(root, 'domain', 'calc.ts'),
      'export const n: number = "hello";\n',
    );
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { noEmit: true, strict: true, target: 'ES2022', module: 'NodeNext' },
        include: ['domain/**/*.ts'],
      }),
    );

    const cfg = loadConfig(root);
    const errors = await runTypeCheck(root, cfg);

    assert.ok(errors.length >= 1);
    const ts2322 = errors.find((e) => e.rule === 'TS2322');
    assert.ok(ts2322);
    assert.equal(ts2322.stage, 'types');
    assert.match(ts2322.cause, /not assignable/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
