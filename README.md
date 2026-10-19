# ia-first-js

AI-first framework for **JavaScript and TypeScript**: contracts, explicit effects and structured feedback, so coding agents get what a purpose-built language would give them. It is the full Node/TypeScript port of the original Python AIF framework, keeping identical canonical JSON schemas (`snake_case` keys, standard error shapes, and rule codes).

An agent works in a loop: change code, run `aif check --json`, read structured errors (`stage`, `rule`, `file`, `line`, `cause`, `suggestion`, `counterexample`), fix, repeat.

## Requirements
Node.js 22+. Plain ESM JavaScript with JSDoc types and bundled `.d.ts` definitions; zero build step required. Works seamlessly with both pure JS projects and TypeScript projects.

## Contracts

```js
import { contract } from 'ia-first-js';

// Curried syntax: contract(options)(fn)
export const transfer = contract({
  requires: ({ amount, balance }) => amount > 0 && balance >= amount,
  ensures: (result, { balance, amount }) => result === balance - amount,
  effects: [],
})(function transfer(balance, amount) {
  return balance - amount;
});

// Direct syntax: contract(options, fn)
export const add = contract(
  {
    requires: ({ a, b }) => typeof a === 'number' && typeof b === 'number',
    ensures: (result, { a, b }) => result === a + b,
  },
  function add(a, b) {
    return a + b;
  },
);

transfer(10, 30); // throws ContractViolation: kind "precondition", with a counterexample
```

- Predicates receive the inputs as an **object**: `requires({ a, b })`, `ensures(result, { a, b })`.
- A violation throws `ContractViolation` with `kind`, `function` and `counterexample`; its message is `AIF_CONTRACT {json}`.
- Omitted arguments appear as `undefined`; for destructured parameters pass `params: ['a', 'b']`.
- `AIF_CONTRACTS=off` disables runtime checks in production.

## Pipeline & Verification Order

`aif check` runs the complete 7-stage verification pipeline in strict fail-fast order:

$$\text{index} \longrightarrow \text{style} \longrightarrow \text{lint} \longrightarrow \text{effects} \longrightarrow \text{types} \longrightarrow \text{fuzz} \longrightarrow \text{tests}$$

## Commands

All 12 canonical commands are fully implemented:

| Command | Purpose |
|---|---|
| `aif check [--json] [--changed] [--root DIR]` | Run the 7-stage pipeline (default command). Exit 0 ok, 1 failed |
| `aif status` | Print last run snapshot (`.aif/last-check.json`) |
| `aif stats` | Usage statistics and failure aggregation (`.aif/history.jsonl`) |
| `aif index` | Rebuild AST member index (`.aif/index.json`) |
| `aif fix` | Auto-format canonical whitespace, blank lines and newlines |
| `aif patch <file> <symbol> <new-source>` | Replace function/class in-place via AST without rewriting the file |
| `aif fuzz [--report]` | Contract fuzzing with counterexamples and skipped functions report |
| `aif intent [list\|create <id>]` | Human intent tracking (`.aif/intents/<id>.md`) & commit trailer checks |
| `aif agents [--write]` | Render & sync agent files (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/aif.mdc`) |
| `aif init [jsdoc\|ts]` | Scaffold a new AI-first project ready to pass `aif check` |
| `aif docs` | Machine audit of documentation consistency (`DOC001`–`DOC004`) |
| `aif upgrade [--apply]` | Upgrade framework-managed files while keeping custom rules |

## Configuration

`aif.config.json` at the project root:

```json
{
  "sourceDirs": ["domain", "ports", "adapters"],
  "pureDirs": ["domain"],
  "adapterDirs": ["adapters"],
  "portDirs": ["ports"],
  "testDirs": ["test"],
  "maxFunctionLines": 50,
  "history": true
}
```

See [docs/configuration.md](docs/configuration.md), [docs/cli.md](docs/cli.md) and [docs/lint-rules.md](docs/lint-rules.md) for full documentation.

Types ship in `types/` and work from TypeScript out of the box.

## Agent Loop & Feedback Examples (How Coding Agents Interact)

When coding agents (Claude, Cursor, Copilot, DeepSeek) work in an AI-First project, they operate in an automated verify-and-fix feedback loop. Instead of free-text compiler output, `aif check --json` emits structured JSON messages (`stage`, `rule`, `file`, `line`, `cause`, `suggestion`, `counterexample`) that allow agents to self-correct in a single turn without hallucinating.

Here are real examples observed in production:

### 1. Public Function in Pure Module Missing Contract (`AIF002`)

**Agent Attempt:**
```js
// domain/date-helpers.js
export function parseDay(text) {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) return null;
  return 739850;
}
```

**Framework Structured Response (`aif check --json` in ~0.08s):**
```json
{
  "ok": false,
  "stage": "lint",
  "rule": "AIF002",
  "file": "domain/date-helpers.js",
  "line": 2,
  "cause": "public function 'parseDay' in pure module has no @contract",
  "suggestion": "wrap with contract({ requires, ensures, effects })"
}
```

**Agent Self-Correction (1-turn fix):**
```js
import { contract } from 'ia-first-js';

export const parseDay = contract({
  requires: ({ text }) => typeof text === 'string',
  ensures: (res) => res === null || typeof res === 'number',
  effects: []
})(function parseDay(text) {
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) return null;
  return 739850;
});
```

---

### 2. Monolithic Function Exceeding Clean Code Limits (`AIF005`)

**Agent Attempt:**
```js
// domain/free-slots.js: an overly complex function of 45 lines accumulating
// busy intervals, future validations, schedule grids, and slot filters...
export const freeSlots = contract({...})(function freeSlots(...) {
  /* 45 lines of nested loops and checks */
});
```

**Framework Structured Response:**
```json
{
  "ok": false,
  "stage": "lint",
  "rule": "AIF005",
  "file": "domain/free-slots.js",
  "line": 48,
  "cause": "function 'freeSlots' has 45 code lines (maximum allowed is 40)",
  "suggestion": "refactor into smaller functions or adjust maxFunctionLines in aif.config.json"
}
```

**Agent Self-Correction:**
The agent decomposes the logic into focused, pure private helper functions:
```js
function _overlaps(start, end, otherStart, otherEnd) { return start < otherEnd && otherStart < end; }
function _gridStarts(rule, durationMin, stepMin) { /* ... */ }
function _isFuture(day, start, nowDay, nowMin) { /* ... */ }

// Main function reduced to 15 clean lines:
export const freeSlots = contract({...})(function freeSlots(professionalId, rules, blocks, bookings, durationMin, day, nowDay, nowMin, stepMin) {
  const busy = _collectBusy(professionalId, day, blocks, bookings);
  return _findFreeStarts({ professionalId, rules, durationMin, day, nowDay, nowMin, stepMin }, busy);
});
```

---

### 3. Anti-Swallow / Silent Exception Handling (`AIF004`)

**Agent Attempt:**
```js
// adapters/sqlite-db.js
function syncLegacyData(db) {
  try {
    db.prepare('SELECT * FROM old_table').all();
  } catch (err) {
    // silently ignoring errors
  }
}
```

**Framework Structured Response:**
```json
{
  "ok": false,
  "stage": "lint",
  "rule": "AIF004",
  "file": "adapters/sqlite-db.js",
  "line": 142,
  "cause": "generic or empty catch block in syncLegacyData",
  "suggestion": "handle specific error or rethrow with context"
}
```

**Agent Self-Correction:**
```js
function syncLegacyData(db) {
  try {
    db.prepare('SELECT * FROM old_table').all();
  } catch (err) {
    if (!err.message?.includes('no such table')) {
      throw new Error(`Unexpected failure synchronizing legacy data: ${err.message}`);
    }
  }
}
```

---

### 4. Contract Fuzzing Catching Contradictory Invariants (`CON004`)

**Agent Attempt:**
```js
// domain/slots.js
export const intervalsOverlap = contract({
  requires: ({ startA, endA, startB, endB }) => startA < endA && startB < endB,
  ensures: (res) => typeof res === 'boolean'
})(function intervalsOverlap(startA, endA, startB, endB) {
  return !(endA <= startB || startA >= endB);
});
```

**Framework Structured Response (`aif fuzz --report --json`):**
```json
{
  "ok": false,
  "stage": "fuzz",
  "rule": "CON004",
  "file": "domain/slots.js",
  "line": 12,
  "cause": "requires of intervalsOverlap rejected all generated inputs (contradictory contract or overly restrictive domain)",
  "suggestion": "provide custom strategies for parameters or widen requires"
}
```

**Agent Self-Correction:**
```js
export const intervalsOverlap = contract({
  requires: ({ startA, endA, startB, endB }) => startA < endA && startB < endB,
  ensures: (res) => typeof res === 'boolean',
  effects: [],
  strategies: {
    startA: () => 100,
    endA: () => 200,
    startB: (rng) => Math.floor(rng() * 300),
    endB: () => 350
  }
})(function intervalsOverlap(startA, endA, startB, endB) {
  return !(endA <= startB || startA >= endB);
});
```

## Development

```bash
npm test          # node --test
node bin/aif.js check
```

Project governance (agents, specs, tasks) lives in `AGENTS.md`, `.agents/` and `.loop/`.
