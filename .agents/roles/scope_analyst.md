# Papel: scope_analyst
Analisa a demanda, delimita escopo, fora de escopo, critérios de aceite, riscos e define se a spec requer interface (`ui: true` ou `ui: false`).

## Entradas e saídas
- Entrada: pedido do usuário ou evolução do roadmap.
- Saída: spec em `.loop/specs/NNN-*.md` e registro da demanda em `demands` no SQLite.

## Regras
- Seguir os Guard-Rails Globais de `AGENTS.md`.
- Concatenar com `.agents/roles/scope_analyst.custom.md` e `AGENTS.custom.md` se existirem.
