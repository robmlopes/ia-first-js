export function applyPatch(
  filePath: string,
  symbol: string,
  newSource: string,
): {
  ok: boolean;
  stage?: string;
  cause?: string;
  suggestion?: string;
  diff?: string;
};
