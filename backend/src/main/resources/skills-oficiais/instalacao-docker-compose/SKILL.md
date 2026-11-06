---
name: instalacao-docker-compose
description: Use quando um sistema Multiplica precisar ser instalado, atualizado ou restaurado no servidor do cliente - "Dockerfile", "docker compose de produção", "subir no servidor do cliente", "Caddy com HTTPS", "certificado", "tls internal", "deploy", "homologação", "backup do banco", "pg_dump", "restaurar backup", "voltar versão", "rollback", "tutorial de instalação para a TI", "worker e migração no compose". Cobre a imagem única (API serve o SPA; ROLE migrar/api/worker), o deploy/docker-compose.yml com Caddy, Postgres sem porta publicada, segredos em arquivo, profiles mailpit/antivirus/langfuse, backup/restore testados e o guia da TI em bash e PowerShell.
---

# Instalação com Docker Compose (padrão Multiplica)

Todo sistema Multiplica é instalado no servidor do cliente do **mesmo jeito**: uma imagem por versão, um `deploy/` com o compose, o
Caddy na frente com HTTPS, segredos em arquivo, backup que já foi restaurado de verdade e um guia para a TI do cliente. Os arquivos
de `referencia/` são cópia de um projeto-modelo que foi **subido de ponta a ponta** (build, HTTPS, login com código pelo Mailpit,
tarefa processada pelo worker, upload, backup, restauração, troca e volta de versão). Copie e adapte; não reescreva de memória.
Vem do CONECTA (`docker-compose.server.yml`, Caddy, backup/restore do servidor), do CambIA (Dockerfile, `.env.example`, releasing) e da
Conta Gráfica (imagem única, deploy). **Cada valor abaixo é fixo**; mudar um é decisão do cliente, registrada no `CLAUDE.md`.

## Padrão Multiplica

1. **Uma imagem por versão** (`Dockerfile` na raiz): multi-stage em `node:22.22.0-alpine3.22`; o estágio de build roda
   `pnpm install --frozen-lockfile`, builda `contratos`, `api` e `web` e faz `pnpm --filter api deploy --prod`; a imagem final só tem
   o build da API com dependências de produção (`/app`) e o build da web (`/app/web`). `ENV NODE_ENV=production` (**sempre**,
   inclusive homologação), `WEB_DIST=/app/web`, `ARMAZENAMENTO_PASTA=/dados/arquivos`, `APP_VERSAO`/`APP_COMMIT` por `--build-arg`.
   Roda como `USER node` (uid 1000); arquivos do app são do root (só leitura); o único lugar gravável é `/dados/arquivos`.
   `HEALTHCHECK` a cada 15 s em `/api/health` (para `ROLE=worker`/`migrar` só confere o processo). `CMD ["node", "dist/main.js"]`.
2. **`.dockerignore`** exclui `.env`, `.env.*` (menos `.env.example`), `node_modules`, `dist`, `.git`, `deploy/segredos`, `deploy/backups`.
3. **A API serve o SPA** (`WEB_DIST`, `configurar-app.ts` do esqueleto): `/api/*` nunca cai no SPA; `index.html` sem cache; `/assets/*`
   com cache de 1 ano. Não existe nginx nem contêiner separado para a web.
4. **`deploy/docker-compose.yml`**, serviços: `caddy` (`caddy:2.10.2-alpine`, **único com porta publicada**: `${PORTA_HTTP:-80}:80` e
   `${PORTA_HTTPS:-443}:443` tcp/udp, volumes `caddy_dados` e `caddy_config`, `depends_on: app healthy`); `migracao` (mesma imagem,
   `ROLE=migrar`, `restart: "no"`, `depends_on: banco healthy`); `app` (`ROLE=api`, **sem `ports:`**, `depends_on: migracao
   service_completed_successfully` e `banco service_healthy`, `stop_grace_period: 45s`, volume `arquivos:/dados/arquivos`);
   `worker` (`ROLE=worker`, mesmo volume, `stop_grace_period: 45s`); `banco` (`postgres:16-alpine`, `pg_isready -U app -d app`,
   volume nomeado `banco_dados`, **sem porta publicada**). Rede `interna`. `name: ${PROJETO:-sistema}`.
5. **Imagem por tag**: `"${APP_IMAGEM:?...}:${APP_VERSAO:?...}"`, **nunca `latest`**. Atualizar = trocar `APP_VERSAO` e `up -d`.
6. **Obrigatórias com `${VAR:?mensagem}`**: `DOMINIO`, `CADDY_TLS`, `APP_IMAGEM`, `APP_VERSAO`. Faltou uma: o compose recusa com a
   mensagem dizendo o que preencher (`required variable DOMINIO is missing a value: defina DOMINIO no .env, ...`). Valor com `: ` na
   mensagem quebra o YAML: mensagens sem dois-pontos e o valor entre aspas.
7. **Papéis do banco** (skill `trilha-auditoria`): só a `migracao` recebe o **dono** (`DATABASE_URL_ARQUIVO=/run/secrets/database_url`).
   `app` e `worker` conectam por `DATABASE_URL_RUNTIME_ARQUIVO` (papel `app_runtime`) e recebem `DATABASE_URL=postgres://app@banco:5432/app`
   **sem senha** (o schema exige a variável; com o runtime definido ela não é usada). `ROLE=migrar` faz, nesta ordem, com o dono:
   migrações, **`definirSenhaRuntime`** (`ALTER ROLE app_runtime LOGIN PASSWORD` com a senha de `DATABASE_URL_RUNTIME`; trocar o
   segredo e subir = rotação; nunca cria papel; recusa o mesmo usuário do dono) e `prepararFila` (schema `fila`, filas e GRANTs).
8. **Segredos em arquivo, nunca no `.env`**: `deploy/segredos/` (`banco_senha`, `database_url`, `database_url_runtime`,
   `auth_segredo_codigo`, `dados_chaves`, `dados_chave_indice`, `segredo_url`) gerada por `gerar-segredos.sh`
   (hex de 24/32 bytes; `k1:` + base64 de 32 bytes para `dados_chaves`; nunca sobrescreve), montada como `secrets:` do compose em
   `/run/secrets/<nome>` e lida por `NOME_ARQUIVO`. Segredos que vêm de fora nascem **vazios** (vazio = não usado) e a TI preenche:
   `smtp_senha`, `anthropic_api_key`, `langfuse_secret_key`, `s3_secret_key`, `azure_connection_string` (`*_ARQUIVO` em `migracao`,
   `app` e `worker`). Pasta `700`, arquivos `444` (os contêineres sem privilégio precisam ler; quem protege é a pasta): para preencher,
   `chmod 600`, escrever só o valor, `chmod 444` (o guia mostra). Postgres por `POSTGRES_PASSWORD_FILE`. O guia manda copiar
   `segredos/` para o cofre do cliente.
9. **`.env` único** na pasta `deploy/`: o compose lê para interpolar e passa à aplicação (`env_file: .env`); o `environment:` do compose
   fixa `NODE_ENV=production`, `PROXIES_CONFIAVEIS=1`, `ROLE` e os `*_ARQUIVO`. `chmod 600 .env`. `deploy/.gitignore`: `segredos/`, `backups/`, `.env`.
10. **Caddy** (`deploy/Caddyfile`): `import seguranca.caddy` no topo e `import seguranca` dentro do site (skill `seguranca`);
    site `{$DOMINIO}`; `tls {$CADDY_TLS}` = e-mail da TI (HTTPS automático, certificado público) **ou** `internal` (rede interna;
    o guia ensina a instalar a raiz); `request_body max_size {$CORPO_MAX_MB}MiB` com `CORPO_MAX_MB = UPLOAD_MAX_MB + 2` calculado no
    `command` do serviço (uma fonte só: `UPLOAD_MAX_MB` do `.env`; MiB como a API); `encode zstd gzip`; `reverse_proxy app:3000`
    padrão (reescreve `X-Forwarded-For`) com `read_timeout 120s`; log JSON. HTTP redireciona para HTTPS (308).
11. **Profiles opcionais** (`COMPOSE_PROFILES` no `.env`): `mailpit` (`axllent/mailpit:v1.31.6`, painel só em `127.0.0.1:8025`;
    homologação com `SMTP_HOST=mailpit`, `SMTP_PORT=1025`); `antivirus` (`clamav/clamav:1.4.6`, `StreamMaxLength 600M`, sem porta);
    `langfuse` (serviços da skill `ia-langfuse`, mesmas versões, painel em `127.0.0.1:3100`). **As senhas da infraestrutura do
    Langfuse** (banco, ClickHouse, Redis, MinIO, `SALT`, `ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, `LANGFUSE_INIT_USER_PASSWORD`) ficam em
    `segredos/langfuse.env`, gerado por `gerar-segredos.sh` já com os nomes de cada contêiner e lido por `env_file` **só** nos serviços
    `langfuse-*`: `migracao`, `app` e `worker` (que recebem o `.env` inteiro) não as veem. No `.env` só `LANGFUSE_INIT_USER_EMAIL` e
    `LANGFUSE_URL_PUBLICA`, com `${VAR:-}` (o Compose cobra `${VAR:?}` **até de profile desligado**); o serviço `langfuse-conferir`
    (busybox) recusa a subida do profile dizendo o que falta. Instalação antiga com `LANGFUSE_*_PASSWORD` no `.env`: o script reaproveita.
12. **Backup** (`deploy/backup.sh`): `pg_dump -Fc` do banco inteiro (confere com `pg_restore -l` antes de aceitar) + `tar.gz` do volume
    `arquivos`; nomes `banco-AAAAMMDD-HHMMSS.dump` e `arquivos-...tar.gz`; `umask 077`, pasta `700`, arquivos `chmod 600`; retenção
    `BACKUP_DIAS=14` apagando só esses dois padrões; nada pela metade (`.parcial` + `trap`). Exemplo de cron: `0 2 * * * cd /opt/sistema/deploy && mkdir -p backups && sh backup.sh >> backups/backup.log 2>&1`.
13. **Restauração** (`deploy/restore.sh`): **nunca apaga o banco do sistema antes de a restauração dar certo.** Sem `--confirmar`
    não faz nada; com ele garante o papel `app_runtime` (é do servidor, não vai no dump), restaura em **`app_restaurando`** com o
    sistema no ar (`pg_restore --exit-on-error`), confere (`drizzle.__drizzle_migrations` com linhas) e extrai os uploads numa pasta ao
    lado; qualquer falha até aqui apaga só o `app_restaurando`. Só então para `app`, `worker` e `caddy` e troca os nomes
    (`app` → `app_antes_<AAAAMMDD_HHMMSS>`, `app_restaurando` → `app`), guarda os uploads atuais em `backups/arquivos-antes-<carimbo>.tar.gz`,
    troca os uploads e `docker compose up -d` (a `migracao` reaplica migrações e a senha do runtime). O banco anterior fica até a TI
    apagá-lo (`dropdb`). `BANCO_DESTINO=<nome>` restaura num banco novo ao lado, sem tocar no sistema. O guia traz o mesmo fluxo em PowerShell.
14. **`deploy/testar-backup.sh`**: backup → restauração num banco vazio (`teste_restauracao`) → contagem de linhas de cada tabela de
    `public` e `drizzle` igual à do sistema, schema `fila` presente → apaga o teste. Termina com `OK: backup ... restaurado`. Mensal.
15. **Guia da TI** (`deploy/INSTALACAO.md`): instalar, atualizar, voltar versão (com e sem mudança de banco), backup, restaurar e
    solução de problemas, **cada comando em bash e em PowerShell** (no PowerShell, nada de `>` com binário: `pg_dump -f` + `docker compose cp`).
    Diz que homologação também usa `NODE_ENV=production` e que `docker compose down -v` apaga os dados.
16. **Testes**: `test/senha-runtime.e2e.spec.ts` (senha com aspas e `:@/`, rotação invalida a antiga, idempotente, papel inexistente =
    erro sem a senha, dono recusado). A instalação em si é provada subindo (Checklist).

## Como aplicar

Pré-requisito: o esqueleto e as skills anteriores aplicadas na ordem do catálogo, **no mínimo até `fila-de-tarefas`** (`ROLE` e
`prepararFila` em `main.ts`), com `pnpm test` passando. Usa de skills anteriores, sem copiar: `seguranca` (`deploy/caddy/seguranca.caddy`),
`trilha-auditoria` (papel `app_runtime`, migração 0004), `fila-de-tarefas` (`fila/papel.ts`, `fila/preparar-fila.ts`), `upload-armazenamento`
(`UPLOAD_MAX_MB`, volume, ClamAV) e `ia-langfuse` (serviços do Langfuse). Skills opcionais não aplicadas não atrapalham: segredo que o
schema não conhece é ignorado (pode tirar do compose a linha dele). Ao copiar de `referencia/`, mantenha o caminho e **apague a 1ª linha**.

**Projeto no esqueleto:**

1. TDD — copie **primeiro** `apps/api/test/senha-runtime.e2e.spec.ts`; `pnpm --filter api test` falha (módulo inexistente).
2. Copie `apps/api/src/banco/senha-runtime.ts`. Em `apps/api/src/main.ts`, só a mudança: importar `definirSenhaRuntime` e, no ramo
   `papel === 'migrar'`, depois de `migrarBanco`, `if (config.DATABASE_URL_RUNTIME) await definirSenhaRuntime(dono, runtime)` (se o arquivo
   ainda é o da `fila-de-tarefas`, substitua pelo da referência). O teste passa.
3. Copie `Dockerfile` e `.dockerignore` para a raiz e `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/.gitignore`,
   `deploy/gerar-segredos.sh`, `deploy/backup.sh`, `deploy/restore.sh`, `deploy/testar-backup.sh`, `deploy/INSTALACAO.md`.
   `deploy/.env.example`: substitua pelo da referência se ainda é o da skill anterior; senão aplique só as mudanças (bloco "Compose" no
   topo; `DATABASE_URL`, segredos de login/LGPD/armazenamento/SMTP apontando para `segredos/`; `UPLOAD_MAX_MB=10` e `ALERTA_EMAIL`
   descomentados; `ROLE` vazio; bloco do Langfuse no fim). `pnpm --filter api test` (o `env-documentadas.spec.ts` confere).
4. Troque `sistema`/`exemplo.com.br` pelo nome e domínio do projeto **só** em `INSTALACAO.md` e nos exemplos do `.env.example`.
5. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` limpos.
6. Prova de ponta a ponta (obrigatória; registre comandos e saída):
   ```bash
   docker build -t sistema-teste:0.0.1 --build-arg APP_VERSAO=0.0.1 --build-arg APP_COMMIT=$(git rev-parse --short HEAD) .
   cd deploy && sh gerar-segredos.sh && cp .env.example .env
   # no .env: DOMINIO=localhost CADDY_TLS=internal APP_IMAGEM=sistema-teste APP_VERSAO=0.0.1 PROJETO=sistemateste
   #          COMPOSE_PROFILES=mailpit SMTP_HOST=mailpit SMTP_PORT=1025 EMAIL_REMETENTE=... ADMIN_INICIAL_EMAIL=admin@exemplo.com.br
   #          (80/443 ocupadas? PORTA_HTTP=8080 PORTA_HTTPS=8443; Mailpit ocupado? PORTA_MAILPIT=8026)
   docker compose up -d && docker compose ps            # app/banco healthy, migracao Exited (0)
   curl -k https://localhost:8443/api/health              # {"status":"ok","banco":"ok","versao":"0.0.1",...}
   ```
   Login real pelo Caddy: `POST /api/auth/codigo` com `Origin: https://localhost:8443` → 202; o código chega no Mailpit
   (`curl http://127.0.0.1:8026/api/v1/messages`) **pelo worker** (`select name, state from fila.job` → `email-enviar|completed`);
   `POST /api/auth/entrar` → 204 com `Set-Cookie: __Host-sessao=...; Secure; HttpOnly; SameSite=Lax`; `GET /api/auth/eu` com o cookie → 200.
   Depois: `sh testar-backup.sh` → `OK`; `sh restore.sh --confirmar <dump> <tar>` e o login/arquivo continuam valendo; sem `DOMINIO`
   no `.env`, `docker compose config` falha com a mensagem do `:?`. Desmonte: `docker compose down -v` (só no teste!).
7. Publique a imagem no registro do cliente (ou da Multiplica) com a tag da versão e entregue `deploy/` + `INSTALACAO.md` à TI.

**Projeto existente fora do esqueleto** (outro framework): mantenha os **valores** — imagem única não-root com `NODE_ENV`/perfil de
produção e healthcheck; Caddy como único com porta, HTTPS automático ou `tls internal`, cabeçalhos da `seguranca`, limite de corpo;
banco sem porta publicada; migração como serviço que roda e termina com o dono, aplicação com papel de runtime; segredos em arquivo;
tag de versão; backup `pg_dump -Fc` + uploads com retenção de 14 dias, restauração testada por script; guia da TI em bash e PowerShell.
Em Java, a imagem é `eclipse-temurin` JRE com o jar; em Python, `python:*-slim` com `gunicorn`. Registre no `CLAUDE.md` o que mudou.

**Ao terminar:** no `CLAUDE.md`, acrescente `instalacao-docker-compose` em "Skills Multiplica aplicadas", em "Comandos" o build da imagem
e `deploy/INSTALACAO.md`, e em "Regras do projeto": serviço novo entra no `deploy/docker-compose.yml` sem `ports:` (só o Caddy publica),
segredo novo vira arquivo em `segredos/` + `gerar-segredos.sh` + `*_ARQUIVO` no compose, e toda versão sobe por tag.

## Referências

Usados sem cópia: `deploy/caddy/seguranca.caddy` (skill `seguranca`); `apps/api/src/configurar-app.ts` (`servirSpa`, esqueleto);
`apps/api/src/banco/migrar.ts` e `test/postgres.ts` (esqueleto); `apps/api/src/fila/papel.ts` e `fila/preparar-fila.ts` (`fila-de-tarefas`);
`config/arquivo-env.ts` e `config/config.ts` (esqueleto e skills seguintes).

- `referencia/Dockerfile`, `referencia/.dockerignore` — a imagem (regras 1 a 3). Leia antes de mudar build ou dependências de sistema.
- `referencia/deploy/docker-compose.yml` — serviços, segredos, profiles, volumes (regras 4 a 9 e 11). Leia antes de acrescentar serviço.
- `referencia/deploy/Caddyfile` — HTTPS, cabeçalhos, limite de corpo (regra 10).
- `referencia/deploy/.env.example` — todas as variáveis (compose e API) comentadas; `referencia/deploy/.gitignore`.
- `referencia/deploy/gerar-segredos.sh` — segredos (regra 8). Leia ao acrescentar um segredo.
- `referencia/deploy/backup.sh`, `restore.sh`, `testar-backup.sh` — regras 12 a 14.
- `referencia/deploy/INSTALACAO.md` — o guia da TI (regra 15); ajuste nomes e entregue.
- `referencia/apps/api/src/banco/senha-runtime.ts`, `referencia/apps/api/test/senha-runtime.e2e.spec.ts`, `referencia/apps/api/src/main.ts` — senha do runtime no passo de migração (regras 7 e 16).

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` limpos; `senha-runtime.e2e.spec.ts` passa.
- [ ] `docker build` gera a imagem; ela roda como `node`, sem devDependencies, com `NODE_ENV=production`; `.dockerignore` exclui `.env`.
- [ ] `docker compose config` sem erro com o `.env` de teste; sem `DOMINIO` falha com a mensagem do `:?`.
- [ ] Só o `caddy` publica porta; `app` e `banco` sem `ports:`; `PROXIES_CONFIAVEIS=1`; `app`/`worker` sem a senha do dono.
- [ ] Subiu com `tls internal`: `curl -k https://localhost/api/health` → `"status":"ok"`; cabeçalhos da `seguranca` na resposta do SPA.
- [ ] Login real pelo Caddy: código pelo Mailpit enviado pelo worker; cookie `__Host-sessao` com `Secure`.
- [ ] `testar-backup.sh` → `OK`; `restore.sh --confirmar` volta o sistema com os dados e os uploads e deixa `app_antes_<carimbo>`.
- [ ] Nenhum segredo no `.env`: chaves de IA/Langfuse/S3/Azure em `segredos/`; senhas do Langfuse em `segredos/langfuse.env`.
- [ ] Trocar `APP_VERSAO` e `up -d` atualiza (o `/api/health` mostra a versão); voltar o valor volta.
- [ ] `INSTALACAO.md` com nomes do projeto, comandos bash e PowerShell; `segredos/` no cofre do cliente.
- [ ] `instalacao-docker-compose` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
