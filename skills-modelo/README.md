# skills-modelo

Projeto-modelo do **padrão Multiplica** para sistemas novos. Ele existe para provar que o código de referência das
skills oficiais do escritor.io (`backend/src/main/resources/skills-oficiais/<slug>/referencia/`) compila, passa nos
testes e funciona junto. Não faz parte do build do escritor.io (que usa Maven e o `frontend/` com npm).

| Pasta | O que é |
|---|---|
| `apps/api` | NestJS 11 + Drizzle + PostgreSQL 16, config validada com zod, logs pino com request-id, `/api/health` |
| `apps/web` | React 19 + Vite + Tailwind 4 + shadcn/ui + TanStack Query + react-router |
| `packages/contratos` | esquemas zod e tipos usados pela API e pela web |
| `deploy/` | arquivos de instalação no cliente (Docker Compose) |
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
```

Rodar local: `docker compose up -d postgres`, `cp .env.example .env`, `pnpm --filter api db:migrate`, `pnpm dev`
(API em http://localhost:3000/api/health, web em http://localhost:5173).

## Regra das referências

Cada arquivo em `skills-oficiais/<slug>/referencia/` começa com um comentário na sintaxe dele contendo
`origem: skills-modelo/<caminho>` e o resto é idêntico ao arquivo daqui. Mudou o código aqui? Rode
`node scripts/verificar-referencias.mjs --atualizar` e revise o diff das skills. Arquivo de `referencia/` sem essa
linha é modelo/documento (ex.: o `CLAUDE.md` modelo) e não é conferido. Não use `.json` em `referencia/`.
