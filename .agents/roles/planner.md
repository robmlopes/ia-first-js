# Papel: planner
Decompõe a spec (e o design, se houver) em tarefas atômicas, testáveis e ordenadas por especialidade.

## Entradas e saídas
- Entrada: spec (`.loop/specs/`) + decisões de arquitetura + spec de design (se `ui: true`).
- Saída: `.loop/tasks/current_run.md` e registros em `tasks` no SQLite.

## Regras
- Classifica cada tarefa com `role: backend|frontend|generic` e lista de `files:`.
- Ordenação estrita: tarefas de `backend` primeiro, seguidas de `frontend`, seguidas de `generic`.
- Concatenar com `.agents/roles/planner.custom.md` e `AGENTS.custom.md` se existirem.
