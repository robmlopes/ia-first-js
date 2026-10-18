/**
 * Project configuration, read from `aif.config.json` at the project root.
 * Unknown keys are ignored; invalid files raise a structured `ConfigError` (stage `config`, no `rule`: it is not a lint rule).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CONFIG_FILE = 'aif.config.json';

/**
 * @typedef {object} Config
 * @property {string[]} sourceDirs Directories checked by the framework.
 * @property {string[]} pureDirs Pure logic: no I/O, contracts required.
 * @property {string[]} portDirs Interfaces only.
 * @property {string[]} adapterDirs Implementations of ports.
 * @property {string[]} entryDirs Web/CLI layers; appended to `sourceDirs`.
 * @property {string[]} compositionRoots Modules allowed to import adapters from `entryDirs`.
 * @property {number} maxFileLines
 * @property {number} maxFunctionLines
 * @property {Record<string, Record<string, number>>} limits Per-layer overrides, e.g. `{ web: { maxFunctionLines: 60 } }`.
 * @property {boolean} countCodeLines Size limits ignore blank lines and comments.
 * @property {number} limitWarnRatio Warn when a file or function reaches this share of its limit.
 * @property {boolean} parallel Run independent heavy stages concurrently.
 * @property {boolean} docsCheck Verify that docs agree with the framework.
 * @property {boolean} history Append every check to `.aif/history.jsonl`.
 * @property {boolean} intents
 * @property {boolean} style
 * @property {boolean} typecheck
 * @property {boolean} typecheckTests
 * @property {boolean} fuzz
 * @property {number} fuzzExamples
 * @property {string} fuzzSetup Module registering input generators.
 * @property {string[]} forbiddenImports
 * @property {string[]} forbiddenCalls
 * @property {string[]} forbiddenClock
 * @property {string[]} thirdParty Packages that source dirs may import.
 * @property {boolean} checkThirdParty
 * @property {Record<string, string[]>} capabilities Capability (parameter type) to effects it grants.
 * @property {(path: string, key: string) => number} limit
 * @property {(path: string) => string} layer
 */

/** Configuration problem, shaped like every other framework error. */
export class ConfigError extends Error {
  /**
   * @param {string} file
   * @param {string} cause
   * @param {string} suggestion
   */
  constructor(file, cause, suggestion) {
    super(`${file}: ${cause}`);
    this.name = 'ConfigError';
    this.stage = 'config';
    this.file = file;
    this.cause = cause;
    this.suggestion = suggestion;
  }

  toJSON() {
    return { stage: this.stage, file: this.file, line: 1, cause: this.cause, suggestion: this.suggestion };
  }
}

const DEFAULTS = Object.freeze({
  sourceDirs: ['domain'],
  pureDirs: ['domain'],
  portDirs: ['ports'],
  adapterDirs: ['adapters'],
  entryDirs: [],
  compositionRoots: [],
  maxFileLines: 200,
  maxFunctionLines: 40,
  limits: {},
  countCodeLines: true,
  limitWarnRatio: 0.9,
  parallel: true,
  docsCheck: false,
  history: true,
  intents: true,
  style: true,
  typecheck: true,
  typecheckTests: true,
  fuzz: true,
  fuzzExamples: 100,
  fuzzSetup: '',
  forbiddenImports: [],
  forbiddenCalls: ['eval', 'Function', 'require', 'importScripts', 'setTimeout', 'setInterval'],
  forbiddenClock: ['Date.now', 'performance.now', 'process.hrtime', 'Math.random'],
  thirdParty: [],
  checkThirdParty: true,
  capabilities: {},
});

/** Fresh default configuration (never shared between callers). */
export function defaults() {
  return finalize(structuredClone(DEFAULTS));
}

function finalize(values) {
  const extra = values.entryDirs.filter((dir) => !values.sourceDirs.includes(dir));
  values.sourceDirs = [...values.sourceDirs, ...extra];
  Object.defineProperties(values, {
    layer: {
      value: (path) => path.replaceAll('\\', '/').replaceAll('.', '/').split('/').find(Boolean) ?? '',
    },
    limit: {
      value(path, key) {
        const override = values.limits[values.layer(path)]?.[key];
        return typeof override === 'number' ? override : values[key];
      },
    },
  });
  return values;
}

function kindOf(value) {
  if (Array.isArray(value)) return 'array';
  return value === null ? 'null' : typeof value;
}

function validate(key, value) {
  const expected = kindOf(DEFAULTS[key]);
  const actual = kindOf(value);
  if (expected !== actual) {
    throw new ConfigError(CONFIG_FILE, `"${key}" must be ${expected}, got ${actual}`, `fix "${key}" in ${CONFIG_FILE}`);
  }
  if (expected === 'array' && !value.every((item) => typeof item === 'string')) {
    throw new ConfigError(CONFIG_FILE, `"${key}" must contain only strings`, `fix "${key}" in ${CONFIG_FILE}`);
  }
}

/**
 * Load the configuration for the project at `root`.
 * @param {string} root
 * @returns {Config}
 * @throws {ConfigError} when the file is unreadable JSON or has wrong value types.
 */
export function loadConfig(root) {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) return defaults();

  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ConfigError(CONFIG_FILE, `file is not valid JSON: ${error.message}`, `fix the syntax of ${CONFIG_FILE}`);
  }
  if (kindOf(data) !== 'object') {
    throw new ConfigError(CONFIG_FILE, 'root must be a JSON object', `wrap the settings of ${CONFIG_FILE} in { }`);
  }

  const values = structuredClone(DEFAULTS);
  for (const [key, value] of Object.entries(data)) {
    if (!(key in DEFAULTS)) continue;
    validate(key, value);
    values[key] = value;
  }
  return finalize(values);
}
