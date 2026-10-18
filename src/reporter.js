/**
 * Custom `node --test` reporter: emits one JSON line per failed test.
 * Used by the `tests` pipeline stage via `--test-reporter`.
 */

/** @param {AsyncIterable<{ type: string, data: any }>} source */
export default async function* reporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:fail') continue;
    const { name, file, details } = event.data;
    const error = details?.error;
    if (error?.failureType === 'subtestsFailed') continue;
    const original = error?.cause ?? error;
    yield `${JSON.stringify({
      name,
      file: file ?? null,
      message: String(original?.message ?? error?.message ?? 'failure'),
    })}\n`;
  }
}
