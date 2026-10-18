# Eval — Spec 004, Fase 2: Análise Estática (Parser, Index, Limits, Model, Lint, Effects)

**Veredito: PASS**
**Juiz:** tester_judge · **Rodada:** T1–T7 · **Comando de Teste:** `npm test`

## 1. Critério de Parada
- `npm test`: **96 testes executados, 96 testes passando (0 falhas, 0 cancelados, 0 pulados)**.
- Validação estrita do compilador TypeScript (`test/types.test.js`) contra `types/*.d.ts` passando com 100% de sucesso.
- Dogfood do framework (`node bin/aif.js check --json`) executado no próprio repositório `ia-first-js`, passando pelos 4 estágios (`index`, `lint`, `effects`, `tests`) com `ok: true`.

## 2. Critérios de Aceite da Spec 004
| Módulo / Regra | Critério | Veredito |
|---|---|---|
| **`src/parser.js`** | Parse estático de `.js`, `.mjs`, `.ts` via TS Compiler API sem dependências externas | PASS |
| **`src/indexer.js`** | Extração de classes, herança, métodos, atributos, funções, contratos e comando `aif index` | PASS |
| **`src/limits.js` (AIF005)** | Contagem de linhas efetivas de código, limites por camada, sugestão de extração e warnings antecipados (90%) | PASS |
| **`src/model.js`** | Modelo em memória com resolução de símbolos cruzados entre módulos e grafo de dependências | PASS |
| **`src/lint.js`** | Regras `AIF001`, `AIF002`, `AIF003`, `AIF004`, `AIF006`, `AIF007`, `AIF012`, `AIF014` com paridade estrita | PASS |
| **`src/effects.js`** | Regras `AIF008`, `AIF009`, `AIF010`, `AIF011`, `AIF013`, `AIF016` para capabilities e isolamento de camadas | PASS |
| **`src/pipeline.js`** | Integração ordenada dos estágios (`index` -> `lint` -> `effects` -> `tests`) e interrupção na primeira falha | PASS |

## 3. Auditoria Anti-Swallow e Migrações
- **Anti-swallow**: Todos os blocos `catch` foram inspecionados. Nenhum erro de negócio ou falha de infraestrutura é engolido. Regra `AIF004` ativamente analisa o código do usuário e rejeita blocos vazios ou bare `catch`.
- **Migração de Banco**: N/A para o framework nesta fase (não utiliza persistência relacional interna).

## 4. Conformidade de Protocolo
- Todas as mensagens de erro emitidas seguem estritamente o formato:
  `{ "stage": "lint" | "effects", "rule": "AIF...", "file": string, "line": number, "cause": string, "suggestion": string }`
