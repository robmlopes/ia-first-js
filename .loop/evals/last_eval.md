# Eval — Spec 006, Fase 4: Governança, Agentes e Ferramental (patch, intents, agents, init, docs, upgrade)

**Veredito: PASS**
**Juiz:** tester_judge · **Rodada:** T1–T7 · **Comando de Teste:** `npm test`

## 1. Critério de Parada
- `npm test`: **136 testes executados, 136 testes passando (0 falhas, 0 cancelados, 0 skips)**.
- Validação TypeScript Compiler API (`test/types.test.js`) 100% verde contra todas as definições `types/*.d.ts`.
- Todos os 12 comandos canônicos do CLI (`check`, `index`, `patch`, `fix`, `intent`, `agents`, `fuzz`, `init`, `status`, `stats`, `docs`, `upgrade`) implementados e testados com sucesso.

## 2. Critérios de Aceite da Spec 006
| Módulo / Funcionalidade | Critério | Veredito |
|---|---|---|
| **`src/patch.js`** | Substituição cirúrgica de funções/classes por símbolo via AST sem corromper imports ou restante do arquivo; comando `aif patch` | PASS |
| **`src/intents.js`** | Rastreamento de intenção (`Why`, `Scope`, `Acceptance`), validação de trailers em commits (`INT004`/`INT005`), verificação de escopo (`INT006`) e comando `aif intent` | PASS |
| **`src/agents.js`** | Geração e sincronização síncrona de `AGENTS.md`, `CLAUDE.md` e `.cursor/rules/aif.mdc` a partir de `.aif/protocol.md`; comando `aif agents` com `--write` | PASS |
| **`src/scaffold.js`** | Inicialização de novos projetos AI-First com suporte aos perfis JSDoc (zero build) e TS nativo, passando `aif check` de imediato; comando `aif init` | PASS |
| **`src/docscheck.js`** | Auditoria de documentação: detecção de links relativos quebrados (`DOC004`) e comandos CLI não documentados (`DOC003`); comando `aif docs` | PASS |
| **`src/upgrade.js`** | Atualizador de arquivos geridos pelo framework com preservação de seções customizadas do usuário; comando `aif upgrade` | PASS |
| **`src/cli.js`** | 100% dos 12 comandos canônicos ativos e documentados no `--help` | PASS |

## 3. Auditoria Anti-Swallow e Migrações
- **Anti-swallow**: Todas as operações de I/O e AST tratam exceções com erros estruturados e códigos de regra, sem suprimir falhas silenciosamente.
- **Migração de Banco**: N/A para o framework nesta fase.
