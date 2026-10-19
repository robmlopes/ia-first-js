# Spec 007 — Fase 5: Melhorias de Usabilidade, Fuzzing Relacional e Governança Web

**UI**: false

## Contexto
Após o primeiro dogfood real com a aplicação `controle-atendimento-js`, foram identificadas fricções práticas no uso do framework por agentes e desenvolvedores:
1. **Fuzzing Relacional**: Quando predicados possuem relações entre parâmetros como `startA < endA` ou `start < end`, o gerador LCG independente causava falsos positivos `CON004 (Contradictory Contract)` por falta de inferência relacional.
2. **Sintaxe de Contratos Mais Flexível**: O formato curried `contract({...})(fn)` pode ser simplificado permitindo passar a função diretamente como segundo argumento `contract({...}, fn)` além do formato curried original, mantendo 100% de compatibilidade retroativa.
3. **Governança de Entrypoints e Rotas Web**: Regra `AIF017` para garantir que rotas e controllers em `entryDirs` não importem adapters de infraestrutura diretamente fora dos composition roots configurados ou recebam injeções de use cases/ports.
4. **Filtragem de Warnings Experimentais do Node.js**: O Node 22 emite `ExperimentalWarning: SQLite...` no stderr dos testes subprocessados, sujando a saída de terminal. O framework deve silenciar flags experimentais conhecidas ao executar subprocessos do pipeline.

## Critérios de Aceite
- `inferBounds` suporta ordenação de parâmetros ou relações simples de bounds.
- O motor de amostragem (`fuzz.js`) respeita restrições relacionais detectadas.
- `contract(options, fn)` funciona tanto como curried `contract(options)(fn)` quanto direto `contract(options, fn)`.
- Regra de lint/effects para camada web/entrypoint.
- 100% dos testes passando (`npm test`).
EOF
