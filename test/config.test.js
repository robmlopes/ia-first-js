import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, defaults, ConfigError, CONFIG_FILE } from '../src/config.js';

function withProject(content, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-config-'));
  try {
    if (content !== undefined) writeFileSync(join(root, CONFIG_FILE), content);
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('returns defaults when no config file exists', () => {
  withProject(undefined, (root) => {
    assert.deepEqual(loadConfig(root), defaults());
  });
});

test('defaults mirror the framework conventions', () => {
  const config = defaults();
  assert.deepEqual(config.sourceDirs, ['domain']);
  assert.deepEqual(config.pureDirs, ['domain']);
  assert.equal(config.maxFileLines, 200);
  assert.equal(config.maxFunctionLines, 40);
  assert.equal(config.limitWarnRatio, 0.9);
  assert.equal(config.fuzzExamples, 100);
  assert.ok(config.forbiddenCalls.includes('eval'));
});

test('a partial file overrides only the given keys', () => {
  withProject('{ "maxFileLines": 120, "fuzz": false }', (root) => {
    const config = loadConfig(root);
    assert.equal(config.maxFileLines, 120);
    assert.equal(config.fuzz, false);
    assert.equal(config.maxFunctionLines, 40);
  });
});

test('unknown keys are ignored', () => {
  withProject('{ "bogus": 1, "style": false }', (root) => {
    const config = loadConfig(root);
    assert.equal(config.style, false);
    assert.equal('bogus' in config, false);
  });
});

test('entryDirs are appended to sourceDirs without duplicates', () => {
  withProject('{ "sourceDirs": ["domain", "web"], "entryDirs": ["web", "cli"] }', (root) => {
    assert.deepEqual(loadConfig(root).sourceDirs, ['domain', 'web', 'cli']);
  });
});

test('invalid JSON raises a structured ConfigError (never swallowed)', () => {
  withProject('{ nope', (root) => {
    assert.throws(
      () => loadConfig(root),
      (error) => {
        assert.ok(error instanceof ConfigError);
        assert.equal(error.stage, 'config');
        assert.equal('rule' in error.toJSON(), false);
        assert.equal(error.file, CONFIG_FILE);
        assert.match(error.cause, /not valid JSON/);
        assert.ok(error.suggestion);
        return true;
      },
    );
  });
});

test('a non-object root raises a config error', () => {
  withProject('[1, 2]', (root) => {
    assert.throws(() => loadConfig(root), (error) => error instanceof ConfigError && /JSON object/.test(error.cause));
  });
});

test('a value of the wrong type raises a config error naming the key', () => {
  withProject('{ "maxFileLines": "many" }', (root) => {
    assert.throws(
      () => loadConfig(root),
      (error) => {
        assert.equal(error.stage, 'config');
        assert.match(error.cause, /maxFileLines/);
        return true;
      },
    );
  });
});

test('arrays must contain strings', () => {
  withProject('{ "pureDirs": [1] }', (root) => {
    assert.throws(() => loadConfig(root), (error) => error instanceof ConfigError && /only strings/.test(error.cause));
  });
});

test('limit(path, key) prefers the layer override', () => {
  withProject('{ "limits": { "web": { "maxFunctionLines": 60 } } }', (root) => {
    const config = loadConfig(root);
    assert.equal(config.limit('web/routes.js', 'maxFunctionLines'), 60);
    assert.equal(config.limit('domain/x.js', 'maxFunctionLines'), 40);
    assert.equal(config.limit('web/routes.js', 'maxFileLines'), 200);
  });
});

test('layer(path) is the first path segment', () => {
  const config = defaults();
  assert.equal(config.layer('web/routes/user.js'), 'web');
  assert.equal(config.layer('web\\routes\\user.js'), 'web');
});

test('ConfigError serializes to the structured error shape', () => {
  const error = new ConfigError('x.json', 'bad', 'fix it');
  assert.deepEqual(error.toJSON(), { stage: 'config', file: 'x.json', line: 1, cause: 'bad', suggestion: 'fix it' });
});
