# Spec 004 — Fase 2: Análise Estática (Parser, Index, Model, Limits, Lint e Effects)

## Objetivo
Implementar o motor de análise estática do `aif` para JavaScript e TypeScript, gerando `.aif/index.json` e executando as verificações de lint (`stage: "lint"` e `stage: "effects"`), mantendo conformidade estrita com o catálogo de regras original do AIF Python (`AIF001`–`AIF016`).

## Escopo
1. **Parser & AST (`src/parser.js`)**:
   - Parse de arquivos `.js`, `.mjs`, `.ts` usando a TypeScript Compiler API (suporte universal JS/TS sem dependências pesadas externas).
   - Extração padronizada de nós: funções, métodos, classes, imports, exports, chamadas, docstrings/JSDoc e decorators/wrappers `contract(...)`.

2. **Indexador (`src/index.js` + comando `aif index`)**:
   - Mapeia classes (bases, métodos, atributos estáticos, atributos de instância no construtor) e funções (args, returns, contract, doc, line).
   - Gera `.aif/index.json` compatível com a estrutura de dados do Python.
   - Suporte ao comando CLI `aif index` e atualização automática no pipeline `check`.

3. **Limits (`src/limits.js` - Regra `AIF005`)**:
   - `maxFileLines` (default 200) e `maxFunctionLines` (default 40), com overrides por camada (`limits.<layer>`).
   - Contagem apenas de linhas de código quando `countCodeLines = true` (ignora linhas vazias, comentários e JSDoc).
   - Emissão de `warnings` a 90% (`limitWarnRatio = 0.9`).
   - Sugestão do maior bloco a ser extraído.

4. **Project Model (`src/model.js`)**:
   - Representação em memória do projeto: grafo de imports, resolução de caminhos locais/absolutos, classes e funções exportadas.

5. **Lint Core (`src/lint.js` - Regras AIF)**:
   - `AIF001`: Import proibido em `pure_dirs` (ex.: `node:fs`, `node:http`, pacotes em `forbiddenImports`).
   - `AIF002`: Função pública exportada em `pure_dirs` sem `contract(...)`.
   - `AIF003`: Falta de tipagem (em TS) ou JSDoc `@param`/`@returns` (em JS) em funções.
   - `AIF004`: `catch` vazio ou que engole exceções sem log/rethrow estruturado.
   - `AIF006`: Import de símbolo ou módulo inexistente no projeto (checado contra o index).
   - `AIF007`: Modificação de escopo global ou uso proibido de `globalThis`/`window`.
   - `AIF012`: Acesso a membros ou métodos inexistentes em classes do projeto.
   - `AIF014`: Pacote de terceiros importado sem declaração no `package.json` ou `thirdParty`.
   - `AIF015`: Submódulo ou símbolo importado inexistente em pacote de terceiros instalado.

6. **Effects & Capabilities (`src/effects.js`)**:
   - `AIF008`: Efeito declarado em `contract({ effects: [...] })` não configurado em `capabilities`.
   - `AIF009`: Efeitos declarados incompatíveis com as capacidades recebidas por parâmetro.
   - `AIF010`: Chamada ou referência a função proibida em `pure_dirs` (`forbiddenCalls` como `eval`, `Function`, `setTimeout`; `forbiddenClock` como `Date.now`, `performance.now`, `Math.random`).
   - `AIF011`: Camada pura (`domain`) importando direta ou indiretamente adaptadores de efeitos (`adapters`).
   - `AIF013`: Dynamic dispatch em `pure_dirs` (`obj[computed]()`, chamada de variável de loop ou função retornada de função).
   - `AIF016`: Entry layer (`web`, `cli`) importando adapters diretamente sem passar por `compositionRoots`.

7. **Pipeline Integration**:
   - Plugar os novos estágios no pipeline: `index` -> `lint` -> `effects` -> `tests`.

## Fora de Escopo
- Fases 3 (fuzzing/Hypothesis/fast-check), 4 (intents/agents/patch) e 5 (scaffold/upgrade).

## Critérios de Aceite
- 100% dos testes passando em `npm test`.
- Saída JSON no formato canônico do AIF Python (`stage`, `rule`, `file`, `line`, `cause`, `suggestion`).
- `aif index` gera `.aif/index.json` válido para projetos JS e TS.
- Fixtures cobrindo todas as regras `AIF001` a `AIF016` disparando os erros e sugestões esperadas.
