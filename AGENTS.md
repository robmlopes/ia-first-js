# IA First JavaScript — Manifesto do Workspace

**Objetivo:** versão JavaScript/Node/TypeScript do framework IA First (originalmente em Python, referência em `/mnt/d/Projetos/ai-first/aif-starter`), atendendo projetos JS de frontend e backend.

**Stack:** Node.js + JavaScript ESM (JSDoc + `.d.ts`, sem build). Analisa projetos JS e TS. CLI: `aif`.
**Testes (critério de parada TDD):** `npm test`.

## Estrutura
- `.agents/` governança (SOUL, MEMORY, schema.sql, memory.sqlite, roles/)
- `.loop/` ciclo (SCHEDULE, specs/, tasks/, evals/)
- `src/` código do framework · `test/` testes `*.test.js` (`node:test`)

## Fluxo
scope_analyst → architect → planner → builder → tester_judge. O Coordenador (`.agents/SOUL.md`) orquestra, concatenando `<role>.md` + `<role>.custom.md` quando existir. Estado de tasks, decisões e evals vive em `.agents/memory.sqlite`; o `current_run.md` espelha a rodada.

## Guard-Rails Core
1. **Blindagem de migração de banco**: nunca assumir banco novo ou `:memory:`. Scripts de init e repositórios inspecionam tabelas/colunas existentes e aplicam migrações idempotentes e retrocompatíveis (`ADD COLUMN IF NOT EXISTS` ou validação reflexiva) sobre bases já em disco.
2. **Anti-Swallow**: proibido `catch {}` vazio ou captura genérica sem log estruturado. Erros de banco/infra nunca ocultam componentes de UI/CLI/API: exibir alerta ou estado degradado explícito. Dados corrompidos são contados e reportados, não descartados em silêncio.
3. **Validação pós-build**: o `tester_judge` testa a migração sobre bases legadas com dados reais e confere a integridade de telas/layout para garantir que nenhum recurso sumiu.
4. **Overlay `*.custom.md`**: regras de projeto ou equipe ficam em arquivos irmãos `*.custom.md` (ex.: `AGENTS.custom.md`, `.agents/roles/builder.custom.md`). O Coordenador concatena core + custom ao invocar um subagente. Atualizações do core nunca modificam nem removem `*.custom.md`.
5. **Batching anti-ping-pong**: sem roundtrips sequenciais de inspeção. Leituras conhecidas em paralelo no mesmo turno; varreduras amplas (>3 arquivos) em um único comando/script. Resolver o objetivo com o menor número de voltas à LLM.
6. **Higiene de execução**: comandos longos levam `timeout`; ao esperar processos assíncronos, o helper de teste deve dar `await` antes de limpar recursos; limpar temporários criados durante investigação (sem `rm -rf` em caminhos absolutos amplos, que a política de segurança bloqueia).
