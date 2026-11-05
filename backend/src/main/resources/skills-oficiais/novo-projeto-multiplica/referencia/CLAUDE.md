# CLAUDE.md — <Nome do sistema>

<Uma frase: o que o sistema faz e para quem.> Monorepo pnpm no padrão Multiplica (skill `novo-projeto-multiplica`).

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 11 + TypeScript (`apps/api`) |
| Banco | PostgreSQL 16 + Drizzle ORM (migrações em `apps/api/drizzle/`) |
| Config | zod no boot (`apps/api/src/config/config.ts`), segredos com `Segredo` e `*_ARQUIVO` |
| Logs | pino (nestjs-pino), JSON em stdout, `X-Request-Id` em toda requisição |
| Frontend | React 19 + Vite + Tailwind 4 + shadcn/ui (`apps/web`) |
| Estado/dados | TanStack Query v5 |
| Rotas web | react-router |
| Contratos | `packages/contratos` (esquemas zod usados pela API e pela web) |
| Testes | vitest + supertest + Testcontainers (API), vitest + Testing Library (web), Playwright (ponta a ponta) |
| Instalação | Docker Compose (uma imagem: a API serve o SPA) |

---

## Estrutura de pastas

```
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/      # schema zod das variáveis de ambiente, Segredo
│   │   │   ├── banco/       # Drizzle: conexão, esquema das tabelas, migrar
│   │   │   ├── log/         # pino + request-id
│   │   │   ├── http/        # filtro de erros (JSON padrão)
│   │   │   ├── saude/       # GET /api/health
│   │   │   └── <dominio>/   # um módulo Nest por domínio (controller fino + service + spec)
│   │   ├── test/            # e2e (*.spec.ts) e helpers (postgres.ts)
│   │   └── drizzle/         # SQL gerado pelo drizzle-kit (não editar à mão)
│   └── web/
│       └── src/
│           ├── telas/        # uma tela por arquivo + teste ao lado
│           ├── componentes/  # componentes do sistema; ui/ = shadcn (não editar à mão)
│           ├── layout/ tema/ # app shell e tokens (skill identidade-visual)
│           └── lib/          # api.ts (chamadas), utils.ts
├── packages/contratos/       # esquemas zod + tipos compartilhados
├── deploy/                   # docker-compose de instalação, .env.example de produção
├── .env.example              # variáveis de desenvolvimento
└── CLAUDE.md
```

---

## Comandos

```bash
pnpm install
docker compose up -d postgres      # banco de desenvolvimento
pnpm --filter api db:migrate       # aplica as migrações
pnpm dev                           # API (3000) + web (5173, com proxy de /api)
pnpm test                          # todos os testes (precisa de Docker: Testcontainers)
pnpm --filter api test             # só a API
pnpm lint && pnpm typecheck        # têm de sair limpos antes de commitar
pnpm build
pnpm --filter api db:generate      # gera migração depois de mudar src/banco/esquema.ts
```

---

## Fluxo de feature (TDD)

1. **Contrato** → `packages/contratos/src/<dominio>.ts`: esquema zod da entrada/saída.
2. **Teste que falha** → `apps/api/test/<dominio>.e2e.spec.ts` (Postgres real via `subirPostgres()`) e/ou
   `src/<dominio>/*.spec.ts`. Rodar e **ver falhar** pelo motivo certo.
3. **Tabela** (se precisar) → `apps/api/src/banco/esquema.ts` + `pnpm --filter api db:generate`.
4. **Implementar** → módulo Nest em `apps/api/src/<dominio>/` (controller fino, regra no service), registrar no
   `app.module.ts`. Rodar → passa.
5. **Web** → teste em `apps/web/src/telas/<Tela>.test.tsx` primeiro, depois a tela com `useQuery`/`useMutation`.
6. `pnpm lint && pnpm typecheck && pnpm test` limpos → commit pequeno com mensagem no imperativo.

---

## Padrões

### Backend
- Toda variável de ambiente nova entra em `config.ts` **e** nos dois `.env.example` (o teste `env-documentadas` cobra).
- Segredo (senha, chave, URL com senha) é `Segredo`; só `.revelar()` no ponto de uso. Nunca logar `config` inteiro
  com segredos revelados.
- Rotas sob `/api`. Erro sempre em JSON `{ status, erro, requestId }`; nunca stack ou SQL na resposta.
- Log só pelo pino (`PinoLogger`); `console.*` é proibido pelo lint. Nunca logar corpo de requisição, CPF, e-mail,
  token ou senha.
- Acesso a banco só pelo Drizzle injetado (`@Inject(BANCO) db: Db`); nada de SQL concatenado com entrada do usuário.

### Frontend
- TanStack Query v5 sempre na forma de objeto: `useQuery({ queryKey: [...], queryFn })`; invalidar após mutação.
- Chamadas à API só por `src/lib/api.ts` (valida com o esquema de `contratos`).
- Componentes shadcn via `@/componentes/ui/` (gerados pelo CLI do shadcn, não editar à mão).
- Textos de tela em português do Brasil; formatos BR (moeda, data, CPF/CNPJ).

---

## Arquivos protegidos — confirmar com o usuário antes de alterar

| Arquivo | Motivo |
|---------|--------|
| `package.json` (raiz e apps) | Versões fixas e scripts usados pela CI e pelo Docker |
| `pnpm-lock.yaml` | Só muda via `pnpm install`/`pnpm add` |
| `apps/api/drizzle/` | Gerado pelo drizzle-kit; migração aplicada não se edita, cria-se outra |
| `apps/api/src/config/config.ts` | Mudança afeta a instalação de todos os clientes (documentar no `.env.example`) |
| `apps/web/src/componentes/ui/` | Componentes gerados pelo shadcn |
| `deploy/` | Instalação no cliente; mudanças entram no CHANGELOG |
| `CLAUDE.md` | Este arquivo |

---

## Variáveis de ambiente

Fonte da verdade: `apps/api/src/config/config.ts`. Desenvolvimento: `.env.example` → `.env`. Instalação:
`deploy/.env.example`. Qualquer variável aceita `NOME_ARQUIVO=/run/secrets/nome` (segredo em arquivo).

| Variável | Obrigatória | Exemplo |
|----------|-------------|---------|
| `DATABASE_URL` | sim | `postgres://app:app@localhost:5432/app` |
| `NODE_ENV` | não (`development`) | `production` |
| `PORT` | não (`3000`) | `3000` |
| `LOG_LEVEL` | não (`info`) | `debug` |
| `APP_VERSAO` / `APP_COMMIT` | não (build da imagem) | `1.4.0` / `abc1234` |
| `WEB_DIST` | não | `/app/web` |

<Acrescente aqui as variáveis de cada skill aplicada (login, e-mail, IA...).>

---

## Skills Multiplica aplicadas

<Liste as skills já aplicadas, na ordem, com a data. Ex.: novo-projeto-multiplica (2026-11-05), identidade-visual (...).>
