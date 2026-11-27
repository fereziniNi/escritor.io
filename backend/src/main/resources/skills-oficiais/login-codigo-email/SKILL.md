---
name: login-codigo-email
description: Use quando um sistema Multiplica precisar de login, autenticação, entrar com código enviado por e-mail (OTP, código de 6 dígitos, "magic code", login sem senha), sessão em cookie, logout, "quem está logado" (/api/auth/eu), expiração de sessão por inatividade, restringir o login a domínios de e-mail da empresa, ou ligar a tela de login padrão. É o login padrão Multiplica e cobre tabelas codigo_login e sessao, rotas /api/auth/*, o middleware que preenche req.usuario para a skill usuarios-e-papeis, o SessaoGuard e a tela TelaEntrar.
---

# Login por código no e-mail Multiplica

O login padrão dos sistemas Multiplica: a pessoa digita o e-mail, recebe um código de 6 dígitos e entra; a sessão é
um token opaco em cookie `HttpOnly`. Nada de senha para guardar, vazar ou resetar. O código em `referencia/` é cópia
de um projeto-modelo que compila e passa nos testes (inclusive o login de verdade no navegador contra o Mailpit):
copie e adapte, não reescreva de memória. Vem da união de Conta Gráfica (`auth/rotas.ts`, `sessao.ts`), BeyondCredit
(`auth/otp/*`, `session-store.ts`) e CONECTA (`modules/auth/service.py`). É código de segurança: **cada valor abaixo é
fixo**; mudar um deles é decisão de segurança registrada no `CLAUDE.md`, não ajuste de gosto.

## Padrão Multiplica

1. **Código**: 6 dígitos de `crypto.randomInt(0, 1_000_000)` com zeros à esquerda (`"000123"`), nunca `Math.random`.
   Guardado **só** como HMAC-SHA256 (`createHmac('sha256', AUTH_SEGREDO_CODIGO)` sobre `email + "\0" + código`, em hex)
   na tabela `codigo_login(id, email, hmac, expira_em, tentativas, usado, criado_em)`. O código em claro só existe no
   e-mail. Validade **10 minutos** (`expira_em = now() + 10 min`); código usado não vale de novo.
2. **5 tentativas por código**, contadas **antes** de comparar: `UPDATE ... SET tentativas = tentativas + 1 WHERE id = ?
   AND tentativas < 5 RETURNING` — sem linha devolvida, recusa. A 6ª tentativa falha **mesmo com o código certo**.
   Comparação com `timingSafeEqual` (`hmacIguais`).
3. **Limite de pedidos**: no máximo **3 códigos por e-mail a cada 10 minutos** (contados no banco, valem entre réplicas)
   e limite por IP (`LIMITE_IP_CODIGO` = 30 pedidos e `LIMITE_IP_ENTRAR` = 30 tentativas a cada 10 min, por instância,
   com `LimitadorJanelaFixa` da skill `seguranca`; acima: 429 com `Retry-After`). Contagem e gravação numa transação
   com `pg_advisory_xact_lock(hashtext(email))`: pedidos simultâneos do mesmo e-mail não furam o limite.
4. **Código novo invalida os anteriores** (na mesma transação, `expira_em = now()` dos pendentes). Só o último vale.
5. **Nunca revelar quem tem acesso**: `POST /api/auth/codigo {email}` responde **sempre 202** com o mesmo corpo
   (`RESPOSTA_PEDIR_CODIGO`: "Se o e-mail tiver acesso, enviamos um código...") para e-mail fora do domínio,
   inexistente, desativado, com limite estourado ou válido, e **nunca antes de 600 ms** (`comTempoMinimo`). O e-mail
   sai com `ServicoEmail.disparar` (não espera o SMTP): o tempo não muda com o envio. `POST /api/auth/entrar` também
   respeita os 600 ms e falha sempre com **401 "Código inválido ou expirado"**, qualquer que seja o motivo. E-mail com
   formato inválido é 400 (não diz nada sobre contas).
6. **Quem pode pedir**: e-mail (normalizado: sem espaços, minúsculo) de usuário com `ativo = true` na tabela `usuario`
   (skill `usuarios-e-papeis`) e, se `AUTH_DOMINIOS_PERMITIDOS` estiver definida, com domínio **exato** da lista
   (nunca "termina com": `malgrupomultiplica.com.br` não passa por `grupomultiplica.com.br`). Lista vazia: qualquer
   domínio cadastrado. O primeiro administrador vem de `ADMIN_INICIAL_EMAIL` (skill `usuarios-e-papeis`).
7. **E-mail do código** (skill `email-transacional`): assunto fixo **"Seu código de acesso"** (nunca o código no
   assunto), corpo com `montarEmail`, nome do sistema por `escaparHtml`, validade e "se não foi você, ignore".
   **Segredo e código nunca ficam guardados além da validade**: o código só existe no banco como hash; o e-mail renderizado
   (com o código em claro) que passa pela fila `email-enviar` (skill `fila-de-tarefas`) é apagado em no máximo 10 min
   (`retentionSeconds: 600`, `deleteAfterSeconds: 300`, limpeza a cada 60 s). Não registre o corpo do e-mail em log nem auditoria.
8. **Sessão**: token `randomBytes(32)` em base64url só no cookie; no banco `sessao(id, hash_token, usuario_id,
   criada_em, ultimo_uso_em, revogada)` guarda o **SHA-256** (`hash_token`, índice único). Expira parada
   **`AUTH_SESSAO_OCIOSA_MIN` = 30 min** ou **`AUTH_SESSAO_ABSOLUTA_H` = 12 h** depois do login, o que vier primeiro;
   `ultimo_uso_em` regravado no máximo 1 vez por minuto. `POST /api/auth/sair` marca `revogada = true`, apaga o cookie e
   responde 204 (também sem sessão). Banco nunca contém o código nem o token (teste dedicado). Mudar `papel` ou
   `ativo` de um usuário **revoga todas as sessões dele** (gatilho `usuario_revoga_sessoes` no Postgres, migração de
   `referencia/migracao-revogar-sessoes.md`): vale para a tela de usuários, o admin inicial e `UPDATE` direto, e
   reativar não ressuscita sessão antiga.
9. **Cookie, falha fechada**: por padrão **`__Host-sessao`**, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem
   `Domain`, `Max-Age` = `AUTH_SESSAO_ABSOLUTA_H`. Só quando o ambiente **declara** `NODE_ENV=development` ou `test`
   (`config.NODE_ENV_DECLARADO`, o valor cru, sem o padrão `development` do esqueleto) o nome vira `sessao` sem `Secure`
   (em `http://localhost` o Safari recusa `Secure`/`__Host-`, e HTTPS no Vite quebraria a guarda de origem do proxy).
   `NODE_ENV` ausente ou vazio conta como **produção** (e a API avisa alto no boot); valor desconhecido (`staging`) nem
   sobe. Nunca por `req.secure` (proxy mal configurado não derruba o `Secure`). A imagem de produção **define
   `NODE_ENV=production`** (a skill `instalacao-docker-compose` grava no Dockerfile). Testes provam: ausente →
   `__Host-sessao` + `Secure`; `development`/`test` → `sessao`; o cookie `sessao` não vale em produção.
10. **`req.usuario` a cada requisição** (contrato da skill `usuarios-e-papeis`): o `SessaoMiddleware` (toda a `/api`)
    lê o cookie, valida a sessão (não revogada, dentro das duas validades) **e** o usuário na tabela `usuario` com
    `ativo = true`, e preenche `req.usuario = { id, email, nome, papel }` com o papel **da tabela**. Desativar ou trocar o
    papel vale na próxima requisição, sem novo login. Sem sessão válida `req.usuario` fica vazio e `@Papeis` dá 401.
11. **Rotas** (`/api/auth`): `POST /codigo` (202), `POST /entrar {email, codigo}` (204 + cookie; corpo validado pelos
    esquemas de `packages/contratos/src/auth.ts`: código `^\d{6}$`), `POST /sair` (204), `GET /eu` (200 com
    `{ id, email, nome, papel }`, 401 sem sessão; protegida por `@ExigirSessao()` / `SessaoGuard`). Os POST passam pela
    guarda de origem da skill `seguranca` (cookie sem `Origin` → 403).
12. **Auditoria**: login, logout, falha, bloqueio do código (5 erros ou 6ª tentativa) e limite de pedidos chamam
    `registrarEvento` (`auth/registro-eventos.ts`, token `REGISTRO_EVENTOS`). Sem a skill `trilha-auditoria` o provedor é
    o `RegistroEventosNulo` (não grava); ela troca o provedor no `AuthModule`. Falha ao registrar nunca derruba o login.
13. **Segredo**: `AUTH_SEGREDO_CODIGO` (ou `AUTH_SEGREDO_CODIGO_ARQUIVO`), `Segredo` com no mínimo 32 caracteres
    (gerador criptográfico: `openssl rand -hex 32`), o mesmo em todas as instâncias. Obrigatória salvo com
    `NODE_ENV=development`/`test` declarados: sem ela a API **não sobe** (`segredoDoCodigo` lança no `AuthService`;
    `NODE_ENV` ausente também exige). Em dev, ausente, a API gera uma por processo. **Trocar o segredo** invalida só os
    códigos pendentes (no máximo 10 min); sessões abertas continuam (o token não depende dele).
14. **Riscos que sobram (aceitos)**: quem troca de IP ainda tenta cerca de 15 códigos por e-mail a cada 10 min
    (3 códigos x 5 tentativas, chance de 1 em 66 mil por janela); e qualquer um pode gastar os 3 pedidos de um e-mail
    conhecido e atrasar o login dessa pessoa por até 10 min. Os eventos `auth.codigo_bloqueado` e `auth.limite_codigo`
    da auditoria mostram as duas coisas.
15. **Tela** (`apps/web/src/telas/TelaEntrar.tsx`, rota `/entrar`): o visual da tela-modelo `TelaLogin` da skill
    `identidade-visual` (cartão centralizado com a marca) em dois passos: e-mail → "Receber código"; código (campo
    `inputMode="numeric"`, `autoComplete="one-time-code"`, só 6 dígitos) → "Entrar", e "Usar outro e-mail". O `Layout` do
    `App.tsx` busca `GET /api/auth/eu`: sem sessão vai para `/entrar`; com sessão mostra nome e papel da API no `AppShell`
    (botão **Sair**, prop `aoSair`; se o servidor falhar ao sair, mostra o erro e não finge que saiu), menu Admin só
    para `ADMIN`; 401 em qualquer chamada relê `/eu` e volta ao login.
    Nenhum usuário fixo no código da web.

## Como aplicar

Pré-requisito: esqueleto da skill `novo-projeto-multiplica` e as skills `identidade-visual`, `seguranca`,
`email-transacional` e `usuarios-e-papeis` aplicadas (nesta ordem), com `pnpm test` passando. Sem nova dependência
npm. Ao copiar um arquivo de `referencia/`, mantenha o mesmo caminho relativo e **apague a 1ª linha** (`origem: ...`).

**Projeto no esqueleto:**

1. TDD, API — copie **primeiro** os testes: `apps/api/src/auth/cripto-auth.spec.ts`, `config-auth.spec.ts` e
   `apps/api/test/auth.e2e.spec.ts`. Rode `pnpm --filter api test`: tem de falhar (módulos inexistentes).
2. Código da API: copie `apps/api/src/auth/` inteiro (`cripto-auth.ts`, `regras-auth.ts`, `cookie-sessao.ts`,
   `registro-eventos.ts`, `auth.tabelas.ts`, `auth.service.ts`, `sessao.guard.ts`, `auth.controller.ts`, `auth.module.ts`).
3. Contratos: copie `packages/contratos/src/auth.ts` e `auth.spec.ts`; no `index.ts` acrescente
   `export * from './auth.js';` no fim.
4. Arquivos do esqueleto — se ainda são os da etapa anterior, **substitua** pelos da referência; se outra skill mexeu
   neles, faça **só** a mudança descrita:
   - `apps/api/src/banco/esquema.ts`: a linha `export * from '../auth/auth.tabelas';`.
   - `apps/api/src/config/config.ts`: a constante `DOMINIO`, as quatro variáveis `AUTH_*` no fim do `esquemaBase`, a
     regra "ociosa não maior que a absoluta" no `superRefine` (o `NODE_ENV_DECLARADO` já vem da skill `email-transacional`;
     se o projeto ainda não tem, acrescente no tipo `Config` e no `return` do `carregarConfig`).
   - `apps/api/src/app.module.ts`: `AuthModule` nos `imports`, depois do `UsuariosModule` (e depois do `SegurancaModule`).
   - `.env.example` e `deploy/.env.example`: o bloco "Login por código no e-mail" do fim.
5. Migração: `pnpm --filter api db:generate`. O SQL novo tem de criar `codigo_login` e `sessao`, a FK
   `sessao.usuario_id → usuario.id` e os índices `codigo_login_email_criado`, `sessao_hash_token_unico` (único) e
   `sessao_usuario`; confira e não edite à mão. Depois a migração do gatilho, como manda
   `referencia/migracao-revogar-sessoes.md` (`drizzle-kit generate --custom --name=revogar_sessoes` + o SQL de lá).
   Rode `pnpm --filter api test`: passa (precisa do Docker).
6. TDD, web — copie `apps/web/src/telas/TelaEntrar.test.tsx` e `apps/web/src/App.test.tsx`; `pnpm --filter web test`
   falha. Copie `apps/web/src/lib/auth-api.ts`, `telas/TelaEntrar.tsx`, e: no `AppShell.tsx` a prop `aoSair` e o botão
   Sair (referência = arquivo depois da skill `identidade-visual`); no `App.tsx` o `Layout` com `/api/auth/eu`, o
   `PaginaEntrar`, os caches de consulta com 401 e o menu por papel (referência = arquivo depois de `usuarios-e-papeis`;
   apague o usuário fixo). A tela-modelo `telas/modelo/TelaLogin.tsx` continua como está (modelo visual).
7. Playwright: substitua `apps/web/e2e/inicio.spec.ts` (agora simula `/api/auth/eu`) e copie `e2e/login-real.spec.ts` e
   `e2e/login-real.config.ts` (o login de verdade; no `pnpm e2e` comum ele fica de fora).
8. Rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build` e `pnpm --filter web e2e`: tudo limpo.
9. Veja funcionando, de verdade: `docker compose up -d postgres mailpit`, `.env` copiado do `.env.example` (traz
   `NODE_ENV=development`, `ADMIN_INICIAL_EMAIL` e `MAIL_MODE=smtp` para o Mailpit), `pnpm --filter api db:migrate`,
   `pnpm dev`; abra http://localhost:5173, peça o código, leia em http://localhost:8025 e entre. Ou automático:
   `e2e/login-real.config.ts` só roda com `E2E_DATABASE_URL`, `E2E_SMTP_PORTA` e `E2E_URL_MAILPIT` apontando para
   contêineres **descartáveis** (o teste apaga a caixa do Mailpit; os comandos estão no topo do arquivo), depois de `pnpm build`.
10. Produção: `NODE_ENV=production` na imagem, `AUTH_SEGREDO_CODIGO_ARQUIVO` (segredo do compose), HTTPS no Caddy,
    `PROXIES_CONFIAVEIS=1` (IP real para o limite) e, se a empresa quiser, `AUTH_DOMINIOS_PERMITIDOS`.
11. Testes de outros módulos: continue usando `test/usuario-de-teste.ts` (skill `usuarios-e-papeis`) para simular o
    usuário; o `SessaoMiddleware` só escreve `req.usuario` quando há sessão válida, então os dois convivem.

**Projeto existente fora do esqueleto** (outro framework ou sem NestJS): não reescreva o sistema e não troque um login
corporativo (SSO) que já funcione sem decisão de quem manda no sistema. Aplique o que independe de stack, com os mesmos
valores: código `randomInt` de 6 dígitos guardado como HMAC-SHA256, 10 min, 5 tentativas contadas antes de comparar,
3 pedidos/10 min por e-mail com trava no banco, código novo invalida os anteriores, resposta idêntica com piso de 600 ms,
domínio exato, token aleatório de 32 bytes guardado como SHA-256, cookie `__Host-` HttpOnly/Secure/SameSite=Lax,
validade ociosa e absoluta, usuário e papel relidos do banco a cada requisição, logout que revoga. `auth.service.ts` e
`regras-auth.ts` mostram o desenho completo. Registre no `CLAUDE.md` onde ficou cada coisa.

**Ao terminar:** acrescente `login-codigo-email` em "Skills Multiplica aplicadas" do `CLAUDE.md` e as variáveis
`AUTH_*` em "Variáveis de ambiente" (com `AUTH_SEGREDO_CODIGO_ARQUIVO` obrigatória em produção).

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou nas skills anteriores. De
`novo-projeto-multiplica`: `apps/api/src/banco/banco.ts` (`BANCO`, `Db`), `config/config.module.ts` (`CONFIG`),
`config/segredo.ts` (`Segredo`), `criar-app.ts`, `test/postgres.ts` (`subirPostgres`), `apps/web/src/lib/api.ts`
(`ErroApi`, `buscarSaude`). De `identidade-visual`: `componentes/Campo.tsx`, `estados.tsx` (`Carregando`,
`ErroCarregar`), `AlternarTema.tsx`, `lib/utils.ts`, `telas/Inicio.tsx`, `telas/modelo/*` e o `Button` do shadcn
(`componentes/ui/button.tsx`). De `seguranca`: `apps/api/src/seguranca/limitador.ts` (`LimitadorJanelaFixa`, `chaveDeIp`,
`recusarPorLimite`) e a guarda de origem. De `email-transacional`: `email/email.module.ts`, `servico-email.ts`
(`disparar`), `modelo-email.ts` (`montarEmail`, `escaparHtml`). De `usuarios-e-papeis`: `usuarios/usuario.tabela.ts`,
`usuario-atual.ts` (`UsuarioAtual`, `@UsuarioLogado`), `usuarios.service.ts` (`validarOu400`), o módulo de usuários,
`packages/contratos/src/usuarios.ts` (`PAPEIS`, `ROTULO_PAPEL`) e `telas/TelaUsuarios.tsx`.

- `referencia/apps/api/src/auth/cripto-auth.ts` — código, HMAC, comparação em tempo constante, token e hash (regras 1, 2, 8); passo 2.
- `referencia/apps/api/src/auth/regras-auth.ts` — valores fixos, domínio exato, segredo e `comTempoMinimo` (regras 3, 5, 6, 13); passo 2.
- `referencia/apps/api/src/auth/cookie-sessao.ts` — nome e atributos do cookie por ambiente, `lerCookie` (regra 9); passo 2.
- `referencia/apps/api/src/auth/auth.tabelas.ts` — tabelas `codigo_login` e `sessao` (regras 1 e 8); passos 2 e 5.
- `referencia/apps/api/src/auth/auth.service.ts` — pedir código, entrar, sair, usuário da sessão (regras 1 a 8 e 10); passo 2 e para entender o fluxo.
- `referencia/apps/api/src/auth/sessao.guard.ts` — `SessaoMiddleware`, `SessaoGuard`, `@ExigirSessao()` (regras 10 e 11); passo 2 e em rota que só exige login.
- `referencia/apps/api/src/auth/auth.controller.ts` — rotas, limite por IP, piso de 600 ms, cookie (regras 3, 5, 9, 11); passo 2.
- `referencia/apps/api/src/auth/registro-eventos.ts`, `auth.module.ts` — ponto de ligação da auditoria e o módulo (regra 12); passo 2 e ao aplicar `trilha-auditoria`.
- `referencia/apps/api/src/auth/cripto-auth.spec.ts`, `config-auth.spec.ts`, `referencia/apps/api/test/auth.e2e.spec.ts` — todos os comportamentos acima, contra Postgres real; passo 1.
- `referencia/apps/api/src/banco/esquema.ts`, `config/config.ts`, `app.module.ts`, `referencia/.env.example`, `referencia/deploy/.env.example` — os arquivos do esqueleto alterados; passo 4.
- `referencia/packages/contratos/src/auth.ts`, `auth.spec.ts`, `index.ts` — esquemas de pedir código, entrar e `eu`; passo 3.
- `referencia/apps/web/src/lib/auth-api.ts`, `telas/TelaEntrar.tsx`, `telas/TelaEntrar.test.tsx` — a tela de login (regra 15); passo 6.
- `referencia/apps/web/src/App.tsx`, `App.test.tsx`, `componentes/AppShell.tsx` — usuário real, redirecionamento e Sair (regra 15); passo 6.
- `referencia/apps/web/e2e/inicio.spec.ts`, `login-real.spec.ts`, `login-real.config.ts` — Playwright simulado e o login de verdade com Mailpit; passos 7 e 9.
- `referencia/migracao-revogar-sessoes.md` — gatilho que revoga as sessões ao mudar papel ou ativo (regra 8); passo 5.

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm --filter web e2e` saem limpos.
- [ ] O login de verdade (`playwright test -c e2e/login-real.config.ts`, ou à mão com o Mailpit) entra, mostra o usuário e sai.
- [ ] A migração cria `codigo_login` e `sessao` com `hash_token` único e FK para `usuario`.
- [ ] Banco sem código nem token em claro: só `hmac` e `hash_token` (teste "banco guarda só hash").
- [ ] E-mail fora do domínio, inexistente e válido recebem o mesmo 202, o mesmo corpo e levam ≥ 600 ms; só o válido recebe e-mail.
- [ ] 6ª tentativa com o código certo é recusada; código de 11 min é recusado; o 4º pedido em 10 min não envia; o 2º código invalida o 1º.
- [ ] Sessão parada 31 min → 401; sessão com 12 h → 401; usuário desativado com sessão aberta → 401 na próxima requisição.
- [ ] Em produção (e com `NODE_ENV` ausente) o cookie é `__Host-sessao; HttpOnly; Secure; SameSite=Lax; Path=/`, sem `Domain`.
- [ ] A imagem de produção define `NODE_ENV=production`; o `.env` de desenvolvimento define `NODE_ENV=development`.
- [ ] Trocar papel ou desativar alguém derruba as sessões dele (migração do gatilho aplicada).
- [ ] `AUTH_SEGREDO_CODIGO_ARQUIVO` definida em produção (a API não sobe sem ela), igual em todas as instâncias.
- [ ] Nenhum usuário fixo na web: nome e papel vêm de `GET /api/auth/eu`; o botão Sair revoga a sessão.
- [ ] Assunto do e-mail fixo ("Seu código de acesso"), sem o código; conferido no Mailpit.
- [ ] `login-codigo-email` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
