Use a skill trilha-auditoria para criar a trilha de auditoria deste sistema Multiplica.
Siga o Padrão Multiplica à risca e em TDD: copie os testes primeiro, veja falhar, depois o código.
Crie a tabela evento_auditoria que só cresce (gatilho que bloqueia UPDATE, DELETE e TRUNCATE e REVOKE para o papel de banco app_runtime), com a API usando DATABASE_URL_RUNTIME e as migrações usando o dono.
Implemente o AuditoriaService.registrar (IP e request-id do contexto, mesma transação da mudança, sem código, token ou dado pessoal em claro) e ligue o login e as ações de usuários a ele.
Crie GET /api/admin/auditoria só para ADMIN com filtros de período, ator e ação, a exportação CSV e a tela TelaAuditoria.
No fim, rode pnpm lint, pnpm typecheck, pnpm test e pnpm build, prove que o papel de runtime não consegue UPDATE nem DELETE e mostre o checklist de pronto.
