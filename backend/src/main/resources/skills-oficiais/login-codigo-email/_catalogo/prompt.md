Use a skill login-codigo-email para implementar o login por código no e-mail neste sistema Multiplica.
Siga o Padrão Multiplica à risca e em TDD: copie os testes primeiro, veja falhar, depois o código.
Use os valores fixos da skill (6 dígitos, HMAC-SHA256, 10 minutos, 5 tentativas, 3 pedidos por e-mail a cada 10 minutos, resposta idêntica com 600 ms, cookie __Host-sessao, sessão de 30 minutos ociosa e 12 horas no máximo).
Ligue o login ao req.usuario da skill usuarios-e-papeis, troque o usuário fixo da web pelo de /api/auth/eu e coloque a tela de entrada e o botão Sair.
No fim, rode pnpm lint, pnpm typecheck, pnpm test, pnpm build e o teste de login de verdade com o Mailpit, e mostre o checklist de pronto preenchido.
