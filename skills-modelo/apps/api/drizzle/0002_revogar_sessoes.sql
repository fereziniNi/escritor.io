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
