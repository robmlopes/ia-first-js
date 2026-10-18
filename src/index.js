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
export { runStages, testsStage, changedFiles, defaultStages, check } from './pipeline.js';
export { main, COMMANDS } from './cli.js';
