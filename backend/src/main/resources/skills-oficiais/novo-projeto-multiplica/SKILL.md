---
name: novo-projeto-multiplica
description: Use quando for criar um sistema novo da Multiplica do zero, montar o esqueleto ou monorepo de um projeto (NestJS, React, pnpm), padronizar um projeto que ainda não segue o padrão Multiplica, escrever o CLAUDE.md do projeto, ou quando outra skill Multiplica pedir o esqueleto (apps/api, apps/web, packages/contratos) e ele não existir.
---

# Novo projeto Multiplica

Esqueleto único dos sistemas novos da Multiplica: monorepo pnpm com `apps/api` (NestJS 11 + Drizzle + PostgreSQL 16),
`apps/web` (React 19 + Vite + Tailwind + shadcn/ui + TanStack Query) e `packages/contratos`. As outras 13 skills
Multiplica assumem este esqueleto e estes caminhos. O código em `referencia/` é cópia de um projeto-modelo que
compila e passa nos testes: copie e adapte, não reescreva de memória.

## Padrão Multiplica

1. **Monorepo pnpm**: `pnpm-workspace.yaml` com `apps/*` e `packages/*`; `package.json` raiz com
   `"packageManager": "pnpm@9.15.4"`, `"engines": { "node": ">=22.22" }` e os scripts `dev`, `build`, `lint`,
   `typecheck`, `test` (todos `pnpm -r <script>`). Pacotes `api`, `web` e `contratos` (`workspace:*`).
2. **Versões fixas** (sem `^`/`~`) em todos os `package.json`, e `pnpm-lock.yaml` versionado. Versões validadas no
   modelo: NestJS 11.2.8, drizzle-orm 0.45.4, drizzle-kit 0.31.11, pg 8.23.1, zod 4.6.7, nestjs-pino 5.3.1,
   pino 10.4.0, React 19.3.1, Vite 8.3.6, Tailwind 4.3.4, @tanstack/react-query 5.106.1, react-router 8.5.1,
   TypeScript 6.0.3, vitest 5.1.0, @testcontainers/postgresql 12.2.1, @playwright/test 1.64.1, ESLint 10.14.0.
3. **Config validada no boot** em `apps/api/src/config/config.ts`: um único schema zod (`esquemaConfig`) com todas as
   variáveis; `carregarConfig(env = process.env): Config` lança `ErroConfiguracao` listando **todas** as variáveis
   inválidas pelo nome, **nunca o valor**; o `main.ts` imprime um JSON `level: fatal` e sai com código 1.
4. **Segredos**: senha, chave ou URL com senha vira `Segredo` (`revelar()`; `toString`, `toJSON` e `util.inspect`
   devolvem `[REDACTED]`). Toda variável aceita `NOME_ARQUIVO=/caminho` (Docker secret); `NOME` e `NOME_ARQUIVO`
   juntos é erro. `DATABASE_URL` é `Segredo`.
5. **Variáveis documentadas**: toda chave do schema aparece em `.env.example` (dev) **e** em `deploy/.env.example`
   (instalação), como `NOME=` ou `# NOME=` com comentário. O teste `test/env-documentadas.spec.ts` cobra isso.
6. **Logs pino** (nestjs-pino) em JSON no stdout. Cada requisição tem `X-Request-Id`: reaproveita o recebido se casar
   com `^[A-Za-z0-9._-]{8,128}$`, senão gera um UUID; devolve sempre no header da resposta. O log da requisição tem
   só `id`, `method`, `path` (sem query) e `statusCode`; headers, query e corpo são censurados. `console.*` é
   proibido pelo ESLint (`no-console: error`).
7. **API sob `/api`** (`setGlobalPrefix('api')`). `GET /api/health` responde
   `{ status, banco, versao, commit }`: 200 com `status: "ok", banco: "ok"`; 503 com `"erro"` quando o banco não
   responde a `select 1` em 2 s. `versao`/`commit` vêm de `APP_VERSAO`/`APP_COMMIT` (build da imagem; padrão `dev`
   e `desconhecido`).
8. **404 real para `/api/*`**: rota desconhecida em `/api` responde 404 em JSON `{ status, erro, requestId }`, nunca
   o `index.html`. Todo erro da API sai nesse formato (`FiltroErros` como `APP_FILTER`); 5xx responde
   `"Erro interno"` e o detalhe vai só para o log.
9. **Uma imagem serve tudo**: com `WEB_DIST` definida, a API serve o build da web; rota da web sem extensão devolve o
   `index.html` (`cache-control: no-cache`); arquivo inexistente (`/assets/x.js`) responde 404; `/assets/*` com cache
   de 1 ano (`immutable`).
10. **Banco**: `criarBanco(url): Db` (Drizzle node-postgres, `db.$client` é o Pool, fechado no desligamento);
    tabelas em `apps/api/src/banco/esquema.ts`; migrações geradas em `apps/api/drizzle/` com
    `pnpm --filter api db:generate` e aplicadas com `pnpm --filter api db:migrate` (`src/banco/executar-migracoes.ts`).
    SQL de migração nunca é editado à mão.
11. **Testes**: vitest em todos os pacotes. API com SWC (`unplugin-swc`, para os decorators do Nest), supertest e
    Postgres 16 real via Testcontainers: um container por bateria (`test/setup-global.ts`) e um banco novo, já
    migrado, por arquivo (`subirPostgres(): Promise<{ url, parar }>` em `test/postgres.ts`). Web com jsdom +
    Testing Library; ponta a ponta com Playwright (`apps/web/e2e/`). Sem mock do banco nos testes de integração.
12. **Web**: Tailwind 4 via `@tailwindcss/vite`; shadcn/ui com `components.json` apontando para `@/componentes/ui` e
    `@/lib/utils`; alias `@` → `src`; proxy do Vite `/api` → `http://localhost:3000`; chamadas à API só por
    `src/lib/api.ts`, validando a resposta com o esquema de `contratos`; TanStack Query sempre na forma de objeto.
13. **Contratos**: `packages/contratos` exporta esquemas zod e tipos (`z.infer`) usados pela API e pela web; o mesmo
    esquema que a web usa para ler é o que o teste da API usa para validar a resposta.
14. **CLAUDE.md** na raiz, a partir de `referencia/CLAUDE.md`, com as seções: Stack, Estrutura de pastas, Comandos,
    Fluxo de feature (TDD), Padrões, Arquivos protegidos, Variáveis de ambiente, Skills Multiplica aplicadas.
15. **`.gitignore`** com `node_modules/`, `dist/`, `.env`, `coverage/`, `test-results/`, `playwright-report/`.
    `.env` nunca é versionado; `.env.example` sempre.

## Como aplicar

**Projeto novo (pasta vazia ou só com README):**

1. Crie a estrutura: `apps/api/{src,test,drizzle/meta}`, `apps/web/{src,e2e}`, `packages/contratos/src`, `deploy/`.
2. Crie o `package.json` raiz (regra 1), `pnpm-workspace.yaml` (`referencia/pnpm-workspace.yaml`), um
   `tsconfig.base.json` com `strict` e `noUncheckedIndexedAccess`, o `.gitignore` (regra 15) e o
   `docker-compose.yml` de dev (`referencia/docker-compose.yml`).
3. `packages/contratos`: `package.json` com `"type": "module"` e `exports` `{ types: ./src/index.ts, development:
   ./src/index.ts, default: ./dist/index.js }`; copie `referencia/packages/contratos/src/saude.ts`.
4. `apps/api` (TDD): escreva **primeiro** `src/config/config.spec.ts`, `test/saude.e2e.spec.ts` e
   `test/env-documentadas.spec.ts` a partir de `referencia/`; rode `pnpm --filter api test` e veja falhar. Depois
   copie os arquivos de `referencia/apps/api/src/` e crie `drizzle/meta/_journal.json` com
   `{"version":"7","dialect":"postgresql","entries":[]}`. Rode de novo → passa.
5. `apps/web`: `vite.config.ts`, `components.json` (regra 12), `src/index.css` com `@import "tailwindcss";` e as
   variáveis do shadcn, `src/lib/utils.ts` (`cn`), depois o teste `src/telas/Inicio.test.tsx` → falha → `Inicio.tsx`,
   `App.tsx`, `lib/api.ts` → passa. Componentes shadcn: `pnpm dlx shadcn@latest add button` dentro de `apps/web`.
6. `.env.example` e `deploy/.env.example` com todas as variáveis (regra 5).
7. `CLAUDE.md` a partir de `referencia/CLAUDE.md`, trocando os `<...>` pelos dados do sistema.
8. Verifique: `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build`, depois
   `docker compose up -d postgres`, `cp .env.example .env`, `pnpm --filter api db:migrate`, `pnpm dev` e abra
   http://localhost:5173 (deve mostrar "API no ar" e "Banco ok").

**Projeto existente que não segue o esqueleto** (sem `apps/api`, outro framework, outra estrutura): não reescreva o
sistema. Pergunte ao usuário se quer migrar para o esqueleto. Se não quiser, aplique só as regras que independem de
stack (3–9, 14, 15) nos caminhos equivalentes do projeto e registre no `CLAUDE.md` onde ficou cada coisa, para as
próximas skills acharem.

**Ordem de aplicação das outras skills** (depois desta):

1. `identidade-visual` → 2. `seguranca` → 3. `email-transacional` → 4. `usuarios-e-papeis` →
5. `login-codigo-email` → 6. `trilha-auditoria` → 7. `lgpd-dados-pessoais` →
8. conforme a necessidade do sistema: `exportacao-excel-pdf-csv`, `upload-armazenamento`, `fila-de-tarefas`,
   `ia-langfuse` → 9. `versionamento-release` → 10. `instalacao-docker-compose`.

Ao terminar cada uma, acrescente-a em "Skills Multiplica aplicadas" no `CLAUDE.md`.

## Referências

- `referencia/CLAUDE.md` — modelo do CLAUDE.md do projeto; leia no passo 7.
- `referencia/pnpm-workspace.yaml` — workspaces do monorepo; passo 2.
- `referencia/docker-compose.yml` — Postgres 16 de desenvolvimento (só em 127.0.0.1); passo 2.
- `referencia/.env.example` — formato do .env de desenvolvimento, uma linha comentada por variável; passo 6.
- `referencia/packages/contratos/src/saude.ts` — exemplo de contrato zod compartilhado; passo 3.
- `referencia/apps/api/src/config/config.ts` — schema zod, `carregarConfig`, `ErroConfiguracao`; ao criar ou mudar variáveis.
- `referencia/apps/api/src/config/segredo.ts` — classe `Segredo` e `lerSegredo` (`NOME_ARQUIVO`); ao lidar com segredos.
- `referencia/apps/api/src/config/config.spec.ts` — testes da config e do `Segredo`; passo 4 (escrever antes).
- `referencia/apps/api/src/config/arquivo-env.ts` — carrega o `.env` de dev; junto com o `main.ts`.
- `referencia/apps/api/src/config/config.module.ts` — token `CONFIG` para injetar a config.
- `referencia/apps/api/src/main.ts` — boot com falha rápida em JSON.
- `referencia/apps/api/src/criar-app.ts` — cria a app (usado pelo main e pelos testes e2e).
- `referencia/apps/api/src/configurar-app.ts` — prefixo `/api`, SPA servido pela API, 404 de `/api/*`.
- `referencia/apps/api/src/app.module.ts` — módulo raiz e `FiltroErros` como `APP_FILTER`; ao registrar módulos.
- `referencia/apps/api/src/log/log.module.ts` — pino com request-id e campos censurados.
- `referencia/apps/api/src/http/filtro-erros.ts` — formato padrão de erro `{ status, erro, requestId }`.
- `referencia/apps/api/src/saude/saude.controller.ts` — `GET /api/health` com ping ao banco.
- `referencia/apps/api/src/banco/banco.ts` — `criarBanco` e token `BANCO`.
- `referencia/apps/api/src/banco/migrar.ts` e `executar-migracoes.ts` — aplicar migrações (dev, testes e Docker).
- `referencia/apps/api/vitest.config.mts` — vitest com SWC e o setup do Postgres.
- `referencia/apps/api/test/setup-global.ts` e `test/postgres.ts` — Testcontainers e `subirPostgres()`; ao escrever testes com banco.
- `referencia/apps/api/test/saude.e2e.spec.ts` — e2e de health, 404, SPA e request-id; passo 4 (escrever antes).
- `referencia/apps/api/test/env-documentadas.spec.ts` — garante as variáveis nos `.env.example`; passo 4.
- `referencia/apps/web/vite.config.ts` — Tailwind, alias `@` e proxy `/api`; passo 5.
- `referencia/apps/web/src/App.tsx` — QueryClient e roteador; ao criar telas.
- `referencia/apps/web/src/lib/api.ts` — chamada à API validada com `contratos`; ao chamar endpoints.
- `referencia/apps/web/src/telas/Inicio.tsx` e `Inicio.test.tsx` — tela + teste com Testing Library; passo 5.
- `referencia/apps/web/playwright.config.ts` — Playwright contra o `vite preview`.

## Checklist de pronto

- [ ] `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem limpos.
- [ ] Sem `DATABASE_URL`, `pnpm --filter api start` sai com código 1 e um JSON citando `DATABASE_URL` (sem valores).
- [ ] `JSON.stringify(config)` e `util.inspect(config)` não mostram a senha do banco (teste passando).
- [ ] `DATABASE_URL_ARQUIVO` funciona no lugar de `DATABASE_URL` (teste passando).
- [ ] `GET /api/health` → 200 `{ status: "ok", banco: "ok", versao, commit }`; banco parado → 503 com `"erro"`.
- [ ] `GET /api/nao-existe` → 404 JSON (mesmo com `Accept: text/html`); `GET /qualquer-tela` → `index.html` com `WEB_DIST`.
- [ ] Toda resposta tem `X-Request-Id`, e a linha de log da requisição traz o mesmo id.
- [ ] `test/env-documentadas.spec.ts` passa: todas as variáveis estão nos dois `.env.example`.
- [ ] Testes da API usam Postgres real (Testcontainers), não mock.
- [ ] Web mostra "API no ar" em http://localhost:5173 com `pnpm dev`.
- [ ] `CLAUDE.md` criado com todas as seções e sem `<...>` sobrando.
- [ ] `.env` fora do git; `pnpm-lock.yaml` versionado; versões sem `^`.
