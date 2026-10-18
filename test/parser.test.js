import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSource } from '../src/parser.js';

test('parseSource extracts top-level functions in JS with JSDoc and contract wrapper', () => {
  const code = `
  /**
   * Transfers funds between accounts.
   * @param {number} balance
   * @param {number} amount
   * @returns {number}
   */
  export const transfer = contract({
    requires: ({ amount }) => amount > 0,
    ensures: (result, { balance, amount }) => result === balance - amount,
    effects: ['db.write'],
  })(function transfer(balance, amount) {
    return balance - amount;
  });

  function helper(x) {
    return x * 2;
  }
  `;

  const parsed = parseSource('domain/transfer.js', code);
  assert.equal(parsed.isTypeScript, false);
  assert.equal(parsed.functions.length, 2);

  const [fn1, fn2] = parsed.functions;
  assert.equal(fn1.name, 'transfer');
  assert.equal(fn1.isExported, true);
  assert.equal(fn1.hasContract, true);
  assert.deepEqual(fn1.contractEffects, ['db.write']);
  assert.equal(fn1.doc.includes('Transfers funds'), true);
  assert.deepEqual(fn1.params.map(p => p.name), ['balance', 'amount']);
  assert.equal(fn1.returnType, 'number');

  assert.equal(fn2.name, 'helper');
  assert.equal(fn2.isExported, false);
  assert.equal(fn2.hasContract, false);
});

test('parseSource extracts functions and types in TypeScript syntax', () => {
  const code = `
  import { contract } from 'ia-first-js';

  export async function loadAccount(id: string): Promise<Account> {
    return db.find(id);
  }
  `;

  const parsed = parseSource('ports/account.ts', code);
  assert.equal(parsed.isTypeScript, true);
  assert.equal(parsed.functions.length, 1);
  const fn = parsed.functions[0];
  assert.equal(fn.name, 'loadAccount');
  assert.equal(fn.isAsync, true);
  assert.equal(fn.isExported, true);
  assert.equal(fn.params[0].name, 'id');
  assert.equal(fn.params[0].type, 'string');
  assert.equal(fn.returnType, 'Promise<Account>');
});

test('parseSource extracts classes with inheritance, methods, static and instance attributes', () => {
  const code = `
  export class SqliteDb extends BaseDb {
    static connectionTimeout = 5000;

    constructor(path) {
      super();
      this.path = path;
      this._conn = null;
    }

    save(account) {
      this._conn.exec();
    }
  }
  `;

  const parsed = parseSource('adapters/sqlite.js', code);
  assert.equal(parsed.classes.length, 1);
  const cls = parsed.classes[0];
  assert.equal(cls.name, 'SqliteDb');
  assert.equal(cls.isExported, true);
  assert.deepEqual(cls.bases, ['BaseDb']);
  assert.deepEqual(cls.staticAttributes, ['connectionTimeout']);
  assert.deepEqual(cls.instanceAttributes.sort(), ['_conn', 'path']);
  assert.equal(cls.methods.some(m => m.name === 'save'), true);
});

test('parseSource extracts imports and exports correctly', () => {
  const code = `
  import { readFileSync, writeFileSync as write } from 'node:fs';
  import defaultExport from 'my-pkg';
  import * as path from 'node:path';

  export const a = 1;
  export default function def() {}
  `;

  const parsed = parseSource('src/io.js', code);
  assert.equal(parsed.imports.length, 3);
  assert.equal(parsed.imports[0].source, 'node:fs');
  assert.equal(parsed.imports[0].specifiers.length, 2);
  assert.equal(parsed.imports[0].specifiers[1].name, 'writeFileSync');
  assert.equal(parsed.imports[0].specifiers[1].alias, 'write');

  assert.equal(parsed.imports[1].source, 'my-pkg');
  assert.equal(parsed.imports[1].specifiers[0].isDefault, true);

  assert.equal(parsed.imports[2].source, 'node:path');
  assert.equal(parsed.imports[2].specifiers[0].isNamespace, true);
});

test('parseSource detects calls, dynamic dispatch and forbidden identifiers', () => {
  const code = `
  function run() {
    eval('foo');
    const table = { act: () => 1 };
    const method = 'act';
    table[method](); // dynamic dispatch
    Date.now();
    globalThis.leak = true;
  }
  `;

  const parsed = parseSource('domain/dirty.js', code);
  const calledNames = parsed.calls.map(c => c.callee);
  assert.equal(calledNames.includes('eval'), true);
  assert.equal(calledNames.includes('Date.now'), true);
  assert.equal(parsed.hasDynamicCalls, true);
  assert.equal(parsed.globals.some(g => g.name === 'globalThis'), true);
});

test('parseSource detects catch clauses: bare or empty catch', () => {
  const code = `
  try {
    dangerous();
  } catch {}

  try {
    safe();
  } catch (err) {
    logger.error(err);
    throw err;
  }
  `;

  const parsed = parseSource('src/resilient.js', code);
  assert.equal(parsed.catches.length, 2);
  assert.equal(parsed.catches[0].isBare, true);
  assert.equal(parsed.catches[0].isEmpty, true);
  assert.equal(parsed.catches[1].isBare, false);
  assert.equal(parsed.catches[1].isEmpty, false);
});
