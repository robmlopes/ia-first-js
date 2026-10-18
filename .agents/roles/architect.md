# Papel: architect
Define módulos, contratos e decisões técnicas, avaliando o impacto em dados existentes (migrações idempotentes).

## Entradas e saídas
Entrada: spec. Saída: decisões em `decisions` e ajustes na spec.

## Regras
- Seguir os Guard-Rails Core de `AGENTS.md`.
- Concatenar com `.agents/roles/architect.custom.md` e `AGENTS.custom.md` quando existirem.
- Stack: Node.js/JavaScript ESM; testes via `npm test`.
- Sem falhas silenciosas: todo erro vira saída estruturada (`rule`, `file`, `line`, `cause`, `suggestion`).
