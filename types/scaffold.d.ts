export const TEMPLATES: Record<string, Record<string, string>>;

export function initProject(
  root: string,
  options?: { template?: 'jsdoc' | 'ts' },
): { ok: boolean; files: string[] };
