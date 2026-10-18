/**
 * Type-check stage: runs tsc --noEmit over sourceDirs and returns structured errors.
 */

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSourceFiles } from './indexer.js';

const TYPE_HINTS = {
  TS2322: 'type is not assignable to target: check declared return or property type',
  TS2345: 'argument type does not match parameter: check function signature or port interface',
  TS2304: 'name is not defined or not imported: check import paths and declarations',
  TS2307: 'cannot find module: check .aif/index.json or package.json dependencies',
  TS2339: 'property does not exist on type: check type definition or interface',
  TS2554: 'expected different number of arguments: check function signature',
  TS7006: 'parameter implicitly has an any type: annotate parameter or add JSDoc @param',
};

/**
 * Parse tsc diagnostic output text into structured AIF errors.
 * @param {string} output
 * @param {string} root
 * @returns {Array<Record<string, any>>}
 */
export function parseTscOutput(output, root) {
  const errors = [];
  const lines = output.split('\n');

  for (const rawLine of lines) {
    // Matches both "file.ts:1:2 - error TS2322: msg" and "file.ts(1,2): error TS2322: msg"
    let match = rawLine.match(/^([^:\n\r]+):(\d+):(\d+)\s*-\s*error\s*(TS\d+):\s*(.+)$/);
    if (!match) {
      match = rawLine.match(/^([^(:\n\r]+)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)$/);
    }
    if (!match) continue;

    const [, filePath, lineStr, , code, msg] = match;
    const relFile = filePath.startsWith(root)
      ? filePath.slice(root.length).replace(/^[/\\]/, '').replace(/\\/g, '/')
      : filePath.replace(/\\/g, '/');

    const suggestion = TYPE_HINTS[code] || 'resolve TypeScript compiler diagnostic';

    errors.push({
      stage: 'types',
      rule: code,
      file: relFile,
      line: parseInt(lineStr, 10),
      cause: msg.trim(),
      suggestion,
    });
  }

  return errors;
}

/**
 * Run TypeScript compiler type-check stage.
 * @param {string} root
 * @param {import('./config.js').Config} cfg
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function runTypeCheck(root, cfg) {
  const files = findSourceFiles(root, cfg);
  const tsFiles = files.filter((f) => f.endsWith('.ts') || f.endsWith('.mts') || f.endsWith('.cts'));

  // If there are no TypeScript files, skip tsc unless tsconfig exists
  const hasTsConfig = existsSync(join(root, 'tsconfig.json'));
  if (tsFiles.length === 0 && !hasTsConfig) {
    return [];
  }

  // Create temporary tsconfig if needed
  let createdTsConfig = false;
  const tsConfigPath = join(root, 'tsconfig.json');
  if (!hasTsConfig) {
    writeFileSync(
      tsConfigPath,
      JSON.stringify({
        compilerOptions: {
          noEmit: true,
          strict: true,
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
        },
        include: cfg.sourceDirs.map((d) => `${d}/**/*`),
      }),
      'utf8',
    );
    createdTsConfig = true;
  }

  return new Promise((resolve) => {
    // Resolve tsc: project's local node_modules, framework's node_modules, or global tsc
    const localTsc = join(root, 'node_modules', '.bin', 'tsc');
    const frameworkTsc = join(new URL('..', import.meta.url).pathname, 'node_modules', '.bin', 'tsc');
    const tscBin = existsSync(localTsc) ? localTsc : existsSync(frameworkTsc) ? frameworkTsc : 'tsc';

    const child = spawn('node', [tscBin, '--noEmit', '--pretty', 'false'], {
      cwd: root,
      env: { ...process.env, npm_config_local_prefix: undefined, npm_package_json: undefined },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (exitCode) => {
      if (createdTsConfig) {
        try {
          // cleanup
          import('node:fs').then((fs) => fs.rmSync(tsConfigPath, { force: true }));
        } catch {}
      }

      if (exitCode === 0) {
        resolve([]);
        return;
      }

      const errors = parseTscOutput(stdout, root);
      if (errors.length === 0 && exitCode !== 0) {
        // tsc failed to start or error outside diagnostics
        resolve([
          {
            stage: 'types',
            rule: 'tsc',
            file: '',
            line: 0,
            cause: (stderr || stdout || 'tsc exited with error').trim().split('\n')[0],
            suggestion: 'install typescript or check tsconfig.json',
          },
        ]);
        return;
      }

      resolve(errors);
    });

    child.on('error', (err) => {
      if (createdTsConfig) {
        try {
          import('node:fs').then((fs) => fs.rmSync(tsConfigPath, { force: true }));
        } catch {}
      }
      resolve([
        {
          stage: 'types',
          rule: 'tsc',
          file: '',
          line: 0,
          cause: `tsc did not run: ${err.message}`,
          suggestion: 'install typescript',
        },
      ]);
    });
  });
}
