# Regras específicas do projeto (overlay — nunca sobrescrito por updates)

## Convenções JavaScript
- ESM (`import`/`export`), `type: module`; aspas simples, ponto e vírgula, 2 espaços.
- `camelCase` para variáveis/funções/chaves JSON, `PascalCase` para classes, `UPPER_SNAKE` para constantes de módulo.
- Arquivos em `kebab-case` ou minúsculos; testes `*.test.js` em `test/` com `node:test` + `node:assert/strict`.
- Tipos via JSDoc (`@param`, `@returns`, `@typedef`); sem etapa de build.
- Preferir `const`; erros como `Error` com campos estruturados; promessas com `async/await`.
- Código, comentários e identificadores em inglês; governança (`.agents/`, `.loop/`) em português.

## Domínio
- Referência funcional: `/mnt/d/Projetos/ai-first/aif-starter`. Portar comportamento, não sintaxe Python.
- Entrega atual: Fase 1 (spec 003). Fases 2-5 em `.loop/specs/002-port-inventory.md`.

## Compatibilidade com o AIF Python (obrigatório)
- Toda saída JSON/arquivo de máquina usa **snake_case** e os **mesmos códigos de regra** do Python (`AIF001`…, `CON…`, `INT…`, `AGT001`, `DOC…`). Código JS interno continua em camelCase.
- Falha sem regra no catálogo = `stage` + `cause` + `suggestion`, **sem `rule`**. Proibido inventar prefixos.
- Antes de criar qualquer formato de saída, código de erro ou exit code: consultar `docs/compatibility.md` e o doc equivalente do Python. Ver o original primeiro, depois portar.
