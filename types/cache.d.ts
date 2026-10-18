import type { Config } from './config.js';

export function loadCache(root: string): Record<string, string>;
export function saveCache(root: string, passed: Record<string, string>): void;
export function computeModuleKeys(root: string, cfg: Config): Record<string, string>;
