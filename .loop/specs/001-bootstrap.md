# Spec 001 — Bootstrap do pacote
## Contexto
Primeira demanda: provar o ciclo TDD no projeto IA First JavaScript.
## Escopo
- `src/index.js` exporta `name` e `version` lidos do package.json.
- Teste de fumaça em `test/index.test.js`.
## Fora de escopo
Portar funcionalidades do IA First em Python (serão novas specs).
## Critérios de aceite
- `npm test` passa.
- `name === "ia-first-js"` e `version` é semver.
## Riscos
Nenhum relevante.
