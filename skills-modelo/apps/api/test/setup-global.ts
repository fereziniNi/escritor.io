import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** URL de administração do Postgres de teste (banco "postgres"), usada por test/postgres.ts. */
    postgresAdminUrl: string;
  }
}

/**
 * Sobe um Postgres 16 (Docker, via Testcontainers) uma vez por bateria de testes. Com TEST_POSTGRES_URL definida
 * (ex.: serviço postgres da CI), usa esse servidor e não sobe container.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const externo = process.env['TEST_POSTGRES_URL'];
  if (externo) {
    project.provide('postgresAdminUrl', externo);
    return async () => {};
  }
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine').start();
  project.provide('postgresAdminUrl', container.getConnectionUri());
  return async () => {
    await container.stop();
  };
}
