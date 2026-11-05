import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as esquema from './esquema';

export type Db = NodePgDatabase<typeof esquema> & { $client: Pool };

/** Token de injeção do banco no Nest (`@Inject(BANCO) db: Db`). */
export const BANCO = Symbol('BANCO');

/**
 * Conexão Drizzle (node-postgres) com pool. `db.$client` é o Pool: feche com `db.$client.end()` no desligamento.
 * Erros de conexão ociosa são só registrados no pool (sem derrubar o processo); a consulta seguinte reconecta.
 */
export function criarBanco(url: string): Db {
  const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5_000 });
  pool.on('error', () => {
    // Conexão ociosa caiu (ex.: Postgres reiniciou). O pool descarta e abre outra na próxima consulta.
  });
  return drizzle({ client: pool, schema: esquema });
}
