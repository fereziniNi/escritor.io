-- Papel de runtime da aplicação, separado do papel que roda as migrações (dono das tabelas).
-- No Postgres, o dono de uma tabela sempre ignora REVOKE contra si mesmo - então, para o
-- REVOKE UPDATE/DELETE em registro_ponto valer alguma coisa (ver V8__create_registro_ponto.sql),
-- a aplicação em runtime precisa se conectar com um papel diferente do que criou a tabela.
--
-- Este script roda ANTES de qualquer migração Flyway: via docker-entrypoint-initdb.d no
-- docker-compose (dev) e via Testcontainers .withInitScript(...) nos testes. Por isso o
-- ALTER DEFAULT PRIVILEGES abaixo já cobre toda tabela futura criada pelo papel de migração,
-- sem precisar conceder retroativamente tabela por tabela.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'presenca_app') THEN
        CREATE ROLE presenca_app LOGIN PASSWORD 'presenca_app';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO presenca_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO presenca_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO presenca_app;
