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

## Subir tudo em container (pra testar sem instalar nada)

Além do fluxo de dev acima (backend/frontend rodando direto na máquina), `docker-compose.yml` também sobe o backend e o frontend como containers — útil pra só testar a aplicação, sem precisar de JDK/Node instalados:

```bash
docker compose up -d --build
```

Isso builda as imagens (`backend/Dockerfile`, `frontend/Dockerfile`) e sobe cinco serviços: `postgres`, `mailpit`, `backend`, `frontend` (Nginx servindo o build de produção, com proxy reverso pras mesmas rotas de API que o Vite usa em dev - ver `frontend/nginx.conf`) e `seed` (roda uma vez, cria o primeiro usuário ADMIN depois que o backend migra o schema - sem isso `POST /usuarios` fica inacessível, porque exige um ADMIN que ainda não existe). O `seed` é idempotente: subir de novo sem apagar o volume não duplica nada.

Acesse `http://localhost:5173`. Login: e-mail `admin@escritor.io`, código chega em `http://localhost:8025` (Mailpit; se remapeada via `.env`, ver Troubleshooting abaixo, use a porta configurada em `MAILPIT_UI_PORT`). Esse usuário já nasce como membro (líder) de uma equipe ("Equipe Geral", id 1) pra já dar pra criar um quadro de teste sem precisar cadastrar mais nada primeiro.

`docker compose down` derruba tudo; `docker compose down -v` também apaga o volume do Postgres (perde os dados, inclusive o seed - a próxima subida recria do zero).

## Ciclo de desenvolvimento (TDD)

Ver [docs/testing-strategy.md](docs/testing-strategy.md) para o workflow completo. Resumo: teste de domínio no backend primeiro, depois web/repositório, depois componente no frontend, E2E só para os fluxos críticos listados lá.

## Troubleshooting

- **Porta 5432/8080/5173/1025/8025 já em uso:** as portas do host em `docker-compose.yml` (`postgres`, `backend`, `frontend`, `mailpit`) são configuráveis via `POSTGRES_PORT`/`BACKEND_PORT`/`FRONTEND_PORT`/`MAILPIT_SMTP_PORT`/`MAILPIT_UI_PORT` (padrão 5432/8080/5173/1025/8025). Se houver outro projeto local usando as mesmas portas, crie um `.env` na raiz (já no `.gitignore` — nunca commitar) remapeando só as portas do host:

  ```
  POSTGRES_PORT=5433
  BACKEND_PORT=8082
  FRONTEND_PORT=5175
  MAILPIT_SMTP_PORT=1026
  MAILPIT_UI_PORT=8026
  ```

  O `docker compose up` já lê o `.env` automaticamente. **Não use `docker-compose.override.yml` pra isso** — listas como `ports:` se *concatenam* entre `docker-compose.yml` e o override em vez de substituir, então a porta padrão (5432) continua sendo reivindicada junto com a nova, e o conflito persiste. Rodando backend/frontend direto na máquina (fora de container), aponte `spring.datasource.url` / `VITE_BACKEND_URL` pra essas mesmas portas. As portas padrão do projeto (5432, 8080, 5173, 1025, 8025) continuam sendo as documentadas — o `.env` é só local, pra rodar em paralelo com outro projeto que já as ocupa. Só o `SPRING_MAIL_PORT` do container `backend` (`docker-compose.yml`) fica fixo em `1025` mesmo com `MAILPIT_SMTP_PORT` remapeado - é tráfego container-a-container dentro da rede do compose, não passa pela porta remapeada do host.
