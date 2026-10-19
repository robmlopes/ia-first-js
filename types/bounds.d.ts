export type Bound = [number | null, number | null];
export interface RelationConstraint {
  less: string;
  greater: string;
  strict: boolean;
}

export function inferBounds(
  requiresFn: ((...args: any[]) => boolean) | null | undefined,
): Record<string, Bound> & { __relations__?: RelationConstraint[] };
