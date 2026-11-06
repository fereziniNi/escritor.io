---
name: fila-de-tarefas
description: Use quando um sistema Multiplica precisar fazer trabalho fora da requisição HTTP e sobreviver a reinício — tarefa em segundo plano, fila de jobs, worker, retry com backoff, tarefa que falha e precisa tentar de novo, rotina agendada (cron), enviar e-mail sem perder no deploy, processar algo pesado depois de responder ao usuário, avisar a TI quando uma tarefa falha de vez, evitar efeito duplicado (idempotência), "pg-boss", "ROLE=worker", "rodar a retenção da LGPD todo dia", "desligar sem perder tarefa em andamento". Cobre o pg-boss no mesmo Postgres (schema fila), registrarTarefa e agendar, ROLE api/worker/tudo/migrar, papel de runtime sem DDL, chave de idempotência, alerta por e-mail sem dado pessoal e encerramento gracioso.
---

# Fila de tarefas Multiplica

Tudo que não precisa acontecer **dentro** da requisição (e-mail, relatório pesado, rotina diária, integração lenta) vira uma **tarefa**
numa fila que mora no **mesmo Postgres** do sistema (pg-boss, schema `fila`): sobrevive a reinício, repete com espera crescente, roda
em um processo separado (o *worker*) e avisa a TI quando desiste. O código de `referencia/` é cópia de um projeto-modelo que compila e
passa nos testes (Postgres de verdade, papel de runtime sem DDL, Mailpit): copie e adapte, não reescreva de memória. Vem de FinAnalytics
(pg-boss, `ROLE`, encerramento gracioso), Conta Gráfica (worker) e Comitê (`lease.service.ts`, `retry.ts`). **Cada valor abaixo é fixo**;
mudar um é decisão do cliente, registrada no `CLAUDE.md`.

## Padrão Multiplica

1. **pg-boss `11.1.2` (versão exata, CJS) no mesmo Postgres, schema `fila`.** Nada de Redis nem de broker novo. Sem o schema, a aplicação
   não sobe (mensagem manda rodar o passo de migração).
2. **Cada tarefa nova entra em `fila/catalogo.ts`** (`FILAS_DO_SISTEMA`), com nome em minúsculas, números e hífen (`email-enviar`).
   Criar fila é DDL, e a API não pode fazer DDL: quem cria é o passo de migração. `registrarTarefa` de um nome fora do catálogo só
   funciona em desenvolvimento (a aplicação cria sozinha) e **falha em produção**.
3. **Dono cria, runtime só usa.** O schema `fila` (tabelas do pg-boss, filas e `fila.efeito_unico`) é criado com o **dono do banco**
   (`DATABASE_URL`) por `ROLE=migrar` ou `pnpm --filter api fila:migrar` (`prepararFila`), **depois** de `db:migrate` (é ele que cria o
   papel `app_runtime`). O runtime (`DATABASE_URL_RUNTIME`, skill `trilha-auditoria`) recebe só `GRANT SELECT, INSERT, UPDATE, DELETE`
   nas tabelas e `USAGE`/`EXECUTE` no schema `fila`; `CREATE TABLE fila.x` com ele tem de dar `permission denied` (teste).
4. **`registrarTarefa(nome, handler, { tentativas: 5, backoff: true })`.** Padrão: 5 tentativas no total; espera de 5 s que dobra a cada
   falha (5, 10, 20, 40 s; teto de 10 min). `backoff: false` = sempre 5 s. Registre **antes** de `iniciar()` (no `onModuleInit`).
5. **Entrega "pelo menos uma vez".** Por isso o handler tem de aguentar rodar duas vezes. Para garantir **um efeito só**, envie com
   chave: `fila.enviar(nome, dados, { chave })`. A chave é reservada em `fila.efeito_unico` antes de rodar; falha libera a chave
   (a nova tentativa roda); chave concluída nunca roda de novo; reserva de execução que morreu vence em **15 min**; chaves concluídas são
   apagadas depois de **30 dias** (tarefa `fila-limpar-chaves`, 04:00).
6. **Payload mínimo.** Ponha ids, não dados pessoais, e nunca segredo. O payload fica no banco até `deleteAfterSeconds` depois de
   terminar: use o **menor prazo** que ainda deixa investigar (e-mail: 1 dia, porque o payload é a mensagem inteira; demais: 1 a 7 dias).
7. **Falha definitiva → e-mail para `ALERTA_EMAIL`.** Vale quando as tentativas se esgotam ou o handler lança `ErroSemRetry` (não
   repete). O e-mail vai por `ServicoEmail.enviar` (direto, **nunca pela fila**) e leva só: tarefa, id do job, tentativas e tipo do
   erro. **Nunca o payload nem a mensagem do erro** (está no log do worker, achado pelo id). Em produção, `worker` e `tudo` sem
   `ALERTA_EMAIL` não sobem.
8. **`ROLE` = `api` | `worker` | `tudo` | `migrar`, mesma imagem.** `api` escuta a porta e só enfileira (não consome, não agenda, sem
   manutenção); `worker` consome e agenda, sem porta; `tudo` faz os dois; `migrar` prepara banco e fila e termina. Sem `ROLE`, vale
   `tudo` **só** com `NODE_ENV=development|test` declarado; em produção (ou `NODE_ENV` ausente) a aplicação **não sobe**.
9. **`agendar(nome, cron, { tz })`.** Cron de 5 campos, fuso padrão `America/Sao_Paulo`. Só `worker`/`tudo` gravam a rotina; com vários
   workers roda **uma vez**. Já agendadas: `lgpd-retencao` (`0 3 * * *`, a retenção da skill `lgpd-dados-pessoais`, só a parte do papel de
   runtime; o expurgo do IP da auditoria continua no comando com o dono) e `fila-limpar-chaves` (`0 4 * * *`).
10. **Encerramento gracioso.** No SIGTERM o `beforeApplicationShutdown` para de buscar tarefas e deixa as em andamento terminarem por até
    `FILA_ENCERRAR_TIMEOUT_S` (padrão **30**); o que passar disso é abandonado e repetido pela fila. O `stop_grace_period` do compose tem
    de ser **maior** (45 s). Acontece antes de fechar o HTTP e o pool do banco.
11. **E-mail passa pela fila.** `ServicoEmail.disparar(m, { chave? })` grava `email-enviar` (5 tentativas, backoff) e devolve na hora;
    `ErroEmailPermanente` vira `ErroSemRetry`. Se nem a fila aceitar (banco fora), cai para o envio em segundo plano com retry curto.
    `ServicoEmail.enviar` continua direto (rotinas, alerta). Isto **substitui** o aviso de perda no deploy da skill `email-transacional`.
12. **Banco inalcançável no boot não derruba**: a fila tenta de novo a cada 5 s (o `/api/health` mostra o banco fora). **Schema ausente
    ou sem permissão derruba** (configuração errada).
13. **Testes (todos no modelo):** falha 2x e passa na 3ª conclui; mesma chave 2x = 1 efeito; chave liberada se falha; falha definitiva
    alerta uma vez sem o payload; `ErroSemRetry` não repete; `ROLE=api` não consome; encerramento termina a tarefa em andamento e respeita
    o prazo; `agendar` grava cron e fuso; runtime sem DDL; e-mail entregue pelo Mailpit via fila (com chave dupla = 1 mensagem);
    sem `ROLE` ou sem `ALERTA_EMAIL` em produção não sobe.

## Como aplicar

Pré-requisito: skills anteriores aplicadas, na ordem do catálogo, até `upload-armazenamento`, e `pnpm test` passando. Esta skill usa
`email-transacional` (`ServicoEmail`, `montarEmail`), `trilha-auditoria` (papel `app_runtime`, `test/postgres.ts`) e `lgpd-dados-pessoais`
(`lgpd/retencao.ts`). Ao copiar um arquivo de `referencia/`, mantenha o mesmo caminho relativo e **apague a 1ª linha** (`origem: ...`).

**Projeto no esqueleto:**

1. Dependência (versão exata): `pnpm --filter api add -E pg-boss@11.1.2`. Acrescente em `apps/api/package.json`, em `scripts`:
   `"fila:migrar": "tsx src/fila/executar-migracao-fila.ts"`.
2. TDD — copie **primeiro** os testes: `apps/api/src/fila/papel.spec.ts`, `apps/api/test/fila.e2e.spec.ts` e `apps/api/test/fila-app.e2e.spec.ts`.
   `pnpm --filter api test`: tem de falhar (módulos inexistentes).
3. Código novo: `apps/api/src/fila/` inteiro (`papel.ts`, `catalogo.ts`, `fila.ts`, `preparar-fila.ts`, `executar-migracao-fila.ts`,
   `fila.module.ts`, `alerta-falha.ts`).
4. Arquivos de skills anteriores — se ainda são os da etapa anterior, **substitua** pelos da referência; se outra skill mexeu neles, faça **só** a mudança descrita:
   - `apps/api/src/config/config.ts`: o bloco "Fila de tarefas" (`ROLE`, `ALERTA_EMAIL`, `FILA_ENCERRAR_TIMEOUT_S`) no fim do esquema base.
     `.env.example` e `deploy/.env.example`: o bloco "Fila de tarefas" do fim.
   - `apps/api/src/app.module.ts`: `FilaModule` logo depois do `EmailModule` (o alerta envia e-mail e as tarefas usam o `BANCO`).
   - `apps/api/src/main.ts`: substitua pelo da referência (`ROLE=migrar` roda `migrarBanco` + `prepararFila` e termina; sem porta no `worker`).
   - `apps/api/src/email/servico-email.ts`: substitua (a tarefa `email-enviar` e o `disparar` pela fila; `enviar` fica como era).
     `enviar-com-retry.ts`: só o comentário do cabeçalho muda.
   - `apps/api/test/auth.e2e.spec.ts`: na config `PRODUCAO` acrescente `ROLE: 'api'` e, depois de `subirPostgres()`, `await prepararFila(urlBanco, { conceder: true })`
     (produção exige `ROLE` e o schema da fila vem do passo de migração).
5. Qualquer outro teste que suba a aplicação com `NODE_ENV=production` precisa dos mesmos dois ajustes (`ROLE` e `prepararFila`); com `NODE_ENV=test`/`development` nada muda.
6. `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: limpos (os e2e precisam do Docker: Postgres e Mailpit).
7. Veja funcionando: `docker compose up -d postgres mailpit`, `pnpm --filter api db:migrate`, `pnpm dev` (`tudo`, o schema `fila` nasce sozinho). Crie um usuário
   pela tela de admin: o convite chega no Mailpit (http://localhost:8025) **pela fila**. Pare o Mailpit, convide outra pessoa, suba o Mailpit de novo: a mensagem
   chega sozinha numa das tentativas. Com `psql`: `select name, state, retry_count from fila.job order by created_on desc limit 5;`.
8. Para criar uma tarefa sua: (a) o nome em `catalogo.ts`; (b) no `onModuleInit` de um provider, `fila.registrarTarefa<Dados>('relatorio-gerar', async ({ relatorioId }, ctx) => {...}, { tentativas: 5, backoff: true })`;
   (c) na rota, `await fila.enviar('relatorio-gerar', { relatorioId }, { chave: 'relatorio-' + relatorioId })` e responda 202; (d) rotina diária: `fila.agendar('relatorio-gerar', '0 6 * * *')`;
   (e) falha que nunca vai passar: `throw new ErroSemRetry('...')`. Rode `pnpm --filter api fila:migrar` onde houver `DATABASE_URL_RUNTIME` (ou suba com `ROLE=migrar`).
9. Produção: entregue `referencia/instalacao-fila.md` à skill `instalacao-docker-compose` (serviços `migracao`, `api`, `worker`, `stop_grace_period`).

**Projeto existente fora do esqueleto:** mantenha os **números** (5 tentativas, 5 s dobrando até 10 min, alerta sem payload, reserva de chave de 15 min, 30 s de
encerramento, `ROLE`, dono cria/runtime só DML). Em Node use o pg-boss 11; em Java, JobRunr ou Quartz sobre o mesmo Postgres; em Python, Procrastinate ou Celery com o
Postgres como broker. `papel.ts`, `catalogo.ts`, `preparar-fila.ts` e a lógica de `fila.ts` (envelope `{chave, dados}`, `umaVez`, decisão de falha definitiva) são a
especificação: reproduza o comportamento e os testes. Registre no `CLAUDE.md` onde ficou cada coisa.

**Ao terminar:** acrescente `fila-de-tarefas` em "Skills Multiplica aplicadas" do `CLAUDE.md`, as variáveis novas (`ROLE`, `ALERTA_EMAIL`, `FILA_ENCERRAR_TIMEOUT_S`) em
"Variáveis de ambiente" e, em "Regras do projeto", que trabalho fora da requisição passa pela `Fila`. Na skill `email-transacional` já aplicada, o limite "e-mail em andamento se perde no deploy" deixa de valer.

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou nas skills anteriores. De `novo-projeto-multiplica`: `config/config.module.ts` (`CONFIG`),
`config/arquivo-env.ts`, `banco/banco.ts` (`BANCO`), `banco/migrar.ts` (`migrarBanco`), `criar-app.ts`, `test/postgres.ts`. De `email-transacional`: `email/modelo-email.ts` (`montarEmail`, `escaparHtml`),
`email/enviador-email.ts`, `email/email.module.ts`. De `trilha-auditoria`: `auditoria/papel-runtime.ts` e o papel `app_runtime` (migração 0004). De `lgpd-dados-pessoais`: `lgpd/retencao.ts` (`executarRetencao`).

- `referencia/apps/api/src/fila/fila.ts` — a classe `Fila`: registrar, agendar, enviar, chave de idempotência, falha definitiva, encerramento (regras 4 a 10). Leia antes de criar qualquer tarefa.
- `.../fila/catalogo.ts` — filas do sistema e retenção de cada uma (regras 2 e 6). Leia ao acrescentar tarefa.
- `.../fila/preparar-fila.ts`, `executar-migracao-fila.ts` — passo do dono: schema, filas, `efeito_unico`, GRANTs (regra 3). Leia ao instalar.
- `.../fila/papel.ts` — `ROLE` e as regras de falha fechada (regras 7 e 8).
- `.../fila/fila.module.ts`, `alerta-falha.ts` — ligação ao Nest, ciclo de vida, tarefas do sistema e o e-mail de alerta (regras 7, 9, 10, 12).
- `.../email/servico-email.ts`, `enviar-com-retry.ts` — o e-mail pela fila (regra 11).
- `.../fila/papel.spec.ts`, `apps/api/test/fila.e2e.spec.ts`, `fila-app.e2e.spec.ts` — testes (regra 13); passo 2.
- `referencia/apps/api/src/main.ts`, `app.module.ts`, `config/config.ts`, `test/auth.e2e.spec.ts`, `.env.example`, `deploy/.env.example` — versões completas dos arquivos alterados.
- `referencia/instalacao-fila.md` — serviços do compose de produção para a skill de instalação.

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` limpos (inclui os e2e contra Postgres e Mailpit).
- [ ] Tarefa que falha 2x e passa na 3ª conclui; mesma chave enviada 2x produz 1 efeito.
- [ ] Falha definitiva manda e-mail para `ALERTA_EMAIL` só com tarefa, id, tentativas e tipo do erro (sem payload).
- [ ] `ROLE=api` não consome a fila; sem `ROLE` em produção (ou `NODE_ENV` ausente) a aplicação não sobe; `worker`/`tudo` sem `ALERTA_EMAIL` em produção não sobem.
- [ ] O schema `fila` foi criado pelo dono (`ROLE=migrar`/`fila:migrar`) e o runtime não consegue `CREATE TABLE` nele.
- [ ] SIGTERM com tarefa em andamento: ela termina (até `FILA_ENCERRAR_TIMEOUT_S`) e `stop_grace_period` do compose é maior que isso.
- [ ] `lgpd-retencao` e `fila-limpar-chaves` aparecem em `fila.schedule` com `America/Sao_Paulo`.
- [ ] O convite/código de e-mail chega pela fila (Mailpit) e uma queda do SMTP não perde a mensagem.
- [ ] Nenhuma tarefa nova leva dado pessoal no payload sem necessidade; `catalogo.ts` tem a retenção dela.
- [ ] `fila-de-tarefas` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
