---
name: email-transacional
description: Use quando um sistema Multiplica precisar enviar e-mail - código de acesso, link de login, convite, aviso, alerta de falha, recuperação de acesso - ou quando o pedido for "enviar e-mail", "configurar SMTP", "nodemailer", "template de e-mail com a identidade visual", "testar e-mail em desenvolvimento" ou "Mailpit". Cobre a interface EnviadorEmail (SMTP e modo log), retry simples, Mailpit no compose de dev e o modelo HTML/texto com as cores da Multiplica.
---

# E-mail transacional Multiplica

Envio de e-mail de sistema (não é marketing) por SMTP, com uma interface única, um modo `log` só para
desenvolvimento (recusado em produção), caixa de entrada falsa (Mailpit) no compose de dev e um modelo de mensagem
com a identidade visual. O código em `referencia/` é cópia de um projeto-modelo que compila e passa nos testes:
copie e adapte, não reescreva de memória. Vem da união de CambIA (`MagicLinkSender`), BeyondCredit (`OtpMailer`),
Comitê (`MailService`) e Conta Gráfica.

## Padrão Multiplica

1. **Interface única** (`apps/api/src/email/enviador-email.ts`): `EnviadorEmail { enviar(m: MensagemEmail): Promise<void> }`
   com `MensagemEmail = { para: string; assunto: string; html: string; texto: string }`. Sempre as duas versões
   (HTML e texto). O resto do sistema injeta `ServicoEmail` (nunca o `EnviadorEmail` direto nem o `nodemailer`).
2. **Dois enviadores**: `EnviadorSmtp` (nodemailer) e `EnviadorLog` (só registra o envio). Escolha por `MAIL_MODE=smtp|log`
   em `email/email.module.ts`. Padrão do schema: `log`.
3. **`log` é recusado em produção**: `carregarConfig` lança `ErroConfiguracao` citando `MAIL_MODE` quando
   `NODE_ENV=production` e `MAIL_MODE=log` (inclusive quando a variável nem foi definida). O sistema não sobe sem e-mail de verdade.
4. **Variáveis** (no schema E nos dois `.env.example`; o teste `env-documentadas` cobra):
   `MAIL_MODE` (`smtp`|`log`, padrão `log`), `SMTP_HOST` (obrigatória com `smtp`), `SMTP_PORT` (padrão **587**),
   `SMTP_SEGURO` (`true`|`false`, padrão `false`: `true` = TLS direto na 465; `false` = STARTTLS), `SMTP_USUARIO`,
   `SMTP_SENHA` (**`Segredo`**; em produção `SMTP_SENHA_ARQUIVO=/run/secrets/smtp_senha`), `EMAIL_REMETENTE`
   (obrigatória com `smtp`; `Sistema <nao-responda@exemplo.com.br>`, uma linha só). `SMTP_USUARIO` e `SMTP_SENHA` andam juntos.
   Recusados no boot: porta **465** com `SMTP_SEGURO=false` (a conexão travaria; na 465 é `true`) e, em produção, porta **25**
   sem TLS.
5. **A senha do SMTP nunca vaza**: é `Segredo` (`[REDACTED]` em JSON, `String()` e `inspect`); só o `EnviadorSmtp` chama
   `revelar()`, ao criar o transporte. Com usuário e `SMTP_SEGURO=false`, o transporte usa `requireTLS: true` (a senha
   nunca vai em claro por STARTTLS opcional). Sem usuário (relay anônimo de rede interna, Mailpit) o STARTTLS é
   **oportunista**: usa TLS se o servidor oferecer e segue sem ele se não; relay anônimo só com a TI do cliente, em rede interna, nunca pela internet.
6. **Log e erro sem dado pessoal**: nunca o corpo da mensagem; destinatário sempre mascarado com `mascararEmail`
   (`ana.silva@exemplo.com.br` -> `a***@exemplo.com.br`), inclusive dentro de mensagens de erro do servidor SMTP. O erro
   lançado não leva `cause` (o original traz o endereço completo). **Nunca ponha código, link de login ou dado pessoal
   no assunto**: o assunto aparece em log, em notificação de celular e na lista de e-mails.
7. **Anti-injeção de cabeçalho**: `para` é um único endereço (sem nome, vírgula, espaço ou quebra de linha),
   `assunto` sem quebra de linha, `EMAIL_REMETENTE` sem quebra de linha. Quebra = `ErroEmailPermanente` (não repete). Vale também no `EnviadorLog`: o erro de endereço ou assunto
   aparece já em desenvolvimento, e o log nunca recebe quebra de linha.
8. **Funciona sozinho, sem fila** (`email/enviar-com-retry.ts`): até **3 tentativas**, espera de 500 ms e 1,5 s entre elas;
   prazos do SMTP de 5 s (conexão e saudação) e 10 s (socket), então o pior caso é de algumas dezenas de segundos.
   `ErroEmailPermanente` (endereço inválido, SMTP respondeu 5xx) não repete.
9. **Nunca segure uma requisição HTTP no SMTP**: dentro de rota/handler use `ServicoEmail.disparar(m)` (devolve na hora,
   envia em segundo plano com o retry, só loga a falha mascarada, **nunca lança**). `ServicoEmail.enviar(m)` espera o
   resultado e lança se esgotar: use em rotinas e scripts. Resposta ao usuário nunca depende do SMTP (e não revela se o
   e-mail existe: skill `seguranca`, regra 10). **Limite** (só sem a skill `fila-de-tarefas`): o e-mail de um `disparar` ainda em andamento se perde se o processo for encerrado (deploy, reinício); para e-mail que não pode
   se perder, use `enviar` numa rotina que registre o resultado, ou aplique a skill `fila-de-tarefas` (regra 10), que resolve isso.
10. **Quando a skill `fila-de-tarefas` for aplicada**, o `disparar` grava o e-mail na fila (tarefa `email-enviar`: 5 tentativas, espera de 5 s que dobra, alerta em falha definitiva, `chave` opcional contra envio duplicado) e o limite da regra 9 deixa de existir: a mensagem sobrevive a reinício e deploy. `ErroEmailPermanente` não repete. `ServicoEmail.enviar` continua direto (retry de `enviar-com-retry.ts`, 3 tentativas), para rotinas e para o alerta. A skill de fila substitui `servico-email.ts`; até lá, vale o que está aqui.
11. **Mailpit no compose de dev** (`docker-compose.yml`, serviço `mailpit`): imagem `axllent/mailpit:v1.31.6` (versão
    fixa, nunca `latest`), portas só em `127.0.0.1`: SMTP `1025`, interface web `8025`. O `.env.example` de dev já aponta
    para ele (`MAIL_MODE=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1025`). Nunca exponha o Mailpit em servidor.
12. **Modelo de e-mail com a identidade visual** (`email/modelo-email.ts`): `montarEmail(titulo, corpoHtml): { html, texto }`.
    Cores em **hex inline** (clientes de e-mail ignoram CSS externo, `<style>` e variáveis CSS), valores do tema claro de
    `tokens.css` (skill `identidade-visual`): primária `#2F6FED`, navy `#001A33`, fundo `#F5F7FA`, superfície `#FFFFFF`,
    borda `#DEE6EF`, texto `#172B43`, texto 3 `#8A97A8`. Layout em tabela de 600 px, sem imagem externa, sem script.
    Título escapado; dado de usuário no corpo passa por `escaparHtml`; link em `botaoHtml(rotulo, url)` (só `http(s)`).
    A versão texto é gerada do HTML: sem tag, links viram `rótulo (url)`.
13. **Testes** (todos no modelo): `MAIL_MODE=log` + produção lança; `EnviadorSmtp` com o transporte de teste do nodemailer
    e **contra um Mailpit real** (Testcontainers, `test/email.e2e.spec.ts`); `montarEmail` contém `#2F6FED` e o texto não tem tags;
    log e erro sem corpo e sem endereço completo; retry (3 tentativas, espera crescente, permanente não repete).

## Como aplicar

Pré-requisito: esqueleto da skill `novo-projeto-multiplica`, mais `identidade-visual` e `seguranca` aplicadas
(nesta ordem), e `pnpm test` passando. Ao copiar um arquivo de `referencia/`, mantenha o mesmo caminho relativo e
**apague a 1ª linha** (`origem: ...`).

**Projeto no esqueleto:**

1. Dependências em `apps/api` (versões exatas): `pnpm --filter api add -E nodemailer@10.3.1`, depois
   `pnpm --filter api add -D -E @types/nodemailer@8.0.2 testcontainers@12.2.1`.
2. TDD — copie **primeiro** os testes: `apps/api/src/email/config-email.spec.ts`, `enviador-email.spec.ts`,
   `enviar-com-retry.spec.ts`, `modelo-email.spec.ts` e `apps/api/test/email.e2e.spec.ts`. Rode `pnpm --filter api test`:
   tem de falhar (módulos e variáveis inexistentes).
3. Código novo: copie `apps/api/src/email/enviador-email.ts`, `enviar-com-retry.ts`, `servico-email.ts`,
   `email.module.ts` e `modelo-email.ts`.
4. Arquivos do esqueleto. Se o arquivo ainda é o da etapa anterior, **substitua** pelo da referência; se outra skill
   mexeu nele, faça **só** a mudança descrita:
   - `apps/api/src/config/config.ts`: o bloco `MAIL_MODE`...`EMAIL_REMETENTE` no fim do `esquemaBase` e o
     `esquemaConfig = esquemaBase.superRefine(...)` com as regras entre variáveis. A referência é o arquivo completo
     **depois da skill `seguranca`** (traz `CORS_ORIGENS`, `LIMITE_REQ_POR_IP`, `PROXIES_CONFIAVEIS`).
   - `apps/api/src/app.module.ts`: `import { EmailModule } ...` e `EmailModule` nos `imports`, depois do `BancoModule`.
     A referência importa `SegurancaModule` de `./seguranca/seguranca.module` (skill `seguranca`, `referencia/apps/api/src/seguranca/seguranca.module.ts`).
   - `docker-compose.yml`: o serviço `mailpit` (regra 11).
   - `.env.example` e `deploy/.env.example`: o bloco "E-mail" do fim.
5. Rode `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: passa (o teste e2e precisa do Docker).
6. Veja funcionando: `docker compose up -d mailpit`, `cp .env.example .env` (se ainda não existe), suba a API e
   mande um e-mail pelo `ServicoEmail`; abra http://localhost:8025 e confira a mensagem renderizada.
7. Uso no código de negócio:

   ```ts
   const { html, texto } = montarEmail('Seu código de acesso', `<p>Use o código <strong>${escaparHtml(codigo)}</strong>.</p>`);
   this.email.disparar({ para: usuario.email, assunto: 'Seu código de acesso', html, texto });
   ```

   O assunto é texto fixo (regra 6). O `ServicoEmail` vem do `EmailModule`: importe-o no módulo que envia.
8. Em produção: `MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SEGURO`, `EMAIL_REMETENTE` e, se o servidor exige
   login, `SMTP_USUARIO` + `SMTP_SENHA_ARQUIVO`. Remetente num domínio do cliente com SPF e DKIM configurados pela TI
   (sem isso o e-mail cai em spam). Teste um envio real antes de entregar.

**Projeto existente fora do esqueleto** (outro framework ou sem NestJS): não reescreva o sistema. Aplique o que
independe de stack: uma interface de envio com duas implementações (SMTP e log) escolhidas por `MAIL_MODE`; recusa do
modo `log` em produção no carregamento da configuração; senha do SMTP por arquivo/segredo; mascarar o endereço nos
logs e nunca logar o corpo; validar `para`/`assunto` contra quebra de linha; retry de 3 tentativas com espera
crescente e prazos curtos; envio fora da requisição; Mailpit (`axllent/mailpit` com versão fixa, portas em `127.0.0.1`)
no compose de dev; e o modelo com as cores da regra 12 em `style` inline (`modelo-email.ts` é puro TypeScript e
pode ser copiado como está). Registre no `CLAUDE.md` onde ficou cada coisa.

**Ao terminar:** acrescente `email-transacional` em "Skills Multiplica aplicadas" do `CLAUDE.md` e as variáveis de
e-mail em "Variáveis de ambiente".

## Referências

Tudo que um arquivo de `referencia/` importa está em `referencia/` ou nas skills anteriores: `novo-projeto-multiplica`
(`apps/api/src/config/config.module.ts` com `CONFIG`, `config/segredo.ts`, `criar-app.ts`, `test/postgres.ts`,
`test/setup-global.ts`, `test/env-documentadas.spec.ts`, `docker-compose.yml` com o Postgres) e `seguranca`
(`apps/api/src/seguranca/seguranca.module.ts`, importado pelo `app.module.ts`).

- `referencia/apps/api/src/email/enviador-email.ts` — interface, `EnviadorSmtp`, `EnviadorLog`, `mascararEmail`, `ErroEmailPermanente` (regras 1 a 7); passo 3.
- `referencia/apps/api/src/email/enviar-com-retry.ts` — 3 tentativas com espera crescente (regra 8); passo 3.
- `referencia/apps/api/src/email/servico-email.ts` — `enviar` e `disparar` (regra 9); passo 3 e ao enviar e-mail em qualquer rota.
- `referencia/apps/api/src/email/email.module.ts` — escolhe o enviador por `MAIL_MODE`; passo 3 e ao importar em outro módulo.
- `referencia/apps/api/src/email/modelo-email.ts` — `montarEmail`, `botaoHtml`, `escaparHtml`, cores (regra 12); passo 3 e ao criar qualquer mensagem.
- `referencia/apps/api/src/email/*.spec.ts`, `referencia/apps/api/test/email.e2e.spec.ts` — testes de unidade e contra o Mailpit (regra 13); passo 2.
- `referencia/apps/api/src/config/config.ts` — schema com as variáveis de e-mail e as regras entre elas (regras 3 e 4); passo 4.
- `referencia/apps/api/src/app.module.ts` — onde o `EmailModule` entra; passo 4.
- `referencia/docker-compose.yml` — serviço `mailpit` (regra 11); passo 4.
- `referencia/.env.example`, `referencia/deploy/.env.example` — variáveis documentadas; passo 4.

## Checklist de pronto

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem limpos (inclui `email.e2e.spec.ts` contra o Mailpit).
- [ ] `NODE_ENV=production` com `MAIL_MODE=log` (ou sem `MAIL_MODE`) faz a API recusar subir, citando `MAIL_MODE`.
- [ ] `docker compose up -d mailpit`: a mensagem enviada pelo sistema aparece em http://localhost:8025 com a faixa navy, a borda `#2F6FED` e a versão texto sem tags.
- [ ] `docker compose ps` mostra o Mailpit em `127.0.0.1:1025` e `127.0.0.1:8025`, com tag de versão (não `latest`).
- [ ] Nenhum log tem o corpo do e-mail nem um endereço completo (só `a***@exemplo.com.br`); o assunto não leva código nem link.
- [ ] `SMTP_SENHA` é `Segredo`, vem de arquivo em produção e não aparece em `JSON.stringify(config)`.
- [ ] Rotas HTTP usam `disparar` (nunca esperam o SMTP) e respondem igual para e-mail existente ou não.
- [ ] Em produção: um envio real foi testado e o SPF/DKIM do domínio do remetente foi confirmado com a TI do cliente.
- [ ] `email-transacional` listada em "Skills Multiplica aplicadas" no `CLAUDE.md`.
