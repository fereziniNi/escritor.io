-- Skill trilha-auditoria: a trilha só cresce, em duas camadas, e a API passa a rodar com um papel de banco sem poder de dono.
--
-- 1) Gatilho: UPDATE, DELETE e TRUNCATE em evento_auditoria falham para QUALQUER papel, inclusive o dono das tabelas.
CREATE FUNCTION evento_auditoria_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'evento_auditoria é imutável (% bloqueado)', TG_OP USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER evento_auditoria_sem_alteracao
BEFORE UPDATE OR DELETE ON evento_auditoria
FOR EACH ROW EXECUTE FUNCTION evento_auditoria_imutavel();
--> statement-breakpoint
CREATE TRIGGER evento_auditoria_sem_truncate
BEFORE TRUNCATE ON evento_auditoria
FOR EACH STATEMENT EXECUTE FUNCTION evento_auditoria_imutavel();
--> statement-breakpoint
-- 2) Dois papéis de banco. O DONO (quem roda esta migração) cria e altera tabelas e nunca atende requisição. O papel de
-- RUNTIME app_runtime é o que a API usa (DATABASE_URL_RUNTIME): lê e grava os dados, mas não é dono de nada, então um
-- REVOKE contra ele vale (o dono ignora REVOKE contra si mesmo). O papel nasce SEM login e SEM senha: quem instala
-- define a senha uma vez (ALTER ROLE app_runtime LOGIN PASSWORD '...'). Se o dono não puder criar papéis
-- (CREATEROLE), peça à TI para criar o papel app_runtime antes: a migração só o cria se ele não existir.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN;
  END IF;
EXCEPTION WHEN duplicate_object OR unique_violation THEN
  NULL; -- duas migrações em paralelo (testes) criaram ao mesmo tempo: o papel já existe
END;
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
--> statement-breakpoint
-- Tabelas e sequências criadas por migrações futuras (pelo mesmo dono) já nascem com estes privilégios.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
--> statement-breakpoint
-- A trilha: o runtime só lê e insere.
REVOKE UPDATE, DELETE, TRUNCATE ON evento_auditoria FROM app_runtime;
