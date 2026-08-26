# Rodando o projeto localmente

> Backend existe desde a fatia S0.1 (ver [docs/incremental-plan.md](docs/incremental-plan.md)). Frontend ainda não foi criado (fatia S0.2).

## Pré-requisitos

- Java 21+ (JDK)
- Node.js 20+ e npm
- Docker (para o Postgres local **e** para os testes do backend via Testcontainers)

Maven **não** precisa estar instalado — o projeto usa o Maven Wrapper (`./mvnw`, `mvnw.cmd` no Windows), que baixa a versão correta automaticamente.

## Banco de dados local

```bash
docker compose up -d
```

Sobe um Postgres em `localhost:5432` para uso do backend em modo `dev`. Os testes do backend **não** usam esse container — Testcontainers sobe um Postgres efêmero próprio a cada execução de suíte (ver [docs/adr/0004-testcontainers.md](docs/adr/0004-testcontainers.md)).

## Backend

```bash
cd backend
./mvnw spring-boot:run     # roda a aplicação em modo dev (requer o Postgres do docker-compose no ar)
./mvnw test                # testes unitários (Surefire) — rápidos, sem Docker
./mvnw verify               # unitários + integração (Failsafe/Testcontainers) — requer Docker ativo
```

No Windows, sem Git Bash/WSL, use `mvnw.cmd` no lugar de `./mvnw`.

`GET /health` (via Spring Boot Actuator) confirma que a aplicação subiu e conseguiu migrar o schema.

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
