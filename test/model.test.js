import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Model } from '../src/model.js';
import { loadConfig } from '../src/config.js';

async function withProject(files, run) {
  const root = mkdtempSync(join(tmpdir(), 'aif-model-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(root, name, '..'), { recursive: true });
      writeFileSync(join(root, name), content);
    }
    return await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('Model builds in-memory representation of project modules', async () => {
  const files = {
    'aif.config.json': JSON.stringify({ sourceDirs: ['domain', 'adapters'] }),
    'domain/account.js': `
      export class Account {
        constructor(id, balance) {
          this.id = id;
          this.balance = balance;
        }
        deposit(amount) {
          this.balance += amount;
        }
      }
      export function createAccount(id) {
        return new Account(id, 0);
      }
    `,
    'domain/transfer.js': `
      import { Account } from './account.js';

      export function transfer(from, to, amount) {
        from.balance -= amount;
        to.deposit(amount);
      }
    `,
    'adapters/sqlite.js': `
      import { Account } from '../domain/account.js';

      export class BaseDb {
        close() {}
      }

      export class SqliteDb extends BaseDb {
        static timeout = 5000;
        constructor(path) {
          super();
          this.path = path;
        }
        save(account) {}
      }
    `,
  };

  await withProject(files, (root) => {
    const cfg = loadConfig(root);
    const model = new Model(root, cfg);

    // 1. Module listing
    assert.ok(model.modules.has('domain.account'));
    assert.ok(model.modules.has('domain.transfer'));
    assert.ok(model.modules.has('adapters.sqlite'));

    // 2. Class inspection & instance members
    const accountCls = model.resolveClass('domain.account', 'Account');
    assert.ok(accountCls);
    assert.equal(accountCls.name, 'Account');
    const members = model.members(accountCls, true);
    assert.ok(members.has('id'));
    assert.ok(members.has('balance'));
    assert.ok(members.has('deposit'));

    // 3. Inheritance inspection
    const sqliteCls = model.resolveClass('adapters.sqlite', 'SqliteDb');
    assert.ok(sqliteCls);
    const sqliteMembers = model.members(sqliteCls, true);
    assert.ok(sqliteMembers.has('save'));
    assert.ok(sqliteMembers.has('timeout'));
    assert.ok(sqliteMembers.has('path'));
    assert.ok(sqliteMembers.has('close')); // inherited from BaseDb

    // 4. Cross-module lookup via imports
    const importedAccount = model.lookup('domain.transfer', 'Account');
    assert.ok(importedAccount);
    assert.equal(importedAccount.kind, 'class');
    assert.equal(importedAccount.info.name, 'Account');

    // 5. Dependency / Import Graph
    const graph = model.importGraph();
    assert.ok(graph.has('domain.transfer'));
    assert.ok(graph.get('domain.transfer').includes('domain.account'));
    assert.ok(graph.get('adapters.sqlite').includes('domain.account'));
  });
});
