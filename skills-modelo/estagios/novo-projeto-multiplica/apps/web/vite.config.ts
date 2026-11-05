import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    // Em dev a web chama /api no mesmo host (como em produção, onde a API serve o SPA): o Vite encaminha para a API.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
