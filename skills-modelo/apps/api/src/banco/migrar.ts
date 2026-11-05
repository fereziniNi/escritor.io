import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { criarBanco } from './banco';

/** Pasta das migrações geradas pelo drizzle-kit (apps/api/drizzle), a partir de src/banco ou dist/banco. */
export const PASTA_MIGRACOES = path.resolve(__dirname, '..', '..', 'drizzle');

/** Aplica as migrações pendentes. Idempotente: o Drizzle registra as aplicadas em drizzle.__drizzle_migrations. */
export async function migrarBanco(url: string): Promise<void> {
  const db = criarBanco(url);
  try {
    await migrate(db, { migrationsFolder: PASTA_MIGRACOES });
  } finally {
    await db.$client.end();
  }
}
