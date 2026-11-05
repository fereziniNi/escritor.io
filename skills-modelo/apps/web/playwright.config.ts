import { defineConfig, devices } from '@playwright/test';

// Ponta a ponta no navegador: sobe o build da web (vite preview) e simula a API com page.route nos testes.
// Rodar: pnpm --filter web build && pnpm --filter web e2e  (precisa de `pnpm exec playwright install chromium` uma vez).
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'pnpm preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env['CI'] },
});
