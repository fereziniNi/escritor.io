import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Login de ponta a ponta DE VERDADE (sem simular a API): a API compilada aplica as migrações, sobe servindo o build da
// web e manda o código pelo SMTP do Mailpit; o teste lê o código na API do Mailpit e entra pela tela.
// Pré-requisitos (na raiz do projeto): docker compose up -d postgres mailpit && pnpm build
// Rodar (em apps/web): pnpm exec playwright test -c e2e/login-real.config.ts
// Banco: use um banco novo (ou um em que ADMIN_INICIAL_EMAIL ainda vire o administrador), porque o teste entra com ele.
// Portas e endereços mudam por variável: E2E_PORTA_API, E2E_DATABASE_URL, E2E_SMTP_PORTA, E2E_URL_MAILPIT, E2E_EMAIL.
const porta = process.env['E2E_PORTA_API'] ?? '3100';
process.env['E2E_LOGIN_REAL'] = '1';

export default defineConfig({
  testDir: '.',
  testMatch: 'login-real.spec.ts',
  use: { baseURL: `http://localhost:${porta}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node dist/banco/executar-migracoes.js && node dist/main.js',
    cwd: path.resolve(import.meta.dirname, '../../api'),
    url: `http://localhost:${porta}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      // development: em http://localhost o cookie é "sessao" sem Secure (em produção é __Host-sessao com Secure).
      NODE_ENV: 'development',
      PORT: porta,
      LOG_LEVEL: 'warn',
      DATABASE_URL: process.env['E2E_DATABASE_URL'] ?? 'postgres://app:app@localhost:5432/app',
      MAIL_MODE: 'smtp',
      SMTP_HOST: 'localhost',
      SMTP_PORT: process.env['E2E_SMTP_PORTA'] ?? '1025',
      EMAIL_REMETENTE: 'Sistema <nao-responda@exemplo.com.br>',
      WEB_DIST: path.resolve(import.meta.dirname, '../dist'),
      ADMIN_INICIAL_EMAIL: process.env['E2E_EMAIL'] ?? 'admin@exemplo.com.br',
      AUTH_DOMINIOS_PERMITIDOS: 'exemplo.com.br',
    },
  },
});
