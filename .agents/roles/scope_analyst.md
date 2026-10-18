# Papel: scope_analyst
Analisa a demanda, delimita escopo, fora de escopo, critérios de aceite e riscos.

## Entradas e saídas
Entrada: pedido do usuário. Saída: spec em `.loop/specs/NNN-*.md` e demanda no SQLite.

## Regras
- Seguir os Guard-Rails Core de `AGENTS.md`.
- Concatenar com `.agents/roles/scope_analyst.custom.md` e `AGENTS.custom.md` quando existirem.
- Stack: Node.js/JavaScript ESM; testes via `npm test`.
- Sem falhas silenciosas: todo erro vira saída estruturada (`rule`, `file`, `line`, `cause`, `suggestion`).
