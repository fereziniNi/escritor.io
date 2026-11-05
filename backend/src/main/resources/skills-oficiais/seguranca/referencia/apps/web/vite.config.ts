// origem: skills-modelo/apps/web/vite.config.ts
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  build: {
    // Fonte nunca vira data: embutida no CSS: a CSP de produção (deploy/caddy/seguranca.caddy) só aceita
    // font-src 'self'. Os demais arquivos pequenos seguem a regra padrão do Vite (img-src aceita data:).
    assetsInlineLimit: (arquivo) => (/\.(woff2?|ttf|otf|eot)$/.test(arquivo) ? false : undefined),
  },
  server: {
    port: 5173,
    // Em dev a web chama /api no mesmo host (como em produção, onde a API serve o SPA): o Vite encaminha para a API.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
