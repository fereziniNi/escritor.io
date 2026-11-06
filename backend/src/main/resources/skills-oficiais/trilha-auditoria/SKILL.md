---
name: trilha-auditoria
description: Use quando um sistema Multiplica precisar de trilha de auditoria, log de auditoria, histórico de quem fez o quê, registro imutável de ações (quem, ação, alvo, antes e depois, IP, request-id), tabela só de inclusão que ninguém consegue editar ou apagar, papel de banco separado para a API (dono das migrações x runtime), tela de auditoria para o administrador com filtros por período, ator e ação, ou exportar a auditoria em CSV. Cobre a tabela evento_auditoria, o gatilho de imutabilidade, o REVOKE para o papel app_runtime, o AuditoriaService.registrar, GET /api/admin/auditoria, a TelaAuditoria e a ligação com os eventos do login e da administração de usuários.
---

# Trilha de auditoria Multiplica

Todo sistema Multiplica registra **quem fez o quê, em quê, quando e de onde** numa tabela que **só cresce**: nem a API, nem o
administrador, nem um `UPDATE` descuidado no console conseguem alterar ou apagar um evento. O código em `referencia/` é cópia
de um projeto-modelo que compila e passa nos testes (inclusive contra Postgres real, com os dois papéis de banco): copie e
adapte, não reescreva de memória. Vem da união de Conta Gráfica (gatilho `auditoria_imutavel`), BeyondCredit (`audit_event`),
CambIA (`operacoes_eventos`) e da ADR 0009 do escritor.io (papel de banco separado). É controle de segurança: **cada valor
abaixo é fixo**; mudar um deles é decisão registrada no `CLAUDE.md`.

## Padrão Multiplica

1. **Tabela** `evento_auditoria(id bigint identity, ocorrido_em timestamptz default now(), ator_id uuid null, acao text,
   alvo_tipo text, alvo_id text, antes jsonb, depois jsonb, ip text, request_id text)` e quatro índices
   (`ocorrido_em`; `ator_id, ocorrido_em`; `acao, ocorrido_em`; `alvo_tipo, alvo_id`). Sem chave estrangeira em `ator_id`
   (a trilha não depende da linha do usuário). `ator_id` nulo = sistema ou ainda não identificado (falha de login).
2. **Nome da ação** `grupo.acao` (`^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$`, até 64 caracteres): `usuario.desativar`, `auth.login`.
   Outro formato lança erro (é erro de programação, não vira lixo na trilha). Toda ação nova de escrita sensível
   (permissão, dado financeiro, configuração, exportação, apagar/desativar) registra um evento.
3. **Imutável em duas camadas**. (a) Gatilho `BEFORE UPDATE OR DELETE` por linha e `BEFORE TRUNCATE` por comando,
   `RAISE EXCEPTION 'evento_auditoria é imutável'` (código `23001`): vale para **qualquer** papel, inclusive o dono.
   (b) `REVOKE UPDATE, DELETE, TRUNCATE ON evento_auditoria FROM app_runtime`: o papel da API recebe `42501` (permissão
   negada). A migração é SQL à mão, conferido por `referencia/migracao-imutabilidade-auditoria.md`; nunca edite à mão o SQL gerado pelo drizzle-kit.
4. **Dois papéis de banco**. O **dono** (`DATABASE_URL`, o usuário que cria as tabelas) roda **só** as migrações. O **runtime**
   (`app_runtime`, `DATABASE_URL_RUNTIME`) é o que a API usa: `SELECT, INSERT, UPDATE, DELETE` em tudo menos a trilha
   (`INSERT` e `SELECT` só). Motivo: o dono ignora `REVOKE` contra si mesmo, então o `REVOKE` só vale para um papel que
   não é dono (ADR 0009). A migração cria `app_runtime` **sem login e sem senha** se ele não existir, dá os privilégios
   (`GRANT` nas tabelas e sequências existentes e `ALTER DEFAULT PRIVILEGES` para as futuras) e quem instala define a senha
   uma vez. `BancoModule` usa `DATABASE_URL_RUNTIME ?? DATABASE_URL`. **Falha fechada** (como o `AUTH_SEGREDO_CODIGO` do login): só com
   `NODE_ENV=development` ou `test` **declarados** a API pode rodar sem `DATABASE_URL_RUNTIME` (como o dono, com o gatilho protegendo);
   em produção, com `NODE_ENV` ausente ou vazio, **a API não sobe** (`exigirPapelRuntime`, chamado no `AuditoriaService`). E
   `DATABASE_URL_RUNTIME` com o **mesmo usuário** de `DATABASE_URL` é recusada já no `carregarConfig` (o REVOKE não valeria).
   O gatilho continua sendo a segunda camada, não um substituto: o dono pode `ALTER TABLE ... DISABLE TRIGGER`, por isso o
   dono nunca atende requisição.
5. **Gravar só por `AuditoriaService.registrar(evento, executor?)`**, a única porta de escrita (não existe método nem rota para
   editar ou apagar). `ator_id`, `acao`, `alvo_tipo`, `alvo_id`, `antes`, `depois` vêm de quem chama; **`ip` e `request_id`
   vêm da requisição em andamento** (`AsyncLocalStorage` preenchido por um middleware em toda a `/api`; o `request_id` é o
   `X-Request-Id` da resposta, o mesmo do log). Fora de requisição (tarefa agendada, script) ficam nulos.
6. **Atomicidade**: em ação de administração passe a **transação** da mudança (`registrar(evento, tx)`): o evento só existe
   se a mudança for confirmada, e se o evento não puder ser gravado a mudança não acontece. Ação recusada (409, 403) não deixa
   evento. No **login** o registro é "melhor esforço": falhar ao registrar vai para o log e nunca derruba o login.
7. **O que nunca entra em `antes`/`depois`**: código, token, cookie, senha, segredo, HMAC ou hash (`sanitizarDetalhes` troca por
   `[REDACTED]` o valor de qualquer chave com `codigo|token|cookie|senha|password|segredo|secret|hmac|hash|authorization|credencial`,
   em qualquer nível; texto acima de 500 caracteres é cortado; profundidade máxima 6). É a última barreira: a regra é quem
   chama **não passar** o dado. Dado pessoal só **mascarado** (`mascararEmail`: `a***@dominio`); **nome de pessoa e corpo
   de requisição nunca**. Teste: o banco inteiro não contém o código, o cookie nem o e-mail completo do login.
8. **Cobertura mínima** (já ligada nos arquivos da referência): login pelo token `REGISTRO_EVENTOS` da skill
   `login-codigo-email` (`auth.login`, `auth.logout`, `auth.falha_login`, `auth.codigo_bloqueado`, `auth.limite_codigo`; o
   `AuthModule` troca o `RegistroEventosNulo` pelo `RegistroEventosAuditoria`); administração de usuários da skill
   `usuarios-e-papeis` (`usuario.convidar`, `usuario.alterar_papel`, `usuario.desativar`, `usuario.reativar`, com
   `antes`/`depois` de `{ papel, ativo }`; no convite `antes` é nulo e `depois` leva e-mail mascarado, papel e ativo; mais
   `usuario.admin_inicial`, sem ator, quando a API cria o primeiro ADMIN por `ADMIN_INICIAL_EMAIL`);
   a exportação da própria trilha (`auditoria.exportar`).
9. **Leitura** `GET /api/admin/auditoria`, **só ADMIN** (`@Papeis('ADMIN')` na rota **e** `exigirPapel` no serviço; sem sessão
   401, GESTOR/USUARIO 403). Filtros: `de` e `ate` (instantes ISO **com fuso**, inclusivos), `atorId` (uuid), `acao`
   (igual, não prefixo), `cursor` e `limite` (padrão **50**, máximo **200**). Ordem: `id` decrescente; paginação por cursor
   (`proximoCursor` nulo na última página). Resposta com `Cache-Control: no-store` e validada pelo esquema de
   `packages/contratos/src/auditoria.ts`. Traz `atorEmail` (junção com `usuario`). **Só GET**: POST, PATCH e DELETE em
   `/api/admin/auditoria` dão 404.
10. **Exportação CSV provisória** (até a skill `exportacao`): `GET /api/admin/auditoria/csv` com os mesmos filtros, **BOM UTF-8**,
    separador **`;`**, linhas terminadas em CRLF, cabeçalho em português, data em horário de Brasília. Texto que começa com
    `= + - @` tab ou CR ganha apóstrofo (planilha não executa fórmula). No máximo **10.000** linhas; acima disso o cabeçalho
    `X-Exportacao-Truncada: true` avisa e a tela mostra o aviso. Quem exporta fica registrado (`auditoria.exportar`, com os
    filtros e a quantidade de linhas). Quando a skill `exportacao-excel-pdf-csv` for aplicada (depois desta), ela SUBSTITUI esta
    exportação: a rota vira `GET /api/admin/auditoria/exportar?formato=xlsx|pdf|csv` (mesmos filtros, limite `EXPORTACAO_MAX_LINHAS`, fluxo
    em lotes, evento `auditoria.exportar` gravado antes do corpo), o `csv.ts` daqui passa a viver em `exportacao/` e a tela usa o
    `BotaoExportar`. Nada disto muda enquanto ela não for aplicada.
11. **Tela** `TelaAuditoria` (`/admin/auditoria`, menu Admin "Auditoria"): filtros De, Até, Ator (lista de usuários), Ação (com
    sugestões) e botões Filtrar/Limpar; tabela com data e hora de Brasília, ator, ação, alvo, IP e "Detalhes" (antes, depois,
    request-id); "Carregar mais"; botão **Exportar CSV** (usa os filtros aplicados). Somente leitura: sem botão de editar ou apagar.
12. **Retenção e expurgo (LGPD)**: a trilha não tem "apagar", nem pela API nem pelo `app_runtime` (sem `DELETE`). Se a política de
    guarda exigir expurgo ou anonimização, é decisão registrada no `CLAUDE.md` e feita **fora da API**, por uma **migração do dono** (ou
    por um papel de manutenção separado, usado só nessa janela e nunca em `DATABASE_URL_RUNTIME`) que no mesmo script desabilita o
    gatilho (`ALTER TABLE evento_auditoria DISABLE TRIGGER evento_auditoria_sem_alteracao`), apaga ou anonimiza só o que a política
    manda (ex.: `ip` e e-mails mascarados com mais de N anos), registra o expurgo como um evento `auditoria.expurgo` e reabilita o
    gatilho. A skill `lgpd` detalha o procedimento; até lá, ninguém expurga.
13. **Riscos que sobram (aceitos)**: quem é superusuário do Postgres (ou o dono) ainda consegue burlar o gatilho e `DROP TABLE`;
    o `IP` é dado pessoal e fica guardado em claro; ações feitas direto no banco não passam por aqui. Para a trilha valer contra o dono, a cópia
    externa (backup/exportação periódica guardada fora do servidor) é decisão do projeto.

## Como aplicar

Pré-requisito: esqueleto da skill `novo-projeto-multiplica` e as skills `identidade-visual`, `seguranca`, `email-transacional`,
`usuarios-e-papeis` e `login-codigo-email` aplicadas (nesta ordem), com `pnpm test` passando. Sem nova dependência npm.
Ao copiar um arquivo de `referencia/`, mantenha o mesmo caminho relativo e **apague a 1ª linha** (`origem: ...`).

**Projeto no esqueleto:**

1. TDD, API — copie **primeiro** os testes: `apps/api/src/auditoria/sanitizar.spec.ts`, `csv.spec.ts`, `config-auditoria.spec.ts`,
   `apps/api/test/auditoria.e2e.spec.ts` e `packages/contratos/src/auditoria.spec.ts`. Rode `pnpm test`: tem de falhar (módulos
   inexistentes). O e2e usa `test/postgres.ts`, que agora devolve também `urlRuntime` (e `test/setup-global.ts`, que dá login ao `app_runtime` uma vez por servidor de teste) — substitua os dois pelos da referência — e `test/usuario-de-teste.ts` (`usuarios-e-papeis`). Todo teste que sobe a API com `NODE_ENV=production` (ou sem `NODE_ENV`) passa `DATABASE_URL_RUNTIME: urlRuntime` (ex.: `test/auth.e2e.spec.ts`).
2. Contratos: copie `packages/contratos/src/auditoria.ts`; no `index.ts` acrescente `export * from './auditoria.js';` no fim.
3. Código da API: copie `apps/api/src/auditoria/` inteiro (`sanitizar.ts`, `csv.ts`, `evento-auditoria.tabela.ts`,
   `contexto-requisicao.ts`, `auditoria.service.ts`, `auditoria.controller.ts`, `registro-eventos-auditoria.ts`, `auditoria.module.ts`).
4. Arquivos de skills anteriores — se ainda são os da etapa anterior, **substitua** pelos da referência; se outra skill mexeu
   neles, faça **só** a mudança descrita:
   - `apps/api/src/banco/esquema.ts`: a linha `export * from '../auditoria/evento-auditoria.tabela';`.
   - `apps/api/src/banco/banco.module.ts`: o `useFactory` usa `config.DATABASE_URL_RUNTIME ?? config.DATABASE_URL`.
   - `apps/api/src/config/config.ts`: a variável opcional `DATABASE_URL_RUNTIME` (Segredo) logo depois de `DATABASE_URL`.
   - `apps/api/src/app.module.ts`: `AuditoriaModule` nos `imports`, logo depois do `BancoModule` (é `@Global()`).
   - `apps/api/src/auth/auth.module.ts`: `{ provide: REGISTRO_EVENTOS, useExisting: RegistroEventosAuditoria }` no lugar do `RegistroEventosNulo`.
   - `apps/api/src/usuarios/usuarios.service.ts`: injeta `AuditoriaService`; `convidar` e `mudar` gravam o evento **dentro da transação**
     (`convidar` agora abre uma; `mudar` recebe `ator` e a `acao`).
   - `apps/api/src/usuarios/admin-inicial.ts`: injeta `AuditoriaService` e grava `usuario.admin_inicial` na transação.
   - `.env.example` e `deploy/.env.example`: o bloco "Trilha de auditoria" do fim.
5. Migrações: `pnpm --filter api exec drizzle-kit generate --name=evento_auditoria` (cria a tabela e os 4 índices; confira e não edite). Depois a
   migração à mão, como manda `referencia/migracao-imutabilidade-auditoria.md` (`drizzle-kit generate --custom
   --name=imutabilidade_auditoria` + o SQL de lá). Rode `pnpm --filter api test`: passa (precisa do Docker).
6. TDD, web — copie `apps/web/src/telas/TelaAuditoria.test.tsx`; `pnpm --filter web test` falha. Copie `lib/auditoria-api.ts` e
   `telas/TelaAuditoria.tsx`; no `App.tsx` (referência = arquivo depois de `login-codigo-email`) o import, o item "Auditoria" do
   grupo Admin e a rota `/admin/auditoria`.
7. Rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build` e `pnpm --filter web e2e`: tudo limpo.
8. Veja funcionando, de verdade: `docker compose up -d postgres mailpit`, `pnpm --filter api db:migrate`, dê login ao papel de
   runtime (`docker compose exec postgres psql -U app -d app -c "ALTER ROLE app_runtime LOGIN PASSWORD 'app_runtime'"`), descomente
   `DATABASE_URL_RUNTIME` no `.env`, `pnpm dev`, entre como administrador, convide e desative alguém e abra Admin → Auditoria. Prove a
   imutabilidade no banco: como `app_runtime` (`psql postgres://app_runtime:app_runtime@localhost:5432/app -c "delete from
   evento_auditoria"`) dá `permission denied`; como dono dá `evento_auditoria é imutável`.
9. Produção: o serviço de **migração** usa o dono (`DATABASE_URL`) e roda uma vez antes da API; o serviço da **API** usa só
   `DATABASE_URL_RUNTIME_ARQUIVO` (segredo do compose) e **não recebe** a senha do dono. A senha do `app_runtime` é definida
   uma vez (`ALTER ROLE app_runtime LOGIN PASSWORD ...` pelo dono). A skill `instalacao-docker-compose` monta isso.
10. Para auditar uma ação nova: injete `AuditoriaService` (é global) e chame `registrar({ acao: 'grupo.acao', atorId, alvoTipo,
    alvoId, antes, depois }, tx)` **dentro da transação** da mudança; escreva o teste que confere o evento (e que o 409/403 não deixa evento).

**Projeto existente fora do esqueleto** (outro framework ou ORM): não reescreva o sistema. Aplique o que independe de stack, com os
mesmos valores: a tabela e os índices do item 1; o gatilho e o `REVOKE` do item 3 (o SQL de `migracao-imutabilidade-auditoria.md`
vale em qualquer stack com Postgres); o papel de runtime separado do dono do item 4 (a aplicação só conecta como o runtime);
registro na mesma transação da mudança, `ip` e `request_id` vindos do contexto da requisição, sanitização e máscara do item 7;
leitura só para administrador e CSV com BOM e `;`. Em outro banco, troque o gatilho pelo mecanismo equivalente e mantenha a
separação de papéis. `auditoria.service.ts` e `sanitizar.ts` mostram o desenho completo. Registre no `CLAUDE.md` onde ficou cada coisa.

**Ao terminar:** acrescente `trilha-auditoria` em "Skills Multiplica aplicadas" do `CLAUDE.md`, `DATABASE_URL_RUNTIME` (e
`DATABASE_URL_RUNTIME_ARQUIVO` em produção) em "Variáveis de ambiente" e, em "Regras do projeto", que toda ação sensível nova registra evento de auditoria.

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou nas skills anteriores. De `novo-projeto-multiplica`:
`apps/api/src/banco/banco.ts` (`BANCO`, `Db`), `config/config.module.ts` (`CONFIG`), `config/segredo.ts` (`Segredo`),
`criar-app.ts`, `test/postgres.ts` (`subirPostgres`), `apps/web/src/lib/api.ts` (`ErroApi`, `pedir`). De `identidade-visual`:
`componentes/CabecalhoPagina.tsx`, `Campo.tsx`, `Cartao.tsx`, `estados.tsx` e o `Button` do shadcn (`componentes/ui/button.tsx`). De
`seguranca`: a guarda de origem (os POST do teste mandam `Origin`). De `email-transacional`: `email/servico-email.ts`
(o teste espia `disparar`). De `usuarios-e-papeis`: `usuarios/papeis.guard.ts` (`@Papeis`), `usuario-atual.ts` (`UsuarioAtual`,
`@UsuarioLogado`, `exigirPapel`), `usuarios.service.ts` (`validarOu400`), `usuario.tabela.ts`, `test/usuario-de-teste.ts`,
`apps/web/src/lib/usuarios-api.ts` (`listarUsuarios`). De `login-codigo-email`: `auth/registro-eventos.ts` (`REGISTRO_EVENTOS`,
`EventoAuth`), `auth.service.ts` (que já chama `registrarEvento`) e `auth.tabelas.ts`.

- `referencia/apps/api/src/auditoria/auditoria.service.ts` — `registrar`, `listar`, `exportarCsv` (regras 5, 6, 9, 10); passo 3 e para entender o desenho.
- `referencia/apps/api/src/auditoria/evento-auditoria.tabela.ts` — a tabela e os índices (regra 1); passos 3 e 5.
- `referencia/apps/api/src/auditoria/papel-runtime.ts` — `exigirPapelRuntime`, a falha fechada (regra 4); passo 3.
- `referencia/apps/api/src/auditoria/contexto-requisicao.ts` — IP e request-id da requisição (regra 5); passo 3.
- `referencia/apps/api/src/auditoria/sanitizar.ts` — `sanitizarDetalhes` e `mascararEmail` (regra 7); passo 3 e em toda ação nova.
- `referencia/apps/api/src/auditoria/csv.ts` — CSV com BOM, `;` e proteção de fórmula (regra 10); passo 3.
- `referencia/apps/api/src/auditoria/auditoria.controller.ts`, `auditoria.module.ts` — rotas só de leitura e o módulo global (regras 9 e 10); passo 3.
- `referencia/apps/api/src/auditoria/registro-eventos-auditoria.ts` — liga o login à trilha (regra 8); passo 3.
- `referencia/apps/api/src/auditoria/sanitizar.spec.ts`, `csv.spec.ts`, `config-auditoria.spec.ts`, `referencia/apps/api/test/auditoria.e2e.spec.ts`,
  `referencia/packages/contratos/src/auditoria.spec.ts` — todos os comportamentos acima contra Postgres real, com os dois papéis; passo 1.
- `referencia/migracao-imutabilidade-auditoria.md` — gatilho, papel `app_runtime`, privilégios e como dar login a ele (regras 3 e 4); passo 5.
- `referencia/apps/api/test/postgres.ts`, `test/setup-global.ts`, `test/auth.e2e.spec.ts`, `referencia/apps/api/src/banco/esquema.ts`, `banco/banco.module.ts`, `usuarios/admin-inicial.ts`, `config/config.ts`, `app.module.ts`, `auth/auth.module.ts`,
  `usuarios/usuarios.service.ts`, `referencia/.env.example`, `referencia/deploy/.env.example` — os arquivos de skills anteriores alterados; passo 4.
- `referencia/packages/contratos/src/auditoria.ts`, `index.ts` — esquemas do evento, da página e dos filtros; passo 2.
- `referencia/apps/web/src/lib/auditoria-api.ts`, `telas/TelaAuditoria.tsx`, `telas/TelaAuditoria.test.tsx`, `App.tsx` — a tela (regra 11); passo 6.

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm --filter web e2e` saem limpos.
- [ ] A migração cria `evento_auditoria` com os 4 índices, o gatilho (UPDATE/DELETE/TRUNCATE) e o papel `app_runtime`.
- [ ] Como `app_runtime`: `UPDATE`, `DELETE` e `TRUNCATE` na trilha dão `permission denied`; `INSERT` e `SELECT` funcionam; as outras tabelas continuam graváveis.
- [ ] Como dono: `UPDATE`, `DELETE` e `TRUNCATE` na trilha dão "evento_auditoria é imutável".
- [ ] A API conecta como `app_runtime` (`select current_user`); `DATABASE_URL_RUNTIME` definida em produção (sem ela, ou com o mesmo usuário do dono, a API não sobe).
- [ ] O serviço de migração usa o dono e a API só recebe a senha do runtime.
- [ ] `registrar` grava `request_id` (o mesmo do cabeçalho `X-Request-Id`), `ip` e `ator_id`; `registrar` na transação some junto com a mudança desfeita.
- [ ] Login, logout e falha de login geram evento; convidar, trocar papel, desativar e reativar geram evento com `antes` e `depois`.
- [ ] Nenhum código, token, cookie, senha ou e-mail completo no banco da trilha; nenhum nome de pessoa em `antes`/`depois`.
- [ ] `GET /api/admin/auditoria` e `/csv`: 401 sem sessão, 403 para GESTOR e USUARIO, 200 para ADMIN; POST/PATCH/DELETE dão 404.
- [ ] O CSV abre no Excel com acentos corretos (BOM), colunas separadas (`;`) e célula `=...` aparece como texto.
- [ ] A tela Admin → Auditoria lista, filtra por período, ator e ação, carrega mais e exporta; não tem botão de apagar nem editar.
- [ ] Ação sensível nova do projeto registra evento dentro da transação, com teste.
- [ ] `trilha-auditoria` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
