# Configuration Reference

AIF is configured via `aif.config.json` at the root of the project.

| Option | Type | Default | Description |
|---|---|---|---|
| `sourceDirs` | `string[]` | `["domain", "ports", "adapters"]` | Directories containing source code to inspect |
| `pureDirs` | `string[]` | `["domain"]` | Directories where code must be pure and have contracts |
| `adapterDirs` | `string[]` | `["adapters"]` | Directories implementing I/O adapters |
| `portDirs` | `string[]` | `["ports"]` | Directories declaring port interfaces/classes |
| `entryDirs` | `string[]` | `[]` | Directories containing entry points |
| `testDirs` | `string[]` | `["test"]` | Directories containing test suites |
| `history` | `boolean` | `true` | Whether to record check runs in `.aif/history.jsonl` |
| `intents` | `boolean` | `false` | Whether to enforce intent validation during check |
| `maxFileLines` | `number` | `300` | Maximum non-empty lines permitted per file |
| `maxFunctionLines` | `number` | `50` | Maximum non-empty lines permitted per function |
| `limitWarnRatio` | `number` | `0.9` | Ratio at which line count warnings are emitted |
| `forbiddenCalls` | `string[]` | `["Date.now", "Math.random"]` | Calls forbidden in pure code |
| `forbiddenClock` | `string[]` | `["Date", "performance.now"]` | Clock accesses forbidden in pure code |
| `allowedCapabilities` | `string[]` | `[]` | Allowed effect capability names |
| `forbiddenThirdParty` | `string[]` | `[]` | Third-party packages explicitly banned |
