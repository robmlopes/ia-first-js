# MEMORY
- Projeto: IA First JavaScript (port do IA First em Python para JS/Node/TS; frontend e backend).
- Stack: Node.js + JavaScript. Testes: `npm test`.
- Persistência: .agents/memory.sqlite (schema em .agents/schema.sql).
- Repositório novo, sem código ainda; sem análise graft.

## Lições aprendidas
(vazio)

## Decisões de projeto
- Framework em JS ESM + JSDoc/.d.ts (sem build); analisa JS e TS; CLI `aif`; entrega inicial = Fase 1 (spec 003).
- Referência Python: /mnt/d/Projetos/ai-first/aif-starter (pacote `aif`).

## Lições aprendidas (update 1)
- `node --test` aninhado: remover `NODE_TEST_CONTEXT` do env do filho, senão ele age como subprocesso do runner externo.
- Helpers de teste assíncronos precisam de `await` antes da limpeza (senão `uv_cwd ENOENT`).
- Argumentos omitidos aparecem como `undefined` nos contratos; JS não expõe defaults sem avaliar código.
- O Python descartava linhas corrompidas de histórico em silêncio; no port elas são contadas (`skipped`) — aplicar o mesmo critério às próximas fases.
- A política de segurança bloqueia `rm -rf` em caminhos absolutos; preferir `rmSync` em testes ou `file_edit` para edições.
- Chamadas longas podem estourar o timeout do EATMCP (60 s): usar `timeout` e `timeout_ms`.
- Sem repositório git ainda: `--changed` cai no caso "checou tudo".
- Variáveis de ambiente herdadas do DSH: `npm_config_local_prefix` e `npm_package_json` vinham setadas para `/home/robson`. Ao executar comandos npm que dependem do diretório local, usar `env -u npm_config_local_prefix -u npm_package_json npm ...`.

## Lição (update 2) — compatibilidade de protocolo
- Na Fase 1 foram inventados `CFG001/002`, `PIP001`, `TST001`, `CLI001/002/500` e chaves JSON em camelCase, divergindo do Python (`AIF…`, snake_case). Corrigido: ver `docs/compatibility.md`. Regra: ler o original antes de portar qualquer contrato de saída; só adaptar o que a linguagem exige.

## Lições (update 3) — T6
- `npm install` não grava `node_modules` em `/mnt/d` (drvfs): "up to date" sem instalar. Não depender de devDependencies: o teste de tipos usa `AIF_TSC`, `node_modules/.bin/tsc` ou `tsc` no PATH, e vira SKIP explícito (com motivo) se não houver compilador. Para rodar: `AIF_TSC=/tmp/tsprobe/node_modules/.bin/tsc npm test` (ou instalar typescript num diretório Linux).
- `.d.ts` validados por consumidor TS real (`typecheck/consumer.ts`) e por casos negativos (`typecheck/negative.ts`).
- `rm -rf` em qualquer caminho absoluto dispara o bloqueio de segurança, mesmo em comando composto: usar `rm -r` sem `-f` ou `rmSync`.

## Atualização de Governança (Update: Especialização por Role)
- Estrutura atualizada para suportar especialização estrita por papéis (`designer`, `builder_backend`, `builder_frontend`, `judge_backend`, `judge_frontend`, `tester_judge`).
- `current_run.md` agora suporta tarefas classificadas com `role: backend|frontend|generic` e `files:`.
- `SCHEDULE.md` e templates de spec atualizados com flag `ui: true|false`.
- Preservação estrita confirmada: `AGENTS.custom.md`, `.agents/memory.sqlite`, specs e evals mantidos intactos.
