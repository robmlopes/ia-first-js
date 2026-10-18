export type Bound = [number | null, number | null];

export function inferBounds(
  requiresFn: ((...args: any[]) => boolean) | null | undefined,
): Record<string, Bound>;
