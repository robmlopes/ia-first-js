# Spec 006 — Fase 4: Engenharia de Prompt, Governança e Ferramental de Agentes

**UI**: false

## Contexto
Após consolidarmos o núcleo (Fase 1), a análise estática (Fase 2) e o ciclo de feedback e verificação (Fase 3), a Fase 4 implementa os comandos e mecanismos operacionais do IA First para automação com agentes e governança de projeto:
1. `patch`: Substituição granular e cirúrgica de funções, métodos ou classes (`Class.method`) gerados por LLMs com verificação de sintaxe e sem reescrever o arquivo inteiro (`aif patch`).
2. `intents`: Rastreamento de intenção humana ("Why", "Scope", "Acceptance") em `.aif/intents/<id>.md` com validação de escopo e aceitação (`aif intent`).
3. `agents`: Renderização e auditoria síncrona dos arquivos de instruções de agentes (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/aif.mdc`) a partir da fonte única `.aif/protocol.md` (`aif agents`).
4. `scaffold` / `init`: Inicializador de novos projetos AI-First (`aif init`) com suporte a ambos os perfis solicitados pelo usuário (ESM puro com JSDoc e TypeScript nativo `.ts`).
5. `docscheck`: Validação estrita de consistência da documentação (`DOC001`–`DOC004`) garantindo que regras de lint, opções de configuração e comandos do CLI estejam documentados.
6. `upgrade`: Atualizador de arquivos governados pelo framework (`aif upgrade`).

## Escopo

### 1. Granular Code Patching (`src/patch.js` + `aif patch`)
- Substitui no arquivo apenas o nó AST do símbolo indicado (`symbol` top-level ou `Class.method`), preservando todo o restante e imports.
- Valida o novo trecho via `parseSource`: rejeita se contiver mais de uma definição ou sintaxe inválida.
- Exibe unified diff das modificações.

### 2. Sistema de Intenções (`src/intents.js` + `aif intent`)
- Gerenciamento de arquivos `.aif/intents/<id>.md`.
- Validação das seções obrigatórias: `## Why`, `## Scope` e `## Acceptance`.
- Integração como estágio opcional ou verificação de conformidade de arquivos modificados dentro do escopo da intenção ativa.

### 3. Governança de Agentes (`src/agents.js` + `aif agents`)
- Renderização de `AGENTS.md`, `CLAUDE.md` e `.cursor/rules/aif.mdc` a partir de `.aif/protocol.md`.
- Deteção de arquivos desatualizados (`stale`) e comando `aif agents [--write]`.

### 4. Inicializador Multi-Template (`src/scaffold.js` + `aif init`)
- Templates para ambos os formatos:
  - **JSDoc / ESM puro**: `aif.config.json`, `package.json`, pastas `domain/`, `ports/`, `adapters/`, `test/`.
  - **TypeScript nativo**: `tsconfig.json`, `package.json` com scripts TS, arquivos `.ts`.
- Inicialização de repositório git e geração imediata do protocolo e hooks de commit.

### 5. Auditoria de Documentação (`src/docscheck.js` + `aif docs`)
- Valida regras canônicas `DOC001`–`DOC004`:
  - `DOC001`: Regra emitida pelo código que não está documentada em `docs/lint-rules.md`.
  - `DOC002`: Opção de configuração não documentada.
  - `DOC003`: Comando CLI não documentado em `docs/cli.md`.
  - `DOC004`: Links relativos quebrados.

### 6. Atualizador de Protocolo (`src/upgrade.js` + `aif upgrade`)
- Atualiza arquivos mantidos pelo framework mantendo seções personalizadas adicionadas pelo usuário.

## Critérios de Aceite
- 100% dos testes passando em `npm test`.
- Todos os 12 comandos canônicos do CLI (`check`, `index`, `patch`, `fix`, `intent`, `agents`, `fuzz`, `init`, `status`, `stats`, `docs`, `upgrade`) totalmente operacionais com exit codes canônicos (0, 1, 2).
- Veredito PASS emitido pelo `tester_judge` em `.loop/evals/last_eval.md`.
