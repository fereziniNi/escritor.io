# Tutorial — Fila de tarefas em segundo plano

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **fila-de-tarefas**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/fila-de-tarefas/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### Como funciona para quem usa o sistema

Quase nada muda na tela: o sistema responde mais rápido, porque o que é lento (mandar e-mail, gerar relatório, rotinas da noite) passa a ser feito
"por trás" por um segundo programa, o **worker**. Se o servidor de e-mail estiver fora do ar, o sistema continua tentando sozinho (5 vezes, esperando cada vez mais)
e **não perde** a mensagem nem quando o sistema é atualizado no meio. Se uma tarefa desistir de vez, a TI recebe um e-mail avisando qual foi (sem nenhum dado
de cliente). Todo dia às 03:00 (horário de Brasília) o sistema aplica a regra de retenção da LGPD.

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica` até `lgpd-dados-pessoais` já aplicadas, mais `exportacao-excel-pdf-csv` e `upload-armazenamento` se o sistema usa (usa e-mail, auditoria e LGPD) | `ls apps/api/src/lgpd` ou `dir apps\api\src\lgpd` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | qualquer versão recente (Postgres e Mailpit dos testes) | `docker version` |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `ROLE` | em produção | `worker` | o que o processo faz: `api` (atende e enfileira), `worker` (executa tarefas e rotinas), `tudo` (os dois, padrão só em desenvolvimento) ou `migrar` (prepara o banco e a fila e termina) |
| `ALERTA_EMAIL` | em produção, para `worker` e `tudo` | `ti@grupomultiplica.com.br` | quem recebe o aviso de tarefa que falhou de vez (um endereço só) |
| `FILA_ENCERRAR_TIMEOUT_S` | não (padrão 30) | `30` | quantos segundos o desligamento espera as tarefas em andamento terminarem |
| `DATABASE_URL` / `DATABASE_URL_RUNTIME` | já existem | `(das skills anteriores)` | o dono cria o schema da fila; o papel de runtime só lê e grava |

### Dependências

Um pacote novo na API: `pg-boss` (versão `11.1.2`). Nenhum serviço novo em desenvolvimento: a fila usa o mesmo Postgres (schema `fila`, criado sozinho).
Em produção entram dois serviços no compose (`migracao` e `worker`): o arquivo `referencia/instalacao-fila.md` diz como.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro (o Docker precisa estar aberto: os testes
   sobem Postgres e Mailpit temporários; a bateria da fila leva cerca de 1 minuto porque espera as tentativas).
3. Veja de verdade (bash, Git Bash, macOS, Linux e PowerShell são iguais aqui):
   ```bash
   docker compose up -d postgres mailpit
   pnpm --filter api db:migrate
   pnpm dev
   ```
   Entre como administrador, convide um usuário novo e abra http://localhost:8025: o e-mail está lá, enviado pela fila. Para ver a fila por dentro:
   - bash / Git Bash: `docker compose exec postgres psql -U app -d app -c "select name, state, retry_count from fila.job order by created_on desc limit 5;"`
   - PowerShell: o mesmo comando, entre aspas simples por fora: `docker compose exec postgres psql -U app -d app -c 'select name, state, retry_count from fila.job order by created_on desc limit 5;'`
4. Teste a resistência: pare o Mailpit (`docker compose stop mailpit`), convide outra pessoa, espere alguns segundos, suba o Mailpit (`docker compose start mailpit`):
   a mensagem chega sozinha, sem novo convite.
5. Em produção, confirme que existem os serviços `migracao` (terminou com sucesso) e `worker` (rodando) e que `stop_grace_period` do `worker` é maior que `FILA_ENCERRAR_TIMEOUT_S`.

### Se não funcionar

- **A API não sobe e o erro cita `ROLE`**: fora de desenvolvimento a variável é obrigatória. Defina `ROLE=api` (e um serviço `worker` com `ROLE=worker`) ou `ROLE=tudo`.
- **O worker não sobe e o erro cita `ALERTA_EMAIL`**: em produção quem executa tarefas precisa de um endereço para o aviso de falha.
- **O erro diz que o schema `fila` está ausente ou sem permissão**: o passo de migração não rodou. Suba o serviço `migracao` (`ROLE=migrar`) ou rode
  `pnpm --filter api fila:migrar` com o usuário dono do banco, depois de `db:migrate`.
- **Acrescentei uma tarefa nova e ela não executa em produção**: o nome precisa estar em `fila/catalogo.ts` e o serviço `migracao` precisa rodar de novo (cria a fila).
- **O e-mail demora para sair depois de uma falha**: é o esperado, a espera dobra a cada tentativa (5, 10, 20, 40 segundos).
- **Chegou o e-mail "Falha definitiva em tarefa da fila"**: copie o id do job e procure no log do worker (`docker compose logs worker | grep <id>`); a mensagem do erro está lá.
- **Recebi o mesmo e-mail duas vezes depois de um reinício**: a fila entrega "pelo menos uma vez". Para tarefas que não podem repetir efeito, envie com `chave`.

Próximo passo: seguir a ordem de skills indicada pelo Claude Code.
