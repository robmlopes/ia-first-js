import { test } from 'node:test';
import assert from 'node:assert/strict';
import { name, version } from '../src/index.js';

test('exports package name', () => {
  assert.equal(name, 'ia-first-js');
});

test('exports semver version', () => {
  assert.match(version, /^\d+\.\d+\.\d+/);
});
