/**
 * Public entry point of `ia-first-js`.
 * Importing the package gives programmatic access to contracts, configuration, the pipeline and the CLI.
 */

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const name = pkg.name;
export const version = pkg.version;

export * from './contract.js';
export * from './config.js';
export * from './history.js';
export * from './indexer.js';
export * from './limits.js';
export * from './model.js';
export * from './lint.js';
export * from './effects.js';
export {
  runStages,
  testsStage,
  indexStage,
  lintStage,
  effectsStage,
  changedFiles,
  defaultStages,
  check,
} from './pipeline.js';
export { main, COMMANDS } from './cli.js';
