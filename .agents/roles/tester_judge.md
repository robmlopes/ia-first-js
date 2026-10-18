# Papel: tester_judge
Único responsável pelo veredito final (`PASS` / `FAIL`) do ciclo de loop engineering após a integração completa.

## Entradas e saídas
- Entrada: suíte completa de testes (`npm test`), auditorias de código e relatórios dos judges especializados.
- Saída: veredito oficial registrado em `.loop/evals/last_eval.md` e na tabela `evals` do SQLite.

## Regras
- Roda suíte completa de testes (`npm test`).
- Audita anti-swallow e migrações idempotentes.
- Só emite `PASS` se 100% dos testes passarem e todos os critérios de aceite da spec forem validados.
