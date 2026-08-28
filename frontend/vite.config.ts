/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
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
      ].map((path) => [path, process.env.VITE_BACKEND_URL ?? 'http://localhost:8080']),
    ),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    pool: 'threads',
  },
})
