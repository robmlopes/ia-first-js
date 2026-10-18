# Spec 005 — Fase 3: Feedback e Verificação (Style, Types, Bounds, Fuzzing e Cache)

**UI**: false

## Contexto
Na Fase 1 construímos o núcleo do framework e na Fase 2 a análise estática (parser, index, limits, model, lint e effects).
A Fase 3 implementa os estágios de verificação profunda e feedback estruturado antes dos testes manuais:
1. `style`: Checagem e autofix de formato canônico de código JS/TS (`aif fix`).
2. `types`: Validação de tipos estritos usando o TypeScript Compiler (`tsc --noEmit`), mapeando diagnósticos em erros estruturados `{ stage: "types", rule: "TSxxxx", ... }`.
3. `bounds`: Inferência estática de limites numéricos a partir de predicados `requires` de contratos.
4. `fuzz`: Fuzzing automatizado de contratos `@contract(ensures=...)` sobre funções puras, gerando contraexemplos (`CON001`–`CON005`), com cache em `.aif/cache/fuzz.json`, relatório detalhado (`fuzzreport`) e comando CLI `aif fuzz [--report]`.
5. Integração no Pipeline `check`: Execução ordenada `index` -> `style` -> `lint` -> `effects` -> `types` -> `fuzz` -> `tests`.

## Escopo

### 1. Estágio de Estilo (`src/style.js` + `aif fix`)
- Checagem de formato canônico: linhas em branco redundantes, espaços em final de linha (trailing spaces), ponto e vírgula obrigatório, aspas consistentes.
- `aif fix`: aplica correções automáticas seguras e formatação canônica nos arquivos de `sourceDirs`.
- Retorna erros `{ stage: "style", rule: "format", file, line, cause, suggestion }`.

### 2. Estágio de Tipos (`src/types.js`)
- Executa `tsc --noEmit` sobre `sourceDirs` e diretórios configurados.
- Faz o parsing dos diagnósticos do compilador TypeScript (`TS2322`, `TS2345`, etc.), associando sugestões contextuais.
- Retorna erros estruturados com `stage: "types"`, `rule: "TSxxxx"`.
- Caso `tsc` não esteja disponível, reporta erro estruturado sem quebrar o processo.

### 3. Inferência de Limites (`src/bounds.js`)
- Analisa a AST de predicados `requires` para extrair intervalos de inteiros e números (ex: `amount > 0 && amount <= 1000` -> `{ amount: { min: 1, max: 1000 } }`).
- Garante que a geração de entradas de fuzzing caia dentro do domínio válido da função.

### 4. Motor de Fuzzing de Contratos (`src/fuzz.js`, `src/cache.js`, `src/fuzzreport.js`)
- Executa fuzzing sobre funções puras que possuem `@contract(ensures=...)` e sem efeitos declarados (`effects: []`).
- Regras do catálogo canônico:
  - `CON001`: Pós-condição (`ensures`) violada com contraexemplo `{ inputs, result }`.
  - `CON002`: Exceção não esperada lançada para entradas válidas que satisfazem a pré-condição.
  - `CON003`: Não foi possível gerar valores para os tipos de parâmetros declarados.
  - `CON004`: A pré-condição rejeitou quase todas as tentativas (contrato contraditório ou excessivamente restritivo).
  - `CON005`: Erro de importação ou execução interna do worker de fuzzing.
- Cache inteligente em `.aif/cache/fuzz.json` baseado em hash SHA-256 do módulo e suas dependências.
- `fuzzreport.js`: Relatório estruturado de funções testadas e motivos de funções ignoradas (sem contrato, com efeitos, sem ensures).
- Comando CLI `aif fuzz [--report]`.

### 5. Integração com Pipeline e Governança
- Plugar os novos estágios no pipeline `check`:
  `index` -> `style` -> `lint` -> `effects` -> `types` -> `fuzz` -> `tests`.
- Atualizar exportações no `src/index.js` e definições TypeScript em `types/`.

## Critérios de Aceite
- 100% dos testes passando em `npm test`.
- Erros de tipos e de fuzzing aderentes à especificação canônica do AIF original.
- Contraexemplos de violação de contrato gerados de forma legível e serializável.
- `aif check` e `aif fuzz` operando como comandos funcionais do CLI.
- Auditoria anti-swallow completa e veredito PASS do `tester_judge`.
