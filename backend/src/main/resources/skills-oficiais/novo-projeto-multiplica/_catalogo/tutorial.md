# Tutorial — Novo projeto Multiplica

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **novo-projeto-multiplica**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/novo-projeto-multiplica/SKILL.md`.
3. Abra o Claude Code na pasta do projeto (pode ser uma pasta vazia) e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill, trocando `<NOME>` e a frase sobre o sistema.

## Parte específica desta skill

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Node.js | 22.22 ou mais nova (24 recomendado) | `node --version` |
| pnpm | 9.15.4 | `corepack enable` e depois `pnpm --version` |
| Docker Desktop (ou Docker Engine) | atual, ligado | `docker info` |
| Git | qualquer recente | `git --version` |

O Docker é usado pelo banco de desenvolvimento e pelos testes (o Testcontainers sobe um PostgreSQL 16 sozinho).

### Variáveis de ambiente

O Claude Code cria o `.env.example` (versionado, sem segredos reais); **você** cria o `.env` a partir dele (passo 3
de "Como verificar") e nunca o envia para o git. Na instalação no cliente, use
`deploy/.env.example`. Qualquer variável pode vir de arquivo com `NOME_ARQUIVO=/caminho` (ex.: Docker secret).

| Nome | Obrigatória | Exemplo |
|---|---|---|
| `DATABASE_URL` | sim | `postgres://app:app@localhost:5432/app` |
| `NODE_ENV` | não (padrão `development`) | `production` |
| `PORT` | não (padrão `3000`) | `3000` |
| `LOG_LEVEL` | não (padrão `info`) | `debug` |
| `APP_VERSAO` | não (preenchida no build da imagem) | `1.0.0` |
| `APP_COMMIT` | não (preenchida no build da imagem) | `abc1234` |
| `WEB_DIST` | não (só quando a API serve a web) | `/app/web` |

### Dependências npm

Instaladas pelo `pnpm install` com versões fixas. Principais: `@nestjs/common`, `@nestjs/core`,
`@nestjs/platform-express`, `drizzle-orm`, `pg`, `zod`, `nestjs-pino`, `pino`, `react`, `react-dom`, `react-router`,
`@tanstack/react-query`, `tailwindcss`, `@tailwindcss/vite`, `vite`; para testes `vitest`, `supertest`,
`@testcontainers/postgresql`, `@testing-library/react`, `@playwright/test`.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o
   PowerShell, depois `cd <caminho-do-projeto>`).
2. Instale as dependências: `pnpm install`.
3. Crie o seu `.env` a partir do exemplo:
   - bash / Git Bash / macOS / Linux: `cp .env.example .env`
   - PowerShell: `Copy-Item .env.example .env`
4. `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam sem erro (o Docker precisa estar ligado).
5. Teste no navegador de verdade (fora do `pnpm test`): `pnpm --filter web e2e`. Na primeira vez rode antes
   `pnpm --filter web exec playwright install chromium`.
6. Suba o banco e o sistema: `docker compose up -d postgres`, depois `pnpm --filter api db:migrate` e `pnpm dev`.
7. Abra http://localhost:3000/api/health: deve aparecer `{"status":"ok","banco":"ok",...}`.
8. Abra http://localhost:3000/api/qualquer-coisa: deve aparecer um erro 404 em JSON (não uma página).
9. Abra http://localhost:5173: a tela mostra "API no ar" e "Banco ok".
10. Existe um `CLAUDE.md` na raiz do projeto, sem trechos `<...>` sobrando.

Próximo passo: aplicar `identidade-visual` e seguir a ordem indicada no fim da resposta do Claude Code.
