#!/usr/bin/env node
import { main } from '../src/cli.js';

const io = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

try {
  process.exitCode = await main(process.argv.slice(2), io);
} catch (error) {
  io.stderr(`${JSON.stringify({ ok: false, stage: 'cli', cause: error?.message ?? String(error), suggestion: 'report the framework bug' })}\n`);
  process.exitCode = 2;
}
