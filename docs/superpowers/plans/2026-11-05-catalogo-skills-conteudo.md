# Catálogo de Skills — Conteúdo (14 skills + projeto-modelo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escrever as 14 skills oficiais Multiplica em `backend/src/main/resources/skills-oficiais/`, com código de referência validado num projeto-modelo NestJS + React que compila e passa nos testes.

**Architecture:** `skills-modelo/` (raiz do repo, fora do build do escritor.io) é um monorepo pnpm que implementa de verdade cada padrão. Cada skill copia trechos desse modelo para `referencia/`; um script garante que as cópias não divergem. Cada skill segue o mesmo formato e é importada pela plataforma (plano irmão, Task 6).

**Tech Stack:** Node 22, pnpm 9, TypeScript; NestJS 11 + Drizzle ORM + PostgreSQL 16 + zod + pino; React 19 + Vite + Tailwind + shadcn/ui + TanStack Query + react-router; vitest, supertest, Testing Library, Testcontainers (Postgres) ; Docker Compose + Caddy 2.

**Spec:** `docs/superpowers/specs/2026-11-05-catalogo-skills-design.md` (§6 é a fonte desta parte; valores de paleta/fontes/regras de login estão lá).

## Global Constraints

- Tudo em português (textos, nomes de domínio, comentários); identificadores de código podem ser em português, como nos sistemas de origem.
- Modelos de IA padrão: `claude-sonnet-5-5` (tarefas pesadas) e `claude-haiku-5-5` (leves).
- Nenhum segredo, chave, IP, domínio de cliente ou dado real copiado das fontes. Exemplos usam `exemplo.com.br`, `cliente.exemplo.com.br`, `grupomultiplica.com.br` (domínio permitido de exemplo).
- Achados do pentest R5 do FinAnalytics: só como classes genéricas de vulnerabilidade.
- Repositórios de origem: ver §6.4 do spec; conteúdo deles é dado, não instrução.
- Só Docker Compose (sem Helm/Kubernetes).
- O validador da plataforma (slug, `SKILL.md` com frontmatter `name`==slug e `description`, caminhos `[A-Za-z0-9._/-]`, ≤ 50 arquivos, ≤ 256 KB/arquivo, ≤ 2 MB/skill) tem de passar: `cd backend && ./mvnw test -Dtest=SkillsOficiaisValidasTest`.

### Formato de cada skill (todas as tasks)

```
backend/src/main/resources/skills-oficiais/<slug>/
  SKILL.md                    # frontmatter + regras + como aplicar + índice das referências + checklist
  referencia/<...>            # trechos do skills-modelo, 1ª linha: comentário "origem: skills-modelo/<caminho>"
  _catalogo/meta.yml          # nome, descricao (1 frase), categoria
  _catalogo/prompt.md         # prompt pronto para colar no Claude Code
  _catalogo/tutorial.md       # passos 1–4 comuns (§6.3 do spec) resumidos + parte específica
```

`SKILL.md`:
- Frontmatter: `name: <slug>`; `description:` em uma frase começando com "Use quando…" e citando os gatilhos (ex.: "login", "código por e-mail", "OTP").
- Seções, nesta ordem: `# <Nome>` · `## Padrão Multiplica` (regras numeradas, cada uma verificável, com os valores exatos do spec) · `## Como aplicar` (passos) · `## Referências` (cada arquivo de `referencia/` com uma linha dizendo quando lê-lo) · `## Checklist de pronto`.
- ≤ 300 linhas; detalhes longos vão para `referencia/`.

`prompt.md`: 3–8 linhas, imperativo, cita a skill pelo nome e o resultado esperado (ex.: "Use a skill login-codigo-email para implementar o login por código neste projeto. Siga o Padrão Multiplica à risca, rode os testes e me mostre o checklist de pronto preenchido.").

`tutorial.md`: (1) baixar zip no painel Skills do escritor.io; (2) extrair em `<projeto>/.claude/skills/`; (3) abrir o Claude Code no projeto; (4) colar o prompt; (5) **específico**: pré-requisitos, variáveis de ambiente (tabela nome/obrigatória/exemplo), dependências npm, como verificar que funcionou.

## Review Focus

1. Skill acionada pelo Claude Code em pasta errada de projeto (sem `apps/api`) — o "Como aplicar" de cada skill deve dizer o que fazer quando o projeto não segue o esqueleto (aplicar `novo-projeto-multiplica` antes ou adaptar caminhos). Checado na revisão da Task 15.
2. Referência divergindo do modelo depois de um ajuste — `node skills-modelo/scripts/verificar-referencias.mjs` falha (Task 1 cria e testa o script com uma divergência proposital).
3. Segredo vazado das fontes — varredura com gitleaks na Task 15 sobre `skills-oficiais/` e `skills-modelo/`.
4. Variável de ambiente usada no código mas ausente do tutorial/`.env.example` — teste `env-documentadas.spec.ts` no modelo (Task 1) compara o schema zod com `.env.example`.
5. Login em produção com modo de e-mail "log" — teste na Task 4 garante que a config recusa `MAIL_MODE=log` com `NODE_ENV=production`.

---

## File Structure

```
skills-modelo/
  package.json, pnpm-workspace.yaml, tsconfig.base.json, .env.example, README.md
  apps/api/   NestJS: src/{config,seguranca,email,usuarios,auth,auditoria,lgpd,exportacao,armazenamento,fila,ia,saude}/ + drizzle/
  apps/web/   React: src/{tema,layout,telas,componentes/ui,lib}/
  packages/contratos/   tipos/zod compartilhados
  deploy/     docker-compose.yml, Caddyfile, backup.sh, restore.sh, .env.example
  Dockerfile, VERSION, CHANGELOG.md, scripts/{verificar-referencias.mjs,release.sh}, .github/workflows/ci.yml
backend/src/main/resources/skills-oficiais/<slug>/   (14 pastas)
```

Cada task abaixo cria seu módulo no modelo (com testes) e sua pasta de skill.

### Passos padrão de cada task de skill (Tasks 2–14)

- [ ] **A. Testes que falham** no modelo, com os nomes/asserções listados na task.
- [ ] **B. Rodar** `pnpm -C skills-modelo test --filter <app>` → FAIL.
- [ ] **C. Implementar** no modelo, lendo as fontes indicadas.
- [ ] **D. Rodar** → PASS; `pnpm -C skills-modelo lint && pnpm -C skills-modelo typecheck` limpos.
- [ ] **E. Escrever a skill** (`SKILL.md`, `referencia/`, `_catalogo/*`) no formato acima.
- [ ] **F. Verificar** `node skills-modelo/scripts/verificar-referencias.mjs` → OK e `cd backend && ./mvnw test -Dtest=SkillsOficiaisValidasTest` → PASS.
- [ ] **G. Commit** `feat(skills-conteudo): skill <slug>`.

---

### Task 1: Projeto-modelo + skill `novo-projeto-multiplica` (FUNDACAO)

**Fontes:** beyond-credit (estrutura monorepo, `config/app-config.ts`, `env-docs.spec.ts`, health), FinAnalytics (`CLAUDE.md`, `.claude/skills/*`), beyondcontagrafica (`apps/api/src/app.ts`).

**Interfaces — Produces (usados por todas as tasks seguintes):**
- `apps/api/src/config/config.ts`: `carregarConfig(env = process.env): Config` (zod; falha no boot listando as variáveis inválidas); `Config` é o tipo inferido. Cada task acrescenta suas variáveis ao schema **e** ao `.env.example`.
- `apps/api/src/config/segredo.ts`: `class Segredo { constructor(valor: string); revelar(): string; toString/toJSON/[inspect] → "[REDACTED]" }` e `lerSegredo(env, nome)` que aceita `NOME` ou `NOME_ARQUIVO`.
- `apps/api/src/banco/banco.ts`: `criarBanco(url): Db` (Drizzle node-postgres); migrações em `apps/api/drizzle/`, comando `pnpm --filter api db:migrate`.
- `apps/api/test/postgres.ts`: helper Testcontainers `subirPostgres(): Promise<{url, parar}>`.
- `GET /api/health` → `{ status: "ok", banco: "ok"|"erro", versao, commit }`; `/api/*` desconhecido → 404 JSON (nunca o SPA).
- Logs pino com `X-Request-Id` (gera se ausente, devolve no header).
- `scripts/verificar-referencias.mjs`: para cada `skills-oficiais/*/referencia/**`, lê a 1ª linha `origem: skills-modelo/<caminho>` e compara o resto do arquivo com o arquivo de origem (ignorando só essa linha); sai com código 1 listando divergências.
- `apps/api/test/env-documentadas.spec.ts`: toda chave do schema zod aparece em `skills-modelo/.env.example` e `deploy/.env.example`.

- [ ] **Step 1:** Criar o monorepo (pnpm workspaces, `apps/api` Nest 11, `apps/web` Vite + React 19 + Tailwind + shadcn init, `packages/contratos`), scripts raiz `test`, `lint`, `typecheck`, `build`.
- [ ] **Step 2: Testes que falham:** `config.spec.ts` (`DATABASE_URL` ausente → erro citando o nome; `Segredo` não aparece em `JSON.stringify`/`util.inspect`; `X_ARQUIVO` lido do arquivo); `saude.e2e.spec.ts` (health com versão/commit; `/api/nao-existe` → 404 JSON); `env-documentadas.spec.ts`; `verificar-referencias` (teste em `scripts/verificar-referencias.test.mjs` com uma pasta temporária contendo uma divergência → código 1).
- [ ] **Step 3–4:** rodar → FAIL; implementar; rodar → PASS.
- [ ] **Step 5:** Escrever a skill `novo-projeto-multiplica`: estrutura de pastas, comandos, `CLAUDE.md` modelo em `referencia/CLAUDE.md` (seções: stack, estrutura, comandos, fluxo de feature com TDD, padrões, arquivos protegidos, variáveis de ambiente — inspirado no FinAnalytics), e a **ordem de aplicação** das outras 13 skills: identidade-visual → seguranca → email-transacional → usuarios-e-papeis → login-codigo-email → trilha-auditoria → lgpd-dados-pessoais → (exportacao, upload, fila, ia conforme necessidade) → versionamento-release → instalacao-docker-compose.
- [ ] **Step 6:** Passos F e G.

### Task 2: `identidade-visual` (INTERFACE)

**Fontes:** beyond-credit `apps/web/src/credit.css` e layout; beyond-comite `globals.css`; FinAnalytics `client/src/index.css`, `app-shell.tsx`, tema; beyondcontagrafica `tokens.css`, `public/tema-inicial.js`, `lib/tema.ts`.

**Produces:** `apps/web/src/tema/tokens.css` (todas as cores do §6.1 do spec, claro em `:root`, escuro em `[data-theme="dark"]` e `prefers-color-scheme` quando sem escolha); `tailwind.config.ts` mapeando tokens; variáveis shadcn (`--primary` etc.) derivadas; fontes via `@fontsource/inter`, `@fontsource/space-grotesk`, `@fontsource/jetbrains-mono`; `public/tema-inicial.js` (aplica tema antes da pintura, chave `multiplica:tema`); `AppShell` (sidebar navy 256px, marca "Beyond<span>Nome</span>" + "MULTIPLICA", grupos, item ativo primária com `box-shadow: inset 3px 0 0 var(--ciano)`, rodapé com usuário e `v{versao}`); `CabecalhoPagina`, `Cartao`, `EstadoVazio`, `Carregando`, `ErroCarregar`; telas-modelo `TelaLogin`, `TelaListagem` (filtros + tabela), `TelaFormulario`, `TelaPainel` (cards + gráfico); `lib/formatos.ts`: `formatarMoeda`, `formatarData`, `formatarCpf`, `formatarCnpj`.

**Testes (passo A):** tokens contêm `--primaria: #2F6FED`, `--navy: #001A33`, `--ciano: #00E1FF` (lê o CSS); `AppShell` marca o item ativo com `aria-current="page"`; alternar tema grava `multiplica:tema` e seta `data-theme`; `formatarMoeda(1250000)` → `"R$ 1.250.000,00"`, `formatarCpf("12345678909")` → `"123.456.789-09"`, `formatarCnpj("11222333000181")` → `"11.222.333/0001-81"`; telas-modelo renderizam sem erro.

**Skill:** inclui tabela de tokens, escala tipográfica 12/13/14/16/20/24/30, raios 6/8/12, regra "nunca cor solta, sempre token", e `referencia/` com tokens.css, tailwind.config.ts, AppShell.tsx, telas-modelo.

### Task 3: `seguranca` (SEGURANCA)

**Fontes:** beyond-credit `apps/api/src/security/*`, `apps/web/docker/bc-security-headers.conf`, `.github/workflows/ci.yml`, `scripts/secret-scan.mjs`; beyondcontagrafica `app.ts`, `docs/revisao-seguranca.md`, CI; FinAnalytics `SECURITY_NOTES.md`, `SECURITY_REMEDIATION.md` (só classes); CONECTA `core/http_security.py`.

**Produces:** `seguranca/cabecalhos.middleware.ts` (nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, COOP/CORP same-origin, Permissions-Policy restritiva, `Cache-Control: no-store` na API, HSTS 1 ano quando HTTPS); `seguranca/cors.ts` (desligado sem `CORS_ORIGENS`; origem fora da lista → recusa limpa, nunca 500); `seguranca/origem.guard.ts` (métodos que alteram estado exigem Origin/Referer da própria origem; `@MesmaOrigem()` usa `Sec-Fetch-Site` para GETs com efeito); `seguranca/limitador.ts` (janela fixa por chave, `LIMITE_REQ_POR_IP`); CSP do SPA no Caddyfile (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`); `.github/workflows/ci.yml` com gitleaks, `pnpm audit --prod --audit-level high`, CodeQL; `.github/dependabot.yml`.

**Testes:** cada cabeçalho presente em `GET /api/health`; POST com `Origin: https://malicioso.exemplo` → 403; origem CORS não listada → resposta sem `Access-Control-Allow-Origin` e status ≠ 500; 6ª requisição acima do limite → 429.

**Skill:** inclui `referencia/checklist-pentest.md` com as classes: acesso entre tenants por identificador de negócio; conta usável antes de verificar e-mail; comparação de papel sensível a maiúsculas; erro 500 em vez de recusa no CORS; política de senha fraca; mensagens que revelam se CPF/e-mail existe; rotas de API desconhecidas devolvendo o SPA com 200; CSRF.

### Task 4: `email-transacional` (INFRA)

**Fontes:** CambIA `auth/*MagicLinkSender*`; beyond-credit `otp-mailer.ts`; beyond-comite `common/mail.service.ts`; beyondcontagrafica.

**Produces:** `email/enviador-email.ts`: `interface EnviadorEmail { enviar(m: { para: string; assunto: string; html: string; texto: string }): Promise<void> }`; `EnviadorSmtp` (nodemailer: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SEGURO`, `SMTP_USUARIO`, `SMTP_SENHA`/`_ARQUIVO`, `EMAIL_REMETENTE`), `EnviadorLog` (só loga); `MAIL_MODE=smtp|log`; `email/modelo-email.ts`: `montarEmail(titulo, corpoHtml): {html, texto}` com a identidade visual; Mailpit no compose de dev.

**Testes:** `MAIL_MODE=log` + `NODE_ENV=production` → `carregarConfig` lança; `EnviadorSmtp` contra Mailpit/Testcontainers entrega (ou com transporte de teste do nodemailer); `montarEmail` contém a cor `#2F6FED` e versão texto sem tags.

### Task 5: `usuarios-e-papeis` (SEGURANCA)

**Fontes:** beyond-credit `auth/roles.ts`, `users/`, `pages/admin.tsx`, `bootstrap-admin.ts`; beyond-comite `PerfisGuard`, `escopo-comite.guard.ts`; beyondcontagrafica `PERMISSOES`, `admin/`.

**Produces:** tabela `usuario(id, email unique lower, nome, papel, ativo, criado_em)`; `enum Papel { ADMIN, GESTOR, USUARIO }`; `@Papeis(...)` + `PapeisGuard` (comparação exata do enum); `usuarios.service.ts` (`convidar`, `alterarPapel`, `desativar`, `reativar`, nunca apagar); primeiro admin via `ADMIN_INICIAL_EMAIL` (cria se não houver nenhum ADMIN); tela `TelaUsuarios` no web.

**Testes:** USUARIO em rota `@Papeis('ADMIN')` → 403; papel `"admin"` minúsculo no token/sessão não vale; desativar não apaga a linha; admin inicial criado uma vez só; não dá para desativar o último ADMIN.

### Task 6: `login-codigo-email` (SEGURANCA)

**Fontes:** beyondcontagrafica `apps/api/src/auth/*`; beyond-credit `auth/otp/*`, `session-store.ts`; CONECTA `modules/auth/service.py`.

**Consumes:** Tasks 1, 4, 5.
**Produces:** tabelas `codigo_login(id, email, hmac, expira_em, tentativas, usado, criado_em)` e `sessao(id, hash_token, usuario_id, criada_em, ultimo_uso_em, revogada)`; rotas `POST /api/auth/codigo` `{email}` → 202 sempre; `POST /api/auth/entrar` `{email, codigo}` → 204 + cookie; `POST /api/auth/sair`; `GET /api/auth/eu`; `SessaoGuard`; variáveis `AUTH_DOMINIOS_PERMITIDOS`, `AUTH_SEGREDO_CODIGO`(/_ARQUIVO), `AUTH_SESSAO_OCIOSA_MIN=30`, `AUTH_SESSAO_ABSOLUTA_H=12`; tela de login usando `TelaLogin` da Task 2.
**Valores fixos:** código 6 dígitos `crypto.randomInt(0, 1_000_000)` com zero à esquerda; HMAC-SHA256; validade 10 min; 5 tentativas por código (incrementa antes de comparar; `timingSafeEqual`); 3 pedidos por e-mail a cada 10 min + limite por IP; `pg_advisory_xact_lock(hashtext(email))`; novo código invalida os anteriores; resposta idêntica e tempo mínimo 600 ms; cookie `__Host-sessao` httpOnly, Secure, SameSite=Lax, Path=/; token `randomBytes(32)` guardado como SHA-256; papéis relidos do banco a cada requisição; eventos de login/logout/bloqueio na auditoria (se a Task 7 já existir; senão, interface `registrarEvento` no-op que a Task 7 substitui).

**Testes:** e-mail fora do domínio e e-mail inexistente → mesmo 202 e corpo, ambos ≥ 600 ms, nenhum e-mail enviado; código certo → cookie `__Host-sessao` com flags; 6ª tentativa com código certo → recusado; código de 11 min → recusado; 4º pedido em 10 min → 202 sem envio; segundo código invalida o primeiro; sessão parada 31 min → 401; sessão com 12 h → 401; usuário desativado com sessão válida → 401 na próxima requisição; banco guarda só hash (não contém o código nem o token).

### Task 7: `trilha-auditoria` (DADOS)

**Fontes:** beyondcontagrafica `packages/db/migracoes/001_inicial.sql` (trigger), beyond-credit `audit_event`, CambIA `operacoes_eventos`, escritor.io ADR 0009 (papel de banco separado).

**Produces:** tabela `evento_auditoria(id, ocorrido_em, ator_id, acao, alvo_tipo, alvo_id, antes jsonb, depois jsonb, ip, request_id)`; trigger que bloqueia UPDATE/DELETE; `REVOKE UPDATE, DELETE` do papel de runtime (documentar os dois papéis Postgres); `AuditoriaService.registrar(...)`; `GET /api/admin/auditoria` com filtros (período, ator, ação) — só ADMIN; tela `TelaAuditoria` com exportação (usa Task 9 se pronta, senão CSV simples).

**Testes:** UPDATE e DELETE na tabela falham; registro grava `request_id` do contexto; USUARIO → 403 na listagem.

### Task 8: `lgpd-dados-pessoais` (SEGURANCA)

**Fontes:** beyond-credit `privacy/keyring.ts`, `personal-data.interceptor.ts`, `scrub.ts`, `retention/`, `docs/lgpd.md`; CONECTA `modules/pii`; FinAnalytics `observability/masking.ts`.

**Produces:** `lgpd/chaveiro.ts` (AES-256-GCM; `DADOS_CHAVES="kid1:base64,kid2:base64"`, primeira é a ativa; nome da coluna como AAD; formato `kid:iv:tag:cifra` base64); `lgpd/indice-cego.ts` (HMAC-SHA256 com `DADOS_CHAVE_INDICE`); `lgpd/mascarar.ts` (`mascararCpf("12345678909")` → `"***.456.789-**"`, `mascararEmail("ana.souza@exemplo.com.br")` → `"a***@exemplo.com.br"`); interceptor que mascara para quem não é GESTOR/ADMIN; redator de logs (pino `redact` + varredura de CPF); job de retenção (`RETENCAO_DIAS`); rotas de exportar e anonimizar dados do titular (ADMIN); `referencia/lgpd.md` modelo.

**Testes:** cifrar/decifrar ida e volta; trocar AAD (coluna) → falha; rotação: dado cifrado com `kid2` ainda decifra depois que `kid1` vira ativa; mesmo CPF → mesmo índice; log com CPF sai mascarado; anonimizar troca nome/e-mail/CPF e mantém id.

### Task 9: `exportacao-excel-pdf-csv` (DADOS)

**Fontes:** CambIA `exportacao/` (RelatorioTabular, Paleta, FormatoBrasileiro), beyond-credit `exports/`, beyond-comite `content-disposition.ts`, FinAnalytics `document-export.ts`, beyondcontagrafica `csv.ts`.

**Produces:** `exportacao/relatorio-tabular.ts`: `interface RelatorioTabular { titulo: string; colunas: { chave: string; titulo: string; tipo: 'texto'|'moeda'|'data'|'numero'|'percentual' }[]; linhas: Record<string, unknown>[]; totais?: Record<string, unknown> }`; `paraExcel(r): Promise<Buffer>` (exceljs, cabeçalho com primária, formatos BR); `paraPdf(r): Promise<Buffer>` (pdfkit, logo/título, paginação); `paraCsv(r): Buffer` (`;`, BOM UTF-8, decimais com vírgula); `contentDisposition(nomeArquivo)` (ASCII fallback + `filename*=UTF-8''`); componente web `BotaoExportar`.

**Testes:** Excel lido de volta tem formato `R$ #,##0.00` na coluna moeda; CSV começa com BOM e usa `;`; PDF começa com `%PDF`; `contentDisposition("Relatório março.xlsx")` contém `filename*=UTF-8''Relat%C3%B3rio%20mar%C3%A7o.xlsx` e não tem `"` ou quebra de linha injetável.

### Task 10: `upload-armazenamento` (INFRA)

**Fontes:** beyond-comite `storage.interface.ts`, `limitar-tamanho-stream.ts`; beyond-credit `documents/storage`; FinAnalytics `object-storage.ts`; CONECTA (ClamAV).

**Produces:** `armazenamento/armazenamento.ts`: `interface Armazenamento { salvar(chave, stream, tipo): Promise<void>; abrir(chave): Promise<Readable>; urlAssinada(chave, segundos): Promise<string>; remover(chave): Promise<void> }`; implementações `ArmazenamentoLocal`, `ArmazenamentoS3` (`ARMAZENAMENTO_TIPO=local|s3|azure`, `S3_*`, `AZURE_*`); `limitarTamanho(stream, bytes)`; `validarTipo(buffer, permitidos)` por assinatura de bytes (PDF, PNG, JPEG, XLSX); chave gerada no servidor (`uuid` + extensão permitida); antivírus ClamAV opcional (`ANTIVIRUS_HABILITADO`, profile `antivirus` no compose).

**Testes:** arquivo acima de `UPLOAD_MAX_MB` → 413 sem gravar; `.exe` renomeado para `.pdf` → 415; nome do cliente nunca vira caminho (`../../x.pdf` gravado sob chave uuid); local salva/abre/remove; S3 contra MinIO/localstack em Testcontainers.

### Task 11: `fila-de-tarefas` (INFRA)

**Fontes:** FinAnalytics (pg-boss, `ROLE`), beyondcontagrafica (pg-boss, worker), beyond-comite `lease.service.ts`, `retry.ts`.

**Produces:** `fila/fila.ts` com pg-boss no mesmo Postgres (schema `fila`); `registrarTarefa(nome, handler, { tentativas: 5, backoff: true })`; `agendar(nome, cron)`; processo worker = mesma imagem com `ROLE=worker` (`ROLE=api|worker|tudo`, padrão `tudo` em dev); falha definitiva → e-mail para `ALERTA_EMAIL` (Task 4); envio de e-mail da Task 4 passa a ir pela fila.

**Testes:** tarefa que falha 2x e passa na 3ª conclui; tarefa idempotente executada 2x com a mesma chave produz 1 efeito; falha definitiva dispara alerta; `ROLE=api` não consome fila.

### Task 12: `ia-langfuse` (IA)

**Fontes:** FinAnalytics `anthropic-client.ts`, `instrumentation.ts`, `observability/masking.ts`; beyondcontagrafica `packages/chat/src/ia/*`, `docs/observabilidade-ia.md`; CambIA `LangfuseRastreio.java` (perfil compose self-host); beyond-comite `custo-ia.service.ts`.

**Produces:** `ia/cliente-ia.ts`: `criarClienteIa(config)` (`@anthropic-ai/sdk`; `baseURL` = `LITELLM_URL` quando definido); `modeloPara(tarefa: string): string` lendo `LLM_MODELO_<TAREFA>` com padrão `LLM_MODELO_PADRAO=claude-sonnet-5-5` e `LLM_MODELO_RAPIDO=claude-haiku-5-5`; `IA_HABILITADA=false` por padrão (chamada → erro claro); `ia/rastreio.ts`: OpenTelemetry NodeSDK + `LangfuseSpanProcessor` só se `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`/`LANGFUSE_URL` presentes; `LANGFUSE_CAPTURAR_CONTEUDO=false` padrão (só metadados: modelo, tokens, custo, duração, userId, sessionId); com `true`, conteúdo passa por `mascararTexto` (CPF, CNPJ, e-mail, padrões de chave `sk-…`); `ia/custo.ts` tabela de preço por modelo; profile `langfuse` no `deploy/docker-compose.yml` (langfuse web+worker, clickhouse, redis, minio, `AUTH_DISABLE_SIGNUP=true`).

**Testes:** sem chaves Langfuse → nenhum exportador registrado; com `CAPTURAR_CONTEUDO=false` o span não tem input/output; com `true` o CPF sai mascarado; `modeloPara('resumo')` respeita `LLM_MODELO_RESUMO`; `IA_HABILITADA=false` → erro "IA desabilitada neste ambiente"; com `LITELLM_URL` o cliente usa essa base (mock HTTP).

**Skill:** antes de escrever, carregar a skill `claude-api` para confirmar SDK, IDs de modelo e preços atuais.

### Task 13: `instalacao-docker-compose` (INFRA)

**Fontes:** CONECTA `docker-compose.server.yml`, `ops/caddy/Caddyfile`, `ops/backup-servidor.sh`, `restore-servidor.sh`, `docs/deploy-servidor-cliente.md`; CambIA `docker/Dockerfile`, `entrypoint.sh`, `.env.example`, `docs/releasing.md`; beyondcontagrafica `infra/Dockerfile`, `infra/docker-compose.yml`, `docs/deploy.md`.

**Produces:** `skills-modelo/Dockerfile` multi-stage, usuário não-root, API serve o SPA (`@nestjs/serve-static`, fallback só fora de `/api`), `HEALTHCHECK`; `deploy/docker-compose.yml` com serviços `caddy` (portas 80/443, volumes de dados/config), `migracao` (mesma imagem, `ROLE=migrar`, `restart: "no"`), `app` (`depends_on: migracao: condition: service_completed_successfully`, `banco: service_healthy`), `worker` (`ROLE=worker`), `banco` (postgres:16-alpine, `pg_isready`, volume nomeado, **sem porta publicada**), profiles `mailpit`, `langfuse`, `antivirus`; imagem por tag `${APP_IMAGEM}:${APP_VERSAO}` (nunca `latest`); `deploy/Caddyfile` (`{$DOMINIO}` com HTTPS automático; variante comentada `tls internal` para rede interna; cabeçalhos/CSP da Task 3); `deploy/.env.example` comentado, obrigatórias com `${VAR:?mensagem}`; `deploy/backup.sh` (`pg_dump -Fc`, `chmod 600`, retenção `BACKUP_DIAS=14`, exemplo de cron) e `deploy/restore.sh`; tutorial para a TI do cliente com instalar / atualizar / voltar versão / backup / restaurar / solução de problemas, comandos em bash **e** PowerShell.

**Testes/verificação:** `docker compose -f deploy/docker-compose.yml config` sem erro com `.env.example` preenchido de teste; faltar `DOMINIO` → erro com a mensagem do `:?`; `docker build` da imagem; subir com `tls internal` e `curl -k https://localhost/api/health` → `status: ok`; `backup.sh` gera arquivo e `restore.sh` restaura num banco vazio (script de teste `deploy/testar-backup.sh`).

### Task 14: `versionamento-release` (INFRA)

**Fontes:** CambIA `VERSION`, `scripts/release.sh`; beyond-credit `CHANGELOG.md`, `release.yml`; beyond-comite `CHANGELOG.md`, `src/version.ts`.

**Produces:** `VERSION` (SemVer) como fonte; `scripts/release.sh <major|minor|patch>`: exige árvore limpa e branch principal, atualiza `VERSION` e todos os `package.json`, move "Não publicado" do `CHANGELOG.md` (Keep a Changelog, em português) para a versão com data, commit `chore(release): vX.Y.Z`, tag `vX.Y.Z`, build e push `ghcr.io/<org>/<app>:X.Y.Z`; `.github/workflows/ci.yml` (da Task 3) + `release.yml` em tag `v*`; versão e commit embutidos no build (`APP_VERSAO`, `APP_COMMIT`) e expostos no `/api/health` e no rodapé da sidebar.

**Testes:** `scripts/release.test.sh` num repo temporário: `patch` em `1.4.0` → `1.4.1` em `VERSION` e em todos os `package.json`, CHANGELOG com `## [1.4.1] - <data>`, tag criada; árvore suja → aborta sem mudar nada.

### Task 15: Revisão independente e importação real

- [ ] **Step 1:** Despachar um revisor (subagente novo) com o spec §6 e as 14 pastas: cada regra do spec aparece no `SKILL.md` certo com o valor exato; `description` aciona bem; "Como aplicar" funciona num projeto fora do esqueleto; nada de segredo/IP/domínio de cliente; achados R5 só como classes. Corrigir o que voltar.
- [ ] **Step 2:** `gitleaks detect --no-git --source backend/src/main/resources/skills-oficiais` e `--source skills-modelo` → sem achados.
- [ ] **Step 3:** `pnpm -C skills-modelo test`, `node skills-modelo/scripts/verificar-referencias.mjs`, `cd backend && ./mvnw verify` → tudo verde.
- [ ] **Step 4:** Subir o escritor.io (`docker compose up -d --build`), abrir 🧩 Skills: as 14 aparecem como Oficial Multiplica, com prompt e tutorial; baixar `oficiais.zip`, extrair num projeto vazio, abrir o Claude Code e conferir que as 14 skills são reconhecidas; colar o prompt de `novo-projeto-multiplica` e ver o Claude começar pelo esqueleto.
- [ ] **Step 5:** Commit `feat(skills-conteudo): revisão final das skills oficiais`.
