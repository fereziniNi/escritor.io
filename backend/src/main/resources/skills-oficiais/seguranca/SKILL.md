---
name: seguranca
description: Use quando for aplicar ou revisar a segurança básica de um sistema Multiplica - cabeçalhos HTTP, CSP, CORS, CSRF (Origin/Referer, Sec-Fetch-Site), limite de requisições por IP ou por chave (429), proxy confiável atrás do Caddy, segredos fora do código, CI com gitleaks, pnpm audit, CodeQL e Dependabot - ou preparar o sistema para pentest. Use também quando o pedido for "deixar o sistema seguro", "passar no pentest", "configurar CORS", "erro de CSP no console" ou "proteger contra CSRF" num projeto Multiplica.
---

# Segurança Multiplica

Linha de base de segurança de todo sistema novo da Multiplica: cabeçalhos e CSP, CORS por lista, proteção contra
CSRF, limite de requisições, segredos fora do código e uma CI que bloqueia segredo vazado e dependência vulnerável.
O código em `referencia/` é cópia de um projeto-modelo que compila e passa nos testes: copie e adapte, não reescreva
de memória. Vem da união de BeyondCredit, Conta Gráfica, CONECTA e dos achados de pentest dos sistemas da Multiplica.

## Padrão Multiplica

1. **Cabeçalhos em toda resposta da API** (`apps/api/src/seguranca/cabecalhos.middleware.ts`), valores exatos:
   `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
   `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`,
   `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`. Só em `/api/*`:
   `Cache-Control: no-store` e `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`.
   Com HTTPS (`req.secure`): `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Sem `X-Powered-By`.
2. **CSP do SPA no Caddy** (`deploy/caddy/seguranca.caddy`, snippet `(seguranca)`), exatamente:
   `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'`.
   O snippet repete os cabeçalhos da regra 1 e o HSTS, põe a CSP com `?` (não sobrescreve a CSP da API) e remove
   `Server`, `X-Powered-By` e `Via`. Nada de script inline, `eval`, CDN ou Google Fonts.
3. **Build compatível com a CSP**: nenhum `<script>` inline no `index.html` (o tema usa `/tema-inicial.js`); fonte
   nunca vira `data:` (`build.assetsInlineLimit` no `vite.config.ts` recusa `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`);
   zod em modo `jitless` (`packages/contratos/src/sem-eval.ts`, **primeiro** import do `index.ts` dos contratos), senão
   o zod testa `Function()` e toda tela registra violação de CSP. Teste: `apps/web/src/build-csp.test.ts`.
4. **CORS desligado por padrão** (`seguranca/cors.ts`). `CORS_ORIGENS` (lista separada por vírgula de origens
   `https://host[:porta]`, sem caminho nem curinga; inválida = erro no boot) liga o CORS só para essas origens, com
   credenciais. Origem fora da lista: resposta **sem** `Access-Control-Allow-Origin` e **nunca 500** (a função de
   origem nunca devolve erro).
5. **CSRF** (`seguranca/origem.guard.ts`): `POST`, `PUT`, `PATCH` e `DELETE` em `/api` só com `Origin` (ou, sem ele,
   `Referer`) igual à própria origem (`req.protocol://Host`) ou a uma de `CORS_ORIGENS`; `Origin: null` é recusado;
   sem `Origin` e sem `Referer`, recusa se `Sec-Fetch-Site` for `cross-site`/`same-site` (cliente que não é navegador
   passa: não carrega cookie de vítima). Recusa = **403** JSON padrão. GET que altera algo (baixar arquivo que registra,
   confirmar por link) leva `@MesmaOrigem()`: `Sec-Fetch-Site` `cross-site`/`same-site` → 403, salvo `Origin` de
   `CORS_ORIGENS`. Cookie de sessão sempre `HttpOnly; Secure; SameSite=Lax` (skill `login-codigo-email`).
6. **Limite por IP** (`seguranca/limitador.ts`): `LIMITE_REQ_POR_IP` requisições por minuto por IP em `/api/*`
   (padrão **300**, janela fixa de 60 s, em memória por instância). Acima: **429** JSON padrão com `Retry-After` em
   segundos. Limite **por chave** (e-mail, usuário, código) com `new LimitadorJanelaFixa(limite, janelaMs)` e chave
   própria (`email:${email}`); limite que precisa valer entre réplicas vai para o banco.
7. **Proxy confiável**: `PROXIES_CONFIAVEIS` (padrão `0`; **`1` na instalação**, atrás do Caddy) vira o
   `trust proxy` do Express. Sem ele, atrás do Caddy, o limite vale para o Caddy inteiro, o HSTS não sai e toda
   mutação leva 403 (o Origin é `https://` e a API se vê em `http://`). Com `0`, `X-Forwarded-*` é ignorado.
8. **Ordem**: `aplicarSeguranca(app, config)` logo depois de `app.useLogger(...)` no `configurarApp` (antes do SPA);
   `SegurancaModule` importado no `AppModule` **logo depois do `LogModule`**, para a recusa (403/429) já ter
   `X-Request-Id`, sair no log e no formato `{ status, erro, requestId }`.
9. **Segredos**: nunca no código, no git nem em log. Senha, chave e URL com senha são `Segredo` (`[REDACTED]` em JSON,
   `String()` e `inspect`); em produção vêm de arquivo (`NOME_ARQUIVO=/run/secrets/nome`). Skill
   `novo-projeto-multiplica`, regra 4.
10. **Nunca enumerar contas**: cadastro, login e "esqueci" respondem igual (mesmo status, corpo e tempo aproximado)
    para e-mail/CPF existente ou não; o aviso real vai por e-mail ao dono. Limite por IP **e** por e-mail.
11. **Erro sem detalhe**: 5xx responde só `"Erro interno"` + `requestId` (detalhe só no log); `/api/*` desconhecida é
    404 JSON, nunca o `index.html` (skill `novo-projeto-multiplica`, regras 8 e 9).
12. **CI** (`.github/workflows/ci.yml`), todos bloqueantes: `qualidade` (`pnpm install --frozen-lockfile`, `lint`,
    `typecheck`, `test`, `build`); `segredos` (gitleaks `v8.28.0` em container, histórico inteiro com
    `fetch-depth: 0`); `dependencias` (`pnpm audit --prod --audit-level high` bloqueia; o audit completo só informa);
    `codeql` (`javascript-typescript`, `security-extended`, permissão `security-events: write`). `permissions:
    contents: read` no topo; actions com versão fixa.
13. **Dependabot** (`.github/dependabot.yml`): `npm` e `github-actions` semanais, dependências de desenvolvimento
    agrupadas, `versioning-strategy: increase` (mantém versão exata). Com Dockerfile, acrescente `docker`.
14. **Checklist de pentest** (`referencia/checklist-pentest.md`): as 8 classes conferidas e marcadas antes da
    homologação e de novo antes de produção.

## Como aplicar

Pré-requisito: esqueleto da skill `novo-projeto-multiplica` (e, pela ordem, `identidade-visual`) aplicado e
`pnpm test` passando. Ao copiar um arquivo de `referencia/`, mantenha o mesmo caminho relativo e **apague a 1ª linha**
(`origem: ...`).

**Projeto no esqueleto:**

1. TDD — copie **primeiro** os testes: `apps/api/src/seguranca/cors.spec.ts`, `limitador.spec.ts`,
   `origem.guard.spec.ts`, `apps/api/test/seguranca.e2e.spec.ts`, `packages/contratos/src/csp.spec.ts` e
   `apps/web/src/build-csp.test.ts`. Rode `pnpm test`: tem de falhar (módulos e variáveis inexistentes, `data:font` no build).
2. Código novo: copie `apps/api/src/seguranca/cabecalhos.middleware.ts`, `cors.ts`, `limitador.ts`,
   `origem.guard.ts`, `seguranca.module.ts` e `packages/contratos/src/sem-eval.ts`.
3. Arquivos do esqueleto. Se o arquivo ainda é o do esqueleto, **substitua** pelo da referência; se outra skill já
   mexeu nele, faça **só** a mudança descrita:
   - `apps/api/src/config/config.ts`: constante `ORIGEM` e as variáveis `CORS_ORIGENS`, `LIMITE_REQ_POR_IP`,
     `PROXIES_CONFIAVEIS` no fim do `esquemaConfig`.
   - `apps/api/src/app.module.ts`: `SegurancaModule` nos `imports`, logo depois do `LogModule`.
   - `apps/api/src/configurar-app.ts`: `aplicarSeguranca(app, config)` logo depois de `app.useLogger(...)`.
   - `packages/contratos/src/index.ts`: `import './sem-eval.js';` como primeiro import.
   - `apps/web/vite.config.ts`: bloco `build.assetsInlineLimit`.
   - `.env.example` e `deploy/.env.example`: bloco "Segurança" do fim (o teste `env-documentadas` cobra).
4. Rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: passa. (`pnpm build` na raiz compila os contratos
   antes da web; a web de produção usa o `dist` dos contratos.)
5. Caddy: copie `deploy/caddy/seguranca.caddy`. O Caddyfile da instalação (skill `instalacao-docker-compose`) faz
   `import seguranca.caddy` no topo e `import seguranca` dentro do site. Para validar sem a instalação, copie também
   `deploy/caddy/teste/Caddyfile` e rode o comando escrito nele (`caddy validate`, Docker).
6. CI: copie `.github/workflows/ci.yml` e `.github/dependabot.yml`. No GitHub do repositório: Settings → Code security →
   ligue Dependabot alerts, Dependabot security updates, Secret scanning e Code scanning; em Branches, exija os 4 jobs
   da CI para o merge na `main`.
7. No código das próximas telas e rotas: `@MesmaOrigem()` em todo GET que altera algo; `LimitadorJanelaFixa` com
   chave própria em login, envio de código e qualquer rota cara; mensagens que não revelam se a conta existe.
8. Verifique (checklist abaixo) e preencha `referencia/checklist-pentest.md` antes da homologação.

**Projeto existente fora do esqueleto** (outro framework, sem NestJS ou sem Caddy): não reescreva o sistema. Aplique
o que independe de stack, nos caminhos equivalentes: os mesmos cabeçalhos e valores da regra 1 (middleware do
framework ou do proxy: nginx `add_header ... always`), a CSP da regra 2 no proxy, CORS por lista que nunca lança,
checagem de Origin/Referer em mutação, limite por IP com proxy confiável configurado, segredos por arquivo, a CI e o
Dependabot (troque os comandos `pnpm` pelos do projeto). Registre no `CLAUDE.md` onde ficou cada coisa.

**Ao terminar:** acrescente `seguranca` em "Skills Multiplica aplicadas" do `CLAUDE.md`, com `PROXIES_CONFIAVEIS=1`
anotado em "Variáveis de ambiente".

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou no esqueleto da skill `novo-projeto-multiplica`
(`apps/api/src/config/config.module.ts` com `CONFIG`, `config/segredo.ts`, `criar-app.ts`, `log/log.module.ts`,
`http/filtro-erros.ts`, `banco/`, `saude/`, `test/postgres.ts`, `test/setup-global.ts`, `packages/contratos/src/saude.ts`
e os `package.json` de `referencia/configuracao.md`: `@nestjs/*`, `express`, `zod`, `vite`, `vitest`, `supertest`).

- `referencia/apps/api/src/seguranca/cabecalhos.middleware.ts` — cabeçalhos e HSTS (regra 1); passo 2.
- `referencia/apps/api/src/seguranca/cors.ts` — CORS por lista, sem 500 (regra 4); passo 2.
- `referencia/apps/api/src/seguranca/origem.guard.ts` — CSRF: middleware de mutação, `MesmaOrigemGuard` e `@MesmaOrigem()` (regra 5); passo 2 e ao criar GET com efeito.
- `referencia/apps/api/src/seguranca/limitador.ts` — `LimitadorJanelaFixa`, `recusarPorLimite` e o limite por IP (regra 6); passo 2 e ao limitar por chave.
- `referencia/apps/api/src/seguranca/seguranca.module.ts` — `SegurancaModule` e `aplicarSeguranca` (regras 7 e 8); passo 2.
- `referencia/apps/api/src/seguranca/*.spec.ts`, `referencia/apps/api/test/seguranca.e2e.spec.ts` — testes de unidade e e2e (cabeçalhos, 403, CORS, 429, proxy); passo 1.
- `referencia/apps/api/src/config/config.ts` — schema com as 3 variáveis novas; passo 3.
- `referencia/apps/api/src/app.module.ts`, `configurar-app.ts` — onde a segurança entra (regra 8); passo 3.
- `referencia/.env.example`, `referencia/deploy/.env.example` — variáveis documentadas (`PROXIES_CONFIAVEIS=1` na instalação); passo 3.
- `referencia/packages/contratos/src/sem-eval.ts`, `index.ts`, `csp.spec.ts` — zod sem `Function()` (regra 3); passos 1–3.
- `referencia/apps/web/vite.config.ts`, `apps/web/src/build-csp.test.ts` — build sem fonte `data:` nem script inline (regra 3); passos 1 e 3.
- `referencia/deploy/caddy/seguranca.caddy` — snippet do Caddy com cabeçalhos e CSP (regra 2); passo 5.
- `referencia/deploy/caddy/teste/Caddyfile` — Caddyfile mínimo para validar e ver os cabeçalhos do snippet; passo 5.
- `referencia/.github/workflows/ci.yml`, `.github/dependabot.yml` — CI e Dependabot (regras 12 e 13); passo 6.
- `referencia/checklist-pentest.md` — as 8 classes de vulnerabilidade, como testar cada uma; passo 8 e antes de cada homologação.

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem limpos (inclui `seguranca.e2e.spec.ts`, `build-csp.test.ts` e `csp.spec.ts`).
- [ ] `curl -sI http://localhost:3000/api/health` mostra os 6 cabeçalhos da regra 1, `Cache-Control: no-store` e a CSP `default-src 'none'`; sem `X-Powered-By`.
- [ ] `curl -s -o /dev/null -w "%{http_code}" -X POST -H "Origin: https://malicioso.exemplo" http://localhost:3000/api/health` → `403`.
- [ ] Origem fora de `CORS_ORIGENS` → sem `Access-Control-Allow-Origin` e status diferente de 500 (GET e OPTIONS).
- [ ] Rajada acima de `LIMITE_REQ_POR_IP` → `429` com `Retry-After`.
- [ ] `deploy/.env.example` com `PROXIES_CONFIAVEIS=1`; `CORS_ORIGENS` vazio salvo necessidade real.
- [ ] `caddy validate` aceita o Caddyfile com `import seguranca`; no navegador (F12 → Console) nenhuma violação de CSP nas telas.
- [ ] `.github/workflows/ci.yml` e `.github/dependabot.yml` no repositório; CI verde com os 4 jobs exigidos para o merge.
- [ ] Nenhuma mensagem revela se e-mail/CPF existe; GET que altera algo tem `@MesmaOrigem()`.
- [ ] `referencia/checklist-pentest.md` preenchido; `seguranca` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
