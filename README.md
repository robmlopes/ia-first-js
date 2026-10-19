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

## Development

```bash
npm test          # node --test
node bin/aif.js check
```

Project governance (agents, specs, tasks) lives in `AGENTS.md`, `.agents/` and `.loop/`.
