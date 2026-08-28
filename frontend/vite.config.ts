/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      ...Object.fromEntries(
        [
          '/health',
          '/auth',
          '/usuarios',
          '/equipes',
          '/projetos',
          '/ponto',
          '/ajustes',
          '/quadros',
          '/colunas',
          '/cards',
          '/apontamentos',
        ].map((path) => [path, process.env.VITE_BACKEND_URL ?? 'http://localhost:8080']),
      ),
      // /ws precisa de ws: true - é upgrade de conexão (S3.11), não request HTTP normal como
      // os prefixos acima, então não dá pra ficar na mesma lista de string->target.
      '/ws': {
        target: process.env.VITE_BACKEND_URL ?? 'http://localhost:8080',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    pool: 'threads',
  },
})
