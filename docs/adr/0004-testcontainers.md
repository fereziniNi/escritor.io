# ADR 0004 — Testcontainers (Postgres real) para testes de integração do backend

## Status
Aceito

## Contexto
O núcleo do domínio de ponto depende de comportamento específico do Postgres: revogação de `UPDATE`/`DELETE` na tabela `registro_ponto` via `REVOKE`, tipos `timestamptz`, e migrações Flyway reais. Esse comportamento é justamente o que dá credibilidade ao registro de ponto (PRD §3.2).

## Decisão
Testes de repositório/integração sobem um Postgres real via Testcontainers, executando as migrações Flyway de verdade antes de cada suíte.

## Alternativas consideradas
- **H2 em memória:** testes mais rápidos e sem dependência de Docker, mas não replica fielmente constraints do Postgres nem a revogação de permissões — um teste em H2 poderia passar "verde" enquanto a proteção real contra `UPDATE`/`DELETE` estivesse quebrada em produção. Falso-positivo inaceitável justamente na parte mais sensível do sistema.

## Consequências
- Rodar a suíte de testes do backend exige Docker disponível localmente e no CI.
- Testes de repositório são mais lentos que unitários puros — por isso ficam isolados na camada de integração da pirâmide (ver [testing-strategy.md](../testing-strategy.md)), não misturados com os testes de domínio.
