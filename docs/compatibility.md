# Compatibilidade com o AIF Python

O `aif` JS e o `aif` Python são intercambiáveis para quem consome a saída (agentes, CI, scripts).
Referência: `/mnt/d/Projetos/ai-first/aif-starter/docs/` (`cli.md`, `lint-rules.md`).

## Contrato de saída (protocolo de máquina) — idêntico ao Python
- **Chaves JSON em `snake_case`** (`changed_only`, `attempts_before_ok`, `top_rules`, `last-check.json`, `history.jsonl`). O código JS interno segue camelCase; só a fronteira JSON é snake_case.
- **Erro:** `{ "stage", "rule", "file", "line", "cause", "suggestion" }`. `rule` existe apenas quando há regra do catálogo.
- **Estágios:** `style`, `agents`, `intents`, `docs`, `lint`, `effects`, `types`, `fuzz`, `tests`, na mesma ordem.
- **Resultado do check:** `{ ok, errors, warnings, timings }` (+ `changed_only` com `--changed`).
- **Códigos de saída:** `check` 0 ok / 1 falha; `status` 0 passou, 3 rodando, 1 caso contrário.
- **Violação de contrato (tests/fuzz):** `{ stage, test, cause: "contract violated", kind, function, counterexample }`.

## Catálogo de regras
Os códigos são os do Python e **não podem ser reutilizados com outro significado**: `AIF001`–`AIF016`, `CON001`–`CON005`, `INT001`–`INT006`, `AGT001`, `DOC001`–`DOC004`.
Cada regra é portada na fase correspondente mantendo o mesmo código e a mesma intenção; quando uma regra não faz sentido em JS (ex.: `AIF007`, `global`), ela é documentada como "não aplicável", nunca renumerada.

## Falhas sem regra no catálogo
Sem `rule`, apenas `stage` + `cause` (+ `suggestion`/`detail`), como o Python faz quando o runner de testes não executa (`{"stage":"tests","cause":"pytest did not run"}`).
Exemplos no port: config inválida (`stage: "config"`), estágio que lançou exceção (`stage: <nome>`), comando desconhecido/não implementado (`{"ok": false, "stage": "cli", ...}`, saída 2).
**Não inventar prefixos novos** (`CFG`, `PIP`, `CLI`...). Se uma regra nova for realmente necessária, propor primeiro no Python para manter os dois catálogos iguais.

## Diferenças inevitáveis de linguagem
| Tema | Python | JS |
|---|---|---|
| Predicados de contrato | lambdas com args nomeados | recebem objeto: `requires({ a })`, `ensures(result, { a })` |
| Config | `aif.toml` | `aif.config.json` (mesmas chaves em camelCase) |
| Testes | pytest | `node --test` |

## Extensões aditivas (únicas diferenças de chaves)
- `aif stats` inclui `skipped_lines` (linhas corrompidas de `history.jsonl`). O Python as descarta em silêncio; aqui são contadas. É uma chave a mais: leitores do Python que ignoram chaves desconhecidas não são afetados.
- `aif status` pode devolver `status: "corrupt"` quando `last-check.json` é ilegível (o Python devolve `none`).
- `aif` JS usa saída `2` para erro de uso/comando não implementado (o Python usa argparse, que também sai com 2).
