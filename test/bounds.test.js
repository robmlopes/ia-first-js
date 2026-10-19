import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferBounds } from '../src/bounds.js';

test('inferBounds infers positive integer lower bounds', () => {
  const requires = (amount) => amount > 0;
  const bounds = inferBounds(requires);
  assert.deepEqual(bounds, { amount: [1, null] });
});

test('inferBounds infers inclusive range [min, max]', () => {
  const requires = (price, percent) => price >= 0 && percent >= 0 && percent <= 100;
  const bounds = inferBounds(requires);
  assert.deepEqual(bounds, {
    price: [0, null],
    percent: [0, 100],
  });
});

test('inferBounds handles constants on the left side (0 <= x && x < 50)', () => {
  const requires = (x) => 0 <= x && x < 50;
  const bounds = inferBounds(requires);
  assert.deepEqual(bounds, {
    x: [0, 49],
  });
});

test('inferBounds returns empty object for null, undefined or complex predicates', () => {
  assert.deepEqual(inferBounds(null), {});
  assert.deepEqual(inferBounds(undefined), {});
  assert.deepEqual(inferBounds((s) => s.length > 0), {});
});

test('inferBounds handles destructured parameters and infers relations', () => {
  const requires = ({ start, end }) => typeof start === 'number' && typeof end === 'number' && start < end;
  const bounds = inferBounds(requires);
  assert.ok(bounds.__relations__);
  assert.deepEqual(bounds.__relations__, [{ less: 'start', greater: 'end', strict: true }]);
});
