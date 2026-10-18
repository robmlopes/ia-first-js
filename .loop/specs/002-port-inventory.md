# Spec 002 — Inventário de port: IA First (Python) → JS/Node/TS

Origem: `/mnt/d/Projetos/ai-first/aif-starter` (pacote `aif`, ~25 módulos, ~3.700 linhas, CLI `aif`).

## Ideia central
Dar a agentes de IA o que uma linguagem feita para eles daria: forma canônica única, contratos, efeitos explícitos e feedback estruturado (`rule`, `file`, `line`, `cause`, `suggestion`, `counterexample`). Pipeline `aif check` em estágios, cada um só roda se o anterior passou.

## Mapeamento de ferramentas
| Python | JS/TS proposto |
|---|---|
| ruff (format+lint) | Prettier + ESLint (ou Biome) |
| mypy --strict | `tsc --strict` |
| Hypothesis (fuzz de contratos) | fast-check |
| pytest | `node:test` (`npm test`) |
| AST (`ast`) | TypeScript Compiler API (analisa JS e TS) |
| `@contract` decorator | wrapper `contract({requires, ensures, effects})(fn)` |
| Protocols em `ports/` | interfaces TS / JSDoc typedefs |
| `domain/ ports/ adapters/` | mesma arquitetura em camadas |

## Módulos e fases sugeridas
**Fase 1 — Núcleo:** `contract` (contract.py), `config` (aif.toml → aif.config.json), `cli` (check/index/fix), `pipeline`.
**Fase 2 — Análise estática:** `model`, `index` (.aif/index.json), `lint` (AIF001-015), `members`, `effects`, `dynamic`, `limits` (AIF005), `thirdparty` (imports inventados).
**Fase 3 — Feedback e verificação:** `style`, `types`, `fuzz` + `bounds` + `fuzzreport` + `cache`.
**Fase 4 — Fluxo de agente:** `intents` (.aif/intents/*.md, trailer `Intent:` no commit), `agents` (AGENTS.md/CLAUDE.md/Cursor a partir de `.aif/protocol.md`), `patch`, `history`.
**Fase 5 — Ciclo de vida:** `scaffold` (`aif init`), `upgrade`, `docscheck`, `env`.

## Decisões em aberto
1. Linguagem do próprio framework: JS puro (+JSDoc/`tsc --checkJs`) ou TypeScript?
2. Alvo analisado: projetos JS, TS ou ambos?
3. Nome do CLI/pacote (`aif`? `aif-js`?) e arquivo de config.
4. Escopo da Fase 1 como primeira entrega.

## Critério de aceite desta spec
Usuário valida mapeamento e fases; só então o `planner` quebra a Fase 1 em tasks.
