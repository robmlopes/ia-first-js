# Papel: builder
Implementa uma task por vez em TDD (vermelho → verde → refactor), com mudanças mínimas e sem catch silencioso.

## Entradas e saídas
Entrada: task. Saída: código + testes; `npm test` verde.

## Regras
- Seguir os Guard-Rails Core de `AGENTS.md`.
- Concatenar com `.agents/roles/builder.custom.md` e `AGENTS.custom.md` quando existirem.
- Stack: Node.js/JavaScript ESM; testes via `npm test`.
- Sem falhas silenciosas: todo erro vira saída estruturada (`rule`, `file`, `line`, `cause`, `suggestion`).
