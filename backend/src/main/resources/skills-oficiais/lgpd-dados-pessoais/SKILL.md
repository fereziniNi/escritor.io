---
name: lgpd-dados-pessoais
description: Use quando um sistema Multiplica guardar ou mostrar dado pessoal (CPF, e-mail, telefone, nome de cliente ou titular) e precisar cumprir a LGPD — criptografia de campo AES-256-GCM com chave rotacionável (kid), índice cego HMAC para buscar CPF sem guardá-lo em claro, máscara de CPF e e-mail por papel nas respostas da API, logs sem dado pessoal (pino redact e varredura de CPF), retenção com expurgo/anonimização agendável, exportar e anonimizar dados do titular (direitos do art. 18) e o documento docs/lgpd.md. Cobre DADOS_CHAVES, DADOS_CHAVE_INDICE, RETENCAO_DIAS, o LgpdModule, o interceptor de máscara, os comandos lgpd:retencao e lgpd:recifrar e um exemplo completo (cliente com CPF cifrado).
---

# Dados pessoais e LGPD Multiplica

Todo sistema Multiplica que guarda dado pessoal segue o mesmo desenho: **CPF cifrado no banco**, **busca por índice
cego**, **máscara por papel** em toda resposta, **nada pessoal no log**, **retenção** com anonimização e as **rotas do
titular** (exportar e anonimizar). O código em `referencia/` é cópia de um projeto-modelo que compila e passa nos testes
(inclusive contra Postgres real): copie e adapte, não reescreva de memória — é criptografia, detalhe errado não aparece
em teste manual. Vem de BeyondCredit (`privacy/`), CONECTA (`modules/pii`) e FinAnalytics (masking). **Cada valor abaixo
é fixo**; mudar um deles é decisão registrada no `CLAUDE.md`.

## Padrão Multiplica

1. **Criptografia de campo AES-256-GCM** (`lgpd/chaveiro.ts`): IV aleatório de **12 bytes** por valor, tag de **16 bytes**
   (tamanho conferido ao decifrar: tag curta é recusada), **AAD = nome da coluna** (`cliente.cpf`: valor copiado para
   outra coluna não decifra). Envelope em texto **`kid:iv:tag:cifra`**, cada parte em base64 padrão. Dado adulterado,
   AAD trocada ou kid desconhecido → `ErroChaveiro` (a mensagem nunca traz chave nem conteúdo).
2. **Chaves** `DADOS_CHAVES="kid1:base64,kid2:base64"`: cada chave **32 bytes** em base64 padrão e canônico (base64url,
   espaço ou lixo são recusados), kid `^[a-z0-9][a-z0-9-]{0,31}$`, **kids distintos**, chaves distintas, nenhuma com todos
   os bytes iguais. **A primeira é a ativa** (cifra); as outras só decifram. `DADOS_CHAVE_INDICE`: 32 bytes, **diferente
   de todas as de dados**. As duas são `Segredo`, andam juntas e são validadas no `carregarConfig` (erro cita a variável,
   nunca o valor). Gerar: `openssl rand -base64 32`.
3. **Falha fechada** (como o segredo do login): sem `DADOS_CHAVES` e `DADOS_CHAVE_INDICE` a API **não sobe**
   (`carregarChavesLgpd`, chamado pelo `LgpdModule`), salvo com `NODE_ENV` **development** ou **test declarados** (o valor
   cru); ausente ou vazio conta como produção. Em dev/teste sem chaves: chaves aleatórias do processo, com aviso (o que
   for cifrado não abre depois de reiniciar — em dev, gere as chaves uma vez e ponha no `.env`).
4. **Rotação**: (1) chave nova **na frente** de `DADOS_CHAVES` (`k2:...,k1:...`) e reinicie; (2) `pnpm --filter api
   lgpd:recifrar` re-cifra o que ainda está numa chave antiga (idempotente); (3) só então retire a antiga. Dado cifrado
   com uma chave que continua na lista sempre decifra. `DADOS_CHAVE_INDICE` **não roda** junto (trocá-la = recalcular todos
   os índices).
5. **Índice cego** (`lgpd/indice-cego.ts`): **HMAC-SHA256** com `DADOS_CHAVE_INDICE` de `coluna + "\0" + valor
   normalizado`, em hex (64 caracteres). CPF normalizado = **só os 11 dígitos** (`normalizarCpf`); mesmo CPF → mesmo índice,
   em outra coluna → outro. Serve para busca exata e para a unicidade (`uniqueIndex` no índice → 409).
6. **No banco**: coluna `<campo>_cifrado` + `<campo>_indice`, com **CHECK** que recusa texto que não seja envelope, CHECK
   de 64 hex no índice e CHECK "os dois nulos ou os dois preenchidos" (ver `cliente.tabela.ts`; migração gerada pelo
   drizzle-kit, sem SQL à mão). CPF válido (dígitos verificadores, `cpfValido`) ou 400. **CPF nunca na URL**: busca por
   `POST .../busca-cpf` com o CPF no corpo.
7. **Máscara por papel** (`MascararDadosPessoaisInterceptor`, global via `APP_INTERCEPTOR`): toda resposta para quem **não é
   GESTOR nem ADMIN** (USUARIO, sem sessão, papel novo) sai com chave `cpf` → **`***.456.789-**`** (`mascararCpf("12345678909")`),
   chave `email` → **`a***@exemplo.com.br`** (`mascararEmail("ana.souza@exemplo.com.br")`) e CPF dentro de qualquer texto
   mascarado. Exceção: o objeto que é o próprio usuário logado (`id` igual) mantém o e-mail. Arquivo binário passa. Erro
   não passa pelo interceptor: **nunca** ponha dado pessoal em mensagem de erro.
8. **Logs sem dado pessoal** (`lgpd/redator-log.ts`, ligado no `log.module.ts`): `redact` do pino com `cpf`, `email`,
   `telefone`, `celular`, `dataNascimento`, `rg` (no topo e um nível abaixo) → `[REDACTED]`; e o destino do pino
   (`destinoSemDadosPessoais`) varre cada linha: CPF formatado sempre, 11 dígitos soltos só se forem CPF válido, viram
   `***.456.789-**` (na mensagem, em qualquer campo, na pilha do erro). A regra continua sendo **não passar** o dado ao logger;
   na trilha de auditoria, só o id do titular (nunca nome nem CPF; e-mail só mascarado).
9. **Retenção** (`lgpd/retencao.ts`, comando `pnpm --filter api lgpd:retencao`, função simples que a skill `fila-de-tarefas`
   pode agendar): com `RETENCAO_DIAS` = N (inteiro ≥ 1; **vazia = nada é expurgado**, prazo a definir com jurídico/DPO),
   anonimiza cliente com `encerrado_em` há mais de N dias, apaga `codigo_login` criados há mais de N dias e `sessao`
   criadas há mais de N dias e já vencidas; um evento `lgpd.retencao` resume. Roda com o **papel de runtime**.
10. **IP da trilha** (`RETENCAO_AUDITORIA_IP_DIAS`, vazia = trilha intacta), regra 12 da `trilha-auditoria`: o mesmo
    comando conecta como o **DONO** (`DATABASE_URL`) e, **numa transação só**, `DISABLE TRIGGER evento_auditoria_sem_alteracao`,
    `UPDATE ... SET ip = NULL` nos eventos mais velhos, `ENABLE TRIGGER` e grava `auditoria.expurgo`. Erro desfaz tudo (DDL é
    transacional) e a tabela fica travada durante a janela. Com o runtime falha (não é dono). **Nunca** dentro da API: rode
    onde o dono já existe (serviço de migração). Ligar é decisão registrada no `CLAUDE.md`.
11. **Direitos do titular** (`TitularController`, **só ADMIN** na rota e no serviço): `GET /api/admin/lgpd/titulares/:id/exportar`
    (JSON completo em anexo `titular-<id>.json`, `Cache-Control: no-store`, `@MesmaOrigem()`, evento `lgpd.exportar_titular`) e
    `POST /api/admin/lgpd/titulares/:id/anonimizar` (guarda de origem da `seguranca`; troca nome por `Titular anonimizado`, apaga
    e-mail, CPF cifrado e índice, marca `anonimizado_em`, **mantém o id**; evento `lgpd.anonimizar_titular` na mesma
    transação; de novo → 409). Retenção e rota usam a mesma `anonimizarCliente`.
12. **Documento** `docs/lgpd.md` a partir de `referencia/lgpd.md`: inventário (dado, onde, finalidade, base legal, proteção,
    quem vê, retenção), chaves e rotação, direitos do titular, retenção, compartilhamento e pendências marcadas **a definir**.
13. **Riscos que sobram (aceitos)**: nome e e-mail ficam em claro (exibição/busca); quem tem banco **e** chaves lê tudo
    (chaves fora do servidor de banco, no cofre do cliente); perder as chaves = perder os CPFs; o envelope não amarra a
    linha (trocar o CPF cifrado entre duas linhas da mesma coluna exige escrita no banco); backups antigos guardam o que
    a retenção já apagou.

## Como aplicar

Pré-requisito: esqueleto `novo-projeto-multiplica` e as skills `identidade-visual`, `seguranca`, `email-transacional`,
`usuarios-e-papeis`, `login-codigo-email` e `trilha-auditoria` aplicadas (nesta ordem), com `pnpm test` passando. Sem
dependência npm nova (só `node:crypto`). Ao copiar um arquivo de `referencia/`, mantenha o caminho e **apague a 1ª linha** (`origem: ...`).

**Projeto no esqueleto:**

1. TDD — copie **primeiro** os testes: `apps/api/src/lgpd/chaveiro.spec.ts`, `mascarar.spec.ts`, `redator-log.spec.ts`,
   `config-lgpd.spec.ts` e `apps/api/test/lgpd.e2e.spec.ts`. Rode `pnpm --filter api test`: tem de falhar (módulos inexistentes).
2. Código: copie `apps/api/src/lgpd/` inteiro (`cpf.ts`, `mascarar.ts`, `chaveiro.ts`, `indice-cego.ts`, `chaves.ts`,
   `redator-log.ts`, `mascarar-dados.interceptor.ts`, `lgpd.module.ts`, `retencao.ts`, `recifrar.ts`, `executar-lgpd.ts`) e o
   exemplo `apps/api/src/clientes/` (`cliente.tabela.ts`, `clientes.service.ts`, `clientes.controller.ts`,
   `titular.controller.ts`, `clientes.module.ts`).
3. Arquivos de skills anteriores — se ainda são os da etapa anterior, **substitua** pelos da referência; se outra skill mexeu
   neles, faça **só** a mudança descrita:
   - `apps/api/src/config/config.ts`: o import de `../lgpd/chaveiro`, as 4 variáveis do fim do schema (`DADOS_CHAVES`,
     `DADOS_CHAVE_INDICE`, `RETENCAO_DIAS`, `RETENCAO_AUDITORIA_IP_DIAS`), a função `motivo` e o bloco de chaves no fim do `superRefine`.
   - `apps/api/src/log/log.module.ts`: `...CAMPOS_PESSOAIS_LOG` no lugar de `'*.cpf', '*.email'` e o destino
     `destinoSemDadosPessoais(destino ?? pino.destination(1))`.
   - `apps/api/src/app.module.ts`: `LgpdModule` logo depois do `AuditoriaModule` e `ClientesModule` depois do `AuthModule`.
   - `apps/api/src/banco/esquema.ts`: `export * from '../clientes/cliente.tabela';`.
   - `apps/api/test/auth.e2e.spec.ts`: `DADOS_CHAVES` e `DADOS_CHAVE_INDICE` na config `PRODUCAO` (produção sem chaves não sobe).
     Todo teste seu que sobe a API com `NODE_ENV=production` faz o mesmo.
   - `.env.example` e `deploy/.env.example`: o bloco "Dados pessoais / LGPD" do fim.
   - `apps/api/package.json`, em `scripts`: `"lgpd:retencao": "tsx src/lgpd/executar-lgpd.ts retencao"` e
     `"lgpd:recifrar": "tsx src/lgpd/executar-lgpd.ts recifrar"`.
4. Migração: `pnpm --filter api exec drizzle-kit generate --name=cliente` (tabela, 3 CHECK, índice único do índice cego e
   índice de `encerrado_em`; confira e não edite). O `app_runtime` recebe os privilégios sozinho (default privileges da
   `trilha-auditoria`). Rode `pnpm --filter api test`: passa (precisa do Docker).
5. Troque o exemplo pela entidade real: cada coluna sensível vira `<campo>_cifrado` + `<campo>_indice` (só se precisar buscar),
   com uma constante de coluna (`COLUNA_CPF = 'cliente.cpf'`, que é a AAD); a entidade entra em `retencao.ts` (o que
   anonimizar e quando), em `recifrar.ts` e nas rotas do titular. Pode apagar `clientes/` se o sistema não tiver cliente.
6. Rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: tudo limpo.
7. Veja funcionando: gere as chaves (`openssl rand -base64 32`, duas vezes), ponha no `.env` (`DADOS_CHAVES=k1:<a>`,
   `DADOS_CHAVE_INDICE=<b>`), `pnpm --filter api db:migrate`, `pnpm dev`; crie um cliente (`POST /api/clientes`) e confira no
   banco que `cpf_cifrado` começa com `k1:` e não contém o CPF; como USUARIO a resposta vem `***.456.789-**`.
8. Produção: as chaves vão como **segredo em arquivo** (`DADOS_CHAVES_ARQUIVO`, `DADOS_CHAVE_INDICE_ARQUIVO`), guardadas também
   no cofre do cliente (perder = perder os CPFs). Agende `node dist/lgpd/executar-lgpd.js retencao` (diário) no serviço que tem
   o dono do banco; a skill `instalacao-docker-compose` monta isso.
9. Preencha `docs/lgpd.md` a partir de `referencia/lgpd.md` e leve as pendências ao jurídico/DPO.

**Projeto existente fora do esqueleto** (outro framework ou ORM): não reescreva o sistema. Aplique o que independe de stack,
com os mesmos valores: AES-256-GCM com IV de 12, tag de 16, AAD = coluna e envelope `kid:iv:tag:cifra` (o `chaveiro.ts` é
~120 linhas de `node:crypto`; em Java/Python use a mesma construção e teste ida e volta, AAD trocada e rotação); chaves
`kid:base64` de 32 bytes com a primeira ativa; índice cego HMAC-SHA256 com chave própria; CHECK no banco; máscara
`***.456.789-**` / `a***@dominio` para quem não é gestor/admin, no ponto único de saída das respostas; redação no logger;
retenção por comando agendado; exportar/anonimizar só para administrador e auditados. Registre no `CLAUDE.md` onde ficou cada coisa.

**Ao terminar:** acrescente `lgpd-dados-pessoais` em "Skills Multiplica aplicadas" do `CLAUDE.md`; `DADOS_CHAVES`,
`DADOS_CHAVE_INDICE`, `RETENCAO_DIAS` e `RETENCAO_AUDITORIA_IP_DIAS` em "Variáveis de ambiente"; e, em "Regras do projeto": dado
pessoal novo entra cifrado (ou justificado em `docs/lgpd.md`), nunca em log, URL ou mensagem de erro, e o valor de
`RETENCAO_DIAS` (ou "a definir") com quem decidiu.

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou nas skills anteriores. De `novo-projeto-multiplica`:
`apps/api/src/banco/banco.ts` (`BANCO`, `Db`, `criarBanco`), `config/config.module.ts` (`CONFIG`), `config/segredo.ts`,
`config/arquivo-env.ts`, `criar-app.ts`. De `seguranca`: `seguranca/origem.guard.ts` (`MesmaOrigem`; a guarda de origem dos POST).
De `email-transacional`: `email/enviador-email.ts` (o `mascarar.spec.ts` confere que o `mascararEmail` dele mascara igual).
De `usuarios-e-papeis`: `usuarios/papel.ts`, `papeis.guard.ts` (`@Papeis`), `usuario-atual.ts` (`exigirPapel`, `UsuarioLogado`),
`usuarios.service.ts` (`validarOu400`), `test/usuario-de-teste.ts`. De `login-codigo-email`: `auth/auth.tabelas.ts`
(`codigoLogin`, `sessao`, apagados na retenção). De `trilha-auditoria`: `auditoria/auditoria.service.ts` (`registrar`),
`auditoria/sanitizar.ts` (outra cópia de `mascararEmail`), `test/postgres.ts` (`urlRuntime`), `test/setup-global.ts` e o
gatilho `evento_auditoria_sem_alteracao`.

- `referencia/apps/api/src/lgpd/chaveiro.ts` — AES-256-GCM, leitura e validação das chaves, rotação (regras 1, 2, 4); passo 2 e para entender o desenho.
- `referencia/apps/api/src/lgpd/indice-cego.ts`, `cpf.ts` — HMAC do índice, normalização e validação do CPF (regras 5, 6); passo 2.
- `referencia/apps/api/src/lgpd/chaves.ts` — `carregarChavesLgpd`, a falha fechada, e o token `CHAVES_LGPD` (regra 3); passo 2.
- `referencia/apps/api/src/lgpd/mascarar.ts`, `mascarar-dados.interceptor.ts`, `lgpd.module.ts` — máscaras e o interceptor global (regra 7); passo 2.
- `referencia/apps/api/src/lgpd/redator-log.ts` e `referencia/apps/api/src/log/log.module.ts` — logs sem dado pessoal (regra 8); passos 2 e 3.
- `referencia/apps/api/src/lgpd/retencao.ts`, `recifrar.ts`, `executar-lgpd.ts` — retenção, expurgo do IP com o dono, re-cifra (regras 4, 9, 10); passos 2 e 8.
- `referencia/apps/api/src/clientes/` — o exemplo completo: tabela com CHECK, serviço, rotas e rotas do titular (regras 6, 11); passos 2 e 5.
- `referencia/apps/api/src/lgpd/*.spec.ts` e `referencia/apps/api/test/lgpd.e2e.spec.ts` — cada regra testada, inclusive contra Postgres com os dois papéis; passo 1.
- `referencia/apps/api/src/config/config.ts`, `app.module.ts`, `banco/esquema.ts`, `test/auth.e2e.spec.ts`, `referencia/.env.example`,
  `referencia/deploy/.env.example` — os arquivos de skills anteriores alterados; passo 3.
- `referencia/lgpd.md` — modelo do `docs/lgpd.md` do projeto (regra 12); passo 9.

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem limpos.
- [ ] Sem `DADOS_CHAVES`/`DADOS_CHAVE_INDICE` a API não sobe em produção (nem com `NODE_ENV` ausente); chave de tamanho errado, kid repetido ou índice igual a chave de dados é recusado no boot.
- [ ] No banco, nenhuma coluna tem CPF em claro (`cpf_cifrado` começa com o kid; o CHECK recusa texto puro).
- [ ] Busca por CPF funciona pelo índice cego, com o CPF no corpo (nunca na URL); CPF repetido → 409.
- [ ] Rotação testada: chave nova na frente, `lgpd:recifrar`, tudo continua legível.
- [ ] USUARIO vê `***.456.789-**` e `a***@dominio`; GESTOR e ADMIN veem completo.
- [ ] Nenhuma linha de log da bateria de testes contém CPF ou e-mail de titular.
- [ ] Exportar e anonimizar: 401/403 para quem não é ADMIN, guarda de origem no POST, evento na trilha sem dado pessoal; anonimizar mantém o id.
- [ ] `lgpd:retencao` sem `RETENCAO_DIAS` não apaga nada; com ela anonimiza só o que venceu. Se `RETENCAO_AUDITORIA_IP_DIAS` estiver ligada: decisão no `CLAUDE.md`, roda com o dono e o gatilho da trilha continua ativo depois.
- [ ] Chaves de produção em segredo de arquivo e no cofre do cliente; `docs/lgpd.md` preenchido com as pendências marcadas.
- [ ] `lgpd-dados-pessoais` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
