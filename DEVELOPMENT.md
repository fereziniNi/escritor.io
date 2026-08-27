# Rodando o projeto localmente

> Backend (S0.1) e frontend (S0.2) já existem como esqueleto — ver [docs/incremental-plan.md](docs/incremental-plan.md).

## Pré-requisitos

- Java 21+ (JDK)
- Node.js 20+ e npm
- Docker (para o Postgres local **e** para os testes do backend via Testcontainers)

Maven **não** precisa estar instalado — o projeto usa o Maven Wrapper (`./mvnw`, `mvnw.cmd` no Windows), que baixa a versão correta automaticamente.

## Banco de dados local

```bash
docker compose up -d
```

Sobe um Postgres em `localhost:5432` e o Mailpit (SMTP fake para o login por e-mail — ver [docs/adr/0008-login-passwordless-email.md](docs/adr/0008-login-passwordless-email.md)) para uso do backend em modo `dev`. Nenhum e-mail sai de verdade: veja os códigos de login recebidos em **http://localhost:8025**. Os testes do backend **não** usam esses containers — Testcontainers sobe os seus próprios efêmeros a cada execução de suíte (ver [docs/adr/0004-testcontainers.md](docs/adr/0004-testcontainers.md)).

Na **primeira** subida (volume `postgres_data` vazio), o Postgres também cria o papel `presenca_app` — o papel de runtime que a aplicação usa, sem privilégio de dono sobre as tabelas (ver [ADR 0009](docs/adr/0009-papel-de-banco-separado-para-runtime.md)). Se você já tinha um volume de antes dessa fatia (S2.1) e o backend falhar ao subir com "role presenca_app does not exist", recrie o volume: `docker compose down -v && docker compose up -d`.

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
npm run dev                # servidor de desenvolvimento (proxy /health -> backend em localhost:8080)
npm test                   # testes unitários/componente (Vitest + Testing Library + MSW)
npm run build               # type-check (tsc -b) + build de produção
```

Playwright (E2E) entra na primeira fatia que tiver um fluxo crítico de verdade para cobrir (ver [docs/testing-strategy.md](docs/testing-strategy.md) §4) — ainda não configurado.

O endereço do backend usado pelo proxy de dev é configurável via `VITE_BACKEND_URL` (padrão `http://localhost:8080`) — útil se a porta 8080 já estiver em uso por outro projeto na máquina.

## Ciclo de desenvolvimento (TDD)

Ver [docs/testing-strategy.md](docs/testing-strategy.md) para o workflow completo. Resumo: teste de domínio no backend primeiro, depois web/repositório, depois componente no frontend, E2E só para os fluxos críticos listados lá.

## Troubleshooting

- **Porta 5432/8080/5173 já em uso:** se houver outro projeto local usando as mesmas portas, suba o Postgres deste projeto em outra porta (`docker compose run --service-ports -p 5433:5432 postgres` ou edite `docker-compose.yml` localmente sem commitar) e aponte `spring.datasource.url` / `VITE_BACKEND_URL` de acordo. As portas padrão do projeto (5432, 8080, 5173) continuam sendo as documentadas — o ajuste é só para rodar em paralelo com outro projeto que já as ocupa.
