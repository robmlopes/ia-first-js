import type { StructuredError } from './config.js';

export function checkLinks(root: string): StructuredError[];
export function checkCliDocs(root: string, commands: string[]): StructuredError[];
export function runDocsCheck(root: string, commands?: string[]): StructuredError[];
