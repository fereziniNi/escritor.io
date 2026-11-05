---
name: usuarios-e-papeis
description: Use quando um sistema Multiplica precisar de usuários com papéis (administrador, gestor, usuário comum), controle de quem pode o quê, tela de administração de usuários, convidar alguém por e-mail, ativar ou desativar usuário, trocar o papel, definir o primeiro administrador, ou quando o pedido for "perfis de acesso", "permissões", "RBAC", "guard de papel", "@Papeis" ou "tela de admin". Cobre a tabela usuario, o enum de papéis, o guard e a checagem de escopo no serviço, o convite por e-mail e a tela TelaUsuarios.
---

# Usuários e papéis Multiplica

Quem pode entrar no sistema e o que cada um pode fazer: tabela `usuario`, três papéis (`ADMIN`, `GESTOR`, `USUARIO`)
que se estendem, guard por papel nas rotas **e** checagem de escopo dentro do serviço, convite por e-mail, desativar em
vez de apagar e a tela de administração. O código em `referencia/` é cópia de um projeto-modelo que compila e passa
nos testes: copie e adapte, não reescreva de memória. Vem da união de BeyondCredit (`roles.ts`, `users/`,
`bootstrap-admin.ts`), Comitê (`PerfisGuard`, escopo por comitê), Conta Gráfica (`PERMISSOES`, `admin/`) e CambIA, com as
lições dos pentests (SEC-001 e VULN-02: o decorator sozinho não protege o dado).

## Padrão Multiplica

1. **Tabela `usuario`** (`apps/api/src/usuarios/usuario.tabela.ts`, exportada por `banco/esquema.ts`):
   `id` uuid (padrão `gen_random_uuid()`), `email` text, `nome` text, `papel` enum `papel` (padrão `USUARIO`),
   `ativo` boolean (padrão `true`), `criado_em` timestamptz. **Único em `lower(email)`**
   (`CREATE UNIQUE INDEX "usuario_email_unico" ON "usuario" USING btree (lower("email"))`): o banco recusa `Ana@x.com`
   e `ana@x.com` juntos. E-mail sempre guardado **em minúsculas e sem espaços** (`normalizarEmail`).
2. **Papéis**: `PAPEIS = ['ADMIN', 'GESTOR', 'USUARIO']` (`usuarios/papel.ts`, igual a `packages/contratos/src/usuarios.ts`;
   `papel.spec.ts` falha se divergirem). Sempre MAIÚSCULO, comparado por **igualdade exata**: `"admin"`, `"Admin"` e
   `"ADMIN "` não valem (nem no token/sessão, nem no corpo da requisição: viram 403 e 400). Papel novo: acrescente nos
   dois arquivos, rode `pnpm --filter api db:generate` (o drizzle-kit gera o `ALTER TYPE ... ADD VALUE`) e decida em
   cada `@Papeis(...)` quem o recebe.
3. **Contrato com a skill de login** (`usuarios/usuario-atual.ts`). Quem sabe QUEM está logado é o login; esta skill só lê
   `req.usuario`, do tipo `UsuarioAtual { id, email, nome, papel }`. A skill `login-codigo-email` (ou outro login) deve,
   num middleware executado em toda requisição a `/api`: validar a sessão, **ler o usuário na tabela `usuario` e exigir
   `ativo = true`** (desativado perde o acesso na hora, mesmo com sessão aberta), e então fazer `req.usuario = { id, email,
   nome, papel }` com o papel **vindo da tabela, nunca do cookie ou do token**. Sem sessão válida, `req.usuario` fica
   `undefined`. O login só aceita e-mail que exista em `usuario` com `ativo = true` (é assim que "convidar" dá acesso).
   Enquanto não há login: nos testes use `test/usuario-de-teste.ts` (`exporUsuarioDeTeste(app)` + cabeçalho `x-usuario-teste`,
   que existe só em `test/` e nunca vai para o build).
4. **Guard por papel** (`usuarios/papeis.guard.ts`): `@Papeis('ADMIN')` no método ou no controller já liga o
   `PapeisGuard`. Sem `req.usuario` → **401**; papel fora da lista → **403**; rota com o guard e sem `@Papeis` → 403 (falha
   fechada); `@Papeis()` vazio lança erro ao declarar. **Toda rota de controller novo declara o papel** (`@Papeis(...)`);
   rota sem decorator fica aberta a qualquer um que o login deixe passar.
5. **Checagem de escopo no serviço, não só no decorator** (lição SEC-001/VULN-02). `@Papeis` diz QUEM PODE CHAMAR;
   o serviço diz DE QUEM O DADO PODE SER LIDO ou ALTERADO. Padrão em `usuarios.service.ts`:
   - `exigirPapel(ator, 'ADMIN')` na 1ª linha de todo método sensível (assim, se o serviço for chamado por outra rota, tarefa
     agendada ou outro serviço, a regra continua valendo);
   - escopo por dono: `perfil(ator, id)` deixa `ADMIN` ler qualquer um e `GESTOR`/`USUARIO` só `id === ator.id`, senão **403**;
   - todo serviço de dado "de alguém" recebe o `ator` (`UsuarioAtual`) como 1º argumento e filtra por ele
     (`where dono_id = ator.id` ou, para gestor, pelo conjunto que lhe pertence). Teste obrigatório: usuário A tentando
     ler/alterar o dado do usuário B → 403, **chamando também o serviço direto**, sem o guard.
6. **Nunca apagar** (`desativar`/`reativar`): `ativo` vira `false`/`true`, a linha fica (histórico e chaves estrangeiras
   válidos). Não existe rota `DELETE` de usuário (devolve 404) nem botão de apagar na tela.
7. **Último ADMIN protegido**: não se pode **desativar** nem **rebaixar** o último `ADMIN` ativo → **409** "Não é possível
   remover o último administrador ativo". Vale também para um admin tirar a si mesmo. A checagem é numa transação que trava
   os ADMIN ativos (`FOR UPDATE`, ordenados por `id`, sem deadlock): dois admins se desativando ao mesmo tempo não zeram
   os administradores (um recebe 200, o outro 409). `ADMIN` desativado não conta como ativo.
8. **Primeiro administrador** (`usuarios/admin-inicial.ts`): com `ADMIN_INICIAL_EMAIL` definida e **nenhum ADMIN ativo**, a
   API cria esse usuário (`nome` "Administrador", `ADMIN`, ativo) ao subir; se o e-mail já existir (por exemplo desativado),
   reativa e promove (recuperação). Com algum ADMIN ativo no banco não faz nada, então reiniciar não recria nem altera
   ninguém. Trava de aconselhamento do Postgres evita criar duas vezes com várias instâncias. Variáveis: `ADMIN_INICIAL_EMAIL`
   (opcional; validada e normalizada no boot) e `NOME_SISTEMA` (padrão `Sistema`, uma linha de até 80 caracteres).
9. **Convidar** (`UsuariosService.convidar`): só ADMIN; cria o usuário **já ativo** e avisa por e-mail com a skill
   `email-transacional` (`ServicoEmail.disparar`, nunca espera o SMTP): assunto fixo **"Você foi adicionado ao sistema"**
   (sem nome nem dado pessoal), corpo com `montarEmail` dizendo "Você foi adicionado ao <NOME_SISTEMA>... entre com seu
   e-mail", **nome e nome do sistema passam por `escaparHtml`**. O convite não manda link nem código: o acesso é do login.
   E-mail já cadastrado (em qualquer caixa) → **409**, sem enviar e-mail.
10. **Rotas** (`usuarios.controller.ts`, todas sob `/api/usuarios`): `GET /` (ADMIN, lista com ativos e desativados),
    `POST /` (ADMIN, convidar, 201), `PATCH /:id/papel` (ADMIN), `POST /:id/desativar` e `POST /:id/reativar` (ADMIN, 200),
    `GET /eu` e `GET /:id` (qualquer papel; `:id` com escopo da regra 5). Corpo validado com zod (400 "Dados inválidos");
    `:id` precisa ser UUID (400); id inexistente → 404. As rotas que mudam dados passam pela guarda de origem da skill
    `seguranca` (Origin de outro site → 403): nos testes envie `Origin` da própria origem ou de `CORS_ORIGENS`.
    A resposta só tem `id, email, nome, papel, ativo, criadoEm`.
11. **Tela `TelaUsuarios`** (`apps/web/src/telas/TelaUsuarios.tsx`, rota `/usuarios` no grupo "Admin" do `AppShell`),
    com os componentes da skill `identidade-visual` (`CabecalhoPagina`, `Cartao`, `Campo`, `Selo`, `estados`, tabela densa):
    formulário Convidar (e-mail, nome, papel), tabela com papel editável (valor do enum, rótulo em português de
    `ROTULO_PAPEL`), selo Ativo/Desativado, botão Desativar/Reativar. Erros da API (último administrador, e-mail repetido,
    403) aparecem com a mensagem dela. A tela só chama a API; **esconder o menu não é segurança**, quem recusa é a API.
12. **Testes** (todos no modelo): USUARIO em `@Papeis('ADMIN')` → 403; sem usuário → 401; papel `"admin"` minúsculo → 403;
    desativar não apaga a linha; admin inicial criado uma vez só (reiniciando 3 vezes); último ADMIN: desativar e rebaixar →
    409, e a corrida de dois admins; e-mail em outra caixa → 409 e índice único no banco; convite com e-mail normalizado,
    assunto fixo e nome escapado; escopo no serviço chamado direto; telas com `fetch` falso.

## Como aplicar

Pré-requisito: esqueleto da skill `novo-projeto-multiplica` e as skills `identidade-visual`, `seguranca` e
`email-transacional` aplicadas (nesta ordem), com `pnpm test` passando. Sem nova dependência npm. Ao copiar um arquivo
de `referencia/`, mantenha o mesmo caminho relativo e **apague a 1ª linha** (`origem: ...`).

**Projeto no esqueleto:**

1. TDD, API — copie **primeiro** os testes: `apps/api/src/usuarios/papel.spec.ts`, `papeis.guard.spec.ts`,
   `config-usuarios.spec.ts`, `apps/api/test/usuarios.e2e.spec.ts` e `apps/api/test/usuario-de-teste.ts`. Rode
   `pnpm --filter api test`: tem de falhar (módulos e variáveis inexistentes).
2. Código da API: copie `apps/api/src/usuarios/` (`papel.ts`, `usuario.tabela.ts`, `usuario-atual.ts`, `papeis.guard.ts`,
   `usuarios.service.ts`, `usuarios.controller.ts`, `admin-inicial.ts`, `usuarios.module.ts`).
3. Arquivos do esqueleto — se ainda são os da etapa anterior, **substitua** pelos da referência; se outra skill mexeu
   neles, faça **só** a mudança descrita:
   - `apps/api/src/banco/esquema.ts`: a linha `export * from '../usuarios/usuario.tabela';`.
   - `apps/api/src/config/config.ts`: `ADMIN_INICIAL_EMAIL` e `NOME_SISTEMA` no fim do `esquemaBase`. A referência é o
     arquivo completo **depois da skill `email-transacional`**.
   - `apps/api/src/app.module.ts`: `UsuariosModule` nos `imports`, depois do `EmailModule`.
   - `.env.example` e `deploy/.env.example`: o bloco "Usuários e papéis" do fim.
4. Migração: `pnpm --filter api db:generate`. O SQL gerado tem de ser, nesta ordem, `CREATE TYPE "public"."papel" AS
   ENUM('ADMIN', 'GESTOR', 'USUARIO')`, `CREATE TABLE "usuario" (...)` e o `CREATE UNIQUE INDEX "usuario_email_unico" ...
   (lower("email"))` da regra 1; confira e não edite à mão. `pnpm --filter api test` aplica a migração em cada banco de teste.
5. Rode `pnpm --filter api test`: passa (o e2e precisa do Docker).
6. TDD, contratos e web — copie `packages/contratos/src/usuarios.ts`, `usuarios.spec.ts` e o `index.ts` (que ganha
   `export * from './usuarios.js';`, **depois** do import de `sem-eval.js`), e `apps/web/src/telas/TelaUsuarios.test.tsx`;
   `pnpm --filter web test` falha. Copie `apps/web/src/lib/usuarios-api.ts` e `telas/TelaUsuarios.tsx`, e no `App.tsx` o
   item "Usuários" do menu Admin e a rota `/usuarios` (a referência é o `App.tsx` completo depois da skill `identidade-visual`).
7. Rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: tudo limpo.
8. Veja funcionando: defina `ADMIN_INICIAL_EMAIL` no `.env`, `docker compose up -d postgres mailpit`,
   `pnpm --filter api db:migrate` e `pnpm dev`; confira a linha do administrador no banco
   (`docker compose exec postgres psql -U app -c "select email, papel, ativo from usuario"`). A tela `/usuarios` só
   carrega com um login ligado (passo 9); até lá, quem prova o comportamento são os testes.
9. **Ligue ao login** (assim que a skill `login-codigo-email` for aplicada): o middleware dela preenche `req.usuario` como na
   regra 3, e `usuario-de-teste.ts` continua só nos testes. Em produção defina `ADMIN_INICIAL_EMAIL` (e `NOME_SISTEMA`).
10. Em cada módulo de negócio: `@Papeis(...)` em toda rota e `exigirPapel`/escopo no serviço (regra 5), com o teste do
    usuário A lendo o dado do usuário B.

**Projeto existente fora do esqueleto** (outro framework ou sem NestJS): não reescreva o sistema. Aplique o que independe
de stack: tabela com `papel` enum, e-mail em minúsculas com índice único em `lower(email)` e `ativo` (nunca apagar);
papéis em MAIÚSCULO comparados por igualdade exata; middleware de login que lê o usuário no banco a cada requisição e exige
`ativo`; guard por papel (401 sem usuário, 403 com papel errado, falha fechada); checagem de papel e de dono **dentro do
serviço**; trava do último administrador numa transação com `FOR UPDATE`; administrador inicial por variável de ambiente
quando não há ADMIN ativo; convite por e-mail com assunto fixo e nome escapado. `papel.ts`, `usuario-atual.ts` e
`papeis.guard.ts` mostram o desenho. Registre no `CLAUDE.md` onde ficou cada coisa.

**Ao terminar:** acrescente `usuarios-e-papeis` em "Skills Multiplica aplicadas" do `CLAUDE.md`, as variáveis em
"Variáveis de ambiente" e a lista de papéis do sistema.

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou nas skills anteriores. De `novo-projeto-multiplica`:
`apps/api/src/banco/banco.ts` (`BANCO`, `Db`), `config/config.module.ts` (`CONFIG`), `test/postgres.ts`
(`subirPostgres`), `criar-app.ts`, `apps/web/src/lib/api.ts` (`pedir`, `ErroApi`). De `identidade-visual`:
`apps/web/src/componentes/` (`CabecalhoPagina`, `Cartao`, `Campo`, `Selo`, `estados`), `lib/formatos.ts`; o `Button`
(`componentes/ui/button.tsx`) é gerado pelo shadcn (`pnpm dlx shadcn@latest add button` em `apps/web`) como ensina essa skill.
De `seguranca`: a guarda de origem que protege as rotas de escrita. De `email-transacional`: `ServicoEmail`,
`montarEmail`/`escaparHtml` (`email/modelo-email.ts`) e `mascararEmail` (`email/enviador-email.ts`).

- `referencia/apps/api/src/usuarios/papel.ts` — `PAPEIS`, `ehPapel` (regra 2); passo 2.
- `referencia/apps/api/src/usuarios/usuario.tabela.ts` — tabela, enum e índice único (regra 1); passo 2.
- `referencia/apps/api/src/usuarios/usuario-atual.ts` — `UsuarioAtual`, `req.usuario`, `@UsuarioLogado`, `exigirPapel` (regras 3 e 5); passo 2 e ao ligar o login.
- `referencia/apps/api/src/usuarios/papeis.guard.ts` — `@Papeis` e `PapeisGuard` (regra 4); passo 2 e ao criar qualquer controller.
- `referencia/apps/api/src/usuarios/usuarios.service.ts` — convidar, papel, desativar, reativar, escopo e último ADMIN (regras 5 a 9); passo 2 e como modelo de serviço com escopo.
- `referencia/apps/api/src/usuarios/usuarios.controller.ts` — as rotas e a validação (regra 10); passo 2.
- `referencia/apps/api/src/usuarios/admin-inicial.ts`, `usuarios.module.ts` — primeiro administrador e o módulo (regra 8); passo 2.
- `referencia/apps/api/src/usuarios/*.spec.ts`, `referencia/apps/api/test/usuarios.e2e.spec.ts`, `referencia/apps/api/test/usuario-de-teste.ts` — testes e o substituto do login (regras 3 e 12); passo 1.
- `referencia/apps/api/src/banco/esquema.ts`, `config/config.ts`, `app.module.ts`, `referencia/.env.example`, `referencia/deploy/.env.example` — os arquivos do esqueleto alterados; passo 3.
- `referencia/packages/contratos/src/usuarios.ts`, `usuarios.spec.ts`, `index.ts` — esquemas compartilhados com a web; passo 6.
- `referencia/apps/web/src/lib/usuarios-api.ts`, `telas/TelaUsuarios.tsx`, `telas/TelaUsuarios.test.tsx`, `App.tsx` — a tela e a rota (regra 11); passo 6.

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem limpos (inclui o e2e contra o Postgres do Docker).
- [ ] A migração gerada tem o enum `papel`, a tabela `usuario` e o índice único em `lower("email")`.
- [ ] Toda rota de controller tem `@Papeis(...)`; todo método de serviço sensível começa com `exigirPapel` ou checa o dono.
- [ ] Existe teste de "usuário A lê/altera dado do usuário B → 403" chamando o serviço direto, sem o guard.
- [ ] Papel `"admin"` minúsculo (token, sessão ou corpo) é recusado; `USUARIO` em rota de ADMIN dá 403 e sem sessão dá 401.
- [ ] Não há `DELETE` nem botão de apagar usuário; desativar mantém a linha.
- [ ] Desativar e rebaixar o último ADMIN ativo devolvem 409, inclusive em requisições simultâneas.
- [ ] `ADMIN_INICIAL_EMAIL` definida em produção; reiniciar a API não cria outro administrador.
- [ ] O convite chega com assunto fixo e o nome escapado (confira no Mailpit); e-mail repetido em outra caixa dá 409.
- [ ] O middleware do login preenche `req.usuario` com o papel **da tabela** e recusa usuário com `ativo = false`.
- [ ] `usuarios-e-papeis` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
