/**
 * Infer numeric input bounds from a `requires` contract predicate.
 * Analyzes comparisons of parameters with integer constants to guide fuzz generators.
 */

import ts from 'typescript';

/**
 * @typedef {[number | null, number | null]} Bound
 */

/**
 * Extract integer constant from AST expression node.
 * @param {ts.Expression} node
 * @returns {number | null}
 */
function extractConstant(node) {
  if (ts.isNumericLiteral(node)) {
    const val = Number(node.text);
    return Number.isInteger(val) ? val : null;
  }
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = extractConstant(node.operand);
    return inner !== null ? -inner : null;
  }
  return null;
}

/**
 * Apply comparison constraint to bounds map.
 * @param {Map<string, [number | null, number | null]>} bounds
 * @param {string} name
 * @param {ts.SyntaxKind} op
 * @param {number} value
 */
function applyConstraint(bounds, name, op, value) {
  if (!bounds.has(name)) {
    bounds.set(name, [null, null]);
  }
  const lowHigh = bounds.get(name);

  // Normalize > and < to >= and <=
  if (op === ts.SyntaxKind.GreaterThanToken) {
    value += 1;
    op = ts.SyntaxKind.GreaterThanEqualsToken;
  } else if (op === ts.SyntaxKind.LessThanToken) {
    value -= 1;
    op = ts.SyntaxKind.LessThanEqualsToken;
  }

  if (op === ts.SyntaxKind.GreaterThanEqualsToken) {
    lowHigh[0] = lowHigh[0] === null ? value : Math.max(lowHigh[0], value);
  } else if (op === ts.SyntaxKind.LessThanEqualsToken) {
    lowHigh[1] = lowHigh[1] === null ? value : Math.min(lowHigh[1], value);
  } else if (op === ts.SyntaxKind.EqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsEqualsToken) {
    lowHigh[0] = value;
    lowHigh[1] = value;
  }
}

/**
 * Invert comparison operator when identifier is on the right side.
 * @param {ts.SyntaxKind} op
 * @returns {ts.SyntaxKind}
 */
function flipOp(op) {
  switch (op) {
    case ts.SyntaxKind.LessThanToken: return ts.SyntaxKind.GreaterThanToken;
    case ts.SyntaxKind.LessThanEqualsToken: return ts.SyntaxKind.GreaterThanEqualsToken;
    case ts.SyntaxKind.GreaterThanToken: return ts.SyntaxKind.LessThanToken;
    case ts.SyntaxKind.GreaterThanEqualsToken: return ts.SyntaxKind.LessThanEqualsToken;
    default: return op;
  }
}

/**
 * Break down expression into binary conjuncts (&&).
 * @param {ts.Expression} node
 * @returns {ts.Expression[]}
 */
function collectConjuncts(node) {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return [...collectConjuncts(node.left), ...collectConjuncts(node.right)];
  }
  if (ts.isParenthesizedExpression(node)) {
    return collectConjuncts(node.expression);
  }
  return [node];
}

/**
 * Infer per-parameter `[low, high]` bounds implied by `requires` function.
 * @param {Function | null | undefined} requiresFn
 * @returns {Record<string, [number | null, number | null]>}
 */
export function inferBounds(requiresFn) {
  if (!requiresFn || typeof requiresFn !== 'function') {
    return {};
  }

  const src = requiresFn.toString().trim();
  // Wrap into an expression statement to parse via TS compiler
  const wrapped = `const __pred__ = ${src};`;
  const sf = ts.createSourceFile('pred.ts', wrapped, ts.ScriptTarget.Latest, true);

  let arrowOrFn = null;
  function findFn(node) {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      arrowOrFn = node;
      return;
    }
    ts.forEachChild(node, findFn);
  }
  findFn(sf);

  if (!arrowOrFn) return {};

  const params = new Set();
  for (const p of arrowOrFn.parameters) {
    if (ts.isIdentifier(p.name)) {
      params.add(p.name.text);
    } else if (ts.isObjectBindingPattern(p.name)) {
      for (const el of p.name.elements) {
        if (ts.isIdentifier(el.name)) {
          params.add(el.name.text);
        }
      }
    }
  }

  const bounds = new Map();
  const relations = [];

  const bodyExpr = ts.isBlock(arrowOrFn.body)
    ? null // Only simple expression bodies are statically parsed for bounds
    : arrowOrFn.body;

  if (!bodyExpr) return {};

  const conjuncts = collectConjuncts(bodyExpr);

  for (const c of conjuncts) {
    if (ts.isBinaryExpression(c)) {
      const left = c.left;
      const right = c.right;
      const op = c.operatorToken.kind;

      // param <op> const
      if (ts.isIdentifier(left) && params.has(left.text)) {
        const val = extractConstant(right);
        if (val !== null) {
          applyConstraint(bounds, left.text, op, val);
        } else if (ts.isIdentifier(right) && params.has(right.text)) {
          // param <op> param (relational constraint)
          if (op === ts.SyntaxKind.LessThanToken || op === ts.SyntaxKind.LessThanEqualsToken) {
            relations.push({ less: left.text, greater: right.text, strict: op === ts.SyntaxKind.LessThanToken });
          } else if (op === ts.SyntaxKind.GreaterThanToken || op === ts.SyntaxKind.GreaterThanEqualsToken) {
            relations.push({ less: right.text, greater: left.text, strict: op === ts.SyntaxKind.GreaterThanToken });
          }
        }
      }
      // const <op> param
      else if (ts.isIdentifier(right) && params.has(right.text)) {
        const val = extractConstant(left);
        if (val !== null) {
          applyConstraint(bounds, right.text, flipOp(op), val);
        }
      }
    }
  }

  const result = {};
  for (const [name, [low, high]] of bounds.entries()) {
    if (low !== null || high !== null) {
      if (low !== null && high !== null && low > high) {
        // Crossed bounds: contradictory contract, let fuzzer report CON004
        continue;
      }
      result[name] = [low, high];
    }
  }

  if (relations.length > 0) {
    Object.defineProperty(result, '__relations__', {
      value: relations,
      enumerable: false,
      configurable: true,
    });
  }

  return result;
}
