import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contract, ContractViolation, parseParams } from '../src/contract.js';

const transfer = contract({
  requires: ({ amount, balance }) => amount > 0 && balance >= amount,
  ensures: (result, { balance, amount }) => result === balance - amount,
  effects: [],
})(function transfer(balance, amount) {
  return balance - amount;
});

test('passes through when contract holds', () => {
  assert.equal(transfer(100, 30), 70);
});

test('throws precondition violation with counterexample', () => {
  assert.throws(
    () => transfer(10, 30),
    (error) => {
      assert.ok(error instanceof ContractViolation);
      assert.equal(error.kind, 'precondition');
      assert.equal(error.function, 'transfer');
      assert.deepEqual(error.counterexample, { inputs: { balance: 10, amount: 30 } });
      return true;
    },
  );
});

test('throws postcondition violation with result', () => {
  const broken = contract({ ensures: (result) => result > 0 })(function broken(x) {
    return -x;
  });
  assert.throws(
    () => broken(5),
    (error) => {
      assert.equal(error.kind, 'postcondition');
      assert.deepEqual(error.counterexample, { inputs: { x: 5 }, result: -5 });
      return true;
    },
  );
});

test('message carries machine-readable AIF_CONTRACT payload', () => {
  try {
    transfer(1, 5);
    assert.fail('expected violation');
  } catch (error) {
    const match = /^AIF_CONTRACT (\{.*\})$/.exec(error.message);
    assert.ok(match);
    assert.equal(JSON.parse(match[1]).kind, 'precondition');
  }
});

test('exposes metadata on __aif__', () => {
  const meta = transfer.__aif__;
  assert.deepEqual(meta.effects, []);
  assert.equal(typeof meta.requires, 'function');
  assert.equal(typeof meta.ensures, 'function');
  assert.deepEqual(meta.strategies, {});
  assert.deepEqual(meta.params, ['balance', 'amount']);
});

test('preserves function name', () => {
  assert.equal(transfer.name, 'transfer');
});

test('AIF_CONTRACTS=off disables checks', () => {
  process.env.AIF_CONTRACTS = 'off';
  try {
    assert.equal(transfer(10, 30), -20);
  } finally {
    delete process.env.AIF_CONTRACTS;
  }
});

test('omitted arguments are undefined in inputs (defaults are not evaluated)', () => {
  const fn = contract({ requires: ({ n }) => n === undefined || n > 0 })(function inc(x, n = 1) {
    return x + n;
  });
  assert.equal(fn(1), 2);
  assert.throws(() => fn(1, 0), ContractViolation);
});

test('explicit params option overrides parsing', () => {
  const fn = contract({ params: ['a', 'b'], requires: ({ a, b }) => a < b })((...args) => args[0] + args[1]);
  assert.equal(fn(1, 2), 3);
  assert.throws(() => fn(2, 1), ContractViolation);
});

test('parseParams handles arrows, defaults and destructuring-free signatures', () => {
  assert.deepEqual(parseParams((a, b = 2) => a + b), ['a', 'b']);
  assert.deepEqual(parseParams(async function f(x) { return x; }), ['x']);
  assert.deepEqual(parseParams(x => x), ['x']);
  assert.deepEqual(parseParams(() => 1), []);
});

test('supports async functions', async () => {
  const fn = contract({ ensures: (r) => r >= 0 })(async function load(x) {
    return x;
  });
  assert.equal(await fn(3), 3);
  await assert.rejects(() => fn(-1), (error) => error.kind === 'postcondition');
});

test('rejects non-function targets with a clear error', () => {
  assert.throws(() => contract({})(42), TypeError);
});

test('supports direct syntax contract(options, fn)', () => {
  const multiply = contract(
    {
      requires: ({ a, b }) => a > 0 && b > 0,
      ensures: (res, { a, b }) => res === a * b,
    },
    function multiply(a, b) {
      return a * b;
    },
  );

  assert.equal(multiply(3, 4), 12);
  assert.equal(multiply.name, 'multiply');
  assert.ok(multiply.__aif__);
  assert.throws(() => multiply(-1, 4), ContractViolation);
});
