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
          '/admin',
          '/usuarios',
          '/equipes',
          '/projetos',
          '/escala',
          '/integracoes',
          '/ponto',
          '/ajustes',
          '/quadros',
          '/colunas',
          '/cards',
          '/apontamentos',
          '/mapas',
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
    // react-reconciler é importado por @pixi/react (mundo do Escritório, redesign estilo Gather)
    // sem extensão de arquivo (`react-reconciler/constants`) - resolve normal no build/dev do Vite,
    // mas a resolução nativa de módulos do Vitest recusa o bare specifier sem extensão. Forçar esses
    // pacotes a passar pelo pipeline de transform do Vite (em vez da resolução nativa do Node) resolve.
    server: {
      deps: {
        inline: ['@pixi/react', 'pixi.js', 'react-reconciler'],
      },
    },
  },
})
