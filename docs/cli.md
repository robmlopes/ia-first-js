# CLI Reference

The CLI entrypoint is `aif`. It is designed for both humans and AI coding agents.

## `aif check`
Runs the complete verification pipeline in strict order:
`index` -> `style` -> `lint` -> `effects` -> `types` -> `fuzz` -> `tests`.

Flags:
- `--json`: Format output as canonical structured JSON.
- `--changed`: Run verification only on modified files tracked by git.
- `--root <dir>`: Target root directory (default `.`).

## `aif status`
Inspects `.aif/last-check.json` to show the snapshot of the last pipeline run.

## `aif stats`
Analyzes `.aif/history.jsonl` to aggregate failure frequencies, execution timings, and retry attempts before green.

## `aif index`
Rebuilds the fast AST index at `.aif/index.json`.

## `aif fix`
Applies canonical formatting automatically: removes trailing whitespace, normalizes multiple blank lines, and guarantees final newlines.

## `aif patch`
Granular code patcher. Replaces one function, class, or method (`Class.method`) in-place without rewriting the entire file.

Usage:
```bash
aif patch <file> <symbol> <new-source>
```

## `aif fuzz`
Runs property-based contract fuzzing.

Flags:
- `--report`: Emits statistical coverage and functions skipped (no contract, effects declared, etc.).
- `--json`: Canonical JSON summary.

## `aif intent`
Manages human feature intents under `.aif/intents/<id>.md`.

Usage:
```bash
aif intent list
aif intent create <id> [title]
```

## `aif agents`
Renders and synchronizes agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/aif.mdc`) from the single source `.aif/protocol.md`.

Flags:
- `--write`: Write rendered files to disk.

## `aif init`
Scaffolds a new AI-first project ready to pass `aif check`.

Usage:
```bash
aif init [jsdoc|ts]
```

## `aif docs`
Validates documentation consistency, broken markdown links (`DOC004`), and documented commands (`DOC003`).

## `aif upgrade`
Brings framework-owned files up to date while preserving custom sections in `.aif/protocol.md`.

Flags:
- `--apply`: Apply updates in-place.
