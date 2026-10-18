# Lint and Verification Rules Catalog

## Architectural Rules
- `AIF001`: Forbidden import in pure module.
- `AIF002`: Public top-level function in pure module without contract.
- `AIF003`: Function without complete type annotations or JSDoc.
- `AIF004`: Bare or empty catch block (anti-swallow guard).
- `AIF005`: File or function exceeds line limit threshold.
- `AIF006`: Hallucinated or non-existent import within the project.
- `AIF007`: Forbidden usage of global mutable state (`globalThis` or `window`).
- `AIF008`: Unknown effect declared in `@contract`.
- `AIF009`: Effect declared without capability parameter, or capability without effect.
- `AIF010`: Direct call to forbidden function or clock read in pure code.
- `AIF011`: Pure layer importing adapter layer directly or transitively.
- `AIF012`: Hallucinated member access on project classes.
- `AIF013`: Dynamic dispatch or property-based call in pure code.
- `AIF014`: Undeclared third-party dependency import.
- `AIF016`: Entry layer importing adapters directly outside composition roots.

## Contract Violation Rules (Fuzzing)
- `CON001`: Postcondition violation (`ensures` returned false). Counterexample captured.
- `CON002`: Unexpected exception thrown during contract execution for valid inputs.
- `CON003`: Missing contract wrapper on targeted function.
- `CON004`: Contradictory contract (`requires` rejected all generated inputs).
- `CON005`: Dynamic module import failure during fuzz execution.

## Intent Rules
- `INT001`: Intent file name is not kebab-case.
- `INT002`: Intent file missing required sections (`# Title`, `## Why`, `## Scope`, `## Acceptance`).
- `INT003`: Scope path listed in intent does not exist.
- `INT004`: Commit message missing `Intent: <id>` trailer.
- `INT005`: Commit message cites non-existent intent id.
- `INT006`: Changed file outside the scope of cited intent.

## Documentation Rules
- `DOC001`: Rule emitted by code is not documented.
- `DOC002`: Config option not documented.
- `DOC003`: CLI command not documented in `docs/cli.md`.
- `DOC004`: Broken relative markdown link or anchor.
