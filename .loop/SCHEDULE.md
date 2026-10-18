# SCHEDULE — Roteamento Operacional por Role
- **Gatilho**: Nova spec em `.loop/specs/` ou acionamento pelo usuário.
- **Roteamento Sequencial**:
  1. `scope_analyst` (define escopo e `ui: true|false`)
  2. `architect` (define módulos e contratos)
  3. `designer` (se `ui: true`, gera `.loop/design/<id>.md`)
  4. `planner` (organiza tarefas com `role:` e `files:`)
  5. `builder_backend` (tarefas `role: backend`)
  6. `builder_frontend` (tarefas `role: frontend`)
  7. `builder` (tarefas `role: generic`)
  8. `judge_backend` / `judge_frontend` (relatórios analíticos preliminares)
  9. `tester_judge` (passada de integração e veredito final único)
- **Limite**: Máximo de 5 ciclos de correção por demanda.
- **Critério de Parada**: `npm test` verde e veredito `PASS` do `tester_judge`.
