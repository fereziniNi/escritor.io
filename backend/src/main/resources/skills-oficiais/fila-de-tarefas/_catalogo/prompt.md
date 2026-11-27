Use a skill fila-de-tarefas para tirar trabalho de dentro da requisição deste sistema Multiplica.
Siga o Padrão Multiplica à risca e em TDD: copie os testes primeiro, veja falhar, depois o código.
Use o pg-boss 11.1.2 no mesmo Postgres (schema fila); registre cada tarefa com registrarTarefa (5 tentativas, backoff) e no catalogo.ts, e envie com chave quando o efeito não puder duplicar.
Rode o schema da fila com o dono do banco (ROLE=migrar) e deixe o runtime só com DML; configure ROLE (api, worker, tudo) e ALERTA_EMAIL, sem dado pessoal no alerta nem no payload.
Passe o envio de e-mail pela fila e agende a retenção da LGPD (03:00, America/Sao_Paulo).
No fim, rode pnpm lint, pnpm typecheck, pnpm test e pnpm build e mostre o checklist de pronto.
