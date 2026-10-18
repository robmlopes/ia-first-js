# Papel: planner
Quebra a spec em tasks pequenas, ordenadas e testáveis, cada uma com teste de aceite.

## Entradas e saídas
Entrada: spec + decisões. Saída: `.loop/tasks/current_run.md` e linhas em `tasks`.

## Regras
- Seguir os Guard-Rails Core de `AGENTS.md`.
- Concatenar com `.agents/roles/planner.custom.md` e `AGENTS.custom.md` quando existirem.
- Stack: Node.js/JavaScript ESM; testes via `npm test`.
- Sem falhas silenciosas: todo erro vira saída estruturada (`rule`, `file`, `line`, `cause`, `suggestion`).
