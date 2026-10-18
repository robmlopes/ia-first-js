import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFileLimits, countCodeLines, getWarnings } from '../src/limits.js';
import { defaults } from '../src/config.js';
import { parseSource } from '../src/parser.js';

test('countCodeLines skips blank lines, single line comments and block comments', () => {
  const code = `
  // this is a comment
  /* multi
     line
     comment */
  /**
   * JSDoc comment
   */

  function hello() {
    return 'world';
  }
  `;

  const totalLines = code.trim().split('\n').length;
  const effectiveLines = countCodeLines(code);
  assert.ok(effectiveLines < totalLines);
  assert.equal(effectiveLines, 3); // function hello() {, return 'world';, }
});

test('checkFileLimits emits error when function exceeds maxFunctionLines', () => {
  const lines = ['function bigFunction() {'];
  for (let i = 0; i < 45; i++) {
    lines.push(`  const x${i} = ${i};`);
  }
  lines.push('}');
  const code = lines.join('\n');

  const cfg = defaults();
  cfg.maxFunctionLines = 40;
  const parsed = parseSource('domain/big.js', code);

  const [errors, warnings] = checkFileLimits(parsed, code, 'domain/big.js', cfg);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].rule, 'AIF005');
  assert.equal(errors[0].stage, 'lint');
  assert.match(errors[0].cause, /bigFunction has 47 code lines \(max 40\)/);
  assert.ok(errors[0].suggestion);
  assert.equal(warnings.length, 0);
});

test('checkFileLimits emits warning when function reaches limitWarnRatio (90%)', () => {
  const lines = ['function mediumFunction() {'];
  for (let i = 0; i < 36; i++) {
    lines.push(`  const x${i} = ${i};`);
  }
  lines.push('}');
  const code = lines.join('\n');

  const cfg = defaults();
  cfg.maxFunctionLines = 40;
  cfg.limitWarnRatio = 0.9; // 90% of 40 = 36 lines
  const parsed = parseSource('domain/med.js', code);

  const [errors, warnings] = checkFileLimits(parsed, code, 'domain/med.js', cfg);
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].rule, 'AIF005');
  assert.match(warnings[0].cause, /mediumFunction has 38 code lines \(max 40\)/);
});

test('checkFileLimits respects layer limit overrides', () => {
  const lines = ['function webHandler() {'];
  for (let i = 0; i < 50; i++) {
    lines.push(`  const a${i} = ${i};`);
  }
  lines.push('}');
  const code = lines.join('\n');

  const cfg = defaults();
  cfg.limits = { web: { maxFunctionLines: 60 } };
  const parsed = parseSource('web/handler.js', code);

  const [errors] = checkFileLimits(parsed, code, 'web/handler.js', cfg);
  assert.equal(errors.length, 0); // 52 lines is < 60 override
});

test('checkFileLimits emits error when file exceeds maxFileLines', () => {
  const lines = [];
  for (let i = 0; i < 210; i++) {
    lines.push(`export const v${i} = ${i};`);
  }
  const code = lines.join('\n');

  const cfg = defaults();
  cfg.maxFileLines = 200;
  const parsed = parseSource('domain/many.js', code);

  const [errors] = checkFileLimits(parsed, code, 'domain/many.js', cfg);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].rule, 'AIF005');
  assert.match(errors[0].cause, /file has 210 code lines \(max 200\)/);
});
