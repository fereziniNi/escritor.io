# skills-modelo

Projeto-modelo do **padrão Multiplica** para sistemas novos. Ele existe para provar que o código de referência das
skills oficiais do escritor.io (`backend/src/main/resources/skills-oficiais/<slug>/referencia/`) compila, passa nos
testes e funciona junto. Não faz parte do build do escritor.io (que usa Maven e o `frontend/` com npm).

| Pasta | O que é |
|---|---|
| `apps/api` | NestJS 11 + Drizzle + PostgreSQL 16, config validada com zod, logs pino com request-id, `/api/health` |
| `apps/web` | React 19 + Vite + Tailwind 4 + shadcn/ui + TanStack Query + react-router |
| `packages/contratos` | esquemas zod e tipos usados pela API e pela web |
| `deploy/` | arquivos de instalação no cliente (Docker Compose; `deploy/caddy/seguranca.caddy` com cabeçalhos e CSP) |
| `.github/` | CI e Dependabot de referência para os repositórios dos sistemas novos (não é a CI do escritor.io) |
| `estagios/` | versões anteriores de arquivos que uma skill posterior alterou, para a `referencia/` da skill anterior |
| `scripts/verificar-referencias.mjs` | confere que cada `referencia/` das skills é cópia fiel deste projeto |

## Comandos

Pré-requisitos: Node 22.22+ (ou 24), pnpm 9 (`corepack enable`), Docker (os testes sobem Postgres com Testcontainers).

```bash
pnpm install
pnpm test          # todos os testes (api com Postgres real via Testcontainers, web, scripts)
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter api test        # só um app
node scripts/verificar-referencias.mjs   # referencia/ das skills == código daqui
pnpm --filter web e2e         # Playwright com a API simulada (depois de pnpm build)
# Login de verdade (API + Postgres + Mailpit DESCARTÁVEIS: o teste apaga a caixa do Mailpit). Comandos dos
# contêineres e das variáveis E2E_* no topo de apps/web/e2e/login-real.config.ts; depois de pnpm build, em apps/web:
pnpm exec playwright test -c e2e/login-real.config.ts
```

Rodar local: `docker compose up -d postgres`, `cp .env.example .env`, `pnpm --filter api db:migrate`, `pnpm dev`
(API em http://localhost:3000/api/health, web em http://localhost:5173).

Dois papéis de banco (skill `trilha-auditoria`): `DATABASE_URL` é o **dono** (só migrações) e `DATABASE_URL_RUNTIME` o papel `app_runtime`
(o que a API usa; sem UPDATE/DELETE na trilha de auditoria). Em dev, depois de migrar:
`docker compose exec postgres psql -U app -d app -c "ALTER ROLE app_runtime LOGIN PASSWORD 'app_runtime'"` e descomente
`DATABASE_URL_RUNTIME` no `.env`. Sem a variável a API usa o dono (ok em dev; o gatilho do banco continua protegendo a trilha).

## Regra das referências

Cada arquivo em `skills-oficiais/<slug>/referencia/` começa com um comentário na sintaxe dele contendo
`origem: skills-modelo/<caminho>` e o resto é idêntico ao arquivo daqui. Mudou o código aqui? Rode
`node scripts/verificar-referencias.mjs --atualizar` e revise o diff das skills.

- Sem essa linha só é aceito `.md` (modelo/documento, ex.: `CLAUDE.modelo.md`). Num `.md`, cada bloco de código
  precedido de `<!-- arquivo: skills-modelo/<caminho> -->` é conferido com o arquivo: é assim que `package.json`,
  `tsconfig.json` e outros JSON entram numa skill (ex.: `referencia/configuracao.md`). `.json` em `referencia/` é
  recusado.
- Nenhum arquivo de skill se chama `CLAUDE.md` (o Claude Code o carregaria como memória do projeto).
- `referencia/` é autossuficiente: todo arquivo que uma cópia importa também está em `referencia/` (ou na
  `referencia/` de uma skill anterior, dito explicitamente no SKILL.md).
