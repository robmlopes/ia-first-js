# ia-first-js

AI-first framework for **JavaScript and TypeScript**: contracts, explicit effects and structured feedback, so coding agents get what a purpose-built language would give them. It is the JS port of the Python [AIF](../ai-first/aif-starter) and keeps its machine-readable output identical (see [docs/compatibility.md](docs/compatibility.md)).

An agent works in a loop: change code, run `aif check --json`, read the structured errors (`stage`, `rule`, `file`, `line`, `cause`, `suggestion`, `counterexample`), fix, repeat.

> Status: **Phase 1** (core). The full roadmap is in `.loop/specs/002-port-inventory.md`.

## Requirements
Node.js 22+. Plain ESM JavaScript with JSDoc types and `.d.ts` files; no build step. Works from JS and TS projects.

## Contracts

```js
import { contract } from 'ia-first-js';

const transfer = contract({
  requires: ({ amount, balance }) => amount > 0 && balance >= amount,
  ensures: (result, { balance, amount }) => result === balance - amount,
  effects: [],
})(function transfer(balance, amount) {
  return balance - amount;
});

transfer(10, 30); // throws ContractViolation: kind "precondition", with a counterexample
```

- Predicates receive the inputs as an **object**: `requires({ a, b })`, `ensures(result, { a, b })`.
- A violation throws `ContractViolation` with `kind`, `function` and `counterexample`; its message is `AIF_CONTRACT {json}`.
- Omitted arguments appear as `undefined`; for destructured parameters pass `params: ['a', 'b']`.
- `AIF_CONTRACTS=off` disables the checks (production).

## Commands

| Command | Purpose |
|---|---|
| `aif check [--json] [--changed] [--root DIR]` | run the pipeline (default command). Exit 0 ok, 1 failed |
| `aif status` | print `.aif/last-check.json`. Exit 0 passed, 3 running, 1 otherwise |
| `aif stats` | usage statistics from `.aif/history.jsonl` |

`index`, `patch`, `fix`, `intent`, `agents`, `fuzz`, `init`, `docs` and `upgrade` arrive in later phases and fail explicitly with `{"ok": false, "stage": "cli", ...}` and exit 2.

Phase 1 pipeline: the `tests` stage runs `node --test`. Stages run in order and stop at the first one with errors.

## Configuration

`aif.config.json` at the project root (all keys optional, camelCase):

```json
{ "sourceDirs": ["domain", "web"], "entryDirs": ["web"], "maxFunctionLines": 40, "history": true }
```

Invalid files fail with `{"stage": "config", ...}`; unknown keys are ignored.

## Programmatic API

```js
import { check, loadConfig, runStages } from 'ia-first-js';
const result = await check(process.cwd()); // { ok, errors, warnings, timings }
```

Types ship in `types/` and work from TypeScript out of the box.

## Development

```bash
npm test          # node --test
node bin/aif.js check
```

Project governance (agents, specs, tasks) lives in `AGENTS.md`, `.agents/` and `.loop/`.
