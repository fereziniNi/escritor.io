import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** URL de administração do Postgres de teste (banco "postgres"), usada por test/postgres.ts. */
    postgresAdminUrl: string;
  }
}

/** Senha do papel app_runtime nos testes (o papel de runtime da skill trilha-auditoria; test/postgres.ts monta a URL dele). */
const SENHA_RUNTIME_TESTE = 'runtime-de-teste';

/**
 * Dá login ao papel app_runtime UMA vez por servidor, antes de qualquer teste (papel é do servidor inteiro: criar em cada
 * arquivo de teste, em paralelo, daria corrida). As migrações só criam o papel se ele não existir e dão os privilégios.
 */
async function prepararPapelRuntime(urlAdmin: string): Promise<void> {
  const pool = new Pool({ connectionString: urlAdmin, max: 1 });
  try {
    await pool.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN ALTER ROLE app_runtime LOGIN PASSWORD '${SENHA_RUNTIME_TESTE}';
      ELSE CREATE ROLE app_runtime LOGIN PASSWORD '${SENHA_RUNTIME_TESTE}'; END IF; END $$`);
  } finally {
    await pool.end();
  }
}

/**
 * Sobe um Postgres 16 (Docker, via Testcontainers) uma vez por bateria de testes. Com TEST_POSTGRES_URL definida
 * (ex.: serviço postgres da CI), usa esse servidor e não sobe container.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const externo = process.env['TEST_POSTGRES_URL'];
  if (externo) {
    await prepararPapelRuntime(externo);
    project.provide('postgresAdminUrl', externo);
    return async () => {};
  }
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine').start();
  await prepararPapelRuntime(container.getConnectionUri());
  project.provide('postgresAdminUrl', container.getConnectionUri());
  return async () => {
    await container.stop();
  };
}
