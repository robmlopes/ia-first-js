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
export * from './style.js';
export * from './types.js';
export * from './bounds.js';
export * from './cache.js';
export * from './fuzzreport.js';
export * from './fuzz.js';
export * from './patch.js';
export * from './intents.js';
export * from './agents.js';
export * from './scaffold.js';
export * from './docscheck.js';
export * from './upgrade.js';
export {
  runStages,
  testsStage,
  indexStage,
  styleStage,
  lintStage,
  effectsStage,
  typesStage,
  fuzzStage,
  changedFiles,
  defaultStages,
  check,
} from './pipeline.js';
export { main, COMMANDS } from './cli.js';
