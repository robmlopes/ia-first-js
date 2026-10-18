import type { Config } from './config.js';

export function resolveProjectImport(importerRelPath: string, importSource: string): string | null;

export class Model {
  constructor(root: string, cfg: Config);
  root: string;
  cfg: Config;
  modules: Map<string, any>;
  parsedFiles: Map<string, any>;
  lookup(moduleKey: string, name: string, depth?: number): { kind: 'class' | 'function'; info: any } | null;
  resolveClass(moduleKey: string, name: string): any | null;
  classHierarchy(cls: any): any[];
  members(cls: any, isInstance?: boolean): Set<string>;
  importGraph(): Map<string, string[]>;
}
