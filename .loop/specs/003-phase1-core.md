# Spec 003 — Fase 1: Núcleo do `aif` (JS)

## Decisões (validadas pelo usuário)
1. **Linguagem do framework:** JavaScript ESM puro + tipos via JSDoc e `.d.ts` gerado/mantido à mão. Sem etapa de build, funciona direto em projetos JS e TS.
2. **Alvo analisado:** projetos JS e TS (Fases seguintes).
3. **Nome:** CLI e pacote de comando `aif` (pacote npm `ia-first-js`, `bin: aif`).
4. **Entrega:** somente Fase 1.

## Escopo
- `src/contract.js`: `contract({requires, ensures, effects, strategies})(fn)` retorna wrapper; `ContractViolation` com `kind`, `function`, `counterexample` e mensagem `AIF_CONTRACT {json}`; `AIF_CONTRACTS=off` desliga; metadados em `wrapper.__aif__`. Predicados recebem objeto nomeado de entradas (`requires({a,b})`) e `ensures(result, {a,b})`.
- `src/config.js`: `loadConfig(root)` lê `aif.config.json` (fallback para defaults), ignora chaves desconhecidas, aplica `entryDirs` em `sourceDirs`. Defaults espelham o Python (`sourceDirs`, `pureDirs`, `maxFileLines`, `maxFunctionLines`, `fuzz`, `forbiddenCalls`...).
- `src/pipeline.js`: `check(root, {changed})` executa estágios ordenados; estágio só roda se o anterior passou; mede timings; retorna `{ok, errors, warnings, timings}`. Estágios são plugáveis (registro); Fase 1 implementa o estágio `tests` (`node --test`, erros estruturados, extrai `AIF_CONTRACT`) e `index` placeholder.
- `src/cli.js` + `bin/aif.js`: `aif check [--json] [--changed] [--root]`; saída humana ou JSON; exit code 0/1. Comandos futuros listados como "não implementado" com erro explícito (sem falha silenciosa).
- `src/history.js` mínimo: grava `.aif/last-check.json` (e histórico jsonl se `history`).

## Fora de escopo
lint/effects/types/fuzz/intents/agents/patch/scaffold (Fases 2-5).

## Critérios de aceite
- Todos os módulos com testes `node:test`; `npm test` verde.
- Contrato: pré-condição, pós-condição, `off`, metadados e contraexemplo JSON cobertos.
- Config: defaults, arquivo parcial, chave desconhecida ignorada, JSON inválido gera erro estruturado (não engolido).
- Pipeline: ordem, parada no primeiro estágio com erro, timings.
- CLI: `aif check --json` em fixture retorna `{"ok":true,...}`; erro de teste retorna exit 1.
- Anti-swallow: nenhum `catch` vazio.
