// origem: skills-modelo/apps/api/vitest.config.mts
import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emite a metadata dos decorators (injeção de dependência do Nest), que o esbuild do Vite não emite.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    // Usa o código-fonte do pacote de contratos (sem precisar do build dele para testar).
    alias: { contratos: path.resolve(import.meta.dirname, '../../packages/contratos/src/index.ts') },
  },
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    environment: 'node',
    // Um Postgres 16 (Testcontainers) por bateria; cada arquivo de teste cria o próprio banco nele (test/postgres.ts).
    globalSetup: ['test/setup-global.ts'],
    testTimeout: 15_000,
    hookTimeout: 120_000,
  },
});
