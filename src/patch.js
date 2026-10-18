/**
 * Granular code patcher: replaces one function, class or method instead of rewriting entire files.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { parseSource } from './parser.js';

function fail(cause, suggestion = '') {
  return { ok: false, stage: 'patch', cause, suggestion };
}

/**
 * Validate that newSource parses cleanly and contains a single definition.
 * @param {string} source
 * @returns {string | null} error message or null if valid
 */
function validateNewSource(source) {
  const sf = ts.createSourceFile('temp.js', source, ts.ScriptTarget.Latest, true);
  // Check diagnostics for syntax errors
  const diagnostics = sf.parseDiagnostics;
  if (diagnostics && diagnostics.length > 0) {
    return `new source has a syntax error: ${diagnostics[0].messageText}`;
  }
  return null;
}

/**
 * Find line span (1-based [start, end]) of symbol in parsed source file.
 * @param {string} filePath
 * @param {string} code
 * @param {string} symbol
 * @returns {[number, number] | null}
 */
function findSymbolSpan(filePath, code, symbol) {
  const sf = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  const [owner, member] = symbol.split('.');

  let targetNode = null;

  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.name.text === owner) {
      if (!member) {
        targetNode = node;
        return;
      }
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.name && decl.name.getText(sf) === owner) {
          if (!member) {
            targetNode = node;
            return;
          }
        }
      }
    } else if (ts.isClassDeclaration(node) && node.name && node.name.text === owner) {
      if (!member) {
        targetNode = node;
        return;
      }
      for (const m of node.members) {
        if (m.name && m.name.getText(sf) === member) {
          targetNode = m;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);

  if (!targetNode) return null;

  const startLine = sf.getLineAndCharacterOfPosition(targetNode.getFullStart()).line + 1;
  const endLine = sf.getLineAndCharacterOfPosition(targetNode.getEnd()).line + 1;
  return [startLine, endLine];
}

/**
 * Replace a symbol's implementation in a file.
 * @param {string} filePath
 * @param {string} symbol
 * @param {string} newSource
 * @returns {{ ok: boolean, stage?: string, cause?: string, suggestion?: string, diff?: string }}
 */
export function applyPatch(filePath, symbol, newSource) {
  if (!existsSync(filePath)) {
    return fail(`file not found: ${filePath}`, 'check target file path');
  }

  const err = validateNewSource(newSource);
  if (err) {
    return fail(err, 'fix the syntax of the new source code');
  }

  const code = readFileSync(filePath, 'utf8');
  const span = findSymbolSpan(filePath, code, symbol);

  if (!span) {
    return fail(`symbol '${symbol}' not found in ${filePath}`, 'check symbol name');
  }

  const lines = code.split('\n');
  const [startLine, endLine] = span;

  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);

  const newLines = newSource.trimEnd().split('\n');
  const combined = [...before, ...newLines, ...after].join('\n');

  writeFileSync(filePath, combined, 'utf8');

  return {
    ok: true,
    diff: `--- ${filePath}\n+++ ${filePath}\n@@ -${startLine},${endLine - startLine + 1} +${startLine},${newLines.length} @@\n`,
  };
}
