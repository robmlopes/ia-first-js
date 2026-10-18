# Eval — Spec 003, Fase 1 (núcleo do `aif`)

**Veredito: PASS**
**Juiz:** tester_judge · **Rodada:** T1–T6 · **Comando:** `AIF_TSC=<tsc> npm test`

## Critério de parada
`npm test`: **62 testes, 62 passam, 0 falham, 0 pulados** (com compilador TypeScript).
Sem `tsc` disponível: 60 passam e 2 ficam `SKIP` com motivo explícito (limitação do `npm install` em `/mnt/d`, ver MEMORY.md).

## Critérios de aceite da spec 003
| Critério | Resultado |
|---|---|
| Módulos com testes `node:test`, `npm test` verde | PASS |
| Contrato: pré/pós-condição, `off`, metadados, contraexemplo JSON | PASS (14 testes) |
| Config: defaults, parcial, chave desconhecida, JSON inválido estruturado | PASS (13 testes) |
| Pipeline: ordem, parada no 1º estágio com erro, timings, estágio que lança | PASS |
| CLI: `check --json` ok/falha, exit codes, comandos futuros explícitos | PASS, incl. execução real do `bin/aif.js` |
| Anti-swallow: nenhum `catch` vazio | PASS (ver abaixo) |

## Auditoria anti-swallow (8 `catch` em src/ e bin/)
Todos reportam ou relançam: `cli.js` → erro de uso; `config.js` → `ConfigError`; `history.js:45` → `status: corrupt`; `history.js:89` → **conta** em `skipped` e `stats` expõe `skipped_lines`; `pipeline.js:40` → erro estruturado do estágio; `pipeline.js:87` → só ignora `ENOENT` e relança o resto; `pipeline.js:138` → só trata `ConfigError`, relança o resto; `bin/aif.js` → JSON em stderr + exit 2. Nenhum catch silencioso.

## Compatibilidade com o Python (verificação executável)
Rodei `record`/`stats` reais do Python (`aif.history`) e do JS com as mesmas entradas:
- Linha de `history.jsonl`: **chaves idênticas** (nenhuma só de um lado).
- `stats`: chaves idênticas, **exceto** `skipped_lines` (extensão aditiva documentada); valores iguais (a única diferença é tupla vs. lista, que é o mesmo JSON).
- `check --json`: `ok, errors, warnings, timings`, como no Python. `status` exit 0/3/1 conforme `cli.md`.
- Prefixos inventados (`CFG/PIP/TST/CLI`): **nenhum** restante.

## Migração de banco / UI
N/A: o framework não usa banco nem tem interface gráfica nesta fase (`grep` por sqlite/CREATE/ALTER em `src/` e `bin/` vazio). O `memory.sqlite` pertence à governança, não ao produto.

## Ressalvas (não bloqueiam)
1. Teste de tipos depende de `tsc` externo (SKIP explícito quando ausente).
2. `--changed` cai em "checou tudo" fora de git; o projeto ainda não é repositório git.
3. `aif check` roda só o estágio `tests`; os demais estágios chegam nas Fases 2–5.
4. O dogfood cria `.aif/` na raiz do projeto; incluir em `.gitignore` quando houver git.
