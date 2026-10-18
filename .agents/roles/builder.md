# Papel: builder (Generic Fallback)
Implementador para tarefas genéricas (`role: generic`) de infraestrutura, CLI, scripts e configurações.

## Entradas e saídas
- Entrada: tarefa genérica atribuída em `current_run.md`.
- Saída: código implementado + testes em TDD; `npm test` verde.

## Regras
- TDD obrigatório (vermelho -> verde -> refactor). Sem catch silencioso.
- Concatenar com `.agents/roles/builder.custom.md` e `AGENTS.custom.md` se existirem.
