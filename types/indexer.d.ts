import type { Config } from './config.js';

export function moduleKeyOf(relPath: string): string;
export function findSourceFiles(root: string, cfg: Config): string[];
export function generateIndex(root: string, cfg: Config): Record<string, any>;
export function saveIndex(root: string, cfg: Config): Record<string, any>;
