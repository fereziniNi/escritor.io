# Rodando o projeto localmente

> Esqueleto ainda não existe (`/backend` e `/frontend` serão criados na fatia S0 do [plano incremental](docs/incremental-plan.md)). Este documento descreve como o setup vai funcionar assim que o scaffold existir — mantenha-o atualizado à medida que S0 avança.

## Pré-requisitos

- Java 21 (LTS)
- Maven 3.9+
- Node.js 20+ e npm
- Docker (para o Postgres local **e** para os testes do backend via Testcontainers)

## Banco de dados local

```bash
docker compose up -d
```

Sobe um Postgres em `localhost:5432` para uso do backend em modo `dev`. Os testes do backend **não** usam esse container — Testcontainers sobe um Postgres efêmero próprio a cada execução de suíte (ver [docs/adr/0004-testcontainers.md](docs/adr/0004-testcontainers.md)).

## Backend

```bash
cd backend
mvn spring-boot:run       # roda a aplicação em modo dev
mvn test                  # roda a suíte de testes (requer Docker ativo)
```

## Frontend

```bash
cd frontend
npm install
npm run dev                # servidor de desenvolvimento
npm test                   # testes unitários/componente (Vitest)
npm run test:e2e           # Playwright, requer backend rodando
```

## Ciclo de desenvolvimento (TDD)

Ver [docs/testing-strategy.md](docs/testing-strategy.md) para o workflow completo. Resumo: teste de domínio no backend primeiro, depois web/repositório, depois componente no frontend, E2E só para os fluxos críticos listados lá.
