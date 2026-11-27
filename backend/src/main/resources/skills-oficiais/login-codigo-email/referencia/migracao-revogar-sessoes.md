# Migração que revoga sessões (gatilho no banco)

Mudar o `papel` ou o `ativo` de um usuário revoga **todas** as sessões dele, venha a mudança da tela de usuários, do
administrador inicial ou de um `UPDATE` direto no banco. Reativar alguém não ressuscita sessão antiga. É um gatilho do
Postgres porque assim vale para qualquer caminho, sem a skill `usuarios-e-papeis` precisar conhecer a tabela `sessao`.

O drizzle-kit não gera gatilho a partir do esquema: crie uma migração vazia com nome fixo e cole o SQL abaixo.

```bash
pnpm --filter api exec drizzle-kit generate --custom --name=revogar_sessoes
```

Ele cria `apps/api/drizzle/<número>_revogar_sessoes.sql` (no modelo, `0002`). Substitua o conteúdo por:

<!-- arquivo: skills-modelo/apps/api/drizzle/0002_revogar_sessoes.sql -->
```sql
-- Skill login-codigo-email: mudar o papel ou o "ativo" de um usuário revoga todas as sessões dele, venha a mudança da
-- tela de usuários, do admin inicial ou de um UPDATE direto. Reativar não ressuscita sessão antiga: é preciso entrar de novo.
CREATE OR REPLACE FUNCTION revogar_sessoes_do_usuario() RETURNS trigger AS $$
BEGIN
  UPDATE sessao SET revogada = true WHERE usuario_id = NEW.id AND revogada = false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER usuario_revoga_sessoes
AFTER UPDATE OF papel, ativo ON usuario
FOR EACH ROW
WHEN (OLD.papel IS DISTINCT FROM NEW.papel OR OLD.ativo IS DISTINCT FROM NEW.ativo)
EXECUTE FUNCTION revogar_sessoes_do_usuario();
```

Confira com `pnpm --filter api test`: os testes "trocar o papel ... revoga todas as sessões" e "desativar e reativar não
ressuscita a sessão antiga" de `apps/api/test/auth.e2e.spec.ts` falham sem esta migração.
