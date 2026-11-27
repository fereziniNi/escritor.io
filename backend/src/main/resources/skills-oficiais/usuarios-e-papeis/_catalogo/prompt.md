Use a skill usuarios-e-papeis para criar o controle de usuários e papéis neste sistema Multiplica.
Siga o Padrão Multiplica à risca e em TDD: copie os testes primeiro, veja falhar, depois o código.
Crie a tabela usuario (e-mail único em minúsculas), o enum ADMIN, GESTOR e USUARIO, o decorator @Papeis com o guard e a checagem de papel e de dono dentro do serviço.
Implemente convidar por e-mail, trocar papel, desativar e reativar (nunca apagar), a proteção do último ADMIN e o primeiro administrador por ADMIN_INICIAL_EMAIL.
Deixe o contrato req.usuario pronto para a skill de login e crie a tela TelaUsuarios na área Admin.
No fim, rode pnpm lint, pnpm typecheck, pnpm test e pnpm build e mostre o checklist de pronto.
