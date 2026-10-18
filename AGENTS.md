# IA First JavaScript — Manifesto do Workspace

**Objetivo:** versão JavaScript/Node/TypeScript do framework IA First (originalmente em Python, referência em `/mnt/d/Projetos/ai-first/aif-starter`), atendendo projetos JS de frontend e backend.

**Stack:** Node.js + JavaScript ESM (JSDoc + `.d.ts`, sem build). Analisa projetos JS e TS. CLI: `aif`.
**Testes (critério de parada TDD):** `npm test`.

## Estrutura
- `.agents/` governança (SOUL, MEMORY, schema.sql, memory.sqlite, roles/)
- `.loop/` ciclo (SCHEDULE, specs/, design/, tasks/, evals/)
- `src/` código do framework · `test/` testes `*.test.js` (`node:test`)

## Fluxo
scope_analyst → architect → [designer se ui:true] → planner → builders (backend -> frontend -> generic) → judges de apoio → tester_judge.
O Coordenador (`.agents/SOUL.md`) orquestra, concatenando `<role>.md` + `<role>.custom.md` quando existir. Estado de tasks, decisões e evals vive em `.agents/memory.sqlite`.

## Guard-Rails Técnicos Globais (Core)
1. **Blindagem de Migração de Banco**: Nenhuma alteração de schema/DDL pode assumir banco novo ou em memória (`:memory:`). Scripts de inicialização (`init_db`) e repositórios devem inspecionar colunas e tabelas existentes e aplicar migrações retrocompatíveis e idempotentes (`ALTER TABLE ADD COLUMN IF NOT EXISTS` ou validação reflexiva) para bases já em disco.
2. **Proibição Estrita de Falhas Silenciosas (Anti-Swallow)**: Proibido `try...except Exception: pass`, `catch {}` vazio ou captura genérica sem log estruturado. Erros de banco ou infraestrutura nunca devem ocultar componentes de interface (UI/CLI/API). Na ocorrência de erro, exibir alerta ou estado degradado explícito para o usuário final.
3. **Validação e Auditoria Pós-Build**: O `tester_judge` deve testar a migração sobre bases legadas com dados reais e checar a integridade de componentes de tela/layout para certificar que nenhum recurso existente sumiu indevidamente.
4. **Padrão de Customização Overlay (`*.custom.md`)**: Customizações específicas de projetos ou equipes não devem ser escritas nos arquivos core. Regras específicas devem ser colocadas em arquivos irmãos com extensão `.custom.md` (ex: `AGENTS.custom.md`, `.agents/roles/builder.custom.md`). O Coordenador sempre concatena o core correspondente com o `.custom.md` ao invocar um subagente. Atualizações core NUNCA modificam nem removem arquivos `*.custom.md`.
5. **Execução em Lote e Anti-Ping-Pong (Batching Mandatório)**: Proibido roundtrips sequenciais de inspeção (`read` arquivo por arquivo em turnos isolados). Emita leituras em lote (`parallel tool calls` no mesmo turno) para arquivos conhecidos. Para varredura ampla (>3 arquivos), use um único comando/script de terminal que filtre e entregue apenas as linhas necessárias. Planeje ações para resolver o objetivo com o menor número possível de voltas à LLM.
6. **Especialização por Role (sem paralelismo)**:
   - O `planner` marca tarefas com `role: backend|frontend|generic` e `files:`. Ordem: backend -> frontend -> generic, sempre em sequência.
   - `designer` roda após o `architect` apenas se a spec tiver `ui: true`; gera `.loop/design/<id>.md` com critérios `VIS-XX`.
   - `judge_backend`/`judge_frontend` apenas reportam; só o `tester_judge` emite o veredito único, após passada de integração.
