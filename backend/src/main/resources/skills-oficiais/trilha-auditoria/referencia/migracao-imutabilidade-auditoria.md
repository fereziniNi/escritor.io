# Migração da imutabilidade e dos dois papéis de banco

Depois da migração que cria a tabela (`pnpm --filter api db:generate` com `--name=evento_auditoria`), uma segunda migração
**à mão** (o drizzle-kit não gera gatilho nem privilégio) faz a trilha só crescer:

1. um **gatilho** que bloqueia UPDATE, DELETE e TRUNCATE em `evento_auditoria` para qualquer papel, inclusive o dono;
2. o papel de banco de **runtime** `app_runtime`, com tudo menos UPDATE, DELETE e TRUNCATE na trilha.

Por que dois papéis: o **dono** de uma tabela ignora qualquer `REVOKE` contra si mesmo. Se a API usar o mesmo usuário que
roda as migrações (o dono), o `REVOKE` não vale nada. Então o dono (`DATABASE_URL`) só roda migrações; a API conecta como
`app_runtime` (`DATABASE_URL_RUNTIME`), que não é dono de nada. O gatilho é a segunda camada: protege também quando só
existe um usuário (desenvolvimento) e contra um `UPDATE` acidental feito de um console SQL como dono. (Mesma ideia da
ADR 0009 do escritor.io, que separa o papel de migração do papel de runtime.)

Crie a migração vazia e cole o SQL abaixo:

```bash
pnpm --filter api exec drizzle-kit generate --custom --name=imutabilidade_auditoria
```

Ela cria `apps/api/drizzle/<número>_imutabilidade_auditoria.sql` (no modelo, `0004`). Substitua o conteúdo por:

<!-- arquivo: skills-modelo/apps/api/drizzle/0004_imutabilidade_auditoria.sql -->
```sql
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
```

## Depois de migrar: dar login ao papel de runtime (uma vez por banco)

A migração cria `app_runtime` **sem login e sem senha** (não existe senha no código). Quem instala define a senha, como o
dono do banco, e a coloca em `DATABASE_URL_RUNTIME`:

```bash
# desenvolvimento (senha de brinquedo; só no seu computador)
docker compose exec postgres psql -U app -d app -c "ALTER ROLE app_runtime LOGIN PASSWORD 'app_runtime'"
# produção: senha gerada (openssl rand -hex 24), guardada no segredo do compose, nunca no git nem no histórico
docker compose exec -it postgres psql -U app -d app   # e dentro dele: password app_runtime
```

Se o dono não puder criar papéis (`CREATEROLE`), peça à TI para criar `app_runtime` antes da migração; ela só cria se não existir.

## Tabelas de migrações futuras

`ALTER DEFAULT PRIVILEGES` faz toda tabela criada depois, pelo mesmo dono, já nascer com SELECT/INSERT/UPDATE/DELETE para o
`app_runtime`: nenhuma migração futura precisa de `GRANT`. Para proteger outra tabela do mesmo jeito, copie o gatilho e o
`REVOKE` desta migração para o nome dela.

Confira com `pnpm --filter api test`: em `apps/api/test/auditoria.e2e.spec.ts`, "papel de runtime: UPDATE, DELETE e TRUNCATE
falham com permissão negada" e "o próprio dono também não consegue" falham sem esta migração.
