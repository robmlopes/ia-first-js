/**
 * The `contract` wrapper: precondition, postcondition and declared effects.
 *
 * Predicates receive the call inputs as a named object: `requires({ a, b })`.
 * `ensures` receives the result first: `ensures(result, { a, b })`.
 * Omitted arguments appear as `undefined` in the inputs: JavaScript does not expose
 * default values without evaluating source, which the framework refuses to do.
 * Set `AIF_CONTRACTS=off` to disable checks (e.g. in production).
 */

/**
 * @typedef {Record<string, unknown>} Inputs
 * @typedef {(inputs: Inputs) => boolean} Requires
 * @typedef {(result: any, inputs: Inputs) => boolean} Ensures
 * @typedef {object} ContractOptions
 * @property {Requires} [requires]
 * @property {Ensures} [ensures]
 * @property {readonly string[]} [effects] Effects the function may perform, e.g. `['db.write']`.
 * @property {Record<string, unknown>} [strategies] Per-parameter generators for `aif fuzz`.
 * @property {readonly string[]} [params] Explicit parameter names; parsed from source when omitted.
 */

/** Contract violation carrying a machine-readable counterexample. */
export class ContractViolation extends Error {
  /**
   * @param {'precondition' | 'postcondition'} kind
   * @param {string} functionName
   * @param {Record<string, unknown>} counterexample
   */
  constructor(kind, functionName, counterexample) {
    const payload = { kind, function: functionName, counterexample };
    super(`AIF_CONTRACT ${JSON.stringify(payload, replacer)}`);
    this.name = 'ContractViolation';
    this.kind = kind;
    this.function = functionName;
    this.counterexample = counterexample;
  }
}

/** JSON replacer that keeps values JSON can not represent readable. */
function replacer(_key, value) {
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value === 'undefined') return '[undefined]';
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  return value;
}

/**
 * Extract top-level parameter names from a function's source.
 * Destructured parameters are not supported; pass `params` explicitly for those.
 * @param {Function} fn
 * @returns {string[]}
 */
export function parseParams(fn) {
  const source = Function.prototype.toString.call(fn);
  const open = source.indexOf('(');
  const arrow = source.indexOf('=>');
  let list;
  if (open !== -1 && (arrow === -1 || open < arrow)) {
    list = source.slice(open + 1, closingParen(source, open));
  } else {
    list = source.slice(0, arrow).replace(/^\s*async\s+/, '');
  }
  return splitTopLevel(list)
    .map((part) => part.trim().replace(/^\.\.\./, '').split('=')[0].trim())
    .filter(Boolean);
}

function closingParen(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new SyntaxError('unbalanced parentheses in function source');
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if ('([{'.includes(char)) depth += 1;
    if (')]}'.includes(char)) depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Wrap a function with a contract.
 * @param {ContractOptions} [options]
 * @returns {<F extends Function>(fn: F) => F}
 */
export function contract(options = {}) {
  const { requires, ensures, effects = [], strategies = {} } = options;

  return (fn) => {
    if (typeof fn !== 'function') {
      throw new TypeError(`contract() expects a function, got ${typeof fn}`);
    }
    const params = options.params ? [...options.params] : parseParams(fn);
    const name = fn.name || 'anonymous';

    const buildInputs = (args) => {
      const names = params.length >= args.length ? params : [...params, ...args.slice(params.length).map((_, i) => `arg${params.length + i}`)];
      return Object.fromEntries(names.map((param, i) => [param, args[i]]));
    };

    const check = (result, inputs) => {
      if (ensures && !ensures(result, inputs)) {
        throw new ContractViolation('postcondition', name, { inputs, result });
      }
      return result;
    };

    const wrapper = function (...args) {
      if (process.env.AIF_CONTRACTS === 'off') return fn.apply(this, args);
      const inputs = buildInputs(args);
      if (requires && !requires(inputs)) {
        throw new ContractViolation('precondition', name, { inputs });
      }
      const result = fn.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.then((value) => check(value, inputs));
      }
      return check(result, inputs);
    };

    Object.defineProperty(wrapper, 'name', { value: name, configurable: true });
    wrapper.__aif__ = { effects: [...effects], requires, ensures, strategies: { ...strategies }, params };
    return wrapper;
  };
}
