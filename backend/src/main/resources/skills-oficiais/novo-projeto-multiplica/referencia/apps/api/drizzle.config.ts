// origem: skills-modelo/apps/api/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

// Só para `db:generate` (gera o SQL a partir de src/banco/esquema.ts). As migrações são aplicadas por src/banco/migrar.ts.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/banco/esquema.ts',
  out: './drizzle',
});
