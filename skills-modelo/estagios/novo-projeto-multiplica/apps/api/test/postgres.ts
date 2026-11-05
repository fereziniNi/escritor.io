import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { inject } from 'vitest';
import { migrarBanco } from '../src/banco/migrar';

export interface PostgresDeTeste {
  /** URL do banco novo, já com as migrações aplicadas. */
  url: string;
  /** Apaga o banco (chame no afterAll). */
  parar: () => Promise<void>;
}

async function executar(urlAdmin: string, sql: string): Promise<void> {
  const pool = new Pool({ connectionString: urlAdmin, max: 1 });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

/**
 * Cria um banco vazio e isolado no Postgres de teste (Testcontainers, test/setup-global.ts), aplica as migrações de
 * apps/api/drizzle e devolve a URL. Cada arquivo de teste chama no beforeAll; os testes não dividem dados.
 */
export async function subirPostgres(): Promise<PostgresDeTeste> {
  const urlAdmin = inject('postgresAdminUrl');
  const nome = `teste_${randomUUID().replaceAll('-', '')}`;
  await executar(urlAdmin, `CREATE DATABASE ${nome}`);
  const url = new URL(urlAdmin);
  url.pathname = `/${nome}`;
  await migrarBanco(url.toString());
  return {
    url: url.toString(),
    parar: () => executar(urlAdmin, `DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`),
  };
}
