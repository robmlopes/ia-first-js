export const COMMANDS: string[];
export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
}
/** Run the CLI; resolves to the exit code. */
export function main(argv: string[], io: Io): Promise<number>;
