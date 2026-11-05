Use a skill email-transacional para ligar o envio de e-mail neste sistema Multiplica.
Siga o Padrão Multiplica à risca e em TDD: copie os testes primeiro, veja falhar, depois o código.
Use a interface EnviadorEmail com SMTP (nodemailer) e modo log, escolhidos por MAIL_MODE; em produção o modo log deve ser recusado.
Adicione o Mailpit (versão fixa, portas em 127.0.0.1) ao docker-compose.yml de dev e monte os e-mails com montarEmail e as cores da identidade visual.
Nas rotas, envie com ServicoEmail.disparar; nunca registre o corpo do e-mail nem o endereço completo, e nunca ponha código ou link no assunto.
No fim, rode pnpm lint, pnpm typecheck, pnpm test e pnpm build, confira o e-mail no Mailpit (http://localhost:8025) e mostre o checklist de pronto.
