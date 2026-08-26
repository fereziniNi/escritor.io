# ADR 0001 — Monorepo para backend e frontend

## Status
Aceito

## Contexto
O desenvolvimento é incremental e full-stack: cada fatia do [plano incremental](../incremental-plan.md) toca backend e frontend juntos (ex.: endpoint de marcação de ponto + botão que o consome).

## Decisão
Um único repositório, com `/backend` e `/frontend` como projetos independentes (build e deploy separados), mas versionados juntos.

## Alternativas consideradas
- **Repositórios separados:** isolamento melhor, mas exige coordenar duas branches/PRs por fatia incremental e versionar a compatibilidade de contrato entre eles — overhead desnecessário para um time pequeno construindo os dois lados na mesma sessão de trabalho.

## Consequências
- Um PR pode (e deve, na maioria das fatias) conter mudanças de backend e frontend juntas.
- CI (quando existir) roda os dois pipelines a partir do mesmo commit.
